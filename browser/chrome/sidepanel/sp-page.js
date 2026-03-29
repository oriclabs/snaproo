// ============================================================
// Page Images Tab — View Modes, Filters, Sort, Selection, Scanner, Gallery, Download, Screenshot
// ============================================================

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

async function scanPageImages() {
  const gallery = $('gallery');
  const extMsg = $('extension-tab-msg');

  gallery.style.display = '';
  extMsg.style.display = 'none';
  gallery.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--slate-500);grid-column:1/-1;">Scanning page images...</div>';

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

      // Known restricted URLs (uses shared isRestrictedUrl from sp-shared.js)
      const isUrlRestricted = isRestrictedUrl(url);

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
  gallery.innerHTML = `<div style="text-align:center;padding:2rem 1rem;max-width:100%;grid-column:1/-1;">
    <div style="color:var(--slate-400);margin-bottom:0.5rem;word-wrap:break-word;">${escapeHtml(text)}</div>
    <div style="color:var(--slate-500);line-height:1.5;">Make sure you are on a website and the page has fully loaded. Try clicking Refresh.</div>
  </div>`;
  _setPageFooter(false);
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
    gallery.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--slate-500);grid-column:1/-1;">No images found</div>';
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
