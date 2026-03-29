// Pixeroo — Showcase Tool (unified Screenshot Beautifier + Device Mockup)

function initShowcase() {
  const canvas = $('sc-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let scImg = null;
  const dropzone = $('sc-dropzone');

  // ── All frame definitions ──────────────────────────────
  const FRAMES = {
    // Screenshot beautifier frames (simple radius + optional title bar)
    none:              { type: 'simple', label: 'No Frame' },
    'browser-light':   { type: 'bar', barH: 32, barBg: '#f1f5f9', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#e2e8f0', radius: 8, urlBar: true },
    'browser-dark':    { type: 'bar', barH: 32, barBg: '#1e293b', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#334155', radius: 8, urlBar: true },
    'window-mac':      { type: 'bar', barH: 28, barBg: '#e2e8f0', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#cbd5e1', radius: 10 },
    'window-mac-dark': { type: 'bar', barH: 28, barBg: '#1e293b', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#334155', radius: 10 },
    'terminal':        { type: 'bar', barH: 28, barBg: '#1e1e2e', dotColors: ['#ef4444','#eab308','#22c55e'], borderColor: '#313244', radius: 10 },
    // iPhone
    'iphone-15':         { type: 'device', w: 393, h: 852, radius: 48, screen: { x:0.031, y:0.026, w:0.938, h:0.948 }, screenR: 38, notch: true, color: '#1e1e1e' },
    'iphone-15-pro-max': { type: 'device', w: 430, h: 932, radius: 50, screen: { x:0.028, y:0.024, w:0.944, h:0.952 }, screenR: 40, notch: true, color: '#1e1e1e' },
    'iphone-14':         { type: 'device', w: 390, h: 844, radius: 47, screen: { x:0.031, y:0.026, w:0.938, h:0.948 }, screenR: 38, notch: true, color: '#1e1e1e' },
    'iphone-se':         { type: 'device', w: 375, h: 667, radius: 36, screen: { x:0.041, y:0.1, w:0.918, h:0.8 }, screenR: 0, homeBtn: true, color: '#1e1e1e' },
    'iphone-13-mini':    { type: 'device', w: 375, h: 812, radius: 44, screen: { x:0.031, y:0.028, w:0.938, h:0.944 }, screenR: 36, notch: true, color: '#1e1e1e' },
    // Android
    'pixel-8':           { type: 'device', w: 412, h: 915, radius: 36, screen: { x:0.021, y:0.02, w:0.958, h:0.96 }, screenR: 28, color: '#1e1e1e' },
    'pixel-8-pro':       { type: 'device', w: 448, h: 998, radius: 38, screen: { x:0.02, y:0.018, w:0.96, h:0.964 }, screenR: 30, color: '#1e1e1e' },
    'samsung-s24':       { type: 'device', w: 412, h: 915, radius: 34, screen: { x:0.019, y:0.018, w:0.962, h:0.964 }, screenR: 26, color: '#1e1e1e' },
    'samsung-s24-ultra': { type: 'device', w: 440, h: 984, radius: 30, screen: { x:0.016, y:0.016, w:0.968, h:0.968 }, screenR: 22, color: '#1e1e1e' },
    'android-generic':   { type: 'device', w: 360, h: 800, radius: 32, screen: { x:0.021, y:0.02, w:0.958, h:0.96 }, screenR: 24, color: '#1e1e1e' },
    // iPad / Tablet
    'ipad':              { type: 'device', w: 820, h: 1180, radius: 28, screen: { x:0.024, y:0.022, w:0.952, h:0.956 }, screenR: 10, color: '#2d2d2d' },
    'ipad-pro-11':       { type: 'device', w: 834, h: 1194, radius: 26, screen: { x:0.022, y:0.02, w:0.956, h:0.96 }, screenR: 8, color: '#2d2d2d' },
    'ipad-pro-13':       { type: 'device', w: 1024, h: 1366, radius: 24, screen: { x:0.02, y:0.018, w:0.96, h:0.964 }, screenR: 8, color: '#2d2d2d' },
    'ipad-mini':         { type: 'device', w: 744, h: 1133, radius: 28, screen: { x:0.026, y:0.024, w:0.948, h:0.952 }, screenR: 10, color: '#2d2d2d' },
    // MacBook / Laptop
    'macbook':           { type: 'device', w: 1440, h: 900, radius: 14, screen: { x:0.055, y:0.03, w:0.89, h:0.84 }, screenR: 4, lid: true, color: '#c0c0c0' },
    'macbook-pro-14':    { type: 'device', w: 1512, h: 982, radius: 14, screen: { x:0.05, y:0.028, w:0.9, h:0.844 }, screenR: 4, lid: true, color: '#2d2d2d' },
    'macbook-pro-16':    { type: 'device', w: 1728, h: 1117, radius: 14, screen: { x:0.048, y:0.026, w:0.904, h:0.848 }, screenR: 4, lid: true, color: '#2d2d2d' },
    'laptop':            { type: 'device', w: 1366, h: 768, radius: 10, screen: { x:0.055, y:0.03, w:0.89, h:0.84 }, screenR: 2, lid: true, color: '#2d2d2d' },
    'laptop-fhd':        { type: 'device', w: 1920, h: 1080, radius: 10, screen: { x:0.045, y:0.025, w:0.91, h:0.85 }, screenR: 2, lid: true, color: '#2d2d2d' },
    // Desktop
    'monitor':           { type: 'device', w: 1920, h: 1080, radius: 10, screen: { x:0.02, y:0.02, w:0.96, h:0.82 }, screenR: 4, stand: true, color: '#1e1e1e' },
    'monitor-2k':        { type: 'device', w: 2560, h: 1440, radius: 10, screen: { x:0.018, y:0.018, w:0.964, h:0.824 }, screenR: 4, stand: true, color: '#1e1e1e' },
    'monitor-4k':        { type: 'device', w: 3840, h: 2160, radius: 10, screen: { x:0.015, y:0.015, w:0.97, h:0.83 }, screenR: 4, stand: true, color: '#1e1e1e' },
  };

  // ── Gradient presets ───────────────────────────────────
  const GRADS = [
    { c1: '#f97316', c2: '#ec4899', name: 'Sunset' },
    { c1: '#06b6d4', c2: '#3b82f6', name: 'Ocean' },
    { c1: '#22c55e', c2: '#14b8a6', name: 'Forest' },
    { c1: '#a855f7', c2: '#6366f1', name: 'Lavender' },
    { c1: '#334155', c2: '#1e293b', name: 'Slate' },
    { c1: '#f59e0b', c2: '#ef4444', name: 'Warm' },
    { c1: '#1e1b4b', c2: '#312e81', name: 'Night' },
    { c1: '#6ee7b7', c2: '#34d399', name: 'Mint' },
    { c1: '#fda4af', c2: '#fb7185', name: 'Rose' },
    { c1: '#4b5563', c2: '#111827', name: 'Graphite' },
  ];

  // ── Show/hide controls based on frame type ─────────────
  function updateFrameControls() {
    const frameName = $('sc-frame')?.value || 'none';
    const frame = FRAMES[frameName];
    const isDevice = frame?.type === 'device';
    // Hide outer padding & radius for device frames, show inset for all
    $('sc-padding-row').style.display = isDevice ? 'none' : '';
    $('sc-radius-row').style.display = isDevice ? 'none' : '';
    // Show scale for device frames
    $('sc-scale-row').style.display = isDevice ? '' : 'none';
  }

  // ── Main render ────────────────────────────────────────
  function render() {
    if (!scImg) return;
    const frameName = $('sc-frame')?.value || 'none';
    const frame = FRAMES[frameName];

    if (frame?.type === 'device') {
      _renderDevice(frame, frameName);
    } else {
      _renderSimple(frame, frameName);
    }
  }

  // ── Render: simple / bar frames ────────────────────────
  function _renderSimple(frame, frameName) {
    const padding = +($('sc-padding')?.value) || 40;
    const radius = +($('sc-radius')?.value) || 12;
    const shadowSize = +($('sc-shadow')?.value) || 20;
    const bgType = $('sc-bg-type')?.value || 'gradient';
    const bgC1 = $('sc-bg-c1')?.value || '#f97316';
    const bgC2 = $('sc-bg-c2')?.value || '#ec4899';
    const gradAngle = +($('sc-grad-angle')?.value) || 135;

    const imgW = scImg.naturalWidth;
    const imgH = scImg.naturalHeight;
    const barH = frame?.barH || 0;
    const frameR = frame?.radius || radius;
    const frameBorder = frame?.type === 'bar' ? 1 : 0;
    const contentW = imgW + frameBorder * 2;
    const contentH = imgH + barH + frameBorder * 2;
    const shadowMargin = shadowSize > 0 ? shadowSize * 2 : 0;
    const cw = contentW + padding * 2 + shadowMargin;
    const ch = contentH + padding * 2 + shadowMargin;

    canvas.width = cw; canvas.height = ch;

    // Background
    _drawBg(ctx, cw, ch, bgType, bgC1, bgC2, gradAngle);

    const cx = (cw - contentW) / 2, cy = (ch - contentH) / 2;

    // Shadow
    if (shadowSize > 0) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = shadowSize;
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = shadowSize * 0.3;
      ctx.beginPath(); ctx.roundRect(cx, cy, contentW, contentH, frame ? frameR : radius);
      ctx.fillStyle = 'rgba(0,0,0,1)'; ctx.fill();
      ctx.restore();
    }

    // Title bar for bar-type frames
    if (frame?.type === 'bar') {
      ctx.beginPath();
      ctx.roundRect(cx, cy, contentW, contentH, frameR);
      ctx.fillStyle = frame.barBg; ctx.fill();
      if (frame.borderColor) { ctx.strokeStyle = frame.borderColor; ctx.lineWidth = 1; ctx.stroke(); }
      // Separator
      ctx.beginPath(); ctx.moveTo(cx + 1, cy + barH); ctx.lineTo(cx + contentW - 1, cy + barH);
      ctx.strokeStyle = frame.borderColor || '#e2e8f0'; ctx.lineWidth = 1; ctx.stroke();
      // Traffic lights
      if (frame.dotColors) {
        const dotR = 5, dotY = cy + barH / 2, startX = cx + 16, gap = 18;
        frame.dotColors.forEach((c, i) => {
          ctx.beginPath(); ctx.arc(startX + i * gap, dotY, dotR, 0, Math.PI * 2);
          ctx.fillStyle = c; ctx.fill();
        });
      }
      // URL bar
      if (frame.urlBar) {
        const bx = cx + 80, bw = contentW - 160, by = cy + 8, bh = barH - 16;
        if (bw > 60) {
          ctx.fillStyle = frame.barBg === '#1e293b' ? '#0f172a' : '#ffffff';
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, bh / 2); ctx.fill();
          ctx.fillStyle = frame.barBg === '#1e293b' ? '#64748b' : '#94a3b8';
          ctx.font = '10px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('https://example.com', bx + bw / 2, by + bh / 2);
        }
      }
    }

    // Image (clipped with radius, with inset)
    const inset = +($('sc-inset')?.value) || 0;
    ctx.save();
    const imgX = cx + frameBorder, imgY = cy + barH + frameBorder;
    const imgR = frame?.type === 'bar' ? 0 : radius;
    const bottomR = frame?.type === 'bar' ? Math.max(0, frameR - 1) : radius;
    if (imgR > 0 || bottomR > 0) {
      ctx.beginPath();
      ctx.roundRect(imgX, imgY, imgW, imgH, frame?.type === 'bar' ? [0, 0, bottomR, bottomR] : imgR);
      ctx.clip();
    }
    if (inset > 0) {
      // Fill background behind inset area
      ctx.fillStyle = frame?.type === 'bar' ? (frame.barBg === '#1e293b' ? '#0f172a' : '#f8fafc') : '#000000';
      ctx.fillRect(imgX, imgY, imgW, imgH);
      ctx.drawImage(scImg, imgX + inset, imgY + inset, imgW - inset * 2, imgH - inset * 2);
    } else {
      ctx.drawImage(scImg, imgX, imgY, imgW, imgH);
    }
    ctx.restore();

    $('sc-dims').textContent = `${cw} \u00D7 ${ch}`;
  }

  // ── Render: realistic device frames ─────────────────────
  function _renderDevice(device, frameName) {
    const bgType = $('sc-bg-type')?.value || 'gradient';
    const bgC1 = $('sc-bg-c1')?.value || '#f97316';
    const bgC2 = $('sc-bg-c2')?.value || '#ec4899';
    const gradAngle = +($('sc-grad-angle')?.value) || 135;
    const shadowSize = +($('sc-shadow')?.value) || 20;
    const shadowOn = shadowSize > 0;
    const scale = +($('sc-scale')?.value) || 100;
    const s = scale / 100; // scale factor for detail sizing

    const dw = Math.round(device.w * s);
    const dh = Math.round(device.h * s);
    const padding = Math.round(Math.max(dw, dh) * 0.12);
    const shadowExtra = shadowOn ? 30 : 0;
    const baseH = device.lid ? Math.round(dh * 0.06) : device.stand ? Math.round(dh * 0.15) : 0;
    const cw = dw + padding * 2 + shadowExtra;
    const ch = dh + padding * 2 + shadowExtra + baseH;

    canvas.width = cw; canvas.height = ch;
    _drawBg(ctx, cw, ch, bgType, bgC1, bgC2, gradAngle);

    const dx = (cw - dw) / 2, dy = (ch - dh - baseH) / 2;
    const dr = device.radius * s;
    const isPhone = frameName.includes('iphone') || frameName.includes('pixel') || frameName.includes('samsung') || frameName.includes('android');
    const isTablet = frameName.includes('ipad');
    const isLaptop = device.lid;
    const isMonitor = device.stand;
    const isDark = device.color !== '#c0c0c0';

    // ── Device body ───────────────────────────────────────
    // Fill device body color first
    ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, dr);
    ctx.fillStyle = device.color; ctx.fill();

    // Drop shadow (drawn behind body via shadowBlur — no separate fill)
    if (shadowOn) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.4)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
      ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, dr);
      ctx.fillStyle = device.color; ctx.fill();
      ctx.restore();
    }

    // Metallic edge (thin stroke around device body)
    const edgeW = (isPhone || isTablet) ? Math.max(1.5, dw * 0.006) : Math.max(1, dw * 0.003);
    const metalGrad = ctx.createLinearGradient(dx, dy, dx + dw, dy + dh);
    if (isDark) {
      metalGrad.addColorStop(0, '#555');
      metalGrad.addColorStop(0.5, '#333');
      metalGrad.addColorStop(1, '#444');
    } else {
      metalGrad.addColorStop(0, '#d0d0d0');
      metalGrad.addColorStop(0.5, '#aaa');
      metalGrad.addColorStop(1, '#bbb');
    }
    ctx.strokeStyle = metalGrad;
    ctx.lineWidth = edgeW;
    ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, dr); ctx.stroke();

    // Subtle top shine
    ctx.save();
    ctx.beginPath(); ctx.roundRect(dx, dy, dw, dh, dr); ctx.clip();
    const shineGrad = ctx.createLinearGradient(dx, dy, dx, dy + dh * 0.25);
    shineGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    shineGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = shineGrad;
    ctx.fillRect(dx, dy, dw, dh * 0.25);
    ctx.restore();

    // ── Side buttons (phone/tablet) ──────────────────────
    if (isPhone || isTablet) {
      const btnW = Math.max(2, dw * 0.008);
      const btnColor = isDark ? '#3a3a3a' : '#b0b0b0';
      // Power button (right side)
      const pwrY = dy + dh * 0.18, pwrH = dh * 0.08;
      ctx.fillStyle = btnColor;
      ctx.beginPath(); ctx.roundRect(dx + dw - 1, pwrY, btnW + 1, pwrH, [0, 2, 2, 0]);
      ctx.fill();
      // Volume buttons (left side)
      if (isPhone) {
        const v1Y = dy + dh * 0.15, v2Y = dy + dh * 0.22, vH = dh * 0.05;
        ctx.beginPath(); ctx.roundRect(dx - btnW, v1Y, btnW + 1, vH, [2, 0, 0, 2]); ctx.fill();
        ctx.beginPath(); ctx.roundRect(dx - btnW, v2Y, btnW + 1, vH, [2, 0, 0, 2]); ctx.fill();
        // Silent switch
        const swY = dy + dh * 0.1, swH = dh * 0.025;
        ctx.beginPath(); ctx.roundRect(dx - btnW, swY, btnW + 1, swH, [2, 0, 0, 2]); ctx.fill();
      }
    }

    // ── Screen area ──────────────────────────────────────
    const sx = dx + device.screen.x * dw, sy = dy + device.screen.y * dh;
    const sw = device.screen.w * dw, sh = device.screen.h * dh;
    const sr = device.screenR * s;

    // Screen bezel inner shadow
    ctx.save();
    ctx.beginPath(); ctx.roundRect(sx - 1, sy - 1, sw + 2, sh + 2, sr + 1); ctx.clip();
    ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4; ctx.shadowInset = true;
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, sr); ctx.stroke();
    ctx.restore();

    // Draw screenshot into screen
    const inset = +($('sc-inset')?.value) || 0;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(sx, sy, sw, sh, sr); ctx.clip();
    const ddx = sx + inset, ddy = sy + inset, ddw = sw - inset * 2, ddh = sh - inset * 2;
    if (inset > 0) { ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, sw, sh); }
    const ia = scImg.naturalWidth / scImg.naturalHeight, sa = ddw / ddh;
    let iw, ih, ix, iy;
    if (ia > sa) { ih = ddh; iw = ih * ia; ix = ddx - (iw - ddw) / 2; iy = ddy; }
    else { iw = ddw; ih = iw / ia; ix = ddx; iy = ddy - (ih - ddh) / 2; }
    ctx.drawImage(scImg, ix, iy, iw, ih);

    // Glass reflection overlay (diagonal shine)
    const reflGrad = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.6);
    reflGrad.addColorStop(0, 'rgba(255,255,255,0.06)');
    reflGrad.addColorStop(0.4, 'rgba(255,255,255,0.02)');
    reflGrad.addColorStop(0.6, 'rgba(255,255,255,0)');
    reflGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = reflGrad;
    ctx.fillRect(sx, sy, sw, sh);
    ctx.restore();

    // ── Dynamic Island / Notch ───────────────────────────
    if (device.notch) {
      const isNewStyle = frameName.includes('15') || frameName.includes('16') || frameName.includes('14');
      if (isNewStyle) {
        // Dynamic Island (pill shape)
        const pillW = dw * 0.22, pillH = dh * 0.022;
        const pillX = dx + (dw - pillW) / 2, pillY = dy + dh * 0.013;
        ctx.fillStyle = '#000000';
        ctx.beginPath(); ctx.roundRect(pillX, pillY, pillW, pillH, pillH / 2); ctx.fill();
        // Front camera dot inside pill
        ctx.fillStyle = '#0a0a0a';
        ctx.beginPath(); ctx.arc(pillX + pillW * 0.72, pillY + pillH / 2, pillH * 0.28, 0, Math.PI * 2); ctx.fill();
        // Camera lens ring
        ctx.strokeStyle = '#1a1a3a';
        ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(pillX + pillW * 0.72, pillY + pillH / 2, pillH * 0.22, 0, Math.PI * 2); ctx.stroke();
      } else {
        // Classic notch (wider, rounded)
        const nw = dw * 0.35, nh = dh * 0.028;
        const nx = dx + (dw - nw) / 2, ny = dy;
        ctx.fillStyle = device.color;
        ctx.beginPath(); ctx.roundRect(nx, ny, nw, nh + dr * 0.3, [0, 0, nh * 0.6, nh * 0.6]); ctx.fill();
        // Speaker grille
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.roundRect(nx + nw * 0.3, ny + nh * 0.35, nw * 0.4, nh * 0.2, nh * 0.1); ctx.fill();
        // Camera
        ctx.fillStyle = '#111';
        ctx.beginPath(); ctx.arc(nx + nw * 0.25, ny + nh * 0.45, nh * 0.2, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Bottom speaker/port (phone) ──────────────────────
    if (isPhone) {
      const bottomY = dy + dh - dh * 0.012;
      // USB-C / Lightning port
      const portW = dw * 0.06, portH = dh * 0.006;
      ctx.fillStyle = isDark ? '#111' : '#888';
      ctx.beginPath(); ctx.roundRect(dx + (dw - portW) / 2, bottomY, portW, portH, portH / 2); ctx.fill();
      // Speaker grille dots (left of port)
      const dotR = Math.max(0.8, dw * 0.004);
      const dotY = bottomY + portH / 2;
      ctx.fillStyle = isDark ? '#111' : '#888';
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.arc(dx + dw * 0.3 + i * dw * 0.025, dotY, dotR, 0, Math.PI * 2); ctx.fill();
      }
      // Speaker dots (right of port)
      for (let i = 0; i < 6; i++) {
        ctx.beginPath(); ctx.arc(dx + dw * 0.58 + i * dw * 0.025, dotY, dotR, 0, Math.PI * 2); ctx.fill();
      }
    }

    // ── Home button (iPhone SE) ──────────────────────────
    if (device.homeBtn) {
      const btnR = dw * 0.06;
      const btnX = dx + dw / 2, btnY = dy + dh * 0.94;
      // Button ring
      ctx.strokeStyle = isDark ? '#444' : '#aaa';
      ctx.lineWidth = Math.max(1, dw * 0.004);
      ctx.beginPath(); ctx.arc(btnX, btnY, btnR, 0, Math.PI * 2); ctx.stroke();
      // Inner square (fingerprint sensor hint)
      const sq = btnR * 0.5;
      ctx.strokeStyle = isDark ? '#333' : '#999';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.roundRect(btnX - sq, btnY - sq, sq * 2, sq * 2, sq * 0.4); ctx.stroke();
    }

    // ── Laptop: lid + base with details ──────────────────
    if (isLaptop) {
      // Hinge
      const hingeH = Math.max(2, dh * 0.005);
      const hingeGrad = ctx.createLinearGradient(dx, dy + dh, dx, dy + dh + hingeH);
      hingeGrad.addColorStop(0, isDark ? '#1a1a1a' : '#999');
      hingeGrad.addColorStop(1, isDark ? '#333' : '#bbb');
      ctx.fillStyle = hingeGrad;
      ctx.fillRect(dx - dw * 0.01, dy + dh, dw * 1.02, hingeH);

      // Base (trapezoid)
      const bw = dw * 1.08, bh = baseH, bx = dx + (dw - bw) / 2, by = dy + dh + hingeH;
      const baseGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
      baseGrad.addColorStop(0, device.color);
      baseGrad.addColorStop(1, isDark ? '#1a1a1a' : '#aaa');
      ctx.beginPath();
      ctx.moveTo(bx + bh * 0.3, by);
      ctx.lineTo(bx + bw - bh * 0.3, by);
      ctx.lineTo(bx + bw, by + bh);
      ctx.quadraticCurveTo(bx + bw, by + bh + 2, bx + bw - 3, by + bh + 2);
      ctx.lineTo(bx + 3, by + bh + 2);
      ctx.quadraticCurveTo(bx, by + bh + 2, bx, by + bh);
      ctx.closePath();
      ctx.fillStyle = baseGrad; ctx.fill();

      // Trackpad
      const tpW = bw * 0.35, tpH = bh * 0.55;
      const tpX = bx + (bw - tpW) / 2, tpY = by + (bh - tpH) * 0.45;
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.roundRect(tpX, tpY, tpW, tpH, 4); ctx.stroke();

      // Webcam dot (top center of lid)
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh * 0.012, Math.max(1.5, dw * 0.003), 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a2a0a';
      ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh * 0.012, Math.max(0.8, dw * 0.0015), 0, Math.PI * 2); ctx.fill();
    }

    // ── Monitor: stand + base ────────────────────────────
    if (isMonitor) {
      // Neck
      const neckW = dw * 0.08, neckH = baseH * 0.55;
      const neckX = dx + (dw - neckW) / 2, neckY = dy + dh;
      const neckGrad = ctx.createLinearGradient(neckX, neckY, neckX + neckW, neckY);
      neckGrad.addColorStop(0, isDark ? '#2a2a2a' : '#b0b0b0');
      neckGrad.addColorStop(0.5, isDark ? '#3a3a3a' : '#c8c8c8');
      neckGrad.addColorStop(1, isDark ? '#222' : '#a0a0a0');
      ctx.fillStyle = neckGrad;
      ctx.fillRect(neckX, neckY, neckW, neckH);

      // Base (elliptical)
      const baseW = dw * 0.3, baseHH = baseH * 0.12;
      const baseX = dx + dw / 2, baseY = neckY + neckH;
      const baseGrad = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, baseW / 2);
      baseGrad.addColorStop(0, isDark ? '#333' : '#c0c0c0');
      baseGrad.addColorStop(1, isDark ? '#1a1a1a' : '#999');
      ctx.fillStyle = baseGrad;
      ctx.beginPath(); ctx.ellipse(baseX, baseY, baseW / 2, baseHH, 0, 0, Math.PI * 2); ctx.fill();

      // Monitor bezel line (bottom chin)
      const chinH = dh * 0.02;
      ctx.fillStyle = isDark ? '#151515' : '#888';
      ctx.fillRect(dx, dy + dh - chinH, dw, chinH);
      // Brand dot (center of chin)
      ctx.fillStyle = isDark ? '#333' : '#aaa';
      ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh - chinH / 2, Math.max(1.5, dw * 0.004), 0, Math.PI * 2); ctx.fill();

      // Webcam dot
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh * 0.008, Math.max(1.5, dw * 0.003), 0, Math.PI * 2); ctx.fill();
    }

    // ── Android-specific: thin chin indicator ────────────
    if (frameName.includes('pixel') || frameName.includes('samsung') || frameName.includes('android')) {
      // Thin bottom nav bar hint
      const barW = dw * 0.25, barH = Math.max(1.5, dh * 0.003);
      const barX = dx + (dw - barW) / 2, barY = dy + dh - dh * 0.02;
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.roundRect(barX, barY, barW, barH, barH / 2); ctx.fill();
    }

    // ── Tablet top camera ────────────────────────────────
    if (isTablet) {
      const camR = Math.max(2, dw * 0.005);
      ctx.fillStyle = '#111';
      ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh * 0.01, camR, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#0a1a2a';
      ctx.beginPath(); ctx.arc(dx + dw / 2, dy + dh * 0.01, camR * 0.5, 0, Math.PI * 2); ctx.fill();
    }

    $('sc-dims').textContent = `${cw} \u00D7 ${ch}`;
  }

  // ── Shared background draw ─────────────────────────────
  function _drawBg(ctx, w, h, type, c1, c2, angle) {
    if (type === 'gradient') {
      const a = angle * Math.PI / 180;
      const cx = w / 2, cy = h / 2, len = Math.max(w, h);
      const grad = ctx.createLinearGradient(cx - Math.cos(a) * len / 2, cy - Math.sin(a) * len / 2, cx + Math.cos(a) * len / 2, cy + Math.sin(a) * len / 2);
      grad.addColorStop(0, c1); grad.addColorStop(1, c2);
      ctx.fillStyle = grad;
    } else if (type === 'solid') {
      ctx.fillStyle = c1;
    } else { ctx.clearRect(0, 0, w, h); return; }
    ctx.fillRect(0, 0, w, h);
  }

  // ── Drop zone ──────────────────────────────────────────
  setupDropzone(dropzone, $('sc-file'), async (file) => {
    scImg = await loadImg(file);
    if (!scImg) return;
    dropzone.style.display = 'none';
    canvas.style.display = 'block';
    $('sc-ribbon')?.classList.remove('disabled');
    render();
  });

  // Paste
  document.addEventListener('paste', (e) => {
    if (currentMode !== 'showcase') return;
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        loadImg(item.getAsFile()).then(img => {
          if (!img) return;
          scImg = img;
          dropzone.style.display = 'none';
          canvas.style.display = 'block';
          $('sc-ribbon')?.classList.remove('disabled');
          render();
        });
        break;
      }
    }
  });

  // ── Bind all inputs ────────────────────────────────────
  ['sc-frame', 'sc-padding', 'sc-radius', 'sc-shadow', 'sc-inset', 'sc-bg-type', 'sc-bg-c1', 'sc-bg-c2', 'sc-grad-angle', 'sc-scale'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  // Frame change — update controls visibility
  $('sc-frame')?.addEventListener('change', () => { updateFrameControls(); render(); });

  // Range value displays
  $('sc-padding')?.addEventListener('input', () => { $('sc-padding-val').textContent = $('sc-padding').value; });
  $('sc-radius')?.addEventListener('input', () => { $('sc-radius-val').textContent = $('sc-radius').value; });
  $('sc-shadow')?.addEventListener('input', () => { $('sc-shadow-val').textContent = $('sc-shadow').value; });
  $('sc-inset')?.addEventListener('input', () => { $('sc-inset-val').textContent = $('sc-inset').value; });
  $('sc-grad-angle')?.addEventListener('input', () => { $('sc-grad-angle-val').textContent = $('sc-grad-angle').value + '\u00B0'; });
  $('sc-scale')?.addEventListener('input', () => { $('sc-scale-val').textContent = $('sc-scale').value + '%'; });

  // Bg type toggle
  $('sc-bg-type')?.addEventListener('change', () => {
    $('sc-grad-controls').style.display = $('sc-bg-type').value === 'gradient' ? '' : 'none';
  });

  // Gradient presets
  $$('.sc-grad-preset').forEach(swatch => {
    swatch.addEventListener('click', () => {
      $('sc-bg-c1').value = swatch.dataset.c1;
      $('sc-bg-c2').value = swatch.dataset.c2;
      $('sc-bg-type').value = 'gradient';
      $('sc-grad-controls').style.display = '';
      render();
    });
  });

  // New / Library
  $('btn-sc-new')?.addEventListener('click', () => {
    scImg = null; canvas.style.display = 'none'; dropzone.style.display = '';
    $('sc-ribbon')?.classList.add('disabled'); $('sc-dims').textContent = '';
  });
  $('btn-sc-from-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      if (!items.length) return;
      const img = new Image(); img.src = items[0].dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      scImg = img; dropzone.style.display = 'none'; canvas.style.display = 'block';
      $('sc-ribbon')?.classList.remove('disabled'); render();
    }, { singleSelect: true });
  });

  // Export
  $('btn-sc-export')?.addEventListener('click', () => {
    if (!canvas.width || !scImg) return;
    const fmt = $('sc-export-fmt')?.value || 'png';
    const mime = { png:'image/png', jpeg:'image/jpeg', webp:'image/webp' }[fmt] || 'image/png';
    canvas.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/showcase.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });
  $('btn-sc-save-lib')?.addEventListener('click', async () => {
    if (!canvas.width || !scImg) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (typeof PixLibrary !== 'undefined')
      await PixLibrary.add({ dataUrl, source: 'showcase', name: 'showcase', width: canvas.width, height: canvas.height, type: 'image', size: dataUrl.length });
  });
  $('btn-sc-copy')?.addEventListener('click', async () => {
    if (!canvas.width || !scImg) return;
    try { const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); } catch {}
  });
}
