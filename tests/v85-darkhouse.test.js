// V8.5: Karanlik Ev Macerasi (ortak macera altyapisi) + ortak ORTAM SESI yoneticisi. Saf mantik/veri testleri; DOM akisi: scripts/ui-v85.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { deriveProgress, taskById, regionOf, canPlay, starsFor } from '../src/games/adventure/model.js';
import { evaluateBoard, slotEdges, visibleTray } from '../src/games/adventure/circuit.js';
import { createAmbience, SCENES } from '../src/core/ambience.js';
import { collectLines } from '../scripts/voice-lines.mjs';
import { lineKey } from '../src/core/voicekey.js';

const CFG = loadData().game.adventure;
const T = taskById(CFG, 'karanlik-ev');
const PIL = CFG.regions[0].tasks;
const EV = CFG.regions[1].tasks;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v) }; };

test('V8.5 veri: Karanlik Ev bolgesi Evde Enerji ile Gunes arasinda; tek final gorev; Pil (8) ve Ev (7) DEGISMEDI', () => {
  assert.deepEqual(CFG.regions.map((r) => r.id), ['pil', 'ev', 'karanlik', 'orman']);
  assert.equal(PIL.length, 8);
  assert.equal(EV.length, 7);
  assert.deepEqual(CFG.regions[2].tasks, ['karanlik-ev']);
  assert.equal(CFG.regions[2].final, 'karanlik-ev');
  assert.equal(T.kind, 'darkhouse');
  assert.equal(T.final, true);
  assert.ok(Number.isInteger(T.coins) && T.coins >= 1);
  assert.equal(regionOf(CFG, 'karanlik-ev'), 2);
  assert.equal(CFG.regions[3].soon, true);
});

test('V8.5 akis verisi: sinematik 3 alt yazi, gorev yonergesi, parcalar bulunabilir (pil+anahtar+lamba), tuzak parcalar yalniz 6-8 bandinda, her bulunan parca devre tepsisinde var', () => {
  assert.equal(T.scenes.length, 3);
  for (const s of T.scenes) assert.ok(s.learn.length > 5 && s.learn.length <= 140);
  assert.ok(T.say && T.win && T.next);
  const need = ['battery', 'switch', 'lamp'];
  for (const n of need) assert.ok(T.spots.some((s) => s.finds === n && !s.hard), `${n} bulunabilir (hard degil)`);
  assert.ok(T.spots.some((s) => !s.finds), 'ipucu noktasi (parca vermeyen) var');
  for (const s of T.spots) {
    assert.ok(s.say && s.label && s.icon && s.x > 5 && s.x < 95 && s.y > 5 && s.y < 95, s.id);
    if (s.finds) assert.ok(T.board.tray.some((p) => p.type === s.finds), `${s.id} -> tepside ${s.finds} var`);
  }
  assert.equal(new Set(T.spots.map((s) => s.id)).size, T.spots.length);
  const t45 = T.spots.filter((s) => !(s.hard && '4-5' === '4-5'));
  assert.ok(t45.length < T.spots.length, '4-5 bandinda dikkat dagitici (hard) nokta gizli');
  assert.ok(visibleTray(T, '4-5').every((p) => !p.hard));
  assert.ok(slotEdges(T).length === 3);
});

test('V8.5 devre: pil+anahtar+lamba, anahtar KAPALIYKEN yanmaz, kapaninca yanar; tas/yaprak iletmez; eksik parcada yanmaz', () => {
  const id = (type) => T.board.tray.find((p) => p.type === type).id;
  const set = { left: id('battery'), top: id('switch'), right: id('lamp') };
  assert.equal(evaluateBoard(T, set, false).lit, false, 'anahtar acik');
  const on = evaluateBoard(T, set, true);
  assert.equal(on.lit, true);
  assert.equal(on.full, true);
  assert.equal(evaluateBoard(T, { ...set, top: id('stone') }, true).lit, false, 'tas iletmez');
  assert.equal(evaluateBoard(T, { ...set, top: id('leaf') }, true).lit, false, 'yaprak iletmez');
  assert.equal(evaluateBoard(T, { left: id('battery'), top: id('switch'), right: null }, true).lit, false);
  assert.equal(evaluateBoard(T, { left: null, top: id('switch'), right: id('lamp') }, true).lit, false, 'pilsiz yanmaz');
});

