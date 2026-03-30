// Snaproo — Convert Tool

function initConvert() {
  let cvtFiles = []; // { file, objectUrl, custom: null | { fmt, quality, w, h } }
  let selectedIndex = 0;

  const FORMAT_INFO = {
    png:  'Lossless · Transparency · Larger files',
    jpeg: 'Lossy · Small files · No transparency',
    webp: 'Modern · Smallest · Good quality',
    bmp:  'Uncompressed · Very large · No transparency',
    svg:  'Vector trace · Scalable · Best for logos & icons',
    'svg-embed': 'Raster wrapped in SVG · Lossless · Fast · Any image',
  };

  // ── Drop zone ──────────────────────────────────────────
  setupDropzone($('convert-drop'), $('convert-file'), (file) => {
    addFiles([file]);
  }, { multiple: true });

  // Add more buttons (ribbon + panel)
  function _triggerAddFiles() {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.addEventListener('change', () => { if (input.files.length) addFiles([...input.files]); });
    input.click();
  }
  $('btn-convert-add2')?.addEventListener('click', _triggerAddFiles);

  // Library import
  $('btn-convert-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      const files = [];
      for (const item of items) {
        const resp = await fetch(item.dataUrl);
        const blob = await resp.blob();
        const file = new File([blob], item.name || 'library-image.png', { type: blob.type });
        files.push(file);
      }
      if (files.length) addFiles(files);
    });
  });

  // Clear all
  $('btn-convert-clear2')?.addEventListener('click', () => {
    $('btn-convert-clear')?.click();
  });

  // Select all / deselect all toggle
  $('btn-convert-selall')?.addEventListener('click', () => {
    const allChecked = cvtFiles.every(f => f.checked !== false);
    cvtFiles.forEach(f => f.checked = !allChecked);
    $('btn-convert-selall').textContent = allChecked ? 'All' : 'None';
    updateFileList();
  });

  // Remove unchecked files
  $('btn-convert-clear-sel')?.addEventListener('click', () => {
    const unchecked = cvtFiles.filter(f => f.checked === false);
    unchecked.forEach(f => URL.revokeObjectURL(f.objectUrl));
    cvtFiles = cvtFiles.filter(f => f.checked !== false);
    if (cvtFiles.length === 0) {
      $('btn-convert-clear')?.click(); // triggers full clear UI reset
    } else {
      selectedIndex = Math.min(selectedIndex, cvtFiles.length - 1);
      updateFileList();
      selectFile(selectedIndex);
    }
  });

  $('btn-convert-add')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.addEventListener('change', () => { if (input.files.length) addFiles([...input.files]); });
    input.click();
  });

  // ── Add files ──────────────────────────────────────────
  function addFiles(files) {
    for (const file of files) {
      cvtFiles.push({ file, objectUrl: URL.createObjectURL(file), custom: null, checked: true });
    }
    $('convert-drop').style.display = 'none';
    $('convert-preview').style.display = '';
    $('convert-file-panel').style.display = 'flex'; $('convert-actions-bar').style.display = 'flex';
    $('btn-convert-go').disabled = false;
    updateFileList();
    selectFile(cvtFiles.length - 1);
    // Only auto-select format on first file, not when adding more
    if (cvtFiles.length === files.length) autoSelectFormat();
    updateFormatStates();
    showCompressionPreview();
    if (typeof _updateWarnings === 'function') _updateWarnings();
  }

  // ── File list panel ────────────────────────────────────
  function updateFileList() {
    const list = $('convert-file-list');
    list.innerHTML = '';
    cvtFiles.forEach((f, i) => {
      const el = document.createElement('div');
      el.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;cursor:pointer;margin-bottom:3px;border:1.5px solid ${i === selectedIndex ? 'var(--saffron-400)' : 'var(--slate-700)'};background:${i === selectedIndex ? 'rgba(244,196,48,0.05)' : 'transparent'};`;
      // Thumbnail with format tag
      const thumbWrap = document.createElement('div');
      thumbWrap.style.cssText = 'position:relative;flex-shrink:0;';
      const thumb = document.createElement('img');
      thumb.src = f.objectUrl;
      thumb.style.cssText = 'width:48px;height:48px;object-fit:cover;border-radius:4px;display:block;border:1px solid var(--slate-700);';
      const ext = f.file.name.split('.').pop()?.toUpperCase() || '?';
      const tag = document.createElement('span');
      tag.textContent = ext;
      const tagColors = { PNG: '#22c55e', JPG: '#3b82f6', JPEG: '#3b82f6', WEBP: '#a855f7', GIF: '#f97316', SVG: '#14b8a6', BMP: '#64748b' };
      tag.style.cssText = `position:absolute;bottom:-3px;right:-3px;font-size:0.55rem;font-weight:700;padding:2px 4px;border-radius:3px;background:${tagColors[ext] || '#64748b'};color:#fff;line-height:1;letter-spacing:0.02em;`;
      thumbWrap.appendChild(thumb);
      thumbWrap.appendChild(tag);
      // Info + custom badge
      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      const customBadge = f.custom ? `<span style="color:var(--saffron-400);font-size:0.5rem;margin-left:4px;border:1px solid var(--saffron-400);border-radius:3px;padding:0 3px;">Custom</span>` : '';
      const outputFmt = f.custom ? f.custom.fmt.toUpperCase() : '';
      const outputInfo = outputFmt ? ` → <span style="color:var(--saffron-400);">${outputFmt}</span>` : '';
      info.innerHTML = `<div style="color:var(--slate-200);font-size:0.7rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.file.name}${customBadge}</div><div style="color:var(--slate-400);font-size:0.6rem;">${_fmtSize(f.file.size)}${outputInfo}</div>`;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '\u00D7';
      removeBtn.style.cssText = 'background:none;border:none;color:var(--slate-500);cursor:pointer;font-size:0.75rem;padding:0 2px;';
      removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFile(i); });
      // Checkbox for selective conversion
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = f.checked !== false;
      cb.style.cssText = 'accent-color:var(--saffron-400);flex-shrink:0;';
      cb.addEventListener('change', (e) => { e.stopPropagation(); cvtFiles[i].checked = cb.checked; });

      el.appendChild(cb); el.appendChild(thumbWrap); el.appendChild(info); el.appendChild(removeBtn);
      el.addEventListener('click', (e) => { if (e.target !== cb) selectFile(i); });
      list.appendChild(el);
    });
    $('convert-status').textContent = cvtFiles.length + ' file' + (cvtFiles.length !== 1 ? 's' : '');
  }

  function selectFile(idx) {
    if (idx < 0 || idx >= cvtFiles.length) return;
    selectedIndex = idx;
    const f = cvtFiles[idx];
    $('convert-img').src = f.objectUrl;
    $('convert-img-info').textContent = `${f.file.name} · ${_fmtSize(f.file.size)}`;
    // Update custom panel
    _syncCustomPanel(f);
    updateFileList();
    updateFormatStates();
    showCompressionPreview();
    _debounceOutputPreview();
  }

  function removeFile(idx) {
    URL.revokeObjectURL(cvtFiles[idx].objectUrl);
    cvtFiles.splice(idx, 1);
    if (cvtFiles.length === 0) {
      $('convert-drop').style.display = '';
      $('convert-preview').style.display = 'none';
      $('convert-file-panel').style.display = 'none'; $('convert-actions-bar').style.display = 'none'; $('convert-warnings-bar').style.display = 'none';
      $('btn-convert-go').disabled = true;
      $('compression-preview').innerHTML = 'Load image to see sizes';
      return;
    }
    selectedIndex = Math.min(selectedIndex, cvtFiles.length - 1);
    updateFileList();
    selectFile(selectedIndex);
  }

  // ── Clear all ──────────────────────────────────────────
  $('btn-convert-clear')?.addEventListener('click', () => {
    cvtFiles.forEach(f => URL.revokeObjectURL(f.objectUrl));
    cvtFiles = [];
    selectedIndex = 0;
    $('convert-drop').style.display = '';
    $('convert-preview').style.display = 'none';
    $('convert-file-panel').style.display = 'none'; $('convert-actions-bar').style.display = 'none'; $('convert-warnings-bar').style.display = 'none';
    $('btn-convert-go').disabled = true;
    $('compression-preview').innerHTML = 'Load image to see sizes';
    $('convert-status').textContent = '0 files';
  });

  // ── Format buttons ─────────────────────────────────────
  $$('#convert-formats .format-btn:not([disabled])').forEach(b => b.addEventListener('click', () => {
    $$('#convert-formats .format-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const fmt = b.dataset.fmt;
    $('convert-quality-section').style.display = ['jpeg','webp'].includes(fmt) ? '' : 'none';
    $('convert-svg-section').style.display = fmt === 'svg' ? '' : 'none';
    $('convert-fmt-hint').textContent = FORMAT_INFO[fmt] || '';
    showCompressionPreview();
    _debounceOutputPreview();
    _updateWarnings();
  }));

  // SVG spinner changes → live preview
  ['cvt-svg-smooth', 'cvt-svg-blur', 'cvt-svg-colors', 'cvt-svg-minarea', 'cvt-svg-maxdim'].forEach(id => {
    $(id)?.addEventListener('change', _debounceOutputPreview);
    $(id)?.addEventListener('input', _debounceOutputPreview);
  });

  let _previewTimer = null;
  function _debounceOutputPreview() { clearTimeout(_previewTimer); _previewTimer = setTimeout(_updateOutputPreview, 400); }

  // Quality changes also trigger preview
  $('convert-quality')?.addEventListener('input', (e) => {
    $('convert-quality-val').textContent = e.target.value;
    showCompressionPreview();
    _debounceOutputPreview();
  });

  async function _updateOutputPreview() {
    if (!cvtFiles.length) { $('convert-output-preview-wrap').style.display = 'none'; return; }
    // Use custom format if this file has custom settings, otherwise global
    const cc = cvtFiles[selectedIndex]?.custom;
    const fmt = cc ? cc.fmt : (document.querySelector('#convert-formats .format-btn.active')?.dataset.fmt);
    const file = cvtFiles[selectedIndex]?.file;
    if (!file) return;

    const container = $('convert-output-preview');
    const wrap = $('convert-output-preview-wrap');

    // Show loader
    wrap.style.display = '';
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100px;color:var(--slate-500);font-size:0.7rem;gap:8px;"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Generating preview...</div>';
    $('convert-output-label').textContent = fmt === 'svg' ? 'SVG Preview' : (fmt || 'PNG').toUpperCase() + ' Preview';
    $('convert-output-size').textContent = '';

    // Block preview for unsupported formats
    if (['avif', 'tiff', 'ico'].includes(fmt)) {
      container.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100px;gap:8px;padding:1rem;"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg><span style="color:#ef4444;font-size:0.75rem;font-weight:600;">Cannot convert to ${fmt.toUpperCase()}</span><span style="color:var(--slate-400);font-size:0.65rem;">Browser does not support ${fmt.toUpperCase()} export</span></div>`;
      $('convert-output-label').textContent = 'Not Supported';
      $('convert-output-size').textContent = '';
      return;
    }

    const img = await loadImg(file);
    if (!img) return;

    if (fmt === 'svg-embed') {
      // SVG embed preview — just show original with size info
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = c.toDataURL('image/png');
      const svgSize = dataUrl.length + 150; // approximate SVG wrapper overhead
      container.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--slate-400);font-size:0.7rem;">Raster embedded as-is inside SVG wrapper.<br>No quality loss. Scalable container.</div>`;
      $('convert-output-label').textContent = 'SVG Embed';
      $('convert-output-size').textContent = `(~${_fmtSize(svgSize)})`;
      return;
    }

    if (fmt === 'svg') {
      // SVG trace preview
      if (typeof SvgTracer === 'undefined') return;
      const maxDim = +($('cvt-svg-maxdim')?.value) || 400;
      let c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      if (c.width > maxDim || c.height > maxDim) {
        const s = Math.min(maxDim / c.width, maxDim / c.height);
        const tc = document.createElement('canvas'); tc.width = Math.round(c.width * s); tc.height = Math.round(c.height * s);
        tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
        c = tc;
      }
      const svgStr = SvgTracer.trace(c, {
        colors: +($('cvt-svg-colors')?.value) || 8,
        blur: +($('cvt-svg-blur')?.value) ?? 1,
        simplify: +($('cvt-svg-smooth')?.value) ?? 1.5,
        smooth: +($('cvt-svg-smooth')?.value) > 0,
        minArea: +($('cvt-svg-minarea')?.value) || 20,
      });
      container.innerHTML = svgStr;
      const svgEl = container.querySelector('svg');
      if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.maxHeight = '50vh'; svgEl.style.display = 'block'; }
      $('convert-output-label').textContent = 'SVG Preview';
      $('convert-output-size').textContent = `(${_fmtSize(new Blob([svgStr]).size)})`;
    } else {
      // Raster format preview
      const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fmt] || 'image/png';
      const q = cc ? cc.quality / 100 : (['jpeg', 'webp'].includes(fmt) ? +$('convert-quality').value / 100 : undefined);
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, mime, q));
      const url = URL.createObjectURL(blob);
      container.innerHTML = `<img src="${url}" style="max-width:100%;max-height:50vh;display:block;border-radius:4px;">`;
      $('convert-output-label').textContent = fmt.toUpperCase() + ' Preview';
      $('convert-output-size').textContent = `(${_fmtSize(blob.size)})`;
    }
    wrap.style.display = '';
  }

  // Show hint for initial active format
  $('convert-fmt-hint').textContent = FORMAT_INFO.png;

  // ── Auto-select best output format ─────────────────────
  function autoSelectFormat() {
    if (!cvtFiles.length) return;
    const file = cvtFiles[selectedIndex]?.file;
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    // Map input to best alternative output
    const bestAlt = { png: 'webp', jpg: 'webp', jpeg: 'webp', webp: 'png', bmp: 'png', gif: 'png', svg: 'png', avif: 'png', tiff: 'png' };
    const targetFmt = bestAlt[ext] || 'png';
    const btn = document.querySelector(`#convert-formats .format-btn[data-fmt="${targetFmt}"]`);
    if (btn && !btn.disabled) {
      $$('#convert-formats .format-btn').forEach(x => x.classList.remove('active'));
      btn.classList.add('active');
      $('convert-quality-section').style.display = ['jpeg','webp'].includes(targetFmt) ? '' : 'none';
      $('convert-svg-section').style.display = targetFmt === 'svg' ? '' : 'none';
      $('convert-fmt-hint').textContent = FORMAT_INFO[targetFmt] || '';
    }
  }

  // ── Dynamic format states ──────────────────────────────
  function updateFormatStates() {
    if (!cvtFiles.length) {
      // Reset all to default
      $$('#convert-formats .format-btn').forEach(btn => {
        btn.classList.remove('fmt-supported', 'fmt-same', 'fmt-unsupported');
        btn.querySelector('.fmt-badge')?.remove();
        btn.querySelector('.fmt-warn')?.remove();
      });
      return;
    }
    const file = cvtFiles[selectedIndex]?.file;
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const inputFmt = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', bmp: 'bmp', gif: 'gif', svg: 'svg', avif: 'avif' }[ext] || '';

    $$('#convert-formats .format-btn').forEach(btn => {
      const fmt = btn.dataset.fmt;
      // Remove old classes and badges
      btn.classList.remove('fmt-supported', 'fmt-same', 'fmt-unsupported');
      btn.querySelector('.fmt-badge')?.remove();
      btn.querySelector('.fmt-warn')?.remove();

      if (btn.disabled) {
        // AVIF/TIFF/ICO — unsupported (red)
        btn.classList.add('fmt-unsupported');
        return;
      }

      if (fmt === inputFmt) {
        // Same as input — amber
        btn.classList.add('fmt-same');
        const badge = document.createElement('span');
        badge.className = 'fmt-badge';
        badge.style.cssText = 'font-size:0.45rem;color:#f59e0b;margin-left:2px;';
        badge.textContent = '(same)';
        btn.appendChild(badge);
      } else {
        // Supported, different — green
        btn.classList.add('fmt-supported');
      }

      if (fmt === 'jpeg' && (ext === 'png' || ext === 'gif' || ext === 'svg' || ext === 'webp')) {
        // Transparency warning
        const existing = btn.querySelector('.fmt-warn');
        if (!existing) {
          const warn = document.createElement('span');
          warn.className = 'fmt-warn';
          warn.style.cssText = 'color:#f59e0b;font-size:0.5rem;margin-left:2px;';
          warn.textContent = '⚠';
          warn.title = 'Transparency will be lost';
          btn.appendChild(warn);
        }
      } else {
        btn.querySelector('.fmt-warn')?.remove();
      }
    });
  }

  // ── Per-file custom settings ────────────────────────────
  function _syncCustomPanel(f) {
    const panel = $('cvt-custom-panel');
    if (!panel) return;
    panel.style.display = '';
    const toggle = $('cvt-custom-toggle');
    const fields = $('cvt-custom-fields');
    toggle.checked = !!f.custom;
    fields.style.display = f.custom ? '' : 'none';
    if (f.custom) {
      $('cvt-custom-fmt').value = f.custom.fmt || 'png';
      $('cvt-custom-quality').value = f.custom.quality || 85;
      $('cvt-custom-quality-val').textContent = f.custom.quality || 85;
      $('cvt-custom-w').value = f.custom.w || '';
      $('cvt-custom-h').value = f.custom.h || '';
    }
  }

  function _saveCustomFromPanel() {
    if (!cvtFiles[selectedIndex]) return;
    if (!$('cvt-custom-toggle').checked) {
      cvtFiles[selectedIndex].custom = null;
    } else {
      cvtFiles[selectedIndex].custom = {
        fmt: $('cvt-custom-fmt').value,
        quality: +$('cvt-custom-quality').value || 85,
        w: +$('cvt-custom-w').value || 0,
        h: +$('cvt-custom-h').value || 0,
      };
    }
    updateFileList();
    // Auto-refresh preview and warnings with custom settings
    _debounceOutputPreview();
    if (typeof _updateWarnings === 'function') _updateWarnings();
  }

  // Toggle custom on/off
  $('cvt-custom-toggle')?.addEventListener('change', () => {
    const fields = $('cvt-custom-fields');
    if ($('cvt-custom-toggle').checked) {
      fields.style.display = '';
      // Initialize with global settings
      const globalFmt = document.querySelector('#convert-formats .format-btn.active')?.dataset.fmt || 'png';
      $('cvt-custom-fmt').value = globalFmt;
      $('cvt-custom-quality').value = $('convert-quality')?.value || 85;
      $('cvt-custom-quality-val').textContent = $('convert-quality')?.value || 85;
      $('cvt-custom-w').value = $('cvt-resize-w')?.value || '';
      $('cvt-custom-h').value = $('cvt-resize-h')?.value || '';
    } else {
      fields.style.display = 'none';
    }
    _saveCustomFromPanel();
  });

  // Save on any field change
  ['cvt-custom-fmt', 'cvt-custom-quality', 'cvt-custom-w', 'cvt-custom-h'].forEach(id => {
    $(id)?.addEventListener('change', _saveCustomFromPanel);
    $(id)?.addEventListener('input', () => {
      if (id === 'cvt-custom-quality') $('cvt-custom-quality-val').textContent = $(id).value;
      _saveCustomFromPanel();
    });
  });

  // Copy global settings
  $('cvt-custom-copy')?.addEventListener('click', () => {
    const globalFmt = document.querySelector('#convert-formats .format-btn.active')?.dataset.fmt || 'png';
    $('cvt-custom-fmt').value = globalFmt;
    $('cvt-custom-quality').value = $('convert-quality')?.value || 85;
    $('cvt-custom-quality-val').textContent = $('convert-quality')?.value || 85;
    $('cvt-custom-w').value = $('cvt-resize-w')?.value || '';
    $('cvt-custom-h').value = $('cvt-resize-h')?.value || '';
    if (!$('cvt-custom-toggle').checked) {
      $('cvt-custom-toggle').checked = true;
      $('cvt-custom-fields').style.display = '';
    }
    _saveCustomFromPanel();
  });

  // ── Warnings ───────────────────────────────────────────
  function _updateWarnings() {
    const bar = $('convert-warnings-bar');
    const hint = $('convert-fmt-hint');
    if (!bar) return;

    // Keep format hint clean
    const globalFmt = document.querySelector('#convert-formats .format-btn.active')?.dataset.fmt;
    if (hint) hint.textContent = FORMAT_INFO[globalFmt] || '';

    if (!cvtFiles.length) { bar.style.display = 'none'; return; }

    const warnings = [];
    for (const f of cvtFiles) {
      if (f.checked === false) continue; // skip unchecked
      const ext = f.file.name.split('.').pop()?.toLowerCase();
      const inputFmt = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', bmp: 'bmp', gif: 'gif', svg: 'svg' }[ext] || '';
      const fmt = f.custom ? f.custom.fmt : globalFmt;

      if (['avif', 'tiff', 'ico'].includes(fmt)) {
        warnings.push({ icon: '✗', color: '#ef4444', text: `${f.file.name}: cannot convert to ${fmt.toUpperCase()} (not supported)` });
      } else if (fmt === inputFmt) {
        warnings.push({ icon: '⚠', color: '#f59e0b', text: `${f.file.name}: same format (${ext.toUpperCase()})` });
      }
      if (fmt === 'jpeg' && ['png', 'gif', 'svg', 'webp'].includes(ext)) {
        warnings.push({ icon: '⚠', color: '#f59e0b', text: `${f.file.name}: transparency will be lost` });
      }
      if (fmt === 'svg' && ['jpg', 'jpeg'].includes(ext)) {
        warnings.push({ icon: '💡', color: '#3b82f6', text: `${f.file.name}: photo → SVG trace may be slow. Try SVG Embed.` });
      }
    }

    if (warnings.length > 0) {
      bar.style.display = '';
      bar.innerHTML = warnings.map(w =>
        `<div style="display:flex;align-items:center;gap:6px;padding:2px 0;font-size:0.65rem;"><span style="flex-shrink:0;">${w.icon}</span><span style="color:${w.color};">${w.text}</span></div>`
      ).join('');
    } else {
      bar.style.display = 'none';
      bar.innerHTML = '';
    }
  }

  // ── Target size toggle ─────────────────────────────────
  $('convert-target-size')?.addEventListener('change', (e) => {
    $('convert-max-kb').style.display = e.target.checked ? '' : 'none';
    $('convert-max-kb-unit').style.display = e.target.checked ? '' : 'none';
  });

  // ── Compression size preview ───────────────────────────
  async function showCompressionPreview() {
    if (!cvtFiles.length) return;
    const file = cvtFiles[selectedIndex]?.file;
    if (!file) return;
    const img = await loadImg(file);
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);

    const el = $('compression-preview');
    el.innerHTML = '<span style="color:var(--slate-500);">Calculating...</span>';

    const originalSize = file.size;
    const results = [];

    for (const [fmt, mime] of [['PNG','image/png'],['JPEG','image/jpeg'],['WebP','image/webp']]) {
      if (fmt === 'PNG') {
        const blob = await new Promise(r => c.toBlob(r, mime));
        results.push({ format: fmt, quality: '', size: blob.size, sizeStr: _fmtSize(blob.size) });
      } else {
        const q = +($('convert-quality')?.value || 85) / 100;
        const blob = await new Promise(r => c.toBlob(r, mime, q));
        results.push({ format: fmt, quality: Math.round(q * 100) + '%', size: blob.size, sizeStr: _fmtSize(blob.size) });
      }
    }

    el.innerHTML = `<div style="color:var(--slate-300);font-size:0.6rem;margin-bottom:3px;">Original: ${_fmtSize(originalSize)}</div>` +
      results.map(r => {
        const saving = originalSize > 0 ? Math.round((1 - r.size / originalSize) * 100) : 0;
        const savingColor = saving > 0 ? '#22c55e' : saving < 0 ? '#ef4444' : 'var(--slate-500)';
        return `<div style="display:flex;justify-content:space-between;padding:1px 0;"><span style="color:var(--slate-400);font-size:0.6rem;">${r.format} ${r.quality}</span><span style="color:var(--slate-200);font-size:0.6rem;">${r.sizeStr} <span style="color:${savingColor};font-size:0.5rem;">${saving > 0 ? '-' : '+'}${Math.abs(saving)}%</span></span></div>`;
      }).join('');
  }

  // ── Convert & Download ─────────────────────────────────
  $('btn-convert-go')?.addEventListener('click', async () => {
    if (!cvtFiles.length) return;
    const fmtBtn = document.querySelector('#convert-formats .format-btn.active');
    const fmt = fmtBtn?.dataset.fmt || 'png';
    const isSvg = fmt === 'svg';
    const isSvgEmbed = fmt === 'svg-embed';
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fmt] || 'image/png';
    const q = ['jpeg', 'webp'].includes(fmt) ? +$('convert-quality').value / 100 : undefined;
    const targetSize = $('convert-target-size')?.checked;
    const maxKB = +($('convert-max-kb')?.value) || 200;
    const resizeW = +($('cvt-resize-w')?.value) || 0;
    const resizeH = +($('cvt-resize-h')?.value) || 0;
    const lockAspect = $('cvt-resize-lock')?.checked;
    const renamePattern = $('cvt-rename')?.value || '{name}';
    const ext = fmt === 'jpeg' ? 'jpg' : fmt;
    const svgColors = +($('cvt-svg-colors')?.value) || 8;
    const svgSmooth = +($('cvt-svg-smooth')?.value) ?? 1.5;
    const svgBlur = +($('cvt-svg-blur')?.value) ?? 1;
    const svgMinArea = +($('cvt-svg-minarea')?.value) || 20;

    const progress = $('convert-progress');
    const bar = $('convert-progress-bar');
    progress.style.display = '';
    bar.style.width = '0%';

    const total = cvtFiles.length;
    const useZip = total > 1 && typeof ZipWriter !== 'undefined';
    const zip = useZip ? new ZipWriter() : null;
    const results = []; // { filename, blob } for single-file download

    for (let i = 0; i < total; i++) {
      const f = cvtFiles[i];
      if (f.checked === false) { bar.style.width = Math.round((i + 1) / total * 100) + '%'; continue; }
      const img = await loadImg(f.file);
      if (!img) continue;

      // Per-file custom settings override globals
      const cc = f.custom; // null or { fmt, quality, w, h }
      const fileFmt = cc ? cc.fmt : fmt;
      const fileMime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fileFmt] || 'image/png';
      const fileQ = cc ? cc.quality / 100 : q;
      const fileExt = fileFmt === 'jpeg' ? 'jpg' : (fileFmt === 'svg-embed' ? 'svg' : fileFmt);
      const fileRW = cc ? (cc.w || 0) : resizeW;
      const fileRH = cc ? (cc.h || 0) : resizeH;
      const fileIsSvg = fileFmt === 'svg';
      const fileIsSvgEmbed = fileFmt === 'svg-embed';

      let w = img.naturalWidth, h = img.naturalHeight;
      if (fileRW > 0 || fileRH > 0) {
        if (fileRW > 0 && fileRH > 0 && !lockAspect) { w = fileRW; h = fileRH; }
        else if (fileRW > 0) { w = fileRW; h = lockAspect ? Math.round(fileRW * img.naturalHeight / img.naturalWidth) : (fileRH || Math.round(fileRW * img.naturalHeight / img.naturalWidth)); }
        else if (fileRH > 0) { h = fileRH; w = lockAspect ? Math.round(fileRH * img.naturalWidth / img.naturalHeight) : (fileRW || Math.round(fileRH * img.naturalWidth / img.naturalHeight)); }
      }

      const srcC = document.createElement('canvas');
      srcC.width = img.naturalWidth; srcC.height = img.naturalHeight;
      srcC.getContext('2d').drawImage(img, 0, 0);
      const c = (w !== img.naturalWidth || h !== img.naturalHeight) ?
        (typeof steppedResize === 'function' ? steppedResize(srcC, w, h) : (() => { const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(srcC, 0, 0, w, h); return t; })()) : srcC;

      const baseName = f.file.name.replace(/\.[^.]+$/, '');

      // SVG embed (wrap raster as base64 inside SVG)
      if (fileIsSvgEmbed) {
        const dataUrl = c.toDataURL('image/png');
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}"><image width="${c.width}" height="${c.height}" xlink:href="${dataUrl}"/></svg>`;
        const filename = renamePattern.replace(/\{name\}/g, baseName).replace(/\{index\}/g, String(i + 1).padStart(3, '0')).replace(/\{fmt\}/g, 'svg') + '.svg';
        if (useZip) {
          zip.addFile(filename, new TextEncoder().encode(svgStr));
        } else {
          Platform.download(new Blob([svgStr], { type: 'image/svg+xml' }), `snaproo/${filename}`, true);
        }
        bar.style.width = Math.round((i + 1) / total * 100) + '%';
        continue;
      }

      // SVG trace
      if (fileIsSvg) {
        if (typeof SvgTracer === 'undefined') { continue; }
        // Downscale for cleaner/faster tracing
        const maxDim = +($('cvt-svg-maxdim')?.value) || 400;
        let traceC = c;
        if (c.width > maxDim || c.height > maxDim) {
          const traceScale = Math.min(maxDim / c.width, maxDim / c.height);
          const tw = Math.round(c.width * traceScale), th = Math.round(c.height * traceScale);
          traceC = document.createElement('canvas'); traceC.width = tw; traceC.height = th;
          traceC.getContext('2d').drawImage(c, 0, 0, tw, th);
        }
        const svgStr = SvgTracer.trace(traceC, {
          colors: svgColors,
          blur: svgBlur,
          simplify: svgSmooth,
          smooth: svgSmooth > 0,
          minArea: svgMinArea,
        });
        const filename = renamePattern.replace(/\{name\}/g, baseName).replace(/\{index\}/g, String(i + 1).padStart(3, '0')).replace(/\{fmt\}/g, 'svg') + '.svg';
        if (useZip) {
          zip.addFile(filename, new TextEncoder().encode(svgStr));
        } else {
          const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
          Platform.download(URL.createObjectURL(svgBlob), `snaproo/${filename}`, true);
        }
        bar.style.width = Math.round((i + 1) / total * 100) + '%';
        continue;
      }

      let blob = await new Promise(r => c.toBlob(r, fileMime, fileQ));

      // Compress to target size
      if (targetSize && fileFmt !== 'png' && blob.size > maxKB * 1024) {
        let lo = 0.05, hi = fileQ || 0.85, attempts = 0;
        while (attempts < 8 && blob.size > maxKB * 1024 && hi - lo > 0.02) {
          const mid = (lo + hi) / 2;
          blob = await new Promise(r => c.toBlob(r, fileMime, mid));
          if (blob.size > maxKB * 1024) hi = mid; else lo = mid;
          attempts++;
        }
      }

      const filename = renamePattern
        .replace(/\{name\}/g, baseName)
        .replace(/\{index\}/g, String(i + 1).padStart(3, '0'))
        .replace(/\{fmt\}/g, fileFmt)
        + '.' + fileExt;

      if (useZip) {
        const buf = await blob.arrayBuffer();
        zip.addFile(filename, new Uint8Array(buf));
      } else {
        Platform.download(URL.createObjectURL(blob), `snaproo/${filename}`, true);
      }

      bar.style.width = Math.round((i + 1) / total * 100) + '%';
    }

    // Download ZIP for multiple files
    if (useZip) {
      const zipBlob = zip.finish();
      Platform.download(URL.createObjectURL(zipBlob), `snaproo/converted-${ext}.zip`, true);
    }

    setTimeout(() => { progress.style.display = 'none'; bar.style.width = '0%'; }, 1500);
  });

  // ── Helpers ────────────────────────────────────────────
  function _fmtSize(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }
}
