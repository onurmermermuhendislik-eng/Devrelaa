// Mucit Atolyesi saf mantigi (DOM yok). Devre benzetimi (shape-complete/circuit-sim.js) DEGISTIRILMEDEN kullanilir.
// Atolye katmani yol bazli bir cocuk modeli kullanir (asagida belgelendi); simulate() yalnizca topoloji/akim yonu icin cagrilir.
import { simulate, conducts } from '../shape-complete/circuit-sim.js';

export const TOOLS = ['wire', 'led', 'resistor', 'switch'];
const NO_STATE = (t) => (t === 'switch' ? 'open' : undefined);

// layout: invent.json > layouts[x]; slots: [tip|null]; states: { slotId: 'open'|'closed' }
export function buildParts(layout, slots, states = {}) {
  const parts = [{ id: layout.battery.id, type: 'battery', a: layout.battery.a, b: layout.battery.b }];
  layout.slots.forEach((s, i) => {
    const type = slots[i] || null;
    parts.push({ id: s.id, type, a: s.a, b: s.b, accepts: 'any', state: type === 'switch' ? states[s.id] || NO_STATE(type) : undefined });
  });
  return parts;
}

// Pilin arti ucundan eksi ucuna giden tum basit yollar (parca listeleri)
export function pathsOf(parts) {
  const battery = parts.find((p) => p.type === 'battery');
  if (!battery) return [];
  const adj = {};
  for (const p of parts) {
    if (p === battery || !conducts(p)) continue;
    (adj[p.a] ||= []).push({ part: p, other: p.b });
    (adj[p.b] ||= []).push({ part: p, other: p.a });
  }
  const out = [];
  const dfs = (node, seen, edges) => {
    if (node === battery.a) return void out.push(edges.slice());
    for (const { part, other } of adj[node] || []) {
      if (seen.has(other)) continue;
      seen.add(other);
      edges.push(part);
      dfs(other, seen, edges);
      edges.pop();
      seen.delete(other);
    }
  };
  dfs(battery.b, new Set([battery.b]), []);
  return out;
}

// ---- Atolye devre modeli (SINIRLAMALAR: cocuk seviyesinde, sadelestirilmis; gercek Ohm yasasi / LED akim-gerilim egrisi HESAPLANMAZ) ----
// Topoloji (hangi yollar kapali) mevcut simulate() ile ayni bicimde, pilden pile giden tum basit yollarla bulunur.
// Her yol bagimsiz bir "kol"dur (ideal pil: paralel kollar birbirini etkilemez; seri parcalar ayni yolu paylasir).
// Yol yuku  L = LED sayisi + 0.5 x direnc sayisi.  Parlaklik b = 1 / L^0.8  (L arttikca azalir; hic artmaz).
// Pil en fazla LOAD_MAX = 3 yuk tasir: L > 3 ise o yoldaki LED'ler YANMAZ ("pil yetmedi").
// LED'siz ve direncsiz yol = kisa devre: pil yorulur, hicbir LED yanmaz. Bir LED birden cok yolun ustundeyse en parlak yolu gecerlidir.
import { brightnessLevel } from '../shape-complete/circuit-sim.js';
export const LOAD_MAX = 3;
export const loadOf = (path) => path.filter((e) => e.type === 'led').length + 0.5 * path.filter((e) => e.type === 'resistor').length;
export const brightnessOf = (load) => (load < 1 ? 1 : 1 / Math.pow(load, 0.8));