test('V8.5 ilerleme/coin: kilitli -> Ev bitince acilir; coin YALNIZ ilk tamamlamada; tekrar coin yok; kayit kalici; bozuk kayit coin kazandirmaz', () => {
  const mm = mem();
  const st = createStorage(mm);
  assert.equal(canPlay(deriveProgress(st.getAdv(), CFG), 'karanlik-ev'), false);
  for (const id of [...PIL, ...EV]) assert.equal(st.completeAdvTask(id, 3).firstTime, true);
  const before = deriveProgress(st.getAdv(), CFG);
  assert.equal(before.nodes['karanlik-ev'].state, 'open');
  assert.equal(before.nextId, 'karanlik-ev');
  const r1 = st.completeAdvTask('karanlik-ev', starsFor(0, CFG.rewards));
  assert.deepEqual([r1.firstTime, r1.saved, r1.stars], [true, true, 3]);
  const after = deriveProgress(st.getAdv(), CFG);
  assert.equal(after.earned - before.earned, T.coins);
  assert.equal(after.coins - before.coins, T.coins);
  assert.equal(after.regions[2].done, true);
  assert.equal(after.regions[3].unlocked, true);
  // tekrar: coin yok
  for (const s of [1, 2, 3]) assert.equal(st.completeAdvTask('karanlik-ev', s).firstTime, false);
  assert.equal(deriveProgress(st.getAdv(), CFG).earned, after.earned);
  // yeniden yukleme (kalicilik)
  const st2 = createStorage(mm);
  assert.equal(deriveProgress(st2.getAdv(), CFG).earned, after.earned);
  assert.equal(st2.getAdv().tasks['karanlik-ev'], 3);
  // atlayarak/bozuk kayit
  const bad = deriveProgress({ tasks: { 'karanlik-ev': 3 } }, CFG);
  assert.equal(bad.coins, 0);
  assert.equal(bad.nodes['karanlik-ev'].state, 'locked');
});

test('V8.5 market uyumu: yeni coin ile market kurali degismez (6 ekipman = 27 coin, fazlasi bakiyede kalir)', () => {
  const st = createStorage(mem());
  for (const id of [...PIL, ...EV, 'karanlik-ev']) st.completeAdvTask(id, 1);
  assert.equal(deriveProgress(st.getAdv(), CFG).coins, 27 + T.coins);
  for (const it of CFG.market.items) assert.equal(st.buyItem(it.id).ok, true);
  const p = deriveProgress(st.getAdv(), CFG);
  assert.deepEqual([p.coins, p.spent, p.inv.length], [T.coins, 27, 6]);
});

test('V8.5 guvenlik: Karanlik Ev metinlerinde priz/sebeke/fis/220/yildirim/islak/cakmak yok; yalniz pil, anahtar, lamba', () => {
  const blob = JSON.stringify(T).toLowerCase();
  assert.doesNotMatch(blob, /priz|şebeke|sebeke|\bfiş|220|volt|yıldırım|ıslak|islak|çakmak|ates|ateş|kibrit/);
  assert.ok(T.spots.every((s) => !['outlet', 'plug', 'mains'].includes(s.finds)));
  assert.deepEqual([...new Set(T.board.tray.map((p) => p.type))].sort(), ['battery', 'lamp', 'leaf', 'stone', 'switch']);
});

test('V8.5 ses satirlari: tum Karanlik Ev cumleleri voice-lines envanterinde (MP3 uretilebilir); cakisma yok', async () => {
  const lines = await collectLines();
  const keys = new Set(lines.map((l) => l.key));
  for (const t of [T.say, T.win, T.next, ...T.scenes.map((s) => s.learn), ...T.spots.map((s) => s.say), ...Object.values(T.hints), CFG.regions[2].finalTitle]) assert.ok(keys.has(lineKey(t)), t);
  assert.equal(keys.size, lines.length);
});

