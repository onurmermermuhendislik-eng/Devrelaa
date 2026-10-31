// Sayi Avi tur uretici (saf mantik, DOM yok -> kolay test edilir). Veri: assets/data/numbers.json
// Bir tur: { id, kind, idea, voice, voiceText, prompt, solvedPrompt, options:[{id,key,value,view}], answer, hint, hintMode }
//  prompt/solvedPrompt/view: render.js'in cizdigi yapisal tanimlar (HTML degil).
//  Gorev tipleri  4-5 yas: count, numToGroup, pickGroup, missing        (aralik 1-5, 2-3 secenek)
//                 6-8 yas: findNumber, missingNumber, add, subtract, sequence (aralik kademeli 1-10)

export const tierConfig = (nh, band, tier) => {
  const list = nh.tiers[band];
  return list[Math.max(0, Math.min(list.length - 1, tier | 0))];
};

const cap = (s) => s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1);
const fmt = (tpl, vars) => cap(tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k]));

// answer disindaki [1..max] sayilarindan (count-1) tane celdirici sec.
// mode 'far': mumkunse en az 2 farkli (kucuk cocuk icin kolay ayirt edilsin); 'near': yakin sayilar (bilissel zorluk)
function distractors(rng, answer, max, count, mode = 'near') {
  const pool = [];
  for (let v = 1; v <= max; v++) if (v !== answer) pool.push(v);
  const need = count - 1;
  let cand = pool;
  if (mode === 'far') {
    const far = pool.filter((v) => Math.abs(v - answer) >= 2);
    if (far.length >= need) cand = far;
  } else {
    cand = pool.slice().sort((a, b) => Math.abs(a - answer) - Math.abs(b - answer)).slice(0, Math.max(need + 1, 3));
  }
  return rng.shuffle(cand).slice(0, need);
}

const numeralOpt = (v, dots) => ({ id: '', key: `n:${v}`, value: v, view: { type: 'numeral', value: v, dots } });
const groupOpt = (object, v) => ({ id: '', key: `g:${object}:${v}`, value: v, view: { type: 'group', object, count: v } });

function finish(rng, round, correct, wrong) {
  const all = rng.shuffle([{ ...correct, id: 'ok' }, ...wrong.map((w, i) => ({ ...w, id: `w${i}` }))]);
  return { ...round, options: all, answer: all.findIndex((o) => o.id === 'ok') };
}

// Id'si bir onceki turla ayni olmayan bir tur uretmeyi dener (parametreler degisir)
function retry(gen, prevId) {
  let r;
  for (let t = 0; t < 12; t++) {
    r = gen();
    if (r.id !== prevId) break;
  }
  return r;
}

export function makeRound(ctx) {
  const { data, rng, band } = ctx;
  const nh = data.game['number-hunt'];
  const cfg = tierConfig(nh, band, ctx.tier);
  let weights = cfg.kinds;
  if (ctx.prevKind) {
    const rest = weights.filter(([k]) => k !== ctx.prevKind);
    if (rest.length) weights = rest;
  }
  const kind = ctx.kind || rng.weighted(weights);
  const env = { nh, cfg, rng, band, prevId: ctx.prevId };
  const round = retry(() => MAKERS[kind](env), ctx.prevId);
  const vkey = kind === 'subtract' && round.away === 1 ? 'subtract1' : kind;
  return { ...round, kind, idea: nh.ideas[kind], voice: `nh_${vkey}`, hintMode: 'narrow' };
}

const voiceOf = (nh, key, vars = {}) => fmt(nh.voice[key], vars);
const wordOf = (nh, n) => nh.words[n];

// ---- 4-5: Nesneleri say / 6-8: Dogru sayiyi bul ------------------------------------
function makeCount({ nh, cfg, rng, band }, kind) {
  const obj = rng.pick(nh.objects);
  const n = 1 + rng.int(cfg.max);
  const dots = band === '4-5';
  const wrong = distractors(rng, n, cfg.max, cfg.options, dots && cfg.max <= 3 ? 'far' : 'near').map((v) => numeralOpt(v, dots));
  return finish(
    rng,
    {
      id: `nh:${kind}:${obj.id}:${n}`,
      prompt: { type: 'objects', object: obj.id, count: n },
      solvedPrompt: { type: 'objects', object: obj.id, count: n, solved: true },
      voiceText: voiceOf(nh, kind, { noun: obj.noun }),
      hint: 'objects'
    },
    numeralOpt(n, dots),
    wrong
  );
}

