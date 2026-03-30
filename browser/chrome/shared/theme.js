// Snaproo - Shared Theme & Font System
// Include this script in every HTML page (popup, sidepanel, editor, settings, help)

(function () {
  const LIGHT_VARS = {
    '--slate-950': '#ffffff',
    '--slate-900': '#f8fafc',
    '--slate-800': '#e2e8f0',
    '--slate-700': '#cbd5e1',
    '--slate-600': '#94a3b8',
    '--slate-500': '#64748b',
    '--slate-400': '#475569',
    '--slate-300': '#334155',
    '--slate-200': '#1e293b',
    '--slate-100': '#0f172a',
    '--slate-50': '#020617',
  };

  const DARK_VARS = {
    '--slate-50': '#f8fafc',
    '--slate-100': '#f1f5f9',
    '--slate-200': '#e2e8f0',
    '--slate-300': '#cbd5e1',
    '--slate-400': '#94a3b8',
    '--slate-500': '#64748b',
    '--slate-600': '#475569',
    '--slate-700': '#334155',
    '--slate-800': '#1e293b',
    '--slate-900': '#0f172a',
    '--slate-950': '#020617',
  };

  const FONT_PRESETS = {
    'system':    "system-ui, -apple-system, 'Segoe UI', sans-serif",
    'inter':     "'Inter', system-ui, sans-serif",
    'roboto':    "'Roboto', 'Segoe UI', sans-serif",
    'plex':      "'IBM Plex Sans', 'Segoe UI', sans-serif",
    'source':    "'Source Sans 3', 'Source Sans Pro', sans-serif",
    'noto':      "'Noto Sans', 'Segoe UI', sans-serif",
    'ubuntu':    "'Ubuntu', 'Segoe UI', sans-serif",
    'jetbrains': "'JetBrains Mono', 'Consolas', monospace",
    'mono':      "'Cascadia Code', 'Consolas', 'Courier New', monospace",
  };

  function applyTheme(theme) {
    const vars = theme === 'light' ? LIGHT_VARS : DARK_VARS;
    const root = document.documentElement;

    for (const [key, value] of Object.entries(vars)) {
      root.style.setProperty(key, value);
    }

    document.body?.classList.toggle('theme-light', theme === 'light');
    document.body?.classList.toggle('theme-dark', theme === 'dark');

    if (document.body) {
      document.body.style.backgroundColor = theme === 'light' ? '#ffffff' : '#020617';
      document.body.style.color = theme === 'light' ? '#1e293b' : '#f3f4f6';
    }
  }

  function applyFontFamily(key) {
    const stack = FONT_PRESETS[key] || FONT_PRESETS['system'];
    // Set on body directly — CSS var() misparses comma-separated font stacks
    if (document.body) document.body.style.fontFamily = stack;
    // Also set on html for elements outside body
    document.documentElement.style.fontFamily = stack;
  }

  async function applyAll() {
    try {
      const r = await chrome.storage.sync.get({ theme: 'dark', fontFamily: 'jetbrains' });
      applyTheme(r.theme);
      applyFontFamily(r.fontFamily);
    } catch {
      applyTheme('dark');
    }
  }

  // Listen for live changes from settings
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    if (changes.theme) applyTheme(changes.theme.newValue);
    if (changes.fontFamily) applyFontFamily(changes.fontFamily.newValue);
  });

  // Apply on DOMContentLoaded (body exists) — if already loaded, apply now
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', applyAll);
  } else {
    applyAll();
  }
})();
