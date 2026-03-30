// Snaproo — Convert Tool

function initConvert() {
  let cvtFiles = []; // { file, img, objectUrl }
  let selectedIndex = 0;

  const FORMAT_INFO = {
    png:  'Lossless · Transparency · Larger files',
    jpeg: 'Lossy · Small files · No transparency',
    webp: 'Modern · Smallest · Good quality',
    bmp:  'Uncompressed · Very large · No transparency',
    svg:  'Vector trace · Scalable · Best for logos & icons',
  };

  // ── Drop zone ──────────────────────────────────────────
  setupDropzone($('convert-drop'), $('convert-file'), (file) => {
    addFiles([file]);
  }, { multiple: true });

  // Add more button
  $('btn-convert-add')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.addEventListener('change', () => { if (input.files.length) addFiles([...input.files]); });
    input.click();
  });

  // ── Add files ──────────────────────────────────────────
  function addFiles(files) {
    for (const file of files) {
      cvtFiles.push({ file, objectUrl: URL.createObjectURL(file) });
    }
    $('convert-drop').style.display = 'none';
    $('convert-preview').style.display = '';
    $('convert-file-list').style.display = '';
    $('btn-convert-go').disabled = false;
    updateFileList();
    selectFile(cvtFiles.length - 1);
    autoSelectFormat();
    updateFormatStates();
    showCompressionPreview();
  }

  // ── File list panel ────────────────────────────────────
  function updateFileList() {
    const list = $('convert-file-list');
    list.innerHTML = '';
    cvtFiles.forEach((f, i) => {
      const el = document.createElement('div');
      el.style.cssText = `display:flex;align-items:center;gap:6px;padding:4px 6px;border-radius:5px;cursor:pointer;margin-bottom:3px;border:1.5px solid ${i === selectedIndex ? 'var(--saffron-400)' : 'var(--slate-700)'};background:${i === selectedIndex ? 'rgba(244,196,48,0.05)' : 'transparent'};`;
      const thumb = document.createElement('img');
      thumb.src = f.objectUrl;
      thumb.style.cssText = 'width:32px;height:32px;object-fit:cover;border-radius:3px;flex-shrink:0;';
      const info = document.createElement('div');
      info.style.cssText = 'flex:1;min-width:0;';
      info.innerHTML = `<div style="color:var(--slate-200);font-size:0.6rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${f.file.name}</div><div style="color:var(--slate-500);font-size:0.55rem;">${_fmtSize(f.file.size)}</div>`;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '\u00D7';
      removeBtn.style.cssText = 'background:none;border:none;color:var(--slate-500);cursor:pointer;font-size:0.75rem;padding:0 2px;';
      removeBtn.addEventListener('click', (e) => { e.stopPropagation(); removeFile(i); });
      el.appendChild(thumb); el.appendChild(info); el.appendChild(removeBtn);
      el.addEventListener('click', () => selectFile(i));
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
    updateFileList();
    updateFormatStates();
    showCompressionPreview();
  }

  function removeFile(idx) {
    URL.revokeObjectURL(cvtFiles[idx].objectUrl);
    cvtFiles.splice(idx, 1);
    if (cvtFiles.length === 0) {
      $('convert-drop').style.display = '';
      $('convert-preview').style.display = 'none';
      $('convert-file-list').style.display = 'none';
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
    $('convert-file-list').style.display = 'none';
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
    const fmt = document.querySelector('#convert-formats .format-btn.active')?.dataset.fmt;
    const file = cvtFiles[selectedIndex]?.file;
    if (!file) return;
    const img = await loadImg(file);
    if (!img) return;

    const container = $('convert-output-preview');
    const wrap = $('convert-output-preview-wrap');

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
      const q = ['jpeg', 'webp'].includes(fmt) ? +$('convert-quality').value / 100 : undefined;
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
    if (!cvtFiles.length) return;
    const file = cvtFiles[selectedIndex]?.file;
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    const inputFmt = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp', bmp: 'bmp', gif: 'gif', svg: 'svg', avif: 'avif' }[ext] || '';

    $$('#convert-formats .format-btn').forEach(btn => {
      const fmt = btn.dataset.fmt;
      // Remove old badges
      btn.querySelector('.fmt-badge')?.remove();

      if (btn.disabled) return; // AVIF/TIFF/ICO stay disabled

      if (fmt === inputFmt) {
        // Same as input — dim it
        const badge = document.createElement('span');
        badge.className = 'fmt-badge';
        badge.style.cssText = 'font-size:0.45rem;color:var(--slate-500);margin-left:2px;';
        badge.textContent = '(same)';
        btn.appendChild(badge);
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
      const img = await loadImg(f.file);
      if (!img) continue;

      let w = img.naturalWidth, h = img.naturalHeight;
      if (resizeW > 0 || resizeH > 0) {
        if (resizeW > 0 && resizeH > 0 && !lockAspect) { w = resizeW; h = resizeH; }
        else if (resizeW > 0) { w = resizeW; h = lockAspect ? Math.round(resizeW * img.naturalHeight / img.naturalWidth) : (resizeH || Math.round(resizeW * img.naturalHeight / img.naturalWidth)); }
        else if (resizeH > 0) { h = resizeH; w = lockAspect ? Math.round(resizeH * img.naturalWidth / img.naturalHeight) : (resizeW || Math.round(resizeH * img.naturalWidth / img.naturalHeight)); }
      }

      const srcC = document.createElement('canvas');
      srcC.width = img.naturalWidth; srcC.height = img.naturalHeight;
      srcC.getContext('2d').drawImage(img, 0, 0);
      const c = (w !== img.naturalWidth || h !== img.naturalHeight) ?
        (typeof steppedResize === 'function' ? steppedResize(srcC, w, h) : (() => { const t = document.createElement('canvas'); t.width = w; t.height = h; t.getContext('2d').drawImage(srcC, 0, 0, w, h); return t; })()) : srcC;

      const baseName = f.file.name.replace(/\.[^.]+$/, '');

      // SVG trace
      if (isSvg) {
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

      let blob = await new Promise(r => c.toBlob(r, mime, q));

      // Compress to target size
      if (targetSize && fmt !== 'png' && blob.size > maxKB * 1024) {
        let lo = 0.05, hi = q || 0.85, attempts = 0;
        while (attempts < 8 && blob.size > maxKB * 1024 && hi - lo > 0.02) {
          const mid = (lo + hi) / 2;
          blob = await new Promise(r => c.toBlob(r, mime, mid));
          if (blob.size > maxKB * 1024) hi = mid; else lo = mid;
          attempts++;
        }
      }

      const filename = renamePattern
        .replace(/\{name\}/g, baseName)
        .replace(/\{index\}/g, String(i + 1).padStart(3, '0'))
        .replace(/\{fmt\}/g, fmt)
        + '.' + ext;

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
