import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 0,
  workers: 1, // serial for extension tests

  use: {
    headless: false, // extensions need headed mode
    viewport: { width: 1280, height: 800 },
    screenshot: 'on', // capture on every test
    trace: 'on-first-retry',
  },

  // Screenshot output for store/docs
  outputDir: './tests/screenshots',

  projects: [
    {
      name: 'chrome',
      use: {
        browserName: 'chromium',
        channel: 'chrome',
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, 'browser/chrome')}`,
            `--load-extension=${path.resolve(__dirname, 'browser/chrome')}`,
          ],
        },
      },
    },
    {
      name: 'edge',
      use: {
        browserName: 'chromium',
        channel: 'msedge',
        launchOptions: {
          args: [
            `--disable-extensions-except=${path.resolve(__dirname, 'browser/chrome')}`,
            `--load-extension=${path.resolve(__dirname, 'browser/chrome')}`,
          ],
        },
      },
    },
    // Firefox: web-ext based loading (different from Chromium)
    // Uncomment when Firefox add-on manifest is ready
    // {
    //   name: 'firefox',
    //   use: {
    //     browserName: 'firefox',
    //   },
    // },
  ],
});
