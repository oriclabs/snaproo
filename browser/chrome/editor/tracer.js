// Snaproo — Image-to-SVG Tracer
// Adapted from imagetracerjs (Public Domain / Unlicense)
// Stripped: Node.js, CLI, AMD, DOM helpers. Kept: core vectorization algorithm.
// API: traceCanvas(canvas, options) → SVG string

const PixTrace = (function () {
  'use strict';

  // ── Presets ──────────────────────────────────────────────

  const presets = {
    default: {
      ltres: 1, qtres: 1, pathomit: 8, rightangleenhance: true,
      colorsampling: 2, numberofcolors: 16, mincolorratio: 0,
      colorquantcycles: 3, layering: 0, strokewidth: 1,
      linefilter: false, scale: 1, roundcoords: 1,
      viewbox: true, desc: false, lcpr: 0, qcpr: 0,
      blurradius: 0, blurdelta: 20
    },
    // --- Snaproo presets ---
    logo:       { colorsampling: 0, numberofcolors: 4, blurradius: 2, pathomit: 4, qtres: 0.5, ltres: 0.5 },
    sketch:     { colorsampling: 0, numberofcolors: 2, ltres: 0.5, qtres: 1, blurradius: 1 },
    photo:      { numberofcolors: 24, blurradius: 3, blurdelta: 40, pathomit: 4 },
    posterized: { colorsampling: 0, numberofcolors: 4, blurradius: 5 },
    curvy:      { ltres: 0.01, linefilter: true, rightangleenhance: false },
    sharp:      { qtres: 0.01, linefilter: false },
    detailed:   { pathomit: 0, roundcoords: 2, ltres: 0.5, qtres: 0.5, numberofcolors: 64 },
    smoothed:   { blurradius: 5, blurdelta: 64 },
    grayscale:  { colorsampling: 0, colorquantcycles: 1, numberofcolors: 7 },
    artistic:   { colorsampling: 0, colorquantcycles: 1, pathomit: 0, blurradius: 5, blurdelta: 64, ltres: 0.01, linefilter: true, numberofcolors: 16, strokewidth: 2 },
    minimal:    { colorsampling: 0, numberofcolors: 2, pathomit: 16, ltres: 2, qtres: 2 },
  };

  function resolveOptions(options) {
    options = options || {};
    if (typeof options === 'string') {
      options = presets[options.toLowerCase()] || {};
    }
    const def = presets.default;
    const out = {};
    for (const k of Object.keys(def)) {
      out[k] = options.hasOwnProperty(k) ? options[k] : def[k];
    }
    if (options.pal) out.pal = options.pal;
    return out;
  }

  // ── Public API ──────────────────────────────────────────

  function traceCanvas(canvas, options) {
    options = resolveOptions(options);
    const ctx = canvas.getContext('2d');
    const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const td = imagedataToTracedata(imgd, options);
    return getsvgstring(td, options);
  }

  function traceCanvasToTracedata(canvas, options) {
    options = resolveOptions(options);
    const ctx = canvas.getContext('2d');
    const imgd = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return imagedataToTracedata(imgd, options);
  }

  // ── Core Pipeline ───────────────────────────────────────

  function imagedataToTracedata(imgd, options) {
    // 1. Color quantization
    const ii = colorquantization(imgd, options);

    // Sequential layering (simpler, works well for most use cases)
    if (options.layering === 0) {
      const tracedata = { layers: [], palette: ii.palette, width: ii.array[0].length - 2, height: ii.array.length - 2 };
      for (let colornum = 0; colornum < ii.palette.length; colornum++) {
        tracedata.layers.push(
          batchtracepaths(
            internodes(pathscan(layeringstep(ii, colornum), options.pathomit), options),
            options.ltres, options.qtres
          )
        );
      }
      return tracedata;
    }

    // Parallel layering
    const ls = layering(ii);
    const bps = batchpathscan(ls, options.pathomit);
    const bis = batchinternodes(bps, options);
    return {
      layers: batchtracelayers(bis, options.ltres, options.qtres),
      palette: ii.palette,
      width: imgd.width,
      height: imgd.height
    };
  }

  // ── 1. Color Quantization (k-means) ────────────────────

  function colorquantization(imgd, options) {
    const pixelnum = imgd.width * imgd.height;
    let data = imgd.data;

    // Ensure RGBA
    if (data.length < pixelnum * 4) {
      const nd = new Uint8ClampedArray(pixelnum * 4);
      for (let p = 0; p < pixelnum; p++) {
        nd[p * 4] = data[p * 3]; nd[p * 4 + 1] = data[p * 3 + 1];
        nd[p * 4 + 2] = data[p * 3 + 2]; nd[p * 4 + 3] = 255;
      }
      data = nd;
    }

    // Color index array (padded +2 in each dimension)
    const arr = [];
    for (let j = 0; j < imgd.height + 2; j++) {
      arr[j] = [];
      for (let i = 0; i < imgd.width + 2; i++) arr[j][i] = -1;
    }

    // Generate or sample palette
    let palette;
    if (options.pal) palette = options.pal;
    else if (options.colorsampling === 0) palette = generatepalette(options.numberofcolors);
    else if (options.colorsampling === 1) palette = samplepalette(options.numberofcolors, { data, width: imgd.width, height: imgd.height });
    else palette = samplepalette2(options.numberofcolors, { data, width: imgd.width, height: imgd.height });

    // Selective Gaussian blur
    let blurData = { data, width: imgd.width, height: imgd.height };
    if (options.blurradius > 0) blurData = blur(blurData, options.blurradius, options.blurdelta);
    const bd = blurData.data;

    // K-means clustering
    const paletteacc = [];
    for (let cnt = 0; cnt < options.colorquantcycles; cnt++) {
      if (cnt > 0) {
        for (let k = 0; k < palette.length; k++) {
          if (paletteacc[k].n > 0) {
            palette[k] = {
              r: Math.floor(paletteacc[k].r / paletteacc[k].n),
              g: Math.floor(paletteacc[k].g / paletteacc[k].n),
              b: Math.floor(paletteacc[k].b / paletteacc[k].n),
              a: Math.floor(paletteacc[k].a / paletteacc[k].n)
            };
          }
          if ((paletteacc[k].n / pixelnum < options.mincolorratio) && (cnt < options.colorquantcycles - 1)) {
            palette[k] = { r: Math.floor(Math.random() * 255), g: Math.floor(Math.random() * 255), b: Math.floor(Math.random() * 255), a: Math.floor(Math.random() * 255) };
          }
        }
      }

      for (let i = 0; i < palette.length; i++) paletteacc[i] = { r: 0, g: 0, b: 0, a: 0, n: 0 };

      for (let j = 0; j < imgd.height; j++) {
        for (let i = 0; i < imgd.width; i++) {
          const idx = (j * imgd.width + i) * 4;
          let ci = 0, cdl = 1024;
          for (let k = 0; k < palette.length; k++) {
            const cd = Math.abs(palette[k].r - bd[idx]) + Math.abs(palette[k].g - bd[idx + 1]) +
                       Math.abs(palette[k].b - bd[idx + 2]) + Math.abs(palette[k].a - bd[idx + 3]);
            if (cd < cdl) { cdl = cd; ci = k; }
          }
          paletteacc[ci].r += bd[idx]; paletteacc[ci].g += bd[idx + 1];
          paletteacc[ci].b += bd[idx + 2]; paletteacc[ci].a += bd[idx + 3];
          paletteacc[ci].n++;
          arr[j + 1][i + 1] = ci;
        }
      }
    }

    return { array: arr, palette };
  }

  function samplepalette(n, imgd) {
    const palette = [];
    for (let i = 0; i < n; i++) {
      const idx = Math.floor(Math.random() * imgd.data.length / 4) * 4;
      palette.push({ r: imgd.data[idx], g: imgd.data[idx + 1], b: imgd.data[idx + 2], a: imgd.data[idx + 3] });
    }
    return palette;
  }

  function samplepalette2(n, imgd) {
    const palette = [], ni = Math.ceil(Math.sqrt(n)), nj = Math.ceil(n / ni);
    const vx = imgd.width / (ni + 1), vy = imgd.height / (nj + 1);
    for (let j = 0; j < nj; j++) {
      for (let i = 0; i < ni; i++) {
        if (palette.length === n) break;
        const idx = Math.floor(((j + 1) * vy) * imgd.width + ((i + 1) * vx)) * 4;
        palette.push({ r: imgd.data[idx], g: imgd.data[idx + 1], b: imgd.data[idx + 2], a: imgd.data[idx + 3] });
      }
    }
    return palette;
  }

  function generatepalette(n) {
    const palette = [];
    if (n < 8) {
      const step = Math.floor(255 / (n - 1));
      for (let i = 0; i < n; i++) palette.push({ r: i * step, g: i * step, b: i * step, a: 255 });
    } else {
      const cq = Math.floor(Math.pow(n, 1 / 3)), cs = Math.floor(255 / (cq - 1));
      for (let r = 0; r < cq; r++)
        for (let g = 0; g < cq; g++)
          for (let b = 0; b < cq; b++)
            palette.push({ r: r * cs, g: g * cs, b: b * cs, a: 255 });
      const rest = n - cq * cq * cq;
      for (let i = 0; i < rest; i++)
        palette.push({ r: Math.floor(Math.random() * 255), g: Math.floor(Math.random() * 255), b: Math.floor(Math.random() * 255), a: Math.floor(Math.random() * 255) });
    }
    return palette;
  }

  // ── 2. Layer Separation & Edge Detection ────────────────

  function layering(ii) {
    const layers = [], ah = ii.array.length, aw = ii.array[0].length;
    for (let k = 0; k < ii.palette.length; k++) {
      layers[k] = [];
      for (let j = 0; j < ah; j++) { layers[k][j] = []; for (let i = 0; i < aw; i++) layers[k][j][i] = 0; }
    }
    for (let j = 1; j < ah - 1; j++) {
      for (let i = 1; i < aw - 1; i++) {
        const val = ii.array[j][i];
        const n1 = ii.array[j - 1][i - 1] === val ? 1 : 0, n2 = ii.array[j - 1][i] === val ? 1 : 0;
        const n4 = ii.array[j][i - 1] === val ? 1 : 0, n5 = ii.array[j][i + 1] === val ? 1 : 0;
        const n6 = ii.array[j + 1][i - 1] === val ? 1 : 0, n7 = ii.array[j + 1][i] === val ? 1 : 0;
        const n8 = ii.array[j + 1][i + 1] === val ? 1 : 0;
        layers[val][j + 1][i + 1] = 1 + n5 * 2 + n8 * 4 + n7 * 8;
        if (!n4) layers[val][j + 1][i] = 0 + 2 + n7 * 4 + n6 * 8;
        if (!n2) layers[val][j][i + 1] = 0 + (ii.array[j - 1][i + 1] === val ? 1 : 0) * 2 + n5 * 4 + 8;
        if (!n1) layers[val][j][i] = 0 + n2 * 2 + 4 + n4 * 8;
      }
    }
    return layers;
  }

  function layeringstep(ii, cnum) {
    const ah = ii.array.length, aw = ii.array[0].length, layer = [];
    for (let j = 0; j < ah; j++) { layer[j] = []; for (let i = 0; i < aw; i++) layer[j][i] = 0; }
    for (let j = 1; j < ah; j++) {
      for (let i = 1; i < aw; i++) {
        layer[j][i] =
          (ii.array[j - 1][i - 1] === cnum ? 1 : 0) +
          (ii.array[j - 1][i] === cnum ? 2 : 0) +
          (ii.array[j][i - 1] === cnum ? 8 : 0) +
          (ii.array[j][i] === cnum ? 4 : 0);
      }
    }
    return layer;
  }

  // ── 3. Path Scanning ────────────────────────────────────

  function pointinpoly(p, pa) {
    let isin = false;
    for (let i = 0, j = pa.length - 1; i < pa.length; j = i++) {
      isin = (((pa[i].y > p.y) !== (pa[j].y > p.y)) && (p.x < (pa[j].x - pa[i].x) * (p.y - pa[i].y) / (pa[j].y - pa[i].y) + pa[i].x)) ? !isin : isin;
    }
    return isin;
  }

  function boundingboxincludes(parent, child) {
    return parent[0] < child[0] && parent[1] < child[1] && parent[2] > child[2] && parent[3] > child[3];
  }

  const pathscan_combined_lookup = [
    [[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]],
    [[0,1,0,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[0,2,-1,0]],
    [[-1,-1,-1,-1],[-1,-1,-1,-1],[0,1,0,-1],[0,0,1,0]],
    [[0,0,1,0],[-1,-1,-1,-1],[0,2,-1,0],[-1,-1,-1,-1]],
    [[-1,-1,-1,-1],[0,0,1,0],[0,3,0,1],[-1,-1,-1,-1]],
    [[13,3,0,1],[13,2,-1,0],[7,1,0,-1],[7,0,1,0]],
    [[-1,-1,-1,-1],[0,1,0,-1],[-1,-1,-1,-1],[0,3,0,1]],
    [[0,3,0,1],[0,2,-1,0],[-1,-1,-1,-1],[-1,-1,-1,-1]],
    [[0,3,0,1],[0,2,-1,0],[-1,-1,-1,-1],[-1,-1,-1,-1]],
    [[-1,-1,-1,-1],[0,1,0,-1],[-1,-1,-1,-1],[0,3,0,1]],
    [[11,1,0,-1],[14,0,1,0],[14,3,0,1],[11,2,-1,0]],
    [[-1,-1,-1,-1],[0,0,1,0],[0,3,0,1],[-1,-1,-1,-1]],
    [[0,0,1,0],[-1,-1,-1,-1],[0,2,-1,0],[-1,-1,-1,-1]],
    [[-1,-1,-1,-1],[-1,-1,-1,-1],[0,1,0,-1],[0,0,1,0]],
    [[0,1,0,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[0,2,-1,0]],
    [[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1],[-1,-1,-1,-1]]
  ];

  function pathscan(arr, pathomit) {
    const paths = [], w = arr[0].length, h = arr.length;
    let pacnt = 0;

    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        if (arr[j][i] === 4 || arr[j][i] === 11) {
          let px = i, py = j, dir = 1, pathfinished = false, pcnt = 0;
          const holepath = arr[j][i] === 11;
          paths[pacnt] = { points: [], boundingbox: [px, py, px, py], holechildren: [] };

          while (!pathfinished) {
            paths[pacnt].points[pcnt] = { x: px - 1, y: py - 1, t: arr[py][px] };
            if ((px - 1) < paths[pacnt].boundingbox[0]) paths[pacnt].boundingbox[0] = px - 1;
            if ((px - 1) > paths[pacnt].boundingbox[2]) paths[pacnt].boundingbox[2] = px - 1;
            if ((py - 1) < paths[pacnt].boundingbox[1]) paths[pacnt].boundingbox[1] = py - 1;
            if ((py - 1) > paths[pacnt].boundingbox[3]) paths[pacnt].boundingbox[3] = py - 1;

            const lookuprow = pathscan_combined_lookup[arr[py][px]][dir];
            arr[py][px] = lookuprow[0]; dir = lookuprow[1]; px += lookuprow[2]; py += lookuprow[3];

            if ((px - 1 === paths[pacnt].points[0].x) && (py - 1 === paths[pacnt].points[0].y)) {
              pathfinished = true;
              if (paths[pacnt].points.length < pathomit) {
                paths.pop();
              } else {
                paths[pacnt].isholepath = holepath;
                if (holepath) {
                  let parentidx = 0, parentbbox = [-1, -1, w + 1, h + 1];
                  for (let pc = 0; pc < pacnt; pc++) {
                    if (!paths[pc].isholepath &&
                        boundingboxincludes(paths[pc].boundingbox, paths[pacnt].boundingbox) &&
                        boundingboxincludes(parentbbox, paths[pc].boundingbox) &&
                        pointinpoly(paths[pacnt].points[0], paths[pc].points)) {
                      parentidx = pc; parentbbox = paths[pc].boundingbox;
                    }
                  }
                  paths[parentidx].holechildren.push(pacnt);
                }
                pacnt++;
              }
            }
            pcnt++;
          }
        }
      }
    }
    return paths;
  }

  function batchpathscan(layers, pathomit) {
    const bpaths = [];
    for (const k in layers) { if (layers.hasOwnProperty(k)) bpaths[k] = pathscan(layers[k], pathomit); }
    return bpaths;
  }

  // ── 4. Interpolation ───────────────────────────────────

  function getdirection(x1, y1, x2, y2) {
    if (x1 < x2) return y1 < y2 ? 1 : y1 > y2 ? 7 : 0;
    if (x1 > x2) return y1 < y2 ? 3 : y1 > y2 ? 5 : 4;
    return y1 < y2 ? 2 : y1 > y2 ? 6 : 8;
  }

  function testrightangle(path, i1, i2, i3, i4, i5) {
    return ((path.points[i3].x === path.points[i1].x && path.points[i3].x === path.points[i2].x &&
             path.points[i3].y === path.points[i4].y && path.points[i3].y === path.points[i5].y) ||
            (path.points[i3].y === path.points[i1].y && path.points[i3].y === path.points[i2].y &&
             path.points[i3].x === path.points[i4].x && path.points[i3].x === path.points[i5].x));
  }

  function internodes(paths, options) {
    const ins = [];
    for (let pacnt = 0; pacnt < paths.length; pacnt++) {
      ins[pacnt] = { points: [], boundingbox: paths[pacnt].boundingbox, holechildren: paths[pacnt].holechildren, isholepath: paths[pacnt].isholepath };
      const palen = paths[pacnt].points.length;

      for (let pcnt = 0; pcnt < palen; pcnt++) {
        const ni = (pcnt + 1) % palen, ni2 = (pcnt + 2) % palen;
        const pi = (pcnt - 1 + palen) % palen, pi2 = (pcnt - 2 + palen) % palen;

        if (options.rightangleenhance && testrightangle(paths[pacnt], pi2, pi, pcnt, ni, ni2)) {
          if (ins[pacnt].points.length > 0) {
            const last = ins[pacnt].points[ins[pacnt].points.length - 1];
            last.linesegment = getdirection(last.x, last.y, paths[pacnt].points[pcnt].x, paths[pacnt].points[pcnt].y);
          }
          ins[pacnt].points.push({
            x: paths[pacnt].points[pcnt].x, y: paths[pacnt].points[pcnt].y,
            linesegment: getdirection(paths[pacnt].points[pcnt].x, paths[pacnt].points[pcnt].y,
              (paths[pacnt].points[pcnt].x + paths[pacnt].points[ni].x) / 2,
              (paths[pacnt].points[pcnt].y + paths[pacnt].points[ni].y) / 2)
          });
        }

        ins[pacnt].points.push({
          x: (paths[pacnt].points[pcnt].x + paths[pacnt].points[ni].x) / 2,
          y: (paths[pacnt].points[pcnt].y + paths[pacnt].points[ni].y) / 2,
          linesegment: getdirection(
            (paths[pacnt].points[pcnt].x + paths[pacnt].points[ni].x) / 2,
            (paths[pacnt].points[pcnt].y + paths[pacnt].points[ni].y) / 2,
            (paths[pacnt].points[ni].x + paths[pacnt].points[ni2].x) / 2,
            (paths[pacnt].points[ni].y + paths[pacnt].points[ni2].y) / 2)
        });
      }
    }
    return ins;
  }

  function batchinternodes(bpaths, options) {
    const out = [];
    for (const k in bpaths) { if (bpaths.hasOwnProperty(k)) out[k] = internodes(bpaths[k], options); }
    return out;
  }

  // ── 5. Curve Fitting ───────────────────────────────────

  function fitseq(path, ltres, qtres, seqstart, seqend) {
    if (seqend > path.points.length || seqend < 0) return [];
    let errorpoint = seqstart, errorval = 0, curvepass = true;
    let tl = seqend - seqstart; if (tl < 0) tl += path.points.length;
    const vx = (path.points[seqend].x - path.points[seqstart].x) / tl;
    const vy = (path.points[seqend].y - path.points[seqstart].y) / tl;

    // Fit straight line
    let pcnt = (seqstart + 1) % path.points.length;
    while (pcnt !== seqend) {
      let pl = pcnt - seqstart; if (pl < 0) pl += path.points.length;
      const px = path.points[seqstart].x + vx * pl, py = path.points[seqstart].y + vy * pl;
      const dist2 = (path.points[pcnt].x - px) ** 2 + (path.points[pcnt].y - py) ** 2;
      if (dist2 > ltres) curvepass = false;
      if (dist2 > errorval) { errorpoint = pcnt; errorval = dist2; }
      pcnt = (pcnt + 1) % path.points.length;
    }
    if (curvepass) return [{ type: 'L', x1: path.points[seqstart].x, y1: path.points[seqstart].y, x2: path.points[seqend].x, y2: path.points[seqend].y }];

    // Fit quadratic spline
    const fitpoint = errorpoint; curvepass = true; errorval = 0;
    let t = (fitpoint - seqstart) / tl, t1 = (1 - t) ** 2, t2 = 2 * (1 - t) * t, t3 = t * t;
    const cpx = (t1 * path.points[seqstart].x + t3 * path.points[seqend].x - path.points[fitpoint].x) / -t2;
    const cpy = (t1 * path.points[seqstart].y + t3 * path.points[seqend].y - path.points[fitpoint].y) / -t2;

    pcnt = seqstart + 1;
    while (pcnt !== seqend) {
      t = (pcnt - seqstart) / tl; t1 = (1 - t) ** 2; t2 = 2 * (1 - t) * t; t3 = t * t;
      const px = t1 * path.points[seqstart].x + t2 * cpx + t3 * path.points[seqend].x;
      const py = t1 * path.points[seqstart].y + t2 * cpy + t3 * path.points[seqend].y;
      const dist2 = (path.points[pcnt].x - px) ** 2 + (path.points[pcnt].y - py) ** 2;
      if (dist2 > qtres) curvepass = false;
      if (dist2 > errorval) { errorpoint = pcnt; errorval = dist2; }
      pcnt = (pcnt + 1) % path.points.length;
    }
    if (curvepass) return [{ type: 'Q', x1: path.points[seqstart].x, y1: path.points[seqstart].y, x2: cpx, y2: cpy, x3: path.points[seqend].x, y3: path.points[seqend].y }];

    // Split and recurse
    const splitpoint = fitpoint;
    return fitseq(path, ltres, qtres, seqstart, splitpoint).concat(fitseq(path, ltres, qtres, splitpoint, seqend));
  }

  function tracepath(path, ltres, qtres) {
    const smp = { segments: [], boundingbox: path.boundingbox, holechildren: path.holechildren, isholepath: path.isholepath };
    let pcnt = 0;
    while (pcnt < path.points.length) {
      let segtype1 = path.points[pcnt].linesegment, segtype2 = -1, seqend = pcnt + 1;
      while (((path.points[seqend].linesegment === segtype1) || (path.points[seqend].linesegment === segtype2) || (segtype2 === -1)) && (seqend < path.points.length - 1)) {
        if (path.points[seqend].linesegment !== segtype1 && segtype2 === -1) segtype2 = path.points[seqend].linesegment;
        seqend++;
      }
      if (seqend === path.points.length - 1) seqend = 0;
      smp.segments = smp.segments.concat(fitseq(path, ltres, qtres, pcnt, seqend));
      pcnt = seqend > 0 ? seqend : path.points.length;
    }
    return smp;
  }

  function batchtracepaths(internodepaths, ltres, qtres) {
    return internodepaths.map(p => tracepath(p, ltres, qtres));
  }

  function batchtracelayers(binternodes, ltres, qtres) {
    const out = [];
    for (const k in binternodes) { if (binternodes.hasOwnProperty(k)) out[k] = batchtracepaths(binternodes[k], ltres, qtres); }
    return out;
  }

  // ── SVG Output ─────────────────────────────────────────

  function roundtodec(val, places) { return +val.toFixed(places); }

  function tosvgcolorstr(c, options) {
    return `fill="rgb(${c.r},${c.g},${c.b})" stroke="rgb(${c.r},${c.g},${c.b})" stroke-width="${options.strokewidth}" opacity="${c.a / 255}" `;
  }

  function svgpathstring(tracedata, lnum, pathnum, options) {
    const layer = tracedata.layers[lnum], smp = layer[pathnum];
    if (options.linefilter && smp.segments.length < 3) return '';
    if (!smp.segments.length) return '';

    const s = options.scale, rc = options.roundcoords;
    const r = rc === -1 ? (v => v * s) : (v => roundtodec(v * s, rc));

    let str = '<path ' + tosvgcolorstr(tracedata.palette[lnum], options) + 'd="';
    str += `M ${r(smp.segments[0].x1)} ${r(smp.segments[0].y1)} `;
    for (const seg of smp.segments) {
      str += `${seg.type} ${r(seg.x2)} ${r(seg.y2)} `;
      if (seg.x3 !== undefined) str += `${r(seg.x3)} ${r(seg.y3)} `;
    }
    str += 'Z ';

    // Hole children
    for (const hci of smp.holechildren) {
      const hsmp = layer[hci];
      if (!hsmp.segments.length) continue;
      const last = hsmp.segments[hsmp.segments.length - 1];
      str += `M ${r(last.x3 !== undefined ? last.x3 : last.x2)} ${r(last.y3 !== undefined ? last.y3 : last.y2)} `;
      for (let pc = hsmp.segments.length - 1; pc >= 0; pc--) {
        str += `${hsmp.segments[pc].type} `;
        if (hsmp.segments[pc].x3 !== undefined) str += `${r(hsmp.segments[pc].x2)} ${r(hsmp.segments[pc].y2)} `;
        str += `${r(hsmp.segments[pc].x1)} ${r(hsmp.segments[pc].y1)} `;
      }
      str += 'Z ';
    }

    str += '" />';
    return str;
  }

  function getsvgstring(tracedata, options) {
    const w = tracedata.width * options.scale, h = tracedata.height * options.scale;
    let svg = options.viewbox
      ? `<svg viewBox="0 0 ${w} ${h}" version="1.1" xmlns="http://www.w3.org/2000/svg">`
      : `<svg width="${w}" height="${h}" version="1.1" xmlns="http://www.w3.org/2000/svg">`;

    for (let lcnt = 0; lcnt < tracedata.layers.length; lcnt++) {
      for (let pcnt = 0; pcnt < tracedata.layers[lcnt].length; pcnt++) {
        if (!tracedata.layers[lcnt][pcnt].isholepath) {
          svg += svgpathstring(tracedata, lcnt, pcnt, options);
        }
      }
    }
    svg += '</svg>';
    return svg;
  }

  // ── Selective Gaussian Blur ────────────────────────────

  const gks = [
    [0.27901, 0.44198, 0.27901],
    [0.135336, 0.228569, 0.272192, 0.228569, 0.135336],
    [0.086776, 0.136394, 0.178908, 0.195843, 0.178908, 0.136394, 0.086776],
    [0.063327, 0.093095, 0.122589, 0.144599, 0.152781, 0.144599, 0.122589, 0.093095, 0.063327],
    [0.049692, 0.069304, 0.089767, 0.107988, 0.120651, 0.125194, 0.120651, 0.107988, 0.089767, 0.069304, 0.049692]
  ];

  function blur(imgd, radius, delta) {
    radius = Math.floor(radius);
    if (radius < 1) return imgd;
    if (radius > 5) radius = 5;
    delta = Math.abs(delta); if (delta > 1024) delta = 1024;
    const thisgk = gks[radius - 1];
    const w = imgd.width, h = imgd.height;
    const data2 = new Array(w * h * 4);

    // Horizontal blur
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let racc = 0, gacc = 0, bacc = 0, aacc = 0, wacc = 0;
        for (let k = -radius; k <= radius; k++) {
          if ((i + k > 0) && (i + k < w)) {
            const idx = (j * w + i + k) * 4;
            racc += imgd.data[idx] * thisgk[k + radius];
            gacc += imgd.data[idx + 1] * thisgk[k + radius];
            bacc += imgd.data[idx + 2] * thisgk[k + radius];
            aacc += imgd.data[idx + 3] * thisgk[k + radius];
            wacc += thisgk[k + radius];
          }
        }
        const idx = (j * w + i) * 4;
        data2[idx] = Math.floor(racc / wacc);
        data2[idx + 1] = Math.floor(gacc / wacc);
        data2[idx + 2] = Math.floor(bacc / wacc);
        data2[idx + 3] = Math.floor(aacc / wacc);
      }
    }

    const himgd = new Uint8ClampedArray(data2);

    // Vertical blur
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        let racc = 0, gacc = 0, bacc = 0, aacc = 0, wacc = 0;
        for (let k = -radius; k <= radius; k++) {
          if ((j + k > 0) && (j + k < h)) {
            const idx = ((j + k) * w + i) * 4;
            racc += himgd[idx] * thisgk[k + radius];
            gacc += himgd[idx + 1] * thisgk[k + radius];
            bacc += himgd[idx + 2] * thisgk[k + radius];
            aacc += himgd[idx + 3] * thisgk[k + radius];
            wacc += thisgk[k + radius];
          }
        }
        const idx = (j * w + i) * 4;
        data2[idx] = Math.floor(racc / wacc);
        data2[idx + 1] = Math.floor(gacc / wacc);
        data2[idx + 2] = Math.floor(bacc / wacc);
        data2[idx + 3] = Math.floor(aacc / wacc);
      }
    }

    // Selective: if blurred pixel differs too much from original, keep original
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const idx = (j * w + i) * 4;
        const d = Math.abs(data2[idx] - imgd.data[idx]) + Math.abs(data2[idx + 1] - imgd.data[idx + 1]) +
                  Math.abs(data2[idx + 2] - imgd.data[idx + 2]) + Math.abs(data2[idx + 3] - imgd.data[idx + 3]);
        if (d > delta) {
          data2[idx] = imgd.data[idx]; data2[idx + 1] = imgd.data[idx + 1];
          data2[idx + 2] = imgd.data[idx + 2]; data2[idx + 3] = imgd.data[idx + 3];
        }
      }
    }

    return { data: data2, width: w, height: h };
  }

  // ── Export ─────────────────────────────────────────────

  return {
    traceCanvas,
    traceCanvasToTracedata,
    presets,
    resolveOptions,
    getsvgstring,
  };
})();
