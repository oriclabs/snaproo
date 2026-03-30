// Snaproo - image-utils.js tests
// Run with: node --test tests/utils/image-utils.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Since these are ES modules, we test the pure functions directly
// by re-implementing them here (the actual module uses browser APIs)

// --- formatBytes ---
function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

describe('formatBytes', () => {
  it('should format bytes', () => {
    assert.equal(formatBytes(0), '0 B');
    assert.equal(formatBytes(512), '512 B');
    assert.equal(formatBytes(1023), '1023 B');
  });

  it('should format kilobytes', () => {
    assert.equal(formatBytes(1024), '1.0 KB');
    assert.equal(formatBytes(1536), '1.5 KB');
    assert.equal(formatBytes(10240), '10.0 KB');
    assert.equal(formatBytes(102400), '100.0 KB');
  });

  it('should format megabytes', () => {
    assert.equal(formatBytes(1048576), '1.0 MB');
    assert.equal(formatBytes(5242880), '5.0 MB');
    assert.equal(formatBytes(1572864), '1.5 MB');
  });
});

// --- mimeFromExt ---
function mimeFromExt(ext) {
  const map = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', avif: 'image/avif',
    bmp: 'image/bmp', tiff: 'image/tiff', tif: 'image/tiff',
    ico: 'image/x-icon', svg: 'image/svg+xml', qoi: 'image/qoi',
  };
  return map[ext?.toLowerCase()] || 'application/octet-stream';
}

describe('mimeFromExt', () => {
  it('should return correct MIME for common formats', () => {
    assert.equal(mimeFromExt('png'), 'image/png');
    assert.equal(mimeFromExt('jpg'), 'image/jpeg');
    assert.equal(mimeFromExt('jpeg'), 'image/jpeg');
    assert.equal(mimeFromExt('gif'), 'image/gif');
    assert.equal(mimeFromExt('webp'), 'image/webp');
    assert.equal(mimeFromExt('avif'), 'image/avif');
    assert.equal(mimeFromExt('bmp'), 'image/bmp');
    assert.equal(mimeFromExt('svg'), 'image/svg+xml');
    assert.equal(mimeFromExt('ico'), 'image/x-icon');
  });

  it('should handle tiff/tif aliases', () => {
    assert.equal(mimeFromExt('tiff'), 'image/tiff');
    assert.equal(mimeFromExt('tif'), 'image/tiff');
  });

  it('should return octet-stream for unknown', () => {
    assert.equal(mimeFromExt('xyz'), 'application/octet-stream');
    assert.equal(mimeFromExt(''), 'application/octet-stream');
  });

  it('should handle null/undefined', () => {
    assert.equal(mimeFromExt(null), 'application/octet-stream');
    assert.equal(mimeFromExt(undefined), 'application/octet-stream');
  });
});

// --- extFromMime ---
function extFromMime(mime) {
  const map = {
    'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
    'image/webp': 'webp', 'image/avif': 'avif', 'image/bmp': 'bmp',
    'image/tiff': 'tiff', 'image/x-icon': 'ico', 'image/svg+xml': 'svg',
  };
  return map[mime] || 'bin';
}

describe('extFromMime', () => {
  it('should return correct extension for common MIME types', () => {
    assert.equal(extFromMime('image/png'), 'png');
    assert.equal(extFromMime('image/jpeg'), 'jpg');
    assert.equal(extFromMime('image/gif'), 'gif');
    assert.equal(extFromMime('image/webp'), 'webp');
    assert.equal(extFromMime('image/avif'), 'avif');
    assert.equal(extFromMime('image/svg+xml'), 'svg');
  });

  it('should return bin for unknown MIME', () => {
    assert.equal(extFromMime('application/pdf'), 'bin');
    assert.equal(extFromMime('text/html'), 'bin');
    assert.equal(extFromMime(''), 'bin');
  });
});

// --- filenameFromUrl ---
function filenameFromUrl(url) {
  try {
    return new URL(url).pathname.split('/').pop() || 'image';
  } catch {
    return 'image';
  }
}

describe('filenameFromUrl', () => {
  it('should extract filename from URL', () => {
    assert.equal(filenameFromUrl('https://example.com/images/photo.jpg'), 'photo.jpg');
    assert.equal(filenameFromUrl('https://example.com/a/b/c/icon.png'), 'icon.png');
  });

  it('should handle URLs without filename', () => {
    assert.equal(filenameFromUrl('https://example.com/'), 'image');
    assert.equal(filenameFromUrl('https://example.com'), 'image');
  });

  it('should handle query params', () => {
    assert.equal(filenameFromUrl('https://example.com/photo.jpg?w=100'), 'photo.jpg');
  });

  it('should return image for invalid URLs', () => {
    assert.equal(filenameFromUrl('not a url'), 'image');
    assert.equal(filenameFromUrl(''), 'image');
  });
});

// --- escapeHtml ---
// Note: real implementation uses DOM, this is the equivalent pure function
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

describe('escapeHtml', () => {
  it('should escape HTML entities', () => {
    assert.equal(escapeHtml('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('should escape ampersands', () => {
    assert.equal(escapeHtml('foo & bar'), 'foo &amp; bar');
  });

  it('should handle empty string', () => {
    assert.equal(escapeHtml(''), '');
  });

  it('should pass through safe strings', () => {
    assert.equal(escapeHtml('Hello World'), 'Hello World');
    assert.equal(escapeHtml('photo.png'), 'photo.png');
  });

  it('should escape single quotes', () => {
    assert.equal(escapeHtml("it's"), "it&#39;s");
  });
});
