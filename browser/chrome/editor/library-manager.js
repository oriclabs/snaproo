// Pixeroo — Library Manager (editor topbar)

function initLibraryManager() {
  const grid = $('lm-grid');
  const detail = $('lm-detail');
  if (!grid) return;

  let allItems = [];
  let selectedIds = new Set();
  let currentView = 'tiles';
  let detailItem = null;
  let _previousMode = null;

  // ── Open / Close library ───────────────────────────────
  $('btn-open-library')?.addEventListener('click', () => {
    const lm = $('library-manager');
    const isOpen = lm.style.display === 'flex';
    if (isOpen) {
      closeLibrary();
    } else {
      openLibrary();
    }
  });

  function openLibrary() {
    const lm = $('library-manager');
    // Hide current mode view
    _previousMode = currentMode;
    $$('.mode-view').forEach(v => v.classList.remove('active'));
    $('home')?.classList.add('hidden');
    lm.style.display = 'flex';
    $('btn-open-library')?.classList.add('active');
    $('mode-label').textContent = 'Library';
    $('btn-back').classList.add('visible');
    document.body.classList.add('tool-active');
    loadLibrary();
  }

  function closeLibrary() {
    const lm = $('library-manager');
    lm.style.display = 'none';
    $('btn-open-library')?.classList.remove('active');
    detail.style.display = 'none';
    // Restore previous state
    if (_previousMode) {
      openMode(_previousMode);
    } else {
      goHome();
    }
  }

  // Override back button behavior when library is open
  const origGoHome = window.goHome;
  if (typeof goHome === 'function') {
    window.goHome = function() {
      if ($('library-manager').style.display === 'flex') {
        closeLibrary();
        if (!_previousMode) origGoHome();
        return;
      }
      origGoHome();
    };
  }

  // ── Load library data ──────────────────────────────────
  async function loadLibrary() {
    if (typeof PixLibrary === 'undefined') return;
    allItems = await PixLibrary.getAll();
    allItems = allItems.filter(i => i.type !== 'color' && i.dataUrl);
    updateCollectionFilter();
    updateCount();
    renderGrid();
  }

  function updateCount() {
    $('lm-total').textContent = allItems.length + ' items';
    $('lib-count').textContent = allItems.length;
    $('lm-sel-count').textContent = selectedIds.size + ' selected';
  }

  function updateCollectionFilter() {
    const sel = $('lm-filter-collection');
    if (!sel) return;
    const collections = [...new Set(allItems.map(i => i.collection).filter(Boolean))];
    sel.innerHTML = '<option value="all">All Collections</option>';
    collections.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c; opt.textContent = c;
      sel.appendChild(opt);
    });
  }

  // ── Get filtered & sorted items ────────────────────────
  function getItems() {
    let items = [...allItems];
    const source = $('lm-filter-source')?.value || 'all';
    const collection = $('lm-filter-collection')?.value || 'all';
    if (source !== 'all') items = items.filter(i => i.source === source);
    if (collection !== 'all') items = items.filter(i => i.collection === collection);

    const sort = $('lm-sort')?.value || 'date-desc';
    if (sort === 'date-desc') items.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    else if (sort === 'date-asc') items.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    else if (sort === 'name') items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    else if (sort === 'size-desc') items.sort((a, b) => (b.size || 0) - (a.size || 0));
    else if (sort === 'size-asc') items.sort((a, b) => (a.size || 0) - (b.size || 0));
    return items;
  }

  // ── Render grid ────────────────────────────────────────
  function renderGrid() {
    const items = getItems();
    grid.innerHTML = '';

    if (currentView === 'tiles') {
      grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(80px,1fr))';
    } else if (currentView === 'medium') {
      grid.style.gridTemplateColumns = 'repeat(auto-fill,minmax(140px,1fr))';
    } else {
      grid.style.gridTemplateColumns = '1fr';
    }

    if (items.length === 0) {
      grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:3rem;color:var(--slate-500);">No items in library</div>';
      return;
    }

    items.forEach(item => {
      const card = document.createElement('div');
      const selected = selectedIds.has(item.id);

      if (currentView === 'list') {
        card.style.cssText = `display:flex;align-items:center;gap:10px;padding:6px 10px;border:1.5px solid ${selected ? 'var(--saffron-400)' : 'var(--slate-700)'};border-radius:6px;cursor:pointer;transition:border-color 0.12s;background:${selected ? 'rgba(244,196,48,0.05)' : 'transparent'};`;
        const thumb = document.createElement('img');
        thumb.src = item.dataUrl;
        thumb.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:4px;flex-shrink:0;';
        const info = document.createElement('div');
        info.style.cssText = 'flex:1;min-width:0;';
        info.innerHTML = `<div style="color:var(--slate-200);font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${item.name || 'Untitled'}</div>
          <div style="color:var(--slate-500);font-size:0.6rem;">${item.width || '?'}×${item.height || '?'} · ${_formatSize(item.size)} · ${item.source || ''}</div>`;
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = selected;
        cb.style.cssText = 'accent-color:var(--saffron-400);flex-shrink:0;';
        card.appendChild(cb); card.appendChild(thumb); card.appendChild(info);
      } else {
        card.style.cssText = `position:relative;border:2px solid ${selected ? 'var(--saffron-400)' : 'var(--slate-700)'};border-radius:6px;overflow:hidden;cursor:pointer;aspect-ratio:1;transition:border-color 0.12s;`;
        const img = document.createElement('img');
        img.src = item.dataUrl;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        img.loading = 'lazy';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = selected;
        cb.style.cssText = 'position:absolute;top:3px;left:3px;z-index:2;accent-color:var(--saffron-400);cursor:pointer;';
        if (currentView === 'medium') {
          const label = document.createElement('div');
          label.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(0,0,0,0.7));padding:4px 6px;color:var(--slate-300);font-size:0.55rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
          label.textContent = item.name || 'Untitled';
          card.appendChild(label);
        }
        card.appendChild(cb); card.appendChild(img);
      }

      // Click to select
      card.addEventListener('click', (e) => {
        if (e.target.type === 'checkbox') {
          // Let checkbox handle it
        } else {
          const cb = card.querySelector('input[type=checkbox]');
          if (e.shiftKey || e.ctrlKey) {
            cb.checked = !cb.checked;
          } else {
            // Single click — show detail
            showDetail(item);
            return;
          }
        }
        const cb = card.querySelector('input[type=checkbox]');
        if (cb.checked) selectedIds.add(item.id); else selectedIds.delete(item.id);
        card.style.borderColor = cb.checked ? 'var(--saffron-400)' : 'var(--slate-700)';
        if (currentView === 'list') card.style.background = cb.checked ? 'rgba(244,196,48,0.05)' : 'transparent';
        updateCount();
      });

      // Double-click to open in editor
      card.addEventListener('dblclick', () => {
        sendToTool(item, 'edit');
      });

      grid.appendChild(card);
    });
  }

  // ── Detail panel ───────────────────────────────────────
  function showDetail(item) {
    detailItem = item;
    $('lm-detail-img').src = item.dataUrl;
    $('lm-detail-info').innerHTML = `
      <div><strong>Name:</strong> ${item.name || 'Untitled'}</div>
      <div><strong>Size:</strong> ${_formatSize(item.size)}</div>
      <div><strong>Dimensions:</strong> ${item.width || '?'} × ${item.height || '?'}</div>
      <div><strong>Source:</strong> ${item.source || 'Unknown'}</div>
      <div><strong>Collection:</strong> ${item.collection || '—'}</div>
      <div><strong>Added:</strong> ${item.addedAt ? new Date(item.addedAt).toLocaleDateString() : '—'}</div>
    `;
    detail.style.display = 'block';
  }

  $('lm-detail-close')?.addEventListener('click', () => { detail.style.display = 'none'; });

  $('lm-detail-download')?.addEventListener('click', () => {
    if (!detailItem) return;
    const a = document.createElement('a');
    a.href = detailItem.dataUrl;
    a.download = detailItem.name || 'library-image';
    a.click();
  });

  $('lm-detail-rename')?.addEventListener('click', async () => {
    if (!detailItem || typeof pixDialog === 'undefined') return;
    const name = await pixDialog.prompt('Rename', 'Enter new name:', detailItem.name || '');
    if (name === null || name === undefined) return;
    detailItem.name = name;
    if (typeof PixLibrary !== 'undefined') await PixLibrary.update(detailItem.id, { name });
    showDetail(detailItem);
    renderGrid();
  });

  $('lm-detail-delete')?.addEventListener('click', async () => {
    if (!detailItem) return;
    if (typeof PixLibrary !== 'undefined') await PixLibrary.remove(detailItem.id);
    allItems = allItems.filter(i => i.id !== detailItem.id);
    selectedIds.delete(detailItem.id);
    detail.style.display = 'none';
    updateCount();
    renderGrid();
  });

  $('lm-detail-open')?.addEventListener('click', () => {
    if (detailItem) showSendToMenu(detailItem);
  });

  // ── View buttons ───────────────────────────────────────
  $$('.lm-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      $$('.lm-view-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderGrid();
    });
  });

  // ── Sort & filter ──────────────────────────────────────
  $('lm-sort')?.addEventListener('change', renderGrid);
  $('lm-filter-source')?.addEventListener('change', renderGrid);
  $('lm-filter-collection')?.addEventListener('change', renderGrid);

  // ── Select all ─────────────────────────────────────────
  $('lm-select-all')?.addEventListener('click', () => {
    const items = getItems();
    const allSelected = items.every(i => selectedIds.has(i.id));
    if (allSelected) {
      selectedIds.clear();
    } else {
      items.forEach(i => selectedIds.add(i.id));
    }
    $('lm-select-all').textContent = selectedIds.size ? 'Deselect All' : 'Select All';
    updateCount();
    renderGrid();
  });

  // ── Add files ──────────────────────────────────────────
  $('lm-add-files')?.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files.length || typeof PixLibrary === 'undefined') return;
    for (const file of files) {
      const img = await loadImg(file);
      if (!img) continue;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = c.toDataURL('image/png');
      await PixLibrary.add({
        dataUrl, source: 'local', name: file.name,
        width: img.naturalWidth, height: img.naturalHeight,
        type: 'image', size: dataUrl.length,
      });
    }
    e.target.value = '';
    await loadLibrary();
  });

  // ── Export selected ────────────────────────────────────
  $('lm-export')?.addEventListener('click', async () => {
    if (!selectedIds.size) return;
    if (typeof ZipWriter === 'undefined') return;
    const zip = new ZipWriter();
    for (const id of selectedIds) {
      const item = allItems.find(i => i.id === id);
      if (!item?.dataUrl) continue;
      const resp = await fetch(item.dataUrl);
      const buf = await resp.arrayBuffer();
      const ext = item.dataUrl.startsWith('data:image/png') ? 'png' : item.dataUrl.startsWith('data:image/jpeg') ? 'jpg' : 'png';
      zip.addFile(`${item.name || 'image'}.${ext}`, new Uint8Array(buf));
    }
    const blob = zip.finish();
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: 'pixeroo/library-export.zip', saveAs: true });
  });

  // ── Delete selected ────────────────────────────────────
  $('lm-delete')?.addEventListener('click', async () => {
    if (!selectedIds.size) return;
    if (typeof pixDialog !== 'undefined') {
      const ok = await pixDialog.confirm('Delete', `Delete ${selectedIds.size} item${selectedIds.size > 1 ? 's' : ''}?`);
      if (!ok) return;
    }
    if (typeof PixLibrary !== 'undefined') {
      for (const id of selectedIds) await PixLibrary.remove(id);
    }
    allItems = allItems.filter(i => !selectedIds.has(i.id));
    selectedIds.clear();
    detail.style.display = 'none';
    updateCount();
    renderGrid();
  });

  // ── Move to collection ─────────────────────────────────
  $('lm-move-collection')?.addEventListener('click', async () => {
    if (!selectedIds.size) return;
    if (typeof pickCollectionDialog !== 'function') return;
    const collection = await pickCollectionDialog('Move to Collection');
    if (!collection) return;
    if (typeof PixLibrary !== 'undefined') {
      for (const id of selectedIds) await PixLibrary.update(id, { collection });
    }
    await loadLibrary();
  });

  // ── Send to tool ───────────────────────────────────────
  $('lm-send-to')?.addEventListener('click', () => {
    if (!selectedIds.size) return;
    const first = allItems.find(i => selectedIds.has(i.id));
    if (first) showSendToMenu(first);
  });

  function showSendToMenu(item) {
    // Simple: send to edit tool
    sendToTool(item, 'edit');
  }

  function sendToTool(item, tool) {
    closeLibrary();
    if (tool === 'edit') {
      openMode('edit');
      // Trigger library import with this item
      setTimeout(() => {
        const img = new Image();
        img.src = item.dataUrl;
        img.onload = () => {
          if (typeof window._loadEditImage === 'function') {
            window._loadEditImage(img, item.name || 'library-image');
          }
        };
      }, 100);
    }
  }

  // ── Helpers ────────────────────────────────────────────
  function _formatSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  // ── Init count on load ─────────────────────────────────
  (async () => {
    if (typeof PixLibrary !== 'undefined') {
      try {
        const items = await PixLibrary.getAll();
        const count = items.filter(i => i.type !== 'color' && i.dataUrl).length;
        $('lib-count').textContent = count;
      } catch {}
    }
  })();
}
