// Pixeroo — Watermark Tool
let wmImages = []; // Array of { file, img, name }
let wmLogo = null; // Image element for logo watermark
let wmType = 'text'; // 'text' or 'logo'
let wmPosition = 'br';
let wmPreviewIdx = 0;
let wmPreviewTimer = null;

function initWatermark() {
  const canvas = $('wm-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const dropzone = $('wm-dropzone');
  const fileInput = $('wm-files');
  const logoInput = $('wm-logo-file');
  const thumbsEl = $('wm-thumbs');
  const countEl = $('wm-count');

  function updateCount() {
    countEl.textContent = wmImages.length + ' image' + (wmImages.length !== 1 ? 's' : '') + ' loaded';
  }

  function addImage(file) {
    loadImg(file).then(img => {
      if (!img) return;
      wmImages.push({ file, img, name: file.name });
      updateCount();
      dropzone.style.display = 'none';
      thumbsEl.style.display = 'flex';
      // Add thumbnail
      const thumb = document.createElement('img');
      thumb.src = img.src;
      thumb.style.cssText = 'height:50px;border-radius:4px;cursor:pointer;border:2px solid transparent;flex-shrink:0;';
      thumb.title = file.name;
      const idx = wmImages.length - 1;
      thumb.addEventListener('click', () => {
        wmPreviewIdx = idx;
        wmRenderPreview();
        // Highlight active thumb
        thumbsEl.querySelectorAll('img').forEach(t => t.style.borderColor = 'transparent');
        thumb.style.borderColor = 'var(--saffron-400)';
      });
      thumbsEl.appendChild(thumb);
      // Auto-preview first image
      if (wmImages.length === 1) {
        wmPreviewIdx = 0;
        wmRenderPreview();
        thumb.style.borderColor = 'var(--saffron-400)';
      }
    });
  }

  // Dropzone for batch image loading
  setupDropzone(dropzone, fileInput, addImage, { multiple: true });

  // Add Images button
  $('btn-wm-add').addEventListener('click', () => fileInput.click());

  // Add from Library button
  $('btn-wm-from-lib')?.addEventListener('click', () => {
    openLibraryPicker(async (items) => {
      for (const item of items) {
        const img = new Image();
        img.src = item.dataUrl;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        wmImages.push({ file: null, img, name: item.name });
        updateCount();
        dropzone.style.display = 'none';
        thumbsEl.style.display = 'flex';
        const thumb = document.createElement('img');
        thumb.src = img.src;
        thumb.style.cssText = 'height:50px;border-radius:4px;cursor:pointer;border:2px solid transparent;flex-shrink:0;';
        thumb.title = item.name;
        const idx = wmImages.length - 1;
        thumb.addEventListener('click', () => {
          wmPreviewIdx = idx;
          wmRenderPreview();
          thumbsEl.querySelectorAll('img').forEach(t => t.style.borderColor = 'transparent');
          thumb.style.borderColor = 'var(--saffron-400)';
        });
        thumbsEl.appendChild(thumb);
        if (wmImages.length === 1) {
          wmPreviewIdx = 0;
          wmRenderPreview();
          thumb.style.borderColor = 'var(--saffron-400)';
        }
      }
    });
  });

  // Clear button
  $('btn-wm-clear').addEventListener('click', async () => {
    if (wmImages.length) {
      const ok = await pixDialog.confirm('Clear Images', `Remove all ${wmImages.length} images?`, { danger: true, okText: 'Clear' });
      if (!ok) return;
    }
    wmImages = [];
    wmPreviewIdx = 0;
    updateCount();
    canvas.style.display = 'none';
    dropzone.style.display = '';
    thumbsEl.style.display = 'none';
    thumbsEl.innerHTML = '';
  });

  // Type toggle (Text / Logo)
  $('wm-type-text').addEventListener('click', () => {
    wmType = 'text';
    $('wm-type-text').classList.add('active');
    $('wm-type-logo').classList.remove('active');
    $('wm-text-group').style.display = '';
    $('wm-logo-row').style.display = 'none';
    wmDebouncedPreview();
  });
  $('wm-type-logo').addEventListener('click', () => {
    wmType = 'logo';
    $('wm-type-logo').classList.add('active');
    $('wm-type-text').classList.remove('active');
    $('wm-text-group').style.display = 'none';
    $('wm-logo-row').style.display = '';
    wmDebouncedPreview();
  });

  // Logo upload
  $('btn-wm-logo-upload').addEventListener('click', () => logoInput.click());
  logoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    wmLogo = await loadImg(file);
    $('wm-logo-name').textContent = file.name;
    wmDebouncedPreview();
  });

  // Position grid
  $$('.wm-pos-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      wmPosition = btn.dataset.pos;
      $$('.wm-pos-btn').forEach(b => {
        b.classList.remove('active');
        b.querySelector('span').style.background = 'var(--slate-500)';
      });
      btn.classList.add('active');
      btn.querySelector('span').style.background = 'var(--saffron-400)';
      wmDebouncedPreview();
    });
  });

  // Style sliders — live update
  ['wm-opacity', 'wm-size', 'wm-rotation', 'wm-margin'].forEach(id => {
    const el = document.getElementById(id);
    const valEl = document.getElementById(id + '-val');
    el.addEventListener('input', () => {
      valEl.textContent = el.value;
      wmDebouncedPreview();
    });
  });

  // Mode dropdown — show/hide tile gap
  $('wm-mode').addEventListener('change', () => {
    const mode = $('wm-mode').value;
    $('wm-tile-row').style.display = mode === 'tile' ? '' : 'none';
    $('wm-position-group').style.display = mode === 'single' ? '' : 'none';
    wmDebouncedPreview();
  });

  // Tile gap num-spin buttons
  $$('#wm-tile-row .num-spin-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $('wm-tile-gap');
      const step = btn.dataset.dir === 'up' ? 10 : -10;
      inp.value = Math.max(20, Math.min(500, parseInt(inp.value || 100) + step));
      wmDebouncedPreview();
    });
  });

  // Text / color / font change triggers preview
  ['wm-text', 'wm-font', 'wm-text-color', 'wm-shadow', 'wm-shadow-color'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const ev = el.type === 'checkbox' ? 'change' : 'input';
    el.addEventListener(ev, () => wmDebouncedPreview());
  });

  // Preview button
  $('btn-wm-preview').addEventListener('click', () => wmRenderPreview());

  // Apply All button
  $('btn-wm-apply').addEventListener('click', () => wmApplyAll());

  // Download ZIP button
  $('btn-wm-download').addEventListener('click', () => wmDownloadZip());
}

