const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

// Pixeroo Side Panel - Unified Gallery with Overlay

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

document.addEventListener('DOMContentLoaded', () => {
  restoreSession().then(() => {
    initMainTabs();
    initViewModes();
    initFilters();
    initSort();
    initSelection();
    initOverlay();
    initDownload();
    initEyedropper();
    initScreenshot();
    initColorFavorites();
    initColorsTab();
    initContrastChecker();
    checkIfEditorPage().then(isEditor => { if (!isEditor) scanPageImages(); });
  });

  $('btn-refresh').addEventListener('click', scanPageImages);

  // Delegated click-to-copy for .copyable elements
  document.addEventListener('click', (e) => {
    if (e.target.classList?.contains('copyable')) {
      navigator.clipboard.writeText(e.target.textContent);
    }
  });

  // Quick Settings popover toggle
  $('btn-sp-settings').addEventListener('click', (e) => {
    e.stopPropagation();
    const pop = $('sp-settings-popover');
    pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
    if (pop.style.display === 'block') initSPQuickSettings();
  });
  document.addEventListener('click', (e) => {
    const pop = $('sp-settings-popover');
    if (pop.style.display === 'block' && !pop.contains(e.target) && e.target.id !== 'btn-sp-settings') {
      pop.style.display = 'none';
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === 'tabChanged') {
      // User switched tabs — editor is no longer the active tab
      editorTabActive = false;
      checkIfEditorPage().then(isEditor => { if (!isEditor) scanPageImages(); });
    }
    if (message.action === 'editorOpened') {
      editorTabActive = true;
      hidePageColorsTabs();
    }
    if (message.action === 'editorClosed') {
      editorTabActive = false;
    }
    if (message.action === 'imagesUpdated') {
      // New images detected on page (lazy load) — rescan silently
      scanPageImages();
    }
  });
});

// ============================================================
// Main Tabs (Images / Colors)
// ============================================================

function initMainTabs() {
  $$('.main-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.main-tab').forEach(t => t.classList.remove('active'));
      $$('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      $(`tab-${tab.dataset.mainTab}`)?.classList.add('active');
    });
  });
}

// ============================================================
// View Modes
// ============================================================

function initViewModes() {
  $$('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('[data-view]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      renderGallery();
      saveSession();
    });
  });
}

// ============================================================
// Filters
// ============================================================

let typeFilterSet = null; // null = all types, Set = specific types

function initFilters() {
  const btn = $('btn-type-filter');
  const dd = $('type-filter-dropdown');
  const allCb = $('tf-all');
  const typeCbs = $$('.tf-type');
  const label = $('type-filter-label');

  // Toggle dropdown
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = dd.style.display === 'none';
    dd.style.display = opening ? 'block' : 'none';
    if (opening) updateTypeCounts();
  });

  document.addEventListener('click', (e) => {
    if (dd.style.display !== 'none' && !dd.contains(e.target) && !btn.contains(e.target)) {
      dd.style.display = 'none';
    }
  });

  // Show count per type in the dropdown labels
  function updateTypeCounts() {
    typeCbs.forEach(cb => {
      const type = cb.value;
      const count = allImages.filter(img => img.type === type).length;
      const lbl = cb.parentElement?.querySelector('label');
      if (lbl) lbl.textContent = count ? `${type} (${count})` : type;
    });
  }

  function syncUI() {
    const checked = [...typeCbs].filter(cb => cb.checked);
    const allChecked = checked.length === typeCbs.length;

    allCb.checked = allChecked;

    if (allChecked) {
      typeFilterSet = null;
      label.textContent = 'All types';
    } else if (checked.length === 0) {
      typeFilterSet = new Set(); // empty = show nothing
      label.textContent = 'None';
    } else if (checked.length === 1) {
      typeFilterSet = new Set(checked.map(cb => cb.value));
      label.textContent = checked[0].value;
    } else {
      typeFilterSet = new Set(checked.map(cb => cb.value));
      label.textContent = `${checked.length} types`;
    }

    currentFilter = typeFilterSet ? [...typeFilterSet].join(',') : 'all';
    renderGallery();
    updateToggleIcon();
    saveSession();
  }

  // "All" checkbox: toggle all on/off
  allCb.addEventListener('change', () => {
    const newState = allCb.checked;
    typeCbs.forEach(cb => { cb.checked = newState; });
    syncUI();
  });

  // Individual type checkboxes
  typeCbs.forEach(cb => {
    cb.addEventListener('change', syncUI);
  });
}

function getFilteredImages() {
  let images;
  if (!typeFilterSet) {
    images = [...allImages];
  } else {
    images = allImages.filter(img => typeFilterSet.has(img.type));
  }
  return applySorting(images);
}

// ============================================================
// Sorting
// ============================================================

function initSort() {
  $('sort-by').addEventListener('change', (e) => {
    currentSort = e.target.value;
    renderGallery();
    saveSession();
  });
}

function applySorting(images) {
  switch (currentSort) {
    case 'position':
      return images; // original page order (already in order from scanner)

    case 'size-desc':
      return images.sort((a, b) => (b.size || 0) - (a.size || 0));

    case 'size-asc':
      return images.sort((a, b) => (a.size || 0) - (b.size || 0));

    case 'dims-desc':
      return images.sort((a, b) => {
        const aArea = (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0);
        const bArea = (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0);
        return aArea - bArea;
      });

    case 'dims-asc':
      return images.sort((a, b) => {
        const aArea = (a.naturalWidth || a.width || 0) * (a.naturalHeight || a.height || 0);
        const bArea = (b.naturalWidth || b.width || 0) * (b.naturalHeight || b.height || 0);
        return aArea - bArea;
      });

    case 'type':
      return images.sort((a, b) => (a.type || '').localeCompare(b.type || ''));

    case 'name':
      return images.sort((a, b) => {
        const nameA = a.filename || extractFilename(a.src);
        const nameB = b.filename || extractFilename(b.src);
        return nameA.localeCompare(nameB);
      });

    default:
      return images;
  }
}

// ============================================================
// Selection
// ============================================================

function initSelection() {
  $('btn-toggle-select').addEventListener('click', () => {
    const filtered = getFilteredImages();
    const allSelected = filtered.every(img => selectedSet.has(img.src));

    if (allSelected) {
      filtered.forEach(img => selectedSet.delete(img.src));
    } else {
      filtered.forEach(img => selectedSet.add(img.src));
    }

    renderGallery();
    updateSelectionCount();
    updateToggleIcon();
  });
}

function updateToggleIcon() {
  const filtered = getFilteredImages();
  const allSelected = filtered.length > 0 && filtered.every(img => selectedSet.has(img.src));
  $('icon-select').style.display = allSelected ? 'none' : '';
  $('icon-deselect').style.display = allSelected ? '' : 'none';
}

function toggleSelection(src) {
  if (selectedSet.has(src)) {
    selectedSet.delete(src);
  } else {
    selectedSet.add(src);
  }
  updateSelectionCount();
  updateToggleIcon();
}

function updateSelectionCount() {
  const count = selectedSet.size;
  const total = allImages.length;
  $('sel-count-num').textContent = count;
  $('btn-dl-selected').disabled = count === 0;

  // Update button labels with counts
  const selLabel = $('dl-sel-label');
  const allLabel = $('dl-all-label');
  if (selLabel) selLabel.textContent = count ? `Selected (${count})` : 'Selected';
  if (allLabel) allLabel.textContent = total ? `All (${total})` : 'All';

  $$('.img-card').forEach(card => {
    const src = card.dataset.src;
    const cb = card.querySelector('.card-check input');
    card.classList.toggle('selected', selectedSet.has(src));
    if (cb) cb.checked = selectedSet.has(src);
  });

  // Update save-to-lib button title
  _updateSaveToLibBtn();
}

// ============================================================
// Page Scanner
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

let editorTabActive = false;

async function checkIfEditorPage() {
  if (editorTabActive) {
    hidePageColorsTabs();
    return true;
  }
  showPageColorsTabs();
  return false;
}

async function scanPageImages() {
  const gallery = $('gallery');
  const extMsg = $('extension-tab-msg');

  gallery.style.display = '';
  extMsg.style.display = 'none';
  gallery.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--slate-500);">Scanning page images...</div>';

  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  } catch (e) {
    showScanError('Could not access tabs');
    return;
  }

  if (!tab?.id) {
    showScanError('No active tab found');
    return;
  }

  // Try to message content script, inject if not present
  let response;
  try {
    response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageImages' });
  } catch (e) {
    // Content script not injected yet -- try injecting it
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/detector.js']
      });
      // Wait briefly for script to initialize
      await new Promise(r => setTimeout(r, 200));
      response = await chrome.tabs.sendMessage(tab.id, { action: 'getPageImages' });
    } catch (e2) {
      const origErr = e.message || '';
      const injectErr = e2.message || '';
      const url = tab?.url || '';

      // Check if original sendMessage failed with connection error (content script not injected)
      const isConnectionErr = origErr.includes('establish connection') || origErr.includes('Receiving end');

      // Is this a normal web page? (http/https)
      const isNormalPage = url.startsWith('http://') || url.startsWith('https://');

      // Known restricted URLs
      const isUrlRestricted = (
        url.startsWith('chrome://') || url.startsWith('chrome-extension://') ||
        url.startsWith('edge://') || url.startsWith('about:') || url.startsWith('devtools://') ||
        url.startsWith('chrome-search://') ||
        url.includes('chromewebstore.google.com') || url.includes('chrome.google.com/webstore') ||
        url.includes('addons.mozilla.org') || url.includes('microsoftedge.microsoft.com/addons')
      );

      // Truly blocked by Chrome (explicit block message + not a normal http page)
      const isBlocked = (injectErr.includes('cannot be scripted') || injectErr.includes('protected page')) && !isNormalPage && url;

      // Restricted: only if we KNOW the URL is restricted (not just empty/unknown)
      if (isUrlRestricted || isBlocked) {
        // Truly restricted page — hide tabs, show library
        hidePageColorsTabs();
        gallery.style.display = 'none';
        extMsg.style.display = 'none';
        $('image-count').textContent = '';
        _setPageFooter(false);
      } else if (isConnectionErr) {
        // Normal page loaded before Pixeroo — show reload button
        showPageColorsTabs();
        gallery.style.display = 'none';
        extMsg.style.display = 'block';
        _setPageFooter(false);
        extMsg.innerHTML = `
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="var(--slate-600)" stroke-width="1.5" style="margin:0 auto 1rem;"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
          <p style="color:var(--slate-400);font-weight:600;margin-bottom:0.5rem;">Reload Required</p>
          <p style="color:var(--slate-500);line-height:1.5;">The page was loaded before Pixeroo. Reload to enable page image scanning and color picking.</p>
          <p style="color:var(--slate-400);margin-top:0.25rem;">Your <b>My Library</b> is still accessible.</p>
          <button id="btn-reload-page" style="margin-top:0.75rem;background:var(--saffron-400);color:#1e293b;border:none;border-radius:6px;padding:6px 16px;font-weight:600;cursor:pointer;">Reload Page</button>`;
        $('btn-reload-page')?.addEventListener('click', async () => {
          try { await chrome.tabs.reload(tab.id); await new Promise(r => setTimeout(r, 1500)); scanPageImages(); } catch {}
        });
        $('image-count').textContent = '';
      } else {
        showScanError('Could not scan this page. Try refreshing the webpage.');
      }
      return;
    }
  }

  if (response?.images) {
    showPageColorsTabs(); // restore tabs — scan succeeded, this is a normal page
    // Deduplicate by src URL
    const seen = new Set();
    const unique = [];
    for (const img of response.images) {
      const key = img.src || img.url || '';
      if (key && seen.has(key)) continue;
      if (key) seen.add(key);
      unique.push(img);
    }
    allImages = unique.map((img, i) => ({ ...img, _index: i }));
    $('image-count').textContent = `${allImages.length} img`;
    renderGallery();
  } else {
    showScanError('No images found on this page');
  }
}

