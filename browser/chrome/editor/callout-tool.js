// Snaproo — Callout Tool
// Uses shared callout rendering from objects.js (DrawObject + ObjectLayer)

const CALLOUT_TEMPLATES = {
  speech:  { shape: 'bubble', tailDir: 'bottom', icon: '', bgColor: '#1e293b', borderColor: '#F4C430', textColor: '#fff', text: 'Speech...' },
  thought: { shape: 'cloud', tailDir: 'bottom', icon: '', bgColor: '#1e293b', borderColor: '#94a3b8', textColor: '#fff', text: 'Thinking...' },
  info:    { shape: 'rounded', tailDir: 'none', icon: 'info', bgColor: '#1e3a5f', borderColor: '#3b82f6', textColor: '#93c5fd', text: 'Info text' },
  warning: { shape: 'rounded', tailDir: 'none', icon: 'warning', bgColor: '#422006', borderColor: '#f59e0b', textColor: '#fde68a', text: 'Warning text' },
  success: { shape: 'rounded', tailDir: 'none', icon: 'check', bgColor: '#052e16', borderColor: '#22c55e', textColor: '#86efac', text: 'Success!' },
  error:   { shape: 'rounded', tailDir: 'none', icon: 'x', bgColor: '#450a0a', borderColor: '#ef4444', textColor: '#fca5a5', text: 'Error!' },
  step:    { shape: 'rounded', tailDir: 'bottom', icon: '1', bgColor: '#F4C430', borderColor: '#F4C430', textColor: '#1e293b', text: 'Step 1' },
  pin:     { shape: 'rounded', tailDir: 'bottom', icon: 'pin', bgColor: '#ef4444', borderColor: '#ef4444', textColor: '#fff', text: '' },
};

function initCallout() {
  const canvas = $('callout-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let coImg = null;
  let coObjLayer = null;

  function loadImage(img) {
    coImg = img;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    ctx.drawImage(img, 0, 0);
    canvas.style.display = 'block';
    $('callout-dropzone').style.display = 'none';

    // Create object layer for callouts
    coObjLayer = new ObjectLayer(canvas);
    coObjLayer.attach($('callout-canvas-wrap'));
  }

  setupDropzone($('callout-dropzone'), $('callout-file'), async (file) => {
    const img = await loadImg(file);
    if (!img) return;
    loadImage(img);
  });

  // Template buttons
  $$('.callout-tpl').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!coObjLayer) return;
      const tpl = CALLOUT_TEMPLATES[btn.dataset.tpl];
      if (!tpl) return;
      coObjLayer.addCallout(canvas.width / 2 - 100, canvas.height / 2 - 40, 200, 80, {
        ...tpl,
        fontSize: +$('co-fontsize')?.value || 16,
      });
    });
  });

  // Add button (custom callout)
  $('btn-co-add')?.addEventListener('click', () => {
    if (!coObjLayer) return;
    coObjLayer.addCallout(canvas.width / 2 - 100, canvas.height / 2 - 40, 200, 80, {
      shape: $('co-shape')?.value || 'rounded',
      tailDir: $('co-tail')?.value || 'bottom',
      icon: $('co-icon')?.value || '',
      bgColor: $('co-bg')?.value || '#1e293b',
      borderColor: $('co-border')?.value || '#F4C430',
      textColor: $('co-text-color')?.value || '#ffffff',
      fontSize: +$('co-fontsize')?.value || 16,
      radius: +$('co-radius')?.value || 12,
      text: 'Type here...',
    });
  });

  // Export
  $('btn-co-export')?.addEventListener('click', () => {
    if (!canvas.width || !coObjLayer) return;
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const oc = out.getContext('2d');
    oc.drawImage(coImg, 0, 0);
    coObjLayer.objects.forEach(obj => obj.draw(oc));
    out.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      chrome.runtime.sendMessage({ action: 'download', url, filename: 'snaproo/callout-annotated.png', saveAs: true });
    }, 'image/png');
  });

  // Save to library
  $('btn-co-save-lib')?.addEventListener('click', () => {
    if (!canvas.width || !coObjLayer) return;
    const out = document.createElement('canvas');
    out.width = canvas.width;
    out.height = canvas.height;
    const oc = out.getContext('2d');
    oc.drawImage(coImg, 0, 0);
    coObjLayer.objects.forEach(obj => obj.draw(oc));
    saveToLibraryDialog(out.toDataURL('image/png'), { name: 'callout-annotated', source: 'Callout Tool', width: out.width, height: out.height });
  });

  // Library picker
  $('btn-co-from-lib')?.addEventListener('click', () => {
    openLibraryPicker(async (items) => {
      if (!items.length) return;
      const img = new Image();
      img.src = items[0].dataUrl;
      await new Promise(r => { img.onload = r; });
      loadImage(img);
    }, { singleSelect: true });
  });
}
