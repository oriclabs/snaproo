// Snaproo Editor - Extended Tools
// Interactive crop, annotations, watermark, batch resize, compression optimizer,
// base64, frame extraction, image hash, DPI, QR reader

// ============================================================
// Interactive Crop
// ============================================================

const Crop = {
  active: false,
  startX: 0, startY: 0,
  x: 0, y: 0, w: 0, h: 0,
  handle: null,
  ratio: null,
  _container: null,

  init(canvas, ctx, onApply) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.onApply = onApply;
    // Create a fixed-position container with a canvas inside
    this._container = document.createElement('div');
    this._container.style.cssText = 'position:fixed;z-index:1000;pointer-events:auto;display:none;';
    this.overlay = document.createElement('canvas');
    this.overlay.style.cssText = 'display:block;cursor:crosshair;';
    this._container.appendChild(this.overlay);
    this.oCtx = this.overlay.getContext('2d');
    // Crop toolbar (Apply / Cancel buttons)
    this._toolbar = document.createElement('div');
    this._toolbar.style.cssText = 'position:absolute;bottom:12px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:6px;z-index:2;';
    // Extra row for mask filter pills (hidden by default)
    this._extraRow = document.createElement('div');
    this._extraRow.style.cssText = 'display:none;gap:4px;flex-wrap:wrap;justify-content:center;background:rgba(15,23,42,0.92);border:1px solid #334155;border-radius:8px;padding:5px 8px;';
    this._toolbar.appendChild(this._extraRow);
    // Main button row
    this._btnRow = document.createElement('div');
    this._btnRow.style.cssText = 'display:flex;gap:8px;';
    this._btnApply = document.createElement('button');
    this._btnApply.textContent = 'Apply Crop';
    this._btnApply.style.cssText = 'background:#F4C430;color:#1e293b;border:none;border-radius:6px;padding:6px 16px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    this._btnCancel = document.createElement('button');
    this._btnCancel.textContent = 'Cancel';
    this._btnCancel.style.cssText = 'background:var(--slate-800,#1e293b);color:var(--slate-300,#cbd5e1);border:1px solid var(--slate-700,#334155);border-radius:6px;padding:6px 16px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
    this._btnRow.appendChild(this._btnApply);
    this._btnRow.appendChild(this._btnCancel);
    this._toolbar.appendChild(this._btnRow);
    this._container.appendChild(this._toolbar);
    document.body.appendChild(this._container);
  },

  _syncPosition() {
    const rect = this.canvas.getBoundingClientRect();
    const w = this.canvas.clientWidth || this.canvas.width;
    const h = this.canvas.clientHeight || this.canvas.height;
    this._container.style.top = Math.floor(rect.top) + 'px';
    this._container.style.left = Math.floor(rect.left) + 'px';
    this._container.style.width = w + 'px';
    this._container.style.height = h + 'px';
    this.overlay.width = this.canvas.width;
    this.overlay.height = this.canvas.height;
    this.overlay.style.width = w + 'px';
    this.overlay.style.height = h + 'px';
  },

  start(parentEl, ratio) {
    this.active = true;
    this.ratio = ratio;
    this.x = Math.floor(this.canvas.width * 0.1);
    this.y = Math.floor(this.canvas.height * 0.1);
    this.w = Math.floor(this.canvas.width * 0.8);
    this.h = ratio ? Math.floor(this.w / ratio) : Math.floor(this.canvas.height * 0.8);
    this.h = Math.min(this.h, Math.floor(this.canvas.height * 0.8));

    this._syncPosition();
    this._container.style.display = 'block';
    this.draw();

    this._onDown = (e) => this.onMouseDown(e);
    this._onMove = (e) => this.onMouseMove(e);
    this._onUp = () => this.onMouseUp();
    this._onResize = () => { if (this.active) this.draw(); };
    this._onApplyClick = () => this.apply();
    this._onCancelClick = () => {
      this.cancel();
      if (this._onCropEnd) this._onCropEnd();
    };
    this.overlay.addEventListener('mousedown', this._onDown);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
    window.addEventListener('resize', this._onResize);
    this._btnApply.addEventListener('click', this._onApplyClick);
    this._btnCancel.addEventListener('click', this._onCancelClick);
  },

  // Show extra content in the overlay toolbar (used by mask filter)
  setExtraContent(buildFn) {
    this._extraRow.innerHTML = '';
    if (!buildFn) { this._extraRow.style.display = 'none'; return; }
    this._extraRow.style.display = 'flex';
    buildFn(this._extraRow);
  },

  cancel() {
    this.active = false;
    this._container.style.display = 'none';
    this._extraRow.style.display = 'none';
    this._extraRow.innerHTML = '';
    this._btnApply.textContent = 'Apply Crop';
    this._maskPreview = null;
    this.overlay.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
    window.removeEventListener('resize', this._onResize);
    this._btnApply.removeEventListener('click', this._onApplyClick);
    this._btnCancel.removeEventListener('click', this._onCancelClick);
  },

  apply() {
    const { x, y, w, h } = this;
    this.cancel();
    if (w > 1 && h > 1) this.onApply(x, y, w, h);
    if (this._onCropEnd) this._onCropEnd();
  },

  toCanvasCoords(e) {
    const rect = this.overlay.getBoundingClientRect();
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    return { cx: (e.clientX - rect.left) * sx, cy: (e.clientY - rect.top) * sy };
  },

  getHandle(cx, cy) {
    const { x, y, w, h } = this;
    const hs = Math.max(8, Math.min(20, w * 0.05)); // handle size
    const corners = [
      { name: 'tl', hx: x, hy: y },
      { name: 'tr', hx: x + w, hy: y },
      { name: 'bl', hx: x, hy: y + h },
      { name: 'br', hx: x + w, hy: y + h },
      { name: 'tm', hx: x + w / 2, hy: y },
      { name: 'bm', hx: x + w / 2, hy: y + h },
      { name: 'ml', hx: x, hy: y + h / 2 },
      { name: 'mr', hx: x + w, hy: y + h / 2 },
    ];
    for (const c of corners) {
      if (Math.abs(cx - c.hx) < hs && Math.abs(cy - c.hy) < hs) return c.name;
    }
    if (cx > x + hs && cx < x + w - hs && cy > y + hs && cy < y + h - hs) return 'move';
    return null;
  },

  onMouseDown(e) {
    const { cx, cy } = this.toCanvasCoords(e);
    this.handle = this.getHandle(cx, cy);
    if (!this.handle) {
      // Start new selection
      this.startX = cx; this.startY = cy;
      this.handle = 'new';
    }
    this.dragStartX = cx; this.dragStartY = cy;
    this.origX = this.x; this.origY = this.y;
    this.origW = this.w; this.origH = this.h;
  },

  onMouseMove(e) {
    if (!this.active) return;
    const { cx, cy } = this.toCanvasCoords(e);

    if (!this.handle) {
      // Update cursor
      const h = this.getHandle(cx, cy);
      const cursors = { tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize', tm: 'ns-resize', bm: 'ns-resize', ml: 'ew-resize', mr: 'ew-resize', move: 'move' };
      this.overlay.style.cursor = cursors[h] || 'crosshair';
      return;
    }

    const dx = cx - this.dragStartX;
    const dy = cy - this.dragStartY;
    const cw = this.canvas.width, ch = this.canvas.height;

    if (this.handle === 'new') {
      this.x = Math.min(this.startX, cx);
      this.y = Math.min(this.startY, cy);
      this.w = Math.abs(cx - this.startX);
      this.h = this.ratio ? this.w / this.ratio : Math.abs(cy - this.startY);
    } else if (this.handle === 'move') {
      this.x = Math.max(0, Math.min(cw - this.origW, this.origX + dx));
      this.y = Math.max(0, Math.min(ch - this.origH, this.origY + dy));
    } else if (this.handle === 'br') {
      this.w = Math.max(10, this.origW + dx);
      this.h = this.ratio ? this.w / this.ratio : Math.max(10, this.origH + dy);
    } else if (this.handle === 'tl') {
      this.w = Math.max(10, this.origW - dx);
      this.h = this.ratio ? this.w / this.ratio : Math.max(10, this.origH - dy);
      this.x = this.origX + this.origW - this.w;
      this.y = this.origY + this.origH - this.h;
    } else if (this.handle === 'tr') {
      this.w = Math.max(10, this.origW + dx);
      this.h = this.ratio ? this.w / this.ratio : Math.max(10, this.origH - dy);
      this.y = this.origY + this.origH - this.h;
    } else if (this.handle === 'bl') {
      this.w = Math.max(10, this.origW - dx);
      this.h = this.ratio ? this.w / this.ratio : Math.max(10, this.origH + dy);
      this.x = this.origX + this.origW - this.w;
    } else if (this.handle === 'tm') {
      this.h = Math.max(10, this.origH - dy);
      this.y = this.origY + this.origH - this.h;
    } else if (this.handle === 'bm') {
      this.h = Math.max(10, this.origH + dy);
    } else if (this.handle === 'ml') {
      this.w = Math.max(10, this.origW - dx);
      this.x = this.origX + this.origW - this.w;
    } else if (this.handle === 'mr') {
      this.w = Math.max(10, this.origW + dx);
    }

    // Clamp
    this.x = Math.max(0, this.x);
    this.y = Math.max(0, this.y);
    this.w = Math.min(this.w, cw - this.x);
    this.h = Math.min(this.h, ch - this.y);

    this.draw();
  },

  onMouseUp() {
    if (this.handle === 'new' && this.w < 5 && this.h < 5) {
      // Too small, ignore
    }
    this.handle = null;
  },

  draw() {
    this._syncPosition();
    const c = this.oCtx;
    const cw = this.overlay.width, ch = this.overlay.height;
    c.clearRect(0, 0, cw, ch);

    // Dim outside crop area (4 rectangles, +1px overlap to prevent gaps)
    const cx = Math.floor(this.x), cy = Math.floor(this.y);
    const cfw = Math.ceil(this.w), cfh = Math.ceil(this.h);
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.fillRect(0, 0, cw, cy); // top
    c.fillRect(0, cy, cx, cfh); // left
    c.fillRect(cx + cfw, cy, cw - cx - cfw, cfh); // right
    c.fillRect(0, cy + cfh, cw, ch - cy - cfh); // bottom

    // Border
    c.strokeStyle = '#F4C430';
    c.lineWidth = 2;
    c.strokeRect(this.x, this.y, this.w, this.h);

    // Rule of thirds
    c.strokeStyle = 'rgba(255,255,255,0.2)';
    c.lineWidth = 1;
    for (let i = 1; i <= 2; i++) {
      c.beginPath();
      c.moveTo(this.x + this.w * i / 3, this.y);
      c.lineTo(this.x + this.w * i / 3, this.y + this.h);
      c.stroke();
      c.beginPath();
      c.moveTo(this.x, this.y + this.h * i / 3);
      c.lineTo(this.x + this.w, this.y + this.h * i / 3);
      c.stroke();
    }

    // Handles (corners + edges)
    const hs = 8;
    c.fillStyle = '#F4C430';
    const handles = [
      [this.x, this.y], [this.x + this.w, this.y],
      [this.x, this.y + this.h], [this.x + this.w, this.y + this.h],
      [this.x + this.w / 2, this.y], [this.x + this.w / 2, this.y + this.h],
      [this.x, this.y + this.h / 2], [this.x + this.w, this.y + this.h / 2],
    ];
    handles.forEach(([hx, hy]) => {
      c.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    });

    // Dimensions label
    c.fillStyle = '#F4C430';
    c.font = '12px monospace';
    c.textAlign = 'center';
    c.fillText(`${Math.round(this.w)} x ${Math.round(this.h)}`, this.x + this.w / 2, this.y - 8);

    // Mask preview callback — renders filtered region onto overlay
    if (this._maskPreview) this._maskPreview(c, this.x, this.y, this.w, this.h);
  }
};

