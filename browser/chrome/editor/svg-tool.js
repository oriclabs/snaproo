// Snaproo — SVG Tool
function initSVG() {
  let svgSrc = '';
  setupDropzone($('svg-drop'), $('svg-file'), (file) => {
    const r = new FileReader();
    r.onload = (e) => {
      svgSrc = e.target.result;
      $('svg-drop').style.display = 'none';
      $('svg-preview').style.display = 'block';
      $('svg-img').src = URL.createObjectURL(file);
      $('svg-source').textContent = svgSrc;
      $('btn-svg-export').disabled = false;
      const doc = new DOMParser().parseFromString(svgSrc, 'image/svg+xml'), svg = doc.querySelector('svg');
      const info = svg ? [['Width',svg.getAttribute('width')||'auto'],['Height',svg.getAttribute('height')||'auto'],['ViewBox',svg.getAttribute('viewBox')||'none'],['Elements',svg.querySelectorAll('*').length],['Size',formatBytes(new Blob([svgSrc]).size)]] : [];
      $('svg-info').innerHTML = info.map(([l,v])=>`<div class="info-row"><span class="info-label">${l}</span><span class="info-value">${esc(String(v))}</span></div>`).join('');
      const w=parseInt(svg?.getAttribute('width'))||parseInt(svg?.getAttribute('viewBox')?.split(' ')[2])||100;
      const h=parseInt(svg?.getAttribute('height'))||parseInt(svg?.getAttribute('viewBox')?.split(' ')[3])||100;
      $('svg-export-w').value=w*2; $('svg-export-h').value=h*2;
    };
    r.readAsText(file);
  });

  $('btn-svg-export').addEventListener('click', () => {
    if (!svgSrc) return;
    const w=+$('svg-export-w').value||400, h=+$('svg-export-h').value||400, fmt=$('svg-export-fmt').value;
    const img=new Image(); img.onload=()=>{
      const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');
      if(fmt==='jpeg'){x.fillStyle='#fff';x.fillRect(0,0,w,h);}x.drawImage(img,0,0,w,h);
      c.toBlob(b=>{chrome.runtime.sendMessage({action:'download',url:URL.createObjectURL(b),filename:`snaproo/svg-export.${fmt==='jpeg'?'jpg':fmt}`,saveAs:true});},{png:'image/png',jpeg:'image/jpeg',webp:'image/webp'}[fmt],0.9);
    }; img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgSrc);
  });
  $('btn-svg-copy-source').addEventListener('click', () => { if(svgSrc) navigator.clipboard.writeText(svgSrc); });

  // Image → SVG Trace
  let traceSvg = '';
  setupDropzone($('trace-drop'), $('trace-file'), async (file) => {
    const img = await loadImg(file);
    if (!img) return;
    $('btn-trace-go').disabled = false;
    $('btn-trace-go')._traceImg = img;
    $('trace-drop').innerHTML = `<p class="drop-title" style="">${esc(file.name)}</p><p class="drop-sub" style="">${img.naturalWidth}x${img.naturalHeight}</p>`;
  });

  $('btn-trace-go')?.addEventListener('click', () => {
    const btn = $('btn-trace-go');
    const img = btn._traceImg;
    if (!img) return;
    btn.disabled = true; btn.textContent = 'Tracing...';

    // Run async so UI updates
    setTimeout(() => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        c.getContext('2d').drawImage(img, 0, 0);

        const preset = $('trace-preset').value;
        const opts = PixTrace.resolveOptions(preset);
        const colors = +$('trace-colors').value;
        if (colors >= 2) opts.numberofcolors = colors;

        traceSvg = PixTrace.traceCanvas(c, opts);

        // Show result
        $('trace-result').style.display = 'block';
        $('trace-preview').innerHTML = traceSvg;
        // Scale preview SVG to fit
        const svgEl = $('trace-preview').querySelector('svg');
        if (svgEl) { svgEl.style.maxWidth = '100%'; svgEl.style.height = 'auto'; }
        const kb = (new Blob([traceSvg]).size / 1024).toFixed(1);
        const paths = (traceSvg.match(/<path /g) || []).length;
        $('trace-stats').textContent = `${kb} KB | ${paths} paths | ${opts.numberofcolors} colors`;
        // Show ribbon export buttons
        $('btn-trace-download').style.display = '';
        $('btn-trace-copy').style.display = '';
        $('btn-trace-save-lib').style.display = '';
      } catch (e) {
        console.warn('Trace failed:', e);
      }
      btn.disabled = false; btn.textContent = 'Trace to SVG';
    }, 50);
  });

  $('btn-trace-download')?.addEventListener('click', () => {
    if (!traceSvg) return;
    const blob = new Blob([traceSvg], { type: 'image/svg+xml' });
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: 'snaproo/traced.svg', saveAs: true });
  });

  $('btn-trace-copy')?.addEventListener('click', () => {
    if (traceSvg) navigator.clipboard.writeText(traceSvg);
  });

  // SVG grid overlay toggle (CSS-based since preview is SVG/img, not canvas)
  $('btn-svg-guides')?.addEventListener('click', (e) => {
    const preview = $('svg-preview') || $('trace-preview');
    if (!preview) return;
    const on = !preview.dataset.grid;
    if (on) {
      preview.dataset.grid = '1';
      preview.style.backgroundImage = 'repeating-linear-gradient(0deg,transparent,transparent 49px,rgba(244,196,48,0.12) 49px,rgba(244,196,48,0.12) 50px),repeating-linear-gradient(90deg,transparent,transparent 49px,rgba(244,196,48,0.12) 49px,rgba(244,196,48,0.12) 50px)';
      preview.style.backgroundSize = '50px 50px';
    } else {
      delete preview.dataset.grid;
      preview.style.backgroundImage = '';
      preview.style.backgroundSize = '';
    }
    e.currentTarget.classList.toggle('active', on);
  });
}
