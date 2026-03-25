// Pixeroo Editor - Home screen + 9 tool modes
// Edit, Convert, Store Assets, Info, QR, Colors, SVG, Compare, OCR

document.addEventListener('DOMContentLoaded', () => {
  // Delegated click-to-copy
  document.addEventListener('click', (e) => {
    if (e.target.classList?.contains('copyable')) {
      navigator.clipboard.writeText(e.target.textContent);
    }
    if (e.target.dataset?.copy) {
      navigator.clipboard.writeText(e.target.dataset.copy);
    }
  });

  initNavigation();
  initEdit();
  initConvert();
  initStore();
  initInfo();
  initQR();
  initColors();
  initSVG();
  initCompare();
  // OCR removed from v1 (Tesseract.js too large for extension)
  initGlobalDrop();
  initGenerate();
  initCollage();

  document.getElementById('btn-editor-settings').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  });

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editUndo(); }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); editRedo(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (currentMode === 'edit') editExport(); }
  });

  const mode = new URLSearchParams(location.search).get('mode');
  if (mode) openMode(mode);
});

// ============================================================
// Navigation: Home <-> Modes
// ============================================================

let currentMode = null;

function initNavigation() {
  document.querySelectorAll('.home-card').forEach(card => {
    card.addEventListener('click', () => openMode(card.dataset.mode));
  });
  document.getElementById('btn-back').addEventListener('click', goHome);
}

function openMode(mode) {
  currentMode = mode;
  document.getElementById('home').classList.add('hidden');
  document.querySelectorAll('.mode-view').forEach(v => v.classList.remove('active'));
  const panel = document.getElementById(`mode-${mode}`);
  if (panel) panel.classList.add('active');

  document.getElementById('btn-back').classList.add('visible');
  const labels = { edit:'Edit', convert:'Convert', store:'Store Assets', info:'Info', qr:'QR Code', colors:'Colors', svg:'SVG Tools', compare:'Compare', generate:'Generate', collage:'Collage' };
  document.getElementById('mode-label').textContent = labels[mode] || '';

  const showUndoRedo = mode === 'edit';
  document.getElementById('btn-undo').style.display = showUndoRedo ? '' : 'none';
  document.getElementById('btn-redo').style.display = showUndoRedo ? '' : 'none';
  document.getElementById('btn-reset-all').style.display = showUndoRedo ? '' : 'none';
}

function goHome() {
  currentMode = null;
  document.getElementById('home').classList.remove('hidden');
  document.querySelectorAll('.mode-view').forEach(v => v.classList.remove('active'));
  document.getElementById('btn-back').classList.remove('visible');
  document.getElementById('mode-label').textContent = '';
  document.getElementById('btn-undo').style.display = 'none';
  document.getElementById('btn-redo').style.display = 'none';
  document.getElementById('file-label').textContent = '';
}

// Global drop: drop file anywhere on home -> auto-detect best mode
function initGlobalDrop() {
  const home = document.getElementById('home');
  home.addEventListener('dragover', (e) => e.preventDefault());
  home.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) { openMode('svg'); triggerDrop('svg-drop', 'svg-file', file); }
    else { openMode('edit'); triggerDrop('edit-dropzone', 'edit-file', file); }
  });
}

// ============================================================
// MODE: Generate (standalone, no input image)
// ============================================================

function initGenerate() {
  const genCanvas = document.getElementById('gen-canvas');
  if (!genCanvas) return;
  const genCtx = genCanvas.getContext('2d');

  function showGen(c, name) {
    genCanvas.width = c.width; genCanvas.height = c.height;
    genCtx.drawImage(c, 0, 0);
    document.getElementById('gen-dims').textContent = `${c.width} x ${c.height}`;
  }

  document.getElementById('btn-gen-gradient')?.addEventListener('click', () => {
    const w = +(document.getElementById('gen-w')?.value) || 800;
    const h = +(document.getElementById('gen-h')?.value) || 600;
    const type = document.getElementById('gen-grad-type')?.value || 'linear';
    const c1 = document.getElementById('gen-grad-c1')?.value || '#F4C430';
    const c2 = document.getElementById('gen-grad-c2')?.value || '#B8860B';
    showGen(generateGradient(w, h, type, [{ pos: 0, color: c1 }, { pos: 1, color: c2 }]), 'gradient');
  });

  document.getElementById('btn-gen-pattern')?.addEventListener('click', () => {
    const w = +(document.getElementById('gen-w')?.value) || 800;
    const h = +(document.getElementById('gen-h')?.value) || 600;
    const type = document.getElementById('gen-pat-type')?.value || 'checkerboard';
    const c1 = document.getElementById('gen-pat-c1')?.value || '#e2e8f0';
    const c2 = document.getElementById('gen-pat-c2')?.value || '#ffffff';
    const cell = +(document.getElementById('gen-pat-cell')?.value) || 40;
    showGen(generatePattern(w, h, type, c1, c2, cell), 'pattern');
  });

  document.getElementById('btn-gen-placeholder')?.addEventListener('click', () => {
    const w = +(document.getElementById('gen-w')?.value) || 800;
    const h = +(document.getElementById('gen-h')?.value) || 600;
    const bg = document.getElementById('gen-ph-bg')?.value || '#94a3b8';
    const tc = document.getElementById('gen-ph-text-color')?.value || '#ffffff';
    const text = document.getElementById('gen-ph-text')?.value || '';
    showGen(generatePlaceholder(w, h, bg, tc, text), 'placeholder');
  });

  document.getElementById('btn-gen-export')?.addEventListener('click', () => {
    if (!genCanvas.width) return;
    const fmt = document.getElementById('gen-export-fmt')?.value || 'png';
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png';
    genCanvas.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/generated.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });
}

// ============================================================
// MODE: Collage (multiple images)
// ============================================================

function initCollage() {
  const collageCanvas = document.getElementById('collage-canvas');
  if (!collageCanvas) return;
  let collageImages = [];

  setupDropzone(document.getElementById('collage-drop'), document.getElementById('collage-files'), async (file) => {
    const img = await loadImg(file);
    if (!img) return;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    collageImages.push(c);

    // Thumbnail
    const thumb = document.createElement('img');
    thumb.src = c.toDataURL('image/jpeg', 0.5);
    thumb.style.cssText = 'width:40px;height:40px;object-fit:cover;border-radius:3px;border:1px solid var(--slate-700);';
    document.getElementById('collage-thumbs')?.appendChild(thumb);
    document.getElementById('collage-count').textContent = `${collageImages.length} images loaded`;
    document.getElementById('btn-collage-build').disabled = collageImages.length < 2;
  }, { multiple: true });

  document.getElementById('btn-collage-build')?.addEventListener('click', () => {
    if (collageImages.length < 2) return;
    const cols = +(document.getElementById('collage-cols')?.value) || 2;
    const spacing = +(document.getElementById('collage-spacing')?.value) || 10;
    const bg = document.getElementById('collage-bg')?.value || '#ffffff';
    const result = createCollage(collageImages, cols, spacing, bg);
    if (result) {
      collageCanvas.width = result.width; collageCanvas.height = result.height;
      collageCanvas.getContext('2d').drawImage(result, 0, 0);
      collageCanvas.style.display = 'block';
      document.getElementById('collage-drop').style.display = 'none';
      document.getElementById('btn-collage-export').disabled = false;
    }
  });

  document.getElementById('btn-collage-export')?.addEventListener('click', () => {
    if (!collageCanvas.width) return;
    collageCanvas.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: 'pixeroo/collage.png', saveAs: true });
    });
  });
}

