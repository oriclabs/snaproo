// Pixeroo E2E Test Helpers
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const FIXTURES = path.resolve(__dirname, '../fixtures');
export const SCREENSHOTS = path.resolve(__dirname, '../screenshots');

/**
 * Get the editor page (extension tab)
 * Opens editor if not already open
 */
export async function getEditorPage(context) {
  // Find existing editor tab
  let pages = context.pages();
  let editor = pages.find(p => p.url().includes('editor/editor.html'));
  if (!editor) {
    // Open editor via extension URL
    const extId = await getExtensionId(context);
    editor = await context.newPage();
    await editor.goto(`chrome-extension://${extId}/editor/editor.html`);
    await editor.waitForLoadState('domcontentloaded');
    await editor.waitForTimeout(500);
  }
  return editor;
}

/**
 * Get the extension ID from service worker
 */
export async function getExtensionId(context) {
  let sw = context.serviceWorkers()[0];
  if (!sw) {
    sw = await context.waitForEvent('serviceworker');
  }
  return sw.url().split('/')[2];
}

/**
 * Take a named screenshot for docs/store
 * Saves to tests/screenshots/{browser}/{name}.png
 */
export async function docScreenshot(page, name, browserName) {
  const dir = path.join(SCREENSHOTS, browserName || 'chrome');
  await page.screenshot({
    path: path.join(dir, `${name}.png`),
    fullPage: false,
  });
}

/**
 * Load a test image into the editor via file chooser
 */
export async function loadImageInEditor(page, fixtureName) {
  const filePath = path.join(FIXTURES, fixtureName);
  // Click the dropzone to trigger file chooser
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.click('#edit-dropzone');
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(filePath);
  await page.waitForTimeout(500);
}

/**
 * Navigate to a tool from the home screen
 */
export async function openTool(page, mode) {
  await page.click(`[data-mode="${mode}"]`);
  await page.waitForTimeout(300);
}

/**
 * Go back to home from any tool
 */
export async function goHome(page) {
  await page.click('#btn-back');
  await page.waitForTimeout(300);
}

/**
 * Get canvas dimensions from the editor
 */
export async function getCanvasDims(page) {
  return page.evaluate(() => {
    const c = document.getElementById('editor-canvas');
    return c ? { width: c.width, height: c.height } : null;
  });
}
