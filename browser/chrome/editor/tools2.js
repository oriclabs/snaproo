// Snaproo Editor - Extended Tools Part 2
// Canvas ops, color ops, generators, social presets, analysis, quality

// ============================================================
// CATEGORY: Canvas Operations
// ============================================================

// #4 Image Overlay/Composite
function compositeImages(baseCanvas, overlayImg, x, y, opacity, blendMode) {
  const ctx = baseCanvas.getContext('2d');
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = blendMode || 'source-over';
  ctx.drawImage(overlayImg, x, y);
  ctx.restore();
}

// #8 Canvas Extend / Padding
function addPadding(canvas, top, right, bottom, left, color) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const origW = canvas.width, origH = canvas.height;

  canvas.width = origW + left + right;
  canvas.height = origH + top + bottom;
  ctx.fillStyle = color || 'transparent';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.putImageData(imgData, left, top);
}

// #9 Image Split
function splitImage(canvas, direction, parts) {
  const results = [];
  const w = canvas.width, h = canvas.height;

  for (let i = 0; i < parts; i++) {
    const tile = document.createElement('canvas');
    const tCtx = tile.getContext('2d');

    if (direction === 'horizontal') {
      const tileH = Math.floor(h / parts);
      tile.width = w; tile.height = tileH;
      tCtx.drawImage(canvas, 0, i * tileH, w, tileH, 0, 0, w, tileH);
    } else {
      const tileW = Math.floor(w / parts);
      tile.width = tileW; tile.height = h;
      tCtx.drawImage(canvas, i * tileW, 0, tileW, h, 0, 0, tileW, h);
    }
    results.push(tile);
  }
  return results;
}

// ============================================================
// CATEGORY: Color Operations
// ============================================================

// #5 Background Remover (flood-fill from edges)
function removeBackground(canvas, tolerance = 30) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width, h = canvas.height;
  const visited = new Uint8Array(w * h);

  // Get reference color from top-left corner
  const refR = data[0], refG = data[1], refB = data[2];

  function colorMatch(i) {
    return Math.abs(data[i] - refR) + Math.abs(data[i+1] - refG) + Math.abs(data[i+2] - refB) < tolerance * 3;
  }

  // Flood fill from all edges
  const queue = [];
  for (let x = 0; x < w; x++) { queue.push(x); queue.push(x + (h-1) * w); }
  for (let y = 0; y < h; y++) { queue.push(y * w); queue.push((y+1) * w - 1); }

  while (queue.length > 0) {
    const pos = queue.pop();
    if (pos < 0 || pos >= w * h || visited[pos]) continue;
    const i = pos * 4;
    if (!colorMatch(i)) continue;

    visited[pos] = 1;
    data[i+3] = 0; // Make transparent

    const x = pos % w, y = Math.floor(pos / w);
    if (x > 0) queue.push(pos - 1);
    if (x < w - 1) queue.push(pos + 1);
    if (y > 0) queue.push(pos - w);
    if (y < h - 1) queue.push(pos + w);
  }

  ctx.putImageData(imgData, 0, 0);
}