// Benzetim + atolye kurallari -> ekran icin sim (boardSvg ile ayni bicim) ve cocuk dostu cozumleme
export function analyze(parts) {
  const base = simulate(parts); // kapali mi / akim yonleri (animasyon) icin mevcut simulator
  const paths = pathsOf(parts);
  const short = paths.some((p) => !p.some((e) => e.type === 'led' || e.type === 'resistor'));
  const leds = parts.filter((p) => p.type === 'led');
  const raw = Object.fromEntries(leds.map((l) => [l.id, 0]));
  const litPaths = []; // yanan LED'i olan yollar (kimlik listesi)
  let weak = false; // pil yetmedi: LED'li yol var ama yuk cok
  if (!short) {
    for (const p of paths) {
      const load = loadOf(p);
      const ledIds = p.filter((e) => e.type === 'led').map((e) => e.id);
      if (!ledIds.length) continue;
      if (load > LOAD_MAX) {
        weak = true;
        continue;
      }
      const b = brightnessOf(load);
      for (const id of ledIds) raw[id] = Math.max(raw[id], b);
      litPaths.push({ ids: ledIds, resistor: p.some((e) => e.type === 'resistor'), load });
    }
  }
  const levels = Object.fromEntries(Object.entries(raw).map(([id, b]) => [id, brightnessLevel(b)]));
  const sim = { ...base, levels, leds: raw };
  const litIds = Object.keys(levels).filter((k) => levels[k] > 0);
  const lit = litIds.length;
  const hasSwitch = parts.some((p) => p.type === 'switch');
  // Anahtarlar kapatilsaydi devre calisir miydi? (ipucu icin)
  const closedAll = parts.map((p) => (p.type === 'switch' ? { ...p, state: 'closed' } : p));
  const wouldClose = !base.closed && simulate(closedAll).closed;
  // Kesif kosullari (yalnizca gercekten yanan LED'lerden):
  const seriesLit = litPaths.some((p) => p.ids.filter((id) => levels[id] > 0).length >= 2);
  let parallelLit = false;
  for (let i = 0; i < litPaths.length && !parallelLit; i++)
    for (let j = i + 1; j < litPaths.length && !parallelLit; j++) {
      const A = litPaths[i].ids.filter((id) => levels[id] > 0);
      const B = litPaths[j].ids.filter((id) => levels[id] > 0);
      parallelLit = A.some((id) => !B.includes(id)) && B.some((id) => !A.includes(id)); // iki ayri kolda, farkli yanan LED'ler
    }
  return {
    sim,
    closed: base.closed,
    short,
    weak: weak && lit === 0,
    ledCount: leds.length,
    lit,
    litIds,
    hasSwitch,
    wouldClose,
    paths: paths.length,
    resistorOnLit: litPaths.some((p) => p.resistor && p.ids.some((id) => levels[id] > 0)),
    seriesLit,
    parallelLit,
    brightest: lit ? Math.max(...litIds.map((k) => levels[k])) : 0,
    filled: parts.filter((p) => p.type && p.type !== 'battery').length,
    gaps: parts.filter((p) => !p.type).map((p) => p.id)
  };
}

// Kisa, nazik ipucu anahtari (cevabi dayatmaz; dikkati yonlendirir). focus: ne vurgulanacak
export function hintFor(a) {
  if (a.lit > 0 && !a.short) return { key: 'lit', focus: null };
  if (a.short) return { key: 'short', focus: 'led' };
  if (a.weak) return { key: 'weak', focus: null };
  if (a.ledCount === 0) return { key: 'noled', focus: 'led' };
  if (!a.closed && a.wouldClose && a.hasSwitch) return { key: 'switch', focus: 'switch' };
  if (!a.closed) return { key: 'gap', focus: 'gaps' };
  return { key: 'ledoff', focus: 'gaps' };
}

// Bu durumda hangi kesifler gecerli? (anahtar kesfi denetleyicide: kapaliyken sonuk -> acikken yanik gecisi)
export function discoveriesIn(a, layoutId) {
  const d = [];
  if (a.lit >= 1) d.push('light');
  if (a.resistorOnLit) d.push('resistor');
  if (a.seriesLit) d.push('series');
  if (a.parallelLit) d.push('parallel');
  if (a.short) d.push('short');
  void layoutId;
  return d;
}

// Anahtar kesfi: ayni dizilimde anahtar acilip kapaninca isik degisti mi?
export const switchDiscovery = (before, after) => before.hasSwitch && after.hasSwitch && (before.lit > 0) !== (after.lit > 0);

export const signature = (layoutId, slots, states = {}) => `${layoutId}:${slots.map((t, i) => (t === 'switch' ? `${t}-${states[`s${i + 1}`] || 'open'}` : t || '_')).join(',')}`;