// ============================================================
// Annotation Tools
// ============================================================

const Annotate = {
  tool: null, // 'rect', 'arrow', 'text', 'redact'
  drawing: false,
  startX: 0, startY: 0,
  color: '#ef4444',
  lineWidth: 3,
  fontSize: 24,
  textValue: '',

  init(canvas, ctx, saveStateFn) {
    this.canvas = canvas;
    this.ctx = ctx;
    this.saveState = saveStateFn;

    this.overlay = document.createElement('canvas');
    this.overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this.oCtx = this.overlay.getContext('2d');
  },

  setTool(tool, parentEl) {
    if (this.tool === tool) {
      this.deactivate();
      return;
    }
    this.deactivate();
    this.tool = tool;
    this.overlay.width = this.canvas.width;
    this.overlay.height = this.canvas.height;

    // Position overlay exactly over the canvas element
    const canvasRect = this.canvas.getBoundingClientRect();
    const parentRect = parentEl.getBoundingClientRect();
    this.overlay.style.cssText = `position:absolute;cursor:${tool === 'text' ? 'text' : 'crosshair'};` +
      `left:${canvasRect.left - parentRect.left}px;top:${canvasRect.top - parentRect.top}px;` +
      `width:${canvasRect.width}px;height:${canvasRect.height}px;`;

    parentEl.style.position = 'relative';
    parentEl.appendChild(this.overlay);

    this._onDown = (e) => this.onDown(e);
    this._onMove = (e) => this.onMove(e);
    this._onUp = (e) => this.onUp(e);
    this.overlay.addEventListener('mousedown', this._onDown);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
  },

  deactivate() {
    this.tool = null;
    this.drawing = false;
    this.overlay.remove();
    this.overlay.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
  },

  toCoords(e) {
    const rect = this.overlay.getBoundingClientRect();
    return {
      cx: (e.clientX - rect.left) * this.canvas.width / rect.width,
      cy: (e.clientY - rect.top) * this.canvas.height / rect.height
    };
  },

  onDown(e) {
    const { cx, cy } = this.toCoords(e);
    this.startX = cx; this.startY = cy;
    this.drawing = true;

    if (this.tool === 'text') {
      this.drawing = false;
      pixDialog.prompt('Text Overlay', 'Enter text to add:').then(text => {
        if (text) {
          this.ctx.fillStyle = this.color;
          this.ctx.font = `bold ${this.fontSize}px Inter, sans-serif`;
          this.ctx.fillText(text, cx, cy);
          this.saveState();
        }
      });
    }
  },

  onMove(e) {
    if (!this.drawing) return;
    const { cx, cy } = this.toCoords(e);
    const oc = this.oCtx;
    oc.clearRect(0, 0, this.overlay.width, this.overlay.height);

    if (this.tool === 'rect') {
      oc.strokeStyle = this.color;
      oc.lineWidth = this.lineWidth;
      oc.strokeRect(this.startX, this.startY, cx - this.startX, cy - this.startY);
    } else if (this.tool === 'arrow') {
      this.drawArrow(oc, this.startX, this.startY, cx, cy);
    } else if (this.tool === 'redact') {
      oc.fillStyle = 'rgba(255,0,0,0.3)';
      oc.fillRect(this.startX, this.startY, cx - this.startX, cy - this.startY);
    }
  },

  onUp(e) {
    if (!this.drawing) return;
    this.drawing = false;
    const { cx, cy } = this.toCoords(e);
    const c = this.ctx;
    this.oCtx.clearRect(0, 0, this.overlay.width, this.overlay.height);

    const x1 = this.startX, y1 = this.startY;

    if (this.tool === 'rect') {
      c.strokeStyle = this.color;
      c.lineWidth = this.lineWidth;
      c.strokeRect(x1, y1, cx - x1, cy - y1);
    } else if (this.tool === 'arrow') {
      this.drawArrow(c, x1, y1, cx, cy);
    } else if (this.tool === 'redact') {
      // Pixelate region
      const rx = Math.min(x1, cx), ry = Math.min(y1, cy);
      const rw = Math.abs(cx - x1), rh = Math.abs(cy - y1);
      if (rw > 2 && rh > 2) {
        const blockSize = Math.max(4, Math.floor(Math.min(rw, rh) / 10));
        const imgData = c.getImageData(rx, ry, rw, rh);
        for (let by = 0; by < rh; by += blockSize) {
          for (let bx = 0; bx < rw; bx += blockSize) {
            // Average the block
            let rr = 0, gg = 0, bb = 0, count = 0;
            for (let py = by; py < Math.min(by + blockSize, rh); py++) {
              for (let px = bx; px < Math.min(bx + blockSize, rw); px++) {
                const i = (py * rw + px) * 4;
                rr += imgData.data[i]; gg += imgData.data[i + 1]; bb += imgData.data[i + 2]; count++;
              }
            }
            rr = Math.round(rr / count); gg = Math.round(gg / count); bb = Math.round(bb / count);
            for (let py = by; py < Math.min(by + blockSize, rh); py++) {
              for (let px = bx; px < Math.min(bx + blockSize, rw); px++) {
                const i = (py * rw + px) * 4;
                imgData.data[i] = rr; imgData.data[i + 1] = gg; imgData.data[i + 2] = bb;
              }
            }
          }
        }
        c.putImageData(imgData, rx, ry);
      }
    }
    this.saveState();
  },

  drawArrow(c, x1, y1, x2, y2) {
    const headLen = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    c.strokeStyle = this.color;
    c.fillStyle = this.color;
    c.lineWidth = this.lineWidth;
    c.beginPath();
    c.moveTo(x1, y1);
    c.lineTo(x2, y2);
    c.stroke();
    c.beginPath();
    c.moveTo(x2, y2);
    c.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    c.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    c.closePath();
    c.fill();
  }
};

