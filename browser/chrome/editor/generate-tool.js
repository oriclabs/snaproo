// Snaproo — Generate Tool
function initGenerate() {
  const genCanvas = $('gen-canvas');
  if (!genCanvas) return;
  const genCtx = genCanvas.getContext('2d');
  let genGuides = null;

  function showGen(c, name) {
    genCanvas.width = c.width; genCanvas.height = c.height;
    genCtx.drawImage(c, 0, 0);
    $('gen-dims').textContent = `${c.width} x ${c.height}`;
    // Show guides
    if (!genGuides) {
      genGuides = new CanvasGuides(genCanvas.parentElement, genCanvas, { showRuler: true, showGrid: true });
    }
    setTimeout(() => { genGuides.show(); genGuides.update(); }, 50);
  }

  $('btn-gen-gradient')?.addEventListener('click', () => {
    const w = +($('gen-w')?.value) || 800;
    const h = +($('gen-h')?.value) || 600;
    const type = $('gen-grad-type')?.value || 'linear';
    const c1 = $('gen-grad-c1')?.value || '#F4C430';
    const c2 = $('gen-grad-c2')?.value || '#B8860B';
    showGen(generateGradient(w, h, type, [{ pos: 0, color: c1 }, { pos: 1, color: c2 }]), 'gradient');
  });

  $('btn-gen-pattern')?.addEventListener('click', () => {
    const w = +($('gen-w')?.value) || 800;
    const h = +($('gen-h')?.value) || 600;
    const type = $('gen-pat-type')?.value || 'checkerboard';
    const c1 = $('gen-pat-c1')?.value || '#e2e8f0';
    const c2 = $('gen-pat-c2')?.value || '#ffffff';
    const cell = +($('gen-pat-cell')?.value) || 40;
    showGen(generatePattern(w, h, type, c1, c2, cell), 'pattern');
  });

  // Enhanced placeholder with patterns, font, border, rounded
  function _genPlaceholder(w, h) {
    const bg = $('gen-ph-bg')?.value || '#94a3b8';
    const txColor = $('gen-ph-text-color')?.value || '#ffffff';
    const text = $('gen-ph-text')?.value || `${w}\u00D7${h}`;
    const pattern = $('gen-ph-pattern')?.value || 'none';
    const font = $('gen-ph-font')?.value || 'Inter, sans-serif';
    const bold = $('gen-ph-bold')?.checked;
    const hasBorder = $('gen-ph-border')?.checked;
    const rounded = $('gen-ph-rounded')?.checked;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d');
    const cornerR = rounded ? Math.min(w, h) * 0.04 : 0;
    if (cornerR > 0) { ctx.beginPath(); ctx.roundRect(0, 0, w, h, cornerR); ctx.clip(); }
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    // Pattern
    if (pattern !== 'none') {
      ctx.save(); ctx.globalAlpha = 0.15; ctx.strokeStyle = txColor; ctx.lineWidth = 1;
      if (pattern === 'cross') { ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(w,h); ctx.moveTo(w,0); ctx.lineTo(0,h); ctx.stroke(); }
      else if (pattern === 'grid') { const s = Math.max(20, Math.min(w,h)/10); ctx.beginPath(); for(let x=s;x<w;x+=s){ctx.moveTo(x,0);ctx.lineTo(x,h);} for(let y=s;y<h;y+=s){ctx.moveTo(0,y);ctx.lineTo(w,y);} ctx.stroke(); }
      else if (pattern === 'diagonal') { const s = Math.max(15, Math.min(w,h)/15); ctx.beginPath(); for(let d=-h;d<w+h;d+=s){ctx.moveTo(d,0);ctx.lineTo(d+h,h);} ctx.stroke(); }
      else if (pattern === 'dots') { const s = Math.max(15, Math.min(w,h)/12); const r = Math.max(1.5, s*0.08); ctx.fillStyle = txColor; for(let x=s;x<w;x+=s) for(let y=s;y<h;y+=s){ ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill(); } }
      ctx.restore();
    }
    if (hasBorder) { ctx.strokeStyle = '#64748b'; ctx.lineWidth = Math.max(2, Math.min(w,h)*0.005); if(cornerR>0){ctx.beginPath();ctx.roundRect(1,1,w-2,h-2,Math.max(0,cornerR-1));ctx.stroke();}else{ctx.strokeRect(1,1,w-2,h-2);} }
    const fontSize = Math.max(10, Math.min(w * 0.8 / (text.length * 0.55), h * 0.25));
    ctx.fillStyle = txColor; ctx.font = `${bold?'bold ':''}${fontSize}px ${font}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, w/2, h/2);
    return c;
  }

  $('btn-gen-placeholder')?.addEventListener('click', () => {
    const w = +($('gen-w')?.value) || 800;
    const h = +($('gen-h')?.value) || 600;
    showGen(_genPlaceholder(w, h), 'placeholder');
  });

  // Placeholder batch
  $('btn-gen-ph-batch')?.addEventListener('click', async () => {
    const input = $('gen-ph-batch')?.value?.trim();
    if (!input) return;
    const sizes = input.split(',').map(s => s.trim()).filter(s => /^\d+[x\u00D7]\d+$/i.test(s));
    if (!sizes.length) return;
    if (typeof ZipWriter === 'undefined') return;
    const zip = new ZipWriter();
    const fmt = $('gen-export-fmt')?.value || 'png';
    const mime = { png:'image/png', jpeg:'image/jpeg', webp:'image/webp' }[fmt] || 'image/png';
    for (const size of sizes) {
      const [sw, sh] = size.split(/[x\u00D7]/i).map(Number);
      if (!sw || !sh || sw > 4096 || sh > 4096) continue;
      const c = _genPlaceholder(sw, sh);
      const blob = await new Promise(r => c.toBlob(r, mime, 0.92));
      const buf = await blob.arrayBuffer();
      zip.addFile(`placeholder-${sw}x${sh}.${fmt==='jpeg'?'jpg':fmt}`, new Uint8Array(buf));
    }
    const zipBlob = zip.finish();
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(zipBlob), filename: 'snaproo/placeholders.zip', saveAs: true });
  });

  // Populate social banner presets dropdown
  const socialSel = $('gen-social-preset');
  if (socialSel && typeof socialBannerPresets !== 'undefined') {
    socialBannerPresets.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = i; opt.textContent = p.name;
      socialSel.appendChild(opt);
    });
  }

  // Social banner
  $('btn-gen-social')?.addEventListener('click', () => {
    const idx = +($('gen-social-preset')?.value);
    const preset = socialBannerPresets[idx];
    if (!preset) return;
    const text = $('gen-social-text')?.value || '';
    const c1 = $('gen-grad-c1')?.value || '#F4C430';
    const c2 = $('gen-grad-c2')?.value || '#B8860B';
    const type = $('gen-grad-type')?.value || 'linear';
    showGen(generateSocialBanner(preset, c1, c2, type, text, '#ffffff'), 'social-banner');
  });

  // Avatar
  $('btn-gen-avatar')?.addEventListener('click', () => {
    const size = +($('gen-w')?.value) || 400;
    const initials = $('gen-avatar-initials')?.value || 'AB';
    const bg = $('gen-avatar-bg')?.value || '#6366f1';
    showGen(generateAvatar(size, initials, bg, '#ffffff'), 'avatar');
  });

  // Noise
  $('btn-gen-noise')?.addEventListener('click', () => {
    const w = +($('gen-w')?.value) || 800;
    const h = +($('gen-h')?.value) || 600;
    const type = $('gen-noise-type')?.value || 'white';
    showGen(generateNoise(w, h, type, 1), 'noise');
  });

  // Letter Favicon
  $('btn-gen-favicon')?.addEventListener('click', () => {
    const letter = $('gen-fav-letter')?.value || 'P';
    const bg = $('gen-fav-bg')?.value || '#F4C430';
    const rounded = $('gen-fav-round')?.checked || false;
    showGen(generateLetterFavicon(letter, 512, bg, '#1e293b', rounded), 'favicon');
  });

  // Color Swatch
  $('btn-gen-swatch')?.addEventListener('click', () => {
    const input = $('gen-swatch-colors')?.value || '#ef4444,#f97316,#eab308,#22c55e,#3b82f6,#8b5cf6';
    const colors = input.split(',').map(c => c.trim()).filter(c => c);
    if (colors.length < 1) return;
    showGen(generateColorSwatch(colors), 'swatch');
  });

  $('btn-gen-export')?.addEventListener('click', () => {
    if (!genCanvas.width) return;
    const fmt = $('gen-export-fmt')?.value || 'png';
    const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[fmt] || 'image/png';
    genCanvas.toBlob(blob => {
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `snaproo/generated.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });
}
