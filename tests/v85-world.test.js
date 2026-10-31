// V8.5 Baglantili macera dunyasi: asamalar, ekipman gereksinimi, kilitlenme olmamasi (soft-lock), market uyumu.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { worldStatus, worldStages, nextStage, canUseItem, ownedIds, deriveProgress, canBuy, itemById } from '../src/games/adventure/model.js';

const CFG = JSON.parse(fs.readFileSync(new URL('../assets/data/adventure.json', import.meta.url), 'utf8'));
const allTasks = () => Object.fromEntries(CFG.tasks.map((t) => [t.id, 3]));
const earnedBefore = (regionId) => {
  let n = 0;
  for (const r of CFG.regions) {
    if (r.id === regionId) break;
    for (const id of r.tasks) n += CFG.tasks.find((t) => t.id === id).coins;
  }
  return n;
};

test('V8.5 dunya: 5 asama sirali (1..5), yalniz Karanlik Ev oynanabilir; digerleri YAPIM ASAMASINDA (bitmis gibi sunulmaz)', () => {
  const st = worldStages(CFG);
  assert.deepEqual(st.map((s) => s.n), [1, 2, 3, 4, 5]);
  assert.deepEqual(st.map((s) => s.id), ['karanlik', 'orman', 'mahalle', 'koy', 'atolye']);
  assert.deepEqual(st.filter((s) => s.status === 'playable').map((s) => s.id), ['karanlik']);
  for (const s of st.filter((x) => x.status !== 'playable')) {
    assert.equal(s.status, 'soon');
    const reg = CFG.regions.find((r) => r.id === s.region);
    assert.ok(!reg || (reg.soon && reg.tasks.length === 0), `${s.id}: bolge yok ya da bos+soon`);
  }
  for (const s of st) assert.ok(s.title && s.learn, `${s.id} metin`);
});

test('V8.5 dunya: tum gereken ekipmanlar MEVCUT market katalogundan (ikinci market yok); her ekipmanin kullanimi tanimli', () => {
  const ids = new Set(CFG.market.items.map((i) => i.id));
  for (const s of worldStages(CFG)) for (const n of s.needs) assert.ok(ids.has(n), `${s.id} -> ${n}`);
  const stageIds = new Set(worldStages(CFG).map((s) => s.id));
  for (const it of CFG.market.items) {
    assert.ok(it.use && it.use.length > 3, `${it.id} ne ise yarar`);
    assert.ok(Array.isArray(it.usedIn) && it.usedIn.length >= 1, `${it.id} hangi gorevlerde`);
    for (const u of it.usedIn) assert.ok(stageIds.has(u), `${it.id} bilinmeyen asama ${u}`);
    // tutarlilik: "usedIn" ile asamanin "needs" listesi birbirini tutar (gereken ekipman, kullanildigi asamada listelenir)
  }
  for (const s of worldStages(CFG)) for (const n of s.needs) assert.ok(CFG.market.items.find((i) => i.id === n).usedIn.includes(s.id), `${n} ${s.id} asamasinda kullanilan olarak isaretli degil`);
  assert.equal(CFG.market.items.length, 6, 'V8.4 market katalogu korunur');
});

test('V8.5 dunya: Karanlik Ev UCRETSIZ baslangic (ekipman gerekmez); kilit sirasi', () => {
  const w0 = worldStatus({ tasks: {}, inv: [] }, CFG);
  assert.deepEqual(w0[0].needs, []);
  assert.equal(w0[0].state, 'locked', 'once Pil + Evde Enerji bolgeleri bitmeli');
  const doneBefore = Object.fromEntries([...CFG.regions[0].tasks, ...CFG.regions[1].tasks].map((i) => [i, 3]));
  const w1 = worldStatus({ tasks: doneBefore, inv: [] }, CFG);
  assert.equal(w1[0].state, 'open', 'ekipman almadan oynanabilir');
  assert.ok(w1.slice(1).every((s) => s.state === 'soon'));
  const w2 = worldStatus({ tasks: allTasks(), inv: [] }, CFG);
  assert.equal(w2[0].state, 'done');
  assert.ok(w2.slice(1).every((s) => s.state === 'soon'), 'sonraki asamalar oynanabilir GORUNMEZ');
});