// ============================================================
// Watermark
// ============================================================

function applyWatermark(canvas, ctx, text, options = {}) {
  const { opacity = 0.3, fontSize = 48, color = '#ffffff', angle = -30, spacing = 200 } = options;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.rotate(angle * Math.PI / 180);

  const diagonal = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
  for (let y = -diagonal; y < diagonal * 2; y += spacing) {
    for (let x = -diagonal; x < diagonal * 2; x += ctx.measureText(text).width + spacing) {
      ctx.fillText(text, x, y);
    }
  }
  ctx.restore();
}

// ============================================================
// Compression Optimizer
// ============================================================

async function getCompressionSizes(canvas, formats) {
  const results = [];
  for (const { format, mime, qualities } of formats) {
    for (const q of qualities) {
      const blob = await new Promise(r => canvas.toBlob(r, mime, q / 100));
      results.push({ format, quality: q, size: blob.size, sizeStr: formatBytesShort(blob.size) });
    }
  }
  return results;
}

function formatBytesShort(b) {
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b / 1024).toFixed(0) + 'KB';
  return (b / 1048576).toFixed(1) + 'MB';
}

// ============================================================
// Base64 Encode / Decode
// ============================================================

function imageToBase64(canvas, format = 'image/png', quality = 0.92) {
  return canvas.toDataURL(format, quality);
}

