// Mahalle Macerasi Asama 1 (R1): hareket, carpisma, kamera, mekan giris/cikis (saf mantik; cihaz testi DEGILDIR).
import test from 'node:test';
import assert from 'node:assert/strict';
import { WORLD, START, PLAYER_R, blocked, ENTRANCES, entranceAt, BUILDINGS, PLACES } from '../src/games/mahalle/world.js';
import { createState, step, quantize, camera, enter, leave, SPEED, viewScale, facing } from '../src/games/mahalle/engine.js';

test('dort mekan var: okul, ev, market, atolye', () => {
  assert.deepEqual(PLACES.map((p) => p.id).sort(), ['atolye', 'ev', 'market', 'okul']);
  assert.equal(ENTRANCES.length, 4);
});
test('baslangic ve her giris/cikis noktasi engelsiz', () => {
  assert.equal(blocked(START.x, START.y), false);
  for (const e of ENTRANCES) { assert.equal(blocked(e.exit.x, e.exit.y), false, e.id); assert.ok(entranceAt(e.exit.x, e.exit.y)?.id === e.id, e.id + ' cikis kendi bolgesinde'); }
});
test('8 yon nicemleme', () => {
  assert.equal(quantize(1, 0), 0); assert.equal(quantize(1, 1), 1); assert.equal(quantize(0, 1), 2); assert.equal(quantize(-1, 1), 3);
  assert.equal(quantize(-1, 0), 4); assert.equal(quantize(-1, -1), 5); assert.equal(quantize(0, -1), 6); assert.equal(quantize(1, -1), 7);
  assert.equal(quantize(0.1, 0.1), -1, 'olu bolge');
  assert.deepEqual(facing(2), { v: 'down', flip: false }); assert.equal(facing(3).flip, true);
});
test('hareket hizi ve capraz hiz normallestirilmis', () => {
  const a = createState(); step(a, { x: 1, y: 0 }, 0.05);
  const b = createState(); step(b, { x: 1, y: 1 }, 0.05);
  const da = Math.hypot(a.x - START.x, a.y - START.y); const db = Math.hypot(b.x - START.x, b.y - START.y);
  assert.ok(Math.abs(da - SPEED * 0.05) < 0.5, 'duz ' + da); assert.ok(Math.abs(db - da) < 0.5, 'capraz ' + db);
  assert.ok(a.moving);
});
test('binalarin icinden gecilemez (her bina, her yon, uzun yurume)', () => {
  for (const b of BUILDINGS) {
    const s = createState(); s.x = b.x + b.w / 2; s.y = b.yb + 50; // kapinin onu
    if (blocked(s.x, s.y)) continue;
    for (let i = 0; i < 200; i++) step(s, { x: 0, y: -1 }, 0.03); // yukari (binaya dogru)
    assert.ok(!blocked(s.x, s.y), b.id + ' icinde');
    assert.ok(s.y >= b.yb + PLAYER_R - 1, b.id + ' cephesine girdi: y=' + s.y);
  }
});
test('dunya siniri asilmaz', () => {
  const s = createState();
  for (let i = 0; i < 600; i++) step(s, { x: -1, y: -1 }, 0.03);
  assert.ok(s.x >= PLAYER_R && s.y >= PLAYER_R && s.x <= WORLD.w && s.y <= WORLD.h);
  for (let i = 0; i < 900; i++) step(s, { x: 1, y: 1 }, 0.03);
  assert.ok(s.x <= WORLD.w - PLAYER_R && s.y <= WORLD.h - PLAYER_R);
});
test('engelden kayarak devam eder (duvar boyunca yurunebilir)', () => {
  const s = createState(); const b = PLACES[0]; s.x = b.x + 10; s.y = b.yb + 20;
  const x0 = s.x; for (let i = 0; i < 15; i++) step(s, { x: 1, y: -1 }, 0.03);
  assert.ok(s.x > x0 + 20, 'yatay kayma ' + (s.x - x0));
});
test('tum girisler baslangictan ULASILABILIR (kareli BFS)', () => {
  const G = 10; const cols = Math.ceil(WORLD.w / G); const rows = Math.ceil(WORLD.h / G);
  const seen = new Uint8Array(cols * rows); const q = [[Math.round(START.x / G), Math.round(START.y / G)]]; seen[q[0][1] * cols + q[0][0]] = 1;
  while (q.length) {
    const [cx, cy] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx; const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows || seen[ny * cols + nx] || blocked(nx * G, ny * G)) continue;
      seen[ny * cols + nx] = 1; q.push([nx, ny]);
    }
  }
  for (const e of ENTRANCES) assert.ok(seen[Math.round(e.exit.y / G) * cols + Math.round(e.exit.x / G)], e.id + ' ulasilamaz');
});
test('giris bolgesine gelince near dolar, iceri gir / disari cik konumu korur ve gecerlidir', () => {
  for (const e of ENTRANCES) {
    const s = createState(); s.x = e.exit.x; s.y = e.exit.y; step(s, { x: 0, y: 0 }, 0.016);
    assert.equal(s.near, e.id);
    assert.ok(enter(s)); assert.equal(s.place, e.id);
    assert.ok(!enter(s), 'ic mekanda ikinci giris yok');
    assert.ok(leave(s)); assert.equal(s.place, 'mahalle'); assert.ok(!blocked(s.x, s.y)); assert.equal(s.near, e.id);
    assert.ok(!leave(s));
  }
  const s = createState(); step(s, { x: 0, y: 0 }, 0.016); assert.equal(s.near, null); assert.ok(!enter(s));
});
test('kamera: takip eder, dunya disina cikmaz, titremez (ayni girdi = ayni konum)', () => {
  const s = createState(); const vw = 933; const vh = 420; const sc = 0.857;
  camera(s, vw, vh, 0.016, sc, 2, true);
  for (let i = 0; i < 120; i++) step(s, { x: 1, y: 0 }, 0.016), camera(s, vw, vh, 0.016, sc, 2);
  for (let i = 0; i < 200; i++) camera(s, vw, vh, 0.016, sc, 2); // yakinsa
  const c = camera(s, vw, vh, 0.016, sc, 2);
  assert.ok(c.x >= 0 && c.y >= 0 && c.x + vw <= WORLD.w + 1 && c.y + vh <= WORLD.h + 1);
  const a = camera(s, vw, vh, 0.016, sc, 2); const b = camera(s, vw, vh, 0.016, sc, 2);
  assert.deepEqual(a, b);
  const q = sc * 2; assert.ok(Math.abs(a.x * q - Math.round(a.x * q)) < 1e-6, 'piksele yuvarlak');
  // oyuncu kamera icinde
  assert.ok(s.x > c.x && s.x < c.x + vw && s.y > c.y && s.y < c.y + vh);
});
test('olcek: yatay ve dikey telefonlarda gorus alani yeterli', () => {
  for (const [w, h] of [[800, 360], [640, 300], [360, 640], [412, 915], [1100, 500]]) {
    const sc = viewScale(w, h);
    assert.ok(w / sc >= 440 - 1 && h / sc >= 400 - 1 || w / sc >= 440 && h / sc >= 300, `${w}x${h} gorus ${w / sc}x${h / sc}`);
    assert.ok(sc * 64 >= 28, 'cocuk okunur boyutta ' + sc * 64);
  }
});
