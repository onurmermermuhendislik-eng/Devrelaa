// V8.4 HEDEFLI tarayici testi (Chromium) - ASAMA D/E/F: gercek hayat gorevleri (Evde Enerji), coin, Enerji Marketi, envanter, ses yolu (MP3 / TTS / sessiz).
// node scripts/ui-v84-market.mjs   SHOTS=/yol  ONLY=E1,E2,...      GERCEK ANDROID CIHAZ TESTI DEGILDIR: yalniz Chromium (Playwright).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { startServer } from './serve.mjs';
import { lineKey } from '../src/core/voicekey.js';

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
const PIL = CFG.regions[0].tasks;
const EV = CFG.regions[1].tasks;
const MK = CFG.market;
const T = (id) => CFG.tasks.find((t) => t.id === id);
const JINGLE = readFileSync(new URL('../assets/sounds/minilab-jingle.mp3', import.meta.url));
const server = await startServer(0, { voiceMp3: true }) /* V8.5: gercek 106 MP3 manifesti sinanir */;
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const W = (page, ms = 350) => page.waitForTimeout(ms);
const all3 = (ids) => Object.fromEntries(ids.map((i) => [i, 3]));
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };
const tap = (page, sel) => page.locator(sel).first().click({ force: true });
const coinsHud = async (page) => Number(await page.locator('[data-coins]').first().getAttribute('data-coins'));

function FAKE_SPEECH() {
  const log = { speak: [], cancel: 0, plays: [] };
  window.__sp = log;
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  Object.defineProperty(window, 'speechSynthesis', {
    value: { get speaking() { return false; }, pending: false, getVoices: () => [{ lang: 'tr-TR', name: 'Sahte TR', localService: true }], resume() {}, cancel() { log.cancel++; },
      speak(u) { log.speak.push({ text: u.text }); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => u.onend && u.onend(), 200); }, 20); } },
    configurable: true
  });
  // MP3 oynatma: gercek oynatma yerine kaydet (otomatik oynatma politikasindan bagimsiz). `missing` iceren yol reddedilir (dosya yok senaryosu).
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    const src = this.currentSrc || this.src || '';
    log.plays.push(src);
    if (/missing/.test(src)) return Promise.reject(new Error('NotSupported'));
    setTimeout(() => this.dispatchEvent(new Event('ended')), 120);
    return Promise.resolve();
  };
  window.__origPlay = play;
}
const spoken = (page) => page.evaluate(() => window.__sp.speak.map((s) => s.text).filter((t) => t.trim()));
const plays = (page) => page.evaluate(() => window.__sp.plays.filter((s) => /voice\//.test(s)));

const mk = async (seed, vp, opts = {}) => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; const external = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  if (opts.speech) await page.addInitScript(FAKE_SPEECH);
  if (opts.fail) await page.addInitScript(() => { const s = Storage.prototype.setItem; window.__failWrites = false; Storage.prototype.setItem = function (k, v) { if (window.__failWrites) throw new Error('dolu'); return s.call(this, k, v); }; });
  if (opts.routes) await opts.routes(page);
  return { ctx, page, errs, external };
};
const go = async (page, hash = '#/adventure') => { await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + hash); await page.waitForSelector('.adv', { timeout: 8000 }); };
const SEEDPIL = { band: '4-5', sound: false, seen: true, adv: { intro: true, tasks: all3(PIL) } };
const SEEDALL = { band: '4-5', sound: false, seen: true, adv: { intro: true, tasks: all3([...PIL, ...EV]) } };
const VP = [800, 360];
const ADVL = [[568, 320], [640, 360], [740, 360], [800, 360], [915, 412], [1024, 600], [1280, 800]];

// secmeli gorevi coz: yanlis (ipucu) ve dogru cevap
async function solveChoice(page, id, { wrongFirst = false } = {}) {
  const t = T(id);
  const idxOk = t.options.findIndex((o) => o.ok);
  if (wrongFirst) { const w = t.options.findIndex((o) => !o.ok); await tap(page, `.ch-opt[data-i="${w}"]`); await W(page, 150); }
  await tap(page, `.ch-opt[data-i="${idxOk}"]`); await W(page, 150);
  await tap(page, '.adv-choice [data-act="finish"]'); await page.waitForSelector('.adv-reward');
}
async function place(page, tileType, edge) { await tap(page, `.cx-tile[data-type="${tileType}"]`); await W(page, 80); await tap(page, `.cx-slot[data-edge="${edge}"]`); await W(page, 120); }