function showScanError(text) {
  const gallery = $('gallery');
  gallery.innerHTML = `<div style="text-align:center;padding:2rem 1rem;max-width:100%;">
    <div style="color:var(--slate-400);margin-bottom:0.5rem;word-wrap:break-word;">${escapeHtml(text)}</div>
    <div style="color:var(--slate-500);line-height:1.5;">Make sure you are on a website and the page has fully loaded. Try clicking Refresh.</div>
  </div>`;
  _setPageFooter(false);
}

function _setPageFooter(visible) {
  const bar = $('page-bottom-bar');
  if (bar) bar.style.display = visible ? '' : 'none';
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
// Gallery Renderer
// ============================================================

async function renderGallery() {
  const gallery = $('gallery');
  const images = getFilteredImages();

  gallery.className = `gallery view-${currentView}`;
  gallery.innerHTML = '';

  if (images.length === 0) {
    gallery.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--slate-500);">No images found</div>';
    _setPageFooter(false);
    return;
  }
  _setPageFooter(true);

  // Load library URLs for "already in library" indicator
  let libUrls = new Set();
  try {
    const libItems = await PixLibrary.getAll();
    libItems.forEach(item => { if (item.dataUrl) libUrls.add(item.dataUrl); });
  } catch {}

  // Update save-to-lib button title based on selection
  _updateSaveToLibBtn();

  images.forEach((img) => {
    const card = document.createElement('div');
    card.className = 'img-card' + (selectedSet.has(img.src) ? ' selected' : '');
    card.dataset.src = img.src;

    const filename = img.filename || extractFilename(img.src);
    const dims = img.naturalWidth && img.naturalHeight
      ? `${img.naturalWidth}x${img.naturalHeight}`
      : (img.width && img.height ? `${img.width}x${img.height}` : '');
    const meta = [dims, img.size ? formatBytes(img.size) : ''].filter(Boolean).join(' | ');

    const tooltip = showTooltips ? [filename, dims, img.type || '', img.size ? formatBytes(img.size) : ''].filter(Boolean).join('\n') : '';

    card.innerHTML = `
      <span class="card-check">
        <input type="checkbox" ${selectedSet.has(img.src) ? 'checked' : ''} data-src="${escapeAttr(img.src)}">
      </span>
      <img src="${escapeAttr(img.src)}" alt="${escapeAttr(filename)}" loading="lazy" draggable="false" ${tooltip ? `title="${escapeAttr(tooltip)}"` : ''}>
      <span class="${typeBadgeClass(img.type)}">${typeBadgeLabel(img.type)}</span>
      <div class="card-label">
        <div class="card-name" title="${escapeAttr(filename)}">${escapeHtml(filename)}</div>
        <div class="card-meta">${escapeHtml(meta)}</div>
      </div>
    `;

    // Library indicator badge
    if (libUrls.has(img.src)) {
      const libBadge = document.createElement('span');
      libBadge.className = 'lib-indicator';
      libBadge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>';
      card.appendChild(libBadge);
    }

    const cb = card.querySelector('input[type="checkbox"]');
    cb.addEventListener('change', () => toggleSelection(img.src));

    card.addEventListener('click', (e) => {
      if (e.target.closest('.card-check')) return;
      openOverlay(img);
    });

    gallery.appendChild(card);
  });

  // Update footer button counts
  updateSelectionCount();
}

// ============================================================
// Overlay
// ============================================================

function initOverlay() {
  const backdrop = $('overlay-backdrop');
  if (!backdrop) return;

  $('overlay-close')?.addEventListener('click', closeOverlay);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeOverlay();
  });

  // Overlay tabs
  $$('.overlay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.overlay-tab').forEach(t => t.classList.remove('active'));
      $$('.overlay-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`overlay-${tab.dataset.overlayTab}`)?.classList.add('active');
    });
  });

  // Save As format buttons
  $$('[data-save-fmt]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!overlayImage) return;
      sendToContent('convertAndSave', { src: overlayImage.src, format: btn.dataset.saveFmt });
    });
  });

  // Action buttons
  $('overlay-copy-png').addEventListener('click', () => {
    if (overlayImage) sendToContent('copyAsPng', { src: overlayImage.src });
  });

  $('overlay-download').addEventListener('click', () => {
    if (overlayImage) {
      const filename = overlayImage.filename || extractFilename(overlayImage.src) || 'image';
      chrome.runtime.sendMessage({
        action: 'download',
        url: overlayImage.src,
        filename: `pixeroo/${filename}`,
        saveAs: true
      });
    }
  });

  $('overlay-extract-colors').addEventListener('click', () => {
    if (overlayImage) sendToContent('extractColors', { src: overlayImage.src });
  });

  $('overlay-read-qr').addEventListener('click', () => {
    if (overlayImage) sendToContent('readQR', { src: overlayImage.src });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!overlayImage) return;
    if (e.key === 'Escape') closeOverlay();
    if (e.key === 'ArrowLeft') navigateOverlay(-1);
    if (e.key === 'ArrowRight') navigateOverlay(1);
  });
}

function openOverlay(img) {
  overlayImage = img;
  const filename = img.filename || extractFilename(img.src);

  $('overlay-title').textContent = filename;
  $('overlay-img').src = img.src;

  // Build info rows
  const infoPanel = $('overlay-info');
  const rows = [
    ['Filename', filename],
    ['Type', img.type || 'Unknown'],
    ['Dimensions', img.naturalWidth && img.naturalHeight
      ? `${img.naturalWidth} x ${img.naturalHeight} px`
      : (img.width && img.height ? `${img.width} x ${img.height} px` : 'Unknown')],
    ['Displayed', img.width && img.height && (img.width !== img.naturalWidth || img.height !== img.naturalHeight)
      ? `${img.width} x ${img.height} px`
      : null],
    ['File Size', img.size ? formatBytes(img.size) : 'Unknown'],
    ['Alt Text', img.alt || '(none)'],
    ['Title', img.title || null],
    ['Source', img.isBgImage ? 'CSS background-image' : null],
    ['URL', img.src],
  ].filter(([, v]) => v !== null);

  infoPanel.innerHTML = rows.map(([label, value]) => `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value copyable" title="Click to copy">${escapeHtml(truncate(String(value), 50))}</span>
    </div>
  `).join('');

  // Reset to info tab
  $$('.overlay-tab').forEach(t => t.classList.remove('active'));
  $$('.overlay-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-overlay-tab="info"]')?.classList.add('active');
  $('overlay-info')?.classList.add('active');

  $('overlay-backdrop')?.classList.add('visible');

  // Load EXIF asynchronously
  loadExifData(img.src);
}

function closeOverlay() {
  $('overlay-backdrop')?.classList.remove('visible');
  overlayImage = null;
}

function navigateOverlay(direction) {
  const images = getFilteredImages();
  if (images.length === 0 || !overlayImage) return;
  const currentIdx = images.findIndex(img => img.src === overlayImage.src);
  if (currentIdx === -1) return;
  const nextIdx = (currentIdx + direction + images.length) % images.length;
  openOverlay(images[nextIdx]);
}

// ============================================================
// EXIF Reader (lightweight, pure JS, JPEG only for now)
// ============================================================

async function loadExifData(src) {
  const content = $('exif-content');
  const loading = $('exif-loading');
  content.innerHTML = '';
  loading.style.display = 'block';
  loading.textContent = 'Loading EXIF data...';

  try {
    const resp = await fetch(src);
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const exif = parseExifFromJpeg(bytes);

    loading.style.display = 'none';

    if (exif.length === 0) {
      content.innerHTML = '<div style="color:var(--slate-500);text-align:center;padding:0.5rem;">No EXIF data found in this image</div>';
      return;
    }

    content.innerHTML = exif.map(([tag, value]) => `
      <div class="info-row">
        <span class="info-label">${escapeHtml(tag)}</span>
        <span class="info-value copyable" title="Click to copy">${escapeHtml(truncate(String(value), 40))}</span>
      </div>
    `).join('');
  } catch (e) {
    loading.textContent = 'Could not load EXIF data';
  }
}

function parseExifFromJpeg(bytes) {
  const entries = [];
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return entries; // Not JPEG

  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xFF) break;
    const marker = bytes[offset + 1];

    if (marker === 0xD9) break; // EOI
    if (marker === 0xDA) break; // SOS - start of scan, no more metadata

    const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];

    // APP1 = EXIF
    if (marker === 0xE1) {
      const exifHeader = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (exifHeader === 'Exif') {
        const tiffStart = offset + 10; // skip marker(2) + length(2) + "Exif\0\0"(6)
        parseTiffIFD(bytes, tiffStart, entries);
      }
    }

    offset += 2 + segLen;
  }

  return entries;
}

function parseTiffIFD(bytes, tiffStart, entries) {
  if (tiffStart + 8 > bytes.length) return;

  const le = bytes[tiffStart] === 0x49; // II = little-endian
  const r16 = (o) => le ? (bytes[o] | (bytes[o+1] << 8)) : ((bytes[o] << 8) | bytes[o+1]);
  const r32 = (o) => le
    ? (bytes[o] | (bytes[o+1] << 8) | (bytes[o+2] << 16) | (bytes[o+3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o+1] << 16) | (bytes[o+2] << 8) | bytes[o+3]) >>> 0;

  const ifdOffset = r32(tiffStart + 4);
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart + 2 > bytes.length) return;

  const count = r16(ifdStart);
  const TAGS = {
    0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation',
    0x011A: 'XResolution', 0x011B: 'YResolution', 0x0128: 'ResolutionUnit',
    0x0131: 'Software', 0x0132: 'DateTime',
    0x829A: 'ExposureTime', 0x829D: 'FNumber',
    0x8827: 'ISO', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
    0x920A: 'FocalLength', 0xA405: 'FocalLengthIn35mm',
    0xA001: 'ColorSpace', 0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension',
    0x8769: 'ExifIFD', 0x8825: 'GPSIFD',
  };

  for (let i = 0; i < count && ifdStart + 2 + i * 12 + 12 <= bytes.length; i++) {
    const entryOff = ifdStart + 2 + i * 12;
    const tag = r16(entryOff);
    const type = r16(entryOff + 2);
    const cnt = r32(entryOff + 4);
    const valOff = entryOff + 8;

    const tagName = TAGS[tag];
    if (!tagName) continue;

    // Follow sub-IFDs
    if (tag === 0x8769 || tag === 0x8825) {
      const subOffset = r32(valOff);
      parseTiffIFDAt(bytes, tiffStart, tiffStart + subOffset, entries, le, TAGS);
      continue;
    }

    const value = readTagValue(bytes, tiffStart, type, cnt, valOff, le);
    if (value !== null) entries.push([tagName, value]);
  }
}

