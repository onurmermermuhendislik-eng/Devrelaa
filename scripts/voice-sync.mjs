// V8.4 Ses envanteri + manifest esitleme. assets/sounds/voice/*.mp3 dosyalarini DOGRULAR (MP3 baslik, boyut, sure) ve
//   1) assets/sounds/voice/VOICE-MANIFEST.json (dosya, anahtar, metin, bayt, sure, SHA-256) yazar,
//   2) assets/manifest.json > voice: dosyasi OLAN anahtarlari yola ayarlar; dosyasi olmayan adv_* girdilerini siler, sabit anahtarlari null yapar.
// Kullanim: node scripts/voice-sync.mjs [--check]   (--check: yazmaz; esitlenmemisse ya da bozuk dosya varsa cikis kodu 1)
// MP3 olmayan ya da cok buyuk dosya REDDEDILIR (uygulamaya girmez). Intro dosyasi (assets/sounds/intro-caglayan.mp3) bu betikle DEGISMEZ.
import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectLines } from './voice-lines.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const DIR = resolve(root, 'assets/sounds/voice');
const MAX_BYTES = 300 * 1024;
const MAX_SEC = 20;
const check = process.argv.includes('--check');

const isMp3 = (b) => b.length > 4 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));
function duration(p) {
  try {
    const o = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_name,sample_rate,bit_rate', '-of', 'json', p], { encoding: 'utf8' });
    const j = JSON.parse(o);
    return { sec: Math.round(Number(j.format.duration) * 100) / 100, codec: j.streams?.[0]?.codec_name || null, rate: Number(j.streams?.[0]?.sample_rate) || null, kbps: Math.round(Number(j.streams?.[0]?.bit_rate || 0) / 1000) || null };
  } catch {
    return { sec: null, codec: null, rate: null, kbps: null };
  }
}

const lines = await collectLines();
const byFile = new Map(lines.map((l) => [l.file.split('/').pop(), l]));
const names = (await readdir(DIR).catch(() => [])).filter((n) => n.endsWith('.mp3')).sort();
const files = [];
const problems = [];
for (const n of names) {
  const p = resolve(DIR, n);
  const buf = await readFile(p);
  const st = await stat(p);
  const line = byFile.get(n);
  if (!isMp3(buf)) problems.push(`${n}: MP3 degil`);
  if (st.size > MAX_BYTES) problems.push(`${n}: ${st.size} bayt > ${MAX_BYTES}`);
  if (!line) problems.push(`${n}: bilinen bir satira ait degil (adi metinden/anahtardan turetilmeli; once node scripts/voice-lines.mjs)`);
  const d = duration(p);
  if (d.sec != null && d.sec > MAX_SEC) problems.push(`${n}: ${d.sec} sn > ${MAX_SEC}`);
  files.push({ file: `assets/sounds/voice/${n}`, key: line?.key ?? null, text: line?.text ?? null, bytes: st.size, sha256: createHash('sha256').update(buf).digest('hex'), durationSec: d.sec, codec: d.codec, sampleRate: d.rate, kbps: d.kbps });
}
const total = files.reduce((n, f) => n + f.bytes, 0);
const missing = lines.filter((l) => !names.includes(l.file.split('/').pop())).map((l) => l.key);
const vm = JSON.stringify({ note: 'Uretilmis dosya: node scripts/voice-sync.mjs. Anlatici: CAGLAYAN (ElevenLabs). Cihazda duyulmadan "dogrulandi" sayilmaz.', lineCount: lines.length, fileCount: files.length, totalBytes: total, missingKeys: missing, files }, null, 2) + '\n';

const mp = resolve(root, 'assets/manifest.json');
const man = JSON.parse(await readFile(mp, 'utf8'));
const have = new Set(names);
const voice = {};
for (const [k, v] of Object.entries(man.voice || {})) {
  if (k.startsWith('adv_')) continue; // asagida yeniden uretilir
  const l = lines.find((x) => x.kind === 'named' && x.key === k);
  voice[k] = l && have.has(`${k}.mp3`) ? l.file : v && !/^assets\/sounds\/voice\//.test(v) ? v : null;
}
for (const l of lines) if (l.kind === 'adv' && have.has(`${l.key}.mp3`)) voice[l.key] = l.file;
const nextMan = JSON.stringify({ ...man, voice }, null, 2) + '\n';
const curMan = await readFile(mp, 'utf8');
const curVm = await readFile(resolve(DIR, 'VOICE-MANIFEST.json'), 'utf8').catch(() => '');

if (problems.length) console.error('SORUNLAR:\n  ' + problems.join('\n  '));
if (check) {
  const drift = curMan !== nextMan || curVm !== vm;
  if (drift) console.error('Ses manifesti esitlenmemis: node scripts/voice-sync.mjs');
  console.log(`ses dosyasi ${files.length}/${lines.length}, ${total} bayt`);
  process.exit(problems.length || drift ? 1 : 0);
}
await writeFile(resolve(DIR, 'VOICE-MANIFEST.json'), vm);
await writeFile(mp, nextMan);
console.log(`ses dosyasi ${files.length}/${lines.length} (${total} bayt); eksik ${missing.length}; manifest.voice dolu ${Object.values(voice).filter(Boolean).length}`);
process.exit(problems.length ? 1 : 0);