// #6 Color Replace
function replaceColor(canvas, fromR, fromG, fromB, toR, toG, toB, tolerance = 30) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const dist = Math.abs(data[i] - fromR) + Math.abs(data[i+1] - fromG) + Math.abs(data[i+2] - fromB);
    if (dist < tolerance * 3) {
      const blend = 1 - dist / (tolerance * 3);
      data[i]   = Math.round(data[i]   + (toR - data[i])   * blend);
      data[i+1] = Math.round(data[i+1] + (toG - data[i+1]) * blend);
      data[i+2] = Math.round(data[i+2] + (toB - data[i+2]) * blend);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// #21 Channel Separation
function extractChannel(canvas, channel) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const chIndex = { r: 0, g: 1, b: 2, a: 3 }[channel];

  for (let i = 0; i < data.length; i += 4) {
    if (channel === 'a') {
      const a = data[i + 3];
      data[i] = a; data[i+1] = a; data[i+2] = a; data[i+3] = 255;
    } else {
      const val = data[i + chIndex];
      data[i] = channel === 'r' ? val : 0;
      data[i+1] = channel === 'g' ? val : 0;
      data[i+2] = channel === 'b' ? val : 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// CATEGORY: Adjustments Extended
// ============================================================

// #7 Levels Adjustment (simplified: black point, white point, gamma)
function adjustLevels(canvas, blackPoint, whitePoint, gamma) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const range = whitePoint - blackPoint;

  for (let i = 0; i < data.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let val = data[i + c];
      // Remap to 0-1 based on black/white points
      val = Math.max(0, Math.min(1, (val - blackPoint) / range));
      // Apply gamma
      val = Math.pow(val, 1 / gamma);
      data[i + c] = Math.round(val * 255);
    }
  }

  ctx.putImageData(imgData, 0, 0);
}

// ============================================================
// CATEGORY: Effects Extended
// ============================================================

// #14 Pixelate Art (downscale + upscale for pixel art look)
function pixelateImage(canvas, blockSize) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const smallW = Math.ceil(w / blockSize);
  const smallH = Math.ceil(h / blockSize);

  // Downscale
  const tmp = document.createElement('canvas');
  tmp.width = smallW; tmp.height = smallH;
  const tc = tmp.getContext('2d');
  tc.imageSmoothingEnabled = false;
  tc.drawImage(canvas, 0, 0, smallW, smallH);

  // Upscale without smoothing
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(tmp, 0, 0, w, h);
  ctx.imageSmoothingEnabled = true;
}

// #10 Perspective Transform (basic 4-point mapping via triangulation)
function perspectiveTransform(canvas, srcPoints, dstPoints) {
  // Basic approach: divide into triangles and use affine transforms
  // srcPoints/dstPoints = [{x,y}, {x,y}, {x,y}, {x,y}] (TL, TR, BR, BL)
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tmp = document.createElement('canvas');
  tmp.width = canvas.width; tmp.height = canvas.height;
  const tc = tmp.getContext('2d');

  // Simple approach: draw two triangles with texture mapping
  // Triangle 1: TL, TR, BL
  drawTexturedTriangle(tc, canvas, imgData,
    srcPoints[0], srcPoints[1], srcPoints[3],
    dstPoints[0], dstPoints[1], dstPoints[3]);
  // Triangle 2: TR, BR, BL
  drawTexturedTriangle(tc, canvas, imgData,
    srcPoints[1], srcPoints[2], srcPoints[3],
    dstPoints[1], dstPoints[2], dstPoints[3]);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(tmp, 0, 0);
}

function drawTexturedTriangle(ctx, srcCanvas, imgData, s0, s1, s2, d0, d1, d2) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  // Compute affine transform matrix
  const denom = (s0.x * (s1.y - s2.y) + s1.x * (s2.y - s0.y) + s2.x * (s0.y - s1.y));
  if (Math.abs(denom) < 0.001) { ctx.restore(); return; }

  const a = (d0.x * (s1.y - s2.y) + d1.x * (s2.y - s0.y) + d2.x * (s0.y - s1.y)) / denom;
  const b = (d0.x * (s1.x - s2.x) + d1.x * (s2.x - s0.x) + d2.x * (s0.x - s1.x)) / -denom;
  const c = (d0.y * (s1.y - s2.y) + d1.y * (s2.y - s0.y) + d2.y * (s0.y - s1.y)) / denom;
  const d = (d0.y * (s1.x - s2.x) + d1.y * (s2.x - s0.x) + d2.y * (s0.x - s1.x)) / -denom;
  const e = d0.x - a * s0.x - b * s0.y;
  const f = d0.y - c * s0.x - d * s0.y;

  ctx.setTransform(a, c, b, d, e, f);
  ctx.drawImage(srcCanvas, 0, 0);
  ctx.restore();
}

// ============================================================
// CATEGORY: Generators (create images from scratch)
// ============================================================

// #15 Gradient Generator
function generateGradient(width, height, type, stops) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  let gradient;
  if (type === 'radial') {
    gradient = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, Math.max(width, height)/2);
  } else {
    gradient = ctx.createLinearGradient(0, 0, width, height);
  }

  stops.forEach(s => gradient.addColorStop(s.pos, s.color));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  return canvas;
}