function parseTiffIFDAt(bytes, tiffStart, ifdStart, entries, le, TAGS) {
  if (ifdStart + 2 > bytes.length) return;

  const r16 = (o) => le ? (bytes[o] | (bytes[o+1] << 8)) : ((bytes[o] << 8) | bytes[o+1]);
  const r32 = (o) => le
    ? (bytes[o] | (bytes[o+1] << 8) | (bytes[o+2] << 16) | (bytes[o+3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o+1] << 16) | (bytes[o+2] << 8) | bytes[o+3]) >>> 0;

  const count = r16(ifdStart);

  for (let i = 0; i < count && ifdStart + 2 + i * 12 + 12 <= bytes.length; i++) {
    const entryOff = ifdStart + 2 + i * 12;
    const tag = r16(entryOff);
    const type = r16(entryOff + 2);
    const cnt = r32(entryOff + 4);
    const valOff = entryOff + 8;

    const tagName = TAGS[tag];
    if (!tagName || tag === 0x8769 || tag === 0x8825) continue;

    const value = readTagValue(bytes, tiffStart, type, cnt, valOff, le);
    if (value !== null) entries.push([tagName, value]);
  }
}

function readTagValue(bytes, tiffStart, type, count, valOff, le) {
  const r16 = (o) => le ? (bytes[o] | (bytes[o+1] << 8)) : ((bytes[o] << 8) | bytes[o+1]);
  const r32 = (o) => le
    ? (bytes[o] | (bytes[o+1] << 8) | (bytes[o+2] << 16) | (bytes[o+3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o+1] << 16) | (bytes[o+2] << 8) | bytes[o+3]) >>> 0;

  try {
    // ASCII string
    if (type === 2) {
      const dataOff = count > 4 ? tiffStart + r32(valOff) : valOff;
      let str = '';
      for (let i = 0; i < count - 1 && dataOff + i < bytes.length; i++) {
        str += String.fromCharCode(bytes[dataOff + i]);
      }
      return str.trim();
    }

    // SHORT (uint16)
    if (type === 3) return r16(valOff);

    // LONG (uint32)
    if (type === 4) return r32(valOff);

    // RATIONAL (two uint32: numerator/denominator)
    if (type === 5) {
      const dataOff = tiffStart + r32(valOff);
      if (dataOff + 8 > bytes.length) return null;
      const num = r32(dataOff);
      const den = r32(dataOff + 4);
      if (den === 0) return num;
      if (num % den === 0) return num / den;
      return `${num}/${den}`;
    }
  } catch {
    return null;
  }
  return null;
}

// ============================================================
// Download
// ============================================================

function initDownload() {
  $('btn-dl-selected').addEventListener('click', () => {
    const images = allImages.filter(img => selectedSet.has(img.src));
    if (images.length > 0) downloadImagesAsZip(images, 'pixeroo-selected.zip');
  });

  $('btn-dl-all').addEventListener('click', () => {
    const images = getFilteredImages();
    if (images.length > 0) downloadImagesAsZip(images, 'pixeroo-images.zip');
  });
}

async function downloadImagesAsZip(images, zipFilename) {
  const btnSel = $('btn-dl-selected');
  const btnAll = $('btn-dl-all');
  const origSelText = btnSel.innerHTML;
  const origAllText = btnAll.innerHTML;
  btnSel.disabled = true;
  btnAll.disabled = true;
  btnAll.textContent = 'Creating ZIP...';

  try {
    const zip = new ZipWriter();
    const usedNames = new Set();

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      let filename = img.filename || extractFilename(img.src) || `image-${i + 1}`;
      // Deduplicate filenames
      if (usedNames.has(filename)) {
        const dot = filename.lastIndexOf('.');
        const base = dot > 0 ? filename.slice(0, dot) : filename;
        const ext = dot > 0 ? filename.slice(dot) : '';
        let n = 2;
        while (usedNames.has(`${base}-${n}${ext}`)) n++;
        filename = `${base}-${n}${ext}`;
      }
      usedNames.add(filename);

      try {
        const resp = await fetch(img.src);
        const blob = await resp.blob();
        await zip.addBlob(filename, blob);
      } catch {}
    }

    const zipBlob = zip.toBlob();
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url; a.download = zipFilename; a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    pixDialog.alert('ZIP Error', 'Failed to create ZIP file: ' + (e.message || e));
  } finally {
    btnSel.innerHTML = origSelText;
    btnAll.innerHTML = origAllText;
    btnSel.disabled = selectedSet.size === 0;
    btnAll.disabled = false;
  }
}

async function exportLibraryAsZip(ids, zipFilename) {
  const btnSel = $('btn-lib-export-selected');
  const btnAll = $('btn-lib-export-all');
  const origSelHtml = btnSel.innerHTML;
  const origAllHtml = btnAll.innerHTML;
  btnSel.disabled = true;
  btnAll.disabled = true;
  btnAll.textContent = 'Creating ZIP...';

  try {
    const zip = new ZipWriter();
    const usedNames = new Set();

    for (let i = 0; i < ids.length; i++) {
      try {
        const item = await PixLibrary.get(ids[i]);
        if (!item?.dataUrl) continue;

        let filename = item.name || `image-${i + 1}`;
        // Ensure file has an extension
        if (!/\.\w+$/.test(filename)) {
          // Guess extension from dataUrl
          const m = item.dataUrl.match(/^data:image\/(\w+)/);
          const ext = m ? (m[1] === 'jpeg' ? '.jpg' : '.' + m[1]) : '.png';
          filename += ext;
        }
        // Deduplicate filenames
        if (usedNames.has(filename)) {
          const dot = filename.lastIndexOf('.');
          const base = dot > 0 ? filename.slice(0, dot) : filename;
          const ext = dot > 0 ? filename.slice(dot) : '';
          let n = 2;
          while (usedNames.has(`${base}-${n}${ext}`)) n++;
          filename = `${base}-${n}${ext}`;
        }
        usedNames.add(filename);

        const resp = await fetch(item.dataUrl);
        const blob = await resp.blob();
        await zip.addBlob(filename, blob);
      } catch {}
    }

    const zipBlob = zip.toBlob();
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url; a.download = zipFilename; a.click();
    URL.revokeObjectURL(url);
  } catch (e) {
    pixDialog.alert('ZIP Error', 'Failed to create ZIP file: ' + (e.message || e));
  } finally {
    btnSel.innerHTML = origSelHtml;
    btnAll.innerHTML = origAllHtml;
    btnSel.disabled = libSelectedIds.size === 0;
    btnAll.disabled = false;
  }
}

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

// ============================================================
// Eyedropper (captureVisibleTab + canvas overlay)
// ============================================================

let eyedropperActive = false;

function initEyedropper() {
  $('btn-eyedropper').addEventListener('click', startEyedropper);
  // Escape in side panel cancels eyedropper
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && eyedropperActive) {
      startEyedropper(); // toggles off
    }
  });
}

async function startEyedropper() {
  const btn = $('btn-eyedropper');

  // Toggle off — cancel active eyedropper
  if (eyedropperActive) {
    eyedropperActive = false;
    btn.style.color = '';
    // Tell content script to close the overlay
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'cancelEyedropper' }).catch(() => {});
    } catch {}
    return;
  }

  eyedropperActive = true;
  btn.style.color = '#F4C430';

  try {
    // Step 1: Capture visible tab
    const capture = await chrome.runtime.sendMessage({ action: 'captureTab' });
    if (!capture?.dataUrl) {
      btn.style.color = '';
      eyedropperActive = false;
      return;
    }

    // Step 2: Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      btn.style.color = '';
      eyedropperActive = false;
      return;
    }

    // Step 3: Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/detector.js']
      });
    } catch {
      // Already injected or can't inject -- try anyway
    }

    // Step 4: Small delay for script init, then send eyedropper command
    setTimeout(() => {
      chrome.tabs.sendMessage(tab.id, {
        action: 'startEyedropper',
        screenshot: capture.dataUrl
      }, (result) => {
        btn.style.color = '';
        eyedropperActive = false;
        if (chrome.runtime.lastError) return;
        if (result?.color) showPickedColor(result.color);
      });
    }, 150);

  } catch (e) {
    btn.style.color = '';
    eyedropperActive = false;
  }
}

function showPickedColor(color) {
  if (!color?.hex) return;

  // Add to picked list
  recentPicks = recentPicks.filter(c => c.hex !== color.hex);
  recentPicks.unshift(color);
  if (recentPicks.length > 30) recentPicks.pop();

  saveSession();
  renderPickedColors();

  // Switch to Colors tab
  $$('.main-tab').forEach(t => t.classList.remove('active'));
  $$('.tab-content').forEach(c => c.classList.remove('active'));
  document.querySelector('[data-main-tab="colors"]')?.classList.add('active');
  $('tab-colors')?.classList.add('active');
}

// ============================================================
// Screenshot
// ============================================================

function initScreenshot() {
  $('btn-screenshot').addEventListener('click', captureScreenshot);
  $('btn-screenshot-close').addEventListener('click', () => {
    $('screenshot-result').style.display = 'none';
  });
  $('btn-ss-copy').addEventListener('click', copyScreenshot);
  $('btn-ss-download').addEventListener('click', downloadScreenshot);
}

let lastScreenshotDataUrl = null;

async function captureScreenshot() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'captureTab' });
    if (response?.error) {
      const isPermission = response.error.includes('activeTab') || response.error.includes('permission');
      const msg = isPermission
        ? 'Click the Pixeroo icon in the toolbar first, then try again. This grants permission to capture the current tab.'
        : 'Could not capture this page. Some pages (chrome://, new tab, web store) do not support screenshots.';
      await pixDialog.alert('Screenshot Failed', msg);
      return;
    }
    if (!response?.dataUrl) return;

    lastScreenshotDataUrl = response.dataUrl;
    // Save to library only — screenshots are not page images
    await saveScreenshotToLibrary(response.dataUrl);
    await pixDialog.alert('Screenshot Saved', 'Viewport screenshot saved to My Library.');
  } catch (e) {
    console.error('Screenshot error:', e);
  }
}


async function copyScreenshot() {
  if (!lastScreenshotDataUrl) return;
  const resp = await fetch(lastScreenshotDataUrl);
  const blob = await resp.blob();
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
}

function downloadScreenshot() {
  if (!lastScreenshotDataUrl) return;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  chrome.runtime.sendMessage({
    action: 'download',
    url: lastScreenshotDataUrl,
    filename: `pixeroo/screenshot-${timestamp}.png`,
    saveAs: true
  });
}

// ============================================================
// Color Favorites (permanent, synced)
// ============================================================

function initColorFavorites() {
  chrome.storage.sync.get({ favColors: [] }, (result) => {
    favColors = result.favColors || [];
    renderFavoritesFull();
  });
}

function addFavoriteColor(hex) {
  if (favColors.includes(hex)) return;
  favColors.unshift(hex);
  if (favColors.length > 30) favColors.pop();
  chrome.storage.sync.set({ favColors });
  renderFavoritesFull();
}

function removeFavoriteColor(hex) {
  favColors = favColors.filter(c => c !== hex);
  chrome.storage.sync.set({ favColors });
  renderFavoritesFull();
}

// ============================================================
// Colors Tab
// ============================================================

function initColorsTab() {
  renderPickedColors();
  renderFavoritesFull();

  // Clear picked
  $('btn-colors-clear').addEventListener('click', () => {
    recentPicks = [];
    saveSession();
    renderPickedColors();
  });

  // Extract page palette
  $('btn-extract-palette').addEventListener('click', extractPagePalette);

  // Export
  $('colors-export').addEventListener('change', (e) => {
    const fmt = e.target.value;
    const allColors = [...recentPicks.map(c => c.hex), ...favColors];
    const unique = [...new Set(allColors)];
    let output = '';

    if (fmt === 'css') {
      output = unique.map((hex, i) => `  --color-${i + 1}: ${hex};`).join('\n');
      output = `:root {\n${output}\n}`;
    } else if (fmt === 'json') {
      output = JSON.stringify(unique, null, 2);
    } else if (fmt === 'text') {
      output = unique.join('\n');
    }

    if (output) navigator.clipboard.writeText(output);
    e.target.selectedIndex = 0; // reset dropdown
  });

  // Close color detail popover on click outside
  document.addEventListener('click', (e) => {
    const popover = document.querySelector('.color-detail');
    if (popover && !popover.contains(e.target) && !e.target.classList.contains('color-swatch')) {
      popover.remove();
    }
  });
}

