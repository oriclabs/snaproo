// Snaproo — Meme Generator Tool

function initMeme() {
  const canvas = $('meme-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let memeImg = null;

  const dropzone = $('meme-dropzone');

  // ── Meme templates (blank white canvas with standard sizes) ──
  const TEMPLATES = {
    custom:    { w: 0,   h: 0,   name: 'Custom Image' },
    drake:     { w: 600, h: 600, name: 'Two Panel (Drake)', panels: 2, layout: 'vertical-half' },
    distracted:{ w: 800, h: 450, name: 'Wide Panel',        panels: 1, layout: 'wide' },
    expanding: { w: 600, h: 800, name: 'Expanding Brain',   panels: 4, layout: 'rows' },
    twobutton: { w: 600, h: 600, name: 'Two Buttons',       panels: 2, layout: 'vertical-half' },
    comparison:{ w: 800, h: 400, name: 'Comparison',        panels: 2, layout: 'side' },
    quadrant:  { w: 600, h: 600, name: 'Four Panel',        panels: 4, layout: 'grid' },
    standard:  { w: 600, h: 600, name: 'Standard',          panels: 1, layout: 'full' },
    wide:      { w: 800, h: 400, name: 'Wide',              panels: 1, layout: 'full' },
    tall:      { w: 500, h: 800, name: 'Tall',              panels: 1, layout: 'full' },
  };

  // ── Draw meme text (outline style) ─────────────────────
  function drawMemeText(ctx, text, x, y, maxWidth, fontSize, color, strokeColor) {
    if (!text) return;
    ctx.font = `bold ${fontSize}px ${$('meme-font')?.value || 'Impact, sans-serif'}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = color;
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = Math.max(2, fontSize * 0.06);
    ctx.lineJoin = 'round';

    // Word wrap
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    for (const word of words) {
      const testLine = currentLine ? currentLine + ' ' + word : word;
      if (ctx.measureText(testLine).width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);

    const lineH = fontSize * 1.15;
    let drawY = y;
    for (const line of lines) {
      ctx.strokeText(line.toUpperCase(), x, drawY);
      ctx.fillText(line.toUpperCase(), x, drawY);
      drawY += lineH;
    }
    return lines.length * lineH;
  }

  // ── Render ─────────────────────────────────────────────
  function render() {
    const tpl = $('meme-template')?.value || 'custom';
    const template = TEMPLATES[tpl];
    const topText = $('meme-top')?.value || '';
    const bottomText = $('meme-bottom')?.value || '';
    const midText = $('meme-mid')?.value || '';
    const fontSize = +($('meme-fontsize')?.value) || 0;
    const textColor = $('meme-text-color')?.value || '#ffffff';
    const strokeColor = $('meme-stroke-color')?.value || '#000000';
    const useStroke = $('meme-stroke')?.checked !== false;
    const padPct = +($('meme-padding')?.value) || 4;

    let w, h;
    if (memeImg && tpl === 'custom') {
      w = memeImg.naturalWidth;
      h = memeImg.naturalHeight;
    } else if (template && template.w) {
      w = template.w;
      h = template.h;
    } else if (memeImg) {
      w = memeImg.naturalWidth;
      h = memeImg.naturalHeight;
    } else {
      w = 600; h = 600;
    }

    canvas.width = w;
    canvas.height = h;

    // Background
    if (memeImg) {
      // Fit image to canvas
      const scale = Math.min(w / memeImg.naturalWidth, h / memeImg.naturalHeight);
      const iw = memeImg.naturalWidth * scale;
      const ih = memeImg.naturalHeight * scale;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(memeImg, (w - iw) / 2, (h - ih) / 2, iw, ih);
    } else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      // Draw panel guides for templates
      if (template && template.panels > 1) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 2;
        if (template.layout === 'vertical-half' || template.layout === 'rows') {
          const rowH = h / template.panels;
          for (let i = 1; i < template.panels; i++) {
            ctx.beginPath(); ctx.moveTo(0, rowH * i); ctx.lineTo(w, rowH * i); ctx.stroke();
          }
        } else if (template.layout === 'side') {
          ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
        } else if (template.layout === 'grid') {
          ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();
        }
      }
    }

    // Calculate font size
    const pad = w * padPct / 100;
    const maxW = w - pad * 2;
    const fs = fontSize || Math.max(16, Math.min(w * 0.08, 60));
    const sColor = useStroke ? strokeColor : 'transparent';

    // Top text
    if (topText) {
      drawMemeText(ctx, topText, w / 2, pad, maxW, fs, textColor, sColor);
    }

    // Bottom text
    if (bottomText) {
      // Measure height to position from bottom
      ctx.font = `bold ${fs}px ${$('meme-font')?.value || 'Impact, sans-serif'}`;
      const words = bottomText.split(' ');
      let lines = 0, currentLine = '';
      for (const word of words) {
        const testLine = currentLine ? currentLine + ' ' + word : word;
        if (ctx.measureText(testLine).width > maxW && currentLine) { lines++; currentLine = word; }
        else currentLine = testLine;
      }
      lines++;
      const totalH = lines * fs * 1.15;
      drawMemeText(ctx, bottomText, w / 2, h - pad - totalH, maxW, fs, textColor, sColor);
    }

    // Middle text (for multi-panel memes)
    if (midText) {
      drawMemeText(ctx, midText, w / 2, h / 2 - fs * 0.6, maxW, fs, textColor, sColor);
    }

    $('meme-dims').textContent = `${w} \u00D7 ${h}`;
  }

  // ── Drop zone ──────────────────────────────────────────
  setupDropzone(dropzone, $('meme-file'), async (file) => {
    memeImg = await loadImg(file);
    if (!memeImg) return;
    dropzone.style.display = 'none';
    canvas.style.display = 'block';
    $('meme-ribbon')?.classList.remove('disabled');
    render();
  });

  // Paste support
  document.addEventListener('paste', (e) => {
    if (currentMode !== 'meme') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        loadImg(item.getAsFile()).then(img => {
          if (!img) return;
          memeImg = img;
          dropzone.style.display = 'none';
          canvas.style.display = 'block';
          $('meme-ribbon')?.classList.remove('disabled');
          render();
        });
        break;
      }
    }
  });

  // ── Use template without image ─────────────────────────
  $('meme-template')?.addEventListener('change', () => {
    const tpl = $('meme-template').value;
    if (tpl !== 'custom') {
      // Allow rendering without image for templates
      dropzone.style.display = 'none';
      canvas.style.display = 'block';
      $('meme-ribbon')?.classList.remove('disabled');
    }
    render();
  });

  // ── Bind inputs ────────────────────────────────────────
  const inputs = ['meme-top', 'meme-bottom', 'meme-mid', 'meme-fontsize', 'meme-font',
    'meme-text-color', 'meme-stroke-color', 'meme-stroke', 'meme-padding'];
  inputs.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  $('meme-fontsize')?.addEventListener('input', () => { $('meme-fontsize-val').textContent = +$('meme-fontsize').value || 'Auto'; });
  $('meme-padding')?.addEventListener('input', () => { $('meme-padding-val').textContent = $('meme-padding').value + '%'; });

  // ── New / Library ──────────────────────────────────────
  $('btn-meme-new')?.addEventListener('click', () => {
    memeImg = null;
    canvas.style.display = 'none';
    dropzone.style.display = '';
    $('meme-ribbon')?.classList.add('disabled');
    $('meme-dims').textContent = '';
  });

  $('btn-meme-from-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      if (!items.length) return;
      const img = new Image();
      img.src = items[0].dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      memeImg = img;
      dropzone.style.display = 'none';
      canvas.style.display = 'block';
      $('meme-ribbon')?.classList.remove('disabled');
      render();
    }, { singleSelect: true });
  });

  // ── Export ─────────────────────────────────────────────
  $('btn-meme-export')?.addEventListener('click', () => {
    if (!canvas.width) return;
    const fmt = $('meme-export-fmt')?.value || 'png';
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png';
    canvas.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `snaproo/meme.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });

  $('btn-meme-save-lib')?.addEventListener('click', async () => {
    if (!canvas.width) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (typeof PixLibrary !== 'undefined') {
      await PixLibrary.add({ dataUrl, source: 'meme', name: 'meme', width: canvas.width, height: canvas.height, type: 'image', size: dataUrl.length });
    }
  });

  $('btn-meme-copy')?.addEventListener('click', async () => {
    if (!canvas.width) return;
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {}
  });
}
