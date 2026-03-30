// DOM helpers — reduce verbosity across all tool files
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);
const on = (el, evt, fn) => el?.addEventListener(evt, fn);

// Snaproo — Shared Editor Utilities

// ── Shared mutable globals ──
let editCanvas, editCtx, editOriginal, editFilename = 'edited';
const pipeline = new EditPipeline();
let editGuides = null; // CanvasGuides instance

let barUnitPx = true;
let barLocked = true;
let originalW = 0, originalH = 0;

let currentMode = null;

// Toast notification
function showToast(message, icon) {
  let toast = document.querySelector('.pix-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'pix-toast';
    document.body.appendChild(toast);
  }
  const iconSvg = icon === 'success'
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
    : icon === 'info'
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    : '';
  toast.innerHTML = iconSvg + '<span>' + message + '</span>';
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

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

// Direct download via <a> tag — avoids blob URL issues with background script
function directDownload(blob, filename) {
  const url = URL.createObjectURL(blob instanceof Blob ? blob : new Blob([blob]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Sanitize filename: spaces → hyphens, strip illegal chars, collapse hyphens
function sanitizeFilename(name) {
  return name.replace(/\s+/g, '-').replace(/[<>:"/\\|?*]+/g, '').replace(/-{2,}/g, '-');
}

// Shared Rename Popover — reusable across Convert, Batch, etc.
// opts: { inputId, tokens: [{token, label?}], getSampleFn: () => { name, ext } }
// Returns { popoverEl, getValue, destroy }
function createRenamePopover(anchorBtn, opts) {
  const { inputId, tokens, getSampleFn } = opts;
  const hiddenInput = $(inputId);

  // Build popover DOM
  const popover = document.createElement('div');
  popover.id = inputId + '-popover';
  popover.style.cssText = 'display:none;position:absolute;top:100%;left:50%;transform:translateX(-50%);z-index:100;margin-top:4px;background:var(--slate-900);border:1px solid var(--slate-700);border-radius:10px;box-shadow:0 12px 36px rgba(0,0,0,0.5);padding:14px 16px;width:320px;';

  const title = document.createElement('div');
  title.style.cssText = 'color:var(--slate-300);font-size:0.75rem;font-weight:600;margin-bottom:10px;';
  title.textContent = 'Output Filename Pattern';
  popover.appendChild(title);

  const input = document.createElement('input');
  input.type = 'text';
  input.id = inputId + '-popover-input';
  input.className = 'input-field';
  input.value = hiddenInput?.value || '{name}';
  input.style.cssText = 'width:100%;padding:6px 10px;font-size:0.8rem;font-family:monospace;box-sizing:border-box;margin-bottom:8px;';
  popover.appendChild(input);

  // Token chips
  const chipRow = document.createElement('div');
  chipRow.style.cssText = 'display:flex;gap:6px;margin-bottom:10px;flex-wrap:wrap;';
  tokens.forEach(t => {
    const chip = document.createElement('button');
    chip.textContent = t.token;
    chip.title = t.label || t.token;
    chip.style.cssText = 'padding:4px 10px;font-size:0.7rem;border:1px solid var(--slate-600);border-radius:4px;background:var(--slate-800);color:var(--slate-300);cursor:pointer;font-family:monospace;';
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      const start = input.selectionStart;
      const end = input.selectionEnd;
      input.value = input.value.slice(0, start) + t.token + input.value.slice(end);
      input.selectionStart = input.selectionEnd = start + t.token.length;
      input.focus();
      updatePreview();
    });
    chipRow.appendChild(chip);
  });
  popover.appendChild(chipRow);

  // Preview
  const previewLabel = document.createElement('div');
  previewLabel.style.cssText = 'color:var(--slate-500);font-size:0.65rem;margin-bottom:4px;';
  previewLabel.textContent = 'Preview:';
  popover.appendChild(previewLabel);

  const previewEl = document.createElement('div');
  previewEl.style.cssText = 'color:var(--slate-300);font-size:0.75rem;font-family:monospace;background:var(--slate-800);border-radius:4px;padding:6px 10px;word-break:break-all;';
  popover.appendChild(previewEl);

  // Insert into DOM
  anchorBtn.style.position = 'relative';
  anchorBtn.parentElement.style.position = 'relative';
  anchorBtn.parentElement.appendChild(popover);

  function updatePreview() {
    const pattern = input.value || '{name}';
    if (hiddenInput) hiddenInput.value = pattern;
    const sample = getSampleFn ? getSampleFn(pattern) : null;
    if (sample) {
      previewEl.textContent = sanitizeFilename(sample.name) + '.' + sample.ext;
    } else {
      previewEl.textContent = sanitizeFilename(pattern.replace(/\{name\}/g, 'photo').replace(/\{index\}/g, '001').replace(/\{[^}]+\}/g, '')) + '.webp';
    }
  }

  input.addEventListener('input', updatePreview);

  // Toggle popover
  anchorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const show = popover.style.display === 'none';
    popover.style.display = show ? '' : 'none';
    if (show) {
      input.value = hiddenInput?.value || '{name}';
      updatePreview();
      input.focus();
      input.select();
    }
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (popover.style.display !== 'none' && !popover.contains(e.target) && e.target !== anchorBtn && !anchorBtn.contains(e.target)) {
      if (hiddenInput) hiddenInput.value = input.value || '{name}';
      popover.style.display = 'none';
    }
  });

  return {
    popoverEl: popover,
    getValue: () => input.value || '{name}',
    updatePreview,
    destroy: () => { popover.remove(); },
  };
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
