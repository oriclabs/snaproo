// Snaproo Editor - Home screen + tool mode initialization
// Navigation, global drop, workspace, help system, library picker

// ── Help System: per-tool popovers + shortcuts overlay ──

const toolHelp = {
  edit: {
    Size: ['W/H: resize image (non-destructive, from original)', 'px/% toggle, lock ratio, Apply or Enter', 'Undo/Redo works on all operations'],
    Transform: ['Crop: drag to select region, Apply to confirm', 'Auto: smart content-aware crop', 'Rotate/Flip: 90° rotation, horizontal/vertical flip'],
    Adjust: ['B/C/S/H: brightness, contrast, saturation, hue', 'Sliders are live — drag to preview', 'Reset button reverts all adjustments'],
    Filters: ['One-click filters: B&W, Sepia, Invert, Blur, Sharpen', 'Filters stack — apply multiple in sequence', 'Undo removes the last filter applied'],
    Draw: ['Rect, Arrow, Text, Pen, Highlighter, Redact', 'Objects are selectable, movable, resizable', 'Click to select, drag handles to resize, Delete to remove', 'Fill checkbox: solid fill for rectangles'],
    Export: ['PNG (lossless), JPEG/WebP (quality slider), BMP, SVG (traced)', 'SVG export vectorizes the image via tracer', 'Ctrl+S to quick-export'],
    View: ['R: toggle ruler, G: toggle grid, C: toggle center crosshair', 'Rulers sit outside the image — no pixels hidden', 'Grid auto-adjusts spacing based on image size'],
  },
  convert: { Convert: ['Drop image(s) for batch conversion', 'Select format, optional resize, strip metadata', 'Quality slider for JPEG/WebP'] },
  generate: { Generate: ['Set W/H, then use any generator', 'Gradient, Pattern, Placeholder, Social Banner, Avatar, Noise, Favicon, Swatch', 'Export as PNG/JPEG/WebP'] },
  collage: {
    Canvas: ['W/H: set canvas dimensions in pixels', 'Background: solid color or 2-color gradient', 'Apply: resize canvas and redraw background'],
    Arrange: ['+ Add: drop or click to add images to canvas', 'Grid/Row/Col/Stack: auto-arrange all images', 'Images are freely draggable and resizable after arrange', 'Clear: remove all images from canvas'],
    Selected: ['Click an image to select, then adjust properties', 'Drag handles to resize. Hold Shift = lock aspect ratio', 'Border: color + thickness, Shadow: color + blur', 'R: corner radius, Filter: grayscale/sepia/etc.', 'Op: opacity, Blend: 16 blend modes', 'Edge: Feather/Vignette/Edge Blur/Fade (directional) + strength slider'],
    Layers: ['Front/Back: change stacking order', 'Up/Down: move one step forward/backward', 'Delete: remove selected (or all multi-selected)', 'Group (Ctrl+G): merge selected into one object', 'Ungroup (Ctrl+Shift+G): split group back to parts'],
    Align: ['Align L/R/T/B: align edges of 2+ selected images', 'Center H/V: align centers of selected images', 'Distribute H/V: equal spacing between 3+ images', 'Canvas H/V: center selection on the canvas'],
    Export: ['Export: full canvas as-is', 'Trim to content: crops to image bounds + 10px padding', 'PNG (lossless), JPEG, WebP'],
  },
  store: { Store: ['Drop a 1024x1024 source icon', 'Generates all app store sizes (Play, Apple, Chrome, Edge, Firefox, MS)', 'Export All downloads as individual PNGs'] },
  info: { Info: ['Drop image to inspect EXIF, DPI, JPEG structure, hash', 'Copy Data URI for embedding', 'All analysis is offline — no data sent anywhere'] },
  qr: { QR: ['Type content, select preset (URL, WiFi, vCard, etc.)', 'Customize size, margin, colors, error correction', 'Export as PNG or SVG, or copy to clipboard', 'Drop an image to read/decode QR codes'] },
  colors: { Colors: ['Drop image, click any pixel to pick color', 'Dominant palette extracted automatically', 'Adjust palette count with slider'] },
  svg: { SVG: ['Drop SVG to inspect source, export as raster', 'Drop image to trace into SVG (vectorize)', 'Trace presets: Logo, Sketch, Photo, Artistic, etc.', 'Grid overlay to check trace accuracy'] },
  compare: { Compare: ['Drop two images (A and B)', 'Diff: highlights pixel differences in red', 'Slider: drag to compare before/after', 'Center guides toggle for alignment check'] },
  batch: { Batch: ['Drop multiple images, apply same operations to all', 'Resize, filter, watermark, format conversion', 'Click thumbnails to remove, + to add more', 'Process All downloads everything to snaproo/batch/'] },
};

function showHelpPopover(btn, mode, group) {
  // Close any existing popover
  $$('.help-popover').forEach(p => p.remove());

  const tips = toolHelp[mode]?.[group];
  if (!tips) return;

  const pop = document.createElement('div');
  pop.className = 'help-popover';
  pop.innerHTML = `<div class="help-popover-title">${group}</div><ul>${tips.map(t => `<li>${t}</li>`).join('')}</ul>`;

  // Position below the button
  const rect = btn.getBoundingClientRect();
  pop.style.position = 'fixed';
  pop.style.top = (rect.bottom + 6) + 'px';
  pop.style.left = Math.max(8, rect.left - 80) + 'px';
  document.body.appendChild(pop);

  // Close on click outside or Escape
  function close(e) {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    pop.remove();
    document.removeEventListener('mousedown', close);
    document.removeEventListener('keydown', close);
  }
  setTimeout(() => {
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
  }, 50);
}

function showShortcutsOverlay() {
  // Remove existing
  $$('.shortcuts-overlay').forEach(o => o.remove());

  const shortcuts = [
    ['General', [
      ['Undo', 'Ctrl+Z'], ['Redo', 'Ctrl+Y'], ['Export / Save', 'Ctrl+S'], ['Shortcuts', 'Ctrl+/'], ['Back to Home', 'Escape'],
    ]],
    ['Edit Mode', [
      ['Toggle Ruler', 'R'], ['Toggle Grid', 'G'], ['Toggle Center', 'C'],
    ]],
    ['Drawing', [
      ['Select object', 'Click'], ['Move object', 'Drag'], ['Delete object', 'Delete / Backspace'],
      ['Edit text', 'Double-click'], ['Finish text', 'Escape'],
    ]],
  ];

  const overlay = document.createElement('div');
  overlay.className = 'shortcuts-overlay';
  const panel = document.createElement('div');
  panel.className = 'shortcuts-panel';
  panel.innerHTML = '<h2>Keyboard Shortcuts</h2>' +
    shortcuts.map(([section, keys]) =>
      `<h3>${section}</h3>` + keys.map(([label, key]) =>
        `<div class="shortcut-row"><span>${label}</span><span class="shortcut-key">${key}</span></div>`
      ).join('')
    ).join('');
  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  function close(e) {
    if (e.type === 'keydown' && e.key !== 'Escape') return;
    if (e.type === 'mousedown' && panel.contains(e.target)) return;
    overlay.remove();
    document.removeEventListener('mousedown', close);
    document.removeEventListener('keydown', close);
  }
  setTimeout(() => {
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
  }, 50);
}

