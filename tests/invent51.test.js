// V5.1 sagIamlastirma: devre modeli, kesif dogrulugu, kayit guvenilirligi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { buildParts, analyze, hintFor, discoveriesIn, switchDiscovery, TOOLS, LOAD_MAX, loadOf, brightnessOf, pathsOf } from '../src/games/invent/logic.js';
import { createStorage } from '../src/core/storage.js';

const data = loadData();
const inv = data.game.invent;
const LOOP = inv.layouts.loop;
const LADDER = inv.layouts.ladder;
const an = (L, slots, st) => analyze(buildParts(L, slots, st));
const raw = (a) => Object.values(a.sim.leds);
const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

// ---- A. Pil, kablo, anahtar, LED ----
test('A: anahtar kapaliyken yanar, acilinca soner, tekrar kapaninca yeniden yanar; ekran seviyesi simulasyonla tutarli', () => {
  const slots = ['switch', 'led', 'wire'];
  const closed = an(LOOP, slots, { s1: 'closed' });
  const open = an(LOOP, slots, { s1: 'open' });
  const again = an(LOOP, slots, { s1: 'closed' });
  assert.equal(closed.lit, 1);
  assert.equal(open.lit, 0);
  assert.equal(open.closed, false);
  assert.equal(again.lit, 1);
  assert.deepEqual(again.sim.levels, closed.sim.levels);
  // ekrana giden seviye ile ham parlaklik tutarli: lit <=> ham > 0 <=> seviye > 0
  for (const a of [closed, open]) for (const [id, lv] of Object.entries(a.sim.levels)) assert.equal(lv > 0, a.sim.leds[id] > 0);
});

test('A: eksik kablo / acik devrede LED asla yanmaz (tum bos-konum kombinasyonlari)', () => {
  for (let mask = 0; mask < 8; mask++) {
    const slots = ['wire', 'led', 'wire'].map((t, i) => (mask & (1 << i) ? null : t));
    const a = an(LOOP, slots);
    if (mask !== 0) {
      assert.equal(a.closed, false, slots.join());
      assert.equal(a.lit, 0, slots.join());
    }
  }
});

test('A: tamamlanmayan devrede keşif verilmez (ilk isik/seri/paralel/direnc/kisa devre yok)', () => {
  for (const slots of [[null, 'led', 'wire'], ['wire', null, 'wire'], [null, null, null], ['switch', 'led', 'wire']]) {
    assert.deepEqual(discoveriesIn(an(LOOP, slots)), [], slots.join());
  }
  assert.deepEqual(discoveriesIn(an(LADDER, ['wire', 'wire', 'led', 'wire', null, 'led'])), []);
});

// ---- B. Direnc ve parlaklik ----
test('B: direnc devreye girince LED parlakligi dusurulur; daha cok direnc ASLA daha parlak degil (monoton)', () => {
  const none = an(LOOP, ['wire', 'led', 'wire']);
  const r1 = an(LOOP, ['resistor', 'led', 'wire']);
  const r2 = an(LOOP, ['resistor', 'led', 'resistor']);
  assert.ok(raw(r1)[0] < raw(none)[0], 'direnc parlakligi dusurmeli');
  assert.ok(raw(r2)[0] <= raw(r1)[0], 'iki direnc bir dirençten parlak olamaz');
  assert.ok(r1.sim.levels.s2 < none.sim.levels.s2, 'ekranda gorunur seviye dususu');
  // saf formul: yuk arttikca parlaklik hic artmaz
  let last = Infinity;
  for (let L = 0; L <= 6; L += 0.5) {
    const b = brightnessOf(L);
    assert.ok(b <= last + 1e-12);
    assert.ok(b > 0 && b <= 1);
    last = b;
  }
  assert.equal(loadOf([{ type: 'led' }, { type: 'resistor' }, { type: 'wire' }]), 1.5);
});