// ---- 4-5: Sayi ile miktari eslestir ----------------------------------------------------
function makeNumToGroup({ nh, cfg, rng }) {
  const obj = rng.pick(nh.objects);
  const n = 1 + rng.int(cfg.max);
  const wrong = distractors(rng, n, cfg.max, cfg.options, cfg.max <= 3 ? 'far' : 'near').map((v) => groupOpt(obj.id, v));
  return finish(
    rng,
    {
      id: `nh:numToGroup:${obj.id}:${n}`,
      prompt: { type: 'numeral', value: n },
      solvedPrompt: { type: 'numeral', value: n, solved: true },
      voiceText: voiceOf(nh, 'numToGroup', { n: wordOf(nh, n) }),
      hint: 'prompt'
    },
    groupOpt(obj.id, n),
    wrong
  );
}

// ---- 4-5: Istenen sayida nesneyi bul ("Uc yildiz bul") -------------------------------------
function makePickGroup({ nh, cfg, rng }) {
  const [obj, other] = rng.shuffle(nh.objects);
  const n = 1 + rng.int(cfg.max);
  const m = distractors(rng, n, cfg.max, 2, 'near')[0]; // ayni nesne, yanlis miktar
  const wrong = [groupOpt(obj.id, m), groupOpt(other.id, n)]; // dogru miktar ama yanlis nesne
  if (cfg.options > 3) wrong.push(groupOpt(other.id, m));
  return finish(
    rng,
    {
      id: `nh:pickGroup:${obj.id}:${n}`,
      prompt: { type: 'target', object: obj.id, count: n },
      solvedPrompt: { type: 'target', object: obj.id, count: n, solved: true },
      voiceText: voiceOf(nh, 'pickGroup', { n: wordOf(nh, n), noun: obj.noun }),
      hint: 'prompt'
    },
    groupOpt(obj.id, n),
    wrong.slice(0, cfg.options - 1)
  );
}

// ---- 4-5: Eksik miktari tamamla --------------------------------------------------------
function makeMissing({ nh, cfg, rng }) {
  const obj = rng.pick(nh.objects);
  const total = 2 + rng.int(cfg.max - 1); // 2..max
  const filled = 1 + rng.int(total - 1); // 1..total-1
  const miss = total - filled;
  const wrong = distractors(rng, miss, cfg.max, cfg.options, 'near').map((v) => groupOpt(obj.id, v));
  return finish(
    rng,
    {
      id: `nh:missing:${obj.id}:${total}:${filled}`,
      prompt: { type: 'slots', object: obj.id, total, filled },
      solvedPrompt: { type: 'slots', object: obj.id, total, filled: total, was: filled, solved: true },
      voiceText: voiceOf(nh, 'missing'),
      hint: 'slots'
    },
    groupOpt(obj.id, miss),
    wrong
  );
}

// ---- 6-8: Eksik sayiyi bul -----------------------------------------------------------------
function makeMissingNumber({ nh, cfg, rng }) {
  const len = cfg.seqLen;
  const down = !!cfg.descending && rng.int(2) === 1;
  const start = down ? len + rng.int(cfg.max - len + 1) : 1 + rng.int(cfg.max - len + 1);
  const items = Array.from({ length: len }, (_, i) => (down ? start - i : start + i));
  const hole = 1 + rng.int(len - 2); // ortadaki bir yer
  const answer = items[hole];
  const shown = items.map((v, i) => (i === hole ? null : v));
  const wrong = distractors(rng, answer, cfg.max, cfg.options, 'near').map((v) => numeralOpt(v, false));
  return finish(
    rng,
    {
      id: `nh:missingNumber:${down ? 'd' : 'u'}:${start}:${hole}`,
      prompt: { type: 'seq', items: shown, hole },
      solvedPrompt: { type: 'seq', items, hole, solved: true },
      voiceText: voiceOf(nh, 'missingNumber'),
      hint: 'hole'
    },
    numeralOpt(answer, false),
    wrong
  );
}

