// V8.1: surum, ana menu baglantilari, SESLI YONERGE durumu (hazir/sorun/tekrar/cakisma), 8 gorevlik veri tabanli Enerji Macerasi (cozulebilirlik,
// yas bandi, simulasyon), tek tutarli ilerleme modeli (coin yalniz ilk kez), geriye uyumlu kimlik tasima, eski kayit uyumu. DOM: scripts/ui-v81.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { createVoice } from '../src/core/voice.js';
import { deriveProgress, starsFor, canPlay, describeCompletion, taskById } from '../src/games/adventure/model.js';
import { evaluateBoard, slotEdges, visibleTray, needLit } from '../src/games/adventure/circuit.js';
import { optionsFor } from '../src/games/adventure/identify.js';
import { scenesFor, sceneTruth } from '../src/games/adventure/judge.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const CFG = data.game.adventure;
const IDS = CFG.regions[0].tasks;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v) }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('V8.1+ surum: 8.1.x / versionCode >= 21 (>20) / com.altez.minilab.v4 korunur / APK adi ALTEZ-MiniLab-<tag>.apk (guncel surum tests/v811.test.js icinde sabitlenir)', () => {
  const env = rd('scripts/version.env');
  const g = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm'))[1];
  assert.match(g('VERSION_NAME_DEFAULT'), /^8\.\d+(\.\d+)?$/);
  assert.equal(g('RELEASE_TAG'), 'V' + g('VERSION_NAME_DEFAULT'));
  assert.ok(Number(g('VERSION_CODE_DEFAULT')) >= 21);
  assert.equal(g('APP_ID_DEFAULT'), 'com.altez.minilab.v4');
  assert.equal(g('APK_NAME_DEFAULT'), `ALTEZ-MiniLab-${g('RELEASE_TAG')}.apk`);
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionCode ${g('VERSION_CODE_DEFAULT')}\\b`));
  assert.match(rd('android/app/build.gradle'), /applicationId "com\.altez\.minilab\.v4"/);
  assert.equal(JSON.parse(rd('assets/data/app-version.json')).versionName, g('VERSION_NAME_DEFAULT'));
  assert.match(JSON.parse(rd('package.json')).version, /^8\.\d+\.\d+$/);
  assert.doesNotMatch(rd("android/app/src/main/AndroidManifest.xml"), /android:screenOrientation="sensorLandscape"/); // V8.2: uygulama geneli yatay kilit kalkti; oyun ekranlari kodla kilitlenir (orient.js)
});

test('V8.1 ana menu: acilis menuye gider (macera otomatik acilmaz); Oyna/Macera/Egitim/Ilerlemem/Ayarlar gercek rotalara baglanir; sahte "yakinda" dugmesi yok', () => {
  const app = rd('src/core/app.js');
  assert.match(app, /renderMainMenu/);
  assert.match(app, /#\/progress/);
  assert.match(app, /#\/settings/);
  assert.doesNotMatch(app, /replaceState\([^)]*#\/adventure/, 'soguk acilis macerayi dogrudan baslatmaz');
  const mm = rd('src/ui/mainmenu.js');
  for (const r of ["'#/adventure'", "'#/games'", "'#/progress'", "'#/settings'", "play?.('learn')"]) assert.ok(mm.includes(r), r);
  assert.doesNotMatch(mm, /soon|yakında|yakinda/i);
  const M = data.strings.mm;
  for (const k of ['play', 'adv', 'edu', 'prog', 'set']) assert.ok(M[k].t && M[k].d, k);
  assert.equal(M.adv.t, 'Enerji Macerası');
  assert.equal(data.strings.games['energy-adventure'].title, 'Enerji Soruları'); // eski oyun kartinin adi macera ile karismaz
});

function fakeWeb(behavior = 'end') {
  const calls = { speak: [], cancel: 0 };
  globalThis.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  globalThis.speechSynthesis = {
    speaking: false, pending: false, getVoices: () => [{ lang: 'tr-TR', name: 'Turkce', localService: true }], resume() {},
    cancel() { calls.cancel++; },
    speak(u) {
      calls.speak.push(u);
      if (behavior === 'silent') return;
      setTimeout(() => {
        if (behavior === 'error') return u.onerror?.({ error: 'synthesis-failed' });
        if (behavior === 'interrupted') return u.onerror?.({ error: 'interrupted' });
        u.onstart?.();
        setTimeout(() => u.onend?.(), 5);
      }, 5);
    }
  };
  return calls;
}
const cleanup = () => { delete globalThis.speechSynthesis; delete globalThis.SpeechSynthesisUtterance; delete globalThis.Capacitor; };

test('V8.1 ses durumu: konusma gercekten baslayinca ok; motor hata verirse problem (kod cagrisi basarili olsa bile "ok" sayilmaz)', async () => {
  fakeWeb('end');
  const v = createVoice({ strings: {}, enabled: true });
  assert.equal(v.status.state, 'unknown');
  const seen = [];
  v.onStatus((s) => seen.push(s.state));
  v.say('k', undefined, 'Merhaba');
  await sleep(120);
  assert.equal(v.status.state, 'ok');
  assert.equal(v.status.via, 'web');
  cleanup();
  fakeWeb('error');
  const v2 = createVoice({ strings: {}, enabled: true });
  v2.say('k', undefined, 'Merhaba');
  await sleep(150);
  assert.equal(v2.status.state, 'problem');
  assert.equal(v2.status.reason, 'synthesis-failed');
  cleanup();
  fakeWeb('interrupted'); // baska konusma kesti: hata DEGIL
  const v3 = createVoice({ strings: {}, enabled: true });
  v3.say('k', undefined, 'Merhaba');
  await sleep(120);
  assert.equal(v3.status.state, 'unknown');
  cleanup();
  const v4 = createVoice({ strings: {}, enabled: true }); // hic konusma motoru yok
  v4.say('k', undefined, 'Merhaba');
  await sleep(150);
  assert.equal(v4.status.state, 'problem');
  assert.equal(v4.status.reason, 'no-engine');
  assert.equal((await v4.ready()).ok, false);
});

test('V8.1 ses: tekrar dinle son satiri okur; ses kapaliyken konusmaz; yeni konusma eskisini keser (ust uste binme yok); ready() Turkce sesi bildirir', async () => {
  const calls = fakeWeb('end');
  const v = createVoice({ strings: {}, enabled: true });
  assert.equal(v.replay(), false, 'henuz satir yok');
  v.say('a', undefined, 'Birinci yonerge');
  await sleep(120);
  v.replay();
  await sleep(120);
  assert.deepEqual(calls.speak.map((u) => u.text), ['Birinci yonerge', 'Birinci yonerge']);
  assert.ok(calls.speak.every((u) => u.lang === 'tr-TR'));
  v.say('b', undefined, 'Ikinci');
  v.say('c', undefined, 'Ucuncu'); // 60 ms icinde ikinci cagri: ilki zamanlayicida iptal edilir, yalniz sonuncu konusulur
  await sleep(150);
  const texts = calls.speak.map((u) => u.text);
  assert.equal(texts.filter((t) => t === 'Ikinci').length, 0, 'eski yonerge ust uste binmedi');
  assert.equal(texts.at(-1), 'Ucuncu');
  const r = await v.ready();
  assert.equal(r.ok, true);
  assert.equal(r.reason, '');
  v.setEnabled(false);
  const n = calls.speak.length;
  v.say('d', undefined, 'Sessiz');
  assert.equal(v.replay(), false);
  await sleep(100);
  assert.equal(calls.speak.length, n, 'ses kapaliyken konusma yok');
  cleanup();
});

test('V8.1 ses: yerel (Capacitor) yolda Turkce desteklenmiyorsa ready() hata + neden bildirir', async () => {
  globalThis.Capacitor = { isNativePlatform: () => true, nativePromise: async (_p, m) => (m === 'isLanguageSupported' ? { supported: false } : {}), PluginHeaders: [{ name: 'TextToSpeech' }], getPlatform: () => 'android' };
  const v = createVoice({ strings: {}, enabled: true });
  const r = await v.ready();
  assert.deepEqual([r.ok, r.reason, r.via], [false, 'no-turkish', 'native']);
  cleanup();
});

// ---- Veri ve cozulebilirlik ----
const solvable = (task, band) => {
  const tray = visibleTray(task, band);
  const slots = slotEdges(task);
  const preset = task.board.preset || {};
  const need = needLit(task);
  const ids = tray.map((p) => p.id);
  let found = false;
  const rec = (i, placed) => {
    if (found) return;
    if (i === slots.length) {
      // V8.4: `need.resistor` gorevlerinde direncsiz yanma COZUM SAYILMAZ (LED'i direnc korur)
      for (const closed of [false, true]) {
        const ev = evaluateBoard(task, placed, closed);
        if (ev.litLamps >= need && (!task.need?.resistor || ev.hasResistor)) found = true;
      }
      return;
    }
    const used = new Set(Object.values(placed).filter(Boolean));
    rec(i + 1, { ...placed, [slots[i]]: null });
    for (const id of ids) if (!used.has(id)) rec(i + 1, { ...placed, [slots[i]]: id });
  };
  rec(0, Object.fromEntries(slots.map((e) => [e, null])));
  const start = Object.fromEntries(slots.map((e) => [e, preset[e] || null]));
  return { found, startsLit: evaluateBoard(task, start, false).litLamps >= need };
};

test('V8.1 8 gorev: sira/adlar dogru, kimlikler benzersiz, final bolge sonu, 8 gorev 1-3 yildiz/jeton; harita konumlari ekranda ve birbirinden uzak', () => {
  assert.deepEqual(IDS, ['tanis', 'ilk-isik', 'dedektif', 'kablo', 'anahtar', 'seri', 'hata', 'final']);
  assert.deepEqual(CFG.tasks.slice(0, 8).map((t) => t.title), ['Enerjiyle Tanış', 'İlk Işık', 'Devre Dedektifi', 'Kabloyu Bul', 'Anahtarın Gücü', 'Seri Devre', 'Hata Avcısı', 'Küçük Mucit Finali']);
  // V8.4: Pil ve Enerji bolgesi AYNEN korunur (8 gorev); yeni 'ev' bolgesi ve 'gunes' (yakinda) arkasindan gelir
  const PIL = CFG.tasks.filter((t) => IDS.includes(t.id));
  assert.equal(PIL.length, 8);
  assert.equal(new Set(CFG.tasks.map((t) => t.id)).size, CFG.tasks.length);
  assert.equal(CFG.regions[0].final, 'final');
  assert.equal(taskById(CFG, 'final').final, true);
  assert.equal(CFG.regions[0].unlocks, 'ev');
  assert.equal(CFG.regions.at(-1).soon, true);
  const pts = PIL.map((t) => t.map);
  for (const t of PIL) {
    assert.ok(Number.isInteger(t.coins) && t.coins >= 1 && t.say && t.title && t.icon, t.id);
    assert.ok(['circuit', 'identify', 'judge'].includes(t.kind), t.id);
    assert.ok(t.map.x > 40 && t.map.x < CFG.map.w - 40 && t.map.y > 40 && t.map.y < CFG.map.h - 40, t.id);
  }
  const all = [CFG.map.start, ...pts, CFG.map.gate];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y) >= 100, `${i}-${j} cok yakin`);
});

test('V8.1 devre gorevleri her iki yas bandinda COZULEBILIR; hicbiri baslangicta kendiliginden cozulmus degil', () => {
  for (const band of ['4-5', '6-8']) {
    for (const t of CFG.tasks.filter((x) => x.kind === 'circuit')) {
      const r = solvable(t, band);
      assert.equal(r.found, true, `${t.id} ${band} cozulemiyor`);
      assert.equal(r.startsLit, false, `${t.id} baslangicta cozulmus`);
    }
  }
  // 4-5: en fazla 3 parca secenegi tepsisinde (final haric: 4 parca gerekir), eksik parca/renk eslestirme basitligi
  for (const t of CFG.tasks.filter((x) => x.kind === 'circuit' && x.id !== 'final' && x.id !== 'ev-final')) assert.ok(visibleTray(t, '4-5').length <= 4, t.id);
  assert.ok(visibleTray(taskById(CFG, 'ilk-isik'), '4-5').length < visibleTray(taskById(CFG, 'ilk-isik'), '6-8').length, 'zor ek parca yalniz 6-8');
});

test('V8.1 devre simulasyonu: sabit parca/kopuk kablo/hazir yerlesim; seri devrede iki lamba; anahtar kapaliyken yanar; tas iletmez', () => {
  const kablo = taskById(CFG, 'kablo');
  const w = kablo.board.tray.find((p) => p.type === 'wire').id;
  const st = kablo.board.tray.find((p) => p.type === 'stone').id;
  assert.equal(evaluateBoard(kablo, { top: null }).lit, false);
  assert.equal(evaluateBoard(kablo, { top: w }).lit, true);
  assert.equal(evaluateBoard(kablo, { top: st }).lit, false);
  const hata = taskById(CFG, 'hata');
  assert.deepEqual(hata.board.preset, { top: 'p2' });
  assert.equal(evaluateBoard(hata, hata.board.preset).lit, false, 'tas takili: yanmaz');
  assert.equal(evaluateBoard(hata, { top: 'p1' }).lit, true, 'kablo takilinca yanar');
  const seri = taskById(CFG, 'seri');
  assert.equal(needLit(seri), 2);
  const L = seri.board.tray.filter((p) => p.type === 'lamp').map((p) => p.id);
  assert.equal(evaluateBoard(seri, { top: L[0], right: null }).litLamps, 0, 'yol acik: tek lamba yanmaz');
  assert.equal(evaluateBoard(seri, { top: L[0], right: L[1] }).litLamps, 2);
  const an = taskById(CFG, 'anahtar');
  const sw = an.board.tray.find((p) => p.type === 'switch').id;
  assert.equal(an.need.thenOpen, true);
  assert.equal(evaluateBoard(an, { top: sw }, false).lit, false);
  assert.equal(evaluateBoard(an, { top: sw }, true).lit, true);
  const fin = taskById(CFG, 'final');
  assert.equal(needLit(fin), 2);
  const [b, s2, l1, l2] = ['p1', 'p2', 'p3', 'p4'];
  assert.equal(evaluateBoard(fin, { left: b, top: s2, right: l1, bottom: l2 }, false).litLamps, 0);
  assert.equal(evaluateBoard(fin, { left: b, top: s2, right: l1, bottom: l2 }, true).litLamps, 2);
});

test('V8.1 tanisma: 4-5 yasta en fazla 3 secenek ve cevap her zaman icinde; 6-8 daha cok secenek; dedektif dogrusu simulasyondan', () => {
  const tn = taskById(CFG, 'tanis');
  assert.equal(tn.rounds.length, 3);
  for (const r of tn.rounds) {
    assert.ok(optionsFor(r, '4-5').length <= 3 && optionsFor(r, '4-5').includes(r.answer));
    assert.ok(optionsFor(r, '6-8').length > optionsFor(r, '4-5').length && optionsFor(r, '6-8').includes(r.answer));
    assert.ok(r.say && r.learn && r.hint);
  }
  const dd = taskById(CFG, 'dedektif');
  assert.deepEqual(dd.scenes.map((s) => (sceneTruth(s) ? 'kapali' : 'acik')), ['kapali', 'acik', 'acik', 'acik', 'kapali']);
  assert.equal(scenesFor(dd, '4-5').length, 3);
  assert.equal(scenesFor(dd, '6-8').length, 5);
  assert.ok(new Set(scenesFor(dd, '4-5').map((s) => sceneTruth(s))).size === 2, 'iki tur de var');
});

test('V8.1 metinler: Turkce, kisa, cevabi vermeyen basliklar; yanlis cevapta ceza degil ipucu; her gorevde sesli yonerge metni var', () => {
  for (const t of CFG.tasks) {
    assert.ok(t.say.length <= 80, t.id);
    assert.doesNotMatch(t.title, /doğru|yanlış/i);
    if (t.kind === 'circuit') assert.ok(t.hints?.start && t.hints?.insulator, t.id);
  }
  assert.match(CFG.text.tryAgain, /dene/i);
  assert.ok(CFG.text.replay === 'Tekrar dinle');
  assert.ok(CFG.text.voiceProblem && CFG.text.voiceNoTr && CFG.text.voiceOffNote);
  const idx = rd('src/games/adventure/index.js');
  assert.match(idx, /data-act="replay"/);
  assert.match(idx, /voice\.onStatus/);
  assert.match(idx, /\.ready\(\)/);
});

test('V8.1 ilerleme modeli: gorevler sirayla acilir (kilitliler oynanamaz), coin/yildiz kayittan turetilir, bolge finali sonraki bolgeyi acar', () => {
  assert.deepEqual(IDS.map((i) => deriveProgress({ tasks: {} }, CFG).nodes[i].state), ['open', ...Array(7).fill('locked')]);
  let adv = { tasks: {} };
  let coins = 0;
  IDS.forEach((id, i) => {
    const p = deriveProgress(adv, CFG);
    assert.equal(canPlay(p, id), true);
    if (i + 1 < IDS.length) assert.equal(canPlay(p, IDS[i + 1]), false);
    adv = { tasks: { ...adv.tasks, [id]: 3 } };
    coins += taskById(CFG, id).coins;
    assert.equal(deriveProgress(adv, CFG).coins, coins);
  });
  const done = deriveProgress(adv, CFG);
  assert.equal(done.regions[0].done, true);
  assert.equal(done.regions[1].unlocked, true);
  assert.equal(done.maxStars, CFG.tasks.length * 3); // V8.4: 15 gorev x 3 yildiz (8 Pil + 7 Evde Enerji)
  assert.equal(done.stars, 24); // yalniz Pil bolgesi bitti
  // bozuk kayit: atlayarak tamamlama sayilmaz
  const bad = deriveProgress({ tasks: { final: 3, seri: 3 } }, CFG);
  assert.equal(bad.coins, 0);
  assert.equal(bad.nodes.final.state, 'locked');
  assert.equal(starsFor(0, CFG.rewards), 3);
  assert.equal(starsFor(2, CFG.rewards), 2);
  assert.equal(starsFor(5, CFG.rewards), 1);
});

test('V8.1 coin yalniz ilk kez: tekrar oynayinca coin yok, yildiz yalniz artar; yeniden baslatmada korunur; yazma hatasinda odul yok', () => {
  const m = mem();
  const st = createStorage(m);
  const b = deriveProgress(st.getAdv(), CFG);
  let r = st.completeAdvTask('tanis', 2);
  assert.deepEqual([r.firstTime, r.saved], [true, true]);
  const a = deriveProgress(st.getAdv(), CFG);
  assert.equal(describeCompletion(b, a, 'tanis', CFG).coinGain, taskById(CFG, 'tanis').coins);
  r = st.completeAdvTask('tanis', 1);
  assert.deepEqual([r.firstTime, r.improved, st.getAdv().tasks.tanis], [false, false, 2]);
  r = st.completeAdvTask('tanis', 3);
  assert.deepEqual([r.firstTime, r.improved, st.getAdv().tasks.tanis], [false, true, 3]);
  assert.equal(describeCompletion(a, deriveProgress(st.getAdv(), CFG), 'tanis', CFG).coinGain, 0);
  assert.equal(deriveProgress(createStorage(m).getAdv(), CFG).coins, taskById(CFG, 'tanis').coins);
  const bad = createStorage({ getItem: () => null, setItem: () => { throw new Error('dolu'); } });
  assert.equal(bad.completeAdvTask('tanis', 3).saved, false);
  assert.deepEqual(bad.getAdv().tasks, {});
});

test('V8.1 geriye uyum: V8.0-proto1 gorev kimlikleri yeni kimliklere tasinir (yildiz korunur, tekrar coin yok); V7.9.1 kaydi aynen okunur', () => {
  const map = Object.fromEntries(CFG.tasks.filter((t) => t.legacy).map((t) => [t.legacy, t.id]));
  assert.deepEqual(map, { 'a1-pil-lamba': 'tanis', 'a2-pil-ne': 'ilk-isik', 'a3-lamba': 'dedektif', 'a4-biten-pil': 'kablo', 'a5-final': 'anahtar' });
  const m = mem();
  m.setItem('altez-minilab:v1', JSON.stringify({ band: '6-8', sound: true, seen: true, correct: 4, games: { 'energy-adventure': { correct: 2, done: ['e1'] } }, edu: { done: ['circuit-1'] }, adv: { intro: true, tasks: { 'a1-pil-lamba': 2, 'a2-pil-ne': 3, 'a3-lamba': 1 } } }));
  const st = createStorage(m);
  assert.equal(st.migrateAdvIds(map), 3);
  assert.deepEqual(st.getAdv().tasks, { tanis: 2, 'ilk-isik': 3, dedektif: 1 });
  assert.equal(st.migrateAdvIds(map), 0, 'ikinci cagri yazmaz');
  assert.equal(st.completeAdvTask('tanis', 2).firstTime, false, 'tasinan gorev tekrar coin vermez');
  assert.deepEqual([st.get().band, st.get().correct, st.get().games['energy-adventure'].done, st.get().edu.done], ['6-8', 4, ['e1'], ['circuit-1']]);
  const p = deriveProgress(st.getAdv(), CFG);
  assert.deepEqual(IDS.map((i) => p.nodes[i].state), ['done', 'done', 'done', 'open', 'locked', 'locked', 'locked', 'locked']);
  // eski (adv alani olmayan) V7.9.1 kaydi
  const m2 = mem();
  m2.setItem('altez-minilab:v1', JSON.stringify({ band: '4-5', sound: false, seen: true, games: { 'energy-adventure': { correct: 1, done: ['e1', 'e2'] } } }));
  const s2 = createStorage(m2);
  assert.equal(s2.migrateAdvIds(map), 0);
  assert.deepEqual(s2.getAdv(), { intro: false, tasks: {}, inv: [] }); // V8.4: `inv` (market envanteri) EKLEMELI alan
  assert.deepEqual(s2.get().games['energy-adventure'].done, ['e1', 'e2']);
  // yazma hatasinda tasima geri alinir
  let fail = false;
  const m3 = mem();
  m3.setItem('altez-minilab:v1', JSON.stringify({ seen: true, adv: { intro: true, tasks: { 'a1-pil-lamba': 3 } } }));
  const s3 = createStorage({ getItem: (k) => m3.getItem(k), setItem: (k, v) => { if (fail) throw new Error('dolu'); m3.setItem(k, v); } });
  fail = true;
  assert.equal(s3.migrateAdvIds(map), 0);
  assert.deepEqual(s3.getAdv().tasks, { 'a1-pil-lamba': 3 });
});

test('V8.1 baglanti: yeni dosyalar harici adres/bare import icermez; yeni ses/model dosyasi eklenmedi (yalniz mevcut voice + audio)', () => {
  for (const f of ['index', 'model', 'svg', 'circuit', 'choice', 'map', 'intro', 'identify', 'judge']) {
    const src = rd(`src/games/adventure/${f}.js`);
    assert.doesNotMatch(src, /https?:\/\//, f);
    assert.doesNotMatch(src, /^import .* from '[^./]/m, f);
  }
  const mm = rd('src/ui/mainmenu.js');
  assert.doesNotMatch(mm, /https?:\/\//);
  const man = JSON.parse(rd('assets/manifest.json'));
  assert.ok(!JSON.stringify(man).match(/piper|mms|xtts|\.onnx/i), 'yeni TTS modeli yok');
});

test('V8.1 kayit: bozuk adv alani temizlenir; gecersiz id/yildiz kaydedilmez; yildiz 1-3 araligina kisilir (V8.0 testi korundu)', () => {
  const m = mem();
  m.setItem('altez-minilab:v1', JSON.stringify({ seen: true, adv: { intro: 'x', tasks: { 'ok-1': 9, '../x': 2, bos: 'a' } } }));
  const s2 = createStorage(m);
  assert.deepEqual(s2.getAdv().tasks, { 'ok-1': 3 });
  assert.equal(s2.completeAdvTask('../x', 3).firstTime, false);
  assert.equal(s2.completeAdvTask('tanis', NaN).firstTime, false);
});
