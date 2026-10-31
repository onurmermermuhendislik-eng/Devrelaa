// V8.5 GUVENLI SES AKTARMA: baska bir surum dizinindeki (ornegin sunucudaki V8.4) Caglayan satir MP3'lerini BU projeye kopyalar.
//   node scripts/import-voice.mjs <kaynak-proje-dizini> [--dry] [--report <dosya.tsv>]
// Guvenlik (hepsi kod ile zorlanir):
//  - Kaynak dizine ASLA yazmaz/silmez/tasimaz (yalniz okur; once-sonra SHA-256 ozeti karsilastirilir). Var olan hedef dosyanin uzerine yazmaz.
//  - Yalniz bu projenin ses satirlarina (assets/data/voice-lines.json) ait anahtarlari kopyalar.
//  - GERCEK MP3 BICIMI: ID3v2 (varsa) atlanir, MPEG-1/2/2.5 Layer III cerceve basliklari cozulur ve en az 8 ardisik cerceve cerceve uzunluguna gore dogrulanir;
//    boyut 2 KB-300 KB; sure (cerceve sayisindan) 0.3-20 sn. Bicim bozuk dosya KOPYALANMAZ.
//  - YER TUTUCU: ayni SHA-256'ya sahip 3 veya daha fazla dosya (gercek seslendirmede her satir farklidir) ya da gecerli dosyalarin yarisindan
//    fazlasinin bicim hatasi/tekrari varsa HICBIR SEY kopyalanmaz (cikis 3).
//  - Kaynak ses klasoru yoksa acikca hata verir (cikis 1); ses uretmez, indirmez, ag kullanmaz.
// Cikti: kopyalanan dosya sayisi, her dosyanin SHA-256'si (--report ile TSV), hala MP3'u olmayan satir sayisi.
import { readFile, readdir, copyFile, access, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const args = process.argv.slice(2);
const srcArg = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--report');
const dry = args.includes('--dry');
const ri = args.indexOf('--report');
const reportPath = ri >= 0 ? args[ri + 1] : null;
if (!srcArg) { console.error('kullanim: node scripts/import-voice.mjs <kaynak-proje-dizini> [--dry] [--report <dosya.tsv>]'); process.exit(2); }
const SRC = resolve(srcArg, 'assets/sounds/voice');
const DST = process.env.IMPORT_VOICE_DST ? resolve(process.env.IMPORT_VOICE_DST) : resolve(root, 'assets/sounds/voice'); // IMPORT_VOICE_DST: yalniz testler icin
if (SRC === DST) { console.error('HATA: kaynak ve hedef ayni'); process.exit(2); }
const sha = (b) => createHash('sha256').update(b).digest('hex');
const MIN = 2000, MAX = 300 * 1024;

// MPEG ses cerceve cozucu (yalniz Layer III). Doner: { ok, frames, sec, sampleRate, kbps, reason }
const BR = { 1: [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320], 2: [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160] };
const SR = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
export function parseMp3(b) {
  let p = 0;
  if (b.length > 10 && b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) p = 10 + (((b[6] & 0x7f) << 21) | ((b[7] & 0x7f) << 14) | ((b[8] & 0x7f) << 7) | (b[9] & 0x7f));
  while (p + 4 < b.length && !(b[p] === 0xff && (b[p + 1] & 0xe0) === 0xe0)) { p++; if (p > 4096 + 10) return { ok: false, reason: 'cerceve esitleme bulunamadi' }; }
  let frames = 0, samples = 0, rate = 0, kbps = 0;
  while (p + 4 <= b.length) {
    const h = b.readUInt32BE(p);
    if (((h >>> 21) & 0x7ff) !== 0x7ff) break;
    const ver = (h >>> 19) & 3, layer = (h >>> 17) & 3, bri = (h >>> 12) & 15, sri = (h >>> 10) & 3, pad = (h >>> 9) & 1;
    if (ver === 1 || layer !== 1 || bri === 0 || bri === 15 || sri === 3) break; // Layer III ve gecerli indeksler
    const mpeg1 = ver === 3;
    const kb = BR[mpeg1 ? 1 : 2][bri], sr = SR[ver][sri];
    const len = Math.floor(((mpeg1 ? 144 : 72) * kb * 1000) / sr) + pad;
    if (len < 24 || p + len > b.length + 1) { if (p + len > b.length + 1) break; }
    frames++; samples += mpeg1 ? 1152 : 576; rate = sr; kbps = kb; p += len;
  }
  if (frames < 8) return { ok: false, reason: `yalniz ${frames} gecerli MPEG Layer III cercevesi` };
  return { ok: true, frames, sec: samples / rate, sampleRate: rate, kbps };
}

let names;
try { names = (await readdir(SRC)).filter((n) => n.endsWith('.mp3')).sort(); } catch { console.error('HATA: kaynak ses klasoru bulunamadi: ' + SRC + '\nSes dosyalari olmadan aktarma yapilmaz; ses uretilmez, yer tutucu konmaz.'); process.exit(1); }
const lines = JSON.parse(await readFile(join(root, 'assets/data/voice-lines.json'), 'utf8')).lines;
const known = new Map(lines.map((l) => [l.key + '.mp3', l]));
const digestDir = async () => { const h = createHash('sha256'); for (const n of (await readdir(SRC)).sort()) h.update(n + ':' + sha(await readFile(join(SRC, n)))); return h.digest('hex'); };
const before = await digestDir();

const cand = []; const skipped = { unknown: [], bad: [], exists: [] };
for (const n of names) {
  const b = await readFile(join(SRC, n));
  if (!known.has(n)) { skipped.unknown.push(n); continue; }
  const m = parseMp3(b);
  if (b.length < MIN || b.length > MAX) { skipped.bad.push(`${n}: boyut ${b.length}`); continue; }
  if (!m.ok) { skipped.bad.push(`${n}: ${m.reason}`); continue; }
  if (m.sec < 0.3 || m.sec > 20) { skipped.bad.push(`${n}: sure ${m.sec.toFixed(2)} sn`); continue; }
  cand.push({ n, hash: sha(b), bytes: b.length, sec: Math.round(m.sec * 100) / 100, kbps: m.kbps, sr: m.sampleRate });
}
const byHash = new Map();
for (const c of cand) byHash.set(c.hash, (byHash.get(c.hash) || 0) + 1);
const dupHash = [...byHash.entries()].find(([, k]) => k >= 3);
console.log(`kaynak: ${SRC}\nkaynakta MP3: ${names.length}; bu projenin satirina ait ve gecerli MPEG Layer III: ${cand.length}; bicim/boyut hatali: ${skipped.bad.length}; bilinmeyen satir: ${skipped.unknown.length}`);
if (dupHash) {
  console.error(`\nDURDU (hicbir dosya kopyalanmadi): ${dupHash[1]} dosya birebir AYNI SHA-256'ya sahip (${dupHash[0].slice(0, 16)}...). Bu GERCEK seslendirme degil, yer tutucu/test sesidir.`);
  process.exit(3);
}
if (names.length > 0 && cand.length < names.length / 2) {
  console.error(`\nDURDU (hicbir dosya kopyalanmadi): kaynak dosyalarin yarisindan fazlasi gecersiz (${cand.length}/${names.length}). Ornek: ${skipped.bad.slice(0, 3).join('; ')}`);
  process.exit(3);
}
if (!dry) await mkdir(DST, { recursive: true });
const done = [];
for (const c of cand) {
  const to = join(DST, c.n);
  if (await access(to).then(() => true, () => false)) { skipped.exists.push(c.n); continue; }
  if (!dry) await copyFile(join(SRC, c.n), to);
  done.push(c);
}
const after = await digestDir();
if (before !== after) { console.error('HATA: kaynak dizin degisti (beklenmiyordu)!'); process.exit(4); }
const have = new Set((await readdir(DST).catch(() => [])).filter((n) => n.endsWith('.mp3')));
const willHave = new Set([...have, ...(dry ? done.map((c) => c.n) : [])]);
const missing = lines.filter((l) => !willHave.has(l.key + '.mp3'));
console.log(`${dry ? '[--dry] kopyalanacak' : 'kopyalanan'}: ${done.length}; zaten var (atlandi): ${skipped.exists.length}`);
if (skipped.bad.length) console.log('  gecersiz (kopyalanmadi): ' + skipped.bad.slice(0, 8).join(' | ') + (skipped.bad.length > 8 ? ' ...' : ''));
console.log('kaynak dizin DEGISMEDI (SHA-256 ozeti ayni).');
const tsv = 'dosya\tsha256\tbayt\tsure_sn\tkbps\tornekleme\n' + done.map((c) => `${c.n}\t${c.hash}\t${c.bytes}\t${c.sec}\t${c.kbps}\t${c.sr}`).join('\n') + '\n';
if (reportPath) { await writeFile(resolve(reportPath), tsv); console.log(`SHA-256 raporu: ${resolve(reportPath)}`); }
else if (done.length) console.log('\n' + tsv.trimEnd());
console.log(`\nBu projede MP3'u OLMAYAN satir: ${missing.length} / ${lines.length}  (bunlar cihazda TTS'e duser; gercek seslendirme DEGILDIR)`);
if (missing.length) console.log('  eksik satir listesi: V8.5-DEV/YENI-SESLENDIRME-SATIRLARI.tsv (yeni 17) ');
console.log('Sonraki adim: node scripts/voice-sync.mjs   (dogrular + manifesti gunceller)');
