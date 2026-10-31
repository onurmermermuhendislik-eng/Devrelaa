// Mahalle R1 gorsel kontrol (ekran goruntuleri). GERCEK CIHAZ DEGILDIR.   SHOTS=/yol VPS=800x360,360x640 node scripts/ui-mahalle-shots.mjs
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url);
let chromium; for (const p of [process.env.PLAYWRIGHT_PATH, '/home/claude/.npm-global/lib/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = require(p)); break; } catch {} }
const SHOTS = process.env.SHOTS || '/tmp/mhshots'; mkdirSync(SHOTS, { recursive: true });
const server = await startServer(0); const BASE = `http://127.0.0.1:${server.address().port}/`; const browser = await chromium.launch();
const VPS = (process.env.VPS || '800x360').split(',').map((s) => s.split('x').map(Number));
for (const [w, h] of VPS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', (e) => errs.push(String(e))); page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await page.addInitScript(() => localStorage.setItem('altez-minilab:v1', JSON.stringify({ band: '4-5', sound: false, seen: true })));
  await page.goto(BASE + '?r=' + Math.random() + '#/mahalle'); await page.waitForSelector('.mh .mh-cv'); await page.waitForTimeout(500);
  const sh = (n) => page.screenshot({ path: `${SHOTS}/${w}x${h}-${n}.png` });
  await sh('1-baslangic');
  for (const id of ['okul', 'atolye', 'ev', 'market']) {
    const pos = { okul: [320, 520], atolye: [1310, 520], ev: [310, 980], market: [1370, 980] }[id];
    await page.evaluate(([x, y]) => window.__mahalle.teleport(x, y), pos); await page.waitForTimeout(450); await sh(`2-${id}-kapi`);
    await page.locator('.mh-act').click(); await page.waitForTimeout(600); await sh(`3-${id}-ic`);
    await page.locator('.mh-out').click(); await page.waitForTimeout(600);
  }
  console.log(`${w}x${h} hatalar:`, errs.length ? errs : 'yok'); await ctx.close();
}
await browser.close(); server.close();
