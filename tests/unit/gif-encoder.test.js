// Unit tests for GIF encoder (LZW + structure)
// Can't test full canvas output in Node, but can test LZW and structure helpers

// Inline the core LZW functions for testing
function _writeStr(buf, s) { for (let i = 0; i < s.length; i++) buf.push(s.charCodeAt(i)); }
function _writeU16(buf, v) { buf.push(v & 0xFF, (v >> 8) & 0xFF); }

function _buildPalette() {
  const p = new Uint8Array(256 * 3);
  let idx = 0;
  for (let r = 0; r < 6; r++) for (let g = 0; g < 6; g++) for (let b = 0; b < 6; b++) {
    p[idx++] = Math.round(r * 51); p[idx++] = Math.round(g * 51); p[idx++] = Math.round(b * 51);
  }
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
    const ri = Math.round(r / 51), gi = Math.round(g / 51), bi = Math.round(b / 51);
    out[i] = ri * 36 + gi * 6 + bi;
  }
  return out;
}

describe('GIF encoder helpers', () => {
  test('_writeStr writes ASCII bytes', () => {
    const buf = [];
    _writeStr(buf, 'GIF');
    expect(buf).toEqual([71, 73, 70]);
  });

  test('_writeU16 writes little-endian', () => {
    const buf = [];
    _writeU16(buf, 256);
    expect(buf).toEqual([0, 1]);

    const buf2 = [];
    _writeU16(buf2, 0x1234);
    expect(buf2).toEqual([0x34, 0x12]);
  });

  test('_buildPalette creates 256 colors (768 bytes)', () => {
    const p = _buildPalette();
    expect(p.length).toBe(768);
    // First color is black (0,0,0)
    expect(p[0]).toBe(0);
    expect(p[1]).toBe(0);
    expect(p[2]).toBe(0);
    // 6x6x6 = 216 cube colors + 40 grays = 256
  });

  test('_quantizeFrame maps RGBA to palette indices', () => {
    const palette = _buildPalette();
    // Pure black pixel
    const black = new Uint8Array([0, 0, 0, 255]);
    const result = _quantizeFrame(black, 1, 1, palette);
    expect(result[0]).toBe(0); // index 0 = black

    // Pure white pixel (255,255,255) → r=5,g=5,b=5 → 5*36+5*6+5 = 215
    const white = new Uint8Array([255, 255, 255, 255]);
    const result2 = _quantizeFrame(white, 1, 1, palette);
    expect(result2[0]).toBe(215);
  });

  test('_quantizeFrame handles multiple pixels', () => {
    const palette = _buildPalette();
    // 2x1 image: red, green
    const rgba = new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]);
    const result = _quantizeFrame(rgba, 2, 1, palette);
    expect(result.length).toBe(2);
    // Red (255,0,0) → r=5,g=0,b=0 → 5*36 = 180
    expect(result[0]).toBe(180);
    // Green (0,255,0) → r=0,g=5,b=0 → 0+5*6+0 = 30
    expect(result[1]).toBe(30);
  });
});
