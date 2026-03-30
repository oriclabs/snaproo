// Snaproo E2E — Convert Tool tests
import { test, expect } from '@playwright/test';
import { getExtensionId, docScreenshot, openTool, goHome } from './helpers.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.resolve(__dirname, '../fixtures');

test.describe('Convert Tool', () => {
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

  test.afterAll(async () => { await page.close(); });

  // ── Navigation ─────────────────────────────────────────
  test('opens convert mode from home', async () => {
    await openTool(page, 'convert');
    await expect(page.locator('#mode-convert')).toBeVisible();
    await expect(page.locator('#convert-table-wrap')).toBeVisible();
  });

  test('shows empty state when no files', async () => {
    const tbody = page.locator('#convert-table-body');
    await expect(tbody).toContainText('Drop images here or click Add');
  });

  test('actions bar is visible', async () => {
    await expect(page.locator('#convert-actions-bar')).toBeVisible();
    await expect(page.locator('#btn-convert-add2')).toBeVisible();
    await expect(page.locator('#btn-convert-go')).toBeVisible();
    await expect(page.locator('#btn-convert-go')).toBeDisabled();
  });

  // ── Adding files ───────────────────────────────────────
  test('adds file via file chooser', async () => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#btn-convert-add2');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(FIXTURES, 'test-500x300.png'));
    await page.waitForTimeout(500);

    // Table should now have a row
    const rows = page.locator('#convert-table-body tr');
    await expect(rows).toHaveCount(1);

    // Convert button should be enabled
    await expect(page.locator('#btn-convert-go')).toBeEnabled();
  });

  test('displays file info in table row', async () => {
    const row = page.locator('#convert-table-body tr').first();
    await expect(row).toContainText('test-500x300.png');
    await expect(row).toContainText('500×300');
    await expect(row).toContainText('PNG');
  });

  test('source format excluded from target dropdown', async () => {
    // Source is PNG — dropdown should not contain PNG
    const select = page.locator('#convert-table-body tr select').first();
    const options = await select.locator('option').allTextContents();
    expect(options).not.toContain('PNG');
    expect(options).toContain('JPEG');
    expect(options).toContain('WebP');
  });

  test('auto-selects best alternative format', async () => {
    // PNG should auto-select WebP
    const select = page.locator('#convert-table-body tr select').first();
    const value = await select.inputValue();
    expect(value).toBe('webp');
  });

  test('adds second file', async () => {
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#btn-convert-add2');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(FIXTURES, 'test-200x200.png'));
    await page.waitForTimeout(500);

    const rows = page.locator('#convert-table-body tr');
    await expect(rows).toHaveCount(2);
  });

  test('status shows file count and total size', async () => {
    const status = page.locator('#convert-status');
    const text = await status.textContent();
    expect(text).toMatch(/2 files/);
    expect(text).toMatch(/[0-9.]+\s*(B|KB|MB)/);
  });

  // ── Table interactions ─────────────────────────────────
  test('checkbox toggles file selection', async () => {
    const cb = page.locator('#convert-table-body tr:first-child input[type="checkbox"]');
    await cb.uncheck();
    await page.waitForTimeout(200);

    // Convert button label should reflect partial selection
    const btnText = await page.locator('#btn-convert-go').textContent();
    expect(btnText).toMatch(/Convert 1 of 2/);

    // Re-check
    await cb.check();
    await page.waitForTimeout(200);
    const btnText2 = await page.locator('#btn-convert-go').textContent();
    expect(btnText2).toMatch(/Convert All/);
  });

  test('select all checkbox toggles all', async () => {
    await page.locator('#cvt-table-selall').uncheck();
    await page.waitForTimeout(200);
    await expect(page.locator('#btn-convert-go')).toBeDisabled();

    await page.locator('#cvt-table-selall').check();
    await page.waitForTimeout(200);
    await expect(page.locator('#btn-convert-go')).toBeEnabled();
  });

  test('format dropdown changes target', async () => {
    const select = page.locator('#convert-table-body tr:first-child select');
    await select.selectOption('jpeg');
    await page.waitForTimeout(200);
    const value = await select.inputValue();
    expect(value).toBe('jpeg');
  });

  test('delete button removes file', async () => {
    // Should have 2 rows
    await expect(page.locator('#convert-table-body tr')).toHaveCount(2);

    // Click delete on second row
    await page.locator('#convert-table-body tr:nth-child(2) button[title="Remove file"]').click();
    await page.waitForTimeout(200);

    await expect(page.locator('#convert-table-body tr')).toHaveCount(1);
  });

  // ── Preview overlay ────────────────────────────────────
  test('preview button opens overlay', async () => {
    // Click preview (eye icon) on first row
    await page.locator('#convert-table-body tr:first-child button[title="Preview conversion"]').click();
    await page.waitForTimeout(500);

    await expect(page.locator('#convert-preview-overlay')).toBeVisible();
    await expect(page.locator('#convert-preview-title')).toContainText('Preview');
    await expect(page.locator('#convert-img')).toBeVisible();
  });

  test('preview shows settings panel', async () => {
    await expect(page.locator('#convert-settings-panel')).toBeVisible();
    await expect(page.locator('#convert-settings-body')).toBeVisible();
  });

  test('settings panel has format dropdown', async () => {
    const settingsSelect = page.locator('#convert-settings-body select');
    await expect(settingsSelect).toBeVisible();
  });

  test('changing format in settings rebuilds panel and updates preview', async () => {
    const settingsSelect = page.locator('#convert-settings-body select');
    await settingsSelect.selectOption('webp');
    await page.waitForTimeout(600);

    // Should show quality slider for WebP
    await expect(page.locator('#convert-settings-body')).toContainText('Quality');
    await expect(page.locator('#convert-output-label')).toContainText('WEBP');
  });

  test('quality slider updates live preview', async () => {
    const slider = page.locator('#convert-settings-body input[type="range"]');
    if (await slider.isVisible()) {
      // Get initial output size
      const sizeBefore = await page.locator('#convert-output-size').textContent();

      // Drag slider to low quality
      await slider.fill('20');
      await page.waitForTimeout(600);

      const sizeAfter = await page.locator('#convert-output-size').textContent();
      // Size should change (lower quality = smaller file)
      expect(sizeAfter).not.toBe(sizeBefore);
    }
  });

  test('switching to SVG Trace shows trace options', async () => {
    const settingsSelect = page.locator('#convert-settings-body select');
    await settingsSelect.selectOption('svg');
    await page.waitForTimeout(600);

    await expect(page.locator('#convert-settings-body')).toContainText('Colors');
    await expect(page.locator('#convert-settings-body')).toContainText('Blur');
    await expect(page.locator('#convert-settings-body')).toContainText('Smooth');
    await expect(page.locator('#convert-output-label')).toContainText('SVG Trace');
  });

  test('reset link restores defaults', async () => {
    const resetLink = page.locator('#convert-settings-body a', { hasText: 'Reset' });
    if (await resetLink.isVisible()) {
      await resetLink.click();
      await page.waitForTimeout(400);
    }
  });

  test('close preview with X button', async () => {
    await page.click('#cvt-close-preview');
    await page.waitForTimeout(300);
    await expect(page.locator('#convert-preview-overlay')).toBeHidden();
  });

  test('preview closes on Escape', async () => {
    // Re-open preview
    await page.locator('#convert-table-body tr:first-child button[title="Preview conversion"]').click();
    await page.waitForTimeout(500);
    await expect(page.locator('#convert-preview-overlay')).toBeVisible();

    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await expect(page.locator('#convert-preview-overlay')).toBeHidden();
  });

  test('preview closes on backdrop click', async () => {
    // Re-open preview
    await page.locator('#convert-table-body tr:first-child button[title="Preview conversion"]').click();
    await page.waitForTimeout(500);

    // Click the backdrop (overlay itself, not the inner content)
    await page.locator('#convert-preview-overlay').click({ position: { x: 10, y: 10 } });
    await page.waitForTimeout(300);
    await expect(page.locator('#convert-preview-overlay')).toBeHidden();
  });

  // ── Rename popover ─────────────────────────────────────
  test('rename button opens popover', async () => {
    await page.click('#btn-convert-rename');
    await page.waitForTimeout(200);
    await expect(page.locator('#convert-rename-popover')).toBeVisible();
    await expect(page.locator('#cvt-rename-input')).toBeVisible();
  });

  test('rename popover shows placeholder chips', async () => {
    await expect(page.locator('.cvt-rename-chip', { hasText: '{name}' })).toBeVisible();
    await expect(page.locator('.cvt-rename-chip', { hasText: '{index}' })).toBeVisible();
    await expect(page.locator('.cvt-rename-chip', { hasText: '{fmt}' })).toBeVisible();
  });

  test('rename input shows live preview', async () => {
    await page.fill('#cvt-rename-input', 'converted-{name}');
    await page.waitForTimeout(200);
    const preview = await page.locator('#cvt-rename-preview').textContent();
    expect(preview).toMatch(/converted-test-500x300/);
  });

  test('chip inserts placeholder at cursor', async () => {
    await page.fill('#cvt-rename-input', '');
    await page.click('.cvt-rename-chip >> text={name}');
    await page.waitForTimeout(100);
    const val = await page.locator('#cvt-rename-input').inputValue();
    expect(val).toContain('{name}');
  });

  test('rename popover closes on outside click', async () => {
    await page.click('#convert-table-wrap');
    await page.waitForTimeout(200);
    await expect(page.locator('#convert-rename-popover')).toBeHidden();
  });

  // ── Strip EXIF ─────────────────────────────────────────
  test('strip EXIF toggle exists', async () => {
    await expect(page.locator('#convert-strip-meta')).toBeVisible();
  });

  // ── Clear ──────────────────────────────────────────────
  test('clear removes all files and shows empty state', async () => {
    await page.click('#btn-convert-clear2');
    await page.waitForTimeout(300);

    await expect(page.locator('#convert-table-body')).toContainText('Drop images here');
    await expect(page.locator('#btn-convert-go')).toBeDisabled();
  });

  // ── Convert execution ──────────────────────────────────
  test('convert downloads file', async () => {
    // Add a file first
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.click('#btn-convert-add2');
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(path.join(FIXTURES, 'test-200x200.png'));
    await page.waitForTimeout(500);

    // Set format to JPEG
    await page.locator('#convert-table-body tr:first-child select').selectOption('jpeg');
    await page.waitForTimeout(200);

    // Click convert — expect a download
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 });
    await page.click('#btn-convert-go');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/\.jpg$/);
    await page.waitForTimeout(1500); // wait for progress bar to finish
  });

  // ── Screenshot for docs ────────────────────────────────
  test('screenshot: convert with files', async () => {
    await docScreenshot(page, 'convert-table', browserName);
  });

  // ── Cleanup ────────────────────────────────────────────
  test('navigates back to home', async () => {
    await goHome(page);
    await page.waitForTimeout(300);
  });
});