function triggerDrop(dropId, inputId, file) {
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById(inputId);
  input.files = dt.files;
  input.dispatchEvent(new Event('change'));
}

// ============================================================
// Shared helpers
// ============================================================

function setupDropzone(dropEl, fileInput, onFile, opts = {}) {
  dropEl.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const files = opts.multiple ? [...e.target.files] : [e.target.files[0]];
    files.filter(Boolean).forEach(onFile);
  });
  dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('dragover'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('dragover'));
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault(); dropEl.classList.remove('dragover');
    const files = opts.multiple ? [...e.dataTransfer.files] : [e.dataTransfer.files[0]];
    files.filter(Boolean).forEach(onFile);
  });
}

function loadImg(file) {
  return new Promise(r => {
    const reader = new FileReader();
    reader.onload = (e) => { const img = new Image(); img.onload = () => r(img); img.onerror = () => r(null); img.src = e.target.result; };
    reader.readAsDataURL(file);
  });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatBytes(b) { if (b < 1024) return b+' B'; if (b < 1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function rgbHex(r,g,b) { return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function rgbHsl(r,g,b) { r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h,s,l=(mx+mn)/2;if(mx===mn){h=s=0}else{const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return`hsl(${Math.round(h*360)},${Math.round(s*100)}%,${Math.round(l*100)}%)`; }
function gcd(a,b){return b===0?a:gcd(b,a%b);}

// ============================================================
// MODE: Edit
// ============================================================

let editCanvas, editCtx, editOriginal, editFilename = 'edited';
let editUndoStack = [], editRedoStack = [];

function initEdit() {
  editCanvas = document.getElementById('editor-canvas');
  editCtx = editCanvas.getContext('2d', { willReadFrequently: true });

  setupDropzone(document.getElementById('edit-dropzone'), document.getElementById('edit-file'), async (file) => {
    editFilename = file.name.replace(/\.[^.]+$/, '');
    document.getElementById('file-label').textContent = file.name;
    const img = await loadImg(file);
    if (!img) return;
    editOriginal = img;
    editCanvas.width = img.naturalWidth; editCanvas.height = img.naturalHeight;
    editCtx.drawImage(img, 0, 0);
    editCanvas.style.display = 'block';
    document.getElementById('edit-dropzone').style.display = 'none';
    updResize(); editUndoStack = []; editRedoStack = []; originalW = 0; originalH = 0; saveEdit();
  });

  // Reset All -- revert to original image
  document.getElementById('btn-reset-all')?.addEventListener('click', () => {
    if (!editOriginal) return;
    if (!confirm('Reset all edits and revert to original image?')) return;
    editCanvas.width = editOriginal.naturalWidth;
    editCanvas.height = editOriginal.naturalHeight;
    editCtx.drawImage(editOriginal, 0, 0);
    updResize();
    editUndoStack = []; editRedoStack = [];
    saveEdit();
    // Reset sliders
    resetAdjustmentSliders();
  });

  // Reset Adjustments -- sliders to 0, redraw original
  document.getElementById('btn-reset-adjust')?.addEventListener('click', () => {
    resetAdjustmentSliders();
    if (editOriginal) {
      editCanvas.width = editOriginal.naturalWidth;
      editCanvas.height = editOriginal.naturalHeight;
      editCtx.drawImage(editOriginal, 0, 0);
      saveEdit();
    }
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
          editCanvas.width = img.naturalWidth; editCanvas.height = img.naturalHeight;
          editCtx.drawImage(img, 0, 0);
          editCanvas.style.display = 'block';
          document.getElementById('edit-dropzone').style.display = 'none';
          updResize(); editUndoStack = []; editRedoStack = []; originalW = 0; originalH = 0; saveEdit();
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

  // Resize
  const rw = document.getElementById('resize-w'), rh = document.getElementById('resize-h'), lr = document.getElementById('lock-ratio');
  rw.addEventListener('input', () => { if (lr.checked && editCanvas.width) rh.value = Math.round(+rw.value * editCanvas.height / editCanvas.width) || ''; });
  rh.addEventListener('input', () => { if (lr.checked && editCanvas.height) rw.value = Math.round(+rh.value * editCanvas.width / editCanvas.height) || ''; });
  document.getElementById('btn-apply-resize').addEventListener('click', () => {
    const w = +rw.value, h = +rh.value;
    if (!w || !h || (w === editCanvas.width && h === editCanvas.height)) return;
    const t = steppedResize(editCanvas, w, h);
    editCanvas.width = w; editCanvas.height = h; editCtx.drawImage(t, 0, 0); updResize(); saveEdit();
  });

  // Transform
  document.getElementById('btn-rotate-left').addEventListener('click', () => editRotate(-90));
  document.getElementById('btn-rotate-right').addEventListener('click', () => editRotate(90));
  document.getElementById('btn-flip-h').addEventListener('click', () => editFlip('h'));
  document.getElementById('btn-flip-v').addEventListener('click', () => editFlip('v'));

  // Adjustments
  ['brightness','contrast','saturation','hue'].forEach(a => {
    const s = document.getElementById(`adj-${a}`), l = document.getElementById(`val-${a}`);
    s.addEventListener('input', () => { l.textContent = s.value; applyAdj(); });
    s.addEventListener('change', saveEdit);
  });

  // Filters
  document.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', () => {
    if (!editOriginal) return;
    const map = { grayscale:'grayscale(100%)',sepia:'sepia(100%)',invert:'invert(100%)',blur:'blur(3px)',sharpen:'contrast(150%) brightness(110%)' };
    editCanvas.width = editOriginal.naturalWidth; editCanvas.height = editOriginal.naturalHeight;
    editCtx.filter = map[b.dataset.filter] || 'none'; editCtx.drawImage(editOriginal, 0, 0); editCtx.filter = 'none'; saveEdit();
  }));

  // Interactive Crop
  Crop.init(editCanvas, editCtx, (x, y, w, h) => {
    const imgData = editCtx.getImageData(x, y, w, h);
    editCanvas.width = w; editCanvas.height = h;
    editCtx.putImageData(imgData, 0, 0);
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

  // Annotation Tools
  Annotate.init(editCanvas, editCtx, saveEdit);
  const annTools = { 'btn-ann-rect': 'rect', 'btn-ann-arrow': 'arrow', 'btn-ann-text': 'text', 'btn-ann-redact': 'redact' };
  Object.entries(annTools).forEach(([id, tool]) => {
    document.getElementById(id)?.addEventListener('click', () => {
      if (!editCanvas.width) return;
      Annotate.setTool(tool, document.getElementById('edit-work'));
    });
  });

  document.getElementById('ann-color')?.addEventListener('input', (e) => { Annotate.color = e.target.value; });
  document.getElementById('ann-width')?.addEventListener('input', (e) => { Annotate.lineWidth = +e.target.value; });

  // Watermark
  document.getElementById('watermark-opacity')?.addEventListener('input', (e) => {
    document.getElementById('watermark-opacity-val').textContent = e.target.value;
  });
  document.getElementById('btn-watermark')?.addEventListener('click', () => {
    const text = document.getElementById('watermark-text').value;
    if (!text || !editCanvas.width) return;
    applyWatermark(editCanvas, editCtx, text, {
      opacity: +document.getElementById('watermark-opacity').value / 100,
    });
    saveEdit();
  });

  // Effects
  document.getElementById('btn-vignette')?.addEventListener('click', () => { if (!editCanvas.width) return; applyVignette(editCanvas, 0.5); saveEdit(); });
  document.getElementById('btn-denoise')?.addEventListener('click', () => { if (!editCanvas.width) return; denoiseImage(editCanvas, 1); saveEdit(); });
  document.getElementById('btn-round-corners')?.addEventListener('click', () => { if (!editCanvas.width) return; applyRoundedCorners(editCanvas, Math.min(editCanvas.width, editCanvas.height) * 0.08); saveEdit(); });
  document.getElementById('btn-border')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const bw = +document.getElementById('border-width').value || 10;
    applyBorder(editCanvas, bw, document.getElementById('border-color').value);
    saveEdit();
  });
  document.getElementById('btn-tile')?.addEventListener('click', () => { if (!editCanvas.width) return; const t = createTiledImage(editCanvas, 2, 2); editCanvas.width = t.width; editCanvas.height = t.height; editCtx.drawImage(t, 0, 0); updResize(); saveEdit(); });
  document.getElementById('btn-tile3')?.addEventListener('click', () => { if (!editCanvas.width) return; const t = createTiledImage(editCanvas, 3, 3); editCanvas.width = t.width; editCanvas.height = t.height; editCtx.drawImage(t, 0, 0); updResize(); saveEdit(); });

  // Color blindness simulation
  document.querySelectorAll('[data-cb]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editOriginal) return;
      editCanvas.width = editOriginal.naturalWidth; editCanvas.height = editOriginal.naturalHeight;
      editCtx.drawImage(editOriginal, 0, 0);
      simulateColorBlindness(editCanvas, btn.dataset.cb);
      saveEdit();
    });
  });

  // CMYK simulation
  document.getElementById('btn-cmyk-sim')?.addEventListener('click', () => {
    if (!editOriginal) return;
    editCanvas.width = editOriginal.naturalWidth; editCanvas.height = editOriginal.naturalHeight;
    editCtx.drawImage(editOriginal, 0, 0);
    simulateCmyk(editCanvas);
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
    for (const tile of tiles) {
      const blob = await new Promise(r => tile.canvas.toBlob(r, 'image/png'));
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/sprite-${tile.row}-${tile.col}.png`, saveAs: false });
    }
  });

  // Steganography
  document.getElementById('btn-steg-detect')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const result = detectSteganography(editCanvas);
    document.getElementById('steg-result').innerHTML = `<div>${esc(result.assessment)}</div><div>LSB ratio: ${result.lsbRatio}</div>`;
  });
  document.getElementById('btn-steg-visualize')?.addEventListener('click', () => {
    if (!editOriginal) return;
    editCanvas.width = editOriginal.naturalWidth; editCanvas.height = editOriginal.naturalHeight;
    editCtx.drawImage(editOriginal, 0, 0);
    visualizeLSB(editCanvas);
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
    const p = +document.getElementById('pad-size').value || 20;
    addPadding(editCanvas, p, p, p, p, document.getElementById('pad-color').value);
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
  document.getElementById('btn-bg-remove')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    removeBackground(editCanvas, 30);
    saveEdit();
  });

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

  // Channel separation
  document.querySelectorAll('[data-channel]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editOriginal) return;
      editCanvas.width = editOriginal.naturalWidth; editCanvas.height = editOriginal.naturalHeight;
      editCtx.drawImage(editOriginal, 0, 0);
      extractChannel(editCanvas, btn.dataset.channel);
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
    editCanvas.width = editOriginal.naturalWidth; editCanvas.height = editOriginal.naturalHeight;
    editCtx.drawImage(editOriginal, 0, 0);
    adjustLevels(editCanvas, +document.getElementById('level-black').value, +document.getElementById('level-white').value, +document.getElementById('level-gamma').value / 100);
    saveEdit();
  });

  // Pixelate art
  document.getElementById('btn-pixelate')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    pixelateImage(editCanvas, +document.getElementById('pixelate-size').value || 8);
    saveEdit();
  });

  // Social media presets
  document.querySelectorAll('[data-social]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!editCanvas.width) return;
      const result = resizeForSocial(editCanvas, btn.dataset.social);
      if (result) {
        editCanvas.width = result.w; editCanvas.height = result.h;
        editCtx.drawImage(result.canvas, 0, 0);
        updResize(); saveEdit();
      }
    });
  });

  // Favicon preview
  document.getElementById('btn-gen-favicons')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const previews = generateFaviconPreviews(editCanvas);
    const container = document.getElementById('favicon-previews');
    container.innerHTML = '';
    previews.forEach(p => {
      const img = document.createElement('img');
      img.src = p.canvas.toDataURL();
      img.style.cssText = `width:${Math.min(p.size, 48)}px;height:${Math.min(p.size, 48)}px;border-radius:3px;border:1px solid var(--slate-700);`;
      img.title = `${p.size}x${p.size}`;
      container.appendChild(img);
    });
  });

  // ASCII art
  document.getElementById('btn-ascii')?.addEventListener('click', () => {
    if (!editCanvas.width) return;
    const cols = +document.getElementById('ascii-cols').value || 80;
    const art = imageToAscii(editCanvas, cols);
    const output = document.getElementById('ascii-output');
    output.textContent = art;
    output.style.display = 'block';
    output.classList.add('copyable');
  });

  // Generators
  // Generators with full options
  function showGenerated(canvas, name) {
    editCanvas.width = canvas.width; editCanvas.height = canvas.height;
    editCtx.drawImage(canvas, 0, 0);
    editCanvas.style.display = 'block';
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

  // --- Persistent Info Bar ---
  initInfoBar();
}

function updResize() { document.getElementById('resize-w').value = editCanvas.width; document.getElementById('resize-h').value = editCanvas.height; }
function saveEdit() {
  editUndoStack.push(editCtx.getImageData(0, 0, editCanvas.width, editCanvas.height));
  if (editUndoStack.length > 30) editUndoStack.shift();
  editRedoStack = [];
  try { const h = computeHistogram(editCanvas); drawHistogram(document.getElementById('histogram-canvas'), h); } catch {}
  updateDimensionBadge();
  updateInfoBar();
  pulseExportButton();
}

// Stepped downscale for sharp resizing (halves until close, then final)
function steppedResize(source, targetW, targetH) {
  let current = source;
  let cw = source.width, ch = source.height;

  while (cw / 2 > targetW || ch / 2 > targetH) {
    const halfW = Math.max(Math.floor(cw / 2), targetW);
    const halfH = Math.max(Math.floor(ch / 2), targetH);
    const step = document.createElement('canvas');
    step.width = halfW; step.height = halfH;
    const sc = step.getContext('2d');
    sc.imageSmoothingEnabled = true;
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(current, 0, 0, halfW, halfH);
    current = step; cw = halfW; ch = halfH;
  }

  // Final step to exact target
  const result = document.createElement('canvas');
  result.width = targetW; result.height = targetH;
  const rc = result.getContext('2d');
  rc.imageSmoothingEnabled = true;
  rc.imageSmoothingQuality = 'high';
  rc.drawImage(current, 0, 0, targetW, targetH);
  return result;
}

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
function editUndo() { if (editUndoStack.length <= 1) return; editRedoStack.push(editUndoStack.pop()); const s = editUndoStack.at(-1); editCanvas.width = s.width; editCanvas.height = s.height; editCtx.putImageData(s, 0, 0); updResize(); updateInfoBar(); }

// ============================================================
// Persistent Info Bar
// ============================================================

let barUnitPx = true;
let barLocked = true;
let originalW = 0, originalH = 0;

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

    const t = steppedResize(editCanvas, newW, newH);
    editCanvas.width = newW; editCanvas.height = newH; editCtx.drawImage(t, 0, 0);
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
function editRedo() { if (!editRedoStack.length) return; const s = editRedoStack.pop(); editUndoStack.push(s); editCanvas.width = s.width; editCanvas.height = s.height; editCtx.putImageData(s, 0, 0); updResize(); }

function editRotate(deg) {
  const t = document.createElement('canvas'), tc = t.getContext('2d');
  t.width = Math.abs(deg) === 90 ? editCanvas.height : editCanvas.width;
  t.height = Math.abs(deg) === 90 ? editCanvas.width : editCanvas.height;
  tc.translate(deg === 90 ? t.width : 0, deg === -90 ? t.height : 0);
  tc.rotate(deg * Math.PI / 180); tc.drawImage(editCanvas, 0, 0);
  editCanvas.width = t.width; editCanvas.height = t.height; editCtx.drawImage(t, 0, 0); updResize(); saveEdit();
}

function editFlip(d) {
  const t = document.createElement('canvas'); t.width = editCanvas.width; t.height = editCanvas.height;
  const tc = t.getContext('2d');
  if (d === 'h') { tc.translate(editCanvas.width, 0); tc.scale(-1, 1); } else { tc.translate(0, editCanvas.height); tc.scale(1, -1); }
  tc.drawImage(editCanvas, 0, 0); editCtx.clearRect(0, 0, editCanvas.width, editCanvas.height); editCtx.drawImage(t, 0, 0); saveEdit();
}

function applyAdj() {
  if (!editOriginal) return;
  const b = +document.getElementById('adj-brightness').value, c = +document.getElementById('adj-contrast').value;
  const s = +document.getElementById('adj-saturation').value, h = +document.getElementById('adj-hue').value;
  editCanvas.width = editOriginal.naturalWidth; editCanvas.height = editOriginal.naturalHeight;
  editCtx.filter = `brightness(${100+b}%) contrast(${100+c}%) saturate(${100+s}%) hue-rotate(${h}deg)`;
  editCtx.drawImage(editOriginal, 0, 0); editCtx.filter = 'none';
}

function editExport() {
  if (!editCanvas.width) return;
  const fmt = document.getElementById('export-format').value;
  const mime = {png:'image/png',jpeg:'image/jpeg',webp:'image/webp',bmp:'image/bmp'}[fmt] || 'image/png';
  const q = ['jpeg','webp'].includes(fmt) ? 0.85 : undefined;
  editCanvas.toBlob(blob => {
    chrome.runtime.sendMessage({ action:'download', url: URL.createObjectURL(blob), filename:`pixeroo/${editFilename}.${fmt==='jpeg'?'jpg':fmt}`, saveAs:true });
  }, mime, q);
}

// ============================================================
// MODE: Convert
// ============================================================

let convertFiles = [];

function initConvert() {
  setupDropzone(document.getElementById('convert-drop'), document.getElementById('convert-file'), (file) => {
    convertFiles.push(file);
    document.getElementById('convert-drop').style.display = 'none';
    document.getElementById('convert-preview').style.display = 'block';
    document.getElementById('convert-img').src = URL.createObjectURL(file);
    document.getElementById('convert-batch-info').textContent = convertFiles.length > 1 ? `${convertFiles.length} files` : file.name;
    document.getElementById('btn-convert-go').disabled = false;
  }, { multiple: true });

  document.querySelectorAll('#convert-formats .format-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('#convert-formats .format-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.getElementById('convert-quality-section').style.display = ['jpeg','webp','avif'].includes(b.dataset.fmt) ? 'block' : 'none';
  }));
  document.getElementById('convert-quality').addEventListener('input', e => { document.getElementById('convert-quality-val').textContent = e.target.value; });

  document.getElementById('btn-convert-go').addEventListener('click', async () => {
    const fmt = document.querySelector('#convert-formats .format-btn.active')?.dataset.fmt || 'png';
    const mime = {png:'image/png',jpeg:'image/jpeg',webp:'image/webp',bmp:'image/bmp'}[fmt] || 'image/png';
    const q = ['jpeg','webp'].includes(fmt) ? +document.getElementById('convert-quality').value / 100 : undefined;
    const batchW = +document.getElementById('batch-resize-w').value || 0;
    const batchH = +document.getElementById('batch-resize-h').value || 0;
    const batchLock = document.getElementById('batch-resize-lock').checked;

    for (const file of convertFiles) {
      const img = await loadImg(file); if (!img) continue;
      let w = img.naturalWidth, h = img.naturalHeight;

      // Apply batch resize if specified
      if (batchW > 0 || batchH > 0) {
        if (batchW > 0 && batchH > 0 && !batchLock) {
          w = batchW; h = batchH;
        } else if (batchW > 0) {
          const ratio = img.naturalHeight / img.naturalWidth;
          w = batchW; h = batchLock ? Math.round(batchW * ratio) : (batchH || Math.round(batchW * ratio));
        } else if (batchH > 0) {
          const ratio = img.naturalWidth / img.naturalHeight;
          h = batchH; w = batchLock ? Math.round(batchH * ratio) : (batchW || Math.round(batchH * ratio));
        }
      }

      const srcC = document.createElement('canvas'); srcC.width = img.naturalWidth; srcC.height = img.naturalHeight;
      srcC.getContext('2d').drawImage(img, 0, 0);
      const c = (w !== img.naturalWidth || h !== img.naturalHeight) ? steppedResize(srcC, w, h) : srcC;
      const blob = await new Promise(r => c.toBlob(r, mime, q));
      chrome.runtime.sendMessage({ action:'download', url: URL.createObjectURL(blob), filename:`pixeroo/${file.name.replace(/\.[^.]+$/,'')}.${fmt==='jpeg'?'jpg':fmt}`, saveAs: convertFiles.length === 1 });
    }
  });

  // Compression preview: show sizes for first loaded file
  async function showCompressionPreview(file) {
    const img = await loadImg(file);
    if (!img) return;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);

    const el = document.getElementById('compression-preview');
    el.innerHTML = '<span style="color:var(--slate-500);font-size:0.6875rem;">Calculating...</span>';

    const results = await getCompressionSizes(c, [
      { format: 'PNG', mime: 'image/png', qualities: [100] },
      { format: 'JPEG', mime: 'image/jpeg', qualities: [50, 75, 85, 95] },
      { format: 'WebP', mime: 'image/webp', qualities: [50, 75, 85, 95] },
    ]);

    el.innerHTML = results.map(r =>
      `<div style="display:flex;justify-content:space-between;font-size:0.625rem;padding:2px 0;color:var(--slate-400);"><span>${r.format}${r.quality < 100 ? ' ' + r.quality + '%' : ''}</span><span style="color:var(--slate-200);font-weight:500;">${r.sizeStr}</span></div>`
    ).join('');
  }

  // Trigger compression preview on first file load
  const origSetup = document.getElementById('convert-file');
  origSetup.addEventListener('change', () => {
    if (origSetup.files[0]) showCompressionPreview(origSetup.files[0]);
  });
}

// ============================================================
// MODE: Store Assets
// ============================================================

const STORE_SPECS = {
  play: [
    { name: 'App Icon', w: 512, h: 512, type: 'icon' },
    { name: 'Feature Graphic', w: 1024, h: 500, type: 'promo' },
    { name: 'TV Banner', w: 1280, h: 720, type: 'promo' },
    { name: 'Hi-res Icon', w: 512, h: 512, type: 'icon', noAlpha: true },
  ],
  apple: [
    { name: 'App Icon', w: 1024, h: 1024, type: 'icon', noAlpha: true },
    { name: 'iPhone 6.7"', w: 1290, h: 2796, type: 'screenshot' },
    { name: 'iPhone 6.5"', w: 1284, h: 2778, type: 'screenshot' },
    { name: 'iPhone 5.5"', w: 1242, h: 2208, type: 'screenshot' },
    { name: 'iPad 12.9"', w: 2048, h: 2732, type: 'screenshot' },
    { name: 'iPad 11"', w: 1668, h: 2388, type: 'screenshot' },
  ],
  chrome: [
    { name: 'Extension Icon', w: 128, h: 128, type: 'icon' },
    { name: 'Small Promo', w: 440, h: 280, type: 'promo' },
    { name: 'Large Promo', w: 920, h: 680, type: 'promo' },
    { name: 'Marquee', w: 1400, h: 560, type: 'promo' },
    { name: 'Screenshot', w: 1280, h: 800, type: 'screenshot' },
  ],
  edge: [
    { name: 'Extension Icon', w: 300, h: 300, type: 'icon' },
    { name: 'Screenshot', w: 1280, h: 800, type: 'screenshot' },
  ],
  firefox: [
    { name: 'Extension Icon', w: 128, h: 128, type: 'icon' },
    { name: 'Screenshot', w: 1280, h: 800, type: 'screenshot' },
  ],
  ms: [
    { name: 'Store Logo', w: 300, h: 300, type: 'icon' },
    { name: 'Hero Image', w: 1920, h: 1080, type: 'promo' },
    { name: 'Screenshot', w: 1366, h: 768, type: 'screenshot' },
  ],
};

let storeIconImg = null, storeScreenImg = null, storeGenerated = {};

function initStore() {
  // Store nav
  document.querySelectorAll('.store-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.store-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      renderStoreAssets(item.dataset.store);
    });
  });

  setupDropzone(document.getElementById('store-icon-drop'), document.getElementById('store-icon-file'), async (file) => {
    storeIconImg = await loadImg(file);
    if (!storeIconImg) return;
    document.getElementById('store-icon-preview').style.display = 'block';
    const c = document.getElementById('store-icon-canvas'); c.width = 128; c.height = 128;
    c.getContext('2d').drawImage(storeIconImg, 0, 0, 128, 128);
    document.getElementById('btn-store-generate').disabled = false;
    validateStoreIcon();
  });

  setupDropzone(document.getElementById('store-screenshot-drop'), document.getElementById('store-screenshot-file'), async (file) => {
    storeScreenImg = await loadImg(file);
  });

  document.getElementById('btn-store-generate').addEventListener('click', generateStoreAssets);
  document.getElementById('btn-store-export').addEventListener('click', exportStoreZip);

  updateStoreCounts();
}

function validateStoreIcon() {
  const el = document.getElementById('store-validation');
  if (!storeIconImg) { el.textContent = 'Upload source icon'; return; }
  const warnings = [];
  if (storeIconImg.naturalWidth < 1024 || storeIconImg.naturalHeight < 1024) warnings.push('Icon should be at least 1024x1024 for best quality');
  if (storeIconImg.naturalWidth !== storeIconImg.naturalHeight) warnings.push('Icon should be square');
  el.innerHTML = warnings.length ? warnings.map(w => `<div style="color:#fbbf24;margin-bottom:2px;">${esc(w)}</div>`).join('') : '<div style="color:#22c55e;">Icon looks good</div>';
}

function updateStoreCounts() {
  let total = 0;
  for (const [store, specs] of Object.entries(STORE_SPECS)) {
    const count = specs.length;
    total += count;
    const el = document.getElementById(`store-count-${store}`);
    if (el) el.textContent = count;
  }
  document.getElementById('store-count-all').textContent = total;
}

async function generateStoreAssets() {
  if (!storeIconImg) return;
  storeGenerated = {};
  const bg = document.getElementById('store-bg-color').value;
  const radius = +document.getElementById('store-corner-radius').value;

  for (const [store, specs] of Object.entries(STORE_SPECS)) {
    storeGenerated[store] = [];
    for (const spec of specs) {
      const canvas = document.createElement('canvas');
      canvas.width = spec.w; canvas.height = spec.h;
      const ctx = canvas.getContext('2d');

      // Background
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, spec.w, spec.h);

      if (spec.type === 'icon') {
        // Draw icon centered, fitting the canvas
        const size = Math.min(spec.w, spec.h);
        const x = (spec.w - size) / 2, y = (spec.h - size) / 2;

        if (radius > 0) {
          roundRect(ctx, x, y, size, size, radius * size / 100);
          ctx.clip();
        }

        ctx.drawImage(storeIconImg, x, y, size, size);

        if (spec.noAlpha) {
          // Flatten alpha onto background
          const tmp = document.createElement('canvas'); tmp.width = spec.w; tmp.height = spec.h;
          const tc = tmp.getContext('2d');
          tc.fillStyle = bg; tc.fillRect(0, 0, spec.w, spec.h);
          tc.drawImage(canvas, 0, 0);
          ctx.clearRect(0, 0, spec.w, spec.h);
          ctx.drawImage(tmp, 0, 0);
        }
      } else if (spec.type === 'promo' || spec.type === 'screenshot') {
        const src = spec.type === 'screenshot' && storeScreenImg ? storeScreenImg : storeIconImg;
        // Center the source image, fit within dimensions
        const scale = Math.min(spec.w / src.naturalWidth, spec.h / src.naturalHeight, 1);
        const sw = src.naturalWidth * scale, sh = src.naturalHeight * scale;
        ctx.drawImage(src, (spec.w - sw) / 2, (spec.h - sh) / 2, sw, sh);
      }

      storeGenerated[store].push({ spec, canvas });
    }
  }

  document.getElementById('btn-store-export').disabled = false;
  renderStoreAssets(document.querySelector('.store-nav-item.active')?.dataset.store || 'all');
}

function renderStoreAssets(filter) {
  const grid = document.getElementById('store-assets');
  grid.innerHTML = '';

  const stores = filter === 'all' ? Object.keys(STORE_SPECS) : [filter];

  for (const store of stores) {
    const items = storeGenerated[store] || [];
    const specs = STORE_SPECS[store] || [];

    if (filter === 'all' && specs.length) {
      const header = document.createElement('div');
      header.style.cssText = 'grid-column:1/-1;font-size:0.75rem;font-weight:600;color:var(--slate-400);text-transform:uppercase;padding-top:0.5rem;';
      header.textContent = { play:'Google Play', apple:'Apple App Store', chrome:'Chrome Web Store', edge:'Edge Add-ons', firefox:'Firefox Add-ons', ms:'Microsoft Store' }[store];
      grid.appendChild(header);
    }

    specs.forEach((spec, idx) => {
      const card = document.createElement('div');
      card.className = 'asset-card';
      const item = items[idx];
      const hasAsset = !!item;

      card.innerHTML = `
        <div class="asset-card-preview">${hasAsset ? '' : '<div style="color:var(--slate-600);font-size:0.625rem;">Not generated</div>'}</div>
        <div class="asset-card-label">
          <div class="asset-card-name"><span class="asset-status ${hasAsset ? 'ready' : 'pending'}"></span>${esc(spec.name)}</div>
          <div class="asset-card-dims">${spec.w} x ${spec.h}</div>
        </div>
      `;

      if (hasAsset) {
        const preview = card.querySelector('.asset-card-preview');
        const img = document.createElement('img');
        img.src = item.canvas.toDataURL('image/png');
        preview.appendChild(img);

        // Click to download individual asset
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          item.canvas.toBlob(blob => {
            const name = `${store}-${spec.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${spec.w}x${spec.h}.png`;
            chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/store-assets/${name}`, saveAs: true });
          });
        });
      }

      grid.appendChild(card);
    });
  }

  if (!grid.children.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--slate-500);font-size:0.8125rem;">Upload a source icon and click Generate</div>';
  }
}