document.addEventListener('DOMContentLoaded', () => {
  // Notify side panel that editor is open/closed
  chrome.runtime.sendMessage({ action: 'editorOpened' }).catch(() => {});
  window.addEventListener('beforeunload', () => {
    chrome.runtime.sendMessage({ action: 'editorClosed' }).catch(() => {});
  });

  // Wrap all number inputs with custom +/- spinner (cross-browser)
  enhanceNumberInputs();

  // Delegated click-to-copy
  document.addEventListener('click', (e) => {
    if (e.target.classList?.contains('copyable')) {
      navigator.clipboard.writeText(e.target.textContent);
    }
    if (e.target.dataset?.copy) {
      navigator.clipboard.writeText(e.target.dataset.copy);
    }
  });

  // Shortcuts button
  $('btn-shortcuts')?.addEventListener('click', showShortcutsOverlay);

  // Help page — opens in new tab with current mode section
  $('btn-help-page')?.addEventListener('click', () => {
    const hash = currentMode || 'overview';
    chrome.tabs.create({ url: chrome.runtime.getURL(`help/help.html#${hash}`) });
  });

  // Guided tour
  $('btn-tour')?.addEventListener('click', () => {
    if (typeof startTour === 'function' && currentMode) startTour(currentMode);
    else if (typeof startTour === 'function') startTour('edit'); // default
  });

  // Inject ? help buttons into ribbon group labels
  // Add ? help indicator next to each ribbon group label
  $$('.ribbon-label').forEach(label => {
    const groupName = label.textContent.trim();
    const modeEl = label.closest('.mode-view');
    const modeId = modeEl?.id?.replace('mode-', '') || 'edit';
    if (!toolHelp[modeId]?.[groupName]) return;

    const q = document.createElement('span');
    q.textContent = '?';
    q.style.cssText = 'display:inline-flex;align-items:center;justify-content:center;width:11px;height:11px;border-radius:50%;font-size:0.4375rem;font-weight:700;color:var(--slate-500);border:1px solid var(--slate-700);cursor:help;margin-left:3px;transition:all 0.12s;vertical-align:middle;';
    q.addEventListener('mouseenter', () => { q.style.color = 'var(--saffron-400)'; q.style.borderColor = 'var(--saffron-400)'; });
    q.addEventListener('mouseleave', () => { q.style.color = 'var(--slate-600)'; q.style.borderColor = 'var(--slate-700)'; });
    q.addEventListener('click', (e) => { e.stopPropagation(); showHelpPopover(q, modeId, groupName); });

    label.appendChild(q);
  });

  // Also inject ? into tool-ribbon titles
  $$('.tool-ribbon .ribbon-title').forEach(title => {
    const groupName = title.textContent.trim();
    const modeEl = title.closest('.mode-view');
    const modeId = modeEl?.id?.replace('mode-', '') || '';
    // Map ribbon-title text to help keys
    const helpMap = { 'Info':'Info', 'Generate':'QR', 'Export':'QR', 'Compare':'Compare',
      'SVG Inspect':'SVG', 'Trace':'SVG', 'Eyedropper':'Colors', 'Palette':'Colors',
      'Source':'Store' };
    const helpKey = helpMap[groupName];
    const modeHelp = toolHelp[modeId];
    // Find first matching help section for this mode
    const sectionKey = modeHelp ? Object.keys(modeHelp)[0] : null;
    if (!sectionKey && !helpKey) return;
    const finalMode = helpKey ? Object.keys(toolHelp).find(m => toolHelp[m][helpKey]) : modeId;
    const finalKey = helpKey || sectionKey;
    if (!finalMode || !finalKey || !toolHelp[finalMode]?.[finalKey]) return;
    const btn = document.createElement('button');
    btn.className = 'help-btn';
    btn.textContent = '?';
    btn.title = `Help: ${finalKey}`;
    btn.addEventListener('click', (e) => { e.stopPropagation(); showHelpPopover(btn, finalMode, finalKey); });
    title.parentNode.insertBefore(btn, title.nextSibling);
  });

  // Collapsible ribbon groups — click label to toggle
  $$('.ribbon-label').forEach(label => {
    label.addEventListener('click', (e) => {
      if (e.target.classList?.contains('help-btn')) return; // don't toggle when clicking ? button
      const group = label.closest('.ribbon-group');
      if (group) group.classList.toggle('collapsed');
    });
  });

  // Collapse non-essential groups by default (Edit mode)
  const collapseByDefault = ['View'];
  $$('.ribbon-group .ribbon-label').forEach(label => {
    if (collapseByDefault.includes(label.textContent.trim())) {
      label.closest('.ribbon-group')?.classList.add('collapsed');
    }
  });

  // Ribbon customize dropdown — show/hide ribbon groups
  const rcBtn = $('btn-ribbon-customize');
  const rcDrop = $('ribbon-customize-dropdown');

  rcBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = rcDrop.style.display !== 'none';
    rcDrop.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) populateRibbonCustomize();
  });

  document.addEventListener('click', (e) => {
    if (rcDrop?.style.display !== 'none' && !rcDrop.contains(e.target) && e.target !== rcBtn) {
      rcDrop.style.display = 'none';
    }
  });

  function populateRibbonCustomize() {
    if (!rcDrop) return;
    // Get all ribbon groups from the currently active mode
    const activeMode = document.querySelector('.mode-view.active');
    if (!activeMode) { rcDrop.innerHTML = '<div style="padding:8px 12px;color:var(--slate-500);">Open a tool first</div>'; return; }

    const groups = activeMode.querySelectorAll('.ribbon-group .ribbon-label');
    if (!groups.length) { rcDrop.innerHTML = '<div style="padding:8px 12px;color:var(--slate-500);">No ribbon groups</div>'; return; }

    // Load saved prefs
    const modeId = activeMode.id || 'unknown';
    chrome.storage.sync.get({ ribbonPrefs: {} }, (r) => {
      const prefs = r.ribbonPrefs || {};
      const modePrefs = prefs[modeId] || {};

      rcDrop.innerHTML = '';
      // "Show All" button
      const showAll = document.createElement('div');
      showAll.style.cssText = 'padding:4px 12px;color:var(--saffron-400);cursor:pointer;font-weight:600;border-bottom:1px solid var(--slate-800);margin-bottom:2px;';
      showAll.textContent = 'Show All';
      showAll.addEventListener('click', () => {
        groups.forEach(label => {
          const group = label.closest('.ribbon-group');
          if (group) group.style.display = '';
        });
        // Clear prefs for this mode
        delete prefs[modeId];
        chrome.storage.sync.set({ ribbonPrefs: prefs });
        populateRibbonCustomize();
      });
      rcDrop.appendChild(showAll);

      groups.forEach(label => {
        const name = label.textContent.trim();
        const group = label.closest('.ribbon-group');
        if (!group || !name) return;

        const isHidden = modePrefs[name] === false;
        if (isHidden) group.style.display = 'none';

        const opt = document.createElement('div');
        opt.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 12px;cursor:pointer;transition:background 0.1s;';
        opt.addEventListener('mouseenter', () => { opt.style.background = 'var(--slate-800)'; });
        opt.addEventListener('mouseleave', () => { opt.style.background = ''; });

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = !isHidden;
        cb.style.cssText = 'accent-color:var(--saffron-400);cursor:pointer;';

        const lbl = document.createElement('span');
        lbl.textContent = name;
        lbl.style.cssText = 'color:var(--slate-300);cursor:pointer;';

        opt.appendChild(cb);
        opt.appendChild(lbl);
        rcDrop.appendChild(opt);

        const toggle = () => {
          cb.checked = !cb.checked;
          group.style.display = cb.checked ? '' : 'none';
          // Save pref
          if (!prefs[modeId]) prefs[modeId] = {};
          prefs[modeId][name] = cb.checked;
          chrome.storage.sync.set({ ribbonPrefs: prefs });
        };

        cb.addEventListener('change', () => {
          group.style.display = cb.checked ? '' : 'none';
          if (!prefs[modeId]) prefs[modeId] = {};
          prefs[modeId][name] = cb.checked;
          chrome.storage.sync.set({ ribbonPrefs: prefs });
        });
        opt.addEventListener('click', (e) => { if (e.target !== cb) toggle(); });
      });
    });
  }

  // Apply saved ribbon prefs when opening a mode (global for openMode)
  window.applyRibbonPrefs = function applyRibbonPrefs(modeEl) {
    if (!modeEl) return;
    chrome.storage.sync.get({ ribbonPrefs: {} }, (r) => {
      const prefs = r.ribbonPrefs?.[modeEl.id] || {};
      modeEl.querySelectorAll('.ribbon-group .ribbon-label').forEach(label => {
        const name = label.textContent.trim();
        const group = label.closest('.ribbon-group');
        if (group && prefs[name] === false) group.style.display = 'none';
      });
    });
  }

  initNavigation();
  initEdit();
  initConvert();
  initStore();
  initInfo();
  initQR();
  initColors();
  initSVG();
  initCompare();
  initBatch();
  initGlobalDrop();
  initGenerate();
  initCollage();
  initSocial();
  initWatermark();
  initCallout();
  initShowcase();
  initMeme();
  initCertificate();
  initGif();
  initLibraryManager();

  // Drop-to-replace on all single-image tool work areas
  // (Edit mode has its own in initEdit, Collage/Batch handle multi-image differently)
  const singleImageTools = [
    { selector: '#mode-convert .work-area', dropId: 'convert-drop', fileId: 'convert-file' },
    { selector: '#mode-info .work-area', dropId: 'info-drop', fileId: 'info-file' },
    { selector: '#mode-colors .work-area', dropId: 'colors-drop', fileId: 'colors-file' },
    { selector: '#mode-svg .work-area', dropId: 'svg-drop', fileId: 'svg-file' },
    { selector: '#mode-social .work-area', dropId: 'social-dropzone', fileId: 'social-file' },
    // QR read uses its own dropzone directly — no replace dialog needed
  ];
  singleImageTools.forEach(({ selector, dropId, fileId }) => {
    setupWorkAreaReplace(selector, (file) => {
      // Re-show dropzone and trigger the file input change
      const drop = document.getElementById(dropId);
      const input = document.getElementById(fileId);
      if (drop) drop.style.display = '';
      // Trigger the existing dropzone handler by dispatching a synthetic drop
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change'));
      }
    });
  });

  // Quick settings popover toggle
  $('btn-editor-settings').addEventListener('click', () => {
    const pop = $('settings-popover');
    pop.style.display = pop.style.display === 'none' ? 'block' : 'none';
  });

  // Close popover when clicking outside
  document.addEventListener('click', (e) => {
    const pop = $('settings-popover');
    if (pop.style.display !== 'none' && !pop.contains(e.target) && e.target.id !== 'btn-editor-settings' && !e.target.closest('#btn-editor-settings')) {
      pop.style.display = 'none';
    }
  });

  // Theme toggle
  $$('.qs-theme').forEach(btn => {
    btn.addEventListener('click', () => {
      chrome.storage.sync.set({ theme: btn.dataset.theme });
    });
  });

  // Default format
  $('qs-format')?.addEventListener('change', (e) => {
    chrome.storage.sync.set({ defaultFormat: e.target.value });
  });

  // Download folder
  $('qs-folder')?.addEventListener('change', (e) => {
    chrome.storage.sync.set({ downloadPrefix: e.target.value });
  });

  // Advanced settings opens in new tab
  $('qs-advanced')?.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
    $('settings-popover').style.display = 'none';
  });

  // Font family
  $('qs-font-family')?.addEventListener('change', (e) => {
    chrome.storage.sync.set({ fontFamily: e.target.value });
  });

  // Load saved settings into popover
  chrome.storage.sync.get({ defaultFormat: 'png', downloadPrefix: 'snaproo', fontSize: 100, fontFamily: 'jetbrains' }, (r) => {
    const fmtEl = $('qs-format'); if (fmtEl) fmtEl.value = r.defaultFormat;
    const folderEl = $('qs-folder'); if (folderEl) folderEl.value = r.downloadPrefix;
    const ffEl = $('qs-font-family'); if (ffEl) ffEl.value = r.fontFamily || 'system';
    applyFontSize(r.fontSize || 100);
  });

  // Font size A- / A+
  function applyFontSize(pct) {
    document.documentElement.style.fontSize = (pct / 100 * 16) + 'px';
    const label = $('qs-font-val');
    if (label) label.textContent = pct + '%';
  }
  $('qs-font-down')?.addEventListener('click', () => {
    chrome.storage.sync.get({ fontSize: 100 }, (r) => {
      const v = Math.max(70, (r.fontSize || 100) - 5);
      chrome.storage.sync.set({ fontSize: v });
      applyFontSize(v);
    });
  });
  $('qs-font-up')?.addEventListener('click', () => {
    chrome.storage.sync.get({ fontSize: 100 }, (r) => {
      const v = Math.min(150, (r.fontSize || 100) + 5);
      chrome.storage.sync.set({ fontSize: v });
      applyFontSize(v);
    });
  });

  // === Workspace Save / Load ===

  function collectWorkspace() {
    const ws = { version: 1, timestamp: Date.now(), name: 'Snaproo Workspace' };

    function val(id) {
      const el = document.getElementById(id);
      if (!el) return undefined;
      if (el.type === 'checkbox') return el.checked;
      if (el.type === 'color') return el.value;
      if (el.type === 'range') return +el.value;
      if (el.type === 'number') return +el.value;
      return el.value;
    }

    ws.qr = {
      text: val('qr-text'), ecc: val('qr-ecc'), style: val('qr-style'),
      px: val('qr-px'), margin: val('qr-margin'), fg: val('qr-fg'), bg: val('qr-bg'),
      label: val('qr-label'), gradient: val('qr-gradient'), fg2: val('qr-fg2'),
      compact: val('qr-compact'),
    };

    ws.edit = {
      annColor: val('ann-color'), annWidth: val('ann-width'),
      annFont: val('ann-font'), annFontsize: val('ann-fontsize'),
      annFill: val('ann-fill'), watermarkText: val('watermark-text'),
    };

    ws.social = {
      platform: val('social-platform'), fit: val('social-fit'),
      bgColor: val('social-bg-color'), text: val('social-text'),
      textColor: val('social-text-color'), textPos: val('social-text-pos'),
    };

    ws.watermark = {
      text: val('wm-text'), font: val('wm-font'), textColor: val('wm-text-color'),
      shadow: val('wm-shadow'), shadowColor: val('wm-shadow-color'),
      opacity: val('wm-opacity'), size: val('wm-size'),
      rotation: val('wm-rotation'), margin: val('wm-margin'),
      mode: val('wm-mode'), tileGap: val('wm-tile-gap'),
      position: document.querySelector('.wm-pos-btn.active')?.dataset.pos || 'br',
    };

    ws.convert = {
      format: document.querySelector('#convert-formats .format-btn.active')?.dataset.fmt || 'png',
      quality: val('convert-quality'),
    };

    ws.collage = {
      bg: val('coll-bg'), gap: val('coll-gap'), radius: val('coll-radius'),
    };

    ws.colors = {
      paletteCount: val('palette-count'),
    };

    ws.global = {
      defaultFormat: val('qs-format'),
      downloadPrefix: val('qs-folder'),
    };

    return ws;
  }

  function applyWorkspace(ws) {
    if (!ws || ws.version !== 1) return false;

    function set(id, value) {
      const el = document.getElementById(id);
      if (!el || value === undefined || value === null) return;
      if (el.type === 'checkbox') { el.checked = !!value; }
      else { el.value = value; }
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (ws.qr) {
      set('qr-text', ws.qr.text); set('qr-ecc', ws.qr.ecc);
      set('qr-style', ws.qr.style); set('qr-px', ws.qr.px);
      set('qr-margin', ws.qr.margin); set('qr-fg', ws.qr.fg);
      set('qr-bg', ws.qr.bg); set('qr-label', ws.qr.label);
      set('qr-gradient', ws.qr.gradient); set('qr-fg2', ws.qr.fg2);
      set('qr-compact', ws.qr.compact);
    }

    if (ws.edit) {
      set('ann-color', ws.edit.annColor); set('ann-width', ws.edit.annWidth);
      set('ann-font', ws.edit.annFont); set('ann-fontsize', ws.edit.annFontsize);
      set('ann-fill', ws.edit.annFill); set('watermark-text', ws.edit.watermarkText);
    }

    if (ws.social) {
      set('social-platform', ws.social.platform); set('social-fit', ws.social.fit);
      set('social-bg-color', ws.social.bgColor); set('social-text', ws.social.text);
      set('social-text-color', ws.social.textColor); set('social-text-pos', ws.social.textPos);
    }

    if (ws.watermark) {
      set('wm-text', ws.watermark.text); set('wm-font', ws.watermark.font);
      set('wm-text-color', ws.watermark.textColor); set('wm-shadow', ws.watermark.shadow);
      set('wm-shadow-color', ws.watermark.shadowColor); set('wm-opacity', ws.watermark.opacity);
      set('wm-size', ws.watermark.size); set('wm-rotation', ws.watermark.rotation);
      set('wm-margin', ws.watermark.margin); set('wm-mode', ws.watermark.mode);
      set('wm-tile-gap', ws.watermark.tileGap);
      if (ws.watermark.position) {
        $$('.wm-pos-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`.wm-pos-btn[data-pos="${ws.watermark.position}"]`)?.classList.add('active');
      }
    }

    if (ws.convert) {
      if (ws.convert.format) {
        $$('#convert-formats .format-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`#convert-formats .format-btn[data-fmt="${ws.convert.format}"]`)?.classList.add('active');
      }
      set('convert-quality', ws.convert.quality);
    }

    if (ws.collage) {
      set('coll-bg', ws.collage.bg); set('coll-gap', ws.collage.gap);
      set('coll-radius', ws.collage.radius);
    }

    if (ws.colors) {
      set('palette-count', ws.colors.paletteCount);
    }

    if (ws.global) {
      set('qs-format', ws.global.defaultFormat);
      set('qs-folder', ws.global.downloadPrefix);
    }

    return true;
  }

  // Save workspace to file
  $('btn-workspace-save')?.addEventListener('click', () => {
    const ws = collectWorkspace();
    const blob = new Blob([JSON.stringify(ws, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const timestamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = `snaproo-workspace-${timestamp}.json`; a.click();
    URL.revokeObjectURL(url);
    $('settings-popover').style.display = 'none';
  });

  // Load workspace from file
  $('btn-workspace-load')?.addEventListener('click', () => {
    $('workspace-file-input').click();
  });

  $('workspace-file-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const ws = JSON.parse(text);
      const ok = applyWorkspace(ws);
      if (ok) {
        await pixDialog.alert('Workspace Loaded', `Settings restored from "${file.name}".`);
      } else {
        await pixDialog.alert('Invalid Workspace', 'This file is not a valid Snaproo workspace.');
      }
    } catch {
      await pixDialog.alert('Error', 'Could not read workspace file.');
    }
    e.target.value = '';
    $('settings-popover').style.display = 'none';
  });

  // Auto-save workspace to chrome.storage every 30 seconds (debounced)
  let wsAutoSaveTimer = null;
  function scheduleWorkspaceAutoSave() {
    clearTimeout(wsAutoSaveTimer);
    wsAutoSaveTimer = setTimeout(() => {
      const ws = collectWorkspace();
      chrome.storage.local.set({ 'snaproo-last-workspace': ws }).catch(() => {});
    }, 30000);
  }

  // Load last workspace on startup
  chrome.storage.local.get('snaproo-last-workspace', (r) => {
    if (r['snaproo-last-workspace']) {
      applyWorkspace(r['snaproo-last-workspace']);
    }
  });

  // Wire auto-save to input/change events on the editor area
  document.querySelector('.editor')?.addEventListener('change', scheduleWorkspaceAutoSave);
  document.querySelector('.editor')?.addEventListener('input', scheduleWorkspaceAutoSave);

  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); editUndo(); }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) { e.preventDefault(); editRedo(); }
    if (e.ctrlKey && e.key === 's') { e.preventDefault(); if (currentMode === 'edit') editExport(); }
    if (e.ctrlKey && e.key === '/') { e.preventDefault(); showShortcutsOverlay(); }
    // Escape → back to home (only when not in an input and no modal open)
    if (e.key === 'Escape' && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      if (currentMode && $('library-manager')?.style.display !== 'flex') { e.preventDefault(); goHome(); }
    }
    // Guide toggles (only when not typing in an input)
    if (currentMode === 'edit' && !e.ctrlKey && !e.metaKey && !e.altKey && !['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) {
      if (e.key === 'r' || e.key === 'R') { $('btn-toggle-ruler')?.click(); }
      if (e.key === 'g' || e.key === 'G') { $('btn-toggle-grid')?.click(); }
      if (e.key === 'c' || e.key === 'C') { $('btn-toggle-center')?.click(); }
      if (e.key === 'h' || e.key === 'H') { $('btn-history')?.click(); }
    }
  });

  const params = new URLSearchParams(location.search);
  const mode = params.get('mode');
  if (mode) openMode(mode);

  // Check for region capture transfer
  if (params.get('fromRegion')) {
    chrome.storage.local.get('snaproo-region', (r) => {
      const data = r['snaproo-region'];
      if (!data?.dataUrl || !data?.region) return;
      chrome.storage.local.remove('snaproo-region');
      const { x, y, w, h } = data.region;
      const fullImg = new Image();
      fullImg.src = data.dataUrl;
      fullImg.onload = () => {
        // Crop to selected region
        const dpr = window.devicePixelRatio || 1;
        const c = document.createElement('canvas');
        c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
        c.getContext('2d').drawImage(fullImg, x * dpr, y * dpr, w * dpr, h * dpr, 0, 0, c.width, c.height);
        openMode('edit');
        const cropped = new Image();
        cropped.src = c.toDataURL('image/png');
        cropped.onload = () => {
          if (typeof window._loadEditImage === 'function')
            window._loadEditImage(cropped, data.name || 'screenshot-region');
        };
      };
    });
  }

  // Check for screenshot transfer (from popup Quick Action)
  if (params.get('fromScreenshot')) {
    chrome.storage.local.get('snaproo-screenshot', (r) => {
      const data = r['snaproo-screenshot'];
      if (!data?.dataUrl) return;
      chrome.storage.local.remove('snaproo-screenshot');
      openMode('edit');
      const img = new Image();
      img.src = data.dataUrl;
      img.onload = () => {
        if (typeof window._loadEditImage === 'function')
          window._loadEditImage(img, data.name || 'screenshot');
      };
    });
  }

  // Check for library transfer (images sent from side panel)
  if (params.get('fromLib')) {
    chrome.storage.local.get('snaproo-lib-transfer', async (r) => {
      const data = r['snaproo-lib-transfer'];
      if (!data?.images?.length) return;
      // Clean up transfer data
      chrome.storage.local.remove('snaproo-lib-transfer');

      const tool = data.tool || 'edit';
      if (tool === 'edit') {
        // Load first image into editor
        const img = new Image();
        img.onload = () => {
          editOriginal = img;
          pipeline.setDisplayCanvas(editCanvas);
          pipeline.loadImage(img);
          editCanvas.style.display = 'block';
          $('edit-ribbon')?.classList.remove('disabled');
          $('edit-dropzone').style.display = 'none';
          editFilename = 'library-image';
          $('file-label').textContent = 'Library Image';
          updResize(); originalW = 0; originalH = 0; saveEdit();
          _initEditGuides();
        };
        img.src = data.images[0];
      } else if (tool === 'collage' || tool === 'batch') {
        // Load all images into the collage/batch drop zone
        for (const dataUrl of data.images) {
          const img = new Image();
          img.src = dataUrl;
          await new Promise(resolve => { img.onload = resolve; img.onerror = resolve; });
          if (tool === 'collage') {
            // Add to collage items list
            if (typeof collageImages !== 'undefined') {
              collageImages.push(img);
              if (typeof renderCollage === 'function') renderCollage();
            }
          } else if (tool === 'batch') {
            if (typeof batchFiles !== 'undefined') {
              batchFiles.push({ file: null, img, name: 'library-image-' + batchFiles.length, dataUrl });
              if (typeof renderBatchList === 'function') renderBatchList();
            }
          }
        }
      }
    });
  }
});

