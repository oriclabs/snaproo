// Snaproo — Guided Tour System
// Shared engine. Each tool defines its own step array.
//
// Usage:
//   const tour = new GuidedTour(steps);
//   tour.start();
//
// Steps: [{ target: '#selector', title: 'Title', text: 'Description' }, ...]
// target: CSS selector for the element to highlight
// title: bold heading
// text: 1-2 sentence description

class GuidedTour {
  constructor(steps) {
    this.steps = steps || [];
    this.current = 0;
    this.overlay = null;
    this.tooltip = null;
    this.active = false;
  }

  start() {
    if (this.active || !this.steps.length) return;
    this.active = true;
    this.current = 0;
    this._createOverlay();
    this._showStep();
  }

  stop() {
    this.active = false;
    if (this.overlay) { this.overlay.remove(); this.overlay = null; }
    if (this.tooltip) { this.tooltip.remove(); this.tooltip = null; }
    // Remove spotlight from any element
    document.querySelectorAll('._tour-spotlight').forEach(el => {
      el.classList.remove('_tour-spotlight');
      el.style.removeProperty('z-index');
      el.style.removeProperty('position');
      el.style.removeProperty('box-shadow');
    });
    if (this._keyHandler) { document.removeEventListener('keydown', this._keyHandler); this._keyHandler = null; }
  }

  next() {
    if (this.current < this.steps.length - 1) { this.current++; this._showStep(); }
    else { this.stop(); }
  }

  prev() {
    if (this.current > 0) { this.current--; this._showStep(); }
  }

  _createOverlay() {
    // Semi-transparent backdrop
    this.overlay = document.createElement('div');
    this.overlay.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,0.6);transition:opacity 0.2s;';
    this.overlay.addEventListener('click', () => this.stop());
    document.body.appendChild(this.overlay);

    // Tooltip container
    this.tooltip = document.createElement('div');
    this.tooltip.style.cssText = 'position:fixed;z-index:10001;background:var(--slate-900,#0f172a);border:1px solid var(--saffron-400,#F4C430);border-radius:10px;padding:14px 18px;max-width:320px;box-shadow:0 12px 40px rgba(0,0,0,0.5);font-family:Inter,system-ui,sans-serif;';
    document.body.appendChild(this.tooltip);