async function exportStoreZip() {
  // Download all assets individually (ZIP requires JSZip - future)
  for (const [store, items] of Object.entries(storeGenerated)) {
    for (const item of items) {
      const name = `${store}-${item.spec.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.spec.w}x${item.spec.h}.png`;
      const blob = await new Promise(r => item.canvas.toBlob(r));
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/store-assets/${name}`, saveAs: false });
    }
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r); ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h); ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r); ctx.quadraticCurveTo(x, y, x + r, y); ctx.closePath();
}

// ============================================================
// MODE: Info
// ============================================================

function initInfo() {
  setupDropzone(document.getElementById('info-drop'), document.getElementById('info-file'), async (file) => {
    document.getElementById('info-drop').style.display = 'none';
    document.getElementById('info-preview').style.display = 'block';
    document.getElementById('info-img').src = URL.createObjectURL(file);
    const img = await loadImg(file);

    document.getElementById('info-file-details').innerHTML = [
      ['Filename', file.name], ['Type', file.type || 'Unknown'], ['Size', formatBytes(file.size)],
      ['Dimensions', img ? `${img.naturalWidth} x ${img.naturalHeight}` : '?'],
      ['Ratio', img ? `${img.naturalWidth/gcd(img.naturalWidth,img.naturalHeight)}:${img.naturalHeight/gcd(img.naturalWidth,img.naturalHeight)}` : '?'],
      ['Modified', file.lastModified ? new Date(file.lastModified).toLocaleString() : '?'],
    ].map(([l,v]) => `<div class="info-row"><span class="info-label">${l}</span><span class="info-value" class="copyable">${esc(v)}</span></div>`).join('');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const exif = parseExif(bytes);
    document.getElementById('info-exif').innerHTML = exif.length ? exif.map(([t,v]) => `<div class="info-row"><span class="info-label">${esc(t)}</span><span class="info-value" class="copyable">${esc(String(v))}</span></div>`).join('') : '<span style="color:var(--slate-500);font-size:0.75rem;">No EXIF data</span>';

    const structure = parseJpegStructure(bytes);
    document.getElementById('info-structure').innerHTML = structure.length ? structure.map(s => `<div style="font-size:0.6875rem;color:var(--slate-400);padding:2px 0;">${esc(s)}</div>`).join('') : '<span style="color:var(--slate-500);font-size:0.75rem;">Not JPEG</span>';

    // DPI
    const dpi = readDpiFromPng(bytes) || readDpiFromJpeg(bytes);
    document.getElementById('info-dpi').innerHTML = dpi
      ? `<div class="info-row"><span class="info-label">DPI</span><span class="info-value">${dpi.x} x ${dpi.y}</span></div>`
      : '<span style="color:var(--slate-500);font-size:0.75rem;">Not available</span>';

    // Image hash
    if (img) {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const hashEl = document.getElementById('info-hash');
      hashEl.innerHTML = '<span style="color:var(--slate-500);font-size:0.6875rem;">Computing...</span>';
      try {
        const sha = await computeImageHash(c, 'SHA-256');
        const phash = computePerceptualHash(c);
        hashEl.innerHTML = `
          <div class="info-row"><span class="info-label">SHA-256</span><span class="info-value copyable" style="font-size:0.5625rem;">${sha.substring(0, 16)}...</span></div>
          <div class="info-row"><span class="info-label">pHash</span><span class="info-value copyable">${phash}</span></div>
        `;
      } catch { hashEl.innerHTML = '<span style="color:var(--slate-500);font-size:0.75rem;">Hash failed</span>'; }

      // Base64 button
      const b64Btn = document.getElementById('btn-copy-base64');
      b64Btn.disabled = false;
      b64Btn.onclick = () => {
        navigator.clipboard.writeText(c.toDataURL(file.type || 'image/png'));
      };
    }
  });
}

// ============================================================
// MODE: QR Code
// ============================================================

function initQR() {
  document.getElementById('btn-qr-generate').addEventListener('click', genQR);
  document.getElementById('qr-text').addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') genQR(); });
  ['qr-px','qr-margin'].forEach(id => { document.getElementById(id).addEventListener('input', e => { document.getElementById(id+'-val').textContent = e.target.value; if (document.getElementById('qr-text').value) genQR(); }); });
  ['qr-ecc','qr-fg','qr-bg'].forEach(id => { document.getElementById(id).addEventListener('change', () => { if (document.getElementById('qr-text').value) genQR(); }); });

  document.querySelectorAll('[data-qr-preset]').forEach(b => b.addEventListener('click', () => {
    const t = { url:'https://example.com', wifi:'WIFI:T:WPA;S:MyNetwork;P:password;;', email:'mailto:name@example.com', phone:'tel:+1234567890', vcard:'BEGIN:VCARD\nVERSION:3.0\nFN:Name\nTEL:+1234567890\nEMAIL:name@example.com\nEND:VCARD' };
    document.getElementById('qr-text').value = t[b.dataset.qrPreset] || '';
  }));

  document.getElementById('btn-qr-copy').addEventListener('click', () => { document.getElementById('qr-canvas').toBlob(b => navigator.clipboard.write([new ClipboardItem({'image/png':b})])); });
  document.getElementById('btn-qr-download').addEventListener('click', () => { document.getElementById('qr-canvas').toBlob(b => { chrome.runtime.sendMessage({action:'download',url:URL.createObjectURL(b),filename:'pixeroo/qrcode.png',saveAs:true}); }); });
  document.getElementById('btn-qr-svg').addEventListener('click', () => {
    const text = document.getElementById('qr-text').value; if (!text) return;
    try {
      const qr = QR.encode(text), fg = document.getElementById('qr-fg').value, bg = document.getElementById('qr-bg').value, m = +document.getElementById('qr-margin').value, sz = qr.size+m*2;
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sz} ${sz}"><rect width="${sz}" height="${sz}" fill="${bg}"/>`;
      for (let y=0;y<qr.size;y++) for (let x=0;x<qr.size;x++) if (qr.modules[y][x]) svg+=`<rect x="${x+m}" y="${y+m}" width="1" height="1" fill="${fg}"/>`;
      svg+='</svg>';
      chrome.runtime.sendMessage({action:'download',url:URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),filename:'pixeroo/qrcode.svg',saveAs:true});
    } catch {}
  });

  setupDropzone(document.getElementById('qr-read-drop'), document.getElementById('qr-read-file'), async (file) => {
    const resultEl = document.getElementById('qr-read-result');
    resultEl.style.display = 'block';
    resultEl.textContent = 'Reading QR code...';
    try {
      const data = await readQRFromFile(file);
      if (data) {
        resultEl.innerHTML = `<div style="margin-bottom:0.25rem;color:#22c55e;font-size:0.6875rem;font-weight:600;">QR Code Found:</div><div class="copyable" style="color:var(--slate-200);font-size:0.75rem;word-break:break-all;cursor:pointer;" title="Click to copy">${esc(data)}</div>`;
      } else {
        resultEl.textContent = 'No QR code found in this image';
      }
    } catch (e) {
      resultEl.textContent = 'Failed to read QR: ' + e.message;
    }
  });
}