// ============================================================
// Navigation: Home <-> Modes
// ============================================================

// currentMode declared in shared-editor.js

function initNavigation() {
  $$('.home-card').forEach(card => {
    card.addEventListener('click', () => openMode(card.dataset.mode));
  });
  $('btn-back').addEventListener('click', goHome);
  initHomeSearch();
  initHomeHints();
  initQuickActions();
  initRecentFiles();
}

// ── Quick Actions ────────────────────────────────────────
function initQuickActions() {
  // Edit Image — open edit tool
  $('qa-open-edit')?.addEventListener('click', () => openMode('edit'));

  // Resize for Social
  $('qa-resize-social')?.addEventListener('click', () => openMode('social'));

  // Convert Format
  $('qa-convert')?.addEventListener('click', () => openMode('convert'));

  // Generate QR
  $('qa-qr')?.addEventListener('click', () => openMode('qr'));

  // Collage
  $('qa-collage')?.addEventListener('click', () => openMode('collage'));

  // Meme
  $('qa-meme')?.addEventListener('click', () => openMode('meme'));

  // Showcase
  $('qa-showcase')?.addEventListener('click', () => openMode('showcase'));

  // Certificate
  $('qa-cert')?.addEventListener('click', () => openMode('certificate'));
}

// ── Recent Files ─────────────────────────────────────────
function initRecentFiles() {
  renderRecentFiles();
}

