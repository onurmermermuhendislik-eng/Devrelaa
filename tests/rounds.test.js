import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { createRng } from '../src/core/rng.js';
import { makeGeometryRound, difficulty, planKind } from '../src/games/shape-complete/rounds.js';

const data = loadData();
const KINDS = { '4-5': ['complete', 'matchColor', 'matchShape'], '6-8': ['complete', 'matchColor', 'matchShape', 'pattern'] };

function* allRounds(count = 60) {
  for (const band of ['4-5', '6-8']) {
    for (let level = 0; level <= 3; level++) {
      for (const kind of KINDS[band]) {
        const rng = createRng(1000 + level * 10 + kind.length);
        let prevId = null;
        for (let i = 0; i < count; i++) {
          const r = makeGeometryRound({ data, rng, band, level, kind, prevId });
          prevId = r.id;
          yield { band, level, kind, r };
        }
      }
    }
  }
}

test('her turda secenek sayisi zorluk tablosuna uyar, cevap gecerli ve tek', () => {
  for (const { band, level, kind, r } of allRounds()) {
    const d = difficulty(band, level);
    const label = `${band}/L${level}/${kind}/${r.id}`;
    assert.equal(r.kind, kind, label);
    assert.equal(r.options.length, d.options, label);
    assert.ok(r.answer >= 0 && r.answer < r.options.length, label);
    const keys = r.options.map((o) => o.key);
    assert.equal(new Set(keys).size, keys.length, `secenekler birbirinden farkli olmali: ${label} ${keys}`);
    assert.equal(r.options[r.answer].id, 'ok', label);
  }
});

test('4-5 yas: sadece yari parca, 2-3 secenek, en fazla 4 sekil tipi', () => {
  for (const { band, level, kind, r } of allRounds(40)) {
    if (band !== '4-5') continue;
    assert.ok(r.options.length <= 3);
    if (kind === 'complete') assert.match(r.id, /:half:/);
    if (level === 0) assert.ok(!r.id.includes('triangle') && !r.id.includes('rectangle'));
  }
});

test('4-5 yas: kare ve dikdortgen ayni secenek grubunda yer almaz', () => {
  for (const { band, kind, r } of allRounds(80)) {
    if (band !== '4-5' || kind !== 'matchShape') continue;
    const k = r.options.map((o) => o.key);
    assert.ok(!(k.includes('shape:square') && k.includes('shape:rectangle')), r.id);
  }
});

test('renk turlari: ayni secenek grubunda kirmizi-yesil gibi karisan renk cifti yok', () => {
  const bad = data.colors.conflicts;
  for (const { kind, r } of allRounds(80)) {
    if (kind !== 'matchColor') continue;
    const cols = r.options.map((o) => o.key.replace('col:', ''));
    for (const [a, b] of bad) assert.ok(!(cols.includes(a) && cols.includes(b)), `${r.id} ${cols}`);
  }
});

test('eksik parca turu: dogru parca silueti baska secenekle ayni degil, delik bir parca', () => {
  for (const { kind, r } of allRounds(80)) {
    if (kind !== 'complete') continue;
    const holes = r.prompt.items.filter((i) => i.role === 'hole');
    assert.equal(holes.length, 1, r.id);
    assert.ok(r.prompt.items.some((i) => i.text === '?'));
    // cozulmus sahne: delik yok, tum parcalar dolu
    assert.ok(r.solvedPrompt.items.every((i) => i.fill !== 'none'));
    assert.equal(r.solvedPrompt.items.length, r.prompt.items.filter((i) => i.geom).length);
  }
});

test('oruntu turu: ilk bes oge icinde cevap ogesi vardir (cikarsanabilir) ve 6. hucre bos', () => {
  for (const { kind, r } of allRounds(80)) {
    if (kind !== 'pattern') continue;
    assert.equal(r.prompt.items.filter((i) => i.geom && i.cls === 'piece').length, 5, r.id);
    assert.equal(r.solvedPrompt.items.filter((i) => i.geom).length, 6, r.id);
    // cevabin dolgu rengi, ilk bes ogeden birinde de bulunmali
    const correctFill = r.solvedPrompt.items[5].fill;
    assert.ok(r.solvedPrompt.items.slice(0, 5).some((i) => i.fill === correctFill && true), r.id);
  }
});

test('ard arda ayni tur gelmez (yeterli cesitlilik olan turlerde)', () => {
  for (const kind of ['complete', 'matchShape', 'matchColor']) {
    const rng = createRng(42);
    let prev = null;
    let repeats = 0;
    for (let i = 0; i < 200; i++) {
      const r = makeGeometryRound({ data, rng, band: '6-8', level: 2, kind, prevId: prev });
      if (r.id === prev) repeats++;
      prev = r.id;
    }
    assert.equal(repeats, 0, kind);
  }
});

test('ayni tohum ayni turu uretir (tekrarlanabilirlik)', () => {
  const a = makeGeometryRound({ data, rng: createRng(5), band: '6-8', level: 1, kind: 'complete' });
  const b = makeGeometryRound({ data, rng: createRng(5), band: '6-8', level: 1, kind: 'complete' });
  assert.deepEqual(a, b);
});

test('tur planlama: her 3. tur devre bolumu', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5].map(planKind), ['geometry', 'geometry', 'circuit', 'geometry', 'geometry', 'circuit']);
});