function genQR() {
  const text = document.getElementById('qr-text').value; if (!text) return;
  try {
    const qr = QR.encode(text);
    QR.renderToCanvas(document.getElementById('qr-canvas'), qr, +document.getElementById('qr-px').value, +document.getElementById('qr-margin').value, document.getElementById('qr-fg').value, document.getElementById('qr-bg').value);
  } catch {
    const c = document.getElementById('qr-canvas'); c.width=200;c.height=50;
    const x=c.getContext('2d'); x.fillStyle='#1e293b'; x.fillRect(0,0,200,50); x.fillStyle='#ef4444'; x.font='12px sans-serif'; x.textAlign='center'; x.fillText('Text too long',100,30);
  }
}

// ============================================================
// MODE: Colors
// ============================================================

function initColors() {
  let cImg = null;
  const cc = document.getElementById('colors-canvas'), cx = cc.getContext('2d', { willReadFrequently: true });

  setupDropzone(document.getElementById('colors-drop'), document.getElementById('colors-file'), async (file) => {
    cImg = await loadImg(file); if (!cImg) return;
    document.getElementById('colors-drop').style.display = 'none';
    document.getElementById('colors-preview').style.display = 'block';
    cc.width = cImg.naturalWidth; cc.height = cImg.naturalHeight; cx.drawImage(cImg, 0, 0);
    extractPal();
  });

  cc.addEventListener('click', (e) => {
    const r = cc.getBoundingClientRect(), x = Math.floor((e.clientX-r.left)*cc.width/r.width), y = Math.floor((e.clientY-r.top)*cc.height/r.height);
    const [rv,gv,bv] = cx.getImageData(x,y,1,1).data, hex = rgbHex(rv,gv,bv);
    document.getElementById('picked-color').innerHTML = `<div style="background:${hex};height:32px;border-radius:6px;margin-bottom:0.375rem;border:1px solid var(--slate-700);"></div><div class="color-hex" data-copy="${hex}">${hex}</div><div class="color-secondary">rgb(${rv},${gv},${bv}) | ${rgbHsl(rv,gv,bv)}</div>`;
  });

  document.getElementById('palette-count').addEventListener('input', e => { document.getElementById('palette-count-val').textContent = e.target.value; });
  document.getElementById('btn-reextract').addEventListener('click', extractPal);

  function extractPal() {
    if (!cImg) return;
    const k = +document.getElementById('palette-count').value, data = cx.getImageData(0,0,cc.width,cc.height), px = [];
    for (let i = 0; i < data.data.length; i += 16) { if (data.data[i+3] < 128) continue; px.push([data.data[i],data.data[i+1],data.data[i+2]]); }
    const pal = kMeans(px, k);
    document.getElementById('palette-colors').innerHTML = pal.map(c => `<div class="color-row"><div class="color-preview" style="background:${c.hex};"></div><div style="flex:1;"><div class="color-hex" data-copy="${c.hex}">${c.hex}</div><div class="color-secondary">rgb(${c.r},${c.g},${c.b}) | ${c.pct}%</div></div></div>`).join('');
  }
}

