// Snaproo Settings

const DEFAULTS = {
  theme: 'dark',
  defaultFormat: 'png',
  downloadPrefix: 'snaproo',
  qrDefaultEcc: 'M',
  defaultView: 'tiles',
  defaultSort: 'position',
};

document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  initTheme();
  initControls();
});

async function loadSettings() {
  const stored = await chrome.storage.sync.get(DEFAULTS);

  document.getElementById('default-format').value = stored.defaultFormat;
  document.getElementById('download-prefix').value = stored.downloadPrefix;
  document.getElementById('qr-default-ecc').value = stored.qrDefaultEcc;
  document.getElementById('default-view').value = stored.defaultView;
  document.getElementById('default-sort').value = stored.defaultSort;

  // Theme
  document.querySelectorAll('.theme-card').forEach(c => {
    c.classList.toggle('active', c.dataset.theme === stored.theme);
  });
  applyTheme(stored.theme);
}

function initTheme() {
  document.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const theme = card.dataset.theme;
      applyTheme(theme);
      save('theme', theme);
    });
  });
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-light', theme === 'light');
}

function initControls() {
  document.getElementById('default-format').addEventListener('change', (e) => save('defaultFormat', e.target.value));
  document.getElementById('download-prefix').addEventListener('change', (e) => save('downloadPrefix', e.target.value));
  document.getElementById('qr-default-ecc').addEventListener('change', (e) => save('qrDefaultEcc', e.target.value));
  document.getElementById('default-view').addEventListener('change', (e) => save('defaultView', e.target.value));
  document.getElementById('default-sort').addEventListener('change', (e) => save('defaultSort', e.target.value));

  document.getElementById('btn-reset-disclaimer').addEventListener('click', () => {
    chrome.storage.local.remove('disclaimerDismissed');
  });

  document.getElementById('btn-reset-all').addEventListener('click', () => {
    chrome.storage.sync.clear();
    chrome.storage.local.clear();
    loadSettings();
  });
}

function save(key, value) {
  chrome.storage.sync.set({ [key]: value });
}