// #16 Pattern Generator
function generatePattern(width, height, type, color1, color2, cellSize) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, width, height);

  if (type === 'checkerboard') {
    ctx.fillStyle = color2;
    for (let y = 0; y < height; y += cellSize) {
      for (let x = 0; x < width; x += cellSize) {
        if (((x / cellSize) + (y / cellSize)) % 2 === 0) {
          ctx.fillRect(x, y, cellSize, cellSize);
        }
      }
    }
  } else if (type === 'stripes-h') {
    ctx.fillStyle = color2;
    for (let y = 0; y < height; y += cellSize * 2) {
      ctx.fillRect(0, y, width, cellSize);
    }
  } else if (type === 'stripes-v') {
    ctx.fillStyle = color2;
    for (let x = 0; x < width; x += cellSize * 2) {
      ctx.fillRect(x, 0, cellSize, height);
    }
  } else if (type === 'dots') {
    ctx.fillStyle = color2;
    const r = cellSize / 3;
    for (let y = cellSize/2; y < height; y += cellSize) {
      for (let x = cellSize/2; x < width; x += cellSize) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (type === 'noise') {
    const imgData = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < imgData.data.length; i += 4) {
      const v = Math.random() * 255;
      imgData.data[i] = v; imgData.data[i+1] = v; imgData.data[i+2] = v; imgData.data[i+3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas;
}

// #18 Placeholder Image Generator
function generatePlaceholder(width, height, bgColor, textColor, text) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = bgColor || '#94a3b8';
  ctx.fillRect(0, 0, width, height);

  const label = text || `${width} x ${height}`;
  const fontSize = Math.max(12, Math.min(width / label.length * 1.5, height / 4));
  ctx.fillStyle = textColor || '#ffffff';
  ctx.font = `bold ${fontSize}px Inter, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, width / 2, height / 2);

  return canvas;
}

// Social media banner presets { name, w, h }
const socialBannerPresets = [
  { name: 'YouTube Thumbnail', w: 1280, h: 720 },
  { name: 'Facebook Cover', w: 820, h: 312 },
  { name: 'Twitter Header', w: 1500, h: 500 },
  { name: 'LinkedIn Banner', w: 1584, h: 396 },
  { name: 'Instagram Post', w: 1080, h: 1080 },
  { name: 'Instagram Story', w: 1080, h: 1920 },
  { name: 'Pinterest Pin', w: 1000, h: 1500 },
  { name: 'Business Card', w: 1050, h: 600 },
  { name: 'A4 Canvas', w: 2480, h: 3508 },
  { name: 'HD Wallpaper', w: 1920, h: 1080 },
];

function generateSocialBanner(preset, bgColor, bgColor2, gradType, text, textColor) {
  const c = document.createElement('canvas');
  c.width = preset.w; c.height = preset.h;
  const ctx = c.getContext('2d');
  if (gradType && gradType !== 'solid') {
    const grad = gradType === 'radial'
      ? ctx.createRadialGradient(c.width/2, c.height/2, 0, c.width/2, c.height/2, Math.max(c.width,c.height)/2)
      : ctx.createLinearGradient(0, 0, c.width, c.height);
    grad.addColorStop(0, bgColor || '#1e293b');
    grad.addColorStop(1, bgColor2 || '#0f172a');
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = bgColor || '#1e293b';
  }
  ctx.fillRect(0, 0, c.width, c.height);
  if (text) {
    const fs = Math.max(16, Math.min(c.width / text.length * 1.2, c.height / 3));
    ctx.fillStyle = textColor || '#ffffff';
    ctx.font = `bold ${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, c.width / 2, c.height / 2);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText(preset.name + ' \u2014 ' + c.width + 'x' + c.height, c.width - 8, c.height - 6);
  return c;
}

function generateAvatar(size, initials, bgColor, textColor) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.closePath();
  ctx.fillStyle = bgColor || '#6366f1'; ctx.fill();
  const t = (initials || 'AB').substring(0, 2).toUpperCase();
  ctx.fillStyle = textColor || '#ffffff';
  ctx.font = `bold ${size*0.42}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(t, size/2, size/2 * 1.05);
  return c;
}

function generateColorSwatch(colors, swatchW, swatchH) {
  swatchW = swatchW || 120; swatchH = swatchH || 120;
  const cols = Math.min(colors.length, 6);
  const rows = Math.ceil(colors.length / cols);
  const gap = 8, pad = 16;
  const totalW = cols * swatchW + (cols - 1) * gap + pad * 2;
  const totalH = rows * (swatchH + 20) + (rows - 1) * gap + pad * 2;
  const c = document.createElement('canvas');
  c.width = totalW; c.height = totalH;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, totalW, totalH);
  colors.forEach((color, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = pad + col * (swatchW + gap), y = pad + row * (swatchH + 20 + gap);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, swatchW, swatchH, 6); ctx.fill();
    ctx.fillStyle = '#334155'; ctx.font = '11px monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText(color.toUpperCase(), x + swatchW / 2, y + swatchH + 4);
  });
  return c;
}

function generateNoise(width, height, type, intensity) {
  const c = document.createElement('canvas');
  c.width = width; c.height = height;
  const ctx = c.getContext('2d');
  const imgData = ctx.createImageData(width, height);
  const d = imgData.data;
  intensity = intensity || 1;
  for (let i = 0; i < d.length; i += 4) {
    if (type === 'perlin') {
      const px = (i/4) % width, py = Math.floor(i/4/width);
      const v = Math.floor((_simpleNoise(px*0.02, py*0.02)*0.5+0.5)*255*intensity);
      d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
    } else if (type === 'color') {
      d[i] = Math.floor(Math.random()*255*intensity);
      d[i+1] = Math.floor(Math.random()*255*intensity);
      d[i+2] = Math.floor(Math.random()*255*intensity);
      d[i+3] = 255;
    } else {
      const v = Math.floor(Math.random()*255*intensity);
      d[i] = d[i+1] = d[i+2] = v; d[i+3] = 255;
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return c;
}
function _simpleNoise(x, y) {
  const n = Math.sin(x*127.1+y*311.7)*43758.5453;
  const n2 = Math.sin(x*269.5+y*183.3)*43758.5453;
  return (n - Math.floor(n))*0.5 + (n2 - Math.floor(n2))*0.5 - 0.5;
}

function generateLetterFavicon(letter, size, bgColor, textColor, rounded) {
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  if (rounded) {
    ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.closePath();
    ctx.fillStyle = bgColor || '#F4C430'; ctx.fill();
  } else {
    ctx.fillStyle = bgColor || '#F4C430';
    ctx.beginPath(); ctx.roundRect(0, 0, size, size, size*0.15); ctx.fill();
  }
  ctx.fillStyle = textColor || '#1e293b';
  ctx.font = `bold ${size*0.6}px Inter, system-ui, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((letter || 'P').substring(0, 2), size/2, size/2 * 1.05);
  return c;
}

// ============================================================
// CATEGORY: Social Media Presets
// ============================================================

const SOCIAL_PRESETS = {
  'ig-post':     { name: 'Instagram Post', w: 1080, h: 1080 },
  'ig-story':    { name: 'Instagram Story', w: 1080, h: 1920 },
  'ig-landscape':{ name: 'Instagram Landscape', w: 1080, h: 566 },
  'tw-post':     { name: 'Twitter Post', w: 1200, h: 675 },
  'tw-header':   { name: 'Twitter Header', w: 1500, h: 500 },
  'fb-post':     { name: 'Facebook Post', w: 1200, h: 630 },
  'fb-cover':    { name: 'Facebook Cover', w: 820, h: 312 },
  'yt-thumb':    { name: 'YouTube Thumbnail', w: 1280, h: 720 },
  'li-post':     { name: 'LinkedIn Post', w: 1200, h: 627 },
  'li-banner':   { name: 'LinkedIn Banner', w: 1584, h: 396 },
  'pin-standard':{ name: 'Pinterest Pin', w: 1000, h: 1500 },
  'og-image':    { name: 'OG Image', w: 1200, h: 630 },
};

async function resizeForSocial(canvas, presetKey) {
  const preset = SOCIAL_PRESETS[presetKey];
  if (!preset) return null;

  const result = document.createElement('canvas');
  result.width = preset.w; result.height = preset.h;
  const ctx = result.getContext('2d');

  // Try smart crop (content-aware) if available
  if (typeof smartcrop !== 'undefined') {
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise(r => { img.onload = r; });

      const sc = await smartcrop.crop(img, { width: preset.w, height: preset.h });
      const c = sc.topCrop;
      URL.revokeObjectURL(img.src);

      ctx.drawImage(canvas, c.x, c.y, c.width, c.height, 0, 0, preset.w, preset.h);
      return { canvas: result, name: preset.name, w: preset.w, h: preset.h };
    } catch {}
  }

  // Fallback: center crop
  const scale = Math.max(preset.w / canvas.width, preset.h / canvas.height);
  const sw = preset.w / scale, sh = preset.h / scale;
  const sx = (canvas.width - sw) / 2, sy = (canvas.height - sh) / 2;

  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, preset.w, preset.h);
  return { canvas: result, name: preset.name, w: preset.w, h: preset.h };
}

