// Snaproo - Object-based Drawing System
// Replaces stamp-based annotations with selectable, movable, resizable objects.
//
// Usage:
//   const objLayer = new ObjectLayer(canvas);
//   objLayer.addText(100, 100, 'Hello');
//   objLayer.addRect(50, 50, 200, 100);
//   objLayer.addArrow(10, 10, 200, 200);
//   objLayer.flatten(); // burns objects into canvas pixels

class DrawObject {
  constructor(type, x, y, w, h) {
    this.type = type; // 'text', 'rect', 'arrow', 'redact', 'pen', 'highlighter', 'image', 'callout'
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.color = '#ef4444';
    this.lineWidth = 3;
    this.text = '';
    this.fontSize = 24;
    this.fontFamily = 'Inter, system-ui, sans-serif';
    this.fontWeight = 'bold';
    this.fontStyle = 'normal';
    this.underline = false;
    this.visible = true;
    this.opacity = 1;
    this.selected = false;
    this.editing = false;
    this.filled = false; // for rect: filled vs stroke-only
    this.bgColor = null; // background color (null = transparent)
    this.redactMode = 'pixelate';
    this.redactStrength = 3;
    this.filter = null;
    this.filterValue = null;
    // For arrow
    this.x2 = x + w;
    this.y2 = y + h;
    // For pen/highlighter
    this.points = [];
    // For image objects (collage)
    this.imgSource = null;  // HTMLCanvasElement or HTMLImageElement
    this.imgFilter = 'none'; // CSS filter name
    this.borderWidth = 0;
    this.borderColor = '#ffffff';
    this.shadowEnabled = false;
    this.shadowColor = '#000000';
    this.shadowBlur = 12;
    this.shadowDir = 'br';
    this.cornerRadius = 0;
    // Callout properties
    this.calloutShape = 'rounded';   // rounded, bubble, cloud, banner, arrow-box
    this.calloutTailDir = 'bottom';  // top, bottom, left, right, none
    this.calloutTailOffset = 0.5;    // 0-1, position along edge
    this.calloutRadius = 12;         // corner radius
    this.calloutPadding = 12;        // inner padding
    this.calloutIcon = '';           // 'info', 'warning', 'check', 'x', 'star', 'pin', 'bulb', '1'-'9'
  }

  containsPoint(px, py) {
    if (this.type === 'arrow') {
      return this._distToSegment(px, py, this.x, this.y, this.x2, this.y2) < 8;
    }
    if (this.type === 'pen' || this.type === 'highlighter') {
      // Check bounding box first (for move when selected)
      const bb = this._strokeBounds();
      if (px >= bb.x - 4 && px <= bb.x + bb.w + 4 && py >= bb.y - 4 && py <= bb.y + bb.h + 4) return true;
      // Also check distance to any segment of the stroke
      const threshold = Math.max(this.lineWidth, 8);
      for (let i = 1; i < this.points.length; i++) {
        if (this._distToSegment(px, py, this.points[i - 1].x, this.points[i - 1].y, this.points[i].x, this.points[i].y) < threshold) return true;
      }
      return false;
    }
    return px >= this.x && px <= this.x + this.w && py >= this.y && py <= this.y + this.h;
  }

  getHandle(px, py) {
    const hs = 6;
    const handles = this._getHandlePositions();
    for (const [name, hx, hy] of handles) {
      if (Math.abs(px - hx) < hs && Math.abs(py - hy) < hs) return name;
    }
    if (this.containsPoint(px, py)) return 'move';
    return null;
  }

  _getHandlePositions() {
    if (this.type === 'arrow') {
      return [['start', this.x, this.y], ['end', this.x2, this.y2]];
    }
    if (this.type === 'pen' || this.type === 'highlighter') {
      // Use bounding box corners for move handle
      const bb = this._strokeBounds();
      return [
        ['tl', bb.x, bb.y], ['tr', bb.x + bb.w, bb.y],
        ['bl', bb.x, bb.y + bb.h], ['br', bb.x + bb.w, bb.y + bb.h],
      ];
    }
    return [
      ['tl', this.x, this.y], ['tr', this.x + this.w, this.y],
      ['bl', this.x, this.y + this.h], ['br', this.x + this.w, this.y + this.h],
      ['tm', this.x + this.w / 2, this.y], ['bm', this.x + this.w / 2, this.y + this.h],
      ['ml', this.x, this.y + this.h / 2], ['mr', this.x + this.w, this.y + this.h / 2],
    ];
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.opacity;

    if (this.type === 'rect') {
      // Fill with BG color if set
      if (this.bgColor) {
        ctx.fillStyle = this.bgColor;
        ctx.fillRect(this.x, this.y, this.w, this.h);
      }
      // Always draw border with main color
      ctx.strokeStyle = this.color;
      ctx.lineWidth = this.lineWidth;
      ctx.strokeRect(this.x, this.y, this.w, this.h);
    } else if (this.type === 'pen' || this.type === 'highlighter') {
      this._drawStroke(ctx);
    } else if (this.type === 'arrow') {
      this._drawArrow(ctx);
    } else if (this.type === 'text') {
      ctx.font = `${this.fontStyle || 'normal'} ${this.fontWeight} ${this.fontSize}px ${this.fontFamily}`;
      ctx.textBaseline = 'top';
      const lines = (this.text || '').split('\n');
      const lineH = this.fontSize * 1.3;
      // Measure and auto-size bounding box (min width for empty/short text)
      const minW = this.editing ? Math.max(this.fontSize * 6, 100) : 20;
      let maxW = 0;
      lines.forEach(line => { maxW = Math.max(maxW, ctx.measureText(line).width); });
      this.w = Math.max(maxW + 12, minW);
      this.h = Math.max(lines.length * lineH + 4, lineH + 4);
      // Draw background if set
      if (this.bgColor) {
        ctx.fillStyle = this.bgColor;
        const pad = 4;
        ctx.fillRect(this.x - pad, this.y - pad, this.w + pad * 2, this.h + pad * 2);
      }
      // Draw text
      ctx.fillStyle = this.color;
      lines.forEach((line, i) => {
        const ty = this.y + i * lineH + 2;
        ctx.fillText(line, this.x + 4, ty);
        // Underline
        if (this.underline) {
          const tw = ctx.measureText(line).width;
          ctx.beginPath();
          ctx.moveTo(this.x + 4, ty + this.fontSize + 2);
          ctx.lineTo(this.x + 4 + tw, ty + this.fontSize + 2);
          ctx.strokeStyle = this.color;
          ctx.lineWidth = Math.max(1, this.fontSize / 16);
          ctx.stroke();
        }
      });
    } else if (this.type === 'redact') {
      // Solid black fill (text unreadable)
      ctx.fillStyle = '#000000';
      ctx.fillRect(this.x, this.y, this.w, this.h);
    } else if (this.type === 'mask') {
      // Mask filter indicator (actual filter applied on flatten)
      ctx.strokeStyle = '#F4C430';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(this.x, this.y, this.w, this.h);
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(244,196,48,0.1)';
      ctx.fillRect(this.x, this.y, this.w, this.h);
      ctx.fillStyle = '#F4C430';
      ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.textBaseline = 'top';
      ctx.fillText(this.filter || 'mask', this.x + 4, this.y + 4);
    } else if (this.type === 'callout') {
      this._drawCallout(ctx);
    } else if (this.type === 'image' && this.imgSource) {
      this._drawImage(ctx);
    }

    ctx.restore();
  }

