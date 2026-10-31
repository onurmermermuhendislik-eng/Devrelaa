// Mahalle Macerasi ASAMA 1 (R1) hedefli tarayici testi (Chromium/Playwright). GERCEK ANDROID CIHAZ TESTI DEGILDIR (dokunmatik = sentetik PointerEvent).
//   node scripts/ui-mahalle.mjs   SHOTS=/yol
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url);
let chromium; for (const p of [process.env.PLAYWRIGHT_PATH, '/home/claude/.npm-global/lib/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = require(p)); break; } catch {} }
if (!chromium) { console.error('Playwright bulunamadi'); process.exit(2); }
const SHOTS = process.env.SHOTS; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = []; const check = (n, ok, info = '') => { results.push(!!ok); console.log(`${ok ? '  ok ' : 'FAIL '} ${n}${ok || !info ? '' : '  -> ' + info}`); };
const server = await startServer(0); const BASE = `http://127.0.0.1:${server.address().port}/`; const browser = await chromium.launch();
const mk = async (vp, hash = '#/mahalle') => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const errs = []; const external = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
  await page.addInitScript(() => localStorage.setItem('altez-minilab:v1', JSON.stringify({ band: '4-5', sound: false, seen: true, adv: { intro: true, tasks: {} } })));
  await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + hash); return { ctx, page, errs, external };
};
const st = (page) => page.evaluate(() => window.__mahalle.state());
const tp = (page, x, y) => page.evaluate(([a, b]) => window.__mahalle.teleport(a, b), [x, y]);
const W = (p, ms) => p.waitForTimeout(ms);
const joy = async (page, dx, dy, ms) => { // sentetik dokunma: sol yarida basla, surukle, bekle, birak
  await page.evaluate(([dx, dy]) => { const pad = document.querySelector('.mh-pad'); const r = pad.getBoundingClientRect(); const x = r.left + 90; const y = r.bottom - 90; window.__j = { pad, x, y };
    pad.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' }));
    pad.dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, clientX: x + dx, clientY: y + dy, bubbles: true, pointerType: 'touch' })); }, [dx, dy]);
  await W(page, ms);
};
const joyUp = (page) => page.evaluate(() => { const { pad, x, y } = window.__j; pad.dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, clientX: x, clientY: y, bubbles: true, pointerType: 'touch' })); });
const shot = (page, n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png` });
const PLACES = { okul: [320, 520, 'Okula Gir'], atolye: [1310, 520, 'Atölyeye Gir'], ev: [310, 980, 'Eve Gir'], market: [1370, 980, 'Markete Gir'] };

try {
  { const { ctx, page, errs, external } = await mk({ width: 800, height: 360 });
    await page.waitForSelector('.mh .mh-cv'); await W(page, 400);
    const s0 = await st(page);
    check('M1 rota acilir, canvas + kontroller var, konsol hatasi/harici istek yok', (await page.locator('.mh-pad').count()) === 1 && (await page.locator('.mh-act').count()) === 1 && (await page.locator('.mh-home').count()) === 1 && errs.length === 0 && external.length === 0, JSON.stringify({ errs, external }));
    check('M2 baslangicta mekana yakin degil: "Ice Gir" dugmesi PASIF', s0.near === null && (await page.locator('.mh-act').isDisabled()));
    await page.keyboard.down('ArrowRight'); await W(page, 500); await page.keyboard.up('ArrowRight'); const s1 = await st(page);
    check('M3 klavye (8 yon): saga yurur, kamera takip eder, karakter ekranda', s1.x > s0.x + 40 && s1.cam.x > s0.cam.x + 20 && s1.dir === 0, JSON.stringify({ s0: [s0.x, s0.cam.x], s1: [s1.x, s1.cam.x, s1.dir] }));
    await page.keyboard.down('ArrowDown'); await page.keyboard.down('ArrowLeft'); await W(page, 400); await page.keyboard.up('ArrowDown'); await page.keyboard.up('ArrowLeft'); const s2 = await st(page);
    check('M4 capraz yurume (asagi-sol) calisir', s2.x < s1.x - 20 && s2.y > s1.y + 20 && s2.dir === 3, JSON.stringify([s1.x, s1.y, s2.x, s2.y, s2.dir]));
    await tp(page, 700, 640); const a = await st(page); await joy(page, 60, 0, 600); const b = await st(page);
    const knob = await page.locator('.mh-knob').evaluate((e) => e.style.transform);
    await shot(page, 'm-joystick'); await joyUp(page); await W(page, 150); const c = await st(page); await W(page, 200); const d = await st(page);
    check('M5 sanal joystick (dokunmatik): surukleyince saga yurur, birakinca durur', b.x > a.x + 40 && !!knob && Math.abs(d.x - c.x) < 1.5, JSON.stringify({ a: a.x, b: b.x, knob, c: c.x, d: d.x }));
    await tp(page, 320, 500); for (let i = 0; i < 3; i++) { await page.keyboard.down('ArrowUp'); await W(page, 500); } await page.keyboard.up('ArrowUp'); const o = await st(page);
    check('M6 engel: okul cephesine girilmez (y >= taban + yaricap)', o.y >= 470 + 12, JSON.stringify(o));
    await ctx.close(); }
  { const { ctx, page, errs } = await mk({ width: 800, height: 360 });
    await page.waitForSelector('.mh .mh-cv'); await W(page, 300);
    for (const [id, [x, y, label]] of Object.entries(PLACES)) {
      await tp(page, x, y); await W(page, 150); const s = await st(page);
      const enabled = !(await page.locator('.mh-act').isDisabled()); const txt = (await page.locator('.mh-act').innerText()).trim();
      check(`M7 ${id}: kapi onunde giris dugmesi AKTIF ("${label}")`, s.near === id && enabled && txt === label, JSON.stringify({ near: s.near, enabled, txt }));
      await page.locator('.mh-act').click(); await W(page, 520);
      const inVis = await page.locator('.mh-in').isVisible(); const pl = await page.locator('.mh').getAttribute('data-place'); await shot(page, `m-${id}-ic`);
      check(`M8 ${id}: ic mekan sahnesi acilir (bos ekran yok: SVG + baslik + Disari Cik)`, inVis && pl === id && (await page.locator('.mh-in svg').count()) === 1 && (await page.locator('.mh-name').innerText()).length > 1 && (await page.locator('.mh-out').isVisible()));
      await page.locator('.mh-out').click(); await W(page, 520); const s2 = await st(page);
      check(`M9 ${id}: Disari Cik -> mahalle, kapinin onunde, gecerli konum, tekrar girilebilir`, s2.place === 'mahalle' && !(await page.locator('.mh-in').isVisible()) && s2.near === id && Math.abs(s2.x - x) < 30 && Math.abs(s2.y - y) < 80 && !(await page.locator('.mh-act').isDisabled()), JSON.stringify(s2));
    }
    await tp(page, 330, 500); await W(page, 100); await page.locator('.mh-act').click({ trial: true }).catch(() => {});
    await tp(page, 330, 560); await W(page, 100); await page.keyboard.press('Enter'); await W(page, 350); check('M10 giris bolgesi disinda Enter etkisiz', (await page.locator('.mh').getAttribute('data-place')) === 'mahalle');
    await tp(page, 320, 520); await W(page, 100); await page.keyboard.press('Enter'); await W(page, 520); await page.keyboard.press('Escape'); await W(page, 520);
    check('M11 klavye: Enter ile gir, Escape ile cik', (await page.locator('.mh').getAttribute('data-place')) === 'mahalle' && (await st(page)).near === 'okul');
    const pos = await st(page); await page.evaluate(() => { location.hash = '#/'; }); await page.waitForSelector('.mm', { timeout: 6000 }); await page.evaluate(() => { location.hash = '#/mahalle'; }); await page.waitForSelector('.mh .mh-cv'); await W(page, 300); const pos2 = await st(page);
    check('M12 menuye cikip donunce konum/dunya durumu korunur', Math.abs(pos.x - pos2.x) < 2 && Math.abs(pos.y - pos2.y) < 2 && pos2.place === 'mahalle', JSON.stringify({ pos, pos2 }));
    check('M13 tum akis boyunca konsol hatasi yok', errs.length === 0, JSON.stringify(errs));
    await ctx.close(); }
  for (const vp of [{ width: 640, height: 300 }, { width: 800, height: 360 }, { width: 960, height: 432 }, { width: 360, height: 640 }, { width: 412, height: 915 }, { width: 1100, height: 500 }]) {
    const { ctx, page } = await mk(vp); await page.waitForSelector('.mh .mh-cv'); await W(page, 300); await tp(page, 320, 520); await W(page, 200);
    const L = await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s).getBoundingClientRect(); return { l: e.left, t: e.top, r: e.right, b: e.bottom, w: e.width, h: e.height }; };
      return { sw: document.documentElement.scrollWidth, iw: innerWidth, ih: innerHeight, act: r('.mh-act'), home: r('.mh-home'), joy: r('.mh-joy'), s: window.__mahalle.state() }; });
    const inb = (e) => e.l >= -1 && e.t >= -1 && e.r <= L.iw + 1 && e.b <= L.ih + 1;
    const kidPx = 64 * L.s.scale;
    check(`M14 ${vp.width}x${vp.height}: kontroller ekranda, tasma yok, dokunma hedefi >= 44px, karakter okunur (${Math.round(kidPx)}px)`, inb(L.act) && inb(L.home) && inb(L.joy) && L.sw <= L.iw + 1 && L.act.h >= 44 && L.home.w >= 44 && L.joy.w >= 96 && kidPx >= 28, JSON.stringify(L));
    await shot(page, `m-${vp.width}x${vp.height}`); await ctx.close();
  }
  { const { ctx, page } = await mk({ width: 800, height: 360 }, '#/'); await page.waitForSelector('.mm'); const b = page.locator('.mm-hood');
    check('M15 ana menude "Mahalle (prototip)" dugmesi var ve tiklaninca mahalleye gider; mevcut 5 kart yerinde', (await b.count()) === 1 && (await page.locator('.mm-card').count()) === 5);
    await b.click(); await page.waitForSelector('.mh .mh-cv'); check('M16 menu dugmesi #/mahalle acar', (await page.evaluate(() => location.hash)) === '#/mahalle');
    await page.locator('.mh-home').click(); await page.waitForSelector('.mm'); check('M17 Ev (🏠) dugmesi ana menuye doner', true);
    await page.evaluate(() => { location.hash = '#/adventure'; }); await page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 8000 }); check('M18 mevcut Macera haritasi hala aciliyor (regresyon)', (await page.locator('.adv-node').count()) > 5);
    await ctx.close(); }
  { const { ctx, page } = await mk({ width: 800, height: 360 }); await page.waitForSelector('.mh .mh-cv');
    const fps = await page.evaluate(() => new Promise((res) => { window.__mahalle.teleport(900, 640); let n = 0; const t0 = performance.now(); const kd = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }); window.dispatchEvent(kd); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else { window.dispatchEvent(new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true })); res(n / ((performance.now() - t0) / 1000)); } }; requestAnimationFrame(f); }));
    console.log(`  bilgi: baş­sız Chromium'da ortalama ${fps.toFixed(0)} kare/sn (yazilim cizimi; cihaz performansi DEGIL)`); await ctx.close(); }
} finally { await browser.close(); server.close(); }
const fail = results.filter((x) => !x).length; console.log(`\nMAHALLE R1 UI: ${results.length - fail}/${results.length} basarili${fail ? `, ${fail} BASARISIZ` : ''}`); process.exit(fail ? 1 : 0);
