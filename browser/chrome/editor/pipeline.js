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

  // Set export dimensions (non-destructive resize)
  setExportSize(w, h) {
    this.exportWidth = w;
    this.exportHeight = h;
    this.render();
  }

  // --- Render Pipeline ---
  // Replays all operations on a fresh copy of the original

  render() {
    if (!this.original || !this.displayCanvas) return;

    const c = this.displayCanvas;
    const ctx = this.displayCtx;

    // Start from original, apply resize if set, then operations
    const resized = this.exportWidth !== this.originalWidth || this.exportHeight !== this.originalHeight;
    if (resized) {
      c.width = this.exportWidth; c.height = this.exportHeight;
      if (typeof steppedResize === 'function' &&
          (this.exportWidth < this.originalWidth / 2 || this.exportHeight < this.originalHeight / 2)) {
        const tmp = document.createElement('canvas');
        tmp.width = this.originalWidth; tmp.height = this.originalHeight;
        tmp.getContext('2d').drawImage(this.original, 0, 0);
        ctx.drawImage(steppedResize(tmp, this.exportWidth, this.exportHeight), 0, 0);
      } else {
        ctx.drawImage(this.original, 0, 0, this.exportWidth, this.exportHeight);
      }
    } else {
      c.width = this.originalWidth; c.height = this.originalHeight;
      ctx.drawImage(this.original, 0, 0);
    }

    // Apply each operation — ops may change canvas dimensions
    for (const op of this.operations) {
      this._applyOp(ctx, c, op);
    }
    // Sync export dimensions to final canvas state
    this.exportWidth = c.width;
    this.exportHeight = c.height;
  }

  // Render at full resolution for export (may differ from display)
  renderForExport(targetW, targetH) {
    const c = document.createElement('canvas');
    c.width = targetW || this.exportWidth;
    c.height = targetH || this.exportHeight;
    const ctx = c.getContext('2d');

    ctx.drawImage(this.original, 0, 0, c.width, c.height);

    for (const op of this.operations) {
      this._applyOp(ctx, c, op);
    }

    return c;
  }

  _applyOp(ctx, canvas, op) {
    switch (op.type) {
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
        } else {
          // Arbitrary angle — expand canvas to fit rotated image
          const sin = Math.abs(Math.sin(rad));
          const cos = Math.abs(Math.cos(rad));
          tmp.width = Math.round(canvas.width * cos + canvas.height * sin);
          tmp.height = Math.round(canvas.width * sin + canvas.height * cos);
          tc.translate(tmp.width / 2, tmp.height / 2);
          tc.rotate(rad);
          tc.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);
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
          blur: 'blur(3px)', sharpen: 'contrast(150%) brightness(110%)'
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
