// Snaproo — Social Media Tool
const SOCIAL_PLATFORM_PRESETS = {
  'tw-header':    { w: 1500, h: 500,  name: 'twitter-header' },
  'tw-post':      { w: 1200, h: 675,  name: 'twitter-post' },
  'tw-profile':   { w: 400,  h: 400,  name: 'twitter-profile' },
  'ig-post':      { w: 1080, h: 1080, name: 'instagram-post' },
  'ig-story':     { w: 1080, h: 1920, name: 'instagram-story' },
  'ig-landscape': { w: 1080, h: 566,  name: 'instagram-landscape' },
  'ig-profile':   { w: 320,  h: 320,  name: 'instagram-profile' },
  'fb-cover':     { w: 820,  h: 312,  name: 'facebook-cover' },
  'fb-post':      { w: 1200, h: 630,  name: 'facebook-post' },
  'fb-profile':   { w: 180,  h: 180,  name: 'facebook-profile' },
  'fb-event':     { w: 1920, h: 1005, name: 'facebook-event' },
  'li-banner':    { w: 1584, h: 396,  name: 'linkedin-banner' },
  'li-post':      { w: 1200, h: 627,  name: 'linkedin-post' },
  'li-profile':   { w: 400,  h: 400,  name: 'linkedin-profile' },
  'yt-thumb':     { w: 1280, h: 720,  name: 'youtube-thumbnail' },
  'yt-banner':    { w: 2560, h: 1440, name: 'youtube-banner' },
  'pin-standard': { w: 1000, h: 1500, name: 'pinterest-standard' },
  'pin-square':   { w: 1000, h: 1000, name: 'pinterest-square' },
  'tt-post':      { w: 1080, h: 1920, name: 'tiktok-post' },
  'dc-avatar':    { w: 128,  h: 128,  name: 'discord-avatar' },
  'dc-banner':    { w: 960,  h: 540,  name: 'discord-banner' },
};

function initSocial() {
  const canvas = $('social-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let socialImg = null;

  const platformSel = $('social-platform');
  const fitSel = $('social-fit');
  const bgColor = $('social-bg-color');
  const textInput = $('social-text');
  const textColor = $('social-text-color');
  const textPos = $('social-text-pos');
  const dimsEl = $('social-dims');
  const dropzone = $('social-dropzone');

  // Drop zone for source image
  setupDropzone(dropzone, $('social-file'), async (file) => {
    socialImg = await loadImg(file);
    if (!socialImg) return;
    dropzone.style.display = 'none';
    canvas.style.display = 'block';
    // Show original on canvas as preview
    canvas.width = socialImg.naturalWidth;
    canvas.height = socialImg.naturalHeight;
    ctx.drawImage(socialImg, 0, 0);
  });

  // Add from Library button
  $('btn-social-from-lib')?.addEventListener('click', () => {
    openLibraryPicker(async (items) => {
      const item = items[0]; if (!item) return;
      const img = new Image();
      img.src = item.dataUrl;
      await new Promise(r => { img.onload = r; img.onerror = r; });
      socialImg = img;
      dropzone.style.display = 'none';
      canvas.style.display = 'block';
      canvas.width = socialImg.naturalWidth;
      canvas.height = socialImg.naturalHeight;
      ctx.drawImage(socialImg, 0, 0);
    }, { singleSelect: true });
  });

  // Platform selection -> show dims
  platformSel.addEventListener('change', () => {
    const preset = SOCIAL_PLATFORM_PRESETS[platformSel.value];
    if (preset) {
      dimsEl.textContent = `${preset.w} \u00d7 ${preset.h}`;
    } else {
      dimsEl.textContent = 'Select a platform';
    }
  });

  // Generate button
  $('btn-social-generate').addEventListener('click', () => {
    if (!socialImg) { pixDialog.alert('No Image', 'Drop or select a source image first.'); return; }
    const preset = SOCIAL_PLATFORM_PRESETS[platformSel.value];
    if (!preset) { pixDialog.alert('No Platform', 'Select a social media platform preset.'); return; }

    const tw = preset.w, th = preset.h;
    canvas.width = tw; canvas.height = th;

    const sw = socialImg.naturalWidth, sh = socialImg.naturalHeight;
    const fit = fitSel.value;

    if (fit === 'cover') {
      // Scale to fill, crop center
      const scale = Math.max(tw / sw, th / sh);
      const dw = sw * scale, dh = sh * scale;
      const dx = (tw - dw) / 2, dy = (th - dh) / 2;
      ctx.drawImage(socialImg, dx, dy, dw, dh);
    } else if (fit === 'contain') {
      // Scale to fit, fill background
      ctx.fillStyle = bgColor.value;
      ctx.fillRect(0, 0, tw, th);
      const scale = Math.min(tw / sw, th / sh);
      const dw = sw * scale, dh = sh * scale;
      const dx = (tw - dw) / 2, dy = (th - dh) / 2;
      ctx.drawImage(socialImg, dx, dy, dw, dh);
    } else {
      // Stretch
      ctx.drawImage(socialImg, 0, 0, tw, th);
    }

    // Text overlay
    const txt = textInput.value.trim();
    if (txt) {
      const fontSize = Math.max(16, Math.round(Math.min(tw, th) * 0.06));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = textColor.value;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Shadow for readability
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 6;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;

      let tx = tw / 2, ty;
      const pos = textPos.value;
      if (pos === 'top') ty = fontSize * 1.5;
      else if (pos === 'bottom') ty = th - fontSize * 1.5;
      else ty = th / 2;

      ctx.fillText(txt, tx, ty);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
    }

    canvas.style.display = 'block';
    dimsEl.textContent = `${tw} \u00d7 ${th}`;
  });

  // Download
  $('btn-social-download').addEventListener('click', () => {
    if (!canvas.width || !canvas.height) return;
    const preset = SOCIAL_PLATFORM_PRESETS[platformSel.value];
    const name = preset ? preset.name : 'social';
    canvas.toBlob((blob) => {
      if (!blob) return;
      chrome.runtime.sendMessage({ action: 'download', url: URL.createObjectURL(blob), filename: `snaproo/${name}.png`, saveAs: true });
    }, 'image/png');
  });

  // Copy to clipboard
  $('btn-social-copy').addEventListener('click', async () => {
    if (!canvas.width || !canvas.height) return;
    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } catch (e) {
      pixDialog.alert('Copy Failed', 'Could not copy image to clipboard.');
    }
  });
}
