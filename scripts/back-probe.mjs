// Teshis: Android Geri tusunun (history geri) uygulama icinde ne yaptigini gosterir. Test degildir.
import { createRequire } from 'node:module';
import { startServer } from './serve.mjs';
const require = createRequire(import.meta.url);
let chromium;
for (const p of [process.env.PLAYWRIGHT_PATH, '/home/claude/.npm-global/lib/node_modules/playwright', 'playwright'].filter(Boolean)) { try { ({ chromium } = require(p)); break; } catch {} }
const server = await startServer(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const seed = { band: '6-8', sound: false, seen: true, games: { invent: { correct: 0, found: [], saved: [{ v: 1, layout: 'loop', slots: ['wire', 'led', 'wire'], sw: ['open', 'open', 'open'] }, { v: 1, layout: 'loop', slots: ['led', 'wire', 'wire'], sw: ['open', 'open', 'open'] }] } } };
const fresh = async (url = BASE) => {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript((v) => { if (!localStorage.getItem('altez-minilab:v1')) localStorage.setItem('altez-minilab:v1', JSON.stringify(v)); }, seed);
  await page.goto(url);
  return { ctx, page };
};
const st = (page) => page.evaluate(() => ({ hash: location.hash, home: !!document.querySelector('.home .game-card'), game: !!document.querySelector('.inv'), drawer: !!document.querySelector('.overlay:not([hidden])'), len: history.length }));
// Android'de gecmis girdisi yoksa Geri tusu uygulamayi arka plana atar (WebView canGoBack=false). navigation.canGoBack ayni olcudur;
// ilk girdi 'about:blank' degil uygulamanin kendisi sayilir: bu yuzden yeni sekmenin bos girdisi cikarilir.
const back = async (page) => {
  const can = await page.evaluate(() => navigation.entries().filter((e) => e.url && e.url !== 'about:blank').indexOf(navigation.currentEntry) > 0);
  if (can) { await page.evaluate(() => history.back()); await page.waitForTimeout(300); }
  return can ? 'sayfa-ici-geri' : 'GECMIS-YOK: Android uygulamayi arka plana atar';
};
const home = async (page) => { await page.waitForSelector('.home .game-card'); };
const out = (n, s, extra = '') => console.log(n.padEnd(46), JSON.stringify(s), extra);
let c;
// A
c = await fresh(); await home(c.page); await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board');
let r = await back(c.page); out('A ana->oyun->Geri', await st(c.page), r); r = await back(c.page); out('A ikinci Geri (ana ekranda)', await st(c.page), r); await c.ctx.close();
// B
c = await fresh(); await home(c.page); await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board');
await c.page.click('[data-act="mine"]'); await c.page.waitForSelector('.inv-save'); out('B cekmece acik', await st(c.page));
r = await back(c.page); out('B Geri (cekmece kapanmali, oyun kalmali)', await st(c.page), r);
r = await back(c.page); out('B Geri (ana ekran)', await st(c.page), r); await c.ctx.close();
// C yukle + geri
c = await fresh(); await home(c.page); await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board');
await c.page.click('[data-act="mine"]'); await c.page.waitForSelector('.inv-save'); await c.page.locator('.inv-save').first().click(); await c.page.waitForTimeout(300);
out('C yukleme sonrasi', await st(c.page)); r = await back(c.page); out('C Geri', await st(c.page), r); await c.ctx.close();
// D soguk dogrudan oyun (yeniden yukleme / sistemin geri getirmesi)
c = await fresh(BASE + '#/play/invent'); await c.page.waitForSelector('.inv .board'); out('D dogrudan #/play/invent', await st(c.page));
r = await back(c.page); out('D Geri', await st(c.page), r); await c.ctx.close();
// E ana->oyun->yeniden yukle->Geri
c = await fresh(); await home(c.page); await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board');
await c.page.reload(); await c.page.waitForSelector('.inv .board'); out('E yeniden yukleme sonrasi', await st(c.page));
r = await back(c.page); out('E Geri', await st(c.page), r); await c.ctx.close();
// F cekmece acikken yeniden yukle, sonra Geri
c = await fresh(); await home(c.page); await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board');
await c.page.click('[data-act="mine"]'); await c.page.waitForSelector('.inv-save'); await c.page.reload(); await c.page.waitForSelector('.inv .board'); out('F cekmece acikken yeniden yukleme', await st(c.page));
r = await back(c.page); out('F Geri', await st(c.page), r); r = await back(c.page); out('F Geri 2', await st(c.page), r); await c.ctx.close();
// G cekmece X ile kapat, sonra Geri
c = await fresh(); await home(c.page); await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board');
await c.page.click('[data-act="mine"]'); await c.page.waitForSelector('.inv-save'); await c.page.click('[data-act="closeMine"]'); await c.page.waitForTimeout(250);
out('G X sonrasi', await st(c.page)); r = await back(c.page); out('G Geri', await st(c.page), r); await c.ctx.close();
// H cekmece ac-kapa 3 kez, sonra tek Geri
c = await fresh(); await home(c.page); await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board');
for (let i = 0; i < 3; i++) { await c.page.click('[data-act="mine"]'); await c.page.waitForSelector('.inv-save'); await c.page.click('[data-act="closeMine"]'); await c.page.waitForTimeout(200); }
out('H 3x ac/kapa', await st(c.page)); r = await back(c.page); out('H Geri', await st(c.page), r); await c.ctx.close();
// I hizli cift Geri (cekmece acik)
c = await fresh(); await home(c.page); await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board');
await c.page.click('[data-act="mine"]'); await c.page.waitForSelector('.inv-save');
await c.page.evaluate(() => { history.back(); history.back(); }); await c.page.waitForTimeout(400); out('I hizli cift Geri', await st(c.page)); await c.ctx.close();
// J dinleyici birikmesi: oyuna 5 kez gir/cik
c = await fresh(); await home(c.page);
await c.page.evaluate(() => { window.__pc = 0; const o = window.addEventListener; const r = window.removeEventListener; window.addEventListener = function (t, ...a) { if (t === 'popstate') window.__pc++; return o.call(this, t, ...a); }; window.removeEventListener = function (t, ...a) { if (t === 'popstate') window.__pc--; return r.call(this, t, ...a); }; });
for (let i = 0; i < 5; i++) { await c.page.click('[data-game="invent"]'); await c.page.waitForSelector('.inv .board'); await c.page.click('[data-act="mine"]'); await c.page.waitForSelector('.inv-save'); await c.page.click('[data-act="closeMine"]'); await c.page.waitForTimeout(150); await c.page.click('[data-act="home"]'); await home(c.page); await c.page.waitForTimeout(150); }
out('J 5 gir/cik sonrasi popstate dinleyici sayisi', await st(c.page), 'dinleyici=' + await c.page.evaluate(() => window.__pc)); await c.ctx.close();
await browser.close(); server.close();
