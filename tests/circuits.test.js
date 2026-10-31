import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { createRng } from '../src/core/rng.js';
import { simulate, litCount } from '../src/games/shape-complete/circuit-sim.js';
import {
  makeCircuitRound, advanceCircuit, initialCircuitState, stagesFor, isComplete, allFilled
} from '../src/games/shape-complete/circuit-rounds.js';

const data = loadData();
const TYPES = new Set(['wire', 'battery', 'led', 'resistor', 'switch']);

const roundFor = (band, stage) =>
  makeCircuitRound({ data, rng: createRng(3), band, circuitState: { stage, plays: 0 } });

function solve(round) {
  for (const s of round.slots) round.parts.find((p) => p.id === s.id).type = s.accepts;
  for (const p of round.parts) if (p.type === 'switch') p.state = 'closed';
  return round;
}

test('bolum tanimlari tutarli: gecerli tipler, dugumler mevcut, secenekler dogru tipi icerir', () => {
  for (const st of data.circuits.stages) {
    const nodes = data.circuits.layouts[st.layout];
    assert.ok(nodes, st.id);
    const ids = st.parts.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length, `${st.id}: parca kimlikleri tekil olmali`);
    assert.equal(st.parts.filter((p) => p.type === 'battery').length + st.parts.filter((p) => p.accepts === 'battery').length, 1, `${st.id}: tek pil`);
    for (const p of st.parts) {
      assert.ok(nodes[p.a] && nodes[p.b], `${st.id}/${p.id}: dugum`);
      if (p.type) assert.ok(TYPES.has(p.type));
      else {
        assert.ok(TYPES.has(p.accepts));
        assert.ok(st.options.includes(p.accepts), `${st.id}: ${p.id} icin dogru secenek yok`);
      }
    }
    assert.ok(st.parts.some((p) => !p.type), `${st.id}: en az bir bos konum`);
    assert.ok(st.options.length >= 2 && st.options.length <= 3);
  }
});

test('her bolum: bos haliyle tamam degil, cozulunce tamam ve tum LED yanar', () => {
  for (const band of ['4-5', '6-8']) {
    stagesFor(data, band).forEach((st, i) => {
      const r = roundFor(band, i);
      assert.equal(r.stageId, st.id);
      assert.equal(isComplete(r), false, `${st.id} baslangicta tamam olmamali`);
      assert.equal(allFilled(r), false);
      solve(r);
      assert.ok(allFilled(r));
      assert.ok(isComplete(r), `${st.id} cozulunce tamam olmali`);
      const res = simulate(r.parts);
      assert.ok(litCount(res) >= 1, st.id);
    });
  }
});

test('anahtar bolumu: anahtar acikken LED sonuk, kapaninca yanar', () => {
  const r = roundFor('4-5', stagesFor(data, '4-5').findIndex((s) => s.finish === 'switch'));
  for (const s of r.slots) r.parts.find((p) => p.id === s.id).type = s.accepts;
  assert.equal(isComplete(r), false);
  assert.equal(litCount(simulate(r.parts)), 0);
  r.parts.find((p) => p.type === 'switch').state = 'closed';
  assert.ok(isComplete(r));
  assert.equal(litCount(simulate(r.parts)), 1);
});

test('seri bolum: iki LED yanar ama soluk; paralel bolumde ikisi de tam parlak', () => {
  const stages = stagesFor(data, '6-8');
  const series = solve(roundFor('6-8', stages.findIndex((s) => s.id === 'c6-seri')));
  const sres = simulate(series.parts);
  assert.deepEqual(Object.values(sres.levels), [2, 2]);

  const par = roundFor('6-8', stages.findIndex((s) => s.id === 'c7-paralel'));
  const before = simulate(par.parts);
  assert.deepEqual(Object.values(before.levels), [3]); // led1 baslangicta yanik, led2 henuz bos konum
  solve(par);
  const after = simulate(par.parts);
  assert.deepEqual(Object.values(after.levels), [3, 3]);
});

test('direnc devreyi bozmaz: LED yine tam parlak', () => {
  const r = solve(roundFor('4-5', stagesFor(data, '4-5').findIndex((s) => s.id === 'c4-direnc')));
  assert.deepEqual(Object.values(simulate(r.parts).levels), [3]);
});

test('akim yonu: pilden cikip devreyi dolasir; her iletken parca icin yon vardir', () => {
  const r = solve(roundFor('4-5', 0));
  const res = simulate(r.parts);
  for (const p of r.parts) assert.ok(res.flows[p.id], p.id);
  // Pil eksi->arti (a->b), ust kablo TL->TR (a->b), sag LED TR->BR (a->b), alt kablo BR->BL (a->b)
  assert.deepEqual(Object.values(res.flows), ['ab', 'ab', 'ab', 'ab']);
});

test('pil yoksa veya devre kopuksa hicbir sey yanmaz', () => {
  const r = roundFor('4-5', 0); // alt kablo eksik
  assert.equal(litCount(simulate(r.parts)), 0);
  const noBat = roundFor('4-5', 1); // pil bos konum
  assert.equal(simulate(noBat.parts).closed, false);
});

test('secenekler her turde dogru tipi icerir ve tipleri tekil', () => {
  for (const band of ['4-5', '6-8']) {
    for (let i = 0; i < stagesFor(data, band).length; i++) {
      for (let seed = 0; seed < 20; seed++) {
        const r = makeCircuitRound({ data, rng: createRng(seed), band, circuitState: { stage: i, plays: 0 } });
        const types = r.options.map((o) => o.type);
        assert.equal(new Set(types).size, types.length);
        for (const s of r.slots) assert.ok(types.includes(s.accepts));
        assert.ok(r.options.length <= (band === '4-5' ? 3 : 4));
      }
    }
  }
});

test('bolum ilerlemesi: 4-5 yasta her bolum 2 kez, 6-8 yasta 1 kez; bitince takilir', () => {
  let s = initialCircuitState();
  const seq45 = [];
  const total45 = stagesFor(data, '4-5').length;
  for (let i = 0; i < total45 * 2 + 3; i++) {
    seq45.push(s.stage);
    s = advanceCircuit(s, data, '4-5');
  }
  assert.deepEqual(seq45.slice(0, 4), [0, 0, 1, 1]);
  assert.equal(s.stage, total45);

  s = initialCircuitState();
  const total68 = stagesFor(data, '6-8').length;
  for (let i = 0; i < total68; i++) s = advanceCircuit(s, data, '6-8');
  assert.equal(s.stage, total68);
});

test('tamamlanan bolumlerden sonra rastgele bolum secilir (hata vermez)', () => {
  const total = stagesFor(data, '6-8').length;
  const seen = new Set();
  for (let seed = 0; seed < 60; seed++) {
    const r = makeCircuitRound({ data, rng: createRng(seed), band: '6-8', circuitState: { stage: total, plays: 0 } });
    seen.add(r.stageId);
  }
  assert.ok(seen.size > 3);
});

test('4-5 yas bolumlerinde anahtar sonlarda, seri/paralel sadece 6-8 yasta', () => {
  assert.ok(!stagesFor(data, '4-5').some((s) => /seri|paralel/.test(s.id)));
  assert.ok(stagesFor(data, '6-8').some((s) => /seri/.test(s.id)) && stagesFor(data, '6-8').some((s) => /paralel/.test(s.id)));
  // ilk bolum her iki yasta da en basit olan
  assert.equal(stagesFor(data, '4-5')[0].id, 'c1-kablo');
  assert.equal(stagesFor(data, '6-8')[0].id, 'c1-kablo');
});
