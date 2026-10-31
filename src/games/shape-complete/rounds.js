// "Şekli Tamamla" tur uretici (saf mantik, DOM yok -> kolay test edilir).
// Bir tur: { id, kind, voice, prompt: Scene, solvedPrompt: Scene, options: [{id,key,scene}], answer, hint }
// Scene: { vb:[x,y,w,h], items:[{geom,fill,stroke,sw,dash,cls,role} | {text,x,y,size,cls}] }
import {
  centered, features, distance, silhouetteKey, place, bboxCenter, translate,
  rotate90, mirrorX, flipY, exactKey, rotKey
} from './geometry.js';

const VB100 = [0, 0, 100, 100];
const SIMPLE_SHAPES = ['circle', 'square', 'triangle', 'rectangle'];

// ---- Zorluk tablosu ---------------------------------------------------------
// band: '4-5' | '6-8'; level: 0..3 (Baslangic..Usta)
export function difficulty(band, level) {
  const lv = Math.max(0, Math.min(3, level | 0));
  if (band === '4-5') {
    return {
      options: lv === 0 ? 2 : 3,
      shapes: lv === 0 ? ['circle', 'square'] : lv === 1 ? ['circle', 'square', 'triangle'] : SIMPLE_SHAPES,
      partitions: ['half'],
      distractor: 'far'
    };
  }
  return {
    options: lv === 0 ? 3 : 4,
    shapes: SIMPLE_SHAPES,
    partitions: lv === 0 ? ['half'] : ['half', 'quarter'],
    distractor: lv <= 1 ? 'mixed' : 'near'
  };
}

export function kindWeights(band, level) {
  if (band === '4-5') {
    if (level === 0) return [['complete', 6], ['matchColor', 4]];
    if (level === 1) return [['complete', 5], ['matchColor', 2.5], ['matchShape', 2.5], ['symmetry', 1.5]];
    return [['complete', 4], ['matchColor', 2], ['matchShape', 2], ['symmetry', 2], ['rotate', 1.5]];
  }
  if (level === 0) return [['complete', 5], ['matchShape', 2], ['matchColor', 1.5], ['pattern', 1.5], ['symmetry', 1]];
  return [['complete', 4], ['pattern', 3], ['matchShape', 1.5], ['matchColor', 1], ['symmetry', 2.5], ['rotate', 2.5]];
}

// Her 3. tur devre bolumu, digerleri geometri.
export function planKind(index) {
  return index % 3 === 2 ? 'circuit' : 'geometry';
}

// ---- Yardimcilar ---------------------------------------------------------------
const hexOf = (data, id) => data.colors.palette.find((c) => c.id === id).hex;

function conflictFree(data, rng, n, must = []) {
  const { palette, conflicts } = data.colors;
  const clash = (a, b) => conflicts.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
  const chosen = [...must];
  for (const c of rng.shuffle(palette.map((p) => p.id))) {
    if (chosen.length >= n) break;
    if (chosen.includes(c)) continue;
    if (chosen.some((o) => clash(o, c))) continue;
    chosen.push(c);
  }
  return chosen;
}

const outlineScene = (data, shapeId, hex) => ({
  vb: VB100,
  items: [{ geom: data.shapes.shapes[shapeId].outline, fill: hex, cls: 'piece' }]
});

function finish(round, rng, correctOption, others) {
  const all = rng.shuffle([correctOption, ...others]);
  return { ...round, options: all, answer: all.indexOf(correctOption) };
}

