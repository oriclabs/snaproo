// Pixeroo Side Panel — Core init (loads last, after all sp-*.js modules)

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
  initSPQuickActions();

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
// Side Panel Quick Actions
// ============================================================

function initSPQuickActions() {
  // Screenshot — capture visible tab, send to editor
  $('sp-qa-screenshot')?.addEventListener('click', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'captureTab' });
      if (response?.dataUrl) {
        const name = 'screenshot-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
        await chrome.storage.local.set({ 'pixeroo-screenshot': { dataUrl: response.dataUrl, name } });
        // Auto-save to library
        if (typeof PixLibrary !== 'undefined') {
          const img = new Image(); img.src = response.dataUrl;
          await new Promise(r => { img.onload = r; img.onerror = r; });
          await PixLibrary.add({ dataUrl: response.dataUrl, source: 'screenshot', name, width: img.naturalWidth, height: img.naturalHeight, type: 'image', size: response.dataUrl.length });
        }
        chrome.runtime.sendMessage({ action: 'openEditor', params: 'fromScreenshot=1' });
      }
    } catch {}
  });

  // Region — start region selection on the page
  $('sp-qa-region')?.addEventListener('click', async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) chrome.tabs.sendMessage(tab.id, { action: 'startRegionCapture' });
    } catch {}
  });

  // Edit — open editor
  $('sp-qa-edit')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openEditor', mode: 'edit' });
  });

  // Convert — open convert tool
  $('sp-qa-convert')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openEditor', mode: 'convert' });
  });

  // QR — open QR tool
  $('sp-qa-qr')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openEditor', mode: 'qr' });
  });
}

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

// Init library on load
initLibrary();
