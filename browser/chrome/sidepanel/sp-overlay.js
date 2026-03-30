// ============================================================
// Overlay (Image detail view)
// ============================================================

function initOverlay() {
  const backdrop = $('overlay-backdrop');
  if (!backdrop) return;

  $('overlay-close')?.addEventListener('click', closeOverlay);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeOverlay();
  });

  // Overlay tabs
  $$('.overlay-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.overlay-tab').forEach(t => t.classList.remove('active'));
      $$('.overlay-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      $(`overlay-${tab.dataset.overlayTab}`)?.classList.add('active');
    });
  });

  // Save As format buttons
  $$('[data-save-fmt]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!overlayImage) return;
      sendToContent('convertAndSave', { src: overlayImage.src, format: btn.dataset.saveFmt });
    });
  });

  // Action buttons
  $('overlay-copy-png').addEventListener('click', () => {
    if (overlayImage) sendToContent('copyAsPng', { src: overlayImage.src });
  });

  $('overlay-download').addEventListener('click', () => {
    if (overlayImage) {
      const filename = overlayImage.filename || extractFilename(overlayImage.src) || 'image';
      chrome.runtime.sendMessage({
        action: 'download',
        url: overlayImage.src,
        filename: `snaproo/${filename}`,
        saveAs: true
      });
    }
  });

  $('overlay-extract-colors').addEventListener('click', () => {
    if (overlayImage) sendToContent('extractColors', { src: overlayImage.src });
  });

  $('overlay-read-qr').addEventListener('click', () => {
    if (overlayImage) sendToContent('readQR', { src: overlayImage.src });
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (!overlayImage) return;
    if (e.key === 'Escape') closeOverlay();
    if (e.key === 'ArrowLeft') navigateOverlay(-1);
    if (e.key === 'ArrowRight') navigateOverlay(1);
  });
}

function openOverlay(img) {
  overlayImage = img;
  const filename = img.filename || extractFilename(img.src);

  $('overlay-title').textContent = filename;
  $('overlay-img').src = img.src;

  // Build info rows
  const infoPanel = $('overlay-info');
  const rows = [
    ['Filename', filename],
    ['Type', img.type || 'Unknown'],
    ['Dimensions', img.naturalWidth && img.naturalHeight
      ? `${img.naturalWidth} x ${img.naturalHeight} px`
      : (img.width && img.height ? `${img.width} x ${img.height} px` : 'Unknown')],
    ['Displayed', img.width && img.height && (img.width !== img.naturalWidth || img.height !== img.naturalHeight)
      ? `${img.width} x ${img.height} px`
      : null],
    ['File Size', img.size ? formatBytes(img.size) : 'Unknown'],
    ['Alt Text', img.alt || '(none)'],
    ['Title', img.title || null],
    ['Source', img.isBgImage ? 'CSS background-image' : null],
    ['URL', img.src],
  ].filter(([, v]) => v !== null);

  infoPanel.innerHTML = rows.map(([label, value]) => `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value copyable" title="Click to copy">${escapeHtml(truncate(String(value), 50))}</span>
    </div>
  `).join('');

  // Reset to info tab
  $$('.overlay-tab').forEach(t => t.classList.remove('active'));
  $$('.overlay-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-overlay-tab="info"]')?.classList.add('active');
  $('overlay-info')?.classList.add('active');

  $('overlay-backdrop')?.classList.add('visible');

  // Load EXIF asynchronously
  loadExifData(img.src);
}

function closeOverlay() {
  $('overlay-backdrop')?.classList.remove('visible');
  overlayImage = null;
}

function navigateOverlay(direction) {
  const images = getFilteredImages();
  if (images.length === 0 || !overlayImage) return;
  const currentIdx = images.findIndex(img => img.src === overlayImage.src);
  if (currentIdx === -1) return;
  const nextIdx = (currentIdx + direction + images.length) % images.length;
  openOverlay(images[nextIdx]);
}

// ============================================================
// EXIF Reader (lightweight, pure JS, JPEG only for now)
// ============================================================