function base64ToImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

// ============================================================
// GIF/APNG Frame Extraction (basic GIF parser)
// ============================================================

function extractGifFrames(buffer) {
  const bytes = new Uint8Array(buffer);
  const frames = [];

  // Check GIF header
  const header = String.fromCharCode(...bytes.slice(0, 6));
  if (!header.startsWith('GIF')) return frames;

  // Read logical screen descriptor
  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packed = bytes[10];
  const hasGCT = (packed >> 7) & 1;
  const gctSize = hasGCT ? 3 * (1 << ((packed & 7) + 1)) : 0;

  let offset = 13 + gctSize;
  let frameIndex = 0;

  while (offset < bytes.length) {
    const block = bytes[offset];

    if (block === 0x3B) break; // Trailer

    if (block === 0x21) {
      // Extension
      const label = bytes[offset + 1];
      offset += 2;
      while (offset < bytes.length) {
        const size = bytes[offset]; offset++;
        if (size === 0) break;
        offset += size;
      }
    } else if (block === 0x2C) {
      // Image descriptor
      const fx = bytes[offset + 1] | (bytes[offset + 2] << 8);
      const fy = bytes[offset + 3] | (bytes[offset + 4] << 8);
      const fw = bytes[offset + 5] | (bytes[offset + 6] << 8);
      const fh = bytes[offset + 7] | (bytes[offset + 8] << 8);
      frames.push({ index: frameIndex++, x: fx, y: fy, width: fw, height: fh });

      const fpacked = bytes[offset + 9];
      const hasLCT = (fpacked >> 7) & 1;
      const lctSize = hasLCT ? 3 * (1 << ((fpacked & 7) + 1)) : 0;
      offset += 10 + lctSize;

      // Skip LZW data
      offset++; // LZW min code size
      while (offset < bytes.length) {
        const size = bytes[offset]; offset++;
        if (size === 0) break;
        offset += size;
      }
    } else {
      offset++;
    }
  }

  return frames.length > 0 ? { width, height, frameCount: frames.length, frames } : null;
}

