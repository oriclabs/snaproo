// Snaproo — Store Tool
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
  $$('.store-nav-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('.store-nav-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
      renderStoreAssets(item.dataset.store);
    });
  });

  setupDropzone($('store-icon-drop'), $('store-icon-file'), async (file) => {
    storeIconImg = await loadImg(file);
    if (!storeIconImg) return;
    $('store-icon-preview').style.display = 'block';
    const c = $('store-icon-canvas'); c.width = 128; c.height = 128;
    c.getContext('2d').drawImage(storeIconImg, 0, 0, 128, 128);
    $('btn-store-generate').disabled = false;
    validateStoreIcon();
  });

  setupDropzone($('store-screenshot-drop'), $('store-screenshot-file'), async (file) => {
    storeScreenImg = await loadImg(file);
  });

  $('btn-store-generate').addEventListener('click', generateStoreAssets);
  $('btn-store-export').addEventListener('click', exportStoreZip);

  updateStoreCounts();
}

function validateStoreIcon() {
  const el = $('store-validation');
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
    const el = $(`store-count-${store}`);
    if (el) el.textContent = count;
  }
  $('store-count-all').textContent = total;
}

async function generateStoreAssets() {
  if (!storeIconImg) return;
  storeGenerated = {};
  const bg = $('store-bg-color').value;
  const radius = +$('store-corner-radius').value;

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

  $('btn-store-export').disabled = false;
  renderStoreAssets(document.querySelector('.store-nav-item.active')?.dataset.store || 'all');
}

function renderStoreAssets(filter) {
  const grid = $('store-assets');
  grid.innerHTML = '';

  const stores = filter === 'all' ? Object.keys(STORE_SPECS) : [filter];

  for (const store of stores) {
    const items = storeGenerated[store] || [];
    const specs = STORE_SPECS[store] || [];

    if (filter === 'all' && specs.length) {
      const header = document.createElement('div');
      header.style.cssText = 'grid-column:1/-1;font-weight:600;color:var(--slate-400);text-transform:uppercase;padding-top:0.5rem;';
      header.textContent = { play:'Google Play', apple:'Apple App Store', chrome:'Chrome Web Store', edge:'Edge Add-ons', firefox:'Firefox Add-ons', ms:'Microsoft Store' }[store];
      grid.appendChild(header);
    }

    specs.forEach((spec, idx) => {
      const card = document.createElement('div');
      card.className = 'asset-card';
      const item = items[idx];
      const hasAsset = !!item;

      card.innerHTML = `
        <div class="asset-card-preview">${hasAsset ? '' : '<div style="color:var(--slate-500);">Not generated</div>'}</div>
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
            chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `snaproo/store-assets/${name}`, saveAs: true });
          });
        });
      }

      grid.appendChild(card);
    });
  }

  if (!grid.children.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:2rem;color:var(--slate-500);">Upload a source icon and click Generate</div>';
  }
}

async function exportStoreZip() {
  // Download all assets individually (ZIP requires JSZip - future)
  for (const [store, items] of Object.entries(storeGenerated)) {
    for (const item of items) {
      const name = `${store}-${item.spec.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.spec.w}x${item.spec.h}.png`;
      const blob = await new Promise(r => item.canvas.toBlob(r));
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `snaproo/store-assets/${name}`, saveAs: false });
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
