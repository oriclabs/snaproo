// Pixeroo - Non-destructive Editing Pipeline
//
// Architecture:
//   Original Image (immutable, full resolution)
//       ↓
//   Operation Stack (ordered list of transforms)
//       ↓
//   Display Canvas (preview at screen resolution)
//       ↓
//   Export (render original + operations at target resolution)
//
// Operations are recorded, not applied destructively.
// The original image is always preserved.
// Undo = remove last operation. Redo = re-add it.
// Resize only changes export target, not source pixels.

class EditPipeline {
  constructor() {
    this.original = null;       // HTMLImageElement or ImageBitmap (never modified)
    this.originalWidth = 0;
    this.originalHeight = 0;
    this.operations = [];       // ordered list of { type, params }
    this.undoneOps = [];        // redo stack
    this.exportWidth = 0;       // target export dimensions (0 = same as original)
    this.exportHeight = 0;
    this.displayCanvas = null;  // the visible canvas element
    this.displayCtx = null;
  }

  // Load the source image (called once per file)
  loadImage(img) {
    this.original = img;
    this.originalWidth = img.naturalWidth || img.width;
    this.originalHeight = img.naturalHeight || img.height;
    this.exportWidth = this.originalWidth;
    this.exportHeight = this.originalHeight;
    this.operations = [];
    this.undoneOps = [];
    this.render();
  }

  setDisplayCanvas(canvas) {
    this.displayCanvas = canvas;
    this.displayCtx = canvas.getContext('2d', { willReadFrequently: true });
  }

  // --- Operations ---

  addOperation(op) {
    this.operations.push(op);
    this.undoneOps = [];
    this.render();
  }

  undo() {
    if (this.operations.length === 0) return;
    this.undoneOps.push(this.operations.pop());
    this.render();
  }

  redo() {
    if (this.undoneOps.length === 0) return;
    this.operations.push(this.undoneOps.pop());
    this.render();
  }

  resetAll() {
    this.operations = [];
    this.undoneOps = [];
    this.exportWidth = this.originalWidth;
    this.exportHeight = this.originalHeight;
    this.render();
  }

  // Set export dimensions via resize operation (undoable)
  setExportSize(w, h) {
    // Remove any existing resize operation and add new one
    this.operations = this.operations.filter(op => op.type !== 'resize');
    if (w !== this.originalWidth || h !== this.originalHeight) {
      this.operations.push({ type: 'resize', w, h });
    }
    this.undoneOps = [];
    this.render();
  }

  // --- Render Pipeline ---
  // Replays all operations on a fresh copy of the original

  render() {
    if (!this.original || !this.displayCanvas) return;

    const c = this.displayCanvas;
    const ctx = this.displayCtx;

    // Always start from original
    c.width = this.originalWidth; c.height = this.originalHeight;
    ctx.drawImage(this.original, 0, 0);

    // Apply each operation in order (including resize)
    for (const op of this.operations) {
      this._applyOp(ctx, c, op);
    }

    // Update export dimensions from final canvas state
    this.exportWidth = c.width;
    this.exportHeight = c.height;
  }

  // Render at full resolution for export
  renderForExport() {
    const c = document.createElement('canvas');
    c.width = this.originalWidth;
    c.height = this.originalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(this.original, 0, 0);

    for (const op of this.operations) {
      this._applyOp(ctx, c, op);
    }

    return c;
  }

