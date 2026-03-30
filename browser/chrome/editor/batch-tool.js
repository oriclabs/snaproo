// Snaproo — Batch Edit Tool
function initBatch() {
  let batchFiles = [];
  let importedPipeline = null;
  let previewIndex = 0; // which image to preview

  // Slider labels
  $('batch-wm-opacity')?.addEventListener('input', (e) => {
    const v = $('batch-wm-opacity-val'); if (v) v.textContent = e.target.value;
  });

  // Show/hide logo button based on watermark mode
  $('batch-wm-mode')?.addEventListener('change', (e) => {
    const logoBtn = $('batch-wm-img-btn');
    if (logoBtn) logoBtn.style.display = e.target.value === 'image' ? '' : 'none';
  });

  // Show/hide copyright text input
  $('batch-add-copyright')?.addEventListener('change', (e) => {
    const input = $('batch-copyright-text');
    if (input) input.style.display = e.target.checked ? '' : 'none';
  });

  // Show/hide target size input
  $('batch-target-size')?.addEventListener('change', (e) => {
    $('batch-max-kb').style.display = e.target.checked ? '' : 'none';
    $('batch-max-kb-unit').style.display = e.target.checked ? '' : 'none';
  });

  // Load logo image
  const wmImgBtn = $('batch-wm-img-btn');
  const wmImgInput = $('batch-wm-img-file');
  wmImgBtn?.addEventListener('click', () => wmImgInput?.click());
  wmImgInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const img = await loadImg(file); if (!img) return;
    wmImage = img;
    wmImgBtn.textContent = file.name.length > 10 ? file.name.slice(0, 8) + '..' : file.name;
    wmImgBtn.style.borderColor = 'var(--saffron-400)';
    wmImgInput.value = '';
  });

  $('batch-quality')?.addEventListener('input', (e) => {
    const v = $('batch-quality-val'); if (v) v.textContent = e.target.value;
  });

  // Drop zone
  setupDropzone($('batch-drop'), $('batch-files'), async (file) => {
    const img = await loadImg(file);
    if (!img) return;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    batchFiles.push({ file, img, canvas: c, checked: true });
    _updateBatchUI();
  }, { multiple: true });

  function _updateBatchUI() {
    const queue = $('batch-queue');
    const items = $('batch-items');
    const drop = $('batch-drop');
    if (batchFiles.length > 0) { queue.style.display = ''; drop.style.display = 'none'; }
    else { queue.style.display = 'none'; drop.style.display = ''; }

    items.innerHTML = '';
    batchFiles.forEach((bf, i) => {
      const card = document.createElement('div');
      card.style.cssText = 'width:90px;background:var(--slate-800);border:1px solid var(--slate-700);border-radius:6px;overflow:hidden;cursor:pointer;transition:transform 0.1s,opacity 0.1s;';
      card.draggable = true; card.dataset.idx = i;
      card.title = `${bf.file.name}\nClick: view | Double-click: preview`;
      card.style.position = 'relative';

      // Checkbox for selection
      const chk = document.createElement('input');
      chk.type = 'checkbox'; chk.checked = bf.checked !== false;
      chk.style.cssText = 'position:absolute;top:3px;left:3px;z-index:2;accent-color:var(--saffron-400);cursor:pointer;';
      chk.addEventListener('click', (e) => { e.stopPropagation(); bf.checked = chk.checked; updateBatchCount(); });
      chk.addEventListener('change', (e) => { e.stopPropagation(); bf.checked = chk.checked; card.style.opacity = chk.checked ? '1' : '0.4'; updateBatchCount(); });

      // Thumbnail — click to preview
      const thumb = document.createElement('img');
      thumb.src = bf.canvas.toDataURL('image/jpeg', 0.3);
      thumb.style.cssText = 'width:100%;height:60px;object-fit:cover;display:block;cursor:pointer;';
      if (bf.checked === false) card.style.opacity = '0.4';
      thumb.addEventListener('click', () => {
        // Preview in a dialog
        // Single click = view original
        pixDialog.alert(bf.file.name, `<img src="${bf.canvas.toDataURL('image/jpeg', 0.7)}" style="max-width:100%;max-height:50vh;border-radius:4px;"><br><span style="color:var(--slate-400);">${bf.img.naturalWidth}\u00d7${bf.img.naturalHeight} | ${bf.file.type || 'image'} | ${(bf.file.size/1024).toFixed(0)} KB</span>`);
      });

      // Delete icon — top right corner
      const del = document.createElement('span');
      del.textContent = '\u00d7';
      del.style.cssText = 'position:absolute;top:2px;right:3px;width:16px;height:16px;background:rgba(239,68,68,0.85);color:#fff;border-radius:50%;text-align:center;line-height:16px;cursor:pointer;z-index:1;';
      del.title = 'Remove';
      del.addEventListener('click', (e) => { e.stopPropagation(); batchFiles.splice(i, 1); _updateBatchUI(); });

      const label = document.createElement('div');
      label.style.cssText = 'padding:2px 4px;font-size:0.65rem;color:var(--slate-400);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      label.textContent = bf.file.name;
      const badge = document.createElement('div');
      badge.style.cssText = 'padding:1px 4px;font-size:0.45rem;color:var(--slate-500);';
      badge.textContent = `${bf.img.naturalWidth}\u00d7${bf.img.naturalHeight}`;
      // Double click = set as preview target and open compare
      thumb.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        previewIndex = i;
        $$('#batch-items > div').forEach((c, ci) => {
          c.style.borderColor = ci === i ? 'var(--saffron-400)' : 'var(--slate-700)';
        });
        $('batch-preview-area').style.display = 'none';
        $('btn-batch-preview')?.click();
      });

      // Drag reorder
      card.addEventListener('dragstart', (e) => { e.dataTransfer.effectAllowed = 'move'; card.style.opacity = '0.4'; card._dragIdx = i; });
      card.addEventListener('dragend', () => { card.style.opacity = '1'; });
      card.addEventListener('dragover', (e) => { e.preventDefault(); card.style.transform = 'scale(1.05)'; });
      card.addEventListener('dragleave', () => { card.style.transform = ''; });
      card.addEventListener('drop', (e) => {
        e.preventDefault(); card.style.transform = '';
        const fromIdx = [...items.children].findIndex(c => c._dragIdx !== undefined && c.style.opacity === '0.4');
        if (fromIdx < 0 || fromIdx === i) return;
        const [moved] = batchFiles.splice(fromIdx, 1);
        batchFiles.splice(i, 0, moved);
        _updateBatchUI();
      });

      card.appendChild(chk); card.appendChild(del); card.appendChild(thumb); card.appendChild(label); card.appendChild(badge);
      items.appendChild(card);
    });

    // Add more button
    const addBtn = document.createElement('div');
    addBtn.style.cssText = 'width:90px;height:80px;border:1px dashed var(--slate-700);border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--slate-500);font-size:1.5rem;';
    addBtn.textContent = '+';
    const addInput = document.createElement('input');
    addInput.type = 'file'; addInput.accept = 'image/*'; addInput.multiple = true; addInput.style.display = 'none';
    addBtn.appendChild(addInput);
    addBtn.addEventListener('click', () => addInput.click());
    addInput.addEventListener('change', async (e) => {
      for (const f of e.target.files) {
        const img = await loadImg(f); if (!img) continue;
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        batchFiles.push({ file: f, img, canvas: c, checked: true });
      }
      addInput.value = ''; _updateBatchUI();
    });
    items.appendChild(addBtn);
    $('batch-status').textContent = `${batchFiles.length} images`;
    $('btn-batch-process').disabled = batchFiles.length === 0;
    $('btn-batch-preview').disabled = batchFiles.length === 0;
    updateRenamePreview();
  }

  function getChecked() { return batchFiles.filter(bf => bf.checked !== false); }

  function updateBatchCount() {
    const checked = getChecked().length;
    $('batch-status').textContent = `${checked}/${batchFiles.length} selected`;
    $('btn-batch-process').disabled = checked === 0;
    $('btn-batch-preview').disabled = checked === 0;
  }

  function updateRenamePreview() {
    const preview = $('batch-rename-preview');
    if (!preview) return;
    if (!batchFiles.length) { preview.textContent = ''; return; }
    const fmt = $('batch-format')?.value || 'png';
    const ext = fmt === 'original' ? batchFiles[0].file.name.split('.').pop() : (fmt === 'jpeg' ? 'jpg' : fmt);
    const w = +($('batch-w')?.value) || batchFiles[0].img.naturalWidth;
    const h = +($('batch-h')?.value) || batchFiles[0].img.naturalHeight;
    const name = batchFilename(batchFiles[0], 0, w, h, ext);
    preview.textContent = name;
    preview.title = name;
  }

  // Update rename preview on input
  $('batch-rename')?.addEventListener('input', updateRenamePreview);

  // Token insert buttons
  $$('#batch-rename-tokens [data-token]').forEach(btn => {
    btn.addEventListener('click', () => {
      const input = $('batch-rename');
      if (!input) return;
      input.value += btn.dataset.token;
      input.dispatchEvent(new Event('input'));
    });
  });

  // --- 1. Import Pipeline from Edit mode ---
  $('btn-batch-import-pipeline')?.addEventListener('click', () => {
    if (!pipeline || !pipeline.operations.length) {
      $('batch-pipeline-info').innerHTML = 'Go to <b>Edit</b> first, apply operations, then come back here to import';
      return;
    }
    importedPipeline = JSON.parse(JSON.stringify(pipeline.operations));
    const opNames = importedPipeline.map(op => op.type).join(', ');
    $('batch-pipeline-info').textContent = `${importedPipeline.length} ops: ${opNames}`;
  });

  // --- 4. Batch Consistency Check ---
  $('btn-batch-check')?.addEventListener('click', () => {
    if (!batchFiles.length) return;

    // Group by dimensions
    const dimGroups = {};
    batchFiles.forEach(bf => {
      const key = `${bf.img.naturalWidth}\u00d7${bf.img.naturalHeight}`;
      if (!dimGroups[key]) dimGroups[key] = [];
      dimGroups[key].push(bf.file.name);
    });

    // Group by format
    const fmtGroups = {};
    batchFiles.forEach(bf => {
      const fmt = bf.file.type || 'unknown';
      if (!fmtGroups[fmt]) fmtGroups[fmt] = 0;
      fmtGroups[fmt]++;
    });

    // Group by orientation
    let landscape = 0, portrait = 0;
    batchFiles.forEach(bf => {
      if (bf.img.naturalWidth >= bf.img.naturalHeight) landscape++; else portrait++;
    });

    // Build table HTML
    const truncName = (n) => n.length > 25 ? n.slice(0, 22) + '...' : n;
    const sortedDims = Object.entries(dimGroups).sort((a, b) => b[1].length - a[1].length);
    const majority = sortedDims[0]?.[0];

    let html = '<table style="width:100%;border-collapse:collapse;">';
    html += '<tr style="border-bottom:1px solid var(--slate-700);"><th style="text-align:left;padding:4px 8px;color:var(--slate-400);">Dimensions</th><th style="text-align:center;padding:4px 8px;color:var(--slate-400);">Count</th><th style="text-align:left;padding:4px 8px;color:var(--slate-400);">Images</th></tr>';

    for (const [dim, files] of sortedDims) {
      const isOutlier = files.length === 1 && sortedDims.length > 1;
      const rowColor = isOutlier ? 'color:#ef4444;' : (dim === majority ? 'color:var(--slate-200);' : 'color:var(--slate-400);');
      const names = files.map(truncName).join(', ');
      const flag = isOutlier ? ' \u26a0' : (dim === majority ? ' \u2713' : '');
      html += `<tr style="border-bottom:1px solid var(--slate-800);${rowColor}"><td style="padding:4px 8px;font-family:monospace;">${dim}${flag}</td><td style="text-align:center;padding:4px 8px;">${files.length}</td><td style="padding:4px 8px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${names}</td></tr>`;
    }
    html += '</table>';

    // Summary below table
    html += '<div style="margin-top:8px;color:var(--slate-500);">';
    html += `Formats: ${Object.entries(fmtGroups).map(([f, c]) => `${f.split('/')[1] || f} (${c})`).join(', ')}`;
    html += ` | Orientation: ${landscape} landscape, ${portrait} portrait`;
    if (sortedDims.length === 1) html += ' | <span style="color:#22c55e;">\u2713 All consistent</span>';
    else html += ` | <span style="color:#ef4444;">\u26a0 ${sortedDims.length} different sizes</span>`;
    html += '</div>';

    pixDialog.alert('Batch Consistency Check', html);
  });

  // --- Smart rename helper ---
  function batchFilename(bf, index, w, h, ext) {
    const pattern = $('batch-rename')?.value || '{name}';
    const baseName = bf.file.name.replace(/\.[^.]+$/, '');
    const origExt = bf.file.name.split('.').pop();
    const date = new Date().toISOString().slice(0, 10);
    return pattern
      .replace(/\{name\}/g, baseName)
      .replace(/\{index\}/g, String(index + 1).padStart(3, '0'))
      .replace(/\{i\}/g, String(index + 1))
      .replace(/\{date\}/g, date)
      .replace(/\{w\}/g, w)
      .replace(/\{h\}/g, h)
      .replace(/\{ext\}/g, origExt)
      + '.' + ext;
  }

  // --- Watermark with position ---
  let wmImage = null; // loaded logo image for image watermark

  function applyPositionedWatermark(c, ctx, text, opts) {
    const mode = $('batch-wm-mode')?.value || 'text';
    const pos = $('batch-wm-position')?.value || 'center';
    const color = $('batch-wm-color')?.value || '#ffffff';
    const fontFamily = $('batch-wm-font')?.value || 'Inter, system-ui, sans-serif';
    const fontSize = Math.round(Math.min(c.width, c.height) * 0.05);
    const opacity = opts.opacity || 0.3;

    ctx.save();
    ctx.globalAlpha = opacity;

    // --- Image watermark mode ---
    if (mode === 'image' && wmImage) {
      const maxSize = Math.min(c.width, c.height) * 0.25;
      const scale = Math.min(maxSize / wmImage.width, maxSize / wmImage.height, 1);
      const lw = Math.round(wmImage.width * scale), lh = Math.round(wmImage.height * scale);
      const pad = 15;
      let lx, ly;
      if (pos === 'center') { lx = (c.width - lw) / 2; ly = (c.height - lh) / 2; }
      else if (pos === 'tiled') {
        for (let ty = pad; ty < c.height; ty += lh + pad * 3) {
          for (let tx = pad; tx < c.width; tx += lw + pad * 3) {
            ctx.drawImage(wmImage, tx, ty, lw, lh);
          }
        }
        ctx.restore(); return;
      } else {
        lx = pos.includes('right') ? c.width - lw - pad : pad;
        ly = pos.includes('bottom') ? c.height - lh - pad : pad;
      }
      ctx.drawImage(wmImage, lx, ly, lw, lh);
      ctx.restore(); return;
    }

    // --- Text-based modes ---
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px ${fontFamily}`;

    if (mode === 'diagonal') {
      // Large diagonal text across center
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate(-Math.PI / 4);
      ctx.fillText(text, 0, 0);
    } else if (mode === 'grid') {
      // Repeated grid (no rotation)
      ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      const tw = ctx.measureText(text).width + 40;
      const th = fontSize + 30;
      for (let gy = 10; gy < c.height; gy += th) {
        for (let gx = 10; gx < c.width; gx += tw) {
          ctx.fillText(text, gx, gy);
        }
      }
    } else if (mode === 'stamp') {
      // Text inside a bordered rectangle
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(text).width + 20;
      const th = fontSize + 14;
      let sx, sy;
      if (pos === 'center') { sx = (c.width - tw) / 2; sy = (c.height - th) / 2; }
      else {
        const pad = fontSize;
        sx = pos.includes('right') ? c.width - tw - pad : pad;
        sy = pos.includes('bottom') ? c.height - th - pad : pad;
      }
      ctx.strokeStyle = color; ctx.lineWidth = 2;
      ctx.strokeRect(sx, sy, tw, th);
      ctx.fillText(text, sx + tw / 2, sy + th / 2);
    } else if (pos === 'tiled') {
      // Tiled with rotation (existing function)
      applyWatermark(c, ctx, text, { opacity, fontSize, angle: -30, color });
    } else if (pos === 'center') {
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(text, c.width / 2, c.height / 2);
    } else {
      // Corner position
      const pad = fontSize;
      const alignH = pos.includes('right') ? 'right' : 'left';
      const alignV = pos.includes('bottom') ? 'bottom' : 'top';
      ctx.textAlign = alignH; ctx.textBaseline = alignV;
      ctx.fillText(text, alignH === 'right' ? c.width - pad : pad, alignV === 'bottom' ? c.height - pad : pad);
    }
    ctx.restore();
  }

  // --- Process single image through all operations ---
  async function processOne(bf, index) {
    const results = []; // { filename, blob }
    const targetW = +($('batch-w')?.value) || 0;
    const targetH = +($('batch-h')?.value) || 0;
    const lockRatio = $('batch-lock')?.checked;
    const filterName = $('batch-filter')?.value || 'none';
    const watermark = $('batch-watermark')?.value || '';
    const wmOpacity = (+($('batch-wm-opacity')?.value) || 30) / 100;
    const format = $('batch-format')?.value || 'png';
    const quality = (+($('batch-quality')?.value) || 85) / 100;
    const multiSize = $('batch-multi-size')?.checked;
    const sizes = ($('batch-sizes')?.value || '150,600,1200').split(',').map(s => +s.trim()).filter(s => s > 0);
    const addCopyright = $('batch-add-copyright')?.checked;
    const ratioEnforce = $('batch-ratio-enforce')?.value || 'none';
    const normalize = $('batch-normalize')?.checked;

    const filterCSS = { none:'', grayscale:'grayscale(100%)', sepia:'sepia(100%)', sharpen:'contrast(150%) brightness(110%)', blur:'blur(2px)', invert:'invert(100%)' };

    // Pre-process: batch crop (trim edges)
    let srcImg = bf.img;
    const cropT = +($('batch-crop-t')?.value) || 0;
    const cropR = +($('batch-crop-r')?.value) || 0;
    const cropB = +($('batch-crop-b')?.value) || 0;
    const cropL = +($('batch-crop-l')?.value) || 0;
    if (cropT || cropR || cropB || cropL) {
      const cw = bf.img.naturalWidth - cropL - cropR;
      const ch = bf.img.naturalHeight - cropT - cropB;
      if (cw > 0 && ch > 0) {
        const cropped = document.createElement('canvas'); cropped.width = cw; cropped.height = ch;
        cropped.getContext('2d').drawImage(bf.img, cropL, cropT, cw, ch, 0, 0, cw, ch);
        srcImg = cropped;
      }
    }

    // Aspect ratio enforcement (crop to ratio)
    if (ratioEnforce !== 'none') {
      const [rw, rh] = ratioEnforce.split(':').map(Number);
      const targetRatio = rw / rh;
      const srcRatio = bf.img.naturalWidth / bf.img.naturalHeight;
      let cropW = bf.img.naturalWidth, cropH = bf.img.naturalHeight, cropX = 0, cropY = 0;
      if (srcRatio > targetRatio) {
        cropW = Math.round(bf.img.naturalHeight * targetRatio); cropX = Math.round((bf.img.naturalWidth - cropW) / 2);
      } else {
        cropH = Math.round(bf.img.naturalWidth / targetRatio); cropY = Math.round((bf.img.naturalHeight - cropH) / 2);
      }
      const cropped = document.createElement('canvas'); cropped.width = cropW; cropped.height = cropH;
      cropped.getContext('2d').drawImage(bf.img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
      srcImg = cropped;
    }

    // Size normalization: if enabled, use the largest image dimensions across batch
    let normW = 0, normH = 0;
    if (normalize && !targetW && !targetH) {
      batchFiles.forEach(b => { normW = Math.max(normW, b.img.naturalWidth); normH = Math.max(normH, b.img.naturalHeight); });
    }

    const outputSizes = multiSize ? sizes : [targetW || normW || (srcImg.naturalWidth || srcImg.width)];

    for (const outW of outputSizes) {
      const srcW = srcImg.naturalWidth || srcImg.width;
      const srcH = srcImg.naturalHeight || srcImg.height;
      let w = outW, h;
      if (normalize && normH) {
        // Normalize: all images to same dimensions, letterbox if needed
        w = normW; h = normH;
      } else if (targetH && !multiSize) { h = targetH; }
      else {
        const ratio = srcH / srcW;
        h = lockRatio || multiSize ? Math.round(w * ratio) : (targetH || srcH);
      }

      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d');

      // If normalizing, draw centered with letterbox
      if (normalize && normH) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
        const scale = Math.min(w / srcW, h / srcH);
        const dw = srcW * scale, dh = srcH * scale;
        ctx.drawImage(srcImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }

      // Apply imported pipeline operations if any
      if (importedPipeline && importedPipeline.length && !normalize) {
        const tempP = new EditPipeline();
        tempP.setDisplayCanvas(c);
        tempP.original = srcImg;
        tempP.originalWidth = srcW; tempP.originalHeight = srcH;
        tempP.exportWidth = w; tempP.exportHeight = h;
        tempP.operations = importedPipeline.filter(op => !['crop'].includes(op.type));
        tempP.render();
      } else if (!normalize) {
        // Basic draw (normalize already drew above)
        if (filterCSS[filterName]) ctx.filter = filterCSS[filterName];
        ctx.drawImage(srcImg, 0, 0, w, h);
        ctx.filter = 'none';
      }

      // Watermark
      if (watermark) {
        applyPositionedWatermark(c, ctx, watermark, { opacity: wmOpacity });
      }

      // Copyright
      if (addCopyright) {
        ctx.save();
        ctx.globalAlpha = 0.5; ctx.fillStyle = '#ffffff';
        ctx.font = `10px Inter, system-ui, sans-serif`;
        ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
        ctx.fillText(`\u00a9 ${new Date().getFullYear()}`, c.width - 6, c.height - 4);
        ctx.restore();
      }

      // Export
      const fmt = format === 'original' ? (bf.file.type?.includes('png') ? 'png' : bf.file.type?.includes('webp') ? 'webp' : 'jpeg') : format;
      const mime = { png:'image/png', jpeg:'image/jpeg', webp:'image/webp' }[fmt] || 'image/png';
      const q = fmt === 'png' ? undefined : quality;
      const ext = fmt === 'jpeg' ? 'jpg' : fmt;
      const filename = batchFilename(bf, index, w, h, ext);
      const subfolder = multiSize ? `${w}w/` : '';

      let blob = await new Promise(r => c.toBlob(r, mime, q));

      // Compress to target size if enabled (iteratively reduce quality)
      const targetSize = $('batch-target-size')?.checked;
      const maxKB = +($('batch-max-kb')?.value) || 200;
      if (targetSize && fmt !== 'png' && blob.size > maxKB * 1024) {
        let lo = 0.05, hi = q || 0.85, attempts = 0;
        while (attempts < 8 && blob.size > maxKB * 1024 && hi - lo > 0.02) {
          const mid = (lo + hi) / 2;
          blob = await new Promise(r => c.toBlob(r, mime, mid));
          if (blob.size > maxKB * 1024) hi = mid; else lo = mid;
          attempts++;
        }
      }

      results.push({ filename: subfolder + filename, blob });
    }
    return results;
  }

  // --- Preview first image ---
  // Close preview
  $('batch-preview-close')?.addEventListener('click', () => {
    $('batch-preview-area').style.display = 'none';
  });

  $('btn-batch-preview')?.addEventListener('click', async () => {
    if (!batchFiles.length) return;
    const area = $('batch-preview-area');
    // Toggle off if already visible
    if (area.style.display !== 'none') { area.style.display = 'none'; return; }
    const idx = Math.min(previewIndex, batchFiles.length - 1);
    const bf = batchFiles[idx];
    area.style.display = '';

    // Update title with image name
    const titleEl = $('batch-preview-title');
    if (titleEl) titleEl.textContent = `Preview: ${bf.file.name}`;

    // Show original (scaled to fit 250px max dimension)
    const origCanvas = $('batch-preview-original');
    const previewMax = 250;
    const origScale = Math.min(previewMax / bf.img.naturalWidth, previewMax / bf.img.naturalHeight, 1);
    origCanvas.width = Math.round(bf.img.naturalWidth * origScale);
    origCanvas.height = Math.round(bf.img.naturalHeight * origScale);
    origCanvas.getContext('2d').drawImage(bf.img, 0, 0, origCanvas.width, origCanvas.height);

    // Process it (same logic as processOne but capture the result instead of downloading)
    const targetW = +($('batch-w')?.value) || 0;
    const targetH = +($('batch-h')?.value) || 0;
    const lockRatio = $('batch-lock')?.checked;
    const filterName = $('batch-filter')?.value || 'none';
    const watermark = $('batch-watermark')?.value || '';
    const wmOpacity = (+($('batch-wm-opacity')?.value) || 30) / 100;
    const addCopyright = $('batch-add-copyright')?.checked;
    const filterCSS = { none:'', grayscale:'grayscale(100%)', sepia:'sepia(100%)', sharpen:'contrast(150%) brightness(110%)', blur:'blur(2px)', invert:'invert(100%)' };

    let w = targetW || bf.img.naturalWidth, h;
    if (targetH && targetW) { h = targetH; }
    else { const ratio = bf.img.naturalHeight / bf.img.naturalWidth; h = lockRatio ? Math.round(w * ratio) : (targetH || bf.img.naturalHeight); }

    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');

    if (importedPipeline && importedPipeline.length) {
      const tempP = new EditPipeline();
      tempP.setDisplayCanvas(c);
      tempP.original = bf.img;
      tempP.originalWidth = bf.img.naturalWidth; tempP.originalHeight = bf.img.naturalHeight;
      tempP.exportWidth = w; tempP.exportHeight = h;
      tempP.operations = importedPipeline.filter(op => !['crop'].includes(op.type));
      tempP.render();
    } else {
      if (filterCSS[filterName]) ctx.filter = filterCSS[filterName];
      ctx.drawImage(bf.img, 0, 0, w, h);
      ctx.filter = 'none';
    }

    if (watermark) applyPositionedWatermark(c, ctx, watermark, { opacity: wmOpacity });
    if (addCopyright) {
      const crText = ($('batch-copyright-text')?.value || '\u00a9 {year}').replace(/\{year\}/g, new Date().getFullYear());
      const crSize = Math.max(10, Math.round(Math.min(c.width, c.height) * 0.025));
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#ffffff';
      ctx.font = `${crSize}px Inter, system-ui, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
      // Subtle shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 3; ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 1;
      ctx.fillText(crText, c.width - crSize * 0.5, c.height - crSize * 0.4); ctx.restore();
    }

    // Show result (scaled to same max dimension for consistent comparison)
    const resCanvas = $('batch-preview-result');
    const resScale = Math.min(previewMax / c.width, previewMax / c.height, 1);
    resCanvas.width = Math.round(c.width * resScale);
    resCanvas.height = Math.round(c.height * resScale);
    resCanvas.getContext('2d').drawImage(c, 0, 0, resCanvas.width, resCanvas.height);

    // Get result blob for size info
    const origSize = bf.file.size;
    const resultBlob = await new Promise(r => {
      const fmt = $('batch-format')?.value || 'png';
      const mime = { png:'image/png', jpeg:'image/jpeg', webp:'image/webp' }[fmt === 'original' ? 'png' : fmt] || 'image/png';
      const q = fmt === 'png' ? undefined : (+($('batch-quality')?.value) || 85) / 100;
      c.toBlob(r, mime, q);
    });

    // Click either canvas to view both side by side at full size
    const origDataUrl = bf.canvas.toDataURL('image/jpeg', 0.8);
    const resDataUrl = c.toDataURL('image/jpeg', 0.8);
    const viewBoth = () => {
      pixDialog.alert('Compare: ' + bf.file.name,
        `<div style="display:flex;gap:12px;align-items:flex-start;flex-wrap:wrap;justify-content:center;">` +
        `<div style="flex:1;min-width:200px;text-align:center;"><div style="color:var(--slate-400);margin-bottom:4px;">Original (${bf.img.naturalWidth}\u00d7${bf.img.naturalHeight} | ${(origSize/1024).toFixed(0)} KB)</div><img src="${origDataUrl}" style="max-width:100%;max-height:50vh;border-radius:4px;border:1px solid var(--slate-700);"></div>` +
        `<div style="flex:1;min-width:200px;text-align:center;"><div style="color:var(--slate-400);margin-bottom:4px;">Result (${c.width}\u00d7${c.height} | ${(resultBlob.size/1024).toFixed(0)} KB)</div><img src="${resDataUrl}" style="max-width:100%;max-height:50vh;border-radius:4px;border:1px solid var(--slate-700);"></div>` +
        `</div>`
      );
    };
    origCanvas.style.cursor = 'pointer'; origCanvas.onclick = viewBoth;
    resCanvas.style.cursor = 'pointer'; resCanvas.onclick = viewBoth;

    // Info
    const info = $('batch-preview-info');
    info.textContent = `Original: ${bf.img.naturalWidth}\u00d7${bf.img.naturalHeight} (${(origSize/1024).toFixed(0)} KB) \u2192 Result: ${c.width}\u00d7${c.height} (${(resultBlob.size/1024).toFixed(0)} KB) | ${importedPipeline ? importedPipeline.length + ' pipeline ops' : 'No pipeline'} | Click to compare full size`;
  });

  // --- Auto-refresh preview when settings change ---
  let previewTimer = null;
  function schedulePreviewRefresh() {
    if ($('batch-preview-area')?.style.display === 'none') return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => { $('btn-batch-preview')?.click(); $('btn-batch-preview')?.click(); }, 300);
  }
  // Hmm double-click would toggle off then on. Let me use a direct refresh instead:
  async function refreshPreview() {
    if ($('batch-preview-area')?.style.display === 'none') return;
    if (!batchFiles.length) return;
    // Force show and re-render
    $('batch-preview-area').style.display = 'none';
    $('btn-batch-preview')?.click();
  }
  const batchSettingIds = ['batch-w','batch-h','batch-filter','batch-watermark','batch-wm-opacity','batch-wm-mode','batch-wm-position','batch-wm-color','batch-wm-font','batch-format','batch-quality','batch-lock','batch-multi-size','batch-sizes','batch-strip-meta','batch-add-copyright','batch-copyright-text','batch-rename','batch-crop-t','batch-crop-r','batch-crop-b','batch-crop-l','batch-ratio-enforce','batch-normalize'];
  batchSettingIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const handler = () => { clearTimeout(previewTimer); previewTimer = setTimeout(refreshPreview, 400); };
    el.addEventListener('input', handler);
    el.addEventListener('change', handler);
  });

  // --- Process all ---
  $('btn-batch-process')?.addEventListener('click', async () => {
    const checked = getChecked();
    if (!checked.length) return;
    const btn = $('btn-batch-process');
    btn.disabled = true; btn.textContent = 'Processing...';

    const progress = $('batch-progress');
    const bar = $('batch-progress-bar');
    const text = $('batch-progress-text');
    progress.style.display = '';

    const useZip = $('batch-zip')?.checked;
    const allResults = [];

    for (let i = 0; i < checked.length; i++) {
      const pct = Math.round(((i + 1) / checked.length) * 100);
      bar.style.width = pct + '%';
      text.textContent = `Processing ${i + 1} / ${checked.length}: ${checked[i].file.name}`;
      const results = await processOne(checked[i], i);
      allResults.push(...results);
    }

    if (useZip && typeof ZipWriter !== 'undefined') {
      text.textContent = `Zipping ${allResults.length} files...`;
      const zip = new ZipWriter();
      for (const r of allResults) {
        await zip.addBlob(r.filename, r.blob);
      }
      const zipBlob = zip.toBlob();
      const zipUrl = URL.createObjectURL(zipBlob);
      chrome.runtime.sendMessage({ action: 'download', url: zipUrl, filename: 'snaproo/batch-export.zip', saveAs: true });
      const origTotal = checked.reduce((s, bf) => s + bf.file.size, 0);
      const pctSaved = origTotal > 0 ? Math.round((1 - zipBlob.size / origTotal) * 100) : 0;
      text.textContent = `Done! ${allResults.length} files zipped (${(zipBlob.size / 1024 / 1024).toFixed(1)} MB) | Original: ${(origTotal/1024/1024).toFixed(1)} MB \u2192 ${pctSaved}% ${pctSaved >= 0 ? 'smaller' : 'larger'}`;
    } else {
      // Individual downloads
      for (const r of allResults) {
        chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(r.blob), filename: `snaproo/batch/${r.filename}`, saveAs: false });
        await new Promise(res => setTimeout(res, 50));
      }
      const origTotal = checked.reduce((s, bf) => s + bf.file.size, 0);
      const outTotal = allResults.reduce((s, r) => s + r.blob.size, 0);
      const pctSaved = origTotal > 0 ? Math.round((1 - outTotal / origTotal) * 100) : 0;
      text.textContent = `Done! ${allResults.length} files | Original: ${(origTotal/1024/1024).toFixed(1)} MB \u2192 Output: ${(outTotal/1024/1024).toFixed(1)} MB (${pctSaved}% ${pctSaved >= 0 ? 'smaller' : 'larger'})`;
    }

    bar.style.width = '100%';
    btn.disabled = false; btn.textContent = 'Process All';
  });

  // --- Clear All ---
  // Add from Library button
  $('btn-batch-from-lib')?.addEventListener('click', () => {
    openLibraryPicker(async (items) => {
      for (const item of items) {
        const img = new Image();
        img.src = item.dataUrl;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);
        // Create a minimal file-like object for name/type/size
        const fakeFile = { name: item.name || 'library-image.png', type: 'image/png', size: item.dataUrl.length };
        batchFiles.push({ file: fakeFile, img, canvas: c, checked: true });
      }
      _updateBatchUI();
    });
  });

  $('btn-batch-sel-all')?.addEventListener('click', () => {
    batchFiles.forEach(bf => { bf.checked = true; }); _updateBatchUI();
  });
  $('btn-batch-sel-none')?.addEventListener('click', () => {
    batchFiles.forEach(bf => { bf.checked = false; }); _updateBatchUI();
  });

  $('btn-batch-clear')?.addEventListener('click', async () => {
    if (batchFiles.length) {
      const ok = await pixDialog.confirm('Clear Batch', `Remove all ${batchFiles.length} images from the batch?`, { danger: true, okText: 'Clear' });
      if (!ok) return;
    }
    batchFiles = []; importedPipeline = null;
    $('batch-pipeline-info').textContent = 'No pipeline';
    $('batch-progress').style.display = 'none';
    _updateBatchUI();
  });

  // --- 1. LQIP: Lazy Load Placeholders ---
  // --- Helper: download or add to zip ---
  async function batchOutput(filename, blob) {
    const useZip = $('batch-zip')?.checked;
    if (useZip && window._batchZip) {
      await window._batchZip.addBlob(filename, blob);
    } else {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `snaproo/batch/${filename}`, saveAs: false });
      await new Promise(r => setTimeout(r, 50));
    }
  }

  async function startBatchZip() {
    if ($('batch-zip')?.checked && typeof ZipWriter !== 'undefined') {
      window._batchZip = new ZipWriter();
      return true;
    }
    window._batchZip = null;
    return false;
  }

  async function finishBatchZip(label) {
    if (window._batchZip) {
      const zipBlob = window._batchZip.toBlob();
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(zipBlob), filename: `snaproo/${label}.zip`, saveAs: true });
      const footer = $('footer-status');
      if (footer) footer.textContent = `${label}: ${(zipBlob.size / 1024 / 1024).toFixed(1)} MB zip`;
      window._batchZip = null;
    }
  }

  // --- 1. LQIP ---
  $('btn-batch-lqip')?.addEventListener('click', async () => {
    const checked = getChecked(); if (!checked.length) return;
    const json = {};
    await startBatchZip();

    for (const bf of checked) {
      const baseName = bf.file.name.replace(/\.[^.]+$/, '');
      const lqipW = +($('batch-lqip-size')?.value) || 20;
      const tiny = document.createElement('canvas'); tiny.width = lqipW;
      tiny.height = Math.round(lqipW * bf.img.naturalHeight / bf.img.naturalWidth);
      const tc = tiny.getContext('2d');
      tc.filter = 'blur(2px)'; tc.drawImage(bf.img, 0, 0, tiny.width, tiny.height);
      json[baseName] = tiny.toDataURL('image/jpeg', 0.3);
      // Also output actual tiny image file
      const imgBlob = await new Promise(r => tiny.toBlob(r, 'image/jpeg', 0.3));
      await batchOutput(`lqip/${baseName}-lqip.jpg`, imgBlob);
    }

    // Also output the JSON mapping file
    const jsonBlob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
    await batchOutput('lqip/placeholders.json', jsonBlob);
    await finishBatchZip('lqip');
    pixDialog.alert('LQIP Placeholders Generated', `<div style="">Generated ${checked.length} tiny blurred images + JSON map.<br><br>Usage:<br><code style="background:var(--slate-800);padding:2px 6px;border-radius:3px;">&lt;img src="photo-lqip.jpg" data-src="photo.jpg" loading="lazy"&gt;</code></div>`);
  });

  // --- 2. Social Preset Batch ---
  $('btn-batch-social')?.addEventListener('click', async () => {
    const checked = getChecked(); if (!checked.length) return;
    const btn = $('btn-batch-social'); btn.disabled = true; btn.textContent = '...';
    const presets = [
      { name: 'ig-post', w: 1080, h: 1080 },
      { name: 'ig-story', w: 1080, h: 1920 },
      { name: 'fb-cover', w: 820, h: 312 },
      { name: 'tw-header', w: 1500, h: 500 },
      { name: 'yt-thumb', w: 1280, h: 720 },
    ];
    await startBatchZip();
    for (const bf of checked) {
      const baseName = bf.file.name.replace(/\.[^.]+$/, '');
      for (const p of presets) {
        const c = document.createElement('canvas'); c.width = p.w; c.height = p.h;
        const ctx = c.getContext('2d');
        const scale = Math.max(p.w / bf.img.naturalWidth, p.h / bf.img.naturalHeight);
        const sw = bf.img.naturalWidth * scale, sh = bf.img.naturalHeight * scale;
        ctx.drawImage(bf.img, (p.w - sw) / 2, (p.h - sh) / 2, sw, sh);
        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.9));
        await batchOutput(`social/${baseName}-${p.name}.jpg`, blob);
      }
    }
    await finishBatchZip('social-batch');
    btn.disabled = false; btn.textContent = 'Social';
    $('footer-status').textContent = `Social: ${checked.length} images \u00d7 ${presets.length} sizes = ${checked.length * presets.length} files`;
  });

  // --- 3. Processing Report ---
  $('btn-batch-report')?.addEventListener('click', async () => {
    const checked = getChecked(); if (!checked.length) return;
    let html = '<!DOCTYPE html><html><head><title>Snaproo Batch Report</title><style>body{font-family:Inter,system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem;max-width:900px;margin:0 auto;}table{width:100%;border-collapse:collapse;margin:1rem 0;}th,td{padding:8px 12px;border-bottom:1px solid #334155;text-align:left;font-size:0.875rem;}th{color:#94a3b8;font-weight:600;}img{max-height:60px;border-radius:4px;}</style></head><body>';
    html += `<h1>Snaproo Batch Report</h1><p style="color:#94a3b8;">${new Date().toLocaleString()} | ${checked.length} images</p>`;
    html += '<table><tr><th>#</th><th>Preview</th><th>Filename</th><th>Dimensions</th><th>Format</th><th>Size</th></tr>';
    checked.forEach((bf, i) => {
      const thumb = bf.canvas.toDataURL('image/jpeg', 0.3);
      html += `<tr><td>${i + 1}</td><td><img src="${thumb}"></td><td>${bf.file.name}</td><td>${bf.img.naturalWidth}\u00d7${bf.img.naturalHeight}</td><td>${bf.file.type || '?'}</td><td>${(bf.file.size / 1024).toFixed(0)} KB</td></tr>`;
    });
    html += '</table></body></html>';
    const blob = new Blob([html], { type: 'text/html' });
    await startBatchZip();
    await batchOutput('report.html', blob);
    await finishBatchZip('batch-report');
  });

  // --- 4. Aspect Ratio + 5. Normalization: handled in processOne ---

  // --- 6. Duplicate Detection ---
  $('btn-batch-dupes')?.addEventListener('click', () => {
    const checked = getChecked(); if (checked.length < 2) return;
    // Compute perceptual hash for each (8x8 grayscale average)
    function pHash(img) {
      const c = document.createElement('canvas'); c.width = 8; c.height = 8;
      c.getContext('2d').drawImage(img, 0, 0, 8, 8);
      const d = c.getContext('2d').getImageData(0, 0, 8, 8).data;
      let avg = 0;
      for (let i = 0; i < 64; i++) avg += (d[i*4] + d[i*4+1] + d[i*4+2]) / 3;
      avg /= 64;
      let hash = '';
      for (let i = 0; i < 64; i++) hash += ((d[i*4] + d[i*4+1] + d[i*4+2]) / 3 > avg) ? '1' : '0';
      return hash;
    }
    function hammingDist(a, b) { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++; return d; }

    const hashes = checked.map(bf => ({ bf, hash: pHash(bf.img) }));
    const dupes = [];
    for (let i = 0; i < hashes.length; i++) {
      for (let j = i + 1; j < hashes.length; j++) {
        const dist = hammingDist(hashes[i].hash, hashes[j].hash);
        if (dist < 10) dupes.push({ a: hashes[i].bf.file.name, b: hashes[j].bf.file.name, similarity: Math.round((1 - dist/64) * 100) });
      }
    }
    if (dupes.length === 0) { pixDialog.alert('Duplicate Check', 'No similar images found.'); return; }
    let html = `<div style="">Found ${dupes.length} potential duplicate pair(s):</div>`;
    html += '<table style="width:100%;border-collapse:collapse;margin-top:8px;">';
    html += '<tr style="border-bottom:1px solid var(--slate-700);"><th style="text-align:left;padding:4px;">Image A</th><th style="text-align:left;padding:4px;">Image B</th><th style="text-align:center;padding:4px;">Similarity</th></tr>';
    dupes.forEach(d => {
      const color = d.similarity > 95 ? '#ef4444' : d.similarity > 85 ? '#eab308' : 'var(--slate-400)';
      html += `<tr style="border-bottom:1px solid var(--slate-800);"><td style="padding:4px;">${d.a}</td><td style="padding:4px;">${d.b}</td><td style="text-align:center;padding:4px;color:${color};">${d.similarity}%</td></tr>`;
    });
    html += '</table>';
    pixDialog.alert('Duplicate Detection', html);
  });

  // --- 7. Drag Reorder ---
  // Handled in _updateBatchUI — cards get draggable attribute

  // --- 8. Presets (save/load batch settings to chrome.storage) ---
  function getBatchSettings() {
    return {
      w: $('batch-w')?.value || '',
      h: $('batch-h')?.value || '',
      lock: $('batch-lock')?.checked,
      filter: $('batch-filter')?.value || 'none',
      watermark: $('batch-watermark')?.value || '',
      wmOpacity: $('batch-wm-opacity')?.value || '30',
      wmMode: $('batch-wm-mode')?.value || 'text',
      wmPosition: $('batch-wm-position')?.value || 'center',
      wmColor: $('batch-wm-color')?.value || '#ffffff',
      wmFont: $('batch-wm-font')?.value || 'Inter, system-ui, sans-serif',
      format: $('batch-format')?.value || 'png',
      quality: $('batch-quality')?.value || '85',
      stripMeta: $('batch-strip-meta')?.checked,
      copyright: $('batch-add-copyright')?.checked,
      copyrightText: $('batch-copyright-text')?.value || '',
      rename: $('batch-rename')?.value || '{name}',
      multiSize: $('batch-multi-size')?.checked,
      sizes: $('batch-sizes')?.value || '150,600,1200',
      ratio: $('batch-ratio-enforce')?.value || 'none',
      normalize: $('batch-normalize')?.checked,
      cropT: $('batch-crop-t')?.value || '0',
      cropR: $('batch-crop-r')?.value || '0',
      cropB: $('batch-crop-b')?.value || '0',
      cropL: $('batch-crop-l')?.value || '0',
      zip: $('batch-zip')?.checked,
    };
  }

  function applyBatchSettings(s) {
    if (!s) return;
    const set = (id, val) => { const el = document.getElementById(id); if (el) { if (el.type === 'checkbox') el.checked = !!val; else el.value = val; } };
    set('batch-w', s.w); set('batch-h', s.h); set('batch-lock', s.lock);
    set('batch-filter', s.filter); set('batch-watermark', s.watermark);
    set('batch-wm-opacity', s.wmOpacity); set('batch-wm-mode', s.wmMode);
    set('batch-wm-position', s.wmPosition); set('batch-wm-color', s.wmColor);
    set('batch-wm-font', s.wmFont); set('batch-format', s.format);
    set('batch-quality', s.quality); set('batch-strip-meta', s.stripMeta);
    set('batch-add-copyright', s.copyright); set('batch-copyright-text', s.copyrightText);
    set('batch-rename', s.rename); set('batch-multi-size', s.multiSize);
    set('batch-sizes', s.sizes); set('batch-ratio-enforce', s.ratio);
    set('batch-normalize', s.normalize); set('batch-zip', s.zip);
    set('batch-crop-t', s.cropT); set('batch-crop-r', s.cropR);
    set('batch-crop-b', s.cropB); set('batch-crop-l', s.cropL);
    // Update labels
    $('batch-wm-opacity-val').textContent = s.wmOpacity || '30';
    $('batch-quality-val').textContent = s.quality || '85';
    updateRenamePreview();
  }

  function loadPresetList() {
    chrome.storage.local.get({ batchPresets: {} }, (r) => {
      const sel = $('batch-preset-list');
      if (!sel) return;
      sel.innerHTML = '<option value="">Presets...</option>';
      for (const name of Object.keys(r.batchPresets).sort()) {
        const opt = document.createElement('option'); opt.value = name; opt.textContent = name;
        sel.appendChild(opt);
      }
    });
  }
  loadPresetList();

  $('btn-batch-save-preset')?.addEventListener('click', async () => {
    const name = await pixDialog.prompt('Save Batch Preset', 'Preset name:', 'My Preset');
    if (!name) return;
    const settings = getBatchSettings();
    chrome.storage.local.get({ batchPresets: {} }, (r) => {
      r.batchPresets[name] = settings;
      chrome.storage.local.set({ batchPresets: r.batchPresets }, () => {
        loadPresetList();
        $('footer-status').textContent = `Preset "${name}" saved`;
      });
    });
  });

  $('batch-preset-list')?.addEventListener('change', (e) => {
    const name = e.target.value; if (!name) return;
    chrome.storage.local.get({ batchPresets: {} }, (r) => {
      if (r.batchPresets[name]) {
        applyBatchSettings(r.batchPresets[name]);
        $('footer-status').textContent = `Preset "${name}" loaded`;
      }
    });
    e.target.value = '';
  });

  $('btn-batch-del-preset')?.addEventListener('click', () => {
    const sel = $('batch-preset-list');
    const name = sel?.value; if (!name) return;
    chrome.storage.local.get({ batchPresets: {} }, (r) => {
      delete r.batchPresets[name];
      chrome.storage.local.set({ batchPresets: r.batchPresets }, () => {
        loadPresetList();
        $('footer-status').textContent = `Preset "${name}" deleted`;
      });
    });
  });

  // --- Right-click context menu on batch area ---
  $('batch-queue')?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    $$('.ctx-menu').forEach(m => m.remove());
    const has = batchFiles.length > 0;

    const items = [
      { label: `${getChecked().length}/${batchFiles.length} selected`, enabled: false },
      { sep: true },
      { label: 'Select All', enabled: has, action: () => { $('btn-batch-sel-all')?.click(); } },
      { label: 'Deselect All', enabled: has, action: () => { $('btn-batch-sel-none')?.click(); } },
      { sep: true },
      { label: 'Clear All', enabled: has, danger: true, action: () => { $('btn-batch-clear')?.click(); } },
      { label: 'Check Consistency', enabled: has, action: () => { $('btn-batch-check')?.click(); } },
      { sep: true },
      { header: 'Sort' },
      { label: 'Sort by Name', enabled: has, action: () => { batchFiles.sort((a,b) => a.file.name.localeCompare(b.file.name)); _updateBatchUI(); } },
      { label: 'Sort by Size (small first)', enabled: has, action: () => { batchFiles.sort((a,b) => a.file.size - b.file.size); _updateBatchUI(); } },
      { label: 'Sort by Size (large first)', enabled: has, action: () => { batchFiles.sort((a,b) => b.file.size - a.file.size); _updateBatchUI(); } },
      { label: 'Sort by Width', enabled: has, action: () => { batchFiles.sort((a,b) => a.img.naturalWidth - b.img.naturalWidth); _updateBatchUI(); } },
      { sep: true },
      { label: 'Remove Duplicates', enabled: has, action: () => {
        const seen = new Set();
        batchFiles = batchFiles.filter(bf => { const k = bf.file.name + bf.file.size; if (seen.has(k)) return false; seen.add(k); return true; });
        _updateBatchUI();
      }},
    ];

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    let lastWasSep = true;
    for (const item of items) {
      if (item.sep) { if (!lastWasSep) { const s = document.createElement('div'); s.className = 'ctx-menu-sep'; menu.appendChild(s); lastWasSep = true; } continue; }
      if (item.header) { const h = document.createElement('div'); h.className = 'ctx-menu-header'; h.textContent = item.header; menu.appendChild(h); lastWasSep = false; continue; }
      if (!item.enabled && item.enabled !== undefined) continue;
      const el = document.createElement('div');
      el.className = 'ctx-menu-item' + (item.danger ? ' danger' : '');
      el.textContent = item.label;
      if (item.action) el.addEventListener('click', () => { menu.remove(); item.action(); });
      menu.appendChild(el);
      lastWasSep = false;
    }
    if (menu.lastChild?.classList?.contains('ctx-menu-sep')) menu.lastChild.remove();

    menu.style.left = e.clientX + 'px'; menu.style.top = e.clientY + 'px';
    document.body.appendChild(menu);
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 4) + 'px';
      if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 4) + 'px';
    });
    setTimeout(() => {
      const close = (ev) => {
        if (ev.type === 'keydown' && ev.key !== 'Escape') return;
        if (ev.type === 'mousedown' && menu.contains(ev.target)) return;
        menu.remove(); document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close);
      };
      document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    }, 50);
  });
}