async function renderRecentFiles() {
  try {
    const data = await chrome.storage.local.get({ recentFiles: [] });
    const items = data.recentFiles || [];
    const container = $('home-recent');
    const row = $('recent-row');
    if (!row || !container) return;
    if (items.length === 0) { container.style.display = 'none'; return; }
    container.style.display = '';
    row.innerHTML = '';
    items.slice(0, 8).forEach(item => {
      const el = document.createElement('div');
      el.className = 'recent-item';
      el.title = item.name || 'Untitled';
      const img = document.createElement('img');
      img.src = item.thumb;
      img.loading = 'lazy';
      const label = document.createElement('span');
      label.textContent = item.name || 'Untitled';
      el.appendChild(img);
      el.appendChild(label);
      el.addEventListener('click', () => {
        // Load full image from data URL
        const fullImg = new Image();
        fullImg.src = item.dataUrl;
        fullImg.onload = () => {
          openMode('edit');
          setTimeout(() => {
            if (typeof window._loadEditImage === 'function') {
              window._loadEditImage(fullImg, item.name || 'recent');
            }
          }, 100);
        };
      });
      row.appendChild(el);
    });
  } catch {}
}

// Call this when an image is loaded in the editor to save to recents
window._addRecentFile = async function(img, name) {
  try {
    // Create thumbnail (64x48)
    const tc = document.createElement('canvas');
    const aspect = img.naturalWidth / img.naturalHeight;
    tc.width = 64; tc.height = Math.round(64 / aspect);
    tc.getContext('2d').drawImage(img, 0, 0, tc.width, tc.height);
    const thumb = tc.toDataURL('image/jpeg', 0.5);

    // Create smaller data URL for storage (max ~300KB)
    const maxDim = 1200;
    const sc = document.createElement('canvas');
    if (img.naturalWidth > maxDim || img.naturalHeight > maxDim) {
      const scale = Math.min(maxDim / img.naturalWidth, maxDim / img.naturalHeight);
      sc.width = Math.round(img.naturalWidth * scale);
      sc.height = Math.round(img.naturalHeight * scale);
    } else {
      sc.width = img.naturalWidth; sc.height = img.naturalHeight;
    }
    sc.getContext('2d').drawImage(img, 0, 0, sc.width, sc.height);
    const dataUrl = sc.toDataURL('image/jpeg', 0.7);

    const data = await chrome.storage.local.get({ recentFiles: [] });
    let items = data.recentFiles || [];
    // Remove duplicate by name
    items = items.filter(i => i.name !== name);
    // Add to front
    items.unshift({ name, thumb, dataUrl, time: Date.now() });
    // Keep max 8
    items = items.slice(0, 8);
    await chrome.storage.local.set({ recentFiles: items });
  } catch {}
};