function kMeans(px, k) {
  if (!px.length) return [];
  let cen = px.slice(0, Math.min(k, px.length)).map(p=>[...p]);
  const asg = new Array(px.length).fill(0);
  for (let it=0;it<15;it++) {
    for (let i=0;i<px.length;i++) { let mn=Infinity; for (let j=0;j<cen.length;j++) { const d=(px[i][0]-cen[j][0])**2+(px[i][1]-cen[j][1])**2+(px[i][2]-cen[j][2])**2; if (d<mn){mn=d;asg[i]=j;} } }
    const s=cen.map(()=>[0,0,0]),ct=new Array(cen.length).fill(0);
    for (let i=0;i<px.length;i++){const c=asg[i];s[c][0]+=px[i][0];s[c][1]+=px[i][1];s[c][2]+=px[i][2];ct[c]++;}
    for (let j=0;j<cen.length;j++) if(ct[j]) cen[j]=[Math.round(s[j][0]/ct[j]),Math.round(s[j][1]/ct[j]),Math.round(s[j][2]/ct[j])];
  }
  const ct=new Array(cen.length).fill(0); for(const c of asg)ct[c]++;
  return cen.map((c,i)=>({r:c[0],g:c[1],b:c[2],hex:rgbHex(c[0],c[1],c[2]),pct:Math.round(ct[i]/px.length*100)})).sort((a,b)=>b.pct-a.pct);
}