  drawSelection(ctx) {
    if (!this.selected) return;
    ctx.save();
    ctx.strokeStyle = '#F4C430';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    if (this.type === 'arrow') {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x2, this.y2);
      ctx.stroke();
    } else if (this.type === 'pen' || this.type === 'highlighter') {
      // Draw bounding box around stroke
      const bb = this._strokeBounds();
      ctx.strokeRect(bb.x - 4, bb.y - 4, bb.w + 8, bb.h + 8);
    } else {
      ctx.strokeRect(this.x - 2, this.y - 2, this.w + 4, this.h + 4);
    }

    ctx.setLineDash([]);

    // Draw handles
    ctx.fillStyle = '#F4C430';
    for (const [, hx, hy] of this._getHandlePositions()) {
      ctx.fillRect(hx - 4, hy - 4, 8, 8);
    }

    // Text cursor when editing
    if ((this.type === 'text' || this.type === 'callout') && this.editing) {
      ctx.font = `${this.fontStyle || 'normal'} ${this.fontWeight || 'normal'} ${this.fontSize}px ${this.fontFamily}`;
      const lines = (this.text || '').split('\n');
      const lastLine = lines[lines.length - 1] || '';
      const lineH = this.fontSize * 1.3;
      let cursorX, cursorY;

      if (this.type === 'callout') {
        const pad = this.calloutPadding || 12;
        let textOffsetX = 0;
        if (this.calloutIcon) textOffsetX = this.fontSize + 6;
        const totalH = lines.length * lineH;
        cursorX = this.x + pad + textOffsetX + ctx.measureText(lastLine).width + 2;
        cursorY = this.y + (this.h - totalH) / 2 + (lines.length - 1) * lineH;
      } else {
        cursorX = this.x + 4 + ctx.measureText(lastLine).width + 2;
        cursorY = this.y + (lines.length - 1) * lineH + 2;
      }

      ctx.strokeStyle = '#F4C430';
      ctx.lineWidth = 2;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(cursorX, cursorY);
      ctx.lineTo(cursorX, cursorY + this.fontSize);
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawArrow(ctx) {
    const headLen = 12;
    const angle = Math.atan2(this.y2 - this.y, this.x2 - this.x);
    ctx.strokeStyle = this.color;
    ctx.fillStyle = this.color;
    ctx.lineWidth = this.lineWidth;
    ctx.beginPath();
    ctx.moveTo(this.x, this.y);
    ctx.lineTo(this.x2, this.y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(this.x2, this.y2);
    ctx.lineTo(this.x2 - headLen * Math.cos(angle - Math.PI / 6), this.y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(this.x2 - headLen * Math.cos(angle + Math.PI / 6), this.y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
  }

  _strokeBounds() {
    if (!this.points.length) return { x: this.x, y: this.y, w: 0, h: 0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of this.points) {
      if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  }

  _drawCallout(ctx) {
    const { x, y, w, h } = this;
    const shape = this.calloutShape || 'rounded';
    const tailDir = this.calloutTailDir || 'none';
    const tailOffset = this.calloutTailOffset || 0.5;
    const radius = Math.min(this.calloutRadius || 12, Math.min(w, h) / 2);
    const pad = this.calloutPadding || 12;
    const tailSize = 12;

    // --- Draw shape path ---
    ctx.beginPath();
    if (shape === 'rounded' || shape === 'arrow-box') {
      ctx.roundRect(x, y, w, h, radius);
      // Arrow-box: small chevron arrows on left+right edges
      if (shape === 'arrow-box') {
        const midY = y + h / 2;
        ctx.moveTo(x, midY - 8); ctx.lineTo(x - 6, midY); ctx.lineTo(x, midY + 8);
        ctx.moveTo(x + w, midY - 8); ctx.lineTo(x + w + 6, midY); ctx.lineTo(x + w, midY + 8);
      }
    } else if (shape === 'bubble') {
      ctx.roundRect(x, y, w, h, radius);
    } else if (shape === 'cloud') {
      // Bumpy cloud approximation
      const cx = x + w / 2, cy = y + h / 2;
      const rx = w / 2, ry = h / 2;
      const bumps = 12;
      for (let i = 0; i < bumps; i++) {
        const a = (i / bumps) * Math.PI * 2;
        const na = ((i + 1) / bumps) * Math.PI * 2;
        const px1 = cx + rx * Math.cos(a), py1 = cy + ry * Math.sin(a);
        const px2 = cx + rx * Math.cos(na), py2 = cy + ry * Math.sin(na);
        const bx = cx + (rx + 8) * Math.cos((a + na) / 2);
        const by = cy + (ry + 8) * Math.sin((a + na) / 2);
        if (i === 0) ctx.moveTo(px1, py1);
        ctx.quadraticCurveTo(bx, by, px2, py2);
      }
      ctx.closePath();
    } else if (shape === 'banner') {
      ctx.moveTo(x + 10, y);
      ctx.lineTo(x + w - 10, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - 10, y + h);
      ctx.lineTo(x + 10, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
    }

    // Fill background
    if (this.bgColor) {
      ctx.fillStyle = this.bgColor;
      ctx.fill();
    }

    // Stroke border
    if (this.borderColor) {
      ctx.strokeStyle = this.borderColor;
      ctx.lineWidth = this.lineWidth || 2;
      ctx.stroke();
    }

    // --- Draw tail (separate path so it doesn't interfere with shape) ---
    if (tailDir !== 'none' && shape !== 'banner') {
      ctx.beginPath();
      if (shape === 'bubble') {
        // Curved speech-bubble tail
        if (tailDir === 'bottom') {
          const tx = x + w * tailOffset;
          ctx.moveTo(tx - 8, y + h);
          ctx.quadraticCurveTo(tx - 15, y + h + tailSize + 5, tx - 5, y + h + tailSize);
          ctx.quadraticCurveTo(tx, y + h + 5, tx + 8, y + h);
        } else if (tailDir === 'top') {
          const tx = x + w * tailOffset;
          ctx.moveTo(tx - 8, y);
          ctx.quadraticCurveTo(tx - 15, y - tailSize - 5, tx - 5, y - tailSize);
          ctx.quadraticCurveTo(tx, y - 5, tx + 8, y);
        } else if (tailDir === 'left') {
          const ty = y + h * tailOffset;
          ctx.moveTo(x, ty - 8);
          ctx.quadraticCurveTo(x - tailSize - 5, ty - 15, x - tailSize, ty - 5);
          ctx.quadraticCurveTo(x - 5, ty, x, ty + 8);
        } else if (tailDir === 'right') {
          const ty = y + h * tailOffset;
          ctx.moveTo(x + w, ty - 8);
          ctx.quadraticCurveTo(x + w + tailSize + 5, ty - 15, x + w + tailSize, ty - 5);
          ctx.quadraticCurveTo(x + w + 5, ty, x + w, ty + 8);
        }
      } else if (shape === 'cloud') {
        // Thought-bubble tail: small circles
        const tx = x + w * tailOffset, ty = y + h;
        if (tailDir === 'bottom') {
          ctx.arc(tx, ty + 6, 4, 0, Math.PI * 2);
          ctx.moveTo(tx - 6 + 2, ty + 14);
          ctx.arc(tx - 6, ty + 14, 2, 0, Math.PI * 2);
        } else if (tailDir === 'top') {
          ctx.arc(tx, y - 6, 4, 0, Math.PI * 2);
          ctx.moveTo(tx - 6 + 2, y - 14);
          ctx.arc(tx - 6, y - 14, 2, 0, Math.PI * 2);
        } else if (tailDir === 'left') {
          const tty = y + h * tailOffset;
          ctx.arc(x - 6, tty, 4, 0, Math.PI * 2);
          ctx.moveTo(x - 14 + 2, tty - 6);
          ctx.arc(x - 14, tty - 6, 2, 0, Math.PI * 2);
        } else if (tailDir === 'right') {
          const tty = y + h * tailOffset;
          ctx.arc(x + w + 6, tty, 4, 0, Math.PI * 2);
          ctx.moveTo(x + w + 14 + 2, tty - 6);
          ctx.arc(x + w + 14, tty - 6, 2, 0, Math.PI * 2);
        }
      } else {
        // Triangle tail for rounded / arrow-box
        let tx, ty2;
        if (tailDir === 'bottom') {
          tx = x + w * tailOffset;
          ctx.moveTo(tx - tailSize, y + h); ctx.lineTo(tx, y + h + tailSize); ctx.lineTo(tx + tailSize, y + h);
        } else if (tailDir === 'top') {
          tx = x + w * tailOffset;
          ctx.moveTo(tx - tailSize, y); ctx.lineTo(tx, y - tailSize); ctx.lineTo(tx + tailSize, y);
        } else if (tailDir === 'left') {
          ty2 = y + h * tailOffset;
          ctx.moveTo(x, ty2 - tailSize); ctx.lineTo(x - tailSize, ty2); ctx.lineTo(x, ty2 + tailSize);
        } else if (tailDir === 'right') {
          ty2 = y + h * tailOffset;
          ctx.moveTo(x + w, ty2 - tailSize); ctx.lineTo(x + w + tailSize, ty2); ctx.lineTo(x + w, ty2 + tailSize);
        }
      }
      if (this.bgColor) { ctx.fillStyle = this.bgColor; ctx.fill(); }
      if (this.borderColor) { ctx.strokeStyle = this.borderColor; ctx.lineWidth = this.lineWidth || 2; ctx.stroke(); }
    }

    // --- Draw icon ---
    let textOffsetX = 0;
    if (this.calloutIcon) {
      const iconSize = (this.fontSize || 16) + 2;
      const iconX = x + pad;
      const iconY = y + h / 2;
      this._drawCalloutIcon(ctx, this.calloutIcon, iconX, iconY, iconSize, this.color || '#fff');
      textOffsetX = iconSize + 4;
    }

    // --- Draw wrapped text ---
    const displayText = this.editing && this.text === 'Type here...' ? '' : this.text;
    if (displayText) {
      ctx.font = `${this.fontStyle || 'normal'} ${this.fontWeight || 'normal'} ${this.fontSize || 16}px ${this.fontFamily || 'Inter, system-ui, sans-serif'}`;
      ctx.fillStyle = this.color || '#ffffff';
      ctx.textBaseline = 'top';
      const maxTextW = w - pad * 2 - textOffsetX;
      const lines = this._wrapText(ctx, displayText, Math.max(maxTextW, 20));
      const lineH = (this.fontSize || 16) * 1.3;
      const totalH = lines.length * lineH;
      const startY = y + (h - totalH) / 2;
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], x + pad + textOffsetX, startY + i * lineH);
        if (this.underline) {
          const tw = ctx.measureText(lines[i]).width;
          const ly = startY + i * lineH + (this.fontSize || 16) + 2;
          ctx.beginPath();
          ctx.moveTo(x + pad + textOffsetX, ly);
          ctx.lineTo(x + pad + textOffsetX + tw, ly);
          ctx.strokeStyle = this.color || '#ffffff';
          ctx.lineWidth = Math.max(1, (this.fontSize || 16) / 16);
          ctx.stroke();
        }
      }
    }
  }

  _drawCalloutIcon(ctx, icon, ix, iy, size, color) {
    ctx.save();
    ctx.font = `bold ${size}px sans-serif`;
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    const icons = {
      'info': '\u2139', 'warning': '\u26A0', 'check': '\u2713', 'x': '\u2715',
      'star': '\u2605', 'pin': '\uD83D\uDCCC', 'bulb': '\uD83D\uDCA1',
      '1':'\u2460','2':'\u2461','3':'\u2462','4':'\u2463','5':'\u2464',
      '6':'\u2465','7':'\u2466','8':'\u2467','9':'\u2468'
    };
    ctx.fillText(icons[icon] || icon, ix, iy);
    ctx.restore();
  }

  _drawImage(ctx) {
    const { x, y, w, h } = this;
    const bw = this.borderWidth || 0;
    const r = this.cornerRadius || 0;

    // Shadow
    if (this.shadowEnabled) {
      const sr = parseInt(this.shadowColor.slice(1,3),16)||0, sg = parseInt(this.shadowColor.slice(3,5),16)||0, sb = parseInt(this.shadowColor.slice(5,7),16)||0;
      const sOff = Math.max(2, Math.round(this.shadowBlur * 0.3));
      const dir = this.shadowDir || 'br';
      ctx.shadowColor = `rgba(${sr},${sg},${sb},0.4)`;
      ctx.shadowBlur = this.shadowBlur;
      ctx.shadowOffsetX = dir === 'center' ? 0 : (dir.includes('r') ? sOff : -sOff);
      ctx.shadowOffsetY = dir === 'center' ? 0 : (dir.includes('b') ? sOff : -sOff);
      ctx.fillStyle = this.borderColor || '#fff';
      if (r > 0) { _imgRoundRect(ctx, x - bw, y - bw, w + bw*2, h + bw*2, r); ctx.fill(); }
      else ctx.fillRect(x - bw, y - bw, w + bw*2, h + bw*2);
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
    }

    // Border frame
    if (bw > 0) {
      ctx.fillStyle = this.borderColor || '#ffffff';
      if (r > 0) { _imgRoundRect(ctx, x - bw, y - bw, w + bw*2, h + bw*2, r); ctx.fill(); }
      else ctx.fillRect(x - bw, y - bw, w + bw*2, h + bw*2);
    }

    // Clip for rounded corners
    ctx.save();
    if (r > 0) { _imgRoundRect(ctx, x, y, w, h, Math.max(1, r - bw)); ctx.clip(); }

    // Filter
    const filterCSS = { none:'', grayscale:'grayscale(100%)', sepia:'sepia(100%)', brightness:'brightness(130%)', contrast:'contrast(140%)', blur:'blur(2px)', invert:'invert(100%)' };
    if (this.imgFilter && filterCSS[this.imgFilter]) ctx.filter = filterCSS[this.imgFilter];

    // Draw image (cover: fill the cell completely)
    const src = this.imgSource;
    const scale = Math.max(w / src.width, h / src.height);
    const sw = src.width * scale, sh = src.height * scale;
    ctx.drawImage(src, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);

    ctx.filter = 'none';
    ctx.restore();
  }

  _drawStroke(ctx) {
    if (this.points.length < 2) return;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.type === 'highlighter' ? Math.max(this.lineWidth * 4, 16) : this.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    if (this.type === 'highlighter') ctx.globalAlpha = 0.4;
    ctx.beginPath();
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      ctx.lineTo(this.points[i].x, this.points[i].y);
    }
    ctx.stroke();
    if (this.type === 'highlighter') ctx.globalAlpha = this.opacity;
  }

  _wrapText(ctx, text, maxWidth) {
    if (!text) return [''];
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line + (line ? ' ' : '') + word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
    return lines;
  }

  _distToSegment(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    if (lenSq === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
  }
}

class ObjectLayer {
  constructor(baseCanvas, saveStateFn) {
    this.base = baseCanvas;
    this.baseCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
    this.objects = [];
    this.selected = null;
    this.saveState = saveStateFn;

    // Overlay canvas for drawing objects + handles
    this.overlay = document.createElement('canvas');
    this.overlay.style.cssText = 'position:absolute;top:0;left:0;pointer-events:auto;cursor:default;z-index:5;';
    this.overlayCtx = this.overlay.getContext('2d');

    // Interaction state
    this.dragging = false;
    this.dragHandle = null;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.origX = 0;
    this.origY = 0;
    this.origW = 0;
    this.origH = 0;
    this.creating = null; // tool type being created
    this.active = false;

    // Settings (shared with ribbon)
    this.color = '#ef4444';
    this.lineWidth = 3;
    this.fontSize = 24;
    this._penObj = null; // active pen/highlighter stroke being drawn
    this._clipboard = null; // for copy/paste of draw objects
  }

  attach(parentEl) {
    // Remove old overlay if re-attaching
    if (this.overlay.parentElement) this.overlay.remove();
    this.overlay.width = this.base.width;
    this.overlay.height = this.base.height;
    parentEl.style.position = 'relative';
    parentEl.appendChild(this.overlay);
    requestAnimationFrame(() => this._syncOverlay());
    this.active = true;

    this._onDown = (e) => this._handleDown(e);
    this._onMove = (e) => this._handleMove(e);
    this._onUp = (e) => this._handleUp(e);
    this._onDblClick = (e) => this._handleDblClick(e);
    this._onKey = (e) => this._handleKey(e);

    this.overlay.addEventListener('mousedown', this._onDown);
    window.addEventListener('mousemove', this._onMove);
    window.addEventListener('mouseup', this._onUp);
    this.overlay.addEventListener('dblclick', this._onDblClick);
    document.addEventListener('keydown', this._onKey);

    this.render();
  }

  detach() {
    this.active = false;
    this.overlay.remove();
    this.overlay.removeEventListener('mousedown', this._onDown);
    window.removeEventListener('mousemove', this._onMove);
    window.removeEventListener('mouseup', this._onUp);
    this.overlay.removeEventListener('dblclick', this._onDblClick);
    document.removeEventListener('keydown', this._onKey);
  }

  _toCanvasCoords(e) {
    const rect = this.overlay.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * this.base.width / rect.width,
      y: (e.clientY - rect.top) * this.base.height / rect.height
    };
  }

  // --- Tool activation ---
  startTool(type) {
    this.deselectAll();
    this.creating = type;
    this.overlay.style.cursor = type === 'text' ? 'text' : 'crosshair';
    this.render();
  }

  stopTool() {
    this.creating = null;
    this.overlay.style.cursor = 'default';
  }

  // --- Object creation ---
  addRect(x, y, w, h) {
    const obj = new DrawObject('rect', x, y, w, h);
    obj.color = this.color;
    obj.lineWidth = this.lineWidth;
    obj.filled = this.filled || false;
    const bgToggle = document.getElementById('ann-bg-toggle');
    if (bgToggle?.checked) obj.bgColor = document.getElementById('ann-bg-color')?.value || '#ffffff';
    this.objects.push(obj);
    this.select(obj);
    return obj;
  }

  addArrow(x1, y1, x2, y2) {
    const obj = new DrawObject('arrow', x1, y1, 0, 0);
    obj.x2 = x2;
    obj.y2 = y2;
    obj.color = this.color;
    obj.lineWidth = this.lineWidth;
    this.objects.push(obj);
    this.select(obj);
    return obj;
  }

  addText(x, y, text) {
    const obj = new DrawObject('text', x, y, 200, 30);
    obj.text = text || '';
    obj.color = this.color;
    obj.fontSize = this.fontSize;
    obj.fontFamily = this.fontFamily || 'Inter, system-ui, sans-serif';
    // Apply background if toggle is on
    const bgToggle = document.getElementById('ann-bg-toggle');
    if (bgToggle?.checked) obj.bgColor = document.getElementById('ann-bg-color')?.value || '#ffffff';
    obj.editing = true;
    this.objects.push(obj);
    this.select(obj);
    return obj;
  }

  addRedact(x, y, w, h) {
    const obj = new DrawObject('redact', x, y, w, h);
    this.objects.push(obj);
    this.select(obj);
    return obj;
  }

  addMask(x, y, w, h, filter, filterValue) {
    const obj = new DrawObject('mask', x, y, w, h);
    obj.filter = filter || 'blur';
    obj.filterValue = filterValue;
    this.objects.push(obj);
    this.select(obj);
    return obj;
  }

  addCallout(x, y, w, h, opts = {}) {
    const obj = new DrawObject('callout', x, y, w || 200, h || 80);
    obj.text = opts.text || 'Type here...';
    obj.color = opts.textColor || this.color;
    obj.bgColor = opts.bgColor || '#1e293b';
    obj.borderColor = opts.borderColor || '#F4C430';
    obj.calloutShape = opts.shape || 'rounded';
    obj.calloutTailDir = opts.tailDir || 'bottom';
    obj.calloutTailOffset = opts.tailOffset || 0.5;
    obj.calloutRadius = opts.radius || 12;
    obj.calloutPadding = opts.padding || 12;
    obj.calloutIcon = opts.icon || '';
    obj.fontSize = opts.fontSize || this.fontSize || 16;
    obj.fontFamily = this.fontFamily || 'Inter, system-ui, sans-serif';
    obj.lineWidth = opts.borderWidth || 2;
    obj.editing = true;
    this.objects.push(obj);
    this.select(obj);
    return obj;
  }

  addImage(imgSource, x, y, w, h) {
    const obj = new DrawObject('image', x, y, w, h);
    obj.imgSource = imgSource;
    obj.opacity = 1;
    this.objects.push(obj);
    this.select(obj);
    return obj;
  }

  // Layer ordering
  bringForward() {
    if (!this.selected) return;
    const i = this.objects.indexOf(this.selected);
    if (i < this.objects.length - 1) {
      this.objects.splice(i, 1);
      this.objects.splice(i + 1, 0, this.selected);
      this.render();
    }
  }

  sendBackward() {
    if (!this.selected) return;
    const i = this.objects.indexOf(this.selected);
    if (i > 0) {
      this.objects.splice(i, 1);
      this.objects.splice(i - 1, 0, this.selected);
      this.render();
    }
  }

  bringToFront() {
    if (!this.selected) return;
    this.objects = this.objects.filter(o => o !== this.selected);
    this.objects.push(this.selected);
    this.render();
  }

  sendToBack() {
    if (!this.selected) return;
    this.objects = this.objects.filter(o => o !== this.selected);
    this.objects.unshift(this.selected);
    this.render();
  }

  // --- Copy / Paste / Duplicate ---
  copySelected() {
    if (!this.selected) return;
    // Deep clone the object properties
    this._clipboard = JSON.parse(JSON.stringify({
      type: this.selected.type,
      x: this.selected.x + 20, // offset so paste is visible
      y: this.selected.y + 20,
      w: this.selected.w,
      h: this.selected.h,
      x2: this.selected.x2,
      y2: this.selected.y2,
      text: this.selected.text,
      color: this.selected.color,
      bgColor: this.selected.bgColor,
      lineWidth: this.selected.lineWidth,
      fontSize: this.selected.fontSize,
      fontFamily: this.selected.fontFamily,
      fontWeight: this.selected.fontWeight,
      filled: this.selected.filled,
      opacity: this.selected.opacity,
      calloutShape: this.selected.calloutShape,
      calloutTailDir: this.selected.calloutTailDir,
      calloutIcon: this.selected.calloutIcon,
      calloutRadius: this.selected.calloutRadius,
      calloutPadding: this.selected.calloutPadding,
      borderColor: this.selected.borderColor,
      points: this.selected.points ? [...this.selected.points.map(p => ({...p}))] : [],
    }));
  }

  pasteFromClipboard() {
    if (!this._clipboard) return;
    const data = this._clipboard;
    const obj = new DrawObject(data.type, data.x, data.y, data.w, data.h);
    Object.assign(obj, data);
    // Offset next paste
    this._clipboard.x += 20;
    this._clipboard.y += 20;
    this.objects.push(obj);
    this.select(obj);
    this.render();
  }

  duplicateSelected() {
    if (!this.selected) return;
    this.copySelected();
    this.pasteFromClipboard();
  }

  // --- Pen/Highlighter are created directly in _handleDown, no addPen needed ---

  // --- Selection ---
  selectedObjects = [];

  select(obj) {
    this.deselectAll();
    obj.selected = true;
    this.selected = obj;
    this.selectedObjects = [obj];
    this.render();
    if (this.onSelect) this.onSelect(obj);
  }

  toggleSelect(obj) {
    // Shift+click: add/remove from multi-selection
    if (obj.selected) {
      obj.selected = false;
      this.selectedObjects = this.selectedObjects.filter(o => o !== obj);
      this.selected = this.selectedObjects.length ? this.selectedObjects[this.selectedObjects.length - 1] : null;
    } else {
      obj.selected = true;
      this.selectedObjects.push(obj);
      this.selected = obj;
    }
    this.render();
    if (this.selected && this.onSelect) this.onSelect(this.selected);
  }

  selectAll() {
    this.objects.forEach(o => o.selected = true);
    this.selectedObjects = [...this.objects];
    this.selected = this.objects.length ? this.objects[this.objects.length - 1] : null;
    this.render();
  }

  deselectAll() {
    if (this.selected?.editing) this.selected.editing = false;
    this.objects.forEach(o => o.selected = false);
    this.selected = null;
    this.selectedObjects = [];
  }

  deleteSelected() {
    if (!this.selectedObjects.length) return;
    this.objects = this.objects.filter(o => !o.selected);
    this.selected = null;
    this.selectedObjects = [];
    this.render();
  }

  // --- Mouse handlers ---
  _handleDown(e) {
    const { x, y } = this._toCanvasCoords(e);

    // If creating a new object
    if (this.creating) {
      this.dragStartX = x;
      this.dragStartY = y;

      if (this.creating === 'text') {
        const obj = this.addText(x, y, '');
        obj.editing = true;
        this.stopTool();
        this.render();
        return;
      }

      // Freehand pen/highlighter — start collecting points immediately
      if (this.creating === 'pen' || this.creating === 'highlighter') {
        const obj = new DrawObject(this.creating, x, y, 0, 0);
        obj.color = this.creating === 'highlighter' ? '#facc15' : this.color;
        obj.lineWidth = this.lineWidth;
        obj.opacity = 1;
        obj.points = [{ x, y }];
        this.objects.push(obj);
        this._penObj = obj;
        this.dragging = true;
        this.dragHandle = 'pen';
        return;
      }

      this.dragging = true;
      this.dragHandle = 'create';
      return;
    }

    // Check if clicking on a handle of selected object
    if (this.selected) {
      const handle = this.selected.getHandle(x, y);
      if (handle) {
        this.dragging = true;
        this.dragHandle = handle;
        this.dragStartX = x;
        this.dragStartY = y;
        this.origX = this.selected.x;
        this.origY = this.selected.y;
        this.origW = this.selected.w;
        this.origH = this.selected.h;
        return;
      }
    }

    // Check if clicking on any object
    for (let i = this.objects.length - 1; i >= 0; i--) {
      if (this.objects[i].containsPoint(x, y)) {
        if (e.shiftKey) {
          // Shift+click: toggle multi-select
          this.toggleSelect(this.objects[i]);
        } else {
          this.select(this.objects[i]);
        }
        this.dragging = true;
        this.dragHandle = 'move';
        this.dragStartX = x;
        this.dragStartY = y;
        this.origX = this.selected?.x || 0;
        this.origY = this.selected?.y || 0;
        // Save original positions of all selected for group move
        this._groupOrigPositions = this.selectedObjects.map(o => ({ obj: o, x: o.x, y: o.y, x2: o.x2, y2: o.y2 }));
        return;
      }
    }

    // Clicked on nothing -- deselect
    this.deselectAll();
    this.render();
  }

  _handleMove(e) {
    if (!this.active) return;
    const { x, y } = this._toCanvasCoords(e);

    if (!this.dragging) {
      // Update cursor based on what's under mouse
      let cursor = this.creating ? (this.creating === 'text' ? 'text' : 'crosshair') : 'default';
      if (this.selected) {
        const handle = this.selected.getHandle(x, y);
        const cursors = { tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize',
          tm: 'ns-resize', bm: 'ns-resize', ml: 'ew-resize', mr: 'ew-resize',
          start: 'move', end: 'move', move: 'move' };
        if (handle) cursor = cursors[handle] || 'move';
      }
      for (const obj of this.objects) {
        if (obj.containsPoint(x, y)) { cursor = 'move'; break; }
      }
      this.overlay.style.cursor = cursor;
      return;
    }

    const dx = x - this.dragStartX;
    const dy = y - this.dragStartY;

    // Freehand stroke in progress
    if (this.dragHandle === 'pen' && this._penObj) {
      this._penObj.points.push({ x, y });
      this.render();
      return;
    }

    if (this.dragHandle === 'create') {
      // Live preview of object being created
      this.render();
      const oc = this.overlayCtx;
      oc.strokeStyle = this.color;
      oc.lineWidth = this.lineWidth;
      oc.setLineDash([4, 4]);
      if (this.creating === 'arrow') {
        oc.beginPath();
        oc.moveTo(this.dragStartX, this.dragStartY);
        oc.lineTo(x, y);
        oc.stroke();
      } else {
        oc.strokeRect(this.dragStartX, this.dragStartY, dx, dy);
      }
      oc.setLineDash([]);
      return;
    }

    if (!this.selected) return;
    const obj = this.selected;

    if (this.dragHandle === 'move') {
      // Group move: move all selected objects
      const origins = this._groupOrigPositions || [{ obj, x: this.origX, y: this.origY, x2: obj.x2, y2: obj.y2 }];
      for (const orig of origins) {
        const o = orig.obj;
        if (o.type === 'arrow') {
          const adx = (orig.x2 || 0) - orig.x;
          const ady = (orig.y2 || 0) - orig.y;
          o.x = orig.x + dx;
          o.y = orig.y + dy;
          o.x2 = o.x + adx;
          o.y2 = o.y + ady;
        } else if ((o.type === 'pen' || o.type === 'highlighter') && o.points?.length) {
          const mx = (orig.x + dx) - o.x;
          const my = (orig.y + dy) - o.y;
          for (const p of o.points) { p.x += mx; p.y += my; }
          o.x = orig.x + dx;
          o.y = orig.y + dy;
        } else {
          o.x = orig.x + dx;
          o.y = orig.y + dy;
        }
      }
      // Apply snap guides for primary object
      const snaps = this._checkSnap(obj, obj.x, obj.y);
      const snapDx = (snaps.x !== null ? snaps.x - obj.x : 0);
      const snapDy = (snaps.y !== null ? snaps.y - obj.y : 0);
      if (snapDx || snapDy) {
        for (const orig of origins) {
          const o = orig.obj;
          if (o.type === 'arrow') {
            o.x += snapDx; o.y += snapDy; o.x2 += snapDx; o.y2 += snapDy;
          } else if ((o.type === 'pen' || o.type === 'highlighter') && o.points?.length) {
            for (const p of o.points) { p.x += snapDx; p.y += snapDy; }
            o.x += snapDx; o.y += snapDy;
          } else {
            o.x += snapDx; o.y += snapDy;
          }
        }
      }
      this._snapLines = snaps.lines;
    } else if (obj.type === 'arrow') {
      if (this.dragHandle === 'start') { obj.x = x; obj.y = y; }
      else if (this.dragHandle === 'end') { obj.x2 = x; obj.y2 = y; }
    } else {
      // Resize handles
      if (this.dragHandle.includes('r')) { obj.w = Math.max(10, this.origW + dx); }
      if (this.dragHandle.includes('l')) { obj.x = this.origX + dx; obj.w = Math.max(10, this.origW - dx); }
      if (this.dragHandle.includes('b')) { obj.h = Math.max(10, this.origH + dy); }
      if (this.dragHandle.includes('t')) { obj.y = this.origY + dy; obj.h = Math.max(10, this.origH - dy); }
    }

    this.render();
  }

  _handleUp(e) {
    if (!this.dragging) return;
    const { x, y } = this._toCanvasCoords(e);

    // Finalize pen/highlighter stroke
    if (this.dragHandle === 'pen' && this._penObj) {
      if (this._penObj.points.length < 3) {
        this.objects.pop();
      } else {
        const bb = this._penObj._strokeBounds();
        this._penObj.x = bb.x; this._penObj.y = bb.y;
        this._penObj.w = bb.w; this._penObj.h = bb.h;
        this.select(this._penObj);
      }
      this._penObj = null;
      this.stopTool();
      // Update pointer button in ribbon
      document.getElementById('btn-ann-select')?.classList.add('active');
      document.querySelectorAll('[id^="btn-ann-"]:not(#btn-ann-select)').forEach(b => b.classList.remove('active'));
      this.dragging = false;
      this.dragHandle = null;
      this.render();
      return;
    }

    if (this.dragHandle === 'create') {
      const dx = x - this.dragStartX;
      const dy = y - this.dragStartY;
      const minSize = 5;

      if (Math.abs(dx) > minSize || Math.abs(dy) > minSize) {
        const rx = Math.min(this.dragStartX, x), ry = Math.min(this.dragStartY, y);
        const rw = Math.abs(dx), rh = Math.abs(dy);

        if (this.creating === 'rect') this.addRect(rx, ry, rw, rh);
        else if (this.creating === 'arrow') this.addArrow(this.dragStartX, this.dragStartY, x, y);
        else if (this.creating === 'redact') this.addRedact(rx, ry, rw, rh);
        else if (this.creating === 'mask') this.addMask(rx, ry, rw, rh, this.maskFilter);
      }
      this.stopTool();
      // Update pointer button in ribbon
      document.getElementById('btn-ann-select')?.classList.add('active');
      document.querySelectorAll('[id^="btn-ann-"]:not(#btn-ann-select)').forEach(b => b.classList.remove('active'));
    }

    this.dragging = false;
    this.dragHandle = null;
    this._snapLines = [];
    this.render();
  }

  _checkSnap(obj, nx, ny) {
    const snaps = { x: null, y: null, lines: [] };
    const threshold = 5;
    const cw = this.base.width, ch = this.base.height;
    const objCx = nx + obj.w / 2, objCy = ny + obj.h / 2;

    // Snap to canvas center
    if (Math.abs(objCx - cw / 2) < threshold) { snaps.x = cw / 2 - obj.w / 2; snaps.lines.push({ x1: cw/2, y1: 0, x2: cw/2, y2: ch }); }
    if (Math.abs(objCy - ch / 2) < threshold) { snaps.y = ch / 2 - obj.h / 2; snaps.lines.push({ x1: 0, y1: ch/2, x2: cw, y2: ch/2 }); }

    // Snap to other objects
    for (const other of this.objects) {
      if (other === obj || other.visible === false) continue;
      // Left edge to left/right edge of other
      if (Math.abs(nx - other.x) < threshold) { snaps.x = other.x; snaps.lines.push({ x1: other.x, y1: 0, x2: other.x, y2: ch }); }
      if (Math.abs(nx - (other.x + other.w)) < threshold) { snaps.x = other.x + other.w; snaps.lines.push({ x1: other.x + other.w, y1: 0, x2: other.x + other.w, y2: ch }); }
      // Right edge to left/right edge of other
      if (Math.abs(nx + obj.w - other.x) < threshold) { snaps.x = other.x - obj.w; snaps.lines.push({ x1: other.x, y1: 0, x2: other.x, y2: ch }); }
      if (Math.abs(nx + obj.w - (other.x + other.w)) < threshold) { snaps.x = other.x + other.w - obj.w; snaps.lines.push({ x1: other.x + other.w, y1: 0, x2: other.x + other.w, y2: ch }); }
      // Center X to center X
      if (Math.abs(objCx - (other.x + other.w / 2)) < threshold) { snaps.x = other.x + other.w / 2 - obj.w / 2; snaps.lines.push({ x1: other.x + other.w / 2, y1: 0, x2: other.x + other.w / 2, y2: ch }); }
      // Top edge to top/bottom edge of other
      if (Math.abs(ny - other.y) < threshold) { snaps.y = other.y; snaps.lines.push({ x1: 0, y1: other.y, x2: cw, y2: other.y }); }
      if (Math.abs(ny - (other.y + other.h)) < threshold) { snaps.y = other.y + other.h; snaps.lines.push({ x1: 0, y1: other.y + other.h, x2: cw, y2: other.y + other.h }); }
      // Bottom edge
      if (Math.abs(ny + obj.h - other.y) < threshold) { snaps.y = other.y - obj.h; snaps.lines.push({ x1: 0, y1: other.y, x2: cw, y2: other.y }); }
      if (Math.abs(ny + obj.h - (other.y + other.h)) < threshold) { snaps.y = other.y + other.h - obj.h; snaps.lines.push({ x1: 0, y1: other.y + other.h, x2: cw, y2: other.y + other.h }); }
      // Center Y to center Y
      if (Math.abs(objCy - (other.y + other.h / 2)) < threshold) { snaps.y = other.y + other.h / 2 - obj.h / 2; snaps.lines.push({ x1: 0, y1: other.y + other.h / 2, x2: cw, y2: other.y + other.h / 2 }); }
    }
    return snaps;
  }

  _handleDblClick(e) {
    const { x, y } = this._toCanvasCoords(e);
    for (let i = this.objects.length - 1; i >= 0; i--) {
      if ((this.objects[i].type === 'text' || this.objects[i].type === 'callout') && this.objects[i].containsPoint(x, y)) {
        this.select(this.objects[i]);
        this.objects[i].editing = true;
        this.render();
        return;
      }
    }
  }

  _handleKey(e) {
    // Text editing
    if (this.selected?.editing && (this.selected.type === 'text' || this.selected.type === 'callout')) {
      if (e.key === 'Escape') {
        this.selected.editing = false;
        if (!this.selected.text) this.deleteSelected();
        this.render();
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        this.selected.text = this.selected.text.slice(0, -1);
        this.render();
        return;
      }
      if (e.key === 'Enter') {
        this.selected.text += '\n';
        this.render();
        return;
      }
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        // Clear placeholder on first keystroke
        if (this.selected.text === 'Type here...' || this.selected.text === 'Speech...' || this.selected.text === 'Thinking...' ||
            this.selected.text === 'Info text' || this.selected.text === 'Warning text' || this.selected.text === 'Success!' ||
            this.selected.text === 'Error!' || this.selected.text === 'Step 1') {
          this.selected.text = '';
        }
        this.selected.text += e.key;
        this.render();
        return;
      }
      return;
    }

    // Delete selected object
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (this.selected) {
        e.preventDefault();
        this.deleteSelected();
        this.render();
      }
    }

    // Escape deselects
    if (e.key === 'Escape') {
      this.deselectAll();
      this.render();
    }
  }

