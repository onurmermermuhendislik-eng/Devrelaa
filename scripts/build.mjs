// Statik paketleme: index.html + src + assets -> www/ (Capacitor webDir). Bagimlilik yok.
// Cevrimdisi guvencesi: dosyalarda harici http(s) adresi varsa derleme basarisiz olur.
import { cp, rm, mkdir, readdir, readFile } from 'node:fs/promises';
import { join, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const out = join(root, 'www');

async function* walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

// Kullaniciya gorunen surum scripts/version.env'den uretilir (tek kaynak)
import { genVersion } from './gen-version.mjs';
await genVersion(root);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const item of ['index.html', 'src', 'assets']) await cp(join(root, item), join(out, item), { recursive: true });

const bad = [];
for await (const f of walk(out)) {
  if (!['.html', '.js', '.css', '.json', '.svg'].includes(extname(f))) continue;
  const text = await readFile(f, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'<>)]+/g)) {
    if (m[0].startsWith('http://www.w3.org/2000/svg')) continue; // SVG ad alani, ag istegi degil
    bad.push(`${f.replace(out, 'www')}: ${m[0]}`);
  }
}
if (bad.length) {
  console.error('Harici adres bulundu (uygulama cevrimdisi/izlemesiz olmali):\n' + bad.join('\n'));
  process.exit(1);
}
let count = 0;
for await (const f of walk(out)) count++;
console.log(`www/ hazir (${count} dosya), harici adres yok.`);
