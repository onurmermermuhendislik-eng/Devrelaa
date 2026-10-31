// V8.1 HEDEFLI tarayici testi (Chromium, yatay): ana menu, ilk acilis tanitimi, harita, 8 gorev, sesli yonerge/Tekrar Dinle, odul, kilit, kalicilik, eski kayit.
// Tam arayuz duman testi (545) bu dosyadan AYRIDIR ve burada calistirilmaz.   node scripts/ui-v81.mjs   SHOTS=/yol  ONLY=A,B,...
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
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
  if (seed !== null) await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  if (opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  if (opts.speech) await page.addInitScript(FAKE_SPEECH, opts.speech);
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
const spoken = (page) => page.evaluate(() => window.__sp.speak.map((s) => s.text));
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


// ---- gorev cozucu (gercek dokunma/surukleme etkilesimiyle) ----
const SOL = {
  'ilk-isik': { seq: [['battery', 'left'], ['lamp', 'right']] },
  kablo: { seq: [['wire', 'top']] },
  anahtar: { seq: [['switch', 'top']], toggle: 'switch', thenOff: true },
  seri: { seq: [['lamp', 'top'], ['lamp', 'right']] },
  hata: { seq: [['wire', 'top']], remove: 'top' },
  final: { seq: [['battery', 'left'], ['switch', 'top'], ['lamp', 'right'], ['lamp', 'bottom']], toggle: 'switch' }
};
const partId = (id, type, nth = 0) => T(id).board.tray.filter((p) => p.type === type)[nth].id;
async function playCircuit(page, id, { stone = false, drag = false } = {}) {
  const sol = SOL[id];
  if (stone) {
    const free = T(id).board.edges.left === 'slot' ? 'left' : 'top';
    await tap(page, `.cx-tile[data-part="${partId(id, 'stone')}"]`); await tap(page, `.cx-slot[data-edge="${free}"]`); await W(page, 350);
    await tap(page, `.cx-slot[data-edge="${free}"]`); await W(page, 200);
  }
  if (sol.remove) { await tap(page, `.cx-slot[data-edge="${sol.remove}"]`); await W(page, 350); }
  const used = {};
  for (const [type, edge] of sol.seq) {
    const nth = used[type] || 0; used[type] = nth + 1;
    const pid = partId(id, type, nth);
    if (drag) {
      const a = await page.locator(`.cx-tile[data-part="${pid}"]`).boundingBox();
      const b = await page.locator(`.cx-slot[data-edge="${edge}"]`).boundingBox();
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await page.mouse.down();
      await page.mouse.move(b.x + b.width / 2 - 10, b.y + b.height / 2 - 6, { steps: 6 }); await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 4 }); await page.mouse.up();
    } else { await tap(page, `.cx-tile[data-part="${pid}"]`); await tap(page, `.cx-slot[data-edge="${edge}"]`); }
    await W(page, 250);
  }
  if (sol.toggle) { await tap(page, `.cx-slot[data-type="${sol.toggle}"]`); await W(page, 300); }
  if (sol.thenOff) { await W(page, 200); await tap(page, '.cx-slot[data-type="switch"]'); await W(page, 300); }
}
async function solveTask(page, id, o = {}) {
  const t = T(id);
  if (id === 'tanis') {
    for (let r = 0; r < 3; r++) {
      if (r === 0 && o.wrong) { await page.locator(`.id-opt:not([data-type="${t.rounds[0].answer}"])`).first().click({ force: true }); await W(page, 250); }
      await page.locator(`.id-opt[data-type="${t.rounds[r].answer}"]`).first().click({ force: true });
      await W(page, r < 2 ? 2900 : 300);
    }
  } else if (id === 'dedektif') {
    const truths = ['closed', 'open', 'open'];
    for (let r = 0; r < 3; r++) {
      const got = await page.getAttribute('.adv-judge', 'data-truth');
      if (got !== truths[r]) throw new Error(`dedektif sahne ${r + 1}: beklenen ${truths[r]} bulunan ${got}`);
      if (r === 0 && o.wrong) { await page.locator(`.jd-opt[data-ans="${truths[0] === 'closed' ? 'open' : 'closed'}"]`).click({ force: true }); await W(page, 250); }
      await page.locator(`.jd-opt[data-ans="${truths[r]}"]`).click({ force: true });
      await W(page, r < 2 ? 3500 : 300);
    }
  } else await playCircuit(page, id, o);
  await page.waitForSelector('[data-act="finish"]:not([hidden])', { timeout: 5000 });
  await tap(page, '[data-act="finish"]');
  await page.waitForSelector('.adv-reward', { timeout: 4000 });
  await W(page, 300);
}
const openNode = async (page, id) => { await tap(page, `.adv-node[data-id="${id}"]`); await page.waitForSelector('.adv-task main > *'); await W(page, 500); };
const menuUp = (page) => page.waitForSelector('.mm[data-screen="menu"]', { timeout: 10000 });
const SIZES = [[640, 360], [568, 320], [740, 360], [800, 360]];