function wmDebouncedPreview() {
  clearTimeout(wmPreviewTimer);
  wmPreviewTimer = setTimeout(() => wmRenderPreview(), 150);
}

function getWmOptions() {
  return {
    type: wmType,
    text: $('wm-text').value || 'Watermark',
    font: $('wm-font').value,
    textColor: $('wm-text-color').value,
    shadowEnabled: $('wm-shadow').checked,
    shadowColor: $('wm-shadow-color').value,
    logoImg: wmLogo,
    position: wmPosition,
    opacity: parseInt($('wm-opacity').value),
    size: parseInt($('wm-size').value),
    rotation: parseInt($('wm-rotation').value),
    margin: parseInt($('wm-margin').value),
    mode: $('wm-mode').value,
    tileGap: parseInt($('wm-tile-gap').value) || 100,
  };
}

function wmRenderPreview() {
  if (!wmImages.length) return;
  const idx = Math.min(wmPreviewIdx, wmImages.length - 1);
  const sourceImg = wmImages[idx].img;
  const options = getWmOptions();
  const result = applyWatermark(sourceImg, options);
  const canvas = $('wm-canvas');
  canvas.width = result.width;
  canvas.height = result.height;
  canvas.getContext('2d').drawImage(result, 0, 0);
  canvas.style.display = 'block';
}