// ============================================================
// MODE: SVG
// ============================================================

function initSVG() {
  let svgSrc = '';
  setupDropzone(document.getElementById('svg-drop'), document.getElementById('svg-file'), (file) => {
    const r = new FileReader();
    r.onload = (e) => {
      svgSrc = e.target.result;
      document.getElementById('svg-drop').style.display = 'none';
      document.getElementById('svg-preview').style.display = 'block';
      document.getElementById('svg-img').src = URL.createObjectURL(file);
      document.getElementById('svg-source').textContent = svgSrc;
      document.getElementById('btn-svg-export').disabled = false;
      const doc = new DOMParser().parseFromString(svgSrc, 'image/svg+xml'), svg = doc.querySelector('svg');
      const info = svg ? [['Width',svg.getAttribute('width')||'auto'],['Height',svg.getAttribute('height')||'auto'],['ViewBox',svg.getAttribute('viewBox')||'none'],['Elements',svg.querySelectorAll('*').length],['Size',formatBytes(new Blob([svgSrc]).size)]] : [];
      document.getElementById('svg-info').innerHTML = info.map(([l,v])=>`<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${esc(String(v))}</span></div>`).join('');
      const w=parseInt(svg?.getAttribute('width'))||parseInt(svg?.getAttribute('viewBox')?.split(' ')[2])||100;
      const h=parseInt(svg?.getAttribute('height'))||parseInt(svg?.getAttribute('viewBox')?.split(' ')[3])||100;
      document.getElementById('svg-export-w').value=w*2; document.getElementById('svg-export-h').value=h*2;
    };
    r.readAsText(file);
  });

  document.getElementById('btn-svg-export').addEventListener('click', () => {
    if (!svgSrc) return;
    const w=+document.getElementById('svg-export-w').value||400, h=+document.getElementById('svg-export-h').value||400, fmt=document.getElementById('svg-export-fmt').value;
    const img=new Image(); img.onload=()=>{
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
      if(fmt==='jpeg'){x.fillStyle='#fff';x.fillRect(0,0,w,h);}x.drawImage(img,0,0,w,h);
      c.toBlob(b=>{chrome.runtime.sendMessage({action:'download',url:URL.createObjectURL(b),filename:`pixeroo/svg-export.${fmt==='jpeg'?'jpg':fmt}`,saveAs:true});},{png:'image/png',jpeg:'image/jpeg',webp:'image/webp'}[fmt],0.9);
    }; img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgSrc);
  });
  document.getElementById('btn-svg-copy-source').addEventListener('click', () => { if(svgSrc) navigator.clipboard.writeText(svgSrc); });
}

