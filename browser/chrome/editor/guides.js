// Snaproo — Ruler & Grid Overlay System
// Non-destructive: renders on a dedicated overlay, never touches the image canvas.
// Rulers sit OUTSIDE the image (offset margin) — no image pixels are covered.
//
// Usage:
//   const guides = new CanvasGuides(parentEl, refCanvas);
//   guides.show();        // attach overlay
//   guides.hide();        // remove overlay
//   guides.toggle();      // flip visibility
//   guides.update();      // re-render (call after canvas resize)
//   guides.setOptions({ showRuler: true, showGrid: true, gridSpacing: 50 });

class CanvasGuides {
  constructor(parentEl, refCanvas, options = {}) {
    this.parent = parentEl;
    this.ref = refCanvas;
    this.visible = false;

    // Options
    this.showRuler = options.showRuler !== undefined ? options.showRuler : true;
    this.showGrid = options.showGrid !== undefined ? options.showGrid : true;
    this.showCenter = options.showCenter !== undefined ? options.showCenter : false;
    this.gridSpacing = options.gridSpacing || 0; // 0 = auto
    this.rulerSize = 22; // px width/height of ruler bar
    this.colors = {
      rulerBg: 'rgba(15,23,42,0.92)',
      rulerText: 'rgba(148,163,184,0.9)',
      rulerTick: 'rgba(148,163,184,0.4)',
      rulerMajor: 'rgba(148,163,184,0.7)',
      grid: 'rgba(244,196,48,0.10)',
      gridMajor: 'rgba(244,196,48,0.22)',
      center: 'rgba(244,196,48,0.35)',
    };

    // Overlay canvas
    this.overlay = document.createElement('canvas');
    this.overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:3;';
    this.ctx = this.overlay.getContext('2d');
  }

  setOptions(opts) {
    if (opts.showRuler !== undefined) this.showRuler = opts.showRuler;
    if (opts.showGrid !== undefined) this.showGrid = opts.showGrid;
    if (opts.showCenter !== undefined) this.showCenter = opts.showCenter;
    if (opts.gridSpacing !== undefined) this.gridSpacing = opts.gridSpacing;
    if (this.visible) { this._syncPosition(); this.render(); }
  }

  show() {
    if (this.visible) return;
    this.visible = true;
    this._syncPosition();
    this.parent.style.position = 'relative';
    this.parent.appendChild(this.overlay);
    this.render();
  }

  hide() {
    if (!this.visible) return;
    this.visible = false;
    this.overlay.remove();
  }

  toggle() {
    this.visible ? this.hide() : this.show();
    return this.visible;
  }

  update() {
    if (!this.visible) return;
    this._syncPosition();
    this.render();
  }

  _syncPosition() {
    const refRect = this.ref.getBoundingClientRect();
    const parentRect = this.parent.getBoundingClientRect();

    // Image position within parent
    const imgLeft = refRect.left - parentRect.left;
    const imgTop = refRect.top - parentRect.top;
    const imgDispW = refRect.width;
    const imgDispH = refRect.height;

    // Ruler margin offset: overlay extends beyond image to make room for rulers
    const rs = this.showRuler ? this.rulerSize : 0;

    // Overlay is larger than image by rulerSize on top and left
    const ovW = Math.round(imgDispW + rs);
    const ovH = Math.round(imgDispH + rs);

    this.overlay.width = ovW;
    this.overlay.height = ovH;
    this.overlay.style.left = (imgLeft - rs) + 'px';
    this.overlay.style.top = (imgTop - rs) + 'px';
    this.overlay.style.width = ovW + 'px';
    this.overlay.style.height = ovH + 'px';

    // The image region within the overlay starts at (rs, rs)
    this._rs = rs;
    this._imgDispW = imgDispW;
    this._imgDispH = imgDispH;
    this.imgW = this.ref.width;
    this.imgH = this.ref.height;
  }

  render() {
    if (!this.visible) return;
    const ctx = this.ctx;
    const ow = this.overlay.width;
    const oh = this.overlay.height;
    ctx.clearRect(0, 0, ow, oh);

    const rs = this._rs;
    const iw = this._imgDispW;
    const ih = this._imgDispH;

    // Grid and center draw only in the image region (offset by rs)
    if (this.showGrid) this._drawGrid(ctx, rs, iw, ih);
    if (this.showCenter) this._drawCenter(ctx, rs, iw, ih);
    if (this.showRuler && rs > 0) this._drawRulers(ctx, rs, iw, ih);
  }

