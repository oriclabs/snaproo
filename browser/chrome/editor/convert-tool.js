// Snaproo — Convert Tool (table-based, per-file format)

function initConvert() {
  let cvtFiles = []; // { file, objectUrl, fmt, checked, img, w, h, opts, hasCustomOpts }
  let previewIdx = -1; // -1 = no preview shown
  let _previewDebounce = null; // debounce for live settings updates

  const FORMATS = [
    { value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' },
    { value: 'webp', label: 'WebP' }, { value: 'bmp', label: 'BMP' },
    { value: 'svg', label: 'SVG Trace' },
  ];
  const BEST_ALT = { png: 'webp', jpg: 'webp', jpeg: 'webp', webp: 'png', bmp: 'png', gif: 'png', svg: 'png', tiff: 'png' };
  const TAG_COLORS = { PNG: '#22c55e', JPG: '#3b82f6', JPEG: '#3b82f6', WEBP: '#a855f7', GIF: '#f97316', SVG: '#14b8a6', BMP: '#64748b' };
  // Map file extension to format value (for filtering source format from target options)
  const EXT_TO_FMT = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', bmp: 'bmp', gif: null, svg: null, tiff: null };

  function _formatsFor(f) {
    const ext = f.file.name.split('.').pop()?.toLowerCase() || '';
    const srcFmt = EXT_TO_FMT[ext];
    return srcFmt ? FORMATS.filter(fm => fm.value !== srcFmt) : FORMATS;
  }

  // ── Default opts from ribbon globals ───────────────────
  function _defaultOpts() {
    return {
      quality: 85,
      targetSize: false,
      maxKB: 200,
      svgColors: 8,
      svgBlur: 1,
      svgSmooth: 1.5,
      svgMinArea: 20,
      svgMaxDim: 400,
    };
  }

  // ── File input + Add button ─────────────────────────────
  $('convert-file')?.addEventListener('change', (e) => {
    if (e.target.files.length) addFiles([...e.target.files]);
    e.target.value = '';
  });

  $('btn-convert-add2')?.addEventListener('click', () => $('convert-file')?.click());

  // Allow dropping files onto the table area
  const tableWrap = $('convert-table-wrap');
  if (tableWrap) {
    tableWrap.addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
    tableWrap.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = [...e.dataTransfer.files].filter(f => f.type.startsWith('image/'));
      if (files.length) addFiles(files);
    });
  }

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
        opts: _defaultOpts(), hasCustomOpts: false,
      });
    }
    $('btn-convert-go').disabled = false;
    renderTable();
    _updateBtn();
     }

  // ── Render table ───────────────────────────────────────
  function renderTable() {
    const tbody = $('convert-table-body');
    tbody.innerHTML = '';
    if (cvtFiles.length === 0) {
      const tr = document.createElement('tr');
      const td = document.createElement('td');
      td.colSpan = 12;
      td.style.cssText = 'padding:3rem 1rem;text-align:center;color:var(--slate-500);';
      td.innerHTML = '<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="display:block;margin:0 auto 0.75rem;opacity:0.5;"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>'
        + '<div style="font-size:0.85rem;margin-bottom:0.25rem;">Drop images here or click Add</div>'
        + '<div style="font-size:0.7rem;color:var(--slate-600);">PNG, JPEG, WebP, BMP, GIF, SVG — batch supported</div>';
      tr.appendChild(td); tbody.appendChild(tr);
      return;
    }
    cvtFiles.forEach((f, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = `border-bottom:1px solid var(--slate-800);${i === previewIdx ? 'background:rgba(244,196,48,0.05);' : ''}`;

      // Checkbox
      const tdCb = _td(32);
      const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = f.checked;
      cb.style.cssText = 'accent-color:var(--saffron-400);width:15px;height:15px;';
      cb.addEventListener('change', () => { f.checked = cb.checked; _updateBtn(); });
      tdCb.appendChild(cb); tr.appendChild(tdCb);

      // Thumbnail
      const tdThumb = _td(44);
      const thumb = document.createElement('img'); thumb.src = f.objectUrl;
      thumb.style.cssText = 'width:38px;height:38px;object-fit:cover;border-radius:4px;border:1px solid var(--slate-700);';
      tdThumb.appendChild(thumb); tr.appendChild(tdThumb);

      // Filename
      const tdName = document.createElement('td');
      tdName.style.cssText = 'padding:8px 10px;color:var(--slate-200);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px;font-size:0.8rem;';
      tdName.textContent = f.file.name;
      tdName.title = f.file.name;
      tr.appendChild(tdName);

      // Source format tag
      const tdSrc = _td(60, 'center');
      const srcExt = f.file.name.split('.').pop()?.toUpperCase() || '?';
      const srcTag = document.createElement('span');
      srcTag.textContent = srcExt;
      srcTag.style.cssText = `font-size:0.65rem;font-weight:700;padding:3px 7px;border-radius:3px;background:${TAG_COLORS[srcExt] || '#64748b'};color:#fff;letter-spacing:0.02em;`;
      tdSrc.appendChild(srcTag); tr.appendChild(tdSrc);

      // Resolution
      const tdRes = _td(80, 'center');
      tdRes.style.color = 'var(--slate-400)';
      tdRes.style.fontSize = '0.75rem';
      tdRes.textContent = f.w && f.h ? `${f.w}×${f.h}` : '—';
      tr.appendChild(tdRes);

      // Arrow
      const tdArrow = _td(18, 'center');
      tdArrow.style.color = 'var(--slate-500)';
      tdArrow.textContent = '→';
      tr.appendChild(tdArrow);

      // Target format dropdown
      const tdTarget = _td(110);
      const sel = document.createElement('select');
      sel.style.cssText = 'background:var(--slate-800);color:var(--slate-200);border:1px solid var(--slate-600);border-radius:4px;padding:4px 6px;font-size:0.75rem;width:auto;min-width:100%;cursor:pointer;';
      _formatsFor(f).forEach(fmt => {
        const opt = document.createElement('option'); opt.value = fmt.value; opt.textContent = fmt.label;
        if (fmt.value === f.fmt) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => { f.fmt = sel.value; _updateWarning(i, tr); if (i === previewIdx) _showPreview(i); });
      tdTarget.appendChild(sel); tr.appendChild(tdTarget);

      // Size
      const tdSize = _td(65, 'right');
      tdSize.style.color = 'var(--slate-400)'; tdSize.style.fontSize = '0.75rem';
      tdSize.textContent = _fmtSize(f.file.size);
      tr.appendChild(tdSize);

      // Warning
      const tdWarn = _td(30, 'center');
      _updateWarning(i, tr, tdWarn);
      tr.appendChild(tdWarn);

      // Preview button
      const tdView = _td(36, 'center');
      const viewBtn = document.createElement('button');
      viewBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
      viewBtn.style.cssText = 'background:none;border:1px solid var(--slate-700);border-radius:4px;cursor:pointer;padding:4px 8px;display:inline-flex;align-items:center;justify-content:center;color:var(--slate-400);transition:all 0.12s;' + (i === previewIdx ? 'border-color:var(--saffron-400);color:var(--saffron-400);' : '');
      viewBtn.title = 'Preview conversion';
      viewBtn.addEventListener('click', () => { _showPreview(i === previewIdx ? -1 : i); });
      tdView.appendChild(viewBtn); tr.appendChild(tdView);

      // Delete button
      const tdDel = _td(30, 'center');
      const delBtn = document.createElement('button');
      delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      delBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;display:inline-flex;align-items:center;justify-content:center;color:var(--slate-500);transition:color 0.12s;';
      delBtn.title = 'Remove file';
      delBtn.addEventListener('mouseenter', () => { delBtn.style.color = '#ef4444'; });
      delBtn.addEventListener('mouseleave', () => { delBtn.style.color = 'var(--slate-500)'; });
      delBtn.addEventListener('click', () => { _removeFile(i); });
      tdDel.appendChild(delBtn); tr.appendChild(tdDel);

      // Drag handle
      const tdDrag = _td(24, 'center');
      tdDrag.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--slate-600)" stroke-width="2" style="cursor:grab;"><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="18" x2="16" y2="18"/></svg>';
      tdDrag.style.cursor = 'grab';
      tr.draggable = true;
      tr.dataset.idx = i;
      tr.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', i); tr.style.opacity = '0.4'; });
      tr.addEventListener('dragend', () => { tr.style.opacity = ''; });
      tr.addEventListener('dragover', (e) => { e.preventDefault(); tr.style.borderTop = '2px solid var(--saffron-400)'; });
      tr.addEventListener('dragleave', () => { tr.style.borderTop = ''; });
      tr.addEventListener('drop', (e) => {
        e.preventDefault(); tr.style.borderTop = '';
        const fromIdx = +e.dataTransfer.getData('text/plain');
        const toIdx = i;
        if (fromIdx !== toIdx) {
          const [moved] = cvtFiles.splice(fromIdx, 1);
          cvtFiles.splice(toIdx, 0, moved);
          if (previewIdx === fromIdx) previewIdx = toIdx;
          else if (previewIdx > fromIdx && previewIdx <= toIdx) previewIdx--;
          else if (previewIdx < fromIdx && previewIdx >= toIdx) previewIdx++;
          renderTable();
        }
      });
      tr.appendChild(tdDrag);

      tbody.appendChild(tr);
    });
    $('convert-status').textContent = cvtFiles.length + ' file' + (cvtFiles.length !== 1 ? 's' : '');
    _updateTotalSize();
  }

  function _removeFile(idx) {
    URL.revokeObjectURL(cvtFiles[idx].objectUrl);
    cvtFiles.splice(idx, 1);
    if (previewIdx === idx) { previewIdx = -1; $('convert-preview-overlay').style.display = 'none'; }
    else if (previewIdx > idx) previewIdx--;
    if (cvtFiles.length === 0) { $('btn-convert-go').disabled = true; }
    renderTable();
    _updateBtn();
  }

  function _updateTotalSize() {
    const total = cvtFiles.reduce((sum, f) => sum + f.file.size, 0);
    const status = $('convert-status');
    if (status && cvtFiles.length > 0) {
      status.textContent = `${cvtFiles.length} file${cvtFiles.length !== 1 ? 's' : ''} · ${_fmtSize(total)}`;
    }
  }

  function _td(w, align) {
    const td = document.createElement('td');
    td.style.cssText = `padding:8px 6px;${w ? 'width:' + w + 'px;' : ''}${align ? 'text-align:' + align + ';' : ''}`;
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
    // Check for duplicate output filenames
    const outName = _outputName(f, i);
    const dupes = cvtFiles.filter((cf, ci) => ci !== i && _outputName(cf, ci) === outName);
    if (dupes.length) warns.push('Duplicate output filename — will be auto-renamed');

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

  // ── Build settings panel inside preview overlay ─────────
  function _buildSettings(f) {
    const body = $('convert-settings-body');
    body.innerHTML = '';
    const fmt = f.fmt;
    const o = f.opts;

    function _liveUpdate() {
      f.hasCustomOpts = JSON.stringify(f.opts) !== JSON.stringify(_defaultOpts());
      clearTimeout(_previewDebounce);
      _previewDebounce = setTimeout(() => _updateOutputPreview(f), 400);
    }

    // Format selector at top
    body.appendChild(_settingsRow('Format', () => {
      const sel = document.createElement('select');
      sel.style.cssText = 'background:var(--slate-700);color:var(--slate-200);border:1px solid var(--slate-600);border-radius:4px;padding:4px 6px;font-size:0.75rem;width:100%;cursor:pointer;';
      _formatsFor(f).forEach(fm => {
        const opt = document.createElement('option'); opt.value = fm.value; opt.textContent = fm.label;
        if (fm.value === f.fmt) opt.selected = true;
        sel.appendChild(opt);
      });
      sel.addEventListener('change', () => {
        f.fmt = sel.value;
        renderTable(); // sync table dropdown
        _buildSettings(f); // rebuild format-specific settings
        _updateOutputPreview(f); // refresh preview
      });
      return sel;
    }));

    // Quality (JPEG/WebP)
    if (['jpeg', 'webp'].includes(fmt)) {
      body.appendChild(_settingsRow('Quality', () => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:6px;width:100%;';
        const slider = document.createElement('input');
        slider.type = 'range'; slider.min = '1'; slider.max = '100'; slider.value = o.quality;
        slider.style.cssText = 'flex:1;';
        const val = document.createElement('span');
        val.style.cssText = 'color:var(--slate-200);font-size:0.75rem;min-width:24px;text-align:right;font-variant-numeric:tabular-nums;';
        val.textContent = o.quality;
        slider.addEventListener('input', () => { o.quality = +slider.value; val.textContent = slider.value; _liveUpdate(); });
        wrap.appendChild(slider); wrap.appendChild(val);
        return wrap;
      }));
      body.appendChild(_settingsRow('Max size', () => {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
        const cb = document.createElement('input');
        cb.type = 'checkbox'; cb.checked = o.targetSize;
        cb.style.cssText = 'accent-color:var(--saffron-400);';
        const inp = document.createElement('input');
        inp.type = 'number'; inp.value = o.maxKB; inp.min = '10'; inp.max = '10000';
        inp.style.cssText = 'width:55px;background:var(--slate-700);color:var(--slate-200);border:1px solid var(--slate-600);border-radius:4px;padding:3px 5px;font-size:0.7rem;text-align:center;';
        inp.disabled = !o.targetSize;
        const unit = document.createElement('span');
        unit.style.cssText = 'color:var(--slate-500);font-size:0.7rem;';
        unit.textContent = 'KB';
        cb.addEventListener('change', () => { o.targetSize = cb.checked; inp.disabled = !cb.checked; _liveUpdate(); });
        inp.addEventListener('input', () => { o.maxKB = +inp.value; });
        wrap.appendChild(cb); wrap.appendChild(inp); wrap.appendChild(unit);
        return wrap;
      }));
    }

    // SVG Trace options
    if (fmt === 'svg') {
      body.appendChild(_settingsRow('Colors', () => _numInput(o, 'svgColors', 2, 32, 1, _liveUpdate)));
      body.appendChild(_settingsRow('Blur', () => _numInput(o, 'svgBlur', 0, 5, 1, _liveUpdate)));
      body.appendChild(_settingsRow('Smooth', () => _numInput(o, 'svgSmooth', 0, 3, 0.5, _liveUpdate)));
      body.appendChild(_settingsRow('Min area', () => _numInput(o, 'svgMinArea', 1, 500, 1, _liveUpdate)));
      body.appendChild(_settingsRow('Max dim', () => _numInput(o, 'svgMaxDim', 50, 2000, 50, _liveUpdate)));
    }

    // No settings
    if (['png', 'bmp'].includes(fmt)) {
      const msg = document.createElement('div');
      msg.style.cssText = 'color:var(--slate-500);font-size:0.7rem;text-align:center;padding:0.75rem 0;';
      msg.textContent = 'No settings for ' + fmt.toUpperCase();
      body.appendChild(msg);
    }

    // Footer: reset link + copy to all (subtle, only if multiple files)
    const footer = document.createElement('div');
    footer.style.cssText = 'display:flex;gap:10px;justify-content:center;padding-top:8px;border-top:1px solid var(--slate-700);margin-top:6px;';

    const resetLink = document.createElement('a');
    resetLink.textContent = 'Reset';
    resetLink.href = '#';
    resetLink.style.cssText = 'color:var(--slate-500);font-size:0.65rem;text-decoration:none;';
    resetLink.addEventListener('click', (e) => {
      e.preventDefault();
      f.opts = _defaultOpts();
      f.hasCustomOpts = false;
      _buildSettings(f);
      _updateOutputPreview(f);
    });
    footer.appendChild(resetLink);

    if (cvtFiles.length > 1) {
      const copyLink = document.createElement('a');
      copyLink.textContent = 'Copy to all files';
      copyLink.href = '#';
      copyLink.style.cssText = 'color:var(--slate-500);font-size:0.65rem;text-decoration:none;';
      copyLink.addEventListener('click', (e) => {
        e.preventDefault();
        const copy = JSON.parse(JSON.stringify(o));
        cvtFiles.forEach(cf => { cf.opts = JSON.parse(JSON.stringify(copy)); cf.hasCustomOpts = true; });
        showToast(`Copied to all ${cvtFiles.length} files`, 'success');
      });
      footer.appendChild(copyLink);
    }
    body.appendChild(footer);

    // Enhance number inputs with custom spinners
    enhanceNumberInputs(body);
  }

  function _settingsRow(label, buildControl) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 0;border-bottom:1px solid var(--slate-700);';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'color:var(--slate-400);font-size:0.7rem;flex-shrink:0;';
    lbl.textContent = label;
    row.appendChild(lbl);
    row.appendChild(buildControl());
    return row;
  }

  function _numInput(opts, key, min, max, step, onChange) {
    const inp = document.createElement('input');
    inp.type = 'number'; inp.value = opts[key]; inp.min = min; inp.max = max; inp.step = step;
    inp.style.cssText = 'width:60px;background:var(--slate-700);color:var(--slate-200);border:1px solid var(--slate-600);border-radius:4px;padding:3px 5px;font-size:0.7rem;text-align:center;';
    inp.addEventListener('input', () => { opts[key] = +inp.value; if (onChange) onChange(); });
    return inp;
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
    $('convert-warnings-bar').style.display = 'none';
    $('convert-preview-overlay').style.display = 'none';
    $('btn-convert-go').disabled = true;
    $('convert-status').textContent = '0 files';
    renderTable();
  }
  $('btn-convert-clear2')?.addEventListener('click', _clearAll);

  // ── Rename popover (shared component) ───────────────────
  if ($('btn-convert-rename')) {
    createRenamePopover($('btn-convert-rename'), {
      inputId: 'cvt-rename',
      tokens: [
        { token: '{name}', label: 'Original filename' },
        { token: '{index}', label: 'File number (001, 002…)' },
        { token: '{fmt}', label: 'Target format' },
      ],
      getSampleFn: (pattern) => {
        const sample = cvtFiles[0];
        if (!sample) return { name: pattern.replace(/\{name\}/g, 'photo').replace(/\{index\}/g, '001').replace(/\{fmt\}/g, 'webp'), ext: 'webp' };
        const baseName = sample.file.name.replace(/\.[^.]+$/, '');
        const ext = sample.fmt === 'jpeg' ? 'jpg' : sample.fmt;
        const name = pattern.replace(/\{name\}/g, baseName).replace(/\{index\}/g, '001').replace(/\{fmt\}/g, sample.fmt);
        return { name, ext };
      },
    });
  }

  // ── Convert button label ───────────────────────────────
  function _updateBtn() {
    const total = cvtFiles.length;
    const checked = cvtFiles.filter(f => f.checked).length;
    const btn = $('btn-convert-go');
    if (!btn) return;
    btn.disabled = checked === 0;
    btn.textContent = checked === total ? `Convert All (${total})` : `Convert ${checked} of ${total}`;
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
    _buildSettings(f);
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
      e.stopPropagation(); _showPreview(-1);
    }
  });

  async function _updateOutputPreview(f) {
    const fmt = f.fmt;
    const container = $('convert-output-preview');
    const wrap = $('convert-output-preview-wrap');
    wrap.style.display = '';
    container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:60px;color:var(--slate-500);font-size:0.65rem;gap:5px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg>...</div>';
    $('convert-output-label').textContent = fmt === 'svg' ? 'SVG Trace' : fmt.toUpperCase();
    $('convert-output-size').textContent = '';

    const img = f.img || await loadImg(f.file);
    if (!img) return;

    if (fmt === 'svg') {
      if (typeof SvgTracer === 'undefined') { container.innerHTML = '<div style="padding:0.5rem;color:var(--slate-500);font-size:0.6rem;">Tracer unavailable</div>'; return; }
      const o = f.opts;
      let c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      if (c.width > o.svgMaxDim || c.height > o.svgMaxDim) {
        const s = Math.min(o.svgMaxDim / c.width, o.svgMaxDim / c.height);
        const tc = document.createElement('canvas'); tc.width = Math.round(c.width * s); tc.height = Math.round(c.height * s);
        tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height); c = tc;
      }
      const svgStr = SvgTracer.trace(c, {
        colors: o.svgColors, blur: o.svgBlur,
        simplify: o.svgSmooth, smooth: o.svgSmooth > 0,
        minArea: o.svgMinArea,
      });
      container.innerHTML = svgStr;
      const svgEl = container.querySelector('svg');
      if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.maxHeight = '35vh'; svgEl.style.display = 'block'; }
      $('convert-output-size').textContent = `(${_fmtSize(new Blob([svgStr]).size)})`;
    } else {
      const o = f.opts;
      const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fmt] || 'image/png';
      const q = ['jpeg', 'webp'].includes(fmt) ? o.quality / 100 : undefined;
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


  // ── Convert & Download ─────────────────────────────────
  $('btn-convert-go')?.addEventListener('click', async () => {
    const checked = cvtFiles.filter(f => f.checked);
    if (!checked.length) return;
    const total = checked.length;
    const progress = $('convert-progress');
    const bar = $('convert-progress-bar');
    progress.style.display = ''; bar.style.width = '0%';

    // Disable interactions during conversion
    const actionsBar = $('convert-actions-bar');
    actionsBar.style.pointerEvents = 'none';
    actionsBar.style.opacity = '0.5';

    const useZip = total > 1 && typeof ZipWriter !== 'undefined';
    const zip = useZip ? new ZipWriter() : null;
    const usedNames = new Set();

    for (let i = 0; i < total; i++) {
      const f = checked[i];
      const fmt = f.fmt;
      const o = f.opts;
      const img = f.img || await loadImg(f.file);
      if (!img) continue;

      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);

      // De-duplicate filenames
      let filename = _outputName(f, cvtFiles.indexOf(f));
      if (usedNames.has(filename)) {
        const dotIdx = filename.lastIndexOf('.');
        const base = filename.slice(0, dotIdx);
        const ext = filename.slice(dotIdx);
        let n = 2;
        while (usedNames.has(`${base}-${n}${ext}`)) n++;
        filename = `${base}-${n}${ext}`;
      }
      usedNames.add(filename);

      if (fmt === 'svg') {
        if (typeof SvgTracer === 'undefined') continue;
        let tc = c;
        if (c.width > o.svgMaxDim || c.height > o.svgMaxDim) {
          const s = Math.min(o.svgMaxDim / c.width, o.svgMaxDim / c.height);
          tc = document.createElement('canvas'); tc.width = Math.round(c.width * s); tc.height = Math.round(c.height * s);
          tc.getContext('2d').drawImage(c, 0, 0, tc.width, tc.height);
        }
        const svgStr = SvgTracer.trace(tc, { colors: o.svgColors, blur: o.svgBlur, simplify: o.svgSmooth, smooth: o.svgSmooth > 0, minArea: o.svgMinArea });
        if (useZip) zip.addFile(filename, new TextEncoder().encode(svgStr));
        else directDownload(new Blob([svgStr], { type: 'image/svg+xml' }), filename);
      } else {
        const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' }[fmt] || 'image/png';
        const fq = ['jpeg', 'webp'].includes(fmt) ? o.quality / 100 : undefined;
        let blob = await new Promise(r => c.toBlob(r, mime, fq));
        if (o.targetSize && fmt !== 'png' && blob.size > o.maxKB * 1024) {
          let lo = 0.05, hi = fq || 0.85, att = 0;
          while (att < 8 && blob.size > o.maxKB * 1024 && hi - lo > 0.02) {
            const mid = (lo + hi) / 2;
            blob = await new Promise(r => c.toBlob(r, mime, mid));
            if (blob.size > o.maxKB * 1024) hi = mid; else lo = mid; att++;
          }
        }
        if (useZip) { const buf = await blob.arrayBuffer(); zip.addFile(filename, new Uint8Array(buf)); }
        else directDownload(blob, filename);
      }
      bar.style.width = Math.round((i + 1) / total * 100) + '%';
    }
    if (useZip) directDownload(zip.toBlob(), 'converted.zip');
    setTimeout(() => {
      progress.style.display = 'none'; bar.style.width = '0%';
      actionsBar.style.pointerEvents = '';
      actionsBar.style.opacity = '';
    }, 1500);
    showToast(`Converted ${total} file${total > 1 ? 's' : ''}`, 'success');
  });

  // Helper: compute output filename for a file (used for duplicate detection + convert)
  function _outputName(f, idx) {
    const pattern = $('cvt-rename')?.value || '{name}';
    const baseName = f.file.name.replace(/\.[^.]+$/, '');
    const ext = f.fmt === 'jpeg' ? 'jpg' : f.fmt;
    const raw = pattern.replace(/\{name\}/g, baseName).replace(/\{index\}/g, String(idx + 1).padStart(3, '0')).replace(/\{fmt\}/g, f.fmt);
    return sanitizeFilename(raw) + '.' + ext;
  }

  function _fmtSize(b) { if (!b) return '0 B'; if (b < 1024) return b + ' B'; if (b < 1048576) return (b / 1024).toFixed(1) + ' KB'; return (b / 1048576).toFixed(1) + ' MB'; }

  // Show empty state on init
  renderTable();
}
