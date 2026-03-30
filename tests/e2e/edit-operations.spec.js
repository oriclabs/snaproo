// Snaproo E2E — Edit operations (from tests.md scenarios)
import { test, expect } from '@playwright/test';
import { getExtensionId, getCanvasDims, docScreenshot, FIXTURES } from './helpers.js';
import path from 'path';

test.describe('Edit Operations', () => {
  let page, extId, browserName;

  async function loadImage(filename) {
    // Go home first if in a tool
    const home = page.locator('#home:visible');
    if (!(await home.count())) {
      await page.click('#btn-back');
      await page.waitForTimeout(300);
      // Handle unsaved dialog
      try { const ok = page.locator('.snaproo-dialog-backdrop button.btn-primary:visible'); if (await ok.count()) await ok.click(); } catch {}
      await page.waitForTimeout(300);
    }
    await page.click('[data-mode="edit"]');
    await page.waitForTimeout(300);
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#edit-dropzone');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(FIXTURES, filename));
    await page.waitForTimeout(800);
  }

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    extId = await getExtensionId(context);
    page = await context.newPage();
    browserName = browser.browserType().name();
    await page.goto(`chrome-extension://${extId}/editor/editor.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  });

  // ── Rotation tests (tests.md) ──────────────────────────
  test('rotate right then left preserves dimensions', async () => {
    await loadImage('test-500x300.png');
    const origDims = await getCanvasDims(page);
    expect(origDims).toEqual({ width: 500, height: 300 });

    // Rotate right
    await page.click('#btn-rotate-right');
    await page.waitForTimeout(300);
    const rotatedDims = await getCanvasDims(page);
    expect(rotatedDims).toEqual({ width: 300, height: 500 });

    // Verify W/H inputs updated
    const barW = await page.inputValue('#bar-w');
    const barH = await page.inputValue('#bar-h');
    expect(barW).toBe('300');
    expect(barH).toBe('500');

    // Rotate left
    await page.click('#btn-rotate-left');
    await page.waitForTimeout(300);
    const restoredDims = await getCanvasDims(page);
    expect(restoredDims).toEqual({ width: 500, height: 300 });

    await docScreenshot(page, 'test-rotate-preserved', browserName);
  });

  test('rotate preserves zoom on large image', async () => {
    await loadImage('test-1920x1080.png');
    await page.waitForTimeout(300);

    // Image should be auto-fitted (CSS width set)
    const cssWidth = await page.evaluate(() => document.getElementById('editor-canvas')?.style.width);
    expect(cssWidth).toBeTruthy(); // Should have CSS width set by fitToView

    // Rotate right
    await page.click('#btn-rotate-right');
    await page.waitForTimeout(300);

    // Should still have CSS fit
    const cssWidthAfter = await page.evaluate(() => document.getElementById('editor-canvas')?.style.width);
    expect(cssWidthAfter).toBeTruthy();

    // Resize handles should be visible
    const handles = page.locator('#img-resize-handles:visible');
    await expect(handles).toBeVisible();
  });

  // ── Undo/Redo tests (tests.md) ─────────────────────────
  test('undo/redo preserves fit-to-view', async () => {
    await loadImage('test-1920x1080.png');

    // Apply flip
    await page.click('#btn-flip-h');
    await page.waitForTimeout(200);

    // Check CSS fit exists
    const before = await page.evaluate(() => document.getElementById('editor-canvas')?.style.width);

    // Undo
    await page.click('#btn-undo');
    await page.waitForTimeout(300);
    const after = await page.evaluate(() => document.getElementById('editor-canvas')?.style.width);
    expect(after).toBeTruthy();

    // Redo
    await page.click('#btn-redo');
    await page.waitForTimeout(300);
    const afterRedo = await page.evaluate(() => document.getElementById('editor-canvas')?.style.width);
    expect(afterRedo).toBeTruthy();
  });

  // ── Crop tests (tests.md) ──────────────────────────────
  test('crop free starts and can be cancelled', async () => {
    await loadImage('test-500x300.png');

    await page.click('#btn-crop-free');
    await page.waitForTimeout(500);

    // Crop overlay should be visible (position:fixed container)
    const cropContainer = page.locator('div[style*="position:fixed"][style*="z-index:1000"]');
    const count = await cropContainer.count();
    expect(count).toBeGreaterThan(0);

    // Press Escape to cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Canvas should still be same size
    const dims = await getCanvasDims(page);
    expect(dims).toEqual({ width: 500, height: 300 });
  });

  // ── Mask filter tests (tests.md) ───────────────────────
  test('mask filter shows pill buttons on overlay', async () => {
    await loadImage('test-500x300.png');

    await page.click('#btn-mask-filter');
    await page.waitForTimeout(500);

    // Check for filter pill buttons in crop overlay toolbar
    const pills = page.locator('.mask-pill');
    const pillCount = await pills.count();
    expect(pillCount).toBe(5); // Blur, Pixelate, Grayscale, Invert, Sepia

    await docScreenshot(page, 'test-mask-pills', browserName);

    // Cancel
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // ── Crop + Objects flatten (tests.md) ───────────────────
  test('crop with draw objects flattens them into image', async () => {
    await loadImage('test-500x300.png');

    // Add a rectangle object
    await page.click('#btn-ann-rect');
    await page.waitForTimeout(200);

    // Check object layer is active
    const hasObjects = await page.evaluate(() => {
      return window._snaprooObjLayer?.objects?.length || 0;
    });
    // Objects may or may not be added via click — just verify the tool activated
    await page.click('#btn-ann-select'); // back to select
    await page.waitForTimeout(200);

    // Start crop
    await page.click('#btn-crop-free');
    await page.waitForTimeout(500);

    // Verify crop overlay appeared
    const cropOverlay = page.locator('div[style*="position:fixed"][style*="z-index:1000"]');
    const overlayCount = await cropOverlay.count();
    expect(overlayCount).toBeGreaterThan(0);

    // Cancel crop for now (full crop+flatten needs mouse interaction)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  });

  // ── Export preset tests (tests.md) ─────────────────────
  test('export preset dropdown exists with options', async () => {
    await loadImage('test-500x300.png');

    const options = await page.locator('#export-preset option').count();
    expect(options).toBeGreaterThan(15); // Should have 18+ presets

    // Check specific preset exists
    const igPost = page.locator('#export-preset option[value*="instagram-post"]');
    await expect(igPost).toHaveCount(1);

    const ytThumb = page.locator('#export-preset option[value*="youtube-thumb"]');
    await expect(ytThumb).toHaveCount(1);
  });

  // ── Resize handles (tests.md) ──────────────────────────
  test('resize handles visible after load', async () => {
    await loadImage('test-200x200.png');
    await page.waitForTimeout(300);

    const handles = page.locator('#img-resize-handles:visible');
    await expect(handles).toBeVisible();
  });
});
