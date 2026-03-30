// Unit tests for isRestrictedUrl (from sp-shared.js)

// Inline the function for testing (no browser APIs needed)
const _restrictedProtocols = ['chrome://', 'chrome-extension://', 'edge://', 'brave://', 'about:', 'devtools://', 'chrome-search://'];
const _restrictedDomains = [
  'chromewebstore.google.com', 'chrome.google.com/webstore',
  'microsoftedge.microsoft.com/addons', 'addons.opera.com',
  'accounts.google.com',
];

function isRestrictedUrl(url) {
  if (!url) return false;
  for (const p of _restrictedProtocols) { if (url.startsWith(p)) return true; }
  if (url.startsWith('http://') || url.startsWith('https://')) {
    for (const d of _restrictedDomains) { if (url.includes(d)) return true; }
  }
  if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) return true;
  return false;
}

describe('isRestrictedUrl', () => {
  test('chrome:// pages are restricted', () => {
    expect(isRestrictedUrl('chrome://extensions')).toBe(true);
    expect(isRestrictedUrl('chrome://settings')).toBe(true);
    expect(isRestrictedUrl('chrome://newtab')).toBe(true);
  });

  test('chrome-extension:// pages are restricted', () => {
    expect(isRestrictedUrl('chrome-extension://abcd1234/popup.html')).toBe(true);
  });

  test('edge:// pages are restricted', () => {
    expect(isRestrictedUrl('edge://extensions')).toBe(true);
  });

  test('brave:// pages are restricted', () => {
    expect(isRestrictedUrl('brave://settings')).toBe(true);
  });

  test('about: pages are restricted', () => {
    expect(isRestrictedUrl('about:blank')).toBe(true);
  });

  test('devtools:// pages are restricted', () => {
    expect(isRestrictedUrl('devtools://devtools/inspector.html')).toBe(true);
  });

  test('Chrome Web Store is restricted', () => {
    expect(isRestrictedUrl('https://chromewebstore.google.com/detail/extension')).toBe(true);
    expect(isRestrictedUrl('https://chrome.google.com/webstore/detail/extension')).toBe(true);
  });

  test('Edge Add-ons store is restricted', () => {
    expect(isRestrictedUrl('https://microsoftedge.microsoft.com/addons/detail/extension')).toBe(true);
  });

  test('Opera Add-ons store is restricted', () => {
    expect(isRestrictedUrl('https://addons.opera.com/extensions/details/extension')).toBe(true);
  });

  test('Google Accounts is restricted', () => {
    expect(isRestrictedUrl('https://accounts.google.com/signin')).toBe(true);
  });

  test('regular http/https pages are NOT restricted', () => {
    expect(isRestrictedUrl('https://example.com')).toBe(false);
    expect(isRestrictedUrl('https://google.com')).toBe(false);
    expect(isRestrictedUrl('http://localhost:3000')).toBe(false);
    expect(isRestrictedUrl('https://github.com')).toBe(false);
  });

  test('file:// URLs are NOT restricted', () => {
    expect(isRestrictedUrl('file:///C:/Users/test/image.html')).toBe(false);
  });

  test('empty/null URL returns false', () => {
    expect(isRestrictedUrl('')).toBe(false);
    expect(isRestrictedUrl(null)).toBe(false);
    expect(isRestrictedUrl(undefined)).toBe(false);
  });

  test('unknown protocols are restricted', () => {
    expect(isRestrictedUrl('ftp://files.example.com')).toBe(true);
    expect(isRestrictedUrl('data:image/png;base64,abc')).toBe(true);
  });
});