// ============================================================
// MODE: Compare
// ============================================================

function initCompare() {
  let iA=null, iB=null;
  setupDropzone(document.getElementById('compare-drop-a'),document.getElementById('compare-file-a'),async(f)=>{iA=await loadImg(f);if(!iA)return;const c=document.getElementById('compare-canvas-a');c.style.display='block';c.width=iA.naturalWidth;c.height=iA.naturalHeight;c.getContext('2d').drawImage(iA,0,0);document.getElementById('compare-drop-a').style.display='none';document.getElementById('compare-info-a').textContent=`${iA.naturalWidth}x${iA.naturalHeight} | ${f.name}`;});
  setupDropzone(document.getElementById('compare-drop-b'),document.getElementById('compare-file-b'),async(f)=>{iB=await loadImg(f);if(!iB)return;const c=document.getElementById('compare-canvas-b');c.style.display='block';c.width=iB.naturalWidth;c.height=iB.naturalHeight;c.getContext('2d').drawImage(iB,0,0);document.getElementById('compare-drop-b').style.display='none';document.getElementById('compare-info-b').textContent=`${iB.naturalWidth}x${iB.naturalHeight} | ${f.name}`;});

  document.getElementById('btn-compare-diff').addEventListener('click',()=>{
    if(!iA||!iB)return;const w=Math.min(iA.naturalWidth,iB.naturalWidth),h=Math.min(iA.naturalHeight,iB.naturalHeight);
    const cA=document.createElement('canvas');cA.width=w;cA.height=h;cA.getContext('2d',{willReadFrequently:true}).drawImage(iA,0,0,w,h);
    const cB=document.createElement('canvas');cB.width=w;cB.height=h;cB.getContext('2d',{willReadFrequently:true}).drawImage(iB,0,0,w,h);
    const dA=cA.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),dB=cB.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),diff=new ImageData(w,h);let dc=0;
    for(let i=0;i<dA.data.length;i+=4){const d=Math.abs(dA.data[i]-dB.data[i])+Math.abs(dA.data[i+1]-dB.data[i+1])+Math.abs(dA.data[i+2]-dB.data[i+2]);if(d>30){diff.data[i]=255;diff.data[i+1]=0;diff.data[i+2]=0;diff.data[i+3]=255;dc++;}else{diff.data[i]=dA.data[i];diff.data[i+1]=dA.data[i+1];diff.data[i+2]=dA.data[i+2];diff.data[i+3]=80;}}
    const co=document.getElementById('compare-canvas-b');co.width=w;co.height=h;co.getContext('2d').putImageData(diff,0,0);
    document.getElementById('compare-info-b').textContent=`Diff: ${((dc/(w*h))*100).toFixed(1)}% (${dc} px)`;
  });
  document.getElementById('btn-compare-swap').addEventListener('click',()=>{const t=iA;iA=iB;iB=t;if(iA){const c=document.getElementById('compare-canvas-a');c.width=iA.naturalWidth;c.height=iA.naturalHeight;c.getContext('2d').drawImage(iA,0,0);}if(iB){const c=document.getElementById('compare-canvas-b');c.width=iB.naturalWidth;c.height=iB.naturalHeight;c.getContext('2d').drawImage(iB,0,0);}});
}

