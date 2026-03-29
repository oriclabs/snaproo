const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// Pixeroo Side Panel - Shared Globals & Utilities

let allImages = [];
let selectedSet = new Set();
let currentView = 'tiles';
let currentFilter = 'all';
let currentSort = 'position';
let overlayImage = null;

let favColors = [];
let recentPicks = [];
let pagePalette = [];
let contrastFg = '#ffffff';
let contrastBg = '#000000';
let contrastTarget = null; // 'fg' or 'bg'
let showTooltips = true;

let typeFilterSet = null; // null = all types, Set = specific types
let editorTabActive = false;
let eyedropperActive = false;
let lastScreenshotDataUrl = null;
let libFilter = 'all';
let libCollectionFilter = 'all';
let libSelectedIds = new Set();

// ============================================================
// Helpers
// ============================================================

async function sendToContent(action, data) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { action, ...data });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeAttr(str) {
  return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

function extractFilename(url) {
  try { return new URL(url).pathname.split('/').pop() || 'image'; }
  catch { return 'image'; }
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function truncate(str, max) {
  return str.length > max ? str.substring(0, max) + '...' : str;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h, s, l = (mx + mn) / 2;
  if (mx === mn) { h = s = 0; }
  else {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return { r, g, b };
}

function rgbToHslObj(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

function getContrastRatio(hex1, hex2) {
  function luminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(v => {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }
  const rgb1 = hexToRgb(hex1), rgb2 = hexToRgb(hex2);
  const l1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const l2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ============================================================
// Type Badge
// ============================================================

function typeBadgeClass(type) {
  const t = (type || 'unknown').toLowerCase();
  const map = {
    jpeg: 'jpeg', jpg: 'jpeg', png: 'png', webp: 'webp',
    svg: 'svg', gif: 'gif', avif: 'avif', bmp: 'bmp',
    ico: 'ico', tiff: 'tiff', tif: 'tiff',
  };
  return `type-badge type-badge-${map[t] || 'unknown'}`;
}


function typeBadgeLabel(type) {
  const t = (type || '').toUpperCase();
  // Shorten for tiny badges
  if (t === 'JPEG') return 'JPG';
  if (t === 'TIFF') return 'TIF';
  return t || '?';
}

// ============================================================
// Context Menu System
// ============================================================

function _removeCtxMenu() {
  const existing = document.querySelector('.sp-ctx-menu');
  if (existing) existing.remove();
}

function _showCtxMenu(x, y, items) {
  _removeCtxMenu();
  const menu = document.createElement('div');
  menu.className = 'sp-ctx-menu';

  items.forEach(item => {
    if (item === 'sep') {
      const sep = document.createElement('div');
      sep.className = 'sp-ctx-sep';
      menu.appendChild(sep);
      return;
    }
    const el = document.createElement('div');
    el.className = 'sp-ctx-item';
    el.innerHTML = (item.icon || '') + '<span>' + escapeHtml(item.label) + '</span>';
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      _removeCtxMenu();
      if (item.action) item.action();
    });
    menu.appendChild(el);
  });

  document.body.appendChild(menu);

  // Position within viewport
  const rect = menu.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  if (x + rect.width > vw) x = vw - rect.width - 4;
  if (y + rect.height > vh) y = vh - rect.height - 4;
  if (x < 0) x = 4;
  if (y < 0) y = 4;
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
}

// Close context menu on click outside, Escape, scroll
document.addEventListener('click', _removeCtxMenu);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') _removeCtxMenu(); });
document.addEventListener('scroll', _removeCtxMenu, true);

// SVG icon helpers for context menu
const _ctxIcons = {
  bookmark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  copy: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  save: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  edit: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  info: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  trash: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  collage: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
  batch: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="16" height="14" rx="2"/><path d="M6 7V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/></svg>',
  palette: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>',
};

// ============================================================
// Page Footer & Save-to-Lib helpers
// ============================================================

function _setPageFooter(visible) {
  const bar = $('page-bottom-bar');
  if (bar) bar.style.display = visible ? '' : 'none';
}

function _updateSaveToLibBtn() {
  const saveBtn = $('btn-save-to-lib');
  const unsaveBtn = $('btn-unsave-from-lib');
  const hasSelection = selectedSet.size > 0;
  if (saveBtn) saveBtn.title = hasSelection ? 'Save selected to Library' : 'Save all to Library';
  if (unsaveBtn) unsaveBtn.title = hasSelection ? 'Remove selected from Library' : 'Remove all from Library';
}

// ============================================================
// Page/Colors Tab Visibility
// ============================================================

function hidePageColorsTabs() {
  const pageTab = document.querySelector('[data-main-tab="images"]');
  const colorsTab = document.querySelector('[data-main-tab="colors"]');
  if (pageTab) pageTab.style.display = 'none';
  if (colorsTab) colorsTab.style.display = 'none';
  // Auto-switch to Library
  $$('.main-tab').forEach(t => t.classList.remove('active'));
  $$('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelector('[data-main-tab="library"]')?.classList.add('active');
  $('tab-library')?.classList.add('active');
}

function showPageColorsTabs() {
  const pageTab = document.querySelector('[data-main-tab="images"]');
  const colorsTab = document.querySelector('[data-main-tab="colors"]');
  if (pageTab) pageTab.style.display = '';
  if (colorsTab) colorsTab.style.display = '';
  // If Library was auto-selected (from restricted page), switch to Page tab
  const libTab = document.querySelector('[data-main-tab="library"]');
  if (libTab?.classList.contains('active') && pageTab) {
    $$('.main-tab').forEach(t => t.classList.remove('active'));
    $$('.tab-content').forEach(t => t.classList.remove('active'));
    pageTab.classList.add('active');
    $('tab-images')?.classList.add('active');
  }
}

// Restricted URL patterns — content scripts can't run or shouldn't run here
const _restrictedProtocols = ['chrome://', 'chrome-extension://', 'edge://', 'brave://', 'about:', 'devtools://', 'chrome-search://'];
const _restrictedDomains = [
  'chromewebstore.google.com', 'chrome.google.com/webstore',
  'microsoftedge.microsoft.com/addons', 'addons.opera.com',
  'accounts.google.com',
];

function isRestrictedUrl(url) {
  if (!url) return false;
  for (const p of _restrictedProtocols) { if (url.startsWith(p)) return true; }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    for (const d of _restrictedDomains) { if (url.includes(d)) return true; }
  }
  // Not http/https and not file:// — restricted
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) return true;
  return false;
}

async function checkIfEditorPage() {
  if (editorTabActive) {
    hidePageColorsTabs();
    return true;
  }
  // Check current tab URL for restrictions
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && isRestrictedUrl(tab.url)) {
      hidePageColorsTabs();
      return true; // treat as restricted — skip scanning
    }
  } catch {}
  showPageColorsTabs();
  return false;
}

// Collection picker dialog for sidepanel
async function pickCollectionDialog(title) {
  const collections = await PixLibrary.getCollections();
  const optionsHtml = collections.map(c => `<option value="${c}">${c}</option>`).join('');
  const body = `
    <div style="display:flex;flex-direction:column;gap:8px;">
      <select id="_pc_select" class="select-field" style="width:100%;padding:4px 8px;">
        ${optionsHtml}
        <option value="__new__">+ New Collection...</option>
      </select>
      <input type="text" id="_pc_new" class="input-field" placeholder="New collection name..." style="width:100%;display:none;">
    </div>
  `;
  const ok = await pixDialog.confirm(title || 'Choose Collection', body, { okText: 'Save', html: true });
  if (!ok) return null;
  const sel = $('_pc_select');
  const newInput = $('_pc_new');
  let collection = sel?.value || 'General';
  if (collection === '__new__') {
    collection = newInput?.value?.trim() || 'General';
  }
  return collection;
}

// Wire collection picker dropdown toggle (needs to run after dialog shows)
document.addEventListener('change', (e) => {
  if (e.target.id === '_pc_select') {
    const newInput = $('_pc_new');
    if (newInput) newInput.style.display = e.target.value === '__new__' ? '' : 'none';
  }
});
