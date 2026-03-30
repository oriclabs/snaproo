// Unit tests for Convert Tool utilities

// ── _fmtSize ─────────────────────────────────────────────
function _fmtSize(b) {
  if (!b) return '0 B';
  if (b < 1024) return b + ' B';
  if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1048576).toFixed(1) + ' MB';
}

describe('_fmtSize', () => {
  test('returns 0 B for falsy', () => {
    expect(_fmtSize(0)).toBe('0 B');
    expect(_fmtSize(null)).toBe('0 B');
    expect(_fmtSize(undefined)).toBe('0 B');
  });
  test('formats bytes', () => {
    expect(_fmtSize(512)).toBe('512 B');
    expect(_fmtSize(1)).toBe('1 B');
  });
  test('formats kilobytes', () => {
    expect(_fmtSize(1024)).toBe('1.0 KB');
    expect(_fmtSize(2048)).toBe('2.0 KB');
    expect(_fmtSize(153600)).toBe('150.0 KB');
  });
  test('formats megabytes', () => {
    expect(_fmtSize(1048576)).toBe('1.0 MB');
    expect(_fmtSize(3145728)).toBe('3.0 MB');
  });
});

// ── EXT_TO_FMT mapping ──────────────────────────────────
const EXT_TO_FMT = { png: 'png', jpg: 'jpeg', jpeg: 'jpeg', webp: 'webp', bmp: 'bmp', gif: null, svg: null, tiff: null };

describe('EXT_TO_FMT', () => {
  test('maps common extensions to format values', () => {
    expect(EXT_TO_FMT['png']).toBe('png');
    expect(EXT_TO_FMT['jpg']).toBe('jpeg');
    expect(EXT_TO_FMT['jpeg']).toBe('jpeg');
    expect(EXT_TO_FMT['webp']).toBe('webp');
    expect(EXT_TO_FMT['bmp']).toBe('bmp');
  });
  test('returns null for formats without direct output match', () => {
    expect(EXT_TO_FMT['gif']).toBeNull();
    expect(EXT_TO_FMT['svg']).toBeNull();
    expect(EXT_TO_FMT['tiff']).toBeNull();
  });
  test('returns undefined for unknown extensions', () => {
    expect(EXT_TO_FMT['avif']).toBeUndefined();
    expect(EXT_TO_FMT['ico']).toBeUndefined();
  });
});

// ── BEST_ALT mapping ────────────────────────────────────
const BEST_ALT = { png: 'webp', jpg: 'webp', jpeg: 'webp', webp: 'png', bmp: 'png', gif: 'png', svg: 'png', tiff: 'png' };

describe('BEST_ALT', () => {
  test('recommends webp for lossless sources', () => {
    expect(BEST_ALT['png']).toBe('webp');
    expect(BEST_ALT['jpg']).toBe('webp');
    expect(BEST_ALT['jpeg']).toBe('webp');
  });
  test('recommends png for webp and legacy formats', () => {
    expect(BEST_ALT['webp']).toBe('png');
    expect(BEST_ALT['bmp']).toBe('png');
    expect(BEST_ALT['gif']).toBe('png');
    expect(BEST_ALT['svg']).toBe('png');
  });
});