  // ── Grid ─────────────────────────────────────────────

  _autoGridSpacing() {
    const candidates = [10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000];
    const scale = this._imgDispW / this.imgW;
    for (const c of candidates) {
      if (c * scale >= 36) return c;
    }
    return 500;
  }

  _drawGrid(ctx, rs, iw, ih) {
    const spacing = this.gridSpacing || this._autoGridSpacing();
    const sx = iw / this.imgW;
    const sy = ih / this.imgH;

    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = spacing; x < this.imgW; x += spacing) {
      const dx = rs + Math.round(x * sx) + 0.5;
      ctx.strokeStyle = (x % (spacing * 5) === 0) ? this.colors.gridMajor : this.colors.grid;
      ctx.beginPath(); ctx.moveTo(dx, rs); ctx.lineTo(dx, rs + ih); ctx.stroke();
    }

    // Horizontal lines
    for (let y = spacing; y < this.imgH; y += spacing) {
      const dy = rs + Math.round(y * sy) + 0.5;
      ctx.strokeStyle = (y % (spacing * 5) === 0) ? this.colors.gridMajor : this.colors.grid;
      ctx.beginPath(); ctx.moveTo(rs, dy); ctx.lineTo(rs + iw, dy); ctx.stroke();
    }
  }

  // ── Center crosshair ────────────────────────────────

  _drawCenter(ctx, rs, iw, ih) {
    const cx = rs + Math.round(iw / 2) + 0.5;
    const cy = rs + Math.round(ih / 2) + 0.5;
    ctx.strokeStyle = this.colors.center;
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 4]);

    ctx.beginPath(); ctx.moveTo(cx, rs); ctx.lineTo(cx, rs + ih); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(rs, cy); ctx.lineTo(rs + iw, cy); ctx.stroke();

    ctx.setLineDash([]);
  }

  // ── Rulers (outside image area) ────────────────────

  _drawRulers(ctx, rs, iw, ih) {
    const spacing = this.gridSpacing || this._autoGridSpacing();
    const sx = iw / this.imgW;
    const sy = ih / this.imgH;

    // Top ruler background (full width, above image)
    ctx.fillStyle = this.colors.rulerBg;
    ctx.fillRect(rs, 0, iw, rs);

    // Left ruler background (full height, left of image)
    ctx.fillRect(0, rs, rs, ih);

    // Corner square
    ctx.fillRect(0, 0, rs, rs);

    // ── Top ruler ticks + labels ──
    ctx.fillStyle = this.colors.rulerText;
    ctx.font = '9px Inter, system-ui, monospace';
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    ctx.lineWidth = 1;

    for (let x = 0; x <= this.imgW; x += spacing) {
      const dx = rs + Math.round(x * sx) + 0.5;
      const isMajor = (x % (spacing * 5) === 0) || x === 0;
      const tickH = isMajor ? rs * 0.55 : rs * 0.3;

      ctx.strokeStyle = isMajor ? this.colors.rulerMajor : this.colors.rulerTick;
      ctx.beginPath();
      ctx.moveTo(dx, rs - 1);
      ctx.lineTo(dx, rs - 1 - tickH);
      ctx.stroke();

      if (isMajor) {
        ctx.fillStyle = this.colors.rulerText;
        ctx.fillText(x.toString(), dx + 2, 1);
      }
    }

    // ── Left ruler ticks + labels ──
    for (let y = 0; y <= this.imgH; y += spacing) {
      const dy = rs + Math.round(y * sy) + 0.5;
      const isMajor = (y % (spacing * 5) === 0) || y === 0;
      const tickW = isMajor ? rs * 0.55 : rs * 0.3;

      ctx.strokeStyle = isMajor ? this.colors.rulerMajor : this.colors.rulerTick;
      ctx.beginPath();
      ctx.moveTo(rs - 1, dy);
      ctx.lineTo(rs - 1 - tickW, dy);
      ctx.stroke();

      if (isMajor) {
        ctx.save();
        ctx.fillStyle = this.colors.rulerText;
        ctx.translate(1, dy + 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'right';
        ctx.textBaseline = 'top';
        ctx.fillText(y.toString(), 0, 0);
        ctx.restore();
      }
    }

    // Corner label
    ctx.fillStyle = this.colors.rulerText;
    ctx.font = 'bold 7px Inter, system-ui, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('px', rs / 2, rs / 2);
  }

  // ── Destroy ─────────────────────────────────────────

  destroy() {
    this.hide();
    this.overlay = null;
    this.ctx = null;
  }
}
