// ============================================================
// My Library Tab
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
    if (libSelectedIds.size) exportLibraryAsZip([...libSelectedIds], 'snaproo-selected.zip');
  });
  $('btn-lib-export-all')?.addEventListener('click', async () => {
    const allItems = await PixLibrary.getAll();
    const ids = allItems.filter(item => item.dataUrl).map(item => item.id);
    if (ids.length) exportLibraryAsZip(ids, 'snaproo-library.zip');
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
  await chrome.storage.local.set({ 'snaproo-lib-transfer': { tool, images } });
  chrome.runtime.sendMessage({ action: 'openEditor', mode: tool, fromLib: true });
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
        await chrome.storage.local.set({ 'snaproo-lib-transfer': { tool: 'edit', images: [item.dataUrl] } });
        chrome.runtime.sendMessage({ action: 'openEditor', mode: 'edit', fromLib: true });
      }
    },
    {
      label: 'Send to Collage',
      icon: _ctxIcons.collage,
      action: async () => {
        const item = await PixLibrary.get(id);
        if (!item?.dataUrl) return;
        await chrome.storage.local.set({ 'snaproo-lib-transfer': { tool: 'collage', images: [item.dataUrl] } });
        chrome.runtime.sendMessage({ action: 'openEditor', mode: 'collage', fromLib: true });
      }
    },
    {
      label: 'Send to Batch',
      icon: _ctxIcons.batch,
      action: async () => {
        const item = await PixLibrary.get(id);
        if (!item?.dataUrl) return;
        await chrome.storage.local.set({ 'snaproo-lib-transfer': { tool: 'batch', images: [item.dataUrl] } });
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
          filename: 'snaproo/' + (item.name || `library-image.${ext}`),
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
