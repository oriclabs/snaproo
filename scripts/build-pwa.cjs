// Build script: generates PWA from Chrome extension editor files
// Run: node scripts/build-pwa.cjs

const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'browser', 'chrome');
const DEST = path.join(__dirname, '..', 'website', 'pwa', 'app');
const OVERRIDES = path.join(__dirname, '..', 'website', 'pwa', 'overrides');

// Clean and create dest
if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true });
fs.mkdirSync(DEST, { recursive: true });
fs.mkdirSync(path.join(DEST, 'styles'), { recursive: true });
fs.mkdirSync(path.join(DEST, 'icons'), { recursive: true });
fs.mkdirSync(path.join(DEST, 'lib'), { recursive: true });

// Copy editor JS files
const editorFiles = fs.readdirSync(path.join(SRC, 'editor')).filter(f => f.endsWith('.js'));
for (const f of editorFiles) {
  fs.copyFileSync(path.join(SRC, 'editor', f), path.join(DEST, f));
}

// Copy styles
for (const f of fs.readdirSync(path.join(SRC, 'styles')).filter(f => f.endsWith('.css'))) {
  fs.copyFileSync(path.join(SRC, 'styles', f), path.join(DEST, 'styles', f));
}

// Copy libs
for (const f of fs.readdirSync(path.join(SRC, 'lib')).filter(f => f.endsWith('.js'))) {
  fs.copyFileSync(path.join(SRC, 'lib', f), path.join(DEST, 'lib', f));
}

// Copy shared
const sharedDir = path.join(SRC, 'shared');
if (fs.existsSync(sharedDir)) {
  fs.mkdirSync(path.join(DEST, 'shared'), { recursive: true });
  for (const f of fs.readdirSync(sharedDir).filter(f => f.endsWith('.js'))) {
    fs.copyFileSync(path.join(sharedDir, f), path.join(DEST, 'shared', f));
  }
}

// Copy icons
for (const f of ['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png']) {
  const src = path.join(SRC, 'icons', f);
  if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DEST, 'icons', f));
}

// Transform editor.html → index.html for PWA
let html = fs.readFileSync(path.join(SRC, 'editor', 'editor.html'), 'utf8');