try {
  // ---------- A: acilis akisi ----------
  if (on('A')) {
    const { page, errs, external, ctx } = await mk(null);
    await go(page);
    await page.waitForSelector('.adv-intro', { timeout: 9000 });
    check('A1 ilk acilis: kisa tanitim acilir (macera haritasi DEGIL), yatay', (await page.evaluate(() => location.hash)) === '#/intro' && (await page.locator('.adv-mapscreen').count()) === 0);
    await W(page, 700);
    check('A2 tanitim: logo + maskot + Atla dugmesi (>=48px, ustte)', await page.locator('.in-logo img').isVisible() && await page.locator('.in-mascot').isVisible() && (await page.locator('.in-skip').boundingBox()).height >= 48 && await topHit(page, '.in-skip'));
    await shot(page, 'tanitim-1');
    await tap(page, '.in-skip'); await menuUp(page);
    check('A3 Atla -> ANA MENU (Enerji Macerasi otomatik baslamaz); tanitim goruldu kaydi yazildi', (await store(page)).adv?.intro === true && (await page.locator('.adv-mapscreen').count()) === 0 && (await page.evaluate(() => location.hash)) === '#/');
    await go(page); await menuUp(page);
    check('A4 sonraki acilista tanitim TEKRAR gelmez; dogrudan ana menu', (await page.locator('.adv-intro').count()) === 0);
    await tap(page, '[data-act="settings"]'); await page.waitForSelector('[data-screen="settings"]');
    await tap(page, '[data-act="intro"]'); await page.waitForSelector('.adv-intro');
    check('A5 Ayarlar > Tanitimi izle calisir', true);
    await page.waitForFunction(() => !document.querySelector('.in-go').hidden, null, { timeout: 15000 });
    await shot(page, 'tanitim-5-haydi');
    await tap(page, '.in-go'); await menuUp(page);
    check('A6 "Haydi baslayalim" -> ana menu', true);
    check('A7 hata ve harici istek yok', errs.length === 0 && external.length === 0, errs.concat(external).join(' | '));
    await ctx.close();
    const r = await mk(null, undefined, { reduced: true }); await go(r.page); await r.page.waitForSelector('.adv-intro');
    const anim = await r.page.evaluate(() => getComputedStyle(document.querySelector('.in-sky i')).animationDuration);
    check('A8 hareket azaltma: tanitim animasyonlari kapali/cok kisa', parseFloat(anim) < 0.01, anim);
    await r.ctx.close();
  }

  // ---------- B: ana menu ----------
  if (on('B')) {
    for (const [w, h] of SIZES) {
      const { page, errs, ctx } = await mk(SEED, { width: w, height: h });
      await go(page); await menuUp(page); await W(page, 900);
      const cards = await page.evaluate(() => [...document.querySelectorAll('.mm-card')].map((c) => ({ act: c.dataset.act, t: c.querySelector('.mm-t').textContent })));
      check(`B1 ${w}x${h} menu: Enerji Macerasi, Oyna, Egitim, Ilerlemem, Ayarlar (gercek ozellikler; sahte dugme yok)`, cards.map((c) => c.act).join() === 'adv,play,edu,progress,settings' && cards[0].t === 'Enerji Macerası', JSON.stringify(cards));
      const o = await overflow(page);
      check(`B2 ${w}x${h} tasma yok`, o.sw <= o.w && o.sh <= o.h, JSON.stringify(o));
      const g = await page.evaluate(() => {
        const R = (e) => e.getBoundingClientRect();
        const cs = [...document.querySelectorAll('.mm-card,.mm-top .adv-btn')];
        const inside = cs.every((e) => { const r = R(e); return r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; });
        const min = Math.min(...cs.map((e) => Math.min(R(e).width, R(e).height)));
        let ov = 0; for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) { const a = R(cs[i]), b = R(cs[j]); if (a.left < b.right - 2 && a.right > b.left + 2 && a.top < b.bottom - 2 && a.bottom > b.top + 2) ov++; }
        const m = document.querySelector('.mascot .m-art').getBoundingClientRect();
        const mh = cs.filter((e) => { const r = R(e); return m.left < r.right && m.right > r.left && m.top < r.bottom && m.bottom > r.top; }).length;
        return { inside, min, ov, mh };
      });
      check(`B3 ${w}x${h} kartlar ekranda, ust uste binmiyor, hedefler >= 48px, maskot kartlari ortmuyor`, g.inside && g.ov === 0 && g.min >= 48 && g.mh === 0, JSON.stringify(g));
      check(`B4 ${w}x${h} kartlar ustte (dokunulabilir)`, (await Promise.all(['adv', 'play', 'edu', 'progress', 'settings'].map((a) => topHit(page, `.mm-card[data-act="${a}"]`)))).every(Boolean));
      if (w === 640) {
        await shot(page, 'ana-menu-640x360');
        await tap(page, '[data-act="play"]'); await page.waitForSelector('.home.games'); await W(page, 400);
        check('B5 Oyna -> mevcut mini oyunlar listesi (Sekli Tamamla, Sayi Avi, Mucit Atolyesi...)', (await page.locator('.game-card[data-game="shape-complete"]').count()) === 1 && (await page.locator('.game-card[data-game="number-hunt"]').count()) === 1 && (await page.locator('.game-card[data-game="invent"]').count()) === 1);
        await shot(page, 'oyna-mini-oyunlar');
        await tap(page, '.gm-back'); await menuUp(page);
        check('B6 mini oyunlar listesinden geri -> ana menu', true);
        await tap(page, '[data-act="edu"]'); await page.waitForSelector('.learn, .learn-map, [class*="learn"]', { timeout: 6000 }); await W(page, 400);
        check('B7 Egitim acilir', (await page.evaluate(() => location.hash)).startsWith('#/play/learn'));
        await page.evaluate(() => window.__altezBack?.handle?.()); await menuUp(page);
        check('B8 Egitimde Android Geri -> ana menu', true);
        await tap(page, '[data-act="progress"]'); await page.waitForSelector('[data-screen="progress"]'); await W(page, 300);
        const pt = await page.locator('.pg-body').textContent();
        check('B9 Ilerlemem: macera gorevi 0/16 (V8.5: 8+7+Karanlik Ev), jeton, yildiz, egitim ve mini oyun satirlari', /0 \/ 16 görev/.test(pt) && /Eğitim/.test(pt) && /Mini oyunlar/.test(pt) && /yıldız/.test(pt), pt.slice(0, 120));
        await shot(page, 'ilerlemem');
        await page.evaluate(() => window.__altezBack?.handle?.()); await menuUp(page);
        await tap(page, '[data-act="settings"]'); await page.waitForSelector('[data-screen="settings"]');
        const s0 = (await store(page)).band;
        await tap(page, '[data-act="band"]'); await W(page, 200);
        check('B10 Ayarlar: yas grubu degisir ve kaydedilir', (await store(page)).band !== s0);
        await tap(page, '[data-act="sound"]'); await W(page, 200);
        check('B11 Ayarlar: ses acilir/kapanir ve kaydedilir', (await store(page)).sound === true);
        await shot(page, 'ayarlar');
        await tap(page, '[data-act="sound"]'); await W(page, 150);
        await tap(page, '[data-act="vtest"]'); await W(page, 250);
        check('B12 ses KAPALIYKEN ses testi "ses kapali" der, basarili saymaz', /Ses kapalı/.test(await page.locator('.st-msg').textContent()));
        await tap(page, '[data-act="back"]'); await menuUp(page);
        await tap(page, '[data-act="adv"]'); await onMap(page);
        check('B13 Enerji Macerasi yalniz cocuk secince acilir; haritada Geri -> ana menu', await (async () => { await page.evaluate(() => window.__altezBack?.handle?.()); await menuUp(page); return true; })());
        await tap(page, '[data-act="sound"]'); await W(page, 200);
        check('B14 ana menude hizli ses dugmesi calisir', (await store(page)).sound === true);
      }
      check(`B15 ${w}x${h} hata yok`, errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
    const p = await mk(SEED, { width: 360, height: 640 });
    await go(p.page); await menuUp(p.page);
    // V8.2 (madde 2/3): menu dikeyde de calisir; "cihazi cevir" uyarisi menude cikmaz, kartlar erisilebilir (eski beklenti: uyari gorunur)
    check('B16 (V8.2) dikey menude "cihazi cevir" uyarisi YOK ve kartlar gorunur', !(await p.page.locator('.adv-rotate').isVisible()) && await p.page.locator('.mm-card').first().isVisible());
    await p.ctx.close();
  }

  // ---------- C: harita ----------
  if (on('C')) {
    for (const [w, h] of SIZES) {
      const { page, errs, ctx } = await mk(SEED, { width: w, height: h });
      await go(page, '#/adventure'); await onMap(page); await W(page, 600);
      const st = await state(page);
      check(`C1 ${w}x${h} harita: 8 dugum, 1. acik, 7'si kilitli`, IDS.map((i) => st[i]).join() === ['open', ...Array(7).fill('locked')].join(), JSON.stringify(st));
      const o = await overflow(page);
      check(`C2 ${w}x${h} tasma yok`, o.sw <= o.w && o.sh <= o.h, JSON.stringify(o));
      const geo = await page.evaluate(() => {
        const R = (e) => e.getBoundingClientRect();
        const ns = [...document.querySelectorAll('.adv-node,.adv-start,.adv-gate')].map((n) => R(n));
        const hu = [...document.querySelectorAll('.adv-hud button,.adv-pill')].map((n) => R(n));
        let ov = 0; for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) { const a = ns[i], b = ns[j]; if (a.left < b.right - 4 && a.right > b.left + 4 && a.top < b.bottom - 4 && a.bottom > b.top + 4) ov++; }
        const inside = [...ns, ...hu].every((r) => r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1);
        const minT = Math.min(...[...document.querySelectorAll('.adv-node')].map((n) => Math.min(R(n).width, R(n).height)), ...[...document.querySelectorAll('.adv-hud button')].map((n) => Math.min(R(n).width, R(n).height)));
        return { ov, inside, minT, hudOk: Math.max(...hu.map((r) => r.bottom)) <= R(document.querySelector('.adv-map')).top + 2 };
      });
      check(`C3 ${w}x${h} dugumler/HUD ekranda, ust uste binmiyor, hedefler >= 44px`, geo.ov === 0 && geo.inside && geo.hudOk && geo.minT >= 44, JSON.stringify(geo));
      if (w === 640) {
        await shot(page, 'harita-8-gorev');
        const before = await page.locator('.adv-task').count();
        await tap(page, `.adv-node[data-id="${IDS[1]}"]`); await W(page, 450);
        check('C4 kilitli goreve dokunma ACMAZ, maskot uyarir', before === 0 && (await page.locator('.adv-task').count()) === 0 && (await page.locator('.mascot .m-bubble').textContent()).includes(CFG.text.lockedHint));
        const hs = await hud(page);
        check('C5 HUD: coin 0, yildiz 0/48, ilerleme 0/16 (V8.5: 8 Pil + 7 Evde Enerji + Karanlik Ev)', hs.coins === 0 && hs.stars === 0 && hs.done === 0 && (await page.locator('.adv-pill.star small').textContent()).includes('48'));
      }
      check(`C6 ${w}x${h} hata yok`, errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  }

  // ---------- D: 8 gorev, odul, kalicilik ----------
  if (on('D')) {
    const { page, errs, external, ctx } = await mk(SEED);
    await go(page, '#/adventure'); await onMap(page);
    let coins = 0, stars = 0;
    for (let i = 0; i < IDS.length; i++) {
      const id = IDS[i];
      const t = T(id);
      await openNode(page, id);
      const o = await overflow(page);
      check(`D${i + 1}a ${t.title}: gorev ekrani tasmaz, "Tekrar dinle" dugmesi var`, o.sw <= o.w && o.sh <= o.h && (await page.locator('[data-act="replay"]').count()) === 1 && (await topHit(page, '[data-act="replay"]')), JSON.stringify(o));
      await shot(page, `gorev-${i + 1}-${id}`);
      const wrong = id === 'tanis' || id === 'ilk-isik' || id === 'dedektif';
      await solveTask(page, id, { wrong, stone: id === 'ilk-isik', drag: id === 'kablo' });
      const rw = await page.evaluate(() => ({ stars: +document.querySelector('.rw-stars').dataset.stars, coin: +(document.querySelector('.rw-coin')?.dataset.coin || 0), final: !!document.querySelector('.adv-reward.final') }));
      const expStars = wrong ? 2 : 3;
      check(`D${i + 1}b ${t.title}: odul yildiz ${expStars} (${wrong ? '1 hata' : 'hatasiz'}), ilk kez +${t.coins} coin`, rw.stars === expStars && rw.coin === t.coins && rw.final === (id === 'final'), JSON.stringify(rw));
      coins += t.coins; stars += expStars;
      if (id === 'ilk-isik') await shot(page, 'odul-ilk-isik');
      if (id === 'final') await shot(page, 'final-kutlama');
      await toMap(page);
      const stt = await state(page); const hs = await hud(page);
      const exp = IDS.map((x, j) => (j <= i ? 'done' : j === i + 1 ? 'open' : 'locked')).join();
      check(`D${i + 1}c ${t.title}: haritada tamamlandi + siradaki acildi, HUD coin/yildiz dogru`, IDS.map((x) => stt[x]).join() === exp && hs.coins === coins && hs.stars === stars && hs.done === i + 1, JSON.stringify([stt, hs]));
    }
    check('D9 bolge 1 bitti: kapi ACIK (yeni bolge kilidi acildi)', await page.locator('.adv-gate.open').count() === 1);
    await shot(page, 'harita-bolge-tamam');
    // tekrar oyna: coin yok
    await openNode(page, 'kablo'); await solveTask(page, 'kablo');
    const rp = await page.evaluate(() => ({ coin: !!document.querySelector('.rw-coin'), note: !!document.querySelector('.rw-note') }));
    check('D10 tekrar oynama: COIN YOK ve "tekrar" notu', !rp.coin && rp.note, JSON.stringify(rp));
    await toMap(page);
    check('D11 tekrardan sonra coin ayni', (await hud(page)).coins === coins);
    await go(page, '#/adventure'); await onMap(page);
    // V8.4: Pil bolgesi bitince yeniden acilista SIRADAKI gorevin bolgesi (Evde Enerji) acilir; Pil haritasina geri dugmesiyle donulur
    check('D12a yeniden baslatinca siradaki bolge (Evde Enerji) acilir', await page.getAttribute('.adv-mapscreen', 'data-region') === 'ev');
    await tap(page, 'button.adv-start.back'); await W(page, 300); await onMap(page);
    const st2 = await state(page); const hs2 = await hud(page);
    check('D12 yeniden baslatinca ilerleme korunur (8 gorev tamam, coin, yildiz, kapi acik)', IDS.every((i) => st2[i] === 'done') && hs2.coins === coins && hs2.stars >= stars && await page.locator('.adv-gate.open').count() === 1, JSON.stringify([st2, hs2]));
    check('D13 hata ve harici istek yok', errs.length === 0 && external.length === 0, errs.concat(external).join(' | '));
    await ctx.close();
  }

  // ---------- E: yas bandi ----------
  if (on('E')) {
    for (const band of ['4-5', '6-8']) {
      const { page, errs, ctx } = await mk({ ...SEED, band });
      await go(page, '#/adventure'); await onMap(page); await openNode(page, 'tanis');
      const n = await page.locator('.id-opt').count();
      check(`E1 ${band} tanisma: ${band === '4-5' ? 'en fazla 3' : '4'} secenek`, band === '4-5' ? n === 3 : n === 4, String(n));
      check(`E2 ${band} secenekler ekranda ve hedef >= 80px`, await page.evaluate(() => [...document.querySelectorAll('.id-opt')].every((e) => { const r = e.getBoundingClientRect(); return r.width >= 80 && r.height >= 80 && r.right <= innerWidth && r.bottom <= innerHeight; })));
      await ctx.close();
      const q = await mk({ ...DONE(2), band });
      await go(q.page, '#/adventure'); await onMap(q.page); await openNode(q.page, 'dedektif');
      const sc = await q.page.evaluate(() => document.querySelectorAll('.id-dots i').length);
      check(`E3 ${band} dedektif: ${band === '4-5' ? 3 : 5} sahne`, sc === (band === '4-5' ? 3 : 5), String(sc));
      check(`E4 ${band} hata yok`, errs.length === 0 && q.errs.length === 0, errs.concat(q.errs).join(' | '));
      await q.ctx.close();
    }
  }

  // ---------- F: sesli yonerge ----------
  if (on('F')) {
    const { page, errs, ctx } = await mk({ ...DONE(1), sound: true }, undefined, { speech: 'end' });
    await go(page, '#/adventure'); await onMap(page);
    await openNode(page, 'ilk-isik'); await W(page, 500);
    let sp = await spoken(page);
    check('F1 gorev acilinca yonerge TURKCE (tr-TR) sesli okunur', sp.length >= 1 && sp.at(-1) === T('ilk-isik').hints.start && await page.evaluate(() => window.__sp.speak.every((s) => s.lang === 'tr-TR')), JSON.stringify(sp));
    const n0 = sp.length;
    await tap(page, '[data-act="replay"]'); await W(page, 400);
    sp = await spoken(page);
    check('F2 "Tekrar dinle" ayni yonergeyi tekrar okur', sp.length === n0 + 1 && sp.at(-1) === sp.at(-2), JSON.stringify(sp));
    await tap(page, `.cx-tile[data-part="${partId('ilk-isik', 'stone')}"]`); await tap(page, '.cx-slot[data-edge="left"]'); await W(page, 500);
    sp = await spoken(page);
    check('F3 ipucu da sesli okunur; sonra Tekrar dinle O ANKI (ipucu) metnini okur', sp.at(-1) === T('ilk-isik').hints.insulator);
    await tap(page, '[data-act="replay"]'); await W(page, 300);
    sp = await spoken(page);
    check('F4 Tekrar dinle ekrandaki guncel yonergeyi okur', sp.at(-1) === T('ilk-isik').hints.insulator);
    await tap(page, '[data-act="back"]'); await onMap(page); await openNode(page, 'ilk-isik'); await W(page, 600);
    check('F5 gorev gecislerinde konusmalar UST USTE BINMEZ', (await page.evaluate(() => window.__sp.overlap)) === 0, String(await page.evaluate(() => window.__sp.overlap)));
    await tap(page, '[data-act="sound"]'); await W(page, 200);
    const n1 = (await spoken(page)).length;
    await tap(page, '[data-act="replay"]'); await W(page, 300);
    check('F6 ses KAPALIYKEN Tekrar dinle konusmaz ve "ses kapali" uyarisi gosterir', (await spoken(page)).length === n1 && await page.locator('.adv-voicewarn').isVisible() && /Ses kapalı/.test(await page.locator('.adv-voicewarn').textContent()));
    await shot(page, 'ses-kapali-uyari');
    check('F7 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
    // ses motoru hata verirse
    const b = await mk({ ...DONE(1), sound: true }, undefined, { speech: 'error' });
    await go(b.page, '#/adventure'); await onMap(b.page); await openNode(b.page, 'ilk-isik');
    await b.page.waitForSelector('.adv-voicewarn:not([hidden])', { timeout: 4000 });
    check('F8 ses motoru hata verirse anlasilir uyari gosterilir (sessiz basari sayilmaz)', /Ses çıkmıyor/.test(await b.page.locator('.adv-voicewarn').textContent()));
    await shot(b.page, 'ses-sorunu-uyari');
    await tap(b.page, '[data-act="vwclose"]');
    check('F9 uyari kapatilabilir', await b.page.locator('.adv-voicewarn').isHidden());
    await b.ctx.close();
    // ayarlar ses testi
    const c = await mk({ ...SEED, sound: true }, undefined, { speech: 'end' });
    await go(c.page, '#/settings'); await c.page.waitForSelector('[data-screen="settings"]');
    await tap(c.page, '[data-act="vtest"]'); await c.page.waitForFunction(() => /Ses çalıştı/.test(document.querySelector('.st-msg').textContent), null, { timeout: 4000 });
    check('F10 Ayarlar ses testi: konusma gercekten baslayinca "Ses calisti"', (await spoken(c.page)).includes(data_sample()));
    await c.ctx.close();
    const d = await mk({ ...SEED, sound: true }, undefined, { speech: 'error' });
    await go(d.page, '#/settings'); await d.page.waitForSelector('[data-screen="settings"]');
    await tap(d.page, '[data-act="vtest"]'); await d.page.waitForFunction(() => /Ses çıkmadı/.test(document.querySelector('.st-msg').textContent), null, { timeout: 4000 });
    check('F11 Ayarlar ses testi: motor hata verirse "Ses cikmadi" (basarili sayilmaz)', true);
    await d.ctx.close();
  }

  // ---------- G: geri uyum + Geri tusu ----------
  if (on('G')) {
    const old = { ...SEED, adv: { intro: true, tasks: { 'a1-pil-lamba': 2, 'a2-pil-ne': 3 } } };
    const { page, errs, ctx } = await mk(old);
    await go(page, '#/adventure'); await onMap(page);
    const st = await state(page); const sv = await store(page);
    check('G1 V8.0-proto1 kaydi yeni kimliklere tasinir (yildiz korunur), eski anahtar silinir', IDS.map((i) => st[i]).join() === 'done,done,open,locked,locked,locked,locked,locked' && sv.adv.tasks.tanis === 2 && sv.adv.tasks['ilk-isik'] === 3 && !('a1-pil-lamba' in sv.adv.tasks), JSON.stringify(sv.adv));
    const hs = await hud(page);
    check('G2 tasinan gorevler icin coin turetilir (tekrar verilmez)', hs.coins === T('tanis').coins + T('ilk-isik').coins, JSON.stringify(hs));
    await openNode(page, 'dedektif');
    await page.evaluate(() => window.__altezBack?.handle?.()); await W(page, 300);
    check('G3 gorevde Android Geri -> harita', (await page.locator('.adv-mapscreen').count()) === 1);
    await tap(page, '[data-act="menu"]'); await W(page, 200);
    await page.evaluate(() => window.__altezBack?.handle?.()); await W(page, 200);
    check('G4 menu acikken Geri once menuyu kapatir', await page.locator('.adv-sheet').isHidden());
    check('G5 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
    const o = await mk({ band: '6-8', sound: false, seen: true, correct: 7, games: { 'energy-adventure': { correct: 3, done: ['e1', 'e2'] } }, edu: { done: ['circuit-1'] } });
    await go(o.page); await o.page.waitForSelector('.adv-intro', { timeout: 9000 });
    await tap(o.page, '.in-skip'); await menuUp(o.page);
    const s2 = await store(o.page);
    check('G6 V7.9.1 kaydi: eski alanlar (yas bandi, Enerji Sorulari, Egitim) aynen korunur', s2.band === '6-8' && s2.games['energy-adventure'].done.length === 2 && s2.edu.done[0] === 'circuit-1' && s2.correct === 7, JSON.stringify(s2));
    await tap(o.page, '[data-act="play"]'); await o.page.waitForSelector('.home.games');
    check('G7 eski "Enerji Sorulari" kart adi yeni Macera ile karismaz', (await o.page.locator('.game-card[data-game="energy-adventure"] .gc-title').textContent()) === 'Enerji Soruları');
    await o.ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
function data_sample() { return JSON.parse(readFileSync(new URL('../assets/data/strings.tr.json', import.meta.url), 'utf8')).mm.settings.voiceSample; }
const fail = results.filter((r) => !r.ok);
console.log(`\nV8.1 UI: ${results.length - fail.length}/${results.length} gecti${fail.length ? `, ${fail.length} BASARISIZ` : ''}`);
process.exit(fail.length ? 1 : 0);
