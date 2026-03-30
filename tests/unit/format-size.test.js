// Unit tests for _formatSize utility

function _formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

describe('_formatSize', () => {
  test('returns dash for falsy values', () => {
    expect(_formatSize(0)).toBe('—');
    expect(_formatSize(null)).toBe('—');
    expect(_formatSize(undefined)).toBe('—');
  });

  test('formats bytes', () => {
    expect(_formatSize(100)).toBe('100 B');
    expect(_formatSize(1)).toBe('1 B');
    expect(_formatSize(1023)).toBe('1023 B');
  });

  test('formats kilobytes', () => {
    expect(_formatSize(1024)).toBe('1.0 KB');
    expect(_formatSize(1536)).toBe('1.5 KB');
    expect(_formatSize(512000)).toBe('500.0 KB');
  });

  test('formats megabytes', () => {
    expect(_formatSize(1048576)).toBe('1.0 MB');
    expect(_formatSize(5242880)).toBe('5.0 MB');
    expect(_formatSize(1572864)).toBe('1.5 MB');
  });
});