// ---- Color helper functions ----

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

// ---- Swatch creation helper ----

function createColorSwatch(hex, opts = {}) {
  const swatch = document.createElement('div');
  swatch.className = 'color-swatch';
  swatch.style.background = hex;
  swatch.title = opts.tooltip || hex;
  swatch.dataset.hex = hex;

  // Heart icon (show on hover to add to favorites)
  if (opts.showHeart !== false) {
    const heart = document.createElement('div');
    heart.className = 'swatch-heart';
    const isFav = favColors.includes(hex);
    heart.innerHTML = `<svg width="8" height="8" viewBox="0 0 24 24" fill="${isFav ? '#ef4444' : 'none'}" stroke="${isFav ? '#ef4444' : '#94a3b8'}" stroke-width="2.5"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
    heart.addEventListener('click', (e) => {
      e.stopPropagation();
      if (favColors.includes(hex)) {
        removeFavoriteColor(hex);
      } else {
        addFavoriteColor(hex);
      }
      // Re-render to update heart state
      renderPickedColors();
      renderPagePalette();
    });
    swatch.appendChild(heart);
  }

  // Usage count badge
  if (opts.count) {
    const badge = document.createElement('span');
    badge.className = 'swatch-count';
    badge.textContent = opts.count;
    swatch.appendChild(badge);
  }

  // Click: assign to contrast checker if active, otherwise show detail popover
  swatch.addEventListener('click', (e) => {
    e.stopPropagation();
    if (contrastTarget) {
      if (contrastTarget === 'fg') {
        contrastFg = hex;
        $('contrast-fg').style.background = hex;
        $('contrast-fg').textContent = '';
      } else {
        contrastBg = hex;
        $('contrast-bg').style.background = hex;
        $('contrast-bg').textContent = '';
      }
      contrastTarget = null;
      $('contrast-fg').classList.remove('active');
      $('contrast-bg').classList.remove('active');
      const hint = $('contrast-hint');
      if (hint) hint.textContent = '';
      updateContrastResult();
      return;
    }
    showColorDetail(hex, swatch);
  });

  // Right-click context menu on all swatches
  swatch.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    const rgb = hexToRgb(hex);
    const hsl = rgbToHslObj(rgb.r, rgb.g, rgb.b);
    const rgbStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    const hslStr = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
    const isFav = favColors.includes(hex);
    const items = [
      { label: 'Copy HEX', icon: _ctxIcons.copy, action: () => navigator.clipboard.writeText(hex) },
      { label: 'Copy RGB', icon: _ctxIcons.copy, action: () => navigator.clipboard.writeText(rgbStr) },
      { label: 'Copy HSL', icon: _ctxIcons.copy, action: () => navigator.clipboard.writeText(hslStr) },
      'sep',
      isFav
        ? { label: 'Remove from Favorites', icon: _ctxIcons.trash, action: () => { removeFavoriteColor(hex); renderPickedColors(); renderPagePalette(); } }
        : { label: 'Add to Favorites', icon: _ctxIcons.bookmark, action: () => { addFavoriteColor(hex); renderPickedColors(); renderPagePalette(); } },
      'sep',
      { label: 'Save to Library', icon: _ctxIcons.bookmark, action: async () => {
        const collection = await pickCollectionDialog('Save color to:');
        if (collection) saveColorToLibrary(hex, rgbStr, hslStr, collection);
      }},
      'sep',
      { label: 'Set as Contrast FG', action: () => { contrastFg = hex; $('contrast-fg').style.background = hex; $('contrast-fg').textContent = ''; updateContrastResult(); }},
      { label: 'Set as Contrast BG', action: () => { contrastBg = hex; $('contrast-bg').style.background = hex; $('contrast-bg').textContent = ''; updateContrastResult(); }},
    ];
    _showCtxMenu(e.clientX, e.clientY, items);
  });

  return swatch;
}

// ---- Color detail popover ----

function showColorDetail(hex, anchorEl) {
  // Remove existing popover
  document.querySelector('.color-detail')?.remove();

  const rgb = hexToRgb(hex);
  const hsl = rgbToHslObj(rgb.r, rgb.g, rgb.b);
  const rgbStr = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  const hslStr = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;

  const popover = document.createElement('div');
  popover.className = 'color-detail';

  popover.innerHTML = `
    <div class="color-detail-preview" style="background:${hex};"></div>
    <div class="color-detail-values">
      <div class="color-detail-row"><span>HEX</span><span class="copyable" data-copy="${hex}">${hex}</span></div>
      <div class="color-detail-row"><span>RGB</span><span class="copyable" data-copy="${rgbStr}">${rgbStr}</span></div>
      <div class="color-detail-row"><span>HSL</span><span class="copyable" data-copy="${hslStr}">${hslStr}</span></div>
    </div>
    <div class="color-detail-actions">
      <button class="cd-copy-hex">Copy HEX</button>
      <button class="cd-save-lib">Save to Library</button>
    </div>
  `;

  // Copy on click for .copyable spans
  popover.querySelectorAll('.copyable').forEach(el => {
    el.addEventListener('click', () => navigator.clipboard.writeText(el.dataset.copy));
  });

  // Copy HEX button
  popover.querySelector('.cd-copy-hex').addEventListener('click', () => {
    navigator.clipboard.writeText(hex);
  });

  // Save to Library button
  popover.querySelector('.cd-save-lib').addEventListener('click', async () => {
    const collection = await pickCollectionDialog('Save color to:');
    if (!collection) return;
    await saveColorToLibrary(hex, rgbStr, hslStr, collection);
    popover.remove();
  });

  document.body.appendChild(popover);

  // Position near anchor
  const rect = anchorEl.getBoundingClientRect();
  let top = rect.bottom + 4;
  let left = rect.left;

  // Keep within viewport
  if (top + 200 > window.innerHeight) top = rect.top - 210;
  if (left + 220 > window.innerWidth) left = window.innerWidth - 228;
  if (left < 4) left = 4;

  popover.style.top = top + 'px';
  popover.style.left = left + 'px';

  // If contrast target is active, also assign to contrast checker
  if (contrastTarget) {
    if (contrastTarget === 'fg') {
      contrastFg = hex;
      $('contrast-fg').style.background = hex;
    } else {
      contrastBg = hex;
      $('contrast-bg').style.background = hex;
    }
    contrastTarget = null;
    $('contrast-fg').classList.remove('active');
    $('contrast-bg').classList.remove('active');
    updateContrastResult();
  }
}

// ---- Extract page palette ----

async function extractPagePalette() {
  const btn = $('btn-extract-palette');
  btn.style.color = '#F4C430';

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      btn.style.color = '';
      return;
    }

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/detector.js']
      });
    } catch {}

    chrome.tabs.sendMessage(tab.id, { action: 'extractPageColors' }, (result) => {
      btn.style.color = '';
      if (chrome.runtime.lastError || !result?.colors) {
        pixDialog.alert('Extract Failed', 'Could not extract colors from this page. Some pages (chrome://, new tab) are restricted.');
        return;
      }
      pagePalette = result.colors;
      renderPagePalette();
    });
  } catch (e) {
    btn.style.color = '';
  }
}

function renderPagePalette() {
  const list = $('page-palette-list');
  if (!list) return;
  list.innerHTML = '';

  if (pagePalette.length === 0) {
    list.innerHTML = '<div style="grid-column:1/-1;padding:0.5rem;text-align:center;color:var(--slate-500);">Click "Extract Palette" to scan page CSS</div>';
    return;
  }

  pagePalette.forEach(c => {
    const swatch = createColorSwatch(c.hex, {
      tooltip: `${c.hex} (used ${c.count}x)`,
      count: c.count > 1 ? c.count : null
    });
    list.appendChild(swatch);
  });
}

// ---- Render picked colors as swatch grid ----

function renderPickedColors() {
  const list = $('picked-colors-list');
  if (!list) return;
  list.innerHTML = '';

  if (recentPicks.length === 0) {
    list.innerHTML = '<div style="grid-column:1/-1;padding:0.5rem;text-align:center;color:var(--slate-500);">Click "Pick Color" to start</div>';
    return;
  }

  recentPicks.forEach(c => {
    const swatch = createColorSwatch(c.hex, { tooltip: c.hex });
    list.appendChild(swatch);
  });
}

// ---- Render favorites as swatch grid ----

function renderFavoritesFull() {
  const list = $('fav-colors-list-full');
  if (!list) return;
  list.innerHTML = '';

  if (favColors.length === 0) {
    list.innerHTML = '<div style="grid-column:1/-1;padding:0.5rem;text-align:center;color:var(--slate-500);">Add colors with the heart icon</div>';
    return;
  }

  favColors.forEach(hex => {
    const swatch = createColorSwatch(hex, { tooltip: hex, showHeart: false });
    // Delete button (×) on hover
    const del = document.createElement('span');
    del.textContent = '\u00d7';
    del.style.cssText = 'position:absolute;top:-4px;right:-4px;width:14px;height:14px;background:var(--slate-800);color:#ef4444;border:1px solid var(--slate-700);border-radius:50%;font-size:10px;line-height:12px;text-align:center;cursor:pointer;display:none;z-index:2;';
    del.addEventListener('click', (e) => { e.stopPropagation(); removeFavoriteColor(hex); });
    swatch.appendChild(del);
    swatch.addEventListener('mouseenter', () => { del.style.display = 'block'; });
    swatch.addEventListener('mouseleave', () => { del.style.display = 'none'; });
    list.appendChild(swatch);
  });

  renderPickedColors();
}

// ---- Contrast checker ----

function initContrastChecker() {
  const fgEl = $('contrast-fg');
  const bgEl = $('contrast-bg');
  if (!fgEl || !bgEl) return;

  function setContrastTarget(target) {
    contrastTarget = contrastTarget === target ? null : target;
    fgEl.classList.toggle('active', contrastTarget === 'fg');
    bgEl.classList.toggle('active', contrastTarget === 'bg');
    // Show instruction
    const hint = $('contrast-hint');
    if (hint) hint.textContent = contrastTarget ? `Click any color swatch to set ${contrastTarget === 'fg' ? 'foreground' : 'background'}` : '';
  }

  fgEl.addEventListener('click', () => setContrastTarget('fg'));
  bgEl.addEventListener('click', () => setContrastTarget('bg'));

  updateContrastResult();
}

function updateContrastResult() {
  const ratio = getContrastRatio(contrastFg, contrastBg);
  const ratioStr = ratio.toFixed(1) + ':1';
  $('contrast-ratio').textContent = ratioStr;

  const wcagEl = $('contrast-wcag');
  if (ratio >= 7) {
    wcagEl.textContent = 'AAA';
    wcagEl.style.color = '#4ade80';
  } else if (ratio >= 4.5) {
    wcagEl.textContent = 'AA';
    wcagEl.style.color = '#4ade80';
  } else if (ratio >= 3) {
    wcagEl.textContent = 'AA Large';
    wcagEl.style.color = '#facc15';
  } else {
    wcagEl.textContent = 'Fail';
    wcagEl.style.color = '#f87171';
  }
}

// ============================================================
// Session Storage
// ============================================================

async function restoreSession() {
  try {
    const session = await chrome.storage.session.get({
      sessionView: 'tiles',
      sessionFilter: 'all',
      sessionSort: 'position',
      recentPicks: [],
    });

    currentView = session.sessionView;
    currentFilter = session.sessionFilter;
    currentSort = session.sessionSort;
    recentPicks = session.recentPicks || [];

    // Apply restored view
    $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
    $('sort-by').value = currentSort;

    // Restore type filter (multi-select checkboxes)
    if (currentFilter && currentFilter !== 'all') {
      const types = currentFilter.split(',');
      typeFilterSet = new Set(types);
      const allCb = $('tf-all');
      const typeCbs = $$('.tf-type');
      if (allCb) allCb.checked = false;
      typeCbs.forEach(cb => { cb.checked = types.includes(cb.value); });
      const label = $('type-filter-label');
      if (label) label.textContent = types.length === 1 ? types[0] : `${types.length} types`;
    }
  } catch {
    // session storage not available (Firefox MV2 fallback)
  }
}

function saveSession() {
  try {
    chrome.storage.session.set({
      sessionView: currentView,
      sessionFilter: currentFilter,
      sessionSort: currentSort,
      recentPicks: recentPicks,
    });
  } catch {}
}

// ============================================================
// Image Library
// ============================================================

async function initLibrary() {
  await PixLibrary.migrateCollections();
  await renderLibrary();

  // Save page images to library (selected if any, otherwise all)
  $('btn-save-to-lib')?.addEventListener('click', async () => {
    const hasSelection = selectedSet.size > 0;
    const imagesToSave = hasSelection
      ? allImages.filter(img => selectedSet.has(img.src))
      : [...allImages];
    if (!imagesToSave.length) return;

    // Ask which collection to save to
    const collection = await pickCollectionDialog(`Save ${imagesToSave.length} image(s) to:`);
    if (!collection) return;

    // Get current tab URL for source
    let pageUrl = '';
    let pageHost = '';
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      pageUrl = tabs[0]?.url || '';
      pageHost = pageUrl ? new URL(pageUrl).hostname : '';
    } catch {}

    let saved = 0;
    for (const img of imagesToSave) {
      try {
        const imgName = img.src?.split('/').pop()?.split('?')[0] || ('image-' + Date.now());
        // Derive host from image src if page URL unavailable
        let source = pageHost;
        if (!source) {
          try { source = new URL(img.src).hostname; } catch {}
        }
        await PixLibrary.add({
          dataUrl: img.src || img.url,
          source: source ? 'Page: ' + source : 'Page',
          name: imgName,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
          url: pageUrl || img.src || '',
          type: 'image',
          collection,
        });
        saved++;
      } catch {}
    }
    await renderLibrary();
    if (saved) $('lib-count').textContent = `(${(await PixLibrary.getUsage()).count})`;
    // Re-render gallery to show bookmark indicators
    await renderGallery();
  });

  // Unsave — remove this page's images from library
  $('btn-unsave-from-lib')?.addEventListener('click', async () => {
    // Get images to unsave: selected page images, or all page images
    const hasSelection = selectedSet.size > 0;
    const imagesToUnsave = hasSelection
      ? allImages.filter(img => selectedSet.has(img.src))
      : [...allImages];
    if (!imagesToUnsave.length) return;

    const srcs = new Set(imagesToUnsave.map(img => img.src || img.url));

    // Find matching library items by dataUrl
    const libItems = await PixLibrary.getAll();
    let removed = 0;
    for (const item of libItems) {
      if (item.dataUrl && srcs.has(item.dataUrl)) {
        await PixLibrary.remove(item.id);
        removed++;
      }
    }
    if (removed) {
      await renderLibrary();
      const u = await PixLibrary.getUsage();
      $('lib-count').textContent = u.count ? `(${u.count})` : '';
      await renderGallery(); // refresh bookmark indicators
    }
  });

  // Clear library
  $('btn-lib-clear')?.addEventListener('click', async () => {
    const ok = await pixDialog.confirm('Clear Library', 'Remove all items from your library? This cannot be undone.', { danger: true, okText: 'Clear All' });
    if (!ok) return;
    await PixLibrary.clear();
    await renderLibrary();
    $('lib-count').textContent = '';
  });

  // Delete selected library items
  $('btn-lib-delete-selected')?.addEventListener('click', async () => {
    if (!libSelectedIds.size) return;
    const ok = await pixDialog.confirm('Delete Selected', `Remove ${libSelectedIds.size} selected item(s) from library?`, { danger: true, okText: 'Delete' });
    if (!ok) return;
    for (const id of libSelectedIds) {
      await PixLibrary.remove(id);
    }
    libSelectedIds.clear();
    updateLibDeleteBtn();
    await renderLibrary();
    const u = await PixLibrary.getUsage();
    $('lib-count').textContent = u.count ? `(${u.count})` : '';
  });

  // Send to Edit/Collage/Batch
  $('btn-lib-send-edit')?.addEventListener('click', () => sendLibToTool('edit'));
  $('btn-lib-send-collage')?.addEventListener('click', () => sendLibToTool('collage'));
  $('btn-lib-send-batch')?.addEventListener('click', () => sendLibToTool('batch'));

  // Export library as ZIP
  $('btn-lib-export-selected')?.addEventListener('click', () => {
    if (libSelectedIds.size) exportLibraryAsZip([...libSelectedIds], 'pixeroo-selected.zip');
  });
  $('btn-lib-export-all')?.addEventListener('click', async () => {
    const allItems = await PixLibrary.getAll();
    const ids = allItems.filter(item => item.dataUrl).map(item => item.id);
    if (ids.length) exportLibraryAsZip(ids, 'pixeroo-library.zip');
  });

  // Select all / deselect all in library
  $('btn-lib-toggle-select')?.addEventListener('click', async () => {
    const allItems = await PixLibrary.getAll();
    const allIds = allItems.map(item => item.id);
    const allSelected = allIds.length > 0 && allIds.every(id => libSelectedIds.has(id));
    if (allSelected) {
      libSelectedIds.clear();
    } else {
      allIds.forEach(id => libSelectedIds.add(id));
    }
    updateLibDeleteBtn();
    await renderLibrary();
  });
}

let libFilter = 'all';
let libCollectionFilter = 'all';
let libSelectedIds = new Set();

function updateLibDeleteBtn() {
  const btn = $('btn-lib-delete-selected');
  if (!btn) return;
  const n = libSelectedIds.size;
  btn.disabled = n === 0;
  btn.style.borderColor = n ? '#ef4444' : 'var(--slate-700)';
  btn.style.color = n ? '#ef4444' : 'var(--slate-500)';

  // Update library footer selection count and export buttons with counts
  const libSelCount = $('lib-sel-count');
  if (libSelCount) libSelCount.textContent = n;
  const btnExportSel = $('btn-lib-export-selected');
  if (btnExportSel) btnExportSel.disabled = n === 0;

  const selLabel = $('lib-export-sel-label');
  if (selLabel) selLabel.textContent = n ? `Selected (${n})` : 'Selected';

  // Get total library item count for All button
  const totalEl = $('lib-usage');
  const totalMatch = totalEl?.textContent?.match(/^(\d+)/);
  const total = totalMatch ? parseInt(totalMatch[1]) : 0;
  const allLabel = $('lib-export-all-label');
  if (allLabel) allLabel.textContent = total ? `All (${total})` : 'All';
}

// Library filter buttons
$$('[data-lib-filter]').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('[data-lib-filter]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    libFilter = btn.dataset.libFilter;
    renderLibrary();
  });
});

// Collection filter dropdown
$('lib-collection-filter')?.addEventListener('change', (e) => {
  libCollectionFilter = e.target.value;
  renderLibrary();
});

async function renderLibrary() {
  const gallery = $('lib-gallery');
  if (!gallery) return;
  const allItems = await PixLibrary.getAll();
  const usage = await PixLibrary.getUsage();

  // Count per type
  let imgCount = 0, ssCount = 0, colCount = 0;
  allItems.forEach(i => {
    if (i.type === 'color') colCount++;
    else if (i.source === 'Screenshot') ssCount++;
    else imgCount++;
  });

  $('lib-usage').textContent = `${allItems.length} items (${PixLibrary.formatBytes(usage.bytes)})`;
  $('lib-count').textContent = allItems.length ? `(${allItems.length})` : '';

  // Update filter counts
  $$('[data-lib-filter]').forEach(btn => {
    const f = btn.dataset.libFilter;
    if (f === 'all') btn.textContent = `All (${allItems.length})`;
    else if (f === 'image') btn.textContent = `Images (${imgCount})`;
    else if (f === 'screenshot') btn.textContent = `Screenshots (${ssCount})`;
    else if (f === 'color') btn.textContent = `Colors (${colCount})`;
  });

  // Populate collection dropdown
  const colDropdown = $('lib-collection-filter');
  if (colDropdown) {
    const collections = new Set();
    allItems.forEach(i => collections.add(i.collection || 'General'));
    const sorted = [...collections].sort();
    const prev = colDropdown.value;
    colDropdown.innerHTML = '<option value="all">All Collections</option>' +
      sorted.map(c => `<option value="${c}"${c === prev ? ' selected' : ''}>${c}</option>`).join('');
    if (prev && prev !== 'all' && !collections.has(prev)) {
      colDropdown.value = 'all';
      libCollectionFilter = 'all';
    } else {
      colDropdown.value = prev;
    }
  }

  // Filter by type
  let items = allItems.filter(i => {
    if (libFilter === 'all') return true;
    if (libFilter === 'color') return i.type === 'color';
    if (libFilter === 'screenshot') return i.source === 'Screenshot';
    if (libFilter === 'image') return i.type !== 'color' && i.source !== 'Screenshot';
    return true;
  });

  // Filter by collection
  if (libCollectionFilter && libCollectionFilter !== 'all') {
    items = items.filter(i => (i.collection || 'General') === libCollectionFilter);
  }



  if (!items.length) {
    gallery.innerHTML = `<div style="text-align:center;width:100%;padding:2rem;color:var(--slate-500);">${allItems.length ? 'No items match this filter.' : 'Library is empty. Save images from any tab, take screenshots, or pick colors.'}</div>`;
    return;
  }

  gallery.innerHTML = '';
  items.forEach(item => {
    if (item.type === 'color') {
      // Color swatch card
      const card = document.createElement('div');
      card.style.cssText = 'width:60px;position:relative;border:1px solid var(--slate-700);border-radius:4px;overflow:hidden;cursor:pointer;';
      card.dataset.id = item.id;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = libSelectedIds.has(item.id);
      cb.style.cssText = 'position:absolute;top:2px;left:2px;z-index:2;cursor:pointer;accent-color:var(--saffron-400);';
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        if (cb.checked) libSelectedIds.add(item.id); else libSelectedIds.delete(item.id);
        card.style.borderColor = cb.checked ? 'var(--saffron-400)' : 'var(--slate-700)';
        updateLibDeleteBtn();
      });

      // Tooltip
      const addedDate = item.addedAt ? new Date(item.addedAt).toLocaleDateString() : '';

      const swatch = document.createElement('div');
      swatch.style.cssText = `width:100%;height:40px;background:${item.color || '#000'};`;
      if (showTooltips) swatch.title = [item.color, item.source || '', addedDate].filter(Boolean).join('\n');
      swatch.addEventListener('click', () => openLibOverlay(item));

      const del = document.createElement('span');
      del.textContent = '\u00d7';
      del.style.cssText = 'position:absolute;top:1px;right:2px;color:#fff;font-size:0.5rem;cursor:pointer;text-shadow:0 0 3px rgba(0,0,0,0.8);z-index:1;';
      del.addEventListener('click', async (e) => { e.stopPropagation(); await PixLibrary.remove(item.id); await renderLibrary(); });

      const label = document.createElement('div');
      label.style.cssText = 'padding:2px 3px;font-size:0.5rem;color:var(--slate-400);font-family:monospace;text-align:center;cursor:pointer;';
      label.textContent = item.color || '';
      label.addEventListener('click', () => { navigator.clipboard.writeText(item.color); });

      card.appendChild(cb); card.appendChild(del); card.appendChild(swatch); card.appendChild(label);
      gallery.appendChild(card);
    } else {
      // Image card
      const card = document.createElement('div');
      card.style.cssText = 'width:80px;position:relative;border:1px solid var(--slate-700);border-radius:4px;overflow:hidden;cursor:pointer;';
      card.dataset.id = item.id;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = libSelectedIds.has(item.id);
      cb.style.cssText = 'position:absolute;top:2px;left:2px;z-index:2;cursor:pointer;accent-color:var(--saffron-400);';
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        if (cb.checked) libSelectedIds.add(item.id); else libSelectedIds.delete(item.id);
        card.style.borderColor = cb.checked ? 'var(--saffron-400)' : 'var(--slate-700)';
        updateLibDeleteBtn();
      });

      const img = document.createElement('img');
      img.src = item.dataUrl;
      img.style.cssText = 'width:100%;height:55px;object-fit:cover;display:block;';
      // Tooltip
      const addedDate = item.addedAt ? new Date(item.addedAt).toLocaleDateString() : '';
      const dimStr = item.width && item.height ? `${item.width}x${item.height}` : '';
      if (showTooltips) img.title = [item.name, dimStr, item.source || '', addedDate].filter(Boolean).join('\n');
      // Click opens detail view
      img.addEventListener('click', () => openLibOverlay(item));

      const del = document.createElement('span');
      del.textContent = '\u00d7';
      del.style.cssText = 'position:absolute;top:1px;right:2px;color:#fff;font-size:0.5rem;cursor:pointer;text-shadow:0 0 3px rgba(0,0,0,0.8);z-index:1;';
      del.addEventListener('click', async (e) => { e.stopPropagation(); await PixLibrary.remove(item.id); await renderLibrary(); });

      const badge = document.createElement('div');
      badge.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.6);padding:1px 3px;font-size:0.4375rem;color:var(--slate-300);display:flex;justify-content:space-between;';
      const srcText = item.source === 'Screenshot' ? '\ud83d\udcf7' : item.source?.replace('Page: ', '') || '';
      const collText = item.collection && item.collection !== 'General' ? item.collection : '';
      badge.innerHTML = `<span>${srcText}</span>${collText ? `<span style="color:var(--saffron-400);">${collText}</span>` : ''}`;

      card.appendChild(cb); card.appendChild(del); card.appendChild(img); card.appendChild(badge);
      gallery.appendChild(card);
    }
  });
}

function openLibOverlay(item) {
  if (item.type === 'color') {
    // Color detail — just copy hex
    navigator.clipboard.writeText(item.color || '');
    return;
  }
  // Reuse the page image overlay for library items
  const filename = item.name || 'Library image';
  const addedDate = item.addedAt ? new Date(item.addedAt).toLocaleString() : 'Unknown';

  $('overlay-title').textContent = filename;
  $('overlay-img').src = item.dataUrl;

  const infoPanel = $('overlay-info');
  const sourceDisplay = (item.source || '').replace('Page: unknown', 'Page').replace('unknown', '') || 'Saved locally';
  const rows = [
    ['Name', filename],
    ['Type', item.source === 'Screenshot' ? 'Screenshot' : 'Image'],
    ['Dimensions', item.width && item.height ? `${item.width} x ${item.height} px` : 'Unknown'],
    ['Size', item.size ? PixLibrary.formatBytes(item.size) : 'Unknown'],
    ['Collection', item.collection || 'General'],
    ['Source', sourceDisplay],
    ['Saved', addedDate],
    item.url ? ['URL', item.url] : null,
  ].filter(Boolean);

  infoPanel.innerHTML = rows.map(([label, value]) => `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value copyable" title="Click to copy">${escapeHtml(truncate(String(value), 50))}</span>
    </div>
  `).join('');

  // Reset to info tab
  $$('.overlay-tab').forEach(t => t.classList.remove('active'));
  $$('.overlay-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-overlay-tab="info"]')?.classList.add('active');
  $('overlay-info')?.classList.add('active');

  $('overlay-backdrop')?.classList.add('visible');

  // Load EXIF data from the dataUrl
  loadExifData(item.dataUrl);

  // Store reference for overlay actions (use a fake img-like object)
  overlayImage = { src: item.dataUrl, filename, type: 'image', _libItem: item };
}

async function saveColorToLibrary(hex, rgb, hsl, collection) {
  try {
    await PixLibrary.add({
      dataUrl: '',
      type: 'color',
      source: 'Color pick',
      name: hex,
      color: hex,
      width: 0, height: 0,
      collection: collection || 'General',
    });
    await renderLibrary();
    $('lib-count').textContent = `(${(await PixLibrary.getUsage()).count})`;
  } catch {}
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

async function saveScreenshotToLibrary(dataUrl) {
  try {
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = dataUrl; });
    await PixLibrary.add({
      dataUrl,
      source: 'Screenshot',
      name: 'screenshot-' + new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-'),
      width: img.naturalWidth,
      height: img.naturalHeight,
      collection: 'General',
    });
    await renderLibrary();
    $('lib-count').textContent = `(${(await PixLibrary.getUsage()).count})`;
  } catch {}
}

async function sendLibToTool(tool) {
  // Collect selected library item IDs, fall back to all visible
  let ids = [...libSelectedIds];
  if (!ids.length) {
    $$('#lib-gallery [data-id]').forEach(card => {
      ids.push(Number(card.dataset.id));
    });
  }
  if (!ids.length) return;

  // Get dataUrls from library
  const images = [];
  for (const id of ids) {
    try {
      const item = await PixLibrary.get(id);
      if (item?.dataUrl) images.push(item.dataUrl);
    } catch {}
  }
  if (!images.length) return;

  // Pass via chrome.storage.local (sessionStorage doesn't cross pages)
  await chrome.storage.local.set({ 'pixeroo-lib-transfer': { tool, images } });
  chrome.runtime.sendMessage({ action: 'openEditor', mode: tool, fromLib: true });
}

// ============================================================
// Rectangle Region Screenshot
// ============================================================

async function captureRegionScreenshot() {
  let tab;
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    tab = tabs[0];
  } catch { return; }
  if (!tab?.id) return;

  // Inject the region selection overlay into the page
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if ($('_pix_region_overlay')) return;

        // --- State ---
        let rx = 0, ry = 0, rw = 0, rh = 0; // region rect
        let phase = 'draw'; // draw, adjust
        let dragType = null; // null, 'move', 'nw','ne','sw','se','n','s','e','w'
        let dragStartX, dragStartY, dragStartRect;

        // --- DOM ---
        const overlay = document.createElement('div');
        overlay.id = '_pix_region_overlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.3);';

        const sel = document.createElement('div');
        sel.style.cssText = 'position:fixed;border:2px solid #F4C430;background:rgba(244,196,48,0.08);display:none;z-index:2147483647;';
        overlay.appendChild(sel);

        const label = document.createElement('div');
        label.style.cssText = 'position:fixed;background:rgba(15,23,42,0.9);color:#F4C430;padding:3px 8px;border-radius:4px;font:bold 12px Inter,sans-serif;z-index:2147483647;pointer-events:none;display:none;';
        overlay.appendChild(label);

        // Toolbar: Capture + Cancel buttons
        const toolbar = document.createElement('div');
        toolbar.style.cssText = 'position:fixed;display:none;z-index:2147483647;gap:6px;align-items:center;';
        const btnCapture = document.createElement('button');
        btnCapture.textContent = 'Capture';
        btnCapture.style.cssText = 'background:#F4C430;color:#1e293b;border:none;border-radius:5px;padding:5px 14px;font:bold 12px Inter,sans-serif;cursor:pointer;';
        const btnCancel = document.createElement('button');
        btnCancel.textContent = 'Cancel';
        btnCancel.style.cssText = 'background:rgba(15,23,42,0.8);color:#cbd5e1;border:1px solid #475569;border-radius:5px;padding:5px 14px;font:bold 12px Inter,sans-serif;cursor:pointer;';
        toolbar.appendChild(btnCapture);
        toolbar.appendChild(btnCancel);
        overlay.appendChild(toolbar);

        // 8 resize handles
        const handles = [];
        const cursors = { nw:'nw-resize', ne:'ne-resize', sw:'sw-resize', se:'se-resize', n:'n-resize', s:'s-resize', e:'e-resize', w:'w-resize' };
        for (const dir of ['nw','n','ne','e','se','s','sw','w']) {
          const h = document.createElement('div');
          h.dataset.dir = dir;
          h.style.cssText = `position:fixed;width:10px;height:10px;background:#F4C430;border:1px solid #1e293b;border-radius:2px;z-index:2147483647;cursor:${cursors[dir]};display:none;`;
          handles.push(h);
          overlay.appendChild(h);
        }

        function updateUI() {
          sel.style.left = rx + 'px'; sel.style.top = ry + 'px';
          sel.style.width = rw + 'px'; sel.style.height = rh + 'px';
          label.style.left = (rx + rw + 8) + 'px'; label.style.top = ry + 'px';
          label.textContent = Math.round(rw) + ' \u00d7 ' + Math.round(rh);
          // Toolbar below selection
          toolbar.style.left = (rx + rw / 2 - 70) + 'px';
          toolbar.style.top = (ry + rh + 10) + 'px';
          // Handles
          const hw = 10, hh = 10;
          const pos = {
            nw: [rx - hw/2, ry - hh/2], n: [rx + rw/2 - hw/2, ry - hh/2], ne: [rx + rw - hw/2, ry - hh/2],
            w: [rx - hw/2, ry + rh/2 - hh/2], e: [rx + rw - hw/2, ry + rh/2 - hh/2],
            sw: [rx - hw/2, ry + rh - hh/2], s: [rx + rw/2 - hw/2, ry + rh - hh/2], se: [rx + rw - hw/2, ry + rh - hh/2],
          };
          handles.forEach(h => {
            const p = pos[h.dataset.dir];
            h.style.left = p[0] + 'px'; h.style.top = p[1] + 'px';
          });
        }

        function showAdjustUI() {
          phase = 'adjust';
          sel.style.cursor = 'move';
          toolbar.style.display = 'flex';
          handles.forEach(h => { h.style.display = 'block'; });
          overlay.style.cursor = 'default';
          overlay.style.background = 'rgba(0,0,0,0.2)';
          updateUI();
        }

        function cleanup() { overlay.remove(); document.removeEventListener('keydown', escHandler); }

        function doCapture() {
          if (rw < 5 || rh < 5) { cleanup(); return; }
          const region = { x: rx, y: ry, w: rw, h: rh, dpr: window.devicePixelRatio || 1 };
          cleanup();
          chrome.runtime.sendMessage({ action: 'captureRegion', region });
        }

        // --- Phase 1: Draw ---
        let drawStartX, drawStartY, drawing = false;

        overlay.addEventListener('mousedown', (e) => {
          if (phase === 'draw') {
            drawStartX = e.clientX; drawStartY = e.clientY; drawing = true;
            sel.style.display = 'block'; label.style.display = 'block';
          } else if (phase === 'adjust') {
            // Check if clicking a handle
            const dir = e.target.dataset?.dir;
            if (dir) {
              dragType = dir; dragStartX = e.clientX; dragStartY = e.clientY;
              dragStartRect = { x: rx, y: ry, w: rw, h: rh };
              e.stopPropagation();
              return;
            }
            // Check if clicking inside selection (move)
            if (e.clientX >= rx && e.clientX <= rx + rw && e.clientY >= ry && e.clientY <= ry + rh) {
              dragType = 'move'; dragStartX = e.clientX; dragStartY = e.clientY;
              dragStartRect = { x: rx, y: ry, w: rw, h: rh };
            }
          }
        });

        overlay.addEventListener('mousemove', (e) => {
          if (phase === 'draw' && drawing) {
            rx = Math.min(drawStartX, e.clientX); ry = Math.min(drawStartY, e.clientY);
            rw = Math.abs(e.clientX - drawStartX); rh = Math.abs(e.clientY - drawStartY);
            updateUI();
          } else if (phase === 'adjust' && dragType) {
            const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
            const r = dragStartRect;
            if (dragType === 'move') { rx = r.x + dx; ry = r.y + dy; }
            else if (dragType === 'se') { rw = Math.max(20, r.w + dx); rh = Math.max(20, r.h + dy); }
            else if (dragType === 'sw') { rx = r.x + dx; rw = Math.max(20, r.w - dx); rh = Math.max(20, r.h + dy); }
            else if (dragType === 'ne') { rw = Math.max(20, r.w + dx); ry = r.y + dy; rh = Math.max(20, r.h - dy); }
            else if (dragType === 'nw') { rx = r.x + dx; rw = Math.max(20, r.w - dx); ry = r.y + dy; rh = Math.max(20, r.h - dy); }
            else if (dragType === 'n') { ry = r.y + dy; rh = Math.max(20, r.h - dy); }
            else if (dragType === 's') { rh = Math.max(20, r.h + dy); }
            else if (dragType === 'e') { rw = Math.max(20, r.w + dx); }
            else if (dragType === 'w') { rx = r.x + dx; rw = Math.max(20, r.w - dx); }
            updateUI();
          }
        });

        overlay.addEventListener('mouseup', () => {
          if (phase === 'draw' && drawing) {
            drawing = false;
            if (rw < 5 || rh < 5) { sel.style.display = 'none'; label.style.display = 'none'; return; }
            showAdjustUI();
          }
          dragType = null;
        });

        btnCapture.addEventListener('click', (e) => { e.stopPropagation(); doCapture(); });
        btnCancel.addEventListener('click', (e) => { e.stopPropagation(); cleanup(); });

        function escHandler(e) {
          if (e.key === 'Escape') cleanup();
          if (e.key === 'Enter' && phase === 'adjust') doCapture();
        }
        document.addEventListener('keydown', escHandler);

        document.body.appendChild(overlay);
      }
    });
  } catch (e) {
    const isPermission = (e.message || '').includes('permission') || (e.message || '').includes('Cannot access');
    const msg = isPermission
      ? 'Click the Pixeroo icon in the toolbar first, then try again. This grants permission to access the current page.'
      : 'Could not inject region selector on this page. Some pages do not allow extensions to run scripts.';
    pixDialog.alert('Region Screenshot Failed', msg);
  }
}