// ---- 6-8: Basit toplama ----------------------------------------------------------------------
function makeAdd({ nh, cfg, rng }) {
  const obj = rng.pick(nh.objects);
  let a, b;
  do {
    a = 1 + rng.int(5);
    b = 1 + rng.int(5);
  } while (a + b > cfg.addMax);
  const sum = a + b;
  const wrong = distractors(rng, sum, cfg.addMax, cfg.options, 'near').map((v) => numeralOpt(v, false));
  return finish(
    rng,
    {
      id: `nh:add:${obj.id}:${a}+${b}`,
      a,
      b,
      prompt: { type: 'sum', object: obj.id, a, b },
      solvedPrompt: { type: 'sum', object: obj.id, a, b, solved: true, result: sum },
      voiceText: voiceOf(nh, 'add'),
      hint: 'objects'
    },
    numeralOpt(sum, false),
    wrong
  );
}

// ---- 6-8: Basit cikarma -----------------------------------------------------------------------
function makeSubtract({ nh, cfg, rng }) {
  const obj = rng.pick(nh.objects);
  const total = 2 + rng.int(cfg.subMax - 1); // 2..subMax
  const kMax = cfg.subMax <= 5 ? 1 : Math.min(3, total - 1); // ilk kademede "bir tanesi gider"
  const away = 1 + rng.int(Math.min(kMax, total - 1));
  const left = total - away;
  const wrong = distractors(rng, left, cfg.max, cfg.options, 'near').map((v) => numeralOpt(v, false));
  return finish(
    rng,
    {
      id: `nh:subtract:${obj.id}:${total}-${away}`,
      total,
      away,
      prompt: { type: 'take', object: obj.id, total, away },
      solvedPrompt: { type: 'take', object: obj.id, total, away, solved: true },
      voiceText: away === 1 ? voiceOf(nh, 'subtract1') : voiceOf(nh, 'subtract', { k: wordOf(nh, away) }),
      hint: 'objects'
    },
    numeralOpt(left, false),
    wrong
  );
}

// ---- 6-8: Sayi orutusu ----------------------------------------------------------------------------
function makeSequence({ nh, cfg, rng }) {
  const rule = rng.pick(cfg.seqRules);
  let items, answer;
  if (rule === '+1') {
    const L = cfg.seqLen;
    const s = 1 + rng.int(cfg.max - L);
    items = Array.from({ length: L }, (_, i) => s + i);
    answer = s + L;
  } else if (rule === '+2') {
    const L = Math.min(cfg.seqLen, 4);
    const s = 1 + rng.int(Math.max(1, cfg.max - 2 * L));
    items = Array.from({ length: L }, (_, i) => s + 2 * i);
    answer = s + 2 * L;
  } else if (rule === '-1') {
    const L = cfg.seqLen;
    const s = L + 1 + rng.int(cfg.max - L);
    items = Array.from({ length: L }, (_, i) => s - i);
    answer = s - L;
  } else {
    const a = 1 + rng.int(cfg.max);
    let b = 1 + rng.int(cfg.max);
    if (b === a) b = a === cfg.max ? a - 1 : a + 1;
    const L = cfg.seqLen;
    items = Array.from({ length: L }, (_, i) => (i % 2 === 0 ? a : b));
    answer = L % 2 === 0 ? a : b;
  }
  const wrong = distractors(rng, answer, cfg.max, cfg.options, 'near').map((v) => numeralOpt(v, false));
  return finish(
    rng,
    {
      id: `nh:sequence:${rule}:${items.join(',')}`,
      rule,
      prompt: { type: 'seq', items: [...items, null], hole: items.length },
      solvedPrompt: { type: 'seq', items: [...items, answer], hole: items.length, solved: true },
      voiceText: voiceOf(nh, 'sequence'),
      hint: 'hole'
    },
    numeralOpt(answer, false),
    wrong
  );
}

const MAKERS = {
  count: (e) => makeCount(e, 'count'),
  findNumber: (e) => makeCount(e, 'findNumber'),
  numToGroup: makeNumToGroup,
  pickGroup: makePickGroup,
  missing: makeMissing,
  missingNumber: makeMissingNumber,
  add: makeAdd,
  subtract: makeSubtract,
  sequence: makeSequence
};
export const KINDS = Object.keys(MAKERS);