// ---- Ortak ortam sesi yoneticisi ----------------------------------------------------------------------------------
function fakeEnv() {
  const log = { ctxs: 0, srcStart: 0, srcStop: 0, audio: [] };
  class Ctx {
    constructor() { log.ctxs++; this.sampleRate = 8000; this.currentTime = 0; this.state = 'running'; this.destination = {}; }
    createBuffer(c, n) { const d = new Float32Array(n); return { getChannelData: () => d }; }
    createBufferSource() { const s = { loop: false, connect: (x) => x, disconnect() {}, start() { log.srcStart++; }, stop() { log.srcStop++; } }; return s; }
    createBiquadFilter() { return { frequency: {}, connect: (x) => x }; }
    createGain() { return { gain: { value: 0, setTargetAtTime() {} }, connect: (x) => x }; }
    createOscillator() { return { frequency: {}, connect: (x) => x, start() {}, stop() {} }; }
    resume() { return Promise.resolve(); }
  }
  return { log, Ctx };
}
const tick = (ms = 260) => new Promise((r) => setTimeout(r, ms));

test('V8.5 ortam sesi: tek anda tek sahne, sahne degisince oncekini keser, bilinmeyen sahne SESSIZ (Caglayan korlemesine eklenmez), ses kapaliysa calmaz', async () => {
  const { log, Ctx } = fakeEnv();
  const a = createAmbience({ manifest: { ambience: {} }, enabled: true, AudioCtx: Ctx });
  // Bilincli degisiklik (V8.5 ses tasarimi): katalog diger maceralar icin TASARIM sahneleriyle (ready:false) genisledi.
  assert.deepEqual(Object.keys(SCENES), ['ev-gece', 'ev-isik', 'orman', 'orman-selale', 'mahalle', 'koy-dere', 'pompa', 'atolye']);
  assert.deepEqual(Object.keys(SCENES).filter((k) => SCENES[k].ready), ['ev-gece', 'ev-isik'], 'yalniz Karanlik Ev sahneleri hazir');
  assert.equal(a.play('yok-boyle-sahne'), null, 'katalogda olmayan sahne calmaz');
  assert.equal(a.state.playing, false);
  assert.equal(a.play('ev-gece'), 'synth');
  assert.equal(a.state.starts, 1);
  a.play('ev-gece');
  assert.equal(a.state.starts, 1, 'ayni sahne yeniden baslamaz');
  a.play('ev-isik');
  await tick();
  assert.equal(log.srcStart, 2);
  assert.equal(log.srcStop, 1, 'onceki sahne durduruldu');
  a.stop();
  await tick();
  assert.equal(log.srcStop, 2);
  assert.equal(a.state.playing, false);
  a.setEnabled(false);
  assert.equal(a.play('ev-gece'), null, 'ses kapaliyken calmaz');
  a.setEnabled(true);
  assert.equal(a.state.via, 'synth', 'ses acilinca istenen sahne baslar');
  a.setEnabled(false);
  await tick();
  assert.equal(a.state.playing, false);
});

test('V8.5 ortam sesi: manifest dosyasi verilirse dongu + kisik ses; dosya hatasinda sentez yedegi; Audio yoksa hata vermez', async () => {
  const { Ctx } = fakeEnv();
  const made = [];
  globalThis.Audio = class { constructor(u) { this.u = u; this.volume = 1; this.loop = false; this.l = {}; made.push(this); } addEventListener(e, f) { this.l[e] = f; } play() { return Promise.resolve(); } pause() { this.paused = true; } removeAttribute() {} load() {} };
  try {
    const a = createAmbience({ manifest: { ambience: { 'ev-gece': 'assets/sounds/ambience/ev-gece.mp3' } }, base: 'http://x/', AudioCtx: Ctx });
    assert.equal(a.play('ev-gece'), 'file');
    assert.equal(made[0].loop, true);
    assert.ok(made[0].volume > 0 && made[0].volume <= 0.5, 'ortam sesi sesli yonergeyi bastirmayacak kadar kisik');
    assert.match(made[0].u, /ev-gece\.mp3$/);
    made[0].l.error();
    assert.equal(a.state.via, 'synth', 'dosya bozuksa sentez');
    a.stop();
    assert.equal(a.state.playing, false);
  } finally {
    delete globalThis.Audio;
  }
  const b = createAmbience({ manifest: {}, AudioCtx: null });
  assert.doesNotThrow(() => b.play('ev-gece'));
  assert.equal(b.state.playing, false);
});

