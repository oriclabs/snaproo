// Snaproo - Manifest & Extension Structure Tests
// Run with: node --test tests/extension/manifest.test.js

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dirname, '..', '..');

// ============================================================
// Chrome Manifest Tests
// ============================================================

describe('Chrome manifest.json', () => {
  const manifestPath = join(ROOT, 'browser', 'chrome', 'manifest.json');
  let manifest;

  it('should exist', () => {
    assert.ok(existsSync(manifestPath));
  });

  it('should be valid JSON', () => {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    assert.ok(typeof manifest === 'object');
  });

  it('should be Manifest V3', () => {
    assert.equal(manifest.manifest_version, 3);
  });

  it('should have correct name', () => {
    assert.equal(manifest.name, 'Snaproo');
  });

  it('should have a version', () => {
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  });

  it('should have a description', () => {
    assert.ok(manifest.description.length > 10);
    assert.ok(manifest.description.length <= 132, 'Description must be <= 132 chars for Chrome');
  });

  it('should have all required icon sizes', () => {
    assert.ok(manifest.icons['16']);
    assert.ok(manifest.icons['32']);
    assert.ok(manifest.icons['48']);
    assert.ok(manifest.icons['128']);
  });

  it('should have a popup defined', () => {
    assert.ok(manifest.action.default_popup);
  });

  it('should have a side panel defined', () => {
    assert.ok(manifest.side_panel.default_path);
  });

  it('should have a service worker', () => {
    assert.ok(manifest.background.service_worker);
  });

  // --- Permission Safety Tests ---
  describe('permissions (Chrome review safety)', () => {
    it('should use activeTab instead of broad host permissions', () => {
      assert.ok(manifest.permissions.includes('activeTab'));
    });

    it('should include contextMenus', () => {
      assert.ok(manifest.permissions.includes('contextMenus'));
    });

    it('should include downloads', () => {
      assert.ok(manifest.permissions.includes('downloads'));
    });

    it('should include storage', () => {
      assert.ok(manifest.permissions.includes('storage'));
    });

    it('should include sidePanel', () => {
      assert.ok(manifest.permissions.includes('sidePanel'));
    });

    it('should NOT include tabs permission', () => {
      assert.ok(!manifest.permissions.includes('tabs'));
    });

    it('should NOT include webRequest permission', () => {
      assert.ok(!manifest.permissions.includes('webRequest'));
    });

    it('should NOT include browsingHistory permission', () => {
      assert.ok(!manifest.permissions.includes('browsingHistory'));
      assert.ok(!manifest.permissions.includes('history'));
    });

    it('should NOT include cookies permission', () => {
      assert.ok(!manifest.permissions.includes('cookies'));
    });

    it('should NOT have host_permissions with <all_urls>', () => {
      const hostPerms = manifest.host_permissions || [];
      assert.ok(!hostPerms.includes('<all_urls>'), 'Should not use <all_urls> host permission');
    });

    it('should NOT include webNavigation', () => {
      assert.ok(!manifest.permissions.includes('webNavigation'));
    });

    it('should have reasonable number of permissions (< 10)', () => {
      assert.ok(manifest.permissions.length < 10,
        `Too many permissions (${manifest.permissions.length}), may trigger longer review`);
    });
  });

  // --- Content Script Tests ---
  describe('content scripts', () => {
    it('should have content scripts defined', () => {
      assert.ok(manifest.content_scripts?.length > 0);
    });

    it('should run at document_idle (least intrusive)', () => {
      assert.equal(manifest.content_scripts[0].run_at, 'document_idle');
    });

    it('should not inject into all_frames by default', () => {
      assert.equal(manifest.content_scripts[0].all_frames, false);
    });
  });

  // --- Commands Tests ---
  describe('commands', () => {
    it('should have keyboard shortcuts defined', () => {
      assert.ok(manifest.commands);
    });

    it('should have quick-qr command', () => {
      assert.ok(manifest.commands['quick-qr']);
    });

    it('should have open-toolkit command', () => {
      assert.ok(manifest.commands['open-toolkit']);
    });
  });
});

// ============================================================
// Edge Manifest Tests
// ============================================================

describe('Edge manifest.json', () => {
  const manifestPath = join(ROOT, 'browser', 'edge', 'manifest.json');
  let manifest;

  it('should exist', () => {
    assert.ok(existsSync(manifestPath));
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  });

  it('should be Manifest V3', () => {
    assert.equal(manifest.manifest_version, 3);
  });

  it('should have same name as Chrome', () => {
    assert.equal(manifest.name, 'Snaproo');
  });
});

// ============================================================
// Firefox Manifest Tests
// ============================================================

describe('Firefox manifest.json', () => {
  const manifestPath = join(ROOT, 'browser', 'firefox', 'manifest.json');
  let manifest;

  it('should exist', () => {
    assert.ok(existsSync(manifestPath));
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  });

  it('should be Manifest V3', () => {
    assert.equal(manifest.manifest_version, 3);
  });

  it('should have sidebar_action instead of side_panel', () => {
    assert.ok(manifest.sidebar_action);
    assert.ok(!manifest.side_panel);
  });

  it('should have gecko browser_specific_settings', () => {
    assert.ok(manifest.browser_specific_settings?.gecko);
  });

  it('should have an extension ID', () => {
    assert.ok(manifest.browser_specific_settings.gecko.id);
  });

  it('should NOT include sidePanel permission (Firefox uses sidebar_action)', () => {
    assert.ok(!manifest.permissions.includes('sidePanel'));
  });

  it('should use background.scripts not service_worker', () => {
    assert.ok(manifest.background.scripts);
    assert.ok(!manifest.background.service_worker);
  });
});

// ============================================================
// File Existence Tests
// ============================================================

describe('Chrome extension file structure', () => {
  const chrome = join(ROOT, 'browser', 'chrome');

  const requiredFiles = [
    'manifest.json',
    'background.js',
    'popup/popup.html',
    'popup/popup.js',
    'sidepanel/sidepanel.html',
    'sidepanel/sidepanel.js',
    'editor/editor.html',
    'editor/editor.js',
    'content/detector.js',
    'help/help.html',
    'styles/shared.css',
  ];

  requiredFiles.forEach(file => {
    it(`should have ${file}`, () => {
      assert.ok(existsSync(join(chrome, file)), `Missing: ${file}`);
    });
  });
});

describe('Firefox extension file structure', () => {
  const firefox = join(ROOT, 'browser', 'firefox');

  it('should have background-firefox.js', () => {
    assert.ok(existsSync(join(firefox, 'background-firefox.js')));
  });

  it('should have manifest.json', () => {
    assert.ok(existsSync(join(firefox, 'manifest.json')));
  });
});