// ---- Eksik parcayi bul ---------------------------------------------------------
function makeComplete({ data, rng, band, level, prevId }) {
  const d = difficulty(band, level);
  const shapes = data.shapes.shapes;
  let id, shapeId, partition, pieces, missing;
  for (let t = 0; t < 12; t++) {
    shapeId = rng.pick(d.shapes);
    partition = rng.pick(d.partitions);
    const cuts = shapes[shapeId].partitions[partition]; // kesim listesi
    const cutIndex = rng.int(cuts.length);
    pieces = cuts[cutIndex];
    missing = rng.pick(pieces);
    id = `complete:${shapeId}:${partition}:${cutIndex}:${missing.id}`;
    if (id !== prevId) break;
  }
  const color = hexOf(data, rng.pick(data.colors.palette).id);

  const items = pieces.map((p) =>
    p.id === missing.id
      ? { geom: p.geom, fill: 'none', dash: true, cls: 'hole', role: 'hole' }
      : { geom: p.geom, fill: color, cls: 'piece' }
  );
  const [hx, hy] = bboxCenter(missing.geom);
  items.push({ text: '?', x: hx, y: hy, size: 22, cls: 'qmark' });
  const solved = pieces.map((p) => ({
    geom: p.geom, fill: color, cls: p.id === missing.id ? 'piece solved-piece' : 'piece'
  }));

  // Celdirici havuzu: tum sekillerin tum parcalari, siluet anahtarina gore tekil.
  const missingKey = silhouetteKey(missing.geom);
  const mf = features(missing.geom);
  const seen = new Set([missingKey]);
  const pool = [];
  for (const s of Object.values(shapes)) {
    for (const p of Object.values(s.partitions).flat(2)) {
      const key = silhouetteKey(p.geom);
      if (seen.has(key)) continue;
      seen.add(key);
      pool.push({ key, geom: p.geom, dist: distance(mf, features(p.geom)) });
    }
  }
  pool.sort((a, b) => a.dist - b.dist);
  const need = d.options - 1;
  let candidates = pool;
  if (d.distractor === 'far') candidates = pool.slice(Math.floor(pool.length / 2));
  else if (d.distractor === 'near') candidates = pool.slice(0, Math.max(need + 2, Math.ceil(pool.length * 0.4)));
  const wrong = rng.shuffle(candidates).slice(0, need).map((c, i) => ({
    id: `w${i}`, key: c.key,
    scene: { vb: VB100, items: [{ geom: centered(c.geom), fill: color, cls: 'piece' }] }
  }));
  const correct = {
    id: 'ok', key: missingKey,
    scene: { vb: VB100, items: [{ geom: centered(missing.geom), fill: color, cls: 'piece' }] }
  };
  return finish(
    { id, kind: 'complete', voice: 'complete', prompt: { vb: VB100, items }, solvedPrompt: { vb: VB100, items: solved }, hint: 'hole' },
    rng, correct, wrong
  );
}

// ---- Ayni rengi bul ------------------------------------------------------------
function makeColor({ data, rng, band, level, prevId }) {
  const d = difficulty(band, level);
  const shapeId = rng.pick(['circle', 'square', 'triangle'].filter((s) => d.shapes.includes(s)));
  let target = rng.pick(data.colors.palette).id;
  let id = `matchColor:${shapeId}:${target}`;
  for (let t = 0; t < 8 && id === prevId; t++) {
    target = rng.pick(data.colors.palette).id;
    id = `matchColor:${shapeId}:${target}`;
  }
  const colors = conflictFree(data, rng, d.options, [target]);
  const scene = (c) => outlineScene(data, shapeId, hexOf(data, c));
  const correct = { id: 'ok', key: `col:${target}`, scene: scene(target) };
  const wrong = colors.filter((c) => c !== target).map((c, i) => ({ id: `w${i}`, key: `col:${c}`, scene: scene(c) }));
  return finish(
    { id, kind: 'matchColor', voice: 'color', prompt: scene(target), solvedPrompt: scene(target), hint: 'prompt' },
    rng, correct, wrong
  );
}

// ---- Ayni sekli bul ------------------------------------------------------------
function makeShape({ data, rng, band, level, prevId }) {
  const d = difficulty(band, level);
  const forbidPair = (a, b) => band === '4-5' && ((a === 'square' && b === 'rectangle') || (a === 'rectangle' && b === 'square'));
  let target = rng.pick(d.shapes);
  let id = `matchShape:${target}`;
  for (let t = 0; t < 8 && id === prevId; t++) {
    target = rng.pick(d.shapes);
    id = `matchShape:${target}`;
  }
  const others = rng.shuffle(d.shapes.filter((s) => s !== target && !forbidPair(s, target)));
  const picked = [];
  for (const s of others) {
    if (picked.length >= d.options - 1) break;
    if (picked.some((p) => forbidPair(p, s))) continue;
    picked.push(s);
  }
  const promptHex = hexOf(data, rng.pick(data.colors.palette).id);
  const optionHex = hexOf(data, rng.pick(data.colors.palette.filter((c) => c.hex !== promptHex)).id);
  const scene = (s, hex) => outlineScene(data, s, hex);
  const correct = { id: 'ok', key: `shape:${target}`, scene: scene(target, optionHex) };
  const wrong = picked.map((s, i) => ({ id: `w${i}`, key: `shape:${s}`, scene: scene(s, optionHex) }));
  return finish(
    { id, kind: 'matchShape', voice: 'shape', prompt: scene(target, promptHex), solvedPrompt: scene(target, promptHex), hint: 'prompt' },
    rng, correct, wrong
  );
}

// ---- Oruntu (6-8 yas) ----------------------------------------------------------
const CELL = 60;
function patternItemGeom(data, shapeId, cx, cy) {
  return place(data.shapes.shapes[shapeId].outline, 0.5, cx, cy);
}

