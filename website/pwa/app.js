// Snaproo PWA - Main Application

document.addEventListener('DOMContentLoaded', () => {
  initToolTabs();
  initConvertPanel();
  initDropzones();
});

// --- Tool Tabs ---
function initToolTabs() {
  const tabs = document.querySelectorAll('.tool-tab');
  const panels = document.querySelectorAll('.tool-panel');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(`panel-${tab.dataset.tool}`).classList.add('active');
    });
  });
}

// --- Convert Panel ---
function initConvertPanel() {
  const dropzone = document.getElementById('convert-dropzone');
  const fileInput = document.getElementById('file-input');
  const preview = document.getElementById('convert-preview');
  const previewImg = document.getElementById('preview-img');
  const convertBtn = document.getElementById('btn-convert');
  let currentFile = null;

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0]));

  function handleFile(file) {
    if (!file || !file.type.startsWith('image/')) return;
    currentFile = file;
    const url = URL.createObjectURL(file);
    previewImg.src = url;
    preview.classList.remove('hidden');
    dropzone.classList.add('hidden');
    convertBtn.disabled = false;
  }

  // Format buttons
  document.querySelectorAll('.format-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.format-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const qualityRow = document.getElementById('quality-row');
      qualityRow.classList.toggle('hidden', !['jpeg', 'webp', 'avif'].includes(btn.dataset.format));
    });
  });

  // Quality slider
  const qualitySlider = document.getElementById('quality');
  const qualityLabel = document.getElementById('quality-label');
  qualitySlider?.addEventListener('input', () => { qualityLabel.textContent = qualitySlider.value; });

  // Convert button
  convertBtn.addEventListener('click', () => {
    if (!currentFile) return;
    const format = document.querySelector('.format-btn.active')?.dataset.format || 'png';
    convertImage(currentFile, format);
  });
}

async function convertImage(file, format) {
  const img = new Image();
  const url = URL.createObjectURL(file);

  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    canvas.getContext('2d').drawImage(img, 0, 0);

    const mimeMap = { png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp', bmp: 'image/bmp' };
    const mime = mimeMap[format] || 'image/png';
    const quality = ['jpeg', 'webp'].includes(format)
      ? parseInt(document.getElementById('quality')?.value || 85) / 100
      : undefined;

    canvas.toBlob((blob) => {
      const ext = format === 'jpeg' ? 'jpg' : format;
      const name = file.name.replace(/\.[^.]+$/, '') + '.' + ext;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    }, mime, quality);

    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// --- Generic Dropzones ---
function initDropzones() {
  ['editor-drop', 'info-drop', 'color-drop'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const input = el.querySelector('input[type="file"]');

    el.addEventListener('click', () => input?.click());
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('dragover'); });
    el.addEventListener('dragleave', () => el.classList.remove('dragover'));
    el.addEventListener('drop', (e) => {
      e.preventDefault();
      el.classList.remove('dragover');
      // TODO: Handle file based on panel type
    });
    input?.addEventListener('change', (e) => {
      // TODO: Handle file
    });
  });
}
