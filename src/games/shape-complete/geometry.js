// Saf geometri yardimcilari. Sekil verisi assets/data/shapes.json'dan gelir.
// Desteklenen tipler: circle {cx,cy,r}, sector {cx,cy,r,from,to}, poly {points}.
const RAD = Math.PI / 180;
const mod360 = (a) => ((a % 360) + 360) % 360;
export const fmt = (n) => String(Math.round(n * 100) / 100);
const r1 = (n) => Math.round(n * 10) / 10;

export function toPath(g) {
  if (g.type === 'circle') {
    const { cx, cy, r } = g;
    return `M${fmt(cx - r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx + r)} ${fmt(cy)}A${fmt(r)} ${fmt(r)} 0 1 0 ${fmt(cx - r)} ${fmt(cy)}Z`;
  }
  if (g.type === 'sector') {
    const { cx, cy, r, from, to } = g;
    const x0 = cx + r * Math.cos(from * RAD);
    const y0 = cy + r * Math.sin(from * RAD);
    const x1 = cx + r * Math.cos(to * RAD);
    const y1 = cy + r * Math.sin(to * RAD);
    const large = to - from > 180 ? 1 : 0;
    return `M${fmt(cx)} ${fmt(cy)}L${fmt(x0)} ${fmt(y0)}A${fmt(r)} ${fmt(r)} 0 ${large} 1 ${fmt(x1)} ${fmt(y1)}Z`;
  }
  if (g.type === 'poly') {
    return 'M' + g.points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L') + 'Z';
  }
  throw new Error(`Bilinmeyen geometri tipi: ${g.type}`);
}

export function area(g) {
  if (g.type === 'circle') return Math.PI * g.r * g.r;
  if (g.type === 'sector') return 0.5 * g.r * g.r * (g.to - g.from) * RAD;
  let s = 0;
  const p = g.points;
  for (let i = 0; i < p.length; i++) {
    const [x0, y0] = p[i];
    const [x1, y1] = p[(i + 1) % p.length];
    s += x0 * y1 - x1 * y0;
  }
  return Math.abs(s) / 2;
}

export function contains(g, x, y) {
  if (g.type === 'circle') return (x - g.cx) ** 2 + (y - g.cy) ** 2 <= g.r * g.r;
  if (g.type === 'sector') {
    const dx = x - g.cx;
    const dy = y - g.cy;
    if (dx * dx + dy * dy > g.r * g.r) return false;
    return mod360(Math.atan2(dy, dx) / RAD - g.from) <= g.to - g.from;
  }
  let inside = false;
  const p = g.points;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const [xi, yi] = p[i];
    const [xj, yj] = p[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function bbox(g) {
  if (g.type === 'circle') return { x0: g.cx - g.r, y0: g.cy - g.r, x1: g.cx + g.r, y1: g.cy + g.r };
  const pts = [];
  if (g.type === 'sector') {
    const at = (a) => [g.cx + g.r * Math.cos(a * RAD), g.cy + g.r * Math.sin(a * RAD)];
    pts.push([g.cx, g.cy], at(g.from), at(g.to));
    for (const a of [0, 90, 180, 270]) if (mod360(a - g.from) <= g.to - g.from) pts.push(at(a));
  } else {
    pts.push(...g.points);
  }
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

export function bboxCenter(g) {
  const b = bbox(g);
  return [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2];
}

// (x,y) -> (cx + (x-50)*k, cy + (y-50)*k)   [0..100 kutusundaki geometriyi olcekle/tasi]
export function place(g, k, cx, cy) {
  const mx = (x) => cx + (x - 50) * k;
  const my = (y) => cy + (y - 50) * k;
  if (g.type === 'circle') return { type: 'circle', cx: mx(g.cx), cy: my(g.cy), r: g.r * k };
  if (g.type === 'sector') return { ...g, cx: mx(g.cx), cy: my(g.cy), r: g.r * k };
  return { type: 'poly', points: g.points.map(([x, y]) => [mx(x), my(y)]) };
}

export function translate(g, dx, dy) {
  if (g.type === 'circle' || g.type === 'sector') return { ...g, cx: g.cx + dx, cy: g.cy + dy };
  return { type: 'poly', points: g.points.map(([x, y]) => [x + dx, y + dy]) };
}

// Parcayi sadece kendi sinirlayici kutusunun merkezi (50,50) olacak sekilde ortala.
export function centered(g, cx = 50, cy = 50) {
  const [bx, by] = bboxCenter(g);
  return translate(g, cx - bx, cy - by);
}

// Iki parcanin ayni gorunup gorunmedigini (konumdan bagimsiz) anlatan anahtar.
export function silhouetteKey(g) {
  if (g.type === 'circle') return `C|${r1(g.r)}`;
  if (g.type === 'sector') return `S|${r1(g.r)}|${r1(g.to - g.from)}|${r1(mod360(g.from))}`;
  const b = bbox(g);
  const pts = g.points.map(([x, y]) => `${r1(x - b.x0)},${r1(y - b.y0)}`).sort();
  return `P|${pts.join(';')}`;
}

export function features(g) {
  const b = bbox(g);
  return {
    kind: g.type,
    curved: g.type !== 'poly',
    area: area(g),
    aspect: (b.x1 - b.x0) / (b.y1 - b.y0),
    n: g.type === 'poly' ? g.points.length : 0
  };
}

// Iki parca arasindaki "gorsel benzemezlik" (buyuk = birbirinden cok farkli).
export function distance(fa, fb) {
  let d = 0;
  if (fa.curved !== fb.curved) d += 2;
  d += Math.abs(Math.log(fa.area / fb.area)) * 1.2;
  d += Math.abs(Math.log(fa.aspect / fb.aspect));
  if (fa.kind === 'poly' && fb.kind === 'poly') d += Math.abs(fa.n - fb.n) * 0.3;
  return d;
}

// ---- Dondurme / yansima (sadece cokgen; figures.json sekilleri) -------------------------
const polyOnly = (g) => {
  if (g.type !== 'poly') throw new Error('Bu islem sadece cokgenler icin');
};
const mapPts = (g, fn) => {
  polyOnly(g);
  return { type: 'poly', points: g.points.map(([x, y]) => fn(x, y)) };
};

// k adet ceyrek tur saat yonunde, (50,50) merkezli: (x,y) -> (100-y, x)
export function rotate90(g, k = 1) {
  let out = g;
  for (let i = 0; i < ((k % 4) + 4) % 4; i++) out = mapPts(out, (x, y) => [100 - y, x]);
  return out;
}
// Dikey eksene (x = axis) gore yansima
export const mirrorX = (g, axis = 50) => mapPts(g, (x, y) => [2 * axis - x, y]);
// Yatay eksene (y = 50) gore yansima (ters cevirme)
export const flipY = (g) => mapPts(g, (x, y) => [x, 100 - y]);

const rnd1 = (n) => Math.round(n * 10) / 10;
// Konuma DUYARLI anahtar (silhouetteKey konumdan bagimsizdir)
export function exactKey(g) {
  polyOnly(g);
  return 'X|' + g.points.map(([x, y]) => `${rnd1(x)},${rnd1(y)}`).sort().join(';');
}
// Donmeye (0/90/180/270) gore degismeyen anahtar: iki sekil birbirinin donmusu ise ayni anahtari verir
export function rotKey(g) {
  const keys = [0, 1, 2, 3].map((k) => silhouetteKey(rotate90(g, k)));
  return keys.sort()[0];
}
