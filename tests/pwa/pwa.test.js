// Snaproo - PWA Tests
// Run with: node --test tests/pwa/pwa.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

// ============================================================
// PWA File Structure Tests
// ============================================================

describe('PWA file structure', () => {
  const pwa = join(ROOT, 'website', 'pwa');

  const requiredFiles = [
    'index.html',
    'app.js',
    'sw.js',
    'manifest.json',
  ];

  requiredFiles.forEach(file => {
    it(`should have ${file}`, () => {
      assert.ok(existsSync(join(pwa, file)), `Missing: pwa/${file}`);
    });
  });
});

// ============================================================
// PWA Manifest Tests
// ============================================================

describe('PWA manifest.json', () => {
  const manifestPath = join(ROOT, 'website', 'pwa', 'manifest.json');
  let manifest;

  it('should exist and be valid JSON', () => {
    assert.ok(existsSync(manifestPath));
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    assert.ok(typeof manifest === 'object');
  });

  it('should have name', () => {
    assert.equal(manifest.name, 'Snaproo');
  });

  it('should have short_name', () => {
    assert.ok(manifest.short_name);
    assert.ok(manifest.short_name.length <= 12, 'short_name should be <= 12 chars');
  });

  it('should have description', () => {
    assert.ok(manifest.description?.length > 0);
  });

  it('should have start_url', () => {
    assert.ok(manifest.start_url);
  });

  it('should have display mode standalone', () => {
    assert.equal(manifest.display, 'standalone');
  });

  it('should have saffron theme_color', () => {
    assert.equal(manifest.theme_color, '#F4C430');
  });

  it('should have dark background_color', () => {
    assert.ok(manifest.background_color);
  });

  it('should have icons', () => {
    assert.ok(manifest.icons?.length >= 2);
  });

  it('should have 192px icon', () => {
    const icon192 = manifest.icons.find(i => i.sizes === '192x192');
    assert.ok(icon192);
    assert.equal(icon192.type, 'image/png');
  });

  it('should have 512px icon', () => {
    const icon512 = manifest.icons.find(i => i.sizes === '512x512' && !i.purpose);
    assert.ok(icon512);
  });

  it('should have maskable icon', () => {
    const maskable = manifest.icons.find(i => i.purpose === 'maskable');
    assert.ok(maskable, 'Should have a maskable icon for Android');
  });

  it('should have categories', () => {
    assert.ok(manifest.categories?.length > 0);
  });

  it('should support share target for images', () => {
    assert.ok(manifest.share_target);
    assert.equal(manifest.share_target.method, 'POST');
    assert.ok(manifest.share_target.params.files);
  });
});

// ============================================================
// Service Worker Tests
// ============================================================

describe('Service Worker (sw.js)', () => {
  const swPath = join(ROOT, 'website', 'pwa', 'sw.js');
  let swContent;

  it('should exist', () => {
    assert.ok(existsSync(swPath));
    swContent = readFileSync(swPath, 'utf-8');
  });

  it('should define a cache name', () => {
    assert.match(swContent, /CACHE_NAME/);
  });

  it('should include version in cache name', () => {
    assert.match(swContent, /snaproo-v/);
  });

  it('should handle install event', () => {
    assert.match(swContent, /addEventListener\(['"]install['"]/);
  });

  it('should handle activate event', () => {
    assert.match(swContent, /addEventListener\(['"]activate['"]/);
  });

  it('should handle fetch event', () => {
    assert.match(swContent, /addEventListener\(['"]fetch['"]/);
  });

  it('should call skipWaiting on install', () => {
    assert.match(swContent, /skipWaiting/);
  });

  it('should call clients.claim on activate', () => {
    assert.match(swContent, /clients\.claim/);
  });

  it('should clean old caches on activate', () => {
    assert.match(swContent, /caches\.delete/);
  });

  it('should have offline fallback', () => {
    assert.match(swContent, /navigate|offline/i);
  });

  it('should cache core assets', () => {
    assert.match(swContent, /ASSETS/);
    assert.match(swContent, /index\.html/);
  });
});

// ============================================================
// PWA HTML Tests
// ============================================================

describe('PWA index.html', () => {
  const htmlPath = join(ROOT, 'website', 'pwa', 'index.html');
  let html;

  it('should exist', () => {
    assert.ok(existsSync(htmlPath));
    html = readFileSync(htmlPath, 'utf-8');
  });

  it('should have proper DOCTYPE', () => {
    assert.match(html, /<!DOCTYPE html>/i);
  });

  it('should have lang attribute', () => {
    assert.match(html, /lang="en"/);
  });

  it('should have viewport meta', () => {
    assert.match(html, /viewport/);
  });

  it('should have theme-color meta', () => {
    assert.match(html, /theme-color/);
    assert.match(html, /#F4C430/);
  });

  it('should link to manifest.json', () => {
    assert.match(html, /rel="manifest"/);
  });

  it('should have apple-touch-icon', () => {
    assert.match(html, /apple-touch-icon/);
  });

  it('should register service worker', () => {
    assert.match(html, /serviceWorker\.register/);
  });

  it('should handle beforeinstallprompt', () => {
    assert.match(html, /beforeinstallprompt/);
  });

  it('should have tool tabs', () => {
    assert.match(html, /data-tool="convert"/);
    assert.match(html, /data-tool="editor"/);
    assert.match(html, /data-tool="qr"/);
    assert.match(html, /data-tool="info"/);
    assert.match(html, /data-tool="colors"/);
  });

  it('should reference app.js', () => {
    assert.match(html, /app\.js/);
  });

  it('should use Tailwind CSS', () => {
    assert.match(html, /tailwindcss/);
  });

  it('should include saffron color config', () => {
    assert.match(html, /saffron/);
    assert.match(html, /F4C430/);
  });
});

// ============================================================
// Docs (GitHub Pages) Tests
// ============================================================

describe('GitHub Pages site', () => {
  const docsPath = join(ROOT, 'website', 'docs');

  it('should have index.html', () => {
    assert.ok(existsSync(join(docsPath, 'index.html')));
  });

  it('should have favicon.svg', () => {
    assert.ok(existsSync(join(docsPath, 'favicon.svg')));
  });

  it('should have proper title', () => {
    const html = readFileSync(join(docsPath, 'index.html'), 'utf-8');
    assert.match(html, /Snaproo/);
  });

  it('should reference saffron colors', () => {
    const html = readFileSync(join(docsPath, 'index.html'), 'utf-8');
    assert.match(html, /F4C430/);
  });

  it('should have privacy section', () => {
    const html = readFileSync(join(docsPath, 'index.html'), 'utf-8');
    assert.match(html, /privacy/i);
  });

  it('should mention 100% offline', () => {
    const html = readFileSync(join(docsPath, 'index.html'), 'utf-8');
    assert.match(html, /offline/i);
  });

  it('favicon SVG should have saffron gradient', () => {
    const svg = readFileSync(join(docsPath, 'favicon.svg'), 'utf-8');
    assert.match(svg, /F4C430/);
  });
});
