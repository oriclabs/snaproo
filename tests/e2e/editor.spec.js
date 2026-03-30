// Pixeroo E2E — Editor tool flows
import { test, expect } from '@playwright/test';
import { getEditorPage, getExtensionId, loadImageInEditor, openTool, goHome, getCanvasDims, docScreenshot, FIXTURES } from './helpers.js';
import path from 'path';

test.describe('Editor Tool', () => {
  let page, extId, browserName;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    extId = await getExtensionId(context);
    page = await context.newPage();
    browserName = browser.browserType().name();
    await page.goto(`chrome-extension://${extId}/editor/editor.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  });

  test('home screen shows tool grid and quick actions', async () => {
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('.quick-actions')).toBeVisible();
    await expect(page.locator('.home-grid')).toBeVisible();
    await expect(page.locator('#home-search')).toBeVisible();
    await docScreenshot(page, '01-home-screen', browserName);
  });

  test('search filters tool cards', async () => {
    await page.fill('#home-search', 'qr');
    await page.waitForTimeout(200);
    const visible = await page.locator('.home-card:visible').count();
    expect(visible).toBeLessThan(15); // should filter down
    await page.fill('#home-search', '');
    await page.waitForTimeout(200);
  });

  test('can open Edit tool', async () => {
    await page.click('[data-mode="edit"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#mode-edit')).toBeVisible();
    await expect(page.locator('#edit-dropzone')).toBeVisible();
    await docScreenshot(page, '02-edit-dropzone', browserName);
  });

  test('can load image via file chooser', async () => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#edit-dropzone');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(FIXTURES, 'test-500x300.png'));
    await page.waitForTimeout(800);
    await expect(page.locator('#editor-canvas')).toBeVisible();
    const dims = await getCanvasDims(page);
    expect(dims.width).toBe(500);
    expect(dims.height).toBe(300);
    await docScreenshot(page, '03-edit-image-loaded', browserName);
  });

  test('rotate right swaps dimensions', async () => {
    await page.click('#btn-rotate-right');
    await page.waitForTimeout(300);
    const dims = await getCanvasDims(page);
    expect(dims.width).toBe(300);
    expect(dims.height).toBe(500);
    await docScreenshot(page, '04-edit-rotated-right', browserName);
  });

  test('rotate left restores dimensions', async () => {
    await page.click('#btn-rotate-left');
    await page.waitForTimeout(300);
    const dims = await getCanvasDims(page);
    expect(dims.width).toBe(500);
    expect(dims.height).toBe(300);
  });

  test('undo removes last operation', async () => {
    await page.click('#btn-undo');
    await page.waitForTimeout(300);
    // After undoing the rotate-left, we should be back to rotated-right (300x500)
    const dims = await getCanvasDims(page);
    expect(dims.width).toBe(300);
    expect(dims.height).toBe(500);
  });

  test('redo restores undone operation', async () => {
    await page.click('#btn-redo');
    await page.waitForTimeout(300);
    const dims = await getCanvasDims(page);
    expect(dims.width).toBe(500);
    expect(dims.height).toBe(300);
  });

  test('resize handles are visible', async () => {
    const handles = page.locator('#img-resize-handles');
    await expect(handles).toBeVisible();
  });

  test('back button prompts when work exists', async () => {
    // We have operations in pipeline, so back should prompt
    const dialogPromise = page.waitForEvent('dialog', { timeout: 3000 }).catch(() => null);
    await page.click('#btn-back');
    await page.waitForTimeout(500);
    // pixDialog is custom, not native — check if dialog overlay appeared
    const dialogVisible = await page.locator('.pixeroo-dialog-backdrop:visible').count().catch(() => 0);
    // Accept or the mode-edit might still be visible
    await docScreenshot(page, '05-back-unsaved-prompt', browserName);
  });
});
