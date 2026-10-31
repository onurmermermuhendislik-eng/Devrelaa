// Asama 3: Sekli Tamamla V2 - yeni gorev tipleri, yeni sekiller, yeni devre gorevleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { createRng } from '../src/core/rng.js';
import { bbox, rotate90, mirrorX, flipY, translate, exactKey, rotKey, silhouetteKey } from '../src/games/shape-complete/geometry.js';
import { makeGeometryRound, difficulty, kindWeights, planKind } from '../src/games/shape-complete/rounds.js';
import {
  makeCircuitRound, stagesFor, isComplete, allFilled, advanceCircuit
} from '../src/games/shape-complete/circuit-rounds.js';
import { simulate } from '../src/games/shape-complete/circuit-sim.js';

const data = loadData();
const { rotate: ROT, symmetry: SYM } = data.figures;
const inBox = (g) => {
  const b = bbox(g);
  return b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 100 && b.y1 <= 100;
};

// ---------- Yeni sekiller ----------
test('yeni sekiller: tum varyantlar (donmus/yansimis/ters/kaydirilmis) 0..100 kutusundan tasmaz', () => {
  for (const f of ROT) {
    for (const k of [0, 1, 2, 3]) {
      assert.ok(inBox(rotate90(f.geom, k)), `${f.id} k=${k}`);
      assert.ok(inBox(rotate90(mirrorX(f.geom), k)), `${f.id} ayna k=${k}`);
    }
  }
  for (const h of SYM) {
    const m = mirrorX(h.geom);
    for (const g of [h.geom, m, flipY(m), translate(h.geom, 50, 0), translate(m, 0, 12)]) assert.ok(inBox(g), h.id);
  }
});

test('simetri yarimlari: sol yarida, eksene dokunur, dikey/yatay simetrik degil', () => {
  for (const h of SYM) {
    const b = bbox(h.geom);
    assert.ok(b.x1 <= 50.0001 && b.x0 >= 0, `${h.id}: sol yarida olmali`);
    assert.ok(h.geom.points.some(([x]) => Math.abs(x - 50) < 0.01), `${h.id}: eksene dokunmali`);
    const m = mirrorX(h.geom);
    assert.notEqual(exactKey(flipY(m)), exactKey(m), `${h.id}: ters cevirme farkli gorunmeli`);
    assert.notEqual(exactKey(translate(h.geom, 50, 0)), exactKey(m), `${h.id}: kopya yansimadan farkli olmali`);
  }
});

test('donme sekilleri: izin verilen donuste gorunur sekilde degisir; 180 derece tum sekiller icin gecerli', () => {
  for (const f of ROT) {
    assert.notEqual(silhouetteKey(rotate90(f.geom, 2)), silhouetteKey(f.geom), `${f.id}: 180 derece`);
  }
  // sekiller birbirinin donmusu degil (celdirici olarak guvenli)
  const keys = ROT.map((f) => rotKey(f.geom));
  assert.equal(new Set(keys).size, keys.length);
});

// ---------- Tur ureticileri ----------
function* rounds(kind, count = 80) {
  for (const band of ['4-5', '6-8']) {
    for (let level = 0; level <= 3; level++) {
      const rng = createRng(500 + level * 7 + kind.length);
      let prevId = null;
      for (let i = 0; i < count; i++) {
        const r = makeGeometryRound({ data, rng, band, level, kind, prevId });
        prevId = r.id;
        yield { band, level, r };
      }
    }
  }
}