try {
  // E1: pil bolgesi bitince acilista Evde Enerji haritasi, 7 dugum (yalniz ilki acik), kapi/geri dugmeleri, coin = kazanilan
  if (on('E1')) {
    const { page, errs, ctx, external } = await mk(SEEDPIL, { width: 800, height: 360 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    check('E1 acilista siradaki gorevin bolgesi: Evde Enerji, 7 dugum', await page.getAttribute('.adv-mapscreen', 'data-region') === 'ev' && await page.locator('.adv-node').count() === 7);
    const st = await page.locator('.adv-node').evaluateAll((n) => n.map((x) => x.dataset.state));
    check('E1 yalniz ilk gorev acik, digerleri kilitli', st[0] === 'open' && st.slice(1).every((s) => s === 'locked'), st.join());
    check('E1 coin HUD = 15 (Pil bolgesi odulleri, harcama yok)', await coinsHud(page) === 15);
    check('E1 HUD gorev sayaci 8 / 16 (V8.5: +Karanlik Ev gorevi)', /8\s*\/\s*16/.test(await page.locator('.adv-pill.prog').textContent()));
    check('E1 geri dugmesi (Pil ve Enerji) var ve calisir', await page.locator('button.adv-start.back').count() === 1);
    await shot(page, 'E1-ev-map');
    await tap(page, 'button.adv-start.back'); await W(page);
    check('E1 geri dugmesi Pil haritasina doner; kapi (Evde Enerji) ACIK ve gidilebilir', await page.getAttribute('.adv-mapscreen', 'data-region') === 'pil' && await page.locator('button.adv-gate.open.go').count() === 1 && await page.locator('.adv-gate.open').count() === 1);
    await tap(page, 'button.adv-gate.go'); await W(page);
    check('E1 kapi Evde Enerji haritasina gecirir', await page.getAttribute('.adv-mapscreen', 'data-region') === 'ev');
    check('E1 Evde Enerji bitmeden Gunes kapisi KILITLI (kapali)', await page.locator('.adv-gate.closed').count() === 1 && await page.locator('button.adv-gate.go').count() === 0);
    check('E1 hata/harici istek yok', errs.length === 0 && external.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E2: Pil bolgesi kapisi baslangicta (pil bitmeden) Evde Enerji KILITLI; bolge atlanamaz
  if (on('E2')) {
    const { page, errs, ctx } = await mk({ band: '4-5', sound: false, seen: true, adv: { intro: true, tasks: all3(PIL.slice(0, 5)) } }, { width: 800, height: 360 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    check('E2 pil bitmeden acilista Pil haritasi, kapi kilitli (gidilemez)', await page.getAttribute('.adv-mapscreen', 'data-region') === 'pil' && await page.locator('.adv-gate.closed').count() === 1 && await page.locator('button.adv-gate').count() === 0);
    check('E2 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E3: secmeli gercek hayat gorevi: yanlis cevap ceza degil (yildiz 2), dogru -> ogretici cumle, coin yalniz ilk kez, tekrar oynama coin vermez, kalici
  if (on('E3')) {
    const { page, errs, ctx } = await mk(SEEDPIL, { width: 800, height: 360 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    await tap(page, '.adv-node[data-id="fener"]'); await page.waitForSelector('.adv-choice');
    check('E3 fener: soru + 3 buyuk secenek, yonerge yazisi [data-say]', await page.locator('.ch-opt').count() === 3 && /Cep fenerin/.test(await page.locator('[data-say]').textContent()));
    const t = T('fener');
    const w = t.options.findIndex((o) => !o.ok);
    await tap(page, `.ch-opt[data-i="${w}"]`); await W(page, 120);
    check('E3 yanlis secenek nazikce isaretlenir, soru yazisi KALIR, gorev bitmez', await page.locator('.ch-opt.bad').count() === 1 && /Cep fenerin/.test(await page.locator('[data-say]').textContent()) && await page.locator('.adv-choice.solved').count() === 0);
    await solveChoice(page, 'fener');
    check('E3 odul: +1 coin ve 2 yildiz (1 hata)', await page.locator('.rw-coin').getAttribute('data-coin') === '1' && await page.locator('.rw-stars').getAttribute('data-stars') === '2');
    let s = await store(page);
    check('E3 kayit: adv.tasks.fener = 2', s.adv.tasks.fener === 2);
    await tap(page, '[data-act="tomap"]'); await W(page);
    check('E3 haritaya donus Evde Enerji; coin 16; ikinci gorev acildi', await page.getAttribute('.adv-mapscreen', 'data-region') === 'ev' && await coinsHud(page) === 16 && await page.locator('.adv-node[data-id="oda-lambasi"][data-state="open"]').count() === 1);
    await tap(page, '.adv-node[data-id="fener"]'); await page.waitForSelector('.adv-choice');
    await solveChoice(page, 'fener');
    check('E3 tekrar oynama: coin YOK ("zaten sende"), 3 yildiz yeni en iyi', await page.locator('.rw-coin').count() === 0 && /zaten sende/.test(await page.locator('.adv-reward').textContent()) && await page.locator('.rw-stars').getAttribute('data-stars') === '3');
    await tap(page, '[data-act="tomap"]'); await W(page);
    check('E3 tekrardan sonra coin hala 16', await coinsHud(page) === 16);
    await page.reload(); await page.waitForSelector('.adv-mapscreen');
    check('E3 yeniden baslatinca coin (16) ve ilerleme korunur', await coinsHud(page) === 16 && (await store(page)).adv.tasks.fener === 3);
    check('E3 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E4: tum secmeli gorevler cozulur (sirayla acilir), guvenlik gorevi dogru cevabi "Kucuk pil"
  if (on('E4')) {
    const { page, errs, ctx } = await mk(SEEDPIL, { width: 800, height: 360 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    for (const id of ['fener', 'oda-lambasi', 'kablo-koruma', 'guvenlik']) {
      await tap(page, `.adv-node[data-id="${id}"]`); await page.waitForSelector('.adv-choice');
      if (id === 'guvenlik') {
        const txt = await page.locator('.ch-opt').allTextContents();
        check('E4 guvenlik: secenekler Kucuk pil / priz / uzatma; sebeke dogru cevap DEGIL', txt.includes('Küçük pil') && txt.some((x) => /priz/i.test(x)));
        const prizIdx = T(id).options.findIndex((o) => /priz/i.test(o.text));
        await tap(page, `.ch-opt[data-i="${prizIdx}"]`); await W(page, 100);
        check('E4 guvenlik: priz secilince cevap KABUL EDILMEZ (gorev bitmez)', await page.locator('.adv-choice.solved').count() === 0);
      }
      await solveChoice(page, id);
      if (id === 'guvenlik') check('E4 guvenlik odul: 2 coin', await page.locator('.rw-coin').getAttribute('data-coin') === '2');
      await tap(page, '[data-act="tomap"]'); await W(page, 200);
    }
    check('E4 4 secmeli gorev sonrasi coin 15+1+1+1+2 = 20, led-direnc acik', await coinsHud(page) === 20 && await page.locator('.adv-node[data-id="led-direnc"][data-state="open"]').count() === 1);
    check('E4 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E5: LED + direnc devre gorevi: kablo ile direnci atlayinca "direnc lazim" ipucu (cozum sayilmaz), direnc koyunca kazanir
  if (on('E5')) {
    const seed = { band: '6-8', sound: false, seen: true, adv: { intro: true, tasks: all3([...PIL, ...EV.slice(0, 4)]) } };
    const { page, errs, ctx } = await mk(seed, { width: 800, height: 360 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    await tap(page, '.adv-node[data-id="led-direnc"]'); await page.waitForSelector('.adv-circuit');
    check('E5 led-direnc: tepside LED, direnc, kablo; LED/direnc parcalari cizilir', await page.locator('.cx-tile[data-type="led"] svg').count() === 1 && await page.locator('.cx-tile[data-type="resistor"] svg').count() === 1);
    await place(page, 'led', 'top'); await place(page, 'wire', 'right');
    check('E5 LED yanar (direnc atlandi) AMA gorev bitmez', await page.locator('.adv-circuit.solved').count() === 0 && await page.getAttribute('.adv-circuit', 'data-lit') === '1');
    check('E5 "direnc lazim" ipucu gosterilir', /direnç/i.test(await page.locator('[data-say]').textContent()), await page.locator('[data-say]').textContent());
    await tap(page, '.cx-slot[data-edge="right"]'); await W(page, 100); // kabloyu geri al
    await place(page, 'resistor', 'right');
    check('E5 LED + direnc: gorev COZULDU', await page.locator('.adv-circuit.solved').count() === 1);
    await shot(page, 'E5-led-direnc');
    await tap(page, '.adv-circuit [data-act="finish"]'); await page.waitForSelector('.adv-reward');
    check('E5 odul 2 coin', await page.locator('.rw-coin').getAttribute('data-coin') === '2');
    check('E5 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E6: Gece lambasi (anahtar+direnc+LED, yan, sonra sondur) ve Mucit Evi Finali (4 parca) -> bolge bitti, kutlama, Gunes kapisi acik ("yakinda")
  if (on('E6')) {
    const seed = { band: '6-8', sound: false, seen: true, adv: { intro: true, tasks: all3([...PIL, ...EV.slice(0, 5)]) } };
    const { page, errs, ctx } = await mk(seed, { width: 800, height: 360 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    await tap(page, '.adv-node[data-id="gece-lambasi"]'); await page.waitForSelector('.adv-circuit');
    await place(page, 'switch', 'top'); await place(page, 'resistor', 'right'); await place(page, 'led', 'bottom');
    check('E6 gece lambasi: anahtar acikken yanmaz, gorev bitmedi', await page.getAttribute('.adv-circuit', 'data-lit') === '0' && await page.locator('.adv-circuit.solved').count() === 0);
    await tap(page, '.cx-slot[data-edge="top"]'); await W(page, 150); // anahtari kapat -> yanar
    check('E6 anahtar kapaninca LED yanar; simdi sondurmesi istenir', await page.getAttribute('.adv-circuit', 'data-lit') === '1' && await page.locator('.adv-circuit.solved').count() === 0);
    await tap(page, '.cx-slot[data-edge="top"]'); await W(page, 150); // ac -> soner -> cozulur
    check('E6 anahtar acilinca soner ve gorev COZULUR', await page.locator('.adv-circuit.solved').count() === 1);
    await tap(page, '.adv-circuit [data-act="finish"]'); await page.waitForSelector('.adv-reward');
    await tap(page, '[data-act="tomap"]'); await W(page, 200);
    await tap(page, '.adv-node[data-id="ev-final"]'); await page.waitForSelector('.adv-circuit');
    await place(page, 'battery', 'left'); await place(page, 'switch', 'top'); await place(page, 'resistor', 'right'); await place(page, 'led', 'bottom');
    await tap(page, '.cx-slot[data-edge="top"]'); await W(page, 150); await tap(page, '.cx-slot[data-edge="top"]'); await W(page, 150);
    check('E6 final: pil+anahtar+direnc+LED kurulur, yan, soner -> COZULDU', await page.locator('.adv-circuit.solved').count() === 1);
    await tap(page, '.adv-circuit [data-act="finish"]'); await page.waitForSelector('.adv-reward');
    const rw = await page.locator('.adv-reward').textContent();
    check('E6 bolge sonu: "Evde Enerji bolgesini bitirdin!" + 3 coin + yeni bolge bildirimi', /Evde Enerji bölgesini bitirdin/.test(rw) && /\+3/.test(rw) && /Yeni bölge açıldı: Karanlık Ev/.test(rw), rw);
    await shot(page, 'E6-final');
    await tap(page, '[data-act="tomap"]'); await W(page, 200);
    check('E6 (V8.5 bilincli degisiklik) haritada Karanlik Ev kapisi ACIK ve GIDILEBILIR (artik oynanabilir bolum; eskiden Gunes "yakinda" idi)', await page.locator('.adv-gate.open').count() === 1 && await page.locator('button.adv-gate.go').count() === 1 && /Karanlık Ev/.test(await page.locator('.adv-gate').textContent()));
    check('E6 toplam coin 27; 15/16 gorev (Karanlik Ev henuz oynanmadi)', await coinsHud(page) === 27 && /15\s*\/\s*16/.test(await page.locator('.adv-pill.prog').textContent()));
    check('E6 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E7: Enerji Marketi: bakiye, katalog, sahiplik durumlari, yetersiz coin reddi, onay penceresi (Vazgec), satin alma, cift tiklama, kalicilik
  if (on('E7')) {
    const { page, errs, ctx } = await mk(SEEDPIL, { width: 800, height: 360 }, { fail: true });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    await tap(page, '[data-act="shop"]'); await page.waitForSelector('.adv-shop');
    check('E7 market acilir: 6 ekipman, bakiye 15, canta 0 / 6', await page.locator('.shop-item').count() === 6 && await coinsHud(page) === 15 && /0 \/ 6/.test(await page.locator('.shop-bag').textContent()));
    await shot(page, 'E7-market');
    const sts = await page.locator('.shop-item').evaluateAll((n) => n.map((x) => x.dataset.item + ':' + x.dataset.state));
    check('E7 fiyatlara gore durum: hepsi alinabilir (15 coin >= 7)', sts.every((x) => x.endsWith(':buy')), sts.join());
    await tap(page, '.shop-item[data-item="kablo-seti"] [data-act="buy"]'); await W(page, 100);
    check('E7 onay penceresi acilir (ekipman adi + fiyat)', await page.locator('.shop-confirm:not([hidden])').count() === 1 && /Kablo Seti/.test(await page.locator('.shop-q').textContent()) && /4 coin/.test(await page.locator('.shop-q').textContent()));
    await tap(page, '[data-act="buyno"]'); await W(page, 100);
    check('E7 Vazgec: coin ve envanter DEGISMEZ', await coinsHud(page) === 15 && ((await store(page)).adv.inv || []).length === 0 && await page.locator('.shop-confirm:not([hidden])').count() === 0);
    await tap(page, '.shop-item[data-item="kablo-seti"] [data-act="buy"]'); await W(page, 100);
    // cift tiklama: onay dugmesine iki hizli dokunus -> tek harcama
    await page.evaluate(() => { const b = document.querySelector('[data-act="buyyes"]'); b.click(); b.click(); });
    await W(page, 200);
    const s = await store(page);
    check('E7 satin alma + CIFT TIKLAMA: tek ekipman, tek harcama (15 -> 11)', JSON.stringify(s.adv.inv) === '["kablo-seti"]' && await coinsHud(page) === 11);
    check('E7 kart "Sende var", canta 1 / 6, tekrar alinamaz (dugme yok)', await page.locator('.shop-item[data-item="kablo-seti"][data-state="owned"]').count() === 1 && await page.locator('.shop-item[data-item="kablo-seti"] [data-act="buy"]').count() === 0 && /1 \/ 6/.test(await page.locator('.shop-bag').textContent()));
    // pahali ekipman: 11 coin -> canta 7 alinabilir; once 3 ekipman al, bakiye azalsin; yetersiz reddi
    await tap(page, '.shop-item[data-item="canta"] [data-act="buy"]'); await tap(page, '[data-act="buyyes"]'); await W(page, 150);
    check('E7 canta (7 coin): 11 -> 4', await coinsHud(page) === 4);
    const poor = await page.locator('.shop-item[data-item="led-seti"]').getAttribute('data-state');
    check('E7 4 coin ile LED Seti (6) "yetmiyor" durumunda; dugme aria-disabled, "2 coin eksik"', poor === 'poor' && await page.locator('.shop-item[data-item="led-seti"] [data-act="buy"]').getAttribute('aria-disabled') === 'true' && /2 coin eksik/.test(await page.locator('.shop-item[data-item="led-seti"]').textContent()));
    await tap(page, '.shop-item[data-item="led-seti"] [data-act="buy"]'); await W(page, 120);
    check('E7 yetersiz coinle satin alma REDDEDILIR (onay acilmaz, bakiye/envanter ayni, uyari)', await page.locator('.shop-confirm:not([hidden])').count() === 0 && await coinsHud(page) === 4 && (await store(page)).adv.inv.length === 2 && /Yetmiyor/.test(await page.locator('.shop-msg').textContent()));
    // kalicilik
    await page.reload(); await page.waitForSelector('.adv-mapscreen');
    await tap(page, '[data-act="shop"]'); await page.waitForSelector('.adv-shop');
    check('E7 yeniden baslatinca bakiye (4) ve envanter (kablo-seti, canta) korunur', await coinsHud(page) === 4 && await page.locator('.shop-item.owned').count() === 2);
    // yazma hatasi: satin alma kaydedilemezse coin harcanmaz
    await tap(page, '.shop-item[data-item="gozluk"] [data-act="buy"]'); await W(page, 100);
    await page.evaluate(() => { window.__failWrites = true; });
    await tap(page, '[data-act="buyyes"]'); await W(page, 200);
    await page.evaluate(() => { window.__failWrites = false; });
    check('E7 yazma hatasi: "Coin harcanmadi" uyarisi, bakiye (4) ve envanter degismez', /Coin harcanmadı/.test(await page.locator('.shop-msg').textContent()) && await coinsHud(page) === 4 && await page.locator('.shop-item.owned').count() === 2);
    check('E7 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E8: market Geri/donus ve ilerleme ekrani: coin = bakiye; menu "Ilerlemem"
  if (on('E8')) {
    const seed = { band: '4-5', sound: false, seen: true, adv: { intro: true, tasks: all3(PIL), inv: ['gozluk'] } };
    const { page, errs, ctx } = await mk(seed, { width: 800, height: 360 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    check('E8 HUD coin = 13 (15 - 2 gozluk)', await coinsHud(page) === 13);
    await tap(page, '[data-act="shop"]'); await page.waitForSelector('.adv-shop');
    await tap(page, '[data-act="shopback"]'); await page.waitForSelector('.adv-mapscreen');
    check('E8 market X: harita (ayni bolge)', await page.getAttribute('.adv-mapscreen', 'data-region') === 'ev');
    await tap(page, '[data-act="shop"]'); await page.waitForSelector('.adv-shop');
    await tap(page, '.shop-item[data-item="canta"] [data-act="buy"]'); await W(page, 100);
    await page.evaluate(() => window.__altezBack.handle()); await W(page, 300);
    check('E8 sistem Geri: once onay penceresi kapanir (market acik kalir)', await page.locator('.adv-shop').count() === 1 && await page.locator('.shop-confirm:not([hidden])').count() === 0);
    await page.evaluate(() => window.__altezBack.handle()); await W(page, 300);
    check('E8 sistem Geri (tekrar): haritaya / ana ekrana doner (market kapanir)', await page.locator('.adv-shop').count() === 0);
    await page.goto(BASE + '?r=2#/progress'); await page.waitForSelector('.pg-body');
    const pt = await page.locator('.pg-body').textContent();
    check('E8 Ilerlemem: 8 / 16 gorev ve 13 jeton (bakiye)', /8 \/ 16 görev/.test(pt) && /13/.test(pt), pt.slice(0, 120));
    check('E8 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E9: ses - sessiz modda hic konusma/MP3 yok (gorev + market); acikken metin TTS ile okunur; kayitli MP3 varsa o calinir (TTS yok); MP3 bozuk/yoksa TTS'e doner
  if (on('E9')) {
    // sessiz
    let c = await mk({ ...SEEDPIL, sound: false }, { width: 800, height: 360 }, { speech: true });
    await go(c.page); await tap(c.page, '.adv-node[data-id="fener"]'); await c.page.waitForSelector('.adv-choice'); await W(c.page, 400);
    await tap(c.page, '.ch-opt'); await W(c.page, 200);
    await tap(c.page, '[data-act="shopback"]').catch(() => {});
    await c.page.goto(BASE + '?r=5#/adventure'); await c.page.waitForSelector('.adv-mapscreen'); await tap(c.page, '[data-act="shop"]'); await c.page.waitForSelector('.adv-shop'); await W(c.page, 400);
    check('E9 SESSIZ: gorev + market boyunca konusma YOK, MP3 YOK', (await spoken(c.page)).length === 0 && (await plays(c.page)).length === 0, JSON.stringify(await spoken(c.page)));
    await c.ctx.close();
    // acik + TTS: gercek manifestte 106 Caglayan MP3 olabilir (uygulama o zaman DOGRU olarak MP3 calar). Bu senaryo "MP3 yok -> TTS" yolunu
    // sinar; bu yuzden manifest.voice bosaltilir (dosya yok durumu). Gercek manifestle davranis ayri senaryoda (asagida) sinanir.
    const noVoice = async (page) => { await page.route('**/assets/manifest.json', async (r) => { const j = JSON.parse((await (await r.fetch()).text())); for (const k of Object.keys(j.voice || {})) j.voice[k] = null; await r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); }); };
    c = await mk({ ...SEEDPIL, sound: true }, { width: 800, height: 360 }, { speech: true, routes: noVoice });
    await go(c.page); await tap(c.page, '.adv-node[data-id="fener"]'); await c.page.waitForSelector('.adv-choice'); await W(c.page, 500);
    let sp = await spoken(c.page);
    check('E9 SES ACIK: gorev yonergesi (tam metin) TTS ile okunur, tek kez', sp.filter((t) => t === T('fener').say).length === 1, JSON.stringify(sp));
    const ok = T('fener').options.findIndex((o) => o.ok);
    await tap(c.page, `.ch-opt[data-i="${ok}"]`); await W(c.page, 400);
    sp = await spoken(c.page);
    check('E9 dogru cevapta ogretici cumle okunur', sp.includes(T('fener').learn), JSON.stringify(sp));
    await tap(c.page, '.adv-choice [data-act="finish"]'); await c.page.waitForSelector('.adv-reward'); await W(c.page, 300);
    sp = await spoken(c.page);
    check('E9 odul cumlesi ("Gorev tamamlandi!") okunur', sp.includes(CFG.text.rewardTitle), JSON.stringify(sp.slice(-3)));
    await tap(c.page, '[data-act="tomap"]'); await tap(c.page, '[data-act="shop"]'); await c.page.waitForSelector('.adv-shop'); await W(c.page, 400);
    check('E9 market hos geldin cumlesi okunur', (await spoken(c.page)).includes(MK.text.say));
    check('E9 TTS yolunda MP3 calinmaz (dosya yok -> eski davranis)', (await plays(c.page)).length === 0);
    await c.ctx.close();
    // GERCEK manifest (paketle gelen): satirin MP3'u kayitliysa o TEK kez calinir ve ayni cumle TTS ile okunmaz; degilse TTS okur.
    {
      const real = JSON.parse(await (await fetch(BASE + 'assets/manifest.json')).text()).voice || {};
      const nReg = Object.values(real).filter(Boolean).length;
      c = await mk({ ...SEEDPIL, sound: true }, { width: 800, height: 360 }, { speech: true });
      await go(c.page); await tap(c.page, '.adv-node[data-id="fener"]'); await c.page.waitForSelector('.adv-choice'); await W(c.page, 600);
      const okI = T('fener').options.findIndex((o) => o.ok);
      const seen = async () => ({ sp: await spoken(c.page), pl: await plays(c.page) });
      const chk = (name, text, got) => { const f = real[lineKey(text)]; const nPlay = f ? got.pl.filter((u) => u.endsWith(f.split('/').pop())).length : 0; const nTts = got.sp.filter((t) => t === text).length;
        check(`E9 gercek manifest (${nReg}/106 MP3): ${name}: ${f ? 'MP3 tek kez, TTS yok' : 'TTS tek kez, MP3 yok'}`, f ? (nPlay === 1 && nTts === 0) : (nTts === 1 && nPlay === 0), JSON.stringify({ f: f || null, nPlay, nTts })); };
      chk('gorev yonergesi', T('fener').say, await seen());
      await tap(c.page, `.ch-opt[data-i="${okI}"]`); await W(c.page, 600);
      chk('ogretici cumle', T('fener').learn, await seen());
      await tap(c.page, '.adv-choice [data-act="finish"]'); await c.page.waitForSelector('.adv-reward'); await W(c.page, 600);
      chk('odul cumlesi', CFG.text.rewardTitle, await seen());
      await tap(c.page, '[data-act="tomap"]'); await tap(c.page, '[data-act="shop"]'); await c.page.waitForSelector('.adv-shop'); await W(c.page, 600);
      chk('market karsilama', MK.text.say, await seen());
      await c.ctx.close();
    }
    // kayitli MP3
    const sayKey = lineKey(T('fener').say);
    const routes = async (page) => {
      await page.route('**/assets/manifest.json', async (r) => { const j = JSON.parse((await (await r.fetch()).text())); j.voice[sayKey] = 'assets/sounds/voice/test-fener.mp3'; j.voice[lineKey(T('fener').learn)] = 'assets/sounds/voice/missing-learn.mp3'; await r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); });
      await page.route('**/assets/sounds/voice/test-fener.mp3', (r) => r.fulfill({ contentType: 'audio/mpeg', body: JINGLE }));
    };
    c = await mk({ ...SEEDPIL, sound: true }, { width: 800, height: 360 }, { speech: true, routes });
    await go(c.page); await tap(c.page, '.adv-node[data-id="fener"]'); await c.page.waitForSelector('.adv-choice'); await W(c.page, 500);
    const pl = await plays(c.page); sp = await spoken(c.page);
    check('E9 kayitli Caglayan MP3 VARSA o calinir (tek kez) ve ayni cumle TTS ile okunmaz', pl.filter((u) => /test-fener\.mp3/.test(u)).length === 1 && !sp.includes(T('fener').say), JSON.stringify({ pl, sp }));
    await tap(c.page, `.ch-opt[data-i="${ok}"]`); await W(c.page, 400);
    sp = await spoken(c.page);
    check('E9 MP3 yolu bozuk/yoksa (oynatma reddi) ayni cumle TTS ile okunur (akis calismaya devam eder)', sp.includes(T('fener').learn) && await c.page.locator('.adv-choice.solved').count() === 1, JSON.stringify(sp));
    const real = c.errs.filter((e) => !/404/.test(e)); // eksik MP3 senaryosunda tarayici 404 kaydi BEKLENIR (bilerek var olmayan dosya)
    check('E9 hata yok (bilerek eksik MP3 icin 404 haric)', real.length === 0, real.join(' | '));
    await c.ctx.close();
  }
  // E10: yerlesim (yatay 7 boyut): Evde Enerji haritasi, market, secmeli gorev, devre gorevi: tasma yok, dugmeler ekranda >=44px, "cihazi cevir" yok; market listesi kaydirilarak sonuna ulasilir
  if (on('E10')) {
    for (const [w, h] of ADVL) {
      const { page, errs, ctx } = await mk({ band: '6-8', sound: false, seen: true, adv: { intro: true, tasks: all3([...PIL, 'fener']) } }, { width: w, height: h });
      const L = () => page.evaluate(() => {
        const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
        const btns = [...document.querySelectorAll('.adv button')].filter(vis);
        const rot = document.querySelector('.adv-rotate');
        return { sw: document.documentElement.scrollWidth, w: innerWidth, off: btns.filter((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1; }).length, small: btns.filter((b) => { const r = b.getBoundingClientRect(); return Math.min(r.width, r.height) < 44; }).map((b) => b.dataset.act || b.className).slice(0, 4), rotate: !!rot && getComputedStyle(rot).display !== 'none' };
      });
      await go(page); await page.waitForSelector('.adv-mapscreen'); await W(page, 300);
      let m = await L();
      check(`E10 ${w}x${h} Evde Enerji haritasi: tasma yok, dugmeler ekranda, cihazi cevir yok`, m.sw <= m.w + 1 && m.off === 0 && !m.rotate, JSON.stringify(m));
      await tap(page, '[data-act="shop"]'); await page.waitForSelector('.adv-shop'); await W(page, 250);
      m = await L();
      const reach = await page.evaluate(() => { const g = document.querySelector('.shop-grid'); g.scrollTop = g.scrollHeight; const last = document.querySelector('.shop-item:last-child [data-act="buy"], .shop-item:last-child .shop-owned'); const r = last.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.top >= 0; });
      check(`E10 ${w}x${h} market: tasma yok, dugmeler >=44px, liste kaydirilinca son urunun dugmesi ekranda`, m.sw <= m.w + 1 && !m.rotate && m.small.length === 0 && reach, JSON.stringify({ ...m, reach }));
      if (w === 800) await shot(page, 'E10-market-800');
      await tap(page, '[data-act="shopback"]'); await page.waitForSelector('.adv-mapscreen');
      await tap(page, '.adv-node[data-id="oda-lambasi"]'); await page.waitForSelector('.adv-choice'); await W(page, 200);
      m = await L();
      const optsIn = await page.evaluate(() => [...document.querySelectorAll('.ch-opt')].every((b) => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight + 1 && r.height >= 44; }));
      check(`E10 ${w}x${h} secmeli gorev: tasma yok, 3 secenek ekranda ve >=44px`, m.sw <= m.w + 1 && m.off === 0 && !m.rotate && optsIn, JSON.stringify(m));
      check(`E10 ${w}x${h} hata yok`, errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  }
  // E11: dikeyde Enerji Macerasi (market dahil) "telefonu yatay cevir" engeliyle korunur (yon kilidi ayni)
  if (on('E11')) {
    const { page, errs, ctx } = await mk(SEEDPIL, { width: 360, height: 640 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    check('E11 dikey: harita uzerinde "telefonu yatay cevir" engeli gorunur', await page.evaluate(() => getComputedStyle(document.querySelector('.adv-rotate')).display !== 'none'));
    await tap(page, '[data-act="shop"]').catch(() => {});
    await page.setViewportSize({ width: 800, height: 360 }); await W(page, 300);
    check('E11 yatay cevrilince engel kalkar, market erisilebilir', await page.evaluate(() => { const r = document.querySelector('.adv-rotate'); return !r || getComputedStyle(r).display === 'none'; }));
    check('E11 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  // E12: eski ilerleme (V8.3: yalniz pil gorevleri, envanter alani yok) bozulmadan acilir; coin korunur
  if (on('E12')) {
    const { page, errs, ctx } = await mk({ band: '6-8', sound: true, seen: true, correct: 4, adv: { intro: true, tasks: { tanis: 3, 'ilk-isik': 2, dedektif: 1 } }, profile: { first: 'Ada', last: 'Mucit' } }, { width: 800, height: 360 });
    await go(page); await page.waitForSelector('.adv-mapscreen');
    check('E12 V8.3 kaydi: Pil haritasi, 3 gorev tamam, coin 4 (1+2+1), market bos', await page.getAttribute('.adv-mapscreen', 'data-region') === 'pil' && await coinsHud(page) === 4 && /3\s*\/\s*16/.test(await page.locator('.adv-pill.prog').textContent()));
    const s = await store(page);
    check('E12 kayit bozulmaz (profil, correct, gorevler aynen)', s.profile.first === 'Ada' && s.correct === 4 && s.adv.tasks.dedektif === 1);
    check('E12 hata yok', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
} catch (e) {
  check('beklenmeyen hata', false, String(e).slice(0, 300));
}
await browser.close();
server.close();
const bad = results.filter((r) => !r.ok);
console.log(`\nV8.4 Market/Gorev UI: ${results.length - bad.length}/${results.length} gecti${bad.length ? `, ${bad.length} BASARISIZ` : ''}`);
process.exit(bad.length ? 1 : 0);