// #12 Favicon Preview
function generateFaviconPreviews(canvas) {
  const sizes = [16, 32, 48, 64, 180]; // browser tab, bookmark, taskbar, high-res, apple-touch
  return sizes.map(s => {
    const c = document.createElement('canvas');
    c.width = s; c.height = s;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(canvas, 0, 0, s, s);
    return { size: s, canvas: c };
  });
}

// ============================================================
// CATEGORY: Analysis
// ============================================================

// #11 Aspect Ratio Calculator
function calculateAspectRatio(width, height) {
  function gcd(a, b) { return b === 0 ? a : gcd(b, a % b); }
  const g = gcd(width, height);
  return { ratio: `${width/g}:${height/g}`, decimal: (width/height).toFixed(4) };
}

// Common sizes for reference
const COMMON_RATIOS = [
  { name: '1:1 (Square)', w: 1, h: 1 },
  { name: '4:3 (Classic)', w: 4, h: 3 },
  { name: '3:2 (Photo)', w: 3, h: 2 },
  { name: '16:9 (Widescreen)', w: 16, h: 9 },
  { name: '16:10 (Laptop)', w: 16, h: 10 },
  { name: '21:9 (Ultrawide)', w: 21, h: 9 },
  { name: '9:16 (Mobile)', w: 9, h: 16 },
  { name: 'A4 Paper', w: 210, h: 297 },
];

