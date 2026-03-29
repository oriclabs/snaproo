// Pixeroo — Colors Tool
function initColors() {
  let cImg = null;
  const cc = $('colors-canvas'), cx = cc.getContext('2d', { willReadFrequently: true });

  setupDropzone($('colors-drop'), $('colors-file'), async (file) => {
    cImg = await loadImg(file); if (!cImg) return;
    $('colors-drop').style.display = 'none';
    $('colors-preview').style.display = 'block';
    cc.width = cImg.naturalWidth; cc.height = cImg.naturalHeight; cx.drawImage(cImg, 0, 0);
    extractPal();
  });

  cc.addEventListener('click', (e) => {
    const r = cc.getBoundingClientRect(), x = Math.floor((e.clientX-r.left)*cc.width/r.width), y = Math.floor((e.clientY-r.top)*cc.height/r.height);
    const [rv,gv,bv] = cx.getImageData(x,y,1,1).data, hex = rgbHex(rv,gv,bv);
    $('picked-color').innerHTML = `<div style="background:${hex};height:32px;border-radius:6px;margin-bottom:0.375rem;border:1px solid var(--slate-700);"></div><div class="color-hex" data-copy="${hex}">${hex}</div><div class="color-secondary">rgb(${rv},${gv},${bv}) | ${rgbHsl(rv,gv,bv)}</div>`;
  });

  $('palette-count').addEventListener('input', e => { $('palette-count-val').textContent = e.target.value; });
  $('btn-reextract').addEventListener('click', extractPal);

  function extractPal() {
    if (!cImg) return;
    const k = +$('palette-count').value, data = cx.getImageData(0,0,cc.width,cc.height), px = [];
    for (let i = 0; i < data.data.length; i += 16) { if (data.data[i+3] < 128) continue; px.push([data.data[i],data.data[i+1],data.data[i+2]]); }
    const pal = kMeans(px, k);
    $('palette-colors').innerHTML = pal.map(c => `<div class="color-row"><div class="color-preview" style="background:${c.hex};"></div><div style="flex:1;"><div class="color-hex" data-copy="${c.hex}">${c.hex}</div><div class="color-secondary">rgb(${c.r},${c.g},${c.b}) | ${c.pct}%</div></div></div>`).join('');
  }
}

function kMeans(px, k) {
  if (!px.length) return [];
  let cen = px.slice(0, Math.min(k, px.length)).map(p=>[...p]);
  const asg = new Array(px.length).fill(0);
  for (let it=0;it<15;it++) {
    for (let i=0;i<px.length;i++) { let mn=Infinity; for (let j=0;j<cen.length;j++) { const d=(px[i][0]-cen[j][0])**2+(px[i][1]-cen[j][1])**2+(px[i][2]-cen[j][2])**2; if (d<mn){mn=d;asg[i]=j;} } }
    const s=cen.map(()=>[0,0,0]),ct=new Array(cen.length).fill(0);
    for (let i=0;i<px.length;i++){const c=asg[i];s[c][0]+=px[i][0];s[c][1]+=px[i][1];s[c][2]+=px[i][2];ct[c]++;}
    for (let j=0;j<cen.length;j++) if(ct[j]) cen[j]=[Math.round(s[j][0]/ct[j]),Math.round(s[j][1]/ct[j]),Math.round(s[j][2]/ct[j])];
  }
  const ct=new Array(cen.length).fill(0); for(const c of asg)ct[c]++;
  return cen.map((c,i)=>({r:c[0],g:c[1],b:c[2],hex:rgbHex(c[0],c[1],c[2]),pct:Math.round(ct[i]/px.length*100)})).sort((a,b)=>b.pct-a.pct);
}
