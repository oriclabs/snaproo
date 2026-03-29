// Pixeroo — GIF Creator Tool

function initGif() {
  const preview = $('gif-preview');
  if (!preview) return;
  const previewCtx = preview.getContext('2d');
  let gifFrames = []; // { img, canvas }
  let playing = false, playTimer = null, playIdx = 0;

  const frameList = $('gif-frame-list');

  // ── Update frame list UI ───────────────────────────────
  function updateFrameList() {
    frameList.innerHTML = '';
    gifFrames.forEach((frame, i) => {
      const el = document.createElement('div');
      el.style.cssText = 'display:inline-flex;flex-direction:column;align-items:center;gap:2px;cursor:pointer;border:2px solid var(--slate-700);border-radius:6px;padding:3px;min-width:60px;';
      el.dataset.idx = i;
      const thumb = document.createElement('canvas');
      thumb.width = 60; thumb.height = 45;
      const tc = thumb.getContext('2d');
      tc.drawImage(frame.canvas, 0, 0, 60, 45);
      thumb.style.cssText = 'border-radius:3px;display:block;';
      const label = document.createElement('span');
      label.style.cssText = 'color:var(--slate-500);font-size:0.55rem;';
      label.textContent = `#${i + 1}`;
      const removeBtn = document.createElement('button');
      removeBtn.textContent = '\u00D7';
      removeBtn.style.cssText = 'background:none;border:none;color:var(--slate-500);cursor:pointer;font-size:0.65rem;padding:0;line-height:1;';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gifFrames.splice(i, 1);
        updateFrameList();
        showFrame(Math.min(i, gifFrames.length - 1));
      });
      el.appendChild(thumb);
      el.appendChild(label);
      el.appendChild(removeBtn);
      el.addEventListener('click', () => showFrame(i));
      frameList.appendChild(el);
    });
    $('gif-count').textContent = gifFrames.length + ' frames';
    $('gif-ribbon')?.classList.toggle('disabled', gifFrames.length === 0);
  }

  function showFrame(idx) {
    if (idx < 0 || idx >= gifFrames.length) return;
    playIdx = idx;
    const frame = gifFrames[idx];
    preview.width = frame.canvas.width;
    preview.height = frame.canvas.height;
    previewCtx.drawImage(frame.canvas, 0, 0);
    preview.style.display = 'block';
    $('gif-dims').textContent = `${preview.width} \u00D7 ${preview.height} \u2022 Frame ${idx + 1}/${gifFrames.length}`;
    // Highlight active
    frameList.querySelectorAll('div[data-idx]').forEach((el, i) => {
      el.style.borderColor = i === idx ? 'var(--saffron-400)' : 'var(--slate-700)';
    });
  }

  // ── Add frames ─────────────────────────────────────────
  async function addImages(files) {
    const targetW = +($('gif-w')?.value) || 0;
    const targetH = +($('gif-h')?.value) || 0;

    for (const file of files) {
      const img = await loadImg(file);
      if (!img) continue;
      const c = document.createElement('canvas');
      // Use target size or first frame size
      let w = targetW || img.naturalWidth;
      let h = targetH || img.naturalHeight;
      if (gifFrames.length > 0 && !targetW) {
        w = gifFrames[0].canvas.width;
        h = gifFrames[0].canvas.height;
      }
      c.width = w; c.height = h;
      const cx = c.getContext('2d');
      // Fit image to frame size (cover)
      const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
      const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
      cx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
      gifFrames.push({ img, canvas: c });
    }
    $('gif-dropzone').style.display = 'none';
    updateFrameList();
    if (gifFrames.length > 0) showFrame(gifFrames.length - 1);
  }

  // Drop zone
  setupDropzone($('gif-dropzone'), $('gif-file'), async (file) => {
    await addImages([file]);
  });
  // Allow multiple files via the file input
  $('gif-file')?.setAttribute('multiple', '');
  $('gif-file')?.addEventListener('change', async (e) => {
    if (e.target.files.length > 0) await addImages([...e.target.files]);
  });

  // Add more button
  $('btn-gif-add')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/*'; input.multiple = true;
    input.addEventListener('change', async () => { if (input.files.length) await addImages([...input.files]); });
    input.click();
  });

  // Library import
  $('btn-gif-from-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      for (const item of items) {
        const img = new Image();
        img.src = item.dataUrl;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        await addImages([{ name: item.name, _img: img }]);
      }
    });
  });

  // Override addImages to handle pre-loaded images from library
  const origAddImages = addImages;
  async function addImagesAny(files) {
    for (const file of files) {
      if (file._img) {
        const img = file._img;
        const targetW = +($('gif-w')?.value) || 0;
        const targetH = +($('gif-h')?.value) || 0;
        let w = targetW || img.naturalWidth;
        let h = targetH || img.naturalHeight;
        if (gifFrames.length > 0 && !targetW) { w = gifFrames[0].canvas.width; h = gifFrames[0].canvas.height; }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const cx = c.getContext('2d');
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
        cx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
        gifFrames.push({ img, canvas: c });
      } else {
        const img = await loadImg(file);
        if (!img) continue;
        const targetW = +($('gif-w')?.value) || 0;
        const targetH = +($('gif-h')?.value) || 0;
        let w = targetW || img.naturalWidth;
        let h = targetH || img.naturalHeight;
        if (gifFrames.length > 0 && !targetW) { w = gifFrames[0].canvas.width; h = gifFrames[0].canvas.height; }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const cx = c.getContext('2d');
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
        cx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
        gifFrames.push({ img, canvas: c });
      }
    }
    $('gif-dropzone').style.display = 'none';
    updateFrameList();
    if (gifFrames.length > 0) showFrame(gifFrames.length - 1);
  }

  // Re-bind library import
  $('btn-gif-from-lib')?.removeEventListener('click', () => {});
  $('btn-gif-from-lib')?.addEventListener('click', () => {
    if (typeof openLibraryPicker !== 'function') return;
    openLibraryPicker(async (items) => {
      for (const item of items) {
        const img = new Image();
        img.src = item.dataUrl;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        const targetW = +($('gif-w')?.value) || 0;
        const targetH = +($('gif-h')?.value) || 0;
        let w = targetW || img.naturalWidth;
        let h = targetH || img.naturalHeight;
        if (gifFrames.length > 0 && !targetW) { w = gifFrames[0].canvas.width; h = gifFrames[0].canvas.height; }
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const cx = c.getContext('2d');
        const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
        const iw = img.naturalWidth * scale, ih = img.naturalHeight * scale;
        cx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
        gifFrames.push({ img, canvas: c });
      }
      $('gif-dropzone').style.display = 'none';
      updateFrameList();
      if (gifFrames.length > 0) showFrame(gifFrames.length - 1);
    });
  });

  // ── Playback ───────────────────────────────────────────
  $('btn-gif-play')?.addEventListener('click', () => {
    if (gifFrames.length < 2) return;
    if (playing) {
      clearInterval(playTimer);
      playing = false;
      $('btn-gif-play').textContent = '\u25B6 Play';
      return;
    }
    playing = true;
    $('btn-gif-play').textContent = '\u275A\u275A Pause';
    const delay = +($('gif-delay')?.value) || 100;
    playTimer = setInterval(() => {
      playIdx = (playIdx + 1) % gifFrames.length;
      showFrame(playIdx);
    }, delay);
  });

  $('gif-delay')?.addEventListener('input', () => {
    $('gif-delay-val').textContent = $('gif-delay').value + 'ms';
    if (playing) {
      clearInterval(playTimer);
      const delay = +$('gif-delay').value || 100;
      playTimer = setInterval(() => {
        playIdx = (playIdx + 1) % gifFrames.length;
        showFrame(playIdx);
      }, delay);
    }
  });

  // ── Reorder ────────────────────────────────────────────
  $('btn-gif-reverse')?.addEventListener('click', () => {
    gifFrames.reverse();
    updateFrameList();
    showFrame(0);
  });

  // ── Clear ──────────────────────────────────────────────
  $('btn-gif-clear')?.addEventListener('click', () => {
    if (playing) { clearInterval(playTimer); playing = false; $('btn-gif-play').textContent = '\u25B6 Play'; }
    gifFrames = [];
    preview.style.display = 'none';
    $('gif-dropzone').style.display = '';
    $('gif-ribbon')?.classList.add('disabled');
    updateFrameList();
    $('gif-dims').textContent = '';
  });

  // ── Export GIF ─────────────────────────────────────────
  $('btn-gif-export')?.addEventListener('click', () => {
    if (gifFrames.length < 1) return;
    if (typeof GifEncoder === 'undefined') { console.warn('GifEncoder not available'); return; }

    const delay = +($('gif-delay')?.value) || 100;
    const w = gifFrames[0].canvas.width;
    const h = gifFrames[0].canvas.height;

    const encoder = new GifEncoder(w, h);
    for (const frame of gifFrames) {
      // Resize frame to match first frame
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(frame.canvas, 0, 0, w, h);
      encoder.addFrame(c, delay);
    }
    const blob = encoder.finish();
    chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `pixeroo/animation.gif`, saveAs: true });
  });

  $('btn-gif-save-lib')?.addEventListener('click', async () => {
    if (gifFrames.length < 1) return;
    // Save first frame as preview
    const dataUrl = gifFrames[0].canvas.toDataURL('image/png');
    if (typeof PixLibrary !== 'undefined') {
      await PixLibrary.add({ dataUrl, source: 'gif', name: 'gif-animation', width: gifFrames[0].canvas.width, height: gifFrames[0].canvas.height, type: 'image', size: dataUrl.length });
    }
  });
}
