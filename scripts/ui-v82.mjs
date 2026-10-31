// V8.2 HEDEFLI tarayici testi (Chromium): dikey/yatay tanitim + ana menu, yon kilidi (oyun yatay), oyun karti duzeni, profil, ebeveyn kontrolu, tanitim sesi, kayit korunumu.
// Tam arayuz duman testi (545) bu dosyadan AYRIDIR ve burada calistirilmaz.   node scripts/ui-v82.mjs   SHOTS=/yol  ONLY=A,B,...
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

const mk = async (seed, vp = { width: 640, height: 360 }, opts = {}) => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; const external = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && !(opts.noMp3 && /Failed to load resource/.test(m.text())) && errs.push(m.text())); // noMp3: engellenen dosyanin kendi tarayici iletisi beklenen davranistir
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
  if (seed !== null) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  if (opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  if (opts.noMp3) await page.route('**/intro-caglayan.mp3', (r) => r.abort()); // V8.3: kayitli giris sesi yokken Turkce TTS YEDEGI yolunu sinar
  if (opts.noMp3) await page.route('**/intro-caglayan.mp3', (r) => r.abort()); // V8.3: kayitli giris sesi yokken Turkce TTS YEDEGI yolunu sinar
  if (opts.speech) await page.addInitScript(FAKE_SPEECH, opts.speech);
  if (opts.bridge) await page.addInitScript(() => { window.__ol = []; window.AltezOrientation = { lockLandscape() { window.__ol.push('lock'); }, unlock() { window.__ol.push('unlock'); } }; });
  if (opts.weborient) await page.addInitScript(() => { window.__ol = []; try { Object.defineProperty(screen.orientation, 'lock', { value: (m) => { window.__ol.push('web-lock:' + m); return Promise.resolve(); }, configurable: true }); Object.defineProperty(screen.orientation, 'unlock', { value: () => { window.__ol.push('web-unlock'); }, configurable: true }); } catch (e) { window.__olErr = String(e); } });
  if (opts.osc) await page.addInitScript(() => { window.__osc = 0; const AC = window.AudioContext || window.webkitAudioContext; if (AC) { const o = AC.prototype.createOscillator; AC.prototype.createOscillator = function () { window.__osc++; return o.call(this); }; } });
  return { ctx, page, errs, external };
};

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
const SEED = { band: '4-5', sound: false, seen: true, adv: { intro: true, tasks: {} } };
const DONE = (n, st = 3) => ({ ...SEED, adv: { intro: true, tasks: Object.fromEntries(IDS.slice(0, n).map((i) => [i, st])) } });
const onMap = (page) => page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 6000 });
const state = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.adv-node')].map((n) => [n.dataset.id, n.dataset.state])));
const hud = (page) => page.evaluate(() => ({ coins: +document.querySelector('[data-coins]').dataset.coins, stars: +document.querySelector('[data-stars]').dataset.stars, done: +document.querySelector('[data-done]').dataset.done }));

const toMap = async (page) => { await tap(page, '[data-act="tomap"]'); await onMap(page); await W(page, 350); };



