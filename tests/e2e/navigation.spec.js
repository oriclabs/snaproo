// Snaproo E2E — Navigation flows
import { test, expect } from '@playwright/test';
import { getExtensionId, docScreenshot } from './helpers.js';

test.describe('Navigation', () => {
  let page, extId;

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext();
    extId = await getExtensionId(context);
    page = await context.newPage();
    await page.goto(`chrome-extension://${extId}/editor/editor.html`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(500);
  });

  test('home screen is default view', async () => {
    await expect(page.locator('#home')).toBeVisible();
    await expect(page.locator('#btn-back')).not.toBeVisible();
  });

  test('clicking tool card opens tool', async () => {
    await page.click('[data-mode="qr"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#mode-qr')).toBeVisible();
    await expect(page.locator('#btn-back')).toBeVisible();
  });

  test('back button returns to home', async () => {
    await page.click('#btn-back');
    await page.waitForTimeout(300);
    await expect(page.locator('#home')).toBeVisible();
  });

  test('Escape key returns to home', async () => {
    await page.click('[data-mode="generate"]');
    await page.waitForTimeout(300);
    await expect(page.locator('#mode-generate')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('#home')).toBeVisible();
  });

  test('library opens from topbar', async () => {
    await page.click('[data-mode="edit"]');
    await page.waitForTimeout(300);
    await page.click('#btn-open-library');
    await page.waitForTimeout(300);
    await expect(page.locator('#library-manager')).toBeVisible();
  });

  test('library back returns to previous tool', async () => {
    await page.click('#btn-back');
    await page.waitForTimeout(300);
    // Should return to edit, not home
    await expect(page.locator('#mode-edit')).toBeVisible();
  });

  test('back from edit (no work) goes to home', async () => {
    // No image loaded, so no unsaved work prompt
    await page.click('#btn-back');
    await page.waitForTimeout(300);
    await expect(page.locator('#home')).toBeVisible();
  });

  test('quick actions open correct tools', async () => {
    const actions = [
      { id: 'qa-open-edit', mode: 'edit' },
      { id: 'qa-qr', mode: 'qr' },
      { id: 'qa-collage', mode: 'collage' },
    ];
    for (const { id, mode } of actions) {
      await page.click(`#${id}`);
      await page.waitForTimeout(300);
      await expect(page.locator(`#mode-${mode}`)).toBeVisible();
      await page.click('#btn-back');
      await page.waitForTimeout(300);
    }
  });
});
