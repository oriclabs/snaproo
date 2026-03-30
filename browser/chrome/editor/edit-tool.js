// Pixeroo — Edit Tool

// Shared state for zoom (used by initInfoBar + initImageHandles)
let zoomLevel = 1;
let panX = 0, panY = 0;

// Resize/rotate hint badge (global — used by initImageHandles)
function showEditHint(text) {
  let badge = $('edit-hint-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.id = 'edit-hint-badge';
    badge.style.cssText = 'position:absolute;z-index:20;background:rgba(15,23,42,0.85);color:var(--saffron-400);font-weight:600;padding:4px 10px;border-radius:6px;pointer-events:none;white-space:nowrap;top:10px;left:50%;transform:translateX(-50%);';
    $('edit-work')?.appendChild(badge);
  }
  badge.textContent = text;
  badge.style.display = 'block';
}
function hideEditHint() {
  const badge = $('edit-hint-badge');
  if (badge) badge.style.display = 'none';
}

function initEdit() {
  editCanvas = $('editor-canvas');
  editCtx = editCanvas.getContext('2d', { willReadFrequently: true });

  setupDropzone($('edit-dropzone'), $('edit-file'), async (file) => {
    editFilename = file.name.replace(/\.[^.]+$/, '');
    $('file-label').textContent = file.name;
    const img = await loadImg(file);
    if (!img) return;
    editOriginal = img;
    // Non-destructive: load into pipeline, pipeline renders to display canvas
    pipeline.setDisplayCanvas(editCanvas);
    pipeline.loadImage(img);
    editCanvas.style.display = 'block'; $('edit-ribbon')?.classList.remove('disabled');
    $('edit-dropzone').style.display = 'none';
    removeSliceOverlay();
    updResize(); originalW = 0; originalH = 0; saveEdit();
    // Init guides overlay
    _initEditGuides();
    showImageHandles();
    if (window.fitToView) window.fitToView();
    if (window._addRecentFile) window._addRecentFile(img, editFilename);
  });

  // Drop-to-replace on work area
  setupWorkAreaReplace('#mode-edit .work-area', async (file) => {
    editFilename = file.name.replace(/\.[^.]+$/, '');
    $('file-label').textContent = file.name;
    const img = await loadImg(file);
    if (!img) return;
    editOriginal = img;
    pipeline.setDisplayCanvas(editCanvas);
    pipeline.loadImage(img);
    editCanvas.style.display = 'block';
    $('edit-ribbon')?.classList.remove('disabled');
    $('edit-dropzone').style.display = 'none';
    removeSliceOverlay();
    updResize(); originalW = 0; originalH = 0; saveEdit();
    resetAdjustmentSliders();
    _initEditGuides();
    showImageHandles();
    if (window.fitToView) window.fitToView();
  });

  // Reset All -- revert to original image
  $('btn-reset-all')?.addEventListener('click', async () => {
    if (!editOriginal) return;
    const ok = await pixDialog.confirm('Reset Image', 'Reset all edits and revert to original image?', { danger: true, okText: 'Reset' });
    if (!ok) return;
    // Non-destructive reset: pipeline replays from original
    pipeline.resetAll();
    updResize();
    saveEdit();
    resetAdjustmentSliders();
    if (window.fitToView) window.fitToView();
  });

  // Reset Adjustments -- remove adjust ops from pipeline, reset sliders
  $('btn-reset-adjust')?.addEventListener('click', () => {
    resetAdjustmentSliders();
    pipeline.operations = pipeline.operations.filter(op => op.type !== 'adjust' && op.type !== 'temperature' && op.type !== 'shadows' && op.type !== 'highlights' && op.type !== 'straighten');
    pipeline.render();
    saveEdit();
  });

  function resetAdjustmentSliders() {
    ['brightness', 'contrast', 'saturation'].forEach(a => {
      $(`adj-${a}`).value = 0;
      $(`val-${a}`).textContent = '0';
    });
    $('adj-hue').value = 0;
    $('val-hue').textContent = '0';
    ['temperature', 'shadows', 'highlights'].forEach(a => {
      const el = $(`adj-${a}`); if (el) { el.value = 0; }
      const lbl = $(`val-${a}`); if (lbl) { lbl.textContent = '0'; }
    });
    const stEl = $('straighten-angle'); if (stEl) stEl.value = 0;
    const stLbl = $('straighten-val'); if (stLbl) stLbl.textContent = '0';
  }

  document.addEventListener('paste', async (e) => {
    if (currentMode !== 'edit') return;
    // Object paste takes priority if there's a clipboard object AND the object layer is active
    if (objLayer._clipboard && objLayer.active) {
      e.preventDefault();
      objLayer.pasteFromClipboard();
      return;
    }
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        const img = await loadImg(file);
        if (!img) continue;

        if (editOriginal) {
          // Image already loaded — ask to replace
          const ok = await pixDialog.confirm('Paste Image', 'Replace current image with pasted image?', { okText: 'Replace' });
          if (!ok) return;
        }

        editOriginal = img;
        editFilename = 'pasted-image';
        $('file-label').textContent = 'Pasted Image';
        pipeline.setDisplayCanvas(editCanvas);
        pipeline.loadImage(img);
        editCanvas.style.display = 'block';
        $('edit-ribbon')?.classList.remove('disabled');
        $('edit-dropzone').style.display = 'none';
        removeSliceOverlay();
        updResize(); originalW = 0; originalH = 0; saveEdit();
        _initEditGuides();
        showImageHandles();
        return;
      }
    }

    // Also handle paste in Convert mode
    if (currentMode === 'convert') {
      for (const item of (e.clipboardData?.items || [])) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          convertFiles.push(file);
          $('convert-drop').style.display = 'none';
          $('convert-preview').style.display = 'block';
          $('convert-img').src = URL.createObjectURL(file);
          $('convert-batch-info').textContent = file.name || 'Pasted image';
          $('btn-convert-go').disabled = false;
          break;
        }
      }
    }
  });

  $('btn-undo').addEventListener('click', editUndo);
  $('btn-redo').addEventListener('click', editRedo);
  $('btn-history')?.addEventListener('click', function() { _showHistoryPanel(this); });

  // Resize
  const rw = $('resize-w'), rh = $('resize-h'), lr = $('lock-ratio');
  rw.addEventListener('input', () => { if (lr.checked && editCanvas.width) rh.value = Math.round(+rw.value * editCanvas.height / editCanvas.width) || ''; });
  rh.addEventListener('input', () => { if (lr.checked && editCanvas.height) rw.value = Math.round(+rh.value * editCanvas.width / editCanvas.height) || ''; });
  $('btn-apply-resize').addEventListener('click', () => {
    const w = +rw.value, h = +rh.value;
    if (!w || !h || (w === editCanvas.width && h === editCanvas.height)) return;
    pipeline.setExportSize(w, h);
    updResize(); saveEdit();
  });

  // Transform (non-destructive via pipeline)
  $('btn-rotate-left').addEventListener('click', () => {
    if (!editCanvas.width) return;
    pipeline.addOperation({ type: 'rotate', degrees: -90 });
    updResize(); saveEdit(); showImageHandles();
    if (window.fitToView) window.fitToView();
  });
  $('btn-rotate-right').addEventListener('click', () => {
    if (!editCanvas.width) return;
    pipeline.addOperation({ type: 'rotate', degrees: 90 });
    updResize(); saveEdit(); showImageHandles();
    if (window.fitToView) window.fitToView();
  });
  $('btn-flip-h').addEventListener('click', () => { pipeline.addOperation({type:'flip', direction:'h'}); saveEdit(); });
  $('btn-flip-v').addEventListener('click', () => { pipeline.addOperation({type:'flip', direction:'v'}); saveEdit(); });

  // Adjustments (non-destructive via pipeline)
  // Adjustments are live-preview: replace the last 'adjust' op on each slider move
  ['brightness','contrast','saturation','hue'].forEach(a => {
    const s = $(`adj-${a}`), l = $(`val-${a}`);
    s.addEventListener('input', () => {
      l.textContent = s.value;
      // Remove trailing adjust op if present (live update, not stacking)
      if (pipeline.operations.length && pipeline.operations[pipeline.operations.length - 1].type === 'adjust') {
        pipeline.operations.pop();
      }
      const b = +$('adj-brightness').value;
      const c = +$('adj-contrast').value;
      const sat = +$('adj-saturation').value;
      const h = +$('adj-hue').value;
      if (b || c || sat || h) {
        pipeline.operations.push({type:'adjust', brightness: b, contrast: c, saturation: sat, hue: h});
      }
      pipeline.undoneOps = [];
      pipeline.render();
    });
    s.addEventListener('change', saveEdit);
  });

  // Temperature / Shadows / Highlights — pixel-level adjustments (each gets its own pipeline op type)
  ['temperature', 'shadows', 'highlights'].forEach(a => {
    const s = $(`adj-${a}`), l = $(`val-${a}`);
    if (!s || !l) return;
    s.addEventListener('input', () => {
      l.textContent = s.value;
      // Remove trailing op of this type if present (live update)
      if (pipeline.operations.length && pipeline.operations[pipeline.operations.length - 1].type === a) {
        pipeline.operations.pop();
      }
      const v = +s.value;
      if (v) {
        pipeline.operations.push({type: a, value: v});
      }
      pipeline.undoneOps = [];
      pipeline.render();
    });
    s.addEventListener('change', saveEdit);
  });

  // Straighten slider (fine rotation -10 to 10 degrees)
  const straightenSlider = $('straighten-angle'), straightenVal = $('straighten-val');
  if (straightenSlider && straightenVal) {
    straightenSlider.addEventListener('input', () => {
      straightenVal.textContent = straightenSlider.value;
      // Remove trailing straighten op
      if (pipeline.operations.length && pipeline.operations[pipeline.operations.length - 1].type === 'straighten') {
        pipeline.operations.pop();
      }
      const v = +straightenSlider.value;
      if (v) {
        pipeline.operations.push({type: 'straighten', angle: v});
      }
      pipeline.undoneOps = [];
      pipeline.render();
    });
    straightenSlider.addEventListener('change', saveEdit);
  }

  // Filters (non-destructive via pipeline)
  $$('[data-filter]').forEach(b => b.addEventListener('click', () => {
    if (!editOriginal) return;
    pipeline.addOperation({type:'filter', name: b.dataset.filter});
    saveEdit();
  }));

  // Interactive Crop (non-destructive via pipeline)
  Crop.init(editCanvas, editCtx, (x, y, w, h) => {
    // Convert absolute px to relative coords (0-1) for pipeline
    const cw = editCanvas.width, ch = editCanvas.height;
    pipeline.addOperation({type:'crop', x: x/cw, y: y/ch, w: w/cw, h: h/ch});
    // Reset zoom to fit new cropped dimensions
    zoomLevel = 1; panX = 0; panY = 0;
    const wrap = $('edit-canvas-wrap');
    if (wrap) wrap.style.transform = '';
    updResize(); saveEdit();
    showImageHandles();
    if (window.fitToView) window.fitToView();
  });

  const cropRatios = { 'btn-crop-free': null, 'btn-crop-1-1': 1, 'btn-crop-4-3': 4/3, 'btn-crop-16-9': 16/9, 'btn-crop-3-2': 3/2 };
  Object.entries(cropRatios).forEach(([id, ratio]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!editCanvas.width) return;
      // Disable ribbon during crop
      $('edit-ribbon')?.classList.add('disabled');
      Crop._onCropEnd = () => {
        $('edit-ribbon')?.classList.remove('disabled');
      };
      Crop.start($('edit-canvas-wrap'), ratio);
    });
  });

  // Smart crop (auto-detect best region)
  $('btn-crop-auto')?.addEventListener('click', async () => {
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

  // Keyboard shortcuts for crop (Enter=apply, Escape=cancel)
  document.addEventListener('keydown', (e) => {
    if (!Crop.active) return;
    if (e.key === 'Escape') { e.preventDefault(); Crop.cancel(); if (Crop._onCropEnd) Crop._onCropEnd(); }
    if (e.key === 'Enter') { e.preventDefault(); Crop.apply(); }
  });

  // Object-based Drawing (replaces stamp-based Annotate)
  const objLayer = new ObjectLayer(editCanvas, saveEdit);

  // Sync ribbon UI when an object is selected
  objLayer.onSelect = (obj) => {
    // Color
    const colorEl = $('ann-color');
    if (colorEl && obj.color) colorEl.value = obj.color;
    // Highlight matching preset
    $$('.ann-preset-color').forEach(s => {
      s.style.outline = s.dataset.color === obj.color ? '2px solid var(--saffron-400)' : '';
      if (s.dataset.color === obj.color) s.style.outlineOffset = '1px';
    });
    // Line width
    const widthEl = $('ann-width');
    if (widthEl && obj.lineWidth) widthEl.value = obj.lineWidth;
    // Background/Fill
    const bgToggle = $('ann-bg-toggle');
    const bgColorEl = $('ann-bg-color');
    if (bgToggle) {
      bgToggle.checked = !!obj.bgColor;
      if (bgColorEl) {
        bgColorEl.style.display = obj.bgColor ? '' : 'none';
        if (obj.bgColor) bgColorEl.value = obj.bgColor;
      }
    }
    // Font (text/callout)
    if (obj.type === 'text' || obj.type === 'callout') {
      const fontEl = $('ann-font');
      if (fontEl && obj.fontFamily) fontEl.value = obj.fontFamily;
      const sizeEl = $('ann-fontsize');
      if (sizeEl && obj.fontSize) sizeEl.value = obj.fontSize;
      // Sync formatting buttons
      const boldEl = $('ann-bold');
      if (boldEl) boldEl.classList.toggle('active', obj.fontWeight === 'bold');
      const italicEl = $('ann-italic');
      if (italicEl) italicEl.classList.toggle('active', obj.fontStyle === 'italic');
      const underEl = $('ann-underline');
      if (underEl) underEl.classList.toggle('active', !!obj.underline);
    }
    // Callout shape/tail
    if (obj.type === 'callout') {
      const shapeEl = $('ann-callout-shape');
      if (shapeEl && obj.calloutShape) shapeEl.value = obj.calloutShape;
      const tailEl = $('ann-callout-tail');
      if (tailEl && obj.calloutTailDir) tailEl.value = obj.calloutTailDir;
    }
    // Opacity
    const opEl = $('ann-opacity');
    if (opEl) opEl.value = Math.round((obj.opacity || 1) * 100);
  };

  // Attach object layer when image loads (called from image load handlers)
  window._pixerooObjLayer = objLayer;

  const annTools = { 'btn-ann-rect': 'rect', 'btn-ann-arrow': 'arrow', 'btn-ann-text': 'text', 'btn-ann-pen': 'pen', 'btn-ann-highlighter': 'highlighter', 'btn-ann-redact': 'redact' };
  const allAnnBtns = ['btn-ann-select', ...Object.keys(annTools)];

  function setActiveAnnTool(activeId) {
    allAnnBtns.forEach(id => document.getElementById(id)?.classList.toggle('active', id === activeId));
  }

  // Pointer / Select tool — deactivates drawing, switches to select mode
  $('btn-ann-select')?.addEventListener('click', () => {
    if (objLayer.active) objLayer.stopTool();
    setActiveAnnTool('btn-ann-select');
  });

  Object.entries(annTools).forEach(([id, tool]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!editCanvas.width) return;
      if (!objLayer.active) objLayer.attach($('edit-canvas-wrap'));
      objLayer.startTool(tool);
      setActiveAnnTool(id);
    });
  });

  // Callout button in Draw ribbon
  $('btn-ann-callout')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    if (!objLayer.active) objLayer.attach($('edit-canvas-wrap'));
    const shape = $('ann-callout-shape')?.value || 'rounded';
    const tailDir = $('ann-callout-tail')?.value || 'bottom';
    const bgColor = $('ann-bg-toggle')?.checked ? $('ann-bg-color')?.value : '#1e293b';
    // Place callout at visible viewport center, not canvas center
    const workArea = editCanvas.closest('.work-area');
    let cx = editCanvas.width / 2 - 100, cy = editCanvas.height / 2 - 40;
    if (workArea) {
      const canvasRect = editCanvas.getBoundingClientRect();
      const areaRect = workArea.getBoundingClientRect();
      const sx = editCanvas.width / canvasRect.width;
      const sy = editCanvas.height / canvasRect.height;
      cx = Math.max(0, Math.min(editCanvas.width - 200, (areaRect.left + areaRect.width / 2 - canvasRect.left) * sx - 100));
      cy = Math.max(0, Math.min(editCanvas.height - 80, (areaRect.top + areaRect.height / 2 - canvasRect.top) * sy - 40));
    }
    objLayer.addCallout(cx, cy, 200, 80, {
      shape, tailDir, bgColor, textColor: '#ffffff', borderColor: '#F4C430'
    });
    setActiveAnnTool('btn-ann-select');
  });

  // Callout shape/tail changes update selected callout
  $('ann-callout-shape')?.addEventListener('change', (e) => {
    if (objLayer.selected?.type === 'callout') {
      objLayer.selected.calloutShape = e.target.value;
      objLayer.render();
    }
  });
  $('ann-callout-tail')?.addEventListener('change', (e) => {
    if (objLayer.selected?.type === 'callout') {
      objLayer.selected.calloutTailDir = e.target.value;
      objLayer.render();
    }
  });

  // Font/size changes update selected text/callout
  $('ann-font')?.addEventListener('change', (e) => {
    objLayer.fontFamily = e.target.value;
    if (objLayer.selected?.type === 'text' || objLayer.selected?.type === 'callout') {
      objLayer.selected.fontFamily = e.target.value;
      objLayer.render();
    }
  });
  $('ann-fontsize')?.addEventListener('input', (e) => {
    objLayer.fontSize = +e.target.value;
    if (objLayer.selected?.type === 'text' || objLayer.selected?.type === 'callout') {
      objLayer.selected.fontSize = +e.target.value;
      objLayer.render();
    }
  });

  // Escape key also switches back to pointer
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && objLayer.active && objLayer.creating) {
      objLayer.stopTool();
      setActiveAnnTool('btn-ann-select');
    }
    // Copy/Paste/Duplicate draw objects
    if (e.ctrlKey && e.key === 'c' && objLayer.selected) {
      e.preventDefault();
      objLayer.copySelected();
    }
    if (e.ctrlKey && e.key === 'v' && objLayer._clipboard && objLayer.active) {
      e.preventDefault();
      objLayer.pasteFromClipboard();
    }
    if (e.ctrlKey && e.key === 'd' && objLayer.selected) {
      e.preventDefault();
      objLayer.duplicateSelected();
    }
    if (e.ctrlKey && e.key === 'a' && objLayer.active && objLayer.objects.length) {
      e.preventDefault();
      objLayer.selectAll();
    }
  });

  $('ann-color')?.addEventListener('input', (e) => {
    objLayer.color = e.target.value;
    if (objLayer.selected) { objLayer.selected.color = e.target.value; objLayer.render(); }
    // Highlight active preset (or none if custom)
    $$('.ann-preset-color').forEach(s => s.style.outline = '');
  });

  // Preset color palette clicks
  $$('.ann-preset-color').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      $('ann-color').value = color;
      objLayer.color = color;
      if (objLayer.selected) { objLayer.selected.color = color; objLayer.render(); }
      // Highlight active preset
      $$('.ann-preset-color').forEach(s => s.style.outline = '');
      swatch.style.outline = '2px solid var(--saffron-400)';
      swatch.style.outlineOffset = '1px';
    });
  });
  $('ann-width')?.addEventListener('input', (e) => {
    objLayer.lineWidth = +e.target.value;
    if (objLayer.selected) { objLayer.selected.lineWidth = +e.target.value; objLayer.render(); }
  });
  // Opacity slider for draw objects
  $('ann-opacity')?.addEventListener('input', (e) => {
    const val = +e.target.value / 100;
    if (objLayer.selected) { objLayer.selected.opacity = val; objLayer.render(); }
  });
  // ann-fill removed — BG toggle handles fill now

  // Background color toggle
  const bgToggle = $('ann-bg-toggle');
  const bgColorPicker = $('ann-bg-color');
  bgToggle?.addEventListener('change', (e) => {
    bgColorPicker.style.display = e.target.checked ? '' : 'none';
    const bgColor = e.target.checked ? bgColorPicker.value : null;
    if (objLayer.selected) { objLayer.selected.bgColor = bgColor; objLayer.render(); }
  });
  bgColorPicker?.addEventListener('input', (e) => {
    if (objLayer.selected) { objLayer.selected.bgColor = e.target.value; objLayer.render(); }
  });
  $('ann-font')?.addEventListener('change', (e) => {
    objLayer.fontFamily = e.target.value;
    // Apply to currently selected text object
    if (objLayer.selected?.type === 'text') { objLayer.selected.fontFamily = e.target.value; objLayer.render(); }
  });
  $('ann-fontsize')?.addEventListener('change', (e) => {
    objLayer.fontSize = +e.target.value || 24;
    if (objLayer.selected?.type === 'text') { objLayer.selected.fontSize = +e.target.value || 24; objLayer.render(); }
  });

  // Text formatting buttons (Bold / Italic / Underline)
  $('ann-bold')?.addEventListener('click', () => {
    const el = $('ann-bold');
    el.classList.toggle('active');
    const bold = el.classList.contains('active') ? 'bold' : 'normal';
    if (objLayer.selected?.type === 'text' || objLayer.selected?.type === 'callout') {
      objLayer.selected.fontWeight = bold;
      objLayer.render();
    }
  });
  $('ann-italic')?.addEventListener('click', () => {
    const el = $('ann-italic');
    el.classList.toggle('active');
    const italic = el.classList.contains('active') ? 'italic' : 'normal';
    if (objLayer.selected?.type === 'text' || objLayer.selected?.type === 'callout') {
      objLayer.selected.fontStyle = italic;
      objLayer.render();
    }
  });
  $('ann-underline')?.addEventListener('click', () => {
    const el = $('ann-underline');
    el.classList.toggle('active');
    const underline = el.classList.contains('active');
    if (objLayer.selected?.type === 'text' || objLayer.selected?.type === 'callout') {
      objLayer.selected.underline = underline;
      objLayer.render();
    }
  });

  // Layer panel
  function updateLayerPanel() {
    const panel = $('obj-layer-panel');
    const list = $('obj-layer-list');
    if (!panel || !list || !objLayer) return;
    if (!objLayer.objects.length) { panel.style.display = 'none'; return; }
    if (panel.style.display === 'none' && !panel.dataset.userOpen) return;
    panel.style.display = '';
    list.innerHTML = '';
    [...objLayer.objects].reverse().forEach((obj) => {
      const item = document.createElement('div');
      item.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 8px;cursor:pointer;border-bottom:1px solid var(--slate-800);';
      if (obj.selected) item.style.background = 'rgba(244,196,48,0.1)';
      const icon = { rect:'\u25A1', text:'T', arrow:'\u2192', pen:'\u270E', highlighter:'\uD83D\uDD8D', redact:'\u25A6', callout:'\uD83D\uDCAC', image:'\uD83D\uDDBC' }[obj.type] || '?';
      const label = obj.type === 'text' || obj.type === 'callout' ? (obj.text || '').substring(0, 12) : obj.type;
      item.innerHTML = '<span style="color:var(--slate-500);">' + icon + '</span><span style="flex:1;color:var(--slate-300);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + label + '</span>';
      const vis = document.createElement('span');
      vis.textContent = obj.visible !== false ? '\uD83D\uDC41' : '\u2014';
      vis.style.cssText = 'cursor:pointer;opacity:0.5;';
      vis.addEventListener('click', (e) => {
        e.stopPropagation();
        obj.visible = obj.visible === false ? true : false;
        objLayer.render();
        updateLayerPanel();
      });
      item.appendChild(vis);
      const del = document.createElement('span');
      del.textContent = '\u2715';
      del.style.cssText = 'cursor:pointer;color:var(--slate-500);';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        objLayer.objects = objLayer.objects.filter(o => o !== obj);
        if (objLayer.selected === obj) objLayer.selected = null;
        objLayer.render();
        updateLayerPanel();
      });
      item.appendChild(del);
      item.addEventListener('click', () => {
        objLayer.select(obj);
        updateLayerPanel();
      });
      list.appendChild(item);
    });
  }
  $('btn-layers-toggle')?.addEventListener('click', () => {
    const panel = $('obj-layer-panel');
    if (!panel) return;
    if (panel.style.display === 'none') {
      panel.dataset.userOpen = '1';
      updateLayerPanel();
      panel.style.display = '';
    } else {
      panel.style.display = 'none';
      delete panel.dataset.userOpen;
    }
  });
  $('btn-close-layers')?.addEventListener('click', () => {
    const panel = $('obj-layer-panel');
    if (panel) { panel.style.display = 'none'; delete panel.dataset.userOpen; }
  });

  // Hook into objLayer render to update layer panel
  const origRender = objLayer.render.bind(objLayer);
  objLayer.render = function() {
    origRender();
    updateLayerPanel();
  };

  // Mask filter tool
  let _maskFilterName = 'blur';
  let _maskAmount = 4; // blur px or pixelate block size
  const _maskFilters = ['blur', 'pixelate', 'grayscale', 'invert', 'sepia'];
  const _maskAmountCfg = {
    blur:      { min: 1, max: 20, step: 1, def: 4,   label: 'Radius' },
    pixelate:  { min: 2, max: 32, step: 2, def: 8,   label: 'Block' },
    grayscale: { min: 5, max: 100, step: 5, def: 100, label: '%' },
    invert:    { min: 5, max: 100, step: 5, def: 100, label: '%' },
    sepia:     { min: 5, max: 100, step: 5, def: 100, label: '%' },
  };

  // Render mask filter preview onto crop overlay context
  function _renderMaskPreview(oCtx, rx, ry, rw, rh) {
    const iw = Math.round(rw), ih = Math.round(rh);
    if (iw < 2 || ih < 2) return;
    const ix = Math.round(rx), iy = Math.round(ry);
    // Grab from the editor canvas (current pipeline state)
    const srcCtx = editCanvas.getContext('2d');
    const region = srcCtx.getImageData(ix, iy, iw, ih);

    const rc = document.createElement('canvas'); rc.width = iw; rc.height = ih;
    const rctx = rc.getContext('2d');
    rctx.putImageData(region, 0, 0);

    const out = document.createElement('canvas'); out.width = iw; out.height = ih;
    const octx = out.getContext('2d');

    if (_maskFilterName === 'pixelate') {
      const bs = _maskAmount || 8;
      const sw = Math.max(1, Math.round(iw / bs)), sh = Math.max(1, Math.round(ih / bs));
      octx.imageSmoothingEnabled = false;
      octx.drawImage(rc, 0, 0, sw, sh);
      octx.drawImage(octx.canvas, 0, 0, sw, sh, 0, 0, iw, ih);
    } else if (_maskFilterName === 'blur') {
      octx.filter = `blur(${_maskAmount || 4}px)`;
      octx.drawImage(rc, 0, 0);
    } else {
      const pct = _maskAmount || 100;
      const f = { grayscale: `grayscale(${pct}%)`, invert: `invert(${pct}%)`, sepia: `sepia(${pct}%)` };
      octx.filter = f[_maskFilterName] || '';
      octx.drawImage(rc, 0, 0);
    }

    // Scale to overlay display size
    const scaleX = Crop._imgDispW || Crop.overlay.width / Crop.canvas.width;
    const scaleY = Crop._imgDispH || Crop.overlay.height / Crop.canvas.height;
    // The overlay canvas matches the image canvas pixel dimensions, so draw 1:1
    oCtx.drawImage(out, rx, ry);
  }

  $('btn-mask-filter')?.addEventListener('click', () => {
    if (!editCanvas.width) return;

    $('edit-ribbon')?.classList.add('disabled');
    Crop._onCropEnd = () => { $('edit-ribbon')?.classList.remove('disabled'); };

    const origOnApply = Crop.onApply;
    Crop.onApply = (x, y, w, h) => {
      const op = { type: 'maskFilter', filterName: _maskFilterName, x, y, w, h, amount: _maskAmount };
      pipeline.addOperation(op);
      updResize(); saveEdit();
      // Re-fit to preserve zoom level (don't reset CSS width/height)
      if (window.fitToView) window.fitToView();
      Crop.onApply = origOnApply;
    };

    // Set live preview callback
    Crop._maskPreview = _renderMaskPreview;

    // Build overlay toolbar: filter pills + amount slider
    Crop.setExtraContent((row) => {
      let sliderWrap = null;

      function selectFilter(name) {
        _maskFilterName = name;
        // Update pill highlights
        row.querySelectorAll('.mask-pill').forEach(b => {
          const active = b.dataset.value === name;
          b.style.background = active ? 'rgba(244,196,48,0.15)' : 'transparent';
          b.style.borderColor = active ? '#F4C430' : '#334155';
          b.style.color = active ? '#F4C430' : '#94a3b8';
        });
        // Update slider for selected filter
        const cfg = _maskAmountCfg[name];
        if (sliderWrap) {
          const sl = sliderWrap.querySelector('input');
          const lbl = sliderWrap.querySelector('.mask-amt-label');
          const valEl = sliderWrap.querySelector('.mask-amt-val');
          lbl.textContent = cfg.label;
          sl.min = cfg.min; sl.max = cfg.max; sl.step = cfg.step;
          _maskAmount = cfg.def; sl.value = cfg.def; valEl.textContent = cfg.def;
        }
        Crop.draw(); // refresh preview
      }

      // Filter pills
      _maskFilters.forEach(f => {
        const pill = document.createElement('button');
        pill.className = 'mask-pill';
        pill.textContent = f.charAt(0).toUpperCase() + f.slice(1);
        pill.dataset.value = f;
        const active = f === _maskFilterName;
        pill.style.cssText = 'border:1.5px solid ' + (active ? '#F4C430' : '#334155') + ';border-radius:5px;padding:3px 10px;cursor:pointer;font-size:0.75rem;font-weight:600;transition:all 0.12s;background:' + (active ? 'rgba(244,196,48,0.15)' : 'transparent') + ';color:' + (active ? '#F4C430' : '#94a3b8') + ';';
        pill.addEventListener('click', () => selectFilter(f));
        row.appendChild(pill);
      });

      // Amount slider (all filters have one)
      sliderWrap = document.createElement('div');
      sliderWrap.style.cssText = 'display:flex;align-items:center;gap:5px;margin-left:6px;border-left:1px solid #334155;padding-left:8px;';
      const cfg = _maskAmountCfg[_maskFilterName];
      const lbl = document.createElement('span');
      lbl.className = 'mask-amt-label';
      lbl.style.cssText = 'color:#94a3b8;font-size:0.7rem;font-weight:600;white-space:nowrap;';
      lbl.textContent = cfg.label;
      const sl = document.createElement('input');
      sl.type = 'range';
      sl.style.cssText = 'width:70px;height:14px;accent-color:#F4C430;cursor:pointer;';
      sl.min = cfg.min; sl.max = cfg.max; sl.step = cfg.step;
      _maskAmount = cfg.def; sl.value = _maskAmount;
      const val = document.createElement('span');
      val.className = 'mask-amt-val';
      val.style.cssText = 'color:#F4C430;font-size:0.7rem;min-width:16px;text-align:right;font-variant-numeric:tabular-nums;';
      val.textContent = _maskAmount;
      sl.addEventListener('input', () => { _maskAmount = +sl.value; val.textContent = sl.value; Crop.draw(); });
      sliderWrap.append(lbl, sl, val);
      row.appendChild(sliderWrap);
    });
    Crop._btnApply.textContent = 'Apply';
    Crop.start($('edit-canvas-wrap'), null);
  });

  // Guides toggle buttons
  $('btn-toggle-ruler')?.addEventListener('click', (e) => {
    if (!editGuides) return;
    editGuides.showRuler = !editGuides.showRuler;
    e.currentTarget.classList.toggle('active', editGuides.showRuler);
    editGuides.render();
  });
  $('btn-toggle-grid')?.addEventListener('click', (e) => {
    if (!editGuides) return;
    editGuides.showGrid = !editGuides.showGrid;
    e.currentTarget.classList.toggle('active', editGuides.showGrid);
    editGuides.render();
  });
  $('btn-toggle-center')?.addEventListener('click', (e) => {
    if (!editGuides) return;
    editGuides.showCenter = !editGuides.showCenter;
    e.currentTarget.classList.toggle('active', editGuides.showCenter);
    editGuides.render();
  });

  // Watermark
  $('watermark-opacity')?.addEventListener('input', (e) => {
    $('watermark-opacity-val').textContent = e.target.value;
  });
  // Watermark sliders
  $('watermark-opacity')?.addEventListener('input', (e) => {
    const v = $('watermark-opacity-val2'); if (v) v.textContent = e.target.value;
  });
  $('watermark-fontsize')?.addEventListener('input', (e) => {
    const v = $('watermark-fontsize-val'); if (v) v.textContent = e.target.value;
  });
  $('watermark-angle')?.addEventListener('input', (e) => {
    const v = $('watermark-angle-val'); if (v) v.textContent = e.target.value;
  });

  $('btn-watermark')?.addEventListener('click', () => {
    const text = $('watermark-text').value;
    if (!text || !editCanvas.width) return;
    pipeline.addOperation({type:'watermark', text, options: {
      opacity: +($('watermark-opacity')?.value || 30) / 100,
      fontSize: +($('watermark-fontsize')?.value || 48),
      angle: +($('watermark-angle')?.value || -30),
      color: $('watermark-color')?.value || '#ffffff',
    }});
    saveEdit();
  });

  // Effects (non-destructive via pipeline)
  $('btn-vignette')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'vignette'}); saveEdit(); });
  $('btn-denoise')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'denoise'}); saveEdit(); });
  $('btn-round-corners')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'roundCorners'}); saveEdit(); });
  $('btn-grain')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'grain', amount: 25}); saveEdit(); });
  $('btn-auto-enhance')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'autoEnhance'}); saveEdit(); });
  $('btn-border')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const bw = +$('border-width').value || 10;
    pipeline.addOperation({type:'border', width: bw, color: $('border-color').value});
    updResize(); saveEdit();
  });
  $('btn-tile')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'tile', cols:2, rows:2}); updResize(); saveEdit(); });
  $('btn-tile3')?.addEventListener('click', () => { if (!editCanvas.width) return; pipeline.addOperation({type:'tile', cols:3, rows:3}); updResize(); saveEdit(); });

  // Color blindness simulation (non-destructive via pipeline)
  $$('[data-cb]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editOriginal) return;
      pipeline.addOperation({type:'colorBlindness', mode: btn.dataset.cb});
      saveEdit();
    });
  });

  // CMYK simulation (non-destructive via pipeline)
  $('btn-cmyk-sim')?.addEventListener('click', () => {
    if (!editOriginal) return;
    pipeline.addOperation({type:'cmyk'});
    saveEdit();
  });

  // Histogram
  function updateHistogram() {
    if (!editCanvas.width) return;
    try {
      const hist = computeHistogram(editCanvas);
      drawHistogram($('histogram-canvas'), hist);
    } catch {}
  }

  // --- Sprite Slicer with Visual Preview ---
  let sliceOverlay = null;
  let sliceActive = false;
  let sliceLines = { vertical: [], horizontal: [] };
  let sliceDragging = null;

  function showSlicePreview() {
    if (!editCanvas.width) return;

    sliceActive = !sliceActive;
    $('btn-slice-preview')?.classList.toggle('active', sliceActive);

    if (!sliceActive) {
      removeSliceOverlay();
      return;
    }

    updateSliceLines();
    renderSliceOverlay();
  }

  function updateSliceLines() {
    const isCustom = $('slice-custom')?.checked;
    const cw = editCanvas.width;
    const ch = editCanvas.height;

    if (isCustom) {
      const wStr = $('slice-custom-w')?.value || '';
      const hStr = $('slice-custom-h')?.value || '';
      sliceLines.vertical = parseCustomPositions(wStr, cw);
      sliceLines.horizontal = parseCustomPositions(hStr, ch);
    } else {
      const cols = +$('sprite-cols')?.value || 4;
      const rows = +$('sprite-rows')?.value || 4;
      sliceLines.vertical = [];
      sliceLines.horizontal = [];
      for (let i = 1; i < cols; i++) sliceLines.vertical.push(Math.round(cw * i / cols));
      for (let i = 1; i < rows; i++) sliceLines.horizontal.push(Math.round(ch * i / rows));
    }
  }

  function parseCustomPositions(str, totalSize) {
    if (!str.trim()) return [];
    const sizes = str.split(',').map(s => +s.trim()).filter(n => n > 0);
    const positions = [];
    let pos = 0;
    for (const size of sizes) {
      pos += size;
      if (pos < totalSize) positions.push(Math.round(pos));
    }
    return positions;
  }

  function renderSliceOverlay() {
    if (!sliceActive || !editCanvas.width) return;

    if (!sliceOverlay) {
      sliceOverlay = document.createElement('canvas');
      sliceOverlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:auto;cursor:default;z-index:4;';
      $('edit-canvas-wrap')?.appendChild(sliceOverlay);

      sliceOverlay.addEventListener('mousedown', onSliceMouseDown);
      window.addEventListener('mousemove', onSliceMouseMove);
      window.addEventListener('mouseup', onSliceMouseUp);
    }

    const baseRect = editCanvas.getBoundingClientRect();
    sliceOverlay.width = editCanvas.width;
    sliceOverlay.height = editCanvas.height;
    sliceOverlay.style.width = baseRect.width + 'px';
    sliceOverlay.style.height = baseRect.height + 'px';

    const ctx = sliceOverlay.getContext('2d');
    ctx.clearRect(0, 0, sliceOverlay.width, sliceOverlay.height);

    // Draw vertical lines
    ctx.setLineDash([6, 4]);
    ctx.lineWidth = 1.5;
    sliceLines.vertical.forEach((x) => {
      ctx.strokeStyle = '#F4C430';
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, editCanvas.height);
      ctx.stroke();
      // Diamond drag handle
      ctx.fillStyle = '#F4C430';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(x, 8); ctx.lineTo(x + 6, 14); ctx.lineTo(x, 20); ctx.lineTo(x - 6, 14);
      ctx.fill();
      ctx.setLineDash([6, 4]);
      // Label
      ctx.fillStyle = 'rgba(244,196,48,0.8)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(x + 'px', x, editCanvas.height - 5);
    });

    // Draw horizontal lines
    sliceLines.horizontal.forEach((y) => {
      ctx.strokeStyle = '#3b82f6';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(editCanvas.width, y);
      ctx.stroke();
      // Diamond drag handle
      ctx.fillStyle = '#3b82f6';
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(8, y); ctx.lineTo(14, y + 6); ctx.lineTo(20, y); ctx.lineTo(14, y - 6);
      ctx.fill();
      ctx.setLineDash([6, 4]);
      // Label
      ctx.fillStyle = 'rgba(59,130,246,0.8)';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(y + 'px', editCanvas.width - 40, y - 4);
    });

    ctx.setLineDash([]);

    // Tile count badge
    const tileCount = (sliceLines.vertical.length + 1) * (sliceLines.horizontal.length + 1);
    ctx.fillStyle = 'rgba(15,23,42,0.7)';
    ctx.fillRect(2, 2, 70, 18);
    ctx.fillStyle = '#F4C430';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`${tileCount} tiles`, 6, 14);
  }

  function toSliceCoords(e) {
    const rect = sliceOverlay.getBoundingClientRect();
    const sx = editCanvas.width / rect.width;
    const sy = editCanvas.height / rect.height;
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }

  function onSliceMouseDown(e) {
    const { x, y } = toSliceCoords(e);
    const threshold = 8;

    for (let i = 0; i < sliceLines.vertical.length; i++) {
      if (Math.abs(x - sliceLines.vertical[i]) < threshold) {
        sliceDragging = { type: 'v', index: i, startPos: sliceLines.vertical[i] };
        sliceOverlay.style.cursor = 'col-resize';
        return;
      }
    }

    for (let i = 0; i < sliceLines.horizontal.length; i++) {
      if (Math.abs(y - sliceLines.horizontal[i]) < threshold) {
        sliceDragging = { type: 'h', index: i, startPos: sliceLines.horizontal[i] };
        sliceOverlay.style.cursor = 'row-resize';
        return;
      }
    }
  }

  function onSliceMouseMove(e) {
    if (!sliceOverlay || !sliceActive) return;

    if (sliceDragging) {
      const { x, y } = toSliceCoords(e);
      if (sliceDragging.type === 'v') {
        sliceLines.vertical[sliceDragging.index] = Math.max(10, Math.min(editCanvas.width - 10, Math.round(x)));
      } else {
        sliceLines.horizontal[sliceDragging.index] = Math.max(10, Math.min(editCanvas.height - 10, Math.round(y)));
      }
      sliceLines.vertical.sort((a, b) => a - b);
      sliceLines.horizontal.sort((a, b) => a - b);
      syncSliceInputs();
      renderSliceOverlay();
      // Auto-switch to custom mode when user drags
      $('slice-custom').checked = true;
      $('slice-custom-row').style.display = '';
      $('slice-custom-row-h').style.display = '';
      return;
    }

    // Update cursor when hovering near lines
    const { x, y } = toSliceCoords(e);
    let cursor = 'default';
    for (const vx of sliceLines.vertical) {
      if (Math.abs(x - vx) < 8) { cursor = 'col-resize'; break; }
    }
    if (cursor === 'default') {
      for (const hy of sliceLines.horizontal) {
        if (Math.abs(y - hy) < 8) { cursor = 'row-resize'; break; }
      }
    }
    sliceOverlay.style.cursor = cursor;
  }

  function onSliceMouseUp() {
    sliceDragging = null;
    if (sliceOverlay) sliceOverlay.style.cursor = 'default';
  }

  function syncSliceInputs() {
    const cw = editCanvas.width;
    const ch = editCanvas.height;

    const vPositions = [0, ...sliceLines.vertical, cw];
    const widths = [];
    for (let i = 1; i < vPositions.length; i++) widths.push(vPositions[i] - vPositions[i - 1]);
    $('slice-custom-w').value = widths.join(',');

    const hPositions = [0, ...sliceLines.horizontal, ch];
    const heights = [];
    for (let i = 1; i < hPositions.length; i++) heights.push(hPositions[i] - hPositions[i - 1]);
    $('slice-custom-h').value = heights.join(',');
  }

  function removeSliceOverlay() {
    if (sliceOverlay) {
      sliceOverlay.remove();
      window.removeEventListener('mousemove', onSliceMouseMove);
      window.removeEventListener('mouseup', onSliceMouseUp);
      sliceOverlay = null;
    }
    sliceActive = false;
    $('btn-slice-preview')?.classList.remove('active');
  }

  function sliceAtPositions(canvas, verticalLines, horizontalLines) {
    const vPos = [0, ...verticalLines.sort((a, b) => a - b), canvas.width];
    const hPos = [0, ...horizontalLines.sort((a, b) => a - b), canvas.height];
    const tiles = [];

    for (let row = 0; row < hPos.length - 1; row++) {
      for (let col = 0; col < vPos.length - 1; col++) {
        const x = vPos[col];
        const y = hPos[row];
        const w = vPos[col + 1] - x;
        const h = hPos[row + 1] - y;
        if (w <= 0 || h <= 0) continue;

        const tile = document.createElement('canvas');
        tile.width = w;
        tile.height = h;
        tile.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
        tiles.push({ canvas: tile, row, col });
      }
    }
    return tiles;
  }

  // Slice preview toggle
  $('btn-slice-preview')?.addEventListener('click', showSlicePreview);

  // Custom toggle shows/hides custom inputs
  $('slice-custom')?.addEventListener('change', (e) => {
    $('slice-custom-row').style.display = e.target.checked ? '' : 'none';
    $('slice-custom-row-h').style.display = e.target.checked ? '' : 'none';
    if (sliceActive) { updateSliceLines(); renderSliceOverlay(); }
  });

  // Cols/rows inputs update preview
  ['sprite-cols', 'sprite-rows'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (sliceActive && !$('slice-custom')?.checked) {
        updateSliceLines();
        renderSliceOverlay();
      }
    });
  });

  // Custom width/height inputs update preview
  ['slice-custom-w', 'slice-custom-h'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      if (sliceActive) { updateSliceLines(); renderSliceOverlay(); }
    });
  });

  // Slice download
  $('btn-slice-sprite')?.addEventListener('click', async () => {
    if (!editCanvas.width) return;

    removeSliceOverlay();

    const isCustom = $('slice-custom')?.checked;
    let tiles;

    if (isCustom && (sliceLines.vertical.length || sliceLines.horizontal.length)) {
      tiles = sliceAtPositions(editCanvas, sliceLines.vertical, sliceLines.horizontal);
    } else {
      const cols = +$('sprite-cols').value || 4;
      const rows = +$('sprite-rows').value || 4;
      tiles = sliceSpriteSheet(editCanvas, cols, rows);
    }

    if (!tiles.length) return;
    const zip = new ZipWriter();
    for (let i = 0; i < tiles.length; i++) {
      const blob = await new Promise(r => tiles[i].canvas.toBlob(r, 'image/png'));
      await zip.addBlob(`slice-${tiles[i].row}-${tiles[i].col}.png`, blob);
    }
    const zipBlob = await zip.toBlob();
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pixeroo-slices.zip'; a.click();
    URL.revokeObjectURL(url);
  });

  // Steganography
  $('btn-steg-detect')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const result = detectSteganography(editCanvas);
    pixDialog.alert('Steganography Analysis', `<div><b>Assessment:</b> ${esc(result.assessment)}</div><div><b>LSB Ratio:</b> ${result.lsbRatio}</div>`);
  });
  $('btn-steg-visualize')?.addEventListener('click', () => {
    if (!editOriginal) return;
    pipeline.addOperation({type:'lsbVisualize'});
    saveEdit();
  });

  // Reverse image search
  $$('[data-rsearch]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editCanvas.width) return;
      openReverseImageSearch(editCanvas.toDataURL('image/png'), btn.dataset.rsearch);
    });
  });

  // Canvas: Padding
  $('btn-padding')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const p = +$('pad-size')?.value || 20;
    const color = $('pad-color')?.value || '#ffffff';
    pipeline.addOperation({type:'padding', top: p, right: p, bottom: p, left: p, color});
    updResize(); saveEdit();
  });

  // Canvas: Split
  $('btn-split-h2')?.addEventListener('click', () => splitAndDownload('horizontal', 2));
  $('btn-split-v2')?.addEventListener('click', () => splitAndDownload('vertical', 2));
  $('btn-split-h3')?.addEventListener('click', () => splitAndDownload('horizontal', 3));
  $('btn-split-v3')?.addEventListener('click', () => splitAndDownload('vertical', 3));

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
  $('btn-color-replace')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const from = $('color-from').value;
    const to = $('color-to').value;
    const fr = parseInt(from.slice(1,3),16), fg = parseInt(from.slice(3,5),16), fb = parseInt(from.slice(5,7),16);
    const tr = parseInt(to.slice(1,3),16), tg = parseInt(to.slice(3,5),16), tb = parseInt(to.slice(5,7),16);
    replaceColor(editCanvas, fr, fg, fb, tr, tg, tb, 30);
    saveEdit();
  });

  // Channel separation (non-destructive via pipeline)
  $$('[data-channel]').forEach(btn => {
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
  $('btn-apply-levels')?.addEventListener('click', () => {
    if (!editOriginal) return;
    pipeline.addOperation({type:'levels', black: +$('level-black').value, white: +$('level-white').value, gamma: +$('level-gamma').value / 100});
    saveEdit();
  });

  // Pixelate art
  $('btn-pixelate')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    pipeline.addOperation({type:'pixelate', blockSize: +$('pixelate-size').value || 8});
    saveEdit();
  });

  // Favicon preview
  $('btn-gen-favicons')?.addEventListener('click', () => {
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
  $('btn-ascii')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const cols = +$('ascii-cols').value || 80;
    const art = imageToAscii(editCanvas, cols);
    navigator.clipboard.writeText(art).catch(() => {});
    pixDialog.alert('ASCII Art (copied to clipboard)', `<pre style="font-family:monospace;font-size:5px;line-height:6px;overflow:auto;max-height:400px;background:var(--slate-800);padding:8px;border-radius:6px;color:var(--slate-200);white-space:pre;">${esc(art)}</pre>`);
  });

  // Generators
  // Generators with full options
  function showGenerated(canvas, name) {
    editCanvas.width = canvas.width; editCanvas.height = canvas.height;
    editCtx.drawImage(canvas, 0, 0);
    editCanvas.style.display = 'block'; $('edit-ribbon')?.classList.remove('disabled');
    $('edit-dropzone').style.display = 'none';
    editFilename = name; updResize(); saveEdit();
  }

  $('btn-gen-gradient')?.addEventListener('click', () => {
    const w = +($('gen-w')?.value || $('bar-w')?.value) || 800;
    const h = +($('gen-h')?.value || $('bar-h')?.value) || 600;
    const type = $('gen-grad-type').value;
    const c1 = $('gen-grad-c1').value;
    const c2 = $('gen-grad-c2').value;
    showGenerated(generateGradient(w, h, type, [{ pos: 0, color: c1 }, { pos: 1, color: c2 }]), 'gradient');
  });

  $('btn-gen-pattern')?.addEventListener('click', () => {
    const w = +($('gen-w')?.value || $('bar-w')?.value) || 800;
    const h = +($('gen-h')?.value || $('bar-h')?.value) || 600;
    const type = $('gen-pat-type').value;
    const c1 = $('gen-pat-c1').value;
    const c2 = $('gen-pat-c2').value;
    const cell = +$('gen-pat-cell').value || 40;
    showGenerated(generatePattern(w, h, type, c1, c2, cell), 'pattern');
  });

  $('btn-gen-placeholder')?.addEventListener('click', () => {
    const w = +($('gen-w')?.value || $('bar-w')?.value) || 800;
    const h = +($('gen-h')?.value || $('bar-h')?.value) || 600;
    const bg = $('gen-ph-bg').value;
    const tc = $('gen-ph-text-color').value;
    const text = $('gen-ph-text').value || '';
    showGenerated(generatePlaceholder(w, h, bg, tc, text), 'placeholder');
  });

  // Strip metadata
  $('btn-strip-meta')?.addEventListener('click', async () => {
    if (!editCanvas.width) return;
    const blob = await stripMetadata(editCanvas, 'png');
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}-clean.png`, saveAs: true });
  });

  // Image to PDF
  $('btn-to-pdf')?.addEventListener('click', async () => {
    if (!editCanvas.width) return;
    const blob = await imageToPdf([editCanvas], 'pixeroo-export');
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}.pdf`, saveAs: true });
  });

  // Export
  $('btn-export').addEventListener('click', editExport);

  // Export preset — resize to target size and export
  $('export-preset')?.addEventListener('change', () => {
    const val = $('export-preset').value;
    if (!val || !editCanvas.width) { $('export-preset').value = ''; return; }
    const parts = val.split(',');
    const tw = +parts[0], th = +parts[1], name = parts[2] || 'preset';
    // Render current pipeline to a temp canvas at target size
    const src = editCanvas;
    const out = document.createElement('canvas');
    out.width = tw; out.height = th;
    const octx = out.getContext('2d');
    // Cover-fit: fill target, crop overflow
    const sa = src.width / src.height, ta = tw / th;
    let sw, sh, sx, sy;
    if (sa > ta) { sh = src.height; sw = sh * ta; sx = (src.width - sw) / 2; sy = 0; }
    else { sw = src.width; sh = sw / ta; sx = 0; sy = (src.height - sh) / 2; }
    octx.drawImage(src, sx, sy, sw, sh, 0, 0, tw, th);
    // Flatten annotations if present
    if (window._pixerooObjLayer?.hasObjects()) {
      window._pixerooObjLayer.renderTo(octx, tw / src.width, th / src.height);
    }
    const fmt = $('export-format').value || 'png';
    const quality = +($('export-quality')?.value || 85) / 100;
    const mime = { png:'image/png', jpeg:'image/jpeg', webp:'image/webp' }[fmt] || 'image/png';
    out.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}-${name}.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, quality);
    $('export-preset').value = '';
  });

  // Export annotations as SVG overlay
  $('btn-export-annotations-svg')?.addEventListener('click', () => {
    if (!window._pixerooObjLayer?.hasObjects()) return;
    const svg = window._pixerooObjLayer.exportAsSVG(editCanvas.width, editCanvas.height);
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}-annotations.svg`, saveAs: true });
  });

  // --- Save/Load Edit Project ---
  $('btn-edit-save')?.addEventListener('click', () => {
    if (!editOriginal) return;
    const footer = $('footer-status');
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

  const editLoadBtn = $('btn-edit-load');
  const editLoadInput = $('edit-load-file');
  editLoadBtn?.addEventListener('click', () => editLoadInput?.click());
  editLoadInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    editLoadInput.value = '';
    const footer = $('footer-status');
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
      $('file-label').textContent = editFilename;

      // Restore pipeline
      pipeline.setDisplayCanvas(editCanvas);
      pipeline.loadImage(img);
      if (project.exportWidth) pipeline.exportWidth = project.exportWidth;
      if (project.exportHeight) pipeline.exportHeight = project.exportHeight;
      pipeline.operations = project.operations || [];
      pipeline.undoneOps = [];
      pipeline.render();

      editCanvas.style.display = 'block';
      $('edit-ribbon')?.classList.remove('disabled');
      $('edit-dropzone').style.display = 'none';
      updResize(); originalW = 0; originalH = 0; saveEdit();
      _initEditGuides();
      showImageHandles();

      if (footer) footer.textContent = `Project loaded: ${pipeline.operations.length} operations`;
    } catch (err) {
      console.error('Load project failed:', err);
      if (footer) footer.textContent = 'Failed to load project file';
    }
  });

  // --- Right-click context menu for Edit mode ---
  $('edit-work')?.addEventListener('contextmenu', (e) => {
    if (!editCanvas.width) return;
    e.preventDefault();
    $$('.ctx-menu').forEach(m => m.remove());

    const hasImage = !!editOriginal;
    const hasOps = pipeline.operations.length > 0;
    const hasUndone = pipeline.undoneOps.length > 0;
    const hasObjects = window._pixerooObjLayer?.hasObjects();
    const selObj = window._pixerooObjLayer?.selected;

    const items = [
      { label: 'Undo', shortcut: 'Ctrl+Z', enabled: hasOps, action: editUndo },
      { label: 'Redo', shortcut: 'Ctrl+Y', enabled: hasUndone, action: editRedo },
      { sep: true },
      { label: 'Reset All', enabled: hasOps, action: () => $('btn-reset-all')?.click() },
      { label: 'Reset Adjustments', enabled: hasOps, action: () => $('btn-reset-adjust')?.click() },
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
      { label: 'Export as SVG', enabled: hasObjects, action: () => $('btn-export-annotations-svg')?.click() },
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

  // --- Before/After toggle (hold Space) ---
  let showingOriginal = false;

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && currentMode === 'edit' && editOriginal && !e.target.matches('input,textarea,select,[contenteditable]')) {
      e.preventDefault();
      if (!showingOriginal) {
        showingOriginal = true;
        // Save current canvas, show original
        editCanvas._savedData = editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = editOriginal.naturalWidth || editOriginal.width;
        tempCanvas.height = editOriginal.naturalHeight || editOriginal.height;
        tempCanvas.getContext('2d').drawImage(editOriginal, 0, 0);
        editCanvas.width = tempCanvas.width;
        editCanvas.height = tempCanvas.height;
        editCtx.drawImage(tempCanvas, 0, 0);
        // Show "Original" badge
        const badge = $('dimension-badge');
        if (badge) { badge.textContent = 'ORIGINAL'; badge.style.display = 'block'; }
      }
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && showingOriginal) {
      showingOriginal = false;
      // Restore edited version
      if (editCanvas._savedData) {
        editCanvas.width = editCanvas._savedData.width;
        editCanvas.height = editCanvas._savedData.height;
        editCtx.putImageData(editCanvas._savedData, 0, 0);
        editCanvas._savedData = null;
      } else {
        pipeline.render();
      }
      $('dimension-badge').style.display = 'none';
    }
  });

  // --- Canvas background color (for transparent PNGs) ---
  // Default checkerboard for transparency
  const canvasWrap = $('edit-canvas-wrap');
  if (canvasWrap) canvasWrap.style.background = 'repeating-conic-gradient(#808080 0% 25%, #a0a0a0 0% 50%) 50% / 16px 16px';
  $('canvas-bg-color')?.addEventListener('input', (e) => {
    $('edit-canvas-wrap').style.backgroundColor = e.target.value;
    $('edit-canvas-wrap').style.backgroundImage = 'none';
  });

  // --- Persistent Info Bar ---
  initInfoBar();
  initImageHandles();
  initLibraryImport();
}

function updResize() {
  $('resize-w').value = editCanvas.width;
  $('resize-h').value = editCanvas.height;
  // Sync canvas size inputs
}
function saveEdit() {
  // Pipeline handles state -- just update UI indicators
  try { const h = computeHistogram(editCanvas); drawHistogram($('histogram-canvas'), h); } catch {}
  updateDimensionBadge();
  updateInfoBar();
  pulseExportButton();
  if (editGuides) editGuides.update();
  _updateHistoryBadge();
  showImageHandles();

  // Show last operation in footer with undo hint
  const footer = $('footer-status');
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
  const badge = $('history-count');
  if (!badge) return;
  const n = pipeline.operations.length;
  if (n > 0) { badge.style.display = ''; badge.textContent = n; }
  else { badge.style.display = 'none'; }
}

function _showHistoryPanel(anchorBtn) {
  // Close existing
  $$('.history-panel').forEach(p => p.remove());

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
  const wrap = $('edit-canvas-wrap');
  if (!wrap || !editCanvas) return;
  if (editGuides) editGuides.destroy();
  editGuides = new CanvasGuides(wrap, editCanvas, { showRuler: true, showGrid: true, showCenter: false });
  editGuides.show();

  // Reposition on window resize
  if (!window._guidesResizeWired) {
    window._guidesResizeWired = true;
    window.addEventListener('resize', () => { if (editGuides) editGuides.update(); });
  }
}

// steppedResize is in shared-editor.js

// ============================================================
// Image Resize Handles (visual drag-to-resize on canvas)
// ============================================================

function initImageHandles() {
  const container = $('img-resize-handles');
  if (!container) return;

  const HS = 10; // handle size
  const cursors = { tl:'nwse-resize', tr:'nesw-resize', bl:'nesw-resize', br:'nwse-resize', tm:'ns-resize', bm:'ns-resize', ml:'ew-resize', mr:'ew-resize' };
  const handleNames = ['tl','tr','bl','br','tm','bm','ml','mr'];
  const handleEls = {};

  // Create resize handle elements
  handleNames.forEach(name => {
    const h = document.createElement('div');
    h.dataset.handle = name;
    h.style.cssText = `position:absolute;width:${HS}px;height:${HS}px;background:var(--saffron-400);border:1px solid var(--saffron-950);cursor:${cursors[name]};pointer-events:auto;z-index:10;border-radius:2px;`;
    container.appendChild(h);
    handleEls[name] = h;
  });


  let dragHandle = null, startX, startY, startW, startH;

  // Position handles based on canvas rect
  function positionHandles() {
    if (!editCanvas.width) return;
    const canvasRect = editCanvas.getBoundingClientRect();
    const workRect = $('edit-work').getBoundingClientRect();
    const ox = canvasRect.left - workRect.left;
    const oy = canvasRect.top - workRect.top;
    const cw = canvasRect.width;
    const ch = canvasRect.height;
    const hh = HS / 2;

    container.style.position = 'absolute';
    container.style.inset = '0';
    container.style.pointerEvents = 'none';

    handleEls.tl.style.left = (ox - hh) + 'px'; handleEls.tl.style.top = (oy - hh) + 'px';
    handleEls.tr.style.left = (ox + cw - hh) + 'px'; handleEls.tr.style.top = (oy - hh) + 'px';
    handleEls.bl.style.left = (ox - hh) + 'px'; handleEls.bl.style.top = (oy + ch - hh) + 'px';
    handleEls.br.style.left = (ox + cw - hh) + 'px'; handleEls.br.style.top = (oy + ch - hh) + 'px';
    handleEls.tm.style.left = (ox + cw / 2 - hh) + 'px'; handleEls.tm.style.top = (oy - hh) + 'px';
    handleEls.bm.style.left = (ox + cw / 2 - hh) + 'px'; handleEls.bm.style.top = (oy + ch - hh) + 'px';
    handleEls.ml.style.left = (ox - hh) + 'px'; handleEls.ml.style.top = (oy + ch / 2 - hh) + 'px';
    handleEls.mr.style.left = (ox + cw - hh) + 'px'; handleEls.mr.style.top = (oy + ch / 2 - hh) + 'px';
  }

  // Wire drag on handles
  Object.values(handleEls).forEach(h => {
    h.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      dragHandle = h.dataset.handle;
      startX = e.clientX;
      startY = e.clientY;
      startW = editCanvas.width;
      startH = editCanvas.height;
    });
  });


  window.addEventListener('mousemove', (e) => {
    if (!dragHandle) return;

    const curZoom = zoomLevel || 1;

    const dx = (e.clientX - startX) / curZoom;
    const dy = (e.clientY - startY) / curZoom;
    let newW = startW, newH = startH;

    if (dragHandle.includes('r')) newW = Math.max(50, Math.round(startW + dx));
    if (dragHandle.includes('l')) newW = Math.max(50, Math.round(startW - dx));
    if (dragHandle.startsWith('b')) newH = Math.max(50, Math.round(startH + dy));
    if (dragHandle.startsWith('t')) newH = Math.max(50, Math.round(startH - dy));

    if (barLocked) {
      // Maintain aspect ratio for all handles when locked
      const ratio = startW / startH;
      if (dragHandle === 'ml' || dragHandle === 'mr') {
        // Horizontal edge: adjust height to match
        newH = Math.round(newW / ratio);
      } else if (dragHandle === 'tm' || dragHandle === 'bm') {
        // Vertical edge: adjust width to match
        newW = Math.round(newH * ratio);
      } else {
        // Corner: use width as primary
        newH = Math.round(newW / ratio);
      }
    } else {
      // Unlocked: edge handles only resize one dimension
      if (dragHandle === 'ml' || dragHandle === 'mr') newH = startH;
      if (dragHandle === 'tm' || dragHandle === 'bm') newW = startW;
    }

    $('bar-w').value = newW;
    $('bar-h').value = newH;
    // Visual preview only — CSS resize, no pipeline render during drag
    editCanvas.style.width = newW + 'px';
    editCanvas.style.height = newH + 'px';
    positionHandles();
    showEditHint(`${newW} × ${newH} px`);
    // Store for mouseup
    pendingResizeW = newW;
    pendingResizeH = newH;
  });

  let pendingResizeW = 0, pendingResizeH = 0;

  window.addEventListener('mouseup', () => {
    if (dragHandle) {
      // Apply resize via pipeline only on release
      if (pendingResizeW && pendingResizeH && (pendingResizeW !== startW || pendingResizeH !== startH)) {
        pipeline.setExportSize(pendingResizeW, pendingResizeH);
        updResize();
        if (window.fitToView) window.fitToView();
      }
      pendingResizeW = 0;
      pendingResizeH = 0;
      dragHandle = null;
      saveEdit();
      positionHandles();
      hideEditHint();
    }
  });

  // Re-position on window resize
  window.addEventListener('resize', positionHandles);

  // Expose for external calls
  window._positionImageHandles = positionHandles;
}

function showImageHandles() {
  const container = $('img-resize-handles');
  if (!container || !editCanvas.width) { if (container) container.style.display = 'none'; return; }
  // Hide handles when pipeline has dimension-changing operations (crop/rotate)
  // Resize via handles conflicts with these operations
  const hasSizeOps = pipeline.operations?.some(op => ['crop','rotate','straighten','padding'].includes(op.type));
  if (hasSizeOps) { container.style.display = 'none'; return; }
  // Move handles container to edit-work (not canvas-wrap, which gets CSS transformed)
  const work = $('edit-work');
  if (container.parentElement !== work) work.appendChild(container);
  container.style.display = '';
  // Position after a frame (canvas needs to be rendered first)
  requestAnimationFrame(() => { if (window._positionImageHandles) window._positionImageHandles(); });
}

// ============================================================
// Canvas Size (artboard) controls
// ============================================================


// ============================================================
// Import from Library
// ============================================================

function _doLibraryImport() {
  if (typeof openLibraryPicker !== 'function') return;
  openLibraryPicker(async (items) => {
    if (!items.length) return;
    const item = items[0];
    const img = new Image();
    img.src = item.dataUrl;
    await new Promise(r => { img.onload = r; img.onerror = r; });
    editOriginal = img;
    editFilename = item.name || 'library-image';
    $('file-label').textContent = editFilename;
    pipeline.setDisplayCanvas(editCanvas);
    pipeline.loadImage(img);
    editCanvas.style.display = 'block';
    $('edit-ribbon')?.classList.remove('disabled');
    $('edit-dropzone').style.display = 'none';
    updResize(); originalW = 0; originalH = 0; saveEdit();
    _initEditGuides();
    showImageHandles();
    if (window.fitToView) window.fitToView();
  }, { singleSelect: true });
}

function initLibraryImport() {
  $('btn-edit-from-lib')?.addEventListener('click', _doLibraryImport);
  $('btn-edit-drop-lib')?.addEventListener('click', (e) => {
    e.stopPropagation(); // prevent dropzone click from opening file browser
    _doLibraryImport();
  });

  // Expose global function for Quick Actions and Library Manager
  window._loadEditImage = function(img, name) {
    editOriginal = img;
    editFilename = name || 'image';
    $('file-label').textContent = editFilename;
    pipeline.setDisplayCanvas(editCanvas);
    pipeline.loadImage(img);
    editCanvas.style.display = 'block';
    $('edit-ribbon')?.classList.remove('disabled');
    $('edit-dropzone').style.display = 'none';
    updResize(); originalW = 0; originalH = 0; saveEdit();
    _initEditGuides();
    showImageHandles();
    if (window.fitToView) window.fitToView();
    // Save to recent files
    if (window._addRecentFile) window._addRecentFile(img, editFilename);
    // Auto-save screenshots to library
    if (editFilename.startsWith('screenshot') && typeof PixLibrary !== 'undefined') {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const dataUrl = c.toDataURL('image/png');
      PixLibrary.add({ dataUrl, source: 'screenshot', name: editFilename, width: img.naturalWidth, height: img.naturalHeight, type: 'image', size: dataUrl.length }).catch(() => {});
    }
  };
}

function updateDimensionBadge() {
  const badge = $('dimension-badge');
  if (!badge || !editCanvas.width) return;
  badge.style.display = 'block';
  badge.textContent = `${editCanvas.width} x ${editCanvas.height}`;
}

let pulseTimeout = null;
function pulseExportButton() {
  const btn = $('btn-export');
  if (!btn) return;
  btn.classList.remove('export-pulse');
  clearTimeout(pulseTimeout);
  pulseTimeout = setTimeout(() => btn.classList.add('export-pulse'), 50);
}
function editUndo() {
  pipeline.undo();
  updResize(); saveEdit(); showImageHandles();
  if (window.fitToView) window.fitToView();
}

// ============================================================
// Persistent Info Bar
// ============================================================

// barUnitPx, barLocked, originalW, originalH declared in shared-editor.js

function initInfoBar() {
  const barW = $('bar-w');
  const barH = $('bar-h');
  const barUnit = $('bar-unit');
  const barLock = $('bar-lock');
  const barApply = $('bar-apply');

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
    barLock.style.color = barLocked ? 'var(--saffron-400)' : 'var(--slate-500)';
    barLock.title = barLocked ? 'Aspect ratio locked — click to unlock' : 'Aspect ratio unlocked — click to lock';
    // Update lock icon: locked vs unlocked
    barLock.innerHTML = barLocked
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 5-5 5 5 0 0 1 5 5"/></svg>';
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

    // Non-destructive: pipeline resize renders from original at target size
    pipeline.setExportSize(newW, newH);
    updResize(); saveEdit();
  }

  barApply?.addEventListener('click', applyBarResize);
  barW?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyBarResize(); });
  barH?.addEventListener('keydown', (e) => { if (e.key === 'Enter') applyBarResize(); });

  // --- Zoom / Pan ---
  let isPanning = false, panStartX = 0, panStartY = 0;

  function updateZoom() {
    if (!editCanvas.width) return;
    // Just update the zoom % display — no CSS changes
    // The work area's overflow:auto and the canvas max-width:none handles natural display
    // Zoom is informational only (Fit/1:1 buttons clear CSS)
    const zoomEl = $('bar-zoom');
    if (zoomEl) zoomEl.textContent = Math.round(zoomLevel * 100) + '%';
    if (editGuides) editGuides.render();
    if (window._positionImageHandles) window._positionImageHandles();
  }

  // Fit image to the work area viewport
  window.fitToView = fitToView;
  function fitToView() {
    if (!editCanvas.width || !editCanvas.height) return;
    const workArea = editCanvas.closest('.work-area');
    if (!workArea) return;
    const areaW = workArea.clientWidth * 0.9;
    const areaH = workArea.clientHeight * 0.9;
    const imgW = editCanvas.width;
    const imgH = editCanvas.height;
    // Only scale down if image is larger than work area
    if (imgW > areaW || imgH > areaH) {
      const scale = Math.min(areaW / imgW, areaH / imgH);
      editCanvas.style.width = Math.round(imgW * scale) + 'px';
      editCanvas.style.height = Math.round(imgH * scale) + 'px';
    } else {
      editCanvas.style.width = '';
      editCanvas.style.height = '';
    }
    zoomLevel = 1; panX = 0; panY = 0;
    updateZoom();
  }


  // Mousewheel zoom disabled — causes overlay/crop/filter conflicts
  // The work area scroll handles viewport fitting naturally

  // Shift+drag to pan (avoids conflicting with draw tools)
  $('edit-work')?.addEventListener('mousedown', (e) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      e.preventDefault();
      isPanning = true;
      panStartX = e.clientX - panX * zoomLevel;
      panStartY = e.clientY - panY * zoomLevel;
      $('edit-work').style.cursor = 'grabbing';
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panX = (e.clientX - panStartX) / zoomLevel;
    panY = (e.clientY - panStartY) / zoomLevel;
    updateZoom();
  });

  window.addEventListener('mouseup', () => {
    if (isPanning) {
      isPanning = false;
      $('edit-work').style.cursor = '';
    }
  });

  // Fit button — reset zoom
  $('bar-fit')?.addEventListener('click', fitToView);

  // 1:1 button — actual pixels
  $('bar-actual')?.addEventListener('click', () => {
    const workRect = $('edit-work').getBoundingClientRect();
    zoomLevel = editCanvas.width / workRect.width;
    panX = 0; panY = 0;
    updateZoom();
    if (editCanvas) editCanvas.style.maxWidth = 'none';
  });

  // "Original" — reset to original image dimensions (keeps other operations)
  $('bar-original')?.addEventListener('click', () => {
    if (!editOriginal) return;
    const origW = editOriginal.naturalWidth || editOriginal.width;
    const origH = editOriginal.naturalHeight || editOriginal.height;
    pipeline.setExportSize(origW, origH);
    updResize(); saveEdit();
  });

  // Size presets
  $('bar-size-preset')?.addEventListener('change', (e) => {
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
  const bar = $('edit-info-bar');
  if (!bar) return;

  // Track original dimensions (set once on first load)
  if (editCanvas.width && !originalW) { originalW = editCanvas.width; originalH = editCanvas.height; }

  const barW = $('bar-w');
  const barH = $('bar-h');

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
  const sizeEl = $('bar-size');
  if (sizeEl) sizeEl.textContent = `~${estPng > 1024 ? (estPng/1024).toFixed(1) + 'MB' : estPng + 'KB'} PNG`;

  // Zoom level
  const rect = editCanvas.getBoundingClientRect();
  const zoom = Math.round(rect.width / editCanvas.width * 100);
  const zoomEl = $('bar-zoom');
  if (zoomEl) zoomEl.textContent = zoom + '%';
}
function editRedo() {
  pipeline.redo();
  updResize(); saveEdit(); showImageHandles();
  if (window.fitToView) window.fitToView();
}

// editRotate and editFlip removed — now handled by pipeline.addOperation()

// applyAdj removed — now handled by pipeline.addOperation({type:'adjust'})

function editExport() {
  if (!editCanvas.width) return;
  // Flatten any drawn objects into the canvas before export
  if (window._pixerooObjLayer?.hasObjects()) window._pixerooObjLayer.flatten();
  const fmt = $('export-format').value;

  // SVG trace export
  if (fmt === 'svg') {
    const svg = PixTrace.traceCanvas(editCanvas, 'default');
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/${editFilename}.svg`, saveAs: true });
    return;
  }

  const mime = {png:'image/png',jpeg:'image/jpeg',webp:'image/webp',bmp:'image/bmp'}[fmt] || 'image/png';
  const q = ['jpeg','webp'].includes(fmt) ? +($('export-quality')?.value || 85) / 100 : undefined;
  editCanvas.toBlob(blob => {
    chrome.runtime.sendMessage({ action:'download', url: URL.createObjectURL(blob), filename:`pixeroo/${editFilename}.${fmt==='jpeg'?'jpg':fmt}`, saveAs:true });
  }, mime, q);
}

// Show/hide quality slider based on format
$('export-format')?.addEventListener('change', (e) => {
  const row = $('export-quality-row');
  if (row) row.style.display = ['jpeg','webp'].includes(e.target.value) ? 'flex' : 'none';
});
$('export-quality')?.addEventListener('input', (e) => {
  const v = $('export-quality-val'); if (v) v.textContent = e.target.value;
});
