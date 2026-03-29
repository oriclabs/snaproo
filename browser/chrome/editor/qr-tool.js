// Pixeroo — QR Code Tool
function initQR() {
  let qrLogo = null;   // Image element for center logo
  let qrBgImg = null;  // Background image behind QR
  let qrDebounce = null;
  let qrHistory = [];
  const QR_HISTORY_MAX = 10;

  const QR_TEMPLATES = {
    url: 'https://example.com',
    wifi: 'WIFI:T:WPA;S:NetworkName;P:Password123;;',
    email: 'mailto:name@example.com?subject=Hello&body=Hi there',
    phone: 'tel:+1234567890',
    vcard: 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nTEL:+1234567890\nEMAIL:john@example.com\nEND:VCARD',
    sms: 'smsto:+1234567890:Hello!',
    geo: 'geo:37.7749,-122.4194',
    event: 'BEGIN:VEVENT\nSUMMARY:Meeting\nDTSTART:20240101T100000Z\nDTEND:20240101T110000Z\nEND:VEVENT',
  };

  // --- QR mode tabs (Generate / Read) ---
  $$('.qr-mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.qr-mode-tab').forEach(t => {
        t.classList.remove('active');
        t.style.color = 'var(--slate-500)';
        t.style.borderBottomColor = 'transparent';
      });
      tab.classList.add('active');
      tab.style.color = 'var(--saffron-400)';
      tab.style.borderBottomColor = 'var(--saffron-400)';

      const mode = tab.dataset.qrMode;
      $('qr-panel-generate').style.display = mode === 'generate' ? 'flex' : 'none';
      $('qr-panel-read').style.display = mode === 'read' ? 'flex' : 'none';
      // Hide ribbon in Read mode (it only applies to Generate)
      const ribbon = document.querySelector('#mode-qr .tool-ribbon');
      if (ribbon) ribbon.style.display = mode === 'generate' ? '' : 'none';
    });
  });

  // --- Live preview: debounced auto-generate on text input ---
  const qrGenBtn = $('btn-qr-generate');
  function updateQrGenBtn() {
    qrGenBtn.disabled = !$('qr-text').value.trim();
  }
  updateQrGenBtn(); // initial state

  $('qr-text').addEventListener('input', () => {
    updateQrGenBtn();
    clearTimeout(qrDebounce);
    qrDebounce = setTimeout(() => genQR(), 500);
  });

  qrGenBtn.addEventListener('click', genQR);
  $('qr-text').addEventListener('keydown', e => { if (e.ctrlKey && e.key === 'Enter') genQR(); });

  // Sliders: update label + regenerate
  ['qr-px','qr-margin'].forEach(id => {
    document.getElementById(id).addEventListener('input', e => {
      document.getElementById(id+'-val').textContent = e.target.value;
      if ($('qr-text').value) genQR();
    });
  });

  // Dropdowns & color pickers: regenerate on change
  ['qr-ecc','qr-fg','qr-bg','qr-fg2','qr-style'].forEach(id => {
    document.getElementById(id).addEventListener('change', () => { if ($('qr-text').value) genQR(); });
  });

  // Gradient toggle: show/hide second color, regenerate
  $('qr-gradient').addEventListener('change', (e) => {
    $('qr-fg2').style.display = e.target.checked ? '' : 'none';
    if ($('qr-text').value) genQR();
  });

  // Compact toggle: adjust margin/px and regenerate
  $('qr-compact').addEventListener('change', (e) => {
    if (e.target.checked) {
      $('qr-margin').value = 1;
      $('qr-margin-val').textContent = '1';
      $('qr-px').value = 5;
      $('qr-px-val').textContent = '5';
    } else {
      $('qr-margin').value = 4;
      $('qr-margin-val').textContent = '4';
      $('qr-px').value = 8;
      $('qr-px-val').textContent = '8';
    }
    if ($('qr-text').value) genQR();
  });

  // Label field: regenerate on input (debounced)
  $('qr-label').addEventListener('input', () => {
    clearTimeout(qrDebounce);
    qrDebounce = setTimeout(() => { if ($('qr-text').value) genQR(); }, 500);
  });

  // --- Preset templates ---
  $$('[data-qr-preset]').forEach(b => b.addEventListener('click', () => {
    // Highlight active preset
    $$('[data-qr-preset]').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    $('qr-text').value = QR_TEMPLATES[b.dataset.qrPreset] || '';
    genQR();
  }));
  // Clear preset highlight when user manually edits text
  $('qr-text').addEventListener('keydown', () => {
    $$('[data-qr-preset]').forEach(x => x.classList.remove('active'));
  });

  // --- Logo upload ---
  $('btn-qr-logo').addEventListener('click', () => $('qr-logo-file').click());
  $('qr-logo-file').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    img.onload = () => {
      qrLogo = img;
      $('btn-qr-logo-clear').style.display = '';
      // Auto-set ECC to High when logo is present
      $('qr-ecc').value = 'H';
      if ($('qr-text').value) genQR();
    };
    img.src = URL.createObjectURL(file);
  });
  $('btn-qr-logo-clear').addEventListener('click', () => {
    qrLogo = null;
    $('qr-logo-file').value = '';
    $('btn-qr-logo-clear').style.display = 'none';
    if ($('qr-text').value) genQR();
  });

  // --- Background image upload ---
  $('btn-qr-bg-img').addEventListener('click', () => $('qr-bg-img-file').click());
  $('qr-bg-img-file').addEventListener('change', e => {
    const file = e.target.files[0]; if (!file) return;
    const img = new Image();
    img.onload = () => {
      qrBgImg = img;
      $('btn-qr-bg-img-clear').style.display = '';
      if ($('qr-text').value) genQR();
    };
    img.src = URL.createObjectURL(file);
  });
  $('btn-qr-bg-img-clear').addEventListener('click', () => {
    qrBgImg = null;
    $('qr-bg-img-file').value = '';
    $('btn-qr-bg-img-clear').style.display = 'none';
    if ($('qr-text').value) genQR();
  });

  // --- Export: Copy image ---
  $('btn-qr-copy').addEventListener('click', () => {
    $('qr-canvas').toBlob(b => navigator.clipboard.write([new ClipboardItem({'image/png':b})]));
  });

  // --- Export: Copy text ---
  $('btn-qr-copy-text').addEventListener('click', () => {
    const text = $('qr-text').value;
    if (text) navigator.clipboard.writeText(text);
  });

  // --- Export: PNG download ---
  $('btn-qr-download').addEventListener('click', () => {
    $('qr-canvas').toBlob(b => {
      chrome.runtime.sendMessage({action:'download',url:URL.createObjectURL(b),filename:'pixeroo/qrcode.png',saveAs:true});
    });
  });

  // --- Export: SVG download ---
  $('btn-qr-svg').addEventListener('click', () => {
    const text = $('qr-text').value; if (!text) return;
    try {
      const ecc = qrLogo ? 'H' : $('qr-ecc').value;
      const qr = QR.encode(text, ecc), fg = $('qr-fg').value, bg = $('qr-bg').value;
      const m = +$('qr-margin').value, style = $('qr-style').value;
      const sz = qr.size + m * 2;
      let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${sz} ${sz}"><rect width="${sz}" height="${sz}" fill="${bg}"/>`;
      for (let y = 0; y < qr.size; y++) {
        for (let x = 0; x < qr.size; x++) {
          if (!qr.modules[y][x]) continue;
          const px = x + m, py = y + m;
          if (style === 'dots') {
            svg += `<circle cx="${px + 0.5}" cy="${py + 0.5}" r="0.45" fill="${fg}"/>`;
          } else if (style === 'rounded') {
            svg += `<rect x="${px}" y="${py}" width="1" height="1" rx="0.3" ry="0.3" fill="${fg}"/>`;
          } else {
            svg += `<rect x="${px}" y="${py}" width="1" height="1" fill="${fg}"/>`;
          }
        }
      }
      svg += '</svg>';
      chrome.runtime.sendMessage({action:'download',url:URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'})),filename:'pixeroo/qrcode.svg',saveAs:true});
    } catch {}
  });

  // --- Export: All Sizes ZIP ---
  $('btn-qr-sizes')?.addEventListener('click', async () => {
    const text = $('qr-text').value; if (!text) return;
    const ecc = qrLogo ? 'H' : $('qr-ecc').value;
    const fg = $('qr-fg').value, bg = $('qr-bg').value;
    const style = $('qr-style').value, label = $('qr-label').value.trim();
    const zip = new ZipWriter();
    for (const targetSize of [128, 256, 512, 1024]) {
      const tc = document.createElement('canvas');
      const qr = QR.encode(text, ecc);
      const margin = +$('qr-margin').value;
      const px = Math.max(1, Math.floor(targetSize / (qr.size + margin * 2)));
      renderQRToCanvas(tc, qr, px, margin, fg, bg, style, qrLogo, label);
      const blob = await new Promise(r => tc.toBlob(r, 'image/png'));
      await zip.addBlob(`qr-${targetSize}x${targetSize}.png`, blob);
    }
    const zipBlob = zip.toBlob();
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a'); a.href = url; a.download = 'pixeroo-qr-sizes.zip'; a.click();
    URL.revokeObjectURL(url);
  });

  // --- Bulk QR Generation ---
  $('btn-qr-bulk')?.addEventListener('click', async () => {
    // Build a custom modal with textarea since pixDialog.prompt uses a single-line input
    const input = await new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483646;background:rgba(2,6,23,0.7);display:flex;align-items:center;justify-content:center;';
      overlay.innerHTML = `
        <div style="background:var(--slate-900,#0f172a);border:1px solid var(--slate-700,#334155);border-radius:12px;padding:1.25rem;min-width:360px;max-width:75vw;box-shadow:0 20px 60px rgba(0,0,0,0.5);font-family:Inter,system-ui,sans-serif;">
          <div style="font-size:0.875rem;font-weight:600;color:var(--slate-200,#e2e8f0);margin-bottom:0.5rem;">Bulk QR Generation</div>
          <div style="color:var(--slate-400,#94a3b8);margin-bottom:0.75rem;">Paste a list of URLs or texts below — <b style="color:var(--saffron-400);">one per line</b>. A separate QR code will be generated for each line and downloaded as a ZIP file.</div>
          <textarea id="bulk-qr-input" style="width:100%;min-height:120px;background:var(--slate-800,#1e293b);color:var(--slate-200,#e2e8f0);border:1px solid var(--slate-700,#334155);border-radius:6px;padding:8px 10px;resize:vertical;outline:none;font-family:monospace;" placeholder="https://example.com&#10;https://another.com&#10;WIFI:T:WPA;S:MyNetwork;P:pass123;;"></textarea>
          <div style="color:var(--slate-500);margin-top:0.375rem;">Using current settings: <b>${$('qr-style')?.value || 'square'}</b> style, <b>${$('qr-ecc')?.value || 'M'}</b> ECC, <b>${$('qr-px')?.value || 8}</b>px</div>
          <div style="display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.75rem;">
            <button id="bulk-qr-cancel" style="background:var(--slate-800,#1e293b);color:var(--slate-300,#cbd5e1);border:1px solid var(--slate-700,#334155);border-radius:6px;padding:6px 16px;font-size:0.75rem;font-weight:500;cursor:pointer;">Cancel</button>
            <button id="bulk-qr-ok" style="background:#F4C430;color:#2A1E05;border:none;border-radius:6px;padding:6px 20px;font-size:0.75rem;font-weight:600;cursor:pointer;">Generate ZIP</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#bulk-qr-cancel').addEventListener('click', () => { document.body.removeChild(overlay); resolve(null); });
      overlay.querySelector('#bulk-qr-ok').addEventListener('click', () => { const v = overlay.querySelector('#bulk-qr-input').value; document.body.removeChild(overlay); resolve(v); });
      overlay.addEventListener('click', e => { if (e.target === overlay) { document.body.removeChild(overlay); resolve(null); } });
      setTimeout(() => overlay.querySelector('#bulk-qr-input').focus(), 50);
    });
    if (!input) return;
    const lines = input.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;

    const ecc = qrLogo ? 'H' : $('qr-ecc').value;
    const fg = $('qr-fg').value, bg = $('qr-bg').value;
    const px = +$('qr-px').value, margin = +$('qr-margin').value;
    const style = $('qr-style').value, label = $('qr-label').value.trim();
    const zip = new ZipWriter();
    for (let i = 0; i < lines.length; i++) {
      try {
        const tc = document.createElement('canvas');
        const qr = QR.encode(lines[i], ecc);
        renderQRToCanvas(tc, qr, px, margin, fg, bg, style, qrLogo, label);
        const blob = await new Promise(r => tc.toBlob(r, 'image/png'));
        await zip.addBlob(`qr-${String(i + 1).padStart(3, '0')}.png`, blob);
      } catch { /* skip lines that are too long */ }
    }
    const zipBlob = zip.toBlob();
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a'); a.href = url; a.download = 'pixeroo-qr-bulk.zip'; a.click();
    URL.revokeObjectURL(url);
  });

  // --- QR Read / Decode ---
  async function readQRFromFile(file) {
    const img = await loadImg(file);
    if (!img) throw new Error('Could not load image');

    // Try multiple scales — QR readers can be picky about resolution
    const scales = [1, 0.5, 2, 0.25];
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

    for (const scale of scales) {
      const w = Math.round(origW * scale);
      const h = Math.round(origH * scale);
      if (w < 20 || h < 20 || w > 2000 || h > 2000) continue;

      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      // White background (helps with transparent PNGs)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h);

      try {
        const result = await chrome.runtime.sendMessage({
          action: 'readQR',
          data: Array.from(imageData.data),
          width: w,
          height: h
        });
        if (result?.text) return result.text;
      } catch {}
    }
    return null;
  }

  setupDropzone($('qr-read-drop'), $('qr-read-file'), async (file) => {
    const resultEl = $('qr-read-result');
    // Show the dropped image as preview
    const previewUrl = URL.createObjectURL(file);
    resultEl.style.display = 'block';
    resultEl.innerHTML = `
      <div style="display:flex;gap:12px;align-items:flex-start;">
        <img src="${previewUrl}" style="width:80px;height:80px;object-fit:contain;border-radius:6px;border:1px solid var(--slate-700);background:#fff;flex-shrink:0;">
        <div style="flex:1;"><span style="color:var(--slate-400);">Reading QR code...</span></div>
      </div>`;
    try {
      const data = await readQRFromFile(file);
      if (data) {
        resultEl.innerHTML = `
          <div style="display:flex;gap:12px;align-items:flex-start;">
            <img src="${previewUrl}" style="width:60px;height:60px;object-fit:contain;border-radius:6px;border:1px solid var(--slate-700);background:#fff;flex-shrink:0;">
            <div style="flex:1;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:0.375rem;">
                <span style="color:#22c55e;font-weight:600;">QR Code Found</span>
                <div style="display:flex;gap:4px;">
                  <button class="tool-btn qr-read-use" style="border:1px solid var(--saffron-400);color:var(--saffron-400);padding:2px 8px;" title="Load this text into the generator">Use</button>
                  <button class="tool-btn qr-read-copy" style="border:1px solid var(--slate-700);padding:2px 8px;" title="Copy to clipboard">Copy</button>
                  <button class="tool-btn qr-read-close" style="border:1px solid var(--slate-700);padding:2px 6px;" title="Dismiss">&#x2715;</button>
                </div>
              </div>
              <div class="copyable" style="color:var(--slate-200);word-break:break-all;cursor:pointer;padding:6px;background:var(--slate-900);border-radius:4px;" title="Click to copy">${esc(data)}</div>
            </div>
          </div>`;
        resultEl.querySelector('.qr-read-copy')?.addEventListener('click', () => navigator.clipboard.writeText(data));
        resultEl.querySelector('.qr-read-use')?.addEventListener('click', () => {
          $('qr-text').value = data;
          updateQrGenBtn();
          genQR();
          // Switch to Generate tab
          document.querySelector('.qr-mode-tab[data-qr-mode="generate"]')?.click();
        });
        resultEl.querySelector('.qr-read-close')?.addEventListener('click', () => { resultEl.style.display = 'none'; });
      } else {
        resultEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;">
            <span style="color:#ef4444;">No QR code found in this image</span>
            <button class="tool-btn qr-read-close" style="border:1px solid var(--slate-700);padding:2px 6px;" title="Dismiss">&#x2715;</button>
          </div>
          <div style="color:var(--slate-500);margin-top:0.25rem;">Make sure the image contains a clear, unobstructed QR code.</div>`;
        resultEl.querySelector('.qr-read-close')?.addEventListener('click', () => { resultEl.style.display = 'none'; });
      }
    } catch (e) {
      resultEl.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="color:#ef4444;">Failed to read QR</span>
          <button class="tool-btn qr-read-close" style="border:1px solid var(--slate-700);padding:2px 6px;" title="Dismiss">&#x2715;</button>
        </div>
        <div style="color:var(--slate-500);margin-top:0.25rem;">${esc(e.message)}</div>`;
      resultEl.querySelector('.qr-read-close')?.addEventListener('click', () => { resultEl.style.display = 'none'; });
    }
  });

  // --- QR History ---
  async function loadQrHistory() {
    try {
      const r = await chrome.storage.local.get('qrHistory');
      qrHistory = r.qrHistory || [];
      renderQrHistory();
    } catch {}
  }

  function saveQrHistory() {
    chrome.storage.local.set({ qrHistory }).catch(() => {});
    renderQrHistory();
  }

  let _lastQrHistoryText = '';

  function addToQrHistory(text, dataUrl) {
    // Only add new entry when text content changes
    if (text === _lastQrHistoryText) {
      // Just update the thumbnail of the existing entry (style changed)
      const existing = qrHistory.find(h => h.text === text);
      if (existing) existing.dataUrl = dataUrl;
      return;
    }
    _lastQrHistoryText = text;
    qrHistory = qrHistory.filter(h => h.text !== text);
    qrHistory.unshift({ text, dataUrl, timestamp: Date.now() });
    if (qrHistory.length > QR_HISTORY_MAX) qrHistory.pop();
    saveQrHistory();
  }

  function renderQrHistory() {
    const container = $('qr-history');
    const list = $('qr-history-list');
    if (!qrHistory.length) { container.style.display = 'none'; return; }
    container.style.display = 'block';
    list.innerHTML = '';
    qrHistory.forEach((item, idx) => {
      const thumb = document.createElement('img');
      thumb.src = item.dataUrl;
      const date = new Date(item.timestamp).toLocaleString();
      const preview = item.text.length > 60 ? item.text.substring(0, 60) + '...' : item.text;
      thumb.title = `${preview}\n${date}`;
      thumb.style.cssText = 'width:50px;height:50px;object-fit:contain;border-radius:4px;border:1px solid var(--slate-700);cursor:pointer;background:#fff;flex-shrink:0;transition:border-color 0.12s;';
      thumb.addEventListener('mouseenter', () => { thumb.style.borderColor = 'var(--saffron-400)'; });
      thumb.addEventListener('mouseleave', () => { thumb.style.borderColor = 'var(--slate-700)'; });
      thumb.addEventListener('click', () => {
        $('qr-text').value = item.text;
        genQR();
      });
      // Right-click context menu on history item
      thumb.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        _qrHistoryCtxMenu(e.clientX, e.clientY, item, idx);
      });
      list.appendChild(thumb);
    });
  }

  // Reset all QR settings to defaults
  $('btn-qr-reset')?.addEventListener('click', async () => {
    const ok = await pixDialog.confirm('Reset QR Tool', 'Reset all settings to defaults?', { okText: 'Reset' });
    if (!ok) return;
    // Text & label
    $('qr-text').value = '';
    $('qr-label').value = '';
    // Style
    $('qr-style').value = 'square';
    $('qr-ecc').value = 'M';
    $('qr-px').value = 8; $('qr-px-val').textContent = '8';
    $('qr-margin').value = 4; $('qr-margin-val').textContent = '4';
    // Colors
    $('qr-fg').value = '#000000';
    $('qr-bg').value = '#ffffff';
    const gradCb = $('qr-gradient');
    if (gradCb) { gradCb.checked = false; gradCb.dispatchEvent(new Event('change')); }
    $('qr-fg2').value = '#0066ff';
    const compactCb = $('qr-compact');
    if (compactCb) { compactCb.checked = false; compactCb.dispatchEvent(new Event('change')); }
    // Logo
    if (typeof qrLogo !== 'undefined') qrLogo = null;
    const logoClear = $('btn-qr-logo-clear');
    if (logoClear) { logoClear.style.display = 'none'; }
    // Clear preset highlight
    $$('[data-qr-preset]').forEach(b => b.classList.remove('active'));
    // Clear canvas
    const cvs = $('qr-canvas');
    cvs.width = 0; cvs.height = 0;
    // Update generate button state
    updateQrGenBtn();
  });

  $('btn-qr-history-clear')?.addEventListener('click', () => {
    qrHistory = [];
    saveQrHistory();
  });

  // --- Context menus for QR ---
  function _removeQrCtx() { document.querySelector('.qr-ctx-menu')?.remove(); }

  function _showQrCtxMenu(x, y, items) {
    _removeQrCtx();
    const menu = document.createElement('div');
    menu.className = 'ctx-menu qr-ctx-menu';
    menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - items.length * 30 - 10) + 'px';
    items.forEach(item => {
      if (item === 'sep') {
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:var(--slate-800);margin:2px 0;';
        menu.appendChild(sep);
        return;
      }
      const row = document.createElement('div');
      row.className = 'ctx-menu-item';
      row.textContent = item.label;
      row.addEventListener('click', () => { _removeQrCtx(); item.action(); });
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
    setTimeout(() => {
      document.addEventListener('click', _removeQrCtx, { once: true });
      document.addEventListener('keydown', function esc(e) {
        if (e.key === 'Escape') { _removeQrCtx(); document.removeEventListener('keydown', esc); }
      });
    }, 10);
  }

  // Right-click on QR history thumbnail
  function _qrHistoryCtxMenu(x, y, item, idx) {
    _showQrCtxMenu(x, y, [
      { label: 'Load this QR', action: () => { $('qr-text').value = item.text; genQR(); } },
      { label: 'Copy Text', action: () => navigator.clipboard.writeText(item.text) },
      { label: 'Copy Image', action: async () => {
        try {
          const resp = await fetch(item.dataUrl);
          const blob = await resp.blob();
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch {}
      }},
      { label: 'Download PNG', action: () => {
        chrome.runtime.sendMessage({ action: 'download', url: item.dataUrl, filename: 'pixeroo/qr-history.png', saveAs: true });
      }},
      'sep',
      { label: 'Remove from History', action: () => {
        qrHistory.splice(idx, 1);
        saveQrHistory();
      }},
    ]);
  }

  // Right-click on generated QR canvas
  $('qr-canvas')?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const cvs = $('qr-canvas');
    const text = $('qr-text').value;
    if (!text || !cvs.width) return;
    _showQrCtxMenu(e.clientX, e.clientY, [
      { label: 'Copy Image', action: async () => {
        try {
          const blob = await new Promise(r => cvs.toBlob(r, 'image/png'));
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch {}
      }},
      { label: 'Copy Text', action: () => navigator.clipboard.writeText(text) },
      'sep',
      { label: 'Download PNG', action: () => { $('btn-qr-download')?.click(); }},
      { label: 'Download SVG', action: () => { $('btn-qr-svg')?.click(); }},
      { label: 'Download All Sizes', action: () => { $('btn-qr-sizes')?.click(); }},
      'sep',
      { label: 'Save to Library', action: () => { $('btn-qr-save-lib')?.click(); }},
    ]);
  });

  loadQrHistory();

  // ---- Core render function used by genQR, bulk, and all-sizes ----
  function renderQRToCanvas(canvas, qr, pixelSize, margin, fg, bg, style, logo, label) {
    const { modules, size } = qr;
    const qrPx = (size + margin * 2) * pixelSize;
    const labelH = label ? Math.max(20, Math.round(pixelSize * 3.5)) : 0;
    const totalW = qrPx;
    const totalH = qrPx + labelH;
    canvas.width = totalW;
    canvas.height = totalH;
    const ctx = canvas.getContext('2d');

    const gradientEnabled = $('qr-gradient')?.checked;
    const fg2Color = $('qr-fg2')?.value || '#0066ff';

    // Background
    if (qrBgImg) {
      // Draw background image scaled to cover the QR area
      const imgRatio = qrBgImg.naturalWidth / qrBgImg.naturalHeight;
      const canvasRatio = totalW / totalH;
      let drawW, drawH, drawX, drawY;
      if (imgRatio > canvasRatio) {
        drawH = totalH;
        drawW = totalH * imgRatio;
        drawX = (totalW - drawW) / 2;
        drawY = 0;
      } else {
        drawW = totalW;
        drawH = totalW / imgRatio;
        drawX = 0;
        drawY = (totalH - drawH) / 2;
      }
      ctx.drawImage(qrBgImg, drawX, drawY, drawW, drawH);
      // Draw semi-transparent white behind each module for contrast
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          if (!modules[y][x]) continue;
          const px = (x + margin) * pixelSize;
          const py = (y + margin) * pixelSize;
          ctx.fillRect(px - 1, py - 1, pixelSize + 2, pixelSize + 2);
        }
      }
    } else {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, totalW, totalH);
    }

    // Set fill style: gradient or solid
    if (gradientEnabled) {
      const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
      grad.addColorStop(0, fg);
      grad.addColorStop(1, fg2Color);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = fg;
    }

    // Draw modules with chosen style
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!modules[y][x]) continue;
        const px = (x + margin) * pixelSize;
        const py = (y + margin) * pixelSize;
        if (style === 'dots') {
          ctx.beginPath();
          ctx.arc(px + pixelSize / 2, py + pixelSize / 2, pixelSize * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (style === 'rounded') {
          const r = pixelSize * 0.3;
          ctx.beginPath();
          ctx.roundRect(px, py, pixelSize, pixelSize, r);
          ctx.fill();
        } else {
          ctx.fillRect(px, py, pixelSize, pixelSize);
        }
      }
    }

    // Draw logo centered on QR
    if (logo) {
      const logoSize = Math.round(qrPx * 0.2);
      const lx = Math.round((qrPx - logoSize) / 2);
      const ly = Math.round((qrPx - logoSize) / 2);
      const pad = 4;
      // White rounded-rect background behind logo
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(lx - pad, ly - pad, logoSize + pad * 2, logoSize + pad * 2, 6);
      ctx.fill();
      // Draw logo image
      ctx.drawImage(logo, lx, ly, logoSize, logoSize);
    }

    // Draw label below QR
    if (label) {
      const fontSize = Math.max(11, Math.round(pixelSize * 2));
      ctx.fillStyle = fg;
      ctx.font = `bold ${fontSize}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, totalW / 2, qrPx + labelH / 2);
    }
  }

  // QR max capacity (bytes) by ECC level
  const QR_MAX_BYTES = { L: 2953, M: 2331, Q: 1663, H: 1273 };

  function validateQRContent(text) {
    if (!text) return 'Enter text or URL to generate QR code';
    const ecc = qrLogo ? 'H' : $('qr-ecc').value;
    const maxBytes = QR_MAX_BYTES[ecc] || 2331;
    const byteLen = new TextEncoder().encode(text).length;
    if (byteLen > maxBytes) return `Content too long (${byteLen} bytes). Max for ${ecc} correction: ${maxBytes} bytes. Shorten text or lower error correction.`;

    // Detect preset type and validate
    if (text.startsWith('https://') || text.startsWith('http://')) {
      try { new URL(text); } catch { return 'Invalid URL format'; }
    } else if (text.startsWith('mailto:')) {
      if (!text.includes('@')) return 'Email must contain @ symbol';
    } else if (text.startsWith('tel:') || text.startsWith('TEL:')) {
      const num = text.replace(/^tel:/i, '');
      if (!/^[+\d\s()-]+$/.test(num)) return 'Phone number contains invalid characters';
    } else if (text.startsWith('WIFI:')) {
      if (!text.includes('S:') || text.includes('S:;')) return 'WiFi config must include network name (S:YourSSID)';
    } else if (text.startsWith('BEGIN:VCARD')) {
      if (!text.includes('FN:')) return 'vCard must include a name (FN:Name)';
      if (!text.includes('END:VCARD')) return 'vCard must end with END:VCARD';
    } else if (text.startsWith('smsto:')) {
      if (text === 'smsto:') return 'SMS must include a phone number';
    } else if (text.startsWith('geo:')) {
      const coords = text.replace('geo:', '');
      if (!/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/.test(coords)) return 'Geo format: geo:latitude,longitude (e.g. geo:37.77,-122.42)';
    } else if (text.startsWith('BEGIN:VEVENT')) {
      if (!text.includes('SUMMARY:')) return 'Event must include SUMMARY:EventName';
      if (!text.includes('END:VEVENT')) return 'Event must end with END:VEVENT';
    }
    // Auto-prepend https:// if it looks like a URL
    if (/^[a-z0-9][-a-z0-9]*\.[a-z]{2,}/i.test(text) && !text.includes(' ') && !text.includes(':')) {
      $('qr-text').value = 'https://' + text;
    }
    return null; // valid
  }

  function showQRError(msg) {
    const c = $('qr-canvas');
    c.width = 240; c.height = 60;
    const x = c.getContext('2d');
    x.fillStyle = '#1e293b'; x.fillRect(0, 0, 240, 60);
    x.fillStyle = '#ef4444'; x.font = 'bold 11px sans-serif'; x.textAlign = 'center';
    // Word wrap
    const words = msg.split(' '); let lines = [''];
    words.forEach(w => { if ((lines[lines.length-1] + ' ' + w).length > 35) lines.push(w); else lines[lines.length-1] += (lines[lines.length-1] ? ' ' : '') + w; });
    lines.forEach((line, i) => x.fillText(line, 120, 20 + i * 16));
  }

  function genQR() {
    const text = $('qr-text').value;
    if (!text) return;

    const error = validateQRContent(text);
    if (error) { showQRError(error); return; }

    // Re-read text (may have been auto-corrected by validation)
    const finalText = $('qr-text').value;

    try {
      const ecc = qrLogo ? 'H' : $('qr-ecc').value;
      const qr = QR.encode(finalText, ecc);
      const px = +$('qr-px').value;
      const margin = +$('qr-margin').value;
      const fg = $('qr-fg').value;
      const bg = $('qr-bg').value;
      const style = $('qr-style').value;
      const label = $('qr-label').value.trim();
      const cvs = $('qr-canvas');
      renderQRToCanvas(cvs, qr, px, margin, fg, bg, style, qrLogo, label);
      try { addToQrHistory(finalText, cvs.toDataURL('image/png')); } catch {}
    } catch {
      showQRError('Could not generate QR. Text may be too long.');
    }
  }
}