test('V8.5 yonlendirme/ortam: app.js her rotada ortam sesini keser; manifest.ambience yalniz katalogdaki sahneleri listeler', () => {
  const app = readFileSync(new URL('../src/core/app.js', import.meta.url), 'utf8');
  assert.match(app, /function route\(\) \{\n\s+ambience\.stop\(\);/);
  const man = JSON.parse(readFileSync(new URL('../assets/manifest.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(man.ambience).sort(), Object.keys(SCENES).sort());
});

// ---- Ortak sahne arac kutusu + arka plana gecme ----------------------------------------------------------------------
import { createSceneRuntime, idleHint } from '../src/games/adventure/scene-kit.js';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('V8.5 sahne arac kutusu: ses/maskot hatasi sahneyi bozmaz; zamanlayicilar destroy ile temizlenir; destroy sonrasi hicbir sey tetiklenmez', async () => {
  const calls = [];
  const rt = createSceneRuntime({
    audio: { play: () => { throw new Error('ses'); } },
    mascot: { react: () => { throw new Error('maskot'); } },
    speak: (t) => calls.push(['speak', t]),
    ambience: { play: (s) => calls.push(['amb', s]), stop: () => calls.push(['ambstop']) }
  });
  assert.doesNotThrow(() => { rt.play('tap'); rt.react('hint'); });
  const el = { textContent: '' };
  rt.say(el, 'Merhaba');
  assert.equal(el.textContent, 'Merhaba');
  rt.say(el, '');
  rt.ambience('ev-gece');
  let fired = 0;
  rt.later(() => { fired += 1; }, 15);
  rt.later(() => { throw new Error('zamanlayici hatasi'); }, 5);
  await sleep(40);
  assert.equal(fired, 1);
  rt.later(() => { fired += 10; }, 30);
  rt.destroy();
  await sleep(60);
  assert.equal(fired, 1, 'destroy sonrasi zamanlayici calismaz');
  assert.equal(rt.dead, true);
  assert.deepEqual(calls, [['speak', 'Merhaba'], ['amb', 'ev-gece'], ['ambstop']]);
});

test('V8.5 bosta kalma ipucu: sure dolunca tetiklenir, poke sayaci sifirlar, en fazla max kez, stop kapatir', async () => {
  const rt = createSceneRuntime({});
  const got = [];
  const h = idleHint(rt, 30, (n) => got.push(n), 2);
  await sleep(45);
  assert.deepEqual(got, [1]);
  h.poke();
  await sleep(20);
  assert.deepEqual(got, [1], 'poke sayaci basa aldi');
  await sleep(100);
  assert.deepEqual(got, [1, 1, 2], 'poke sonrasi yeniden saydi; max=2 asilmadi');
  await sleep(80);
  assert.equal(got.length, 3);
  const g2 = [];
  const h2 = idleHint(rt, 20, () => g2.push(1));
  h2.stop();
  await sleep(50);
  assert.equal(g2.length, 0);
  rt.destroy();
});

test('V8.5 ortam sesi + arka plan: gizlenince durur (sahne korunur), one gelince AYNI sahne tek ses olarak yeniden baslar; ses kapaliyken baslamaz; sahne durdurulduysa baslamaz', async () => {
  const { log, Ctx } = fakeEnv();
  const handlers = [];
  const doc = { visibilityState: 'visible', addEventListener: (e, f) => e === 'visibilitychange' && handlers.push(f), removeEventListener() {} };
  const prev = globalThis.document;
  globalThis.document = doc;
  try {
    const a = createAmbience({ manifest: {}, AudioCtx: Ctx });
    const vis = (v) => { doc.visibilityState = v; handlers.forEach((h) => h()); };
    a.play('ev-gece');
    assert.equal(a.state.playing, true);
    vis('hidden');
    await sleep(260);
    assert.equal(a.state.playing, false, 'arka planda sus');
    assert.equal(a.state.scene, 'ev-gece', 'sahne kimligi korunur');
    const s0 = log.srcStart;
    vis('visible');
    assert.equal(a.state.playing, true, 'one gelince yeniden basladi');
    assert.equal(log.srcStart, s0 + 1, 'tek kaynak');
    vis('visible');
    assert.equal(log.srcStart, s0 + 1, 'tekrar visible cift ses uretmez');
    a.setEnabled(false);
    vis('hidden'); vis('visible');
    assert.equal(a.state.playing, false, 'ses kapaliyken one gelince baslamaz');
    a.setEnabled(true);
    a.stop();
    vis('hidden'); vis('visible');
    assert.equal(a.state.playing, false, 'sahne durdurulduysa (rota degisti) geri gelince calmaz');
  } finally {
    if (prev === undefined) delete globalThis.document; else globalThis.document = prev;
  }
});