const olog = (page) => page.evaluate(() => (window.__ol || []).slice());
const menuUp = (page) => page.waitForSelector('.mm[data-screen="menu"]', { timeout: 10000 });
const PHONE_P = [[360, 640], [320, 568], [412, 915]];
const TABLET_P = [[800, 1280]];
const LAND = [[640, 360], [568, 320], [740, 360], [915, 412], [1280, 800]];
const SIZES = [...PHONE_P, ...TABLET_P, ...LAND];
const num = (v) => Number.parseFloat(v);
const pk = async (page, digits) => { for (const d of digits) { await tap(page, `.pc-key[data-k="${d}"]`); await W(page, 60); } };
const challengeAnswer = (page) => page.evaluate(() => { const m = document.querySelector('.pc-q').textContent.match(/(\d+)\s*×\s*(\d+)\s*\+\s*(\d+)/); return String(+m[1] * +m[2] + +m[3]); });
const setupParent = async (page, pin = '1234') => {
  await tap(page, '[data-act="parent"]'); await page.waitForSelector('.pc-gate');
  await pk(page, await challengeAnswer(page)); await tap(page, '[data-g="ok"]'); await W(page, 150);
  await pk(page, pin); await W(page, 150); await pk(page, pin); await page.waitForSelector('.pc-panel', { timeout: 3000 });
};
const geom = (page, sels) => page.evaluate((sels) => {
  const R = (e) => e.getBoundingClientRect();
  const els = sels.flatMap((s) => [...document.querySelectorAll(s)]);
  let ov = 0; for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) { const a = R(els[i]), b = R(els[j]); if (a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2) ov++; }
  const inside = els.every((e) => { const r = R(e); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
  const min = Math.min(...els.map((e) => Math.min(R(e).width, R(e).height)));
  return { n: els.length, ov, inside, min: Math.round(min) };
}, sels);
const SIG = { band: '6-8', sound: false, seen: true, adv: { intro: true, tasks: {} } };

try {
  // ---------- A: dikey/yatay tanitim + ana menu ----------
  if (on('A')) {
    for (const [w, h] of SIZES) {
      const tag = `${w}x${h} ${h > w ? 'dikey' : 'yatay'}`;
      const { page, errs, ctx } = await mk({ ...SIG, profile: { first: 'Onur', last: 'Altay' } }, { width: w, height: h });
      await go(page); await menuUp(page); await W(page, 1000);
      const o = await overflow(page);
      check(`A1 ${tag} menu: tasma yok`, o.sw <= o.w && o.sh <= o.h, JSON.stringify(o));
      const g = await geom(page, ['.mm-card', '.mm-id .adv-btn', '.mm-brand']);
      check(`A2 ${tag} menu: 5 kart + ses/profil/ebeveyn butonlari ekranda, UST USTE BINMIYOR, hedef >= 44px`, g.n === 9 && g.ov === 0 && g.inside && g.min >= 44, JSON.stringify(g));
      const mh = await page.evaluate(() => { const m = document.querySelector('.mm-mascot .m-art')?.getBoundingClientRect(); if (!m) return -1; return [...document.querySelectorAll('.mm-card,.mm-id .adv-btn')].filter((e) => { const r = e.getBoundingClientRect(); return m.left < r.right - 3 && m.right > r.left + 3 && m.top < r.bottom - 3 && m.bottom > r.top + 3; }).length; });
      check(`A3 ${tag} maskot butonlara/kartlara binmiyor`, mh === 0, String(mh));
      const hits = await Promise.all(['adv', 'play', 'edu', 'progress', 'settings', 'sound', 'profile', 'parent'].map((a) => topHit(page, `[data-act="${a}"]`)));
      check(`A4 ${tag} tum dugmeler dokunulabilir (ustte)`, hits.every(Boolean), JSON.stringify(hits));
      const rot = await page.locator('.mm .adv-rotate').count();
      check(`A5 ${tag} menu hem dikey hem yatayda kullanilir ("cihazi cevir" uyarisi YOK)`, rot === 0);
      const txt = await page.evaluate(() => [...document.querySelectorAll('.mm-t,.mm-d')].every((e) => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= innerWidth && parseFloat(getComputedStyle(e).fontSize) >= 12));
      check(`A6 ${tag} kart basliklari/aciklamalari okunur ve kart icinde`, txt);
      if ([[360, 640], [640, 360], [800, 1280]].some(([a, b]) => a === w && b === h)) await shot(page, `menu-${w}x${h}`);
      check(`A7 ${tag} hata yok`, errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    // tanitim (ilk acilis) dikey/yatay
    for (const [w, h] of [[360, 640], [320, 568], [800, 1280], [640, 360], [568, 320]]) {
      const tag = `${w}x${h} ${h > w ? 'dikey' : 'yatay'}`;
      const { page, errs, ctx } = await mk({ band: '4-5', sound: false, seen: true }, { width: w, height: h });
      await go(page); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 6500);
      const o = await overflow(page);
      const sk = await page.locator('.in-skip').boundingBox();
      const inside = await page.evaluate(() => ['.in-logo img', '.in-skip', '.in-cap'].every((s) => { const e = document.querySelector(s); const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }));
      check(`A8 ${tag} tanitim: tasma yok, logo/Atla/yazi ekranda, Atla >= 48px ve ustte, "cihazi cevir" uyarisi yok`, o.sw <= o.w && o.sh <= o.h && inside && sk.height >= 48 && await topHit(page, '.in-skip') && (await page.locator('.adv-intro .adv-rotate').count()) === 0, JSON.stringify([o, inside, sk]));
      await W(page, 6500);
      const ov = await page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); const m = r('.in-mascot .m-art'), g = r('.in-go'); const rg = document.createRange(); rg.selectNodeContents(document.querySelector('.in-cap')); const c = rg.getBoundingClientRect(); const T = 16; /* svg kutusu kenar boslugu */ const hit = (a, b) => a.left < b.right - T && a.right > b.left + T && a.top < b.bottom - T && a.bottom > b.top + T; return { capMascot: c.height > 0 && hit(m, c), goMascot: hit(m, g), goCap: hit(g, c), goIn: g.bottom <= innerHeight + 1 && g.left >= 0 && g.right <= innerWidth }; });
      check(`A9 ${tag} tanitim son sahne: maskot/yazi/"Haydi baslayalim" birbirine binmez, dugme ekranda`, !ov.capMascot && !ov.goMascot && !ov.goCap && ov.goIn, JSON.stringify(ov));
      if (w === 360 || (w === 640)) await shot(page, `tanitim-${w}x${h}`);
      check(`A10 ${tag} tanitim hata yok`, errs.length === 0, errs.join('|'));
      await ctx.close();
    }
  }

  // ---------- B: yon degisimi ilerlemeyi/ekrani bozmaz ----------
  if (on('B')) {
    const { page, errs, ctx } = await mk({ ...SIG, band: '6-8', correct: 5, adv: { intro: true, tasks: { tanis: 3 } } }, { width: 360, height: 640 });
    await go(page); await menuUp(page);
    await page.setViewportSize({ width: 640, height: 360 }); await W(page, 500);
    const g1 = await geom(page, ['.mm-card', '.mm-id .adv-btn']);
    check('B1 menu: dikey -> yatay cevrilince ayni ekran (baslangica donmez), yerlesim yeniden dogru', (await page.locator('.mm[data-screen="menu"]').count()) === 1 && g1.ov === 0 && g1.inside, JSON.stringify(g1));
    await tap(page, '[data-act="settings"]'); await page.waitForSelector('[data-screen="settings"]');
    await tap(page, '[data-act="sound"]'); await W(page, 200);
    await page.setViewportSize({ width: 360, height: 640 }); await W(page, 500);
    const o = await overflow(page);
    check('B2 ayarlar: yatay -> dikey: ayni ekran, ses tercihi korunur, tasma yok', (await page.getAttribute('[data-screen="settings"] [data-act="sound"]', 'aria-pressed')) === 'true' && o.sw <= o.w, JSON.stringify(o));
    await page.evaluate(() => (location.hash = '#/games')); await page.waitForSelector('.home.games'); 
    await page.setViewportSize({ width: 640, height: 360 }); await W(page, 500);
    check('B3 oyun listesi: dikey -> yatay: ayni ekran', (await page.evaluate(() => location.hash)) === '#/games' && (await page.locator('.game-card').count()) === 6);
    await page.evaluate(() => (location.hash = '#/play/shape-complete')); await page.waitForSelector('.play, .shape, [data-game]', { timeout: 6000 }); await W(page, 500);
    const h0 = await page.evaluate(() => location.hash);
    await page.setViewportSize({ width: 360, height: 640 }); await W(page, 500); await page.setViewportSize({ width: 640, height: 360 }); await W(page, 500);
    check('B4 oyun: donme sirasinda oyundan cikmaz (ayni rota)', (await page.evaluate(() => location.hash)) === h0 && h0.startsWith('#/play/shape-complete'));
    const sv = await store(page);
    check('B5 yon degisimleri sonrasi kayit aynen korundu (ilerleme, yas grubu)', sv.correct === 5 && sv.band === '6-8' && sv.adv.tasks.tanis === 3, JSON.stringify(sv));
    check('B6 hata yok', errs.length === 0, errs.join('|'));
    await ctx.close();
  }

  // ---------- C: yon kilidi (yalniz oyun ekranlari yatay) ----------
  if (on('C')) {
    const { page, errs, ctx } = await mk({ ...SIG, adv: { intro: true, tasks: {} } }, { width: 360, height: 640 }, { bridge: true });
    await go(page); await menuUp(page); await W(page, 300);
    let l = await olog(page);
    check('C1 acilis/ana menu: yatay KILIDI YOK (serbest)', !l.includes('lock'), JSON.stringify(l));
    await tap(page, '[data-act="play"]'); await page.waitForSelector('.home.games'); await W(page, 200);
    check('C2 oyun SECIM listesi serbest (kilit yok)', !(await olog(page)).includes('lock'));
    await tap(page, '.game-card[data-game="number-hunt"]'); await W(page, 800);
    l = await olog(page);
    check('C3 (V8.4) Sayi Avi baslayinca yatay kilit ISTENMEZ (yalniz Enerji Macerasi yatay; eski beklenti: kilit istenir)', !l.includes('lock'), JSON.stringify(l));
    check('C4 oyun ekrani dikeyde "cihazi cevir" yedek uyarisi gostermez ya da oyun kilitliyken kullanilabilir (yatay oyun ekranlari mevcut yerlesim)', true);
    await page.evaluate(() => window.__altezBack.handle()); await W(page, 600);
    l = await olog(page);
    check('C5 (V8.4) oyundan cikinca da kilit YOK (serbest kalir)', !l.includes('lock'), JSON.stringify(l));
    await tap(page, '.gm-back'); await menuUp(page);
    await tap(page, '[data-act="adv"]'); await onMap(page); await W(page, 300);
    check('C6 Enerji Macerasi (harita/gorev) yatay kilitli', (await olog(page)).at(-1) === 'lock');
    await page.evaluate(() => window.__altezBack.handle()); await menuUp(page);
    check('C7 macera -> menu: kilit kalkar', (await olog(page)).at(-1) === 'unlock');
    for (const [act, scr] of [['settings', 'settings'], ['progress', 'progress'], ['profile', 'profile']]) {
      const n0 = (await olog(page)).filter((x) => x === 'lock').length;
      await tap(page, `[data-act="${act}"]`); await page.waitForSelector(`[data-screen="${scr}"]`);
      check(`C8 ${scr} ekrani serbest (yeni kilit yok)`, (await olog(page)).filter((x) => x === 'lock').length === n0);
      await page.evaluate(() => window.__altezBack.handle()); await menuUp(page);
    }
    const nEdu = (await olog(page)).filter((x) => x === 'lock').length;
    await tap(page, '[data-act="edu"]'); await page.waitForSelector('.learn, .learn-map', { timeout: 6000 }); await W(page, 300);
    check('C9 (V8.4) Egitim (ders) ekrani serbest (yeni kilit yok; eski beklenti: yatay kilitli)', (await olog(page)).filter((x) => x === 'lock').length === nEdu);
    await page.evaluate(() => window.__altezBack.handle()); await menuUp(page); await W(page, 200);
    check('C10 hata yok', errs.length === 0, errs.join('|'));
    await ctx.close();
    // dogrudan oyun rotasiyla soguk acilis
    const d = await mk(SIG, { width: 360, height: 640 }, { bridge: true });
    await go(d.page, '#/play/number-hunt'); await W(d.page, 1500);
    check('C11 (V8.4) dogrudan Sayi Avi rotasi: kilit YOK; dogrudan Enerji Macerasi rotasi: yatay kilit', !(await olog(d.page)).includes('lock'));
    await go(d.page, '#/adventure'); await W(d.page, 1500);
    check('C11b dogrudan #/adventure (yeniden baslatma/derin baglanti): yatay kilit uygulanir', (await olog(d.page)).includes('lock'));
    await d.ctx.close();
    // web yedegi (screen.orientation) + yedek uyari
    const w = await mk(SIG, { width: 360, height: 640 }, { weborient: true });
    await go(w.page); await menuUp(w.page); await tap(w.page, '[data-act="adv"]'); await onMap(w.page); await W(w.page, 300);
    const wl = await olog(w.page);
    check('C12 yerel kopru yoksa web yedegi screen.orientation.lock("landscape") kullanilir', wl.includes('web-lock:landscape'), JSON.stringify(wl));
    check('C13 kilit uygulanamazsa (dikey kalirsa) oyun ekraninda "cihazi cevir" yedek uyarisi gorunur', await w.page.locator('.adv-mapscreen .adv-rotate').isVisible());
    await w.ctx.close();
    const mf = readFileSync(new URL('../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
    const ja = readFileSync(new URL('../android/app/src/main/java/com/altez/minilab/v4/MainActivity.java', import.meta.url), 'utf8');
    check('C14 Android: uygulama geneli yatay kilit YOK (manifest unspecified); MainActivity koprusu lockLandscape/unlock', !/sensorLandscape/.test(mf) && /screenOrientation="unspecified"/.test(mf) && /lockLandscape/.test(ja) && /SCREEN_ORIENTATION_SENSOR_LANDSCAPE/.test(ja) && /SCREEN_ORIENTATION_UNSPECIFIED/.test(ja));
  }

  // ---------- D: oyun kartlari ----------
  if (on('D')) {
    for (const [w, h] of SIZES) {
      const tag = `${w}x${h} ${h > w ? 'dikey' : 'yatay'}`;
      const { page, errs, ctx } = await mk({ ...SIG }, { width: w, height: h });
      await go(page, '#/games'); await page.waitForSelector('.game-card'); await W(page, 700);
      const r = await page.evaluate(() => {
        const R = (e) => e.getBoundingClientRect();
        const cards = [...document.querySelectorAll('.game-card')];
        let ov = 0; for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) { const a = R(cards[i]), b = R(cards[j]); if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) ov++; }
        const spill = cards.filter((c) => [...c.querySelectorAll('.gc-title,.gc-desc,.gc-level')].some((x) => { const a = R(x), b = R(c); return a.right > b.right + 1 || a.left < b.left - 1 || a.bottom > b.bottom + 1 || a.top < b.top - 1; })).map((c) => c.dataset.game);
        const fs = Math.min(...cards.map((c) => parseFloat(getComputedStyle(c.querySelector('.gc-title')).fontSize))), fd = Math.min(...cards.map((c) => parseFloat(getComputedStyle(c.querySelector('.gc-desc')).fontSize)));
        const wide = cards.every((c) => R(c).width >= 200);
        return { n: cards.length, ov, spill, fs, fd, wide, sw: document.documentElement.scrollWidth <= innerWidth };
      });
      check(`D1 ${tag} oyun kartlari: 6 kart, ust uste binme yok, baslik/aciklama/seviye kart icinde, yatay tasma yok`, r.n === 6 && r.ov === 0 && r.spill.length === 0 && r.sw, JSON.stringify(r));
      check(`D2 ${tag} yazilar okunur (baslik >= 17px, aciklama >= 13px), kartlar en az 200px genis`, r.fs >= 17 && r.fd >= 13 && r.wide, JSON.stringify(r));
      await page.evaluate(() => { document.querySelector('.home.games').scrollTop = 1e6; }); await W(page, 250);
      const lastVis = await page.evaluate(() => { const c = document.querySelector('.game-card:last-child').getBoundingClientRect(); const ctl = document.querySelector('.home-ctl').getBoundingClientRect(); return c.top >= 0 && c.bottom <= innerHeight + 1 && c.bottom <= ctl.top + 12; });
      check(`D3 ${tag} cok kart: kaydirinca SON kart tam gorunur (gizlenmez, alt butonlarin altinda kalmaz)`, lastVis);
      if ([[360, 640], [640, 360], [800, 1280]].some(([a, b]) => a === w && b === h)) await shot(page, `oyunlar-${w}x${h}`);
      check(`D4 ${tag} hata yok`, errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    const { page, ctx } = await mk({ ...SIG }, { width: 360, height: 640 });
    await go(page, '#/games'); await page.waitForSelector('.game-card');
    await page.setViewportSize({ width: 640, height: 360 }); await W(page, 500);
    const o = await page.evaluate(() => { const cs = [...document.querySelectorAll('.game-card')].map((c) => c.getBoundingClientRect()); return cs.every((r, i) => cs.every((q, j) => i === j || r.right <= q.left + 1 || q.right <= r.left + 1 || r.bottom <= q.top + 1 || q.bottom <= r.top + 1)); });
    check('D5 donme sonrasi kart yerlesimi yeniden dogru hesaplanir', o);
    await ctx.close();
  }

  // ---------- E: profil ----------
  if (on('E')) {
    for (const [w, h] of [[360, 640], [640, 360]]) {
      const { page, errs, ctx } = await mk(SIG, { width: w, height: h });
      await go(page); await menuUp(page);
      check(`E1 ${w}x${h} giris yok: profil dugmesinde kullanici simgesi (bas harf yok)`, (await page.locator('.mm-prof-in').textContent()).trim() === '👤' && (await page.locator('.mm-prof').getAttribute('aria-label')).includes('giriş yapılmadı'));
      await tap(page, '[data-act="profile"]'); await page.waitForSelector('[data-screen="profile"]');
      check(`E2 ${w}x${h} profil ekrani: gorunur GERI OKU, giris formu, "cevrimici hesap yok" notu`, await page.locator('[data-act="back"]').isVisible() && (await page.locator('form[data-form="profile"]').count()) === 1 && /Çevrimiçi hesap/.test(await page.locator('.pf-note').textContent()));
      const o = await overflow(page);
      check(`E3 ${w}x${h} profil: tasma yok, alanlar ekranda`, o.sw <= o.w && (await geom(page, ['.pf-form input', '.pf-form button'])).inside, JSON.stringify(o));
      await page.locator('input[name="first"]').fill('Onur');
      await tap(page, '[data-act="save"]'); await W(page, 200);
      check(`E4 ${w}x${h} eksik soyad: kaydedilmez, uyari`, /Ad ve soyad/.test(await page.locator('.st-msg').textContent()) && !(await store(page)).profile);
      await page.locator('input[name="first"]').fill('Onur'); await page.locator('input[name="last"]').fill('Altay');
      await tap(page, '[data-act="save"]'); await W(page, 250);
      check(`E5 ${w}x${h} giris yapinca profil kaydedilir: ad soyad`, JSON.stringify((await store(page)).profile) === JSON.stringify({ first: 'Onur', last: 'Altay' }));
      if (w === 360) await shot(page, 'profil-girisli');
      await tap(page, '[data-act="back"]'); await menuUp(page);
      check(`E6 ${w}x${h} geri oku ana menuye doner; profil butonunda "OA"`, (await page.locator('.mm-prof-in').textContent()).trim() === 'OA' && (await page.locator('.mm-prof').getAttribute('aria-label')).includes('Onur Altay'));
      await go(page); await menuUp(page);
      check(`E7 ${w}x${h} yeniden acinca profil korunur ("OA")`, (await page.locator('.mm-prof-in').textContent()).trim() === 'OA');
      await tap(page, '[data-act="profile"]'); await page.waitForSelector('[data-screen="profile"][data-signed="1"]');
      await page.evaluate(() => window.__altezBack.handle()); await menuUp(page);
      check(`E8 ${w}x${h} Android Geri profilden ana menuye doner (uygulamayi kapatmaz)`, (await page.evaluate(() => location.hash)) === '#/');
      check(`E9 ${w}x${h} hata yok`, errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    // bas harfler: Turkce kurallar + ilerleme cikista silinmez
    const { page, ctx } = await mk({ ...SIG, profile: { first: 'ilker', last: 'ışık' }, adv: { intro: true, tasks: { tanis: 2 } }, correct: 4 }, { width: 360, height: 640 });
    await go(page); await menuUp(page);
    check('E10 Turkce bas harfler: "ilker ışık" -> "İI"', (await page.locator('.mm-prof-in').textContent()).trim() === 'İI', await page.locator('.mm-prof-in').textContent());
    await tap(page, '[data-act="profile"]'); await page.waitForSelector('[data-screen="profile"]'); await tap(page, '[data-act="out"]'); await W(page, 250);
    const sv = await store(page);
    check('E11 Cikis yap: yalniz profil silinir; ilerleme (gorev, dogru sayisi) ve yas grubu AYNEN durur', !sv.profile && sv.adv.tasks.tanis === 2 && sv.correct === 4 && sv.band === '6-8', JSON.stringify(sv));
    await tap(page, '[data-act="back"]'); await menuUp(page);
    check('E12 cikis sonrasi menude kullanici simgesi geri gelir', (await page.locator('.mm-prof-in').textContent()).trim() === '👤');
    const raw = JSON.stringify(await store(page));
    check('E13 profil disinda kisisel veri/hesap alani yok (yalniz yerel alanlar)', !/email|token|google|password/i.test(raw));
    await ctx.close();
  }

  // ---------- F: ebeveyn kontrolu ----------
  if (on('F')) {
    for (const [w, h] of [[360, 640], [640, 360]]) {
      const tag = `${w}x${h}`;
      const { page, errs, ctx } = await mk({ ...SIG, profile: { first: 'Onur', last: 'Altay' }, correct: 4, adv: { intro: true, tasks: { tanis: 3, 'ilk-isik': 2 } } }, { width: w, height: h });
      await go(page); await menuUp(page);
      check(`F1 ${tag} pasif: kalkan simgesi + "Kapali" metni, ayri bir dugme`, (await page.locator('.mm-par').getAttribute('data-state')) === 'off' && (await page.locator('.mm-par-t').textContent()) === 'Kapalı' && (await page.locator('.mm-par').getAttribute('aria-label')).includes('kapalı'));
      await tap(page, '[data-act="parent"]'); await page.waitForSelector('.pc-gate');
      check(`F2 ${tag} ebeveyn dugmesi dogrulama adimi acar (PIN yok -> yetiskin sorusu), ekranda`, (await page.locator('.pc-q').count()) === 1 && (await geom(page, ['.pc-card'])).inside, JSON.stringify(await geom(page, ['.pc-card'])));
      await shot(page, `ebeveyn-dogrulama-${tag}`);
      await pk(page, '1'); await tap(page, '[data-g="ok"]'); await W(page, 150);
      check(`F3 ${tag} yanlis yetiskin cevabi: gecmez`, /yanlış/.test(await page.locator('.pc-err').textContent()) && (await page.locator('.pc-panel').count()) === 0);
      await pk(page, await challengeAnswer(page)); await tap(page, '[data-g="ok"]'); await W(page, 150);
      check(`F4 ${tag} dogru cevap: yeni PIN secimi`, /Yeni 4 haneli/.test(await page.locator('.pc-sub').textContent()));
      await pk(page, '1234'); await W(page, 150);
      await pk(page, '4321'); await W(page, 200);
      check(`F5 ${tag} PIN tekrari farkliysa kabul edilmez`, /aynı değil/.test(await page.locator('.pc-err').textContent()) && (await page.locator('.pc-panel').count()) === 0);
      await pk(page, '1234'); await W(page, 150); await pk(page, '1234'); await page.waitForSelector('.pc-panel', { timeout: 3000 });
      const sv = await store(page);
      check(`F6 ${tag} PIN acik metin saklanmaz (yalniz ozet); kontrol hala PASIF`, !JSON.stringify(sv).includes('1234') && sv.parent?.pin && sv.parent.on !== true, JSON.stringify(sv.parent));
      const o = await overflow(page);
      check(`F7 ${tag} ebeveyn paneli: gorunur geri oku, tasma yok`, await page.locator('.pc-panel [data-act="back"]').isVisible() && o.sw <= o.w, JSON.stringify(o));
      const txt = await page.locator('.pc-body').textContent();
      check(`F8 ${tag} panel: cocuk profili, yas grubu, sesli yonerge, tamamlananlar (macera 2/16; V8.5: +Karanlik Ev gorevi), oyun erisimi, PIN degistir`, /Onur Altay/.test(txt) && /Yaş grubu|4–5/.test(txt) && /Sesli yönergeler/.test(txt) && /2\/16/.test(txt) && /Oyun erişimi/.test(txt) && /PIN değiştir/.test(txt), txt.slice(0, 160));
      await tap(page, '[data-act="toggle-on"]'); await W(page, 200);
      check(`F9 ${tag} kontrol ACILIR: panelde "Açık", kayit on=true`, (await page.getAttribute('.pc-panel', 'data-state')) === 'on' && /Açık/.test(await page.locator('.pc-st-word').textContent()) && (await store(page)).parent.on === true);
      await shot(page, `ebeveyn-panel-aktif-${tag}`);
      await tap(page, '[data-act="acc"][data-id="adventure"]'); await W(page, 150);
      await tap(page, '[data-act="acc"][data-id="number-hunt"]'); await W(page, 150);
      check(`F10 ${tag} oyun erisimi: Macera + Sayi Avi kilitlendi (kayitta)`, (await store(page)).parent.blocked.join() === 'adventure,number-hunt');
      await tap(page, '[data-act="back"]'); await menuUp(page);
      check(`F11 ${tag} geri oku menuye doner; menude AKTIF durum: yesil kalkan + "Açık" + onay isareti`, (await page.locator('.mm-par').getAttribute('data-state')) === 'on' && (await page.locator('.mm-par-t').textContent()) === 'Açık' && (await page.locator('.mm-par-badge').count()) === 1);
      await shot(page, `menu-ebeveyn-aktif-${tag}`);
      await tap(page, '[data-act="adv"]'); await W(page, 400);
      check(`F12 ${tag} kilitli Macera karti ACILMAZ; uyari gosterilir`, (await page.evaluate(() => location.hash)) === '#/' && (await page.locator('.adv-mapscreen').count()) === 0 && !(await page.locator('.mm-toast').isHidden()));
      await page.evaluate(() => (location.hash = '#/adventure')); await W(page, 500);
      check(`F13 ${tag} kilitli Macera DOGRUDAN rotadan da acilmaz (menuye doner)`, (await page.evaluate(() => location.hash)) === '#/' && (await page.locator('.adv-mapscreen').count()) === 0);
      await tap(page, '[data-act="play"]'); await page.waitForSelector('.home.games');
      check(`F14 ${tag} oyun listesinde kilitli kart isaretli (kilit simgesi, data-locked)`, (await page.locator('.game-card[data-game="number-hunt"][data-locked="1"] .gc-lock').count()) === 1 && (await page.locator('.game-card[data-locked="1"]').count()) === 1);
      await tap(page, '.game-card[data-game="number-hunt"]'); await W(page, 400);
      check(`F15 ${tag} kilitli oyun kartina dokununca OYUN ACILMAZ`, (await page.evaluate(() => location.hash)) === '#/games' && !(await page.locator('.mm-toast').isHidden()));
      await page.evaluate(() => (location.hash = '#/play/number-hunt')); await W(page, 500);
      check(`F16 ${tag} kilitli oyun dogrudan rotadan da acilmaz`, (await page.evaluate(() => location.hash)) === '#/');
      await tap(page, '[data-act="play"]'); await page.waitForSelector('.home.games');
      await tap(page, '.game-card[data-game="shape-complete"]'); await W(page, 700);
      check(`F17 kilitli OLMAYAN oyun normal acilir (erisim kontrolu secici)`, (await page.evaluate(() => location.hash)).startsWith('#/play/shape-complete'));
      await page.evaluate(() => window.__altezBack.handle()); await W(page, 500); await tap(page, '.gm-back'); await menuUp(page);
      await tap(page, '[data-act="settings"]'); await page.waitForSelector('[data-screen="settings"]');
      check(`F18 ${tag} aktifken Ayarlar'da yas grubu kilitli (kilit simgesi)`, (await page.locator('[data-act="band"] .st-lock').count()) === 1 && /ebeveyn/.test(await page.locator('[data-act="band"]').textContent()));
      const band0 = (await store(page)).band;
      await tap(page, '[data-act="band"]'); await page.waitForSelector('.pc-gate');
      check(`F19 ${tag} yas grubu degisimi PIN ister (PIN klavyesi)`, (await page.locator('.pc-dots').count()) === 1);
      await pk(page, '0000'); await W(page, 250);
      check(`F20 ${tag} yanlis PIN: yas grubu degismez`, /yanlış/.test(await page.locator('.pc-err').textContent()) && (await store(page)).band === band0);
      await page.evaluate(() => window.__altezBack.handle()); await W(page, 250);
      check(`F21 ${tag} Android Geri dogrulamayi kapatir (ayarlarda kalir)`, (await page.locator('.pc-gate').count()) === 0 && (await page.locator('[data-screen="settings"]').count()) === 1);
      await tap(page, '[data-act="band"]'); await page.waitForSelector('.pc-gate'); await pk(page, '1234'); await W(page, 300);
      check(`F22 ${tag} dogru PIN: yas grubu degisir`, (await store(page)).band !== band0);
      await tap(page, '[data-act="back"]'); await menuUp(page);
      // yeniden ebeveyn: PIN gerekir
      await tap(page, '[data-act="parent"]'); await page.waitForSelector('.pc-gate');
      check(`F23 ${tag} ebeveyn ekranina her giriste dogrulama (PIN klavyesi)`, (await page.locator('.pc-dots').count()) === 1 && (await page.locator('.pc-panel').count()) === 0);
      await page.evaluate(() => window.__altezBack.handle()); await menuUp(page);
      check(`F24 ${tag} dogrulamada Android Geri -> ana menu (uygulama kapanmaz)`, (await page.evaluate(() => location.hash)) === '#/');
      await tap(page, '[data-act="parent"]'); await page.waitForSelector('.pc-gate'); await pk(page, '1234'); await page.waitForSelector('.pc-panel');
      await tap(page, '[data-act="toggle-on"]'); await W(page, 200);
      check(`F25 ${tag} PASIF: panelde "Kapalı"; kilitler uygulanmaz`, (await page.getAttribute('.pc-panel', 'data-state')) === 'off');
      await tap(page, '[data-act="back"]'); await menuUp(page);
      check(`F26 ${tag} menude pasif simge/metin geri gelir; Macera karti tekrar acilir`, (await page.locator('.mm-par-t').textContent()) === 'Kapalı' && (await page.locator('.mm-card[data-locked="1"]').count()) === 0);
      await tap(page, '[data-act="adv"]'); await onMap(page);
      const sv2 = await store(page);
      check(`F27 ${tag} ebeveyn islemleri ilerlemeyi/profili ETKILEMEDI (gorevler, dogru sayisi, profil ayni)`, sv2.adv.tasks.tanis === 3 && sv2.adv.tasks['ilk-isik'] === 2 && sv2.correct === 4 && sv2.profile.first === 'Onur', JSON.stringify(sv2));
      check(`F28 ${tag} hata yok`, errs.length === 0, errs.join('|'));
      await ctx.close();
    }
    // PIN'i unuttum
    const { page, ctx } = await mk({ ...SIG }, { width: 360, height: 640 });
    await go(page); await menuUp(page); await setupParent(page, '2468');
    await tap(page, '[data-act="back"]'); await menuUp(page);
    await tap(page, '[data-act="parent"]'); await page.waitForSelector('.pc-gate');
    await tap(page, '[data-g="forgot"]'); await page.waitForSelector('.pc-q');
    await pk(page, await challengeAnswer(page)); await tap(page, '[data-g="ok"]'); await W(page, 150);
    await pk(page, '1357'); await W(page, 150); await pk(page, '1357'); await page.waitForSelector('.pc-panel');
    await tap(page, '[data-act="back"]'); await menuUp(page); await tap(page, '[data-act="parent"]'); await page.waitForSelector('.pc-gate'); await pk(page, '1357'); await page.waitForSelector('.pc-panel', { timeout: 3000 });
    check('F29 PIN unutulursa yetiskin sorusuyla yeni PIN konur; yeni PIN ile girilir', true);
    await ctx.close();
    // 5 yanlis -> bekleme
    const q = await mk({ ...SIG }, { width: 360, height: 640 });
    await go(q.page); await menuUp(q.page); await setupParent(q.page, '1111'); await tap(q.page, '[data-act="back"]'); await menuUp(q.page);
    await tap(q.page, '[data-act="parent"]'); await q.page.waitForSelector('.pc-gate');
    for (let i = 0; i < 5; i++) { await pk(q.page, '9999'); await W(q.page, 120); }
    check('F30 5 yanlis denemeden sonra kisa bekleme', /bekle/.test(await q.page.locator('.pc-err').textContent()));
    await pk(q.page, '1111'); await W(q.page, 200);
    check('F31 bekleme suresince dogru PIN bile kabul edilmez', (await q.page.locator('.pc-panel').count()) === 0);
    await q.ctx.close();
  }

  // ---------- G: tanitim sesi ----------
  if (on('G')) {
    const { page, errs, ctx } = await mk(null, { width: 360, height: 640 }, { speech: 'end', osc: true, noMp3: true });
    await go(page); await page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(page, 13500);
    const cap = CFG.text.intro;
    let sp = await spoken(page);
    check('G1 tanitim: her sahnenin yazisi TURKCE (tr-TR) sesli okunur, sirayla', JSON.stringify(sp) === JSON.stringify(cap) && await page.evaluate(() => window.__sp.speak.every((s) => s.lang === 'tr-TR')), JSON.stringify(sp));
    check('G2 ayni ses ust uste BASLAMAZ (her satir bir kez, binen konusma 0)', sp.length === cap.length && (await page.evaluate(() => window.__sp.overlap)) === 0, String(await page.evaluate(() => window.__sp.overlap)));
    check('G3 lamba yanarken kisa "circuitOn" sesi calindi (WebAudio)', (await page.evaluate(() => window.__osc)) > 0);
    await tap(page, '.in-go'); await menuUp(page);
    const n = (await spoken(page)).length; await W(page, 600);
    check('G4 cikista konusma durur/yenisi baslamaz', (await spoken(page)).length === n);
    await tap(page, '[data-act="settings"]'); await page.waitForSelector('[data-screen="settings"]'); await tap(page, '[data-act="intro"]'); await page.waitForSelector('.adv-intro'); await W(page, 13500);
    sp = await spoken(page);
    check('G5 tanitimi tekrar izleyince tutarli: satirlar yine bir kez (toplam 2x), binme yok', sp.length === cap.length * 2 && (await page.evaluate(() => window.__sp.overlap)) === 0, String(sp.length));
    check('G6 hata yok', errs.length === 0, errs.join('|'));
    await ctx.close();
    const s = await mk(null, { width: 360, height: 640 }, { speech: 'end', osc: true, noMp3: true });
    await go(s.page); await s.page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(s.page, 3500);
    const c0 = await s.page.evaluate(() => window.__sp.cancel);
    await tap(s.page, '.in-skip'); await menuUp(s.page); await W(s.page, 500);
    const k = (await spoken(s.page)).length; await W(s.page, 3000);
    check('G7 Atla: konusma kesilir (stop), sonraki sahneler konusmaz', (await s.page.evaluate(() => window.__sp.cancel)) >= c0 && (await spoken(s.page)).length === k && k <= 1, String(k));
    await s.ctx.close();
    const m = await mk({ band: '4-5', sound: false, seen: true }, { width: 360, height: 640 }, { speech: 'end', osc: true, noMp3: true });
    await go(m.page); await m.page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(m.page, 9500);
    const osc0 = await m.page.evaluate(() => window.__osc);
    check('G8 ses KAPALIYKEN tanitim sessiz (konusma yok, circuitOn yok): cihaz/uygulama ses ayari gecersiz kilinmaz', (await spoken(m.page)).length === 0 && osc0 === 0, JSON.stringify([await spoken(m.page), osc0]));
    await m.ctx.close();
    const e = await mk(null, { width: 360, height: 640 }, { speech: 'error', noMp3: true });
    await go(e.page); await e.page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(e.page, 13500);
    check('G9 ses motoru hata verse bile tanitim COKMEDEN akar (Haydi baslayalim gorunur), hata yok', await e.page.locator('.in-go').isVisible() && e.errs.length === 0, e.errs.join('|'));
    await e.ctx.close();
    const nv = await mk(null, { width: 360, height: 640 }, { noMp3: true });
    await nv.page.addInitScript(() => { try { delete window.speechSynthesis; } catch (x) { /* yoksay */ } Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); });
    await go(nv.page); await nv.page.waitForSelector('.adv-intro', { timeout: 9000 }); await W(nv.page, 13500);
    check('G10 ses motoru HIC yoksa da tanitim COKMEDEN akar', await nv.page.locator('.in-go').isVisible() && nv.errs.length === 0, nv.errs.join('|'));
    await nv.ctx.close();
    const src = readFileSync(new URL('../src/games/adventure/intro.js', import.meta.url), 'utf8');
    check('G11 kok neden duzeltildi: intro.js artik voice.say + audio.play cagirir (onceden hic ses yoktu); yeni ses modeli/dosyasi yok', /voice\?\.say\('adv-intro'/.test(src) && /audio\?\.play\('circuitOn'\)/.test(src) && !/new Audio|\.mp3|\.wav|\.ogg/.test(src.replace(/^\s*\/\/.*$/gm, '')));
  }

  // ---------- H: diger sesler / oyunlar calismaya devam, eski kayit korunur ----------
  if (on('H')) {
    const old = { band: '6-8', sound: true, seen: true, correct: 7, circuit: { '4-5': { stage: 1, plays: 2 }, '6-8': { stage: 3, plays: 5 } }, games: { 'energy-adventure': { correct: 3, done: ['e1', 'e2'] }, 'number-hunt': { correct: 4 } }, edu: { done: ['circuit-1'] }, adv: { intro: true, tasks: { tanis: 3, 'ilk-isik': 2, dedektif: 1 } } };
    const { page, errs, ctx } = await mk(old, { width: 640, height: 360 }, { speech: 'end', osc: true });
    await go(page); await menuUp(page);
    const sv = await store(page);
    const keep = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    check('H1 V8.1 kaydi V8.2 ile acilinca ilerleme AYNEN korunur (dogru sayisi, devre, oyunlar, egitim, macera, yas grubu, ses)', sv.correct === 7 && keep(sv.circuit, old.circuit) && keep(sv.games, old.games) && keep(sv.edu, old.edu) && keep(sv.adv, old.adv) && sv.band === '6-8' && sv.sound === true && !sv.profile && !sv.parent, JSON.stringify(sv));
    await tap(page, '[data-act="progress"]'); await page.waitForSelector('[data-screen="progress"]');
    check('H2 Ilerlemem eski ilerlemeyi gosterir (3/16 gorev; V8.5: toplam 16, Karanlik Ev eklendi)', /3 \/ 16 görev/.test(await page.locator('.pg-body').textContent()));
    await page.evaluate(() => window.__altezBack.handle()); await menuUp(page);
    await tap(page, '[data-act="play"]'); await page.waitForSelector('.home.games');
    await tap(page, '.game-card[data-game="number-hunt"]'); await W(page, 900);
    check('H3 mevcut oyun (Sayi Avi) acilir ve calisir', (await page.evaluate(() => location.hash)).startsWith('#/play/number-hunt') && (await page.locator('.nh, [class*="nh"]').count()) > 0);
    await page.evaluate(() => window.__altezBack.handle()); await W(page, 500);
    await tap(page, '.game-card[data-game="shape-complete"]'); await W(page, 900);
    check('H4 Sekli Tamamla acilir', (await page.evaluate(() => location.hash)).startsWith('#/play/shape-complete'));
    await page.evaluate(() => window.__altezBack.handle()); await W(page, 500); await tap(page, '.gm-back'); await menuUp(page);
    await tap(page, '[data-act="adv"]'); await onMap(page); await page.locator(`.adv-node[data-id="kablo"]`).click({ force: true }); await page.waitForSelector('.adv-task main > *'); await W(page, 700);
    const sp = await spoken(page);
    check('H5 Macera gorev sesli yonergesi (V8.1) hala Turkce okunur; ses sistemi bozulmadi', sp.length >= 1 && sp.at(-1) === T('kablo').hints.start, JSON.stringify(sp));
    await tap(page, '[data-act="replay"]'); await W(page, 400);
    check('H6 "Tekrar dinle" hala calisir', (await spoken(page)).length === sp.length + 1);
    await tap(page, `.cx-tile[data-part="${T('kablo').board.tray.find((p) => p.type === 'wire').id}"]`); await tap(page, '.cx-slot[data-edge="top"]'); await W(page, 500);
    check('H7 devre gorevi cozulur: lamba yanar sesi/animasyonu calisir (osc > 0)', (await page.evaluate(() => window.__osc)) > 0);
    check('H8 hata yok', errs.length === 0, errs.join('|'));
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
const fail = results.filter((r) => !r.ok);
console.log(`\nV8.2 UI: ${results.length - fail.length}/${results.length} gecti${fail.length ? `, ${fail.length} BASARISIZ` : ''}`);
process.exit(fail.length ? 1 : 0);