  _applyOp(ctx, canvas, op) {
    switch (op.type) {
      case 'resize': {
        const { w, h } = op;
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width; tmp.height = canvas.height;
        tmp.getContext('2d').drawImage(canvas, 0, 0);
        canvas.width = w; canvas.height = h;
        if (typeof steppedResize === 'function' && (w < tmp.width / 2 || h < tmp.height / 2)) {
          ctx.drawImage(steppedResize(tmp, w, h), 0, 0);
        } else {
          ctx.drawImage(tmp, 0, 0, w, h);
        }
        break;
      }
      case 'rotate': {
        const tmp = document.createElement('canvas');
        const tc = tmp.getContext('2d');
        const deg = op.degrees;
        const rad = deg * Math.PI / 180;
        if (deg === 90 || deg === -90) {
          // Exact 90° — swap dimensions
          tmp.width = canvas.height; tmp.height = canvas.width;
          tc.translate(deg === 90 ? tmp.width : 0, deg === -90 ? tmp.height : 0);
          tc.rotate(rad);
          tc.drawImage(canvas, 0, 0);
        } else if (deg === 180 || deg === -180) {
          tmp.width = canvas.width; tmp.height = canvas.height;
          tc.translate(tmp.width, tmp.height);
          tc.rotate(rad);
          tc.drawImage(canvas, 0, 0);
        }
        canvas.width = tmp.width; canvas.height = tmp.height;
        ctx.drawImage(tmp, 0, 0);
        this.exportWidth = canvas.width; this.exportHeight = canvas.height;
        break;
      }

      case 'flip': {
        const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
        const tc = tmp.getContext('2d');
        if (op.direction === 'h') { tc.translate(canvas.width, 0); tc.scale(-1, 1); }
        else { tc.translate(0, canvas.height); tc.scale(1, -1); }
        tc.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp, 0, 0);
        break;
      }

      case 'crop': {
        const imgData = ctx.getImageData(
          Math.round(op.x * canvas.width), Math.round(op.y * canvas.height),
          Math.round(op.w * canvas.width), Math.round(op.h * canvas.height)
        );
        const nw = Math.round(op.w * canvas.width);
        const nh = Math.round(op.h * canvas.height);
        canvas.width = nw; canvas.height = nh;
        ctx.putImageData(imgData, 0, 0);
        this.exportWidth = nw; this.exportHeight = nh;
        break;
      }

      case 'adjust': {
        const filters = [];
        if (op.brightness !== 0) filters.push(`brightness(${100 + op.brightness}%)`);
        if (op.contrast !== 0) filters.push(`contrast(${100 + op.contrast}%)`);
        if (op.saturation !== 0) filters.push(`saturate(${100 + op.saturation}%)`);
        if (op.hue !== 0) filters.push(`hue-rotate(${op.hue}deg)`);
        if (filters.length > 0) {
          const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
          const tc = tmp.getContext('2d');
          tc.filter = filters.join(' ');
          tc.drawImage(canvas, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tmp, 0, 0);
        }
        break;
      }

      case 'filter': {
        const filterMap = {
          grayscale: 'grayscale(100%)', sepia: 'sepia(100%)', invert: 'invert(100%)',
          blur: 'blur(1.5px)', sharpen: 'contrast(150%) brightness(110%)'
        };
        if (filterMap[op.name]) {
          const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
          const tc = tmp.getContext('2d');
          tc.filter = filterMap[op.name];
          tc.drawImage(canvas, 0, 0);
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(tmp, 0, 0);
        }
        break;
      }

      case 'maskFilter': {
        const { filterName, x, y, w, h, amount } = op;
        const rx = Math.round(x), ry = Math.round(y), rw = Math.round(w), rh = Math.round(h);
        if (rw < 1 || rh < 1) break;
        const regionData = ctx.getImageData(rx, ry, rw, rh);
        const rc = document.createElement('canvas'); rc.width = rw; rc.height = rh;
        const rctx = rc.getContext('2d');
        rctx.putImageData(regionData, 0, 0);

        if (filterName === 'pixelate') {
          const bs = amount || 8;
          const sw = Math.max(1, Math.round(rw / bs)), sh = Math.max(1, Math.round(rh / bs));
          const small = document.createElement('canvas'); small.width = sw; small.height = sh;
          small.getContext('2d').drawImage(rc, 0, 0, sw, sh);
          rctx.imageSmoothingEnabled = false;
          rctx.clearRect(0, 0, rw, rh);
          rctx.drawImage(small, 0, 0, rw, rh);
        } else if (filterName === 'blur') {
          const px = amount || 4;
          const tmp = document.createElement('canvas'); tmp.width = rw; tmp.height = rh;
          const tc = tmp.getContext('2d');
          tc.filter = `blur(${px}px)`;
          tc.drawImage(rc, 0, 0);
          rctx.clearRect(0, 0, rw, rh);
          rctx.drawImage(tmp, 0, 0);
        } else {
          const pct = amount || 100;
          const filters = { grayscale:`grayscale(${pct}%)`, invert:`invert(${pct}%)`, sepia:`sepia(${pct}%)` };
          if (filters[filterName]) {
            const tmp = document.createElement('canvas'); tmp.width = rw; tmp.height = rh;
            const tc = tmp.getContext('2d');
            tc.filter = filters[filterName];
            tc.drawImage(rc, 0, 0);
            rctx.clearRect(0, 0, rw, rh);
            rctx.drawImage(tmp, 0, 0);
          }
        }
        ctx.drawImage(rc, rx, ry);
        break;
      }

      case 'vignette': {
        const cx = canvas.width / 2, cy = canvas.height / 2;
        const maxDist = Math.sqrt(cx * cx + cy * cy);
        const gradient = ctx.createRadialGradient(cx, cy, maxDist * 0.5, cx, cy, maxDist);
        gradient.addColorStop(0, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        break;
      }

      case 'denoise': {
        // Simple box blur pass
        denoiseImage(canvas, 1);
        break;
      }

      case 'pixelate': {
        pixelateImage(canvas, op.blockSize || 8);
        break;
      }

      case 'roundCorners': {
        applyRoundedCorners(canvas, Math.min(canvas.width, canvas.height) * 0.08);
        break;
      }

      case 'watermark': {
        applyWatermark(canvas, ctx, op.text, op.options);
        break;
      }

      case 'border': {
        applyBorder(canvas, op.width || 10, op.color || '#000000');
        this.exportWidth = canvas.width;
        this.exportHeight = canvas.height;
        break;
      }

      case 'padding': {
        const p = op.top || 0, pr = op.right || 0, pb = op.bottom || 0, pl = op.left || 0;
        const color = op.color || '#ffffff';
        const nw = canvas.width + pl + pr, nh = canvas.height + p + pb;
        const tmp = document.createElement('canvas'); tmp.width = nw; tmp.height = nh;
        const tc = tmp.getContext('2d');
        tc.fillStyle = color; tc.fillRect(0, 0, nw, nh);
        tc.drawImage(canvas, pl, p);
        canvas.width = nw; canvas.height = nh;
        ctx.drawImage(tmp, 0, 0);
        this.exportWidth = nw; this.exportHeight = nh;
        break;
      }

      case 'tile': {
        const tiled = createTiledImage(canvas, op.cols || 2, op.rows || 2);
        canvas.width = tiled.width; canvas.height = tiled.height;
        ctx.drawImage(tiled, 0, 0);
        this.exportWidth = canvas.width;
        this.exportHeight = canvas.height;
        break;
      }

      case 'colorBlindness': {
        simulateColorBlindness(canvas, op.mode);
        break;
      }

      case 'cmyk': {
        simulateCmyk(canvas);
        break;
      }

      case 'channel': {
        extractChannel(canvas, op.channel);
        break;
      }

      case 'levels': {
        adjustLevels(canvas, op.black, op.white, op.gamma);
        break;
      }

      case 'temperature': {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        const t = op.value / 100; // -1 to 1
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.min(255, Math.max(0, d[i] + t * 30));     // R: warm
          d[i+2] = Math.min(255, Math.max(0, d[i+2] - t * 30)); // B: cool
        }
        ctx.putImageData(data, 0, 0);
        break;
      }

      case 'shadows': {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        const v = op.value;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (d[i] + d[i+1] + d[i+2]) / 3;
          if (lum < 128) {
            const factor = (128 - lum) / 128;
            const adj = v * factor * 0.5;
            d[i] = Math.min(255, Math.max(0, d[i] + adj));
            d[i+1] = Math.min(255, Math.max(0, d[i+1] + adj));
            d[i+2] = Math.min(255, Math.max(0, d[i+2] + adj));
          }
        }
        ctx.putImageData(data, 0, 0);
        break;
      }