// Init region button
$('btn-screenshot-region')?.addEventListener('click', captureRegionScreenshot);

// Listen for region capture result from content script via background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'captureRegion' && message.region) {
    // The content script sends this — but we need the background to capture the tab
    // Actually the content script sends to background, background responds to content script
    // We need a different flow — let's listen for a custom message
  }
  if (message.action === 'regionCaptured') {
    handleRegionCapture(message.dataUrl, message.region);
  }
});

async function handleRegionCapture(fullDataUrl, region) {
  if (!fullDataUrl || !region) return;
  // Crop the full viewport image to the region
  const img = new Image();
  await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = fullDataUrl; });
  const dpr = region.dpr || 1;
  const c = document.createElement('canvas');
  c.width = Math.round(region.w * dpr);
  c.height = Math.round(region.h * dpr);
  c.getContext('2d').drawImage(img, Math.round(region.x * dpr), Math.round(region.y * dpr), c.width, c.height, 0, 0, c.width, c.height);
  const croppedUrl = c.toDataURL('image/png');

  lastScreenshotDataUrl = croppedUrl;
  // Save to library only — screenshots are not page images
  await saveScreenshotToLibrary(croppedUrl);
  await pixDialog.alert('Screenshot Saved', 'Region screenshot saved to My Library.');
}

