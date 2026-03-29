// Pixeroo — Convert Tool
// convertFiles is declared in shared-editor.js

function initConvert() {
  setupDropzone($('convert-drop'), $('convert-file'), (file) => {
    convertFiles.push(file);
    $('convert-drop').style.display = 'none';
    $('convert-preview').style.display = 'block';
    $('convert-img').src = URL.createObjectURL(file);
    $('convert-batch-info').textContent = convertFiles.length > 1 ? `${convertFiles.length} files` : file.name;
    $('btn-convert-go').disabled = false;
  }, { multiple: true });

  $$('#convert-formats .format-btn').forEach(b => b.addEventListener('click', () => {
    $$('#convert-formats .format-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('convert-quality-section').style.display = ['jpeg','webp','avif'].includes(b.dataset.fmt) ? 'block' : 'none';
  }));
  $('convert-quality').addEventListener('input', e => { $('convert-quality-val').textContent = e.target.value; });

  $('btn-convert-go').addEventListener('click', async () => {
    const fmt = document.querySelector('#convert-formats .format-btn.active')?.dataset.fmt || 'png';
    const mime = {png:'image/png',jpeg:'image/jpeg',webp:'image/webp',bmp:'image/bmp'}[fmt] || 'image/png';
    const q = ['jpeg','webp'].includes(fmt) ? +$('convert-quality').value / 100 : undefined;
    const batchW = +$('batch-resize-w').value || 0;
    const batchH = +$('batch-resize-h').value || 0;
    const batchLock = $('batch-resize-lock').checked;

    for (const file of convertFiles) {
      const img = await loadImg(file); if (!img) continue;
      let w = img.naturalWidth, h = img.naturalHeight;

      // Apply batch resize if specified
      if (batchW > 0 || batchH > 0) {
        if (batchW > 0 && batchH > 0 && !batchLock) {
          w = batchW; h = batchH;
        } else if (batchW > 0) {
          const ratio = img.naturalHeight / img.naturalWidth;
          w = batchW; h = batchLock ? Math.round(batchW * ratio) : (batchH || Math.round(batchW * ratio));
        } else if (batchH > 0) {
          const ratio = img.naturalWidth / img.naturalHeight;
          h = batchH; w = batchLock ? Math.round(batchH * ratio) : (batchW || Math.round(batchH * ratio));
        }
      }

      const srcC = document.createElement('canvas'); srcC.width = img.naturalWidth; srcC.height = img.naturalHeight;
      srcC.getContext('2d').drawImage(img, 0, 0);
      const c = (w !== img.naturalWidth || h !== img.naturalHeight) ? steppedResize(srcC, w, h) : srcC;
      const blob = await new Promise(r => c.toBlob(r, mime, q));
      chrome.runtime.sendMessage({ action:'download', url: URL.createObjectURL(blob), filename:`pixeroo/${file.name.replace(/\.[^.]+$/,'')}.${fmt==='jpeg'?'jpg':fmt}`, saveAs: convertFiles.length === 1 });
    }
  });

  // Compression preview: show sizes for first loaded file
  async function showCompressionPreview(file) {
    const img = await loadImg(file);
    if (!img) return;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);

    const el = $('compression-preview');
    el.innerHTML = '<span style="color:var(--slate-500);">Calculating...</span>';

    const results = await getCompressionSizes(c, [
      { format: 'PNG', mime: 'image/png', qualities: [100] },
      { format: 'JPEG', mime: 'image/jpeg', qualities: [50, 75, 85, 95] },
      { format: 'WebP', mime: 'image/webp', qualities: [50, 75, 85, 95] },
    ]);

    el.innerHTML = results.map(r =>
      `<div style="display:flex;justify-content:space-between;padding:2px 0;color:var(--slate-400);"><span>${r.format}${r.quality < 100 ? ' ' + r.quality + '%' : ''}</span><span style="color:var(--slate-200);font-weight:500;">${r.sizeStr}</span></div>`
    ).join('');
  }

  // Trigger compression preview on first file load
  const origSetup = $('convert-file');
  origSetup.addEventListener('change', () => {
    if (origSetup.files[0]) showCompressionPreview(origSetup.files[0]);
  });
}
