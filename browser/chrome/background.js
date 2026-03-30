// Snaproo - Background Service Worker
// Handles context menus, commands, message routing, QR reading

// Load jsQR locally (bundled, no CDN)
importScripts('lib/jsQR.min.js');

// --- Context Menu Setup ---
chrome.runtime.onInstalled.addListener(() => {
  // Parent menu
  chrome.contextMenus.create({
    id: 'snaproo',
    title: 'Snaproo',
    contexts: ['image']
  });

  // Image info
  chrome.contextMenus.create({
    id: 'snaproo-info',
    parentId: 'snaproo',
    title: 'View Image Info',
    contexts: ['image']
  });

  // Save As submenu
  chrome.contextMenus.create({
    id: 'snaproo-saveas',
    parentId: 'snaproo',
    title: 'Save As...',
    contexts: ['image']
  });

  const formats = ['PNG', 'JPEG', 'WebP', 'AVIF', 'BMP', 'ICO'];
  formats.forEach(fmt => {
    chrome.contextMenus.create({
      id: `snaproo-save-${fmt.toLowerCase()}`,
      parentId: 'snaproo-saveas',
      title: fmt,
      contexts: ['image']
    });
  });

  // Copy as PNG
  chrome.contextMenus.create({
    id: 'snaproo-copy-png',
    parentId: 'snaproo',
    title: 'Copy as PNG',
    contexts: ['image']
  });

  // Read QR
  chrome.contextMenus.create({
    id: 'snaproo-read-qr',
    parentId: 'snaproo',
    title: 'Read QR Code',
    contexts: ['image']
  });

  // Separator + page-level actions
  chrome.contextMenus.create({
    id: 'snaproo-separator',
    parentId: 'snaproo',
    type: 'separator',
    contexts: ['image']
  });

  chrome.contextMenus.create({
    id: 'snaproo-extract-colors',
    parentId: 'snaproo',
    title: 'Extract Colors',
    contexts: ['image']
  });
});

// --- Context Menu Click Handler ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const { menuItemId, srcUrl } = info;

  if (menuItemId === 'snaproo-info') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showImageInfo',
      src: srcUrl
    });
  } else if (menuItemId.startsWith('snaproo-save-')) {
    const format = menuItemId.replace('snaproo-save-', '');
    chrome.tabs.sendMessage(tab.id, {
      action: 'convertAndSave',
      src: srcUrl,
      format: format
    });
  } else if (menuItemId === 'snaproo-copy-png') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'copyAsPng',
      src: srcUrl
    });
  } else if (menuItemId === 'snaproo-read-qr') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'readQR',
      src: srcUrl
    });
  } else if (menuItemId === 'snaproo-extract-colors') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'extractColors',
      src: srcUrl
    });
  }
});

