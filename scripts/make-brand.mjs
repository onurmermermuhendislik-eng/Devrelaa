// Marka varliklarini kaynak SVG'lerden uretir: logo-lockup.svg, ikon katmanlari ve Android launcher PNG'leri.
// Kaynaklar: assets/brand/logo-mark.svg, logo-wordmark.svg, logo-altez.svg (elle duzenlenir).
// Kullanim: node scripts/make-brand.mjs   (PNG icin Playwright gerekir; yoksa sadece SVG'ler uretilir)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const B = join(ROOT, 'assets/brand');
const inner = (f) => readFileSync(join(B, f), 'utf8').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const mark = inner('logo-mark.svg');
const word = inner('logo-wordmark.svg');
const altez = inner('logo-altez.svg');
const head = (vb, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}"${extra}>`;

// Dikey ana logo: simge + ALTEZ + MiniLab
writeFileSync(
  join(B, 'logo-lockup.svg'),
  head('0 0 304 262', ' role="img" aria-label="ALTEZ MiniLab"') +
    `<g transform="translate(77 0) scale(.75)">${mark}</g>` +
    `<g transform="translate(119 156) scale(.5)">${altez}</g>` +
    `<g transform="translate(0 180)">${word}</g></svg>\n`
);
// Android adaptive icon on katmani (108dp tuval, guvenli alan ortada)
writeFileSync(join(B, 'icon-foreground.svg'), head('0 0 108 108') + `<g transform="translate(24 24) scale(.3)">${mark}</g></svg>\n`);
// Eski cihazlar icin tam ikon (yuvarlak kose)
writeFileSync(
  join(B, 'icon-legacy.svg'),
  head('0 0 108 108') +
    '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#BFE3F6"/><stop offset="1" stop-color="#86C3EA"/></linearGradient></defs>' +
    '<rect width="108" height="108" rx="24" fill="url(#g)"/>' +
    `<g transform="translate(17 14) scale(.38)">${mark}</g></svg>\n`
);
console.log('SVG katmanlari uretildi');

const require = createRequire(import.meta.url);
let chromium;
for (const p of [process.env.PLAYWRIGHT_PATH, '/home/claude/.npm-global/lib/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try {
    ({ chromium } = require(p));
    break;
  } catch {
    /* sonrakini dene */
  }
}
if (!chromium) {
  console.log('Playwright yok: PNG uretilmedi');
  process.exit(0);
}

const DENS = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const OUT = join(ROOT, 'android-res');
const browser = await chromium.launch();
const page = await browser.newPage();
async function png(svgFile, px, out, bg = 'transparent') {
  const svg = readFileSync(join(B, svgFile), 'utf8');
  await page.setViewportSize({ width: px, height: px });
  await page.setContent(`<body style="margin:0;background:${bg}"><div style="width:${px}px;height:${px}px">${svg.replace('<svg ', `<svg width="${px}" height="${px}" `)}</div></body>`);
  mkdirSync(dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: px, height: px } });
}
for (const [d, k] of Object.entries(DENS)) {
  const dir = join(OUT, `mipmap-${d}`);
  await png('icon-legacy.svg', Math.round(48 * k), join(dir, 'ic_launcher.png'));
  await png('icon-legacy.svg', Math.round(48 * k), join(dir, 'ic_launcher_round.png'));
  await png('icon-foreground.svg', Math.round(108 * k), join(dir, 'ic_launcher_foreground.png'));
}
await png('icon-legacy.svg', 512, join(OUT, 'play-store-icon-512.png'));
await browser.close();
mkdirSync(join(OUT, 'mipmap-anydpi-v26'), { recursive: true });
const adaptive = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n    <background android:drawable="@color/ic_launcher_background"/>\n    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n</adaptive-icon>\n';
writeFileSync(join(OUT, 'mipmap-anydpi-v26/ic_launcher.xml'), adaptive);
writeFileSync(join(OUT, 'mipmap-anydpi-v26/ic_launcher_round.xml'), adaptive);
mkdirSync(join(OUT, 'values'), { recursive: true });
writeFileSync(join(OUT, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#A3D4F1</color>\n</resources>\n');
console.log('Android ikonlari: android-res/');
