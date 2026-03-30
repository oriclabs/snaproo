// Snaproo - color-utils.js tests
// Run with: node --test tests/utils/color-utils.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- rgbToHex ---
function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

describe('rgbToHex', () => {
  it('should convert black', () => {
    assert.equal(rgbToHex(0, 0, 0), '#000000');
  });

  it('should convert white', () => {
    assert.equal(rgbToHex(255, 255, 255), '#ffffff');
  });

  it('should convert red', () => {
    assert.equal(rgbToHex(255, 0, 0), '#ff0000');
  });

  it('should convert green', () => {
    assert.equal(rgbToHex(0, 255, 0), '#00ff00');
  });

  it('should convert blue', () => {
    assert.equal(rgbToHex(0, 0, 255), '#0000ff');
  });

  it('should convert saffron primary', () => {
    assert.equal(rgbToHex(244, 196, 48), '#f4c430');
  });

  it('should pad single-digit hex values', () => {
    assert.equal(rgbToHex(1, 2, 3), '#010203');
  });

  it('should handle mid-range values', () => {
    assert.equal(rgbToHex(128, 128, 128), '#808080');
  });
});

// --- rgbToHsl ---
function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

describe('rgbToHsl', () => {
  it('should convert black', () => {
    assert.equal(rgbToHsl(0, 0, 0), 'hsl(0, 0%, 0%)');
  });

  it('should convert white', () => {
    assert.equal(rgbToHsl(255, 255, 255), 'hsl(0, 0%, 100%)');
  });

  it('should convert pure red', () => {
    assert.equal(rgbToHsl(255, 0, 0), 'hsl(0, 100%, 50%)');
  });

  it('should convert pure green', () => {
    assert.equal(rgbToHsl(0, 255, 0), 'hsl(120, 100%, 50%)');
  });

  it('should convert pure blue', () => {
    assert.equal(rgbToHsl(0, 0, 255), 'hsl(240, 100%, 50%)');
  });

  it('should convert gray (no saturation)', () => {
    const result = rgbToHsl(128, 128, 128);
    assert.match(result, /hsl\(0, 0%, 50%\)/);
  });

  it('should convert saffron color', () => {
    const result = rgbToHsl(244, 196, 48);
    // Saffron is approximately hsl(45, 90%, 57%)
    assert.match(result, /^hsl\(\d+, \d+%, \d+%\)$/);
    // Hue should be around 45
    const hue = parseInt(result.match(/hsl\((\d+)/)[1]);
    assert.ok(hue >= 40 && hue <= 50, `Saffron hue should be ~45, got ${hue}`);
  });
});

// --- extractPalette ---
function extractPalette(pixels, k = 6) {
  // Simplified test version without ImageData dependency
  if (pixels.length === 0) return [];

  // Just verify the algorithm doesn't crash
  let centroids = pixels.slice(0, Math.min(k, pixels.length)).map(p => [...p]);
  const assignments = new Array(pixels.length).fill(0);

  for (let iter = 0; iter < 10; iter++) {
    for (let i = 0; i < pixels.length; i++) {
      let minDist = Infinity;
      for (let j = 0; j < centroids.length; j++) {
        const dist = (pixels[i][0] - centroids[j][0]) ** 2 +
                     (pixels[i][1] - centroids[j][1]) ** 2 +
                     (pixels[i][2] - centroids[j][2]) ** 2;
        if (dist < minDist) { minDist = dist; assignments[i] = j; }
      }
    }

    const sums = centroids.map(() => [0, 0, 0]);
    const counts = new Array(centroids.length).fill(0);
    for (let i = 0; i < pixels.length; i++) {
      const c = assignments[i];
      sums[c][0] += pixels[i][0];
      sums[c][1] += pixels[i][1];
      sums[c][2] += pixels[i][2];
      counts[c]++;
    }
    for (let j = 0; j < centroids.length; j++) {
      if (counts[j] > 0) {
        centroids[j] = [
          Math.round(sums[j][0] / counts[j]),
          Math.round(sums[j][1] / counts[j]),
          Math.round(sums[j][2] / counts[j]),
        ];
      }
    }
  }

  const counts = new Array(centroids.length).fill(0);
  for (const c of assignments) counts[c]++;
  const total = assignments.length;

  return centroids.map((c, i) => ({
    r: c[0], g: c[1], b: c[2],
    hex: rgbToHex(c[0], c[1], c[2]),
    percent: Math.round((counts[i] / total) * 100),
  })).sort((a, b) => b.percent - a.percent);
}

describe('extractPalette', () => {
  it('should return empty for no pixels', () => {
    assert.deepEqual(extractPalette([]), []);
  });

  it('should extract single color from uniform image', () => {
    const pixels = Array(100).fill([255, 0, 0]); // all red
    const palette = extractPalette(pixels, 3);
    assert.ok(palette.length > 0);
    // Dominant color should be red
    assert.equal(palette[0].r, 255);
    assert.equal(palette[0].g, 0);
    assert.equal(palette[0].b, 0);
    assert.equal(palette[0].percent, 100);
  });

  it('should extract two colors', () => {
    const pixels = [
      ...Array(50).fill([255, 0, 0]),  // red
      ...Array(50).fill([0, 0, 255]),  // blue
    ];
    const palette = extractPalette(pixels, 2);
    assert.equal(palette.length, 2);
    assert.equal(palette[0].percent + palette[1].percent, 100);
  });

  it('should include hex values', () => {
    const pixels = Array(10).fill([244, 196, 48]); // saffron
    const palette = extractPalette(pixels, 1);
    assert.equal(palette[0].hex, '#f4c430');
  });

  it('should sort by percentage descending', () => {
    const pixels = [
      ...Array(70).fill([255, 0, 0]),
      ...Array(30).fill([0, 255, 0]),
    ];
    const palette = extractPalette(pixels, 2);
    assert.ok(palette[0].percent >= palette[1].percent);
  });

  it('should handle k larger than unique colors', () => {
    const pixels = Array(10).fill([128, 128, 128]);
    const palette = extractPalette(pixels, 6);
    assert.ok(palette.length > 0);
  });

  it('should handle single pixel', () => {
    const palette = extractPalette([[42, 84, 126]], 3);
    assert.ok(palette.length > 0);
    assert.equal(palette[0].r, 42);
  });
});
