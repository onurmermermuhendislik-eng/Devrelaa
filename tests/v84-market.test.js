// V8.4: gercek hayat gorevleri (Evde Enerji), LED/direnc devresi, coin bakiyesi (kazanilan - harcanan), Enerji Marketi + envanter (tek seferlik,
// atomik, kalici), guvenli egitim icerigi, ses satirlari/manifest/uretim betikleri, API anahtari yok. DOM: scripts/ui-v84.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { deriveProgress, canBuy, spentOf, ownedItems, itemById, regionOf, describeCompletion, taskById } from '../src/games/adventure/model.js';
import { evaluateBoard, slotEdges, visibleTray, needLit } from '../src/games/adventure/circuit.js';
import { lineKey, normalizeLine } from '../src/core/voicekey.js';
import { collectLines } from '../scripts/voice-lines.mjs';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const CFG = data.game.adventure;
const MK = CFG.market;
const PIL = CFG.regions[0].tasks;
const EV = CFG.regions[1].tasks;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => void m.set(k, v) }; };
const all3 = (ids) => Object.fromEntries(ids.map((i) => [i, 3]));
const sumCoins = (ids) => ids.reduce((n, i) => n + taskById(CFG, i).coins, 0);

test('V8.4 bolgeler: Pil (8, DEGISMEDI) -> Evde Enerji (7 gercek hayat gorevi) -> Gunes (yakinda); kimlikler benzersiz, siralama kolaydan zora', () => {
  // V8.5 (BILINCLI OZELLIK DEGISIKLIGI): Evde Enerji ile Gunes arasina 'karanlik' (Karanlik Ev Macerasi) bolgesi eklendi; Pil (8) ve Ev (7) AYNEN korunur.
  assert.deepEqual(CFG.regions.map((r) => r.id), ['pil', 'ev', 'karanlik', 'orman']);
  assert.equal(PIL.length, 8);
  assert.deepEqual(EV, ['fener', 'oda-lambasi', 'kablo-koruma', 'guvenlik', 'led-direnc', 'gece-lambasi', 'ev-final']);
  assert.equal(CFG.regions[0].unlocks, 'ev');
  assert.equal(CFG.regions[1].unlocks, 'karanlik');
  assert.equal(CFG.regions[2].unlocks, 'orman');
  assert.equal(CFG.regions[1].final, 'ev-final');
  assert.equal(CFG.regions[3].soon, true);
  assert.equal(new Set(CFG.tasks.map((t) => t.id)).size, 16); // 8 Pil + 7 Ev + 1 Karanlik Ev
  assert.equal(regionOf(CFG, 'fener'), 1);
  assert.equal(regionOf(CFG, 'final'), 0);
  // kolaydan zora: coin degerleri azalmaz, secmeliler once, devreler sonra, final en sonda
  const coins = EV.map((i) => taskById(CFG, i).coins);
  assert.deepEqual(coins, [...coins].sort((a, b) => a - b));
  assert.deepEqual(EV.map((i) => taskById(CFG, i).kind), ['choice', 'choice', 'choice', 'choice', 'circuit', 'circuit', 'circuit']);
  for (const id of EV) {
    const t = taskById(CFG, id);
    assert.ok(t.say.length <= 90 && t.title && t.icon && Number.isInteger(t.coins) && t.coins >= 1, id);
    assert.ok(t.map.x > 40 && t.map.x < CFG.regions[1].map.w - 40 && t.map.y > 40 && t.map.y < CFG.regions[1].map.h - 40, id);
  }
  const ev = CFG.regions[1].map;
  const pts = [ev.start, ...EV.map((i) => taskById(CFG, i).map), ev.gate];
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) assert.ok(Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y) >= 100, `${i}-${j} cok yakin`);
});

test('V8.4 secmeli gorevler: tek dogru cevap, ogretici aciklama + ipucu; GUVENLIK: priz/sebeke elektrigi asla dogru cevap degil, buyuge danisma vurgusu', () => {
  for (const id of EV.filter((i) => taskById(CFG, i).kind === 'choice')) {
    const t = taskById(CFG, id);
    assert.equal(t.options.length, 3, id);
    assert.equal(t.options.filter((o) => o.ok).length, 1, id);
    assert.ok(t.learn.length > 10 && t.hint.length > 5, id);
    for (const o of t.options.filter((x) => x.ok)) assert.doesNotMatch(o.text, /priz|uzatma|şebeke/i, `${id}: tehlikeli dogru cevap`);
  }
  const g = taskById(CFG, 'guvenlik');
  assert.equal(g.options.find((o) => o.ok).text, 'Küçük pil');
  assert.match(g.learn, /priz/i);
  assert.match(g.learn, /büyük/i);
  // hicbir gorev metni cocuga gercek sebeke elektrigiyle deney yaptirmaz
  for (const t of CFG.tasks) {
    const blob = JSON.stringify(t);
    assert.doesNotMatch(blob, /prize (tak|sok|dokun)|evde dene|kendin dene/i, t.id);
  }
});