function getWatermarkPosition(position, canvasW, canvasH, wmW, wmH, margin) {
  const m = margin;
  const positions = {
    'tl': { x: m, y: m },
    'tc': { x: (canvasW - wmW) / 2, y: m },
    'tr': { x: canvasW - wmW - m, y: m },
    'cl': { x: m, y: (canvasH - wmH) / 2 },
    'cc': { x: (canvasW - wmW) / 2, y: (canvasH - wmH) / 2 },
    'cr': { x: canvasW - wmW - m, y: (canvasH - wmH) / 2 },
    'bl': { x: m, y: canvasH - wmH - m },
    'bc': { x: (canvasW - wmW) / 2, y: canvasH - wmH - m },
    'br': { x: canvasW - wmW - m, y: canvasH - wmH - m },
  };
  return positions[position] || positions['br'];
}

function drawWatermarkAt(ctx, cw, ch, options) {
  if (options.type === 'text') {
    const fontSize = Math.round(cw * options.size / 100 / 5);
    ctx.font = `bold ${fontSize}px ${options.font}`;
    ctx.fillStyle = options.textColor;
    ctx.textBaseline = 'top';
    const metrics = ctx.measureText(options.text);
    const wmW = metrics.width;
    const wmH = fontSize;
    const pos = getWatermarkPosition(options.position, cw, ch, wmW, wmH, options.margin);

    ctx.save();
    if (options.rotation !== 0) {
      ctx.translate(pos.x + wmW / 2, pos.y + wmH / 2);
      ctx.rotate(options.rotation * Math.PI / 180);
      ctx.translate(-(pos.x + wmW / 2), -(pos.y + wmH / 2));
    }
    if (options.shadowEnabled) {
      ctx.shadowColor = options.shadowColor;
      ctx.shadowBlur = Math.max(2, fontSize * 0.1);
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
    }
    ctx.fillText(options.text, pos.x, pos.y);
    ctx.restore();
  } else if (options.type === 'logo' && options.logoImg) {
    const logoW = cw * options.size / 100;
    const logoH = logoW * (options.logoImg.naturalHeight / options.logoImg.naturalWidth);
    const pos = getWatermarkPosition(options.position, cw, ch, logoW, logoH, options.margin);

    ctx.save();
    if (options.rotation !== 0) {
      ctx.translate(pos.x + logoW / 2, pos.y + logoH / 2);
      ctx.rotate(options.rotation * Math.PI / 180);
      ctx.translate(-(pos.x + logoW / 2), -(pos.y + logoH / 2));
    }
    ctx.drawImage(options.logoImg, pos.x, pos.y, logoW, logoH);
    ctx.restore();
  }
}