// Init library on load
initLibrary();

// ============================================================
// Quick Settings (Side Panel)
// ============================================================

let spQsInited = false;
async function initSPQuickSettings() {
  if (spQsInited) return;
  spQsInited = true;

  // Theme buttons
  const result = await chrome.storage.sync.get({ theme: 'dark', fontScale: 100, fontFamily: 'jetbrains' });
  $$('.sp-qs-theme').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === result.theme);
    btn.addEventListener('click', async () => {
      await chrome.storage.sync.set({ theme: btn.dataset.theme });
      $$('.sp-qs-theme').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Font size
  let scale = result.fontScale || 100;
  const valEl = $('sp-qs-font-val');
  valEl.textContent = scale + '%';
  function applyScale() {
    document.documentElement.style.fontSize = (scale / 100 * 100) + '%';
    valEl.textContent = scale + '%';
    chrome.storage.sync.set({ fontScale: scale });
  }
  $('sp-qs-font-down').addEventListener('click', () => {
    if (scale > 70) { scale -= 10; applyScale(); }
  });
  $('sp-qs-font-up').addEventListener('click', () => {
    if (scale < 150) { scale += 10; applyScale(); }
  });
  applyScale();

  // Font family
  const ffEl = $('sp-qs-font-family');
  if (ffEl) {
    ffEl.value = result.fontFamily || 'system';
    ffEl.addEventListener('change', () => {
      chrome.storage.sync.set({ fontFamily: ffEl.value });
    });
  }

  // Tooltips toggle
  const ttCb = $('sp-qs-tooltips');
  const ttResult = await chrome.storage.sync.get({ showTooltips: true });
  showTooltips = ttResult.showTooltips;
  ttCb.checked = showTooltips;
  ttCb.addEventListener('change', () => {
    showTooltips = ttCb.checked;
    chrome.storage.sync.set({ showTooltips });
    renderGallery();
  });

  // Advanced settings
  $('sp-qs-advanced').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
    $('sp-settings-popover').style.display = 'none';
  });
}

