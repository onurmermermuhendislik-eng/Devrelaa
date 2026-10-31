// V7.9.1: surum (7.9.1 / 19), Maskot V2 (guvenli yerlesim, durumlar, hareket azaltma), Enerji Macerasi ilk dilim (Pil ve Enerji):
// veri dogrulugu, coin (yalniz ilk cozum, turetilmis, kayip/sinir/satin alma yok), eski kayit uyumu, ses/ag bagimliligi yok.
// DOM davranisi scripts/ui-v79.mjs icinde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { validateTask } from '../src/games/logic-science/logic.js';
import { tasksFor, MAX_OPTIONS_4_5, optionCount, progressOf } from '../src/core/taskkit.js';
import { coinsOf, coinValue, coinGain, coinsAvailable, MAX_COIN } from '../src/games/energy-adventure/coins.js';
import { choosePlacement, KINDS, mascotSvg, PLACE_SIZES, PLACE_COMPACT } from '../src/ui/mascot.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const EN = data.game['energy-adventure'];
const MSG = data.strings.mascot.messages;

test('surum tutarliligi (V7.9.1 -> V8.0): version.env, package.json/lock, build.gradle, VERSION.json/txt, app-version.json ayni surumde; applicationId korundu (guncel surum tests/v80.test.js icinde sabitlenir)', () => {
  const env = rd('scripts/version.env');
  const g = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm'))[1];
  const name = g('VERSION_NAME_DEFAULT');
  const code = g('VERSION_CODE_DEFAULT');
  assert.equal(g('APP_ID_DEFAULT'), 'com.altez.minilab.v4');
  assert.ok(Number(code) >= 19);
  const npmVer = name.split('.').length >= 3 ? name : name + '.0';
  assert.equal(JSON.parse(rd('package.json')).version, npmVer);
  const lock = JSON.parse(rd('package-lock.json'));
  assert.equal(lock.version, npmVer);
  assert.equal(lock.packages[''].version, npmVer);
  const esc = (x) => x.replace(/[.]/g, '\\.');
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionCode ${code}\\b`));
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionName "${esc(name)}"`));
  assert.match(rd('android/app/build.gradle'), /applicationId "com\.altez\.minilab\.v4"/);
  const vj = JSON.parse(rd('VERSION.json'));
  assert.equal(String(vj.versionCode), code);
  assert.equal(vj.versionName, name);
  assert.equal(vj.applicationId, 'com.altez.minilab.v4');
  assert.match(rd('VERSION.txt'), new RegExp(`${esc(name)} \\(versionCode ${code}\\)`));
  const av = JSON.parse(rd('assets/data/app-version.json'));
  assert.equal(av.versionName, name);
  assert.equal(String(av.versionCode), code);
  assert.equal(av.tag, g('RELEASE_TAG'));
});

test('V7.9 Maskot V2: yerlesim saf mantigi - bos kose secilir, cevap dugmeleri ortulmez, en kotu durumda balonsuz kucuk maskot', () => {
  const vp = { w: 320, h: 568 };
  const free = choosePlacement({ vp, blocked: [], bubble: { w: 150, h: 36 } });
  assert.equal(free.corner, 'bottom-left');
  assert.equal(free.size, PLACE_SIZES[0]);
  assert.equal(free.withBubble, true);
  assert.equal(free.safe, true);
  const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  // altta genis bir dugme: maskot baska yere (ya da kucuk) gider, dugmeyle KESISMEZ
  const btn = { l: 20, t: 440, r: 300, b: 540 };
  const p = choosePlacement({ vp, blocked: [btn], bubble: { w: 150, h: 36 } });
  assert.equal(p.safe, true);
  assert.equal(hits(p.union, btn), false);
  // her yer dolu: guvenli degil, en kucuk boyut, balonsuz (metin ekran okuyucuda kalir)
  const all = [{ l: 0, t: 0, r: 320, b: 568 }];
  const q = choosePlacement({ vp, blocked: all, bubble: { w: 150, h: 36 } });
  assert.equal(q.safe, false);
  assert.equal(q.size, PLACE_COMPACT);
  assert.equal(q.withBubble, false);
  // yatay ekran
  const l = choosePlacement({ vp: { w: 640, h: 360 }, blocked: [{ l: 150, t: 280, r: 490, b: 350 }], bubble: { w: 120, h: 34 } });
  assert.equal(l.safe, true);
  assert.equal(hits(l.union, { l: 150, t: 280, r: 490, b: 350 }), false);
  // her sonuc ekranin icinde
  for (const r of [free, p, q, l]) {
    assert.ok(r.union.l >= 0 && r.union.t >= 0, JSON.stringify(r.union));
  }
});

