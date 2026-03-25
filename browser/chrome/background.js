// Pixeroo - Background Service Worker
// Handles context menus, commands, message routing, QR reading

// Load jsQR locally (bundled, no CDN)
importScripts('lib/jsQR.min.js');

// --- Context Menu Setup ---
chrome.runtime.onInstalled.addListener(() => {
  // Parent menu
  chrome.contextMenus.create({
    id: 'pixeroo',
    title: 'Pixeroo',
    contexts: ['image']
  });

  // Image info
  chrome.contextMenus.create({
    id: 'pixeroo-info',
    parentId: 'pixeroo',
    title: 'View Image Info',
    contexts: ['image']
  });

  // Save As submenu
  chrome.contextMenus.create({
    id: 'pixeroo-saveas',
    parentId: 'pixeroo',
    title: 'Save As...',
    contexts: ['image']
  });

  const formats = ['PNG', 'JPEG', 'WebP', 'AVIF', 'BMP', 'ICO'];
  formats.forEach(fmt => {
    chrome.contextMenus.create({
      id: `pixeroo-save-${fmt.toLowerCase()}`,
      parentId: 'pixeroo-saveas',
      title: fmt,
      contexts: ['image']
    });
  });

  // Copy as PNG
  chrome.contextMenus.create({
    id: 'pixeroo-copy-png',
    parentId: 'pixeroo',
    title: 'Copy as PNG',
    contexts: ['image']
  });

  // Read QR
  chrome.contextMenus.create({
    id: 'pixeroo-read-qr',
    parentId: 'pixeroo',
    title: 'Read QR Code',
    contexts: ['image']
  });

  // Separator + page-level actions
  chrome.contextMenus.create({
    id: 'pixeroo-separator',
    parentId: 'pixeroo',
    type: 'separator',
    contexts: ['image']
  });

  chrome.contextMenus.create({
    id: 'pixeroo-extract-colors',
    parentId: 'pixeroo',
    title: 'Extract Colors',
    contexts: ['image']
  });
});

// --- Context Menu Click Handler ---
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab?.id) return;
  const { menuItemId, srcUrl } = info;

  if (menuItemId === 'pixeroo-info') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'showImageInfo',
      src: srcUrl
    });
  } else if (menuItemId.startsWith('pixeroo-save-')) {
    const format = menuItemId.replace('pixeroo-save-', '');
    chrome.tabs.sendMessage(tab.id, {
      action: 'convertAndSave',
      src: srcUrl,
      format: format
    });
  } else if (menuItemId === 'pixeroo-copy-png') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'copyAsPng',
      src: srcUrl
    });
  } else if (menuItemId === 'pixeroo-read-qr') {
    chrome.tabs.sendMessage(tab.id, {
      action: 'readQR',
      src: srcUrl
    });
  } else if (menuItemId === 'pixeroo-extract-colors') {
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
      filename: message.filename || 'pixeroo-image',
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
    const editorUrl = chrome.runtime.getURL('editor/editor.html');
    chrome.tabs.create({ url: editorUrl });
    sendResponse({ success: true });
  }

  if (message.action === 'captureTab') {
    (async () => {
      try {
        // captureVisibleTab captures the current window's active tab
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'png' });
        sendResponse({ dataUrl });
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

function notifySidePanelRescan() {
  clearTimeout(rescanTimer);
  rescanTimer = setTimeout(() => {
    chrome.runtime.sendMessage({ action: 'tabChanged' }).catch(() => {});
  }, 300); // debounce 300ms
}

// User switches tabs
chrome.tabs.onActivated.addListener(() => notifySidePanelRescan());

// Page finishes loading (navigation, refresh)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'complete') notifySidePanelRescan();
});
