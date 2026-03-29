// Pixeroo — Certificate / Badge Generator Tool

function initCertificate() {
  const canvas = $('cert-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let certLogo = null;

  // ── Templates ──────────────────────────────────────────
  const TEMPLATES = {
    classic: {
      name: 'Classic Certificate', w: 1200, h: 850, orientation: 'landscape',
      bg: '#fffdf7', border: '#B8860B', accent: '#1e293b', text: '#1e293b',
      borderStyle: 'double', ornate: true,
    },
    modern: {
      name: 'Modern Certificate', w: 1200, h: 850, orientation: 'landscape',
      bg: '#ffffff', border: '#3b82f6', accent: '#3b82f6', text: '#1e293b',
      borderStyle: 'solid', ornate: false,
    },
    elegant: {
      name: 'Elegant', w: 1200, h: 850, orientation: 'landscape',
      bg: '#1e293b', border: '#F4C430', accent: '#F4C430', text: '#f1f5f9',
      borderStyle: 'solid', ornate: true,
    },
    minimal: {
      name: 'Minimal', w: 1200, h: 850, orientation: 'landscape',
      bg: '#ffffff', border: '#e2e8f0', accent: '#64748b', text: '#334155',
      borderStyle: 'solid', ornate: false,
    },
    achievement: {
      name: 'Achievement Badge', w: 800, h: 800, orientation: 'square',
      bg: '#0f172a', border: '#F4C430', accent: '#F4C430', text: '#f1f5f9',
      borderStyle: 'solid', ornate: false, badge: true,
    },
    diploma: {
      name: 'Diploma', w: 1200, h: 850, orientation: 'landscape',
      bg: '#fefce8', border: '#92400e', accent: '#92400e', text: '#451a03',
      borderStyle: 'double', ornate: true,
    },
    training: {
      name: 'Training Completion', w: 1200, h: 850, orientation: 'landscape',
      bg: '#f0fdf4', border: '#16a34a', accent: '#16a34a', text: '#14532d',
      borderStyle: 'solid', ornate: false,
    },
    award: {
      name: 'Award Certificate', w: 1200, h: 850, orientation: 'landscape',
      bg: '#faf5ff', border: '#7c3aed', accent: '#7c3aed', text: '#3b0764',
      borderStyle: 'solid', ornate: true,
    },
  };

  // ── Render ─────────────────────────────────────────────
  function render() {
    const tplKey = $('cert-template')?.value || 'classic';
    const tpl = TEMPLATES[tplKey];
    const title = $('cert-title')?.value || 'Certificate of Completion';
    const subtitle = $('cert-subtitle')?.value || 'This is proudly presented to';
    const recipientName = $('cert-name')?.value || 'John Doe';
    const description = $('cert-desc')?.value || 'For successfully completing the course requirements';
    const dateText = $('cert-date')?.value || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const issuer = $('cert-issuer')?.value || 'Organization Name';
    const sigName = $('cert-sig-name')?.value || '';

    const w = tpl.w, h = tpl.h;
    canvas.width = w; canvas.height = h;

    // Background
    ctx.fillStyle = tpl.bg;
    ctx.fillRect(0, 0, w, h);

    // Border
    const bw = tpl.borderStyle === 'double' ? 4 : 3;
    const margin = 30;
    ctx.strokeStyle = tpl.border;
    ctx.lineWidth = bw;
    ctx.strokeRect(margin, margin, w - margin * 2, h - margin * 2);
    if (tpl.borderStyle === 'double') {
      ctx.strokeRect(margin + 10, margin + 10, w - (margin + 10) * 2, h - (margin + 10) * 2);
    }

    // Ornate corner decorations
    if (tpl.ornate) {
      _drawCornerOrnaments(ctx, w, h, margin, tpl.border);
    }

    if (tpl.badge) {
      // Badge style — circular layout
      _renderBadge(ctx, w, h, tpl, title, recipientName, description, dateText, issuer);
    } else {
      // Certificate style — text layout
      _renderCertificate(ctx, w, h, tpl, title, subtitle, recipientName, description, dateText, issuer, sigName);
    }

    // Logo overlay
    if (certLogo) {
      const logoSize = Math.min(80, w * 0.07);
      const lx = w / 2 - logoSize / 2;
      const ly = margin + (tpl.borderStyle === 'double' ? 20 : 10) + 10;
      ctx.drawImage(certLogo, lx, ly, logoSize, logoSize);
    }

    $('cert-dims').textContent = `${w} \u00D7 ${h}`;
  }

  function _renderCertificate(ctx, w, h, tpl, title, subtitle, name, desc, date, issuer, sigName) {
    const cx = w / 2;
    let y = h * 0.18;

    // Title
    ctx.fillStyle = tpl.accent;
    ctx.font = `bold ${Math.round(w * 0.035)}px Georgia, serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title.toUpperCase(), cx, y);

    // Decorative line
    y += w * 0.04;
    ctx.strokeStyle = tpl.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - w * 0.15, y); ctx.lineTo(cx + w * 0.15, y);
    ctx.stroke();

    // Subtitle
    y += w * 0.035;
    ctx.fillStyle = tpl.text;
    ctx.font = `italic ${Math.round(w * 0.016)}px Georgia, serif`;
    ctx.fillText(subtitle, cx, y);

    // Recipient name
    y += w * 0.055;
    ctx.fillStyle = tpl.accent;
    ctx.font = `bold ${Math.round(w * 0.042)}px Georgia, serif`;
    ctx.fillText(name, cx, y);

    // Underline for name
    const nameW = ctx.measureText(name).width;
    y += w * 0.015;
    ctx.strokeStyle = tpl.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - nameW / 2 - 20, y); ctx.lineTo(cx + nameW / 2 + 20, y);
    ctx.stroke();

    // Description
    y += w * 0.04;
    ctx.fillStyle = tpl.text;
    ctx.font = `${Math.round(w * 0.014)}px Inter, system-ui, sans-serif`;
    // Word wrap description
    const maxW = w * 0.6;
    const words = desc.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, cx, y);
        line = word;
        y += w * 0.022;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, cx, y);

    // Date and issuer
    y = h * 0.78;
    ctx.fillStyle = tpl.text;
    ctx.font = `${Math.round(w * 0.013)}px Inter, system-ui, sans-serif`;
    ctx.fillText(date, cx, y);

    // Signature area
    y = h * 0.87;
    const sigX1 = w * 0.25, sigX2 = w * 0.75;

    // Signature lines
    ctx.strokeStyle = tpl.text;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(sigX1 - 60, y); ctx.lineTo(sigX1 + 60, y);
    ctx.moveTo(sigX2 - 60, y); ctx.lineTo(sigX2 + 60, y);
    ctx.stroke();

    ctx.font = `${Math.round(w * 0.011)}px Inter, system-ui, sans-serif`;
    ctx.fillText(sigName || 'Signature', sigX1, y + 16);
    ctx.fillText(issuer, sigX2, y + 16);
  }

  function _renderBadge(ctx, w, h, tpl, title, name, desc, date, issuer) {
    const cx = w / 2, cy = h / 2;
    const r = Math.min(w, h) * 0.38;

    // Outer ring
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = tpl.border; ctx.lineWidth = 6; ctx.stroke();

    // Inner ring
    ctx.beginPath(); ctx.arc(cx, cy, r - 12, 0, Math.PI * 2);
    ctx.strokeStyle = tpl.border; ctx.lineWidth = 1.5; ctx.stroke();

    // Star decoration at top
    _drawStar(ctx, cx, cy - r + 30, 18, tpl.accent);

    // Text
    ctx.fillStyle = tpl.accent;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `bold ${w * 0.035}px Georgia, serif`;
    ctx.fillText(title.toUpperCase(), cx, cy - r * 0.35);

    ctx.fillStyle = tpl.text;
    ctx.font = `${w * 0.018}px Inter, sans-serif`;
    ctx.fillText(desc, cx, cy - r * 0.1);

    ctx.fillStyle = tpl.accent;
    ctx.font = `bold ${w * 0.045}px Georgia, serif`;
    ctx.fillText(name, cx, cy + r * 0.15);

    ctx.fillStyle = tpl.text;
    ctx.font = `${w * 0.016}px Inter, sans-serif`;
    ctx.fillText(date, cx, cy + r * 0.4);
    ctx.fillText(issuer, cx, cy + r * 0.55);
  }

  function _drawCornerOrnaments(ctx, w, h, margin, color) {
    const s = 25; // ornament size
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const corners = [
      [margin + 5, margin + 5, 1, 1],
      [w - margin - 5, margin + 5, -1, 1],
      [margin + 5, h - margin - 5, 1, -1],
      [w - margin - 5, h - margin - 5, -1, -1],
    ];
    corners.forEach(([x, y, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(x, y + s * dy);
      ctx.lineTo(x, y);
      ctx.lineTo(x + s * dx, y);
      ctx.stroke();
      // Inner L
      ctx.beginPath();
      ctx.moveTo(x + 5 * dx, y + (s - 5) * dy);
      ctx.lineTo(x + 5 * dx, y + 5 * dy);
      ctx.lineTo(x + (s - 5) * dx, y + 5 * dy);
      ctx.stroke();
    });
  }

  function _drawStar(ctx, x, y, r, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const method = i === 0 ? 'moveTo' : 'lineTo';
      ctx[method](x + r * Math.cos(angle), y + r * Math.sin(angle));
    }
    ctx.closePath();
    ctx.fill();
  }

  // ── Bind inputs ────────────────────────────────────────
  const inputs = ['cert-template', 'cert-title', 'cert-subtitle', 'cert-name',
    'cert-desc', 'cert-date', 'cert-issuer', 'cert-sig-name'];
  inputs.forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('input', render);
    el.addEventListener('change', render);
  });

  // Logo upload
  $('cert-logo-file')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    certLogo = await loadImg(file);
    render();
  });
  $('btn-cert-clear-logo')?.addEventListener('click', () => {
    certLogo = null;
    $('cert-logo-file').value = '';
    render();
  });

  // Export
  $('btn-cert-export')?.addEventListener('click', () => {
    if (!canvas.width) return;
    const fmt = $('cert-export-fmt')?.value || 'png';
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png';
    canvas.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/certificate.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });

  $('btn-cert-save-lib')?.addEventListener('click', async () => {
    if (!canvas.width) return;
    const dataUrl = canvas.toDataURL('image/png');
    if (typeof PixLibrary !== 'undefined') {
      await PixLibrary.add({ dataUrl, source: 'certificate', name: 'certificate', width: canvas.width, height: canvas.height, type: 'image', size: dataUrl.length });
    }
  });

  $('btn-cert-copy')?.addEventListener('click', async () => {
    if (!canvas.width) return;
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch {}
  });

  // Initial render
  render();
}
