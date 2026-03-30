// Snaproo — Minimal ZIP file creator (pure JS, no dependencies)
// Uses "store" mode (no compression) — images are already compressed.
// Supports files up to 4GB total (ZIP32 format).
//
// Usage:
//   const zip = new ZipWriter();
//   zip.addFile('folder/photo.jpg', uint8Array);
//   zip.addFile('folder/image.png', anotherUint8Array);
//   const blob = zip.toBlob();
//   // download blob

class ZipWriter {
  constructor() {
    this.files = []; // { name, data, crc32 }
  }

  addFile(name, data) {
    // data: Uint8Array or ArrayBuffer
    if (data instanceof ArrayBuffer) data = new Uint8Array(data);
    this.files.push({ name, data, crc: this._crc32(data) });
  }

  async addBlob(name, blob) {
    const buf = await blob.arrayBuffer();
    this.addFile(name, new Uint8Array(buf));
  }

  toBlob() {
    const localHeaders = [];
    const centralHeaders = [];
    let offset = 0;

    // Build local file headers + file data
    for (const f of this.files) {
      const nameBytes = new TextEncoder().encode(f.name);
      const localHeader = this._buildLocalHeader(nameBytes, f.data, f.crc);
      localHeaders.push(localHeader, nameBytes, f.data);

      const centralHeader = this._buildCentralHeader(nameBytes, f.data, f.crc, offset);
      centralHeaders.push(centralHeader, nameBytes);

      offset += localHeader.byteLength + nameBytes.byteLength + f.data.byteLength;
    }

    const centralDirOffset = offset;
    let centralDirSize = 0;
    for (const h of centralHeaders) centralDirSize += h.byteLength;

    // End of central directory
    const eocd = this._buildEOCD(this.files.length, centralDirSize, centralDirOffset);

    // Combine everything
    const parts = [...localHeaders, ...centralHeaders, eocd];
    return new Blob(parts, { type: 'application/zip' });
  }

  _buildLocalHeader(nameBytes, data, crc) {
    const buf = new ArrayBuffer(30);
    const v = new DataView(buf);
    v.setUint32(0, 0x04034b50, true);  // Local file header signature
    v.setUint16(4, 20, true);           // Version needed (2.0)
    v.setUint16(6, 0, true);            // Flags
    v.setUint16(8, 0, true);            // Compression: store
    v.setUint16(10, 0, true);           // Mod time
    v.setUint16(12, 0, true);           // Mod date
    v.setUint32(14, crc, true);         // CRC-32
    v.setUint32(18, data.byteLength, true); // Compressed size
    v.setUint32(22, data.byteLength, true); // Uncompressed size
    v.setUint16(26, nameBytes.byteLength, true); // Filename length
    v.setUint16(28, 0, true);           // Extra field length
    return new Uint8Array(buf);
  }

  _buildCentralHeader(nameBytes, data, crc, localOffset) {
    const buf = new ArrayBuffer(46);
    const v = new DataView(buf);
    v.setUint32(0, 0x02014b50, true);  // Central directory header signature
    v.setUint16(4, 20, true);           // Version made by
    v.setUint16(6, 20, true);           // Version needed
    v.setUint16(8, 0, true);            // Flags
    v.setUint16(10, 0, true);           // Compression: store
    v.setUint16(12, 0, true);           // Mod time
    v.setUint16(14, 0, true);           // Mod date
    v.setUint32(16, crc, true);         // CRC-32
    v.setUint32(20, data.byteLength, true); // Compressed size
    v.setUint32(24, data.byteLength, true); // Uncompressed size
    v.setUint16(28, nameBytes.byteLength, true); // Filename length
    v.setUint16(30, 0, true);           // Extra field length
    v.setUint16(32, 0, true);           // Comment length
    v.setUint16(34, 0, true);           // Disk number start
    v.setUint16(36, 0, true);           // Internal attrs
    v.setUint32(38, 0, true);           // External attrs
    v.setUint32(42, localOffset, true); // Offset of local header
    return new Uint8Array(buf);
  }

  _buildEOCD(fileCount, centralDirSize, centralDirOffset) {
    const buf = new ArrayBuffer(22);
    const v = new DataView(buf);
    v.setUint32(0, 0x06054b50, true);  // EOCD signature
    v.setUint16(4, 0, true);           // Disk number
    v.setUint16(6, 0, true);           // Disk with central dir
    v.setUint16(8, fileCount, true);   // Entries on this disk
    v.setUint16(10, fileCount, true);  // Total entries
    v.setUint32(12, centralDirSize, true);  // Central dir size
    v.setUint32(16, centralDirOffset, true); // Central dir offset
    v.setUint16(20, 0, true);          // Comment length
    return new Uint8Array(buf);
  }

  // CRC-32 implementation
  _crc32(data) {
    if (!ZipWriter._crcTable) {
      const t = [];
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        t[n] = c;
      }
      ZipWriter._crcTable = t;
    }
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < data.length; i++) crc = ZipWriter._crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
}
