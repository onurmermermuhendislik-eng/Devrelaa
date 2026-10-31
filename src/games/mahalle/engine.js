// Mahalle Macerasi — hareket / kamera / durum. SAF mantik (node testleri). Gorev, egitim, envanter, ilerleme sonraki asamalarda
// `state.place` ve `state.flags` uzerinden baglanir (simdilik yalniz konum + mekan).
import { WORLD, START, PLAYER_R, blocked, entranceAt, ENTRANCES } from './world.js';

export const SPEED = 175; // du/sn (cocuk icin rahat kontrol)
const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]]; // 0=dogu ... saat yonunde (ekran: y asagi)
const D8 = DIRS.map(([x, y]) => { const l = Math.hypot(x, y); return [x / l, y / l]; });

export const createState = () => ({ x: START.x, y: START.y, dir: START.dir, moving: false, phase: 0, place: 'mahalle', near: null, cam: { x: START.x, y: START.y }, flags: {} });

// Girdiyi (joystick/klavye vektoru) 8 yone indirger: -1 = durgun. Olu bolge: 0.22
export function quantize(ix, iy, dead = 0.22) {
  const m = Math.hypot(ix, iy);
  if (m < dead) return -1;
  let a = Math.atan2(iy, ix); // -pi..pi
  if (a < 0) a += Math.PI * 2;
  return Math.round(a / (Math.PI / 4)) % 8;
}
export const dirVec = (d) => D8[d] || [0, 0];

// Sprite yonu: 'down' | 'up' | 'side' (+ yatay ayna)
export function facing(dir) {
  if (dir === 2) return { v: 'down', flip: false };
  if (dir === 6) return { v: 'up', flip: false };
  if (dir === 0 || dir === 1 || dir === 7) return { v: 'side', flip: false };
  return { v: 'side', flip: true };
}

// Bir adim: eksenleri ayri dener (engele surtunerek kayar). Cok kucuk adimlara boler (tunelleme yok).
export function step(s, input, dt) {
  dt = Math.min(Math.max(dt, 0), 0.05);
  const d = quantize(input.x || 0, input.y || 0);
  s.moving = false;
  if (d >= 0) {
    s.dir = d;
    const [vx, vy] = D8[d];
    const sp = SPEED * Math.min(1, Math.max(0.55, Math.hypot(input.x || 0, input.y || 0))); // hafif analog hiz (en az %55)
    const dist = sp * dt;
    const n = Math.max(1, Math.ceil(dist / 4));
    let moved = 0;
    for (let i = 0; i < n; i++) {
      const dx = (vx * dist) / n;
      const dy = (vy * dist) / n;
      let did = false;
      if (!blocked(s.x + dx, s.y)) { s.x += dx; did = did || dx !== 0; }
      if (!blocked(s.x, s.y + dy)) { s.y += dy; did = did || dy !== 0; }
      if (did) moved += Math.hypot(dx, dy);
    }
    if (moved > 0.01) {
      s.moving = true;
      s.phase += (moved / 22) * Math.PI; // adim fazi
    }
  }
  const e = entranceAt(s.x, s.y);
  s.near = e ? e.id : null;
  return s;
}

// Kamera: yumusak takip + dunya sinirina kenetleme; goruntu dunyadan buyukse ortalar. Cihaz pikseline yuvarlanir (titreme yok).
export function camera(s, viewW, viewH, dt, scale = 1, dpr = 1, snap = false) {
  const tx = clampAxis(s.x, viewW, WORLD.w);
  const ty = clampAxis(s.y - 8, viewH, WORLD.h);
  if (snap) { s.cam.x = tx; s.cam.y = ty; }
  else {
    const k = 1 - Math.exp(-Math.min(dt, 0.05) * 9);
    s.cam.x += (tx - s.cam.x) * k;
    s.cam.y += (ty - s.cam.y) * k;
    if (Math.abs(tx - s.cam.x) < 0.02) s.cam.x = tx;
    if (Math.abs(ty - s.cam.y) < 0.02) s.cam.y = ty;
  }
  const q = scale * dpr;
  return { x: Math.round((s.cam.x - viewW / 2) * q) / q, y: Math.round((s.cam.y - viewH / 2) * q) / q };
}
const clampAxis = (c, view, world) => (view >= world ? world / 2 : Math.max(view / 2, Math.min(world - view / 2, c)));

// Mekana gir / cik. Cikista cocuk KAPININ ONUNDEKI kaldirima (bos, gecerli bir noktaya) konur.
export function enter(s) {
  if (s.place !== 'mahalle' || !s.near) return false;
  s.place = s.near;
  s.moving = false;
  return true;
}
export function leave(s) {
  if (s.place === 'mahalle') return false;
  const e = ENTRANCES.find((x) => x.id === s.place);
  if (e) {
    let { x, y } = e.exit;
    if (blocked(x, y, PLAYER_R)) y = e.zone.y + e.zone.h - 10;
    s.x = x; s.y = y; s.dir = 2;
  }
  s.place = 'mahalle';
  s.near = e ? e.id : null;
  s.moving = false;
  return true;
}
export function viewScale(cssW, cssH) {
  return Math.max(0.42, Math.min(cssW / 520, cssH / 470));
}