test('donduruldu: secenek sayisi zorluga uyar, dogru cevap tek, secenekler farkli, celdiriciler donmus hedef degil', () => {
  for (const { band, level, r } of rounds('rotate')) {
    const d = difficulty(band, level);
    const label = `${band}/L${level}/${r.id}`;
    assert.equal(r.kind, 'rotate');
    assert.equal(r.options.length, d.options, label);
    assert.equal(r.options[r.answer].id, 'ok');
    assert.equal(r.options.filter((o) => o.id === 'ok').length, 1);
    const geoms = r.options.map((o) => o.scene.items[0].geom);
    assert.equal(new Set(geoms.map(exactKey)).size, geoms.length, `tekil: ${label}`);
    const target = r.prompt.items[0].geom;
    const tRot = rotKey(target);
    r.options.forEach((o, i) => {
      const same = rotKey(geoms[i]) === tRot;
      assert.equal(same, i === r.answer, `${label}: sadece dogru secenek hedefin donmusu olmali (${o.key})`);
      assert.ok(inBox(geoms[i]), label);
    });
    // dogru secenek hedeften gorunur sekilde farkli (gercekten dondurulmus)
    assert.notEqual(silhouetteKey(geoms[r.answer]), silhouetteKey(target), label);
    assert.ok(r.answerTurn >= 1 && r.answerTurn <= 3);
    assert.equal(exactKey(geoms[r.answer]), exactKey(rotate90(target, r.answerTurn)), label);
    if (band === '4-5') assert.equal(r.answerTurn, 2, '4-5 yas: sadece ters cevrilmis (180)');
    assert.equal(r.hintMode, 'narrow');
  }
});

test('6-8 yas seviye 1+: donmus sekil gorevinde ayna goruntusu celdirici bulunur (donmeyle eldesi imkansiz)', () => {
  let withMirror = 0;
  let total = 0;
  for (const { band, level, r } of rounds('rotate', 120)) {
    if (band !== '6-8' || level < 1) continue;
    total += 1;
    if (r.options.some((o) => o.key.startsWith('mirror:'))) withMirror += 1;
  }
  assert.ok(withMirror / total > 0.5, `${withMirror}/${total}`);
});

test('simetri: dogru secenek tek ve gercekten yansima; celdiriciler yansima degil', () => {
  for (const { band, level, r } of rounds('symmetry')) {
    const d = difficulty(band, level);
    const label = `${band}/L${level}/${r.id}`;
    assert.equal(r.options.length, d.options, label);
    const left = r.prompt.items[0].geom;
    const want = exactKey(mirrorX(left));
    const rights = r.options.map((o) => o.scene.items[2].geom);
    const matches = rights.map((g, i) => (exactKey(g) === want ? i : -1)).filter((i) => i >= 0);
    assert.deepEqual(matches, [r.answer], label);
    assert.equal(new Set(rights.map(exactKey)).size, rights.length, label);
    r.options.forEach((o) => {
      // sol yari her seceneklerde ayni (ekranda hedefle ayni)
      assert.equal(exactKey(o.scene.items[0].geom), exactKey(left), label);
      assert.ok(o.scene.items.every((it) => !it.geom || inBox(it.geom)), label);
    });
    assert.ok(r.prompt.items.some((it) => it.role === 'hole'), 'hedef alani (bos yer) var');
    assert.ok(r.solvedPrompt.items.some((it) => /solved-piece/.test(it.cls || '')));
    assert.equal(r.hintMode, 'narrow');
  }
});

// ---------- Yas / seviye uygunlugu, cesitlilik ----------
test('yas ve seviye uygunlugu: 4-5 yas L0 sadece basit gorevler; donme 4-5 yasta L2+; 6-8 tum gorevler', () => {
  const kinds = (band, level) => kindWeights(band, level).map(([k]) => k);
  assert.deepEqual(kinds('4-5', 0), ['complete', 'matchColor']); // mevcut davranis korunur
  assert.ok(!kinds('4-5', 1).includes('rotate'));
  assert.ok(kinds('4-5', 1).includes('symmetry'));
  assert.ok(kinds('4-5', 2).includes('rotate'));
  for (let l = 0; l <= 3; l++) {
    assert.ok(!kinds('4-5', l).includes('pattern'), '4-5 yasta oruntu yok');
    assert.ok(kinds('6-8', l).includes('pattern') && kinds('6-8', l).includes('symmetry'));
  }
  assert.ok(kinds('6-8', 1).includes('rotate') && !kinds('6-8', 0).includes('rotate'));
  for (let l = 0; l <= 3; l++) {
    assert.ok(difficulty('4-5', l).options <= 3 && difficulty('6-8', l).options <= 4);
  }
});

