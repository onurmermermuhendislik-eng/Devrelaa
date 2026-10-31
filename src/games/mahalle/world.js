// Mahalle Macerasi — ASAMA 1 (R1) dunya verisi + carpisma. SAF mantik (DOM/canvas yok): node testleriyle dogrulanir.
// Birim: "dunya birimi" (du). Cocuk ~64 du boyunda. Kamera olcegi ekrana gore index.js'de hesaplanir.
// Yerlesim: iki yatay yol (R1 kuzey, R2 guney) + dikey yol; kuzey sirada OKUL ve ATOLYE, guney sirada EV ve MARKET (kapilar kaldirima bakar).
export const WORLD = { w: 1800, h: 1160 };
export const PLAYER_R = 13; // ayak carpisma yaricapi (du)

const road = (x, y, w, h) => ({ x, y, w, h });
export const ROADS = [road(0, 520, 1800, 100), road(0, 980, 1800, 100), road(850, 0, 100, 1160)];
export const SIDEWALKS = [
  road(0, 480, 1800, 40), road(0, 620, 1800, 40), road(0, 940, 1800, 40), road(0, 1080, 1800, 40),
  road(810, 0, 40, 1160), road(950, 0, 40, 1160)
];

// Mekanlar: kapi merkezi cx, taban cizgisi yb, genislik w, yukseklik h. Cephenin tamami carpisma alanidir (icinden gecilmez).
const place = (id, kind, name, x, yb, w, h) => ({ id, kind, name, x, yb, w, h, cx: x + w / 2, enter: true });
const deco = (id, kind, x, yb, w, h) => ({ id, kind, name: '', x, yb, w, h, cx: x + w / 2, enter: false });
export const PLACES = [
  place('okul', 'school', 'OKUL', 120, 470, 400, 290),
  place('atolye', 'workshop', 'ATÖLYE', 1130, 470, 360, 270),
  place('ev', 'home', 'EV', 150, 930, 320, 250),
  place('market', 'market', 'MARKET', 1180, 930, 380, 260)
];
export const BUILDINGS = [
  ...PLACES,
  deco('komsu1', 'home2', 585, 470, 200, 190),
  deco('komsu2', 'home3', 1540, 470, 220, 200),
  deco('komsu3', 'home3', 525, 930, 250, 210),
  deco('komsu4', 'home2', 1000, 930, 150, 180),
  deco('komsu5', 'home2', 1600, 930, 170, 190)
];
const R = 16; // agac govdesi carpisma yaricapi
const tree = (x, y, s = 1) => ({ kind: 'tree', x, y, r: R * s, s });
export const TREES = [
  tree(60, 120), tree(200, 90, 1.1), tree(560, 110), tree(700, 90, 1.1), tree(780, 160), tree(1020, 100), tree(1120, 120, 1.1), tree(1540, 110), tree(1700, 140),
  tree(60, 400), tree(40, 700), tree(120, 790, 1.1), tree(300, 720), tree(430, 820), tree(560, 720, 1.1), tree(700, 800), tree(760, 700),
  tree(1030, 720), tree(1120, 820, 1.1), tree(1300, 730), tree(1480, 800), tree(1700, 720, 1.1), tree(1760, 860),
  tree(60, 1020), tree(520, 1130), tree(1100, 1130), tree(1700, 1130)
];
export const PROPS = [
  { kind: 'lamp', x: 230, y: 478, r: 7 }, { kind: 'lamp', x: 640, y: 478, r: 7 }, { kind: 'lamp', x: 1060, y: 478, r: 7 }, { kind: 'lamp', x: 1440, y: 478, r: 7 },
  { kind: 'lamp', x: 230, y: 664, r: 7 }, { kind: 'lamp', x: 640, y: 664, r: 7 }, { kind: 'lamp', x: 1060, y: 664, r: 7 }, { kind: 'lamp', x: 1440, y: 664, r: 7 },
  { kind: 'lamp', x: 400, y: 944, r: 7 }, { kind: 'lamp', x: 780, y: 944, r: 7 }, { kind: 'lamp', x: 1120, y: 944, r: 7 }, { kind: 'lamp', x: 1640, y: 944, r: 7 },
  { kind: 'bench', x: 420, y: 676, hw: 32, hh: 9 }, { kind: 'bench', x: 1250, y: 676, hw: 32, hh: 9 }, { kind: 'bench', x: 700, y: 492, hw: 32, hh: 9 },
  { kind: 'mailbox', x: 560, y: 485, r: 8 }, { kind: 'bin', x: 1500, y: 485, r: 8 }, { kind: 'bin', x: 1510, y: 950, r: 8 },
  { kind: 'pond', x: 640, y: 830, rx: 80, ry: 46, r: 0 }
];
export const FLOWERS = [
  [150, 500], [175, 505], [480, 505], [505, 500], [1160, 505], [1470, 500], [180, 962], [450, 965], [1210, 962], [1540, 965], [330, 700], [360, 690], [1330, 700], [1360, 712],
  [980, 690], [1000, 760], [1010, 840], [780, 880], [740, 700], [880, 700]
].map(([x, y]) => ({ x, y }));

