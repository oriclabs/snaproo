// Pixeroo — Edit Tool
function initEdit() {
  editCanvas = document.getElementById('editor-canvas');
  editCtx = editCanvas.getContext('2d', { willReadFrequently: true });

  setupDropzone(document.getElementById('edit-dropzone'), document.getElementById('edit-file'), async (file) => {
    editFilename = file.name.replace(/\.[^.]+$/, '');
    document.getElementById('file-label').textContent = file.name;
    const img = await loadImg(file);
    if (!img) return;
    editOriginal = img;
    // Non-destructive: load into pipeline, pipeline renders to display canvas
    pipeline.setDisplayCanvas(editCanvas);
    pipeline.loadImage(img);
    editCanvas.style.display = 'block'; document.getElementById('edit-ribbon')?.classList.remove('disabled');
    document.getElementById('edit-dropzone').style.display = 'none';
    updResize(); originalW = 0; originalH = 0; saveEdit();
    // Init guides overlay
    _initEditGuides();
  });

  // Drop-to-replace on work area
  setupWorkAreaReplace('#mode-edit .work-area', async (file) => {
    editFilename = file.name.replace(/\.[^.]+$/, '');
    document.getElementById('file-label').textContent = file.name;
    const img = await loadImg(file);
    if (!img) return;
    editOriginal = img;
    pipeline.setDisplayCanvas(editCanvas);
    pipeline.loadImage(img);
    editCanvas.style.display = 'block';
    document.getElementById('edit-ribbon')?.classList.remove('disabled');
    document.getElementById('edit-dropzone').style.display = 'none';
    updResize(); originalW = 0; originalH = 0; saveEdit();
    resetAdjustmentSliders();
    _initEditGuides();
  });

  // Reset All -- revert to original image
  document.getElementById('btn-reset-all')?.addEventListener('click', async () => {
    if (!editOriginal) return;
    const ok = await pixDialog.confirm('Reset Image', 'Reset all edits and revert to original image?', { danger: true, okText: 'Reset' });
    if (!ok) return;
    // Non-destructive reset: pipeline replays from original
    pipeline.resetAll();
    updResize();
       saveEdit();
    // Reset sliders
    resetAdjustmentSliders();
  });

  // Reset Adjustments -- remove adjust ops from pipeline, reset sliders
  document.getElementById('btn-reset-adjust')?.addEventListener('click', () => {
    resetAdjustmentSliders();
    pipeline.operations = pipeline.operations.filter(op => op.type !== 'adjust');
    pipeline.render();
    saveEdit();
  });

  function resetAdjustmentSliders() {
    ['brightness', 'contrast', 'saturation'].forEach(a => {
      document.getElementById(`adj-${a}`).value = 0;
      document.getElementById(`val-${a}`).textContent = '0';
    });
    document.getElementById('adj-hue').value = 0;
    document.getElementById('val-hue').textContent = '0';
  }

  document.addEventListener('paste', (e) => {
    if (currentMode !== 'edit') return;
    for (const item of (e.clipboardData?.items || [])) {
      if (item.type.startsWith('image/')) {
        loadImg(item.getAsFile()).then(img => {
          if (!img) return;
          editOriginal = img; editFilename = 'pasted';
          document.getElementById('file-label').textContent = 'Pasted image';
          pipeline.setDisplayCanvas(editCanvas);
          pipeline.loadImage(img);
          editCanvas.style.display = 'block'; document.getElementById('edit-ribbon')?.classList.remove('disabled');
          document.getElementById('edit-dropzone').style.display = 'none';
          updResize(); originalW = 0; originalH = 0; saveEdit();
          _initEditGuides();
        }); break;
      }
    }

    // Also handle paste in Convert mode
    if (currentMode === 'convert') {
      for (const item of (e.clipboardData?.items || [])) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          convertFiles.push(file);
          document.getElementById('convert-drop').style.display = 'none';
          document.getElementById('convert-preview').style.display = 'block';
          document.getElementById('convert-img').src = URL.createObjectURL(file);
          document.getElementById('convert-batch-info').textContent = file.name || 'Pasted image';
          document.getElementById('btn-convert-go').disabled = false;
          break;
        }
      }
    }
  });

  document.getElementById('btn-undo').addEventListener('click', editUndo);
  document.getElementById('btn-redo').addEventListener('click', editRedo);
  document.getElementById('btn-history')?.addEventListener('click', function() { _showHistoryPanel(this); });

  // Resize
  const rw = document.getElementById('resize-w'), rh = document.getElementById('resize-h'), lr = document.getElementById('lock-ratio');
  rw.addEventListener('input', () => { if (lr.checked && editCanvas.width) rh.value = Math.round(+rw.value * editCanvas.height / editCanvas.width) || ''; });
  rh.addEventListener('input', () => { if (lr.checked && editCanvas.height) rw.value = Math.round(+rh.value * editCanvas.width / editCanvas.height) || ''; });
  document.getElementById('btn-apply-resize').addEventListener('click', () => {
    const w = +rw.value, h = +rh.value;
    if (!w || !h || (w === editCanvas.width && h === editCanvas.height)) return;
    pipeline.setExportSize(w, h);
    updResize(); saveEdit();
  });

  // Transform (non-destructive via pipeline)
  document.getElementById('btn-rotate-left').addEventListener('click', () => { pipeline.addOperation({type:'rotate', degrees:-90}); updResize(); saveEdit(); });
  document.getElementById('btn-rotate-right').addEventListener('click', () => { pipeline.addOperation({type:'rotate', degrees:90}); updResize(); saveEdit(); });
  document.getElementById('btn-flip-h').addEventListener('click', () => { pipeline.addOperation({type:'flip', direction:'h'}); saveEdit(); });
  document.getElementById('btn-flip-v').addEventListener('click', () => { pipeline.addOperation({type:'flip', direction:'v'}); saveEdit(); });

  // Adjustments (non-destructive via pipeline)
  // Adjustments are live-preview: replace the last 'adjust' op on each slider move
  ['brightness','contrast','saturation','hue'].forEach(a => {
    const s = document.getElementById(`adj-${a}`), l = document.getElementById(`val-${a}`);
    s.addEventListener('input', () => {
      l.textContent = s.value;
      // Remove trailing adjust op if present (live update, not stacking)
      if (pipeline.operations.length && pipeline.operations[pipeline.operations.length - 1].type === 'adjust') {
        pipeline.operations.pop();
      }
      const b = +document.getElementById('adj-brightness').value;
      const c = +document.getElementById('adj-contrast').value;
      const sat = +document.getElementById('adj-saturation').value;
      const h = +document.getElementById('adj-hue').value;
      if (b || c || sat || h) {
        pipeline.operations.push({type:'adjust', brightness: b, contrast: c, saturation: sat, hue: h});
      }
      pipeline.undoneOps = [];
      pipeline.render();
    });
    s.addEventListener('change', saveEdit);
  });

  // Filters (non-destructive via pipeline)
  document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    if (!editOriginal) return;
    pipeline.addOperation({type:'filter', name: b.dataset.filter});
    saveEdit();
  }));

  // Interactive Crop (non-destructive via pipeline)
  Crop.init(editCanvas, editCtx, (x, y, w, h) => {
    // Convert absolute px to relative coords (0-1) for pipeline
    const cw = editCanvas.width, ch = editCanvas.height;
    pipeline.addOperation({type:'crop', x: x/cw, y: y/ch, w: w/cw, h: h/ch});
    updResize(); saveEdit();
  });

  const cropRatios = { 'btn-crop-free': null, 'btn-crop-1-1': 1, 'btn-crop-4-3': 4/3, 'btn-crop-16-9': 16/9, 'btn-crop-3-2': 3/2 };
  Object.entries(cropRatios).forEach(([id, ratio]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!editCanvas.width) return;
      Crop.start(document.getElementById('edit-work'), ratio);
      document.getElementById('btn-crop-apply').style.display = '';
      document.getElementById('btn-crop-cancel').style.display = '';
    });
  });

  // Smart crop (auto-detect best region)
  document.getElementById('btn-crop-auto')?.addEventListener('click', async () => {
    if (!editCanvas.width || typeof smartcrop === 'undefined') return;
    try {
      // Create an image from current canvas for smartcrop
      const blob = await new Promise(r => editCanvas.toBlob(r, 'image/png'));
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise(r => { img.onload = r; });

      // Find best square crop (most common use case)
      const size = Math.min(editCanvas.width, editCanvas.height);
      const result = await smartcrop.crop(img, { width: size, height: size });
      const c = result.topCrop;
      URL.revokeObjectURL(img.src);

      // Apply the smart crop via pipeline (relative coords)
      pipeline.addOperation({type:'crop', x: c.x/editCanvas.width, y: c.y/editCanvas.height, w: c.width/editCanvas.width, h: c.height/editCanvas.height});
      updResize(); saveEdit();
    } catch (e) {
      console.warn('Smart crop failed:', e);
    }
  });

  document.getElementById('btn-crop-apply')?.addEventListener('click', () => {
    Crop.apply();
    document.getElementById('btn-crop-apply').style.display = 'none';
    document.getElementById('btn-crop-cancel').style.display = 'none';
  });
  document.getElementById('btn-crop-cancel')?.addEventListener('click', () => {
    Crop.cancel();
    document.getElementById('btn-crop-apply').style.display = 'none';
    document.getElementById('btn-crop-cancel').style.display = 'none';
  });

  // Object-based Drawing (replaces stamp-based Annotate)
  const objLayer = new ObjectLayer(editCanvas, saveEdit);

  // Attach object layer when image loads (called from image load handlers)
  window._pixerooObjLayer = objLayer;

  const annTools = { 'btn-ann-rect': 'rect', 'btn-ann-arrow': 'arrow', 'btn-ann-text': 'text', 'btn-ann-pen': 'pen', 'btn-ann-highlighter': 'highlighter', 'btn-ann-redact': 'redact' };
  const allAnnBtns = ['btn-ann-select', ...Object.keys(annTools)];

  function setActiveAnnTool(activeId) {
    allAnnBtns.forEach(id => document.getElementById(id)?.classList.toggle('active', id === activeId));
  }

  // Pointer / Select tool — deactivates drawing, switches to select mode
  document.getElementById('btn-ann-select')?.addEventListener('click', () => {
    if (objLayer.active) objLayer.stopTool();
    setActiveAnnTool('btn-ann-select');
  });

  Object.entries(annTools).forEach(([id, tool]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!editCanvas.width) return;
      if (!objLayer.active) objLayer.attach(document.getElementById('edit-canvas-wrap'));
      objLayer.startTool(tool);
      setActiveAnnTool(id);
    });
  });

  // Escape key also switches back to pointer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && objLayer.active && objLayer.creating) {
      objLayer.stopTool();
      setActiveAnnTool('btn-ann-select');
    }
  });

  document.getElementById('ann-color')?.addEventListener('input', (e) => {
    objLayer.color = e.target.value;
    if (objLayer.selected) { objLayer.selected.color = e.target.value; objLayer.render(); }
    // Highlight active preset (or none if custom)
    document.querySelectorAll('.ann-preset-color').forEach(s => s.style.outline = '');
  });

  // Preset color palette clicks
  document.querySelectorAll('.ann-preset-color').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      document.getElementById('ann-color').value = color;
      objLayer.color = color;
      if (objLayer.selected) { objLayer.selected.color = color; objLayer.render(); }
      // Highlight active preset
      document.querySelectorAll('.ann-preset-color').forEach(s => s.style.outline = '');
      swatch.style.outline = '2px solid var(--saffron-400)';
      swatch.style.outlineOffset = '1px';
    });
  });
  document.getElementById('ann-width')?.addEventListener('input', (e) => {
    objLayer.lineWidth = +e.target.value;
    if (objLayer.selected) { objLayer.selected.lineWidth = +e.target.value; objLayer.render(); }
  });
  document.getElementById('ann-fill')?.addEventListener('change', (e) => { objLayer.filled = e.target.checked; });
  document.getElementById('ann-font')?.addEventListener('change', (e) => {
    objLayer.fontFamily = e.target.value;
    // Apply to currently selected text object
    if (objLayer.selected?.type === 'text') { objLayer.selected.fontFamily = e.target.value; objLayer.render(); }
  });
  document.getElementById('ann-fontsize')?.addEventListener('change', (e) => {
    objLayer.fontSize = +e.target.value || 24;
    if (objLayer.selected?.type === 'text') { objLayer.selected.fontSize = +e.target.value || 24; objLayer.render(); }
  });

  // Mask filter tool
  document.getElementById('btn-mask-filter')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    if (!objLayer.active) objLayer.attach(document.getElementById('edit-canvas-wrap'));
    objLayer.maskFilter = 'blur'; // default mask filter
    objLayer.startTool('mask');
  });

  // Guides toggle buttons
  document.getElementById('btn-toggle-ruler')?.addEventListener('click', (e) => {
    if (!editGuides) return;
    editGuides.showRuler = !editGuides.showRuler;
    e.currentTarget.classList.toggle('active', editGuides.showRuler);
    editGuides.render();
  });
  document.getElementById('btn-toggle-grid')?.addEventListener('click', (e) => {
    if (!editGuides) return;
    editGuides.showGrid = !editGuides.showGrid;
    e.currentTarget.classList.toggle('active', editGuides.showGrid);
    editGuides.render();
  });
  document.getElementById('btn-toggle-center')?.addEventListener('click', (e) => {
    if (!editGuides) return;
    editGuides.showCenter = !editGuides.showCenter;
    e.currentTarget.classList.toggle('active', editGuides.showCenter);
    editGuides.render();
  });

  // Watermark
  document.getElementById('watermark-opacity')?.addEventListener('input', (e) => {
    document.getElementById('watermark-opacity-val').textContent = e.target.value;
  });
  // Watermark sliders
  document.getElementById('watermark-opacity')?.addEventListener('input', (e) => {
    const v = document.getElementById('watermark-opacity-val2'); if (v) v.textContent = e.target.value;
  });
  document.getElementById('watermark-fontsize')?.addEventListener('input', (e) => {
    const v = document.getElementById('watermark-fontsize-val'); if (v) v.textContent = e.target.value;
  });
  document.getElementById('watermark-angle')?.addEventListener('input', (e) => {
    const v = document.getElementById('watermark-angle-val'); if (v) v.textContent = e.target.value;
  });

  document.getElementById('btn-watermark')?.addEventListener('click', () => {
    const text = document.getElementById('watermark-text').value;
    if (!text || !editCanvas.width) return;
    pipeline.addOperation({type:'watermark', text, options: {
      opacity: +(document.getElementById('watermark-opacity')?.value || 30) / 100,
      fontSize: +(document.getElementById('watermark-fontsize')?.value || 48),
      angle: +(document.getElementById('watermark-angle')?.value || -30),
      color: document.getElementById('ann-color')?.value || '#ffffff',
    }});
    saveEdit();
  });

  // Effects (non-destructive via pipeline)
  document.getElementById('btn-vignette')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'vignette'}); saveEdit(); });
  document.getElementById('btn-denoise')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'denoise'}); saveEdit(); });
  document.getElementById('btn-round-corners')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'roundCorners'}); saveEdit(); });
  document.getElementById('btn-border')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const bw = +document.getElementById('border-width').value || 10;
    pipeline.addOperation({type:'border', width: bw, color: document.getElementById('border-color').value});
    updResize(); saveEdit();
  });
  document.getElementById('btn-tile')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'tile', cols:2, rows:2}); updResize(); saveEdit(); });
  document.getElementById('btn-tile3')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'tile', cols:3, rows:3}); updResize(); saveEdit(); });

  // Color blindness simulation (non-destructive via pipeline)
  document.querySelectorAll('[data-cb]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editOriginal) return;
      pipeline.addOperation({type:'colorBlindness', mode: btn.dataset.cb});
      saveEdit();
    });
  });

  // CMYK simulation (non-destructive via pipeline)
  document.getElementById('btn-cmyk-sim')?.addEventListener('click', () => {
    if (!editOriginal) return;
    pipeline.addOperation({type:'cmyk'});
    saveEdit();
  });

  // Histogram
  function updateHistogram() {
    if (!editCanvas.width) return;
    try {
      const hist = computeHistogram(editCanvas);
      drawHistogram(document.getElementById('histogram-canvas'), hist);
    } catch {}
  }

  // Sprite slicer
  document.getElementById('btn-slice-sprite')?.addEventListener('click', async () => {
    if (!editCanvas.width) return;
    const cols = +document.getElementById('sprite-cols').value || 4;
    const rows = +document.getElementById('sprite-rows').value || 4;
    const tiles = sliceSpriteSheet(editCanvas, cols, rows);
    if (!tiles.length) return;
    const zip = new ZipWriter();
    for (const tile of tiles) {
      const blob = await new Promise(r => tile.canvas.toBlob(r, 'image/png'));
      await zip.addBlob(`sprite-${tile.row}-${tile.col}.png`, blob);
    }
    const zipBlob = await zip.toBlob();
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url; a.download = `pixeroo-sprites-${cols}x${rows}.zip`; a.click();
    URL.revokeObjectURL(url);
  });

  // Steganography
  document.getElementById('btn-steg-detect')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const result = detectSteganography(editCanvas);
    pixDialog.alert('Steganography Analysis', `<div><b>Assessment:</b> ${esc(result.assessment)}</div><div><b>LSB Ratio:</b> ${result.lsbRatio}</div>`);
  });
  document.getElementById('btn-steg-visualize')?.addEventListener('click', () => {
    if (!editOriginal) return;
    pipeline.addOperation({type:'lsbVisualize'});
    saveEdit();
  });

  // Reverse image search
  document.querySelectorAll('[data-rsearch]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editCanvas.width) return;
      openReverseImageSearch(editCanvas.toDataURL('image/png'), btn.dataset.rsearch);
    });
  });

  // Canvas: Padding
  document.getElementById('btn-padding')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const p = +document.getElementById('pad-size')?.value || 20;
    const color = document.getElementById('pad-color')?.value || '#ffffff';
    pipeline.addOperation({type:'padding', top: p, right: p, bottom: p, left: p, color});
    updResize(); saveEdit();
  });

  // Canvas: Split
  document.getElementById('btn-split-h2')?.addEventListener('click', () => splitAndDownload('horizontal', 2));
  document.getElementById('btn-split-v2')?.addEventListener('click', () => splitAndDownload('vertical', 2));
  document.getElementById('btn-split-h3')?.addEventListener('click', () => splitAndDownload('horizontal', 3));
  document.getElementById('btn-split-v3')?.addEventListener('click', () => splitAndDownload('vertical', 3));

  async function splitAndDownload(dir, parts) {
    if (!editCanvas.width) return;
    const tiles = splitImage(editCanvas, dir, parts);
    for (let i = 0; i < tiles.length; i++) {
      const blob = await new Promise(r => tiles[i].toBlob(r, 'image/png'));
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}-${dir[0]}${i+1}.png`, saveAs: false });
    }
  }

  // Background remove



  // Color replace
  document.getElementById('btn-color-replace')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const from = document.getElementById('color-from').value;
    const to = document.getElementById('color-to').value;
    const fr = parseInt(from.slice(1,3),16), fg = parseInt(from.slice(3,5),16), fb = parseInt(from.slice(5,7),16);
    const tr = parseInt(to.slice(1,3),16), tg = parseInt(to.slice(3,5),16), tb = parseInt(to.slice(5,7),16);
    replaceColor(editCanvas, fr, fg, fb, tr, tg, tb, 30);
    saveEdit();
  });

  // Channel separation (non-destructive via pipeline)
  document.querySelectorAll('[data-channel]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editOriginal) return;
      pipeline.addOperation({type:'channel', channel: btn.dataset.channel});
      saveEdit();
    });
  });

  // Levels
  ['level-black', 'level-white', 'level-gamma'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', (e) => {
      const val = id === 'level-gamma' ? (+e.target.value / 100).toFixed(1) : e.target.value;
      document.getElementById(id + '-val').textContent = val;
    });
  });
  document.getElementById('btn-apply-levels')?.addEventListener('click', () => {
    if (!editOriginal) return;
    pipeline.addOperation({type:'levels', black: +document.getElementById('level-black').value, white: +document.getElementById('level-white').value, gamma: +document.getElementById('level-gamma').value / 100});
    saveEdit();
  });

  // Pixelate art
  document.getElementById('btn-pixelate')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    pipeline.addOperation({type:'pixelate', blockSize: +document.getElementById('pixelate-size').value || 8});
    saveEdit();
  });

  // Favicon preview
  document.getElementById('btn-gen-favicons')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const previews = generateFaviconPreviews(editCanvas);
    let html = '<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end;">';
    previews.forEach(p => {
      html += `<div style="text-align:center;"><img src="${p.canvas.toDataURL()}" style="width:${Math.min(p.size, 64)}px;height:${Math.min(p.size, 64)}px;border-radius:3px;border:1px solid var(--slate-700);display:block;margin:0 auto 4px;image-rendering:pixelated;"><span style="color:var(--slate-400);">${p.size}px</span></div>`;
    });
    html += '</div>';
    pixDialog.alert('Favicon Preview', html);
  });

  // ASCII art
  document.getElementById('btn-ascii')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const cols = +document.getElementById('ascii-cols').value || 80;
    const art = imageToAscii(editCanvas, cols);
    navigator.clipboard.writeText(art).catch(() => {});
    pixDialog.alert('ASCII Art (copied to clipboard)', `<pre style="font-family:monospace;font-size:5px;line-height:6px;overflow:auto;max-height:400px;background:var(--slate-800);padding:8px;border-radius:6px;color:var(--slate-200);white-space:pre;">${esc(art)}</pre>`);
  });

  // Generators
  // Generators with full options
  function showGenerated(canvas, name) {
    editCanvas.width = canvas.width; editCanvas.height = canvas.height;
    editCtx.drawImage(canvas, 0, 0);
    editCanvas.style.display = 'block'; document.getElementById('edit-ribbon')?.classList.remove('disabled');
    document.getElementById('edit-dropzone').style.display = 'none';
    editFilename = name; updResize(); saveEdit();
  }

  document.getElementById('btn-gen-gradient')?.addEventListener('click', () => {
    const w = +(document.getElementById('gen-w')?.value || document.getElementById('bar-w')?.value) || 800;
    const h = +(document.getElementById('gen-h')?.value || document.getElementById('bar-h')?.value) || 600;
    const type = document.getElementById('gen-grad-type').value;
    const c1 = document.getElementById('gen-grad-c1').value;
    const c2 = document.getElementById('gen-grad-c2').value;
    showGenerated(generateGradient(w, h, type, [{ pos: 0, color: c1 }, { pos: 1, color: c2 }]), 'gradient');
  });

  document.getElementById('btn-gen-pattern')?.addEventListener('click', () => {
    const w = +(document.getElementById('gen-w')?.value || document.getElementById('bar-w')?.value) || 800;
    const h = +(document.getElementById('gen-h')?.value || document.getElementById('bar-h')?.value) || 600;
    const type = document.getElementById('gen-pat-type').value;
    const c1 = document.getElementById('gen-pat-c1').value;
    const c2 = document.getElementById('gen-pat-c2').value;
    const cell = +document.getElementById('gen-pat-cell').value || 40;
    showGenerated(generatePattern(w, h, type, c1, c2, cell), 'pattern');
  });

  document.getElementById('btn-gen-placeholder')?.addEventListener('click', () => {
    const w = +(document.getElementById('gen-w')?.value || document.getElementById('bar-w')?.value) || 800;
    const h = +(document.getElementById('gen-h')?.value || document.getElementById('bar-h')?.value) || 600;
    const bg = document.getElementById('gen-ph-bg').value;
    const tc = document.getElementById('gen-ph-text-color').value;
    const text = document.getElementById('gen-ph-text').value || '';
    showGenerated(generatePlaceholder(w, h, bg, tc, text), 'placeholder');
  });

  // Strip metadata
  document.getElementById('btn-strip-meta')?.addEventListener('click', async () => {
    if (!editCanvas.width) return;
    const blob = await stripMetadata(editCanvas, 'png');
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}-clean.png`, saveAs: true });
  });

  // Image to PDF
  document.getElementById('btn-to-pdf')?.addEventListener('click', async () => {
    if (!editCanvas.width) return;
    const blob = await imageToPdf([editCanvas], 'pixeroo-export');
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}.pdf`, saveAs: true });
  });

  // Export
  document.getElementById('btn-export').addEventListener('click', editExport);

  // Export annotations as SVG overlay
  document.getElementById('btn-export-annotations-svg')?.addEventListener('click', () => {
    if (!window._pixerooObjLayer?.hasObjects()) return;
    const svg = window._pixerooObjLayer.exportAsSVG(editCanvas.width, editCanvas.height);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}-annotations.svg`, saveAs: true });
  });

  // --- Save/Load Edit Project ---
  document.getElementById('btn-edit-save')?.addEventListener('click', () => {
    if (!editOriginal) return;
    const footer = document.getElementById('footer-status');
    if (footer) footer.textContent = 'Saving project...';

    // Save original image as base64 + pipeline operations
    const tmpC = document.createElement('canvas');
    tmpC.width = editOriginal.naturalWidth || editOriginal.width;
    tmpC.height = editOriginal.naturalHeight || editOriginal.height;
    tmpC.getContext('2d').drawImage(editOriginal, 0, 0);

    const project = {
      version: 1,
      type: 'edit',
      original: tmpC.toDataURL('image/png'),
      filename: editFilename,
      exportWidth: pipeline.exportWidth,
      exportHeight: pipeline.exportHeight,
      operations: pipeline.operations,
    };

    const json = JSON.stringify(project);
    const blob = new Blob([json], { type: 'application/json' });
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}-project.pixeroo`, saveAs: true });
    if (footer) footer.textContent = `Project saved (${(json.length / 1024).toFixed(0)} KB)`;
  });

  const editLoadBtn = document.getElementById('btn-edit-load');
  const editLoadInput = document.getElementById('edit-load-file');
  editLoadBtn?.addEventListener('click', () => editLoadInput?.click());
  editLoadInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    editLoadInput.value = '';
    const footer = document.getElementById('footer-status');
    if (footer) footer.textContent = 'Loading project...';

    try {
      const text = await file.text();
      const project = JSON.parse(text);
      if (!project.version || !project.original) throw new Error('Invalid project');

      // Restore original image
      const img = new Image();
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = project.original; });

      editOriginal = img;
      editFilename = project.filename || 'loaded';
      document.getElementById('file-label').textContent = editFilename;

      // Restore pipeline
      pipeline.setDisplayCanvas(editCanvas);
      pipeline.loadImage(img);
      if (project.exportWidth) pipeline.exportWidth = project.exportWidth;
      if (project.exportHeight) pipeline.exportHeight = project.exportHeight;
      pipeline.operations = project.operations || [];
      pipeline.undoneOps = [];
      pipeline.render();

      editCanvas.style.display = 'block';
      document.getElementById('edit-ribbon')?.classList.remove('disabled');
      document.getElementById('edit-dropzone').style.display = 'none';
      updResize(); originalW = 0; originalH = 0; saveEdit();
      _initEditGuides();

      if (footer) footer.textContent = `Project loaded: ${pipeline.operations.length} operations`;
    } catch (err) {
      console.error('Load project failed:', err);
      if (footer) footer.textContent = 'Failed to load project file';
    }
  });

  // --- Right-click context menu for Edit mode ---
  document.getElementById('edit-work')?.addEventListener('contextmenu', (e) => {
    if (!editCanvas.width) return;
    e.preventDefault();
    document.querySelectorAll('.ctx-menu').forEach(m => m.remove());

    const hasImage = !!editOriginal;
    const hasOps = pipeline.operations.length > 0;
    const hasUndone = pipeline.undoneOps.length > 0;
    const hasObjects = window._pixerooObjLayer?.hasObjects();
    const selObj = window._pixerooObjLayer?.selected;

    const items = [
      { label: 'Undo', shortcut: 'Ctrl+Z', enabled: hasOps, action: editUndo },
      { label: 'Redo', shortcut: 'Ctrl+Y', enabled: hasUndone, action: editRedo },
      { sep: true },
      { label: 'Reset All', enabled: hasOps, action: () => document.getElementById('btn-reset-all')?.click() },
      { label: 'Reset Adjustments', enabled: hasOps, action: () => document.getElementById('btn-reset-adjust')?.click() },
      { sep: true },
      { header: 'Quick Filters', enabled: hasImage },
      { label: 'Grayscale', enabled: hasImage, action: () => { pipeline.addOperation({type:'filter', name:'grayscale'}); saveEdit(); } },
      { label: 'Sepia', enabled: hasImage, action: () => { pipeline.addOperation({type:'filter', name:'sepia'}); saveEdit(); } },
      { label: 'Invert', enabled: hasImage, action: () => { pipeline.addOperation({type:'filter', name:'invert'}); saveEdit(); } },
      { label: 'Sharpen', enabled: hasImage, action: () => { pipeline.addOperation({type:'filter', name:'sharpen'}); saveEdit(); } },
      { sep: true },
      { header: 'Transform', enabled: hasImage },
      { label: 'Rotate Left 90°', enabled: hasImage, action: () => { pipeline.addOperation({type:'rotate', degrees:-90}); updResize(); saveEdit(); } },
      { label: 'Rotate Right 90°', enabled: hasImage, action: () => { pipeline.addOperation({type:'rotate', degrees:90}); updResize(); saveEdit(); } },
      { label: 'Flip Horizontal', enabled: hasImage, action: () => { pipeline.addOperation({type:'flip', direction:'h'}); saveEdit(); } },
      { label: 'Flip Vertical', enabled: hasImage, action: () => { pipeline.addOperation({type:'flip', direction:'v'}); saveEdit(); } },
      { sep: true },
      { label: 'Copy Image', enabled: hasImage, action: () => {
        editCanvas.toBlob(blob => { navigator.clipboard.write([new ClipboardItem({'image/png': blob})]); });
      }},
      { label: 'Export', shortcut: 'Ctrl+S', enabled: hasImage, action: editExport },
      { sep: true },
      { header: 'Annotations', enabled: hasObjects },
      { label: 'Flatten Annotations', enabled: hasObjects, action: () => { window._pixerooObjLayer.flatten(); saveEdit(); } },
      { label: 'Delete Selected', enabled: !!selObj, action: () => { window._pixerooObjLayer.deleteSelected(); window._pixerooObjLayer.render(); } },
      { label: 'Export as SVG', enabled: hasObjects, action: () => document.getElementById('btn-export-annotations-svg')?.click() },
    ];

    // Reuse the same menu builder from collage
    const menu = document.createElement('div');
    menu.className = 'ctx-menu';
    let lastWasSep = true;
    for (const item of items) {
      if (item.sep) { if (!lastWasSep) { const s = document.createElement('div'); s.className = 'ctx-menu-sep'; menu.appendChild(s); lastWasSep = true; } continue; }
      if (item.header) { if (item.enabled === false) continue; const h = document.createElement('div'); h.className = 'ctx-menu-header'; h.textContent = item.header; menu.appendChild(h); lastWasSep = false; continue; }
      if (!item.enabled) continue;
      const el = document.createElement('div');
      el.className = 'ctx-menu-item' + (item.danger ? ' danger' : '');
      el.innerHTML = `${item.label}${item.shortcut ? `<span class="ctx-menu-shortcut">${item.shortcut}</span>` : ''}`;
      el.addEventListener('click', () => { menu.remove(); item.action(); });
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

  // --- Persistent Info Bar ---
  initInfoBar();
}

function updResize() { document.getElementById('resize-w').value = editCanvas.width; document.getElementById('resize-h').value = editCanvas.height; }
function saveEdit() {
  // Pipeline handles state -- just update UI indicators
  try { const h = computeHistogram(editCanvas); drawHistogram(document.getElementById('histogram-canvas'), h); } catch {}
  updateDimensionBadge();
  updateInfoBar();
  pulseExportButton();
  if (editGuides) editGuides.update();
  _updateHistoryBadge();

  // Show last operation in footer with undo hint
  const footer = document.getElementById('footer-status');
  if (footer && pipeline.operations.length) {
    const last = pipeline.operations[pipeline.operations.length - 1];
    const labels = { rotate:'Rotated', flip:'Flipped', crop:'Cropped', adjust:'Adjusted', filter:'Filter', vignette:'Vignette', denoise:'Denoised', pixelate:'Pixelated', roundCorners:'Rounded', watermark:'Watermark', border:'Border', padding:'Padded', tile:'Tiled', colorBlindness:'CB Sim', cmyk:'CMYK', channel:'Channel', levels:'Levels', lsbVisualize:'LSB' };
    const sizeChanged = ['crop','border','tile','rotate','padding'].includes(last.type);
    footer.textContent = `${labels[last.type] || last.type} | ${editCanvas.width}\u00d7${editCanvas.height} | ${pipeline.operations.length} ops${sizeChanged ? ' | Ctrl+Z to undo' : ''}`;
  }
}

// --- History Panel ---
const _historyOpLabels = {
  rotate:'Rotate', flip:'Flip', crop:'Crop', adjust:'Adjust', filter:'Filter',
  vignette:'Vignette', denoise:'Denoise', pixelate:'Pixelate', roundCorners:'Round Corners',
  watermark:'Watermark', border:'Border', tile:'Tile', colorBlindness:'Color Blind Sim',
  cmyk:'CMYK Sim', channel:'Channel', levels:'Levels', lsbVisualize:'LSB Visualize',
};

function _updateHistoryBadge() {
  const badge = document.getElementById('history-count');
  if (!badge) return;
  const n = pipeline.operations.length;
  if (n > 0) { badge.style.display = ''; badge.textContent = n; }
  else { badge.style.display = 'none'; }
}

function _showHistoryPanel(anchorBtn) {
  // Close existing
  document.querySelectorAll('.history-panel').forEach(p => p.remove());

  const panel = document.createElement('div');
  panel.className = 'history-panel';

  // Original state
  const origin = document.createElement('div');
  origin.className = 'history-origin';
  origin.textContent = 'Original Image';
  origin.addEventListener('click', () => {
    pipeline.operations = [];
    pipeline.undoneOps = [];
    pipeline.render();
    updResize(); saveEdit();
    panel.remove();
  });
  panel.appendChild(origin);

  // Each operation
  pipeline.operations.forEach((op, i) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    if (i === pipeline.operations.length - 1) item.classList.add('active');

    const label = _historyOpLabels[op.type] || op.type;
    let detail = '';
    if (op.type === 'rotate') detail = op.degrees + '°';
    else if (op.type === 'flip') detail = op.direction === 'h' ? 'Horizontal' : 'Vertical';
    else if (op.type === 'filter') detail = op.name;
    else if (op.type === 'adjust') detail = `B${op.brightness} C${op.contrast}`;
    else if (op.type === 'crop') detail = `${Math.round(op.w*100)}%x${Math.round(op.h*100)}%`;

    item.innerHTML = `<span class="hi-num">${i + 1}</span><span class="hi-label">${label}${detail ? ' — ' + detail : ''}</span>`;

    // Click to revert to this step
    item.addEventListener('click', () => {
      // Keep operations 0..i, move rest to undone
      const removed = pipeline.operations.splice(i + 1);
      pipeline.undoneOps = removed.reverse().concat(pipeline.undoneOps);
      pipeline.render();
      updResize(); saveEdit();
      panel.remove();
    });

    panel.appendChild(item);
  });

  // Undone ops (grayed out)
  pipeline.undoneOps.slice().reverse().forEach((op, i) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.style.opacity = '0.35';
    const label = _historyOpLabels[op.type] || op.type;
    item.innerHTML = `<span class="hi-num" style="text-decoration:line-through;">${pipeline.operations.length + i + 1}</span><span class="hi-label">${label} (undone)</span>`;
    item.addEventListener('click', () => {
      // Redo up to this point
      for (let j = 0; j <= i; j++) {
        if (pipeline.undoneOps.length) pipeline.operations.push(pipeline.undoneOps.pop());
      }
      pipeline.render();
      updResize(); saveEdit();
      panel.remove();
    });
    panel.appendChild(item);
  });

  if (pipeline.operations.length === 0 && pipeline.undoneOps.length === 0) {
    const empty = document.createElement('div');
    empty.style.cssText = 'padding:10px;text-align:center;color:var(--slate-500);';
    empty.textContent = 'No operations yet';
    panel.appendChild(empty);
  }

  // Position below the button
  const rect = anchorBtn.getBoundingClientRect();
  panel.style.top = (rect.bottom + 4) + 'px';
  panel.style.left = Math.max(8, rect.left - 100) + 'px';
  document.body.appendChild(panel);

  // Close on click outside
  function close(e) {
    if (panel.contains(e.target) || e.target === anchorBtn) return;
    panel.remove();
    document.removeEventListener('mousedown', close);
    document.removeEventListener('keydown', closeKey);
  }
  function closeKey(e) { if (e.key === 'Escape') { panel.remove(); document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeKey); } }
  setTimeout(() => {
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeKey);
  }, 50);
}

function _initEditGuides() {
  const work = document.getElementById('edit-work');
  if (!work || !editCanvas) return;
  if (editGuides) editGuides.destroy();
  editGuides = new CanvasGuides(work, editCanvas, { showRuler: true, showGrid: true, showCenter: false });
  editGuides.show();

  // Reposition on window resize
  if (!window._guidesResizeWired) {
    window._guidesResizeWired = true;
    window.addEventListener('resize', () => { if (editGuides) editGuides.update(); });
  }
}

// steppedResize is in shared-editor.js

function updateDimensionBadge() {
  const badge = document.getElementById('dimension-badge');
  if (!badge || !editCanvas.width) return;
  badge.style.display = 'block';
  badge.textContent = `${editCanvas.width} x ${editCanvas.height}`;
}

let pulseTimeout = null;
function pulseExportButton() {
  const btn = document.getElementById('btn-export');
  if (!btn) return;
  btn.classList.remove('export-pulse');
  clearTimeout(pulseTimeout);
  pulseTimeout = setTimeout(() => btn.classList.add('export-pulse'), 50);
}
function editUndo() { pipeline.undo(); updResize(); saveEdit(); }

// ============================================================
// Persistent Info Bar
// ============================================================

// barUnitPx, barLocked, originalW, originalH declared in shared-editor.js

function initInfoBar() {
  const barW = document.getElementById('bar-w');
  const barH = document.getElementById('bar-h');
  const barUnit = document.getElementById('bar-unit');
  const barLock = document.getElementById('bar-lock');
  const barApply = document.getElementById('bar-apply');

  // Toggle px / %
  barUnit?.addEventListener('click', () => {
    barUnitPx = !barUnitPx;
    barUnit.textContent = barUnitPx ? 'px' : '%';
    barUnit.classList.toggle('active', barUnitPx);
    updateInfoBar();
  });

  // Toggle lock
  barLock?.addEventListener('click', () => {
    barLocked = !barLocked;
    barLock.classList.toggle('locked', barLocked);
  });

  // W input changes H if locked
  barW?.addEventListener('input', () => {
    if (!barLocked || !originalW) return;
    const ratio = originalH / originalW;
    if (barUnitPx) {
      barH.value = Math.round(+barW.value * ratio);
    } else {
      barH.value = barW.value; // same percentage
    }
  });

  // H input changes W if locked
  barH?.addEventListener('input', () => {
    if (!barLocked || !originalH) return;
    const ratio = originalW / originalH;
    if (barUnitPx) {
      barW.value = Math.round(+barH.value * ratio);
    } else {
      barW.value = barH.value;
    }
  });

  // Apply resize on button click or Enter key
  function applyBarResize() {
    if (!editCanvas.width) return;
    let newW, newH;
    if (barUnitPx) {
      newW = +barW.value; newH = +barH.value;
    } else {
      newW = Math.round(originalW * +barW.value / 100);
      newH = Math.round(originalH * +barH.value / 100);
    }
    if (!newW || !newH || newW < 1 || newH < 1) return;
    if (newW === editCanvas.width && newH === editCanvas.height) return;

    // Non-destructive: pipeline resize renders from original at target size
    pipeline.setExportSize(newW, newH);
    updResize(); saveEdit();
  }

  barApply?.addEventListener('click', applyBarResize);
  barW?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyBarResize(); });
  barH?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyBarResize(); });

  // Fit / 1:1 buttons
  document.getElementById('bar-fit')?.addEventListener('click', () => {
    if (editCanvas) editCanvas.style.maxWidth = '90%';
  });
  document.getElementById('bar-actual')?.addEventListener('click', () => {
    if (editCanvas) editCanvas.style.maxWidth = 'none';
  });

  // "Original" — reset to original image dimensions (keeps other operations)
  document.getElementById('bar-original')?.addEventListener('click', () => {
    if (!editOriginal) return;
    const origW = editOriginal.naturalWidth || editOriginal.width;
    const origH = editOriginal.naturalHeight || editOriginal.height;
    pipeline.setExportSize(origW, origH);
    updResize(); saveEdit();
  });

  // Size presets
  document.getElementById('bar-size-preset')?.addEventListener('change', (e) => {
    if (!editOriginal || !e.target.value) return;
    const origW = editOriginal.naturalWidth || editOriginal.width;
    const origH = editOriginal.naturalHeight || editOriginal.height;
    let newW, newH;

    if (e.target.value === 'square') {
      const side = Math.min(origW, origH);
      newW = side; newH = side;
    } else if (e.target.value === 'half') {
      newW = Math.round(origW / 2); newH = Math.round(origH / 2);
    } else if (e.target.value === 'double') {
      newW = origW * 2; newH = origH * 2;
    } else {
      const parts = e.target.value.split(',');
      newW = +parts[0]; newH = +parts[1];
      // Maintain aspect ratio: fit within the preset dimensions
      if (barLocked) {
        const ratio = origW / origH;
        if (ratio > newW / newH) {
          newH = Math.round(newW / ratio);
        } else {
          newW = Math.round(newH * ratio);
        }
      }
    }

    if (newW && newH) {
      if (barUnitPx) {
        barW.value = newW; barH.value = newH;
      } else {
        barW.value = Math.round(newW / origW * 100);
        barH.value = Math.round(newH / origH * 100);
      }
      pipeline.setExportSize(newW, newH);
      updResize(); saveEdit();
    }
    e.target.value = ''; // reset to "Presets" label
  });

  // Set defaults
  if (barW) barW.value = 800;
  if (barH) barH.value = 600;
}

function updateInfoBar() {
  const bar = document.getElementById('edit-info-bar');
  if (!bar) return;

  // Track original dimensions (set once on first load)
  if (editCanvas.width && !originalW) { originalW = editCanvas.width; originalH = editCanvas.height; }

  const barW = document.getElementById('bar-w');
  const barH = document.getElementById('bar-h');

  if (barUnitPx) {
    barW.value = editCanvas.width;
    barH.value = editCanvas.height;
  } else {
    barW.value = originalW ? Math.round(editCanvas.width / originalW * 100) : 100;
    barH.value = originalH ? Math.round(editCanvas.height / originalH * 100) : 100;
  }

  // Estimate file size
  const pixels = editCanvas.width * editCanvas.height;
  const estPng = Math.round(pixels * 1.5 / 1024); // rough PNG estimate
  const sizeEl = document.getElementById('bar-size');
  if (sizeEl) sizeEl.textContent = `~${estPng > 1024 ? (estPng/1024).toFixed(1) + 'MB' : estPng + 'KB'} PNG`;

  // Zoom level
  const rect = editCanvas.getBoundingClientRect();
  const zoom = Math.round(rect.width / editCanvas.width * 100);
  const zoomEl = document.getElementById('bar-zoom');
  if (zoomEl) zoomEl.textContent = zoom + '%';
}
function editRedo() { pipeline.redo(); updResize(); saveEdit(); }

// editRotate and editFlip removed — now handled by pipeline.addOperation()

// applyAdj removed — now handled by pipeline.addOperation({type:'adjust'})

function editExport() {
  if (!editCanvas.width) return;
  // Flatten any drawn objects into the canvas before export
  if (window._pixerooObjLayer?.hasObjects()) window._pixerooObjLayer.flatten();
  const fmt = document.getElementById('export-format').value;

  // SVG trace export
  if (fmt === 'svg') {
    const svg = PixTrace.traceCanvas(editCanvas, 'default');
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}.svg`, saveAs: true });
    return;
  }

  const mime = {png:'image/png',jpeg:'image/jpeg',webp:'image/webp',bmp:'image/bmp'}[fmt] || 'image/png';
  const q = ['jpeg','webp'].includes(fmt) ? +(document.getElementById('export-quality')?.value || 85) / 100 : undefined;
  editCanvas.toBlob(blob => {
    chrome.runtime.sendMessage({ action:'download', url: URL.createObjectURL(blob), filename:`pixeroo/${editFilename}.${fmt==='jpeg'?'jpg':fmt}`, saveAs:true });
  }, mime, q);
}

// Show/hide quality slider based on format
document.getElementById('export-format')?.addEventListener('change', (e) => {
  const row = document.getElementById('export-quality-row');
  if (row) row.style.display = ['jpeg','webp'].includes(e.target.value) ? 'flex' : 'none';
});
document.getElementById('export-quality')?.addEventListener('input', (e) => {
  const v = document.getElementById('export-quality-val'); if (v) v.textContent = e.target.value;
});