// ── Home grid search filter ──────────────────────────────
function initHomeSearch() {
  const input = $('home-search');
  if (!input) return;
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    $$('.home-card').forEach(card => {
      if (!q) { card.style.display = ''; return; }
      const title = card.querySelector('.home-card-title')?.textContent?.toLowerCase() || '';
      const desc = card.querySelector('.home-card-desc')?.textContent?.toLowerCase() || '';
      const mode = card.dataset.mode || '';
      card.style.display = (title.includes(q) || desc.includes(q) || mode.includes(q)) ? '' : 'none';
    });
  });
}

// ── Home hint bar (shows tips on card hover) ─────────────
function initHomeHints() {
  const hints = {
    edit:        { tips: 'Resize, crop, rotate \u00B7 Brightness, contrast, filters \u00B7 Draw shapes, text, callouts \u00B7 Undo/redo history', keys: 'Ctrl+Z / Ctrl+S' },
    convert:     { tips: 'PNG, JPEG, WebP, BMP conversion \u00B7 Batch convert multiple files \u00B7 Quality control' },
    store:       { tips: 'App store icons at all sizes \u00B7 Apple & Google Play ready \u00B7 Screenshot frames' },
    info:        { tips: 'EXIF data, GPS, camera info \u00B7 Dimensions, color depth \u00B7 JPEG structure analysis' },
    colors:      { tips: 'Eyedropper from any page \u00B7 Palette extraction \u00B7 HEX/RGB/HSL/CMYK \u00B7 Contrast checker' },
    svg:         { tips: 'Inspect SVG source \u00B7 Render to raster at any size \u00B7 View structure & layers' },
    qr:          { tips: 'Generate with custom colors & logos \u00B7 Rounded corners, styles \u00B7 Read from images \u00B7 Bulk generate' },
    compare:     { tips: 'Side-by-side diff \u00B7 Pixel-level highlighting \u00B7 Overlay & slider modes' },
    generate:    { tips: 'Gradients, patterns, noise \u00B7 Color swatches \u00B7 Social banners, avatars, favicons' },
    showcase:    { tips: 'Gradient backgrounds, 10 presets \u00B7 Browser, macOS, Terminal frames \u00B7 iPhone, iPad, MacBook, Android, Monitor mockups \u00B7 Shadow, padding, radius', keys: 'Ctrl+V paste' },
    meme:        { tips: 'Top/bottom/middle text \u00B7 Impact font with outline \u00B7 Blank templates or own images \u00B7 Auto sizing' },
    certificate: { tips: '8 templates: classic to elegant \u00B7 Custom text, date, issuer \u00B7 Logo upload \u00B7 Badge mode' },
    gif:         { tips: 'Combine images into animated GIF \u00B7 Frame delay 30\u20132000ms \u00B7 Preview playback \u00B7 No server needed' },
    social:      { tips: 'All major platforms \u00B7 Twitter, Instagram, Facebook, LinkedIn, YouTube \u00B7 Cover/fit modes' },
    watermark:   { tips: 'Text watermark \u00B7 Custom font, angle, opacity \u00B7 Tiled across entire image' },
    callout:     { tips: '5 shapes with tail directions \u00B7 Custom colors & icons \u00B7 Drag to position & resize' },
    collage:     { tips: 'Freeform canvas, drag & drop \u00B7 Solid/gradient/image backgrounds \u00B7 Grid or manual layout' },
    batch:       { tips: 'Resize, filter, watermark multiple images \u00B7 Consistent output \u00B7 Download as ZIP' },
  };

  const bar = $('home-hint-bar');
  const nameEl = $('hint-name');
  const tipsEl = $('hint-tips');
  const keysEl = $('hint-keys');
  if (!bar) return;

  const defaultTips = 'Ctrl+V to paste \u00B7 Drop files on any tool';

  $$('.home-card').forEach(card => {
    card.addEventListener('mouseenter', () => {
      const mode = card.dataset.mode;
      const data = hints[mode];
      const title = card.querySelector('.home-card-title')?.textContent || mode;
      nameEl.textContent = title;
      tipsEl.textContent = data?.tips || '';
      keysEl.textContent = data?.keys || '';
      bar.classList.remove('empty');
    });
    card.addEventListener('mouseleave', () => {
      nameEl.textContent = 'Hover a tool';
      tipsEl.textContent = defaultTips;
      keysEl.textContent = '';
      bar.classList.add('empty');
    });
  });

  // Footer links
  $('link-footer-help')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') });
  });
  $('link-footer-settings')?.addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
  });
}

