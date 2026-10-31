// Kullaniciya gosterilen surum bilgisini TEK kaynaktan (scripts/version.env) uretir: assets/data/app-version.json.
// Elle yazilmis ikinci bir surum sistemi yoktur; build.mjs bunu her derlemede calistirir, preflight ve testler uyumu dogrular.
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

export function parseEnv(text) {
  const o = {};
  for (const l of text.split('\n')) {
    const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
    if (m) o[m[1]] = m[2].trim();
  }
  return o;
}

export function versionInfo(env) {
  return { versionName: env.VERSION_NAME_DEFAULT, versionCode: Number(env.VERSION_CODE_DEFAULT), tag: env.RELEASE_TAG };
}

export async function genVersion(dir = root) {
  const env = parseEnv(await readFile(resolve(dir, 'scripts/version.env'), 'utf8'));
  const info = versionInfo(env);
  if (!info.versionName || !Number.isInteger(info.versionCode)) throw new Error('version.env: VERSION_NAME_DEFAULT / VERSION_CODE_DEFAULT eksik');
  const text = JSON.stringify({ _note: 'scripts/version.env dosyasindan otomatik uretilir (scripts/gen-version.mjs); elle duzenlemeyin.', ...info }, null, 2) + '\n';
  await writeFile(resolve(dir, 'assets/data/app-version.json'), text);
  return info;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const i = await genVersion();
  console.log(`app-version.json: ${i.tag} (${i.versionName}, versionCode ${i.versionCode})`);
}
