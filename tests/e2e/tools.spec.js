// Pixeroo E2E — Individual tool smoke tests
import { test, expect } from '@playwright/test';
import { getExtensionId, docScreenshot } from './helpers.js';

test.describe('Tool Smoke Tests', () => {
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

  async function openAndVerify(mode, selector) {
    await page.click(`[data-mode="${mode}"]`);
    await page.waitForTimeout(300);
    await expect(page.locator(`#mode-${mode}`)).toBeVisible();
    if (selector) await expect(page.locator(selector)).toBeVisible();
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  }

  test('Edit tool opens with dropzone', async () => {
    await openAndVerify('edit', '#edit-dropzone');
  });

  test('Convert tool opens', async () => {
    await openAndVerify('convert', '#mode-convert');
  });

  test('Store Assets tool opens', async () => {
    await openAndVerify('store', '#mode-store');
  });

  test('Info tool opens', async () => {
    await openAndVerify('info', '#mode-info');
  });

  test('Colors tool opens', async () => {
    await openAndVerify('colors', '#mode-colors');
  });

  test('SVG tool opens', async () => {
    await openAndVerify('svg', '#mode-svg');
  });

  test('QR Code tool opens', async () => {
    await openAndVerify('qr', '#mode-qr');
  });

  test('Compare tool opens', async () => {
    await openAndVerify('compare', '#mode-compare');
  });

  test('Generate tool opens and generates gradient', async () => {
    await page.click('[data-mode="generate"]');
    await page.waitForTimeout(300);
    await page.click('#btn-gen-gradient');
    await page.waitForTimeout(300);
    const canvas = page.locator('#gen-canvas');
    const width = await canvas.evaluate(el => el.width);
    expect(width).toBeGreaterThan(0);
    await docScreenshot(page, 'test-generate-gradient', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('Showcase tool opens with dropzone', async () => {
    await openAndVerify('showcase', '#sc-dropzone');
  });

  test('Meme tool opens', async () => {
    await openAndVerify('meme', '#meme-dropzone');
  });

  test('Certificate tool renders on open', async () => {
    await page.click('[data-mode="certificate"]');
    await page.waitForTimeout(500);
    const canvas = page.locator('#cert-canvas');
    const width = await canvas.evaluate(el => el.width);
    expect(width).toBeGreaterThan(0); // Certificate renders immediately
    await docScreenshot(page, 'test-certificate', browserName);
    await page.click('#btn-back');
    await page.waitForTimeout(300);
  });

  test('GIF Creator tool opens', async () => {
    await openAndVerify('gif', '#gif-dropzone');
  });

  test('Collage tool opens', async () => {
    await openAndVerify('collage', '#mode-collage');
  });

  test('Batch Edit tool opens', async () => {
    await openAndVerify('batch', '#mode-batch');
  });

  test('Social Media tool opens', async () => {
    await openAndVerify('social', '#mode-social');
  });

  test('Watermark tool opens', async () => {
    await openAndVerify('watermark', '#mode-watermark');
  });

  test('Callout tool opens', async () => {
    await openAndVerify('callout', '#mode-callout');
  });
});