test('oyun akisi: arka arkaya ayni gorev tipi veya ayni gorev gelmez; gorev cesitliligi saglanir', () => {
  for (const band of ['4-5', '6-8']) {
    for (const level of [0, 1, 2, 3]) {
      const rng = createRng(77 + level);
      let prevKind = null;
      let prevId = null;
      const seen = new Set();
      for (let index = 0; index < 400; index++) {
        let kind;
        let id;
        if (planKind(index) === 'circuit') {
          kind = 'circuit';
          id = `circuit:${index}`;
        } else {
          const r = makeGeometryRound({ data, rng, band, level, prevId, prevKind });
          kind = r.kind;
          id = r.id;
          assert.notEqual(r.id, prevId, `${band}/L${level}: ayni gorev arka arkaya (${r.id})`);
        }
        assert.notEqual(kind, prevKind, `${band}/L${level} #${index}: ayni tip arka arkaya (${kind})`);
        seen.add(kind);
        prevKind = kind;
        prevId = id;
      }
      const expected = [...kindWeights(band, level).map(([k]) => k), 'circuit'].sort();
      assert.deepEqual([...seen].sort(), expected, `${band}/L${level}: tum gorev tipleri gorulmeli`);
    }
  }
});

test('her gorev tipi icin yazili + sesli yonerge ve manifest anahtari var', () => {
  const rng = createRng(5);
  for (const band of ['4-5', '6-8']) {
    for (const kind of ['complete', 'matchColor', 'matchShape', 'pattern', 'rotate', 'symmetry']) {
      const r = makeGeometryRound({ data, rng, band, level: 3, kind, prevId: null });
      assert.ok(data.strings.voice[r.voice], `${kind}: metin`);
      assert.ok(r.voice in data.manifest.voice, `${kind}: manifest`);
    }
  }
  assert.equal(data.strings.voice.rotate, 'Döndürülmüş şekli bul.');
  assert.equal(data.strings.voice.symmetry, 'Diğer tarafı tamamla.');
  assert.ok(data.strings.voice.circuit_fix && 'circuit_fix' in data.manifest.voice);
});

// ---------- Elektrik ----------
const OLD_ORDER = ['c1-kablo', 'c2-pil', 'c3-led', 'c4-direnc', 'c5-anahtar', 'c6-seri', 'c7-paralel'];
const roundAt = (band, id) => {
  const i = stagesFor(data, band).findIndex((s) => s.id === id);
  assert.ok(i >= 0, `${band}: ${id}`);
  return makeCircuitRound({ data, rng: createRng(9), band, circuitState: { stage: i, plays: 0 } });
};

test('devre bolumleri sadece eklendi: eski 7 bolumun sirasi ve bandlari ayni (kayitli ilerleme kaymaz)', () => {
  assert.deepEqual(data.circuits.stages.slice(0, 7).map((s) => s.id), OLD_ORDER);
  assert.deepEqual(stagesFor(data, '4-5').slice(0, 5).map((s) => s.id), OLD_ORDER.slice(0, 5));
  assert.deepEqual(stagesFor(data, '6-8').slice(0, 7).map((s) => s.id), OLD_ORDER);
});

test('yeni devre bolumleri: 4-5 yas sadece temel (kablo/pil/LED/anahtar), 6-8 yas hata bulma ve tamamlama', () => {
  assert.deepEqual(stagesFor(data, '4-5').slice(5).map((s) => s.id), ['c8-kablo-ust', 'c9-pil-sag', 'c10-led-ust', 'c11-anahtar-ust']);
  assert.deepEqual(
    stagesFor(data, '6-8').slice(7).map((s) => s.id),
    ['c8-kablo-ust', 'c9-pil-sag', 'c10-led-ust', 'c11-anahtar-ust', 'c12-onar-kablo', 'c13-onar-paralel', 'c14-tamamla-uc', 'c15-tamamla-anahtar']
  );
  for (const s of stagesFor(data, '4-5')) {
    assert.ok(!s.parts.some((p) => p.fault), '4-5: hata bulma yok');
    assert.ok(s.parts.filter((p) => !p.type).length <= 2);
  }
});