// --- Keyboard Commands ---
chrome.commands.onCommand.addListener(async (command) => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  if (command === 'quick-qr') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'quickQR',
      url: tab.url
    });
  } else if (command === 'open-toolkit') {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// --- Message Router ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'download') {
    chrome.downloads.download({
      url: message.url,
      filename: message.filename || 'snaproo-image',
      saveAs: message.saveAs !== false
    }, (downloadId) => {
      sendResponse({ success: true, downloadId });
    });
    return true; // async response
  }

  if (message.action === 'readQR') {
    try {
      const data = new Uint8ClampedArray(message.data);
      const result = jsQR(data, message.width, message.height);
      sendResponse({ text: result?.data || null });
    } catch (e) {
      sendResponse({ text: null, error: e.message });
    }
    return true;
  }

  if (message.action === 'openEditor') {
    (async () => {
      const mode = message.mode || '';
      const fromLib = message.fromLib || false;
      const extraParams = message.params || '';
      const editorUrl = chrome.runtime.getURL('editor/editor.html');
      let qs = [];
      if (mode) qs.push('mode=' + mode);
      if (fromLib) qs.push('fromLib=1');
      if (extraParams) qs.push(extraParams);
      const url = qs.length ? `${editorUrl}?${qs.join('&')}` : editorUrl;

      // Find existing editor tab — from tracked IDs or by searching all tabs
      let existingId = editorTabIds.size > 0 ? [...editorTabIds][0] : null;

      if (!existingId) {
        try {
          const tabs = await chrome.tabs.query({});
          const editorTab = tabs.find(t => t.url?.includes('editor/editor.html'));
          if (editorTab) {
            existingId = editorTab.id;
            editorTabIds.add(existingId);
          }
        } catch {}
      }

      if (existingId) {
        try {
          await chrome.tabs.update(existingId, { url, active: true });
        } catch {
          chrome.tabs.create({ url });
        }
      } else {
        chrome.tabs.create({ url });
      }
      sendResponse({ success: true });
    })();
    return true; // async sendResponse
  }

  if (message.action === 'captureTab') {
    (async () => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        sendResponse({ dataUrl });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (message.action === 'startRegionOnTab') {
    (async () => {
      try {
        const tabId = message.tabId;
        // Inject content script if not already present
        try {
          await chrome.scripting.executeScript({ target: { tabId }, files: ['content/detector.js'] });
        } catch {} // may already be injected
        await new Promise(r => setTimeout(r, 200));
        // Try sending message, retry once if fails
        try {
          await chrome.tabs.sendMessage(tabId, { action: 'startRegionCapture' });
        } catch {
          await new Promise(r => setTimeout(r, 300));
          try { await chrome.tabs.sendMessage(tabId, { action: 'startRegionCapture' }); } catch {}
        }
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (message.action === 'captureRegion') {
    (async () => {
      try {
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        const region = message.region;
        // Store capture + region for editor to crop and load
        await chrome.storage.local.set({ 'snaproo-region': { dataUrl, region, name: 'screenshot-region-' + new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-') } });
        // Open editor with fromRegion param
        const editorUrl = chrome.runtime.getURL('editor/editor.html');
        let existingId = editorTabIds.size > 0 ? [...editorTabIds][0] : null;
        if (!existingId) {
          const tabs = await chrome.tabs.query({});
          const t = tabs.find(t => t.url?.includes('editor/editor.html'));
          if (t) { existingId = t.id; editorTabIds.add(existingId); }
        }
        const url = editorUrl + '?fromRegion=1';
        if (existingId) { try { await chrome.tabs.update(existingId, { url, active: true }); } catch { chrome.tabs.create({ url }); } }
        else { chrome.tabs.create({ url }); }
        // Also relay for sidepanel listeners
        chrome.runtime.sendMessage({ action: 'regionCaptured', dataUrl, region }).catch(() => {});
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }

  if (message.action === 'openSidePanel') {
    const tabId = sender.tab?.id;
    if (tabId) {
      chrome.sidePanel.open({ tabId });
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
        if (tab?.id) chrome.sidePanel.open({ tabId: tab.id });
      });
    }
    sendResponse({ success: true });
  }
});

// --- Side Panel Behavior ---
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })
  .catch(() => {});

// --- Auto-rescan: notify side panel on tab change / page load ---
let rescanTimer = null;
const editorTabIds = new Set();

function notifySidePanelRescan() {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id && editorTabIds.has(tab.id)) {
        chrome.runtime.sendMessage({ action: 'editorOpened' }).catch(() => {});
      } else {
        chrome.runtime.sendMessage({ action: 'tabChanged' }).catch(() => {});
      }
    } catch {
      chrome.runtime.sendMessage({ action: 'tabChanged' }).catch(() => {});
    }
  }, 300);
}

// Track editor tabs
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'editorOpened' && sender.tab?.id) {
    editorTabIds.add(sender.tab.id);
  }
  if (message.action === 'editorClosed' && sender.tab?.id) {
    editorTabIds.delete(sender.tab.id);
  }
});

// User switches tabs
chrome.tabs.onActivated.addListener(() => notifySidePanelRescan());

// Page finishes loading (navigation, refresh)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') notifySidePanelRescan();
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  if (editorTabIds.has(tabId)) {
    editorTabIds.delete(tabId);
    // If the closed tab was active, notify side panel
    notifySidePanelRescan();
  }
});