// ── Format filtering (source excluded) ──────────────────
const FORMATS = [
  { value: 'png', label: 'PNG' }, { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' }, { value: 'bmp', label: 'BMP' },
  { value: 'svg', label: 'SVG Trace' },
];

function _formatsFor(ext) {
  const srcFmt = EXT_TO_FMT[ext];
  return srcFmt ? FORMATS.filter(fm => fm.value !== srcFmt) : FORMATS;
}

describe('_formatsFor (source format exclusion)', () => {
  test('excludes PNG for .png files', () => {
    const fmts = _formatsFor('png');
    expect(fmts.find(f => f.value === 'png')).toBeUndefined();
    expect(fmts.find(f => f.value === 'jpeg')).toBeDefined();
    expect(fmts).toHaveLength(4);
  });
  test('excludes JPEG for .jpg files', () => {
    const fmts = _formatsFor('jpg');
    expect(fmts.find(f => f.value === 'jpeg')).toBeUndefined();
    expect(fmts).toHaveLength(4);
  });
  test('excludes JPEG for .jpeg files', () => {
    const fmts = _formatsFor('jpeg');
    expect(fmts.find(f => f.value === 'jpeg')).toBeUndefined();
  });
  test('excludes WebP for .webp files', () => {
    const fmts = _formatsFor('webp');
    expect(fmts.find(f => f.value === 'webp')).toBeUndefined();
    expect(fmts).toHaveLength(4);
  });
  test('shows all formats for .gif (no output match)', () => {
    const fmts = _formatsFor('gif');
    expect(fmts).toHaveLength(5);
  });
  test('shows all formats for .svg (no output match)', () => {
    const fmts = _formatsFor('svg');
    expect(fmts).toHaveLength(5);
  });
  test('shows all formats for unknown extension', () => {
    const fmts = _formatsFor('xyz');
    expect(fmts).toHaveLength(5);
  });
});

// ── Filename sanitization ───────────────────────────────
function sanitizeFilename(raw, ext) {
  return raw.replace(/\s+/g, '-').replace(/[<>:"/\\|?*]+/g, '').replace(/-{2,}/g, '-') + '.' + ext;
}

describe('filename sanitization', () => {
  test('replaces spaces with hyphens', () => {
    expect(sanitizeFilename('my photo', 'webp')).toBe('my-photo.webp');
  });
  test('removes illegal characters', () => {
    expect(sanitizeFilename('file<name>:test', 'png')).toBe('filenametest.png');
  });
  test('collapses multiple hyphens', () => {
    expect(sanitizeFilename('a   b', 'jpg')).toBe('a-b.jpg');
  });
  test('handles clean names', () => {
    expect(sanitizeFilename('photo-001', 'webp')).toBe('photo-001.webp');
  });
  test('handles rename pattern with placeholders resolved', () => {
    expect(sanitizeFilename('vacation-001-webp', 'webp')).toBe('vacation-001-webp.webp');
  });
});

// ── Duplicate filename de-duplication ───────────────────
function deduplicateFilename(filename, usedNames) {
  if (!usedNames.has(filename)) { usedNames.add(filename); return filename; }
  const dotIdx = filename.lastIndexOf('.');
  const base = filename.slice(0, dotIdx);
  const ext = filename.slice(dotIdx);
  let n = 2;
  while (usedNames.has(`${base}-${n}${ext}`)) n++;
  const result = `${base}-${n}${ext}`;
  usedNames.add(result);
  return result;
}

describe('duplicate filename de-duplication', () => {
  test('returns original if no conflict', () => {
    const used = new Set();
    expect(deduplicateFilename('photo.webp', used)).toBe('photo.webp');
  });
  test('appends -2 for first duplicate', () => {
    const used = new Set(['photo.webp']);
    expect(deduplicateFilename('photo.webp', used)).toBe('photo-2.webp');
  });
  test('increments counter for multiple duplicates', () => {
    const used = new Set(['photo.webp', 'photo-2.webp']);
    expect(deduplicateFilename('photo.webp', used)).toBe('photo-3.webp');
  });
  test('handles different extensions independently', () => {
    const used = new Set(['photo.webp']);
    expect(deduplicateFilename('photo.png', used)).toBe('photo.png');
  });
});

// ── Default opts ────────────────────────────────────────
function _defaultOpts() {
  return {
    quality: 85, targetSize: false, maxKB: 200,
    svgColors: 8, svgBlur: 1, svgSmooth: 1.5, svgMinArea: 20, svgMaxDim: 400,
  };
}

describe('_defaultOpts', () => {
  test('returns expected defaults', () => {
    const o = _defaultOpts();
    expect(o.quality).toBe(85);
    expect(o.targetSize).toBe(false);
    expect(o.maxKB).toBe(200);
    expect(o.svgColors).toBe(8);
    expect(o.svgBlur).toBe(1);
    expect(o.svgSmooth).toBe(1.5);
    expect(o.svgMinArea).toBe(20);
    expect(o.svgMaxDim).toBe(400);
  });
  test('returns new object each call', () => {
    const a = _defaultOpts();
    const b = _defaultOpts();
    expect(a).not.toBe(b);
    expect(a).toEqual(b);
  });
});
