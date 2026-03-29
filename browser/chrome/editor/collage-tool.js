// Pixeroo — Collage Tool
function initCollage() {
  const canvas = $('collage-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  // --- Image objects (simple array, no ObjectLayer) ---
  let images = []; // { src, x, y, w, h, borderWidth, borderColor, shadowEnabled, shadowColor, shadowBlur, cornerRadius, imgFilter, opacity }
  let selection = []; // multi-select array
  let selected = null; // primary selected (last clicked, receives property edits + handles)
  let dragging = false, dragWhat = null, dragStartX = 0, dragStartY = 0, origX = 0, origY = 0, origW = 0, origH = 0;
  let dragOrigins = []; // {obj, x, y} for multi-move
  let _shiftHeld = false;

  // --- Undo/Redo state stack ---
  let undoStack = []; // snapshots of images state
  let redoStack = [];
  const MAX_UNDO = 30;

  function snapImage(o) {
    return {
      src: o.src, x: o.x, y: o.y, w: o.w, h: o.h, rotation: o.rotation, flipH: o.flipH, flipV: o.flipV,
      borderWidth: o.borderWidth, borderColor: o.borderColor,
      shadowEnabled: o.shadowEnabled, shadowColor: o.shadowColor, shadowBlur: o.shadowBlur,
      cornerRadius: o.cornerRadius, imgFilter: o.imgFilter, panX: o.panX, panY: o.panY,
      opacity: o.opacity, blendMode: o.blendMode, fadeLeft: o.fadeLeft, fadeRight: o.fadeRight, fadeTop: o.fadeTop, fadeBottom: o.fadeBottom, edgeColor: o.edgeColor, isGroup: o.isGroup,
      children: o.children, type: o.type, text: o.text, color: o.color, fontSize: o.fontSize, fontFamily: o.fontFamily, fontWeight: o.fontWeight,
    };
  }

  function saveState() {
    // Snapshot images + canvas dimensions
    undoStack.push({
      canvasW: canvas.width, canvasH: canvas.height,
      images: images.map(snapImage),
    });
    if (undoStack.length > MAX_UNDO) undoStack.shift();
    redoStack = []; // new action clears redo
  }

  function restoreState(state) {
    // Restore canvas dimensions
    if (state.canvasW) { canvas.width = state.canvasW; $('collage-w').value = state.canvasW; }
    if (state.canvasH) { canvas.height = state.canvasH; $('collage-h').value = state.canvasH; }
    // Restore images
    const imgList = state.images || state; // backwards compat with old format
    images = imgList.map(s => {
      if (s.type === 'text') {
        const o = makeTextObj(s.x, s.y, s.text);
        o.color = s.color; o.fontSize = s.fontSize; o.fontFamily = s.fontFamily; o.fontWeight = s.fontWeight;
        o.rotation = s.rotation; o.opacity = s.opacity;
        return o;
      }
      const o = makeImgObj(s.src, s.x, s.y, s.w, s.h);
      o.borderWidth = s.borderWidth; o.borderColor = s.borderColor;
      o.shadowEnabled = s.shadowEnabled; o.shadowColor = s.shadowColor; o.shadowBlur = s.shadowBlur;
      o.cornerRadius = s.cornerRadius; o.imgFilter = s.imgFilter; o.panX = s.panX; o.panY = s.panY;
      o.rotation = s.rotation; o.flipH = s.flipH; o.flipV = s.flipV;
      o.opacity = s.opacity; o.blendMode = s.blendMode;
      o.fadeLeft = s.fadeLeft; o.fadeRight = s.fadeRight; o.fadeTop = s.fadeTop; o.fadeBottom = s.fadeBottom; o.edgeColor = s.edgeColor;
      o.isGroup = s.isGroup; o.children = s.children;
      return o;
    });
    selection = []; selected = null; snapGuides = [];
    updateCount(); render();
  }

  function currentSnapshot() {
    return { canvasW: canvas.width, canvasH: canvas.height, images: images.map(snapImage) };
  }

  function collageUndo() {
    if (!undoStack.length) return;
    redoStack.push(currentSnapshot());
    restoreState(undoStack.pop());
  }

  function collageRedo() {
    if (!redoStack.length) return;
    undoStack.push(currentSnapshot());
    restoreState(redoStack.pop());
  }
  let snapGuides = []; // {axis:'x'|'y', pos:number} — active snap guide lines during drag
  let zoomLevel = 1;
  let dragTooltip = null; // { text, x, y } — shown near cursor during drag
  const HANDLE = 7;
  const SNAP_THRESHOLD = 6;

  document.addEventListener('keydown', (e) => { if (e.key === 'Shift') _shiftHeld = true; });
  document.addEventListener('keyup', (e) => { if (e.key === 'Shift') _shiftHeld = false; });

  function makeTextObj(x, y, text) {
    // Smart color: contrast with background
    const textColor = getContrastColor();
    return { type: 'text', x, y, w: 200, h: 40, text: text || '', color: textColor, fontSize: 36, fontFamily: 'Inter, system-ui, sans-serif', fontWeight: 'bold', opacity: 1, rotation: 0, editing: false };
  }

  function getContrastColor() {
    // Sample background color at center of canvas
    const bg = $('collage-bg')?.value || '#ffffff';
    const r = parseInt(bg.slice(1,3),16)||0, g = parseInt(bg.slice(3,5),16)||0, b = parseInt(bg.slice(5,7),16)||0;
    // Luminance formula
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum > 0.5 ? '#1e293b' : '#ffffff';
  }

  function makeImgObj(src, x, y, w, h) {
    return { src, x, y, w, h, rotation: 0, flipH: false, flipV: false, panX: 0, panY: 0, borderWidth: 0, borderColor: '#ffffff', shadowEnabled: false, shadowColor: '#000000', shadowBlur: 12, cornerRadius: 0, imgFilter: 'none', opacity: 1, blendMode: 'source-over', fadeLeft: 0, fadeRight: 0, fadeTop: 0, fadeBottom: 0, edgeColor: '#000000' };
  }

  // --- Background ---
  let bgImage = null; // background image canvas

  function drawBg() {
    const bgType = $('collage-bg-type')?.value || 'solid';
    const bg1 = $('collage-bg')?.value || '#ffffff';
    const bg2 = $('collage-bg2')?.value || '#e2e8f0';
    if (bgType === 'image' && bgImage) {
      ctx.drawImage(bgImage, 0, 0, canvas.width, canvas.height);
    } else if (bgType === 'gradient') {
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, bg1); g.addColorStop(1, bg2); ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = bg1;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  // --- Draw one image object ---
  function drawImgObj(obj) {
    if (obj.type === 'text') { drawTextObj(ctx, obj); return; }
    drawImgObjOn(ctx, obj);
  }

  function drawTextObj(c, obj) {
    c.save();
    if (obj.rotation) {
      const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
      c.translate(cx, cy); c.rotate(obj.rotation * Math.PI / 180); c.translate(-cx, -cy);
    }
    c.globalAlpha = obj.opacity;
    c.fillStyle = obj.color;
    c.font = `${obj.fontWeight} ${obj.fontSize}px ${obj.fontFamily}`;
    c.textBaseline = 'top';
    const lines = (obj.text || '').split('\n');
    const lineH = obj.fontSize * 1.3;
    let maxW = 0;
    lines.forEach(line => { maxW = Math.max(maxW, c.measureText(line).width); });
    obj.w = Math.max(maxW + 8, 40);
    obj.h = Math.max(lines.length * lineH + 4, lineH + 4);
    lines.forEach((line, i) => { c.fillText(line, obj.x + 4, obj.y + i * lineH + 2); });
    // Cursor when editing
    if (obj.editing) {
      const lastLine = lines[lines.length - 1] || '';
      const cursorX = obj.x + 4 + c.measureText(lastLine).width + 2;
      const cursorY = obj.y + (lines.length - 1) * lineH + 2;
      c.strokeStyle = '#F4C430'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(cursorX, cursorY); c.lineTo(cursorX, cursorY + obj.fontSize); c.stroke();
    }
    c.restore();
  }

  function drawImgObjOn(c, obj) {
    const { x, y, w, h, src } = obj;
    const bw = obj.borderWidth || 0;
    const r = obj.cornerRadius || 0;
    const hasEdge = (obj.fadeLeft || obj.fadeRight || obj.fadeTop || obj.fadeBottom);

    // If edge effect: draw entire image+border onto temp canvas first, then apply fade
    const totalW = w + bw * 2, totalH = h + bw * 2;
    const useTemp = hasEdge;
    const tc = useTemp ? document.createElement('canvas') : null;
    let tctx = null;
    let drawX = x, drawY = y; // where to draw in final output
    if (useTemp) {
      tc.width = totalW + 20; tc.height = totalH + 20; // extra for shadow
      tctx = tc.getContext('2d');
      // Draw at offset 10,10 to leave room for shadow
      drawX = 10 + bw; drawY = 10 + bw;
    }
    const dc = useTemp ? tctx : c; // draw context
    const ox = useTemp ? drawX : x; // origin x for image
    const oy = useTemp ? drawY : y;
    const obx = useTemp ? drawX - bw : x - bw; // origin x for border
    const oby = useTemp ? drawY - bw : y - bw;

    if (!useTemp) {
      c.save();
      c.globalAlpha = obj.opacity;
      if (obj.blendMode && obj.blendMode !== 'source-over') c.globalCompositeOperation = obj.blendMode;
      if (obj.rotation || obj.flipH || obj.flipV) {
        const cx = x + w / 2, cy = y + h / 2;
        c.translate(cx, cy);
        if (obj.rotation) c.rotate(obj.rotation * Math.PI / 180);
        if (obj.flipH || obj.flipV) c.scale(obj.flipH ? -1 : 1, obj.flipV ? -1 : 1);
        c.translate(-cx, -cy);
      }
    }

    // Shadow
    if (obj.shadowEnabled) {
      const sr = parseInt(obj.shadowColor.slice(1,3),16)||0, sg = parseInt(obj.shadowColor.slice(3,5),16)||0, sb = parseInt(obj.shadowColor.slice(5,7),16)||0;
      dc.shadowColor = `rgba(${sr},${sg},${sb},0.4)`;
      dc.shadowBlur = obj.shadowBlur; dc.shadowOffsetX = 4; dc.shadowOffsetY = 4;
      dc.fillStyle = obj.borderColor || '#fff';
      if (r > 0) { roundRect(dc, obx, oby, totalW, totalH, r); dc.fill(); }
      else dc.fillRect(obx, oby, totalW, totalH);
      dc.shadowColor = 'transparent'; dc.shadowBlur = 0; dc.shadowOffsetX = 0; dc.shadowOffsetY = 0;
    }

    // Border frame
    if (bw > 0) {
      dc.fillStyle = obj.borderColor || '#ffffff';
      if (r > 0) { roundRect(dc, obx, oby, totalW, totalH, r); dc.fill(); }
      else dc.fillRect(obx, oby, totalW, totalH);
    }

    // Clip
    dc.save();
    if (r > 0) { roundRect(dc, ox, oy, w, h, Math.max(1, r - bw)); dc.clip(); }
    else { dc.beginPath(); dc.rect(ox, oy, w, h); dc.clip(); }

    // Filter
    const fmap = { none:'', grayscale:'grayscale(100%)', sepia:'sepia(100%)', brightness:'brightness(130%)', blur:'blur(2px)', invert:'invert(100%)' };
    if (obj.imgFilter && fmap[obj.imgFilter]) dc.filter = fmap[obj.imgFilter];

    // Draw image with pan offset
    const ppx = obj.panX || 0, ppy = obj.panY || 0;
    dc.drawImage(src, ox + ppx, oy + ppy, w, h);
    dc.filter = 'none';
    dc.restore(); // pop clip

    if (useTemp) {
      // Apply per-edge fades to the temp canvas
      const tw = tc.width, th = tc.height;
      const ec = obj.edgeColor || '#000000';
      const er = parseInt(ec.slice(1,3),16)||0, eg = parseInt(ec.slice(3,5),16)||0, eb = parseInt(ec.slice(5,7),16)||0;
      const solid = `rgba(${er},${eg},${eb},1)`;
      const clear = `rgba(${er},${eg},${eb},0)`;

      function edgeGrad(x1,y1,x2,y2) { const g = tctx.createLinearGradient(x1,y1,x2,y2); g.addColorStop(0, solid); g.addColorStop(1, clear); return g; }

      if (obj.fadeLeft > 0) {
        const sz = tw * obj.fadeLeft / 100;
        tctx.fillStyle = edgeGrad(0, 0, sz, 0); tctx.fillRect(0, 0, sz, th);
      }
      if (obj.fadeRight > 0) {
        const sz = tw * obj.fadeRight / 100;
        tctx.fillStyle = edgeGrad(tw, 0, tw - sz, 0); tctx.fillRect(tw - sz, 0, sz, th);
      }
      if (obj.fadeTop > 0) {
        const sz = th * obj.fadeTop / 100;
        tctx.fillStyle = edgeGrad(0, 0, 0, sz); tctx.fillRect(0, 0, tw, sz);
      }
      if (obj.fadeBottom > 0) {
        const sz = th * obj.fadeBottom / 100;
        tctx.fillStyle = edgeGrad(0, th, 0, th - sz); tctx.fillRect(0, th - sz, tw, sz);
      }

      // Composite temp canvas onto main canvas
      c.save();
      c.globalAlpha = obj.opacity;
      if (obj.blendMode && obj.blendMode !== 'source-over') c.globalCompositeOperation = obj.blendMode;
      if (obj.rotation || obj.flipH || obj.flipV) {
        const cx = x + w / 2, cy = y + h / 2;
        c.translate(cx, cy);
        if (obj.rotation) c.rotate(obj.rotation * Math.PI / 180);
        if (obj.flipH || obj.flipV) c.scale(obj.flipH ? -1 : 1, obj.flipV ? -1 : 1);
        c.translate(-cx, -cy);
      }
      c.drawImage(tc, x - bw - 10, y - bw - 10);
      c.restore();
    } else {
      // No edge effect — already drew directly on c
      c.restore(); // pop the main save
    }
  }

  // --- Selection + handles ---
  function drawSelection(obj) {
    ctx.save();
    // Apply same rotation transform
    if (obj.rotation) {
      const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
      ctx.translate(cx, cy); ctx.rotate(obj.rotation * Math.PI / 180); ctx.translate(-cx, -cy);
    }
    ctx.strokeStyle = '#F4C430'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.strokeRect(obj.x - 1, obj.y - 1, obj.w + 2, obj.h + 2);
    ctx.setLineDash([]);
    ctx.fillStyle = '#F4C430';
    for (const [, hx, hy] of getHandles(obj)) {
      ctx.fillRect(hx - HANDLE/2, hy - HANDLE/2, HANDLE, HANDLE);
    }
    // Rotation handle — circle above top center (not for text)
    if (obj.type !== 'text') {
      const rotX = obj.x + obj.w / 2, rotY = obj.y - 25;
      ctx.beginPath(); ctx.arc(rotX, rotY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#F4C430'; ctx.lineWidth = 1; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(rotX, rotY + 6); ctx.lineTo(rotX, obj.y); ctx.stroke();
    }
    ctx.restore();
  }

  function getHandles(obj) {
    // Text objects: no resize handles (auto-sized by font)
    if (obj.type === 'text') return [];
    const { x, y, w, h } = obj;
    return [
      ['tl',x,y],['tr',x+w,y],['bl',x,y+h],['br',x+w,y+h],
      ['tm',x+w/2,y],['bm',x+w/2,y+h],['ml',x,y+h/2],['mr',x+w,y+h/2],
    ];
  }

  function hitHandle(obj, px, py) {
    for (const [name, hx, hy] of getHandles(obj)) {
      if (Math.abs(px-hx) < HANDLE && Math.abs(py-hy) < HANDLE) return name;
    }
    return null;
  }

  function hitImage(px, py) {
    for (let i = images.length - 1; i >= 0; i--) {
      const o = images[i];
      if (px >= o.x && px <= o.x+o.w && py >= o.y && py <= o.y+o.h) return o;
    }
    return null;
  }

  // --- Full render ---
  function render() {
    drawBg();

    // Check if any image uses a non-normal blend mode
    const hasBlend = images.some(o => o.blendMode && o.blendMode !== 'source-over');

    if (hasBlend) {
      // Draw all images onto a transparent layer, then composite onto bg
      const layer = document.createElement('canvas');
      layer.width = canvas.width; layer.height = canvas.height;
      const lctx = layer.getContext('2d');
      for (const obj of images) drawImgObjOn(lctx, obj);
      ctx.drawImage(layer, 0, 0);
    } else {
      for (const obj of images) drawImgObj(obj);
    }

    // Selection + guides on top (always normal blend)
    for (const obj of selection) {
      if (obj !== selected) drawSelectionOutline(obj);
    }
    if (selected) drawSelection(selected);
    if (!dragging) { snapGuides = []; dragTooltip = null; }
    drawSnapGuides();
    if (dragTooltip) drawDragTooltip();
    updateHint();
    updateRibbonState();
    if (!textPlaceMode && !dragging) canvas.style.cursor = 'default';
  }

  // Outline for multi-selected (dashed, corner dots, no resize handles)
  function drawSelectionOutline(obj) {
    ctx.save();
    if (obj.rotation) {
      const cx = obj.x + obj.w / 2, cy = obj.y + obj.h / 2;
      ctx.translate(cx, cy); ctx.rotate(obj.rotation * Math.PI / 180); ctx.translate(-cx, -cy);
    }
    ctx.strokeStyle = '#F4C430'; ctx.lineWidth = 2.5; ctx.setLineDash([8, 4]);
    ctx.strokeRect(obj.x - 3, obj.y - 3, obj.w + 6, obj.h + 6);
    ctx.setLineDash([]);
    // Corner dots
    ctx.fillStyle = '#F4C430';
    const d = 5;
    ctx.fillRect(obj.x - d, obj.y - d, d*2, d*2);
    ctx.fillRect(obj.x + obj.w - d, obj.y - d, d*2, d*2);
    ctx.fillRect(obj.x - d, obj.y + obj.h - d, d*2, d*2);
    ctx.fillRect(obj.x + obj.w - d, obj.y + obj.h - d, d*2, d*2);
    ctx.restore();
  }

  function updateHint() {
    const hint = $('collage-hint');
    if (!hint) return;
    if (canvas.style.display === 'none') { hint.style.display = 'none'; return; }
    hint.style.display = '';
    if (images.length === 0) {
      hint.textContent = 'Click + Add or drop images to get started';
    } else if (selection.length === 0) {
      hint.textContent = 'Click to select \u2022 Shift+Click multi-select \u2022 Ctrl+A all' + (joinMode ? ' \u2022 JOIN MODE: Shift+Click 2 images to auto-blend' : '');
    } else if (selection.length > 1) {
      hint.innerHTML = `<span style="color:var(--saffron-400);">${selection.length} selected</span> \u2022 Drag to move all \u2022 Delete to remove \u2022 <b>Ctrl+G</b> to group`;
    } else if (selected) {
      const s = selected.src;
      const origSize = s ? `${s.width}\u00d7${s.height}` : '';
      const curSize = `${Math.round(selected.w)}\u00d7${Math.round(selected.h)}`;
      const groupHint = selected.isGroup ? ' \u2022 <b>Ctrl+Shift+G</b> to ungroup' : '';
      const panHint = panMode ? ' \u2022 <span style="color:#22c55e;">PAN MODE</span>: drag to shift image in frame' : ' \u2022 Double-click to pan inside frame';
      hint.innerHTML = `<span style="color:var(--saffron-400);">Selected</span> ${origSize ? origSize + ' \u2192 ' : ''}${curSize} \u2022 Drag handles to resize \u2022 <b>Shift = lock ratio</b> \u2022 Delete${groupHint}${panHint}`;
    }
  }

  // --- Canvas coords from mouse event ---
  function toCanvas(e) {
    const r = canvas.getBoundingClientRect();
    return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height };
  }

  // --- Mouse interaction ---
  let _didDrag = false;
  let _mouseDownShift = false;
  let _skipNextMouseup = false;

  function updateRibbonState() {
    const n = selection.length;
    const has1 = n >= 1;
    const has2 = n >= 2;
    const has3 = n >= 3;
    const isGrp = !!selected?.isGroup;

    function setBtn(id, enabled) {
      const el = document.getElementById(id);
      if (el) el.disabled = !enabled;
    }

    // Transform: need 1+
    setBtn('btn-coll-rot-left', has1);
    setBtn('btn-coll-rot-right', has1);
    setBtn('btn-coll-flip-h', has1);
    setBtn('btn-coll-flip-v', has1);

    // Layer order: need 1+
    setBtn('btn-coll-front', has1);
    setBtn('btn-coll-forward', has1);
    setBtn('btn-coll-backward', has1);
    setBtn('btn-coll-back', has1);

    // Delete/Deselect: need 1+
    setBtn('btn-coll-delete', has1);
    setBtn('btn-coll-deselect', has1);

    // Group: need 2+, Ungroup: need group
    setBtn('btn-coll-group', has2);
    setBtn('btn-coll-ungroup', isGrp);

    // Style: need 1+
    setBtn('btn-coll-copy-style', has1);
    setBtn('btn-coll-paste-style', has1);

    // Join: need exactly 2
    setBtn('btn-coll-join', n === 2);

    // Align: need 2+
    setBtn('btn-align-left', has2);
    setBtn('btn-align-right', has2);
    setBtn('btn-align-top', has2);
    setBtn('btn-align-bottom', has2);
    setBtn('btn-align-center-h', has2);
    setBtn('btn-align-center-v', has2);

    // Distribute: need 3+
    setBtn('btn-distribute-h', has3);
    setBtn('btn-distribute-v', has3);

    // Center on canvas: need 1+
    setBtn('btn-center-canvas-h', has1);
    setBtn('btn-center-canvas-v', has1);
  }

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = toCanvas(e);
    _didDrag = false;
    _mouseDownShift = e.shiftKey;

    // Shift+mousedown: do nothing (selection handled in mouseup)
    if (e.shiftKey) return;

    // Check handle on primary selected
    if (selected && !e.shiftKey) {
      // Rotation handle — circle above top center (not for text)
      const rotX = selected.x + selected.w / 2, rotY = selected.y - 25;
      if (selected.type !== 'text' && Math.hypot(x - rotX, y - rotY) < 10) {
        dragging = true; dragWhat = 'rotate'; _didDrag = true;
        dragStartX = x; dragStartY = y;
        origX = selected.rotation || 0;
        return;
      }
      const h = hitHandle(selected, x, y);
      if (h) {
        dragging = true; dragWhat = h; _didDrag = true;
        dragStartX = x; dragStartY = y;
        origX = selected.x; origY = selected.y; origW = selected.w; origH = selected.h;
        return;
      }
    }

    // Check image hit for drag-move
    const hit = hitImage(x, y);
    if (hit) {
      if (!selection.includes(hit)) { selection = [hit]; selected = hit; render(); }
      dragging = true; dragWhat = 'move';
      dragStartX = x; dragStartY = y;
      dragOrigins = selection.map(o => ({ obj: o, x: o.x, y: o.y }));
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (_skipNextMouseup) { _skipNextMouseup = false; dragging = false; dragWhat = null; snapGuides = []; return; }
    if (_didDrag) { dragging = false; dragWhat = null; _didDrag = false; snapGuides = []; saveState(); render(); return; }
    dragging = false; dragWhat = null;

    const { x, y } = toCanvas(e);

    // Text placement mode — click to place text
    if (textPlaceMode) {
      textPlaceMode = false;
      canvas.style.cursor = 'default';
      $('btn-coll-add-text')?.classList.remove('active');
      saveState();
      const t = makeTextObj(x, y, '');
      images.push(t);
      selection = [t]; selected = t;
      t.editing = true;
      // Sync text color picker
      const tcPicker = $('coll-text-color');
      if (tcPicker) tcPicker.value = t.color;
      updateCount(); render();
      return;
    }
    const hit = hitImage(x, y);
    const isShift = e.shiftKey || _mouseDownShift;

    if (hit) {
      if (isShift) {
        // Shift+Click: toggle in multi-selection
        const idx = selection.indexOf(hit);
        if (idx >= 0) {
          selection.splice(idx, 1);
          if (selected === hit) selected = selection.length ? selection[selection.length - 1] : null;
        } else {
          selection.push(hit);
          selected = hit;
        }
      } else {
        // Normal click: single-select, stop any text editing
        images.forEach(o => { if (o !== hit && o.editing) o.editing = false; });
        if (!selection.includes(hit)) { selection = [hit]; selected = hit; }
      }
    } else if (!isShift) {
      // Exit pan mode on any click
      if (panMode) panMode = false;
      // Click on nothing: stop text editing, remove empty text objects, deselect
      images.forEach(o => { if (o.editing) o.editing = false; });
      images = images.filter(o => !(o.type === 'text' && !o.text.trim()));
      selection = []; selected = null;
    }

    // Auto-join when join mode is on and exactly 2 selected
    if (joinMode && selection.length === 2) {
      joinBlend();
    }

    render();
  });

  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    const { x, y } = toCanvas(e);
    const dx = x - dragStartX, dy = y - dragStartY;
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) _didDrag = true;
    if (!selected && dragWhat === 'move') return;

    // Pan mode: shift image within frame
    if (panMode && dragWhat === 'move' && selected && !selected.type) {
      selected.panX = (selected.panX || 0) + (x - dragStartX);
      selected.panY = (selected.panY || 0) + (y - dragStartY);
      dragStartX = x; dragStartY = y;
      dragTooltip = { text: `pan: ${Math.round(selected.panX)}, ${Math.round(selected.panY)}`, x, y };
      render(); return;
    }

    if (dragWhat === 'rotate' && selected) {
      // Free rotation: angle from center to mouse
      const cx = selected.x + selected.w / 2, cy = selected.y + selected.h / 2;
      const angle = Math.atan2(y - cy, x - cx) * 180 / Math.PI + 90; // +90 because handle is above
      selected.rotation = Math.round(angle);
      // Snap to 0, 90, 180, 270 within 5 degrees
      for (const snap of [0, 90, 180, 270, -90, -180, -270, 360]) {
        if (Math.abs(selected.rotation - snap) < 5) { selected.rotation = snap % 360; break; }
      }
      dragTooltip = { text: `${selected.rotation}\u00b0`, x, y };
      render(); return;
    } else if (dragWhat === 'move') {
      // Move all selected images together
      for (const d of dragOrigins) { d.obj.x = d.x + dx; d.obj.y = d.y + dy; }
      // Smart snap (skip if Ctrl held)
      if (!e.ctrlKey && selected) {
        const snap = computeSnap(selected);
        if (snap.dx !== 0 || snap.dy !== 0) {
          for (const d of dragOrigins) { d.obj.x += snap.dx; d.obj.y += snap.dy; }
        }
        snapGuides = snap.guides;
      } else {
        snapGuides = [];
      }
      if (selected) dragTooltip = { text: `${Math.round(selected.x)}, ${Math.round(selected.y)}`, x, y };
    } else {
      // Shift = lock to original image aspect ratio
      const lockRatio = _shiftHeld && selected.src;
      const aspect = lockRatio ? (selected.src.width / selected.src.height) : 0;

      if (dragWhat === 'br' || dragWhat === 'tr' || dragWhat === 'bl' || dragWhat === 'tl') {
        // Corner handles: resize both dimensions
        let newW = origW + (dragWhat.includes('r') ? dx : -dx);
        let newH = origH + (dragWhat.includes('b') ? dy : -dy);
        newW = Math.max(20, newW);
        newH = Math.max(20, newH);
        if (lockRatio) { newH = Math.round(newW / aspect); }
        selected.w = newW;
        selected.h = newH;
        if (dragWhat.includes('l')) selected.x = origX + origW - newW;
        if (dragWhat.includes('t')) selected.y = origY + origH - newH;
      } else {
        // Edge handles: resize one dimension, auto-adjust other if Shift
        if (dragWhat === 'mr' || dragWhat === 'ml') {
          const newW = Math.max(20, dragWhat === 'mr' ? origW + dx : origW - dx);
          selected.w = newW;
          if (dragWhat === 'ml') selected.x = origX + origW - newW;
          if (lockRatio) selected.h = Math.round(newW / aspect);
        }
        if (dragWhat === 'bm' || dragWhat === 'tm') {
          const newH = Math.max(20, dragWhat === 'bm' ? origH + dy : origH - dy);
          selected.h = newH;
          if (dragWhat === 'tm') selected.y = origY + origH - newH;
          if (lockRatio) selected.w = Math.round(newH * aspect);
        }
      }
      dragTooltip = { text: `${Math.round(selected.w)} \u00d7 ${Math.round(selected.h)}`, x, y };
    }
    render();
  });

  // Global mouseup fallback (in case mouseup fires outside canvas)
  window.addEventListener('mouseup', () => { if (dragging) { dragging = false; dragWhat = null; snapGuides = []; render(); } });

  // --- Right-click context menu ---
  function closeCtxMenu() { $$('.ctx-menu').forEach(m => m.remove()); }

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    closeCtxMenu();

    const { x, y } = toCanvas(e);
    const hit = hitImage(x, y);

    // If right-clicked an unselected image, select it
    if (hit && !selection.includes(hit)) {
      selection = [hit]; selected = hit; render();
    }

    const menu = document.createElement('div');
    menu.className = 'ctx-menu';

    const multi = selection.length > 1;
    const hasSelection = selection.length > 0;
    const isGroup = selected?.isGroup;

    const items = [
      // Edit
      { label: 'Select All', shortcut: 'Ctrl+A', enabled: images.length > 0, action: () => { selection = [...images]; selected = images[images.length-1]; render(); } },
      { label: 'Duplicate', enabled: hasSelection, action: () => {
        saveState(); const dupes = [];
        for (const o of selection) {
          const d = makeImgObj(o.src, o.x + 20, o.y + 20, o.w, o.h);
          d.borderWidth = o.borderWidth; d.borderColor = o.borderColor;
          d.shadowEnabled = o.shadowEnabled; d.shadowColor = o.shadowColor;
          d.shadowBlur = o.shadowBlur; d.cornerRadius = o.cornerRadius;
          d.rotation = o.rotation; d.flipH = o.flipH; d.flipV = o.flipV;
          d.imgFilter = o.imgFilter; d.opacity = o.opacity; d.blendMode = o.blendMode; d.fadeLeft = o.fadeLeft; d.fadeRight = o.fadeRight; d.fadeTop = o.fadeTop; d.fadeBottom = o.fadeBottom; d.edgeColor = o.edgeColor;
          images.push(d); dupes.push(d);
        }
        selection = dupes; selected = dupes[dupes.length-1]; updateCount(); render();
      }},
      { label: 'Delete', shortcut: 'Del', enabled: hasSelection, danger: true, action: () => {
        saveState(); images = images.filter(o => !selection.includes(o));
        selection = []; selected = null; updateCount(); render();
      }},
      { sep: true },
      // Order
      { header: 'Order' },
      { label: 'Front', enabled: hasSelection, action: () => $('btn-coll-front')?.click() },
      { label: 'Back', enabled: hasSelection, action: () => $('btn-coll-back')?.click() },
      { sep: true },
      // Group
      { header: 'Group' },
      { label: 'Group', shortcut: 'Ctrl+G', enabled: multi, action: groupSelected },
      { label: 'Ungroup', shortcut: 'Ctrl+Shift+G', enabled: isGroup, action: ungroupSelected },
      { label: 'Join Blend', enabled: selection.length === 2, action: joinBlend },
      { sep: true },
      // Align (only show header if 2+)
      { header: 'Align', enabled: multi },
      { label: 'Align Left', enabled: multi, action: () => $('btn-align-left')?.click() },
      { label: 'Align Center H', enabled: multi, action: () => $('btn-align-center-h')?.click() },
      { label: 'Align Right', enabled: multi, action: () => $('btn-align-right')?.click() },
      { label: 'Align Top', enabled: multi, action: () => $('btn-align-top')?.click() },
      { label: 'Align Center V', enabled: multi, action: () => $('btn-align-center-v')?.click() },
      { label: 'Align Bottom', enabled: multi, action: () => $('btn-align-bottom')?.click() },
      { label: 'Center on Canvas', enabled: hasSelection, action: () => { $('btn-center-canvas-h')?.click(); $('btn-center-canvas-v')?.click(); } },
      { sep: true },
      // Style
      { header: 'Style', enabled: hasSelection },
      { label: 'Copy Style', enabled: hasSelection && !selected?.type, action: () => $('btn-coll-copy-style')?.click() },
      { label: 'Paste Style', enabled: !!copiedStyle && hasSelection, action: () => $('btn-coll-paste-style')?.click() },
      { sep: true },
      // Reset options — only show when there's something to reset
      { header: 'Reset', enabled: hasSelection && (selected?.rotation || selected?.panX || selected?.panY || selected?.borderWidth || selected?.shadowEnabled || selected?.fadeLeft || selected?.fadeRight || selected?.fadeTop || selected?.fadeBottom || selected?.imgFilter !== 'none') },
      { label: 'Reset Rotation', enabled: hasSelection && !!selected?.rotation, action: () => {
        saveState(); for (const o of selection) o.rotation = 0; render();
      }},
      { label: 'Reset Pan', enabled: hasSelection && !!(selected?.panX || selected?.panY), action: () => {
        saveState(); for (const o of selection) { o.panX = 0; o.panY = 0; } render();
      }},
      { label: 'Reset Flip', enabled: hasSelection && (selected?.flipH || selected?.flipV), action: () => {
        saveState(); for (const o of selection) { o.flipH = false; o.flipV = false; } render();
      }},
      { label: 'Reset Effects', enabled: hasSelection && !!(selected?.borderWidth || selected?.shadowEnabled || selected?.cornerRadius || (selected?.imgFilter && selected?.imgFilter !== 'none') || selected?.fadeLeft || selected?.fadeRight || selected?.fadeTop || selected?.fadeBottom), action: () => {
        saveState();
        for (const o of selection) {
          o.borderWidth = 0; o.shadowEnabled = false; o.cornerRadius = 0;
          o.imgFilter = 'none'; o.fadeLeft = 0; o.fadeRight = 0; o.fadeTop = 0; o.fadeBottom = 0;
          o.blendMode = 'source-over'; o.opacity = 1;
        }
        render();
      }},
      { label: 'Reset All', enabled: hasSelection, action: () => {
        saveState();
        for (const o of selection) {
          o.rotation = 0; o.flipH = false; o.flipV = false;
          o.panX = 0; o.panY = 0;
          o.borderWidth = 0; o.borderColor = '#ffffff';
          o.shadowEnabled = false; o.shadowColor = '#000000'; o.shadowBlur = 12;
          o.cornerRadius = 0; o.imgFilter = 'none';
          o.opacity = 1; o.blendMode = 'source-over';
          o.fadeLeft = 0; o.fadeRight = 0; o.fadeTop = 0; o.fadeBottom = 0; o.edgeColor = '#000000';
        }
        render();
      }},
    ];

    let lastWasSep = true; // avoid leading separator
    for (const item of items) {
      if (item.sep) {
        if (!lastWasSep) {
          const sep = document.createElement('div');
          sep.className = 'ctx-menu-sep';
          menu.appendChild(sep);
          lastWasSep = true;
        }
        continue;
      }
      if (item.header) {
        if (item.enabled === false) continue; // hide header if disabled
        const h = document.createElement('div');
        h.className = 'ctx-menu-header';
        h.textContent = item.header;
        menu.appendChild(h);
        lastWasSep = false;
        continue;
      }
      if (!item.enabled) continue; // hide disabled items entirely
      const el = document.createElement('div');
      el.className = 'ctx-menu-item' + (item.danger ? ' danger' : '');
      el.innerHTML = `${item.label}${item.shortcut ? `<span class="ctx-menu-shortcut">${item.shortcut}</span>` : ''}`;
      el.addEventListener('click', () => { closeCtxMenu(); _skipNextMouseup = true; item.action(); });
      menu.appendChild(el);
      lastWasSep = false;
    }
    // Remove trailing separator
    if (menu.lastChild?.classList?.contains('ctx-menu-sep')) menu.lastChild.remove();

    // Position menu at cursor
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';
    document.body.appendChild(menu);

    // Keep in viewport
    requestAnimationFrame(() => {
      const r = menu.getBoundingClientRect();
      if (r.right > window.innerWidth) menu.style.left = (window.innerWidth - r.width - 4) + 'px';
      if (r.bottom > window.innerHeight) menu.style.top = (window.innerHeight - r.height - 4) + 'px';
    });

    // Close on click outside or Escape
    setTimeout(() => {
      const close = (ev) => {
        if (ev.type === 'keydown' && ev.key !== 'Escape') return;
        // Don't close if clicking inside the menu (let click handler run)
        if (ev.type === 'mousedown' && menu.contains(ev.target)) return;
        closeCtxMenu();
        document.removeEventListener('mousedown', close);
        document.removeEventListener('keydown', close);
      };
      document.addEventListener('mousedown', close);
      document.addEventListener('keydown', close);
    }, 50);
  });

  // Delete key
  document.addEventListener('keydown', (e) => {
    if (currentMode !== 'collage') return;
    if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
    // Skip delete if editing text
    if (selected?.type === 'text' && selected?.editing) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && selection.length) {
      saveState();
      images = images.filter(o => !selection.includes(o));
      selection = []; selected = null; render(); updateCount();
    }
    // Ctrl+Z undo, Ctrl+Y redo (collage-specific, override global)
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault(); e.stopPropagation(); collageUndo();
    }
    if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
      e.preventDefault(); e.stopPropagation(); collageRedo();
    }
    // Ctrl+A select all
    if (e.ctrlKey && e.key === 'a' && images.length) {
      e.preventDefault();
      selection = [...images];
      selected = selection[selection.length - 1];
      render();
    }
    // Ctrl+G group / Ctrl+Shift+G ungroup
    if (e.ctrlKey && e.key.toLowerCase() === 'g' && !e.shiftKey && selection.length > 1) {
      e.preventDefault(); groupSelected();
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g' && selected?.isGroup) {
      e.preventDefault(); ungroupSelected();
    }
  });

  // --- Cursor update + hover tooltip ---
  canvas.addEventListener('mousemove', (e) => {
    if (dragging) return;
    const { x, y } = toCanvas(e);
    let cursor = 'default';
    let hoverTip = null;
    if (selected) {
      // Check rotation handle (not for text)
      const rotX = selected.x + selected.w / 2, rotY = selected.y - 25;
      if (selected.type !== 'text' && Math.hypot(x - rotX, y - rotY) < 10) {
        cursor = 'grab';
        hoverTip = `${selected.rotation || 0}\u00b0`;
      } else {
        const h = hitHandle(selected, x, y);
        const cm = { tl:'nwse-resize',tr:'nesw-resize',bl:'nesw-resize',br:'nwse-resize',tm:'ns-resize',bm:'ns-resize',ml:'ew-resize',mr:'ew-resize' };
        if (h) {
          cursor = cm[h] || 'move';
          hoverTip = `${Math.round(selected.w)} \u00d7 ${Math.round(selected.h)}`;
        }
      }
    }
    if (cursor === 'default' && hitImage(x, y)) cursor = 'move';
    canvas.style.cursor = textPlaceMode ? 'text' : cursor;

    // Show/clear hover tooltip
    if (hoverTip && !dragging) {
      dragTooltip = { text: hoverTip, x, y };
      render();
    } else if (dragTooltip && !dragging) {
      dragTooltip = null;
      render();
    }
  });

  // --- Helper ---
  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w/2, h/2);
    c.beginPath(); c.moveTo(x+r, y); c.lineTo(x+w-r, y);
    c.quadraticCurveTo(x+w, y, x+w, y+r); c.lineTo(x+w, y+h-r);
    c.quadraticCurveTo(x+w, y+h, x+w-r, y+h); c.lineTo(x+r, y+h);
    c.quadraticCurveTo(x, y+h, x, y+h-r); c.lineTo(x, y+r);
    c.quadraticCurveTo(x, y, x+r, y); c.closePath();
  }

  // --- Smart Snap: snap to other objects' edges/centers + canvas center ---
  function computeSnap(obj) {
    const guides = [];
    let dx = 0, dy = 0;
    const T = SNAP_THRESHOLD;

    // Points to check on the dragged object
    const srcL = obj.x, srcR = obj.x + obj.w, srcCX = obj.x + obj.w / 2;
    const srcT = obj.y, srcB = obj.y + obj.h, srcCY = obj.y + obj.h / 2;

    // Collect target snap points from other images + canvas
    const xTargets = [0, canvas.width, canvas.width / 2]; // canvas left, right, center
    const yTargets = [0, canvas.height, canvas.height / 2]; // canvas top, bottom, center

    for (const o of images) {
      if (selection.includes(o)) continue; // skip selected images
      xTargets.push(o.x, o.x + o.w, o.x + o.w / 2); // left, right, center
      yTargets.push(o.y, o.y + o.h, o.y + o.h / 2); // top, bottom, center
    }

    // Find nearest X snap
    let bestXDist = T + 1, bestXSnap = 0, bestXGuide = 0;
    for (const tx of xTargets) {
      for (const sx of [srcL, srcR, srcCX]) {
        const d = Math.abs(sx - tx);
        if (d < bestXDist) { bestXDist = d; bestXSnap = tx - sx; bestXGuide = tx; }
      }
    }
    if (bestXDist <= T) { dx = bestXSnap; guides.push({ axis: 'x', pos: bestXGuide }); }

    // Find nearest Y snap
    let bestYDist = T + 1, bestYSnap = 0, bestYGuide = 0;
    for (const ty of yTargets) {
      for (const sy of [srcT, srcB, srcCY]) {
        const d = Math.abs(sy - ty);
        if (d < bestYDist) { bestYDist = d; bestYSnap = ty - sy; bestYGuide = ty; }
      }
    }
    if (bestYDist <= T) { dy = bestYSnap; guides.push({ axis: 'y', pos: bestYGuide }); }

    return { dx, dy, guides };
  }

  // --- Draw snap guide lines ---
  function drawDragTooltip() {
    if (!dragTooltip) return;
    ctx.save();
    ctx.font = 'bold 11px Inter, system-ui, sans-serif';
    const tm = ctx.measureText(dragTooltip.text);
    const pw = tm.width + 12, ph = 20;
    const tx = Math.min(dragTooltip.x + 15, canvas.width - pw - 5);
    const ty = Math.max(dragTooltip.y - 25, 5);
    ctx.fillStyle = 'rgba(15,23,42,0.85)';
    ctx.beginPath(); ctx.roundRect(tx, ty, pw, ph, 4); ctx.fill();
    ctx.fillStyle = '#F4C430';
    ctx.textBaseline = 'middle';
    ctx.fillText(dragTooltip.text, tx + 6, ty + ph / 2);
    ctx.restore();
  }

  function drawSnapGuides() {
    if (!snapGuides.length) return;
    ctx.save();
    ctx.strokeStyle = '#ef4444'; // red guide lines
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);
    for (const g of snapGuides) {
      ctx.beginPath();
      if (g.axis === 'x') {
        ctx.moveTo(g.pos + 0.5, 0);
        ctx.lineTo(g.pos + 0.5, canvas.height);
      } else {
        ctx.moveTo(0, g.pos + 0.5);
        ctx.lineTo(canvas.width, g.pos + 0.5);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function updateCount() {
    $('collage-count').textContent = images.length.toString();
  }

  // --- Init canvas ---
  function initCanvas() {
    const w = +($('collage-w')?.value) || 1200;
    const h = +($('collage-h')?.value) || 800;
    canvas.width = w; canvas.height = h;
    canvas.style.display = 'block';
    $('collage-drop').style.display = 'none';
    render();
  }

  // --- Add image ---
  async function addImageFile(file) {
    const img = await loadImg(file);
    if (!img) return;
    const src = document.createElement('canvas');
    src.width = img.naturalWidth; src.height = img.naturalHeight;
    src.getContext('2d').drawImage(img, 0, 0);

    if (!canvas.width || canvas.style.display === 'none') initCanvas();

    const maxDim = Math.min(canvas.width * 0.4, canvas.height * 0.4);
    const scale = Math.min(maxDim / src.width, maxDim / src.height, 1);
    const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
    const ox = 20 + Math.random() * Math.max(0, canvas.width - w - 40);
    const oy = 20 + Math.random() * Math.max(0, canvas.height - h - 40);

    const obj = makeImgObj(src, Math.round(ox), Math.round(oy), w, h);
    saveState();
    images.push(obj);
    selected = obj;
    updateCount(); render();
  }

  // --- Drop zone ---
  setupDropzone($('collage-drop'), $('collage-files-drop'), async (file) => {
    await addImageFile(file);
  }, { multiple: true });

  // --- Add button ---
  const addBtn = $('collage-add-btn');
  const addInput = $('collage-files');
  addBtn?.addEventListener('click', () => addInput?.click());
  addInput?.addEventListener('change', async (e) => {
    for (const f of e.target.files) await addImageFile(f);
    addInput.value = '';
  });

  // --- Add from Library ---
  $('btn-collage-from-lib')?.addEventListener('click', () => {
    openLibraryPicker(async (items) => {
      for (const item of items) {
        const img = new Image();
        img.src = item.dataUrl;
        await new Promise(r => { img.onload = r; img.onerror = r; });
        const src = document.createElement('canvas');
        src.width = img.naturalWidth; src.height = img.naturalHeight;
        src.getContext('2d').drawImage(img, 0, 0);

        if (!canvas.width || canvas.style.display === 'none') initCanvas();

        const maxDim = Math.min(canvas.width * 0.4, canvas.height * 0.4);
        const scale = Math.min(maxDim / src.width, maxDim / src.height, 1);
        const w = Math.round(src.width * scale), h = Math.round(src.height * scale);
        const ox = 20 + Math.random() * Math.max(0, canvas.width - w - 40);
        const oy = 20 + Math.random() * Math.max(0, canvas.height - h - 40);

        const obj = makeImgObj(src, Math.round(ox), Math.round(oy), w, h);
        saveState();
        images.push(obj);
        selected = obj;
        updateCount(); render();
      }
    });
  });

  // --- Add text ---
  let textPlaceMode = false;
  $('btn-coll-add-text')?.addEventListener('click', () => {
    if (canvas.style.display === 'none') initCanvas();
    textPlaceMode = true;
    canvas.style.cursor = 'text';
    $('btn-coll-add-text')?.classList.add('active');
  });

  // Double-click to edit text
  let panMode = false; // true when double-clicked an image to pan within frame

  canvas.addEventListener('dblclick', (e) => {
    const { x, y } = toCanvas(e);
    const hit = hitImage(x, y);
    if (hit?.type === 'text') {
      selected = hit; selection = [hit];
      hit.editing = true;
      panMode = false; render();
    } else if (hit && !hit.type) {
      // Double-click image: enter pan/crop mode
      selected = hit; selection = [hit];
      panMode = true; render();
    }
  });

  // Text editing keyboard handler
  document.addEventListener('keydown', (e) => {
    if (currentMode !== 'collage') return;
    const editingText = selected?.type === 'text' && selected?.editing;
    if (!editingText) return;

    if (e.key === 'Escape') {
      selected.editing = false;
      if (!selected.text.trim()) { images = images.filter(o => o !== selected); selected = null; selection = []; updateCount(); }
      render(); return;
    }
    if (e.key === 'Backspace') { e.preventDefault(); selected.text = selected.text.slice(0, -1); render(); return; }
    if (e.key === 'Enter') { selected.text += '\n'; render(); return; }
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault(); selected.text += e.key; render(); return;
    }
  });

  // --- Zoom (Ctrl+wheel) ---
  canvas.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel = Math.max(0.2, Math.min(5, zoomLevel + delta));
    canvas.style.transform = `scale(${zoomLevel})`;
    canvas.style.transformOrigin = 'center center';
  }, { passive: false });

  // Reset zoom
  canvas.addEventListener('dblclick', (e) => {
    if (e.ctrlKey) { zoomLevel = 1; canvas.style.transform = ''; }
  });

  // --- Background image ---
  const bgImgBtn = $('collage-bg-img-btn');
  const bgImgInput = $('collage-bg-file');
  bgImgBtn?.addEventListener('click', () => bgImgInput?.click());
  bgImgInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const img = await loadImg(file); if (!img) return;
    bgImage = document.createElement('canvas'); bgImage.width = img.naturalWidth; bgImage.height = img.naturalHeight;
    bgImage.getContext('2d').drawImage(img, 0, 0);
    bgImgInput.value = ''; render();
  });
  $('collage-bg-type')?.addEventListener('change', (e) => {
    if (bgImgBtn) bgImgBtn.style.display = e.target.value === 'image' ? '' : 'none';
  });

  // --- Canvas resize + BG ---
  $('btn-collage-resize')?.addEventListener('click', () => {
    saveState();
    canvas.width = +($('collage-w')?.value) || 1200;
    canvas.height = +($('collage-h')?.value) || 800;
    render();
  });

  // Fit canvas to content bounds
  $('btn-collage-fit')?.addEventListener('click', () => {
    if (!images.length) return; saveState();
    let maxX = 0, maxY = 0;
    for (const o of images) {
      const bw = o.borderWidth || 0;
      maxX = Math.max(maxX, o.x + o.w + bw + 20);
      maxY = Math.max(maxY, o.y + o.h + bw + 20);
    }
    canvas.width = Math.round(maxX);
    canvas.height = Math.round(maxY);
    $('collage-w').value = canvas.width;
    $('collage-h').value = canvas.height;
    render();
  });
  ['collage-bg', 'collage-bg2', 'collage-bg-type'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', render);
    document.getElementById(id)?.addEventListener('change', render);
  });

  // --- Quick arrange ---
  // Helper: get image's natural aspect ratio
  function imgRatio(o) { return o.src ? (o.src.width / o.src.height) : (o.w / o.h || 1); }

  // Helper: fit image to a max cell size preserving ratio
  function fitToCell(o, maxW, maxH) {
    const r = imgRatio(o);
    if (r > maxW / maxH) { o.w = maxW; o.h = Math.round(maxW / r); }
    else { o.h = maxH; o.w = Math.round(maxH * r); }
  }

  $('btn-arrange-grid')?.addEventListener('click', () => {
    const imgs = (selection.length > 1 ? selection : images).filter(o => !o.type); if (!imgs.length) return; saveState();
    const cols = Math.ceil(Math.sqrt(imgs.length)); const gap = 15;
    const cellW = Math.floor((canvas.width * 0.85 - (cols + 1) * gap) / cols);
    const cellH = Math.round(cellW * 0.75);
    const rows = Math.ceil(imgs.length / cols);
    const startX = (canvas.width - (cols * cellW + (cols - 1) * gap)) / 2;
    const startY = (canvas.height - (rows * cellH + (rows - 1) * gap)) / 2;
    imgs.forEach((o, i) => {
      fitToCell(o, cellW, cellH);
      const col = i % cols, row = Math.floor(i / cols);
      o.x = startX + col * (cellW + gap) + (cellW - o.w) / 2;
      o.y = startY + row * (cellH + gap) + (cellH - o.h) / 2;
    });
    render();
  });

  $('btn-arrange-row')?.addEventListener('click', () => {
    const imgs = (selection.length > 1 ? selection : images).filter(o => !o.type); if (!imgs.length) return; saveState();
    const gap = 15; const pad = 20;
    const targetH = 300; // reasonable image height
    // Size each to same height, proportional width
    imgs.forEach(o => { fitToCell(o, 600, targetH); });
    let totalW = imgs.reduce((s, o) => s + o.w, 0) + (imgs.length - 1) * gap + pad * 2;
    let totalH = Math.max(...imgs.map(o => o.h)) + pad * 2;
    // Expand canvas if needed
    if (totalW > canvas.width) { canvas.width = totalW; $('collage-w').value = totalW; }
    if (totalH > canvas.height) { canvas.height = totalH; $('collage-h').value = totalH; }
    let x = (canvas.width - totalW + pad * 2) / 2 + pad;
    imgs.forEach(o => {
      o.x = x; o.y = (canvas.height - o.h) / 2;
      x += o.w + gap;
    });
    render();
  });

  $('btn-arrange-col')?.addEventListener('click', () => {
    const imgs = (selection.length > 1 ? selection : images).filter(o => !o.type); if (!imgs.length) return; saveState();
    const gap = 15; const pad = 20;
    const targetW = 400; // reasonable image width
    imgs.forEach(o => { fitToCell(o, targetW, 600); });
    let totalH = imgs.reduce((s, o) => s + o.h, 0) + (imgs.length - 1) * gap + pad * 2;
    let totalW = Math.max(...imgs.map(o => o.w)) + pad * 2;
    // Expand canvas if needed
    if (totalH > canvas.height) { canvas.height = totalH; $('collage-h').value = totalH; }
    if (totalW > canvas.width) { canvas.width = totalW; $('collage-w').value = totalW; }
    let y = (canvas.height - totalH + pad * 2) / 2 + pad;
    imgs.forEach(o => {
      o.x = (canvas.width - o.w) / 2; o.y = y;
      y += o.h + gap;
    });
    render();
  });

  $('btn-arrange-stack')?.addEventListener('click', () => {
    const imgs = (selection.length > 1 ? selection : images).filter(o => !o.type); if (!imgs.length) return; saveState();
    const maxW = canvas.width * 0.5, maxH = canvas.height * 0.5;
    imgs.forEach((o, i) => {
      fitToCell(o, maxW, maxH);
      o.x = (canvas.width - o.w) / 2 + i * 25;
      o.y = (canvas.height - o.h) / 2 + i * 25;
    });
    render();
  });

  // --- Templates ---
  $('btn-tpl-polaroid')?.addEventListener('click', () => {
    const imgs = (selection.length > 1 ? selection : images).filter(o => !o.type); if (!imgs.length) return; saveState();
    const sz = Math.min(canvas.width, canvas.height) * 0.35;
    imgs.forEach((o, i) => {
      o.w = sz; o.h = sz;
      o.x = canvas.width / 2 + (Math.random() - 0.5) * canvas.width * 0.5 - sz / 2;
      o.y = canvas.height / 2 + (Math.random() - 0.5) * canvas.height * 0.4 - sz / 2;
      o.rotation = Math.round((Math.random() - 0.5) * 30);
      o.borderWidth = Math.round(sz * 0.04);
      o.borderColor = '#ffffff';
      o.shadowEnabled = true; o.shadowBlur = 15; o.shadowColor = '#000000';
    });
    render();
  });

  $('btn-tpl-filmstrip')?.addEventListener('click', () => {
    const imgs = images.filter(o => !o.type); if (!imgs.length) return; saveState();
    const gap = 8;
    const cellH = canvas.height - gap * 2;
    const cellW = Math.round(cellH * 0.7);
    const totalW = imgs.length * cellW + (imgs.length - 1) * gap;
    const startX = Math.max(gap, (canvas.width - totalW) / 2);
    imgs.forEach((o, i) => {
      o.x = startX + i * (cellW + gap); o.y = gap; o.w = cellW; o.h = cellH;
      o.rotation = 0; o.borderWidth = 3; o.borderColor = '#1e293b';
      o.shadowEnabled = false; o.cornerRadius = 4;
    });
    render();
  });

  $('btn-tpl-magazine')?.addEventListener('click', () => {
    const imgs = images.filter(o => !o.type); if (!imgs.length) return; saveState();
    const gap = 12;
    if (imgs.length >= 1) { const o = imgs[0]; o.x = gap; o.y = gap; o.w = canvas.width * 0.6 - gap; o.h = canvas.height - gap * 2; o.rotation = 0; }
    if (imgs.length >= 2) { const o = imgs[1]; o.x = canvas.width * 0.6 + gap; o.y = gap; o.w = canvas.width * 0.4 - gap * 2; o.h = canvas.height * 0.5 - gap; o.rotation = 0; }
    if (imgs.length >= 3) { const o = imgs[2]; o.x = canvas.width * 0.6 + gap; o.y = canvas.height * 0.5 + gap; o.w = canvas.width * 0.4 - gap * 2; o.h = canvas.height * 0.5 - gap * 2; o.rotation = 0; }
    for (let i = 3; i < imgs.length; i++) { const o = imgs[i]; o.x = gap + (i - 3) * 60; o.y = canvas.height - 80; o.w = 70; o.h = 70; o.rotation = 0; }
    render();
  });

  // --- Selected item properties ---
  let _propSaveTimer = null;
  function applyToSelected(fn) {
    if (!selected) return; fn(selected); render();
    // Debounced save: captures state after rapid slider changes settle
    clearTimeout(_propSaveTimer);
    _propSaveTimer = setTimeout(saveState, 500);
  }

  let lastSel = null;
  setInterval(() => {
    if (selected !== lastSel) { lastSel = selected; syncUI(); }
  }, 200);

  function syncUI() {
    if (!selected) return;
    const el = (id) => document.getElementById(id);
    if (el('coll-item-border')) el('coll-item-border').checked = selected.borderWidth > 0;
    if (el('coll-item-border-color')) el('coll-item-border-color').value = selected.borderColor;
    if (el('coll-item-border-width')) el('coll-item-border-width').value = selected.borderWidth;
    if (el('coll-item-shadow')) el('coll-item-shadow').checked = selected.shadowEnabled;
    if (el('coll-item-shadow-color')) el('coll-item-shadow-color').value = selected.shadowColor;
    if (el('coll-item-shadow-blur')) el('coll-item-shadow-blur').value = selected.shadowBlur;
    if (el('coll-item-radius')) el('coll-item-radius').value = selected.cornerRadius;
    if (el('coll-item-filter')) el('coll-item-filter').value = selected.imgFilter;
    if (el('coll-item-opacity')) el('coll-item-opacity').value = Math.round(selected.opacity * 100);
    if (el('coll-item-blend')) el('coll-item-blend').value = selected.blendMode || 'source-over';
    if (el('coll-edge-left')) el('coll-edge-left').value = selected.fadeLeft || 0;
    if (el('coll-edge-right')) el('coll-edge-right').value = selected.fadeRight || 0;
    if (el('coll-edge-top')) el('coll-edge-top').value = selected.fadeTop || 0;
    if (el('coll-edge-bottom')) el('coll-edge-bottom').value = selected.fadeBottom || 0;
    // Text properties
    if (selected.type === 'text') {
      if (el('coll-text-color')) el('coll-text-color').value = selected.color || '#ffffff';
      if (el('coll-text-size')) el('coll-text-size').value = selected.fontSize || 36;
      if (el('coll-text-font')) el('coll-text-font').value = selected.fontFamily || 'Inter, system-ui, sans-serif';
    }
    if (el('coll-item-edge-color')) el('coll-item-edge-color').value = selected.edgeColor || '#000000';
  }

  const propMap = [
    ['coll-item-border', (o,el) => { o.borderWidth = el.checked ? (+($('coll-item-border-width')?.value)||6) : 0; }],
    ['coll-item-border-color', (o,el) => { o.borderColor = el.value; }],
    ['coll-item-border-width', (o,el) => { if ($('coll-item-border')?.checked) o.borderWidth = +el.value||0; }],
    ['coll-item-shadow', (o,el) => { o.shadowEnabled = el.checked; }],
    ['coll-item-shadow-color', (o,el) => { o.shadowColor = el.value; }],
    ['coll-item-shadow-blur', (o,el) => { o.shadowBlur = +el.value||12; }],
    ['coll-item-radius', (o,el) => { o.cornerRadius = +el.value||0; }],
    ['coll-item-filter', (o,el) => { o.imgFilter = el.value; }],
    ['coll-item-opacity', (o,el) => { o.opacity = (+el.value||100)/100; }],
    ['coll-item-blend', (o,el) => { o.blendMode = el.value; }],
    ['coll-edge-left', (o,el) => { o.fadeLeft = +el.value; }],
    ['coll-edge-right', (o,el) => { o.fadeRight = +el.value; }],
    ['coll-edge-top', (o,el) => { o.fadeTop = +el.value; }],
    ['coll-edge-bottom', (o,el) => { o.fadeBottom = +el.value; }],
    ['coll-item-edge-color', (o,el) => { o.edgeColor = el.value; }],
    ['coll-text-color', (o,el) => { if (o.type === 'text') o.color = el.value; }],
    ['coll-text-size', (o,el) => { if (o.type === 'text') o.fontSize = +el.value || 36; }],
    ['coll-text-font', (o,el) => { if (o.type === 'text') o.fontFamily = el.value; }],
  ];
  propMap.forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => applyToSelected(o => fn(o, el)));
    el.addEventListener('change', () => applyToSelected(o => fn(o, el)));
  });

  // --- Layer controls ---
  function moveLayer(from, to) {
    if (!selected || from < 0 || to < 0 || to >= images.length) return;
    saveState(); images.splice(from, 1); images.splice(to, 0, selected); render();
  }
  $('btn-coll-front')?.addEventListener('click', () => { const i = images.indexOf(selected); if (i >= 0) moveLayer(i, images.length-1); });
  $('btn-coll-forward')?.addEventListener('click', () => { const i = images.indexOf(selected); if (i >= 0) moveLayer(i, i+1); });
  $('btn-coll-backward')?.addEventListener('click', () => { const i = images.indexOf(selected); if (i >= 0) moveLayer(i, i-1); });
  $('btn-coll-back')?.addEventListener('click', () => { const i = images.indexOf(selected); if (i >= 0) moveLayer(i, 0); });
  $('btn-coll-delete')?.addEventListener('click', () => {
    saveState();
    images = images.filter(o => !selection.includes(o));
    selection = []; selected = null; updateCount(); render();
  });
  $('btn-coll-deselect')?.addEventListener('click', () => { selection = []; selected = null; render(); });

  // --- Group / Ungroup ---
  function groupSelected() {
    if (selection.length < 2) return; saveState();
    try {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const o of selection) {
        minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
        maxX = Math.max(maxX, o.x + o.w); maxY = Math.max(maxY, o.y + o.h);
      }
      const gw = Math.round(maxX - minX), gh = Math.round(maxY - minY);
      if (gw < 1 || gh < 1) return;

      // Store children for later ungroup
      const children = selection.map(o => ({
        src: o.src, relX: o.x - minX, relY: o.y - minY, w: o.w, h: o.h,
        borderWidth: o.borderWidth, borderColor: o.borderColor, shadowEnabled: o.shadowEnabled,
        shadowColor: o.shadowColor, shadowBlur: o.shadowBlur, cornerRadius: o.cornerRadius,
        imgFilter: o.imgFilter, opacity: o.opacity
      }));

      // Render all selected into one group canvas
      const gc = document.createElement('canvas'); gc.width = gw; gc.height = gh;
      const gctx = gc.getContext('2d');
      for (const o of selection) {
        gctx.save();
        gctx.globalAlpha = o.opacity;
        gctx.drawImage(o.src, o.x - minX, o.y - minY, o.w, o.h);
        gctx.restore();
      }

      // Remove originals, add group
      images = images.filter(o => !selection.includes(o));
      const group = makeImgObj(gc, Math.round(minX), Math.round(minY), gw, gh);
      group.isGroup = true;
      group.children = children;
      images.push(group);
      selection = [group]; selected = group;
      updateCount(); render();
    } catch (e) { console.error('Group failed:', e); }
  }

  function ungroupSelected() {
    if (!selected?.isGroup || !selected.children) return; saveState();
    const g = selected;
    images = images.filter(o => o !== g);
    // Restore children at absolute positions
    for (const c of g.children) {
      const obj = makeImgObj(c.src, g.x + c.relX, g.y + c.relY, c.w, c.h);
      obj.borderWidth = c.borderWidth; obj.borderColor = c.borderColor;
      obj.shadowEnabled = c.shadowEnabled; obj.shadowColor = c.shadowColor;
      obj.shadowBlur = c.shadowBlur; obj.cornerRadius = c.cornerRadius;
      obj.imgFilter = c.imgFilter; obj.opacity = c.opacity;
      images.push(obj);
    }
    selection = []; selected = null;
    updateCount(); render();
  }

  $('btn-coll-group')?.addEventListener('click', groupSelected);
  $('btn-coll-ungroup')?.addEventListener('click', ungroupSelected);

  // Rotate/Flip buttons
  // --- Copy/Paste Style ---
  let copiedStyle = null;
  $('btn-coll-copy-style')?.addEventListener('click', () => {
    if (!selected) return;
    copiedStyle = {
      borderWidth: selected.borderWidth, borderColor: selected.borderColor,
      shadowEnabled: selected.shadowEnabled, shadowColor: selected.shadowColor, shadowBlur: selected.shadowBlur,
      cornerRadius: selected.cornerRadius, imgFilter: selected.imgFilter,
      opacity: selected.opacity, blendMode: selected.blendMode,
      fadeLeft: selected.fadeLeft, fadeRight: selected.fadeRight, fadeTop: selected.fadeTop, fadeBottom: selected.fadeBottom, edgeColor: selected.edgeColor,
    };
    $('footer-status').textContent = 'Style copied';
  });
  $('btn-coll-paste-style')?.addEventListener('click', () => {
    if (!copiedStyle || !selection.length) return; saveState();
    for (const o of selection) {
      if (o.type === 'text') continue; // skip text objects
      Object.assign(o, copiedStyle);
    }
    render();
    $('footer-status').textContent = `Style pasted to ${selection.length} image(s)`;
  });

  // --- Shadow Presets ---
  $('coll-shadow-preset')?.addEventListener('change', (e) => {
    if (!selected || selected.type === 'text') return; saveState();
    const preset = e.target.value;
    if (preset === 'float') {
      selected.shadowEnabled = true; selected.shadowBlur = 20; selected.shadowColor = '#000000';
    } else if (preset === 'contact') {
      selected.shadowEnabled = true; selected.shadowBlur = 5; selected.shadowColor = '#000000';
    } else if (preset === 'long') {
      selected.shadowEnabled = true; selected.shadowBlur = 35; selected.shadowColor = '#000000';
    } else if (preset === 'none') {
      selected.shadowEnabled = false;
    }
    e.target.value = ''; // reset dropdown
    render();
  });

  $('btn-coll-rot-left')?.addEventListener('click', () => {
    if (!selected) return; saveState();
    selected.rotation = ((selected.rotation || 0) - 90) % 360; render();
  });
  $('btn-coll-rot-right')?.addEventListener('click', () => {
    if (!selected) return; saveState();
    selected.rotation = ((selected.rotation || 0) + 90) % 360; render();
  });
  $('btn-coll-flip-h')?.addEventListener('click', () => {
    if (!selected) return; saveState();
    selected.flipH = !selected.flipH; render();
  });
  $('btn-coll-flip-v')?.addEventListener('click', () => {
    if (!selected) return; saveState();
    selected.flipV = !selected.flipV; render();
  });

  // --- Join Blend: auto-detect nearest edges of 2 selected images and apply directional fades ---
  function joinBlend() {
    if (selection.length !== 2) return;
    saveState();
    const [a, b] = selection;

    // Find which edges are closest
    const aCX = a.x + a.w / 2, aCY = a.y + a.h / 2;
    const bCX = b.x + b.w / 2, bCY = b.y + b.h / 2;
    const dx = bCX - aCX, dy = bCY - aCY;

    // Determine primary axis and apply per-edge fades
    const fadeAmt = 20; // default fade percentage
    if (Math.abs(dx) >= Math.abs(dy)) {
      if (dx > 0) {
        // B is right of A
        a.fadeRight = fadeAmt; b.fadeLeft = fadeAmt;
        const overlap = Math.round(Math.min(a.w, b.w) * 0.15);
        b.x = a.x + a.w - overlap;
      } else {
        // B is left of A
        a.fadeLeft = fadeAmt; b.fadeRight = fadeAmt;
        const overlap = Math.round(Math.min(a.w, b.w) * 0.15);
        b.x = a.x - b.w + overlap;
      }
      b.y = a.y + (a.h - b.h) / 2;
    } else {
      if (dy > 0) {
        // B is below A
        a.fadeBottom = fadeAmt; b.fadeTop = fadeAmt;
        const overlap = Math.round(Math.min(a.h, b.h) * 0.15);
        b.y = a.y + a.h - overlap;
      } else {
        // B is above A
        a.fadeTop = fadeAmt; b.fadeBottom = fadeAmt;
        const overlap = Math.round(Math.min(a.h, b.h) * 0.15);
        b.y = a.y - b.h + overlap;
      }
      b.x = a.x + (a.w - b.w) / 2;
    }

    // Apply join blend effect to the overlapping image
    const joinEffect = $('coll-join-effect')?.value || 'source-over';
    b.blendMode = joinEffect;

    render();
  }

  let joinMode = false;
  $('btn-coll-join')?.addEventListener('click', () => {
    joinMode = !joinMode;
    $('btn-coll-join').classList.toggle('active', joinMode);
    // If turning on and already have 2 selected, apply immediately
    if (joinMode && selection.length === 2) joinBlend();
  });

  // --- Clear ---
  $('btn-collage-clear')?.addEventListener('click', async () => {
    if (images.length) {
      const ok = await pixDialog.confirm('Clear Collage', `Remove all ${images.length} images from the collage?`, { danger: true, okText: 'Clear' });
      if (!ok) return;
    }
    images = []; selection = []; selected = null; snapGuides = [];
    updateCount(); render();
    canvas.style.display = 'none';
    $('collage-drop').style.display = '';
  });

  // --- Align functions ---
  function getSelBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const o of selection) {
      minX = Math.min(minX, o.x); minY = Math.min(minY, o.y);
      maxX = Math.max(maxX, o.x + o.w); maxY = Math.max(maxY, o.y + o.h);
    }
    return { minX, minY, maxX, maxY };
  }

  $('btn-align-left')?.addEventListener('click', () => {
    if (selection.length < 2) return; saveState();
    const target = Math.min(...selection.map(o => o.x));
    for (const o of selection) o.x = target;
    render();
  });
  $('btn-align-right')?.addEventListener('click', () => {
    if (selection.length < 2) return; saveState();
    const target = Math.max(...selection.map(o => o.x + o.w));
    for (const o of selection) o.x = target - o.w;
    render();
  });
  $('btn-align-top')?.addEventListener('click', () => {
    if (selection.length < 2) return; saveState();
    const target = Math.min(...selection.map(o => o.y));
    for (const o of selection) o.y = target;
    render();
  });
  $('btn-align-bottom')?.addEventListener('click', () => {
    if (selection.length < 2) return; saveState();
    const target = Math.max(...selection.map(o => o.y + o.h));
    for (const o of selection) o.y = target - o.h;
    render();
  });
  $('btn-align-center-h')?.addEventListener('click', () => {
    if (selection.length < 2) return; saveState();
    const avg = selection.reduce((s, o) => s + o.x + o.w / 2, 0) / selection.length;
    for (const o of selection) o.x = avg - o.w / 2;
    render();
  });
  $('btn-align-center-v')?.addEventListener('click', () => {
    if (selection.length < 2) return; saveState();
    const avg = selection.reduce((s, o) => s + o.y + o.h / 2, 0) / selection.length;
    for (const o of selection) o.y = avg - o.h / 2;
    render();
  });
  $('btn-distribute-h')?.addEventListener('click', () => {
    if (selection.length < 3) return; saveState();
    const sorted = [...selection].sort((a, b) => a.x - b.x);
    const totalW = sorted.reduce((s, o) => s + o.w, 0);
    const space = (sorted[sorted.length - 1].x + sorted[sorted.length - 1].w - sorted[0].x - totalW) / (sorted.length - 1);
    let x = sorted[0].x;
    for (const o of sorted) { o.x = x; x += o.w + space; }
    render();
  });
  $('btn-distribute-v')?.addEventListener('click', () => {
    if (selection.length < 3) return; saveState();
    const sorted = [...selection].sort((a, b) => a.y - b.y);
    const totalH = sorted.reduce((s, o) => s + o.h, 0);
    const space = (sorted[sorted.length - 1].y + sorted[sorted.length - 1].h - sorted[0].y - totalH) / (sorted.length - 1);
    let y = sorted[0].y;
    for (const o of sorted) { o.y = y; y += o.h + space; }
    render();
  });
  $('btn-center-canvas-h')?.addEventListener('click', () => {
    if (!selection.length) return; saveState();
    const b = getSelBounds();
    const dx = (canvas.width - (b.maxX - b.minX)) / 2 - b.minX;
    for (const o of selection) o.x += dx;
    render();
  });
  $('btn-center-canvas-v')?.addEventListener('click', () => {
    if (!selection.length) return; saveState();
    const b = getSelBounds();
    const dy = (canvas.height - (b.maxY - b.minY)) / 2 - b.minY;
    for (const o of selection) o.y += dy;
    render();
  });

  // --- Export ---
  function getContentBounds() {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const o of images) {
      const bw = o.borderWidth || 0;
      minX = Math.min(minX, o.x - bw); minY = Math.min(minY, o.y - bw);
      maxX = Math.max(maxX, o.x + o.w + bw); maxY = Math.max(maxY, o.y + o.h + bw);
    }
    const pad = 10;
    return { x: Math.max(0, minX - pad), y: Math.max(0, minY - pad),
             w: Math.min(canvas.width, maxX + pad) - Math.max(0, minX - pad),
             h: Math.min(canvas.height, maxY + pad) - Math.max(0, minY - pad) };
  }

  $('btn-collage-export')?.addEventListener('click', () => {
    if (!canvas.width || !images.length) return;
    const savedSel = selected; const savedSnap = snapGuides;
    selected = null; snapGuides = []; selection = []; render();

    const trim = $('collage-trim-export')?.checked;
    const fmt = $('collage-export-fmt')?.value || 'png';
    const mime = { png:'image/png', jpeg:'image/jpeg', webp:'image/webp' }[fmt] || 'image/png';
    const q = fmt === 'png' ? undefined : 0.92;

    if (trim) {
      // Export only the content area
      const b = getContentBounds();
      const trimCanvas = document.createElement('canvas');
      trimCanvas.width = b.w; trimCanvas.height = b.h;
      trimCanvas.getContext('2d').drawImage(canvas, b.x, b.y, b.w, b.h, 0, 0, b.w, b.h);
      trimCanvas.toBlob(blob => {
        chrome.runtime.sendMessage({ action:'download', url:URL.createObjectURL(blob), filename:`pixeroo/collage.${fmt==='jpeg'?'jpg':fmt}`, saveAs:true });
        selected = savedSel; snapGuides = savedSnap; selection = savedSel ? [savedSel] : []; render();
      }, mime, q);
    } else {
      canvas.toBlob(blob => {
        chrome.runtime.sendMessage({ action:'download', url:URL.createObjectURL(blob), filename:`pixeroo/collage.${fmt==='jpeg'?'jpg':fmt}`, saveAs:true });
        selected = savedSel; snapGuides = savedSnap; selection = savedSel ? [savedSel] : []; render();
      }, mime, q);
    }
  });

  // --- Save Project ---
  $('btn-collage-save')?.addEventListener('click', () => {
    if (!images.length) return;
    const footer = $('footer-status');
    if (footer) footer.textContent = 'Saving project...';

    const project = {
      version: 1,
      canvas: {
        w: canvas.width, h: canvas.height,
        bg: $('collage-bg')?.value || '#ffffff',
        bg2: $('collage-bg2')?.value || '#e2e8f0',
        bgType: $('collage-bg-type')?.value || 'solid',
      },
      images: images.map(o => ({
        data: o.src.toDataURL('image/png'),
        x: o.x, y: o.y, w: o.w, h: o.h,
        borderWidth: o.borderWidth, borderColor: o.borderColor,
        shadowEnabled: o.shadowEnabled, shadowColor: o.shadowColor, shadowBlur: o.shadowBlur,
        cornerRadius: o.cornerRadius, imgFilter: o.imgFilter,
        opacity: o.opacity, blendMode: o.blendMode, fadeLeft: o.fadeLeft, fadeRight: o.fadeRight, fadeTop: o.fadeTop, fadeBottom: o.fadeBottom, edgeColor: o.edgeColor,
        isGroup: o.isGroup || false,
      })),
    };

    const json = JSON.stringify(project);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    chrome.runtime.sendMessage({ action: 'download', url, filename: 'pixeroo/collage-project.pixeroo', saveAs: true });
    if (footer) footer.textContent = `Project saved (${(json.length / 1024).toFixed(0)} KB)`;
  });

  // --- Load Project ---
  const loadBtn = $('btn-collage-load');
  const loadInput = $('collage-load-file');
  loadBtn?.addEventListener('click', () => loadInput?.click());
  loadInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    loadInput.value = '';
    const footer = $('footer-status');
    if (footer) footer.textContent = 'Loading project...';

    try {
      const text = await file.text();
      const project = JSON.parse(text);
      if (!project.version || !project.images) throw new Error('Invalid project file');

      // Restore canvas
      const cw = project.canvas?.w || 1200, ch = project.canvas?.h || 800;
      $('collage-w').value = cw;
      $('collage-h').value = ch;
      if (project.canvas?.bg) $('collage-bg').value = project.canvas.bg;
      if (project.canvas?.bg2) $('collage-bg2').value = project.canvas.bg2;
      if (project.canvas?.bgType) $('collage-bg-type').value = project.canvas.bgType;
      canvas.width = cw; canvas.height = ch;
      canvas.style.display = 'block';
      $('collage-drop').style.display = 'none';

      // Restore images
      images = [];
      selection = []; selected = null;

      for (const imgData of project.images) {
        const img = new Image();
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imgData.data;
        });
        const src = document.createElement('canvas');
        src.width = img.naturalWidth; src.height = img.naturalHeight;
        src.getContext('2d').drawImage(img, 0, 0);

        const obj = makeImgObj(src, imgData.x, imgData.y, imgData.w, imgData.h);
        obj.borderWidth = imgData.borderWidth || 0;
        obj.borderColor = imgData.borderColor || '#ffffff';
        obj.shadowEnabled = imgData.shadowEnabled || false;
        obj.shadowColor = imgData.shadowColor || '#000000';
        obj.shadowBlur = imgData.shadowBlur || 12;
        obj.cornerRadius = imgData.cornerRadius || 0;
        obj.imgFilter = imgData.imgFilter || 'none';
        obj.opacity = imgData.opacity !== undefined ? imgData.opacity : 1;
        obj.blendMode = imgData.blendMode || 'source-over';
        obj.fadeLeft = imgData.fadeLeft || 0; obj.fadeRight = imgData.fadeRight || 0;
        obj.fadeTop = imgData.fadeTop || 0; obj.fadeBottom = imgData.fadeBottom || 0;
        obj.edgeColor = imgData.edgeColor || '#000000';
        obj.isGroup = imgData.isGroup || false;
        images.push(obj);
      }

      updateCount(); render();
      if (footer) footer.textContent = `Project loaded: ${images.length} images`;
    } catch (err) {
      console.error('Load project failed:', err);
      if (footer) footer.textContent = 'Failed to load project file';
    }
  });

  // Initial ribbon state — all disabled until images added
  updateRibbonState();
}
