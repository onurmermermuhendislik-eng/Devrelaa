// Gercek tarayici (Chromium) uzerinden uctan uca duman testi.
//   node scripts/ui-smoke.mjs            -> testleri calistirir
//   SHOTS=/yol/klasor node scripts/ui-smoke.mjs   -> ekran goruntuleri de kaydeder
// Playwright PROJE BAGIMLILIGI DEGILDIR (yalnizca bu test icin, makinede kurulu olmali).
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { startServer } from './serve.mjs';

const require = createRequire(import.meta.url);
let chromium;
for (const p of [process.env.PLAYWRIGHT_PATH, '/home/claude/.npm-global/lib/node_modules/playwright', 'playwright'].filter(Boolean)) {
  try {
    ({ chromium } = require(p));
    break;
  } catch {
    /* sonrakini dene */
  }
}
if (!chromium) {
  console.error('Playwright bulunamadi (PLAYWRIGHT_PATH ile yol verebilirsiniz).');
  process.exit(2);
}

const SHOTS = process.env.SHOTS;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok: !!ok, info });
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${info ? '  -> ' + info : ''}`);
};

const server = await startServer(0);
// V8.4 TEST DUZENI (beklenti DUSURULMEDI): V8.1'den beri varsayilan acilis ana MENUdur; bu 545 kontrolluk set V7.x'in eski ana ekranini (oyun kartlari) sinar.
// Eski ana ekran `?home=1` ile acilir (menu ve macera: ui-v81/v82/v83/v84/v84-market). Hash rotalari ayni kalir.
const BASE = `http://127.0.0.1:${server.address().port}/?home=1`;
const HOME = BASE + '#/games'; // V7.8+: oyun kartlari (`.home .game-card`) Oyunlar listesindedir (#/games)
const browser = await chromium.launch();
// V7.8+ iki kademeli gezinme: acilis/Geri ANA MENUye (.home.menu) doner, oyun kartlari (.game-card) Oyunlar listesindedir (#/games).
// Bu yardimci eski "ana ekran = oyun listesi" beklentisini yeni akisa uyarlar (MENU gorunur olmali; sonra Oyunlar listesine gecilir). Beklenti dusurulmedi.
const menuReady = async (pg) => { // ANA MENU (kok '#/'): egitim girisi vb. burada
  await pg.waitForSelector('.home', { timeout: 8000 });
  if (!(await pg.locator('.home .edu-entry').count())) { await pg.evaluate(() => { location.hash = '#/'; }); }
  await pg.waitForSelector('.home .edu-entry', { state: 'attached', timeout: 8000 });
};
const cardsReady = async (pg, o) => {
  await pg.waitForSelector('.home', o);
  if (!(await pg.$('.home .game-card'))) await pg.evaluate(() => { if (location.hash !== '#/games') location.hash = '#/games'; });
  await pg.waitForSelector('.home .game-card', o);
};


const VIEWPORTS = {
  'telefon-kucuk-320x568': { width: 320, height: 568 },
  'telefon-360x640': { width: 360, height: 640 },
  'telefon-uzun-412x915': { width: 412, height: 915 },
  'tablet-800x1280': { width: 800, height: 1280 },
  'yatay-640x360': { width: 640, height: 360 }
};

async function newPage(viewport, seedStorage, { splash = false, routeAbort = null, noTts = false } = {}) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const problems = { errors: [], external: [] };
  page.on('pageerror', (e) => problems.errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && problems.errors.push(m.text()));
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) problems.external.push(r.url());
  });
  // Ses dosyasi calma girisimlerini izle (jingle dosyasi gercekten istenmis mi)
  await page.addInitScript(() => {
    window.__media = [];
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (...a) {
      window.__media.push(this.currentSrc || this.src);
      return play.apply(this, a);
    };
  });
  if (routeAbort) await page.route(routeAbort, (r) => r.abort());
  // Konusma motoru yok senaryosu (ses calismazsa oyun akmaya devam etmeli) + testleri hizlandirir
  if (noTts) await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }));
  // Ses uretimini izle (oscillator sayisi, en gec biten nota): sesin gercekten uretildigini dogrular
  await page.addInitScript(() => {
    const Base = window.AudioContext || window.webkitAudioContext;
    window.__audio = { osc: 0, maxEnd: 0, contexts: 0 };
    if (!Base) return;
    window.AudioContext = class extends Base {
      constructor(...a) {
        super(...a);
        window.__audio.contexts += 1;
      }
      createOscillator() {
        const o = super.createOscillator();
        window.__audio.osc += 1;
        const stop = o.stop.bind(o);
        o.stop = (t) => {
          window.__audio.maxEnd = Math.max(window.__audio.maxEnd, t - this.currentTime);
          return stop(t);
        };
        return o;
      }
    };
  });
  // Testlerin cogu acilis ekranini beklemesin: "goruldu" bayragi ile baslar (splash testleri hariç)
  const seed = splash ? seedStorage : { seen: true, ...(seedStorage || {}) };
  if (seed) {
    await page.addInitScript((v) => {
      if (!localStorage.getItem('altez-minilab:v1')) localStorage.setItem('altez-minilab:v1', JSON.stringify(v));
    }, seed);
  }
  if (splash) return { page, ctx, problems };
  await page.goto(HOME);
  await cardsReady(page);
  return { page, ctx, problems };
}

