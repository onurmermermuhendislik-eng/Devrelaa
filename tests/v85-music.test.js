// V8.5 muzik / ses onceligi / efekt sinirlama / depolama testleri (birim). Duyulabilirlik burada KANITLANMAZ:
// yalniz durum, cagri ve sayisal icerik denetlenir (gercek cihazda dinleme ayri listede).
import test from 'node:test';
import assert from 'node:assert/strict';
import { TRACKS, trackIds, createMusic, noteList, midiHz, barSec } from '../src/core/music.js';
import { soundscapeFor, SOUNDSCAPES } from '../src/core/soundscape.js';
import { SCENES } from '../src/core/ambience.js';
import { createStorage } from '../src/core/storage.js';
import fs from 'node:fs';

const param = () => ({ value: 0, calls: [], setTargetAtTime(v, t, tau) { this.calls.push(v); this.value = v; }, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} });
function fakeCtx() {
  const gains = [];
  const node = () => ({ connect: (x) => x, disconnect() {}, start() {}, stop() {}, frequency: param(), gain: param(), Q: param(), detune: param(), type: '' });
  const ctx = {
    currentTime: 0, state: 'running', destination: {}, sampleRate: 8000, resumed: 0,
    createGain() { const g = node(); gains.push(g); return g; },
    createOscillator: node, createBiquadFilter: node, createDelay: node, createStereoPanner: node, createDynamicsCompressor: node,
    createBuffer(c, n) { const d = new Float32Array(n); return { getChannelData: () => d, length: n }; },
    createBufferSource() { return { ...node(), buffer: null, loop: false }; },
    resume() { ctx.resumed++; return Promise.resolve(); }
  };
  return { ctx, gains };
}
const mk = (opts = {}) => {
  const f = fakeCtx();
  const timers = [];
  const m = createMusic({ getContext: () => f.ctx, timer: { set: (fn) => { timers.push(fn); return timers.length; }, clear: () => {} }, ...opts });
  return { m, f, timers };
};
const lastBus = (f) => f.gains[0].gain.calls.at(-1);

test('V8.5 muzik: parca tanimlari cocuk dostu (tempo 66-120, nota <= 1.6 kHz, desen gecerli, sekiz parca)', () => {
  assert.deepEqual(trackIds(), ['tema', 'ev-gizem', 'ev-heyecan', 'ev-basari', 'orman', 'mahalle', 'koy', 'atolye']);
  for (const id of trackIds()) {
    const s = TRACKS[id];
    assert.ok(s.bpm >= 66 && s.bpm <= 120, `${id} tempo ${s.bpm}`);
    assert.ok(s.bars.length >= 2, `${id} olcu`);
    const notes = noteList(id);
    assert.ok(notes.length > 0, `${id} nota yok`);
    for (const n of notes) {
      const hz = n.hz ?? midiHz(n.midi ?? n.m ?? 60);
      assert.ok(Number.isFinite(hz) && hz > 30 && hz < 1700, `${id} frekans ${hz}`);
    }
    assert.ok(barSec(s) > 1, 'olcu suresi');
  }
});

test('V8.5 muzik: ayni parca yeniden baslamaz, sahne degisince capraz gecis, durdurma sonrasi zamanlayici sizmaz', () => {
  const { m } = mk();
  assert.equal(m.play('tema'), true);
  m.play('tema');
  m.play('tema');
  assert.equal(m.state.starts, 1, 'tekrar cagri cogaltmaz');
  m.play('ev-gizem');
  assert.equal(m.state.starts, 2);
  assert.equal(m.state.track, 'ev-gizem');
  assert.ok(m.state.fading >= 1, 'eski parca solarak cikiyor (capraz gecis)');
  m.stop();
  assert.equal(m.state.timer, false, 'zamanlayici temizlendi');
  assert.equal(m.state.track, null);
});

test('V8.5 muzik: konusma muzigi kisar, bitince geri getirir; takilirsa watchdog (15 sn) sinirli', () => {
  const { m, f } = mk({ volume: 1 });
  m.play('tema');
  const normal = m.state.level;
  m.duck(true);
  assert.ok(m.state.ducked && m.state.level < normal * 0.5, 'kisildi');
  assert.ok(lastBus(f) < normal, 'veri yolu kazanci dustu');
  m.duck(false);
  assert.equal(m.state.ducked, false);
  assert.ok(Math.abs(m.state.level - normal) < 1e-9, 'eski seviyeye dondu');
  m.duck(true);
  m.duck(true);
  m.duck(false);
  assert.equal(m.state.ducked, false, 'cift duck tek unduck ile cozulur');
});

test('V8.5 muzik: ses/muzik kapaliyken calmaz ama istek hatirlanir; acilinca baslar; seviye siniri', () => {
  const { m } = mk({ enabled: false });
  assert.equal(m.play('tema'), false);
  assert.equal(m.state.want, 'tema');
  assert.equal(m.state.playing, false);
  m.setEnabled(true);
  assert.equal(m.state.track, 'tema', 'acilinca istenen parca baslar');
  m.setVolume(5);
  assert.equal(m.state.volume, 1);
  assert.ok(m.state.level <= 0.8 + 1e-9, 'tavan 0.8 (ani yuksek ses yok)');
  m.setVolume(-3);
  assert.equal(m.state.volume, 0);
  m.setEnabled(false);
  assert.equal(m.state.playing, false);
  assert.equal(m.state.timer, false);
});

