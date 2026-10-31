// `npx cap add android` sonrasi calistirilir: marka ikonlarini Android projesine kopyalar.
//   node scripts/android-prep.mjs [--no-internet]
// --no-internet: AndroidManifest'ten INTERNET iznini kaldirir (uygulama tamamen cevrimdisi; test edilmemis sertlestirme).
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android/app/src/main/res');
if (!existsSync(RES)) {
  console.error('android/ yok. Once: npx cap add android');
  process.exit(1);
}
cpSync(join(ROOT, 'android-res'), RES, { recursive: true, filter: (s) => !s.endsWith('.png') || !s.includes('play-store') });
console.log('Ikonlar kopyalandi ->', RES);
// Android 11+ paket gorunurlugu: <queries> olmadan WebView/yerel TTS motoru bulunamaz ve sesli yonerge SESSIZ kalir.
{
  const mf = join(ROOT, 'android/app/src/main/AndroidManifest.xml');
  let x = readFileSync(mf, 'utf8');
  if (x.includes('android.intent.action.TTS_SERVICE')) console.log('TTS <queries> zaten var');
  else {
    const q = '    <queries>\n        <intent>\n            <action android:name="android.intent.action.TTS_SERVICE" />\n        </intent>\n    </queries>\n';
    x = x.replace(/(\s*)<application/, `\n${q}$1<application`);
    writeFileSync(mf, x);
    console.log('AndroidManifest: TTS_SERVICE <queries> eklendi');
  }
}
if (process.argv.includes('--no-internet')) {
  const mf = join(ROOT, 'android/app/src/main/AndroidManifest.xml');
  const x = readFileSync(mf, 'utf8');
  const y = x.replace(/\s*<uses-permission android:name="android.permission.INTERNET"\s*\/>/, '');
  writeFileSync(mf, y);
  console.log(x === y ? 'INTERNET izni bulunamadi (zaten yok)' : 'INTERNET izni kaldirildi');
}