// #17 SSIM (Structural Similarity Index) - simplified
function computeSSIM(canvasA, canvasB) {
  const w = Math.min(canvasA.width, canvasB.width);
  const h = Math.min(canvasA.height, canvasB.height);

  const cA = document.createElement('canvas'); cA.width = w; cA.height = h;
  cA.getContext('2d').drawImage(canvasA, 0, 0, w, h);
  const cB = document.createElement('canvas'); cB.width = w; cB.height = h;
  cB.getContext('2d').drawImage(canvasB, 0, 0, w, h);

  const dA = cA.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
  const dB = cB.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;

  const n = w * h;
  let sumA = 0, sumB = 0, sumA2 = 0, sumB2 = 0, sumAB = 0;

  for (let i = 0; i < dA.length; i += 4) {
    const a = (dA[i] * 0.299 + dA[i+1] * 0.587 + dA[i+2] * 0.114); // luminance
    const b = (dB[i] * 0.299 + dB[i+1] * 0.587 + dB[i+2] * 0.114);
    sumA += a; sumB += b;
    sumA2 += a * a; sumB2 += b * b;
    sumAB += a * b;
  }

  const meanA = sumA / n, meanB = sumB / n;
  const varA = sumA2 / n - meanA * meanA;
  const varB = sumB2 / n - meanB * meanB;
  const covAB = sumAB / n - meanA * meanB;

  const c1 = (0.01 * 255) ** 2;
  const c2 = (0.03 * 255) ** 2;

  const ssim = ((2 * meanA * meanB + c1) * (2 * covAB + c2)) /
               ((meanA ** 2 + meanB ** 2 + c1) * (varA + varB + c2));

  return Math.max(0, Math.min(1, ssim));
}

