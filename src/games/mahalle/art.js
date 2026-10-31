// Mahalle Macerasi — canvas cizimleri (cizgi film, sicak renk; ayni kontur rengi: karakter/bina/prop ayni sanat yonetimi).
// Statik nesneler (bina, agac, lamba...) bir kez kucuk "sprite" tuvaline cizilir, her karede yalniz drawImage + y-siralama yapilir (hafif).
import { WORLD, ROADS, SIDEWALKS, BUILDINGS, TREES, PROPS, FLOWERS, ENTRANCES } from './world.js';
import { facing } from './engine.js';

const OUT = '#3a2433';
function rr(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
const fillStroke = (c, fill, lw = 2) => { c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); };
const box = (c, x, y, w, h, r, fill, lw = 2) => { rr(c, x, y, w, h, r); fillStroke(c, fill, lw); };
const circ = (c, x, y, r, fill, lw = 0) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = fill; c.fill(); if (lw) { c.lineWidth = lw; c.strokeStyle = OUT; c.stroke(); } };
const text = (c, t, x, y, size, color, w = 900) => { c.font = `${w} ${size}px system-ui, "Segoe UI", Roboto, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = color; c.fillText(t, x, y); };

export function makeSprite(w, h, ppu, draw, ox = 0, oy = 0) {
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil(w * ppu)); cv.height = Math.max(1, Math.ceil(h * ppu));
  const c = cv.getContext('2d');
  c.scale(ppu, ppu); c.translate(-ox, -oy);
  draw(c);
  return { cv, ox, oy, w, h };
}

// ---- Binalar (yerel koordinat: (0,0) = cephe sol ust; taban cizgisi y = h) --------------------------------------
function windowPane(c, x, y, w, h, glass = '#9fd8ff') {
  box(c, x, y, w, h, 4, glass, 2);
  c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + w / 2, y); c.lineTo(x + w / 2, y + h); c.moveTo(x, y + h / 2); c.lineTo(x + w, y + h / 2); c.stroke();
  c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.moveTo(x + 4, y + h - 5); c.lineTo(x + 12, y + 4); c.lineTo(x + 18, y + 4); c.lineTo(x + 10, y + h - 5); c.fill();
}
function door(c, cx, h, fill, w = 50, dh = 78, round = true) {
  box(c, cx - w / 2 - 5, h - dh - 5, w + 10, dh + 5, 8, '#8a5a34', 2);
  box(c, cx - w / 2, h - dh, w, dh, round ? 8 : 3, fill, 2);
  circ(c, cx + w / 2 - 9, h - dh / 2 + 4, 3.5, '#ffd23f', 1.2);
  c.fillStyle = 'rgba(0,0,0,.12)'; rr(c, cx - w / 2 + 7, h - dh + 8, w - 14, dh * 0.35, 4); c.fill();
  box(c, cx - w / 2 - 10, h - 5, w + 20, 6, 2, '#cfc4b8', 1.5);
}
function sign(c, cx, y, t, w, bg, fg) {
  c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.moveTo(cx - w / 2 + 14, y + 26); c.lineTo(cx - w / 2 + 14, y + 36); c.moveTo(cx + w / 2 - 14, y + 26); c.lineTo(cx + w / 2 - 14, y + 36); c.stroke();
  box(c, cx - w / 2, y, w, 30, 9, bg, 2.4);
  text(c, t, cx, y + 16, 20, fg);
}
function shadow(c, w, h) { c.fillStyle = 'rgba(30,20,50,.22)'; c.beginPath(); c.ellipse(w / 2 + 8, h + 2, w / 2 + 14, 9, 0, 0, Math.PI * 2); c.fill(); }

const DRAW = {
  school(c, w, h) {
    shadow(c, w, h);
    box(c, 0, 64, w, h - 64, 6, '#f7e3b0', 2.4);
    c.fillStyle = 'rgba(0,0,0,.07)'; for (let x = 18; x < w; x += 36) c.fillRect(x, 78, 2, h - 90);
    box(c, -8, 40, w + 16, 34, 6, '#3b6fd6', 2.4); box(c, -8, 40, w + 16, 9, 4, '#5a8cf0', 0);
    box(c, w / 2 - 44, 6, 88, 44, 8, '#f0c75a', 2.4); circ(c, w / 2, 28, 15, '#fff', 2); c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(w / 2, 28); c.lineTo(w / 2, 18); c.moveTo(w / 2, 28); c.lineTo(w / 2 + 8, 30); c.stroke();
    c.strokeStyle = OUT; c.lineWidth = 2.4; c.beginPath(); c.moveTo(w - 40, 40); c.lineTo(w - 40, -8); c.stroke(); box(c, w - 40, -6, 26, 16, 2, '#e5483e', 1.8);
    [34, 100, w - 138, w - 72].forEach((x) => windowPane(c, x, 110, 38, 56));
    [34, 100, w - 138, w - 72].forEach((x) => windowPane(c, x, 188, 38, 46));
    door(c, w / 2, h, '#f0904a', 64, 82, true);
    sign(c, w / 2, 76, 'OKUL', 118, '#2f5fbf', '#fff');
    c.fillStyle = '#ffd23f'; [w / 2 - 44, w / 2 + 44].forEach((x) => { c.beginPath(); c.arc(x, 91, 4, 0, 7); c.fill(); });
  },
  workshop(c, w, h) {
    shadow(c, w, h);
    box(c, 0, 58, w, h - 58, 6, '#68c8bc', 2.4);
    c.strokeStyle = 'rgba(0,0,0,.13)'; c.lineWidth = 2; for (let y = 88; y < h - 10; y += 14) { c.beginPath(); c.moveTo(4, y); c.lineTo(w - 4, y); c.stroke(); }
    box(c, -8, 34, w + 16, 32, 6, '#3d4f66', 2.4); c.fillStyle = 'rgba(255,255,255,.12)'; for (let x = 6; x < w; x += 16) c.fillRect(x, 38, 6, 24);
    box(c, w - 80, -4, 34, 46, 4, '#7a5a4a', 2.2); box(c, w - 86, -10, 46, 12, 3, '#5a3f33', 2);
    // dis cark simgesi
    const gx = 56; const gy = 22; c.fillStyle = '#f0c75a'; for (let i = 0; i < 8; i++) { const a = (i * Math.PI) / 4; c.beginPath(); c.arc(gx + Math.cos(a) * 17, gy + Math.sin(a) * 17, 5, 0, 7); c.fill(); }
    circ(c, gx, gy, 14, '#f0c75a', 2); circ(c, gx, gy, 6, '#3d4f66', 0);
    windowPane(c, 24, 104, 64, 52, '#ffe9a0'); windowPane(c, w - 88, 104, 64, 52, '#ffe9a0');
    door(c, w / 2, h, '#e5683e', 60, 80, false);
    sign(c, w / 2, 70, 'ATÖLYE', 128, '#ffd23f', '#3a2433');
    c.fillStyle = '#e5483e'; c.beginPath(); c.moveTo(w / 2 - 50, 85); c.lineTo(w / 2 - 44, 85); c.lineTo(w / 2 - 49, 93); c.lineTo(w / 2 - 44, 93); c.lineTo(w / 2 - 53, 104); c.lineTo(w / 2 - 50, 96); c.lineTo(w / 2 - 55, 96); c.closePath(); c.fill(); // simsek
    box(c, 26, h - 44, 34, 30, 4, '#c98550', 2); box(c, 66, h - 36, 28, 22, 4, '#c98550', 2); circ(c, w - 50, h - 20, 15, '#9aa7b5', 2); circ(c, w - 50, h - 20, 6, '#6a7684', 0);
  },
  home(c, w, h) {
    shadow(c, w, h);
    box(c, 10, 90, w - 20, h - 90, 6, '#f4cfa6', 2.4);
    c.beginPath(); c.moveTo(-10, 100); c.lineTo(w / 2, 4); c.lineTo(w + 10, 100); c.closePath(); fillStroke(c, '#d8503e', 2.6);
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 2; for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-10 + i * 14, 100 - i * 18); c.lineTo(w + 10 - i * 14, 100 - i * 18); c.stroke(); }
    box(c, w - 92, 20, 28, 50, 3, '#9a5a44', 2.2); box(c, w - 98, 14, 40, 10, 3, '#7a4636', 2);
    circ(c, w / 2, 62, 16, '#9fd8ff', 2.2); c.strokeStyle = OUT; c.lineWidth = 1.6; c.beginPath(); c.moveTo(w / 2 - 16, 62); c.lineTo(w / 2 + 16, 62); c.moveTo(w / 2, 46); c.lineTo(w / 2, 78); c.stroke();
    [28, w - 28 - 52].forEach((x) => { windowPane(c, x, 122, 52, 56); box(c, x - 8, 122, 8, 56, 3, '#3f9d9a', 1.6); box(c, x + 52, 122, 8, 56, 3, '#3f9d9a', 1.6); box(c, x - 4, 178, 60, 10, 3, '#a8693c', 1.8); [8, 26, 44].forEach((o, i) => circ(c, x + o + 2, 176, 5, i % 2 ? '#ffd23f' : '#ff7aa8', 1.2)); });
    door(c, w / 2, h, '#3f9d6a', 56, 84, true);
    sign(c, w / 2, 98, 'EV', 70, '#ffd23f', '#3a2433');
  },
  market(c, w, h) {
    shadow(c, w, h);
    box(c, 0, 66, w, h - 66, 6, '#ffe39a', 2.4);
    box(c, -6, 30, w + 12, 46, 6, '#3f9d6a', 2.4);
    // seritli tente
    for (let i = 0; i < 12; i++) { const x = -6 + (i * (w + 12)) / 12; c.beginPath(); c.moveTo(x, 76); c.lineTo(x + (w + 12) / 12, 76); c.lineTo(x + (w + 12) / 12, 98); c.arc(x + (w + 12) / 24, 98, (w + 12) / 24, 0, Math.PI, false); c.closePath(); fillStroke(c, i % 2 ? '#fff' : '#e5483e', 2); }
    sign(c, w / 2, 0, 'MARKET', 150, '#ffd23f', '#3a2433');
    windowPane(c, 22, 118, 108, 70, '#c7ecff'); windowPane(c, w - 130, 118, 108, 70, '#c7ecff');
    [[34, '#e5483e'], [58, '#ffb02e'], [82, '#7fd36a'], [106, '#ffd23f']].forEach(([x, col]) => { circ(c, x, 178, 9, col, 1.4); circ(c, w - 130 + x - 12, 178, 9, col, 1.4); });
    door(c, w / 2, h, '#7fd0ef', 70, 84, false);
    box(c, 28, h - 38, 44, 28, 4, '#c98550', 2); circ(c, 42, h - 42, 8, '#e5483e', 1.4); circ(c, 58, h - 42, 8, '#ffb02e', 1.4);
    box(c, w - 72, h - 38, 44, 28, 4, '#c98550', 2); circ(c, w - 58, h - 42, 8, '#7fd36a', 1.4); circ(c, w - 42, h - 42, 8, '#ffd23f', 1.4);
  },
  home2(c, w, h) {
    shadow(c, w, h);
    box(c, 8, 70, w - 16, h - 70, 6, '#b9e0a8', 2.4);
    c.beginPath(); c.moveTo(-8, 80); c.lineTo(w / 2, 6); c.lineTo(w + 8, 80); c.closePath(); fillStroke(c, '#4a7fd0', 2.6);
    windowPane(c, 22, 104, 44, 46); windowPane(c, w - 66, 104, 44, 46);
    door(c, w / 2, h, '#e0684e', 40, 66, true);
  },
  home3(c, w, h) {
    shadow(c, w, h);
    box(c, 8, 60, w - 16, h - 60, 6, '#f6c1c8', 2.4);
    box(c, -6, 36, w + 12, 30, 6, '#7a5aa8', 2.4); box(c, -6, 36, w + 12, 8, 4, '#9a7ac8', 0);
    windowPane(c, 24, 90, 48, 52); windowPane(c, w - 72, 90, 48, 52);
    door(c, w / 2, h, '#f0b24a', 44, 70, true);
  }
};

const TREE = (c, s) => {
  c.fillStyle = 'rgba(30,20,50,.22)'; c.beginPath(); c.ellipse(0, 4, 26 * s, 8 * s, 0, 0, 7); c.fill();
  box(c, -6 * s, -34 * s, 12 * s, 38 * s, 4, '#8a5a34', 2);
  circ(c, 0, -62 * s, 32 * s, '#3f9d55', 2.2); circ(c, -22 * s, -46 * s, 20 * s, '#4cb064', 2); circ(c, 22 * s, -48 * s, 21 * s, '#37914d', 2);
  circ(c, -8 * s, -72 * s, 9 * s, 'rgba(255,255,255,.22)', 0);
};
const LAMP = (c) => {
  c.fillStyle = 'rgba(30,20,50,.2)'; c.beginPath(); c.ellipse(0, 2, 11, 4, 0, 0, 7); c.fill();
  box(c, -3, -78, 6, 80, 3, '#59597a', 1.8); box(c, -11, -92, 22, 18, 8, '#ffe9a0', 2); box(c, -13, -96, 26, 7, 3, '#59597a', 1.8);
};
const BENCH = (c) => { box(c, -32, -22, 64, 10, 3, '#a8693c', 1.8); box(c, -32, -10, 64, 12, 3, '#c98550', 1.8); box(c, -28, 0, 6, 8, 1, '#59597a', 1.4); box(c, 22, 0, 6, 8, 1, '#59597a', 1.4); };
const MAIL = (c) => { box(c, -2.5, -22, 5, 26, 1, '#7a4f2e', 1.4); box(c, -11, -38, 22, 18, 8, '#e5483e', 1.8); };
const BIN = (c) => { box(c, -8, -24, 16, 26, 3, '#4aa562', 1.8); box(c, -10, -28, 20, 6, 2, '#378349', 1.6); };

export function buildSprites(ppu) {
  const S = { buildings: [], trees: [], props: [], ppu };
  for (const b of BUILDINGS) {
    const pad = 34;
    const sp = makeSprite(b.w + pad * 2, b.h + pad * 2, ppu, (c) => DRAW[b.kind](c, b.w, b.h), -pad, -pad);
    S.buildings.push({ b, sp, sortY: b.yb, x: b.x, y: b.yb - b.h });
  }
  const mk = (n, w, h, ox, oy, fn) => makeSprite(w, h, ppu, fn, ox, oy);
  const trees = new Map();
  for (const t of TREES) { const k = t.s; if (!trees.has(k)) trees.set(k, mk('tree', 90 * k, 120 * k, -45 * k, -105 * k, (c) => TREE(c, k))); S.trees.push({ t, sp: trees.get(k), sortY: t.y + 4 }); }
  const lamp = mk('lamp', 40, 110, -20, -100, LAMP); const bench = mk('bench', 80, 40, -40, -30, BENCH); const mail = mk('mail', 40, 50, -20, -42, MAIL); const bin = mk('bin', 36, 40, -18, -32, BIN);
  const map = { lamp, bench, mailbox: mail, bin };
  for (const p of PROPS) if (map[p.kind]) S.props.push({ p, sp: map[p.kind], sortY: p.y + 2 });
  return S;
}

// ---- Zemin (her karede, kamera icinde kalani cizer; ucuz) ---------------------------------------------------------
let grassPat = null; let grassPpu = 0;
function grass(ctx, ppu) {
  if (grassPat && grassPpu === ppu) return grassPat;
  const T = Math.max(16, Math.round(120 * ppu)); const cv = document.createElement('canvas'); cv.width = T; cv.height = T; const c = cv.getContext('2d');
  c.fillStyle = '#74cc70'; c.fillRect(0, 0, T, T); c.fillStyle = '#69c166';
  for (let i = 0; i < 9; i++) { const x = ((i * 53) % 97) / 97 * T; const y = ((i * 37) % 89) / 89 * T; c.beginPath(); c.ellipse(x, y, T * 0.1, T * 0.05, 0, 0, 7); c.fill(); }
  c.strokeStyle = '#5fb35c'; c.lineWidth = Math.max(1, ppu * 1.5); c.lineCap = 'round';
  for (let i = 0; i < 14; i++) { const x = ((i * 71) % 101) / 101 * T; const y = ((i * 43) % 83) / 83 * T; c.beginPath(); c.moveTo(x, y); c.lineTo(x - 2 * ppu, y - 6 * ppu); c.moveTo(x, y); c.lineTo(x + 2 * ppu, y - 6 * ppu); c.stroke(); }
  grassPat = ctx.createPattern(cv, 'repeat'); grassPpu = ppu; grassPat._T = T; return grassPat;
}
export function drawGround(c, cam, vw, vh, ppu) {
  const x0 = cam.x; const y0 = cam.y;
  c.fillStyle = grass(c, ppu); c.save(); c.translate(0, 0); c.fillRect(x0, y0, vw, vh); c.restore();
  const vis = (r) => r.x < x0 + vw && r.x + r.w > x0 && r.y < y0 + vh && r.y + r.h > y0;
  for (const s of SIDEWALKS) if (vis(s)) { c.fillStyle = '#ddd6c6'; c.fillRect(s.x, s.y, s.w, s.h); }
  c.strokeStyle = 'rgba(120,110,95,.35)'; c.lineWidth = 1.5; c.beginPath();
  for (const s of SIDEWALKS) if (vis(s)) { if (s.w > s.h) for (let x = Math.max(s.x, Math.floor(x0 / 40) * 40); x < Math.min(s.x + s.w, x0 + vw); x += 40) { c.moveTo(x, s.y); c.lineTo(x, s.y + s.h); } else for (let y = Math.max(s.y, Math.floor(y0 / 40) * 40); y < Math.min(s.y + s.h, y0 + vh); y += 40) { c.moveTo(s.x, y); c.lineTo(s.x + s.w, y); } }
  c.stroke();
  for (const r of ROADS) if (vis(r)) { c.fillStyle = '#515570'; c.fillRect(r.x, r.y, r.w, r.h); c.fillStyle = '#434760'; if (r.w > r.h) { c.fillRect(r.x, r.y, r.w, 5); c.fillRect(r.x, r.y + r.h - 5, r.w, 5); } else { c.fillRect(r.x, r.y, 5, r.h); c.fillRect(r.x + r.w - 5, r.y, 5, r.h); } }
  c.fillStyle = '#ffe28a';
  for (const r of ROADS) if (vis(r)) { if (r.w > r.h) for (let x = Math.max(0, Math.floor(x0 / 60) * 60); x < Math.min(r.w, x0 + vw); x += 60) { if (x > 800 && x < 960) continue; c.fillRect(x, r.y + r.h / 2 - 3, 32, 6); } else for (let y = Math.max(0, Math.floor(y0 / 60) * 60); y < Math.min(r.h, y0 + vh); y += 60) { if ((y > 500 && y < 640) || (y > 960 && y < 1100)) continue; c.fillRect(r.x + r.w / 2 - 3, y, 6, 32); } }
  // yaya gecidi (zebra)
  c.fillStyle = 'rgba(255,255,255,.85)';
  for (const ry of [525, 985]) for (const zx of [770, 1000]) for (let i = 0; i < 5; i++) c.fillRect(zx + i * 8, ry, 5, 90);
  // cicekler
  for (const f of FLOWERS) { if (f.x < x0 - 10 || f.x > x0 + vw + 10 || f.y < y0 - 10 || f.y > y0 + vh + 10) continue; circ(c, f.x, f.y, 3.6, (f.x + f.y) % 3 ? '#ff7aa8' : '#ffd23f', 1); circ(c, f.x, f.y, 1.4, '#fff', 0); c.fillStyle = '#3f9d55'; c.fillRect(f.x - 1, f.y + 3, 2, 5); }
  // gol
  for (const p of PROPS) if (p.kind === 'pond') {
    c.fillStyle = '#c9bfa8'; c.beginPath(); c.ellipse(p.x, p.y, p.rx + 9, p.ry + 8, 0, 0, 7); c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke();
    c.fillStyle = '#4aa8e0'; c.beginPath(); c.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.beginPath(); c.ellipse(p.x - 8, p.y - 4, p.rx * 0.55, p.ry * 0.5, 0, 0.2, 2.4); c.stroke();
    circ(c, p.x + 34, p.y + 10, 9, '#5fc06a', 1.4);
  }
}

// ---- Cocuk karakteri (sirt cantali; 8 yon: on / arka / yan(+ayna); yuruyus dongusu) --------------------------------
export function drawKid(c, x, y, dir, phase, moving, t) {
  const f = facing(dir);
  const sw = moving ? Math.sin(phase) : 0; const bob = moving ? Math.abs(Math.sin(phase)) * 2.4 : Math.sin(t * 2.2) * 0.7;
  c.save(); c.translate(x, y); if (f.flip) c.scale(-1, 1);
  c.fillStyle = 'rgba(30,20,50,.28)'; c.beginPath(); c.ellipse(0, 1, 16, 5, 0, 0, 7); c.fill();
  c.lineJoin = 'round';
  const SK = '#ffd2a6'; const HR = '#5b3a1e'; const SH = '#ffb02e'; const PN = '#2f4a8a'; const PK = '#e5483e'; const SO = '#4a352b';
  if (f.v === 'side') {
    const lx = sw * 9;
    box(c, -3 - lx - 4, -20, 9, 21, 4, '#233a73', 1.5); box(c, -4 - lx - 3, -2, 12, 6, 3, SO, 1.4); // uzak bacak
    box(c, -3 + sw * 7, -44 - bob, 7, 17, 3.5, '#e69a1f', 1.4); // uzak kol
    box(c, -21, -44 - bob, 14, 23, 6, PK, 1.7); box(c, -19, -34 - bob, 10, 9, 3, '#ff8a7a', 1.1); // canta
    box(c, -9, -46 - bob, 18, 28, 8, SH, 1.7);
    box(c, -3 + lx, -20, 9, 21, 4, PN, 1.5); box(c, -4 + lx, -2, 12, 6, 3, SO, 1.4); // yakin bacak
    box(c, -4 - sw * 7, -44 - bob, 8, 18, 4, SH, 1.4); circ(c, -sw * 7, -25 - bob, 4, SK, 1.2);
    circ(c, 1, -58 - bob, 12, SK, 1.7); c.beginPath(); c.arc(0, -61 - bob, 12.4, Math.PI * 0.95, Math.PI * 2.05); c.lineTo(8, -56 - bob); c.quadraticCurveTo(0, -62 - bob, -10, -52 - bob); c.closePath(); fillStroke(c, HR, 1.4);
    circ(c, 8, -57 - bob, 2.1, '#2b2b2b'); circ(c, 8.7, -57.8 - bob, .8, '#fff'); circ(c, 8, -52 - bob, 2.4, '#ff8f8f55'); c.strokeStyle = '#8a3b2b'; c.lineWidth = 1.6; c.lineCap = 'round'; c.beginPath(); c.moveTo(5, -51 - bob); c.quadraticCurveTo(8, -48.5 - bob, 11, -51 - bob); c.stroke(); circ(c, -7, -57 - bob, 2.8, '#f2b88a', 1);
  } else if (f.v === 'down') {
    const lx = sw * 6;
    box(c, -9, -20 + Math.max(0, -lx), 9, 21 - Math.max(0, -lx), 4, PN, 1.5); box(c, 1, -20 + Math.max(0, lx), 9, 21 - Math.max(0, lx), 4, PN, 1.5);
    box(c, -11, -2 - Math.max(0, lx) * 0, 11, 6, 3, SO, 1.3); box(c, 1, -2, 11, 6, 3, SO, 1.3);
    box(c, -17, -44 - bob, 7, 26, 3.5, PK, 1.3); box(c, 10, -44 - bob, 7, 26, 3.5, PK, 1.3);
    box(c, -13, -46 - bob, 26, 29, 10, SH, 1.7); c.strokeStyle = '#c9372e'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(-6, -44 - bob); c.lineTo(-5, -26 - bob); c.moveTo(6, -44 - bob); c.lineTo(5, -26 - bob); c.stroke();
    box(c, -20, -44 - bob + sw * 4, 8, 20, 4, SH, 1.4); circ(c, -16, -23 - bob + sw * 4, 4, SK, 1.2); box(c, 12, -44 - bob - sw * 4, 8, 20, 4, SH, 1.4); circ(c, 16, -23 - bob - sw * 4, 4, SK, 1.2);
    circ(c, 0, -58 - bob, 13, SK, 1.7); c.beginPath(); c.arc(0, -60 - bob, 13.4, Math.PI, Math.PI * 2); c.quadraticCurveTo(0, -64 - bob, -13, -60 - bob); c.closePath(); fillStroke(c, HR, 1.4);
    circ(c, -13, -56 - bob, 2.6, '#f2b88a', 1); circ(c, 13, -56 - bob, 2.6, '#f2b88a', 1);
    circ(c, -5, -56 - bob, 2.1, '#2b2b2b'); circ(c, 5, -56 - bob, 2.1, '#2b2b2b'); circ(c, -4.3, -56.8 - bob, .8, '#fff'); circ(c, 5.7, -56.8 - bob, .8, '#fff');
    circ(c, -9, -51 - bob, 2.6, '#ff8f8f66'); circ(c, 9, -51 - bob, 2.6, '#ff8f8f66'); c.strokeStyle = '#8a3b2b'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-3.5, -50 - bob); c.quadraticCurveTo(0, -47 - bob, 3.5, -50 - bob); c.stroke();
  } else { // up: arkadan (canta belirgin)
    const lx = sw * 6;
    box(c, -9, -20 + Math.max(0, lx), 9, 21 - Math.max(0, lx), 4, PN, 1.5); box(c, 1, -20 + Math.max(0, -lx), 9, 21 - Math.max(0, -lx), 4, PN, 1.5);
    box(c, -11, -2, 11, 6, 3, SO, 1.3); box(c, 1, -2, 11, 6, 3, SO, 1.3);
    box(c, -20, -44 - bob - sw * 4, 8, 20, 4, SH, 1.4); circ(c, -16, -23 - bob - sw * 4, 4, SK, 1.2); box(c, 12, -44 - bob + sw * 4, 8, 20, 4, SH, 1.4); circ(c, 16, -23 - bob + sw * 4, 4, SK, 1.2);
    box(c, -13, -46 - bob, 26, 29, 10, SH, 1.7); box(c, -14, -44 - bob, 28, 28, 9, PK, 1.8); box(c, -9, -30 - bob, 18, 11, 4, '#ff8a7a', 1.2); box(c, -6, -49 - bob, 12, 6, 3, '#b8332b', 1.3);
    circ(c, 0, -58 - bob, 13, HR, 1.7); circ(c, -13, -56 - bob, 2.6, '#f2b88a', 1); circ(c, 13, -56 - bob, 2.6, '#f2b88a', 1); c.fillStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.ellipse(-4, -62 - bob, 5, 3, -0.4, 0, 7); c.fill();
  }
  c.restore();
}
export function drawArrow(c, x, y, t) { const b = Math.sin(t * 5) * 5; c.save(); c.translate(x, y + b); c.beginPath(); c.moveTo(0, 0); c.lineTo(-13, -17); c.lineTo(-5, -17); c.lineTo(-5, -32); c.lineTo(5, -32); c.lineTo(5, -17); c.lineTo(13, -17); c.closePath(); fillStroke(c, '#ffd23f', 2.4); c.restore(); }
export { ENTRANCES, WORLD };
