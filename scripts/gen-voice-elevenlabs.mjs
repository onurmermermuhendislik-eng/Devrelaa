// V8.4 Caglayan MP3 uretici (GELISTIRICI ARACI; uygulamaya/APK'ya GIRMEZ: www/ yalniz index.html + src + assets kopyalar).
// ElevenLabs API anahtari YALNIZ ortam degiskeninden okunur (ELEVENLABS_API_KEY); depoya, koda, APK'ya yazilmaz.
//   ELEVENLABS_API_KEY=... node scripts/gen-voice-elevenlabs.mjs --dry            (ne uretilecegini listeler, ag istegi yok)
//   ELEVENLABS_API_KEY=... node scripts/gen-voice-elevenlabs.mjs --limit 3        (once 3 ornek: dinleyip onayla)
//   ELEVENLABS_API_KEY=... node scripts/gen-voice-elevenlabs.mjs                  (eksik olan TUM satirlar; var olani ATLAR)
//   ... --force  (var olan dosyalarin ustune yazar; intro-caglayan.mp3'e DOKUNMAZ)
// Sonra: node scripts/voice-lines.mjs && node scripts/voice-sync.mjs
// Ayarlar (ortam): ELEVEN_VOICE_ID (varsayilan CAGLAYAN), ELEVEN_MODEL (varsayilan eleven_multilingual_v2), ELEVEN_STABILITY, ELEVEN_SIMILARITY, ELEVEN_STYLE, ELEVEN_SPEED, ELEVEN_FORMAT.
// NOT: Anlatici tutarliligi icin intro-caglayan.mp3'u uretirken kullandigin modeli/ayarlari ELEVEN_* ile ver. Bu betik onu bilemez.
import { mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLines } from './voice-lines.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const arg = (n) => process.argv.includes(n);
const val = (n) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : null);
const VOICE = process.env.ELEVEN_VOICE_ID || 'sJ0xHHPzz1LOio4QNlB0'; // CAGLAYAN
const MODEL = process.env.ELEVEN_MODEL || 'eleven_multilingual_v2';
const FORMAT = process.env.ELEVEN_FORMAT || 'mp3_44100_96'; // intro-caglayan.mp3 = 44.1 kHz / 128 kbps; konusma satirlari icin 96 kbps yeterli ve kucuk (mp3_44100_128 da verilebilir)
const num = (e, d) => (process.env[e] != null && process.env[e] !== '' ? Number(process.env[e]) : d);
const settings = { stability: num('ELEVEN_STABILITY', 0.5), similarity_boost: num('ELEVEN_SIMILARITY', 0.75), style: num('ELEVEN_STYLE', 0), use_speaker_boost: true, speed: num('ELEVEN_SPEED', 1) };
const exists = (p) => access(p).then(() => true, () => false);

const lines = await collectLines();
const todo = [];
for (const l of lines) if (arg('--force') || !(await exists(resolve(root, l.file)))) todo.push(l);
const limit = val('--limit') ? Number(val('--limit')) : todo.length;
const batch = todo.slice(0, limit);
console.log(`toplam ${lines.length} satir, uretilecek ${batch.length} (voice=${VOICE}, model=${MODEL})`);
if (arg('--dry')) {
  for (const l of batch) console.log(`  ${l.file}  "${l.text}"`);
  process.exit(0);
}
const key = process.env.ELEVENLABS_API_KEY;
if (!key) {
  console.error('ELEVENLABS_API_KEY ortam degiskeni yok (anahtar koda/depoya YAZILMAZ). Ornek: ELEVENLABS_API_KEY=... node scripts/gen-voice-elevenlabs.mjs --limit 3');
  process.exit(2);
}
let ok = 0;
let fail = 0;
for (const l of batch) {
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE}?output_format=${FORMAT}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text: l.text, model_id: MODEL, language_code: 'tr', voice_settings: settings })
    });
    if (!r.ok) throw new Error(`HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length < 800) throw new Error(`cok kucuk yanit (${buf.length} bayt)`);
    const out = resolve(root, l.file);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buf);
    ok += 1;
    console.log(`ok   ${l.file} (${buf.length} bayt)`);
  } catch (e) {
    fail += 1;
    console.error(`HATA ${l.file}: ${e.message}`);
  }
}
console.log(`bitti: ${ok} uretildi, ${fail} hata. Sonra: node scripts/voice-sync.mjs`);
process.exit(fail ? 1 : 0);