// ============================================================
// Image Hash
// ============================================================

async function computeImageHash(canvas, algorithm = 'SHA-256') {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest(algorithm, buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function computePerceptualHash(canvas) {
  // Simple average hash (aHash): resize to 8x8, grayscale, compare to mean
  const tmp = document.createElement('canvas');
  tmp.width = 8; tmp.height = 8;
  const tc = tmp.getContext('2d', { willReadFrequently: true });
  tc.drawImage(canvas, 0, 0, 8, 8);
  const data = tc.getImageData(0, 0, 8, 8).data;

  const grays = [];
  for (let i = 0; i < data.length; i += 4) {
    grays.push(data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114);
  }

  const mean = grays.reduce((a, b) => a + b, 0) / grays.length;
  let hash = '';
  for (const g of grays) hash += g >= mean ? '1' : '0';

  // Convert binary to hex
  let hex = '';
  for (let i = 0; i < hash.length; i += 4) {
    hex += parseInt(hash.substr(i, 4), 2).toString(16);
  }
  return hex;
}

// ============================================================
// DPI / PPI
// ============================================================

function readDpiFromPng(bytes) {
  // Look for pHYs chunk in PNG
  if (bytes[0] !== 0x89 || bytes[1] !== 0x50) return null;
  let offset = 8;
  while (offset < bytes.length - 12) {
    const len = (bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3];
    const type = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
    if (type === 'pHYs') {
      const ppuX = (bytes[offset + 8] << 24) | (bytes[offset + 9] << 16) | (bytes[offset + 10] << 8) | bytes[offset + 11];
      const ppuY = (bytes[offset + 12] << 24) | (bytes[offset + 13] << 16) | (bytes[offset + 14] << 8) | bytes[offset + 15];
      const unit = bytes[offset + 16];
      if (unit === 1) {
        // Meters to DPI
        return { x: Math.round(ppuX / 39.3701), y: Math.round(ppuY / 39.3701) };
      }
      return { x: ppuX, y: ppuY, unit: 'unknown' };
    }
    offset += 12 + len;
  }
  return null;
}

function readDpiFromJpeg(bytes) {
  // JFIF APP0 contains DPI
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return null;
  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xFF) break;
    const marker = bytes[offset + 1];
    if (marker === 0xD9 || marker === 0xDA) break;
    const len = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (marker === 0xE0) {
      // JFIF APP0
      const id = String.fromCharCode(...bytes.slice(offset + 4, offset + 9));
      if (id === 'JFIF\0') {
        const units = bytes[offset + 11];
        const xDpi = (bytes[offset + 12] << 8) | bytes[offset + 13];
        const yDpi = (bytes[offset + 14] << 8) | bytes[offset + 15];
        if (units === 1) return { x: xDpi, y: yDpi }; // DPI
        if (units === 2) return { x: Math.round(xDpi * 2.54), y: Math.round(yDpi * 2.54) }; // dots/cm to DPI
      }
    }
    offset += 2 + len;
  }
  return null;
}