async function loadExifData(src) {
  const content = $('exif-content');
  const loading = $('exif-loading');
  content.innerHTML = '';
  loading.style.display = 'block';
  loading.textContent = 'Loading EXIF data...';

  try {
    const resp = await fetch(src);
    const buffer = await resp.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const exif = parseExifFromJpeg(bytes);

    loading.style.display = 'none';

    if (exif.length === 0) {
      content.innerHTML = '<div style="color:var(--slate-500);text-align:center;padding:0.5rem;">No EXIF data found in this image</div>';
      return;
    }

    content.innerHTML = exif.map(([tag, value]) => `
      <div class="info-row">
        <span class="info-label">${escapeHtml(tag)}</span>
        <span class="info-value copyable" title="Click to copy">${escapeHtml(truncate(String(value), 40))}</span>
      </div>
    `).join('');
  } catch (e) {
    loading.textContent = 'Could not load EXIF data';
  }
}

function parseExifFromJpeg(bytes) {
  const entries = [];
  if (bytes[0] !== 0xFF || bytes[1] !== 0xD8) return entries; // Not JPEG

  let offset = 2;
  while (offset < bytes.length - 1) {
    if (bytes[offset] !== 0xFF) break;
    const marker = bytes[offset + 1];

    if (marker === 0xD9) break; // EOI
    if (marker === 0xDA) break; // SOS - start of scan, no more metadata

    const segLen = (bytes[offset + 2] << 8) | bytes[offset + 3];

    // APP1 = EXIF
    if (marker === 0xE1) {
      const exifHeader = String.fromCharCode(...bytes.slice(offset + 4, offset + 8));
      if (exifHeader === 'Exif') {
        const tiffStart = offset + 10; // skip marker(2) + length(2) + "Exif\0\0"(6)
        parseTiffIFD(bytes, tiffStart, entries);
      }
    }

    offset += 2 + segLen;
  }

  return entries;
}

function parseTiffIFD(bytes, tiffStart, entries) {
  if (tiffStart + 8 > bytes.length) return;

  const le = bytes[tiffStart] === 0x49; // II = little-endian
  const r16 = (o) => le ? (bytes[o] | (bytes[o+1] << 8)) : ((bytes[o] << 8) | bytes[o+1]);
  const r32 = (o) => le
    ? (bytes[o] | (bytes[o+1] << 8) | (bytes[o+2] << 16) | (bytes[o+3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o+1] << 16) | (bytes[o+2] << 8) | bytes[o+3]) >>> 0;

  const ifdOffset = r32(tiffStart + 4);
  const ifdStart = tiffStart + ifdOffset;
  if (ifdStart + 2 > bytes.length) return;

  const count = r16(ifdStart);
  const TAGS = {
    0x010F: 'Make', 0x0110: 'Model', 0x0112: 'Orientation',
    0x011A: 'XResolution', 0x011B: 'YResolution', 0x0128: 'ResolutionUnit',
    0x0131: 'Software', 0x0132: 'DateTime',
    0x829A: 'ExposureTime', 0x829D: 'FNumber',
    0x8827: 'ISO', 0x9003: 'DateTimeOriginal', 0x9004: 'DateTimeDigitized',
    0x920A: 'FocalLength', 0xA405: 'FocalLengthIn35mm',
    0xA001: 'ColorSpace', 0xA002: 'PixelXDimension', 0xA003: 'PixelYDimension',
    0x8769: 'ExifIFD', 0x8825: 'GPSIFD',
  };

  for (let i = 0; i < count && ifdStart + 2 + i * 12 + 12 <= bytes.length; i++) {
    const entryOff = ifdStart + 2 + i * 12;
    const tag = r16(entryOff);
    const type = r16(entryOff + 2);
    const cnt = r32(entryOff + 4);
    const valOff = entryOff + 8;

    const tagName = TAGS[tag];
    if (!tagName) continue;

    // Follow sub-IFDs
    if (tag === 0x8769 || tag === 0x8825) {
      const subOffset = r32(valOff);
      parseTiffIFDAt(bytes, tiffStart, tiffStart + subOffset, entries, le, TAGS);
      continue;
    }

    const value = readTagValue(bytes, tiffStart, type, cnt, valOff, le);
    if (value !== null) entries.push([tagName, value]);
  }
}

