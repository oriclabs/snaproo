// DOM helpers — reduce verbosity across all tool files
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const on = (el, evt, fn) => el?.addEventListener(evt, fn);

// Pixeroo — Shared Editor Utilities

// ── Shared mutable globals ──
let editCanvas, editCtx, editOriginal, editFilename = 'edited';
const pipeline = new EditPipeline();
let editGuides = null; // CanvasGuides instance

let barUnitPx = true;
let barLocked = true;
let originalW = 0, originalH = 0;

let currentMode = null;

let convertFiles = [];

// Wrap all <input type="number"> with custom spinner buttons (cross-browser)
function enhanceNumberInputs(root) {
  const inputs = (root || document).querySelectorAll('input[type="number"]:not([data-spin-done])');
  inputs.forEach(input => {
    input.setAttribute('data-spin-done', '1');

    // Create wrapper
    const wrap = document.createElement('span');
    wrap.className = 'num-spin';
    // Preserve any inline width from the input
    const inlineW = input.style.width;
    if (inlineW) { wrap.style.width = inlineW; input.style.width = '100%'; }

    // Button column
    const btns = document.createElement('span');
    btns.className = 'num-spin-btns';
    const upBtn = document.createElement('button');
    upBtn.className = 'num-spin-btn';
    upBtn.type = 'button';
    upBtn.innerHTML = '&#9650;'; // ▲
    upBtn.tabIndex = -1;
    const downBtn = document.createElement('button');
    downBtn.className = 'num-spin-btn';
    downBtn.type = 'button';
    downBtn.innerHTML = '&#9660;'; // ▼
    downBtn.tabIndex = -1;
    btns.appendChild(upBtn);
    btns.appendChild(downBtn);

    // Insert wrapper
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(btns);

    // Remove input border (wrapper has it)
    input.style.border = 'none';
    input.style.background = 'transparent';
    input.style.minWidth = '0';
    input.style.minHeight = '0';

    const step = +(input.step) || 1;
    const min = input.min !== '' ? +input.min : -Infinity;
    const max = input.max !== '' ? +input.max : Infinity;

    function nudge(dir) {
      let v = +(input.value) || 0;
      v += dir * step;
      v = Math.max(min, Math.min(max, v));
      input.value = v;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Click: instant nudge. Hold: wait 400ms then repeat every 100ms.
    let holdDelay = null, holdInterval = null;
    function stopHold() {
      clearTimeout(holdDelay); holdDelay = null;
      clearInterval(holdInterval); holdInterval = null;
    }
    function bindBtn(btn, dir) {
      btn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        nudge(dir);
        stopHold();
        holdDelay = setTimeout(() => {
          holdInterval = setInterval(() => nudge(dir), 100);
        }, 400);
      });
      btn.addEventListener('mouseup', stopHold);
      btn.addEventListener('mouseleave', stopHold);
    }
    bindBtn(upBtn, 1);
    bindBtn(downBtn, -1);
  });
}

// Shared: allow dropping a new image onto the work area to replace current (with confirmation)
function setupWorkAreaReplace(workAreaSelector, onReplace, opts = {}) {
  const area = typeof workAreaSelector === 'string' ? document.querySelector(workAreaSelector) : workAreaSelector;
  if (!area) return;
  area.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });
  area.addEventListener('drop', async (e) => {
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    e.preventDefault();
    const msg = opts.confirmMsg || 'Replace current image? Unsaved changes will be lost.';
    const ok = await pixDialog.confirm('Replace Image', msg, { okText: 'Replace' });
    if (!ok) return;
    onReplace(file);
  });
}

function setupDropzone(dropEl, fileInput, onFile, opts = {}) {
  dropEl.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => {
    const files = opts.multiple ? [...e.target.files] : [e.target.files[0]];
    files.filter(Boolean).forEach(onFile);
  });
  dropEl.addEventListener('dragover', (e) => { e.preventDefault(); dropEl.classList.add('dragover'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('dragover'));
  dropEl.addEventListener('drop', (e) => {
    e.preventDefault(); dropEl.classList.remove('dragover');
    const files = opts.multiple ? [...e.dataTransfer.files] : [e.dataTransfer.files[0]];
    files.filter(Boolean).forEach(onFile);
  });
}

async function loadImg(file) {
  // Use createImageBitmap with EXIF orientation correction (handles rotated phone photos)
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
    c.getContext('2d').drawImage(bitmap, 0, 0); bitmap.close();
    const img = new Image(); img.src = c.toDataURL();
    await new Promise((ok, fail) => { img.onload = ok; img.onerror = fail; });
    return img;
  } catch {}
  // Fallback for older browsers
  return new Promise(r => {
    const reader = new FileReader();
    reader.onload = (e) => { const img = new Image(); img.onload = () => r(img); img.onerror = () => r(null); img.src = e.target.result; };
    reader.readAsDataURL(file);
  });
}

function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
function formatBytes(b) { if (b < 1024) return b+' B'; if (b < 1048576) return (b/1024).toFixed(1)+' KB'; return (b/1048576).toFixed(1)+' MB'; }
function rgbHex(r,g,b) { return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function rgbHsl(r,g,b) { r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h,s,l=(mx+mn)/2;if(mx===mn){h=s=0}else{const d=mx-mn;s=l>.5?d/(2-mx-mn):d/(mx+mn);if(mx===r)h=((g-b)/d+(g<b?6:0))/6;else if(mx===g)h=((b-r)/d+2)/6;else h=((r-g)/d+4)/6;}return`hsl(${Math.round(h*360)},${Math.round(s*100)}%,${Math.round(l*100)}%)`; }
function gcd(a,b){return b===0?a:gcd(b,a%b);}

function triggerDrop(dropId, inputId, file) {
  const dt = new DataTransfer(); dt.items.add(file);
  const input = document.getElementById(inputId);
  input.files = dt.files;
  input.dispatchEvent(new Event('change'));
}

function steppedResize(source, targetW, targetH) {
  let current = source;
  let cw = source.width, ch = source.height;

  while (cw / 2 > targetW || ch / 2 > targetH) {
    const halfW = Math.max(Math.floor(cw / 2), targetW);
    const halfH = Math.max(Math.floor(ch / 2), targetH);
    const step = document.createElement('canvas');
    step.width = halfW; step.height = halfH;
    const sc = step.getContext('2d');
    sc.imageSmoothingEnabled = true;
    sc.imageSmoothingQuality = 'high';
    sc.drawImage(current, 0, 0, halfW, halfH);
    current = step; cw = halfW; ch = halfH;
  }

  // Final step to exact target
  const result = document.createElement('canvas');
  result.width = targetW; result.height = targetH;
  const rc = result.getContext('2d');
  rc.imageSmoothingEnabled = true;
  rc.imageSmoothingQuality = 'high';
  rc.drawImage(current, 0, 0, targetW, targetH);
  return result;
}
