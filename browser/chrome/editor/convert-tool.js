// Snaproo — Convert Tool (table-based, per-file format)

function initConvert() {
  let cvtFiles = []; // { file, objectUrl, fmt, checked, img (cached) }
  let previewIdx = -1; // -1 = no preview shown

  const FORMATS = [
    { value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WebP' }, { value: 'bmp', label: 'BMP' },
    { value: 'svg', label: 'SVG Trace' }, { value: 'svg-embed', label: 'SVG Embed' },
  ];
  const BEST_ALT = { png: 'webp', jpg: 'webp', jpeg: 'webp', webp: 'png', bmp: 'png', gif: 'png', svg: 'png', tiff: 'png' };
  const TAG_COLORS = { PNG: '#22c55e', JPG: '#3b82f6', JPEG: '#3b82f6', WEBP: '#a855f7', GIF: '#f97316', SVG: '#14b8a6', BMP: '#64748b' };

  // ── Drop zone + Add buttons ────────────────────────────
  setupDropzone($('convert-drop'), $('convert-file'), (file) => addFiles([file]), { multiple: true });

  $('btn-convert-add2')?.addEventListener('click', () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.addEventListener('change', () => { if (inp.files.length) addFiles([...inp.files]); });
    inp.click();
  });

  $('btn-convert-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      const files = [];
      for (const item of items) {
        const resp = await fetch(item.dataUrl); const blob = await resp.blob();
        files.push(new File([blob], item.name || 'library-image.png', { type: blob.type }));
      }
      if (files.length) addFiles(files);
    });
  });

  // ── Add files ──────────────────────────────────────────
  async function addFiles(files) {
    for (const file of files) {
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const img = await loadImg(file);
      cvtFiles.push({
        file, objectUrl: URL.createObjectURL(file), fmt: BEST_ALT[ext] || 'png',
        checked: true, img, w: img?.naturalWidth || 0, h: img?.naturalHeight || 0,
      });
    }
    $('convert-drop').style.display = 'none';
    $('convert-table-wrap').style.display = '';
    $('convert-actions-bar').style.display = 'flex';
    $('btn-convert-go').disabled = false;
    renderTable();
    _updateBtn();
    _updateSvgVis();
  }

  // ── Render table ───────────────────────────────────────
  function renderTable() {
    const tbody = $('convert-table-body');
    tbody.innerHTML = '';
    cvtFiles.forEach((f, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom:1px solid var(--slate-800);${i === previewIdx ? 'background:rgba(244,196,48,0.05);' : ''}`;

      // Checkbox
      const tdCb = _td(30);
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = f.checked;
      cb.style.cssText = 'accent-color:var(--saffron-400);';
      cb.addEventListener('change', () => { f.checked = cb.checked; _updateBtn(); });
      tdCb.appendChild(cb); tr.appendChild(tdCb);

      // Thumbnail
      const tdThumb = _td(40);
      const thumb = document.createElement('img'); thumb.src = f.objectUrl;
      thumb.style.cssText = 'width:34px;height:34px;object-fit:cover;border-radius:3px;border:1px solid var(--slate-700);';
      tdThumb.appendChild(thumb); tr.appendChild(tdThumb);

      // Filename
      const tdName = document.createElement('td');
      tdName.style.cssText = 'padding:6px 8px;color:var(--slate-200);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px;';
      tdName.textContent = f.file.name;
      tdName.title = f.file.name;
      tr.appendChild(tdName);

      // Source format tag
      const tdSrc = _td(50, 'center');
      const srcExt = f.file.name.split('.').pop()?.toUpperCase() || '?';
      const srcTag = document.createElement('span');
      srcTag.textContent = srcExt;
      srcTag.style.cssText = `font-size:0.55rem;font-weight:700;padding:2px 5px;border-radius:3px;background:${TAG_COLORS[srcExt] || '#64748b'};color:#fff;`;
      tdSrc.appendChild(srcTag); tr.appendChild(tdSrc);

      // Resolution
      const tdRes = _td(60, 'center');
      tdRes.style.color = 'var(--slate-400)';
      tdRes.style.fontSize = '0.6rem';
      tdRes.textContent = f.w && f.h ? `${f.w}×${f.h}` : '—';
      tr.appendChild(tdRes);

      // Arrow
      const tdArrow = _td(16, 'center');
      tdArrow.style.color = 'var(--slate-500)';
      tdArrow.textContent = '→';
      tr.appendChild(tdArrow);

      // Target format dropdown
      const tdTarget = _td(90);
      const sel = document.createElement('select');
      sel.style.cssText = 'background:var(--slate-800);color:var(--slate-200);border:1px solid var(--slate-600);border-radius:4px;padding:2px 4px;font-size:0.65rem;width:100%;cursor:pointer;';
      FORMATS.forEach(fmt => {
        const opt = document.createElement('option'); opt.value = fmt.value; opt.textContent = fmt.label;
        if (fmt.value === f.fmt) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => { f.fmt = sel.value; _updateSvgVis(); _updateWarning(i, tr); if (i === previewIdx) _showPreview(i); });
      tdTarget.appendChild(sel); tr.appendChild(tdTarget);

      // Size
      const tdSize = _td(55, 'right');
      tdSize.style.color = 'var(--slate-400)'; tdSize.style.fontSize = '0.6rem';
      tdSize.textContent = _fmtSize(f.file.size);
      tr.appendChild(tdSize);

      // Warning
      const tdWarn = _td(28, 'center');
      _updateWarning(i, tr, tdWarn);
      tr.appendChild(tdWarn);

      // Preview button
      const tdView = _td(32, 'center');
      const viewBtn = document.createElement('button');
      viewBtn.textContent = '👁';
      viewBtn.style.cssText = 'background:none;border:1px solid var(--slate-700);border-radius:4px;cursor:pointer;padding:2px 6px;font-size:0.7rem;transition:all 0.12s;' + (i === previewIdx ? 'border-color:var(--saffron-400);' : '');
      viewBtn.addEventListener('click', () => { _showPreview(i === previewIdx ? -1 : i); });
      tdView.appendChild(viewBtn); tr.appendChild(tdView);

      tbody.appendChild(tr);
    });
    $('convert-status').textContent = cvtFiles.length + ' file' + (cvtFiles.length !== 1 ? 's' : '');
  }

  function _td(w, align) {
    const td = document.createElement('td');
    td.style.cssText = `padding:6px 4px;${w ? 'width:' + w + 'px;' : ''}${align ? 'text-align:' + align + ';' : ''}`;
    return td;
  }

  function _updateWarning(i, tr, tdWarn) {
    const f = cvtFiles[i];
    const ext = f.file.name.split('.').pop()?.toLowerCase();
    const inputFmt = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', bmp: 'bmp', gif: 'gif', svg: 'svg' }[ext] || '';
    const warns = [];
    if (f.fmt === inputFmt) warns.push('Same format — output identical');
    if (f.fmt === 'jpeg' && ['png', 'gif', 'svg', 'webp'].includes(ext)) warns.push('Transparency will be lost');
    if (f.fmt === 'svg' && ['jpg', 'jpeg'].includes(ext)) warns.push('Photo → SVG trace may be slow');

    const td = tdWarn || tr.cells[8];
    if (!td) return;
    td.innerHTML = '';
    if (warns.length > 0) {
      const icon = document.createElement('span');
      icon.textContent = '⚠';
      icon.style.cssText = 'color:#f59e0b;cursor:help;';
      icon.title = warns.join('\n');
      td.appendChild(icon);
    }
  }

  // ── Select all checkbox ────────────────────────────────
  $('cvt-table-selall')?.addEventListener('change', (e) => {
    cvtFiles.forEach(f => f.checked = e.target.checked);
    renderTable();
    _updateBtn();
  });

  $('btn-convert-selall')?.addEventListener('click', () => {
    const allChecked = cvtFiles.every(f => f.checked);
    cvtFiles.forEach(f => f.checked = !allChecked);
    $('cvt-table-selall').checked = !allChecked;
    renderTable();
    _updateBtn();
  });

  // ── Clear ──────────────────────────────────────────────
  function _clearAll() {
    cvtFiles.forEach(f => URL.revokeObjectURL(f.objectUrl));
    cvtFiles = []; previewIdx = -1;
    $('convert-drop').style.display = '';
    $('convert-table-wrap').style.display = 'none';
    $('convert-actions-bar').style.display = 'none';
    $('convert-warnings-bar').style.display = 'none';
    $('convert-preview-overlay').style.display = 'none';
    $('btn-convert-go').disabled = true;
    $('convert-status').textContent = '0 files';
    $('compression-preview').innerHTML = 'Drop images to start';
  }
  $('btn-convert-clear')?.addEventListener('click', _clearAll);
  $('btn-convert-clear2')?.addEventListener('click', _clearAll);

  // ── Convert button label ───────────────────────────────
  function _updateBtn() {
    const total = cvtFiles.length;
    const checked = cvtFiles.filter(f => f.checked).length;
    const btn = $('btn-convert-go');
    if (!btn) return;
    btn.disabled = checked === 0;
    btn.textContent = checked === total ? `Convert All (${total})` : `Convert ${checked} of ${total}`;
  }

  function _updateSvgVis() {
    const hasSvg = cvtFiles.some(f => f.checked && f.fmt === 'svg');
    $('convert-svg-section').style.display = hasSvg ? '' : 'none';
  }

  // ── Preview panel ──────────────────────────────────────
  function _showPreview(idx) {
    previewIdx = idx;
    renderTable(); // re-highlight row
    const panel = $('convert-preview-overlay');
    if (idx < 0 || !cvtFiles[idx]) {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';
    const f = cvtFiles[idx];
    $('convert-img').src = f.objectUrl;
    $('convert-img-info').textContent = `${f.file.name} · ${_fmtSize(f.file.size)} · ${f.w}×${f.h}`;
    $('convert-preview-title').textContent = `Preview: ${f.file.name}`;
    _updateOutputPreview(f);
  }

  $('cvt-close-preview')?.addEventListener('click', () => _showPreview(-1));
  // Close on backdrop click
  $('convert-preview-overlay')?.addEventListener('click', (e) => {
    if (e.target === $('convert-preview-overlay')) _showPreview(-1);
  });
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && previewIdx >= 0 && $('convert-preview-overlay')?.style.display !== 'none') {
      e.stopPropagation();
      _showPreview(-1);
    }
  });

  async function _updateOutputPreview(f) {
    const fmt = f.fmt;
    const container = $('convert-output-preview');
    const wrap = $('convert-output-preview-wrap');
    wrap.style.display = '';
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:60px;color:var(--slate-500);font-size:0.65rem;gap:5px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>...</div>';
    $('convert-output-label').textContent = fmt === 'svg' ? 'SVG Trace' : fmt === 'svg-embed' ? 'SVG Embed' : fmt.toUpperCase();
    $('convert-output-size').textContent = '';

    const img = f.img || await loadImg(f.file);
    if (!img) return;

    if (fmt === 'svg-embed') {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const size = c.toDataURL('image/png').length + 150;
      container.innerHTML = '<div style="padding:0.5rem;text-align:center;color:var(--slate-400);font-size:0.6rem;">Raster embedded in SVG</div>';
      $('convert-output-size').textContent = `(~${_fmtSize(size)})`;
    } else if (fmt === 'svg') {
      if (typeof SvgTracer === 'undefined') { container.innerHTML = '<div style="padding:0.5rem;color:var(--slate-500);font-size:0.6rem;">Tracer unavailable</div>'; return; }
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
      if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.maxHeight = '35vh'; svgEl.style.display = 'block'; }
      $('convert-output-size').textContent = `(${_fmtSize(new Blob([svgStr]).size)})`;
    } else {
      const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fmt] || 'image/png';
      const q = ['jpeg', 'webp'].includes(fmt) ? +$('convert-quality').value / 100 : undefined;
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, mime, q));
      container.innerHTML = `<img src="${URL.createObjectURL(blob)}" style="max-width:100%;max-height:35vh;display:block;">`;
      $('convert-output-size').textContent = `(${_fmtSize(blob.size)})`;
    }

    // Match output box height to original box
    requestAnimationFrame(() => {
      const origBox = $('convert-img-box');
      const outBox = $('convert-output-box');
      if (origBox && outBox) {
        const r = origBox.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) {
          outBox.style.minHeight = r.height + 'px';
          outBox.style.minWidth = r.width + 'px';
        }
      }
    });
  }

  // ── Quality slider ─────────────────────────────────────
  $('convert-quality')?.addEventListener('input', (e) => {
    $('convert-quality-val').textContent = e.target.value;
    if (previewIdx >= 0) _updateOutputPreview(cvtFiles[previewIdx]);
  });

  $('convert-target-size')?.addEventListener('change', (e) => {
    $('convert-max-kb').style.display = e.target.checked ? '' : 'none';
    $('convert-max-kb-unit').style.display = e.target.checked ? '' : 'none';
  });

  // SVG option changes refresh preview
  ['cvt-svg-smooth', 'cvt-svg-blur', 'cvt-svg-colors', 'cvt-svg-minarea', 'cvt-svg-maxdim'].forEach(id => {
    $(id)?.addEventListener('change', () => { if (previewIdx >= 0 && cvtFiles[previewIdx]?.fmt === 'svg') _updateOutputPreview(cvtFiles[previewIdx]); });
  });

  // ── Convert & Download ─────────────────────────────────
  $('btn-convert-go')?.addEventListener('click', async () => {
    const checked = cvtFiles.filter(f => f.checked);
    if (!checked.length) return;
    const total = checked.length;
    const q = +$('convert-quality').value / 100;
    const targetSize = $('convert-target-size')?.checked;
    const maxKB = +($('convert-max-kb')?.value) || 200;
    const renamePattern = $('cvt-rename')?.value || '{name}';

    const progress = $('convert-progress');
    const bar = $('convert-progress-bar');
    progress.style.display = ''; bar.style.width = '0%';

    const useZip = total > 1 && typeof ZipWriter !== 'undefined';
    const zip = useZip ? new ZipWriter() : null;

    for (let i = 0; i < total; i++) {
      const f = checked[i];
      const fmt = f.fmt;
      const img = f.img || await loadImg(f.file);
      if (!img) continue;

      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const baseName = f.file.name.replace(/\.[^.]+$/, '');
      const ext = fmt === 'jpeg' ? 'jpg' : (fmt === 'svg-embed' ? 'svg' : fmt);
      const filename = renamePattern.replace(/\{name\}/g, baseName).replace(/\{index\}/g, String(i + 1).padStart(3, '0')).replace(/\{fmt\}/g, fmt) + '.' + ext;

      if (fmt === 'svg-embed') {
        const svgStr = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${c.width}" height="${c.height}" viewBox="0 0 ${c.width} ${c.height}"><image width="${c.width}" height="${c.height}" xlink:href="${c.toDataURL('image/png')}"/></svg>`;
        if (useZip) zip.addFile(filename, new TextEncoder().encode(svgStr));
        else Platform.download(new Blob([svgStr], { type: 'image/svg+xml' }), `snaproo/${filename}`, true);
      } else if (fmt === 'svg') {
        if (typeof SvgTracer === 'undefined') continue;
        const maxDim = +($('cvt-svg-maxdim')?.value) || 400;
        let tc = c;
        if (c.width > maxDim || c.height > maxDim) {
          const s = Math.min(maxDim / c.width, maxDim / c.height);
          tc = document.createElement('canvas'); tc.width = Math.round(c.width * s); tc.height = Math.round(c.height * s);
          tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
        }
        const svgStr = SvgTracer.trace(tc, { colors: +($('cvt-svg-colors')?.value) || 8, blur: +($('cvt-svg-blur')?.value) ?? 1, simplify: +($('cvt-svg-smooth')?.value) ?? 1.5, smooth: +($('cvt-svg-smooth')?.value) > 0, minArea: +($('cvt-svg-minarea')?.value) || 20 });
        if (useZip) zip.addFile(filename, new TextEncoder().encode(svgStr));
        else Platform.download(new Blob([svgStr], { type: 'image/svg+xml' }), `snaproo/${filename}`, true);
      } else {
        const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fmt] || 'image/png';
        const fq = ['jpeg', 'webp'].includes(fmt) ? q : undefined;
        let blob = await new Promise(r => c.toBlob(r, mime, fq));
        if (targetSize && fmt !== 'png' && blob.size > maxKB * 1024) {
          let lo = 0.05, hi = fq || 0.85, att = 0;
          while (att < 8 && blob.size > maxKB * 1024 && hi - lo > 0.02) {
            const mid = (lo + hi) / 2;
            blob = await new Promise(r => c.toBlob(r, mime, mid));
            if (blob.size > maxKB * 1024) hi = mid; else lo = mid; att++;
          }
        }
        if (useZip) { const buf = await blob.arrayBuffer(); zip.addFile(filename, new Uint8Array(buf)); }
        else Platform.download(URL.createObjectURL(blob), `snaproo/${filename}`, true);
      }
      bar.style.width = Math.round((i + 1) / total * 100) + '%';
    }
    if (useZip) Platform.download(URL.createObjectURL(zip.finish()), 'snaproo/converted.zip', true);
    setTimeout(() => { progress.style.display = 'none'; bar.style.width = '0%'; }, 1500);
  });

  function _fmtSize(b) { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }
}