// Apply saved settings on load
chrome.storage.sync.get({ fontScale: 100, showTooltips: true }, (r) => {
  if (r.fontScale && r.fontScale !== 100) {
    document.documentElement.style.fontSize = (r.fontScale / 100 * 100) + '%';
  }
  showTooltips = r.showTooltips;
});

// ============================================================
// Save-to-Library button text updater
// ============================================================

function _updateSaveToLibBtn() {
  const saveBtn = $('btn-save-to-lib');
  const unsaveBtn = $('btn-unsave-from-lib');
  const hasSelection = selectedSet.size > 0;
  if (saveBtn) saveBtn.title = hasSelection ? 'Save selected to Library' : 'Save all to Library';
  if (unsaveBtn) unsaveBtn.title = hasSelection ? 'Remove selected from Library' : 'Remove all from Library';
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
// Page Image Context Menu
// ============================================================

$('gallery')?.addEventListener('contextmenu', (e) => {
  const card = e.target.closest('.img-card');
  if (!card) return;
  e.preventDefault();
  e.stopPropagation();

  const src = card.dataset.src;
  const img = allImages.find(i => i.src === src);
  if (!img) return;

  const items = [
    {
      label: 'Save to Library',
      icon: _ctxIcons.bookmark,
      action: async () => {
        const collection = await pickCollectionDialog('Save image to:');
        if (!collection) return;
        let pageUrl = '', pageHost = 'unknown';
        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          pageUrl = tabs[0]?.url || '';
          pageHost = pageUrl ? new URL(pageUrl).hostname : 'unknown';
        } catch {}
        const imgName = img.src?.split('/').pop()?.split('?')[0] || ('image-' + Date.now());
        await PixLibrary.add({
          dataUrl: img.src || img.url,
          source: 'Page: ' + pageHost,
          name: imgName,
          width: img.naturalWidth || img.width || 0,
          height: img.naturalHeight || img.height || 0,
          url: pageUrl,
          type: 'image',
          collection,
        });
        await renderLibrary();
        $('lib-count').textContent = `(${(await PixLibrary.getUsage()).count})`;
        await renderGallery();
      }
    },
    {
      label: 'Download',
      icon: _ctxIcons.save,
      action: () => {
        chrome.runtime.sendMessage({
          action: 'download',
          url: img.src,
          filename: 'pixeroo/' + (img.filename || extractFilename(img.src) || 'image'),
          saveAs: true
        });
      }
    },
    {
      label: 'Copy to Clipboard',
      icon: _ctxIcons.copy,
      action: () => sendToContent('copyAsPng', { src: img.src })
    },
    'sep',
    ...(['PNG', 'JPEG', 'WebP'].filter(fmt => {
      const imgType = (img.type || '').toUpperCase();
      const fmtUpper = fmt.toUpperCase();
      // Skip if same format (JPEG/JPG match)
      if (imgType === fmtUpper) return false;
      if (imgType === 'JPG' && fmtUpper === 'JPEG') return false;
      if (imgType === 'JPEG' && fmtUpper === 'JPG') return false;
      return true;
    }).map(fmt => ({
      label: `Convert to ${fmt}`,
      icon: _ctxIcons.save,
      action: () => sendToContent('convertAndSave', { src: img.src, format: fmt.toLowerCase() })
    }))),
    'sep',
    {
      label: 'Open in Editor',
      icon: _ctxIcons.edit,
      action: async () => {
        await chrome.storage.local.set({ 'pixeroo-lib-transfer': { tool: 'edit', images: [img.src] } });
        chrome.runtime.sendMessage({ action: 'openEditor', mode: 'edit', fromLib: true });
      }
    },
    {
      label: 'View Info',
      icon: _ctxIcons.info,
      action: () => openOverlay(img)
    },
  ];

  _showCtxMenu(e.clientX, e.clientY, items);
});

// ============================================================
// Library Item Context Menu
// ============================================================

