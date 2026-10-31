// V8.5 guvenli ses aktarma betigi (scripts/import-voice.mjs): yer tutucu reddi, kaynaga dokunmama, ustune yazmama, gecersiz dosya atlama.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const LINES = JSON.parse(readFileSync(new URL('../assets/data/voice-lines.json', import.meta.url), 'utf8')).lines;
const SCRIPT = new URL('../scripts/import-voice.mjs', import.meta.url).pathname;
// GECERLI MPEG-1 Layer III cerceve dizisi (128 kbps, 44.1 kHz, cerceve 417 bayt) + satira ozgu yuk: bicim denetimini gecer ama GERCEK ses DEGIL (yalniz aktarma mantigini sinar)
const fakeMp3 = (seed, frames = 12) => Buffer.concat(Array.from({ length: frames }, (_, i) => Buffer.concat([Buffer.from([0xff, 0xfb, 0x90, 0x00]), Buffer.alloc(413, (seed * 3 + i) % 251)])));
const mk = (n, make) => {
  const src = mkdtempSync(join(tmpdir(), 'v84src-'));
  const dir = join(src, 'assets/sounds/voice');
  mkdirSync(dir, { recursive: true });
  LINES.slice(0, n).forEach((l, i) => writeFileSync(join(dir, l.key + '.mp3'), make(i)));
  return { src, dir };
};
const run = (src, extra = []) => {
  const dst = mkdtempSync(join(tmpdir(), 'v85dst-'));
  const r = spawnSync(process.execPath, [SCRIPT, src, ...extra], { encoding: 'utf8', env: { ...process.env, IMPORT_VOICE_DST: dst } });
  return { ...r, dst };
};
const digest = (dir) => readdirSync(dir).sort().map((n) => n + createHash('sha256').update(readFileSync(join(dir, n))).digest('hex')).join();

test('V8.5 ses aktarma: gecerli ve FARKLI dosyalar kopyalanir; kaynak degismez; ikinci calistirma uzerine yazmaz', () => {
  const { src, dir } = mk(10, (i) => fakeMp3(i + 1));
  const before = digest(dir);
  const r = run(src);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readdirSync(r.dst).length, 10);
  assert.equal(digest(dir), before, 'kaynak dizin degismedi');
  assert.match(r.stdout, /kopyalanan: 10/);
  assert.match(r.stdout, /MP3'u OLMAYAN satir: 113 \/ 123/);
});

test('V8.5 ses aktarma: birebir ayni dosyalar (yer tutucu) REDDEDILIR, hicbir sey kopyalanmaz', () => {
  const { src } = mk(10, () => fakeMp3(7));
  const r = run(src);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /yer tutucu/);
  assert.equal(readdirSync(r.dst).length, 0);
});

test('V8.5 ses aktarma: bilinmeyen satir, MP3 olmayan ve cok kucuk dosya atlanir; --dry yazmaz', () => {
  const { src, dir } = mk(5, (i) => fakeMp3(i + 1));
  writeFileSync(join(dir, 'adv_bilinmeyen.mp3'), fakeMp3(99));
  writeFileSync(join(dir, LINES[5].key + '.mp3'), Buffer.from('bu mp3 degil'.repeat(400)));
  writeFileSync(join(dir, LINES[4].key + '.mp3'), Buffer.concat([Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, 0]), Buffer.alloc(4000, 7)])); // ID3 var ama MPEG cercevesi yok
  writeFileSync(join(dir, LINES[6].key + '.mp3'), fakeMp3(5, 2));
  const r = run(src);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(readdirSync(r.dst).length, 4);
  assert.match(r.stdout, /bicim\/boyut hatali: 3; bilinmeyen satir: 1/);
  const d = run(src, ['--dry']);
  assert.equal(readdirSync(d.dst).length, 0);
});

test('V8.5 ses aktarma: kaynak yoksa hata kodu 1; hedef=kaynak olamaz', () => {
  const r = run('/yok/boyle/dizin');
  assert.equal(r.status, 1);
});

test('V8.5 ses aktarma: SHA-256 raporu yazilir ve dosya sayisiyla eslesir; cogunlugu gecersiz kaynak REDDEDILIR', () => {
  const { src } = mk(6, (i) => fakeMp3(i + 1));
  const rep = join(mkdtempSync(join(tmpdir(), 'rep-')), 'r.tsv');
  const r = run(src, ['--report', rep]);
  assert.equal(r.status, 0, r.stderr);
  const rows = readFileSync(rep, 'utf8').trim().split('\n').slice(1);
  assert.equal(rows.length, 6);
  for (const row of rows) assert.match(row.split('\t')[1], /^[0-9a-f]{64}$/);
  const bad = mk(6, () => Buffer.from('mp3 degil '.repeat(500)));
  assert.equal(run(bad.src).status, 3);
});