// #20 Metadata Stripper (re-encode to strip all metadata)
async function stripMetadata(canvas, format, quality) {
  const mime = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' }[format] || 'image/png';
  const q = ['jpeg', 'webp'].includes(format) ? quality : undefined;
  const blob = await new Promise(r => canvas.toBlob(r, mime, q));
  return blob;
}

// #22 Image to ASCII Art
function imageToAscii(canvas, cols = 80) {
  const chars = ' .:-=+*#%@';
  const aspect = 0.5; // character aspect ratio compensation

  const rows = Math.round(cols * (canvas.height / canvas.width) * aspect);
  const tmp = document.createElement('canvas');
  tmp.width = cols; tmp.height = rows;
  const ctx = tmp.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(canvas, 0, 0, cols, rows);
  const data = ctx.getImageData(0, 0, cols, rows).data;

  let ascii = '';
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const brightness = (data[i] * 0.299 + data[i+1] * 0.587 + data[i+2] * 0.114) / 255;
      ascii += chars[Math.floor(brightness * (chars.length - 1))];
    }
    ascii += '\n';
  }
  return ascii;
}

// ============================================================
// CATEGORY: Collage
// ============================================================

// #23 Collage Maker (multi-layout with effects)
function createCollage(canvases, opts) {
  // Support legacy call signature: createCollage(canvases, cols, spacing, bgColor)
  if (typeof opts === 'number') opts = { cols: opts, spacing: arguments[2], bgColor: arguments[3] };
  opts = opts || {};

  if (canvases.length === 0) return null;

  const layout = opts.layout || 'grid';
  const cols = opts.cols || 2;
  const borderPad = (!!opts.border) ? (opts.borderWidth || 6) : (opts.filter === 'polaroid' ? 10 : 0);
  const spacing = (opts.spacing ?? 10) + borderPad * 2; // extra spacing for border frame
  const fit = opts.fit || 'cover';
  const bgColor = opts.bgColor || '#ffffff';
  const bgColor2 = opts.bgColor2 || '#e2e8f0';
  const bgType = opts.bgType || 'solid';
  const radius = opts.radius || 0;
  const shadow = !!opts.shadow;
  const border = !!opts.border;
  const filter = opts.filter || 'none';
  const blendMode = opts.blendMode || 'source-over';
  const cellOpacity = opts.opacity !== undefined ? opts.opacity : 1;
  const targetW = opts.width || 1200;
  const polaroid = filter === 'polaroid';

  let cellW, cellH, totalW, totalH, positions = [];

  if (layout === 'strip-h') {
    const stripH = 400;
    let x = spacing;
    canvases.forEach(c => {
      const scale = stripH / c.height;
      const w = Math.round(c.width * scale);
      positions.push({ x, y: spacing, w, h: stripH });
      x += w + spacing;
    });
    totalW = x; totalH = stripH + spacing * 2;
  } else if (layout === 'strip-v') {
    const stripW = targetW - spacing * 2;
    let y = spacing;
    canvases.forEach(c => {
      const scale = stripW / c.width;
      const h = Math.round(c.height * scale);
      positions.push({ x: spacing, y, w: stripW, h });
      y += h + spacing;
    });
    totalW = targetW; totalH = y;
  } else if (layout === 'hero') {
    const heroH = Math.round(targetW * 0.5);
    positions.push({ x: spacing, y: spacing, w: targetW - spacing * 2, h: heroH });
    const gridCols = Math.max(2, cols);
    const remaining = canvases.length - 1;
    const gridRows = Math.ceil(remaining / gridCols);
    cellW = Math.floor((targetW - (gridCols + 1) * spacing) / gridCols);
    cellH = Math.round(cellW * 0.75);
    for (let i = 0; i < remaining; i++) {
      const col = i % gridCols;
      const row = Math.floor(i / gridCols);
      positions.push({
        x: spacing + col * (cellW + spacing),
        y: heroH + spacing * 2 + row * (cellH + spacing),
        w: cellW, h: cellH
      });
    }
    totalW = targetW;
    totalH = heroH + spacing * 2 + gridRows * (cellH + spacing) + spacing;
  } else if (layout === 'masonry') {
    cellW = Math.floor((targetW - (cols + 1) * spacing) / cols);
    const colHeights = new Array(cols).fill(spacing);
    canvases.forEach(c => {
      let minCol = 0;
      for (let j = 1; j < cols; j++) { if (colHeights[j] < colHeights[minCol]) minCol = j; }
      const scale = cellW / c.width;
      const h = Math.round(c.height * scale);
      positions.push({ x: spacing + minCol * (cellW + spacing), y: colHeights[minCol], w: cellW, h });
      colHeights[minCol] += h + spacing;
    });
    totalW = targetW; totalH = Math.max(...colHeights) + spacing;
  } else {
    // Grid — aspect-ratio preserving layout
    const actualCols = Math.min(cols, canvases.length);
    const scales = opts.scales || []; // per-image scale factors (1 = default)

    if (actualCols >= canvases.length) {
      // Single row (landscape): normalize to same height, each image keeps its aspect ratio
      // Find the target row height: use a reasonable base height
      const baseH = 400;
      let x = spacing;
      canvases.forEach((c, i) => {
        const s = scales[i] || 1;
        const imgH = baseH * s;
        const imgW = Math.round((c.width / c.height) * imgH);
        positions.push({ x, y: spacing, w: imgW, h: Math.round(imgH) });
        x += imgW + spacing;
      });
      totalW = x;
      const maxH = Math.max(...positions.map(p => p.h));
      // Center shorter images vertically
      positions.forEach(p => { p.y = spacing + Math.round((maxH - p.h) / 2); });
      totalH = maxH + spacing * 2;
    } else if (actualCols === 1) {
      // Single column (portrait): normalize to same width, each image keeps its aspect ratio
      const baseW = targetW - spacing * 2;
      let y = spacing;
      canvases.forEach((c, i) => {
        const s = scales[i] || 1;
        const imgW = Math.round(baseW * s);
        const imgH = Math.round((c.height / c.width) * imgW);
        positions.push({ x: spacing + Math.round((baseW - imgW) / 2), y, w: imgW, h: imgH });
        y += imgH + spacing;
      });
      totalW = targetW;
      totalH = y;
    } else {
      // Multi-row grid: fixed cell size, wraps at actualCols
      cellW = Math.floor((targetW - (actualCols + 1) * spacing) / actualCols);
      const rowHeights = [];
      canvases.forEach((c, i) => {
        const s = scales[i] || 1;
        const row = Math.floor(i / actualCols);
        const imgH = Math.round((c.height / c.width) * cellW * s);
        if (!rowHeights[row] || imgH > rowHeights[row]) rowHeights[row] = imgH;
      });
      let y = spacing;
      canvases.forEach((c, i) => {
        const col = i % actualCols;
        const row = Math.floor(i / actualCols);
        const s = scales[i] || 1;
        const imgW = Math.round(cellW * s);
        const imgH = Math.round((c.height / c.width) * cellW * s);
        if (col === 0 && row > 0) y += rowHeights[row - 1] + spacing;
        const rowH = rowHeights[row];
        positions.push({ x: spacing + col * (cellW + spacing), y: y + Math.round((rowH - imgH) / 2), w: imgW, h: imgH });
      });
      totalW = targetW;
      totalH = y + (rowHeights[rowHeights.length - 1] || 0) + spacing;
    }
  }

  // Only override height for fixed-size layouts, not when content determines height
  if (opts.height && layout !== 'strip-v' && cols > 1) totalH = Math.max(totalH, opts.height);

  const result = document.createElement('canvas');
  result.width = totalW; result.height = totalH;
  const ctx = result.getContext('2d');

  // Background
  if (bgType === 'gradient') {
    const grad = ctx.createLinearGradient(0, 0, 0, totalH);
    grad.addColorStop(0, bgColor); grad.addColorStop(1, bgColor2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, totalW, totalH);
  } else if (bgType === 'blur' && canvases[0]) {
    ctx.filter = 'blur(30px) brightness(70%)';
    ctx.drawImage(canvases[0], -40, -40, totalW + 80, totalH + 80);
    ctx.filter = 'none';
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, totalW, totalH);
  }

  const filterCSS = { none:'', grayscale:'grayscale(100%)', sepia:'sepia(100%)', brightness:'brightness(130%)', contrast:'contrast(140%)', polaroid:'' };

  // Draw images onto a separate layer (for blend mode support)
  const useBlend = blendMode !== 'source-over';
  const imgLayer = useBlend ? document.createElement('canvas') : null;
  if (imgLayer) { imgLayer.width = totalW; imgLayer.height = totalH; }
  const drawCtx = useBlend ? imgLayer.getContext('2d') : ctx;

  canvases.forEach((c, i) => {
    if (!positions[i]) return;
    const { x, y, w, h } = positions[i];
    const borderW = opts.borderWidth || 6;
    const pad = polaroid ? Math.round(Math.min(w, h) * 0.06) : (border ? borderW : 0);
    const padBot = polaroid ? Math.round(Math.min(w, h) * 0.15) : pad;

    // Shadow (always on result canvas, not layer)
    if (shadow) {
      ctx.save();
      const sColor = opts.shadowColor || '#000000';
      const sBlur = opts.shadowBlur ?? 12;
      const sDir = opts.shadowDir || 'br';
      const sOff = Math.max(2, Math.round(sBlur * 0.3));
      const sdx = sDir === 'center' ? 0 : (sDir.includes('r') ? sOff : -sOff);
      const sdy = sDir === 'center' ? 0 : (sDir.includes('b') ? sOff : -sOff);
      // Parse hex to rgba with 0.4 opacity
      const sr = parseInt(sColor.slice(1,3),16), sg = parseInt(sColor.slice(3,5),16), sb = parseInt(sColor.slice(5,7),16);
      ctx.shadowColor = `rgba(${sr},${sg},${sb},0.4)`;
      ctx.shadowBlur = sBlur; ctx.shadowOffsetX = sdx; ctx.shadowOffsetY = sdy;
      ctx.fillStyle = opts.borderColor || '#fff';
      _collageRoundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad + padBot, radius); ctx.fill();
      ctx.restore();
    }

    // Frame (always on result canvas)
    if (pad > 0) {
      ctx.fillStyle = opts.borderColor || '#ffffff';
      _collageRoundRect(ctx, x - pad, y - pad, w + pad * 2, h + pad + padBot, radius); ctx.fill();
    }

    // Clip + draw image
    drawCtx.save();
    if (radius > 0) {
      _collageRoundRect(drawCtx, x, y, w, h, Math.max(1, radius - pad)); drawCtx.clip();
    } else {
      drawCtx.beginPath(); drawCtx.rect(x, y, w, h); drawCtx.clip();
    }

    if (filterCSS[filter]) drawCtx.filter = filterCSS[filter];
    if (cellOpacity < 1) drawCtx.globalAlpha = cellOpacity;

    // Draw image
    const scale = fit === 'cover' ? Math.max(w / c.width, h / c.height) : Math.min(w / c.width, h / c.height);
    const sw = c.width * scale, sh = c.height * scale;
    drawCtx.drawImage(c, x + (w - sw) / 2, y + (h - sh) / 2, sw, sh);

    drawCtx.filter = 'none';
    drawCtx.globalAlpha = 1;
    drawCtx.restore();
  });

  // Composite image layer onto result with blend mode
  if (useBlend) {
    ctx.globalCompositeOperation = blendMode;
    ctx.drawImage(imgLayer, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }

  return result;
}

function _collageRoundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r); ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h); ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r); ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// #19 Favicon Extractor - REMOVED
// Fetching external URLs from extension context risks Chrome review rejection
// (flagged as potential malware download vector)

// ============================================================
// CATEGORY: Quality of Life
// ============================================================

// #2 JPEG Quality Live Preview (returns size for given quality)
async function getJpegSizeAtQuality(canvas, quality) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', quality / 100));
  return blob.size;
}

// Helper: format size compactly
function fmtSize(b) {
  if (b < 1024) return b + 'B';
  if (b < 1048576) return (b / 1024).toFixed(0) + 'KB';
  return (b / 1048576).toFixed(1) + 'MB';
}
