// Pixeroo — Screenshot Beautifier Tool

function initScreenshotBeautifier() {
  const canvas = $('ss-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let ssImg = null;

  const dropzone = $('ss-dropzone');

  // ── Gradient presets ────────────────────────────────────
  const GRAD_PRESETS = [
    { name: 'Sunset',    c1: '#f97316', c2: '#ec4899' },
    { name: 'Ocean',     c1: '#06b6d4', c2: '#3b82f6' },
    { name: 'Forest',    c1: '#22c55e', c2: '#14b8a6' },
    { name: 'Lavender',  c1: '#a855f7', c2: '#6366f1' },
    { name: 'Slate',     c1: '#334155', c2: '#1e293b' },
    { name: 'Warm',      c1: '#f59e0b', c2: '#ef4444' },
    { name: 'Night',     c1: '#1e1b4b', c2: '#312e81' },
    { name: 'Mint',      c1: '#6ee7b7', c2: '#34d399' },
    { name: 'Rose',      c1: '#fda4af', c2: '#fb7185' },
    { name: 'Graphite',  c1: '#4b5563', c2: '#111827' },
  ];

  // ── Frame templates (SVG device outlines) ──────────────
  const FRAMES = {
    none: { label: 'None', pad: [0,0,0,0] },
    'browser-light': { label: 'Browser', barH: 32, barBg: '#f1f5f9', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#e2e8f0', radius: 8 },
    'browser-dark': { label: 'Browser Dark', barH: 32, barBg: '#1e293b', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#334155', radius: 8 },
    'window-mac': { label: 'macOS', barH: 28, barBg: '#e2e8f0', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#cbd5e1', radius: 10, macStyle: true },
    'window-mac-dark': { label: 'macOS Dark', barH: 28, barBg: '#1e293b', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#334155', radius: 10, macStyle: true },
    'terminal': { label: 'Terminal', barH: 28, barBg: '#1e1e2e', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#313244', radius: 10, macStyle: true },
  };

  // ── Render ─────────────────────────────────────────────
  function render() {
    if (!ssImg) return;

    const padding = +($('ss-padding')?.value) || 40;
    const radius = +($('ss-radius')?.value) || 12;
    const shadowSize = +($('ss-shadow')?.value) || 20;
    const bgType = $('ss-bg-type')?.value || 'gradient';
    const bgColor1 = $('ss-bg-c1')?.value || '#f97316';
    const bgColor2 = $('ss-bg-c2')?.value || '#ec4899';
    const gradAngle = +($('ss-grad-angle')?.value) || 135;
    const frameName = $('ss-frame')?.value || 'none';
    const frame = FRAMES[frameName] || FRAMES.none;
    const scale = +($('ss-scale')?.value) || 100;

    const imgW = Math.round(ssImg.naturalWidth * scale / 100);
    const imgH = Math.round(ssImg.naturalHeight * scale / 100);

    // Frame adds a title bar on top
    const frameBarH = frame.barH || 0;
    const frameR = frame.radius || 0;
    const frameBorder = frameName !== 'none' ? 1 : 0;

    // Total content area (image + frame)
    const contentW = imgW + frameBorder * 2;
    const contentH = imgH + frameBarH + frameBorder * 2;

    // Canvas = content + padding + shadow margin
    const shadowMargin = shadowSize > 0 ? shadowSize * 2 : 0;
    const canvasW = contentW + padding * 2 + shadowMargin;
    const canvasH = contentH + padding * 2 + shadowMargin;

    canvas.width = canvasW;
    canvas.height = canvasH;

    // Background
    if (bgType === 'gradient') {
      const a = gradAngle * Math.PI / 180;
      const cx = canvasW / 2, cy = canvasH / 2;
      const len = Math.max(canvasW, canvasH);
      const x1 = cx - Math.cos(a) * len / 2, y1 = cy - Math.sin(a) * len / 2;
      const x2 = cx + Math.cos(a) * len / 2, y2 = cy + Math.sin(a) * len / 2;
      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, bgColor1);
      grad.addColorStop(1, bgColor2);
      ctx.fillStyle = grad;
    } else if (bgType === 'solid') {
      ctx.fillStyle = bgColor1;
    } else {
      // transparent — leave clear
      ctx.clearRect(0, 0, canvasW, canvasH);
    }
    if (bgType !== 'transparent') ctx.fillRect(0, 0, canvasW, canvasH);

    // Content position (centered)
    const cx = (canvasW - contentW) / 2;
    const cy = (canvasH - contentH) / 2;

    // Shadow
    if (shadowSize > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = shadowSize;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = shadowSize * 0.3;

      // Draw shadow shape (rounded rect for content area)
      const r = frameName !== 'none' ? frameR : radius;
      ctx.beginPath();
      ctx.roundRect(cx, cy, contentW, contentH, r);
      ctx.fillStyle = 'rgba(0,0,0,1)'; // opaque to generate shadow, will be drawn over
      ctx.fill();
      ctx.restore();
    }

    // Frame
    if (frameName !== 'none') {
      _drawFrame(ctx, cx, cy, contentW, contentH, imgW, imgH, frame);
    }

    // Screenshot image (clipped with radius)
    ctx.save();
    const imgX = cx + frameBorder;
    const imgY = cy + frameBarH + frameBorder;
    const imgR = frameName !== 'none' ? 0 : radius;
    const bottomR = frameName !== 'none' ? Math.max(0, frameR - 1) : radius;

    if (imgR > 0 || bottomR > 0) {
      ctx.beginPath();
      if (frameName !== 'none') {
        // Only round bottom corners when framed
        ctx.roundRect(imgX, imgY, imgW, imgH, [0, 0, bottomR, bottomR]);
      } else {
        ctx.roundRect(imgX, imgY, imgW, imgH, imgR);
      }
      ctx.clip();
    }
    ctx.drawImage(ssImg, imgX, imgY, imgW, imgH);
    ctx.restore();

    // Dims
    $('ss-dims').textContent = `${canvasW} \u00D7 ${canvasH}`;
  }

  // ── Draw browser/window frame ──────────────────────────
  function _drawFrame(ctx, x, y, w, h, imgW, imgH, frame) {
    const r = frame.radius || 0;
    const barH = frame.barH || 0;

    // Frame background (full rounded rect)
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = frame.barBg;
    ctx.fill();

    // Border
    if (frame.borderColor) {
      ctx.strokeStyle = frame.borderColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Title bar separator
    ctx.beginPath();
    ctx.moveTo(x + 1, y + barH);
    ctx.lineTo(x + w - 1, y + barH);
    ctx.strokeStyle = frame.borderColor || '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Traffic lights / dots
    if (frame.dotColors) {
      const dotR = frame.macStyle ? 5 : 5;
      const dotY = y + barH / 2;
      const startX = x + (frame.macStyle ? 16 : 14);
      const gap = frame.macStyle ? 18 : 18;
      frame.dotColors.forEach((color, i) => {
        ctx.beginPath();
        ctx.arc(startX + i * gap, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      });
    }

    // URL bar for browser frames
    if (frame.label.includes('Browser')) {
      const barX = x + 80;
      const barW = w - 160;
      const barY = y + 8;
      const barHH = barH - 16;
      if (barW > 60) {
        ctx.fillStyle = frame.barBg === '#1e293b' ? '#0f172a' : '#ffffff';
        ctx.beginPath();
        ctx.roundRect(barX, barY, barW, barHH, barHH / 2);
        ctx.fill();
        // URL text
        ctx.fillStyle = frame.barBg === '#1e293b' ? '#64748b' : '#94a3b8';
        ctx.font = '10px Inter, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('https://example.com', barX + barW / 2, barY + barHH / 2);
      }
    }
  }

  // ── Drop zone ──────────────────────────────────────────
  setupDropzone(dropzone, $('ss-file'), async (file) => {
    ssImg = await loadImg(file);
    if (!ssImg) return;
    dropzone.style.display = 'none';
    canvas.style.display = 'block';
    $('ss-ribbon')?.classList.remove('disabled');
    render();
  });

  // ── Paste support ──────────────────────────────────────
  document.addEventListener('paste', (e) => {
    if (currentMode !== 'screenshot') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          loadImg(file).then(img => {
            if (!img) return;
            ssImg = img;
            dropzone.style.display = 'none';
            canvas.style.display = 'block';
            $('ss-ribbon')?.classList.remove('disabled');
            render();
          });
        }
        break;
      }
    }
  });

  // ── Bind all inputs ────────────────────────────────────
  const inputs = ['ss-padding', 'ss-radius', 'ss-shadow', 'ss-bg-type', 'ss-bg-c1', 'ss-bg-c2',
    'ss-grad-angle', 'ss-frame', 'ss-scale'];
  inputs.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  // Range value displays
  $('ss-padding')?.addEventListener('input', () => { $('ss-padding-val').textContent = $('ss-padding').value; });
  $('ss-radius')?.addEventListener('input', () => { $('ss-radius-val').textContent = $('ss-radius').value; });
  $('ss-shadow')?.addEventListener('input', () => { $('ss-shadow-val').textContent = $('ss-shadow').value; });
  $('ss-grad-angle')?.addEventListener('input', () => { $('ss-grad-angle-val').textContent = $('ss-grad-angle').value + '\u00B0'; });
  $('ss-scale')?.addEventListener('input', () => { $('ss-scale-val').textContent = $('ss-scale').value + '%'; });

  // Background type toggle — show/hide gradient controls
  $('ss-bg-type')?.addEventListener('change', () => {
    const isGrad = $('ss-bg-type').value === 'gradient';
    $('ss-grad-controls').style.display = isGrad ? 'flex' : 'none';
  });

  // ── Gradient presets ───────────────────────────────────
  $$('.ss-grad-preset').forEach(swatch => {
    swatch.addEventListener('click', () => {
      $('ss-bg-c1').value = swatch.dataset.c1;
      $('ss-bg-c2').value = swatch.dataset.c2;
      $('ss-bg-type').value = 'gradient';
      $('ss-grad-controls').style.display = 'flex';
      render();
    });
  });

  // ── New image ──────────────────────────────────────────
  $('btn-ss-new')?.addEventListener('click', () => {
    ssImg = null;
    canvas.style.display = 'none';
    dropzone.style.display = '';
    $('ss-ribbon')?.classList.add('disabled');
    $('ss-dims').textContent = '';
  });

  // ── Library import ─────────────────────────────────────
  $('btn-ss-from-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      if (!items.length) return;
      const img = new Image();
      img.src = items[0].dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      ssImg = img;
      dropzone.style.display = 'none';
      canvas.style.display = 'block';
      $('ss-ribbon')?.classList.remove('disabled');
      render();
    }, { singleSelect: true });
  });

  // ── Export ─────────────────────────────────────────────
  $('btn-ss-export')?.addEventListener('click', () => {
    if (!canvas.width || !ssImg) return;
    const fmt = $('ss-export-fmt')?.value || 'png';
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png';
    canvas.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/screenshot-beautified.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });

  // ── Save to Library ────────────────────────────────────
  $('btn-ss-save-lib')?.addEventListener('click', async () => {
    if (!canvas.width || !ssImg) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (typeof PixLibrary !== 'undefined') {
      await PixLibrary.add({ dataUrl, source: 'screenshot', name: 'screenshot-beautified', width: canvas.width, height: canvas.height, type: 'image', size: dataUrl.length });
    }
  });

  // ── Copy to clipboard ──────────────────────────────────
  $('btn-ss-copy')?.addEventListener('click', async () => {
    if (!canvas.width || !ssImg) return;
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {}
  });
}
