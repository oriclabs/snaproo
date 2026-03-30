// Snaproo E2E — Screenshot capture for store/docs
// Run with: npm run test:e2e:screenshots
// Outputs to tests/screenshots/{browser}/
import { test } from '@playwright/test';
import { getExtensionId, docScreenshot, FIXTURES } from './helpers.js';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve(FIXTURES, '../../screenshots');

test.describe('Store & Doc Screenshots', () => {
  let page, extId, browserName;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    extId = await getExtensionId(context);
    page = await context.newPage();
    browserName = browser.browserType().name();
    // Ensure screenshot dir exists
    const dir = path.join(SCREENSHOT_DIR, browserName);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    await page.goto(`chrome-extension://${extId}/editor/editor.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(800);
  });

  test('home screen with all tools', async () => {
    await docScreenshot(page, 'store-01-home', browserName);
  });

  test('home screen search', async () => {
    await page.fill('#home-search', 'social');
    await page.waitForTimeout(300);
    await docScreenshot(page, 'store-02-search', browserName);
    await page.fill('#home-search', '');
    await page.waitForTimeout(200);
  });

  test('edit tool with image', async () => {
    await page.click('[data-mode="edit"]');
    await page.waitForTimeout(300);
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#edit-dropzone');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(FIXTURES, 'test-1920x1080.png'));
    await page.waitForTimeout(800);
    await docScreenshot(page, 'store-03-edit-tool', browserName);
  });

  test('edit tool - adjust sliders', async () => {
    // Just show the ribbon with adjust group visible
    await docScreenshot(page, 'store-04-edit-ribbon', browserName);
  });

  test('back to home', async () => {
    await page.click('#btn-back');
    await page.waitForTimeout(500);
    // Handle unsaved work dialog if it appears
    try {
      const okBtn = page.locator('.snaproo-dialog-backdrop button.btn-primary:visible');
      if (await okBtn.count() > 0) await okBtn.click();
    } catch {}
    await page.waitForTimeout(300);
  });

  test('QR code tool', async () => {
    await page.click('[data-mode="qr"]');
    await page.waitForTimeout(500);
    await docScreenshot(page, 'store-05-qr-tool', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('generate tool', async () => {
    await page.click('[data-mode="generate"]');
    await page.waitForTimeout(300);
    // Click gradient Go to show a preview
    await page.click('#btn-gen-gradient').catch(() => {});
    await page.waitForTimeout(300);
    await docScreenshot(page, 'store-06-generate-tool', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('showcase tool', async () => {
    await page.click('[data-mode="showcase"]');
    await page.waitForTimeout(300);
    await docScreenshot(page, 'store-07-showcase-tool', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('meme tool', async () => {
    await page.click('[data-mode="meme"]');
    await page.waitForTimeout(300);
    await docScreenshot(page, 'store-08-meme-tool', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('certificate tool', async () => {
    await page.click('[data-mode="certificate"]');
    await page.waitForTimeout(500);
    await docScreenshot(page, 'store-09-certificate-tool', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('gif creator tool', async () => {
    await page.click('[data-mode="gif"]');
    await page.waitForTimeout(300);
    await docScreenshot(page, 'store-10-gif-tool', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('library manager', async () => {
    await page.click('#btn-open-library');
    await page.waitForTimeout(500);
    await docScreenshot(page, 'store-11-library', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('popup', async () => {
    const popup = await page.context().newPage();
    await popup.goto(`chrome-extension://${extId}/popup/popup.html`);
    await popup.waitForLoadState('domcontentloaded');
    await popup.waitForTimeout(500);
    await popup.screenshot({ path: path.join(SCREENSHOT_DIR, browserName, 'store-12-popup.png') });
    await popup.close();
  });
});