// Fix paths: ../styles/ → styles/, ../lib/ → lib/, ../shared/ → shared/, ../icons/ → icons/
html = html.replace(/\.\.\/styles\//g, 'styles/');
html = html.replace(/\.\.\/lib\//g, 'lib/');
html = html.replace(/\.\.\/shared\//g, 'shared/');
html = html.replace(/\.\.\/icons\//g, 'icons/');

// Add PWA meta tags after <meta name="viewport">
html = html.replace(
  '<title>Snaproo</title>',
  `<title>Snaproo</title>
  <meta name="description" content="Snaproo — Free offline image toolkit. Snap. Render. Optimise. Output.">
  <meta name="theme-color" content="#F4C430">
  <link rel="manifest" href="../manifest.json">
  <link rel="apple-touch-icon" href="../icons/icon-192.png">
  <link rel="icon" type="image/svg+xml" href="icons/favicon.svg">`
);

// Add service worker registration before </body>
html = html.replace(
  '</body>',
  `<script>
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('../sw.js').catch(() => {});
  }
  </script>
</body>`
);

// Add viewport mobile fixes
html = html.replace(
  '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
  '<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">'
);

// Inject PWA mobile overrides (responsive.css + mobile.js)
if (fs.existsSync(OVERRIDES)) {
  const overrideCss = fs.readdirSync(OVERRIDES).filter(f => f.endsWith('.css'));
  const overrideJs = fs.readdirSync(OVERRIDES).filter(f => f.endsWith('.js'));

  // Copy override files to dest
  for (const f of overrideCss) {
    fs.copyFileSync(path.join(OVERRIDES, f), path.join(DEST, 'styles', f));
  }
  for (const f of overrideJs) {
    fs.copyFileSync(path.join(OVERRIDES, f), path.join(DEST, f));
  }

  // Inject CSS links before </head>
  if (overrideCss.length) {
    const cssLinks = overrideCss.map(f => `  <link rel="stylesheet" href="styles/${f}">`).join('\n');
    html = html.replace('</head>', `${cssLinks}\n</head>`);
  }

  // Inject JS scripts before </body> (after service worker)
  if (overrideJs.length) {
    const jsTags = overrideJs.map(f => `  <script src="${f}"></script>`).join('\n');
    html = html.replace('</body>', `${jsTags}\n</body>`);
  }
}

fs.writeFileSync(path.join(DEST, 'index.html'), html);

// Copy favicon
const favicon = path.join(__dirname, '..', 'website', 'docs', 'favicon.svg');
if (fs.existsSync(favicon)) fs.copyFileSync(favicon, path.join(DEST, 'icons', 'favicon.svg'));

// Minify if --minify flag passed
if (process.argv.includes('--minify')) {
  const { minify: terserMinify } = require('terser');
  const CleanCSS = require('clean-css');
  const { minify: htmlMinify } = require('html-minifier-terser');

  console.log('Minifying JS...');
  const jsFiles = fs.readdirSync(DEST).filter(f => f.endsWith('.js'));
  for (const f of jsFiles) {
    const fp = path.join(DEST, f);
    const code = fs.readFileSync(fp, 'utf8');
    terserMinify(code, { compress: { drop_console: false }, mangle: true })
      .then(r => { if (r.code) fs.writeFileSync(fp, r.code); });
  }
  // Also minify lib JS
  const libFiles = fs.readdirSync(path.join(DEST, 'lib')).filter(f => f.endsWith('.js'));
  for (const f of libFiles) {
    const fp = path.join(DEST, 'lib', f);
    const code = fs.readFileSync(fp, 'utf8');
    terserMinify(code, { compress: true, mangle: true })
      .then(r => { if (r.code) fs.writeFileSync(fp, r.code); });
  }
  // Shared JS
  const sharedPath = path.join(DEST, 'shared');
  if (fs.existsSync(sharedPath)) {
    for (const f of fs.readdirSync(sharedPath).filter(f => f.endsWith('.js'))) {
      const fp = path.join(sharedPath, f);
      const code = fs.readFileSync(fp, 'utf8');
      terserMinify(code, { compress: true, mangle: true })
        .then(r => { if (r.code) fs.writeFileSync(fp, r.code); });
    }
  }

  console.log('Minifying CSS...');
  const cssFiles = fs.readdirSync(path.join(DEST, 'styles')).filter(f => f.endsWith('.css'));
  for (const f of cssFiles) {
    const fp = path.join(DEST, 'styles', f);
    const code = fs.readFileSync(fp, 'utf8');
    const result = new CleanCSS({ level: 2 }).minify(code);
    if (result.styles) fs.writeFileSync(fp, result.styles);
  }

  console.log('Minifying HTML...');
  const indexPath = path.join(DEST, 'index.html');
  htmlMinify(fs.readFileSync(indexPath, 'utf8'), {
    collapseWhitespace: true,
    removeComments: true,
    minifyCSS: true,
    minifyJS: true,
  }).then(r => fs.writeFileSync(indexPath, r));

  // Wait for async terser
  setTimeout(() => {
    const totalSize = _dirSize(DEST);
    console.log(`PWA built (minified): ${(totalSize / 1024).toFixed(0)} KB total`);
  }, 2000);
} else {
  console.log(`PWA built to ${DEST} (unminified)`);
}

console.log(`Files: ${fs.readdirSync(DEST).length} root + ${editorFiles.length} JS`);

function _dirSize(dir) {
  let size = 0;
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, f.name);
    if (f.isDirectory()) size += _dirSize(fp);
    else size += fs.statSync(fp).size;
  }
  return size;
}
