// MiniLab acilis jingle'i: ozgun melodi, tamamen kod ile sentezlenir (ornek/kayit/telifli parca yok).
// Cikti: assets/sounds/minilab-jingle.mp3 (ffmpeg gerekir; sadece uretim icin, uygulama calisirken gerekmez).
// Kullanim: node scripts/make-jingle.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SR = 44100;
const LEN = 2.5; // sn
const L = new Float32Array(Math.ceil(SR * (LEN + 0.4)));
const R = new Float32Array(L.length);

const F = { C3: 130.81, G2: 98.0, E5: 659.25, G5: 783.99, C6: 1046.5, D6: 1174.66, E6: 1318.51, G6: 1567.98, C7: 2093.0, A5: 880.0 };

function add(t0, dur, pan, fn) {
  const i0 = Math.floor(t0 * SR);
  const n = Math.floor(dur * SR);
  const gl = Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n && i0 + i < L.length; i++) {
    const v = fn(i / SR);
    L[i0 + i] += v * gl;
    R[i0 + i] += v * gr;
  }
}
const sin = (f, t) => Math.sin(2 * Math.PI * f * t);
// Oyuncak "glockenspiel": kisa saldiri, hizli sonum, hafif uyumsuz kismi tonlar
const bell = (f, t0, dur, amp, pan = 0) =>
  add(t0, dur, pan, (t) => amp * Math.min(1, t / 0.004) * Math.exp(-t * 5.5 / Math.max(dur, 0.2) * 1.6) * (sin(f, t) + 0.32 * sin(f * 2.76, t) * Math.exp(-t * 14) + 0.12 * sin(f * 5.4, t) * Math.exp(-t * 25)));
// Hafif elektronik "pluck": tek tonlu kose dalga, hizli sonum
const pluck = (f, t0, dur, amp, pan = 0) =>
  add(t0, dur, pan, (t) => {
    const env = Math.min(1, t / 0.003) * Math.exp(-t * 9);
    const sq = sin(f, t) + sin(f * 3, t) / 3 + sin(f * 5, t) / 5;
    return amp * env * sq * 0.6;
  });
const bass = (f, t0, dur, amp) =>
  add(t0, dur, 0, (t) => amp * Math.min(1, t / 0.01) * Math.exp(-t * 2.2) * (sin(f, t) + 0.2 * sin(f * 2, t)));
const zap = (t0, dur, amp) =>
  add(t0, dur, 0, (t) => {
    const k = t / dur;
    const f = 280 * Math.pow(5, k);
    return amp * Math.sin(k * Math.PI) * sin(f, t);
  });

// Enerji "zip" -> kanca (Mi-Ni-Lab-da!) -> kisa inis -> parlak final akoru
zap(0.0, 0.2, 0.18);
const hook = [[F.E5, 0.2], [F.G5, 0.34], [F.C6, 0.48], [F.E6, 0.66]];
hook.forEach(([f, t], i) => {
  bell(f, t, i === 3 ? 0.55 : 0.3, 0.42, (i - 1.5) * 0.18);
  pluck(f / 2, t, 0.22, 0.2, 0);
});
bass(F.C3, 0.2, 0.7, 0.34);
[[F.D6, 1.08], [F.C6, 1.22], [F.G5, 1.36]].forEach(([f, t], i) => bell(f, t, 0.3, 0.3, 0.3 - i * 0.3));
// final: C majör, tatli ve acik
const tf = 1.55;
bass(F.C3, tf, 0.9, 0.36);
bass(F.G2, tf, 0.9, 0.2);
[F.C6, F.E6, F.G6].forEach((f, i) => bell(f, tf + i * 0.035, 0.9, 0.34, (i - 1) * 0.35));
pluck(F.C6, tf, 0.3, 0.12);
[F.G6, F.E6, F.C7].forEach((f, i) => bell(f, tf + 0.26 + i * 0.09, 0.5, 0.16, i % 2 ? -0.5 : 0.5));

// Normalize (tepe ~ -6 dBFS: rahatsiz etmez), son 120 ms yumusak kapanis
let peak = 0;
for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const gain = 0.5 / peak;
const total = Math.floor(SR * LEN);
const pcm = Buffer.alloc(44 + total * 4);
pcm.write('RIFF', 0); pcm.writeUInt32LE(36 + total * 4, 4); pcm.write('WAVEfmt ', 8);
pcm.writeUInt32LE(16, 16); pcm.writeUInt16LE(1, 20); pcm.writeUInt16LE(2, 22);
pcm.writeUInt32LE(SR, 24); pcm.writeUInt32LE(SR * 4, 28); pcm.writeUInt16LE(4, 32); pcm.writeUInt16LE(16, 34);
pcm.write('data', 36); pcm.writeUInt32LE(total * 4, 40);
for (let i = 0; i < total; i++) {
  const fade = Math.min(1, (total - i) / (SR * 0.12));
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain * fade)) * 32767), 44 + i * 4);
  pcm.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain * fade)) * 32767), 46 + i * 4);
}
mkdirSync(join(ROOT, 'assets/sounds'), { recursive: true });
const wav = join(ROOT, 'assets/sounds/.jingle-raw.wav');
writeFileSync(wav, pcm);
// Hafif yanki + MP3 (Android/iOS/Web'de ortak calar)
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-af', 'aecho=0.8:0.6:45|90:0.22|0.12,alimiter=limit=0.6', '-t', String(LEN), '-codec:a', 'libmp3lame', '-b:a', '112k', join(ROOT, 'assets/sounds/minilab-jingle.mp3')]);
execFileSync('rm', ['-f', wav]);
console.log('minilab-jingle.mp3 hazir', LEN, 'sn');