test('V8.4 devre: LED lamba gibi yanar, direnc iletir, `need.resistor` gorevlerinde direncsiz yanma cozum sayilmaz; hepsi iki yas bandinda cozulebilir', () => {
  const solve = (task, band) => {
    const tray = visibleTray(task, band);
    const slots = slotEdges(task);
    const ids = tray.map((p) => p.id);
    let found = false;
    const rec = (i, placed) => {
      if (found) return;
      if (i === slots.length) {
        for (const closed of [false, true]) {
          const ev = evaluateBoard(task, placed, closed);
          if (ev.litLamps >= needLit(task) && (!task.need?.resistor || ev.hasResistor)) found = true;
        }
        return;
      }
      const used = new Set(Object.values(placed).filter(Boolean));
      rec(i + 1, { ...placed, [slots[i]]: null });
      for (const id of ids) if (!used.has(id)) rec(i + 1, { ...placed, [slots[i]]: id });
    };
    rec(0, Object.fromEntries(slots.map((e) => [e, null])));
    return found;
  };
  for (const id of ['led-direnc', 'gece-lambasi', 'ev-final']) for (const band of ['4-5', '6-8']) assert.equal(solve(taskById(CFG, id), band), true, `${id} ${band}`);
  const t = taskById(CFG, 'led-direnc');
  const id = (type) => t.board.tray.find((p) => p.type === type).id;
  // LED + direnc: yanar ve direnc var
  let ev = evaluateBoard(t, { top: id('led'), right: id('resistor') }, false);
  assert.deepEqual([ev.lit, ev.hasResistor], [true, true]);
  // LED + kablo (direnc atlandi): yanar AMA direnc yok -> gorev cozulmus sayilmaz
  ev = evaluateBoard(t, { top: id('led'), right: id('wire') }, false);
  assert.deepEqual([ev.lit, ev.hasResistor], [true, false]);
  // tas iletmez
  assert.equal(evaluateBoard(t, { top: id('led'), right: id('stone') }, false).lit, false);
  // baslangicta yanmiyor
  for (const x of ['led-direnc', 'gece-lambasi', 'ev-final']) assert.equal(evaluateBoard(taskById(CFG, x), {}, false).lit, false);
  assert.ok(CFG.text.parts.led && CFG.text.parts.resistor);
  assert.ok(taskById(CFG, 'gece-lambasi').hints.noResistor && taskById(CFG, 'led-direnc').hints.noResistor);
});

test('V8.4 coin bakiyesi: kazanilan (gorevlerden) - harcanan (sahip olunan ekipman fiyatlari); hic eksiye dusmez; ayri sayac YOK', () => {
  assert.equal(sumCoins(PIL), 15);
  assert.equal(sumCoins(EV), 12);
  let adv = { tasks: all3(PIL), inv: [] };
  let p = deriveProgress(adv, CFG);
  assert.deepEqual([p.coins, p.earned, p.spent], [15, 15, 0]);
  adv = { ...adv, inv: ['kablo-seti'] };
  p = deriveProgress(adv, CFG);
  assert.deepEqual([p.coins, p.earned, p.spent, p.inv], [11, 15, 4, ['kablo-seti']]);
  // bozuk kayit: gorev yokken envanter -> bakiye 0 (eksi degil), cokmez
  p = deriveProgress({ tasks: {}, inv: ['canta', 'led-seti'] }, CFG);
  assert.deepEqual([p.coins, p.earned], [0, 0]);
  // bilinmeyen ekipman kimligi harcama sayilmaz
  assert.equal(spentOf({ inv: ['yok-boyle-bir-sey'] }, CFG), 0);
  assert.equal(ownedItems({ inv: ['gozluk', 'yok'] }, CFG).length, 1);
  // gorev coin kazanci = kazanilan farki (satin alma sonucu degismez)
  const b = deriveProgress({ tasks: {}, inv: [] }, CFG);
  const a = deriveProgress({ tasks: { tanis: 3 }, inv: [] }, CFG);
  assert.equal(describeCompletion(b, a, 'tanis', CFG).coinGain, taskById(CFG, 'tanis').coins);
});