test('eski ilerleme yeni icerikle uyumlu: eski kayit hala ayni bolumu gosterir; 4-5 "hepsi tamam" olanlar yeni bolumlere devam eder', () => {
  const r2 = makeCircuitRound({ data, rng: createRng(1), band: '4-5', circuitState: { stage: 2, plays: 0 } });
  assert.equal(r2.stageId, 'c3-led');
  const r5 = makeCircuitRound({ data, rng: createRng(1), band: '4-5', circuitState: { stage: 5, plays: 0 } });
  assert.equal(r5.stageId, 'c8-kablo-ust');
  // ilerleme mantigi degismedi: 4-5 yasta bolum basina 2 oyun
  assert.deepEqual(advanceCircuit({ stage: 5, plays: 0 }, data, '4-5'), { stage: 5, plays: 1 });
  assert.deepEqual(advanceCircuit({ stage: 5, plays: 1 }, data, '4-5'), { stage: 6, plays: 0 });
});

test('bozuk kabloyu onar: bozuk parca ipucu cevabi vermez, onarilinca dogru parca ile devre tamamlanir', () => {
  const r = roundAt('6-8', 'c12-onar-kablo');
  assert.equal(r.voice, 'circuit_fix');
  const part = r.parts.find((p) => p.fault);
  assert.ok(part && !part.type, 'bozuk parca bos konum olarak modellenir (simulatore dokunulmaz)');
  assert.equal(isComplete(r), false);
  assert.equal(simulate(r.parts).closed, false);
  // yanlis tip yerlestirmek devreyi tamamlamaz, dogru tip tamamlar
  part.fault = false;
  part.type = 'wire';
  assert.ok(allFilled(r) && isComplete(r));
  assert.ok(r.options.some((o) => o.type === 'wire') && r.options.some((o) => o.type !== 'wire'));
});

test('paralel onarma: baslangicta bir LED yanar, digeri onarilinca ikisi de tam parlar', () => {
  const r = roundAt('6-8', 'c13-onar-paralel');
  const before = simulate(r.parts);
  assert.deepEqual([before.levels.led1, before.levels.led2], [0, 3]);
  const slot = r.parts.find((p) => p.fault);
  slot.fault = false;
  slot.type = 'wire';
  const after = simulate(r.parts);
  assert.deepEqual([after.levels.led1, after.levels.led2], [3, 3]);
  assert.ok(isComplete(r));
});

test('basit devreyi tamamla: 3 bos konum, her biri icin dogru secenek var, anahtarli surum anahtarla biter', () => {
  for (const id of ['c14-tamamla-uc', 'c15-tamamla-anahtar']) {
    const r = roundAt('6-8', id);
    assert.equal(r.slots.length, 2 + (id === 'c14-tamamla-uc' ? 1 : 0) - (id === 'c15-tamamla-anahtar' ? 0 : 0));
    for (const s of r.slots) assert.ok(r.options.some((o) => o.type === s.accepts), `${id}/${s.id}`);
  }
  const r = roundAt('6-8', 'c14-tamamla-uc');
  assert.equal(r.slots.length, 3);
  assert.equal(r.voice, 'circuit_multi');
});

test('yeni bolumlerde konum cesitliligi: eksik kablo/pil/LED/anahtar farkli kenarlarda', () => {
  const where = (id, accepts) => {
    const st = data.circuits.stages.find((s) => s.id === id);
    const p = st.parts.find((q) => q.accepts === accepts);
    return `${p.a}-${p.b}`;
  };
  assert.notEqual(where('c8-kablo-ust', 'wire'), where('c1-kablo', 'wire'));
  assert.notEqual(where('c9-pil-sag', 'battery'), where('c2-pil', 'battery'));
  assert.notEqual(where('c10-led-ust', 'led'), where('c3-led', 'led'));
  assert.notEqual(where('c11-anahtar-ust', 'switch'), where('c5-anahtar', 'switch'));
});
