// QR Code wrapper — uses qrcode-generator by Kazuhiko Arase (MIT)
// Provides the QR.encode(text, eccLevel) API used throughout Snaproo

const QR = (() => {
  'use strict';

  function encode(text, eccLevel = 'M') {
    // Validate ECC level
    if (!['L', 'M', 'Q', 'H'].includes(eccLevel)) eccLevel = 'M';

    // typeNumber 0 = auto-detect version
    const qr = qrcode(0, eccLevel);
    qr.addData(text);
    qr.make();

    const count = qr.getModuleCount();
    const modules = [];
    for (let y = 0; y < count; y++) {
      const row = new Uint8Array(count);
      for (let x = 0; x < count; x++) {
        row[x] = qr.isDark(y, x) ? 1 : 0;
      }
      modules.push(row);
    }

    return { modules, size: count };
  }

  // Legacy render for popup (simple, no custom styles)
  function renderToCanvas(canvas, qrData, pixelSize = 4, margin = 4, fg = '#000000', bg = '#ffffff') {
    const { modules, size } = qrData;
    const total = (size + margin * 2) * pixelSize;
    canvas.width = total;
    canvas.height = total;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, total, total);
    ctx.fillStyle = fg;
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (modules[y][x])
          ctx.fillRect((x + margin) * pixelSize, (y + margin) * pixelSize, pixelSize, pixelSize);
  }

  return { encode, renderToCanvas };
})();