function makePattern({ data, rng, band, level, prevId }) {
  const d = difficulty(band, level);
  const templates = level >= 1 ? ['AB', 'AAB', 'ABC'] : ['AB', 'AAB'];
  let tpl = rng.pick(templates);
  let mode = rng.pick(['shape', 'color']);
  let id = `pattern:${mode}:${tpl}`;
  for (let t = 0; t < 8 && id === prevId; t++) {
    tpl = rng.pick(templates);
    mode = rng.pick(['shape', 'color']);
    id = `pattern:${mode}:${tpl}`;
  }
  const letters = [...new Set(tpl)];
  const seq = Array.from({ length: 6 }, (_, i) => tpl[i % tpl.length]);

  let itemOf; // harf -> {shape,color}
  let fresh; // desenin disindan ek celdirici uretir
  if (mode === 'shape') {
    const shapes = rng.shuffle(SIMPLE_SHAPES).slice(0, letters.length);
    const color = rng.pick(data.colors.palette).id;
    itemOf = (l) => ({ shape: shapes[letters.indexOf(l)], color });
    fresh = () => SIMPLE_SHAPES.filter((s) => !shapes.includes(s)).map((s) => ({ shape: s, color }));
  } else {
    const colors = conflictFree(data, rng, letters.length);
    const shape = rng.pick(['circle', 'square', 'triangle']);
    itemOf = (l) => ({ shape, color: colors[letters.indexOf(l)] });
    fresh = () => conflictFree(data, rng, 4, colors).filter((c) => !colors.includes(c)).map((c) => ({ shape, color: c }));
  }
  const keyOf = (it) => `${it.shape}|${it.color}`;
  const itemItems = (it, cx, cy, cls = 'piece') => ({
    geom: patternItemGeom(data, it.shape, cx, cy), fill: hexOf(data, it.color), cls
  });

  const cx = (i) => CELL / 2 + CELL * i;
  const known = seq.slice(0, 5).map((l, i) => itemItems(itemOf(l), cx(i), 30));
  const answerItem = itemOf(seq[5]);
  const holeGeom = { type: 'poly', points: [[cx(5) - 21, 9], [cx(5) + 21, 9], [cx(5) + 21, 51], [cx(5) - 21, 51]] };
  const prompt = {
    vb: [0, 0, CELL * 6, 60],
    items: [...known, { geom: holeGeom, fill: 'none', dash: true, cls: 'hole', role: 'hole' }, { text: '?', x: cx(5), y: 30, size: 20, cls: 'qmark' }]
  };
  const solved = { vb: prompt.vb, items: [...known, itemItems(answerItem, cx(5), 30, 'piece solved-piece')] };

  const optScene = (it) => ({
    vb: VB100,
    items: [{ geom: data.shapes.shapes[it.shape].outline, fill: hexOf(data, it.color), cls: 'piece' }]
  });
  const used = new Set([keyOf(answerItem)]);
  const wrongItems = [];
  const consider = (it) => {
    if (wrongItems.length >= d.options - 1 || used.has(keyOf(it))) return;
    used.add(keyOf(it));
    wrongItems.push(it);
  };
  letters.forEach((l) => consider(itemOf(l)));
  rng.shuffle(fresh()).forEach(consider);
  const correct = { id: 'ok', key: keyOf(answerItem), scene: optScene(answerItem) };
  const wrong = wrongItems.map((it, i) => ({ id: `w${i}`, key: keyOf(it), scene: optScene(it) }));
  return finish({ id, kind: 'pattern', voice: 'pattern', prompt, solvedPrompt: solved, hint: 'hole' }, rng, correct, wrong);
}

// ---- Dondurulmus sekli bul -----------------------------------------------------
// 4-5 yas: sadece 180 derece (ters cevrilmis) + farkli sekiller. 6-8 yas: 90/180/270 + (seviye 1+) ayna goruntusu celdirici.
function makeRotate({ data, rng, band, level, prevId }) {
  const d = difficulty(band, level);
  const figs = data.figures.rotate;
  const turns = band === '4-5' ? [2] : [1, 2, 3];
  let fig, k, id;
  for (let t = 0; t < 16; t++) {
    fig = rng.pick(figs);
    const ok = turns.filter((q) => silhouetteKey(rotate90(fig.geom, q)) !== silhouetteKey(fig.geom));
    if (!ok.length) continue;
    k = rng.pick(ok);
    id = `rotate:${fig.id}:${k}`;
    if (id !== prevId) break;
  }
  const promptHex = hexOf(data, rng.pick(data.colors.palette).id);
  const optionHex = hexOf(data, rng.pick(data.colors.palette.filter((c) => c.hex !== promptHex)).id);
  const scene = (geom, hex) => ({ vb: VB100, items: [{ geom, fill: hex, cls: 'piece' }] });

  const targetRot = rotKey(fig.geom);
  const correctGeom = rotate90(fig.geom, k);
  const used = new Set([exactKey(correctGeom)]);
  const wrongs = [];
  const need = d.options - 1;
  const add = (geom, key) => {
    const e = exactKey(geom);
    if (wrongs.length >= need || used.has(e)) return;
    used.add(e);
    wrongs.push({ geom, key });
  };
  const mirror = mirrorX(fig.geom);
  if (band === '6-8' && level >= 1 && rotKey(mirror) !== targetRot) {
    const q = rng.int(4);
    add(rotate90(mirror, q), `mirror:${fig.id}:${q}`); // ayna goruntusu: donmeyle elde edilemez
  }
  for (const f of rng.shuffle(figs.filter((f) => f.id !== fig.id && rotKey(f.geom) !== targetRot))) {
    const q = rng.int(4);
    add(rotate90(f.geom, q), `fig:${f.id}:${q}`);
  }
  const correct = { id: 'ok', key: `rot:${fig.id}:${k}`, scene: scene(correctGeom, optionHex) };
  const wrong = wrongs.map((w, i) => ({ id: `w${i}`, key: w.key, scene: scene(w.geom, optionHex) }));
  return finish(
    {
      id, kind: 'rotate', voice: 'rotate', prompt: scene(fig.geom, promptHex), solvedPrompt: scene(fig.geom, promptHex),
      hint: 'prompt', hintMode: 'narrow', answerTurn: k
    },
    rng, correct, wrong
  );
}

