// Mahalle Macerasi — ASAMA 1 (R1) oynanabilir dunya prototipi. Rota: #/mahalle (ana menude kucuk "Mahalle (prototip)" dugmesi).
// Bolumler: world.js (veri+carpisma) | engine.js (hareket/kamera/durum) | art.js (canvas) | interiors.js (ic mekan SVG) | index.js (ekran, girdi, dongu).
// Mevcut oyunlar/kayit/ses akisina DOKUNMAZ: kayit anahtari yok (durum oturum boyunca bellekte), yeni ses yok, yeni kutuphane yok.
import { createState, step, camera, enter, leave, viewScale } from './engine.js';
import { WORLD, ENTRANCES } from './world.js';
import { buildSprites, drawGround, drawKid, drawArrow } from './art.js';
import { INTERIORS, INFO } from './interiors.js';

const T = {
  title: 'Mahalle', home: 'Ana menü', act: 'İçeri Gir', out: 'Dışarı Çık', joy: 'Hareket kontrolü',
  go: { okul: 'Okula Gir', ev: 'Eve Gir', market: 'Markete Gir', atolye: 'Atölyeye Gir' }
};
let SAVED = null; // oturum boyunca dunya durumu (konum, yon, mekan) — ekrana donuste korunur

export function createMahalle(ctx) {
  const { registerBack, exit, audio } = ctx;
  let root = null; let raf = 0; let alive = false; let unreg = null;
  let cv; let c2; let cssW = 0; let cssH = 0; let dpr = 1; let scale = 1; let sprites = null; let spriteScale = 0;
  let last = 0; let t = 0; let busy = false; const keys = new Set(); let joy = { x: 0, y: 0 };
  let S = SAVED || createState(); const own = () => (SAVED = S);

  const html = () => `
    <section class="mh" data-screen="mahalle" data-place="mahalle" aria-label="${T.title}">
      <canvas class="mh-cv" aria-label="${T.title}"></canvas>
      <button type="button" class="adv-btn round mh-home" data-mh="home" aria-label="${T.home}"><span aria-hidden="true">🏠</span></button>
      <div class="mh-pad" aria-label="${T.joy}"><div class="mh-joy" data-active="0"><i class="mh-knob"></i></div></div>
      <button type="button" class="adv-btn primary big mh-act" data-mh="act" disabled>${T.act}</button>
      <div class="mh-in" hidden><div class="mh-scene"></div><div class="mh-name adv-block"></div><div class="mh-bar"><p class="mh-note adv-block"></p><button type="button" class="adv-btn primary big mh-out" data-mh="out">${T.out}</button></div></div>
      <div class="mh-fade"></div>
    </section>`;

  // ---- olcek / tuval ------------------------------------------------------------------------------------------
  function resize() {
    const r = root.getBoundingClientRect();
    cssW = Math.max(1, Math.round(r.width)); cssH = Math.max(1, Math.round(r.height));
    dpr = Math.min(2, window.devicePixelRatio || 1);
    scale = viewScale(cssW, cssH);
    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr); cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    const ppu = scale * dpr;
    if (!sprites || Math.abs(ppu - spriteScale) / ppu > 0.04) { sprites = buildSprites(ppu); spriteScale = ppu; }
    draw(0, true);
  }

  // ---- cizim --------------------------------------------------------------------------------------------------
  function draw(dt = 0, snap = false) {
    if (!c2 || !sprites) return;
    const vw = cssW / scale; const vh = cssH / scale; const cam = camera(S, vw, vh, dt, scale, dpr, snap);
    const q = scale * dpr;
    c2.setTransform(q, 0, 0, q, -cam.x * q, -cam.y * q);
    drawGround(c2, cam, vw, vh, q);
    if (S.near) { const z = ENTRANCES.find((e) => e.id === S.near)?.zone; if (z) { c2.save(); c2.globalAlpha = 0.3 + Math.sin(t * 4) * 0.08; c2.fillStyle = '#ffe36b'; c2.fillRect(z.x, z.y, z.w, z.h); c2.restore(); } }
    const list = [];
    for (const o of sprites.buildings) list.push(o); for (const o of sprites.trees) list.push(o); for (const o of sprites.props) list.push(o);
    list.push({ kid: true, sortY: S.y });
    list.sort((a, b) => a.sortY - b.sortY);
    for (const o of list) {
      if (o.kid) { drawKid(c2, S.x, S.y, S.dir, S.phase, S.moving, t); continue; }
      const sp = o.sp; const px = o.b ? o.b.x : o.t ? o.t.x : o.p.x; const py = o.b ? o.b.yb - o.b.h : o.t ? o.t.y : o.p.y;
      const x = px + sp.ox; const y = py + sp.oy;
      if (x > cam.x + vw || x + sp.w < cam.x || y > cam.y + vh || y + sp.h < cam.y) continue;
      c2.drawImage(sp.cv, x, y, sp.w, sp.h);
    }
    if (S.near) {
      const e = ENTRANCES.find((z) => z.id === S.near);
      if (e) { // kapinin onundeki kaldirim alani parlar + cocugun ustunde ok
        drawArrow(c2, S.x, S.y - 78, t);
      }
    }
  }

  // ---- dongu --------------------------------------------------------------------------------------------------
  function frame(now) {
    raf = 0; if (!alive) return;
    const dt = last ? (now - last) / 1000 : 0.016; last = now; t += dt;
    if (S.place === 'mahalle' && !busy) {
      let ix = joy.x; let iy = joy.y;
      if (!ix && !iy) { ix = (keys.has('ArrowRight') || keys.has('d') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('a') ? 1 : 0); iy = (keys.has('ArrowDown') || keys.has('s') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('w') ? 1 : 0); }
      const wasNear = S.near;
      step(S, { x: ix, y: iy }, dt);
      if (S.near !== wasNear) paintAct();
      draw(dt);
    } else if (S.place === 'mahalle') draw(dt);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf && alive && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };
  const stop = () => { if (raf) cancelAnimationFrame(raf); raf = 0; joy = { x: 0, y: 0 }; keys.clear(); };

  // ---- dugme / ic mekan ---------------------------------------------------------------------------------------
  function paintAct() {
    const b = root.querySelector('.mh-act'); const near = S.place === 'mahalle' ? S.near : null;
    b.disabled = !near; b.textContent = near ? T.go[near] : T.act; b.dataset.near = near || '';
    root.dataset.near = near || '';
  }
  function fade(fn) {
    if (busy) return; busy = true; const f = root.querySelector('.mh-fade'); f.classList.add('on');
    setTimeout(() => { if (!alive) return; fn(); requestAnimationFrame(() => { f.classList.remove('on'); setTimeout(() => { busy = false; }, 220); }); }, 200);
  }
  function showInterior(id) {
    const box = root.querySelector('.mh-in'); root.querySelector('.mh-scene').innerHTML = INTERIORS[id]();
    root.querySelector('.mh-name').textContent = INFO[id].title; root.querySelector('.mh-note').textContent = INFO[id].note;
    box.hidden = false; root.dataset.place = id; joy = { x: 0, y: 0 }; own(); paintAct();
  }
  function hideInterior() { root.querySelector('.mh-in').hidden = true; root.dataset.place = 'mahalle'; own(); paintAct(); draw(0, true); }
  function doEnter() { if (busy || S.place !== 'mahalle' || !S.near) return; audio?.play?.('tap'); fade(() => { if (enter(S)) showInterior(S.place); }); }
  function doOut() { if (busy || S.place === 'mahalle') return; audio?.play?.('tap'); fade(() => { leave(S); hideInterior(); }); }
  const handleBack = () => { if (S.place !== 'mahalle') { doOut(); return true; } return false; };

  // ---- girdi: yuzen sanal joystick (sol yarim ekran) + klavye --------------------------------------------------
  function bindJoystick() {
    const pad = root.querySelector('.mh-pad'); const base = root.querySelector('.mh-joy'); const knob = base.querySelector('.mh-knob');
    let id = null; let ox = 0; let oy = 0; const R = () => Math.max(40, Math.min(64, cssH * 0.14));
    const place = (x, y) => { const r = pad.getBoundingClientRect(); base.style.left = x - r.left + 'px'; base.style.top = y - r.top + 'px'; base.style.bottom = 'auto'; };
    const rest = () => { base.removeAttribute('style'); knob.style.transform = ''; base.dataset.active = '0'; };
    pad.addEventListener('pointerdown', (e) => {
      if (id !== null) return; id = e.pointerId; ox = e.clientX; oy = e.clientY; place(ox, oy); base.dataset.active = '1';
      try { pad.setPointerCapture(id); } catch { /* sentetik olay */ } e.preventDefault();
    });
    pad.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - ox; let dy = e.clientY - oy; const r = R(); const m = Math.hypot(dx, dy);
      if (m > r) { dx = (dx / m) * r; dy = (dy / m) * r; }
      knob.style.transform = `translate(${dx}px,${dy}px)`; joy = { x: dx / r, y: dy / r };
    });
    const up = (e) => { if (e.pointerId !== id) return; id = null; joy = { x: 0, y: 0 }; rest(); };
    pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); pad.addEventListener('lostpointercapture', up);
  }
  const onKey = (e) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (e.type === 'keydown') {
      if (k === 'Enter' || k === 'e') return void doEnter();
      if (k === 'Escape') return void (S.place !== 'mahalle' ? doOut() : undefined);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { keys.add(k); e.preventDefault(); }
    } else keys.delete(k);
  };
  const onVis = () => (document.hidden ? stop() : start());

  return {
    mount(host) {
      root = host; root.innerHTML = html(); alive = true;
      const sec = root.querySelector('.mh'); root = sec; cv = sec.querySelector('.mh-cv'); c2 = cv.getContext('2d');
      sec.addEventListener('click', (e) => {
        const b = e.target.closest('[data-mh]'); if (!b) return;
        if (b.dataset.mh === 'act') doEnter(); else if (b.dataset.mh === 'out') doOut(); else if (b.dataset.mh === 'home') { audio?.play?.('tap'); exit?.(); }
      });
      bindJoystick(); window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey); document.addEventListener('visibilitychange', onVis);
      window.addEventListener('resize', onResize); unreg = registerBack?.(handleBack);
      if (S.place !== 'mahalle') leave(S); // onceki oturumda ic mekandaysa disari, kapinin onune
      resize(); paintAct(); start();
      window.__mahalle = { state: () => ({ x: S.x, y: S.y, dir: S.dir, place: S.place, near: S.near, moving: S.moving, cam: { ...S.cam }, scale, cssW, cssH }), teleport: (x, y) => { S.x = x; S.y = y; camera(S, cssW / scale, cssH / scale, 0, scale, dpr, true); } };
    },
    unmount() {
      alive = false; stop(); unreg?.(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('resize', onResize);
      if (S.place !== 'mahalle') leave(S); own(); sprites = null; delete window.__mahalle;
    }
  };
  function onResize() { if (alive) resize(); }
}
export default { id: 'mahalle', create: createMahalle };
export { WORLD };
