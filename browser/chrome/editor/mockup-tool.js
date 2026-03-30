// Snaproo — Device Mockup Tool

function initMockup() {
  const canvas = $('mockup-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let mockImg = null;

  const dropzone = $('mockup-dropzone');

  // ── Device definitions ─────────────────────────────────
  // screen: { x, y, w, h } relative to device size (0-1 normalized)
  const DEVICES = {
    'iphone-15': {
      name: 'iPhone 15', w: 390, h: 780, radius: 48, bezel: 12,
      screen: { x: 0.031, y: 0.026, w: 0.938, h: 0.948 }, screenR: 38,
      notch: true, color: '#1e1e1e',
    },
    'iphone-se': {
      name: 'iPhone SE', w: 340, h: 680, radius: 36, bezel: 14,
      screen: { x: 0.041, y: 0.1, w: 0.918, h: 0.8 }, screenR: 0,
      homeBtn: true, color: '#1e1e1e',
    },
    'android': {
      name: 'Android Phone', w: 380, h: 780, radius: 32, bezel: 8,
      screen: { x: 0.021, y: 0.02, w: 0.958, h: 0.96 }, screenR: 24,
      color: '#1e1e1e',
    },
    'ipad': {
      name: 'iPad', w: 620, h: 860, radius: 28, bezel: 18,
      screen: { x: 0.029, y: 0.035, w: 0.942, h: 0.93 }, screenR: 8,
      color: '#2d2d2d',
    },
    'macbook': {
      name: 'MacBook', w: 900, h: 580, radius: 14, bezel: 0,
      screen: { x: 0.055, y: 0.03, w: 0.89, h: 0.84 }, screenR: 4,
      lid: true, color: '#c0c0c0',
    },
    'laptop': {
      name: 'Laptop', w: 900, h: 580, radius: 10, bezel: 0,
      screen: { x: 0.055, y: 0.03, w: 0.89, h: 0.84 }, screenR: 2,
      lid: true, color: '#2d2d2d',
    },
    'monitor': {
      name: 'Desktop Monitor', w: 900, h: 620, radius: 10, bezel: 12,
      screen: { x: 0.02, y: 0.02, w: 0.96, h: 0.82 }, screenR: 4,
      stand: true, color: '#1e1e1e',
    },
    'browser': {
      name: 'Browser Window', w: 900, h: 600, radius: 10, bezel: 0,
      screen: { x: 0, y: 0.055, w: 1, h: 0.945 }, screenR: 0,
      browserBar: true, color: '#f1f5f9',
    },
    'browser-dark': {
      name: 'Browser Dark', w: 900, h: 600, radius: 10, bezel: 0,
      screen: { x: 0, y: 0.055, w: 1, h: 0.945 }, screenR: 0,
      browserBar: true, color: '#1e293b',
    },
  };

  // ── Render ─────────────────────────────────────────────
  function render() {
    if (!mockImg) return;

    const deviceKey = $('mockup-device')?.value || 'iphone-15';
    const device = DEVICES[deviceKey];
    if (!device) return;

    const bgType = $('mockup-bg-type')?.value || 'gradient';
    const bgC1 = $('mockup-bg-c1')?.value || '#6366f1';
    const bgC2 = $('mockup-bg-c2')?.value || '#a855f7';
    const shadowOn = $('mockup-shadow')?.checked !== false;
    const scale = +($('mockup-scale')?.value) || 100;

    const dw = Math.round(device.w * scale / 100);
    const dh = Math.round(device.h * scale / 100);
    const padding = Math.round(Math.max(dw, dh) * 0.12);
    const shadowExtra = shadowOn ? 30 : 0;

    // Canvas size
    const cw = dw + padding * 2 + shadowExtra;
    let ch = dh + padding * 2 + shadowExtra;

    // Extra height for laptop base or monitor stand
    const baseH = device.lid ? Math.round(dh * 0.06) : device.stand ? Math.round(dh * 0.15) : 0;
    ch += baseH;

    canvas.width = cw;
    canvas.height = ch;

    // Background
    if (bgType === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, cw, ch);
      grad.addColorStop(0, bgC1); grad.addColorStop(1, bgC2);
      ctx.fillStyle = grad;
    } else if (bgType === 'solid') {
      ctx.fillStyle = bgC1;
    } else {
      ctx.clearRect(0, 0, cw, ch);
    }
    if (bgType !== 'transparent') ctx.fillRect(0, 0, cw, ch);

    // Device position (centered)
    const dx = (cw - dw) / 2;
    const dy = (ch - dh - baseH) / 2;
    const dr = device.radius * scale / 100;

    // Shadow
    if (shadowOn) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.3)';
      ctx.shadowBlur = 25;
      ctx.shadowOffsetY = 8;
      ctx.beginPath();
      ctx.roundRect(dx, dy, dw, dh, dr);
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fill();
      ctx.restore();
    }

    // Device body
    ctx.beginPath();
    ctx.roundRect(dx, dy, dw, dh, dr);
    ctx.fillStyle = device.color;
    ctx.fill();

    // Screen area
    const sx = dx + device.screen.x * dw;
    const sy = dy + device.screen.y * dh;
    const sw = device.screen.w * dw;
    const sh = device.screen.h * dh;
    const sr = device.screenR * scale / 100;

    ctx.save();
    ctx.beginPath();
    ctx.roundRect(sx, sy, sw, sh, sr);
    ctx.clip();

    // Draw user image to fit screen
    const imgAspect = mockImg.naturalWidth / mockImg.naturalHeight;
    const screenAspect = sw / sh;
    let iw, ih, ix, iy;
    if (imgAspect > screenAspect) {
      // Wider — fit width, crop height
      ih = sh; iw = ih * imgAspect;
      ix = sx - (iw - sw) / 2; iy = sy;
    } else {
      iw = sw; ih = iw / imgAspect;
      ix = sx; iy = sy - (ih - sh) / 2;
    }
    ctx.drawImage(mockImg, ix, iy, iw, ih);
    ctx.restore();

    // Browser bar
    if (device.browserBar) {
      const barH = device.screen.y * dh;
      const barR = dr;
      ctx.beginPath();
      ctx.roundRect(dx, dy, dw, barH + 4, [barR, barR, 0, 0]);
      ctx.fillStyle = device.color;
      ctx.fill();

      // Traffic lights
      const dotR = 4 * scale / 100;
      const dotY = dy + barH / 2;
      const dotStart = dx + 14 * scale / 100;
      const dotGap = 14 * scale / 100;
      ['#ef4444', '#eab308', '#22c55e'].forEach((c, i) => {
        ctx.beginPath(); ctx.arc(dotStart + i * dotGap, dotY, dotR, 0, Math.PI * 2);
        ctx.fillStyle = c; ctx.fill();
      });

      // URL bar
      const urlBarX = dx + dw * 0.15;
      const urlBarW = dw * 0.7;
      const urlBarH = barH * 0.5;
      const urlBarY = dy + (barH - urlBarH) / 2;
      const urlBarBg = device.color === '#1e293b' ? '#0f172a' : '#ffffff';
      ctx.beginPath(); ctx.roundRect(urlBarX, urlBarY, urlBarW, urlBarH, urlBarH / 2);
      ctx.fillStyle = urlBarBg; ctx.fill();
    }

    // Notch (iPhone style)
    if (device.notch) {
      const nw = dw * 0.3;
      const nh = dh * 0.03;
      const nx = dx + (dw - nw) / 2;
      const ny = dy + dh * 0.01;
      ctx.beginPath();
      ctx.roundRect(nx, ny, nw, nh, nh / 2);
      ctx.fillStyle = device.color;
      ctx.fill();
    }

    // Home button (iPhone SE)
    if (device.homeBtn) {
      const btnR = dw * 0.06;
      const btnX = dx + dw / 2;
      const btnY = dy + dh * 0.95;
      ctx.beginPath(); ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 1.5; ctx.stroke();
    }

    // Laptop base
    if (device.lid) {
      const baseW = dw * 1.1;
      const bh = baseH;
      const bx = dx + (dw - baseW) / 2;
      const by = dy + dh;
      ctx.beginPath();
      ctx.moveTo(bx + 10, by);
      ctx.lineTo(bx + baseW - 10, by);
      ctx.lineTo(bx + baseW, by + bh);
      ctx.lineTo(bx, by + bh);
      ctx.closePath();
      ctx.fillStyle = device.color;
      ctx.fill();
      // Hinge line
      ctx.beginPath(); ctx.moveTo(dx, by); ctx.lineTo(dx + dw, by);
      ctx.strokeStyle = 'rgba(0,0,0,0.2)'; ctx.lineWidth = 1; ctx.stroke();
      // Trackpad indent
      const tpW = baseW * 0.3;
      const tpH = bh * 0.1;
      ctx.beginPath(); ctx.roundRect(bx + (baseW - tpW) / 2, by + bh * 0.4, tpW, tpH, 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 0.5; ctx.stroke();
    }

    // Monitor stand
    if (device.stand) {
      const standW = dw * 0.15;
      const standH = baseH * 0.6;
      const standX = dx + (dw - standW) / 2;
      const standY = dy + dh;
      ctx.fillStyle = device.color;
      ctx.fillRect(standX, standY, standW, standH);
      // Base plate
      const plateW = dw * 0.35;
      const plateH = baseH * 0.08;
      const plateX = dx + (dw - plateW) / 2;
      const plateY = standY + standH;
      ctx.beginPath();
      ctx.ellipse(plateX + plateW / 2, plateY, plateW / 2, plateH, 0, 0, Math.PI * 2);
      ctx.fillStyle = device.color; ctx.fill();
    }

    $('mockup-dims').textContent = `${cw} \u00D7 ${ch}`;
  }

  // ── Drop zone ──────────────────────────────────────────
  setupDropzone(dropzone, $('mockup-file'), async (file) => {
    mockImg = await loadImg(file);
    if (!mockImg) return;
    dropzone.style.display = 'none';
    canvas.style.display = 'block';
    $('mockup-ribbon')?.classList.remove('disabled');
    render();
  });

  // Paste
  document.addEventListener('paste', (e) => {
    if (currentMode !== 'mockup') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        loadImg(item.getAsFile()).then(img => {
          if (!img) return;
          mockImg = img;
          dropzone.style.display = 'none';
          canvas.style.display = 'block';
          $('mockup-ribbon')?.classList.remove('disabled');
          render();
        });
        break;
      }
    }
  });

  // ── Bind inputs ────────────────────────────────────────
  const inputs = ['mockup-device', 'mockup-bg-type', 'mockup-bg-c1', 'mockup-bg-c2',
    'mockup-shadow', 'mockup-scale'];
  inputs.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  $('mockup-scale')?.addEventListener('input', () => { $('mockup-scale-val').textContent = $('mockup-scale').value + '%'; });

  // Background type toggle
  $('mockup-bg-type')?.addEventListener('change', () => {
    const isGrad = $('mockup-bg-type').value === 'gradient';
    $('mockup-grad-c2-wrap').style.display = isGrad ? '' : 'none';
  });

  // Gradient presets
  $$('.mockup-grad-preset').forEach(swatch => {
    swatch.addEventListener('click', () => {
      $('mockup-bg-c1').value = swatch.dataset.c1;
      $('mockup-bg-c2').value = swatch.dataset.c2;
      $('mockup-bg-type').value = 'gradient';
      $('mockup-grad-c2-wrap').style.display = '';
      render();
    });
  });

  // New / Library
  $('btn-mockup-new')?.addEventListener('click', () => {
    mockImg = null;
    canvas.style.display = 'none';
    dropzone.style.display = '';
    $('mockup-ribbon')?.classList.add('disabled');
    $('mockup-dims').textContent = '';
  });

  $('btn-mockup-from-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      if (!items.length) return;
      const img = new Image();
      img.src = items[0].dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      mockImg = img;
      dropzone.style.display = 'none';
      canvas.style.display = 'block';
      $('mockup-ribbon')?.classList.remove('disabled');
      render();
    }, { singleSelect: true });
  });

  // Export
  $('btn-mockup-export')?.addEventListener('click', () => {
    if (!canvas.width || !mockImg) return;
    const fmt = $('mockup-export-fmt')?.value || 'png';
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png';
    canvas.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `snaproo/mockup.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });

  $('btn-mockup-save-lib')?.addEventListener('click', async () => {
    if (!canvas.width || !mockImg) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (typeof PixLibrary !== 'undefined') {
      await PixLibrary.add({ dataUrl, source: 'mockup', name: 'device-mockup', width: canvas.width, height: canvas.height, type: 'image', size: dataUrl.length });
    }
  });

  $('btn-mockup-copy')?.addEventListener('click', async () => {
    if (!canvas.width || !mockImg) return;
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {}
  });
}