export const START = { x: 830, y: 640, dir: 4 }; // kuzey yolun guney kaldirimi, dikey yolun yaninda (dir 4 = asagi)

// Carpisma: dikdortgenler (AABB) + daireler. Cocuk = daire (PLAYER_R).
const solids = () => {
  const rects = BUILDINGS.map((b) => ({ x: b.x, y: b.yb - b.h, w: b.w, h: b.h, id: b.id }));
  PROPS.filter((p) => p.kind === 'bench').forEach((p) => rects.push({ x: p.x - p.hw, y: p.y - p.hh, w: p.hw * 2, h: p.hh * 2, id: 'bench' }));
  const circles = [...TREES.map((t) => ({ x: t.x, y: t.y, r: t.r })), ...PROPS.filter((p) => p.r > 0).map((p) => ({ x: p.x, y: p.y, r: p.r }))];
  const ponds = PROPS.filter((p) => p.kind === 'pond').map((p) => ({ x: p.x, y: p.y, rx: p.rx, ry: p.ry }));
  return { rects, circles, ponds };
};
const SOLIDS = solids();
export const getSolids = () => SOLIDS;

// (px,py) daire merkezi: engele (veya dunya sinirina) deger mi?
export function blocked(px, py, r = PLAYER_R, S = SOLIDS) {
  if (px < r + 6 || py < r + 40 || px > WORLD.w - r - 6 || py > WORLD.h - r - 6) return true;
  for (const b of S.rects) {
    const cx = Math.max(b.x, Math.min(px, b.x + b.w));
    const cy = Math.max(b.y, Math.min(py, b.y + b.h));
    const dx = px - cx;
    const dy = py - cy;
    if (dx * dx + dy * dy < r * r) return true;
  }
  for (const c of S.circles) {
    const dx = px - c.x;
    const dy = py - c.y;
    const rr = r + c.r;
    if (dx * dx + dy * dy < rr * rr) return true;
  }
  for (const p of S.ponds) {
    const dx = (px - p.x) / (p.rx + r * 0.6);
    const dy = (py - p.y) / (p.ry + r * 0.6);
    if (dx * dx + dy * dy < 1) return true;
  }
  return false;
}

// Giris bolgeleri: kapinin onundeki kaldirim alani (cocugun ayak noktasi bu dikdortgendeyse "Iceri Gir" aktif)
export const entrances = () =>
  PLACES.map((p) => ({ id: p.id, name: p.name, kind: p.kind, door: { x: p.cx, y: p.yb }, zone: { x: p.cx - 74, y: p.yb + 2, w: 148, h: 78 }, exit: { x: p.cx, y: p.yb + 46 } }));
export const ENTRANCES = entrances();
export const entranceAt = (x, y) => ENTRANCES.find((e) => x >= e.zone.x && x <= e.zone.x + e.zone.w && y >= e.zone.y && y <= e.zone.y + e.zone.h) || null;
