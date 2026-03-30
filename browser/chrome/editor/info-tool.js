// Snaproo — Info Tool
function initInfo() {
  setupDropzone($('info-drop'), $('info-file'), async (file) => {
    $('info-drop').style.display = 'none';
    $('info-preview').style.display = 'block';
    $('info-img').src = URL.createObjectURL(file);
    const grid = $('info-details-grid');
    if (grid) { grid.style.display = 'grid'; grid.style.gridTemplateColumns = '1fr 1fr'; }
    const img = await loadImg(file);

    $('info-file-details').innerHTML = [
      ['Filename', file.name], ['Type', file.type || 'Unknown'], ['Size', formatBytes(file.size)],
      ['Dimensions', img ? `${img.naturalWidth} x ${img.naturalHeight}` : '?'],
      ['Ratio', img ? `${img.naturalWidth/gcd(img.naturalWidth,img.naturalHeight)}:${img.naturalHeight/gcd(img.naturalWidth,img.naturalHeight)}` : '?'],
      ['Modified', file.lastModified ? new Date(file.lastModified).toLocaleString() : '?'],
    ].map(([l,v]) => `<div class="info-row"><span class="info-label">${l}</span><span class="info-value" class="copyable">${esc(v)}</span></div>`).join('');

    const bytes = new Uint8Array(await file.arrayBuffer());
    const exif = parseExif(bytes);
    $('info-exif').innerHTML = exif.length ? exif.map(([t,v]) => `<div class="info-row"><span class="info-label">${esc(t)}</span><span class="info-value" class="copyable">${esc(String(v))}</span></div>`).join('') : '<span style="color:var(--slate-500);">No EXIF data</span>';

    const structure = parseJpegStructure(bytes);
    $('info-structure').innerHTML = structure.length ? structure.map(s => `<div style="color:var(--slate-400);padding:2px 0;">${esc(s)}</div>`).join('') : '<span style="color:var(--slate-500);">Not JPEG</span>';

    // DPI
    const dpi = readDpiFromPng(bytes) || readDpiFromJpeg(bytes);
    $('info-dpi').innerHTML = dpi
      ? `<div class="info-row"><span class="info-label">DPI</span><span class="info-value">${dpi.x} x ${dpi.y}</span></div>`
      : '<span style="color:var(--slate-500);">Not available</span>';

    // Image hash
    if (img) {
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      const hashEl = $('info-hash');
      hashEl.innerHTML = '<span style="color:var(--slate-500);">Computing...</span>';
      try {
        const sha = await computeImageHash(c, 'SHA-256');
        const phash = computePerceptualHash(c);
        hashEl.innerHTML = `
          <div class="info-row"><span class="info-label">SHA-256</span><span class="info-value copyable" style="font-size:0.7rem;">${sha.substring(0, 16)}...</span></div>
          <div class="info-row"><span class="info-label">pHash</span><span class="info-value copyable">${phash}</span></div>
        `;
      } catch { hashEl.innerHTML = '<span style="color:var(--slate-500);">Hash failed</span>'; }

      // Base64 button
      const b64Btn = $('btn-copy-base64');
      b64Btn.disabled = false;
      b64Btn.onclick = () => {
        navigator.clipboard.writeText(c.toDataURL(file.type || 'image/png'));
      };
    }
  });
}

// ============================================================
// EXIF Parser (shared)
// ============================================================

function parseExif(bytes) {
  const e=[];if(bytes[0]!==0xFF||bytes[1]!==0xD8)return e;let o=2;
  while(o<bytes.length-1){if(bytes[o]!==0xFF)break;const m=bytes[o+1];if(m===0xD9||m===0xDA)break;const l=(bytes[o+2]<<8)|bytes[o+3];
  if(m===0xE1){const h=String.fromCharCode(...bytes.slice(o+4,o+8));if(h==='Exif')parseTIFD(bytes,o+10,e);}o+=2+l;}return e;
}
function parseTIFD(b,ts,e){if(ts+8>b.length)return;const le=b[ts]===0x49;const r16=(o)=>le?(b[o]|(b[o+1]<<8)):((b[o]<<8)|b[o+1]);const r32=(o)=>le?(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0:((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;
const is=ts+r32(ts+4);if(is+2>b.length)return;const T={0x010F:'Make',0x0110:'Model',0x0112:'Orientation',0x011A:'XResolution',0x011B:'YResolution',0x0131:'Software',0x0132:'DateTime',0x829A:'ExposureTime',0x829D:'FNumber',0x8827:'ISO',0x9003:'DateTimeOriginal',0x920A:'FocalLength',0xA405:'FocalLength35mm',0xA002:'PixelXDimension',0xA003:'PixelYDimension',0x8769:'ExifIFD',0x8825:'GPSIFD'};
const c=r16(is);for(let i=0;i<c&&is+2+i*12+12<=b.length;i++){const eo=is+2+i*12,tag=r16(eo),ty=r16(eo+2),tc=r32(eo+4),vo=eo+8;const n=T[tag];if(!n)continue;if(tag===0x8769||tag===0x8825){parseTSub(b,ts,ts+r32(vo),e,le,T);continue;}const v=readTV(b,ts,ty,tc,vo,le);if(v!==null)e.push([n,v]);}}
function parseTSub(b,ts,is,e,le,T){if(is+2>b.length)return;const r16=(o)=>le?(b[o]|(b[o+1]<<8)):((b[o]<<8)|b[o+1]);const r32=(o)=>le?(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0:((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;
const c=r16(is);for(let i=0;i<c&&is+2+i*12+12<=b.length;i++){const eo=is+2+i*12,tag=r16(eo),ty=r16(eo+2),tc=r32(eo+4),vo=eo+8;const n=T[tag];if(!n||tag===0x8769||tag===0x8825)continue;const v=readTV(b,ts,ty,tc,vo,le);if(v!==null)e.push([n,v]);}}
function readTV(b,ts,ty,c,vo,le){const r16=(o)=>le?(b[o]|(b[o+1]<<8)):((b[o]<<8)|b[o+1]);const r32=(o)=>le?(b[o]|(b[o+1]<<8)|(b[o+2]<<16)|(b[o+3]<<24))>>>0:((b[o]<<24)|(b[o+1]<<16)|(b[o+2]<<8)|b[o+3])>>>0;
try{if(ty===2){const d=c>4?ts+r32(vo):vo;let s='';for(let i=0;i<c-1&&d+i<b.length;i++)s+=String.fromCharCode(b[d+i]);return s.trim();}if(ty===3)return r16(vo);if(ty===4)return r32(vo);if(ty===5){const d=ts+r32(vo);if(d+8>b.length)return null;const n=r32(d),dn=r32(d+4);return dn===0?n:n%dn===0?n/dn:`${n}/${dn}`;}}catch{}return null;}

function parseJpegStructure(bytes) {
  const s=[];if(bytes[0]!==0xFF||bytes[1]!==0xD8)return s;s.push('SOI');let o=2;
  const N={0xE0:'APP0/JFIF',0xE1:'APP1/EXIF',0xDB:'DQT',0xC0:'SOF0/Baseline',0xC2:'SOF2/Progressive',0xC4:'DHT',0xDA:'SOS',0xD9:'EOI',0xFE:'COM'};
  while(o<bytes.length-1){if(bytes[o]!==0xFF)break;const m=bytes[o+1];if(m===0xD9){s.push('EOI');break;}if(m===0xDA){s.push('SOS');break;}const l=(bytes[o+2]<<8)|bytes[o+3];s.push(`${N[m]||'0xFF'+m.toString(16).toUpperCase()} [${l}B]`);o+=2+l;}return s;
}
