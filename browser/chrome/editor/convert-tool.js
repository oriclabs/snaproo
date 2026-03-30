// Snaproo — Convert Tool (simplified: per-file format dropdown)

function initConvert() {
  let cvtFiles = []; // { file, objectUrl, fmt, checked }
  let selectedIndex = 0;

  const FORMATS = [
    { value: 'png', label: 'PNG' },
    { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WebP' },
    { value: 'bmp', label: 'BMP' },
    { value: 'svg', label: 'SVG Trace' },
    { value: 'svg-embed', label: 'SVG Embed' },
  ];

  const BEST_ALT = { png: 'webp', jpg: 'webp', jpeg: 'webp', webp: 'png', bmp: 'png', gif: 'png', svg: 'png', tiff: 'png' };

  // ── Drop zone ──────────────────────────────────────────
  setupDropzone($('convert-drop'), $('convert-file'), (file) => {
    addFiles([file]);
  }, { multiple: true });

  $('btn-convert-add2')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.addEventListener('change', () => { if (input.files.length) addFiles([...input.files]); });
    input.click();
  });

  $('btn-convert-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      const files = [];
      for (const item of items) {
        const resp = await fetch(item.dataUrl);
        const blob = await resp.blob();
        files.push(new File([blob], item.name || 'library-image.png', { type: blob.type }));
      }
      if (files.length) addFiles(files);
    });
  });

  // ── Add files ──────────────────────────────────────────
  function addFiles(files) {
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const bestFmt = BEST_ALT[ext] || 'png';
      cvtFiles.push({ file, objectUrl: URL.createObjectURL(file), fmt: bestFmt, checked: true });
    }
    $('convert-drop').style.display = 'none';
    $('convert-preview').style.display = '';
    $('convert-file-panel').style.display = 'flex'; $('convert-actions-bar').style.display = 'flex';
    $('btn-convert-go').disabled = false;
    renderFileList();
    selectFile(cvtFiles.length - 1);
    _updateConvertBtn();
    _updateSvgVisibility();
  }

  // ── File list with per-file format dropdown ────────────
  function renderFileList() {
    const list = $('convert-file-list');
    list.innerHTML = '';
    cvtFiles.forEach((f, i) => {
      const el = document.createElement('div');
      const sel = i === selectedIndex;
      el.style.cssText = `display:flex;align-items:center;gap:5px;padding:5px 6px;border-radius:5px;cursor:pointer;margin-bottom:3px;border:1.5px solid ${sel ? 'var(--saffron-400)' : 'var(--slate-700)'};background:${sel ? 'rgba(244,196,48,0.05)' : 'transparent'};`;

      // Checkbox
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = f.checked;
      cb.style.cssText = 'accent-color:var(--saffron-400);flex-shrink:0;';
      cb.addEventListener('change', (e) => { e.stopPropagation(); f.checked = cb.checked; _updateConvertBtn(); });

      // Thumbnail with source tag
      const thumbWrap = document.createElement('div');
      thumbWrap.style.cssText = 'position:relative;flex-shrink:0;';
      const thumb = document.createElement('img');
      thumb.src = f.objectUrl;
      thumb.style.cssText = 'width:44px;height:44px;object-fit:cover;border-radius:4px;display:block;border:1px solid var(--slate-700);';
      const srcExt = f.file.name.split('.').pop()?.toUpperCase() || '?';
      const srcTag = document.createElement('span');
      const tagColors = { PNG: '#22c55e', JPG: '#3b82f6', JPEG: '#3b82f6', WEBP: '#a855f7', GIF: '#f97316', SVG: '#14b8a6', BMP: '#64748b' };
      srcTag.textContent = srcExt;
      srcTag.style.cssText = `position:absolute;bottom:-2px;right:-2px;font-size:0.5rem;font-weight:700;padding:1px 3px;border-radius:3px;background:${tagColors[srcExt] || '#64748b'};color:#fff;line-height:1;`;
      thumbWrap.appendChild(thumb);
      thumbWrap.appendChild(srcTag);

      // Info + format dropdown
      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      const nameDiv = document.createElement('div');
      nameDiv.style.cssText = 'color:var(--slate-200);font-size:0.65rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:2px;';
      nameDiv.textContent = f.file.name;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:4px;';
      const arrow = document.createElement('span');
      arrow.style.cssText = 'color:var(--slate-500);font-size:0.6rem;';
      arrow.textContent = '→';
      const fmtSel = document.createElement('select');
      fmtSel.style.cssText = 'background:var(--slate-800);color:var(--slate-200);border:1px solid var(--slate-600);border-radius:4px;padding:1px 4px;font-size:0.6rem;cursor:pointer;';
      FORMATS.forEach(fmt => {
        const opt = document.createElement('option');
        opt.value = fmt.value; opt.textContent = fmt.label;
        if (fmt.value === f.fmt) opt.selected = true;
        fmtSel.appendChild(opt);
      });
      fmtSel.addEventListener('change', (e) => { e.stopPropagation(); f.fmt = fmtSel.value; _updateSvgVisibility(); _debounceOutputPreview(); });
      const sizeSpan = document.createElement('span');
      sizeSpan.style.cssText = 'color:var(--slate-500);font-size:0.55rem;';
      sizeSpan.textContent = _fmtSize(f.file.size);
      row.appendChild(arrow); row.appendChild(fmtSel); row.appendChild(sizeSpan);
      info.appendChild(nameDiv); info.appendChild(row);

      // Remove
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '\u00D7';
      removeBtn.style.cssText = 'background:none;border:none;color:var(--slate-500);cursor:pointer;font-size:0.8rem;padding:0 3px;flex-shrink:0;';
      removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFile(i); });

      el.appendChild(cb); el.appendChild(thumbWrap); el.appendChild(info); el.appendChild(removeBtn);
      el.addEventListener('click', (e) => { if (e.target !== cb && e.target.tagName !== 'SELECT') selectFile(i); });
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
    renderFileList();
    showCompressionPreview();
    _debounceOutputPreview();
  }

  function removeFile(idx) {
    URL.revokeObjectURL(cvtFiles[idx].objectUrl);
    cvtFiles.splice(idx, 1);
    if (cvtFiles.length === 0) { _clearAll(); return; }
    selectedIndex = Math.min(selectedIndex, cvtFiles.length - 1);
    renderFileList();
    selectFile(selectedIndex);
    _updateConvertBtn();
  }

  // ── Clear / Select All ─────────────────────────────────
  function _clearAll() {
    cvtFiles.forEach(f => URL.revokeObjectURL(f.objectUrl));
    cvtFiles = []; selectedIndex = 0;
    $('convert-drop').style.display = '';
    $('convert-preview').style.display = 'none';
    $('convert-file-panel').style.display = 'none'; $('convert-actions-bar').style.display = 'none';
    $('convert-warnings-bar').style.display = 'none';
    $('btn-convert-go').disabled = true;
    $('compression-preview').innerHTML = 'Drop images to start';
    $('convert-status').textContent = '0 files';
    $('convert-output-preview-wrap').style.display = 'none';
  }
  $('btn-convert-clear')?.addEventListener('click', _clearAll);
  $('btn-convert-clear2')?.addEventListener('click', _clearAll);

  $('btn-convert-selall')?.addEventListener('click', () => {
    const allChecked = cvtFiles.every(f => f.checked);
    cvtFiles.forEach(f => f.checked = !allChecked);
    renderFileList();
    _updateConvertBtn();
  });

  // ── Convert button label ───────────────────────────────
  function _updateConvertBtn() {
    const total = cvtFiles.length;
    const checked = cvtFiles.filter(f => f.checked).length;
    const btn = $('btn-convert-go');
    if (!btn) return;
    btn.disabled = checked === 0;
    if (checked === total) {
      btn.textContent = `Convert All (${total})`;
    } else {
      btn.textContent = `Convert ${checked} of ${total}`;
    }
  }

  // ── Show SVG options if any file targets SVG ───────────
  function _updateSvgVisibility() {
    const hasSvg = cvtFiles.some(f => f.checked && f.fmt === 'svg');
    $('convert-svg-section').style.display = hasSvg ? '' : 'none';
  }

  // ── Quality slider ─────────────────────────────────────
  $('convert-quality')?.addEventListener('input', (e) => {
    $('convert-quality-val').textContent = e.target.value;
    showCompressionPreview();
    _debounceOutputPreview();
  });

  $('convert-target-size')?.addEventListener('change', (e) => {
    $('convert-max-kb').style.display = e.target.checked ? '' : 'none';
    $('convert-max-kb-unit').style.display = e.target.checked ? '' : 'none';
  });

  // SVG options → refresh preview
  ['cvt-svg-smooth', 'cvt-svg-blur', 'cvt-svg-colors', 'cvt-svg-minarea', 'cvt-svg-maxdim'].forEach(id => {
    $(id)?.addEventListener('change', _debounceOutputPreview);
    $(id)?.addEventListener('input', _debounceOutputPreview);
  });

  // ── Output preview ─────────────────────────────────────
  let _previewTimer = null;
  function _debounceOutputPreview() { clearTimeout(_previewTimer); _previewTimer = setTimeout(_updateOutputPreview, 400); }

  let _lastSyncImg = null;
  window.addEventListener('resize', () => { if (_lastSyncImg) requestAnimationFrame(() => _syncPreviewBoxes(_lastSyncImg)); });
  const _origBoxObs = new ResizeObserver(() => { if (_lastSyncImg) requestAnimationFrame(() => _syncPreviewBoxes(_lastSyncImg)); });
  const _origBox = $('convert-img-box');
  if (_origBox) _origBoxObs.observe(_origBox);

  async function _updateOutputPreview() {
    if (!cvtFiles.length) { $('convert-output-preview-wrap').style.display = 'none'; return; }
    const f = cvtFiles[selectedIndex];
    if (!f) return;
    const fmt = f.fmt;

    const container = $('convert-output-preview');
    const wrap = $('convert-output-preview-wrap');

    // Loader
    wrap.style.display = '';
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:80px;color:var(--slate-500);font-size:0.7rem;gap:6px;"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>Preview...</div>';
    $('convert-output-label').textContent = fmt === 'svg' ? 'SVG Trace' : fmt === 'svg-embed' ? 'SVG Embed' : fmt.toUpperCase();
    $('convert-output-size').textContent = '';

    const img = await loadImg(f.file);
    if (!img) return;

    if (fmt === 'svg-embed') {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const size = c.toDataURL('image/png').length + 150;
      container.innerHTML = '<div style="padding:1rem;text-align:center;color:var(--slate-400);font-size:0.65rem;">Raster embedded as-is in SVG</div>';
      $('convert-output-size').textContent = `(~${_fmtSize(size)})`;
    } else if (fmt === 'svg') {
      if (typeof SvgTracer === 'undefined') { container.innerHTML = '<div style="padding:1rem;color:var(--slate-500);">Tracer not loaded</div>'; return; }
      const maxDim = +($('cvt-svg-maxdim')?.value) || 400;
      let c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      if (c.width > maxDim || c.height > maxDim) {
        const s = Math.min(maxDim / c.width, maxDim / c.height);
        const tc = document.createElement('canvas'); tc.width = Math.round(c.width * s); tc.height = Math.round(c.height * s);
        tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height); c = tc;
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
      $('convert-output-size').textContent = `(${_fmtSize(new Blob([svgStr]).size)})`;
    } else {
      const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fmt] || 'image/png';
      const q = ['jpeg', 'webp'].includes(fmt) ? +$('convert-quality').value / 100 : undefined;
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, mime, q));
      container.innerHTML = `<img src="${URL.createObjectURL(blob)}" style="max-width:100%;max-height:50vh;display:block;">`;
      $('convert-output-size').textContent = `(${_fmtSize(blob.size)})`;
    }
    wrap.style.display = '';
    _lastSyncImg = img;
    requestAnimationFrame(() => _syncPreviewBoxes(img));
  }

  function _syncPreviewBoxes(img) {
    const origBox = $('convert-img-box');
    const outBox = $('convert-output-box');
    if (!origBox || !outBox) return;
    const r = origBox.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    outBox.style.width = r.width + 'px';
    outBox.style.height = r.height + 'px';
  }

  // ── Compression preview ────────────────────────────────
  async function showCompressionPreview() {
    if (!cvtFiles.length) return;
    const file = cvtFiles[selectedIndex]?.file;
    if (!file) return;
    const img = await loadImg(file);
    if (!img) return;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const el = $('compression-preview');
    const origSize = file.size;
    const results = [];
    for (const [fmt, mime] of [['PNG','image/png'],['JPEG','image/jpeg'],['WebP','image/webp']]) {
      const q = fmt === 'PNG' ? undefined : +($('convert-quality')?.value || 85) / 100;
      const blob = await new Promise(r => c.toBlob(r, mime, q));
      const saving = origSize > 0 ? Math.round((1 - blob.size / origSize) * 100) : 0;
      const sColor = saving > 0 ? '#22c55e' : saving < 0 ? '#ef4444' : 'var(--slate-500)';
      results.push(`<div style="display:flex;justify-content:space-between;padding:1px 0;"><span style="color:var(--slate-400);font-size:0.6rem;">${fmt}${q ? ' ' + Math.round(q*100) + '%' : ''}</span><span style="color:var(--slate-200);font-size:0.6rem;">${_fmtSize(blob.size)} <span style="color:${sColor};font-size:0.5rem;">${saving > 0 ? '-' : '+'}${Math.abs(saving)}%</span></span></div>`);
    }
    el.innerHTML = `<div style="color:var(--slate-300);font-size:0.6rem;margin-bottom:2px;">Original: ${_fmtSize(origSize)}</div>` + results.join('');
  }

  // ── Convert & Download ─────────────────────────────────
  $('btn-convert-go')?.addEventListener('click', async () => {
    const checked = cvtFiles.filter(f => f.checked);
    if (!checked.length) return;
    const total = checked.length;
    const q = +$('convert-quality').value / 100;
    const targetSize = $('convert-target-size')?.checked;
    const maxKB = +($('convert-max-kb')?.value) || 200;
    const renamePattern = $('cvt-rename')?.value || '{name}';
    const svgColors = +($('cvt-svg-colors')?.value) || 8;
    const svgSmooth = +($('cvt-svg-smooth')?.value) ?? 1.5;
    const svgBlur = +($('cvt-svg-blur')?.value) ?? 1;
    const svgMinArea = +($('cvt-svg-minarea')?.value) || 20;
    const svgMaxDim = +($('cvt-svg-maxdim')?.value) || 400;

    const progress = $('convert-progress');
    const bar = $('convert-progress-bar');
    progress.style.display = ''; bar.style.width = '0%';

    const useZip = total > 1 && typeof ZipWriter !== 'undefined';
    const zip = useZip ? new ZipWriter() : null;

    for (let i = 0; i < total; i++) {
      const f = checked[i];
      const fmt = f.fmt;
      const img = await loadImg(f.file);
      if (!img) continue;

      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const baseName = f.file.name.replace(/\.[^.]+$/, '');
      const ext = fmt === 'jpeg' ? 'jpg' : (fmt === 'svg-embed' ? 'svg' : fmt);
      const filename = renamePattern.replace(/\{name\}/g, baseName).replace(/\{index\}/g, String(i + 1).padStart(3, '0')).replace(/\{fmt\}/g, fmt) + '.' + ext;

      if (fmt === 'svg-embed') {
        const dataUrl = c.toDataURL('image/png');
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}"><image width="${c.width}" height="${c.height}" xlink:href="${dataUrl}"/></svg>`;
        if (useZip) zip.addFile(filename, new TextEncoder().encode(svgStr));
        else Platform.download(new Blob([svgStr], { type: 'image/svg+xml' }), `snaproo/${filename}`, true);
      } else if (fmt === 'svg') {
        if (typeof SvgTracer === 'undefined') continue;
        let tc = c;
        if (c.width > svgMaxDim || c.height > svgMaxDim) {
          const s = Math.min(svgMaxDim / c.width, svgMaxDim / c.height);
          tc = document.createElement('canvas'); tc.width = Math.round(c.width * s); tc.height = Math.round(c.height * s);
          tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
        }
        const svgStr = SvgTracer.trace(tc, { colors: svgColors, blur: svgBlur, simplify: svgSmooth, smooth: svgSmooth > 0, minArea: svgMinArea });
        if (useZip) zip.addFile(filename, new TextEncoder().encode(svgStr));
        else Platform.download(new Blob([svgStr], { type: 'image/svg+xml' }), `snaproo/${filename}`, true);
      } else {
        const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fmt] || 'image/png';
        const fq = ['jpeg', 'webp'].includes(fmt) ? q : undefined;
        let blob = await new Promise(r => c.toBlob(r, mime, fq));
        if (targetSize && fmt !== 'png' && blob.size > maxKB * 1024) {
          let lo = 0.05, hi = fq || 0.85, attempts = 0;
          while (attempts < 8 && blob.size > maxKB * 1024 && hi - lo > 0.02) {
            const mid = (lo + hi) / 2;
            blob = await new Promise(r => c.toBlob(r, mime, mid));
            if (blob.size > maxKB * 1024) hi = mid; else lo = mid;
            attempts++;
          }
        }
        if (useZip) { const buf = await blob.arrayBuffer(); zip.addFile(filename, new Uint8Array(buf)); }
        else Platform.download(URL.createObjectURL(blob), `snaproo/${filename}`, true);
      }
      bar.style.width = Math.round((i + 1) / total * 100) + '%';
    }

    if (useZip) {
      const zipBlob = zip.finish();
      Platform.download(URL.createObjectURL(zipBlob), 'snaproo/converted.zip', true);
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