function parseTiffIFDAt(bytes, tiffStart, ifdStart, entries, le, TAGS) {
  if (ifdStart + 2 > bytes.length) return;

  const r16 = (o) => le ? (bytes[o] | (bytes[o+1] << 8)) : ((bytes[o] << 8) | bytes[o+1]);
  const r32 = (o) => le
    ? (bytes[o] | (bytes[o+1] << 8) | (bytes[o+2] << 16) | (bytes[o+3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o+1] << 16) | (bytes[o+2] << 8) | bytes[o+3]) >>> 0;

  const count = r16(ifdStart);

  for (let i = 0; i < count && ifdStart + 2 + i * 12 + 12 <= bytes.length; i++) {
    const entryOff = ifdStart + 2 + i * 12;
    const tag = r16(entryOff);
    const type = r16(entryOff + 2);
    const cnt = r32(entryOff + 4);
    const valOff = entryOff + 8;

    const tagName = TAGS[tag];
    if (!tagName || tag === 0x8769 || tag === 0x8825) continue;

    const value = readTagValue(bytes, tiffStart, type, cnt, valOff, le);
    if (value !== null) entries.push([tagName, value]);
  }
}

function readTagValue(bytes, tiffStart, type, count, valOff, le) {
  const r16 = (o) => le ? (bytes[o] | (bytes[o+1] << 8)) : ((bytes[o] << 8) | bytes[o+1]);
  const r32 = (o) => le
    ? (bytes[o] | (bytes[o+1] << 8) | (bytes[o+2] << 16) | (bytes[o+3] << 24)) >>> 0
    : ((bytes[o] << 24) | (bytes[o+1] << 16) | (bytes[o+2] << 8) | bytes[o+3]) >>> 0;

  try {
    // ASCII string
    if (type === 2) {
      const dataOff = count > 4 ? tiffStart + r32(valOff) : valOff;
      let str = '';
      for (let i = 0; i < count - 1 && dataOff + i < bytes.length; i++) {
        str += String.fromCharCode(bytes[dataOff + i]);
      }
      return str.trim();
    }

    // SHORT (uint16)
    if (type === 3) return r16(valOff);

    // LONG (uint32)
    if (type === 4) return r32(valOff);

    // RATIONAL (two uint32: numerator/denominator)
    if (type === 5) {
      const dataOff = tiffStart + r32(valOff);
      if (dataOff + 8 > bytes.length) return null;
      const num = r32(dataOff);
      const den = r32(dataOff + 4);
      if (den === 0) return num;
      if (num % den === 0) return num / den;
      return `${num}/${den}`;
    }
  } catch {
    return null;
  }
  return null;
}

// ============================================================
// Library Overlay (reuses page image overlay for library items)
// ============================================================

function openLibOverlay(item) {
  if (item.type === 'color') {
    // Color detail — just copy hex
    navigator.clipboard.writeText(item.color || '');
    return;
  }
  // Reuse the page image overlay for library items
  const filename = item.name || 'Library image';
  const addedDate = item.addedAt ? new Date(item.addedAt).toLocaleString() : 'Unknown';

  $('overlay-title').textContent = filename;
  $('overlay-img').src = item.dataUrl;

  const infoPanel = $('overlay-info');
  const sourceDisplay = (item.source || '').replace('Page: unknown', 'Page').replace('unknown', '') || 'Saved locally';
  const rows = [
    ['Name', filename],
    ['Type', item.source === 'Screenshot' ? 'Screenshot' : 'Image'],
    ['Dimensions', item.width && item.height ? `${item.width} x ${item.height} px` : 'Unknown'],
    ['Size', item.size ? PixLibrary.formatBytes(item.size) : 'Unknown'],
    ['Collection', item.collection || 'General'],
    ['Source', sourceDisplay],
    ['Saved', addedDate],
    item.url ? ['URL', item.url] : null,
  ].filter(Boolean);

  infoPanel.innerHTML = rows.map(([label, value]) => `
    <div class="info-row">
      <span class="info-label">${label}</span>
      <span class="info-value copyable" title="Click to copy">${escapeHtml(truncate(String(value), 50))}</span>
    </div>
  `).join('');

  // Reset to info tab
  $$('.overlay-tab').forEach(t => t.classList.remove('active'));
  $$('.overlay-panel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-overlay-tab="info"]')?.classList.add('active');
  $('overlay-info')?.classList.add('active');

  $('overlay-backdrop')?.classList.add('visible');

  // Load EXIF data from the dataUrl
  loadExifData(item.dataUrl);

  // Store reference for overlay actions (use a fake img-like object)
  overlayImage = { src: item.dataUrl, filename, type: 'image', _libItem: item };
}