$('lib-gallery')?.addEventListener('contextmenu', (e) => {
  const card = e.target.closest('[data-id]');
  if (!card) return;
  e.preventDefault();
  e.stopPropagation();

  const id = Number(card.dataset.id);

  const items = [
    {
      label: 'Send to Edit',
      icon: _ctxIcons.edit,
      action: async () => {
        const item = await PixLibrary.get(id);
        if (!item?.dataUrl) return;
        await chrome.storage.local.set({ 'pixeroo-lib-transfer': { tool: 'edit', images: [item.dataUrl] } });
        chrome.runtime.sendMessage({ action: 'openEditor', mode: 'edit', fromLib: true });
      }
    },
    {
      label: 'Send to Collage',
      icon: _ctxIcons.collage,
      action: async () => {
        const item = await PixLibrary.get(id);
        if (!item?.dataUrl) return;
        await chrome.storage.local.set({ 'pixeroo-lib-transfer': { tool: 'collage', images: [item.dataUrl] } });
        chrome.runtime.sendMessage({ action: 'openEditor', mode: 'collage', fromLib: true });
      }
    },
    {
      label: 'Send to Batch',
      icon: _ctxIcons.batch,
      action: async () => {
        const item = await PixLibrary.get(id);
        if (!item?.dataUrl) return;
        await chrome.storage.local.set({ 'pixeroo-lib-transfer': { tool: 'batch', images: [item.dataUrl] } });
        chrome.runtime.sendMessage({ action: 'openEditor', mode: 'batch', fromLib: true });
      }
    },
    'sep',
    {
      label: 'Download',
      icon: _ctxIcons.save,
      action: async () => {
        const item = await PixLibrary.get(id);
        if (!item?.dataUrl) return;
        const ext = (item.name || '').split('.').pop()?.toLowerCase() || 'png';
        chrome.runtime.sendMessage({
          action: 'download',
          url: item.dataUrl,
          filename: 'pixeroo/' + (item.name || `library-image.${ext}`),
          saveAs: true
        });
      }
    },
    {
      label: 'Copy to clipboard',
      icon: _ctxIcons.copy,
      action: async () => {
        const imgEl = card.querySelector('img');
        if (!imgEl) return;
        try {
          const resp = await fetch(imgEl.src);
          const blob = await resp.blob();
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch {}
      }
    },
    'sep',
    ...(() => {
      // Get item type from card's badge or name extension
      const badge = card.querySelector('.type-badge');
      const badgeText = badge?.textContent?.toUpperCase() || '';
      const itemType = badgeText || 'UNKNOWN';
      return ['PNG', 'JPEG', 'WebP'].filter(fmt => {
        const fmtUpper = fmt.toUpperCase();
        if (itemType === fmtUpper) return false;
        if (itemType === 'JPG' && fmtUpper === 'JPEG') return false;
        if (itemType === 'JPEG' && fmtUpper === 'JPG') return false;
        return true;
      }).map(fmt => ({
        label: `Convert to ${fmt}`,
        icon: _ctxIcons.save,
        action: async () => {
          const item = await PixLibrary.get(id);
          if (!item?.dataUrl) return;
          sendToContent('convertAndSave', { src: item.dataUrl, format: fmt.toLowerCase() });
        }
      }));
    })(),
    'sep',
    {
      label: 'Remove from Library',
      icon: _ctxIcons.trash,
      action: async () => {
        await PixLibrary.remove(id);
        libSelectedIds.delete(id);
        updateLibDeleteBtn();
        await renderLibrary();
        const u = await PixLibrary.getUsage();
        $('lib-count').textContent = u.count ? `(${u.count})` : '';
        // Re-render page gallery to update bookmark indicators
        await renderGallery();
      }
    },
  ];

  _showCtxMenu(e.clientX, e.clientY, items);
});

// ============================================================
// Color Item Context Menu
// ============================================================

function _attachColorCtxMenu(container, getColorData) {
  container?.addEventListener('contextmenu', (e) => {
    const colorItem = e.target.closest('.color-item');
    if (!colorItem) return;
    e.preventDefault();
    e.stopPropagation();

    const colorData = getColorData(colorItem);
    if (!colorData) return;

    const hex = colorData.hex;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const hsl = rgbToHsl(r, g, b);
    const rgb = `rgb(${r}, ${g}, ${b})`;

    const items = [
      {
        label: 'Copy HEX',
        icon: _ctxIcons.palette,
        action: () => navigator.clipboard.writeText(hex)
      },
      {
        label: 'Copy RGB',
        icon: _ctxIcons.palette,
        action: () => navigator.clipboard.writeText(rgb)
      },
      {
        label: 'Copy HSL',
        icon: _ctxIcons.palette,
        action: () => navigator.clipboard.writeText(hsl)
      },
    ];

    // "Save to Library" only for picked colors (not favorites, which are already saved differently)
    if (colorData.canSaveToLib) {
      items.push('sep');
      items.push({
        label: 'Save to Library',
        icon: _ctxIcons.bookmark,
        action: async () => {
          const collection = await pickCollectionDialog('Save color to:');
          if (collection) saveColorToLibrary(hex, rgb, hsl, collection);
        }
      });
    }

    _showCtxMenu(e.clientX, e.clientY, items);
  });
}

// Attach to picked colors list
_attachColorCtxMenu($('picked-colors-list'), (item) => {
  const hexEl = item.querySelector('.color-item-hex');
  if (!hexEl) return null;
  return { hex: hexEl.textContent.trim(), canSaveToLib: true };
});

// Attach to favorites list
_attachColorCtxMenu($('fav-colors-list-full'), (item) => {
  const hexEl = item.querySelector('.color-item-hex');
  if (!hexEl) return null;
  return { hex: hexEl.textContent.trim(), canSaveToLib: false };
});

/* ──────────────────────────────────────────────────
   Guided Tour — Side Panel
   ────────────────────────────────────────────────── */

const SP_TOUR_STEPS = [
  // General
  { target: '.main-tabs', title: 'Navigation', text: 'Switch between Page (images from current webpage), Page Colors (color picker & palette), and My Library (saved images).' },

  // Page tab
  { target: '#btn-refresh', title: 'Refresh', text: 'Rescan the current page for images. Auto-refreshes when you switch tabs or scroll (lazy-loaded images detected).' },
  { target: '[data-view="tiles"]', title: 'View Modes', text: '5 view modes: Tiles, Medium, Large, Details, Names. Pick your preferred layout.' },
  { target: '#btn-type-filter', title: 'Type Filter', text: 'Filter by image type \u2014 select multiple formats like PNG + SVG together.' },
  { target: '#btn-toggle-select', title: 'Select & Save', text: 'Select All/None, Save to Library (with collection picker), or Remove from Library. Works on selected or all images.' },
  { target: '#btn-screenshot', title: 'Screenshots', text: 'Capture the viewport or drag to select a region. Screenshots save to My Library automatically.' },
  { target: '#page-bottom-bar', title: 'Download', text: 'Download selected or all images as a ZIP file. Right-click any image for individual download or format conversion.' },

  // Colors tab
  { target: '[data-main-tab="colors"]', title: 'Page Colors', text: 'Pick colors from any webpage, extract the page CSS palette, save favorites, and check WCAG contrast ratios.', switchTab: 'colors' },
  { target: '#btn-eyedropper', title: 'Color Picker', text: 'Click to activate, then click any pixel on the page. Press Escape or click again to cancel.' },
  { target: '.contrast-checker', title: 'Contrast Check', text: 'Click FG, pick a color. Click BG, pick another. Shows WCAG accessibility rating (AAA/AA/Fail).' },

  // Library tab
  { target: '[data-main-tab="library"]', title: 'My Library', text: 'All saved images, screenshots, and colors. Organized by collections. Persistent across sessions.', switchTab: 'library' },
  { target: '[data-lib-filter="all"]', title: 'Filter & Collections', text: 'Filter by type (Images/Screenshots/Colors) and collection. Select items with checkboxes.' },
  { target: '#lib-bottom-bar', title: 'Library Actions', text: 'Select All, export selected/all as ZIP. Send images to Edit, Collage, or Batch tools in the Toolkit.' },

  // Settings
  { target: '#btn-sp-settings', title: 'Quick Settings', text: 'Change theme (dark/light), font family, font size, and toggle hover tooltips.' },
];

let spTourStep = -1;
let spTourOverlay = null;

function startSPTour() {
  spTourStep = 0;
  showSPTourStep();
}

function showSPTourStep() {
  // Remove existing overlay
  document.querySelector('.sp-tour-overlay')?.remove();

  if (spTourStep < 0 || spTourStep >= SP_TOUR_STEPS.length) {
    endSPTour();
    return;
  }

  const step = SP_TOUR_STEPS[spTourStep];

  // Switch tab if needed
  if (step.switchTab) {
    const tabBtn = document.querySelector(`[data-main-tab="${step.switchTab}"]`);
    if (tabBtn) tabBtn.click();
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sp-tour-overlay';

  // Highlight target element
  const targetEl = document.querySelector(step.target);
  if (targetEl) {
    const rect = targetEl.getBoundingClientRect();
    const highlight = document.createElement('div');
    highlight.className = 'sp-tour-highlight';
    highlight.style.top = (rect.top - 4) + 'px';
    highlight.style.left = (rect.left - 4) + 'px';
    highlight.style.width = (rect.width + 8) + 'px';
    highlight.style.height = (rect.height + 8) + 'px';
    overlay.appendChild(highlight);

    // Scroll into view if needed
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Banner at bottom
  const banner = document.createElement('div');
  banner.className = 'sp-tour-banner';

  // Progress dots
  const dots = SP_TOUR_STEPS.map((_, i) =>
    `<div class="sp-tour-dot${i === spTourStep ? ' active' : ''}"></div>`
  ).join('');

  banner.innerHTML = `
    <div class="sp-tour-title">${step.title}</div>
    <div class="sp-tour-text">${step.text}</div>
    <div class="sp-tour-nav">
      <div class="sp-tour-dots">${dots}</div>
      <div class="sp-tour-btns">
        <button class="tool-btn sp-tour-skip" style="padding:3px 10px;border:1px solid var(--slate-700);border-radius:4px;">Skip</button>
        ${spTourStep > 0 ? '<button class="tool-btn sp-tour-prev" style="padding:3px 10px;border:1px solid var(--slate-700);border-radius:4px;">Prev</button>' : ''}
        <button class="btn-primary sp-tour-next" style="padding:3px 12px;">${spTourStep === SP_TOUR_STEPS.length - 1 ? 'Done' : 'Next'}</button>
      </div>
    </div>
  `;

  overlay.appendChild(banner);
  document.body.appendChild(overlay);
  spTourOverlay = overlay;

  // Wire buttons
  banner.querySelector('.sp-tour-skip')?.addEventListener('click', endSPTour);
  banner.querySelector('.sp-tour-prev')?.addEventListener('click', () => { spTourStep--; showSPTourStep(); });
  banner.querySelector('.sp-tour-next')?.addEventListener('click', () => { spTourStep++; showSPTourStep(); });
}

function endSPTour() {
  document.querySelector('.sp-tour-overlay')?.remove();
  spTourOverlay = null;
  spTourStep = -1;
  // Switch back to Page tab
  document.querySelector('[data-main-tab="images"]')?.click();
}

// Keyboard navigation during tour
document.addEventListener('keydown', (e) => {
  if (spTourStep < 0) return;
  if (e.key === 'Escape') endSPTour();
  if (e.key === 'ArrowRight' || e.key === 'Enter') { spTourStep++; showSPTourStep(); }
  if (e.key === 'ArrowLeft') { spTourStep--; showSPTourStep(); }
});

// Wire tour button
$('btn-sp-tour')?.addEventListener('click', startSPTour);

// Show tour hint on first use — points to the ? button
chrome.storage.sync.get({ spTourSeen: false }, (r) => {
  if (!r.spTourSeen) {
    setTimeout(() => {
      const btn = $('btn-sp-tour');
      if (!btn) return;
      const hint = document.createElement('div');
      hint.style.cssText = 'position:fixed;z-index:2000;background:var(--saffron-400);color:#1e293b;font-weight:600;padding:6px 12px;border-radius:6px;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;white-space:nowrap;';
      const rect = btn.getBoundingClientRect();
      hint.style.top = (rect.bottom + 8) + 'px';
      hint.style.right = '12px';
      hint.innerHTML = 'New here? Click <b>?</b> for a quick tour &rarr;';
      // Arrow
      const arrow = document.createElement('div');
      arrow.style.cssText = 'position:absolute;top:-6px;right:14px;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:6px solid var(--saffron-400);';
      hint.appendChild(arrow);
      hint.addEventListener('click', () => { hint.remove(); startSPTour(); });
      // Auto-dismiss after 8 seconds
      setTimeout(() => hint.remove(), 8000);
      document.body.appendChild(hint);
      chrome.storage.sync.set({ spTourSeen: true });
    }, 1500);
  }
});

