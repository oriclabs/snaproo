// Minimal GIF89a Encoder — produces animated GIFs from canvas frames
// Usage: const gif = new GifEncoder(width, height); gif.addFrame(ctx, delay); const blob = gif.finish();

class GifEncoder {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.frames = [];
  }

  addFrame(canvas, delay = 100) {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, this.width, this.height);
    this.frames.push({ data: imageData.data, delay });
  }

  finish() {
    const buf = [];
    const w = this.width, h = this.height;

    // Header
    _writeStr(buf, 'GIF89a');
    _writeU16(buf, w);
    _writeU16(buf, h);
    // Global Color Table: 256 colors, 8 bits
    buf.push(0xF7); // GCT flag, color res 8, sorted=0, size=7 (256 colors)
    buf.push(0);    // bg color index
    buf.push(0);    // pixel aspect ratio

    // Global color table (256 RGB entries — we'll use a simple palette)
    // For each frame, quantize to 256 colors
    // Use a simple uniform palette: 6x6x6 color cube + 40 grays
    const palette = _buildPalette();
    for (let i = 0; i < 256; i++) {
      buf.push(palette[i * 3], palette[i * 3 + 1], palette[i * 3 + 2]);
    }

    // Netscape extension for looping
    buf.push(0x21, 0xFF, 0x0B);
    _writeStr(buf, 'NETSCAPE2.0');
    buf.push(0x03, 0x01);
    _writeU16(buf, 0); // loop count 0 = infinite
    buf.push(0x00);

    // Frames
    for (const frame of this.frames) {
      // Graphics Control Extension
      buf.push(0x21, 0xF9, 0x04);
      buf.push(0x04); // disposal: restore to bg, no transparency
      _writeU16(buf, Math.round(frame.delay / 10)); // delay in 1/100s
      buf.push(0x00); // transparent color index (unused)
      buf.push(0x00); // block terminator

      // Image Descriptor
      buf.push(0x2C);
      _writeU16(buf, 0); // left
      _writeU16(buf, 0); // top
      _writeU16(buf, w);
      _writeU16(buf, h);
      buf.push(0x00); // no local color table

      // LZW compressed pixels
      const pixels = _quantizeFrame(frame.data, w, h, palette);
      const minCodeSize = 8;
      buf.push(minCodeSize);
      const compressed = _lzwEncode(pixels, minCodeSize);
      // Write sub-blocks
      let pos = 0;
      while (pos < compressed.length) {
        const chunk = Math.min(255, compressed.length - pos);
        buf.push(chunk);
        for (let i = 0; i < chunk; i++) buf.push(compressed[pos++]);
      }
      buf.push(0x00); // block terminator
    }

    // Trailer
    buf.push(0x3B);

    return new Blob([new Uint8Array(buf)], { type: 'image/gif' });
  }
}

function _writeStr(buf, s) { for (let i = 0; i < s.length; i++) buf.push(s.charCodeAt(i)); }
function _writeU16(buf, v) { buf.push(v & 0xFF, (v >> 8) & 0xFF); }

function _buildPalette() {
  // 6x6x6 color cube (216) + 40 grays
  const p = new Uint8Array(256 * 3);
  let idx = 0;
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) {
    p[idx++] = Math.round(r * 51); p[idx++] = Math.round(g * 51); p[idx++] = Math.round(b * 51);
  }
  // 40 grays (216..255)
  for (let i = 0; i < 40; i++) {
    const v = Math.round(i * 255 / 39);
    p[idx++] = v; p[idx++] = v; p[idx++] = v;
  }
  return p;
}

function _quantizeFrame(rgba, w, h, palette) {
  const n = w * h;
  const out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const r = rgba[i * 4], g = rgba[i * 4 + 1], b = rgba[i * 4 + 2];
    // Find nearest in 6x6x6 cube
    const ri = Math.round(r / 51), gi = Math.round(g / 51), bi = Math.round(b / 51);
    out[i] = ri * 36 + gi * 6 + bi;
  }
  return out;
}

function _lzwEncode(pixels, minCodeSize) {
  const clearCode = 1 << minCodeSize;
  const eoiCode = clearCode + 1;
  let codeSize = minCodeSize + 1;
  let nextCode = eoiCode + 1;
  const maxCode = 4096;

  const output = [];
  let bitBuf = 0, bitCount = 0;

  function emit(code) {
    bitBuf |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(bitBuf & 0xFF);
      bitBuf >>= 8;
      bitCount -= 8;
    }
  }

  // Init dictionary
  let dict = new Map();
  function resetDict() {
    dict.clear();
    for (let i = 0; i < clearCode; i++) dict.set(String(i), i);
    nextCode = eoiCode + 1;
    codeSize = minCodeSize + 1;
  }

  emit(clearCode);
  resetDict();

  let current = String(pixels[0]);
  for (let i = 1; i < pixels.length; i++) {
    const next = String(pixels[i]);
    const combined = current + ',' + next;
    if (dict.has(combined)) {
      current = combined;
    } else {
      emit(dict.get(current));
      if (nextCode < maxCode) {
        dict.set(combined, nextCode++);
        if (nextCode > (1 << codeSize) && codeSize < 12) codeSize++;
      } else {
        emit(clearCode);
        resetDict();
      }
      current = next;
    }
  }
  emit(dict.get(current));
  emit(eoiCode);

  // Flush remaining bits
  if (bitCount > 0) output.push(bitBuf & 0xFF);

  return output;
}