test('V8.5 dunya: KILITLENME YOK — her asamanin gereken ekipmani, o asamadan ONCE kazanilabilir coinle alinabilir (kumulatif)', () => {
  const total = CFG.regions.flatMap((r) => r.tasks).reduce((n, id) => n + CFG.tasks.find((t) => t.id === id).coins, 0);
  let need = new Set();
  for (const s of worldStages(CFG)) {
    for (const n of s.needs) need.add(n);
    const price = [...need].reduce((n, id) => n + itemById(CFG, id).price, 0);
    const budget = s.region ? earnedBefore(s.region) : total; // bolgesi olmayan asamalar: kazanilabilir TUM coin
    assert.ok(price <= budget, `${s.id}: kumulatif gereken ${price} > kazanilabilir ${budget}`);
  }
  const all = CFG.market.items.reduce((n, i) => n + i.price, 0);
  assert.ok(all <= total, `butun market (${all}) kazanilabilir toplam coini (${total}) asmaz: hicbir ekipman erisilemez degil`);
  // simulasyon: tum gorevler bitti, hicbir sey alinmadi -> her ekipman alinabilir (sirayla hepsi)
  let adv = { tasks: allTasks(), inv: [] };
  for (const it of [...CFG.market.items].sort((a, b) => a.price - b.price)) {
    const bal = deriveProgress(adv, CFG).coins;
    assert.equal(canBuy(adv, CFG, it.id, bal).ok, true, `${it.id} alinamadi (bakiye ${bal})`);
    adv = { ...adv, inv: [...adv.inv, it.id] };
  }
  assert.equal(deriveProgress(adv, CFG).coins, total - all);
});

test('V8.5 dunya: sahip olunmayan ekipman KULLANILAMAZ; satin alinca kullanilir; bakiye dogru; tekrar alinamaz (sonsuz coin yok)', () => {
  let adv = { tasks: allTasks(), inv: [] };
  assert.equal(canUseItem(adv, CFG, 'pil-kutusu'), false);
  const bal0 = deriveProgress(adv, CFG).coins;
  assert.equal(canBuy(adv, CFG, 'pil-kutusu', bal0).ok, true);
  adv = { ...adv, inv: ['pil-kutusu'] };
  assert.equal(canUseItem(adv, CFG, 'pil-kutusu'), true);
  assert.deepEqual(ownedIds(adv, CFG), ['pil-kutusu']);
  assert.equal(deriveProgress(adv, CFG).coins, bal0 - 3);
  assert.equal(canBuy(adv, CFG, 'pil-kutusu', 99).reason, 'owned');
  assert.equal(canUseItem(adv, CFG, 'yok-boyle-ekipman'), false);
});

test('V8.5 dunya: gereken-ekipman gosterimi — eksikler ve toplam maliyet; sonraki asama', () => {
  const adv = { tasks: allTasks(), inv: ['pil-kutusu'] };
  const n = nextStage(adv, CFG);
  assert.equal(n.id, 'orman');
  assert.equal(n.state, 'soon');
  assert.deepEqual(n.missing.map((m) => m.id), ['led-seti']);
  assert.equal(n.missingCost, 6);
  assert.equal(n.needs.find((x) => x.id === 'pil-kutusu').owned, true);
  assert.equal(nextStage({ tasks: {}, inv: [] }, CFG).id, 'karanlik');
});

test('V8.5 dunya: bozuk kayit kilit/ekipman kazandirmaz (kilitli bolge gorevi sayilmaz; envanterde olmayan kimlik yok sayilir)', () => {
  const forged = { tasks: { 'karanlik-ev': 3 }, inv: ['hayali-esya'] };
  const w = worldStatus(forged, CFG);
  assert.equal(w[0].state, 'locked');
  assert.deepEqual(ownedIds(forged, CFG), []);
  assert.equal(deriveProgress(forged, CFG).earned, 0);
});