function applyWatermark(sourceImg, options) {
  const c = document.createElement('canvas');
  c.width = sourceImg.naturalWidth || sourceImg.width;
  c.height = sourceImg.naturalHeight || sourceImg.height;
  const ctx = c.getContext('2d');

  // Draw source image
  ctx.drawImage(sourceImg, 0, 0);

  // Apply watermark based on mode
  ctx.globalAlpha = options.opacity / 100;

  if (options.mode === 'single') {
    drawWatermarkAt(ctx, c.width, c.height, options);
  } else if (options.mode === 'tile') {
    // Calculate watermark size for tiling
    let wmW, wmH;
    if (options.type === 'text') {
      const fontSize = Math.round(c.width * options.size / 100 / 5);
      ctx.font = `bold ${fontSize}px ${options.font}`;
      wmW = ctx.measureText(options.text).width;
      wmH = fontSize;
    } else if (options.logoImg) {
      wmW = c.width * options.size / 100;
      wmH = wmW * (options.logoImg.naturalHeight / options.logoImg.naturalWidth);
    } else {
      wmW = wmH = 50;
    }
    const gap = options.tileGap;
    const cols = Math.ceil(c.width / (wmW + gap)) + 1;
    const rows = Math.ceil(c.height / (wmH + gap)) + 1;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = col * (wmW + gap);
        const y = row * (wmH + gap);
        ctx.save();
        if (options.rotation !== 0) {
          ctx.translate(x + wmW / 2, y + wmH / 2);
          ctx.rotate(options.rotation * Math.PI / 180);
          ctx.translate(-wmW / 2, -wmH / 2);
        } else {
          ctx.translate(x, y);
        }
        if (options.type === 'text') {
          const fontSize = Math.round(c.width * options.size / 100 / 5);
          ctx.font = `bold ${fontSize}px ${options.font}`;
          ctx.fillStyle = options.textColor;
          ctx.textBaseline = 'top';
          if (options.shadowEnabled) {
            ctx.shadowColor = options.shadowColor;
            ctx.shadowBlur = Math.max(2, fontSize * 0.1);
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
          }
          ctx.fillText(options.text, 0, 0);
        } else if (options.logoImg) {
          ctx.drawImage(options.logoImg, 0, 0, wmW, wmH);
        }
        ctx.restore();
      }
    }
  } else if (options.mode === 'diagonal') {
    // Diagonal repeating text/logo across the image
    const angle = options.rotation || -45;
    let wmW, wmH;
    if (options.type === 'text') {
      const fontSize = Math.round(c.width * options.size / 100 / 5);
      ctx.font = `bold ${fontSize}px ${options.font}`;
      wmW = ctx.measureText(options.text).width;
      wmH = fontSize;
    } else if (options.logoImg) {
      wmW = c.width * options.size / 100;
      wmH = wmW * (options.logoImg.naturalHeight / options.logoImg.naturalWidth);
    } else {
      wmW = wmH = 50;
    }
    const gap = options.tileGap;
    const diag = Math.sqrt(c.width * c.width + c.height * c.height);
    const rowCount = Math.ceil(diag / (wmH + gap)) + 2;
    const colCount = Math.ceil(diag / (wmW + gap)) + 2;

    ctx.save();
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate(angle * Math.PI / 180);

    for (let row = -rowCount; row < rowCount; row++) {
      for (let col = -colCount; col < colCount; col++) {
        const x = col * (wmW + gap);
        const y = row * (wmH + gap);
        if (options.type === 'text') {
          const fontSize = Math.round(c.width * options.size / 100 / 5);
          ctx.font = `bold ${fontSize}px ${options.font}`;
          ctx.fillStyle = options.textColor;
          ctx.textBaseline = 'top';
          if (options.shadowEnabled) {
            ctx.shadowColor = options.shadowColor;
            ctx.shadowBlur = Math.max(2, fontSize * 0.1);
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 1;
          }
          ctx.fillText(options.text, x, y);
        } else if (options.logoImg) {
          ctx.drawImage(options.logoImg, x, y, wmW, wmH);
        }
      }
    }
    ctx.restore();
  }

  ctx.globalAlpha = 1;
  return c;
}

async function wmApplyAll() {
  if (!wmImages.length) { pixDialog.alert('No Images', 'Load images first.'); return; }
  const options = getWmOptions();
  if (options.type === 'text' && !$('wm-text').value.trim()) {
    pixDialog.alert('No Text', 'Enter watermark text.'); return;
  }
  if (options.type === 'logo' && !wmLogo) {
    pixDialog.alert('No Logo', 'Upload a logo image first.'); return;
  }

  const format = $('wm-format').value;
  const mime = format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png';
  const quality = format === 'jpeg' ? 0.85 : format === 'webp' ? 0.85 : undefined;

  const results = [];
  for (let i = 0; i < wmImages.length; i++) {
    const result = applyWatermark(wmImages[i].img, options);
    const blob = await new Promise(r => result.toBlob(r, mime, quality));
    const ext = format === 'jpeg' ? 'jpg' : format;
    const name = wmImages[i].name.replace(/\.[^.]+$/, '') + '-wm.' + ext;
    results.push({ name, blob });
  }

  // Store for download
  wmApplyAll._results = results;
  pixDialog.alert('Done', `Applied watermark to ${results.length} image(s). Click "Download ZIP" to export.`);
}

async function wmDownloadZip() {
  const results = wmApplyAll._results;
  if (!results || !results.length) {
    // Apply first if not yet done
    await wmApplyAll();
    if (!wmApplyAll._results || !wmApplyAll._results.length) return;
    return wmDownloadZip();
  }

  const zip = new ZipWriter();
  for (const r of results) {
    await zip.addBlob(r.name, r.blob);
  }
  const zipBlob = zip.toBlob();
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pixeroo-watermarked.zip';
  a.click();
  URL.revokeObjectURL(url);
}