test('V7.9 duzeltme: yatay ekranda dort kose dolu olsa da kenar taramasi bos yer bulur (gorev bitis ekrani), dugmeyle KESISMEZ', () => {
  const hits = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
  // 640x360 bitis ekrani: sol-ust kapat, sag-ust ses, altta "Sonraki gorev" ve "Gorev listesi"; koseler dolu
  const blocked = [
    { l: 12, t: 6, r: 60, b: 54 }, { l: 580, t: 6, r: 628, b: 54 },
    { l: 251, t: 241, r: 389, b: 261 }, { l: 55, t: 267, r: 395, b: 323 }, { l: 407, t: 271, r: 585, b: 319 },
    { l: 66, t: 95, r: 270, b: 200 }, { l: 316, t: 68, r: 564, b: 222 }
  ];
  const p = choosePlacement({ vp: { w: 640, h: 360 }, blocked, bubble: { w: 150, h: 36 } });
  assert.equal(p.safe, true, JSON.stringify(p));
  for (const b of blocked) assert.equal(hits(p.union, b), false, JSON.stringify({ u: p.union, b }));
  assert.ok(p.union.l >= 0 && p.union.t >= 0 && p.union.r <= 640 && p.union.b <= 360);
  // sunucuda yazi biraz daha genis: "Gorev listesi" sag kenara 40px kala biter (eski surumde kose bu dugmeye biniyordu)
  const wide = blocked.map((b) => (b.l === 407 ? { ...b, r: 600 } : b));
  const q = choosePlacement({ vp: { w: 640, h: 360 }, blocked: wide, bubble: { w: 150, h: 36 } });
  assert.equal(q.safe, true);
  for (const b of wide) assert.equal(hits(q.union, b), false, JSON.stringify({ u: q.union, b }));
});