test('B: direnc kesfi yalnizca direnc YANAN LED ile ayni yoldaysa; LEDsiz direnc kolu kesif vermez', () => {
  assert.ok(discoveriesIn(an(LOOP, ['resistor', 'led', 'wire'])).includes('resistor'));
  // Merdiven: LED dis yolda, direnc yalniz ortadaki kolda (LED'in yolunda degil)
  const a = an(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', 'resistor']);
  assert.equal(a.lit, 1);
  assert.equal(discoveriesIn(a).includes('resistor'), false);
  // direnc var ama LED yanmiyorsa kesif yok
  assert.equal(discoveriesIn(an(LOOP, [null, 'led', 'resistor'])).includes('resistor'), false);
});

// ---- C. Seri devre ----
test('C: seri LEDler tek yolda paylasir: 1 > 2 > 3 LED parlaklik; seri kesfi yalnizca >=2 LED yanarken', () => {
  const one = raw(an(LOOP, ['wire', 'led', 'wire']))[0];
  const two = raw(an(LOOP, ['led', 'led', 'wire']))[0];
  const three = raw(an(LOOP, ['led', 'led', 'led']))[0];
  assert.ok(one > two && two > three && three > 0);
  assert.ok(discoveriesIn(an(LOOP, ['led', 'led', 'wire'])).includes('series'));
  assert.equal(discoveriesIn(an(LOOP, ['wire', 'led', 'wire'])).includes('series'), false);
  // iki LED var ama biri bos yuzunden yol acik: seri kesfi yok
  assert.equal(discoveriesIn(an(LOOP, ['led', 'led', null])).includes('series'), false);
});

test('C: pil yetmezse (yol yuku > 3) LEDler yanmaz, "weak" durumu, ipucu nazik; kesif verilmez', () => {
  assert.equal(LOAD_MAX, 3);
  const a = an(LADDER, ['led', 'led', 'led', 'led', 'led', null]); // dis yolda 5 LED seri
  assert.equal(a.closed, true);
  assert.equal(a.lit, 0);
  assert.equal(a.weak, true);
  assert.equal(hintFor(a).key, 'weak');
  assert.deepEqual(discoveriesIn(a), []);
  // sinirda: 3 LED yanar
  assert.equal(an(LOOP, ['led', 'led', 'led']).lit, 3);
  // yuk: 2 LED + 2 direnc = 3 -> yanar? (dis yol 4 parca: s1..s5 icinden 4 yerlestir)
  const edge = an(LADDER, ['led', 'led', 'resistor', 'resistor', 'wire', null]); // L = 2 + 1 = 3
  assert.equal(edge.lit, 2);
  const over = an(LADDER, ['led', 'led', 'resistor', 'resistor', 'resistor', null]); // L = 3.5
  assert.equal(over.lit, 0);
  assert.equal(over.weak, true);
});

// ---- D. Paralel devre ----
test('D: paralel kollar bagimsiz: bir kolun LEDi digerini etkilemez; iki kolda iki LED = paralel kesfi', () => {
  const both = an(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', 'led']);
  assert.equal(both.lit, 2);
  assert.ok(discoveriesIn(both).includes('parallel'));
  // paralel LEDler tek LED kadar parlak (seride paylasilmaz)
  const single = raw(an(LOOP, ['wire', 'led', 'wire']))[0];
  assert.ok(raw(both).every((b) => Math.abs(b - single) < 1e-9));
  // bir kolu bosalt: diger kol yine yanar, paralel kesfi artik yok
  const oneArm = an(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', null]);
  assert.equal(oneArm.lit, 1);
  assert.equal(discoveriesIn(oneArm).includes('parallel'), false);
});

test('D: YANLIS paralel kesfi verilmez: ayni yoldaki iki LED, ya da ortak parcadaki LED paralel degildir', () => {
  // iki LED ayni (dis) yolda, orta kol direncli: seri, paralel DEGIL
  const sameWay = an(LADDER, ['wire', 'led', 'led', 'wire', 'wire', 'resistor']);
  assert.equal(sameWay.lit, 2);
  assert.equal(discoveriesIn(sameWay).includes('parallel'), false);
  assert.ok(discoveriesIn(sameWay).includes('series'));
  // LED ortak kolda (s1) + orta kolda LED: ortak LED iki yolun ustunde
  const shared = an(LADDER, ['led', 'wire', 'wire', 'wire', 'wire', 'led']);
  assert.equal(discoveriesIn(shared).includes('parallel'), false);
});

test('D: topoloji gercek: iki yol (ladder) iki bagimsiz yol uretir, tek yol (loop) bir', () => {
  assert.equal(pathsOf(buildParts(LOOP, ['wire', 'led', 'wire'])).length, 1);
  assert.equal(pathsOf(buildParts(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', 'led'])).length, 2);
  assert.notEqual(LADDER.slots.length, LOOP.slots.length);
});

// ---- E. Kisa devre ----
test('E: kisa devre algilanir, hicbir LED yanmaz, sakin mesaj, hesap sonlanir (tum kombinasyonlar)', () => {
  const a = an(LOOP, ['wire', 'wire', 'wire']);
  assert.equal(a.short, true);
  assert.equal(a.lit, 0);
  assert.equal(hintFor(a).key, 'short');
  assert.ok(/oyun/i.test(inv.text.short), 'cocuk dostu aciklama: sadece bir oyun');
  assert.ok(discoveriesIn(a).includes('short'));
  // LEDi atlayan kablo kolu kisa devre yapar (fizik: LED yanmaz)
  assert.equal(an(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', 'wire']).lit, 0);
  // tum kombinasyonlar: hesap sonlanir, tutarlilik
  const opts = [null, ...TOOLS];
  const t0 = Date.now();
  for (const L of Object.values(inv.layouts)) {
    const n = L.slots.length;
    for (let k = 0; k < opts.length ** n; k++) {
      const slots = Array.from({ length: n }, (_, i) => opts[Math.floor(k / opts.length ** i) % opts.length]);
      for (const sw of ['open', 'closed']) {
        const a = an(L, slots, Object.fromEntries(L.slots.map((s) => [s.id, sw])));
        if (a.short) assert.equal(a.lit, 0);
        if (a.weak) assert.equal(a.lit, 0);
        if (a.lit > 0) assert.ok(a.closed && !a.short && !a.weak);
        // keşifler yalnizca kosul saglaninca
        const d = discoveriesIn(a);
        if (d.includes('light')) assert.ok(a.lit > 0);
        if (d.includes('series') || d.includes('parallel')) assert.ok(a.lit >= 2);
        if (d.includes('resistor')) assert.ok(a.lit > 0 && slots.includes('resistor'));
        if (d.includes('short')) assert.ok(a.short);
        // ham parlaklik asla 1'i asmaz, negatif olmaz
        for (const b of raw(a)) assert.ok(b >= 0 && b <= 1);
      }
    }
  }
  assert.ok(Date.now() - t0 < 5000, 'tum kombinasyonlar hizli sonlanmali');
});

test('E: anahtar kesfi yalnizca anahtar gercekten isigi degistirince', () => {
  const open = an(LOOP, ['switch', 'led', 'wire']);
  const closed = an(LOOP, ['switch', 'led', 'wire'], { s1: 'closed' });
  assert.equal(switchDiscovery(open, closed), true);
  assert.equal(switchDiscovery(open, open), false);
  // anahtar yolun ustunde degilse (merdiven orta kol, dis yol LEDli): acip kapatmak isigi degistirmez
  const o = an(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', 'switch'], { s6: 'open' });
  const c = an(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', 'switch'], { s6: 'closed' });
  assert.equal(o.lit, 1);
  assert.equal(c.short, true); // kapali anahtarli bos kol = LEDsiz yol -> kisa devre
  assert.equal(switchDiscovery(o, c), true); // isik gercekten degisti (yandi -> kisa devre ile soner)
});

// ---- 3. Alti kesif benzersiz sayilir, kalici ----
test('Kesifler: benzersiz sayilir (tekrar artirmaz), 0/6 baslar, yeniden acilista korunur', () => {
  const be = mem();
  const s = createStorage(be);
  assert.equal((s.getGame('invent').found || []).length, 0);
  const total = inv.discoveries.length;
  assert.equal(total, 6);
  for (const id of ['light', 'switch', 'resistor', 'series', 'parallel', 'short', 'light', 'switch']) {
    const f = new Set(s.getGame('invent').found || []);
    f.add(id);
    s.updateGame('invent', { correct: f.size, found: [...f] });
  }
  const t = createStorage(be);
  assert.equal(t.getGame('invent').found.length, 6);
  assert.equal(t.getGame('invent').correct, 6);
  assert.deepEqual([...new Set(t.getGame('invent').found)].sort(), inv.discoveries.map((d) => d.id).sort());
  // gecersiz kimlik atilir
  t.updateGame('invent', { found: ['light', 'hileli kesif!', 'light'] });
  assert.deepEqual(createStorage(be).getGame('invent').found, ['light']);
});

// ---- 4. Kayit guvenilirligi ----
test('Kayit: en fazla 6 buluş saklanir; bozuk girdiler cokmeden ayiklanir; v alani eklenir', () => {
  const be = mem();
  const s = createStorage(be);
  const mk = (i) => ({ layout: 'loop', slots: ['wire', 'led', i % 2 ? 'wire' : 'resistor'], sw: ['open', 'open', 'open'] });
  s.updateGame('invent', { correct: 0, saved: Array.from({ length: 6 }, (_, i) => mk(i)) });
  assert.equal(createStorage(be).getGame('invent').saved.length, 6);
  assert.ok(createStorage(be).getGame('invent').saved.every((e) => e.v === 1));
  // bozuk: slots dizi degil, layout yok, cok uzun
  s.updateGame('invent', { saved: [null, 5, 'x', { layout: 'loop' }, { layout: 'loop', slots: 'abc' }, { layout: 'loop', slots: new Array(20).fill('wire') }, mk(0)] });
  assert.equal(createStorage(be).getGame('invent').saved.length, 1);
});

test('Kayit: V4/V5 bicimli (v alanisiz) eski kayit okunur, kaybolmaz', () => {
  const be = mem();
  be.setItem('altez-minilab:v1', JSON.stringify({ correct: 9, band: '6-8', sound: true, seen: true, games: { 'number-hunt': { correct: 11 }, invent: { correct: 2, found: ['light', 'switch'], saved: [{ layout: 'ladder', slots: ['wire', 'wire', 'led', 'wire', 'wire', 'led'], sw: ['open', 'open', 'open', 'open', 'open', 'open'] }] } } }));
  const s = createStorage(be);
  assert.equal(s.get().correct, 9);
  assert.equal(s.getGame('number-hunt').correct, 11);
  assert.deepEqual(s.getGame('invent').found, ['light', 'switch']);
  const e = s.getGame('invent').saved[0];
  assert.equal(e.layout, 'ladder');
  assert.equal(e.v, 1);
  assert.equal(analyze(buildParts(inv.layouts[e.layout], e.slots)).lit, 2);
});

test('Kayit: depolama yazamazsa saveOk() false olur (basari mesaji gosterilmemeli), bellek bozulmaz', () => {
  let fail = false;
  const m = new Map();
  const be = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { if (fail) throw new Error('kota doldu'); m.set(k, v); } };
  const s = createStorage(be);
  s.updateGame('invent', { correct: 1, found: ['light'] });
  assert.equal(s.saveOk(), true);
  fail = true;
  s.updateGame('invent', { saved: [{ layout: 'loop', slots: ['wire', 'led', 'wire'] }] });
  assert.equal(s.saveOk(), false);
  fail = false;
  s.updateGame('invent', { found: ['light'] });
  assert.equal(s.saveOk(), true);
});

test('Kayit: bir buluş yuklenince baglantilar ayni kurulur (tur, konum, anahtar durumu, pano)', () => {
  const be = mem();
  const s = createStorage(be);
  const layout = 'ladder';
  const slots = ['switch', 'wire', 'led', 'wire', 'wire', 'led'];
  s.updateGame('invent', { correct: 0, saved: [{ layout, slots, sw: ['closed', 'open', 'open', 'open', 'open', 'open'] }] });
  const e = createStorage(be).getGame('invent').saved[0];
  const L = inv.layouts[e.layout];
  const st = Object.fromEntries(L.slots.map((x, k) => [x.id, e.sw[k]]));
  const before = analyze(buildParts(L, slots, { s1: 'closed' }));
  const after = analyze(buildParts(L, e.slots, st));
  assert.deepEqual(e.slots, slots);
  assert.deepEqual(after.sim.levels, before.sim.levels);
  assert.equal(after.lit, 2);
});