      case 'highlights': {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        const v = op.value;
        for (let i = 0; i < d.length; i += 4) {
          const lum = (d[i] + d[i+1] + d[i+2]) / 3;
          if (lum > 128) {
            const factor = (lum - 128) / 128;
            const adj = v * factor * 0.5;
            d[i] = Math.min(255, Math.max(0, d[i] + adj));
            d[i+1] = Math.min(255, Math.max(0, d[i+1] + adj));
            d[i+2] = Math.min(255, Math.max(0, d[i+2] + adj));
          }
        }
        ctx.putImageData(data, 0, 0);
        break;
      }

      case 'grain': {
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        const amount = op.amount || 25;
        for (let i = 0; i < d.length; i += 4) {
          const noise = (Math.random() - 0.5) * amount;
          d[i] = Math.min(255, Math.max(0, d[i] + noise));
          d[i+1] = Math.min(255, Math.max(0, d[i+1] + noise));
          d[i+2] = Math.min(255, Math.max(0, d[i+2] + noise));
        }
        ctx.putImageData(data, 0, 0);
        break;
      }

      case 'autoEnhance': {
        // Auto-levels: stretch histogram to full range, then slight contrast boost
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = data.data;
        let minR = 255, minG = 255, minB = 255, maxR = 0, maxG = 0, maxB = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] < minR) minR = d[i]; if (d[i] > maxR) maxR = d[i];
          if (d[i+1] < minG) minG = d[i+1]; if (d[i+1] > maxG) maxG = d[i+1];
          if (d[i+2] < minB) minB = d[i+2]; if (d[i+2] > maxB) maxB = d[i+2];
        }
        const rangeR = maxR - minR || 1, rangeG = maxG - minG || 1, rangeB = maxB - minB || 1;
        for (let i = 0; i < d.length; i += 4) {
          d[i] = ((d[i] - minR) / rangeR) * 255;
          d[i+1] = ((d[i+1] - minG) / rangeG) * 255;
          d[i+2] = ((d[i+2] - minB) / rangeB) * 255;
        }
        ctx.putImageData(data, 0, 0);
        // Slight contrast boost
        const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
        const tc = tmp.getContext('2d');
        tc.filter = 'contrast(110%)';
        tc.drawImage(canvas, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp, 0, 0);
        break;
      }

      case 'straighten': {
        const angle = op.angle * Math.PI / 180;
        // Keep canvas same size — rotate in place (corners clipped)
        const tmp = document.createElement('canvas'); tmp.width = canvas.width; tmp.height = canvas.height;
        const tc = tmp.getContext('2d');
        tc.translate(canvas.width / 2, canvas.height / 2);
        tc.rotate(angle);
        tc.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tmp, 0, 0);
        break;
      }

      case 'lsbVisualize': {
        visualizeLSB(canvas);
        break;
      }
    }
  }

  // --- Utility ---

  getOriginalDimensions() {
    return { w: this.originalWidth, h: this.originalHeight };
  }

  getExportDimensions() {
    return { w: this.exportWidth, h: this.exportHeight };
  }

  hasOperations() {
    return this.operations.length > 0;
  }

  // Get the current state summary
  getOperationsSummary() {
    return this.operations.map(op => op.type).join(', ');
  }
}
