// Pixeroo Popup - QR + launchers + quick settings

document.addEventListener('DOMContentLoaded', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  document.getElementById('qr-url').textContent = url;
  generateQR(url);

  // Page Images -> open side panel
  document.getElementById('btn-page-images').addEventListener('click', () => {
    if (tab?.id) chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    window.close();
  });

  // Toolkit -> reuse existing editor tab or open new
  document.getElementById('btn-toolkit').addEventListener('click', () => {
    chrome.runtime.sendMessage({ action: 'openEditor' });
    window.close();
  });

  // Help
  document.getElementById('btn-help').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('help/help.html') });
    window.close();
  });

  // Advanced settings -> full page
  document.getElementById('btn-advanced').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/settings.html') });
    window.close();
  });

  // ── Quick Actions ─────────────────────────────────────
  // Screenshot — capture visible tab, open in editor
  document.getElementById('pqa-screenshot')?.addEventListener('click', async () => {
    try {
      const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
      const name = 'screenshot-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
      // Store for editor to pick up
      await chrome.storage.local.set({ 'pixeroo-screenshot': { dataUrl, name } });
      // Screenshot will be auto-saved to recent files when editor loads it
      chrome.runtime.sendMessage({ action: 'openEditor', params: 'fromScreenshot=1' });
      window.close();
    } catch (e) {
      // Fallback: just open editor
      chrome.runtime.sendMessage({ action: 'openEditor' });
      window.close();
    }
  });

  // Region — tell content script to show selector, then capture
  document.getElementById('pqa-region')?.addEventListener('click', async () => {
    try {
      if (tab?.id) {
        // Inject region selector into the page
        await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content/detector.js'] }).catch(() => {});
        await new Promise(r => setTimeout(r, 100));
        chrome.tabs.sendMessage(tab.id, { action: 'startRegionCapture' });
      }
      window.close();
    } catch {
      window.close();
    }
  });

  // Pick Color — open side panel with colors tab
  document.getElementById('pqa-color')?.addEventListener('click', () => {
    if (tab?.id) chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
    // Signal to switch to colors tab
    chrome.runtime.sendMessage({ action: 'switchToColors' });
    window.close();
  });

  // QR Page — scroll to QR section (already visible, just focus)
  document.getElementById('pqa-qr-page')?.addEventListener('click', () => {
    document.getElementById('qr-output')?.scrollIntoView({ behavior: 'smooth' });
  });

  // Copy QR
  document.getElementById('btn-copy-qr').addEventListener('click', () => {
    document.getElementById('qr-output').toBlob((blob) => {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(() => {
        const btn = document.getElementById('btn-copy-qr');
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = 'Copy'; }, 1500);
      });
    });
  });

  // ── Quick Settings toggle ──────────────────────────────
  const qsHeader = document.getElementById('qs-header');
  const qsBody = document.getElementById('qs-body');
  const qsArrow = document.getElementById('qs-arrow');

  // Restore collapsed state
  chrome.storage.local.get({ qsOpen: false }, (r) => {
    if (r.qsOpen) {
      qsBody.classList.add('open');
      qsArrow.style.transform = 'rotate(180deg)';
    }
  });

  qsHeader.addEventListener('click', () => {
    const open = qsBody.classList.toggle('open');
    qsArrow.style.transform = open ? 'rotate(180deg)' : '';
    chrome.storage.local.set({ qsOpen: open });
  });

  // ── Load quick settings values ─────────────────────────
  const qsTheme = document.getElementById('qs-theme');
  const qsFormat = document.getElementById('qs-format');
  const qsEcc = document.getElementById('qs-qr-ecc');
  const qsView = document.getElementById('qs-view');

  chrome.storage.sync.get({
    theme: 'dark',
    defaultFormat: 'png',
    qrDefaultEcc: 'M',
    defaultView: 'tiles',
  }, (s) => {
    qsTheme.value = s.theme || 'dark';
    qsFormat.value = s.defaultFormat || 'png';
    qsEcc.value = s.qrDefaultEcc || 'M';
    qsView.value = s.defaultView || 'tiles';
    document.body.classList.toggle('theme-light', qsTheme.value === 'light');
  });

  // ── Save on change (sync storage, matches settings page) ──
  qsTheme.addEventListener('change', () => {
    chrome.storage.sync.set({ theme: qsTheme.value });
    document.body.classList.toggle('theme-light', qsTheme.value === 'light');
  });

  qsFormat.addEventListener('change', () => {
    chrome.storage.sync.set({ defaultFormat: qsFormat.value });
  });

  qsEcc.addEventListener('change', () => {
    chrome.storage.sync.set({ qrDefaultEcc: qsEcc.value });
  });

  qsView.addEventListener('change', () => {
    chrome.storage.sync.set({ defaultView: qsView.value });
  });
});

function generateQR(text) {
  const canvas = document.getElementById('qr-output');
  const ctx = canvas.getContext('2d');

  if (!text || text.startsWith('chrome://') || text.startsWith('chrome-extension://') || text.startsWith('about:')) {
    canvas.width = 180; canvas.height = 180;
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 180, 180);
    ctx.fillStyle = '#64748b'; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No URL available', 90, 86);
    ctx.fillStyle = '#475569'; ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.fillText('Navigate to a page first', 90, 104);
    return;
  }

  try {
    const qr = QR.encode(text);
    const px = Math.max(1, Math.floor(170 / (qr.size + 8)));
    QR.renderToCanvas(canvas, qr, px, 4, '#000000', '#ffffff');
  } catch {
    canvas.width = 180; canvas.height = 180;
    ctx.fillStyle = '#1e293b'; ctx.fillRect(0, 0, 180, 180);
    ctx.fillStyle = '#ef4444'; ctx.font = '11px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('URL too long for QR', 90, 86);
    ctx.fillStyle = '#475569'; ctx.font = '10px sans-serif';
    ctx.fillText('Use QR Studio in Toolkit', 90, 104);
  }
}