function openMode(mode) {
  currentMode = mode;
  $('home').classList.add('hidden');
  $$('.mode-view').forEach(v => v.classList.remove('active'));
  const panel = $(`mode-${mode}`);
  if (panel) panel.classList.add('active');

  $('btn-back').classList.add('visible');
  document.body.classList.add('tool-active');
  const labels = { edit:'Edit', convert:'Convert', store:'Store Assets', info:'Info', qr:'QR Code', colors:'Colors', svg:'SVG Tools', compare:'Compare', generate:'Generate', showcase:'Showcase', meme:'Meme', certificate:'Certificate', gif:'GIF Creator', collage:'Collage', batch:'Batch Edit', social:'Social Media', watermark:'Watermark', callout:'Callout' };
  $('mode-label').textContent = labels[mode] || '';

  // Apply saved ribbon group visibility preferences
  if (panel) applyRibbonPrefs(panel);
}

async function goHome() {
  // Check if there's work in progress that would be lost
  if (currentMode && _hasUnsavedWork()) {
    if (typeof pixDialog !== 'undefined') {
      const ok = await pixDialog.confirm('Leave Tool?', 'You have unsaved work. Going back will discard your changes.', { okText: 'Leave', danger: true });
      if (!ok) return;
    }
  }
  currentMode = null;
  $('home').classList.remove('hidden');
  $$('.mode-view').forEach(v => v.classList.remove('active'));
  $('btn-back').classList.remove('visible');
  document.body.classList.remove('tool-active');
  $('mode-label').textContent = '';
  $('btn-undo').style.display = 'none';
  $('btn-redo').style.display = 'none';
  $('file-label').textContent = '';
  // Ensure library manager is hidden
  const lm = $('library-manager');
  if (lm) { lm.style.display = 'none'; $('btn-open-library')?.classList.remove('active'); }
  // Refresh recent files
  renderRecentFiles();
}