  // Sync overlay pixel dimensions to match base canvas
  _syncOverlay() {
    if (this.overlay.width !== this.base.width) this.overlay.width = this.base.width;
    if (this.overlay.height !== this.base.height) this.overlay.height = this.base.height;
    // Match the canvas actual rendered size (clientWidth accounts for CSS)
    const w = this.base.clientWidth || this.base.width;
    const h = this.base.clientHeight || this.base.height;
    this.overlay.style.position = 'absolute';
    this.overlay.style.top = '0';
    this.overlay.style.left = '0';
    this.overlay.style.width = w + 'px';
    this.overlay.style.height = h + 'px';
  }

  // --- Rendering ---
  render() {
    if (!this.active) return;
    this._syncOverlay();
    const ctx = this.overlayCtx;
    ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);

    // Draw all objects (skip invisible ones, but draw selection if selected)
    for (const obj of this.objects) {
      if (obj.visible !== false) obj.draw(ctx);
      obj.drawSelection(ctx);
    }

    // Draw snap guide lines
    if (this._snapLines && this._snapLines.length) {
      ctx.save();
      ctx.strokeStyle = '#F4C430';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      for (const ln of this._snapLines) {
        ctx.beginPath();
        ctx.moveTo(ln.x1, ln.y1);
        ctx.lineTo(ln.x2, ln.y2);
        ctx.stroke();
      }
      ctx.setLineDash([]);
      ctx.restore();
    }
  }

  // --- Flatten: burn all objects into the base canvas ---
  flatten() {
    this.deselectAll();
    for (const obj of this.objects) {
      if (obj.visible === false) continue;
      if (obj.type === 'redact') {
        this._pixelateRegion(obj.x, obj.y, obj.w, obj.h, obj.redactStrength);
        // Draw solid black on top for full concealment
        this.baseCtx.fillStyle = '#000000';
        this.baseCtx.fillRect(Math.round(obj.x), Math.round(obj.y), Math.round(obj.w), Math.round(obj.h));
      } else if (obj.type === 'mask') {
        this._applyMaskFilter(obj);
      } else {
        obj.draw(this.baseCtx);
      }
    }
    this.objects = [];
    this.render();
    if (this.saveState) this.saveState();
  }

  // Apply a filter only within the mask region
  _applyMaskFilter(obj) {
    const rx = Math.max(0, Math.round(obj.x));
    const ry = Math.max(0, Math.round(obj.y));
    const rw = Math.min(Math.round(obj.w), this.base.width - rx);
    const rh = Math.min(Math.round(obj.h), this.base.height - ry);
    if (rw < 2 || rh < 2) return;

    // Extract region, apply to temp canvas with filter, put back
    const imgData = this.baseCtx.getImageData(rx, ry, rw, rh);
    const tmp = document.createElement('canvas'); tmp.width = rw; tmp.height = rh;
    const tc = tmp.getContext('2d');
    tc.putImageData(imgData, 0, 0);

    const out = document.createElement('canvas'); out.width = rw; out.height = rh;
    const oc = out.getContext('2d');

    const filterMap = {
      'blur': 'blur(5px)', 'sharpen': 'contrast(150%) brightness(110%)',
      'grayscale': 'grayscale(100%)', 'sepia': 'sepia(100%)',
      'invert': 'invert(100%)', 'brightness': `brightness(${obj.filterValue || 150}%)`
    };

    oc.filter = filterMap[obj.filter] || 'blur(5px)';
    oc.drawImage(tmp, 0, 0);
    oc.filter = 'none';

    this.baseCtx.drawImage(out, rx, ry);
  }

  _pixelateRegion(rx, ry, rw, rh, strength) {
    rx = Math.max(0, Math.round(rx));
    ry = Math.max(0, Math.round(ry));
    rw = Math.min(Math.round(rw), this.base.width - rx);
    rh = Math.min(Math.round(rh), this.base.height - ry);
    if (rw < 2 || rh < 2) return;

    // strength 1=light(big blocks), 2=medium, 3=heavy(tiny blocks, unreadable)
    const s = strength || 3;
    const blockSize = Math.max(2, Math.floor(Math.min(rw, rh) / (s * 8)));
    const imgData = this.baseCtx.getImageData(rx, ry, rw, rh);
    const data = imgData.data;

    for (let by = 0; by < rh; by += blockSize) {
      for (let bx = 0; bx < rw; bx += blockSize) {
        let r = 0, g = 0, b = 0, count = 0;
        for (let py = by; py < Math.min(by + blockSize, rh); py++) {
          for (let px = bx; px < Math.min(bx + blockSize, rw); px++) {
            const i = (py * rw + px) * 4;
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
          }
        }
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
        for (let py = by; py < Math.min(by + blockSize, rh); py++) {
          for (let px = bx; px < Math.min(bx + blockSize, rw); px++) {
            const i = (py * rw + px) * 4;
            data[i] = r; data[i + 1] = g; data[i + 2] = b;
          }
        }
      }
    }
    this.baseCtx.putImageData(imgData, rx, ry);
  }

  // --- Check if there are unflatted objects ---
  hasObjects() {
    return this.objects.length > 0;
  }

  // --- Export annotations as SVG string ---
  exportAsSVG(width, height) {
    const w = width || this.base.width;
    const h = height || this.base.height;
    let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">`;

    for (const obj of this.objects) {
      const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      if (obj.type === 'rect') {
        if (obj.filled) {
          svg += `<rect x="${obj.x}" y="${obj.y}" width="${obj.w}" height="${obj.h}" fill="${obj.color}" opacity="${obj.opacity}"/>`;
        } else {
          svg += `<rect x="${obj.x}" y="${obj.y}" width="${obj.w}" height="${obj.h}" fill="none" stroke="${obj.color}" stroke-width="${obj.lineWidth}" opacity="${obj.opacity}"/>`;
        }
      } else if (obj.type === 'arrow') {
        const headLen = 12;
        const angle = Math.atan2(obj.y2 - obj.y, obj.x2 - obj.x);
        const hx1 = obj.x2 - headLen * Math.cos(angle - Math.PI / 6);
        const hy1 = obj.y2 - headLen * Math.sin(angle - Math.PI / 6);
        const hx2 = obj.x2 - headLen * Math.cos(angle + Math.PI / 6);
        const hy2 = obj.y2 - headLen * Math.sin(angle + Math.PI / 6);
        svg += `<line x1="${obj.x}" y1="${obj.y}" x2="${obj.x2}" y2="${obj.y2}" stroke="${obj.color}" stroke-width="${obj.lineWidth}" opacity="${obj.opacity}"/>`;
        svg += `<polygon points="${obj.x2},${obj.y2} ${hx1},${hy1} ${hx2},${hy2}" fill="${obj.color}" opacity="${obj.opacity}"/>`;
      } else if (obj.type === 'text') {
        const lines = (obj.text || '').split('\n');
        const lineH = obj.fontSize * 1.3;
        lines.forEach((line, i) => {
          svg += `<text x="${obj.x + 4}" y="${obj.y + i * lineH + obj.fontSize}" fill="${obj.color}" font-size="${obj.fontSize}px" font-family="${esc(obj.fontFamily)}" font-weight="${obj.fontWeight}" opacity="${obj.opacity}">${esc(line)}</text>`;
        });
      } else if (obj.type === 'pen' || obj.type === 'highlighter') {
        if (obj.points.length >= 2) {
          let d = `M${obj.points[0].x},${obj.points[0].y}`;
          for (let i = 1; i < obj.points.length; i++) d += `L${obj.points[i].x},${obj.points[i].y}`;
          const sw = obj.type === 'highlighter' ? Math.max(obj.lineWidth * 4, 16) : obj.lineWidth;
          const op = obj.type === 'highlighter' ? 0.4 : obj.opacity;
          svg += `<path d="${d}" fill="none" stroke="${obj.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>`;
        }
      } else if (obj.type === 'redact') {
        svg += `<rect x="${obj.x}" y="${obj.y}" width="${obj.w}" height="${obj.h}" fill="#000000"/>`;
      }
    }

    svg += '</svg>';
    return svg;
  }
}

// Shared rounded rect helper for image objects
function _imgRoundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
