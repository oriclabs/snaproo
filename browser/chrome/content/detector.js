// Snaproo Content Script - Image Detector
// Minimal footprint: only activates when messaged by background/popup/sidepanel

(() => {
  'use strict';

  // --- Watch for lazy-loaded images ---
  let _observerActive = false;
  let _lastImageCount = 0;
  let _debounceTimer = null;

  function startImageObserver() {
    if (_observerActive) return;
    _observerActive = true;
    _lastImageCount = document.querySelectorAll('img').length;

    const observer = new MutationObserver(() => {
      try { chrome.runtime; } catch { observer.disconnect(); return; }
      const currentCount = document.querySelectorAll('img').length;
      if (currentCount > _lastImageCount) {
        _lastImageCount = currentCount;
        clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
          try {
            chrome.runtime.sendMessage({ action: 'imagesUpdated' }).catch(() => {});
          } catch { observer.disconnect(); }
        }, 800);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // --- Message Listener ---
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'getPageImages':
        sendResponse({ images: collectPageImages() });
        startImageObserver();
        break;

      case 'cancelEyedropper':
        document.getElementById('snaproo-eyedropper')?.remove();
        sendResponse({ success: true });
        break;

      case 'showImageInfo':
        showImageInfoOverlay(message.src);
        sendResponse({ success: true });
        break;

      case 'copyAsPng':
        copyImageAsPng(message.src);
        sendResponse({ success: true });
        break;

      case 'convertAndSave':
        convertAndSave(message.src, message.format);
        sendResponse({ success: true });
        break;

      case 'readQR':
        readQRFromImage(message.src);
        sendResponse({ success: true });
        break;

      case 'extractColors':
        extractColorsFromImage(message.src);
        sendResponse({ success: true });
        break;

      case 'startEyedropper':
        startEyedropperOverlay(message.screenshot, sendResponse);
        return true; // async response

      case 'quickQR':
        sendResponse({ success: true });
        break;

      case 'runAudit':
        runAccessibilityAudit();
        sendResponse({ success: true });
        break;

      case 'extractPageColors':
        sendResponse({ colors: extractCSSColors() });
        break;

      case 'startRegionCapture':
        _showRegionSelector();
        sendResponse({ ok: true });
        break;

      case 'startFullPageCapture':
        _captureFullPage();
        sendResponse({ ok: true });
        break;

      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true;
  });

  // ── Region capture overlay ─────────────────────────────
  function _showRegionSelector() {
    // Create full-screen overlay for user to draw a rectangle
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:crosshair;background:rgba(0,0,0,0.15);';
    const hint = document.createElement('div');
    hint.textContent = 'Click and drag to select a region. Press Escape to cancel.';
    hint.style.cssText = 'position:fixed;top:16px;left:50%;transform:translateX(-50%);background:rgba(15,23,42,0.9);color:#e2e8f0;padding:8px 16px;border-radius:8px;font:13px Inter,system-ui,sans-serif;z-index:2147483647;pointer-events:none;';
    overlay.appendChild(hint);
    document.body.appendChild(overlay);

    let startX, startY, selBox = null;

    overlay.addEventListener('mousedown', (e) => {
      startX = e.clientX; startY = e.clientY;
      selBox = document.createElement('div');
      selBox.style.cssText = 'position:fixed;border:2px solid #F4C430;background:rgba(244,196,48,0.08);pointer-events:none;z-index:2147483647;';
      document.body.appendChild(selBox);
    });

    overlay.addEventListener('mousemove', (e) => {
      if (!selBox) return;
      const x = Math.min(startX, e.clientX), y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
      selBox.style.left = x + 'px'; selBox.style.top = y + 'px';
      selBox.style.width = w + 'px'; selBox.style.height = h + 'px';
    });

    overlay.addEventListener('mouseup', (e) => {
      const x = Math.min(startX, e.clientX), y = Math.min(startY, e.clientY);
      const w = Math.abs(e.clientX - startX), h = Math.abs(e.clientY - startY);
      overlay.remove();
      if (selBox) selBox.remove();
      if (w < 10 || h < 10) return; // too small
      // Request capture from background
      try {
        chrome.runtime.sendMessage({ action: 'captureRegion', region: { x, y, w, h } });
      } catch {}
    });

    const escHandler = (e) => {
      if (e.key === 'Escape') {
        overlay.remove();
        if (selBox) selBox.remove();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  // ── Full page capture (scroll-stitch) ──────────────────
  async function _captureFullPage() {
    const scrollH = document.documentElement.scrollHeight;
    const viewH = window.innerHeight;
    const viewW = window.innerWidth;
    const origScrollY = window.scrollY;

    // Stitch canvas
    const stitchCanvas = document.createElement('canvas');
    stitchCanvas.width = viewW * (window.devicePixelRatio || 1);
    stitchCanvas.height = scrollH * (window.devicePixelRatio || 1);
    const sctx = stitchCanvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;

    let y = 0;
    while (y < scrollH) {
      window.scrollTo(0, y);
      await new Promise(r => setTimeout(r, 150)); // wait for render
      try {
        const response = await chrome.runtime.sendMessage({ action: 'captureTab' });
        if (response?.dataUrl) {
          const img = await new Promise((resolve) => {
            const i = new Image(); i.onload = () => resolve(i); i.onerror = () => resolve(null); i.src = response.dataUrl;
          });
          if (img) {
            const captureH = Math.min(viewH, scrollH - y);
            sctx.drawImage(img, 0, 0, img.naturalWidth, captureH * dpr, 0, y * dpr, img.naturalWidth, captureH * dpr);
          }
        }
      } catch {}
      y += viewH;
    }

    // Restore scroll
    window.scrollTo(0, origScrollY);

    // Send stitched result
    const dataUrl = stitchCanvas.toDataURL('image/png');
    try {
      chrome.runtime.sendMessage({ action: 'fullPageCaptured', dataUrl });
    } catch {}
  }

  // --- Collect All Images on Page ---
  function collectPageImages() {
    const images = [];
    const seen = new Set();

    // <img> elements
    document.querySelectorAll('img').forEach(img => {
      const src = img.currentSrc || img.src;
      if (!src || seen.has(src)) return;
      seen.add(src);
      images.push({
        src,
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        alt: img.alt || '',
        title: img.title || '',
        type: guessTypeFromUrl(src),
        filename: extractFilename(src),
      });
    });

    // CSS background images
    document.querySelectorAll('*').forEach(el => {
      const bg = getComputedStyle(el).backgroundImage;
      if (bg && bg !== 'none') {
        const match = bg.match(/url\(["']?(.+?)["']?\)/);
        if (match && match[1] && !seen.has(match[1])) {
          const src = match[1];
          seen.add(src);
          images.push({
            src,
            type: guessTypeFromUrl(src),
            filename: extractFilename(src),
            isBgImage: true,
          });
        }
      }
    });

    // <picture> / <source> elements
    document.querySelectorAll('source[srcset]').forEach(source => {
      const srcset = source.srcset;
      srcset.split(',').forEach(entry => {
        const src = entry.trim().split(/\s+/)[0];
        if (src && !seen.has(src)) {
          seen.add(src);
          images.push({
            src,
            type: guessTypeFromUrl(src),
            filename: extractFilename(src),
          });
        }
      });
    });

    // Favicons: <link rel="icon">, <link rel="shortcut icon">, <link rel="apple-touch-icon">
    document.querySelectorAll('link[rel*="icon"]').forEach(link => {
      const src = link.href;
      if (!src || seen.has(src)) return;
      seen.add(src);

      // Parse sizes attribute if available (e.g., "32x32", "192x192")
      const sizes = link.getAttribute('sizes');
      let w = 0, h = 0;
      if (sizes && sizes !== 'any') {
        const parts = sizes.split('x');
        if (parts.length === 2) { w = parseInt(parts[0]); h = parseInt(parts[1]); }
      }

      images.push({
        src,
        width: w,
        height: h,
        naturalWidth: w,
        naturalHeight: h,
        type: guessTypeFromUrl(src) || 'ICO',
        filename: extractFilename(src),
        isFavicon: true,
        alt: link.getAttribute('rel') || 'favicon',
      });
    });

    return images;
  }

  // --- Show Info Overlay ---
  function showImageInfoOverlay(src) {
    removeOverlay();

    const overlay = document.createElement('div');
    overlay.id = 'snaproo-overlay';
    overlay.style.cssText = `
      position: fixed; top: 12px; right: 12px; z-index: 2147483647;
      width: 320px; max-height: 80vh; overflow-y: auto;
      background: #0f172a; color: #e2e8f0; font-family: Inter, system-ui, sans-serif;
      border: 1px solid #334155; border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      font-size: 13px; line-height: 1.5;
    `;

    overlay.innerHTML = `
      <div style="padding:12px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-weight:700;color:#F4C430;">Snaproo</span>
        <button id="snaproo-close" style="background:none;border:none;color:#64748b;cursor:pointer;font-size:18px;">&times;</button>
      </div>
      <div style="padding:8px 12px;">
        <div style="background:#1e293b;border-radius:8px;padding:8px;margin-bottom:8px;text-align:center;max-height:150px;overflow:hidden;">
          <img src="${escapeAttr(src)}" style="max-width:100%;max-height:140px;object-fit:contain;border-radius:4px;" alt="Preview">
        </div>
        <div id="snaproo-info-rows" style="font-size:12px;">
          <div style="color:#64748b;text-align:center;padding:8px;">Loading image info...</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    overlay.querySelector('#snaproo-close').addEventListener('click', removeOverlay);

    // Delegated click-to-copy
    overlay.addEventListener('click', (e) => {
      if (e.target.classList?.contains('snaproo-copyable')) {
        navigator.clipboard.writeText(e.target.textContent);
      }
    });

    // Load actual info
    loadImageInfo(src);
  }

  async function loadImageInfo(src) {
    const rows = document.getElementById('snaproo-info-rows');
    if (!rows) return;

    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });

      let fileSize = 'Unknown';
      try {
        const resp = await fetch(src, { method: 'HEAD' });
        const cl = resp.headers.get('content-length');
        if (cl) fileSize = formatBytes(parseInt(cl));
      } catch {}

      const info = [
        ['Filename', extractFilename(src)],
        ['Type', guessTypeFromUrl(src)],
        ['Dimensions', `${img.naturalWidth} x ${img.naturalHeight} px`],
        ['File Size', fileSize],
        ['URL', src],
      ];

      // Find matching <img> on page for alt/title
      const pageImg = document.querySelector(`img[src="${CSS.escape(src)}"]`) ||
                       document.querySelector(`img[currentSrc="${CSS.escape(src)}"]`);
      if (pageImg) {
        if (pageImg.alt) info.push(['Alt Text', pageImg.alt]);
        if (pageImg.title) info.push(['Title', pageImg.title]);
        if (pageImg.width !== img.naturalWidth || pageImg.height !== img.naturalHeight) {
          info.push(['Displayed', `${pageImg.width} x ${pageImg.height} px`]);
          const scale = ((pageImg.width / img.naturalWidth) * 100).toFixed(0);
          info.push(['Scale', `${scale}%`]);
        }
      }

      rows.innerHTML = info.map(([label, value]) => `
        <div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #1e293b;">
          <span style="color:#64748b;">${label}</span>
          <span class="snaproo-copyable" style="color:#cbd5e1;max-width:180px;text-align:right;word-break:break-all;cursor:pointer;" title="Click to copy">${escapeHtml(truncate(String(value), 50))}</span>
        </div>
      `).join('');
    } catch (e) {
      rows.innerHTML = `<div style="color:#ef4444;padding:8px;">Failed to load image info</div>`;
    }
  }

  // --- Copy Image as PNG ---
  async function copyImageAsPng(src) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      showToast('Copied as PNG');
    } catch (e) {
      showToast('Failed to copy image', true);
    }
  }

  // --- Convert and Save ---
  async function convertAndSave(src, format) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = src;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext('2d').drawImage(img, 0, 0);

      const mimeMap = {
        png: 'image/png',
        jpeg: 'image/jpeg',
        webp: 'image/webp',
        bmp: 'image/bmp',
      };
      const mime = mimeMap[format] || 'image/png';
      const quality = ['jpeg', 'webp'].includes(format) ? 0.85 : undefined;

      const blob = await new Promise(resolve => canvas.toBlob(resolve, mime, quality));
      const url = URL.createObjectURL(blob);
      const filename = `${extractFilename(src).replace(/\.[^.]+$/, '')}.${format}`;

      chrome.runtime.sendMessage({
        action: 'download',
        url,
        filename: `snaproo/${filename}`,
        saveAs: true
      });

      showToast(`Saved as ${format.toUpperCase()}`);
    } catch (e) {
      showToast('Conversion failed', true);
      if (['avif', 'ico'].includes(format)) {
        showToast('AVIF/ICO conversion not supported in this format', true);
      }
    }
  }

  // --- Read QR (sends image data to background for jsQR processing) ---
  async function readQRFromImage(src) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((resolve, reject) => { img.onload = resolve; img.onerror = reject; img.src = src; });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Send pixel data to background service worker for QR reading
      const result = await chrome.runtime.sendMessage({
        action: 'readQR',
        data: Array.from(imageData.data),
        width: canvas.width,
        height: canvas.height
      });

      if (result?.text) {
        showToast('QR: ' + result.text);
        navigator.clipboard.writeText(result.text).catch(() => {});
      } else {
        showToast('No QR code found in this image');
      }
    } catch (e) {
      showToast('Could not read QR from this image', true);
    }
  }

  // --- Extract Colors (placeholder) ---
  function extractColorsFromImage(src) {
    // TODO: Implement k-means color extraction
    showToast('Color extraction coming soon');
  }

  // --- Extract CSS Colors from Page ---
  function extractCSSColors() {
    const colorMap = new Map(); // hex -> count
    const props = ['color', 'backgroundColor', 'borderColor', 'outlineColor'];

    function rgbStringToHex(str) {
      if (!str || str === 'transparent') return null;
      const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/);
      if (!m) return null;
      const a = m[4] !== undefined ? parseFloat(m[4]) : 1;
      if (a === 0) return null;
      const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
      return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    }

    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
      try {
        const cs = getComputedStyle(el);
        for (const prop of props) {
          const hex = rgbStringToHex(cs[prop]);
          if (hex) {
            colorMap.set(hex, (colorMap.get(hex) || 0) + 1);
          }
        }
      } catch {}
    });

    // Sort by frequency descending, limit to 50
    const sorted = [...colorMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([hex, count]) => ({ hex, count }));

    return sorted;
  }

  // --- Accessibility Audit (placeholder) ---
  function runAccessibilityAudit() {
    const imgs = document.querySelectorAll('img');
    let missing = 0;
    let total = imgs.length;

    imgs.forEach(img => {
      if (!img.alt && !img.getAttribute('role')?.includes('presentation')) {
        missing++;
        img.style.outline = '3px solid #ef4444';
        img.style.outlineOffset = '2px';
      }
    });

    showToast(`Audit: ${total} images, ${missing} missing alt text`);
  }

  // --- Toast Notification ---
  function showToast(msg, isError = false) {
    const existing = document.getElementById('snaproo-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'snaproo-toast';
    toast.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; padding: 10px 20px; border-radius: 8px;
      font-family: Inter, system-ui, sans-serif; font-size: 13px; font-weight: 500;
      background: ${isError ? '#7f1d1d' : '#0f172a'}; color: ${isError ? '#fca5a5' : '#F4C430'};
      border: 1px solid ${isError ? '#991b1b' : '#334155'};
      box-shadow: 0 10px 30px rgba(0,0,0,0.4);
      transition: opacity 0.3s;
    `;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; }, 2500);
    setTimeout(() => toast.remove(), 3000);
  }

  // --- Helpers ---
  function removeOverlay() {
    document.getElementById('snaproo-overlay')?.remove();
  }

  function guessTypeFromUrl(url) {
    try {
      const ext = new URL(url, location.href).pathname.split('.').pop()?.toLowerCase();
      const map = {
        jpg: 'JPEG', jpeg: 'JPEG', png: 'PNG', gif: 'GIF',
        webp: 'WebP', avif: 'AVIF', svg: 'SVG', bmp: 'BMP',
        ico: 'ICO', tiff: 'TIFF', tif: 'TIFF',
      };
      return map[ext] || ext?.toUpperCase() || 'Unknown';
    } catch {
      return 'Unknown';
    }
  }

  function extractFilename(url) {
    try {
      return new URL(url, location.href).pathname.split('/').pop() || 'image';
    } catch {
      return 'image';
    }
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function truncate(str, max) {
    return str.length > max ? str.substring(0, max) + '...' : str;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
  }

  // --- Eyedropper Overlay with Magnifier ---
  function startEyedropperOverlay(screenshotDataUrl, sendResponse) {
    // Remove any existing overlay
    document.getElementById('snaproo-eyedropper')?.remove();

    if (!screenshotDataUrl) {
      sendResponse({ color: null });
      return;
    }

    const img = new Image();
    img.onerror = () => {
      sendResponse({ color: null });
    };
    img.onload = () => {
      // Full-screen canvas overlay
      const overlay = document.createElement('div');
      overlay.id = 'snaproo-eyedropper';
      overlay.style.cssText = `
        position: fixed; inset: 0; z-index: 2147483647; cursor: none;
        overflow: hidden; width: 100vw; height: 100vh;
      `;

      // Hide page scrollbars while overlay is active
      const prevOverflow = document.documentElement.style.overflow;
      document.documentElement.style.overflow = 'hidden';

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.style.cssText = 'position:absolute;top:0;left:0;width:100vw;height:100vh;';
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);

      // Crosshair at cursor position (this is the actual pick point)
      const crosshair = document.createElement('div');
      crosshair.style.cssText = `
        position: fixed; pointer-events: none; display: none;
        width: 20px; height: 20px; margin-left: -10px; margin-top: -10px;
        border: 2px solid #ffffff; border-radius: 50%;
        box-shadow: 0 0 0 1px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(0,0,0,0.3);
      `;
      // Center dot
      const centerDot = document.createElement('div');
      centerDot.style.cssText = `
        position: absolute; top: 50%; left: 50%; width: 4px; height: 4px;
        margin: -2px 0 0 -2px; background: #ffffff; border-radius: 50%;
        box-shadow: 0 0 2px rgba(0,0,0,0.8);
      `;
      crosshair.appendChild(centerDot);

      // Magnifier (floating preview, offset from cursor)
      const mag = document.createElement('div');
      const magSize = 100;
      const magZoom = 8;
      mag.style.cssText = `
        position: fixed; pointer-events: none; display: none;
        width: ${magSize}px; height: ${magSize}px;
        border-radius: 50%; border: 2px solid #F4C430;
        box-shadow: 0 4px 16px rgba(0,0,0,0.5);
        overflow: hidden;
      `;
      const magCanvas = document.createElement('canvas');
      magCanvas.width = magSize; magCanvas.height = magSize;
      magCanvas.style.cssText = 'width:100%;height:100%;';
      mag.appendChild(magCanvas);

      // Color label (shows hex below magnifier)
      const label = document.createElement('div');
      label.style.cssText = `
        position: fixed; pointer-events: none; display: none;
        background: #0f172a; color: #F4C430; font-family: monospace;
        font-size: 11px; font-weight: 600; padding: 3px 8px;
        border-radius: 4px; border: 1px solid #334155;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        white-space: nowrap;
      `;

      // Hint text
      const hint = document.createElement('div');
      hint.style.cssText = `
        position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
        background: #0f172a; color: #e2e8f0; font-family: Inter, system-ui, sans-serif;
        font-size: 12px; padding: 6px 14px; border-radius: 6px;
        border: 1px solid #334155; box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        z-index: 1;
      `;
      hint.textContent = 'Click to pick · Esc to cancel';

      overlay.appendChild(canvas);
      overlay.appendChild(crosshair);
      overlay.appendChild(mag);
      overlay.appendChild(label);
      overlay.appendChild(hint);
      document.body.appendChild(overlay);

      function getCanvasCoords(clientX, clientY) {
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        return {
          px: Math.floor((clientX - rect.left) * sx),
          py: Math.floor((clientY - rect.top) * sy),
          sx, sy
        };
      }

      function getPixelAt(clientX, clientY) {
        const { px, py } = getCanvasCoords(clientX, clientY);
        const cx = Math.max(0, Math.min(px, canvas.width - 1));
        const cy = Math.max(0, Math.min(py, canvas.height - 1));
        const data = ctx.getImageData(cx, cy, 1, 1).data;
        return { r: data[0], g: data[1], b: data[2] };
      }

      function drawMagnifier(clientX, clientY) {
        const mc = magCanvas.getContext('2d');
        const { px, py, sx } = getCanvasCoords(clientX, clientY);
        const srcSize = magSize / magZoom;

        mc.imageSmoothingEnabled = false;
        mc.clearRect(0, 0, magSize, magSize);
        mc.drawImage(canvas, px - srcSize / 2, py - srcSize / 2, srcSize, srcSize, 0, 0, magSize, magSize);

        // Crosshair in center
        const cellSize = Math.max(magZoom, Math.round(sx * magZoom));
        mc.strokeStyle = 'rgba(255,255,255,0.6)';
        mc.lineWidth = 1;
        mc.strokeRect(magSize / 2 - cellSize / 2, magSize / 2 - cellSize / 2, cellSize, cellSize);
      }

      overlay.addEventListener('mousemove', (e) => {
        crosshair.style.display = 'block';
        mag.style.display = 'block';
        label.style.display = 'block';

        // Crosshair: exactly at cursor
        crosshair.style.left = e.clientX + 'px';
        crosshair.style.top = e.clientY + 'px';

        // Magnifier: offset to top-right of cursor
        let magX = e.clientX + 24;
        let magY = e.clientY - magSize - 8;

        // Keep in viewport
        if (magY < 4) magY = e.clientY + 24;
        if (magX + magSize > window.innerWidth - 4) magX = e.clientX - magSize - 24;

        mag.style.left = magX + 'px';
        mag.style.top = magY + 'px';

        // Label: below magnifier
        label.style.left = magX + 'px';
        label.style.top = (magY + magSize + 4) + 'px';

        drawMagnifier(e.clientX, e.clientY);

        const { r, g, b } = getPixelAt(e.clientX, e.clientY);
        const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        label.textContent = hex;
        mag.style.borderColor = hex;
        crosshair.style.borderColor = hex;
        centerDot.style.background = hex;
      });

      function cleanup() {
        document.removeEventListener('keydown', onKey, true);
        overlay.removeEventListener('keydown', onKey);
        overlay.remove();
        document.documentElement.style.overflow = prevOverflow;
      }

      overlay.addEventListener('click', (e) => {
        const { r, g, b } = getPixelAt(e.clientX, e.clientY);
        const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        cleanup();
        sendResponse({ color: { r, g, b, hex } });
      });

      // Make overlay focusable so it receives keyboard events
      overlay.tabIndex = 0;
      overlay.focus();

      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          cleanup();
          sendResponse({ color: null });
        }
      };
      document.addEventListener('keydown', onKey, true);
      overlay.addEventListener('keydown', onKey);
    };
    img.src = screenshotDataUrl;
  }
})();