    // Keyboard navigation
    this._keyHandler = (e) => {
      if (e.key === 'Escape') this.stop();
      if (e.key === 'ArrowRight' || e.key === 'Enter') this.next();
      if (e.key === 'ArrowLeft') this.prev();
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  _showStep() {
    if (!this.active || !this.tooltip) return;
    const step = this.steps[this.current];

    // Remove previous spotlight
    document.querySelectorAll('._tour-spotlight').forEach(el => {
      el.classList.remove('_tour-spotlight');
      el.style.removeProperty('z-index');
      el.style.removeProperty('position');
      el.style.removeProperty('box-shadow');
    });

    // Highlight target element (fall back to parent if target is hidden/zero-size)
    let target = step.target ? document.querySelector(step.target) : null;
    if (target) {
      const rect = target.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0 && target.parentElement) target = target.parentElement;
    }
    if (target) {
      target.classList.add('_tour-spotlight');
      target.style.zIndex = '9999';
      target.style.position = 'relative';
      target.style.boxShadow = '0 0 0 4px var(--saffron-400, #F4C430), 0 0 20px rgba(244,196,48,0.3)';
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    // Build tooltip content
    const total = this.steps.length;
    const num = this.current + 1;
    this.tooltip.innerHTML = `
      <div style="font-size:0.625rem;color:var(--slate-500,#64748b);margin-bottom:4px;">Step ${num} of ${total}</div>
      <div style="font-size:0.875rem;font-weight:700;color:var(--saffron-400,#F4C430);margin-bottom:6px;">${step.title || ''}</div>
      <div style="font-size:0.8125rem;color:var(--slate-300,#cbd5e1);line-height:1.5;margin-bottom:12px;">${step.text || ''}</div>
      <div style="display:flex;gap:6px;justify-content:space-between;align-items:center;">
        <button id="_tour-skip" style="background:none;border:none;color:var(--slate-500,#64748b);font-size:0.6875rem;cursor:pointer;padding:4px 8px;">Skip tour</button>
        <div style="display:flex;gap:6px;">
          ${num > 1 ? '<button id="_tour-prev" style="background:var(--slate-800,#1e293b);color:var(--slate-300,#cbd5e1);border:1px solid var(--slate-700,#334155);border-radius:6px;padding:5px 14px;font-size:0.75rem;cursor:pointer;">Prev</button>' : ''}
          <button id="_tour-next" style="background:var(--saffron-400,#F4C430);color:#1e293b;border:none;border-radius:6px;padding:5px 14px;font-size:0.75rem;font-weight:600;cursor:pointer;">${num === total ? 'Finish' : 'Next'}</button>
        </div>
      </div>
      <div style="display:flex;gap:3px;justify-content:center;margin-top:8px;">
        ${this.steps.map((_, i) => `<div style="width:${i === this.current ? '16px' : '6px'};height:4px;border-radius:2px;background:${i === this.current ? 'var(--saffron-400,#F4C430)' : 'var(--slate-700,#334155)'};transition:width 0.2s;"></div>`).join('')}
      </div>
    `;

    // Wire buttons
    this.tooltip.querySelector('#_tour-skip')?.addEventListener('click', () => this.stop());
    this.tooltip.querySelector('#_tour-prev')?.addEventListener('click', () => this.prev());
    this.tooltip.querySelector('#_tour-next')?.addEventListener('click', () => this.next());

    // Position tooltip near target
    this._positionTooltip(target);
  }

  _positionTooltip(target) {
    if (!this.tooltip) return;
    const tip = this.tooltip;

    if (!target) {
      // Center on screen
      tip.style.top = '50%'; tip.style.left = '50%'; tip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    tip.style.transform = '';
    const tr = target.getBoundingClientRect();
    const tw = tip.offsetWidth || 320;
    const th = tip.offsetHeight || 200;
    const pad = 12;

    // Try below target
    if (tr.bottom + pad + th < window.innerHeight) {
      tip.style.top = (tr.bottom + pad) + 'px';
      tip.style.left = Math.max(pad, Math.min(tr.left, window.innerWidth - tw - pad)) + 'px';
    }
    // Try above
    else if (tr.top - pad - th > 0) {
      tip.style.top = (tr.top - pad - th) + 'px';
      tip.style.left = Math.max(pad, Math.min(tr.left, window.innerWidth - tw - pad)) + 'px';
    }
    // Try right
    else if (tr.right + pad + tw < window.innerWidth) {
      tip.style.top = Math.max(pad, tr.top) + 'px';
      tip.style.left = (tr.right + pad) + 'px';
    }
    // Fallback: left
    else {
      tip.style.top = Math.max(pad, tr.top) + 'px';
      tip.style.left = Math.max(pad, tr.left - tw - pad) + 'px';
    }
  }
}

// --- Per-tool step definitions ---
const tourSteps = {
  edit: [
    { target: '#edit-dropzone', title: 'Drop Zone', text: 'Drop an image file here, click to browse, or paste from clipboard (Ctrl+V).' },
    { target: '#edit-ribbon', title: 'Ribbon Toolbar', text: 'All editing tools organized in groups. Disabled until you load an image.' },
    { target: '#btn-undo', title: 'Undo / Redo', text: 'Ctrl+Z to undo, Ctrl+Y to redo. Every operation is non-destructive — your original is always preserved.' },
    { target: '#btn-crop-free', title: 'Crop & Transform', text: 'Crop (free or ratio), rotate, flip. Smart crop auto-detects the subject.' },
    { target: '#adj-brightness', title: 'Adjustments', text: 'Brightness, Contrast, Saturation, Hue — drag sliders for live preview.' },
    { target: '#btn-ann-rect', title: 'Drawing Tools', text: 'Rectangle, arrow, text, freehand pen, highlighter. Objects are selectable and movable.' },
    { target: '#export-format', title: 'Export', text: 'PNG, JPEG, WebP, BMP, or traced SVG. Quality slider for lossy formats.' },
    { target: '#btn-history', title: 'History Panel', text: 'Press H to see all operations. Click any step to revert to that state.' },
  ],
  collage: [
    { target: '#collage-drop', title: 'Add Images', text: 'Drop images to start. Each becomes a freeform object you can drag, resize, and layer.' },
    { target: '#btn-arrange-grid', title: 'Quick Arrange', text: 'Grid, Row, Column, Stack — auto-position images. Then adjust manually.' },
    { target: '#btn-coll-rot-left', title: 'Transform', text: 'Rotate, flip, reorder layers. Drag the circle handle above an image for free rotation.' },
    { target: '#coll-item-border', title: 'Per-Image Effects', text: 'Border, shadow, corner radius, filter, opacity, blend mode — applied to the selected image.' },
    { target: '#coll-edge-left', title: 'Edge Fades', text: 'Independent fade on each edge (L/R/T/B). Use to blend images at seams.' },
    { target: '#btn-coll-join', title: 'Join Blend', text: 'Select 2 images, click Join. Auto-detects which edges meet and applies fades.' },
    { target: '#btn-align-left', title: 'Alignment', text: 'Align edges, centers, distribute spacing. Select 2+ images first.' },
    { target: '#btn-collage-export', title: 'Export', text: 'PNG, JPEG, WebP. Trim to content crops empty canvas. Save/Load preserves your project.' },
  ],
  batch: [
    { target: '#batch-drop', title: 'Drop Images', text: 'Drop multiple images for batch processing. Click thumbnails to preview, checkboxes to select.' },
    { target: '#batch-w', title: 'Resize', text: 'Set target width/height. Lock ratio preserves proportions. Multi-size exports at multiple widths.' },
    { target: '#btn-batch-import-pipeline', title: 'Import Pipeline', text: 'Go to Edit mode first, load an image, apply operations (filter, adjust, rotate, etc.). Then come back here and click Import Edit to apply those same operations to all batch images.' },
    { target: '#batch-wm-mode', title: 'Watermark', text: '5 modes: text, diagonal, grid, stamp, image logo. Position, color, font, opacity.' },
    { target: '#batch-rename', title: 'Smart Rename', text: 'Pattern-based: {name}, {index}, {date}, {w}, {h}. Click token buttons to insert.' },
    { target: '#btn-batch-preview', title: 'Preview', text: 'See the result before processing all. Click any thumbnail to preview that specific image.' },
    { target: '#batch-zip-label', title: 'Zip Export', text: 'Bundle all processed files into a single ZIP download. No more 50 individual save dialogs.' },
    { target: '#btn-batch-save-preset', title: 'Presets', text: 'Save all current settings as a named preset. Load it later for repeatable workflows.' },
  ],
  convert: [
    { target: '#convert-drop', title: 'Drop Images', text: 'Drop image(s) to convert between formats. Batch supported.' },
    { target: '.format-btn', title: 'Format Selection', text: 'Click the target format: PNG, JPEG, WebP, AVIF, BMP, ICO, TIFF.' },
    { target: '#convert-quality', title: 'Quality', text: 'Quality slider for lossy formats (JPEG, WebP). Higher = larger file, better quality.' },
    { target: '#btn-convert-go', title: 'Convert', text: 'Click to convert and download. Batch mode processes all dropped images.' },
  ],
  generate: [
    { target: '#gen-w', title: 'Canvas Size', text: 'Set width and height for the generated image.' },
    { target: '#btn-gen-gradient', title: 'Generators', text: 'Gradient, pattern, placeholder, social banner, avatar, noise, favicon, color swatch.' },
    { target: '#btn-gen-export', title: 'Export', text: 'Download the generated image as PNG, JPEG, or WebP.' },
  ],
  info: [
    { target: '#info-drop', title: 'Drop Image', text: 'Drop any image to inspect its metadata — EXIF, DPI, JPEG structure, hash.' },
    { target: '#btn-copy-base64', title: 'Copy Data URI', text: 'Copy the image as a base64 data URI for embedding in HTML/CSS.' },
  ],
  qr: [
    { target: '#qr-text', title: 'Enter Content', text: 'Type a URL, text, or structured data. QR generates live as you type — no need to click Generate.' },
    { target: '[data-qr-preset="url"]', title: 'Quick Presets', text: 'Click a preset to fill in a template: URL, WiFi password, email, phone, vCard, SMS, location, or calendar event. Edit the values to customize.' },
    { target: '#qr-style', title: 'Style & Quality', text: 'Choose dot shape (square, rounded, dots), error correction level, pixel size, and margin. Higher error correction = more scannable even if damaged.' },
    { target: '#qr-fg', title: 'Colors & Label', text: 'Customize foreground and background colors. Add a label like "Scan Me" below the QR code.' },
    { target: '#btn-qr-logo', title: 'Center Logo', text: 'Upload a logo or icon to embed in the center of the QR. Error correction auto-switches to High for reliable scanning.' },
    { target: '#btn-qr-generate', title: 'Generate & Bulk', text: 'Generate manually, or use Bulk to paste multiple URLs and create a QR for each — downloaded as a ZIP.' },
    { target: '#btn-qr-copy', title: 'Export Options', text: 'Copy image to clipboard, copy the raw text, download as PNG or SVG, export in 4 sizes as ZIP, or save to your Library.' },
    { target: 'details', title: 'Read QR', text: 'Expand this section to drop an image containing a QR code and decode it.' },
  ],
  svg: [
    { target: '#svg-drop', title: 'SVG Inspect', text: 'Drop an SVG file to view source, info, and export as raster image.' },
    { target: '#trace-drop', title: 'Image Trace', text: 'Drop a raster image to vectorize it into SVG paths. Multiple style presets.' },
  ],
  compare: [
    { target: '#compare-drop-a', title: 'Image A', text: 'Drop the first image (before).' },
    { target: '#compare-drop-b', title: 'Image B', text: 'Drop the second image (after).' },
    { target: '#btn-compare-diff', title: 'Diff', text: 'Highlights pixel differences in red.' },
    { target: '#btn-compare-slider', title: 'Slider', text: 'Drag to reveal before/after side by side.' },
  ],
  colors: [
    { target: '#colors-drop', title: 'Drop Image', text: 'Drop an image and click any pixel to pick its color.' },
    { target: '#palette-count', title: 'Palette', text: 'Dominant colors extracted automatically. Adjust count with the slider.' },
  ],
  social: [
    { target: '#social-dropzone', title: 'Drop Image', text: 'Drop a source image to resize for social media platforms.' },
    { target: '#social-platform', title: 'Platform Preset', text: 'Choose a social platform and size — Twitter, Instagram, Facebook, LinkedIn, YouTube, Pinterest, TikTok, Discord.' },
    { target: '#social-fit', title: 'Fit Mode', text: 'Cover fills the frame and crops. Contain fits inside with a background color. Stretch distorts to fill.' },
    { target: '#social-text', title: 'Text Overlay', text: 'Add optional text with color and position (top, center, bottom). Expand the Text group to access.' },
    { target: '#btn-social-generate', title: 'Generate', text: 'Renders the image at the selected platform dimensions with your chosen fit and text.' },
    { target: '#btn-social-download', title: 'Export', text: 'Download the result as PNG, or copy it to the clipboard.' },
  ],
  watermark: [
    { target: '#wm-dropzone', title: 'Load Images', text: 'Drop images or click to browse. You can add multiple images for batch watermarking.' },
    { target: '#wm-type-text', title: 'Watermark Type', text: 'Choose Text or Logo watermark.' },
    { target: '#wm-pos-grid', title: 'Position', text: 'Click where to place the watermark on your images.' },
    { target: '#wm-opacity', title: 'Opacity & Size', text: 'Adjust opacity, size, and rotation of the watermark.' },
    { target: '#wm-mode', title: 'Tiling Mode', text: 'Single places one watermark. Tile repeats in a grid. Diagonal creates angled repeating text.' },
    { target: '#btn-wm-apply', title: 'Apply & Export', text: 'Preview first, then Apply All to batch process. Download as ZIP.' },
  ],
  callout: [
    { target: '.callout-tpl', title: 'Templates', text: 'Quick presets: speech bubbles, info boxes, warnings, numbered steps.' },
    { target: '#co-shape', title: 'Customize', text: 'Choose shape, tail direction, icon, colors, and font.' },
    { target: '#btn-co-add', title: 'Add & Export', text: 'Add callout to canvas. Export or save to library when done.' },
  ],
};

// Start tour for current mode
function startTour(mode) {
  const steps = tourSteps[mode];
  if (!steps || !steps.length) return;
  const tour = new GuidedTour(steps);
  tour.start();
}
