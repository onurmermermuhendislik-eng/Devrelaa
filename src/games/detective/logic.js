// Elektrik Dedektifi saf mantigi (DOM yok). Devre benzetimi Mucit Atolyesi (games/invent/logic.js analyze) ile AYNI;
// ikinci bir benzetim motoru YOKTUR. Vaka verisi assets/data/detective.json'dadir.
import { buildParts, analyze } from '../invent/logic.js';
import { taskResult } from '../learn/logic.js';

const startStates = (t) => ({ ...(t.states || {}), ...Object.fromEntries((t.closed || []).map((id) => [id, 'closed'])) });
export const startState = (t) => ({ slots: t.slots.slice(), states: startStates(t) });

export const layoutOf = (inv, t) => inv.layouts[t.layout];
export const partsOf = (inv, t, slots, states) => {
  const L = layoutOf(inv, t);
  return { L, parts: buildParts(L, slots, states) };
};

// Cozum olcutu (ortak): devre yanmali (kisa devre degil), istenen parcalar tahtada, goal.minLit kadar LED yanmali
// ve devredeki TUM LED'ler yanmali (yanmayan lamba = vaka cozulmedi). Ipucu anahtari taskResult ile ayni (V7.5 parca adli ipuclari).
export function evaluate(inv, t, slots, states) {
  const goal = t.goal || { lit: true };
  const r = taskResult(inv, { lit: true, with: goal.with, series: goal.series, parallel: goal.parallel }, slots, states, t.layout);
  const a = r.analysis;
  const allLit = a.ledCount > 0 && a.lit === a.ledCount;
  const minOk = a.lit >= (goal.minLit || 1);
  const ok = r.ok && allLit && minOk;
  let key = r.key;
  if (!ok && r.ok) key = 'notall'; // yanan var ama bazi lambalar yanmiyor / yeterince lamba yok
  return { ok, key, analysis: a };
}

// Eksik parca vakasi: bir secenek konunca cozuluyor mu? (tek bos konum)
export function placeOption(inv, t, type) {
  const st = startState(t);
  const i = st.slots.findIndex((x) => !x);
  if (i < 0) return { index: -1, ...evaluate(inv, t, st.slots, st.states) };
  st.slots[i] = type;
  if (type === 'switch') st.states[`s${i + 1}`] = st.states[`s${i + 1}`] || 'open';
  return { index: i, slots: st.slots, states: st.states, ...evaluate(inv, t, st.slots, st.states) };
}

// Ariza vakasi: dokunulan konum bir arıza mi? Duzeltilmis hali (kalan arizalar ayni kalir) dondurur.
export function tapFault(t, slots, states, fixed, slotId) {
  const c = (t.culprits || []).find((x) => x.slot === slotId);
  if (!c || fixed.includes(slotId)) return { hit: false };
  const i = Number(slotId.slice(1)) - 1;
  const nslots = slots.slice();
  const nstates = { ...states };
  if (c.fix === 'close') nstates[slotId] = 'closed';
  else nslots[i] = c.fix;
  return { hit: true, slots: nslots, states: nstates, fixed: [...fixed, slotId] };
}

// Sagliklı konum ipucu: vakaya ozel (hints[slotId]) > parca turu (healthy[tur])
export function healthyHint(t, T, slots, states, slotId) {
  if (t.hints && typeof t.hints[slotId] === 'string' && t.hints[slotId]) return t.hints[slotId];
  const i = Number(slotId.slice(1)) - 1;
  const type = slots[i];
  if (type === 'switch') return T.healthy.switch;
  return (type && T.healthy[type]) || T.wrongTap;
}

// Yanlis secenek/baglanti icin ipucu metni: vakaya ozel hints[secenek|anahtar] > genel T.hints[anahtar]
export function hintFor(t, T, ref, key) {
  const own = t.hints && typeof t.hints[ref] === 'string' ? t.hints[ref] : '';
  if (own) return own;
  return (key && T.hints[key]) || '';
}

// Zorunlu alanlar ve 4-5 yas secenek siniri (veri dogrulama; test ve cagirici icin)
export function validateTask(t, inv) {
  const errs = [];
  if (!['missing', 'build', 'fault'].includes(t.kind)) errs.push('kind');
  if (!inv.layouts[t.layout]) errs.push('layout');
  else if (!Array.isArray(t.slots) || t.slots.length !== inv.layouts[t.layout].slots.length) errs.push('slots');
  if (t.kind === 'missing' && (!Array.isArray(t.options) || !t.options.length || !Array.isArray(t.answer) || !t.answer.length)) errs.push('options');
  if (t.kind === 'build' && (!Array.isArray(t.tools) || !t.tools.length)) errs.push('tools');
  if (t.kind === 'fault' && (!Array.isArray(t.culprits) || !t.culprits.length)) errs.push('culprits');
  return errs;
}