// ============================================================
// QR Reader (Canvas-based)
// ============================================================

async function readQRFromFile(file) {
  const img = await new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
  if (!img) return null;

  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return readQRFromCanvas(canvas);
}

async function readQRFromCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Send to background service worker where jsQR is loaded
  const result = await chrome.runtime.sendMessage({
    action: 'readQR',
    data: Array.from(imageData.data),
    width: canvas.width,
    height: canvas.height
  });

  return result?.text || null;
}

// ============================================================
// #30 Sprite Sheet Slicer
// ============================================================

function sliceSpriteSheet(canvas, cols, rows) {
  const tileW = Math.floor(canvas.width / cols);
  const tileH = Math.floor(canvas.height / rows);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tiles = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const tile = document.createElement('canvas');
      tile.width = tileW;
      tile.height = tileH;
      const tCtx = tile.getContext('2d');
      tCtx.drawImage(canvas, c * tileW, r * tileH, tileW, tileH, 0, 0, tileW, tileH);
      tiles.push({ canvas: tile, row: r, col: c, index: r * cols + c });
    }
  }
  return tiles;
}

// ============================================================
// #31 Image to PDF (minimal PDF generator)
// ============================================================

async function imageToPdf(canvasList, filename) {
  // Minimal valid PDF with embedded JPEG images
  const images = [];
  for (const c of canvasList) {
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.92));
    const buf = await blob.arrayBuffer();
    images.push({ data: new Uint8Array(buf), w: c.width, h: c.height });
  }

  let pdf = '%PDF-1.4\n';
  const objects = [];
  let objNum = 1;

  // Catalog
  const catalogNum = objNum++;
  objects.push(`${catalogNum} 0 obj\n<< /Type /Catalog /Pages ${catalogNum + 1} 0 R >>\nendobj\n`);

  // Pages
  const pagesNum = objNum++;
  const pageNums = [];

  for (let i = 0; i < images.length; i++) {
    const imgObj = objNum++;
    const pageObj = objNum++;
    const contentObj = objNum++;
    pageNums.push(pageObj);

    // Image XObject
    objects.push(`${imgObj} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${images[i].w} /Height ${images[i].h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${images[i].data.length} >>\nstream\n`);
    objects.push(images[i].data);
    objects.push('\nendstream\nendobj\n');

    // Page content (scale image to fit)
    const content = `q ${images[i].w} 0 0 ${images[i].h} 0 0 cm /Img${i} Do Q`;
    objects.push(`${contentObj} 0 obj\n<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);

    // Page
    objects.push(`${pageObj} 0 obj\n<< /Type /Page /Parent ${pagesNum} 0 R /MediaBox [0 0 ${images[i].w} ${images[i].h}] /Contents ${contentObj} 0 R /Resources << /XObject << /Img${i} ${imgObj} 0 R >> >> >>\nendobj\n`);
  }

  // Pages object
  objects.splice(1, 0, `${pagesNum} 0 obj\n<< /Type /Pages /Kids [${pageNums.map(n => n + ' 0 R').join(' ')}] /Count ${images.length} >>\nendobj\n`);

  // Build PDF
  const encoder = new TextEncoder();
  const parts = [encoder.encode(pdf)];
  for (const obj of objects) {
    parts.push(typeof obj === 'string' ? encoder.encode(obj) : obj);
  }
  parts.push(encoder.encode('%%EOF\n'));

  return new Blob(parts, { type: 'application/pdf' });
}

// #32 PDF to Image - REMOVED
// Requires PDF.js (400KB CDN load) which Chrome rejects as remote code.
// PDF parsing: basic canvas-to-PDF approach for now.

// ============================================================
// #33 Color Blindness Simulator
// ============================================================

function simulateColorBlindness(canvas, type) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // Color blindness simulation matrices (Brettel 1997)
  const matrices = {
    protanopia:   [[0.567, 0.433, 0], [0.558, 0.442, 0], [0, 0.242, 0.758]],
    deuteranopia: [[0.625, 0.375, 0], [0.7, 0.3, 0], [0, 0.3, 0.7]],
    tritanopia:   [[0.95, 0.05, 0], [0, 0.433, 0.567], [0, 0.475, 0.525]],
    achromatopsia:[[0.299, 0.587, 0.114], [0.299, 0.587, 0.114], [0.299, 0.587, 0.114]],
  };

  const m = matrices[type];
  if (!m) return;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    data[i]     = Math.round(m[0][0] * r + m[0][1] * g + m[0][2] * b);
    data[i + 1] = Math.round(m[1][0] * r + m[1][1] * g + m[1][2] * b);
    data[i + 2] = Math.round(m[2][0] * r + m[2][1] * g + m[2][2] * b);
  }

  ctx.putImageData(imageData, 0, 0);
}

// ============================================================
// #34 Noise Reduction (simple box blur / median filter)
// ============================================================

function denoiseImage(canvas, strength = 1) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width, h = canvas.height;
  const radius = Math.max(1, Math.min(3, strength));
  const copy = new Uint8ClampedArray(data);

  for (let y = radius; y < h - radius; y++) {
    for (let x = radius; x < w - radius; x++) {
      let rr = 0, gg = 0, bb = 0, count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const i = ((y + dy) * w + (x + dx)) * 4;
          rr += copy[i]; gg += copy[i + 1]; bb += copy[i + 2]; count++;
        }
      }
      const i = (y * w + x) * 4;
      data[i] = Math.round(rr / count);
      data[i + 1] = Math.round(gg / count);
      data[i + 2] = Math.round(bb / count);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// #35 Vignette / Border / Rounded Corners
// ============================================================

function applyVignette(canvas, strength = 0.5) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const cx = w / 2, cy = h / 2;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  const gradient = ctx.createRadialGradient(cx, cy, maxDist * (1 - strength), cx, cy, maxDist);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.7)');

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
}

function applyBorder(canvas, borderWidth, borderColor) {
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = borderWidth;
  ctx.strokeRect(borderWidth / 2, borderWidth / 2, canvas.width - borderWidth, canvas.height - borderWidth);
}

function applyRoundedCorners(canvas, radius) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // Clear canvas and clip to rounded rect
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(canvas.width - radius, 0);
  ctx.quadraticCurveTo(canvas.width, 0, canvas.width, radius);
  ctx.lineTo(canvas.width, canvas.height - radius);
  ctx.quadraticCurveTo(canvas.width, canvas.height, canvas.width - radius, canvas.height);
  ctx.lineTo(radius, canvas.height);
  ctx.quadraticCurveTo(0, canvas.height, 0, canvas.height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.clip();
  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// #36 Image Tiling / Mosaic
// ============================================================

function createTiledImage(canvas, tilesX, tilesY) {
  const result = document.createElement('canvas');
  result.width = canvas.width * tilesX;
  result.height = canvas.height * tilesY;
  const ctx = result.getContext('2d');

  for (let y = 0; y < tilesY; y++) {
    for (let x = 0; x < tilesX; x++) {
      ctx.drawImage(canvas, x * canvas.width, y * canvas.height);
    }
  }

  return result;
}

// ============================================================
// #37 Histogram Display
// ============================================================

function computeHistogram(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;

  const r = new Uint32Array(256);
  const g = new Uint32Array(256);
  const b = new Uint32Array(256);
  const lum = new Uint32Array(256);

  for (let i = 0; i < data.length; i += 4) {
    r[data[i]]++;
    g[data[i + 1]]++;
    b[data[i + 2]]++;
    const l = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    lum[l]++;
  }

  return { r, g, b, lum };
}

function drawHistogram(targetCanvas, histogram, width = 256, height = 100) {
  targetCanvas.width = width;
  targetCanvas.height = height;
  const ctx = targetCanvas.getContext('2d');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  const maxVal = Math.max(
    ...Array.from(histogram.r),
    ...Array.from(histogram.g),
    ...Array.from(histogram.b)
  );

  function drawChannel(data, color) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = (i / 255) * width;
      const y = height - (data[i] / maxVal) * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  drawChannel(histogram.r, '#ef4444');
  drawChannel(histogram.g, '#22c55e');
  drawChannel(histogram.b, '#3b82f6');
  ctx.globalAlpha = 0.4;
  drawChannel(histogram.lum, '#ffffff');
  ctx.globalAlpha = 1;
}

// ============================================================
// #38 CMYK Preview
// ============================================================

function rgbToCmyk(r, g, b) {
  const rr = r / 255, gg = g / 255, bb = b / 255;
  const k = 1 - Math.max(rr, gg, bb);
  if (k === 1) return { c: 0, m: 0, y: 0, k: 100 };
  return {
    c: Math.round(((1 - rr - k) / (1 - k)) * 100),
    m: Math.round(((1 - gg - k) / (1 - k)) * 100),
    y: Math.round(((1 - bb - k) / (1 - k)) * 100),
    k: Math.round(k * 100),
  };
}

function simulateCmyk(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const cmyk = rgbToCmyk(data[i], data[i + 1], data[i + 2]);
    // Convert back to RGB (CMYK simulation - will look slightly different)
    const k = cmyk.k / 100;
    data[i]     = Math.round(255 * (1 - cmyk.c / 100) * (1 - k));
    data[i + 1] = Math.round(255 * (1 - cmyk.m / 100) * (1 - k));
    data[i + 2] = Math.round(255 * (1 - cmyk.y / 100) * (1 - k));
  }

  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// #39 Steganography Detector (LSB analysis)
// ============================================================

function detectSteganography(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const totalPixels = canvas.width * canvas.height;

  // Check least significant bit distribution
  let lsbOnes = 0;
  const lsbPattern = [];

  for (let i = 0; i < data.length; i += 4) {
    const lsb = (data[i] & 1) + (data[i + 1] & 1) + (data[i + 2] & 1);
    lsbOnes += lsb;
    if (lsbPattern.length < 1000) lsbPattern.push(lsb);
  }

  const expectedOnes = totalPixels * 3 * 0.5; // random should be ~50%
  const ratio = lsbOnes / (totalPixels * 3);

  // Chi-squared test simplification
  const deviation = Math.abs(ratio - 0.5);
  const suspicious = deviation < 0.01; // Too perfect = likely embedded data

  // Check for sequential patterns
  let sequential = 0;
  for (let i = 1; i < lsbPattern.length; i++) {
    if (lsbPattern[i] === lsbPattern[i - 1]) sequential++;
  }
  const sequentialRatio = sequential / lsbPattern.length;

  return {
    lsbRatio: (ratio * 100).toFixed(2) + '%',
    suspicious,
    assessment: suspicious ? 'Possible hidden data detected (LSB distribution is unusually uniform)' :
                deviation > 0.15 ? 'Unlikely to contain hidden data' :
                'No strong indicators of steganography',
    sequentialRatio: (sequentialRatio * 100).toFixed(1) + '%',
  };
}

// Visual LSB extraction - amplify least significant bits
function visualizeLSB(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    // Amplify LSBs to make hidden data visible
    data[i]     = (data[i] & 1) * 255;
    data[i + 1] = (data[i + 1] & 1) * 255;
    data[i + 2] = (data[i + 2] & 1) * 255;
  }

  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// #40 Reverse Image Search
// ============================================================

function openReverseImageSearch(imageDataUrl, engine = 'google') {
  // These open in new tabs - the user uploads manually
  // We can't POST directly due to CORS, but we can open the search pages
  const urls = {
    google: 'https://images.google.com/',
    tineye: 'https://tineye.com/',
    bing: 'https://www.bing.com/images/search?view=detailv2&iss=sbiupload',
    yandex: 'https://yandex.com/images/search?rpt=imageview',
  };

  const url = urls[engine];
  if (url) {
    // Copy image to clipboard so user can paste it on the search page
    fetch(imageDataUrl)
      .then(r => r.blob())
      .then(blob => {
        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).catch(() => {});
      });
    window.open(url, '_blank');
  }
}