test('V8.4 market katalogu: sanal ekipman, tam sayi fiyat, benzersiz kimlik, fiyatlar gorev odulleriyle DENGELI (hepsi alinabilir, gereksiz kolay degil)', () => {
  assert.equal(MK.items.length, 6);
  assert.equal(new Set(MK.items.map((i) => i.id)).size, 6);
  for (const i of MK.items) {
    assert.ok(Number.isInteger(i.price) && i.price >= 1 && i.price <= 10, i.id);
    assert.ok(i.title && i.icon && i.desc, i.id);
    assert.match(i.id, /^[\w-]{1,30}$/);
  }
  const total = MK.items.reduce((n, i) => n + i.price, 0);
  const earnedAll = sumCoins(PIL) + sumCoins(EV);
  assert.ok(total <= earnedAll, 'tum ekipmanlar tum coinle alinabilmeli');
  assert.ok(total >= earnedAll - 3, 'fiyatlar odule gore cok dusuk degil (tamamlama gerekir)');
  // ilk bolge bitince en az iki ekipman alinabilir; hicbiri bolge baslamadan alinamaz
  const afterPil = deriveProgress({ tasks: all3(PIL), inv: [] }, CFG).coins;
  assert.ok(MK.items.filter((i) => i.price <= afterPil).length >= 2);
  assert.ok(MK.items.every((i) => i.price > 1));
  // gercek para / reklam / abonelik / can-enerji YOK
  const blob = JSON.stringify(MK.items) + JSON.stringify(MK.text); // `note` olumsuzlamayi ANLATIR (gercek para YOK), bu yuzden disarida
  assert.doesNotMatch(blob, /₺|\bTL\b|\$|€|reklam|abonelik|premium|billing/i);
  assert.doesNotMatch(rd('src/games/adventure/index.js'), /billing|purchase\(|Capacitor.*(iap|store)/i);
  assert.match(MK.note, /gercek para/i);
});

test('V8.4 satin alma karari: yetersiz coin reddedilir, sahip olunan tekrar alinamaz, bilinmeyen ekipman reddedilir', () => {
  const adv = { tasks: all3(PIL), inv: [] };
  assert.deepEqual(canBuy(adv, CFG, 'gozluk', 15), { ok: true, reason: '', need: 0 });
  assert.deepEqual(canBuy(adv, CFG, 'canta', 5), { ok: false, reason: 'poor', need: 2 });
  assert.deepEqual(canBuy({ inv: ['gozluk'] }, CFG, 'gozluk', 99), { ok: false, reason: 'owned', need: 0 });
  assert.equal(canBuy(adv, CFG, 'yok', 99).reason, 'unknown');
  assert.equal(itemById(CFG, 'canta').price, 7);
});

test('V8.4 envanter (storage): atomik tek seferlik satin alma, cift cagri tek kayit, yeniden baslatinca korunur, yazma hatasinda geri alinir', () => {
  const m = mem();
  let st = createStorage(m);
  for (const id of PIL) st.completeAdvTask(id, 3);
  let r = st.buyItem('kablo-seti');
  assert.deepEqual([r.ok, r.saved, r.owned], [true, true, true]);
  r = st.buyItem('kablo-seti'); // cift tiklama / eszamanli cagri
  assert.deepEqual([r.ok, r.owned], [false, true]);
  assert.deepEqual(st.getAdv().inv, ['kablo-seti']);
  assert.equal(deriveProgress(st.getAdv(), CFG).coins, 11, 'tek harcama');
  // yeniden baslatma
  st = createStorage(m);
  assert.deepEqual(st.getAdv().inv, ['kablo-seti']);
  const p = deriveProgress(st.getAdv(), CFG);
  assert.deepEqual([p.coins, p.earned, p.done], [11, 15, 8]);
  // yeni gorev coini envanteri bozmaz; envanter gorev ilerlemesini bozmaz
  st.completeAdvTask('fener', 2);
  assert.deepEqual(st.getAdv().inv, ['kablo-seti']);
  assert.equal(deriveProgress(st.getAdv(), CFG).coins, 12);
  assert.equal(st.getAdv().tasks.final, 3);
  // yazma hatasi: ekipman girmez, coin harcanmaz
  let fail = false;
  const flaky = { getItem: (k) => m.getItem(k), setItem: (k, v) => { if (fail) throw new Error('dolu'); m.setItem(k, v); } };
  const s2 = createStorage(flaky);
  fail = true;
  r = s2.buyItem('gozluk');
  assert.deepEqual([r.ok, r.saved], [false, false]);
  assert.deepEqual(s2.getAdv().inv, ['kablo-seti']);
  assert.equal(deriveProgress(s2.getAdv(), CFG).coins, 12);
  fail = false;
  assert.equal(s2.buyItem('gozluk').ok, true);
});

test('V8.4 kayit uyumu: eski kayit (inv yok) aynen okunur; bozuk inv temizlenir; tekrarlar atilir; en fazla 32; V8.3 kaydi bozulmaz', () => {
  const m = mem();
  m.setItem('altez-minilab:v1', JSON.stringify({ band: '6-8', sound: true, seen: true, correct: 3, adv: { intro: true, tasks: { tanis: 3, 'ilk-isik': 2 } } }));
  let st = createStorage(m);
  assert.deepEqual(st.getAdv(), { intro: true, tasks: { tanis: 3, 'ilk-isik': 2 }, inv: [] });
  assert.equal(deriveProgress(st.getAdv(), CFG).coins, 3);
  m.setItem('altez-minilab:v1', JSON.stringify({ adv: { tasks: { tanis: 3 }, inv: ['gozluk', 'gozluk', 7, null, '../x', 'a b', 'canta'] } }));
  st = createStorage(m);
  assert.deepEqual(st.getAdv().inv, ['gozluk', 'canta']);
  m.setItem('altez-minilab:v1', JSON.stringify({ adv: { inv: Array.from({ length: 40 }, (_, i) => 'e' + i) } }));
  assert.equal(createStorage(m).getAdv().inv.length, 32);
  m.setItem('altez-minilab:v1', JSON.stringify({ adv: { inv: 'bozuk' } }));
  assert.deepEqual(createStorage(m).getAdv().inv, []);
  // intro/gorev guncellemeleri envanteri silmez
  m.setItem('altez-minilab:v1', JSON.stringify({ adv: { tasks: { tanis: 3 }, inv: ['gozluk'] } }));
  st = createStorage(m);
  st.setAdvIntro(true);
  st.completeAdvTask('ilk-isik', 1);
  assert.deepEqual(st.getAdv().inv, ['gozluk']);
});

test('V8.4 tam akis: 15 gorev -> 27 coin -> 6 ekipmanin hepsi alinir, bakiye tam 0, yeniden alinamaz', () => {
  const st = createStorage(mem());
  for (const id of [...PIL, ...EV]) assert.equal(st.completeAdvTask(id, 1).firstTime, true);
  assert.equal(deriveProgress(st.getAdv(), CFG).coins, 27);
  for (const it of MK.items) {
    const p = deriveProgress(st.getAdv(), CFG);
    const d = canBuy(st.getAdv(), CFG, it.id, p.coins);
    assert.equal(d.ok, true, it.id);
    assert.equal(st.buyItem(it.id).ok, true);
  }
  const p = deriveProgress(st.getAdv(), CFG);
  assert.deepEqual([p.coins, p.spent, p.inv.length], [0, 27, 6]);
  for (const it of MK.items) assert.equal(canBuy(st.getAdv(), CFG, it.id, p.coins).reason, 'owned');
  assert.equal(st.getAdv().inv.length, 6);
});

test('V8.4 ses anahtari: kararli, bosluktan bagimsiz, metin degisince degisir; tum macera cumleleri envanterde, anahtar cakismasi yok', async () => {
  assert.equal(lineKey('Görev tamamlandı!'), lineKey('  Görev   tamamlandı! '));
  assert.notEqual(lineKey('Görev tamamlandı!'), lineKey('Görev tamamlandı.'));
  assert.match(lineKey('x'), /^adv_[0-9a-f]{8}$/);
  assert.equal(normalizeLine(' a \n b '), 'a b');
  const lines = await collectLines();
  const keys = lines.map((l) => l.key);
  assert.equal(new Set(keys).size, keys.length);
  // her gorevin yonergesi ve her ogretici cumle envanterde
  for (const t of CFG.tasks) {
    assert.ok(keys.includes(lineKey(t.say)), `${t.id}.say`);
    if (t.learn) assert.ok(keys.includes(lineKey(t.learn)), `${t.id}.learn`);
    if (t.win) assert.ok(keys.includes(lineKey(t.win)), `${t.id}.win`);
  }
  for (const k of ['say', 'sayBought', 'sayNo']) assert.ok(keys.includes(lineKey(MK.text[k])), k);
  assert.ok(keys.includes(lineKey(CFG.text.rewardTitle)) && keys.includes(lineKey(CFG.text.finalTitle)) && keys.includes(lineKey(CFG.regions[1].finalTitle)));
  // sabit yonergeler (manifest'te anahtari olanlar) adlariyla
  const named = lines.filter((l) => l.kind === 'named');
  assert.ok(named.length >= 10);
  for (const l of lines) assert.ok(l.text.length <= 140 && !/\{\w+\}/.test(l.text), l.key);
  // voice-lines.json guncel
  assert.equal(spawnSync(process.execPath, ['scripts/voice-lines.mjs', '--check'], { cwd: new URL('..', import.meta.url).pathname }).status, 0);
});

test('V8.4 ses dosyalari/manifest: manifest.voice yollari VAR olan dosyaya gider, voice/ icindeki her MP3 bilinen satira ait, VOICE-MANIFEST esitlenmis, intro DEGISMEDI', () => {
  const man = JSON.parse(rd('assets/manifest.json'));
  for (const [k, v] of Object.entries(man.voice)) if (v) assert.ok(existsSync(new URL('../' + v, import.meta.url)), `${k} -> ${v} yok`);
  assert.equal(man.sounds.introVoice, 'assets/sounds/intro-caglayan.mp3');
  const r = spawnSync(process.execPath, ['scripts/voice-sync.mjs', '--check'], { cwd: new URL('..', import.meta.url).pathname, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const vm = JSON.parse(rd('assets/sounds/voice/VOICE-MANIFEST.json'));
  assert.equal(vm.fileCount, readdirSync(new URL('../assets/sounds/voice', import.meta.url)).filter((n) => n.endsWith('.mp3')).length);
  for (const f of vm.files) assert.match(f.sha256, /^[0-9a-f]{64}$/);
});

test('V8.4 gizlilik/cevrimdisi: API anahtari uygulamada/APK kaynaginda YOK; uretici betik anahtari yalniz ortamdan okur; betikler www/ paketine girmez; ag istegi yok', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]));
  const root = new URL('..', import.meta.url).pathname;
  const app = [...walk(root + 'src'), ...walk(root + 'assets'), root + 'index.html'].filter((f) => /\.(js|json|html|css)$/.test(f));
  for (const f of app) {
    const t = readFileSync(f, 'utf8');
    assert.doesNotMatch(t, /xi-api-key|ELEVENLABS_API_KEY|api\.elevenlabs\.io|sk_[0-9a-f]{20,}/i, f);
  }
  const gen = rd('scripts/gen-voice-elevenlabs.mjs');
  assert.match(gen, /process\.env\.ELEVENLABS_API_KEY/);
  assert.doesNotMatch(gen, /sk_[0-9a-f]{20,}|xi-api-key['"]?\s*:\s*['"][0-9a-f]{16,}/);
  assert.match(rd('scripts/build.mjs'), /\['index\.html', 'src', 'assets'\]/);
  // yeni MP3 yalniz yerel dosya olarak calinir (voice.say Audio(path)); adventure kodunda fetch/XHR yok
  assert.doesNotMatch(rd('src/games/adventure/index.js'), /fetch\(|XMLHttpRequest|https?:\/\//);
});

test('V8.4 kaynak: konusma metne gore MP3 anahtari arar (yoksa TTS), pazar ekrani Geri/onay/cift-tik korumali, bolge gecisi var', () => {
  const idx = rd('src/games/adventure/index.js');
  assert.match(idx, /lineKey\(txt\)/);
  assert.match(idx, /data\.manifest\?\.voice\?\.\[key\] \? key : 'adv-task'/);
  assert.match(idx, /function showShop/);
  assert.match(idx, /if \(!id \|\| screen !== 'shop'\) return;/); // onaysiz/cift tiklama: hicbir sey
  assert.match(idx, /storage\.buyItem\(id\)/);
  assert.match(idx, /screen === 'shop'/); // Geri (handleBack) pazar ekranini bilir
  assert.match(idx, /data-act="region"|act === 'region'/);
  const choice = rd('src/games/adventure/choice.js');
  assert.match(choice, /speak\?\.\(/);
  assert.match(choice, /data-say/);
});
