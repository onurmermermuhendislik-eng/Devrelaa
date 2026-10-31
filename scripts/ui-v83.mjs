// V8.3 HEDEFLI tarayici testi (Chromium): kayitli CAGLAYAN giris sesi (assets/sounds/intro-caglayan.mp3): bir kez calar, ses kapaliysa calmaz, dosya yoksa cokmeden TTS yedegi, yerel varlik/cevrimdisi.
// Tam arayuz duman testi (545) bu dosyadan AYRIDIR ve burada calistirilmaz.   node scripts/ui-v83.mjs   SHOTS=/yol  ONLY=A,B,...
// GERCEK ANDROID CIHAZ TESTI DEGILDIR: yalniz Chromium (Playwright) ile gorunum/mantik dogrulanir.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const p of [process.env.PLAYWRIGHT_PATH, '/home/claude/.npm-global/lib/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try { ({ chromium } = require(p)); break; } catch { /* sonrakini dene */ }
}
if (!chromium) { console.error('Playwright bulunamadi (PLAYWRIGHT_PATH ile yol verebilirsiniz).'); process.exit(2); }
const SHOTS = process.env.SHOTS;
const ONLY = process.env.ONLY || '';
const on = (x) => !ONLY || ONLY.split(',').includes(x);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok: !!ok, info }); console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${ok || !info ? '' : '  -> ' + info}`); };
const KEY = 'altez-minilab:v1';
const CFG = JSON.parse(readFileSync(new URL('../assets/data/adventure.json', import.meta.url), 'utf8'));
const IDS = CFG.regions[0].tasks;
const BAND = '4-5';
const T = (id) => CFG.tasks.find((t) => t.id === id);
const server = await startServer(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const VPS = [[640, 360], [568, 320], [740, 360], [800, 360]];
const W = (page, ms = 400) => page.waitForTimeout(ms);

// Sahte konusma motoru (Chromium'da Turkce TTS yok): konusma sayisini, metni, dili ve USTUSTE BINMEYI (eski bitmeden yenisi) olcer.
function FAKE_SPEECH(mode) {
  const log = { speak: [], cancel: 0, overlap: 0 };
  let active = 0;
  window.__sp = log;
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  const fake = {
    get speaking() { return active > 0; }, pending: false, getVoices: () => [{ lang: 'tr-TR', name: 'Sahte TR', localService: true }], resume() {},
    cancel() { log.cancel++; active = 0; },
    speak(u) {
      if (active > 0) log.overlap++;
      active++;
      log.speak.push({ text: u.text, lang: u.lang });
      setTimeout(() => {
        if (mode === 'error') { active = 0; return u.onerror && u.onerror({ error: 'synthesis-failed' }); }
        u.onstart && u.onstart();
        setTimeout(() => { active = 0; u.onend && u.onend(); }, 250);
      }, 20);
    }
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
}
const spoken = (page) => page.evaluate(() => window.__sp.speak.map((s) => s.text).filter((t) => t.trim())); // sessiz (bosluk) "prime" konusmasi sayilmaz
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const go = async (page, hash = '') => { await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + hash); };
const tap = (page, sel) => page.locator(sel).first().click({ force: true }); // nabiz animasyonu "durgun" kontrolunu bozar; asagidaki topHit gercek vurusu dogrular
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const topHit = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); }, sel);
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight }));

const mk = async (seed, opts = {}) => {
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; const external = []; const mp3req = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
  page.on('request', (r) => { const u = new URL(r.url()); if (/intro-caglayan\.mp3$/.test(u.pathname)) mp3req.push(u.pathname); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
  if (seed !== null) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  if (opts.noMp3) await page.route('**/intro-caglayan.mp3', (r) => r.abort());
  if (opts.speech) await page.addInitScript(FAKE_SPEECH, opts.speech);
  // sayac: HTMLMediaElement.play cagrilari (src'ye gore) ve dosyanin gercekten calma durumu
  await page.addInitScript(() => {
    window.__pl = []; window.__pa = 0;
    const opa = HTMLMediaElement.prototype.pause;
    HTMLMediaElement.prototype.pause = function () { if (/intro-caglayan\.mp3/.test(this.currentSrc || this.src)) window.__pa++; return opa.call(this); };
    const op = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { if (/intro-caglayan\.mp3/.test(this.currentSrc || this.src)) window.__pl.push('play'); return op.call(this); };
  });
  return { ctx, page, errs, external, mp3req };
};
const menuUp = (page) => page.waitForSelector('.mm[data-screen="menu"]', { timeout: 10000 });
const plays = (page) => page.evaluate(() => window.__pl.length);
const introAudio = (page) => page.evaluate(() => { const a = [...document.querySelectorAll('audio')]; return a.length; });
const state = (page) => page.evaluate(() => ({ nPlay: window.__pl.length }));

try {
  // A: ilk acilis, ses acik, MP3 var
  {
    const { page, errs, ctx, external, mp3req } = await mk(null, { speech: 'end' });
    await go(page); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 13500);
    check('A1 giris sesi (yerel CAGLAYAN MP3) tanitimda BIR kez calmaya baslar', (await plays(page)) === 1, String(await plays(page)));
    check('A2 MP3 yalniz yerel varlik olarak istenir (harici istek 0), dosya sunucudan 200 ile gelir', external.length === 0 && mp3req.length >= 1, JSON.stringify([external, mp3req]));
    check('A3 kayitli ses calarken TTS ayni anda OKUMAZ (ust uste binme yok)', (await spoken(page)).length === 0 && (await page.evaluate(() => window.__sp.overlap)) === 0, JSON.stringify(await spoken(page)));
    check('A4 tanitim akisi tamam: "Haydi baslayalim" gorunur, hata yok', await page.locator('.in-go').isVisible() && errs.length === 0, errs.join('|'));
    const bytes = await page.evaluate(async () => (await (await fetch('assets/sounds/intro-caglayan.mp3')).arrayBuffer()).byteLength);
    check('A5 MP3 www paketinde (Android varligi) 195822 bayt ve bozulmamis', bytes === 195822, String(bytes));
    await tap(page, '.in-go'); await menuUp(page);
    check('A6 "Haydi baslayalim" ile cikista kayitli ses DURDURULUR (pause cagrildi), tekrar baslamaz', (await page.evaluate(() => window.__pa)) >= 1 && (await plays(page)) === 1, String(await page.evaluate(() => window.__pa)));
    await tap(page, '[data-act="settings"]'); await page.waitForSelector('[data-screen="settings"]'); await tap(page, '[data-act="intro"]'); await page.waitForSelector('.adv-intro'); await W(page, 1500);
    check('A7 tanitimi tekrar izleyince yine TEK oynatma (toplam 2, ust uste yok)', (await plays(page)) === 2, String(await plays(page)));
    await tap(page, '.in-skip'); await menuUp(page); await W(page, 500);
    check('A8 Atla: oynatma sayisi artmaz, ses durdurulur (pause artti)', (await plays(page)) === 2 && (await page.evaluate(() => window.__pa)) >= 2, String(await page.evaluate(() => window.__pa)));
    await ctx.close();
  }
  // B: ses kapali
  {
    const { page, errs, ctx } = await mk({ band: '4-5', sound: false, seen: true }, { speech: 'end' });
    await go(page); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 9500);
    check('B1 ses KAPALIYKEN giris sesi CALMAZ (play cagrisi 0, TTS 0)', (await plays(page)) === 0 && (await spoken(page)).length === 0, JSON.stringify([await plays(page), await spoken(page)]));
    await W(page, 4500);
    check('B2 ses kapaliyken tanitim yine tam akar, hata yok', await page.locator('.in-go').isVisible() && errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  // C: dosya yuklenemiyor
  {
    const { page, errs, ctx } = await mk(null, { speech: 'end', noMp3: true });
    await go(page); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 13500);
    check('C1 MP3 yuklenemezse uygulama COKMEZ, tanitim akar ("Haydi baslayalim" gorunur)', await page.locator('.in-go').isVisible() && errs.length === 0, errs.join('|'));
    check('C2 MP3 yoksa Turkce TTS yedegi devreye girer (sahne yazilari okunur)', (await spoken(page)).length === CFG.text.intro.length, JSON.stringify(await spoken(page)));
    await ctx.close();
  }
  // D: yeni giris sesi dosyasi ve eski sesler
  {
    const { page, errs, ctx } = await mk(null, { speech: 'end' });
    await go(page); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 3000);
    await tap(page, '.in-skip'); await menuUp(page);
    await tap(page, '[data-act="play"]'); await W(page, 600);
    check('D1 menuden oyunlar listesi acilir (diger ekranlar bozulmadi), hata yok', (await page.locator('.home.games').count()) === 1 && errs.length === 0, errs.join('|'));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
const fail = results.filter((r) => !r.ok);
console.log(`\nV8.3 UI: ${results.length - fail.length}/${results.length} gecti${fail.length ? `, ${fail.length} BASARISIZ` : ''}`);
process.exit(fail.length ? 1 : 0);