// ---- Simetriyi tamamla ---------------------------------------------------------
const AXIS = { type: 'poly', points: [[49.2, 6], [50.8, 6], [50.8, 94], [49.2, 94]] };
const SYM_HOLE = { type: 'poly', points: [[54, 8], [92, 8], [92, 92], [54, 92]] };

function makeSymmetry({ data, rng, band, level, prevId }) {
  const d = difficulty(band, level);
  const halves = data.figures.symmetry;
  let half, id;
  for (let t = 0; t < 12; t++) {
    half = rng.pick(halves);
    id = `symmetry:${half.id}`;
    if (id !== prevId) break;
  }
  const hex = hexOf(data, rng.pick(data.colors.palette).id);
  const left = half.geom;
  const mirror = mirrorX(left);
  const other = rng.pick(halves.filter((h) => h.id !== half.id));
  const near = band === '6-8' && level >= 2;
  const cands = near
    ? [['shift', translate(mirror, 0, 12)], ['flip', flipY(mirror)], ['copy', translate(left, 50, 0)], ['other', mirrorX(other.geom)]]
    : [['copy', translate(left, 50, 0)], ['flip', flipY(mirror)], ['other', mirrorX(other.geom)]];

  const composite = (rightGeom, solved = false) => ({
    vb: VB100,
    items: [
      { geom: left, fill: hex, cls: 'piece' },
      { geom: AXIS, fill: '#b8c2d6', cls: 'axis' },
      { geom: rightGeom, fill: hex, cls: solved ? 'piece solved-piece fold' : 'piece' }
    ]
  });
  const used = new Set([exactKey(mirror)]);
  const wrongs = [];
  for (const [tag, g] of cands) {
    const e = exactKey(g);
    if (wrongs.length >= d.options - 1 || used.has(e)) continue;
    used.add(e);
    wrongs.push({ tag, g });
  }
  const prompt = {
    vb: VB100,
    items: [
      { geom: left, fill: hex, cls: 'piece' },
      { geom: AXIS, fill: '#b8c2d6', cls: 'axis' },
      { geom: SYM_HOLE, fill: 'none', dash: true, cls: 'hole', role: 'hole' },
      { text: '?', x: 73, y: 50, size: 22, cls: 'qmark' }
    ]
  };
  const correct = { id: 'ok', key: `sym:${half.id}:mirror`, scene: composite(mirror) };
  const wrong = wrongs.map((w, i) => ({ id: `w${i}`, key: `sym:${half.id}:${w.tag}`, scene: composite(w.g) }));
  return finish(
    { id, kind: 'symmetry', voice: 'symmetry', prompt, solvedPrompt: composite(mirror, true), hint: 'hole', hintMode: 'narrow' },
    rng, correct, wrong
  );
}

// ---- Disariya acilan kapi ------------------------------------------------------
const MAKERS = { complete: makeComplete, matchColor: makeColor, matchShape: makeShape, pattern: makePattern, rotate: makeRotate, symmetry: makeSymmetry };

// prevKind: bir onceki turun tipi; mumkunse arka arkaya ayni gorev tipi gelmez.
export function makeGeometryRound(ctx) {
  let weights = kindWeights(ctx.band, ctx.level);
  if (ctx.prevKind) {
    const rest = weights.filter(([k]) => k !== ctx.prevKind);
    if (rest.length) weights = rest;
  }
  const kind = ctx.kind || ctx.rng.weighted(weights);
  return MAKERS[kind](ctx);
}
