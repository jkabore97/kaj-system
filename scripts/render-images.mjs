// Renders public/og-image.png and the PNG icons from og-image.html and
// public/favicon.svg with headless Chromium. Dev-only: the generated files
// are committed, so this is only needed when the logo or social card changes.
//
//   npm install --save-dev playwright   # one-time
//   npx playwright install chromium      # one-time
//   npm run render-images
//
// Or point CHROMIUM_PATH at an existing Chromium binary to skip the download.
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pub = path.join(root, 'public');

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  console.error('Playwright is not installed. Run:\n  npm install --save-dev playwright && npx playwright install chromium');
  process.exit(1);
}

const exe = process.env.CHROMIUM_PATH;
const browser = await chromium.launch(exe ? { executablePath: exe } : {});

const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await og.goto(pathToFileURL(path.join(root, 'og-image.html')).href, { waitUntil: 'networkidle' });
await og.evaluate(() => document.fonts.ready);
await og.screenshot({ path: path.join(pub, 'og-image.png') });

for (const [name, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['apple-touch-icon.png', 180]]) {
  const p = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await p.setContent(`<img src="${pathToFileURL(path.join(pub, 'favicon.svg')).href}" style="width:${size}px;height:${size}px;display:block">`, { waitUntil: 'load' });
  await p.screenshot({ path: path.join(pub, name), omitBackground: true });
}
await browser.close();
console.log('rendered public/og-image.png, public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png');
