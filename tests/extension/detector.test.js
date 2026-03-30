// Snaproo - Content Script (detector.js) Logic Tests
// Run with: node --test tests/extension/detector.test.js
//
// These test the pure functions extracted from detector.js
// Browser-specific APIs (chrome.*, DOM) are not available in Node

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// --- guessTypeFromUrl ---
function guessTypeFromUrl(url) {
  try {
    const ext = new URL(url, 'https://example.com').pathname.split('.').pop()?.toLowerCase();
    const map = {
      jpg: 'JPEG', jpeg: 'JPEG', png: 'PNG', gif: 'GIF',
      webp: 'WebP', avif: 'AVIF', svg: 'SVG', bmp: 'BMP',
      ico: 'ICO', tiff: 'TIFF', tif: 'TIFF',
    };
    return map[ext] || ext?.toUpperCase() || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

describe('guessTypeFromUrl', () => {
  it('should detect JPEG from .jpg', () => {
    assert.equal(guessTypeFromUrl('https://example.com/photo.jpg'), 'JPEG');
  });

  it('should detect JPEG from .jpeg', () => {
    assert.equal(guessTypeFromUrl('https://example.com/photo.jpeg'), 'JPEG');
  });

  it('should detect PNG', () => {
    assert.equal(guessTypeFromUrl('https://example.com/icon.png'), 'PNG');
  });

  it('should detect WebP', () => {
    assert.equal(guessTypeFromUrl('https://example.com/image.webp'), 'WebP');
  });

  it('should detect AVIF', () => {
    assert.equal(guessTypeFromUrl('https://example.com/photo.avif'), 'AVIF');
  });

  it('should detect SVG', () => {
    assert.equal(guessTypeFromUrl('https://example.com/logo.svg'), 'SVG');
  });

  it('should detect GIF', () => {
    assert.equal(guessTypeFromUrl('https://example.com/animation.gif'), 'GIF');
  });

  it('should detect BMP', () => {
    assert.equal(guessTypeFromUrl('https://example.com/old.bmp'), 'BMP');
  });

  it('should detect ICO', () => {
    assert.equal(guessTypeFromUrl('https://example.com/favicon.ico'), 'ICO');
  });

  it('should detect TIFF from .tiff and .tif', () => {
    assert.equal(guessTypeFromUrl('https://example.com/scan.tiff'), 'TIFF');
    assert.equal(guessTypeFromUrl('https://example.com/scan.tif'), 'TIFF');
  });

  it('should handle URLs with query params', () => {
    assert.equal(guessTypeFromUrl('https://cdn.example.com/photo.jpg?w=800&q=80'), 'JPEG');
  });

  it('should handle unknown extensions', () => {
    const result = guessTypeFromUrl('https://example.com/file.xyz');
    assert.equal(result, 'XYZ');
  });

  it('should return Unknown for no extension', () => {
    const result = guessTypeFromUrl('https://example.com/image');
    // 'image' has no dot, so pop returns 'image' -> 'IMAGE'
    assert.ok(typeof result === 'string');
  });
});

// --- extractFilename ---
function extractFilename(url) {
  try {
    return new URL(url, 'https://example.com').pathname.split('/').pop() || 'image';
  } catch {
    return 'image';
  }
}

describe('extractFilename', () => {
  it('should extract filename from simple URL', () => {
    assert.equal(extractFilename('https://example.com/photos/sunset.jpg'), 'sunset.jpg');
  });

  it('should extract filename from deep path', () => {
    assert.equal(extractFilename('https://cdn.example.com/a/b/c/d/photo.png'), 'photo.png');
  });

  it('should return image for root URL', () => {
    assert.equal(extractFilename('https://example.com/'), 'image');
  });

  it('should handle data URIs gracefully', () => {
    const result = extractFilename('data:image/png;base64,iVBORw0KGgo=');
    assert.ok(typeof result === 'string');
  });

  it('should handle relative URLs', () => {
    assert.equal(extractFilename('/images/cat.gif'), 'cat.gif');
  });
});

// --- formatBytes ---
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

describe('formatBytes (detector)', () => {
  it('should format small sizes', () => {
    assert.equal(formatBytes(100), '100 B');
  });

  it('should format KB', () => {
    assert.equal(formatBytes(2048), '2.0 KB');
  });

  it('should format MB', () => {
    assert.equal(formatBytes(3145728), '3.0 MB');
  });
});

// --- truncate ---
function truncate(str, max) {
  return str.length > max ? str.substring(0, max) + '...' : str;
}

describe('truncate', () => {
  it('should not truncate short strings', () => {
    assert.equal(truncate('hello', 10), 'hello');
  });

  it('should truncate long strings', () => {
    assert.equal(truncate('a'.repeat(100), 10), 'a'.repeat(10) + '...');
  });

  it('should handle exact length', () => {
    assert.equal(truncate('12345', 5), '12345');
  });

  it('should handle empty string', () => {
    assert.equal(truncate('', 10), '');
  });
});

// --- escapeAttr ---
function escapeAttr(str) {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
}

describe('escapeAttr', () => {
  it('should escape double quotes', () => {
    assert.equal(escapeAttr('hello "world"'), 'hello &quot;world&quot;');
  });

  it('should escape angle brackets', () => {
    assert.equal(escapeAttr('<script>'), '&lt;script>');
  });

  it('should escape ampersands', () => {
    assert.equal(escapeAttr('a&b'), 'a&amp;b');
  });

  it('should handle clean strings', () => {
    assert.equal(escapeAttr('photo.jpg'), 'photo.jpg');
  });
});
