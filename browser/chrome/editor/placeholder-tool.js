// Pixeroo — Placeholder Image Generator Tool

function initPlaceholder() {
  const canvas = $('ph-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let locked = false, ratio = 0;

  // ── Live preview on any change ─────────────────────────
  function render() {
    const w = Math.max(1, Math.min(4096, +($('ph-w')?.value) || 800));
    const h = Math.max(1, Math.min(4096, +($('ph-h')?.value) || 600));
    canvas.width = w; canvas.height = h;

    const bg = $('ph-bg')?.value || '#94a3b8';
    const txColor = $('ph-text-color')?.value || '#ffffff';
    const text = $('ph-text')?.value || `${w}\u00D7${h}`;
    const font = $('ph-font')?.value || 'Inter, system-ui, sans-serif';
    const bold = $('ph-bold')?.checked;
    let fontSize = +($('ph-fontsize')?.value) || 0;
    const pattern = $('ph-pattern')?.value || 'none';
    const patternOp = (+($('ph-pattern-opacity')?.value) || 15) / 100;
    const hasBorder = $('ph-border')?.checked;
    const borderColor = $('ph-border-color')?.value || '#64748b';
    const rounded = $('ph-rounded')?.checked;
    const cornerR = rounded ? Math.min(w, h) * 0.04 : 0;

    // Rounded clip
    if (cornerR > 0) {
      ctx.beginPath();
      ctx.roundRect(0, 0, w, h, cornerR);
      ctx.clip();
    }

    // Background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Pattern overlay
    if (pattern !== 'none') {
      ctx.save();
      ctx.globalAlpha = patternOp;
      ctx.strokeStyle = txColor;
      ctx.lineWidth = 1;

      if (pattern === 'cross') {
        // Diagonal cross from corners
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(w, h);
        ctx.moveTo(w, 0); ctx.lineTo(0, h);
        ctx.stroke();
      } else if (pattern === 'grid') {
        const step = Math.max(20, Math.min(w, h) / 10);
        ctx.beginPath();
        for (let x = step; x < w; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = step; y < h; y += step) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
      } else if (pattern === 'diagonal') {
        const step = Math.max(15, Math.min(w, h) / 15);
        ctx.beginPath();
        for (let d = -h; d < w + h; d += step) {
          ctx.moveTo(d, 0); ctx.lineTo(d + h, h);
        }
        ctx.stroke();
      } else if (pattern === 'dots') {
        const step = Math.max(15, Math.min(w, h) / 12);
        const r = Math.max(1.5, step * 0.08);
        ctx.fillStyle = txColor;
        for (let x = step; x < w; x += step) {
          for (let y = step; y < h; y += step) {
            ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      ctx.restore();
    }

    // Border
    if (hasBorder) {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = Math.max(2, Math.min(w, h) * 0.005);
      if (cornerR > 0) {
        ctx.beginPath(); ctx.roundRect(1, 1, w - 2, h - 2, Math.max(0, cornerR - 1)); ctx.stroke();
      } else {
        ctx.strokeRect(1, 1, w - 2, h - 2);
      }
    }

    // Text
    if (fontSize === 0) {
      // Auto-size: fit text within 80% of dimensions
      fontSize = Math.max(10, Math.min(w * 0.8 / (text.length * 0.55), h * 0.25));
    }
    ctx.fillStyle = txColor;
    ctx.font = `${bold ? 'bold ' : ''}${fontSize}px ${font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, w / 2, h / 2);

    // Update dims badge
    $('ph-dims').textContent = `${w} \u00D7 ${h}`;

    // Update placeholder text input placeholder
    $('ph-text').placeholder = `Auto (${w}\u00D7${h})`;
  }

  // ── Bind all inputs to live preview ─────────────────────
  const inputs = ['ph-w', 'ph-h', 'ph-bg', 'ph-text-color', 'ph-text', 'ph-font',
    'ph-fontsize', 'ph-bold', 'ph-border', 'ph-border-color', 'ph-rounded',
    'ph-pattern', 'ph-pattern-opacity'];
  inputs.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  // Pattern opacity value display
  $('ph-pattern-opacity')?.addEventListener('input', () => {
    $('ph-pattern-opacity-val').textContent = $('ph-pattern-opacity').value;
  });

  // ── Size presets ────────────────────────────────────────
  $('ph-preset')?.addEventListener('change', (e) => {
    const val = e.target.value;
    if (!val) return;
    const [pw, ph] = val.split(',').map(Number);
    $('ph-w').value = pw;
    $('ph-h').value = ph;
    if (locked) ratio = pw / ph;
    render();
  });

  // ── Aspect lock ─────────────────────────────────────────
  $('ph-lock')?.addEventListener('click', () => {
    locked = !locked;
    $('ph-lock').style.color = locked ? 'var(--saffron-400)' : '';
    if (locked) ratio = (+$('ph-w').value) / (+$('ph-h').value || 1);
  });

  $('ph-w')?.addEventListener('input', () => {
    if (locked && ratio) $('ph-h').value = Math.round(+$('ph-w').value / ratio);
    render();
  });
  $('ph-h')?.addEventListener('input', () => {
    if (locked && ratio) $('ph-w').value = Math.round(+$('ph-h').value * ratio);
    render();
  });

  // ── Color presets ───────────────────────────────────────
  $$('.ph-color-preset').forEach(swatch => {
    swatch.addEventListener('click', () => {
      $('ph-bg').value = swatch.dataset.bg;
      $('ph-text-color').value = swatch.dataset.tx;
      render();
    });
  });

  // ── Export ──────────────────────────────────────────────
  $('btn-ph-export')?.addEventListener('click', () => {
    if (!canvas.width) return;
    const fmt = $('ph-export-fmt')?.value || 'png';

    if (fmt === 'svg') {
      exportAsSvg();
      return;
    }

    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png';
    canvas.toBlob(blob => {
      const w = canvas.width, h = canvas.height;
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/placeholder-${w}x${h}.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });

  // ── SVG export ──────────────────────────────────────────
  function exportAsSvg() {
    const w = +$('ph-w').value || 800, h = +$('ph-h').value || 600;
    const bg = $('ph-bg')?.value || '#94a3b8';
    const txColor = $('ph-text-color')?.value || '#ffffff';
    const text = $('ph-text')?.value || `${w}\u00D7${h}`;
    const font = $('ph-font')?.value || 'Inter, system-ui, sans-serif';
    const bold = $('ph-bold')?.checked;
    let fontSize = +($('ph-fontsize')?.value) || 0;
    if (fontSize === 0) fontSize = Math.max(10, Math.min(w * 0.8 / (text.length * 0.55), h * 0.25));
    const rounded = $('ph-rounded')?.checked;
    const cornerR = rounded ? Math.min(w, h) * 0.04 : 0;
    const hasBorder = $('ph-border')?.checked;
    const borderColor = $('ph-border-color')?.value || '#64748b';
    const pattern = $('ph-pattern')?.value || 'none';
    const patternOp = (+($('ph-pattern-opacity')?.value) || 15) / 100;

    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;
    svg += `<rect width="${w}" height="${h}" fill="${bg}" rx="${cornerR}"/>`;

    // Pattern
    if (pattern !== 'none') {
      svg += `<g opacity="${patternOp}" stroke="${txColor}" stroke-width="1" fill="none">`;
      if (pattern === 'cross') {
        svg += `<line x1="0" y1="0" x2="${w}" y2="${h}"/><line x1="${w}" y1="0" x2="0" y2="${h}"/>`;
      } else if (pattern === 'grid') {
        const step = Math.max(20, Math.min(w, h) / 10);
        for (let x = step; x < w; x += step) svg += `<line x1="${x}" y1="0" x2="${x}" y2="${h}"/>`;
        for (let y = step; y < h; y += step) svg += `<line x1="0" y1="${y}" x2="${w}" y2="${y}"/>`;
      } else if (pattern === 'diagonal') {
        const step = Math.max(15, Math.min(w, h) / 15);
        for (let d = -h; d < w + h; d += step) svg += `<line x1="${d}" y1="0" x2="${d + h}" y2="${h}"/>`;
      } else if (pattern === 'dots') {
        const step = Math.max(15, Math.min(w, h) / 12);
        const r = Math.max(1.5, step * 0.08);
        svg += `</g><g opacity="${patternOp}" fill="${txColor}">`;
        for (let x = step; x < w; x += step) for (let y = step; y < h; y += step) svg += `<circle cx="${x}" cy="${y}" r="${r}"/>`;
      }
      svg += `</g>`;
    }

    // Border
    if (hasBorder) {
      const bw = Math.max(2, Math.min(w, h) * 0.005);
      svg += `<rect x="${bw / 2}" y="${bw / 2}" width="${w - bw}" height="${h - bw}" rx="${Math.max(0, cornerR - 1)}" fill="none" stroke="${borderColor}" stroke-width="${bw}"/>`;
    }

    // Text
    svg += `<text x="${w / 2}" y="${h / 2}" fill="${txColor}" font-family="${font}" font-size="${fontSize}" font-weight="${bold ? 'bold' : 'normal'}" text-anchor="middle" dominant-baseline="central">${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`;
    svg += `</svg>`;

    const blob = new Blob([svg], { type: 'image/svg+xml' });
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/placeholder-${w}x${h}.svg`, saveAs: true });
  }

  // ── Batch generation ────────────────────────────────────
  $('btn-ph-batch')?.addEventListener('click', async () => {
    const input = $('ph-batch')?.value?.trim();
    if (!input) return;
    const sizes = input.split(',').map(s => s.trim()).filter(s => /^\d+[x×]\d+$/i.test(s));
    if (!sizes.length) return;

    // Build ZIP with all sizes
    if (typeof ZipWriter === 'undefined') { console.warn('ZipWriter not available'); return; }
    const zip = new ZipWriter();
    const fmt = $('ph-export-fmt')?.value || 'png';
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png';

    const origW = $('ph-w').value, origH = $('ph-h').value;

    for (const size of sizes) {
      const [sw, sh] = size.split(/[x×]/i).map(Number);
      if (!sw || !sh || sw > 4096 || sh > 4096) continue;
      $('ph-w').value = sw; $('ph-h').value = sh;
      render();

      if (fmt === 'svg') {
        // For SVG batch we'd need the SVG string — skip for now, use raster
      }
      const blob = await new Promise(r => canvas.toBlob(r, mime, 0.92));
      const buf = await blob.arrayBuffer();
      zip.addFile(`placeholder-${sw}x${sh}.${fmt === 'jpeg' ? 'jpg' : fmt}`, new Uint8Array(buf));
    }

    // Restore original size
    $('ph-w').value = origW; $('ph-h').value = origH;
    render();

    const zipBlob = zip.finish();
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(zipBlob), filename: 'pixeroo/placeholders.zip', saveAs: true });
  });

  // ── Save to Library ─────────────────────────────────────
  $('btn-ph-save-lib')?.addEventListener('click', async () => {
    if (!canvas.width) return;
    const dataUrl = canvas.toDataURL('image/png');
    const w = canvas.width, h = canvas.height;
    if (typeof PixLibrary !== 'undefined') {
      await PixLibrary.add({ dataUrl, source: 'placeholder', name: `placeholder-${w}x${h}`, width: w, height: h, type: 'image', size: dataUrl.length });
    }
  });

  // ── Initial render ──────────────────────────────────────
  render();
}