// ============================================================
// MODE: OCR
// ============================================================

// OCR removed from v1 -- Tesseract.js is 6MB+, triggers Chrome review scrutiny

// ============================================================
// EXIF Parser (shared)
// ============================================================

function parseExif(bytes) {
  const e=[];if(bytes[0]!==0xFF||bytes[1]!==0xD8)return e;let o=2;
  while(o<bytes.length-1){if(bytes[o]!==0xFF)break;const m=bytes[o+1];if(m===0xD9||m===0xDA)break;const l=(bytes[o+2]<<8)|bytes[o+3];
  if(m===0xE1){const h=String.fromCharCode(...bytes.slice(o+4,o+8));if(h==='Exif')parseTIFD(bytes,o+10,e);}o+=2+l;}return e;
}
function parseTIFD(b,ts,e){if(ts+8>b.length)return;const le=b[ts]===0x49;const r16=(o)=>le?(b[o]|(b[o+1]<<8)):((b[o]<<8)|b[o+1]);const r32=(o)=>le?(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0:((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;
const is=ts+r32(ts+4);if(is+2>b.length)return;const T={0x010F:'Make',0x0110:'Model',0x0112:'Orientation',0x011A:'XResolution',0x011B:'YResolution',0x0131:'Software',0x0132:'DateTime',0x829A:'ExposureTime',0x829D:'FNumber',0x8827:'ISO',0x9003:'DateTimeOriginal',0x920A:'FocalLength',0xA405:'FocalLength35mm',0xA002:'PixelXDimension',0xA003:'PixelYDimension',0x8769:'ExifIFD',0x8825:'GPSIFD'};
const c=r16(is);for(let i=0;i<c&&is+2+i*12+12<=b.length;i++){const eo=is+2+i*12,tag=r16(eo),ty=r16(eo+2),tc=r32(eo+4),vo=eo+8;const n=T[tag];if(!n)continue;if(tag===0x8769||tag===0x8825){parseTSub(b,ts,ts+r32(vo),e,le,T);continue;}const v=readTV(b,ts,ty,tc,vo,le);if(v!==null)e.push([n,v]);}}
function parseTSub(b,ts,is,e,le,T){if(is+2>b.length)return;const r16=(o)=>le?(b[o]|(b[o+1]<<8)):((b[o]<<8)|b[o+1]);const r32=(o)=>le?(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0:((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;
const c=r16(is);for(let i=0;i<c&&is+2+i*12+12<=b.length;i++){const eo=is+2+i*12,tag=r16(eo),ty=r16(eo+2),tc=r32(eo+4),vo=eo+8;const n=T[tag];if(!n||tag===0x8769||tag===0x8825)continue;const v=readTV(b,ts,ty,tc,vo,le);if(v!==null)e.push([n,v]);}}
function readTV(b,ts,ty,c,vo,le){const r16=(o)=>le?(b[o]|(b[o+1]<<8)):((b[o]<<8)|b[o+1]);const r32=(o)=>le?(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0:((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;
try{if(ty===2){const d=c>4?ts+r32(vo):vo;let s='';for(let i=0;i<c-1&&d+i<b.length;i++)s+=String.fromCharCode(b[d+i]);return s.trim();}if(ty===3)return r16(vo);if(ty===4)return r32(vo);if(ty===5){const d=ts+r32(vo);if(d+8>b.length)return null;const n=r32(d),dn=r32(d+4);return dn===0?n:n%dn===0?n/dn:`${n}/${dn}`;}}catch{}return null;}

function parseJpegStructure(bytes) {
  const s=[];if(bytes[0]!==0xFF||bytes[1]!==0xD8)return s;s.push('SOI');let o=2;
  const N={0xE0:'APP0/JFIF',0xE1:'APP1/EXIF',0xDB:'DQT',0xC0:'SOF0/Baseline',0xC2:'SOF2/Progressive',0xC4:'DHT',0xDA:'SOS',0xD9:'EOI',0xFE:'COM'};
  while(o<bytes.length-1){if(bytes[o]!==0xFF)break;const m=bytes[o+1];if(m===0xD9){s.push('EOI');break;}if(m===0xDA){s.push('SOS');break;}const l=(bytes[o+2]<<8)|bytes[o+3];s.push(`${N[m]||'0xFF'+m.toString(16).toUpperCase()} [${l}B]`);o+=2+l;}return s;
}