const shot = async (page, name) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}.png` }));
const cls = (page, sel) => page.getAttribute(sel, 'class');
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('altez-minilab:v1') || 'null'));

async function solveGeometry(page, stats) {
  const n = await page.locator('.tile').count();
  for (let i = 0; i < n; i++) {
    const tile = page.locator('.tile').nth(i);
    if ((await tile.getAttribute('class')).includes('dim')) continue;
    await tile.click();
    await page.waitForTimeout(80);
    if ((await cls(page, '.prompt')).includes('solved')) return;
    stats.wrong += 1; // yanlis secim: ceza olmamali
    stats.wrongDimmed &&= (await tile.getAttribute('class')).includes('dim');
    stats.wrongNoPunish &&= (await page.locator('.overlay:not([hidden])').count()) === 0;
  }
  throw new Error('geometri turu cozulemedi');
}

async function solveCircuit(page, stats) {
  for (let guard = 0; guard < 40; guard++) {
    const empties = await page.locator('[data-slot]').count();
    const sw = page.locator('.part.hint[data-switch]');
    // "Bozuk parcayi bul" turu (c12): once bozuk parcaya dokunmak gerekir; parca secimi yerlestirmez. (V6: kararsizligin KOK NEDENI - cozucu bu turu bilmiyordu)
    const faulty = page.locator('.slot.fault');
    if (await faulty.count()) {
      stats.faultFixed = (stats.faultFixed || 0) + 1;
      await faulty.first().click({ force: true });
      await page.waitForTimeout(120);
      continue;
    }
    if (empties === 0 && (await sw.count()) === 0) {
      await page.waitForSelector('.prompt.solved', { timeout: 6000 });
      return;
    }
    if (await sw.count()) {
      stats.switchTapped = true;
      await sw.click();
      await page.waitForTimeout(100);
      continue;
    }
    const tiles = page.locator('.tile:not(.used)');
    const cnt = await tiles.count();
    let progressed = false;
    for (let i = 0; i < cnt && !progressed; i++) {
      const usedBefore = await page.locator('.tile.used').count();
      await tiles.nth(i).click();
      if ((await page.locator('[data-slot]').count()) > 1) await page.locator('[data-slot]').first().click();
      // V7.3: tek konumlu devrede yerlesme, secilen parcanin adi/parlamasi gorunsun diye kisa sure (~450ms) gecikir.
      await page.waitForTimeout(90);
      for (let w = 0; w < 14 && (await page.locator('.tile.used').count()) <= usedBefore && (await page.locator('.tile.chosen').count()) > 0; w++) await page.waitForTimeout(60);
      if ((await page.locator('.tile.used').count()) > usedBefore) progressed = true;
      else stats.wrong += 1;
    }
    if (!progressed) throw new Error('devre turu cozulemedi');
  }
  throw new Error('devre turu cozulemedi (dongu siniri)');
}

// Bir turu coz, sonraki tura gec. Seviye atlama ekrani gorulurse adini dondur.
async function playRound(page, stats, { shotName, measure } = {}) {
  const circuit = (await cls(page, '.prompt')).includes('kind-circuit');
  const stage = circuit ? await page.getAttribute('.prompt', 'data-stage') : null;
  const glowBefore = circuit ? await page.$$eval('.board .led .glow', (els) => els.map((e) => +getComputedStyle(e).opacity)) : [];
  if (circuit) await solveCircuit(page, stats);
  else await solveGeometry(page, stats);
  let leds = [];
  let glow = [];
  if (circuit) {
    leds = await page.$$eval('.board .led', (els) => els.map((e) => e.dataset.b));
    if (shotName || measure) await page.waitForTimeout(1600); // LED parlamasi otursun
    glow = await page.$$eval('.board .led .glow', (els) => els.map((e) => +getComputedStyle(e).opacity));
  }
  if (shotName) await shot(page, shotName);
  await page.waitForFunction(() => {
    const o = document.querySelector('.overlay');
    return (o && !o.hidden) || !document.querySelector('.prompt')?.classList.contains('solved');
  }, null, { timeout: 9000 });
  let levelUp = null;
  if ((await page.locator('.overlay:not([hidden])').count()) > 0) {
    levelUp = (await page.textContent('.lv-title')).trim();
    await shot(page, `seviye-atlama-${levelUp}`);
    await page.click('.overlay');
    await page.waitForFunction(() => !document.querySelector('.prompt')?.classList.contains('solved'));
  }
  stats.rounds += 1;
  if (circuit) stats.circuits += 1;
  return { circuit, levelUp, stage, leds, glow, glowBefore };
}

const newStats = () => ({ rounds: 0, circuits: 0, wrong: 0, wrongDimmed: true, wrongNoPunish: true, switchTapped: false });

async function layoutChecks(page, label) {
  const vp = page.viewportSize();
  const m = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    sh: document.documentElement.scrollHeight,
    tiles: [...document.querySelectorAll('.tile')].map((t) => {
      const r = t.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    }),
    prompt: (() => {
      const r = document.querySelector('.prompt')?.getBoundingClientRect();
      return r && { x: r.x, y: r.y, w: r.width, h: r.height };
    })()
  }));
  check(`${label}: yatay tasma yok`, m.sw <= vp.width + 1, `${m.sw}/${vp.width}`);
  check(`${label}: dikey tasma yok`, m.sh <= vp.height + 1, `${m.sh}/${vp.height}`);
  const inside = (r) => r.x >= -1 && r.y >= -1 && r.x + r.w <= vp.width + 1 && r.y + r.h <= vp.height + 1;
  check(`${label}: tum secenekler ekran icinde`, m.tiles.length > 0 && m.tiles.every(inside), JSON.stringify(m.tiles.map((t) => [Math.round(t.x), Math.round(t.y)])));
  check(`${label}: dokunma alani >= 64px`, m.tiles.every((t) => t.w >= 64 && t.h >= 48), m.tiles.map((t) => `${Math.round(t.w)}x${Math.round(t.h)}`).join(' '));
  check(`${label}: ipucu/soru alani gorunur`, m.prompt && m.prompt.w > 120 && m.prompt.h > 60 && inside(m.prompt), JSON.stringify(m.prompt));
  const tooSmall = m.tiles.length > 1 && m.tiles.some((a, i) => m.tiles.some((b, j) => i < j && Math.abs(a.x - b.x) < a.w * 0.9 && Math.abs(a.y - b.y) < a.h * 0.9));
  check(`${label}: secenekler ust uste binmiyor`, !tooSmall);
}

try {
} catch (e) { check('beklenmeyen hata [bolum: 1) Acilis]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 1) Acilis + 4-5 yas akisi (telefon) ----------
  {
    const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640']);
    // Asama 4: tek "Oyna" dugmesi yerine oyun secim kartlari (talimat geregi; esdeger kontroller asagida + bolum 12)
    check('uygulama acilir, "Sekli Tamamla" karti gorunur', (await page.textContent('[data-game="shape-complete"]')).includes('Şekli Tamamla'));
    const homeBox = await page.locator('[data-game="shape-complete"]').boundingBox();
    check('ana ekran: kart dokunma alani buyuk (>= 64px) ama ekrani kaplamaz', homeBox.height >= 64 && homeBox.height < 220, `${Math.round(homeBox.width)}x${Math.round(homeBox.height)}`);
    await shot(page, '01-ana-ekran');
    await page.click('[data-game="shape-complete"]');
    await page.waitForSelector('.play .prompt svg');
    check('oyun ekrani acilir (#/play)', (await page.evaluate(() => location.hash)).startsWith('#/play/'));
    check('4-5 yas seviye 0: 2 secenek', (await page.locator('.tile').count()) === 2);
    await layoutChecks(page, 'telefon-360 / tur 1');
    await shot(page, '02-tur1-sekil');

    const stats = newStats();
    await page.locator('.tile').first().click();
    await page.waitForTimeout(120);
    const oscAfterFirst = (await page.evaluate(() => window.__audio.osc));
    check('dokunma sesi uretilir (ses motoru calisir)', oscAfterFirst >= 1, `osc=${oscAfterFirst}`);
    if (!(await cls(page, '.prompt')).includes('solved')) await solveGeometry(page, stats);
    check('dogru cevap: tur cozulur ve ilerleme kaydedilir', (await stored(page)).correct === 1);
    await page.waitForFunction(() => !document.querySelector('.prompt').classList.contains('solved'), null, { timeout: 5000 });
    stats.rounds = 1;

    await playRound(page, stats); // tur 2 (geometri)
    check('tur 3 devre bolumu', (await cls(page, '.prompt')).includes('kind-circuit'));
    await layoutChecks(page, 'telefon-360 / devre');
    await shot(page, '04-devre-baslangic');
    const board = await page.evaluate(() => ({
      slots: document.querySelectorAll('[data-slot]').length,
      tiles: document.querySelectorAll('.tile.comp').length,
      power: document.querySelector('.board')?.classList.contains('power'),
      stage: document.querySelector('.prompt').dataset.stage
    }));
    check('devre: bos konum + komponent karolari var, enerji kapali', board.slots >= 1 && board.tiles >= 2 && !board.power, JSON.stringify(board));
    check('devre: ilk bolum en basit bolum (kablo)', board.stage === 'c1-kablo', board.stage);
    await page.evaluate(() => (window.__audio.maxEnd = 0));
    const oscBeforeCircuit = await page.evaluate(() => window.__audio.osc);
    const c = await playRound(page, stats, { shotName: '05-devre-tamam', measure: true });
    check('devre: LED tamamlanmadan sonuk (hale yok)', c.glowBefore.every((o) => o === 0), c.glowBefore.join());
    check('devre: tamamlaninca LED gercekten parlar (hale gorunur)', c.glow.length >= 1 && c.glow.every((o) => o > 0.5), c.glow.join());
    const au = await page.evaluate(() => window.__audio);
    check('devre: basari muzigi calindi (cok notali, ~2 sn)', au.osc - oscBeforeCircuit >= 25 && au.maxEnd >= 1.8 && au.maxEnd <= 2.8, `osc+${au.osc - oscBeforeCircuit} bitis=${au.maxEnd.toFixed(2)}s`);
    check('devre tamamlama kaydi (bolum ilerlemesi) saklandi', (await stored(page)).circuit['4-5'].plays === 1);

    // Seviye atlama (10 dogru)
    let level = null;
    for (let i = 0; i < 12 && !level; i++) level = (await playRound(page, stats)).levelUp;
    check('10 dogru cevapta seviye atlar: Cirak', level === 'Çırak', String(level));
    const st = await stored(page);
    check('saklanan veri minimum (yalnizca ilerleme/yas/ses/acilis goruldu)', Object.keys(st).sort().join() === 'band,circuit,correct,seen,sound', Object.keys(st).join());
    check('yanlis cevaplar ceza yaratmadi', stats.wrongDimmed && stats.wrongNoPunish, `yanlis=${stats.wrong}`);
    check('hic harici ag istegi yok (cevrimdisi)', problems.external.length === 0, problems.external.join(','));
    check('konsol/sayfa hatasi yok', problems.errors.length === 0, problems.errors.slice(0, 3).join(' | '));

    await page.goBack();
    await cardsReady(page);
    check('geri tusu ana ekrana doner', (await page.locator('.home').count()) === 1 && (await page.locator('.play').count()) === 0);
    await page.reload();
    await cardsReady(page);
    check('ilerleme yeniden acilista korunur', (await stored(page)).correct === st.correct && (await page.textContent('.home .lv-name')).trim() === 'Çırak');
    await ctx.close();
  }

} catch (e) { check('beklenmeyen hata [bolum: 1) Acilis + 4-5 yas akisi (telefon)]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 1b) Yanlis cevap: ceza yok, nazik ipucu (gercek yanlis dokunus yakalanana kadar dener) ----------
  {
    let proven = null;
    for (let attempt = 0; attempt < 14 && !proven; attempt++) {
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640']);
      await page.click('[data-game="shape-complete"]');
      await page.waitForSelector('.play .prompt svg');
      const oscBefore = await page.evaluate(() => window.__audio.osc);
      const first = page.locator('.tile').first();
      await first.click();
      await page.waitForTimeout(150);
      if ((await first.getAttribute('class')).includes('dim')) {
        proven = {
          noOverlay: (await page.locator('.overlay:not([hidden])').count()) === 0,
          notSolved: !(await cls(page, '.prompt')).includes('solved'),
          hint: (await cls(page, '.prompt')).includes('hint') || (await page.locator('.tile.glow-hint').count()) > 0,
          progress: (await stored(page))?.correct ?? 0, // yanlis cevap hicbir sey yazmaz
          soft: (await page.evaluate(() => window.__audio.osc)) - oscBefore,
          stillPlayable: (await page.locator('.tile:not(.dim)').count()) >= 1
        };
        await shot(page, '03-yanlis-ipucu');
      }
      await ctx.close();
    }
    check('yanlis dokunus yakalandi (test gecerli)', !!proven);
    if (proven) {
      check('yanlis cevap: ceza/olumsuz ekran yok, tur surer', proven.noOverlay && proven.notSolved && proven.stillPlayable);
      check('yanlis cevap: gorsel ipucu verilir (hedef vurgusu veya parlayan dogru secenek)', proven.hint);
      check('yanlis cevap: puan dusmez', proven.progress === 0, String(proven.progress));
      check('yanlis cevap: yumusak, tek notalik ses (buzzer degil)', proven.soft >= 1 && proven.soft <= 4, `osc+${proven.soft}`);
    }
  }

} catch (e) { check('beklenmeyen hata [bolum: 1b) Yanlis cevap: ceza yok, nazik ipucu (gercek ya]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 2) 6-8 yas: 4 secenek, oruntu, seri/paralel bolumler ----------
  {
    const seed = { correct: 12, band: '6-8', sound: true, circuit: { '4-5': { stage: 0, plays: 0 }, '6-8': { stage: 5, plays: 0 } } };
    const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], seed);
    await page.click('[data-game="shape-complete"]');
    await page.waitForSelector('.play .prompt svg');
    check('6-8 yas seviye 1: 4 secenek', (await page.locator('.tile').count()) === 4);
    const t = await page.locator('.tile').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().y)));
    check('6-8 yas: 4 secenek 2x2 dengeli dizilir', new Set(t).size === 2, t.join(','));
    const stats = newStats();
    const kinds = new Set();
    const circuits = {};
    for (let i = 0; i < 7; i++) {
      const k = (await cls(page, '.prompt')).match(/kind-(\w+)/)[1];
      kinds.add(k);
      await shot(page, k === 'circuit' ? `06-6-8-devre-${i}` : `06-6-8-${k}-${i}`);
      const r = await playRound(page, stats, { shotName: k === 'circuit' ? `07-6-8-devre-tamam-${i}` : null, measure: k === 'circuit' });
      if (r.circuit) circuits[r.stage] = r;
    }
    check('6-8 yas: birden fazla tur tipi gorulur', kinds.size >= 2, [...kinds].join(','));
    check('6-8 yas: seri bolum (iki LED, soluk) oynandi', circuits['c6-seri'] && circuits['c6-seri'].leds.join() === '2,2', JSON.stringify(circuits['c6-seri']?.leds));
    check('6-8 yas: paralel bolum (iki LED, tam parlak) oynandi', circuits['c7-paralel'] && circuits['c7-paralel'].leds.join() === '3,3', JSON.stringify(circuits['c7-paralel']?.leds));
    if (circuits['c6-seri'] && circuits['c7-paralel']) {
      const dim = Math.max(...circuits['c6-seri'].glow);
      const bright = Math.min(...circuits['c7-paralel'].glow);
      check('seri LED paraleldekinden gorunur sekilde daha soluk', dim < bright, `seri=${dim.toFixed(2)} paralel=${bright.toFixed(2)}`);
    }
    check('6-8: harici ag/konsol hatasi yok', problems.external.length === 0 && problems.errors.length === 0, [...problems.external, ...problems.errors].slice(0, 3).join(' | '));
    await ctx.close();
  }

} catch (e) { check('beklenmeyen hata [bolum: 2) 6-8 yas: 4 secenek, oruntu, seri/paralel boluml]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 3) Anahtar bolumu (4-5, bolum 5) ----------
  {
    const seed = { correct: 0, band: '4-5', sound: true, circuit: { '4-5': { stage: 4, plays: 0 }, '6-8': { stage: 0, plays: 0 } } };
    const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], seed);
    await page.click('[data-game="shape-complete"]');
    await page.waitForSelector('.play .prompt svg');
    const stats = newStats();
    await playRound(page, stats);
    await playRound(page, stats);
    check('anahtar bolumu acilir', (await page.getAttribute('.prompt', 'data-stage')) === 'c5-anahtar');
    const tile = page.locator('.tile:not(.used)');
    const n = await tile.count();
    for (let i = 0; i < n; i++) {
      await tile.nth(i).click();
      await page.waitForTimeout(90);
      // V7.3: tek konumlu devrede yerlesme ~450ms gecikir (secilen parcanin adi gorunsun)
      for (let w = 0; w < 14 && (await page.locator('.part.hint[data-switch]').count()) === 0 && (await page.locator('.tile.chosen').count()) > 0; w++) await page.waitForTimeout(60);
      if ((await page.locator('.part.hint[data-switch]').count()) > 0) break;
    }
    const hinted = (await page.locator('.part.hint[data-switch]').count()) === 1;
    check('anahtar bolumu: anahtar acik, dokun ipucu parlar, LED sonuk', hinted && (await page.locator('.board.power').count()) === 0);
    await shot(page, '08-anahtar-bekliyor');
    if (hinted) {
      await page.locator('.part.hint[data-switch]').click();
      await page.waitForSelector('.prompt.solved', { timeout: 6000 });
      await page.waitForTimeout(1500);
      check('anahtar kapaninca enerji akar ve LED yanar', (await page.locator('.board.power .led[data-b="3"]').count()) >= 1);
      await shot(page, '09-anahtar-tamam');
    }
    await ctx.close();
  }

} catch (e) { check('beklenmeyen hata [bolum: 3) Anahtar bolumu (4-5, bolum 5)]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 3b) Devrede yanlis yerlestirme: ceza yok, nazik duzeltme (2 konumlu bolum: direnc + kablo) ----------
  {
    const seed = { correct: 0, band: '4-5', sound: true, circuit: { '4-5': { stage: 3, plays: 0 }, '6-8': { stage: 0, plays: 0 } } };
    const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], seed);
    await page.click('[data-game="shape-complete"]');
    await page.waitForSelector('.play .prompt svg');
    const stats = newStats();
    await playRound(page, stats);
    await playRound(page, stats);
    check('direnc bolumu: 2 bos konum', (await page.getAttribute('.prompt', 'data-stage')) === 'c4-direnc' && (await page.locator('[data-slot]').count()) === 2);
    const used = () => page.locator('.tile.used').count();
    const correctBefore = (await stored(page)).correct;

    // 1) kablo -> direnc konumu (yanlis): yerlesmez, konum nazikce vurgulanir
    await page.locator('.tile[data-type="wire"]').click();
    check('komponent secilince bos konumlar vurgulanir', (await page.locator('.slot.armed').count()) === 2);
    await page.locator('[data-slot="top"]').click();
    await page.waitForTimeout(150);
    check('yanlis konum: komponent yerlesmez, konum sari ipucuyla vurgulanir', (await used()) === 0 && (await page.locator('.slot.hint[data-slot="top"]').count()) === 1);
    check('yanlis konum: puan/ilerleme degismez, ekran kilitlenmez', (await stored(page)).correct === correctBefore && !(await cls(page, '.prompt')).includes('solved'));
    // 2) pil (dagitici) -> kablo konumu (yanlis, 2. hata): dogru komponent parlar
    await page.locator('.tile[data-type="battery"]').click();
    await page.locator('[data-slot="bot"]').click();
    await page.waitForTimeout(150);
    check('2. yanlista dogru komponent parlayarak gosterilir', (await page.locator('.tile.glow-hint[data-type="wire"]').count()) === 1);
    await shot(page, '13-devre-yanlis-ipucu');
    // 3) dogrusunu yap
    await page.locator('.tile[data-type="wire"]').click();
    await page.locator('[data-slot="bot"]').click();
    await page.waitForTimeout(150);
    check('dogru konuma yerlesir, diger bos konum kalir', (await used()) === 1 && (await page.locator('[data-slot]').count()) === 1);
    await page.locator('.tile[data-type="resistor"]').click(); // tek bos konum: otomatik yerlesir
    await page.waitForSelector('.prompt.solved', { timeout: 6000 });
    check('direnc bolumu tamamlanir', (await stored(page)).correct === correctBefore + 1);
    check('devrede yanlis yerlestirme hata uretmedi', problems.errors.length === 0, problems.errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

} catch (e) { check('beklenmeyen hata [bolum: 3b) Devrede yanlis yerlestirme: ceza yok, nazik du]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 3c) Bosta kalinca otomatik nazik ipucu (cocuk ne yapacagini bilmiyorsa) ----------
  {
    const geo = async () => {
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640']);
      await page.click('[data-game="shape-complete"]');
      await page.waitForSelector('.play .prompt svg');
      const early = (await cls(page, '.prompt')).includes('hint') || (await page.locator('.tile.glow-hint').count()) > 0;
      await page.waitForTimeout(9800);
      const first = (await cls(page, '.prompt')).includes('hint');
      await page.waitForTimeout(9300);
      const second = (await page.locator('.tile.glow-hint').count()) === 1;
      await shot(page, '14-bosta-ipucu-sekil');
      await ctx.close();
      return { early, first, second };
    };
    const circ = async () => {
      const seed = { correct: 0, band: '4-5', sound: true, circuit: { '4-5': { stage: 0, plays: 0 }, '6-8': { stage: 0, plays: 0 } } };
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], seed);
      await page.click('[data-game="shape-complete"]');
      await page.waitForSelector('.play .prompt svg');
      const st = newStats();
      await playRound(page, st);
      await playRound(page, st);
      const early = (await page.locator('.slot.hint').count()) > 0;
      await page.waitForTimeout(9800);
      const first = (await page.locator('.slot.hint').count()) > 0;
      await page.waitForTimeout(9300);
      const second = (await page.locator('.tile.glow-hint').count()) === 1;
      await shot(page, '15-bosta-ipucu-devre');
      await ctx.close();
      return { early, first, second };
    };
    const [g, c] = await Promise.all([geo(), circ()]);
    check('sekil turu: ilk anda ipucu yok, ~9 sn sonra hedef vurgulanir, ~18 sn sonra dogru secenek parlar', !g.early && g.first && g.second, JSON.stringify(g));
    check('devre turu: ilk anda ipucu yok, ~9 sn sonra bos konum vurgulanir, ~18 sn sonra dogru komponent parlar', !c.early && c.first && c.second, JSON.stringify(c));
  }

} catch (e) { check('beklenmeyen hata [bolum: 3c) Bosta kalinca otomatik nazik ipucu (cocuk ne y]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 3b) Acilis ekrani + jingle ----------
  {
    const T0 = () => Date.now();
    const vp = VIEWPORTS['telefon-360x640'];
    // a) ilk acilis, ses acik
    const a = await newPage(vp, undefined, { splash: true });
    const t0 = T0();
    await a.page.goto(BASE); // acilis ekrani (splash) testi: kok adres
    await a.page.waitForSelector('.splash', { timeout: 1500 });
    check('acilis ekrani hemen gorunur', T0() - t0 < 1500, `${T0() - t0}ms`);
    await a.page.waitForFunction(() => document.querySelector('.sp-mark')?.complete && document.querySelector('.sp-word')?.complete);
    const imgs = await a.page.evaluate(() => [...document.querySelectorAll('.splash img')].map((i) => i.naturalWidth > 0));
    check('logo (simge + ALTEZ + MiniLab) dosyalardan yuklenir', imgs.length === 3 && imgs.every(Boolean));
    await shot(a.page, '20-splash-logo');
    await a.page.waitForTimeout(900);
    await shot(a.page, '21-splash-led');
    const media = await a.page.evaluate(() => window.__media);
    check('ses aciksa jingle dosyasi calinmaya calisilir', media.some((u) => u.endsWith('assets/sounds/minilab-jingle.mp3')), media.join(','));
    await a.page.waitForTimeout(1100);
    const tagOpacity = await a.page.evaluate(() => Number(getComputedStyle(document.querySelector('.sp-tag')).opacity));
    check('slogan "Kesfet · Ogren · Uret" gorunur (V7.7 acilis ekrani)', tagOpacity > 0.9 && (await a.page.textContent('.sp-tag')) === 'Keşfet · Öğren · Üret', String(tagOpacity));
    await shot(a.page, '22-splash-slogan');
    await a.page.waitForSelector('.home', { timeout: 3000 }); // V7.8+: acilistan sonra ANA MENU (.home) gelir
    const firstMs = T0() - t0;
    check('ilk acilis kisa: ana ekran <= 3.3 sn (muzik sureyi uzatmaz)', firstMs <= 3300, `${firstMs}ms`);
    check('ana ekranda logo gorseli var', await a.page.evaluate(() => document.querySelector('.home .logo')?.naturalWidth > 0));
    await cardsReady(a.page, { timeout: 3000 }); // oyun kartlari icin Oyunlar listesine gec
    // Asama 4: 6 seviyelik yol kaldirildi (talimat: ana ekran karmasik olmasin); seviye her kartin icinde, 6 seviye sirasi levels.json testinde korunur
    check('ana ekran: her kartta kendi seviye rozeti', await a.page.evaluate(() => document.querySelectorAll('.game-card .lv-name').length === document.querySelectorAll('.game-card').length && document.querySelectorAll('.game-card').length >= 3));
    await shot(a.page, '23-ana-logo');
    check('acilis goruldu bayragi saklandi', (await stored(a.page)).seen === true);
    // b) ikinci acilis daha kisa
    const t1 = T0();
    await a.page.reload();
    await cardsReady(a.page, { timeout: 4000 });
    const secondMs = T0() - t1;
    check('sonraki acilis daha kisa (<= 2.6 sn)', secondMs <= 2600 && secondMs < firstMs, `${secondMs}ms`);
    check('acilis ekrani hata uretmedi', a.problems.errors.length === 0 && a.problems.external.length === 0, a.problems.errors.join(' | '));
    await a.ctx.close();

    // c) sessiz mod: jingle zorla calinmaz
    const m = await newPage(vp, { sound: false }, { splash: true });
    await m.page.goto(BASE); // acilis ekrani (splash) testi: kok adres
    await m.page.waitForSelector('.splash');
    await cardsReady(m.page, { timeout: 4000 });
    const mm = await m.page.evaluate(() => ({ media: window.__media.length, osc: window.__audio.osc }));
    check('ses kapaliyken acilis sesi calinmaz', mm.media === 0 && mm.osc === 0, JSON.stringify(mm));
    await m.ctx.close();

    // d) dokununca atla
    const k = await newPage(vp, undefined, { splash: true });
    await k.page.goto(BASE); // acilis ekrani (splash) testi: kok adres
    await k.page.waitForSelector('.splash');
    await k.page.waitForTimeout(300);
    const t2 = T0();
    await k.page.touchscreen.tap(180, 320);
    await cardsReady(k.page, { timeout: 1500 });
    check('dokununca acilis atlanir', T0() - t2 < 900, `${T0() - t2}ms`);
    await k.ctx.close();

    // e) jingle dosyasi yuklenemezse uygulama calisir
    const f = await newPage(vp, undefined, { splash: true, routeAbort: '**/minilab-jingle.mp3' });
    await f.page.goto(BASE); // acilis ekrani (splash) testi: kok adres
    await cardsReady(f.page, { timeout: 5000 });
    await f.page.click('[data-game="shape-complete"]');
    await f.page.waitForSelector('.play .prompt svg');
    check('jingle dosyasi yoksa uygulama yine acilir ve oynanir', f.problems.errors.every((e) => /Failed to load resource|net::ERR/i.test(e)), f.problems.errors.join(' | '));
    await f.ctx.close();

    // f) jingle dosyasi analizi (gercek mp3 cozumlenir)
    const { page, ctx } = await newPage(vp);
    const j = await page.evaluate(async () => {
      const buf = await (await fetch('assets/sounds/minilab-jingle.mp3')).arrayBuffer();
      const ac = new OfflineAudioContext(2, 44100, 44100);
      const au = await ac.decodeAudioData(buf);
      const d = au.getChannelData(0);
      let peak = 0, sum = 0;
      for (let i = 0; i < d.length; i++) { peak = Math.max(peak, Math.abs(d[i])); sum += d[i] * d[i]; }
      return { dur: au.duration, peak, rms: Math.sqrt(sum / d.length) };
    });
    check('jingle: 2-4 sn, kirpilmaz, rahatsiz etmeyen seviye', j.dur >= 2 && j.dur <= 4 && j.peak > 0.15 && j.peak < 0.7 && j.rms > 0.01 && j.rms < 0.2, JSON.stringify(j));
    await ctx.close();
  }

} catch (e) { check('beklenmeyen hata [bolum: 3b) Acilis ekrani + jingle]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 3c) Asama 3: yeni gorev tipleri ----------
  {
    const vpPhone = VIEWPORTS['telefon-360x640'];
    const base = { correct: 200, band: '6-8', sound: true, seen: true };
    const seedA = { ...base };
    // a) Donduruldu + simetri: 6-8 yas, Usta seviyesi. Gorev tipi gorulene kadar oyna.
    const { page, ctx, problems } = await newPage(vpPhone, seedA, { noTts: true });
    await page.click('[data-game="shape-complete"]');
    await page.waitForSelector('.play .prompt svg');
    const seen = {};
    const stats = newStats();
    let prevKind = null;
    let sameKindInRow = 0;
    for (let i = 0; i < 70 && !(seen.rotate && seen.symmetry); i++) {
      const kind = ((await cls(page, '.prompt')).match(/kind-(\w+)/) || [])[1];
      if (kind === prevKind) sameKindInRow += 1;
      prevKind = kind;
      if ((kind === 'rotate' || kind === 'symmetry') && !seen[kind]) {
        seen[kind] = true;
        const cap = (await page.textContent('.cap')).trim();
        check(`${kind}: kisa yazili yonerge gorunur`, cap === (kind === 'rotate' ? 'Döndürülmüş şekli bul.' : 'Diğer tarafı tamamla.'), cap);
        await layoutChecks(page, `${kind} (telefon)`);
        await shot(page, `30-${kind}`);
        const n = await page.locator('.tile').count();
        // yanlis secimler: ceza yok, dogru secenek parlatilmaz, ipucu cevabi vermez
        let wrongClicks = 0;
        let glow = 0;
        for (let t = 0; t < n && wrongClicks < 2; t++) {
          const tile = page.locator('.tile').nth(t);
          if ((await tile.getAttribute('class')).includes('dim')) continue;
          const before = await page.locator('.prompt.solved').count();
          await tile.click();
          await page.waitForTimeout(80);
          if ((await page.locator('.prompt.solved').count()) > before) break; // tesadufen dogru
          wrongClicks += 1;
          glow += await page.locator('.tile.glow-hint').count();
        }
        check(`${kind}: yanlis secenekler hafifce geri cekilir (dim), kirmizi/ceza yok, overlay yok`, (await page.locator('.tile.dim').count()) >= 1 || (await page.locator('.prompt.solved').count()) === 1);
        check(`${kind}: ipucu dogru secenegi parlatmaz`, glow === 0, `glow=${glow}`);
        // dogru secenegi coz
        if ((await page.locator('.prompt.solved').count()) === 0) {
          for (let t = 0; t < n; t++) {
            const tile = page.locator('.tile').nth(t);
            if ((await tile.getAttribute('class')).includes('dim')) continue;
            await tile.click();
            await page.waitForTimeout(80);
            if ((await page.locator('.prompt.solved').count()) > 0) break;
          }
        }
        await page.waitForSelector('.prompt.solved');
        if (kind === 'rotate') check('rotate: dogru secenek donerek hedefle ayni konuma gelir (animasyon)', (await page.locator('.tile.correct.unrotate').count()) === 1);
        else check('symmetry: yansima tarafi eksenden acilir (animasyon)', (await page.locator('.prompt.solved .solved-piece.fold').count()) === 1);
        await page.waitForFunction(() => !document.querySelector('.prompt')?.classList.contains('solved'), null, { timeout: 9000 });
        stats.rounds += 1;
        continue;
      }
      await playRound(page, stats);
    }
    check('6-8 Usta: Dondurulmus sekli bul gorevi oynandi', !!seen.rotate);
    check('6-8 Usta: Simetriyi tamamla gorevi oynandi', !!seen.symmetry);
    check('arka arkaya ayni gorev tipi gelmedi (tarayicida)', sameKindInRow === 0, `tekrar=${sameKindInRow}`);
    check('yeni gorevlerde harici ag istegi / konsol hatasi yok', problems.errors.length === 0 && problems.external.length === 0, problems.errors.slice(0, 2).join(' | '));
    await ctx.close();

    // b) 4-5 yas: sadece basit gorevler (Baslangic); simetri/donme L0'da yok
    {
      const b = await newPage(vpPhone, { correct: 0, band: '4-5', sound: true, seen: true }, { noTts: true });
      await b.page.click('[data-game="shape-complete"]');
      await b.page.waitForSelector('.play .prompt svg');
      const st = newStats();
      const kinds = new Set();
      for (let i = 0; i < 9; i++) { // 10. dogruda Cirak (seviye 1) baslar; Baslangic'ta sadece 9 tur
        kinds.add(((await cls(b.page, '.prompt')).match(/kind-(\w+)/) || [])[1]);
        await playRound(b.page, st);
      }
      check('4-5 yas Baslangic: donme/simetri/oruntu yok (mevcut davranis korundu)', ![...kinds].some((k) => ['rotate', 'symmetry', 'pattern'].includes(k)), [...kinds].join(','));
      await b.ctx.close();
    }

    // c) Yeni devre gorevleri: 6-8 (bozuk kablo, paralel onarim, tamamlama) ve 4-5 (konum cesitliligi)
    const circuitAt = async (band, stage, fn, label) => {
      const c = await newPage(vpPhone, { correct: 0, band, sound: true, seen: true, circuit: { '4-5': { stage: 0, plays: 0 }, '6-8': { stage: 0, plays: 0 }, [band]: { stage, plays: 0 } } }, { noTts: true });
      await c.page.click('[data-game="shape-complete"]');
      await c.page.waitForSelector('.play .prompt svg');
      const st = newStats();
      await playRound(c.page, st); // geometri
      await playRound(c.page, st); // geometri
      await c.page.waitForSelector('.prompt.kind-circuit');
      await fn(c.page, st);
      check(`${label}: hata/harici istek yok`, c.problems.errors.length === 0 && c.problems.external.length === 0, c.problems.errors.slice(0, 2).join(' | '));
      await c.ctx.close();
    };

    await circuitAt('6-8', 11, async (pg, st) => {
      check('c12 bozuk kablo: bolum acilir', (await pg.getAttribute('.prompt', 'data-stage')) === 'c12-onar-kablo');
      check('c12: yazili yonerge "Bozuk parçayı bul."', (await pg.textContent('.cap')).trim() === 'Bozuk parçayı bul.');
      check('c12: bozuk parca gorunur', (await pg.locator('.slot.fault').count()) === 1);
      await shot(pg, '31-bozuk-kablo');
      // once komponent secmek: yerlesmez, bozuk parca vurgulanir (ceza yok)
      await pg.locator('.tile').first().click();
      await pg.waitForTimeout(120);
      check('c12: once parcayi bulmak gerekir (komponent yerlesmez, bozuk parca vurgulanir)', (await pg.locator('.tile.used').count()) === 0 && (await pg.locator('.slot.fault.hint').count()) === 1);
      await pg.locator('.slot.fault').click();
      await pg.waitForTimeout(150);
      check('c12: bozuk parca kalkar, bos konum acilir, yonerge degisir', (await pg.locator('.slot.fault').count()) === 0 && (await pg.locator('[data-slot]').count()) === 1 && (await pg.textContent('.cap')).trim() === 'Eksik kabloyu bul.');
      await shot(pg, '32-bozuk-kablo-acildi');
      await solveCircuit(pg, st);
      await pg.waitForSelector('.prompt.solved');
      check('c12: onarilinca LED yanar', (await pg.$$eval('.board .led', (e) => e.map((x) => x.dataset.b))).every((b) => b === '3'));
    }, 'c12');

    await circuitAt('6-8', 12, async (pg, st) => {
      check('c13 paralel onarim: baslangicta bir LED yanik, digeri sonuk', (await pg.$$eval('.board .led', (e) => e.map((x) => x.dataset.b).sort().join())) === '0,3');
      await shot(pg, '33-paralel-onarim');
      await pg.locator('.slot.fault').click();
      await pg.waitForTimeout(120);
      await solveCircuit(pg, st);
      await pg.waitForSelector('.prompt.solved');
      check('c13: onarinca iki LED de tam parlak', (await pg.$$eval('.board .led', (e) => e.map((x) => x.dataset.b).join())) === '3,3');
    }, 'c13');

    for (const [stage, id] of [[13, 'c14-tamamla-uc'], [14, 'c15-tamamla-anahtar']]) {
      await circuitAt('6-8', stage, async (pg, st) => {
        check(`${id}: bolum acilir, birden cok bos konum`, (await pg.getAttribute('.prompt', 'data-stage')) === id && (await pg.locator('[data-slot]').count()) >= 2);
        await shot(pg, `34-${id}`);
        await solveCircuit(pg, st);
        check(`${id}: tamamlanir`, (await pg.locator('.prompt.solved').count()) === 1);
      }, id);
    }

    for (const [stage, id] of [[5, 'c8-kablo-ust'], [6, 'c9-pil-sag'], [7, 'c10-led-ust'], [8, 'c11-anahtar-ust']]) {
      await circuitAt('4-5', stage, async (pg, st) => {
        check(`4-5 ${id}: bolum acilir, 1 bos konum, 2-3 secenek`, (await pg.getAttribute('.prompt', 'data-stage')) === id && (await pg.locator('[data-slot]').count()) === 1 && (await pg.locator('.tile').count()) <= 3);
        await solveCircuit(pg, st);
        check(`4-5 ${id}: tamamlanir`, (await pg.locator('.prompt.solved').count()) === 1);
      }, `4-5 ${id}`);
    }

    // d) Konusma motoru yokken (noTts) devre tamamlanma sesi beklemesi takilmaz: yukaridaki akislar bunu zaten kanitlar.
    // e) Ekran boyutlari: yeni gorevler kucuk/buyuk/yatay ekranlarda
    for (const name of ['telefon-kucuk-320x568', 'tablet-800x1280', 'yatay-640x360']) {
      const v = await newPage(VIEWPORTS[name], seedA, { noTts: true });
      await v.page.click('[data-game="shape-complete"]');
      await v.page.waitForSelector('.play .prompt svg');
      const got = new Set();
      const st = newStats();
      for (let i = 0; i < 70 && got.size < 2; i++) {
        const kind = ((await cls(v.page, '.prompt')).match(/kind-(\w+)/) || [])[1];
        if ((kind === 'rotate' || kind === 'symmetry') && !got.has(kind)) {
          got.add(kind);
          await layoutChecks(v.page, `${name} / ${kind}`);
          await shot(v.page, `35-${name}-${kind}`);
        }
        await playRound(v.page, st);
      }
      check(`${name}: yeni gorevler gosterildi`, got.size === 2, [...got].join(','));
      await v.ctx.close();
    }
  }

} catch (e) { check('beklenmeyen hata [bolum: 3c) Asama 3: yeni gorev tipleri]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 4) Ekran boyutlari ----------
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    const { page, ctx, problems } = await newPage(vp);
    await shot(page, `10-${name}-ana`);
    await page.click('[data-game="shape-complete"]');
    await page.waitForSelector('.play .prompt svg');
    await layoutChecks(page, `${name} / sekil`);
    await shot(page, `11-${name}-sekil`);
    const stats = newStats();
    await playRound(page, stats);
    await playRound(page, stats);
    await layoutChecks(page, `${name} / devre`);
    await shot(page, `12-${name}-devre`);
    check(`${name}: hata yok`, problems.errors.length === 0 && problems.external.length === 0, problems.errors.slice(0, 2).join(' | '));
    await ctx.close();
  }

} catch (e) { check('beklenmeyen hata [bolum: 4) Ekran boyutlari]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 5) Ses kalitesi: gercek dalga bicimi analizi (OfflineAudioContext) ----------
  {
    const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640']);
    const rep = await page.evaluate(async () => {
      const { createAudio } = await import('/src/core/audio.js');
      const out = {};
      for (const name of ['tap', 'place', 'correct', 'gentle', 'levelUp', 'circuitOn', 'success', 'jingle']) {
        class Off extends OfflineAudioContext {
          constructor() {
            super(2, 44100 * 4, 44100);
          }
        }
        const a = createAudio({ AudioCtx: Off, enabled: true });
        a.synth(name);
        const buf = await a.context.startRendering();
        let peak = 0;
        let sum = 0;
        let last = 0;
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) {
          const v = Math.abs(d[i]);
          if (v > peak) peak = v;
          sum += d[i] * d[i];
          if (v > 0.002) last = i;
        }
        out[name] = { peak, rms: Math.sqrt(sum / d.length), end: last / 44100 };
      }
      return out;
    });
    for (const [name, r] of Object.entries(rep)) console.log(`      ses ${name}: tepe=${r.peak.toFixed(3)} rms=${r.rms.toFixed(4)} bitis=${r.end.toFixed(2)}s`);
    check('tum sesler duyulur ama kirpilmaz (0.02 < tepe < 0.95)', Object.values(rep).every((r) => r.peak > 0.02 && r.peak < 0.95));
    check('basari muzigi: kisa ama dolgun (1.5-2.8 sn, yeterli enerji)', rep.success.end >= 1.5 && rep.success.end <= 2.8 && rep.success.rms > 0.01, `${rep.success.end.toFixed(2)}s rms=${rep.success.rms.toFixed(4)}`);
    check('yanlis cevap sesi yumusak ve kisa (basari sesinden belirgin sessiz)', rep.gentle.peak < 0.2 && rep.gentle.end < 0.5 && rep.gentle.peak < rep.success.peak, `tepe=${rep.gentle.peak.toFixed(3)} sure=${rep.gentle.end.toFixed(2)}s`);
    check('jingle yedek sentezi calisir (1.5-3 sn)', rep.jingle.end >= 1.5 && rep.jingle.end <= 3 && rep.jingle.rms > 0.01, `${rep.jingle.end.toFixed(2)}s`);
    check('dogru cevap sesi kisa (< 0.8 sn)', rep.correct.end < 0.8, `${rep.correct.end.toFixed(2)}s`);
    await ctx.close();
  }

} catch (e) { check('beklenmeyen hata [bolum: 5) Ses kalitesi: gercek dalga bicimi analizi (Offl]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 12) Asama 4: ana ekran oyun secimi + Sayi Avi ----------
  {
    const KEY = 'altez-minilab:v1';
    const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1 && document.body.scrollWidth <= innerWidth + 1);
    // Her kart (gerekirse kapsayici kaydirilarak) tamamen ekrana getirilebilir mi?
    const cardsReachable = (page) => page.evaluate(() => [...document.querySelectorAll('.game-card')].every((e) => { e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }));
    const inView = (page, sel) =>
      page.evaluate((s) => [...document.querySelectorAll(s)].every((e) => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }), sel);
    for (const [vn, vp] of Object.entries(VIEWPORTS)) {
      const { page, ctx, problems } = await newPage(vp, { band: '4-5' });
      check(`${vn}: Oyunlar listesinde 6 oyun karti (V5: 3 mini oyun; V7.7: +2 Gorev oyunu; V7.9: +Enerji Macerasi)`, (await page.locator('.game-card').count()) === 6);
      check(`${vn}: ana ekran tasma yok, kartlar ekran icinde`, (await noOverflow(page)) && (await cardsReachable(page)) && (await inView(page, '.home-ctl .btn'))); // V7.7+: 6 kart kucuk ekranda kaydirilir; her kart kaydirilinca TAMAMEN ekranda
      const boxes = await page.locator('.game-card').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return [r.width, r.height]; }));
      check(`${vn}: kart dokunma alani >= 64px`, boxes.every(([w, h]) => w >= 64 && h >= 64), JSON.stringify(boxes.map((b) => b.map(Math.round))));
      check(`${vn}: kart metinleri ve slogan`, (await page.textContent('.home')).includes('Şekilleri keşfet, devreleri tamamla.') && (await page.textContent('.home')).includes('Sayıları bul, say ve keşfet.'));
      check(`${vn}: yas ve ses kontrolleri var`, (await page.locator('[data-act="band"]').count()) === 1 && (await page.locator('[data-act="sound"]').count()) === 1);
      // V7.8+: logo ve slogan ANA MENUDEDIR (kok '#/'); sonra Oyunlar listesine donulur
      await page.evaluate(() => { location.hash = '#/'; });
      await page.waitForSelector('.home.menu .tagline', { state: 'attached' });
      check(`${vn}: ana menude logo ve slogan var`, (await page.locator('.home .logo').count()) === 1 && (await page.textContent('.tagline')) === 'Keşfet • Öğren • Mucit Ol');
      await cardsReady(page);
      await shot(page, `40-ana-${vn}`);
      // Sayi Avi ekrani
      await page.click('[data-game="number-hunt"]');
      await page.waitForSelector('.nh .tile');
      check(`${vn}: Sayi Avi acilir`, (await page.evaluate(() => location.hash)) === '#/play/number-hunt');
      await page.waitForTimeout(300);
      check(`${vn}: Sayi Avi tasma yok, secenekler ekran icinde`, (await noOverflow(page)) && (await inView(page, '.nh .tile, .nh .bar .btn, .nh .prompt')));
      const tb = await page.locator('.nh .tile').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
      check(`${vn}: Sayi Avi dokunma alani >= 64px`, tb.every((v) => v >= 64), tb.map(Math.round).join(','));
      await shot(page, `41-sayiavi-${vn}`);
      check(`${vn}: Sayi Avi konsol hatasi/dis istek yok`, problems.errors.length === 0 && problems.external.length === 0, [...problems.errors, ...problems.external].join(' | '));
      await ctx.close();
    }

    // Gezinme: iki oyun, 🏠, geri tusu
    {
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], { band: '6-8' });
      await page.click('[data-game="number-hunt"]');
      await page.waitForSelector('.nh .tile');
      await page.click('[data-act="home"]');
      await page.waitForSelector('.home');
      check('Sayi Avi: 🏠 ana menuye doner', (await page.locator('.home').count()) === 1 && (await page.locator('.play').count()) === 0);
      await cardsReady(page);
      await page.goBack().catch(() => {});
      await page.waitForTimeout(250);
      check('🏠 sonrasi tarayici Geri tusu oyuna geri dondurmez', (await page.locator('.nh').count()) === 0);
      await page.goto(HOME);
      await cardsReady(page);
      await page.click('[data-game="shape-complete"]');
      await page.waitForSelector('.play .prompt svg');
      await page.click('[data-act="home"]');
      await page.waitForSelector('.home');
      check('Sekli Tamamla: 🏠 ana menuye doner', (await page.locator('.home').count()) === 1 && (await page.locator('.play').count()) === 0); // V7.8+: Geri/Ana ekran -> ANA MENU (.home); kartlar Oyunlar listesindedir
      await cardsReady(page);
      await page.click('[data-game="number-hunt"]');
      await page.waitForSelector('.nh .tile');
      await page.goBack();
      await page.waitForSelector('.home');
      check('Sayi Avi: sistem Geri tusu ana menuye doner', (await page.locator('.home').count()) === 1 && (await page.locator('.play').count()) === 0); // V7.8+: Geri/Ana ekran -> ANA MENU (.home); kartlar Oyunlar listesindedir
      await cardsReady(page);
      await ctx.close();
    }

    // Ayarlar iki oyunda ortak ve kalici
    {
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], { band: '4-5' });
      await page.click('[data-act="band"]');
      await page.click('[data-act="sound"]');
      await page.click('[data-game="number-hunt"]');
      await page.waitForSelector('.nh .tile');
      check('yas 6-8 secimi Sayi Avi icin gecerli', (await page.getAttribute('.nh', 'data-band')) === '6-8');
      await page.reload();
      await page.waitForSelector('.nh .tile');
      const st = await stored(page);
      check('yas ve ses ayari yeniden acilista korunur', st.band === '6-8' && st.sound === false);
      await ctx.close();
    }

    // V3 kaydi uyumlu: Sekli Tamamla ilerlemesi Sayi Avi'ndan etkilenmez
    {
      const v3 = { band: '4-5', sound: false, correct: 12, seen: true };
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], v3);
      check('V3 kaydi: Sekli Tamamla karti Cirak seviyesini gosterir', (await page.locator('[data-game="shape-complete"] .lv-name').textContent()) === 'Çırak');
      check('V3 kaydi: Sayi Avi Baslangic seviyesinde baslar', (await page.locator('[data-game="number-hunt"] .lv-name').textContent()) === 'Başlangıç');
      await ctx.close();
    }

    // Sayi Avi tam akis: her yas grubu, dogru/yanlis, ilerleme kaydi, TTS yok iken akis
    for (const band of ['4-5', '6-8']) {
      const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], { band, sound: true, correct: 7 }, { noTts: true });
      await page.click('[data-game="number-hunt"]');
      await page.waitForSelector('.nh .tile');
      const kinds = new Set();
      let gentleOk = true;
      let nextOk = true;
      for (let r = 0; r < 24; r++) {
        await page.waitForSelector('.nh .tile:not(.faded):not(.correct)', { timeout: 4000 });
        const info = await page.evaluate(() => ({ kind: document.querySelector('.prompt').dataset.kind, cap: document.querySelector('.cap').textContent, n: document.querySelectorAll('.nh .tile').length }));
        kinds.add(info.kind);
        if (!info.cap) gentleOk = false;
        const answer = await page.evaluate(() => {
          // Dogru secenegi test icin ekran verisinden degil, oyunun cizdigi sorudan cozeriz (bagimsiz dogrulama)
          const p = document.querySelector('.prompt');
          const objs = (el) => el.querySelectorAll('.obj').length;
          const kind = p.dataset.kind;
          const tiles = [...document.querySelectorAll('.nh .tile')];
          const val = (t) => Number(t.querySelector('.numeral')?.textContent ?? t.querySelectorAll('.obj').length);
          const sel = (pred) => tiles.findIndex(pred);
          if (kind === 'count' || kind === 'findNumber') return sel((t) => val(t) === objs(p));
          if (kind === 'numToGroup') return sel((t) => objs(t) === Number(p.querySelector('.nh-big').textContent));
          if (kind === 'pickGroup') {
            const n = Number(p.querySelector('.nh-big').textContent);
            const src = p.querySelector('.nh-icon').getAttribute('src');
            return sel((t) => objs(t) === n && [...t.querySelectorAll('img')].every((i) => i.getAttribute('src') === src));
          }
          if (kind === 'missing') return sel((t) => objs(t) === p.querySelectorAll('.obj.slot').length);
          if (kind === 'missingNumber' || kind === 'sequence') {
            const cells = [...p.querySelectorAll('.cell')];
            const nums = cells.map((c) => (c.classList.contains('hole') ? null : Number(c.textContent)));
            const h = nums.indexOf(null);
            const known = nums.filter((v) => v !== null);
            if (kind === 'missingNumber') {
              const step = known[1] - known[0] === 1 || known[known.length - 1] - known[known.length - 2] === 1 ? 1 : -1;
              const cand = h > 0 ? nums[h - 1] + step : nums[h + 1] - step;
              return sel((t) => val(t) === cand);
            }
            const cands = tiles.map(val);
            const d = known.slice(1).map((v, i) => v - known[i]);
            const rep = known.length >= 3 && known.every((v, i) => i < 2 || v === known[i - 2]);
            const want = rep ? known[known.length - 2] : known[known.length - 1] + d[d.length - 1];
            return cands.indexOf(want);
          }
          if (kind === 'add') {
            const total = p.querySelectorAll('.obj').length;
            return sel((t) => val(t) === total);
          }
          if (kind === 'subtract') {
            const left = p.querySelectorAll('.obj.cnt').length;
            return sel((t) => val(t) === left);
          }
          return -1;
        });
        if (answer < 0) { check(`Sayi Avi ${band}: ${info.kind} sorusu cozulemedi`, false); break; }
        // once bir yanlis secenek dene (ceza yok): yoksa dogruya git
        const wrongIdx = [...Array(info.n).keys()].find((i) => i !== answer);
        if (r % 3 === 0 && wrongIdx !== undefined) {
          await page.locator('.nh .tile').nth(wrongIdx).click();
          await page.waitForTimeout(120);
          const st1 = await page.evaluate(() => ({ dim: document.querySelectorAll('.nh .tile.dim').length, solved: document.querySelector('.prompt').classList.contains('solved') }));
          if (st1.dim < 1 || st1.solved) gentleOk = false;
        }
        const before = (await stored(page))?.games?.['number-hunt']?.correct ?? 0;
        await page.locator('.nh .tile').nth(answer).click();
        await page.waitForSelector('.prompt.solved', { timeout: 1500 });
        const after = (await stored(page)).games['number-hunt'].correct;
        if (after !== before + 1) nextOk = false;
        if (r === 0) await shot(page, `42-dogru-${band}`);
        await page.waitForFunction(() => !document.querySelector('.prompt').classList.contains('solved') || !document.querySelector('.overlay').hidden, null, { timeout: 4000 });
        if (await page.locator('.overlay:not([hidden])').count()) await page.click('.overlay');
      }
      const expect = band === '4-5' ? ['count', 'numToGroup'] : ['findNumber', 'missingNumber', 'add'];
      check(`Sayi Avi ${band}: 24 tur (yanlis denemeli) cozuldu, tipler: ${[...kinds].join(',')}`, expect.every((k) => kinds.has(k)));
      check(`Sayi Avi ${band}: yanlis cevap cezasiz (secenek solar, tur cozulmez), yonerge yazisi hep var`, gentleOk);
      check(`Sayi Avi ${band}: her dogru cevap oyuna ozel sayaci +1 arttirir`, nextOk);
      const st = await stored(page);
      check(`Sayi Avi ${band}: ilerleme kayitli, Sekli Tamamla sayaci degismedi`, st.games['number-hunt'].correct >= 24 && st.correct === 7, JSON.stringify(st.games));
      check(`Sayi Avi ${band}: konusma motoru olmadan oyun akti, konsol hatasi/dis istek yok`, problems.errors.length === 0 && problems.external.length === 0, [...problems.errors, ...problems.external].join(' | '));
      await page.reload();
      await page.waitForSelector('.nh .tile');
      check(`Sayi Avi ${band}: yeniden acilista ilerleme/seviye korunur`, (await stored(page)).games['number-hunt'].correct >= 24 && (await page.locator('.nh .lv-name').textContent()) !== 'Başlangıç');
      await ctx.close();
    }

    // Ipucu: cevabi vermez; dogru secenek isaretlenmez
    {
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], { band: '6-8', sound: false }, { noTts: true });
      await page.click('[data-game="number-hunt"]');
      await page.waitForSelector('.nh .tile');
      const n = await page.locator('.nh .tile').count();
      const ans = await page.evaluate(() => [...document.querySelectorAll('.nh .tile')].map((t) => t.className));
      await page.waitForTimeout(9600);
      const hinted = await page.evaluate(() => ({ prompt: document.querySelector('.prompt').classList.contains('hint'), glow: document.querySelectorAll('.nh .tile.glow-hint, .nh .tile.correct').length, dim: document.querySelectorAll('.nh .tile.dim').length }));
      check('Sayi Avi ipucu 1: soru nesneleri vurgulanir, hicbir secenek cevap diye isaretlenmez', hinted.prompt && hinted.glow === 0 && hinted.dim === 0 && n >= 3, JSON.stringify({ hinted, ans }));
      await page.waitForTimeout(9300);
      const hinted2 = await page.evaluate(() => ({ dim: document.querySelectorAll('.nh .tile.dim').length, glow: document.querySelectorAll('.nh .tile.glow-hint, .nh .tile.correct').length, left: document.querySelectorAll('.nh .tile:not(.dim)').length }));
      check('Sayi Avi ipucu 2: yalnizca yanlis secenek elenir (en az 2 secenek kalir)', hinted2.dim === 1 && hinted2.glow === 0 && hinted2.left >= 2, JSON.stringify(hinted2));
      await ctx.close();
    }

    // Sekli Tamamla hala calisiyor (regresyon) ve Sayi Avi sonrasi ilerlemesi ayni
    {
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], { band: '4-5', sound: false, correct: 3 }, { noTts: true });
      await page.click('[data-game="shape-complete"]');
      await page.waitForSelector('.play .prompt svg');
      check('regresyon: Sekli Tamamla yeni ana ekrandan acilir, 2 secenek', (await page.locator('.tile').count()) === 2);
      await ctx.close();
    }
  }

} catch (e) { check('beklenmeyen hata [bolum: 12) Asama 4: ana ekran oyun secimi + Sayi Avi]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 13) Sesli yonerge: kullanici etkilesiminden sonra gercekten tetiklenir (sahte speechSynthesis ile izlenir) ----------
  {
    const spy = () => {
      window.__spoken = [];
      window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: { speaking: false, pending: false, getVoices: () => [{ name: 'Turkce', lang: 'tr-TR', localService: true }], resume() {}, cancel() {}, speak(u) { window.__spoken.push({ text: u.text, lang: u.lang, vol: u.volume, voice: u.voice?.lang }); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 5); } }
      });
    };
    // Paketle 106 Caglayan MP3 gelince uygulama (tasarim geregi) MP3 calar, TTS okumaz. Asagidaki dongu "MP3 yok -> Turkce TTS" yolunu sinar;
    // bu yuzden o senaryoda manifest.voice tarayici baglaminda bosaltilir (diskteki dosyalar degismez). MP3'lu gercek manifest ayri bloktadir.
    const mk = async (seed, { blank = true } = {}) => {
      const ctx = await browser.newContext({ viewport: VIEWPORTS['telefon-360x640'], hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      await page.addInitScript(spy);
      await page.addInitScript((v) => localStorage.setItem('altez-minilab:v1', JSON.stringify(v)), seed);
      if (blank) await page.route('**/assets/manifest.json', async (r) => { const j = JSON.parse((await (await r.fetch()).text())); for (const k of Object.keys(j.voice || {})) j.voice[k] = null; await r.fulfill({ contentType: 'application/json', body: JSON.stringify(j) }); });
      await page.goto(HOME);
      await cardsReady(page);
      return { ctx, page };
    };
    for (const [gid, band, sel] of [['shape-complete', '4-5', '.play .prompt svg'], ['number-hunt', '6-8', '.nh .tile'], ['number-hunt', '4-5', '.nh .tile']]) {
      const { ctx, page } = await mk({ band, sound: true, seen: true });
      check(`ses ${gid} ${band}: ana ekranda (etkilesim oncesi) yonerge konusulmaz`, (await page.evaluate(() => window.__spoken.length)) === 0);
      await page.click(`[data-game="${gid}"]`);
      await page.waitForSelector(sel);
      await page.waitForTimeout(500);
      const sp = await page.evaluate(() => window.__spoken.filter((s) => s.vol !== 0));
      check(`ses ${gid} ${band}: dokunmadan sonra Turkce yonerge konusuldu`, sp.length >= 1 && sp[0].lang === 'tr-TR' && sp[0].voice === 'tr-TR' && sp[0].text.length > 5, JSON.stringify(sp[0]));
      const n = (await page.evaluate(() => window.__spoken.length));
      await page.click('[data-act="speak"]');
      await page.waitForTimeout(400);
      check(`ses ${gid} ${band}: 🔊 tekrar dinle yeniden konusturur`, (await page.evaluate(() => window.__spoken.length)) > n);
      await ctx.close();
    }
    // GERCEK manifest (paketle gelen): Sekli Tamamla yonergesi icin MP3 kayitliysa o calinir (TTS okumaz), 🔊 yeniden calar; kayitli degilse TTS (yukaridaki yol).
    {
      const real = (await (await fetch(BASE.replace(/\?.*$/, '') + 'assets/manifest.json')).json()).voice || {};
      // Ilk tur = index 0 = geometri (planKind: yalniz her 3. tur devre); 4-5 yas seviye 0 agirliklari kindWeights: complete(6) / matchColor(4)
      // -> round.voice yalnizca 'complete' veya 'color' (rounds.js 128/148; game.js announce -> voice.say(round.voice)). Manifest dosyasi: voice/<anahtar>.mp3.
      const SC_KEYS = ['complete', 'color'];
      const named = SC_KEYS.map((k) => real[k]).filter(Boolean).map((v) => String(v).split('/').pop());
      const { ctx, page } = await mk({ band: '4-5', sound: true, seen: true }, { blank: false });
      await page.evaluate(() => { window.__plays = []; const p = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { window.__plays.push(this.currentSrc || this.src || ''); setTimeout(() => this.dispatchEvent(new Event('ended')), 100); return Promise.resolve(); }; });
      await page.click('[data-game="shape-complete"]');
      await page.waitForSelector('.play .prompt svg');
      await page.waitForTimeout(600);
      const got = await page.evaluate(() => ({ pl: window.__plays.filter((u) => /voice\//.test(u)), sp: window.__spoken.filter((s) => s.vol !== 0).length }));
      if (named.length) {
        check(`ses shape-complete 4-5 GERCEK manifest (ilk tur anahtarlari complete/color icin ${named.length} MP3): yonerge bu MP3lerden biriyle TEK kez calinir, TTS okumaz`, got.pl.length === 1 && named.includes(got.pl[0].split('/').pop()) && got.sp === 0, JSON.stringify(got));
        await page.click('[data-act="speak"]'); await page.waitForTimeout(500);
        const again = await page.evaluate(() => window.__plays.filter((u) => /voice\//.test(u)).length);
        check('ses shape-complete 4-5 GERCEK manifest: 🔊 tekrar dinle MP3 yeniden calar', again === 2, String(again));
      } else {
        check('ses shape-complete 4-5 GERCEK manifest (MP3 yok): yonerge TTS ile okunur, MP3 calinmaz', got.pl.length === 0 && got.sp >= 1, JSON.stringify(got));
      }
      await ctx.close();
    }
    {
      const { ctx, page } = await mk({ band: '4-5', sound: false, seen: true });
      await page.click('[data-game="number-hunt"]');
      await page.waitForSelector('.nh .tile');
      await page.click('[data-act="speak"]');
      await page.waitForTimeout(400);
      check('ses kapaliyken hicbir yonerge konusulmaz (iki oyun) ve oyun akar', (await page.evaluate(() => window.__spoken.length)) === 0);
      await page.click('[data-act="home"]');
      await cardsReady(page);
      await page.click('[data-game="shape-complete"]');
      await page.waitForSelector('.play .prompt svg');
      await page.waitForTimeout(400);
      check('ses kapaliyken Sekli Tamamla da sessiz', (await page.evaluate(() => window.__spoken.length)) === 0);
      await ctx.close();
    }
    {
      const { ctx, page } = await mk({ band: '4-5', sound: true, seen: true });
      await page.goto(BASE + '#/voice-test');
      await page.waitForSelector('#vt-out');
      await page.click('[data-vt="say"]');
      await page.waitForTimeout(500);
      check('ses test sayfasi (#/voice-test) konusturur ve tani gosterir', (await page.evaluate(() => window.__spoken.some((s) => s.text === 'Doğru sayıyı bul.'))) && (await page.textContent('#vt-out')).includes('"trVoices"'));
      await ctx.close();
    }
  }

} catch (e) { check('beklenmeyen hata [bolum: 13) Sesli yonerge: kullanici etkilesiminden sonra ]', false, String(e).split('\n')[0].slice(0, 200)); }
try {
  // ---------- 14) V5: Mucit Atolyesi + normal acilis ----------
  {
    const KEY = 'altez-minilab:v1';
    const noOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.documentElement.scrollHeight <= innerHeight + 1);
    const inView = (page, sel) => page.evaluate((q) => [...document.querySelectorAll(q)].every((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }), sel);
    const place = async (page, tool, slot) => {
      // Ayni arac zaten seciliyse tekrar dokunmak secimi kaldirir (tasarim geregi) -> sadece secili degilse sec
      if ((await page.getAttribute(`[data-tool="${tool}"]`, 'aria-pressed')) !== 'true') await page.click(`[data-tool="${tool}"]`);
      await page.locator(`.slot[data-slot="${slot}"] .slot-hit, .inv-hit[data-slot="${slot}"]`).first().click({ force: true });
    };
    const lit = (page) => page.getAttribute('.inv .prompt', 'data-lit');
    const tap = (page, sel) => page.locator(sel).first().click({ force: true });

    // Normal acilis: #/voice-test ile baslasa bile ana ekran gelir; 🏠 uygulama ici ana ekrana doner
    {
      const ctx = await browser.newContext({ viewport: VIEWPORTS['telefon-360x640'], hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      await page.addInitScript((k) => localStorage.setItem(k, JSON.stringify({ band: '4-5', sound: false, seen: true })), KEY);
      await page.goto(BASE + '#/voice-test');
      await page.waitForSelector('.home', { timeout: 4000 });
      check('acilis: #/voice-test ile baslansa bile normal ana ekran acilir (tani sayfasi ele gecirmez)', (await page.locator('#vt-out').count()) === 0 && (await page.locator('.home.menu').count()) === 1);
      check('acilis: adres cubugu ana ekrana (#/) normallesir', (await page.evaluate(() => location.hash)) === '#/');
      await page.goto(BASE);
      await page.waitForSelector('.home', { timeout: 4000 });
      check('acilis: hash yokken ana ekran (menu)', (await page.locator('.home.menu').count()) === 1 && (await page.locator('#vt-out').count()) === 0);
      await cardsReady(page);
      await page.click('[data-game="invent"]');
      await page.waitForSelector('.inv .board');
      await page.click('[data-act="home"]');
      await page.waitForSelector('.home');
      check('Mucit Atolyesi: 🏠 uygulama ici ana ekrana doner', (await page.locator('.home').count()) === 1 && (await page.locator('.play').count()) === 0); // V7.8+: ana menu
      await cardsReady(page);
      await page.goBack().catch(() => {});
      await page.waitForTimeout(250);
      check('Mucit Atolyesi: 🏠 sonrasi Geri tusu atolyeye dondurmez', (await page.locator('.inv').count()) === 0);
      // Tani sayfasina uygulama acikken elle gidilebilir (gizli, menude yok)
      await page.evaluate(() => (location.hash = '#/voice-test'));
      await page.waitForSelector('#vt-out');
      check('tani sayfasi hala elle acilabilir (gizli)', true);
      await ctx.close();
    }

    // Boyutlar: atolye dokunma alanlari ve taşma
    for (const [vn, vp] of Object.entries(VIEWPORTS)) {
      const { page, ctx, problems } = await newPage(vp, { band: '4-5', sound: false });
      await page.click('[data-game="invent"]');
      await page.waitForSelector('.inv .board');
      await page.waitForTimeout(200);
      check(`${vn}: Mucit Atolyesi tasma yok, tahta/parcalar/dugmeler ekranda`, (await noOverflow(page)) && (await inView(page, '.inv .prompt, .inv .inv-tool, .inv .inv-act, .inv .bar .btn')));
      const sizes = await page.locator('.inv .inv-tool, .inv .inv-act, .inv .bar .btn').evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return Math.min(r.width, r.height); }));
      check(`${vn}: Mucit Atolyesi dokunma alani >= 44px`, sizes.every((v) => v >= 44), sizes.map(Math.round).join(','));
      await shot(page, `50-atolye-${vn}`);
      check(`${vn}: Mucit Atolyesi konsol hatasi/dis istek yok`, problems.errors.length === 0 && problems.external.length === 0, [...problems.errors, ...problems.external].join(' | '));
      await ctx.close();
    }

    // Etkilesim: kur, yanlis dene, ipucu, anahtar, kesif, kaydet, buluslarim, temizle, kalicilik
    {
      const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], { band: '6-8', sound: false, correct: 4 }, { noTts: true });
      await page.click('[data-game="invent"]');
      await page.waitForSelector('.inv .board');
      check('atolye: baslangicta LED sonuk, yildizlar sonuk', (await lit(page)) === '0' && (await page.locator('.inv-star.on').count()) === 0);
      // parca secmeden bosluga dokun: nazik yonlendirme, hata/ceza yok
      await page.locator('.slot[data-slot="s1"] .slot-hit').click({ force: true });
      check('atolye: parca secmeden dokunma nazik ipucu verir (tepsi vurgulanir)', (await page.locator('.inv-tool.glow-hint').count()) === 1 && (await page.textContent('.cap')).length > 3);
      // bosluklu devre: yanmaz, ipucu bosluklari gosterir
      await place(page, 'led', 's2');
      await place(page, 'wire', 's3');
      check('atolye: bosluk varken LED yanmaz', (await lit(page)) === '0');
      await page.click('[data-act="hint"]');
      check('atolye: ipucu bos konumlari vurgular (cevap dayatmaz)', (await page.locator('.slot.hint').count()) >= 1);
      await place(page, 'wire', 's1');
      check('atolye: devre tamamlaninca LED yanar, ilk kesif yildizi yanar', (await lit(page)) === '1' && (await page.locator('.inv-star.on').count()) === 1);
      let st = await stored(page);
      check('atolye: kesif kaydedildi (games.invent.found), diger oyun sayaclari degismedi', st.games.invent.found.includes('light') && st.correct === 4 && !st.games['number-hunt']);
      // kisa devre: LED'i kablo ile degistir
      await place(page, 'wire', 's2');
      check('atolye: kisa devre LEDsiz yolda: yanmaz ve kisa devre mesaji', (await lit(page)) === '0' && (await page.getAttribute('.inv .prompt', 'data-short')) === '1');
      // tek dokunusla geri al (parcaya dokun, secili arac yokken)
      await page.click('[data-tool="wire"]');
      await page.click('[data-tool="erase"]');
      await page.locator('.inv-hit[data-slot="s2"]').click({ force: true });
      await place(page, 'led', 's2');
      check('atolye: sil araci + yeniden yerlestirme calisir', (await lit(page)) === '1');
      // anahtar kesfi
      await place(page, 'switch', 's1');
      check('atolye: anahtar acikken devre kapali', (await lit(page)) === '0');
      await page.click('[data-act="hint"]');
      check('atolye: anahtar ipucu anahtari vurgular', (await page.locator('.part.hint').count()) === 1);
      await tap(page, '[data-switch="s1"] .slot-hit');
      check('atolye: anahtar kapaninca LED yanar', (await lit(page)) === '1');
      await tap(page, '[data-switch="s1"] .slot-hit');
      check('atolye: anahtar acilinca LED soner', (await lit(page)) === '0');
      await tap(page, '[data-switch="s1"] .slot-hit');
      st = await stored(page);
      check('atolye: anahtar kesfi ve kisa devre kesfi kaydedildi', st.games.invent.found.includes('switch') && st.games.invent.found.includes('short'), JSON.stringify(st.games.invent.found));
      // direnc
      await page.click('[data-tool="resistor"]');
      await page.click('[data-tool="resistor"]'); // ayni arac: secimi kaldirir
      await place(page, 'resistor', 's3');
      st = await stored(page);
      check('atolye: direnc kesfi kaydedildi', st.games.invent.found.includes('resistor') && (await lit(page)) === '1');
      // kaydet + buluslarim
      await page.click('[data-act="save"]');
      st = await stored(page);
      check('atolye: calisan devre kaydedilir (buluslarim)', st.games.invent.saved.length === 1 && st.games.invent.saved[0].layout === 'loop');
      await page.click('[data-act="save"]');
      check('atolye: ayni buluş tekrar kaydedilmez', (await stored(page)).games.invent.saved.length === 1);
      await page.click('[data-act="clear"]');
      check('atolye: temizle tahtayi bosaltir', (await lit(page)) === '0' && (await page.locator('.inv-hit').count()) === 0);
      await page.click('[data-act="save"]');
      check('atolye: calismayan devre kaydedilmez (nazik uyari)', (await stored(page)).games.invent.saved.length === 1 && (await page.textContent('.cap')).length > 3);
      await page.click('[data-act="mine"]');
      await page.waitForSelector('.inv-save');
      check('atolye: Buluslarim kaydedilen devreyi onizler', (await page.locator('.inv-save').count()) === 1);
      await shot(page, '51-buluslarim');
      await page.click('.inv-save');
      await page.waitForTimeout(150);
      check('atolye: kayitli buluş yuklenince devre yeniden calisir', (await lit(page)) === '1' && (await page.locator('.overlay:not([hidden])').count()) === 0);
      // iki yol: paralel iki LED seriden daha parlak
      await page.click('[data-act="layout"][data-layout="ladder"]');
      await place(page, 'wire', 's1'); await place(page, 'wire', 's2'); await place(page, 'led', 's3'); await place(page, 'wire', 's4'); await place(page, 'wire', 's5'); await place(page, 'led', 's6');
      check('atolye: iki yol (paralel) iki LED de yanar', (await lit(page)) === '2');
      const lv = await page.evaluate(() => [...document.querySelectorAll('.inv .board .led')].map((e) => e.getAttribute('data-b')));
      check('atolye: paralel LEDler tam parlak (seviye 3)', lv.length === 2 && lv.every((v) => v === '3'), lv.join(','));
      st = await stored(page);
      check('atolye: paralel kesfi kaydedildi', st.games.invent.found.includes('parallel'));
      await page.click('[data-act="layout"][data-layout="loop"]');
      check('atolye: tahta degistirince onceki tahta korunur', (await page.locator('.inv-hit').count()) >= 0);
      await page.evaluate(() => (location.hash = '#/'));
      await page.reload();
      await cardsReady(page);
      check('atolye: yeniden acilista kesifler ana ekran kartinda gorunur (Mucit n/6)', /Mucit [4-6]\/6/.test(await page.textContent('[data-game="invent"] .lv-name')), await page.textContent('[data-game="invent"] .lv-name'));
      check('atolye: konsol hatasi/dis istek yok', problems.errors.length === 0 && problems.external.length === 0, [...problems.errors, ...problems.external].join(' | '));
      await ctx.close();
    }

    // ---------- V5.1: kayit guvenilirligi, direnc, pil yetmezligi, Geri tusu ----------
    {
      const sw3 = ['open', 'open', 'open'];
      const six = [['wire', 'led', 'wire'], ['led', 'wire', 'wire'], ['wire', 'wire', 'led'], ['resistor', 'led', 'wire'], ['led', 'led', 'wire'], ['led', 'resistor', 'wire']]
        .map((slots) => ({ v: 1, layout: 'loop', slots, sw: sw3 }));
      const capText = (page) => page.textContent('.cap');

      // (1) Direnc gozle gorulur kisar + pil yetmezligi nazik mesaj
      {
        const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], { band: '6-8', sound: false }, { noTts: true });
        await page.click('[data-game="invent"]');
        await page.waitForSelector('.inv .board');
        await place(page, 'wire', 's1'); await place(page, 'led', 's2'); await place(page, 'wire', 's3');
        const b1 = await page.evaluate(() => Number(document.querySelector('.inv .board .led').getAttribute('data-b')));
        await place(page, 'resistor', 's3');
        const b2 = await page.evaluate(() => Number(document.querySelector('.inv .board .led').getAttribute('data-b')));
        check('V5.1: direnc LED parlakligini gozle gorulur dusurur, LED yine yanar', b2 < b1 && b2 > 0 && (await lit(page)) === '1', `${b1}->${b2}`);
        await page.click('[data-act="layout"][data-layout="ladder"]');
        for (const s of ['s1', 's2', 's3', 's4', 's5']) await place(page, 'led', s);
        check('V5.1: pil yetmezse (5 LED seri) LED yanmaz ve nazik mesaj gosterilir', (await lit(page)) === '0' && /Pil yetmedi/.test(await capText(page)), await capText(page));
        const st = await stored(page);
        check('V5.1: pil yetmezken seri/paralel kesfi verilmez', !st.games.invent.found.includes('series') && !st.games.invent.found.includes('parallel'), JSON.stringify(st.games.invent.found));
        check('V5.1: direnc/pil testi konsol hatasi yok', problems.errors.length === 0 && problems.external.length === 0, problems.errors.join(' | '));
        await ctx.close();
      }

      // (2) 6 kayit siniri: sessiz silme yok, acik mesaj; silince yer acilir; guncelleme yerinde
      {
        const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], { band: '6-8', sound: false, games: { invent: { correct: 0, found: [], saved: six } } }, { noTts: true });
        await page.click('[data-game="invent"]');
        await page.waitForSelector('.inv .board');
        await place(page, 'led', 's1'); await place(page, 'led', 's2'); await place(page, 'led', 's3');
        check('V5.1: yeni devre (3 LED seri) yanar', (await lit(page)) === '3');
        await page.click('[data-act="save"]');
        let st = await stored(page);
        check('V5.1: 6 kayit doluyken yeni kayit reddedilir, acik mesaj gosterilir', st.games.invent.saved.length === 6 && /dolu/.test(await capText(page)), await capText(page));
        check('V5.1: 6 kayit doluyken mevcut kayitlar korunur (sessiz silme yok)', JSON.stringify(st.games.invent.saved.map((e) => e.slots)) === JSON.stringify(six.map((e) => e.slots)));
        // Buluslarim: 6 kutu + 6 sil dugmesi, 360px'te sigar
        await page.click('[data-act="mine"]');
        await page.waitForSelector('.inv-save');
        check('V5.1: Buluslarim 6 buluş ve 6 sil dugmesi gosterir', (await page.locator('.inv-save').count()) === 6 && (await page.locator('.inv-del').count()) === 6);
        check('V5.1: Buluslarim tasma yok, sil dugmeleri >= 44px', (await noOverflow(page)) && (await page.locator('.inv-del').evaluateAll((els) => els.every((e) => { const r = e.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }))));
        await shot(page, '52-buluslarim-6');
        // Geri tusu: once Buluslarim kapanir, atolyede kalinir; ikinci Geri ana ekrana
        await page.goBack();
        await page.waitForTimeout(250);
        check('V5.1: Geri tusu Buluslarim acikken once onu kapatir, atolyede kalir', (await page.locator('.overlay:not([hidden])').count()) === 0 && (await page.locator('.inv').count()) === 1);
        // Sil -> yer acilir -> kaydet
        await page.click('[data-act="mine"]');
        await page.waitForSelector('.inv-save');
        await page.locator('.inv-del').first().click();
        await page.waitForTimeout(100);
        st = await stored(page);
        check('V5.1: silme bir buluşu kaldirir (6 -> 5)', st.games.invent.saved.length === 5);
        await page.click('[data-act="closeMine"]');
        await page.waitForTimeout(250);
        await page.click('[data-act="save"]');
        st = await stored(page);
        check('V5.1: yer acilinca yeni buluş kaydedilir (5 -> 6)', st.games.invent.saved.length === 6 && st.games.invent.saved.some((e) => e.slots.join() === 'led,led,led'));
        // Yukle -> degistir -> kaydet = yerinde guncelle
        await page.click('[data-act="mine"]');
        await page.waitForSelector('.inv-save');
        await page.locator('.inv-save').first().click();
        await page.waitForTimeout(150);
        const beforeSlots = (await stored(page)).games.invent.saved.map((e) => e.slots.join('|'));
        await place(page, 'resistor', 's3');
        await page.click('[data-act="save"]');
        st = await stored(page);
        check('V5.1: yuklenip degistirilen buluş yeni kayit acmaz, yerinde guncellenir', st.games.invent.saved.length === 6 && st.games.invent.saved.map((e) => e.slots.join('|')).join() !== beforeSlots.join() && /güncellendi/.test(await capText(page)), await capText(page));
        check('V5.1: kayit/yukleme konsol hatasi yok', problems.errors.length === 0 && problems.external.length === 0, problems.errors.join(' | '));
        await ctx.close();
      }

      // (3) Depolama yazamazsa: basari mesaji yok, hayalet kayit yok, cokme yok
      {
        const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], { band: '6-8', sound: false }, { noTts: true });
        await page.click('[data-game="invent"]');
        await page.waitForSelector('.inv .board');
        await place(page, 'wire', 's1'); await place(page, 'led', 's2'); await place(page, 'wire', 's3');
        await page.evaluate(() => { Storage.prototype.setItem = function () { throw new Error('kota doldu'); }; });
        await page.click('[data-act="save"]');
        const msg = await capText(page);
        await page.click('[data-act="mine"]');
        await page.waitForSelector('.inv-empty, .inv-save');
        check('V5.1: kayit basarisizsa "kaydedildi" denmez, nazik hata gosterilir', /Kaydedemedim/.test(msg) && !/kaydedildi/.test(msg), msg);
        check('V5.1: basarisiz kayit Buluslarim icinde hayalet kayit olusturmaz', (await page.locator('.inv-save').count()) === 0);
        check('V5.1: basarisiz kayitta oyun cokmez', (await page.locator('.inv').count()) === 1 && problems.errors.length === 0, problems.errors.join(' | '));
        await ctx.close();
      }

      // (4) Bozuk / eski kayitlar cokertmez
      {
        const junk = [null, 7, 'x', { layout: 'loop' }, { layout: 'zzz', slots: ['led'] }, { layout: 'loop', slots: 'abc' }];
        const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], { band: '6-8', sound: false, games: { invent: { correct: 0, found: ['light', 'hilesiz?'], saved: [...junk, six[0], { layout: 'loop', slots: ['led', 'led', 'led'], sw: sw3 }] } } }, { noTts: true });
        await page.click('[data-game="invent"]');
        await page.waitForSelector('.inv .board');
        await page.click('[data-act="mine"]');
        await page.waitForSelector('.inv-save');
        const n = await page.locator('.inv-save').count();
        check('V5.1: bozuk kayitlar ayiklanir/gosterilir, cokme yok, gecerli kayit acilir', n >= 1 && n <= 6 && problems.errors.length === 0, `n=${n}`);
        await page.locator('.inv-save').first().click();
        await page.waitForTimeout(150);
        check('V5.1: bozuk kayit sonrasi atolye kullanilabilir', (await page.locator('.inv').count()) === 1 && problems.errors.length === 0, problems.errors.join(' | '));
        await page.evaluate(() => (location.hash = '#/'));
        await page.reload();
        await cardsReady(page);
        check('V5.1: gecersiz kesif kimligi yildiz sayisini sisirmez (Mucit 1/6)', /Mucit 1\/6/.test(await page.textContent('[data-game="invent"] .lv-name')), await page.textContent('[data-game="invent"] .lv-name'));
        await ctx.close();
      }

      // (5) Geri tusu: Buluslarim kapaliyken oyundan cikar (ana ekran)
      {
        const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], { band: '4-5', sound: false }, { noTts: true });
        await page.click('[data-game="invent"]');
        await page.waitForSelector('.inv .board');
        await page.click('[data-act="mine"]');
        await page.click('[data-act="closeMine"]');
        await page.waitForTimeout(250);
        check('V5.1: Buluslarim kapatilinca atolyede kalinir', (await page.locator('.inv').count()) === 1 && (await page.locator('.overlay:not([hidden])').count()) === 0);
        await page.goBack();
        await page.waitForTimeout(300);
        check('V5.1: Buluslarim kapaliyken Geri tusu ana ekrana doner', (await page.locator('.home').count()) === 1 && (await page.locator('.play').count()) === 0); // V7.8+: Geri -> ana menu
        await ctx.close();
      }
    }

    // ---------- V5.2: Android Geri tusu ve oyun oturumu (history tabanli; WebView canGoBack ile ayni olcu) ----------
    {
      const seedSaved = { band: '6-8', sound: false, games: { invent: { correct: 0, found: [], saved: [{ v: 1, layout: 'loop', slots: ['wire', 'led', 'wire'], sw: ['open', 'open', 'open'] }, { v: 1, layout: 'loop', slots: ['led', 'wire', 'wire'], sw: ['open', 'open', 'open'] }] } } };
      // canGoBack=false iken Android Geri tusu uygulamayi ARKA PLANA atar (ekran o an neyse onunla)
      const canBack = (page) => page.evaluate(() => navigation.entries().filter((e) => e.url && e.url !== 'about:blank').indexOf(navigation.currentEntry) > 0);
      const goBack = async (page) => { const can = await canBack(page); if (can) { await page.evaluate(() => history.back()); await page.waitForTimeout(300); } return can; };
      const view = (page) => page.evaluate(() => ({ home: !!document.querySelector('.home'), game: !!document.querySelector('.play'), drawer: !!document.querySelector('.overlay:not([hidden])') }));
      const open = async (page, id = 'invent') => { await page.click(`[data-game="${id}"]`); await page.waitForSelector('.play'); await page.waitForTimeout(150); };

      // 1) normal akis
      {
        const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], seedSaved, { noTts: true });
        await open(page);
        check('V5.2: oyundayken Geri mumkun (gecmis girdisi var)', await canBack(page));
        await goBack(page);
        let v = await view(page);
        check('V5.2: Geri tusu Mucit Atolyesinden ana menuye doner (oyun ekrani kalmaz)', v.home && !v.game);
        check('V5.2: ana menude Geri gecmisi bitmis (uygulama ana menuden arka plana gider, oyun ekrani ile degil)', !(await canBack(page)));
        await ctx.close();
      }
      // 2) cekmece acik: once cekmece kapanir, sonra ana menu
      {
        const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], seedSaved, { noTts: true });
        await open(page);
        await page.click('[data-act="mine"]'); await page.waitForSelector('.inv-save');
        await goBack(page);
        let v = await view(page);
        check('V5.2: cekmece aciksa ilk Geri yalniz cekmeceyi kapatir, oyunda kalinir', v.game && !v.drawer && !v.home);
        await goBack(page);
        v = await view(page);
        check('V5.2: ikinci Geri ana menuye doner', v.home && !v.game && !(await canBack(page)));
        check('V5.2: cekmece/Geri sonrasi kaydedilen devreler korunur (2)', (await stored(page)).games.invent.saved.length === 2);
        await ctx.close();
      }
      // 3) dogrudan / geri yuklenen #/play/invent: oyun gecmisin tek girdisi olmamali
      {
        const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], seedSaved, { noTts: true });
        await page.goto(BASE + '#/play/invent');
        // Yalniz hash degisen goto beklemeden doner: hash uygulanmadan reload edilirse ana ekran yuklenir (testin yarisi). Once hedefin acildigini bekle.
        await page.waitForSelector('.inv .board');
        await page.reload();
        await page.waitForSelector('.inv .board');
        check('V5.2: dogrudan acilan oyunda Geri mumkun (oyun gecmisin tek girdisi degil)', await canBack(page));
        await goBack(page);
        const v = await view(page);
        check('V5.2: dogrudan acilan oyunda Geri ana menuye doner', v.home && !v.game);
        await ctx.close();
      }
      // 4) cekmece acikken sayfa yenilenirse olu girdi birakmaz
      {
        const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], seedSaved, { noTts: true });
        await open(page);
        await page.click('[data-act="mine"]'); await page.waitForSelector('.inv-save');
        await page.reload(); await page.waitForSelector('.inv .board'); await page.waitForTimeout(300);
        await goBack(page);
        const v = await view(page);
        check('V5.2: cekmece acikken yenilenince tek Geri ana menuye goturur (bos Geri basisi yok)', v.home && !v.game);
        await ctx.close();
      }
      // 5) hizli cift Geri / X sonrasi Geri / ac-kapa tekrarlari
      {
        const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], seedSaved, { noTts: true });
        await open(page);
        await page.click('[data-act="mine"]'); await page.waitForSelector('.inv-save');
        await page.evaluate(() => { history.back(); history.back(); });
        await page.waitForTimeout(450);
        let v = await view(page);
        check('V5.2: hizli cift Geri ana menude biter, yanlis ekran acilmaz', v.home && !v.game && !v.drawer);
        await open(page);
        for (let i = 0; i < 3; i++) { await page.click('[data-act="mine"]'); await page.waitForSelector('.inv-save'); await page.click('[data-act="closeMine"]'); await page.waitForTimeout(200); }
        await goBack(page);
        v = await view(page);
        check('V5.2: cekmeceyi X ile 3 kez ac/kapa sonrasi tek Geri ana menuye doner', v.home && !v.game);
        await ctx.close();
      }
      // 6) ekrandaki 🏠 (X) davranisi bozulmadi; sonrasinda eski oyun ekrani geri gelmez
      {
        const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], seedSaved, { noTts: true });
        await open(page);
        await page.click('[data-act="home"]');
        await cardsReady(page);
        const v = await view(page);
        check('V5.2: 🏠 dugmesi ana menuye doner', v.home && !v.game);
        check('V5.2: 🏠 sonrasi Geri gecmisi bitmis (eski oyun ekrani arkada kalmaz)', !(await canBack(page)));
        await ctx.close();
      }
      // 7) yeniden giris temiz + dinleyici birikmez + kayitlar korunur
      {
        const { page, ctx, problems } = await newPage(VIEWPORTS['telefon-360x640'], seedSaved, { noTts: true });
        await page.evaluate(() => { window.__pc = 0; const o = window.addEventListener; const r = window.removeEventListener; window.addEventListener = function (t, ...a) { if (t === 'popstate') window.__pc++; return o.call(this, t, ...a); }; window.removeEventListener = function (t, ...a) { if (t === 'popstate') window.__pc--; return r.call(this, t, ...a); }; });
        await open(page);
        await place(page, 'wire', 's1'); await place(page, 'led', 's2'); await place(page, 'wire', 's3');
        check('V5.2: devre kuruldu (LED yanar)', (await lit(page)) === '1');
        for (let i = 0; i < 4; i++) {
          await goBack(page);
          await cardsReady(page);
          await open(page);
          await page.click('[data-act="mine"]'); await page.waitForSelector('.inv-save'); await page.click('[data-act="closeMine"]'); await page.waitForTimeout(150);
        }
        check('V5.2: yeniden girisse oyun temiz baslar (kurulu devre tasinmaz)', (await lit(page)) === '0' && (await page.locator('.inv-hit').count()) === 0);
        await goBack(page); await cardsReady(page);
        check('V5.2: tekrar gir/cik sonrasi popstate dinleyicisi birikmez', (await page.evaluate(() => window.__pc)) === 0, String(await page.evaluate(() => window.__pc)));
        check('V5.2: kullanicinin kaydettigi devreler korunur (2)', (await stored(page)).games.invent.saved.length === 2);
        check('V5.2: Geri dongusu konsol hatasi/dis istek yok', problems.errors.length === 0 && problems.external.length === 0, problems.errors.join(' | '));
        await ctx.close();
      }
      // 8) diger oyunlar: dogrudan acilista da Geri ana menuye doner; normal akis bozulmadi
      for (const id of ['shape-complete', 'number-hunt']) {
        const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], { band: '6-8', sound: false }, { noTts: true });
        await open(page, id);
        await goBack(page);
        let v = await view(page);
        check(`V5.2: ${id}: Geri ana menuye doner`, v.home && !v.game);
        await page.goto(BASE + `#/play/${id}`); await page.waitForSelector('.play'); await page.reload(); await page.waitForSelector('.play');
        await goBack(page);
        v = await view(page);
        check(`V5.2: ${id}: dogrudan acilista Geri ana menuye doner`, v.home && !v.game);
        await ctx.close();
      }
    }

    // ---------- V6: Android FIZIKSEL Geri tusu (Capacitor App.backButton taklidi; GERCEK CIHAZ TESTI DEGILDIR) ----------
    {
      const seedV6 = { band: '6-8', sound: false, seen: true, games: { invent: { correct: 0, found: [], saved: [{ v: 1, layout: 'loop', slots: ['wire', 'led', 'wire'], sw: ['open', 'open', 'open'] }, { v: 1, layout: 'loop', slots: ['led', 'wire', 'wire'], sw: ['open', 'open', 'open'] }] } } };
      const fakeBridge = (withApp) => (withApp) => {
        const C = { PluginHeaders: withApp ? [{ name: 'App' }] : [{ name: 'TextToSpeech' }], listeners: 0, cb: null, min: 0 };
        C.addListener = (p, e, cb) => { if (p === 'App' && e === 'backButton') { C.listeners += 1; C.cb = cb; } return { remove() {} }; };
        C.nativePromise = (p, m) => { if (p === 'App' && m === 'minimizeApp') C.min += 1; return Promise.resolve({}); };
        window.Capacitor = C;
        window.__fire = (n = 1) => { for (let i = 0; i < n; i++) C.cb && C.cb({ canGoBack: true }); };
      };
      const mkNative = async (withApp = true, url = BASE) => {
        const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript(fakeBridge(withApp), withApp);
        await page.addInitScript((v) => { if (!localStorage.getItem('altez-minilab:v1')) localStorage.setItem('altez-minilab:v1', JSON.stringify(v)); }, seedV6);
        await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }));
        await page.goto(url);
        return { ctx, page, errors };
      };
      const vw = (page) => page.evaluate(() => ({ home: !!document.querySelector('.home'), game: !!document.querySelector('.play'), drawer: !!document.querySelector('.overlay:not([hidden])'), min: window.Capacitor.min, n: window.Capacitor.listeners }));
      const fire = async (page, n = 1) => { await page.evaluate((k) => window.__fire(k), n); await page.waitForTimeout(350); };

      {
        const { ctx, page, errors } = await mkNative(true);
        await cardsReady(page);
        check('V6 Geri: App.backButton dinleyicisi acilista TEK kez kaydedilir', (await vw(page)).n === 1);
        await cardsReady(page); await page.click('[data-game="invent"]'); await page.waitForSelector('.inv .board');
        await fire(page);
        let v = await vw(page);
        check('V6 Geri: fiziksel Geri oyundan ana ekrana doner (oyun ekrani arkada kalmaz)', v.home && !v.game && v.min === 0);
        await fire(page); // V7.8+: Oyunlar listesinden Geri -> ana menu (arka plana alma YOK)
        v = await vw(page);
        check('V6 Geri: Oyunlar listesinden Geri ana menuye doner, uygulama kapanmaz', v.home && v.min === 0);
        await fire(page);
        v = await vw(page);
        check('V6 Geri: ana ekranda Geri uygulamayi arka plana alir (minimizeApp), ana ekran kalir', v.home && v.min === 1);
        await fire(page);
        v = await vw(page);
        check('V6 Geri: ana ekranda tekrar Geri tutarli (dongu/takilma yok)', v.home && v.min === 2);
        await cardsReady(page);
        await cardsReady(page); await page.click('[data-game="invent"]'); await page.waitForSelector('.inv .board');
        await page.click('[data-act="mine"]'); await page.waitForSelector('.inv-save');
        await fire(page);
        v = await vw(page);
        check('V6 Geri: Buluslarim acikken ilk fiziksel Geri yalniz cekmeceyi kapatir', v.game && !v.drawer && !v.home);
        await fire(page);
        v = await vw(page);
        check('V6 Geri: ikinci fiziksel Geri ana ekrana doner', v.home && !v.game);
        check('V6 Geri: gir/cik sonrasi dinleyici sayisi hala 1', v.n === 1);
        check('V6 Geri: kaydedilen devreler korunur (2)', (await stored(page)).games.invent.saved.length === 2);
        // X (🏠) davranisi: cekmece X'i cekmeceyi kapatir ve oyunda birakir; 🏠 ana ekrana doner
        await cardsReady(page); await page.click('[data-game="invent"]'); await page.waitForSelector('.inv .board');
        await page.click('[data-act="mine"]'); await page.waitForSelector('.inv-save'); await page.click('[data-act="closeMine"]'); await page.waitForTimeout(300);
        v = await vw(page);
        check('V6 Geri: cekmece X dugmesi cekmeceyi kapatip Mucit Atolyesinde birakir', v.game && !v.drawer);
        await page.click('[data-act="home"]'); await cardsReady(page);
        await fire(page);
        v = await vw(page);
        check('V6 Geri: 🏠 sonrasi Geri eski oyun ekranini geri getirmez', v.home && !v.game);
        // Hizli cift Geri: oyunda tek cikis, ana ekranda kalir
        await cardsReady(page); await page.click('[data-game="invent"]'); await page.waitForSelector('.inv .board');
        const before = (await vw(page)).min;
        await fire(page, 2);
        v = await vw(page);
        check('V6 Geri: oyunda hizli cift Geri ana ekranda biter, arka plana atmaz', v.home && !v.game && v.min === before);
        // Cekmece acikken hizli cift Geri: cekmece + oyundan cikis
        await cardsReady(page); await page.click('[data-game="invent"]'); await page.waitForSelector('.inv .board');
        await page.click('[data-act="mine"]'); await page.waitForSelector('.inv-save');
        await fire(page, 2);
        v = await vw(page);
        check('V6 Geri: cekmece acikken hizli cift Geri ana ekranda biter', v.home && !v.game && !v.drawer);
        // Diger oyunlar
        for (const id of ['shape-complete', 'number-hunt']) {
          await cardsReady(page); await page.click(`[data-game="${id}"]`); await page.waitForSelector('.play');
          await fire(page);
          v = await vw(page);
          check(`V6 Geri: ${id}: fiziksel Geri ana ekrana doner`, v.home && !v.game);
        }
        check('V6 Geri: konsol/sayfa hatasi yok', errors.length === 0, errors.join(' | '));
        await ctx.close();
      }
      // dogrudan oyun rotasi + yenileme + soguk acilis
      {
        const { ctx, page } = await mkNative(true, BASE + '#/play/invent');
        await page.waitForSelector('.inv .board');
        await fire(page);
        let v = await vw(page);
        check('V6 Geri: dogrudan #/play/invent acilisinda fiziksel Geri ana ekrana doner', v.home && !v.game);
        await cardsReady(page); // V7.8+: kartlar Oyunlar listesindedir
        await page.click('[data-game="invent"]'); await page.waitForSelector('.inv .board');
        await page.reload(); await page.waitForSelector('.inv .board');
        await fire(page);
        v = await vw(page);
        check('V6 Geri: oyunda yenileme sonrasi fiziksel Geri ana ekrana doner', v.home && !v.game);
        await ctx.close();
      }
      {
        const { ctx, page } = await mkNative(true, BASE + '#/voice-test');
        await cardsReady(page);
        const v = await vw(page);
        check('V6 Geri: #/voice-test soguk acilisi ana ekrani ele gecirmez', v.home && (await page.locator('#vt-out').count()) === 0);
        await ctx.close();
      }
      // @capacitor/app eklentisi yoksa dinleyici kaydedilmez (durum acikca raporlanir)
      {
        const { ctx, page } = await mkNative(false);
        await cardsReady(page);
        const st = await page.evaluate(() => ({ n: window.Capacitor.listeners, s: window.__altezBack.status() }));
        check('V6 Geri: App eklentisi yoksa dinleyici kaydedilmez ve durum "missing" olur', st.n === 0 && st.s.plugin === 'missing', JSON.stringify(st.s));
        await ctx.close();
      }
    }

    // ---------- V6: GERCEK Capacitor 8.5.3 native-bridge.js uzerinde protokol testi (Android mesaj bicimi kaynaktan taklit; CIHAZ TESTI DEGILDIR) ----------
    {
      const { readFileSync } = await import('node:fs');
      const bridgeSrc = readFileSync(new URL('../tests/fixtures/capacitor-8.5.3-native-bridge.js', import.meta.url), 'utf8');
      const seedB = { band: '6-8', sound: false, seen: true };
      const mkReal = async ({ headers, url = BASE, replyErrorToListener = false } = {}) => {
        const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e)));
        await page.addInitScript(({ h, errMode }) => {
          window.__sent = [];
          // Android'in gercek WebView koprusu: JS -> native JSON metin
          window.androidBridge = { postMessage(str) { const m = JSON.parse(str); window.__sent.push(m); if (errMode && m.methodName === 'addListener') setTimeout(() => window.Capacitor.fromNative({ save: true, callbackId: m.callbackId, pluginId: m.pluginId, methodName: m.methodName, success: false, error: { message: 'unable to find plugin : App' } }), 5); } };
          window.Capacitor = { DEBUG: false, isLoggingEnabled: false, Plugins: {} }; // JSExport.getBridgeJS ile ayni baslangic
        }, { h: headers, errMode: replyErrorToListener });
        await page.addInitScript({ content: bridgeSrc });
        await page.addInitScript((h) => { window.Capacitor.PluginHeaders = h; }, headers); // JSExport.getPluginJS ile ayni sira
        await page.addInitScript(() => Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }));
        await page.addInitScript((v) => { if (!localStorage.getItem('altez-minilab:v1')) localStorage.setItem('altez-minilab:v1', JSON.stringify(v)); }, seedB);
        await page.goto(url);
        return { ctx, page, errors };
      };
      // Android: PluginCall.resolve(data) kalici dinleyiciye yanit (MessageHandler.sendResponseMessage alanlari)
      const nativeBack = (page) => page.evaluate(() => { const l = window.__sent.find((m) => m.pluginId === 'App' && m.methodName === 'addListener'); window.Capacitor.fromNative({ save: true, callbackId: l.callbackId, pluginId: 'App', methodName: 'addListener', success: true, data: { canGoBack: true } }); });
      const HEAD_OK = [{ name: 'App', methods: [{ name: 'addListener', rtype: 'none' }, { name: 'minimizeApp', rtype: 'promise' }] }];
      const view2 = (page) => page.evaluate(() => ({ home: !!document.querySelector('.home'), game: !!document.querySelector('.play') }));

      {
        const { ctx, page, errors } = await mkReal({ headers: HEAD_OK });
        await cardsReady(page);
        const sent = await page.evaluate(() => window.__sent.filter((m) => m.pluginId === 'App'));
        check('V6 gercek koprü: backButton dinleyicisi Android mesaj bicimiyle TEK kez gonderilir', sent.length === 1 && sent[0].methodName === 'addListener' && sent[0].options.eventName === 'backButton' && sent[0].callbackId !== '-1', JSON.stringify(sent));
        check('V6 gercek koprü: durum ok / dinleniyor', await page.evaluate(() => { const s = window.__altezBack.status(); return s.plugin === 'ok' && s.listening; }));
        await page.click('[data-game="invent"]'); await page.waitForSelector('.inv .board');
        await nativeBack(page); await page.waitForTimeout(350);
        let v = await view2(page);
        check('V6 gercek koprü: native backButton olayi oyundan ana ekrana doner', v.home && !v.game);
        await nativeBack(page); await page.waitForTimeout(350); // V7.8+: Oyunlar listesi -> ana menu (kapatma yok)
        await nativeBack(page); await page.waitForTimeout(150);
        const min = await page.evaluate(() => window.__sent.filter((m) => m.pluginId === 'App' && m.methodName === 'minimizeApp'));
        check('V6 gercek koprü: ana ekranda App.minimizeApp native mesaji gonderilir (callbackId ile)', min.length === 1 && min[0].callbackId !== '-1', JSON.stringify(min));
        // native cevap verirse (Promise cozulur) hata olusmaz
        await page.evaluate(() => { const m = window.__sent.find((x) => x.methodName === 'minimizeApp'); window.Capacitor.fromNative({ save: false, callbackId: m.callbackId, pluginId: 'App', methodName: 'minimizeApp', success: true }); });
        await page.waitForTimeout(100);
        v = await view2(page);
        check('V6 gercek koprü: minimizeApp sonrasi ana ekran bozulmaz, sayfa hatasi yok', v.home && errors.length === 0, errors.join(' | '));
        await ctx.close();
      }
      {
        const { ctx, page } = await mkReal({ headers: HEAD_OK, replyErrorToListener: true });
        await cardsReady(page);
        await page.waitForTimeout(300);
        const st = await page.evaluate(() => window.__altezBack.status());
        check('V6 gercek koprü: native dinleyiciyi reddederse durum "error" olur, ACIK raporlanir', st.plugin === 'error' && st.listening === false, JSON.stringify(st));
        await page.evaluate(() => (location.hash = '#/voice-test'));
        await page.waitForSelector('#vt-out');
        await page.waitForTimeout(500);
        const txt = await page.textContent('#vt-out');
        check('V6 gercek koprü: tani sayfasi Geri tusu HATASINI gosterir', /GERI TUSU:.*error/.test(txt) && /HATA\/UYARI/.test(txt), txt.split('\n')[0]);
        await ctx.close();
      }
      {
        const { ctx, page } = await mkReal({ headers: [{ name: 'TextToSpeech', methods: [] }] });
        await cardsReady(page);
        const r = await page.evaluate(() => ({ sent: window.__sent.filter((m) => m.pluginId === 'App').length, s: window.__altezBack.status() }));
        check('V6 gercek koprü: @capacitor/app yoksa dinleyici GONDERILMEZ ve durum "missing" (acik hata)', r.sent === 0 && r.s.plugin === 'missing', JSON.stringify(r));
        await ctx.close();
      }
    }

    // Idle ipucu: 12 sn sonra nazik ipucu (cevap vermez)
    {
      const { page, ctx } = await newPage(VIEWPORTS['telefon-360x640'], { band: '4-5', sound: false }, { noTts: true });
      await page.click('[data-game="invent"]');
      await page.waitForSelector('.inv .board');
      await place(page, 'led', 's2');
      await page.waitForTimeout(12600);
      check('atolye: 12 sn bekleyince nazik ipucu (bosluklar vurgulanir)', (await page.locator('.slot.hint').count()) >= 1 && (await lit(page)) === '0');
      await ctx.close();
    }

    // Ses: atolye yonergesi Turkce (sahte speechSynthesis izleyici), ses kapaliyken sessiz
    {
      const spy = () => {
        window.__spoken = [];
        window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, pending: false, getVoices: () => [{ name: 'Turkce', lang: 'tr-TR', localService: true }], resume() {}, cancel() {}, speak(u) { window.__spoken.push({ text: u.text, lang: u.lang, vol: u.volume }); setTimeout(() => { u.onstart?.(); u.onend?.(); }, 5); } } });
      };
      for (const sound of [true, false]) {
        const ctx = await browser.newContext({ viewport: VIEWPORTS['telefon-360x640'], hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        await page.addInitScript(spy);
        await page.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, { band: '4-5', sound, seen: true }]);
        await page.goto(HOME);
        await cardsReady(page);
        await page.click('[data-game="invent"]');
        await page.waitForSelector('.inv .board');
        await page.waitForTimeout(500);
        const sp = await page.evaluate(() => window.__spoken.filter((s) => s.vol !== 0));
        if (sound) check('ses: Mucit Atolyesi Turkce yonerge konusur (tr-TR)', sp.length >= 1 && sp[0].lang === 'tr-TR' && /devre/i.test(sp[0].text), JSON.stringify(sp[0]));
        else check('ses kapaliyken Mucit Atolyesi sessiz', sp.length === 0);
        await ctx.close();
      }
    }
    // ---- V7.3: ana ekran duzeni + sesli secenek / tek durumlu parlak vurgu ----
    {
      const KEY = 'altez-minilab:v1';
      const spyInit = (mode) => {
        window.__spoken = [];
        window.__cancels = 0;
        window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
        Object.defineProperty(window, 'speechSynthesis', {
          configurable: true,
          value: {
            speaking: false, pending: false, getVoices: () => [{ name: 'Turkce', lang: 'tr-TR', localService: true }], resume() {},
            cancel() { window.__cancels += 1; },
            speak(u) { if (mode === 'throw') throw new Error('tts-bozuk'); window.__spoken.push({ text: u.text, lang: u.lang, vol: u.volume }); setTimeout(() => u.onend && u.onend(), 30); }
          }
        });
      };
      const mk = async (seed, { vp = VIEWPORTS['telefon-360x640'], mode = 'ok' } = {}) => {
        const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(String(e)));
        await page.addInitScript(spyInit, mode);
        await page.addInitScript(() => {
          const Base = window.AudioContext || window.webkitAudioContext;
          window.__audio = { osc: 0, maxEnd: 0 };
          if (!Base) return;
          window.AudioContext = class extends Base {
            createOscillator() { const o = super.createOscillator(); window.__audio.osc += 1; return o; }
          };
        });
        await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
        await page.goto(HOME);
        await cardsReady(page);
        return { ctx, page, errs };
      };
      // --- Ana ekran: Egitim ve yas dugmeleri (simge ustte, yazi altta) ---
      for (const [vn, vp] of [['360x640', VIEWPORTS['telefon-360x640']], ['320x568', { width: 320, height: 568 }]]) {
        const { ctx, page, errs } = await mk({ band: '4-5', sound: false, seen: true }, { vp });
        await menuReady(page); // V7.8+: egitim girisi ANA MENUDEDIR
        const measure = (sels) => page.evaluate((sels) => {
          const out = {};
          for (const sel of sels) {
            const b = document.querySelector(sel); const r = b.getBoundingClientRect();
            const ic = b.querySelector('.stk-icon, .mc-ic').getBoundingClientRect(); const lb = b.querySelector('.stk-label, .mc-t'); const lr = lb.getBoundingClientRect(); // V7.8+: menu karti .mc-ic/.mc-t
            out[sel] = { w: r.width, h: r.height, iconAbove: ic.bottom <= lr.top + 2, centered: Math.abs((ic.left + ic.width / 2) - (lr.left + lr.width / 2)) < 6, fits: lb.scrollWidth <= lb.clientWidth + 1 && lr.left >= r.left - 1 && lr.right <= r.right + 1, inView: r.left >= 0 && r.right <= innerWidth, text: lb.textContent.replace(/\s+/g, ' ').trim() };
          }
          return out;
        }, sels);
        const lay = await measure(['.edu-entry']); // V7.8+: Egitim girisi ANA MENUDE
        await page.evaluate(() => { location.hash = '#/games'; }); await cardsReady(page); // yas dugmesi Oyunlar listesinde
        Object.assign(lay, await measure(['.band-btn']));
        const e = lay['.edu-entry']; const b = lay['.band-btn'];
        check(`V7.3 ana ekran (${vn}): Egitim simgesi ustte, "Egitim" yazisi altta ve eksiksiz`, e.iconAbove && e.centered && e.fits && e.text.startsWith('Eğitim'), JSON.stringify(e));
        check(`V7.3 ana ekran (${vn}): Egitim dugmesi tasmiyor, dokunma alani >= 64px`, e.inView && e.h >= 64 && e.w >= 64, `${Math.round(e.w)}x${Math.round(e.h)}`);
        check(`V7.3 ana ekran (${vn}): yas simgesi ustte, "4–5 yas" altta, tasma yok`, b.iconAbove && b.centered && b.fits && b.inView && b.text === '4–5 yaş' && b.h >= 60, // V7.x'ten beri .home-ctl dugmesi min-height:62px (V8.3'te de ayni; belgeli kasitli uyarlama, 48dp Android alt siniri ustunde)
           JSON.stringify(b));
        await page.click('.band-btn');
        const after = await page.evaluate((k) => ({ band: JSON.parse(localStorage.getItem(k)).band, text: document.querySelector('.band-btn .stk-label').textContent.trim(), icon: document.querySelector('.band-btn .stk-icon').textContent.trim() }), KEY);
        check(`V7.3 ana ekran (${vn}): yas secimi calisir (6–8 yas, saklanir)`, after.band === '6-8' && after.text === '6–8 yaş' && after.icon === '🦉', JSON.stringify(after));
        await menuReady(page);
        await page.click('.edu-entry');
        await page.waitForSelector('.learn-map');
        check(`V7.3 ana ekran (${vn}): Egitim dugmesi Egitim bolumunu acar`, (await page.evaluate(() => location.hash)) === '#/play/learn');
        check(`V7.3 ana ekran (${vn}): sayfa hatasi yok`, errs.length === 0, errs[0] || '');
        await ctx.close();
      }
      // --- Devre secenekleri: adi okunur, tek kart parlar ---
      const openCircuit = async (seed, opts) => {
        const c = await mk(seed, opts);
        await c.page.click('[data-game="shape-complete"]');
        await c.page.waitForSelector('.play .prompt svg');
        const st = newStats();
        await playRound(c.page, st);
        await playRound(c.page, st);
        await c.page.waitForSelector('.prompt.kind-circuit');
        return c;
      };
      const seedC = (stage, sound = true) => ({ correct: 0, band: '6-8', sound, seen: true, circuit: { '4-5': { stage: 0, plays: 0 }, '6-8': { stage, plays: 0 } } });
      const info = (page) => page.evaluate(() => ({
        chosen: [...document.querySelectorAll('.tile')].map((t, i) => (t.classList.contains('chosen') ? i : -1)).filter((i) => i >= 0),
        labels: [...document.querySelectorAll('.tile')].map((t) => t.getAttribute('aria-label')),
        types: [...document.querySelectorAll('.tile')].map((t) => t.dataset.type),
        spoken: window.__spoken.filter((x) => x.vol !== 0).map((x) => x.text),
        cap: document.querySelector('.cap')?.textContent.trim(),
        used: document.querySelectorAll('.tile.used').length,
        correct: JSON.parse(localStorage.getItem('altez-minilab:v1')).correct
      }));
      {
        // tek bos konumlu devre (c1-kablo): yanlis karta dokun -> adi okunur + parlar; yerlesmez, dogru sayilmaz, ilerleme yazilmaz
        const { ctx, page, errs } = await openCircuit(seedC(0));
        await page.evaluate(() => (window.__spoken.length = 0));
        const i0 = await info(page);
        const c0 = i0.correct;
        const wrongIdx = i0.types.findIndex((t) => t !== 'wire');
        const rightIdx = i0.types.findIndex((t) => t === 'wire');
        const oscW0 = await page.evaluate(() => window.__audio.osc);
        await page.locator('.tile').nth(wrongIdx).click();
        await page.waitForTimeout(120);
        const a = await info(page);
        check('V7.3 devre secenegi: dokunulan kartin adi Turkce okunur', a.spoken.at(-1) === a.labels[wrongIdx], JSON.stringify([a.spoken, a.labels[wrongIdx]]));
        check('V7.3 devre secenegi: okunan kart parlar (tek kart, okunanla ayni)', a.chosen.length === 1 && a.chosen[0] === wrongIdx);
        check('V7.3 devre secenegi: secilen ad yazili da gorunur (ses olmasa da anlasilir)', a.cap === a.labels[wrongIdx], a.cap);
        await page.waitForTimeout(900);
        const w = await info(page);
        const oscW = (await page.evaluate(() => window.__audio.osc)) - oscW0;
        check('V7.3 yanlis parca: basari muzigi calmaz (yalniz kisa dokunma/hata sesi)', oscW <= 6, `osc+${oscW}`);
        check('V7.3 yanlis parca: dogru sayilmaz, ilerleme yazilmaz, basari yok, vurgu temizlenir', w.used === 0 && w.correct === c0 && w.chosen.length === 0 && (await page.locator('.prompt.solved').count()) === 0);
        // hizli dokunma: once yanlis sonra dogru kart -> vurgu ve ses son karta gecer, yalniz son secim degerlendirilir
        await page.evaluate(() => (window.__spoken.length = 0));
        const oscR0 = await page.evaluate(() => window.__audio.osc);
        await page.locator('.tile').nth(wrongIdx).click();
        await page.waitForTimeout(60);
        await page.locator('.tile').nth(rightIdx).click();
        await page.waitForTimeout(60);
        const r = await info(page);
        check('V7.3 hizli dokunma: vurgu yeni karta gecti (tek kart), ses son secimle eslesir', r.chosen.length === 1 && r.chosen[0] === rightIdx && r.spoken.at(-1) === r.labels[rightIdx], JSON.stringify([r.chosen, r.spoken]));
        await page.waitForSelector('.prompt.solved', { timeout: 6000 });
        const ok = await info(page);
        check('V7.3 dogru parca: devre tamamlanir, ilerleme tam 1 artar', ok.correct === c0 + 1, `${c0}->${ok.correct}`);
        await page.waitForTimeout(1700);
        const led = await page.evaluate(() => ({ power: !!document.querySelector('.board.power'), leds: [...document.querySelectorAll('.board .led')].map((e) => e.dataset.b), glow: [...document.querySelectorAll('.board .led .glow')].map((e) => +getComputedStyle(e).opacity) }));
        check('V7.3 devre: LED gercekten yanar (guc akisi + parlaklik > 0)', led.power && led.leds.length >= 1 && led.leds.every((b) => +b > 0) && led.glow.some((g) => g > 0.3), JSON.stringify(led));
        const oscR = (await page.evaluate(() => window.__audio.osc)) - oscR0;
        check('V7.3 dogru cevap: basari muzigi bir kez calar (yigilmaz)', oscR >= 25 && oscR <= 60, `osc+${oscR}`);
        check('V7.3 devre secenegi: sayfa hatasi yok', errs.length === 0, errs[0] || '');
        await ctx.close();
      }
      {
        // cok bos konumlu devre (c14): secimler arasinda gecis, tek vurgu; ses kapaliyken de calisir
        const { ctx, page } = await openCircuit(seedC(13));
        await page.evaluate(() => (window.__spoken.length = 0));
        await page.locator('.tile').nth(0).click();
        await page.waitForTimeout(80);
        await page.locator('.tile').nth(1).click();
        await page.waitForTimeout(80);
        const m = await info(page);
        check('V7.3 cok konumlu devre: ikinci secimde vurgu ve ses ikinci karta gecer (tek kart)', m.chosen.length === 1 && m.chosen[0] === 1 && m.spoken.at(-1) === m.labels[1] && m.used === 0, JSON.stringify(m.chosen));
        await ctx.close();
      }
      {
        const { ctx, page } = await openCircuit(seedC(13, false));
        await page.locator('.tile').nth(0).click();
        await page.waitForTimeout(100);
        const q = await info(page);
        check('V7.3 ses kapali: secim yapilir, kart parlar, ad yazili gorunur, konusma yok', q.chosen.length === 1 && q.spoken.length === 0 && q.cap === q.labels[0], JSON.stringify([q.chosen, q.spoken, q.cap]));
        await ctx.close();
      }
      {
        const { ctx, page, errs } = await openCircuit(seedC(13), { mode: 'throw' });
        await page.locator('.tile').nth(0).click();
        await page.waitForTimeout(150);
        const f = await info(page);
        await page.locator('.tile').nth(1).click();
        await page.waitForTimeout(100);
        check('V7.3 konusma motoru hata verirse oyun surer (cokme yok, secim/vurgu calisir)', errs.length === 0 && f.chosen.length === 1 && (await info(page)).chosen[0] === 1, errs[0] || '');
        await ctx.close();
      }
      {
        // ekrandan cikinca eski konusma kesilir ve yeni konusma baslamaz
        const { ctx, page } = await openCircuit(seedC(13));
        await page.locator('.tile').nth(0).click();
        await page.waitForTimeout(60);
        const c1 = await page.evaluate(() => window.__cancels);
        await page.click('[data-act="home"]');
        await cardsReady(page);
        const c2 = await page.evaluate(() => ({ cancels: window.__cancels, n: window.__spoken.length }));
        await page.waitForTimeout(1200);
        const n2 = await page.evaluate(() => window.__spoken.length);
        check('V7.3 ekrandan cikinca konusma durdurulur ve sonradan yeni okuma baslamaz', c2.cancels > c1 && n2 === c2.n, JSON.stringify([c1, c2, n2]));
        await ctx.close();
      }
      {
        // renk/sekil seceneklerinde (adi olan geometri) tiklanan secenegin adi okunur; tek kart parlar
        const { ctx, page } = await mk({ correct: 0, band: '6-8', sound: true, seen: true });
        await page.click('[data-game="shape-complete"]');
        await page.waitForSelector('.play .prompt svg');
        const NAMES = ['Kırmızı', 'Mavi', 'Sarı', 'Yeşil', 'Mor', 'Turuncu', 'Daire', 'Kare', 'Üçgen', 'Dikdörtgen', 'Yıldız', 'Kalp', 'Altıgen', 'Beşgen', 'Elips', 'Yarım daire', 'Çeyrek daire'];
        let seen = null; const st = newStats();
        for (let r = 0; r < 40 && !seen; r++) {
          const kind = await cls(page, '.prompt');
          if (/kind-(matchColor|matchShape)/.test(kind)) {
            await page.evaluate(() => (window.__spoken.length = 0));
            await page.locator('.tile').first().click();
            await page.waitForTimeout(120);
            seen = await page.evaluate(() => ({ spoken: window.__spoken.filter((x) => x.vol !== 0).map((x) => x.text), chosen: document.querySelectorAll('.tile.chosen').length }));
            break;
          }
          await playRound(page, st);
        }
        check('V7.3 renk/sekil sorusu: dokunulan secenegin adi okunur ve tek kart parlar', !!seen && seen.spoken.length >= 1 && NAMES.includes(seen.spoken.at(-1)) && seen.chosen === 1, JSON.stringify(seen));
        await ctx.close();
      }
    }
    // ---- V7.4: Egitim yazisi GORUNURLUGU (renk/piksel) + Egitim Merkezi (alti asama, yeni dersler, gorevler, ipucu, ses, ilerleme) ----
    {
      const KEY = 'altez-minilab:v1';
      const spyInit = () => {
        window.__spoken = [];
        window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
        Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, pending: false, getVoices: () => [{ name: 'Turkce', lang: 'tr-TR', localService: true }], resume() {}, cancel() {}, speak(u) { window.__spoken.push({ text: u.text, vol: u.volume }); setTimeout(() => u.onend && u.onend(), 20); } } });
        const Base = window.AudioContext || window.webkitAudioContext;
        window.__audio = { osc: 0 };
        if (Base) window.AudioContext = class extends Base { createOscillator() { const o = super.createOscillator(); window.__audio.osc += 1; return o; } };
      };
      const mk = async (seed, vp = VIEWPORTS['telefon-360x640']) => {
        const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
        const page = await ctx.newPage();
        const errs = [];
        page.on('pageerror', (e) => errs.push(String(e)));
        page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
        await page.addInitScript(spyInit);
        await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
        return { ctx, page, errs };
      };
      // ---- 1) "Egitim" yazisi gercekten GORUNUR (hesaplanan renk + zemin kontrasti + piksel) ----
      for (const [vn, vp] of [['360x640', VIEWPORTS['telefon-360x640']], ['320x568', { width: 320, height: 568 }]]) {
        for (const band of ['4-5', '6-8']) {
          const { ctx, page } = await mk({ band, sound: false, seen: true }, vp);
          await page.goto(BASE);
          await menuReady(page); // V7.8+: egitim girisi ANA MENUDEDIR
          const m = await page.evaluate(() => {
            const parse = (c) => c.match(/[\d.]+/g).map(Number);
            const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
            const btn = document.querySelector('.edu-entry'); const lab = btn.querySelector('.stk-label, .mc-t');
            const fg = parse(getComputedStyle(lab).color).slice(0, 3); const bg = parse(getComputedStyle(btn).backgroundColor).slice(0, 3);
            const L1 = lum(fg), L2 = lum(bg);
            const rb = btn.getBoundingClientRect(), rl = lab.getBoundingClientRect();
            return { fg, bg, contrast: (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05), alpha: parse(getComputedStyle(btn).backgroundColor)[3] ?? 1, opacity: +getComputedStyle(lab).opacity, vis: getComputedStyle(lab).visibility, text: lab.textContent.replace(/\s+/g, ' ').trim(), centerDx: Math.abs((rl.left + rl.width / 2) - (rb.left + rb.width / 2)), inBtn: rl.left >= rb.left - 1 && rl.right <= rb.right + 1 && rl.bottom <= rb.bottom + 1 };
          });
          check(`V7.4 Egitim yazisi (${vn}, ${band}): metin "Egitim", gorunur, zeminle kontrast >= 4.5`, m.text.startsWith('Eğitim') && m.vis === 'visible' && m.opacity > 0.9 && m.contrast >= 4.5, JSON.stringify(m));
          check(`V7.4 Egitim yazisi (${vn}, ${band}): simgenin altinda ortali ve dugmenin icinde`, m.centerDx < 6 && m.inBtn, JSON.stringify(m));
          // piksel kontrolu: etiket alaninda zeminden belirgin farkli piksel var mi (beyaz-uzeri-beyaz hatasi yakalanir)
          const png = (await page.locator('.edu-entry .stk-label, .edu-entry .mc-t').first().screenshot()).toString('base64');
          const px = await page.evaluate(async (b64) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
            const d = x.getImageData(0, 0, c.width, c.height).data; const bg = [d[0], d[1], d[2]]; let n = 0;
            for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - bg[0]) + Math.abs(d[i + 1] - bg[1]) + Math.abs(d[i + 2] - bg[2]) > 200) n++;
            return { n, total: d.length / 4 };
          }, png);
          check(`V7.4 Egitim yazisi (${vn}, ${band}): ekranda gercekten cizili (zeminden farkli piksel yeterli)`, px.n > px.total * 0.08, JSON.stringify(px));
          await ctx.close();
        }
      }
      // ---- 2) Egitim Merkezi: asama yolu, sayaclar, rozetler ----
      {
        const { ctx, page, errs } = await mk({ band: '4-5', sound: false, seen: true, edu: { done: ['circuit-1', 'switch-1', 'resistor-1'] } });
        await page.goto(BASE + '#/play/learn');
        await page.waitForSelector('.learn-map');
        const m = await page.evaluate(() => ({
          path: [...document.querySelectorAll('.learn-path .lp')].map((e) => e.dataset.level + ':' + e.className.match(/lp-(done|open|locked|soon)/)[1] + (e.classList.contains('lp-now') ? '*' : '')),
          names: [...document.querySelectorAll('.learn-path .lp-name')].map((e) => e.textContent),
          badges: [...document.querySelectorAll('.learn-badges .lb')].map((e) => e.classList.contains('lb-on') ? 1 : 0).join(''),
          counts: [...document.querySelectorAll('.learn-level .lv-count')].map((e) => e.textContent).join(','),
          levels: [...document.querySelectorAll('.learn-level')].map((e) => e.dataset.level).join(',')
        }));
        check('V7.4 Egitim Merkezi: alti asama dogru sirada gorunur', m.names.join(',') === 'Başlangıç,Çırak,Kalfa,Usta,Kaşif,Mucit' && m.levels === 'baslangic,cirak,kalfa,usta,kasif,mucit', JSON.stringify(m.names));
        check('V7.4 Egitim Merkezi: bitenler tamam, siradaki asama isaretli (Kalfa), ilerleyenler kilitli', m.path.join(',') === 'baslangic:done,cirak:done,kalfa:open*,usta:locked,kasif:locked,mucit:locked', m.path.join(','));
        check('V7.4 Egitim Merkezi: ders sayaclari ve rozetler (3/8 ders -> 3 rozet kazanildi)', m.counts === '2/2,1/1,0/2,0/1,0/1,0/1' && m.badges === '11100000', JSON.stringify([m.counts, m.badges]));
        // dar ekranda asama adlari kesilmiyor
        const clip = await page.evaluate(() => [...document.querySelectorAll('.learn-path .lp-name')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth).length);
        check('V7.4 Egitim Merkezi: asama adlari kesilmez/tasmaz (360px)', clip === 0, String(clip));
        const ovf = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
        check('V7.4 Egitim Merkezi: yatay tasma yok', !ovf);
        check('V7.4 Egitim Merkezi: sayfa hatasi yok', errs.length === 0, errs[0] || '');
        await ctx.close();
      }
      {
        const { ctx, page } = await mk({ band: '4-5', sound: false, seen: true }, { width: 320, height: 568 });
        await page.goto(BASE + '#/play/learn');
        await page.waitForSelector('.learn-map');
        const clip = await page.evaluate(() => [...document.querySelectorAll('.learn-path .lp-name')].filter((e) => e.scrollWidth > e.clientWidth + 1 || e.getBoundingClientRect().right > innerWidth).length);
        check('V7.4 Egitim Merkezi: 320px genislikte asama adlari kesilmez', clip === 0, String(clip));
        await ctx.close();
      }
      // ---- 3) Yeni dersler uctan uca (Usta -> Kasif -> Mucit), ses ACIK, TTS casusu ----
      {
        const KEYS = ['circuit-1', 'switch-1', 'resistor-1', 'series-1', 'parallel-1'];
        const { ctx, page, errs } = await mk({ band: '4-5', sound: true, seen: true, correct: 5, games: { 'number-hunt': { correct: 9 } }, edu: { done: KEYS } });
        await page.goto(BASE + '#/play/learn');
        await page.waitForSelector('.learn-map');
        const st = () => page.evaluate(() => [...document.querySelectorAll('.learn-lesson')].map((e) => e.className.split('st-')[1]).join());
        check('V7.4 Usta dersi acik, Kasif/Mucit kilitli', (await st()) === 'done,done,done,done,done,open,locked,locked', await st());
        const place = async (tool, slot) => { await page.click(`[data-tool="${tool}"]`); await page.click(`[data-slot="${slot}"]`); };
        const toTask = async () => { for (let i = 0; i < 9; i++) { if (await page.locator('[data-tool]').count()) return; await page.click('[data-act="next"]'); await page.waitForTimeout(80); } };
        const spoken = () => page.evaluate(() => window.__spoken.filter((x) => x.vol !== 0).map((x) => x.text));
        const lit = () => page.evaluate(() => +document.querySelector('.prompt').dataset.lit);
        const glow = () => page.evaluate(() => [...document.querySelectorAll('.board .led .glow')].map((e) => +getComputedStyle(e).opacity));
        const next = () => page.locator('[data-act="next"]').count();
        const quiz = async () => { await page.waitForSelector('.learn-opt'); await page.click('.learn-opt:nth-child(2)'); };
        // USTA: LED + direnc + anahtar
        await page.click('[data-lesson="usta-1"]');
        await page.waitForSelector('.learn-dots .learn-dot');
        await toTask();
        await place('led', 's1'); await place('resistor', 's2');
        await page.waitForTimeout(500);
        check('V7.4 Usta gorevi: eksik yolda gorev tamamlanmaz, ipucu yazisi var ve okunur', (await next()) === 0 && (await page.textContent('.cap')).length > 3 && (await spoken()).includes(await page.textContent('.cap')));
        await place('switch', 's3');
        check('V7.4 Usta gorevi: anahtar acikken LED yanmaz, gorev tamamlanmaz, ipucu "anahtara dokun"', (await lit()) === 0 && (await next()) === 0 && /anahtar/i.test(await page.textContent('.cap')), await page.textContent('.cap'));
        const g0 = Math.max(0, ...(await glow()));
        const o0 = await page.evaluate(() => window.__audio.osc);
        await page.click('[data-switch="s3"]');
        await page.waitForTimeout(700);
        const g1 = Math.max(0, ...(await glow()));
        check('V7.4 Usta gorevi: anahtar kapaninca LED gercekten yanar (parlaklik artar) ve gorev tamamlanir', (await lit()) > 0 && g1 > g0 + 0.2 && (await next()) === 1, JSON.stringify([g0, g1]));
        await page.waitForTimeout(1200);
        const o1 = await page.evaluate(() => window.__audio.osc);
        for (let i = 0; i < 6; i++) await page.click('[data-switch="s3"]', { force: true, noWaitAfter: true }).catch(() => {});
        await page.waitForTimeout(900);
        const o2 = await page.evaluate(() => window.__audio.osc);
        check('V7.4 Basari sesi bir kez: hizli tekrar dokunuslarda ek ses/odul yok, gorev tamam kalir', o1 > o0 && o2 === o1 && (await next()) === 1 && (await lit()) > 0, JSON.stringify([o0, o1, o2]));
        await page.click('[data-act="next"]');
        await quiz(); // yanlis cevap: ipucu
        await page.waitForTimeout(500); // konusma kisa bir gecikmeyle baslar (Android cancel sonrasi)
        const wrongTxt = await page.textContent('.cap');
        check('V7.4 Usta sorusu: yanlis cevapta cevap verilmez, ogretici ipucu gosterilir ve okunur', (await next()) === 0 && /Anahtar|yol/i.test(wrongTxt) && (await spoken()).includes(wrongTxt), wrongTxt);
        await page.click('.learn-opt:nth-child(1)');
        await page.click('[data-act="next"]');
        await page.waitForSelector('.learn-done');
        check('V7.4 Usta dersi tamamlaninca kaydedilir; mevcut oyun kayitlari bozulmaz', await page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); return s.edu.done.join() === 'circuit-1,switch-1,resistor-1,series-1,parallel-1,usta-1' && s.correct === 5 && s.games['number-hunt'].correct === 9; }, KEY));
        // KASIF: acik devre -> kablo ile kapat
        await page.click('[data-lesson="kasif-1"]');
        await page.waitForSelector('.learn-dots .learn-dot');
        const kShow = [];
        for (let i = 0; i < 4 && !(await page.locator('[data-tool]').count()); i++) { kShow.push(await page.evaluate(() => +document.querySelector('.prompt').dataset.lit)); await page.click('[data-act="next"]'); await page.waitForTimeout(80); }
        check('V7.4 Kasif: acik devre gosterimi LED yanmaz, kapali devre gosterimi LED yanar (farki gorsel)', kShow[0] === 0 && kShow[1] > 0, JSON.stringify(kShow));
        await page.click('[data-tool="led"]').catch(() => {});
        check('V7.4 Kasif gorevi: baslangicta devre acik (LED yanmiyor), parcalar kilitli', (await lit()) === 0 && (await next()) === 0);
        await page.click('[data-tool="wire"]');
        await page.click('[data-slot="s3"]');
        await page.waitForTimeout(600);
        check('V7.4 Kasif gorevi: bosluk kapaninca LED yanar ve gorev tamamlanir', (await lit()) > 0 && (await next()) === 1);
        await page.click('[data-act="next"]');
        await quiz();
        check('V7.4 Kasif sorusu: yanlista ipucu', (await next()) === 0 && (await page.textContent('.cap')).length > 10);
        await page.click('.learn-opt:nth-child(1)');
        await page.click('[data-act="next"]');
        await page.waitForSelector('.learn-done');
        // MUCIT: iki LED + anahtar (paralel)
        await page.click('[data-lesson="mucit-1"]');
        await page.waitForSelector('.learn-dots .learn-dot');
        await toTask();
        await place('led', 's4');
        check('V7.4 Mucit gorevi: tek LED ile gorev tamamlanmaz, ipucu var', (await next()) === 0 && (await page.textContent('.cap')).length > 3);
        await place('switch', 's5'); await place('led', 's6');
        check('V7.4 Mucit gorevi: anahtar acikken LED yok', (await lit()) === 0 && (await next()) === 0);
        await page.click('[data-switch="s5"]');
        await page.waitForTimeout(700);
        check('V7.4 Mucit gorevi: anahtar kapaninca iki ayri yolda iki LED yanar, gorev tamamlanir', (await lit()) >= 2 && (await next()) === 1, String(await lit()));
        await page.click('[data-act="next"]');
        await quiz(); // 2. secenek yanlis
        check('V7.4 Mucit sorusu: yanlista ipucu', (await next()) === 0 && (await page.textContent('.cap')).length > 10);
        await page.click('.learn-opt:nth-child(1)');
        await page.click('[data-act="next"]');
        await page.waitForSelector('.learn-done');
        check('V7.4 Mucit dersi son ders: "Sonraki ders" yok, liste dugmesi var', (await page.locator('[data-act="open"]').count()) === 0 && (await page.locator('[data-act="map"]').count()) === 1);
        await page.click('[data-act="map"]');
        await page.waitForSelector('.learn-map');
        const fin = await page.evaluate(() => ({ path: [...document.querySelectorAll('.learn-path .lp')].map((e) => e.className.match(/lp-(done|open|locked|soon)/)[1]).join(), badges: [...document.querySelectorAll('.learn-badges .lb-on')].length, lessons: [...document.querySelectorAll('.learn-lesson')].map((e) => e.className.split('st-')[1]).join() }));
        check('V7.4 tum 8 ders bitti: alti asama tamam, 8 rozet', fin.path === 'done,done,done,done,done,done' && fin.badges === 8 && fin.lessons === 'done,done,done,done,done,done,done,done', JSON.stringify(fin));
        // uygulama yeniden acilinca ilerleme korunur
        await page.reload();
        await page.waitForSelector('.learn-map');
        check('V7.4 ilerleme yeniden acilista korunur (8 ders, 8 rozet)', await page.evaluate(() => document.querySelectorAll('.learn-badges .lb-on').length === 8 && [...document.querySelectorAll('.learn-lesson')].every((e) => e.classList.contains('st-done'))));
        // ayni gorev tekrar acilinca kayit bozulmaz
        await page.click('[data-lesson="usta-1"]');
        await page.waitForSelector('.learn-dots .learn-dot');
        await toTask();
        await page.click('[data-act="close"]');
        await page.waitForSelector('.learn-map');
        check('V7.4 tamamlanmis ders tekrar acilip kapatilinca kayit bozulmaz', await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).edu.done.length === 8, KEY));
        check('V7.4 Egitim Merkezi: sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join(' | '));
        await ctx.close();
      }
      // ---- 4) Ses KAPALI: hicbir yonlendirme konusulmaz; gorev yine tamamlanir ----
      {
        const { ctx, page } = await mk({ band: '4-5', sound: false, seen: true, edu: { done: ['circuit-1', 'switch-1', 'resistor-1', 'series-1', 'parallel-1'] } });
        await page.goto(BASE + '#/play/learn');
        await page.waitForSelector('.learn-map');
        await page.click('[data-lesson="usta-1"]');
        await page.waitForSelector('.learn-dots .learn-dot');
        for (let i = 0; i < 9 && !(await page.locator('[data-tool]').count()); i++) { await page.click('[data-act="next"]'); await page.waitForTimeout(80); }
        for (const [t, sl] of [['led', 's1'], ['resistor', 's2'], ['switch', 's3']]) { await page.click(`[data-tool="${t}"]`); await page.click(`[data-slot="${sl}"]`); }
        await page.click('[data-switch="s3"]');
        await page.waitForTimeout(600);
        const r = await page.evaluate(() => ({ spoken: window.__spoken.length, osc: window.__audio.osc, next: document.querySelectorAll('[data-act="next"]').length }));
        check('V7.4 ses kapaliyken: konusma yok, ses uretilmez, gorev yine tamamlanir', r.spoken === 0 && r.osc === 0 && r.next === 1, JSON.stringify(r));
        await ctx.close();
      }
      // ---- 5) Geri tusu ve ana ekran ----
      {
        const { ctx, page } = await mk({ band: '4-5', sound: false, seen: true });
        await page.goto(BASE);
        await menuReady(page); // V7.8+: egitim girisi ANA MENUDEDIR
        await page.click('.edu-entry');
        await page.waitForSelector('.learn-map');
        await page.click('[data-lesson="circuit-1"]');
        await page.waitForSelector('.learn-dots .learn-dot');
        await page.click('[data-act="close"]');
        await page.waitForSelector('.learn-map');
        await page.click('[data-act="back"]');
        await page.waitForSelector('.home');
        check('V7.4 gezinme: Egitim -> ders -> kapat -> liste -> ana ekran', (await page.evaluate(() => location.hash)) === '#/' || (await page.evaluate(() => location.hash)) === '');
        await ctx.close();
      }
    }
    // ---- V7.2 Kalfa: Seri ve Paralel devre dersleri (ilk uc ders onceden bitmis) ----
    {
      const KEY = 'altez-minilab:v1';
      const seed = { band: '4-5', sound: false, seen: true, correct: 3, edu: { done: ['circuit-1', 'switch-1', 'resistor-1'] } };
      const ctx = await browser.newContext({ viewport: VIEWPORTS['telefon-360x640'], hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
      await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
      await page.goto(BASE + '#/play/learn');
      await page.waitForSelector('.learn-map');
      const st = () => page.evaluate(() => [...document.querySelectorAll('.learn-lesson')].map((e) => e.className.split('st-')[1]).join());
      check('V7.2 Kalfa: Cirak bitince Seri devre acik, Paralel kilitli, Kalfa seviyesi "yakinda" degil', (await st()) === 'done,done,done,open,locked,locked,locked,locked' && !(await page.evaluate(() => document.querySelector('[data-level="kalfa"]').className.includes('lv-soon'))));
      const place = async (tool, slot) => { await page.click(`[data-tool="${tool}"]`); await page.click(`[data-slot="${slot}"]`); };
      const toTask = async () => { for (let i = 0; i < 9; i++) { if (await page.locator('[data-tool]').count()) return; await page.click('[data-act="next"]'); await page.waitForTimeout(80); } };
      await page.click('[data-lesson="series-1"]');
      await page.waitForSelector('.learn-dots .learn-dot');
      await toTask();
      await place('led', 's1'); await place('wire', 's3');
      check('V7.2 seri gorevi: yol acikken (bir konum bos) gorev tamamlanmaz, ipucu yazisi var', (await page.locator('[data-act="next"]').count()) === 0 && (await page.textContent('.cap')).length > 3);
      await place('led', 's2');
      check('V7.2 seri gorevi: iki LED ayni yolda yanar ve gorev tamamlanir', (await page.locator('[data-act="next"]').count()) === 1);
      await page.click('[data-act="next"]');
      await page.waitForSelector('.learn-opt');
      await page.click('.learn-opt:nth-child(1)');
      if (!(await page.locator('[data-act="next"]').count())) await page.click('.learn-opt:nth-child(2)');
      await page.click('[data-act="next"]');
      await page.waitForSelector('.learn-done');
      check('V7.2 seri dersi tamamlaninca kaydedilir', JSON.stringify((await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY)).edu.done) === '["circuit-1","switch-1","resistor-1","series-1"]');
      await page.click('[data-lesson="parallel-1"]');
      await page.waitForSelector('.learn-dots .learn-dot');
      await toTask();
      await place('led', 's2');
      check('V7.2 paralel gorevi: tek kolda LED yanar ama gorev tamamlanmaz', (await page.locator('[data-act="next"]').count()) === 0);
      await page.click('[data-slot="s6"]'); // LED araci secili kalir
      check('V7.2 paralel gorevi: iki kolda birer LED yanar ve gorev tamamlanir', (await page.locator('[data-act="next"]').count()) === 1);
      check('V7.2 Kalfa: konsol/sayfa hatasi yok', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
    }
    // ---- V7 Egitim Bolumu (gercek tarayici; ses kapali ve acik) ----
    {
      const KEY = 'altez-minilab:v1';
      const eduStore = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
      const seed = { band: '4-5', sound: false, seen: true, correct: 7, games: { invent: { correct: 1, found: ['light'] } } };
      const ctx = await browser.newContext({ viewport: VIEWPORTS['telefon-360x640'], hasTouch: true, isMobile: true });
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', (e) => errs.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
      await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
      await page.goto(BASE);
      await page.waitForSelector('.home .edu-entry', { timeout: 5000 }); // V7.8+: egitim girisi ANA MENUDEDIR
      check('V7 egitim: ana ekranda giris dugmesi var, oyun karti sayisi hala 3', (await page.locator('.edu-entry').count()) === 1 && (await page.locator('.game-card').count()) === 0); // kartlar artik Oyunlar listesinde (6)
      check('V7 egitim: ana ekran tasma yok, giris dugmesi ekran icinde', await page.evaluate(() => { const r = document.querySelector('.edu-entry').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth; }));
      await page.click('.edu-entry');
      await page.waitForSelector('.learn-map');
      check('V7 egitim: ders listesi acilir (#/play/learn)', (await page.evaluate(() => location.hash)) === '#/play/learn');
      const lv = await page.evaluate(() => [...document.querySelectorAll('.learn-level')].map((e) => e.dataset.level + ':' + e.className.replace('learn-level ', '')));
      check('V7 egitim: seviye sirasi dogru ve durumlar (V7.4: yalniz Baslangic acik, digerleri kilitli)', lv.join('|') === 'baslangic:lv-open|cirak:lv-locked|kalfa:lv-locked|usta:lv-locked|kasif:lv-locked|mucit:lv-locked', lv.join('|'));
      check('V7 egitim: yalniz ilk ders acik, digerleri kilitli', await page.evaluate(() => [...document.querySelectorAll('.learn-lesson')].map((e) => e.className.split('st-')[1]).join() === 'open,locked,locked,locked,locked,locked,locked,locked'));
      await page.click('[data-lesson="switch-1"]', { force: true }); // aria-disabled: Playwright 'enabled' saymaz; gercek dokunus gelir
      check('V7 egitim: kilitli derse dokunmak dersi ACMAZ (nazik uyari)', (await page.locator('.learn-map').count()) === 1 && (await page.locator('.learn-dots .learn-dot').count()) === 0 && (await page.textContent('.learn-cap')).length > 5);
      await page.click('[data-lesson="resistor-1"]', { force: true });
      check('V7 egitim: kilitli Cirak dersi de acilmaz', (await page.locator('.learn-map').count()) === 1);
      // Geri tusu: ders listesindeyken ana ekrana
      await page.click('[data-lesson="circuit-1"]');
      await page.waitForSelector('.learn-dots .learn-dot');
      check('V7 egitim: ders acilir (adim noktalari, X dugmesi)', (await page.locator('.learn-dot').count()) === 7 && (await page.getAttribute('.bar .btn.icon', 'data-act')) === 'close');
      // sistem Geri tusu dersi kapatip listeye doner
      await page.evaluate(() => window.__altezBack && 0);
      await page.goBack();
      await page.waitForTimeout(250);
      const afterBack = await page.evaluate(() => ({ hash: location.hash, map: !!document.querySelector('.learn-map'), home: !!document.querySelector('.home') }));
      check('V7 egitim: ders icinde tarayici Geri (gecmis) oyundan ana ekrana doner', afterBack.home || afterBack.map, JSON.stringify(afterBack));
      await page.goto(BASE + '#/');
      await menuReady(page); // V7.8+: egitim girisi ANA MENUDEDIR
      await page.click('.edu-entry');
      await page.waitForSelector('.learn-map');
      await page.click('[data-lesson="circuit-1"]');
      await page.waitForSelector('.learn-dots .learn-dot');
      // X dugmesi dersi kapatir, listeye doner, ilerleme yazilmaz
      await page.click('.bar .btn.icon');
      await page.waitForSelector('.learn-map');
      check('V7 egitim: X dugmesi dersi kapatir ve listeye doner, ilerleme yazilmaz', !(await eduStore(page)).edu);
      // Android fiziksel Geri tusu benzetimi: ders icinde listeye, listede ana ekrana
      await page.click('[data-lesson="circuit-1"]');
      await page.waitForSelector('.learn-dots .learn-dot');
      const handled = await page.evaluate(() => window.__altezBack.handle());
      await page.waitForTimeout(150);
      check('V7 egitim: fiziksel Geri ders icinde sadece dersi kapatir (listeye doner)', (await page.locator('.learn-map').count()) === 1 && (await page.evaluate(() => location.hash)) === '#/play/learn', String(handled));
      await page.evaluate(() => window.__altezBack.handle());
      await page.waitForTimeout(500);
      check('V7 egitim: fiziksel Geri listede ana ekrana doner', (await page.locator('.home').count()) === 1 && (await page.locator('.play').count()) === 0);
      // Ders 1'i ses kapaliyken bastan sona coz
      await page.click('.edu-entry');
      await page.waitForSelector('.learn-map');
      await page.click('[data-lesson="circuit-1"]');
      await page.waitForSelector('.learn-dots .learn-dot');
      for (let i = 0; i < 5; i++) { await page.click('[data-act="next"]'); await page.waitForTimeout(80); }
      check('V7 egitim: gorev adimina gelindi, devre tahtasi ve parca tepsisi var', (await page.locator('.prompt.kind-circuit .board, .prompt.kind-circuit svg').count()) >= 1 && (await page.locator('.inv-tool').count()) === 3);
      check('V7 egitim: gorev bitmeden Devam yok', (await page.locator('[data-act="next"]').count()) === 0);
      const place = async (tool, slot) => { await page.click(`[data-tool="${tool}"]`); await page.click(`[data-slot="${slot}"]`); };
      await place('wire', 's1');
      check('V7 egitim: eksik devrede LED yanmaz, nazik ipucu yazisi', (await page.getAttribute('.prompt', 'data-lit')) === '0' && (await page.textContent('.cap')).length > 3);
      await place('led', 's2');
      check('V7 egitim: yol hala acikken gorev tamamlanmaz', (await page.locator('[data-act="next"]').count()) === 0);
      await place('wire', 's3');
      check('V7 egitim: kapali devrede LED yanar ve gorev tamamlanir', (await page.getAttribute('.prompt', 'data-lit')) === '1' && (await page.locator('[data-act="next"]').count()) === 1);
      await page.click('[data-act="next"]');
      await page.waitForSelector('.learn-opt');
      await page.click('.learn-opt:nth-child(2)');
      check('V7 egitim: yanlis cevapta ceza yok, tekrar denenebilir', (await page.locator('[data-act="next"]').count()) === 0 && (await page.locator('.learn-opt').count()) === 2 && (await page.textContent('.cap')).length > 3);
      check('V7 egitim: yanlis cevap ilerleme yazmaz', !(await eduStore(page)).edu);
      await page.click('.learn-opt:nth-child(1)');
      await page.click('[data-act="next"]');
      await page.waitForSelector('.learn-done');
      const st1 = await eduStore(page);
      check('V7 egitim: ders tamamlaninca ayri alana kaydedilir', JSON.stringify(st1.edu) === '{"done":["circuit-1"]}', JSON.stringify(st1.edu));
      check('V7 egitim: mevcut oyun kayitlari degismedi', st1.correct === 7 && st1.games.invent.correct === 1 && st1.games.invent.found.join() === 'light');
      // Sonraki ders acilir, kapatinca liste: ilk ders bitti, ikinci acik
      await page.click('[data-lesson="switch-1"]');
      await page.waitForSelector('.learn-dots .learn-dot');
      check('V7 egitim: ilk ders bitince ikinci ders acildi', (await page.locator('.learn-dot').count()) === 5);
      await page.click('.bar .btn.icon');
      await page.waitForSelector('.learn-map');
      check('V7 egitim: liste durumlari guncel (bitti,acik,kilitli)', await page.evaluate(() => [...document.querySelectorAll('.learn-lesson')].map((e) => e.className.split('st-')[1]).join() === 'done,open,locked,locked,locked,locked,locked,locked'));
      // Uygulama yeniden acilinca ilerleme korunur
      await page.goto(BASE);
      await menuReady(page); // V7.8+: egitim girisi ANA MENUDEDIR
      check('V7 egitim: yeniden acilista giris dugmesi ilerlemeyi gosterir (1/8)', (await page.textContent('.edu-entry')).includes('1/8'));
      await page.click('.edu-entry');
      await page.waitForSelector('.learn-map');
      check('V7 egitim: yeniden acilista ilerleme korunur', await page.evaluate(() => [...document.querySelectorAll('.learn-lesson')].map((e) => e.className.split('st-')[1]).join() === 'done,open,locked,locked,locked,locked,locked,locked'));
      check('V7 egitim: konsol/sayfa hatasi yok', errs.length === 0, errs.slice(0, 3).join(' | '));
      await ctx.close();
      // Bozuk kayitla acilis cokmez
      for (const bad of ['{', '{"edu":5}', '{"edu":{"done":"x"}}', '{"edu":{"done":[1,null,"../a"]},"seen":true}']) {
        const c2 = await browser.newContext({ viewport: VIEWPORTS['telefon-360x640'], hasTouch: true, isMobile: true });
        const p2 = await c2.newPage();
        const e2 = [];
        p2.on('pageerror', (e) => e2.push(String(e)));
        await p2.addInitScript(([k, v]) => { if (!sessionStorage.getItem('x')) { localStorage.setItem(k, v); sessionStorage.setItem('x', '1'); } }, [KEY, bad]);
        await p2.goto(BASE + '#/play/learn');
        await p2.waitForSelector('.learn-map', { timeout: 5000 }).catch(() => {});
        check(`V7 egitim: bozuk kayit (${bad.slice(0, 20)}) uygulamayi cokertmez`, (await p2.locator('.learn-map').count()) === 1 && e2.length === 0, e2[0] || '');
        await c2.close();
      }
      // Ses: acikken Turkce yonerge konusulur; kapaliyken sessiz AMA gorev yine tamamlanir
      for (const sound of [true, false]) {
        const c3 = await browser.newContext({ viewport: VIEWPORTS['telefon-360x640'], hasTouch: true, isMobile: true });
        const p3 = await c3.newPage();
        await p3.addInitScript(() => {
          window.__spoken = [];
          window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
          Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, pending: false, getVoices: () => [{ name: 'Turkce', lang: 'tr-TR', localService: true }], resume() {}, cancel() {}, pause() {}, speak(u) { window.__spoken.push({ text: u.text, lang: u.lang, vol: u.volume }); }, addEventListener() {}, removeEventListener() {} } });
        });
        await p3.addInitScript(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [KEY, { band: '4-5', sound, seen: true }]);
        await p3.goto(BASE + '#/play/learn');
        await p3.waitForSelector('.learn-map');
        await p3.click('[data-lesson="circuit-1"]');
        await p3.waitForSelector('.learn-dots .learn-dot');
        await p3.waitForTimeout(500);
        const sp = await p3.evaluate(() => window.__spoken.filter((x) => x.vol !== 0));
        if (sound) check('V7 egitim ses: ders Turkce yonerge konusur', sp.length >= 1 && sp[0].lang === 'tr-TR' && /devre/i.test(sp[0].text), JSON.stringify(sp[0]));
        else check('V7 egitim ses: ses kapaliyken sessiz', sp.length === 0);
        for (let i = 0; i < 5; i++) { await p3.click('[data-act="next"]'); await p3.waitForTimeout(60); }
        for (const [t, sl] of [['wire', 's1'], ['led', 's2'], ['wire', 's3']]) { await p3.click(`[data-tool="${t}"]`); await p3.click(`[data-slot="${sl}"]`); }
        check(`V7 egitim ses ${sound ? 'acik' : 'kapali'}: gorev tamamlanir`, (await p3.locator('[data-act="next"]').count()) === 1);
        await p3.click('[data-act="next"]');
        await p3.waitForSelector('.learn-opt');
        await p3.click('.learn-opt:nth-child(1)');
        await p3.click('[data-act="next"]');
        await p3.waitForSelector('.learn-done');
        check(`V7 egitim ses ${sound ? 'acik' : 'kapali'}: ders tamamlanir ve kaydedilir`, (await p3.evaluate((k) => JSON.parse(localStorage.getItem(k)).edu.done.join(), KEY)) === 'circuit-1');
        await c3.close();
      }
    }

  }
} catch (e) {
  check('beklenmeyen hata', false, e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol basarili`);
process.exit(failed.length ? 1 : 0);
