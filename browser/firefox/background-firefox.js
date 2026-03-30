// Snaproo - Firefox Background Script
// Firefox uses sidebar_action instead of sidePanel, and event pages instead of service workers

// --- Context Menu Setup ---
browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'snaproo',
    title: 'Snaproo',
    contexts: ['image']
  });

  browser.contextMenus.create({
    id: 'snaproo-info',
    parentId: 'snaproo',
    title: 'View Image Info',
    contexts: ['image']
  });

  browser.contextMenus.create({
    id: 'snaproo-saveas',
    parentId: 'snaproo',
    title: 'Save As...',
    contexts: ['image']
  });

  const formats = ['PNG', 'JPEG', 'WebP', 'AVIF', 'BMP', 'ICO'];
  formats.forEach(fmt => {
    browser.contextMenus.create({
      id: `snaproo-save-${fmt.toLowerCase()}`,
      parentId: 'snaproo-saveas',
      title: fmt,
      contexts: ['image']
    });
  });

  browser.contextMenus.create({
    id: 'snaproo-copy-png',
    parentId: 'snaproo',
    title: 'Copy as PNG',
    contexts: ['image']
  });

  browser.contextMenus.create({
    id: 'snaproo-read-qr',
    parentId: 'snaproo',
    title: 'Read QR Code',
    contexts: ['image']
  });

  browser.contextMenus.create({
    id: 'snaproo-edit',
    parentId: 'snaproo',
    title: 'Open in Editor',
    contexts: ['image']
  });

  browser.contextMenus.create({
    id: 'snaproo-separator',
    parentId: 'snaproo',
    type: 'separator',
    contexts: ['image']
  });

  browser.contextMenus.create({
    id: 'snaproo-extract-colors',
    parentId: 'snaproo',
    title: 'Extract Colors',
    contexts: ['image']
  });
});

// --- Context Menu Click Handler ---
browser.contextMenus.onClicked.addListener((info, tab) => {
  const { menuItemId, srcUrl } = info;

  if (menuItemId === 'snaproo-info') {
    browser.tabs.sendMessage(tab.id, { action: 'showImageInfo', src: srcUrl });
  } else if (menuItemId.startsWith('snaproo-save-')) {
    const format = menuItemId.replace('snaproo-save-', '');
    browser.tabs.sendMessage(tab.id, { action: 'convertAndSave', src: srcUrl, format });
  } else if (menuItemId === 'snaproo-copy-png') {
    browser.tabs.sendMessage(tab.id, { action: 'copyAsPng', src: srcUrl });
  } else if (menuItemId === 'snaproo-read-qr') {
    browser.tabs.sendMessage(tab.id, { action: 'readQR', src: srcUrl });
  } else if (menuItemId === 'snaproo-edit') {
    const editorUrl = browser.runtime.getURL(`editor/editor.html?src=${encodeURIComponent(srcUrl)}`);
    browser.tabs.create({ url: editorUrl });
  } else if (menuItemId === 'snaproo-extract-colors') {
    browser.tabs.sendMessage(tab.id, { action: 'extractColors', src: srcUrl });
  }
});

// --- Keyboard Commands ---
browser.commands.onCommand.addListener((command) => {
  if (command === 'quick-qr') {
    browser.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      browser.tabs.sendMessage(tab.id, { action: 'quickQR', url: tab.url });
    });
  }
  // sidebar_action is handled natively by Firefox via _execute_sidebar_action
});

// --- Message Router ---
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'download') {
    return browser.downloads.download({
      url: message.url,
      filename: message.filename || 'snaproo-image',
      saveAs: message.saveAs !== false
    }).then(downloadId => ({ success: true, downloadId }));
  }

  if (message.action === 'openEditor') {
    const editorUrl = browser.runtime.getURL(`editor/editor.html?src=${encodeURIComponent(message.src)}`);
    browser.tabs.create({ url: editorUrl });
    return Promise.resolve({ success: true });
  }

  if (message.action === 'openSidePanel') {
    browser.sidebarAction.open();
    return Promise.resolve({ success: true });
  }
});
