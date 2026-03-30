// Snaproo — Compare Tool
function initCompare() {
  let iA=null, iB=null;
  setupDropzone($('compare-drop-a'),$('compare-file-a'),async(f)=>{iA=await loadImg(f);if(!iA)return;const c=$('compare-canvas-a');c.style.display='block';c.width=iA.naturalWidth;c.height=iA.naturalHeight;c.getContext('2d').drawImage(iA,0,0);$('compare-drop-a').style.display='none';$('compare-info-a').textContent=`${iA.naturalWidth}x${iA.naturalHeight} | ${f.name}`;});
  setupDropzone($('compare-drop-b'),$('compare-file-b'),async(f)=>{iB=await loadImg(f);if(!iB)return;const c=$('compare-canvas-b');c.style.display='block';c.width=iB.naturalWidth;c.height=iB.naturalHeight;c.getContext('2d').drawImage(iB,0,0);$('compare-drop-b').style.display='none';$('compare-info-b').textContent=`${iB.naturalWidth}x${iB.naturalHeight} | ${f.name}`;});

  $('btn-compare-diff').addEventListener('click',()=>{
    if(!iA||!iB)return;const w=Math.min(iA.naturalWidth,iB.naturalWidth),h=Math.min(iA.naturalHeight,iB.naturalHeight);
    const cA=document.createElement('canvas');cA.width=w;cA.height=h;cA.getContext('2d',{willReadFrequently:true}).drawImage(iA,0,0,w,h);
    const cB=document.createElement('canvas');cB.width=w;cB.height=h;cB.getContext('2d',{willReadFrequently:true}).drawImage(iB,0,0,w,h);
    const dA=cA.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),dB=cB.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h),diff=new ImageData(w,h);let dc=0;
    for(let i=0;i<dA.data.length;i+=4){const d=Math.abs(dA.data[i]-dB.data[i])+Math.abs(dA.data[i+1]-dB.data[i+1])+Math.abs(dA.data[i+2]-dB.data[i+2]);if(d>30){diff.data[i]=255;diff.data[i+1]=0;diff.data[i+2]=0;diff.data[i+3]=255;dc++;}else{diff.data[i]=dA.data[i];diff.data[i+1]=dA.data[i+1];diff.data[i+2]=dA.data[i+2];diff.data[i+3]=80;}}
    const co=$('compare-canvas-b');co.width=w;co.height=h;co.getContext('2d').putImageData(diff,0,0);
    $('compare-info-b').textContent=`Diff: ${((dc/(w*h))*100).toFixed(1)}% (${dc} px)`;
  });
  $('btn-compare-swap').addEventListener('click',()=>{const t=iA;iA=iB;iB=t;if(iA){const c=$('compare-canvas-a');c.width=iA.naturalWidth;c.height=iA.naturalHeight;c.getContext('2d').drawImage(iA,0,0);}if(iB){const c=$('compare-canvas-b');c.width=iB.naturalWidth;c.height=iB.naturalHeight;c.getContext('2d').drawImage(iB,0,0);}});

  // Compare guides (center crosshair, default off)
  let cmpGuidesA = null, cmpGuidesB = null;
  $('btn-compare-guides')?.addEventListener('click', (e) => {
    const cA = $('compare-canvas-a');
    const cB = $('compare-canvas-b');
    if (!cA.width && !cB.width) return;
    if (!cmpGuidesA && cA.width) {
      cmpGuidesA = new CanvasGuides(cA.parentElement, cA, { showRuler: false, showGrid: false, showCenter: true });
    }
    if (!cmpGuidesB && cB.width) {
      cmpGuidesB = new CanvasGuides(cB.parentElement, cB, { showRuler: false, showGrid: false, showCenter: true });
    }
    const on = cmpGuidesA?.toggle();
    cmpGuidesB?.toggle();
    e.currentTarget.classList.toggle('active', on);
  });

  // --- Before/After Slider ---
  $('btn-compare-slider')?.addEventListener('click', () => {
    if (!iA || !iB) return;
    const container = $('compare-container');
    const sliderView = $('compare-slider-view');
    const isSlider = sliderView.style.display !== 'none';

    if (isSlider) {
      // Switch back to side-by-side
      sliderView.style.display = 'none';
      container.style.display = 'flex';
      $('btn-compare-slider').classList.remove('active');
      return;
    }

    // Switch to slider view
    container.style.display = 'none';
    sliderView.style.display = 'block';
    $('btn-compare-slider').classList.add('active');

    // Draw both images onto slider canvases at same size
    const w = Math.max(iA.naturalWidth, iB.naturalWidth);
    const h = Math.max(iA.naturalHeight, iB.naturalHeight);
    const cA = $('compare-slider-a');
    const cB = $('compare-slider-b');
    cA.width = w; cA.height = h;
    cB.width = w; cB.height = h;
    cA.getContext('2d').drawImage(iA, 0, 0, w, h);
    cB.getContext('2d').drawImage(iB, 0, 0, w, h);

    // Reset slider to 50%
    _setSliderPos(50);
  });

  function _setSliderPos(pct) {
    pct = Math.max(0, Math.min(100, pct));
    const cB = $('compare-slider-b');
    const line = $('compare-slider-line');
    const handle = $('compare-slider-handle');
    cB.style.clipPath = `inset(0 0 0 ${pct}%)`;
    line.style.left = pct + '%';
    handle.style.left = pct + '%';
  }

  // Drag handling for slider
  const sliderView = $('compare-slider-view');
  let sliderDragging = false;

  function sliderMove(e) {
    if (!sliderDragging) return;
    const rect = sliderView.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    _setSliderPos((x / rect.width) * 100);
  }

  sliderView?.addEventListener('mousedown', (e) => { sliderDragging = true; sliderMove(e); });
  sliderView?.addEventListener('touchstart', (e) => { sliderDragging = true; sliderMove(e); }, { passive: true });
  window.addEventListener('mousemove', sliderMove);
  window.addEventListener('touchmove', sliderMove, { passive: true });
  window.addEventListener('mouseup', () => { sliderDragging = false; });
  window.addEventListener('touchend', () => { sliderDragging = false; });

  // Library buttons for Compare A and B (single-select)
  $('btn-compare-lib-a')?.addEventListener('click', () => {
    openLibraryPicker(async (items) => {
      const item = items[0]; if (!item) return;
      const img = new Image();
      img.src = item.dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      iA = img;
      const c = $('compare-canvas-a');
      c.style.display = 'block'; c.width = iA.naturalWidth; c.height = iA.naturalHeight;
      c.getContext('2d').drawImage(iA, 0, 0);
      $('compare-drop-a').style.display = 'none';
      $('compare-info-a').textContent = `${iA.naturalWidth}x${iA.naturalHeight} | ${item.name}`;
    }, { singleSelect: true });
  });

  $('btn-compare-lib-b')?.addEventListener('click', () => {
    openLibraryPicker(async (items) => {
      const item = items[0]; if (!item) return;
      const img = new Image();
      img.src = item.dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      iB = img;
      const c = $('compare-canvas-b');
      c.style.display = 'block'; c.width = iB.naturalWidth; c.height = iB.naturalHeight;
      c.getContext('2d').drawImage(iB, 0, 0);
      $('compare-drop-b').style.display = 'none';
      $('compare-info-b').textContent = `${iB.naturalWidth}x${iB.naturalHeight} | ${item.name}`;
    }, { singleSelect: true });
  });
}