test('V7.9 Maskot V2: durumlar (karsilama, basari, tesvik, ipucu, kutlama, macera), yeni mesajlar kisa ve cesaretlendirici; yeni ses/model/harici kaynak YOK', () => {
  for (const k of ['greet', 'enter', 'correct', 'wrong', 'hint', 'done', 'adventure']) {
    assert.ok(KINDS[k], k);
    assert.ok(MSG[k]?.length >= 1, k);
    for (const t of MSG[k]) assert.ok(t.length >= 4 && t.length <= 40, `${k}: ${t}`);
  }
  for (const k of ['enter', 'correct', 'wrong', 'hint', 'done']) assert.ok(MSG[k].length >= 4, `${k}: cesitlilik icin 4+ cumle`);
  for (const t of MSG.wrong) assert.doesNotMatch(t, /yanl[ıi]ş yap(tın|tin)|kötü|berbat|aptal/i, t); // utandirma yok
  const svg = mascotSvg();
  for (const c of ['m-brow', 'm-happy', 'm-bulb', 'm-conf', 'm-blush', 'm-soft', '#ffd23f', '#38bdf8']) assert.ok(svg.includes(c), c);
  const src = rd('src/ui/mascot.js');
  assert.doesNotMatch(src, /new Audio|speechSynthesis|fetch\(|XMLHttpRequest|https?:\/\//);
  const mp3 = readdirSync(new URL('../assets/sounds', import.meta.url)).filter((n) => n !== 'voice'); // V8.4: voice/ = Caglayan satir MP3 klasoru (maskot dosya eklemez)
  assert.deepEqual([...mp3].sort(), ['intro-caglayan.mp3', 'minilab-jingle.mp3'], 'V8.3: yalniz kayitli giris sesi (intro-caglayan.mp3) eklendi, baska ses dosyasi yok');
  assert.equal(existsSync(new URL('../assets/voice', import.meta.url)), false, 'ses/konusma dosyasi eklenmedi');
});

test('V7.9 Maskot V2 CSS: hareket azaltmada animasyon+gecis kapali, durumlar animasyonsuz da gorunur; yalniz transform/opacity/translate/rotate; dokunma engellenmez', () => {
  const c = rd('src/ui/styles.css');
  const rm = c.slice(c.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.match(rm, /\.mascot \*[^{]*\{ animation: none !important/);
  assert.match(rm, /\.mascot, \.mascot \* \{ transition: none !important; \}/);
  assert.match(c, /\.mascot, \.mascot \* \{ pointer-events: none; \}/);
  assert.match(c, /\.mascot-dock \{ position: fixed; inset: 0; z-index: 60; pointer-events: none; \}/);
  assert.match(c, /\.mascot\[data-mood='think'\] \.m-bulb[^{]*\{ display: inline; \}/);
  const kf = c.match(/@keyframes m-(?:blink|bob|wave|hop|tilt|pulse|glowp|spark|fall) \{[^@]*?\n/g) || [];
  assert.ok(kf.length >= 9);
  for (const k of kf) assert.doesNotMatch(k, /\b(width|height|top|left|right|bottom|margin|padding|box-shadow|filter)\s*:/, k);
});

test('V7.9 Enerji Macerasi veri: Pil ve Enerji bolgesi gecerli, benzersiz, 4-5 yasta en fazla 3 secenek, cevabi veren baslik yok, kalan bolgeler Yakinda', () => {
  const ids = EN.tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 8);
  for (const t of EN.tasks) {
    assert.deepEqual(validateTask(t), [], t.id);
    assert.match(t.id, /^[\w-]{1,30}$/);
    assert.equal(t.region, 'pil');
    assert.ok(Number.isInteger(t.coins) && t.coins >= 1 && t.coins <= MAX_COIN, t.id);
    if (t.bands.includes('4-5')) assert.ok(optionCount(t) <= MAX_OPTIONS_4_5, t.id);
  }
  assert.equal(tasksFor(EN, '4-5').length, 6);
  assert.equal(tasksFor(EN, '6-8').length, 8);
  const open = EN.regions.filter((r) => r.status === 'open').map((r) => r.id);
  assert.deepEqual(open, ['pil']);
  assert.equal(EN.regions.length, 5, 'bes bolge gorunur; dort tanesi henuz Yakinda');
  assert.ok(EN.regions.filter((r) => r.status === 'soon').length === 4);
  // her gorevde dogru secenek + her yanlista ipucu (cezalandirici dil yok)
  for (const t of EN.tasks.filter((x) => x.options)) for (const o of t.options.filter((x) => !x.ok)) assert.doesNotMatch(o.hint, /yanl[ıi]ş|hata|kötü|olmaz!/i, t.id);
  assert.equal(data.strings.games['energy-adventure'].title, 'Enerji Soruları'); // V8.1: 'Enerji Macerası' adı yeni harita oyununa geçti
  assert.equal(data.manifest.gameData['energy-adventure'], 'assets/data/energy.json');
});

test('V7.9 coin: ilk cozumde kazanilir, tekrar cozumde ODUL YOK; turetilmis (ayri kayit alani yok); kayip/azalma yok; kayit yazilamazsa coin yok', () => {
  const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v) }; };
  const st = createStorage(mem());
  assert.equal(coinsOf(EN, st.getTasks('energy-adventure').done), 0);
  const t1 = EN.tasks[0];
  let r = st.completeTask('energy-adventure', t1.id);
  assert.equal(r.firstTime, true);
  assert.equal(coinGain(t1, r.firstTime, r.saved), coinValue(t1));
  assert.equal(coinsOf(EN, st.getTasks('energy-adventure').done), coinValue(t1));
  // ayni gorev tekrar: ilk degil -> kazanc 0, toplam ayni
  r = st.completeTask('energy-adventure', t1.id);
  assert.equal(r.firstTime, false);
  assert.equal(coinGain(t1, r.firstTime, r.saved), 0);
  assert.equal(coinsOf(EN, st.getTasks('energy-adventure').done), coinValue(t1));
  // 2 coinlik gorev
  const t8 = EN.tasks.find((t) => t.coins === 2);
  r = st.completeTask('energy-adventure', t8.id);
  assert.equal(coinGain(t8, r.firstTime, r.saved), 2);
  assert.equal(coinsOf(EN, st.getTasks('energy-adventure').done), coinValue(t1) + 2);
  // kayit alani semasi degismedi: yalniz correct + done
  const raw = JSON.parse(rd('src/core/storage.js') && JSON.stringify(st.get()));
  assert.deepEqual(Object.keys(raw.games['energy-adventure']).sort(), ['correct', 'done']);
  assert.equal(raw.coins, undefined);
  // yazma basarisiz: coin kazanci 0 ve bellekte gorev kayitli degil
  const bad = { getItem: () => null, setItem: () => { throw new Error('dolu'); } };
  const st2 = createStorage(bad);
  r = st2.completeTask('energy-adventure', t1.id);
  assert.equal(r.firstTime, false);
  assert.equal(r.saved, false);
  assert.equal(coinGain(t1, r.firstTime, r.saved), 0);
  assert.equal(coinsOf(EN, st2.getTasks('energy-adventure').done), 0);
  // coin azalmaz: coinsOf yalniz toplar; bilinmeyen/bozuk kimlikler sayiyi sisirmez
  assert.equal(coinsOf(EN, ['yok-boyle-gorev', 5, null]), 0);
  assert.equal(coinsOf(EN, null), 0);
  assert.equal(coinValue({ coins: 99 }), MAX_COIN);
  assert.equal(coinValue({}), 1);
  assert.ok(coinsAvailable(EN, '6-8') > coinsAvailable(EN, '4-5'));
});

test('V7.9 eski kayit uyumu: V7.8 kaydi (oyun/Egitim/gorev ilerlemesi) aynen okunur, Enerji Macerasi alani yoksa 0/8 ve 0 coin', () => {
  const old = { correct: 7, band: '6-8', sound: false, seen: true, games: { 'number-hunt': { correct: 9 }, detective: { correct: 2, done: ['d1-kayip-lamba', 'd2-eksik-parca'] }, 'logic-science': { correct: 1, done: ['l1-tohum'] } }, edu: { done: ['circuit-1', 'switch-1'] } };
  const m = new Map([['altez-minilab:v1', JSON.stringify(old)]]);
  const st = createStorage({ getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v) });
  assert.equal(st.get().band, '6-8');
  assert.deepEqual(st.getTasks('detective').done, ['d1-kayip-lamba', 'd2-eksik-parca']);
  assert.deepEqual(st.getTasks('logic-science').done, ['l1-tohum']);
  assert.deepEqual(st.getEdu().done, ['circuit-1', 'switch-1']);
  assert.deepEqual(st.getTasks('energy-adventure').done, []);
  assert.deepEqual(progressOf(tasksFor(EN, '6-8'), st.getTasks('energy-adventure').done), { done: 0, total: 8 });
  // yeni oyun eski kayitlari silmez
  st.completeTask('energy-adventure', 'e1-pil-ne');
  assert.deepEqual(st.getTasks('detective').done, ['d1-kayip-lamba', 'd2-eksik-parca']);
  assert.deepEqual(st.getEdu().done, ['circuit-1', 'switch-1']);
  assert.equal(st.get().games['number-hunt'].correct, 9);
});

test('V7.9 baglanti: Enerji Macerasi Oyunlar ekraninda kendi kartiyla; Gorevler hub ve "Cok yakinda" kartindan ayrildi; reklam/satin alma/enerji siniri yok', () => {
  const app = rd('src/core/app.js');
  assert.match(app, /import energyAdventure from '\.\.\/games\/energy-adventure\/index\.js'/);
  assert.match(app, /taskGames: \[\.\.\.subGames, energyAdventure\]/);
  assert.match(rd('src/games/tasks/subgames.js'), /subGames = \[detective, logicScience\]/, 'hub degismedi');
  assert.match(rd('src/ui/home.js'), /advLive/);
  const shell = rd('src/games/tasks/shell.js');
  for (const h of ['listTop', 'onList', 'onLeaveList', 'extras?.done']) assert.ok(shell.includes(h), h);
  // yasak ozellikler (kaynakta yok): reklam, satin alma, enerji siniri, coin kaybi
  const all = ['src/games/energy-adventure/index.js', 'src/games/energy-adventure/coins.js', 'assets/data/energy.json'].map(rd).join('\n');
  assert.doesNotMatch(all, /\b(ads?|admob|purchase|billing|iap|subscription|paywall|lives|stamina|cooldown|spend|deduct)\b/i);
  assert.doesNotMatch(all, /https?:\/\//);
  assert.doesNotMatch(rd('src/games/energy-adventure/coins.js'), /-=|\bMath\.max\(0,[^)]*-/, 'coin azaltma yok');
  // coin kayit semasina yeni alan eklemez
  assert.doesNotMatch(rd('src/core/storage.js'), /coins/);
  // soon.json Profil/Ebeveyn hala hazir degil
  const soon = data.game.soon.items;
  assert.equal(soon.find((i) => i.id === 'profile').enabled, false);
  assert.equal(soon.find((i) => i.id === 'parental').enabled, false);
});