function _hasUnsavedWork() {
  // Edit tool: check if an image is loaded (canvas visible with content)
  if (currentMode === 'edit') {
    const c = $('editor-canvas');
    if (c && c.width > 0 && c.style.display !== 'none') return true;
  }
  // Other tools: check if their canvas has content
  const canvasIds = {
    showcase: 'sc-canvas', meme: 'meme-canvas', collage: 'collage-canvas',
    certificate: 'cert-canvas', gif: 'gif-preview',
  };
  const cid = canvasIds[currentMode];
  if (cid) {
    const c = $(cid);
    if (c && c.width > 0 && c.style.display !== 'none') return true;
  }
  return false;
}

// Global drop: drop file anywhere on home -> auto-detect best mode
function initGlobalDrop() {
  const home = $('home');
  home.addEventListener('dragover', (e) => e.preventDefault());
  home.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    if (file.type === 'image/svg+xml' || file.name.endsWith('.svg')) { openMode('svg'); triggerDrop('svg-drop', 'svg-file', file); }
    else { openMode('edit'); triggerDrop('edit-dropzone', 'edit-file', file); }
  });
}

// ============================================================
// MODE: OCR
// ============================================================

// OCR removed from v1 -- Tesseract.js is 6MB+, triggers Chrome review scrutiny

// ============================================================
// Library Picker — shared modal for all tools
// ============================================================

async function openLibraryPicker(onAdd, options) {
  // onAdd receives array of { dataUrl, name, width, height }
  // options: { singleSelect: true } for compare tool
  const singleSelect = options?.singleSelect || false;
  const backdrop = $('lib-picker-backdrop');
  const grid = $('lib-picker-grid');
  const countEl = $('lib-picker-count');
  const selectedEl = $('lib-picker-selected');
  const selectAllBtn = $('lib-picker-select-all');

  // Load library items (images only, not colors)
  const allItems = await PixLibrary.getAll();
  const items = allItems.filter(i => i.type !== 'color' && i.dataUrl);

  if (!items.length) {
    await pixDialog.alert('Library Empty', 'No images in your library. Save images from the side panel first.');
    return;
  }

  countEl.textContent = items.length + ' items';
  const pickerSelected = new Set();

  // Hide select all in single mode
  selectAllBtn.style.display = singleSelect ? 'none' : '';

  // Render grid
  grid.innerHTML = '';
  items.forEach(item => {
    const card = document.createElement('div');
    card.style.cssText = 'position:relative;border:2px solid var(--slate-700);border-radius:6px;overflow:hidden;cursor:pointer;aspect-ratio:1;';
    card.dataset.id = item.id;

    const img = document.createElement('img');
    img.src = item.dataUrl;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';

    card.appendChild(img);

    if (singleSelect) {
      // Single-select: click to highlight, double-click to import directly
      card.addEventListener('click', () => {
        pickerSelected.clear();
        grid.querySelectorAll('div[data-id]').forEach(c => c.style.borderColor = 'var(--slate-700)');
        pickerSelected.add(item.id);
        card.style.borderColor = 'var(--saffron-400)';
        selectedEl.textContent = '1 selected';
      });
      card.addEventListener('dblclick', () => {
        pickerSelected.clear();
        pickerSelected.add(item.id);
        addHandler();
      });
    } else {
      // Multi-select: checkboxes
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.style.cssText = 'position:absolute;top:3px;left:3px;z-index:2;accent-color:var(--saffron-400);cursor:pointer;';
      card.insertBefore(cb, img);

      card.addEventListener('click', (e) => {
        if (e.target === cb) return;
        cb.checked = !cb.checked;
        cb.dispatchEvent(new Event('change'));
      });

      cb.addEventListener('change', () => {
        if (cb.checked) pickerSelected.add(item.id); else pickerSelected.delete(item.id);
        card.style.borderColor = cb.checked ? 'var(--saffron-400)' : 'var(--slate-700)';
        selectedEl.textContent = pickerSelected.size + ' selected';
      });
    }

    grid.appendChild(card);
  });

  // Show modal
  backdrop.style.display = 'flex';
  $('lib-picker-add').textContent = singleSelect ? 'Import' : 'Add';

  // Select All toggle
  const selectAllHandler = () => {
    const allSelected = pickerSelected.size === items.length;
    grid.querySelectorAll('input[type="checkbox"]').forEach((cb, i) => {
      cb.checked = !allSelected;
      const id = items[i].id;
      if (!allSelected) pickerSelected.add(id); else pickerSelected.delete(id);
      cb.closest('div').style.borderColor = cb.checked ? 'var(--saffron-400)' : 'var(--slate-700)';
    });
    selectedEl.textContent = pickerSelected.size + ' selected';
    selectAllBtn.textContent = pickerSelected.size === items.length ? 'Deselect All' : 'Select All';
  };

  function cleanup() {
    backdrop.style.display = 'none';
    selectAllBtn.removeEventListener('click', selectAllHandler);
    $('lib-picker-cancel').removeEventListener('click', cancelHandler);
    $('lib-picker-add').removeEventListener('click', addHandler);
    $('lib-picker-close').removeEventListener('click', cancelHandler);
    backdrop.removeEventListener('click', backdropHandler);
    document.removeEventListener('keydown', escHandler);
  }

  const cancelHandler = () => cleanup();

  const backdropHandler = (e) => { if (e.target === backdrop) cleanup(); };

  const escHandler = (e) => { if (e.key === 'Escape') cleanup(); };

  const addHandler = async () => {
    if (!pickerSelected.size) return;
    const selected = [];
    for (const id of pickerSelected) {
      const item = items.find(i => i.id === id);
      if (item) selected.push({ dataUrl: item.dataUrl, name: item.name || 'library-image', width: item.width || 0, height: item.height || 0 });
    }
    cleanup();
    if (selected.length) onAdd(selected);
  };

  selectAllBtn.addEventListener('click', selectAllHandler);
  $('lib-picker-cancel').addEventListener('click', cancelHandler);
  $('lib-picker-add').addEventListener('click', addHandler);
  $('lib-picker-close').addEventListener('click', cancelHandler);
  backdrop.addEventListener('click', backdropHandler);
  document.addEventListener('keydown', escHandler);
}

