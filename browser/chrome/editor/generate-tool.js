// Pixeroo — Generate Tool
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

  $('btn-gen-placeholder')?.addEventListener('click', () => {
    const w = +($('gen-w')?.value) || 800;
    const h = +($('gen-h')?.value) || 600;
    const bg = $('gen-ph-bg')?.value || '#94a3b8';
    const tc = $('gen-ph-text-color')?.value || '#ffffff';
    const text = $('gen-ph-text')?.value || '';
    showGen(generatePlaceholder(w, h, bg, tc, text), 'placeholder');
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
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/generated.${fmt === 'jpeg' ? 'jpg' : fmt}`, saveAs: true });
    }, mime, 0.92);
  });
}
