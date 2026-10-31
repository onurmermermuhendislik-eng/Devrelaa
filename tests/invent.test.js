// V5 Mucit Atolyesi: saf mantik, veri, kayit ve V4 korumasi testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { buildParts, analyze, hintFor, discoveriesIn, switchDiscovery, signature, pathsOf, TOOLS } from '../src/games/invent/logic.js';
import { simulate } from '../src/games/shape-complete/circuit-sim.js';
import { createStorage } from '../src/core/storage.js';
import { games } from '../src/games/registry.js';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const data = loadData();
const inv = data.game.invent;
const LOOP = inv.layouts.loop;
const LADDER = inv.layouts.ladder;
const an = (L, slots, states) => analyze(buildParts(L, slots, states));
const mem = () => {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

test('atolye verisi: yerlesimler circuits.json dugumleriyle uyumlu, kesifler ve metinler tam', () => {
  for (const L of Object.values(inv.layouts)) {
    const nodes = data.circuits.layouts[L.id];
    assert.ok(nodes, L.id);
    for (const p of [L.battery, ...L.slots]) assert.ok(nodes[p.a] && nodes[p.b], `${L.id}/${p.id}`);
    assert.equal(new Set(L.slots.map((s) => s.id)).size, L.slots.length);
  }
  assert.deepEqual(TOOLS, ['wire', 'led', 'resistor', 'switch']);
  for (const d of inv.discoveries) assert.ok(d.id && d.icon && d.tr);
  for (const k of ['intro', 'noled', 'gap', 'switch', 'short', 'ledoff', 'lit', 'new', 'saved', 'cleared', 'savefirst', 'empty', 'pick']) assert.ok(inv.text[k], k);
  for (const k of ['intro', 'noled', 'gap', 'switch', 'short', 'ledoff', 'lit', 'new', 'saved', 'cleared']) assert.ok(`inv_${k}` in data.manifest.voice, `manifest inv_${k}`);
});

test('atolye: bos tahtada devre acik, LED yanmaz', () => {
  const a = an(LOOP, [null, null, null]);
  assert.equal(a.closed, false);
  assert.equal(a.lit, 0);
  assert.equal(hintFor(a).key, 'noled');
});

test('atolye: pil + kablo + LED + kablo = LED yanar', () => {
  const a = an(LOOP, ['wire', 'led', 'wire']);
  assert.equal(a.lit, 1);
  assert.equal(a.short, false);
  assert.deepEqual(discoveriesIn(a), ['light']);
  assert.equal(hintFor(a).key, 'lit');
});

test('atolye: LED yolda ama bosluk varsa yanmaz ve nazik ipucu bosluklari gosterir', () => {
  const a = an(LOOP, [null, 'led', 'wire']);
  assert.equal(a.lit, 0);
  const h = hintFor(a);
  assert.equal(h.key, 'gap');
  assert.equal(h.focus, 'gaps');
  assert.deepEqual(a.gaps, ['s1']);
});

test('atolye: kisa devre (LEDsiz yol) LEDleri sondurur ve kisa devre diye bildirilir', () => {
  const a = an(LOOP, ['wire', 'wire', 'wire']);
  assert.equal(a.short, true);
  assert.equal(a.lit, 0);
  assert.equal(hintFor(a).key, 'short');
  assert.ok(discoveriesIn(a).includes('short'));
  // Merdiven: LEDi atlayan kablo kolu LED'i sondurur (fizik olarak dogru)
  const b = an(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', 'wire']);
  assert.equal(b.short, true);
  assert.equal(b.lit, 0);
});

test('atolye: anahtar acikken devre kapali, ipucu anahtari gosterir; kapaninca LED yanar', () => {
  const open = an(LOOP, ['switch', 'led', 'wire']);
  assert.equal(open.lit, 0);
  assert.equal(open.wouldClose, true);
  assert.equal(hintFor(open).key, 'switch');
  assert.equal(hintFor(open).focus, 'switch');
  const closed = an(LOOP, ['switch', 'led', 'wire'], { s1: 'closed' });
  assert.equal(closed.lit, 1);
  assert.equal(switchDiscovery(open, closed), true);
  assert.equal(switchDiscovery(closed, closed), false);
});

test('atolye: direnc LED yolunda ise direnc kesfi; parlaklik daha dusuk', () => {
  const a = an(LOOP, ['resistor', 'led', 'wire']);
  assert.equal(a.lit, 1);
  assert.ok(discoveriesIn(a).includes('resistor'));
  const plain = an(LOOP, ['wire', 'led', 'wire']);
  assert.ok(a.sim.levels.s2 <= plain.sim.levels.s2);
});

test('atolye: seri iki LED soluk, paralel iki LED parlak (sonucu gorerek karsilastirma)', () => {
  const series = an(LOOP, ['led', 'led', 'wire']);
  assert.equal(series.lit, 2);
  assert.equal(series.paths, 1);
  assert.ok(discoveriesIn(series).includes('series'));
  const parallel = an(LADDER, ['wire', 'wire', 'led', 'wire', 'wire', 'led']);
  assert.equal(parallel.lit, 2);
  assert.equal(parallel.paths, 2);
  assert.ok(discoveriesIn(parallel).includes('parallel'));
  const bs = Math.max(...Object.values(series.sim.levels));
  const bp = Math.min(...Object.values(parallel.sim.levels));
  assert.ok(bp > bs, `paralel ${bp} > seri ${bs}`);
});

test('atolye: LED yolun ustunde degil -> ledoff ipucu', () => {
  // Merdiven: yol ust-sag-alt kablolarla tamam, LED yalniz orta kolda ama orta kol anahtarsiz bos degil -> LED bypass
  const a = an(LADDER, ['wire', 'wire', 'wire', 'wire', 'wire', 'led']);
  assert.equal(a.short, true); // kablo yolu pili kisa devre yapar
});

test('atolye: tum 3^n/4^n kombinasyonlarda cozumleme hata vermez, tutarli (kisa devre iken lit=0, lit>0 iken closed)', () => {
  const opts = [null, ...TOOLS];
  for (const L of Object.values(inv.layouts)) {
    const n = L.slots.length;
    const total = Math.min(opts.length ** n, 5 ** n);
    for (let k = 0; k < total; k++) {
      const slots = Array.from({ length: n }, (_, i) => opts[Math.floor(k / opts.length ** i) % opts.length]);
      for (const sw of ['open', 'closed']) {
        const st = Object.fromEntries(L.slots.map((s) => [s.id, sw]));
        const a = an(L, slots, st);
        if (a.short) assert.equal(a.lit, 0);
        if (a.lit > 0) assert.ok(a.closed && !a.short);
        assert.ok(['lit', 'short', 'weak', 'noled', 'switch', 'gap', 'ledoff'].includes(hintFor(a).key));
      }
    }
  }
});

test('atolye: devre benzetimi (circuit-sim.js) DEGISMEDI (V4 sozlesmesi)', () => {
  const sim = readFileSync(new URL('../src/games/shape-complete/circuit-sim.js', import.meta.url));
  // V4'te dogrulanan davranis: pil+kablo+LED+kablo dongusu yanar, anahtar acikken yanmaz
  const parts = buildParts(LOOP, ['wire', 'led', 'wire']);
  assert.equal(simulate(parts).levels.s2, 3);
  assert.equal(simulate(buildParts(LOOP, ['switch', 'led', 'wire'])).levels.s2, 0);
  assert.ok(sim.length > 1000);
  assert.ok(pathsOf(parts).length === 1);
});

test('atolye: imza ayni dizilim icin ayni, farkli anahtar durumunda farkli', () => {
  assert.equal(signature('loop', ['wire', 'led', 'wire']), signature('loop', ['wire', 'led', 'wire']));
  assert.notEqual(signature('loop', ['switch', 'led', 'wire'], { s1: 'open' }), signature('loop', ['switch', 'led', 'wire'], { s1: 'closed' }));
});

test('kayit: kesifler ve kayitli bulus kalici, V3/V4 kaydi etkilenmez, bozuk veri atilir', () => {
  const be = mem();
  const s = createStorage(be);
  s.update({ correct: 12 });
  s.updateGame('number-hunt', { correct: 7 });
  s.updateGame('invent', { correct: 2, found: ['light', 'switch', 'light', 'x y'], saved: [{ layout: 'loop', slots: ['wire', 'led', 'bomba'], sw: ['x', 'closed', 'open'] }, { layout: '', slots: [] }] });
  const t = createStorage(be);
  assert.deepEqual(t.getGame('invent').found, ['light', 'switch']);
  assert.equal(t.getGame('invent').saved.length, 1);
  // V5.1: kayitlara bicim surumu (v:1) eklendi; v'siz eski kayitlar ayni sekilde okunur
  assert.deepEqual(t.getGame('invent').saved[0], { v: 1, layout: 'loop', slots: ['wire', 'led', null], sw: ['open', 'closed', 'open'] });
  assert.equal(t.get().correct, 12);
  assert.equal(t.getGame('number-hunt').correct, 7);
  // en fazla 6 buluş
  const many = Array.from({ length: 9 }, (_, i) => ({ layout: 'loop', slots: ['wire', 'led', i % 2 ? 'wire' : null] }));
  t.updateGame('invent', { saved: many });
  assert.equal(createStorage(be).getGame('invent').saved.length, 6);
});

test('kayit: V4 kaydi (invent yok) aynen okunur ve `games.invent` oynanana kadar yazilmaz', () => {
  const be = mem();
  be.setItem('altez-minilab:v1', JSON.stringify({ correct: 5, band: '6-8', sound: false, seen: true }));
  const s = createStorage(be);
  assert.equal(s.getGame('invent').correct, 0);
  assert.equal(s.get().games, undefined);
  s.update({ sound: true });
  assert.ok(!('games' in JSON.parse(be.getItem('altez-minilab:v1'))));
});

test('ana ekran: Mucit Atolyesi kayitli, rozet kesif sayisini verir; seviye esikleri degismedi', () => {
  const g = games.find((x) => x.id === 'invent');
  assert.ok(g && typeof g.create === 'function' && g.icon === '💡');
  const be = mem();
  const s = createStorage(be);
  assert.equal(g.badge({ storage: s, data }).fraction, 0);
  s.updateGame('invent', { correct: 3, found: ['light', 'switch', 'series'] });
  const b = g.badge({ storage: s, data });
  assert.equal(b.fraction, 0.5);
  assert.equal(b.name, 'Mucit 3/6');
  assert.deepEqual(data.levels.filter((l) => l.status === 'active').map((l) => l.min), [0, 10, 30, 60]);
  assert.equal(data.strings.games.invent.title, 'Mucit Atölyesi');
});

test('V4 korumasi: Sekli Tamamla ve Sayi Avi kaynaklari V5\'te degismedi (V4 teslim ozetleriyle birebir)', () => {
  const guard = JSON.parse(readFileSync(new URL('./v4-guard.json', import.meta.url), 'utf8'));
  for (const [f, hash] of Object.entries(guard)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../${f}`, import.meta.url))).digest('hex'), hash, `${f} degismis: bilincli degisiklikse v4-guard.json guncellenip raporlanmali`);
  }
  const voice = readFileSync(new URL('../src/core/voice.js', import.meta.url), 'utf8');
  assert.ok(voice.includes('nativePromise(PLUGIN, method, opts)'));
  assert.ok(voice.includes("VOICE_BUILD = 'ses-3-nativePromise'"));
});