// ============================================================
// Save to Library Dialog (custom modal)
// ============================================================

async function saveToLibraryDialog(dataUrl, metadata = {}) {
  // metadata: { name, width, height, source, type }
  const overlay = $('stl-overlay');
  if (!overlay) return false;

  const collections = await PixLibrary.getCollections();

  // Populate thumbnail
  $('stl-thumb').src = dataUrl;

  // Populate name
  $('stl-name').value = metadata.name || 'image';

  // Populate collection dropdown
  const sel = $('stl-collection');
  sel.innerHTML = collections.map(c => `<option value="${c}"${c === 'General' ? ' selected' : ''}>${c}</option>`).join('') +
    '<option value="__new__">+ New Collection...</option>';

  // Reset new collection input
  const newInput = $('stl-new-collection');
  newInput.value = '';
  newInput.style.display = 'none';

  // Wire dropdown toggle
  const onSelChange = () => {
    newInput.style.display = sel.value === '__new__' ? 'block' : 'none';
    if (sel.value === '__new__') newInput.focus();
  };
  sel.addEventListener('change', onSelChange);

  overlay.style.display = 'flex';
  $('stl-name').focus();

  return new Promise((resolve) => {
    const cleanup = (result) => {
      overlay.style.display = 'none';
      sel.removeEventListener('change', onSelChange);
      $('stl-save').removeEventListener('click', onSave);
      $('stl-cancel').removeEventListener('click', onCancel);
      overlay.removeEventListener('click', onBackdrop);
      document.removeEventListener('keydown', onKey);
      resolve(result);
    };

    const doSave = async () => {
      const name = $('stl-name').value || metadata.name || 'image';
      let collection = sel.value;
      if (collection === '__new__') {
        collection = newInput.value.trim() || 'General';
      }
      await PixLibrary.add({
        dataUrl,
        name,
        collection,
        source: metadata.source || 'Tool',
        width: metadata.width || 0,
        height: metadata.height || 0,
        type: metadata.type || 'image',
      });
      return true;
    };

    const onSave = async () => { const r = await doSave(); cleanup(r); };
    const onCancel = () => cleanup(false);
    const onBackdrop = (e) => { if (e.target === overlay) cleanup(false); };
    const onKey = (e) => {
      if (e.key === 'Enter') { e.preventDefault(); onSave(); }
      if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    };

    $('stl-save').addEventListener('click', onSave);
    $('stl-cancel').addEventListener('click', onCancel);
    overlay.addEventListener('click', onBackdrop);
    document.addEventListener('keydown', onKey);
  });
}

// ============================================================
// Wire Save to Library buttons for all tools
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
  // Edit mode
  $('btn-edit-save-lib')?.addEventListener('click', async () => {
    if (!editCanvas.width) return;
    const dataUrl = editCanvas.toDataURL('image/png');
    await saveToLibraryDialog(dataUrl, { name: editFilename || 'edit-export', source: 'Edit', width: editCanvas.width, height: editCanvas.height });
  });

  // Generate mode
  $('btn-gen-save-lib')?.addEventListener('click', async () => {
    const canvas = $('gen-canvas');
    if (!canvas || !canvas.width) return;
    const dataUrl = canvas.toDataURL('image/png');
    await saveToLibraryDialog(dataUrl, { name: 'generated', source: 'Generate', width: canvas.width, height: canvas.height });
  });

  // Collage mode
  $('btn-collage-save-lib')?.addEventListener('click', async () => {
    const canvas = $('collage-canvas');
    if (!canvas || !canvas.width) return;
    const dataUrl = canvas.toDataURL('image/png');
    await saveToLibraryDialog(dataUrl, { name: 'collage', source: 'Collage', width: canvas.width, height: canvas.height });
  });

  // QR mode
  $('btn-qr-save-lib')?.addEventListener('click', async () => {
    const canvas = $('qr-canvas');
    if (!canvas || !canvas.width) return;
    const dataUrl = canvas.toDataURL('image/png');
    await saveToLibraryDialog(dataUrl, { name: 'qrcode', source: 'QR Code', width: canvas.width, height: canvas.height });
  });

  // Social media mode
  $('btn-social-save-lib')?.addEventListener('click', async () => {
    const canvas = $('social-canvas');
    if (!canvas || !canvas.width || !canvas.height) return;
    const dataUrl = canvas.toDataURL('image/png');
    await saveToLibraryDialog(dataUrl, { name: 'social-banner', source: 'Social Media', width: canvas.width, height: canvas.height });
  });

  // Watermark mode — save the preview canvas
  $('btn-wm-save-lib')?.addEventListener('click', async () => {
    const canvas = $('wm-canvas');
    if (!canvas || !canvas.width) return;
    const dataUrl = canvas.toDataURL('image/png');
    await saveToLibraryDialog(dataUrl, { name: 'watermarked', source: 'Watermark', width: canvas.width, height: canvas.height });
  });

  // SVG Trace mode — render SVG to canvas for library save
  $('btn-trace-save-lib')?.addEventListener('click', async () => {
    const svgEl = document.querySelector('#trace-preview svg');
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    await new Promise((r, j) => { img.onload = r; img.onerror = j; img.src = url; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || 800;
    c.height = img.naturalHeight || 600;
    c.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const dataUrl = c.toDataURL('image/png');
    await saveToLibraryDialog(dataUrl, { name: 'svg-trace', source: 'SVG Trace', width: c.width, height: c.height });
  });
});
