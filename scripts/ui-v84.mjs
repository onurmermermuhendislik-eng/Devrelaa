// V8.4 HEDEFLI tarayici testi (Chromium) - ASAMA B (ekran yonu/yerlesim): YALNIZ Enerji Macerasi yatay; diger tum oyunlar dikey+yatay; yon degisimi/yeniden boyutlandirma/gecis.
// Tam arayuz duman testi (545) bu dosyadan AYRIDIR ve burada calistirilmaz.   node scripts/ui-v84.mjs   SHOTS=/yol  ONLY=A,B,...
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

const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const go = async (page, hash = '') => { await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + hash); };
const tap = (page, sel) => page.locator(sel).first().click({ force: true }); // nabiz animasyonu "durgun" kontrolunu bozar; asagidaki topHit gercek vurusu dogrular
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const topHit = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); }, sel);
const overflow = (page) => page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, w: innerWidth, h: innerHeight }));
const onMap = (page) => page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 6000 });

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
const SEED = { band: '4-5', sound: false, seen: true, adv: { intro: true, tasks: {} } };
const mk = async (seed, vp, opts = {}) => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; const external = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  if (opts.bridge) await page.addInitScript(() => { window.__ol = []; window.AltezOrientation = { lockLandscape() { window.__ol.push('lock'); }, unlock() { window.__ol.push('unlock'); } }; });
  return { ctx, page, errs, external };
};
const olog = (page) => page.evaluate(() => (window.__ol || []).slice());
const menuUp = (page) => page.waitForSelector('.mm[data-screen="menu"]', { timeout: 10000 });
// yatay tasma, gorunen "cihazi cevir" uyarisi, ekran disina tasan dugmeler (yatayda), ust uste binen dugmeler
const layout = (page) => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const rot = document.querySelector('.adv-rotate'); const rotate = !!rot && getComputedStyle(rot).display !== 'none';
  const btns = [...document.querySelectorAll('button')].filter(vis);
  const offX = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1; }).length;
  const top = [...document.querySelectorAll('.gm-bar button, .gm-back, header button, [data-act="back"], [data-act="home"]')].filter(vis);
  return { sw: document.documentElement.scrollWidth, w: innerWidth, rotate, offX, nBtn: btns.length, nTop: top.length };
});
const advBlocks = (page) => page.evaluate(() => {
  const R = (e) => e.getBoundingClientRect();
  const cs = [...document.querySelectorAll('.adv-block')].filter((e) => { const r = R(e); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none'; });
  const inside = cs.every((e) => { const r = R(e); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
  let ov = 0; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { if (cs[i].contains(cs[j]) || cs[j].contains(cs[i])) continue; const a = R(cs[i]), b = R(cs[j]); if (a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2) ov++; }
  return { n: cs.length, inside, ov, rotate: !!document.querySelector('.adv-rotate') && getComputedStyle(document.querySelector('.adv-rotate')).display !== 'none' };
});
const GAMES = ['shape-complete', 'number-hunt', 'invent', 'learn', 'tasks'];
const PORT = [[360, 640], [320, 568], [412, 915], [800, 1280]];
const LAND = [[640, 360], [568, 320], [915, 412], [1280, 800]];
const ADVL = [[568, 320], [640, 360], [740, 360], [800, 360], [915, 412], [1024, 600], [1280, 800]];

try {
  // B1: her oyun, dikey + yatay: acilir, yatay tasma yok, "cihazi cevir" engeli yok, kontroller ekranda, hata yok
  for (const g of GAMES) {
    for (const [w, h] of [...PORT, ...LAND]) {
      const { page, errs, ctx, external } = await mk(SEED, { width: w, height: h });
      await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + '#/play/' + g); await W(page, 1500);
      const m = await layout(page);
      check(`B1 ${g} ${w}x${h} ${w < h ? 'DIKEY' : 'YATAY'}: acilir, yatay tasma yok, "cihazi cevir" engeli yok, dugmeler ekranda`, m.sw <= m.w + 1 && !m.rotate && m.offX === 0 && m.nBtn >= 2 && errs.length === 0 && external.length === 0, JSON.stringify({ ...m, errs: errs.slice(0, 1) }));
      await ctx.close();
    }
  }
  // B2: oynanabilirlik (dikey ve yatay): Sayi Avi ve Sekli Tamamla'da secenekler dokunulabilir ve dogru cevap ilerleme yazar
  for (const g of ['number-hunt', 'shape-complete']) for (const [w, h] of [[360, 640], [640, 360]]) {
    const { page, errs, ctx } = await mk(SEED, { width: w, height: h });
    await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + '#/play/' + g); await W(page, 1200);
    const n = await page.locator('.options > *').count();
    const hitOk = await page.evaluate(() => [...document.querySelectorAll('.options > *')].every((e) => { const r = e.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const t = document.elementFromPoint(x, y); return r.right <= innerWidth + 1 && r.left >= -1 && t && (t === e || e.contains(t)); }));
    let before = JSON.stringify(await store(page)); let moved = false;
    for (let i = 0; i < n && !moved; i++) { await page.locator('.options > *').nth(i).click({ force: true }); await W(page, 900); moved = JSON.stringify(await store(page)) !== before; }
    check(`B2 ${g} ${w}x${h}: ${n} secenek ekranda ve ust uste binmiyor (dokunma hedefi), dokunus ilerleme yazar`, n >= 2 && hitOk && moved && errs.length === 0, JSON.stringify({ n, hitOk, moved, errs: errs.slice(0, 1) }));
    await ctx.close();
  }
  // B3: oyundayken YON DEGISIMI (dikey <-> yatay): sayfa yenilenmez, ekran/durum korunur, tasma yok
  for (const g of ['shape-complete', 'number-hunt', 'invent', 'learn']) {
    const { page, errs, ctx } = await mk(SEED, { width: 360, height: 640 }, { bridge: true });
    await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + '#/play/' + g); await W(page, 1200);
    await page.evaluate(() => { window.__marker = 'same-page'; });
    const html0 = await page.evaluate(() => document.querySelector('.stage, .learn, .invent, main')?.textContent?.trim().slice(0, 60) || '');
    await page.setViewportSize({ width: 640, height: 360 }); await W(page, 700);
    const mL = await layout(page);
    await page.setViewportSize({ width: 360, height: 640 }); await W(page, 700);
    const mP = await layout(page);
    const same = await page.evaluate(() => window.__marker === 'same-page' && location.hash.startsWith('#/play/'));
    const html1 = await page.evaluate(() => document.querySelector('.stage, .learn, .invent, main')?.textContent?.trim().slice(0, 60) || '');
    check(`B3 ${g}: dikey->yatay->dikey: sayfa yenilenmez, ayni ekran/soru korunur, tasma yok, yon kilidi cagrilmaz`, same && html0 === html1 && mL.sw <= mL.w + 1 && mP.sw <= mP.w + 1 && !(await olog(page)).includes('lock') && errs.length === 0, JSON.stringify({ same, html0, html1, mL, mP, ol: await olog(page) }));
    await ctx.close();
  }
  // B4: yon kilidi gecisleri (Android koprusu sahte): menu serbest -> oyun serbest -> Enerji Macerasi kilitli -> menu serbest ...
  {
    const { page, errs, ctx } = await mk(SEED, { width: 360, height: 640 }, { bridge: true });
    await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2)); await menuUp(page); await W(page, 300);
    check('B4a ana menu: kilit yok', !(await olog(page)).includes('lock'));
    for (const g of ['shape-complete', 'number-hunt', 'invent']) {
      await page.evaluate((id) => { location.hash = '#/play/' + id; }, g); await W(page, 700);
      check(`B4b ${g}: yatay kilit istenmez`, !(await olog(page)).includes('lock'), JSON.stringify(await olog(page)));
      await page.evaluate(() => window.__altezBack.handle()); await W(page, 600);
    }
    await page.evaluate(() => { location.hash = '#/'; }); await menuUp(page);
    await tap(page, '[data-act="adv"]'); await onMap(page); await W(page, 300);
    check('B4c Enerji Macerasi: yatay KILIT istenir', (await olog(page)).at(-1) === 'lock', JSON.stringify(await olog(page)));
    await page.evaluate(() => window.__altezBack.handle()); await menuUp(page); await W(page, 300);
    check('B4d macera -> menu: kilit KALKAR', (await olog(page)).at(-1) === 'unlock', JSON.stringify(await olog(page)));
    await page.evaluate(() => { location.hash = '#/play/number-hunt'; }); await W(page, 700);
    const n1 = (await olog(page)).length;
    await page.evaluate(() => { location.hash = '#/play/energy-adventure'; }); await W(page, 700);
    check('B4e Oyunlar listesindeki Enerji Macerasi (play/energy-adventure): yatay kilit istenir', (await olog(page)).at(-1) === 'lock' && (await olog(page)).length > n1, JSON.stringify(await olog(page)));
    await page.evaluate(() => { location.hash = '#/play/shape-complete'; }); await W(page, 700);
    check('B4f Enerji Macerasi -> baska oyun: kilit KALKAR (yatay kisit tasmaz)', (await olog(page)).at(-1) === 'unlock', JSON.stringify(await olog(page)));
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await page.evaluate(() => { location.hash = '#/adventure'; }); await W(page, 700);
    await page.evaluate(() => { document.dispatchEvent(new Event('visibilitychange')); }); await W(page, 200);
    check('B4g arka plandan donuste (visibilitychange) kilit durumu yeniden uygulanir, tutarli (son cagri lock)', (await olog(page)).at(-1) === 'lock');
    check('B4h hata yok', errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  // B5: Enerji Macerasi YATAY: harita + gorev + oduller, 7 boyut: icerik ekranda, ust uste binme yok
  for (const [w, h] of ADVL) {
    const { page, errs, ctx } = await mk(SEED, { width: w, height: h });
    await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + '#/adventure'); await onMap(page); await W(page, 700);
    let a = await advBlocks(page);
    check(`B5 harita ${w}x${h}: HUD/dugumler/maskot ekranda, ust uste binme yok, "cihazi cevir" yok`, a.n >= 8 && a.inside && a.ov === 0 && !a.rotate && errs.length === 0, JSON.stringify({ ...a, errs: errs.slice(0, 1) }));
    await page.locator('.adv-node.open').first().click({ force: true }); await W(page, 900);
    a = await advBlocks(page);
    const o = await overflow(page);
    check(`B5 gorev ${w}x${h}: gorev ekrani ekranda, binme yok, tasma yok`, a.n >= 3 && a.inside && a.ov === 0 && !a.rotate && o.sw <= o.w && errs.length === 0, JSON.stringify({ ...a, o, errs: errs.slice(0, 1) }));
    await ctx.close();
  }
  // B6: Enerji Macerasi dikeyde acilirsa: kilit uygulanamayan ortamda yedek uyari (oyun ekrani kesilmeden yonlendirir)
  {
    const { page, ctx } = await mk(SEED, { width: 360, height: 640 });
    await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + '#/adventure'); await onMap(page); await W(page, 500);
    check('B6 Enerji Macerasi kilitlenemeyen dikey ortamda "cihazi cevir" yedek uyarisi gorunur (icerik kesik gosterilmez)', await page.locator('.adv-mapscreen .adv-rotate').isVisible());
    await page.setViewportSize({ width: 640, height: 360 }); await W(page, 500);
    check('B6b yatay donunce uyari kalkar, harita ayni sayfada kalir (yenilenmez)', !(await page.locator('.adv-mapscreen .adv-rotate').isVisible()) && (await page.locator('.adv-node').count()) >= 8);
    await ctx.close();
  }
  // B7: Geri tusu / yeniden acma: oyundan Geri -> liste -> menu; sayfa yenileme ayni rotada acilir
  {
    const { page, errs, ctx } = await mk(SEED, { width: 360, height: 640 }, { bridge: true });
    await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2)); await menuUp(page);
    await tap(page, '[data-act="play"]'); await page.waitForSelector('.home.games'); await tap(page, '.game-card[data-game="invent"]'); await W(page, 900);
    await page.evaluate(() => window.__altezBack.handle()); await W(page, 700);
    check('B7a oyundan Geri: Oyunlar listesine doner, dikeyde bozulma yok', (await page.locator('.home.games').count()) === 1 && (await layout(page)).sw <= 361);
    await page.evaluate(() => window.__altezBack.handle()); await menuUp(page);
    check('B7b Geri: Oyunlar -> ana menu', true);
    await page.reload(); await menuUp(page);
    check('B7c yeniden acma: ana menu serbest, hata yok', !(await olog(page)).includes('lock') && errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ================= ASAMA C: Caglayan giris sesi (yalniz mevcut mekanizma; Chromium simulasyonu, GERCEK CIHAZ DEGIL) =================
  const mkC = async (seed, opts = {}) => {
    const r = await mk(seed, { width: 640, height: 360 });
    if (opts.speech) await r.page.addInitScript(FAKE_SPEECH, opts.speech);
    await r.page.addInitScript((gate) => {
      window.__ok = 0; window.__rej = 0; window.__pa = 0; window.__gesture = false;
      addEventListener('pointerdown', () => { window.__gesture = true; }, true);
      const op = HTMLMediaElement.prototype.play; const opa = HTMLMediaElement.prototype.pause;
      HTMLMediaElement.prototype.pause = function () { if (/intro-caglayan\.mp3/.test(this.currentSrc || this.src)) window.__pa++; return opa.call(this); };
      HTMLMediaElement.prototype.play = function () {
        if (!/intro-caglayan\.mp3/.test(this.currentSrc || this.src)) return op.call(this);
        if (gate && !window.__gesture) { window.__rej++; return Promise.reject(new DOMException('play() failed: user gesture required', 'NotAllowedError')); }
        window.__ok++; return op.call(this);
      };
    }, !!opts.gate);
    return r;
  };
  const cnt = (page) => page.evaluate(() => ({ ok: window.__ok, rej: window.__rej, pa: window.__pa }));
  const FRESH = () => BASE + '?r=' + Math.random().toString(36).slice(2);
  {
    const { page, errs, ctx } = await mkC(null, { speech: 'end' });
    await page.goto(FRESH()); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 13500);
    const c = await cnt(page);
    check('C1 ilk acilis: Caglayan sesi tanitimda tam BIR kez baslar (cagri 1, reddedilen 0), TTS ile ust uste binmez', c.ok === 1 && c.rej === 0 && (await spoken(page)).length === 0 && (await page.evaluate(() => window.__sp.overlap)) === 0, JSON.stringify([c, await spoken(page)]));
    check('C2 ilk acilis akisi tamam, hata yok', await page.locator('.in-go').isVisible() && errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  {
    const { page, errs, ctx } = await mkC(null, { speech: 'end', gate: true });
    await page.goto(FRESH()); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 1200);
    let c = await cnt(page);
    check('C3 oynatma engelli ortam: ilk deneme reddedilir ama uygulama/akis bozulmaz', c.ok === 0 && c.rej === 1 && errs.length === 0, JSON.stringify(c));
    await page.touchscreen.tap(320, 180); await W(page, 800);
    c = await cnt(page);
    check('C4 ilk dokunusta (ilk saniyelerde) kayitli ses BIR kez baslar; ek deneme yok', c.ok === 1 && c.rej === 1, JSON.stringify(c));
    await page.touchscreen.tap(320, 180); await W(page, 500);
    check('C5 sonraki dokunuslar tekrar baslatmaz (yinelenen oynatma yok)', (await cnt(page)).ok === 1);
    await W(page, 12500);
    check('C6 akis tamam, hata yok', await page.locator('.in-go').isVisible() && errs.length === 0, errs.join('|'));
    await ctx.close();
  }
  {
    const { page, errs, ctx } = await mkC(null, { speech: 'end', gate: true });
    await page.goto(FRESH()); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 5200);
    await page.touchscreen.tap(320, 180); await W(page, 700);
    const c = await cnt(page);
    check('C7 gec dokunus (>4 sn): kayitli ses sahnenin ortasinda baslamaz', c.ok === 0 && errs.length === 0, JSON.stringify(c));
    await ctx.close();
  }
  {
    const { page, errs, ctx } = await mkC(null, { speech: 'end' });
    await page.goto(FRESH()); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 2500);
    const a = await cnt(page);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await W(page, 300);
    const h = await cnt(page);
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await W(page, 1500);
    const v = await cnt(page);
    check('C8 uygulama arka plana alininca giris sesi DURUR, one gelince yeniden baslamaz (calma sayisi ayni)', h.pa > a.pa && v.ok === 1 && errs.length === 0, JSON.stringify([a, h, v]));
    await ctx.close();
  }
  {
    const { page, errs, ctx } = await mkC(null, { speech: 'end' });
    await page.goto(FRESH()); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 2000);
    const a = await cnt(page);
    await page.evaluate(() => { location.hash = '#/play/number-hunt'; }); await W(page, 1200);
    const b2 = await cnt(page);
    check('C9 tanitim sirasinda baska ekrana gecis: ses durdurulur (pause), yeniden baslamaz, oyun acilir', b2.pa > a.pa && b2.ok === 1 && (await page.locator('.options > *').count()) >= 2 && errs.length === 0, JSON.stringify([a, b2, errs.slice(0, 1)]));
    await ctx.close();
  }
  {
    const { page, ctx } = await mkC(null, { speech: 'end' });
    const reqs = []; page.on('request', (r) => /\.mp3$/i.test(r.url()) && reqs.push(new URL(r.url()).pathname));
    await page.goto(FRESH()); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 1500);
    const reqs0 = [...reqs]; // yalniz uygulamanin KENDI istekleri (asagidaki test fetch'leri hariç)
    const man = await page.evaluate(async () => (await (await fetch('assets/manifest.json')).json()).sounds.introVoice);
    const good = await page.evaluate(async () => (await fetch('assets/sounds/intro-caglayan.mp3')).status);
    const bad = await page.evaluate(async () => (await fetch('assets/sounds/INTRO-CAGLAYAN.mp3')).status);
    check('C10 dosya yolu birebir "assets/sounds/intro-caglayan.mp3" (kucuk harf), istek bu yola gider; buyuk harfli yol YOK', man === 'assets/sounds/intro-caglayan.mp3' && good === 200 && bad !== 200 && reqs0.length >= 1 && reqs0.every((p) => p.endsWith('/assets/sounds/intro-caglayan.mp3') || p.endsWith('minilab-jingle.mp3')), JSON.stringify([man, good, bad, reqs0]));
    await ctx.close();
  }
  {
    const { page, ctx } = await mkC({ band: '4-5', sound: false, seen: true }, { speech: 'end' });
    await page.goto(FRESH() + '#/intro'); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 3000);
    const c = await cnt(page);
    check('C11 ses kapali: giris sesi calmaz (ok 0, rej 0), konusma yok', c.ok === 0 && c.rej === 0 && (await spoken(page)).length === 0, JSON.stringify(c));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
const fail = results.filter((r) => !r.ok);
console.log(`\nV8.4 UI: ${results.length - fail.length}/${results.length} gecti${fail.length ? `, ${fail.length} BASARISIZ` : ''}`);
process.exit(fail.length ? 1 : 0);