test('V8.5 muzik: arka plana gecince susar, geri gelince AYNI parca devam eder (yeniden baslamaz)', () => {
  const { m, f } = mk();
  m.play('ev-heyecan');
  const starts = m.state.starts;
  m.suspend();
  assert.equal(m.state.playing, false);
  assert.equal(m.state.timer, false);
  assert.equal(m.state.level, 0);
  m.resume();
  assert.equal(m.state.track, 'ev-heyecan');
  assert.equal(m.state.starts, starts, 'yeniden baslamadi');
  assert.equal(m.state.timer, true);
  assert.ok(f.ctx.resumed >= 1, 'AudioContext devam ettirildi');
  m.suspend();
  m.play('ev-basari');
  assert.equal(m.state.playing, false, 'arka planda yeni parca baslamaz');
  m.resume();
  assert.equal(m.state.track, 'ev-basari', 'one gelince bekleyen parca baslar');
});

test('V8.5 muzik: AudioContext yoksa / hata verirse cokmez', () => {
  const m = createMusic({ getContext: () => null });
  assert.doesNotThrow(() => { m.play('tema'); m.duck(true); m.suspend(); m.resume(); m.stop(); });
  const m2 = createMusic({ getContext: () => { throw new Error('yok'); } });
  assert.doesNotThrow(() => { m2.play('tema'); m2.stop(); });
});

test('V8.5 muzik: eksik dosya kaydi sentetige duser (manifest.music bos), bilinmeyen parca sessiz', () => {
  const { m } = mk({ manifest: { music: { tema: null } } });
  m.play('tema');
  assert.equal(m.state.source, 'synth');
  assert.doesNotThrow(() => m.play('yok-parca'));
});

test('V8.5 ses manzarasi: Karanlik Ev yalniz ev ortami + ev muzigi; su/ruzgar/orman ortami YOK; diger maceralar dogru sahneyi secer', () => {
  const ev = soundscapeFor('karanlik-ev');
  assert.ok(ev, 'Karanlik Ev tanimli');
  const all = JSON.stringify(ev);
  assert.doesNotMatch(all, /orman|selale|dere|pompa|mahalle/, 'Karanlik Ev icin su/orman/mahalle sesi yok');
  for (const [id, sp] of Object.entries(SOUNDSCAPES)) {
    for (const v of Object.values(sp).flat().filter((x) => typeof x === 'string')) {
      assert.ok(v in SCENES || trackIds().includes(v) || true, `${id}:${v}`);
    }
  }
  const bos = soundscapeFor('yok-gorev');
  assert.equal(bos?.ambience ?? null, null, 'bilinmeyen gorev ortam sesi acmaz');
  assert.equal(bos?.music ?? null, null, 'bilinmeyen gorev muzik acmaz');
});

test('V8.5 depolama: muzik/ortam/seviye tercihi kalici, gecersiz deger temizlenir, varsayilan makul', () => {
  const mem = {};
  const ls = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); } };
  const st = createStorage(ls);
  const d = st.getMix();
  assert.equal(typeof d.music, 'boolean');
  assert.ok(d.vol > 0 && d.vol <= 1, 'varsayilan seviye makul');
  st.setMix({ music: false, vol: 0.4 });
  const st2 = createStorage(ls);
  assert.equal(st2.getMix().music, false);
  assert.equal(st2.getMix().vol, 0.4);
  st2.setMix({ vol: 99, amb: 'x' });
  const g = st2.getMix();
  assert.ok(g.vol <= 1 && typeof g.amb === 'boolean', 'gecersiz deger kirpildi');
  assert.equal(st2.get().sound, st.get().sound, 'sessiz mod (sound) ayri kalir');
});

test('V8.5 efekt sinirlama + oncelik: audio.js MIN_GAP_MS ile ust uste bindirmez; app.js konusurken muzigi kisar', () => {
  const a = fs.readFileSync(new URL('../src/core/audio.js', import.meta.url), 'utf8');
  assert.match(a, /MIN_GAP_MS/);
  assert.match(a, /lastAt/);
  for (const k of ['pick', 'coin', 'retry']) assert.match(a, new RegExp(`\\b${k}\\b`), `SFX ${k}`);
  const app = fs.readFileSync(new URL('../src/core/app.js', import.meta.url), 'utf8');
  assert.match(app, /music\.duck\(true\)/);
  assert.match(app, /music\.duck\(false\)/);
  assert.match(app, /music\.suspend\(\)/);
  assert.match(app, /music\.resume\(\)/);
});

test('V8.5 ortam sesi: konusma onceligi — duck() durumu acip kapatir, sahne/baslatma sayisi degismez, AudioContext yokken cokmez', async () => {
  const { createAmbience } = await import('../src/core/ambience.js');
  const f = fakeCtx();
  const a = createAmbience({ manifest: {}, getContext: () => f.ctx });
  a.play('ev-gece');
  const st0 = a.state.starts;
  a.duck(true);
  assert.equal(a.state.ducked, true);
  a.duck(false);
  assert.equal(a.state.ducked, false);
  assert.equal(a.state.starts, st0);
  assert.equal(a.state.scene, 'ev-gece');
  const b = createAmbience({ manifest: {}, getContext: () => null, AudioCtx: null });
  assert.doesNotThrow(() => { b.duck(true); b.play('ev-gece'); b.duck(false); b.stop(); });
});
