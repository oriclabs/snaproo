// Unit tests for batchFilename pattern

function batchFilename(bf, index, w, h, ext) {
  const pattern = bf.pattern || '{name}';
  const baseName = bf.file.name.replace(/\.[^.]+$/, '');
  const origExt = bf.file.name.split('.').pop();
  const date = new Date().toISOString().slice(0, 10);
  return pattern
    .replace(/\{name\}/g, baseName)
    .replace(/\{index\}/g, String(index + 1).padStart(3, '0'))
    .replace(/\{i\}/g, String(index + 1))
    .replace(/\{date\}/g, date)
    .replace(/\{w\}/g, w)
    .replace(/\{h\}/g, h)
    .replace(/\{ext\}/g, origExt)
    + '.' + ext;
}

describe('batchFilename', () => {
  const mockFile = (name) => ({ file: { name }, pattern: '{name}' });
  const today = new Date().toISOString().slice(0, 10);

  test('default pattern uses original name', () => {
    const bf = mockFile('photo.jpg');
    expect(batchFilename(bf, 0, 800, 600, 'png')).toBe('photo.png');
  });

  test('{index} pads to 3 digits', () => {
    const bf = { ...mockFile('img.png'), pattern: 'file-{index}' };
    expect(batchFilename(bf, 0, 800, 600, 'png')).toBe('file-001.png');
    expect(batchFilename(bf, 9, 800, 600, 'png')).toBe('file-010.png');
    expect(batchFilename(bf, 99, 800, 600, 'png')).toBe('file-100.png');
  });

  test('{i} uses unpadded index', () => {
    const bf = { ...mockFile('img.png'), pattern: 'file-{i}' };
    expect(batchFilename(bf, 0, 800, 600, 'png')).toBe('file-1.png');
    expect(batchFilename(bf, 9, 800, 600, 'png')).toBe('file-10.png');
  });

  test('{date} inserts today', () => {
    const bf = { ...mockFile('img.png'), pattern: '{name}-{date}' };
    expect(batchFilename(bf, 0, 800, 600, 'png')).toBe(`img-${today}.png`);
  });

  test('{w} and {h} insert dimensions', () => {
    const bf = { ...mockFile('img.png'), pattern: '{name}-{w}x{h}' };
    expect(batchFilename(bf, 0, 1920, 1080, 'jpg')).toBe('img-1920x1080.jpg');
  });

  test('{ext} inserts original extension', () => {
    const bf = { ...mockFile('photo.jpeg'), pattern: '{name}-original-{ext}' };
    expect(batchFilename(bf, 0, 800, 600, 'webp')).toBe('photo-original-jpeg.webp');
  });

  test('complex pattern with multiple tokens', () => {
    const bf = { ...mockFile('vacation.jpg'), pattern: '{date}-{name}-{index}-{w}x{h}' };
    expect(batchFilename(bf, 4, 640, 480, 'png')).toBe(`${today}-vacation-005-640x480.png`);
  });

  test('strips extension from name correctly', () => {
    const bf = mockFile('my.photo.final.png');
    expect(batchFilename(bf, 0, 800, 600, 'png')).toBe('my.photo.final.png');
  });
});
