// V7.8 HEDEFLI tarayici testi - YENI ANA MENU + OYUNLAR EKRANI + MiniLab MASKOTU + hafif hareketler (Chromium).
// Tam arayuz duman testi (545) ve diger hedefli testler bu dosyadan AYRIDIR.
//   node scripts/ui-v78-home.mjs                      -> calistirir (cikis kodu 0 = hepsi basarili)
//   ONLY=C node scripts/ui-v78-home.mjs               -> yalniz C bolumu; SHOTS=/yol node ... -> ekran goruntuleri de kaydeder
// Tam arayuz duman testi (scripts/ui-smoke.mjs) bu dosyadan AYRIDIR ve burada calistirilmaz.
// Playwright PROJE BAGIMLILIGI DEGILDIR (makinede kurulu olmali; PLAYWRIGHT_PATH ile yol verilebilir).
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
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
const ONLY = process.env.ONLY || ''; // orn. ONLY=E -> yalniz E bolumu (varsayilan: hepsi)
const on = (x) => !ONLY || ONLY.includes(x);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok: !!ok, info });
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${ok || !info ? '' : '  -> ' + info}`);
};

const KEY = 'altez-minilab:v1';
const server = await startServer(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();

// Konusma + ses uretimi casuslari (V7.4 smoke ile ayni yaklasim)
const spyInit = () => {
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; } };
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: { speaking: false, pending: false, getVoices: () => [{ name: 'Turkce', lang: 'tr-TR', localService: true }], resume() {}, cancel() {}, speak(u) { window.__spoken.push({ text: u.text, vol: u.volume }); setTimeout(() => u.onend && u.onend(), 20); } } });
  const Base = window.AudioContext || window.webkitAudioContext;
  window.__audio = { osc: 0 };
  if (Base) window.AudioContext = class extends Base { createOscillator() { const o = super.createOscillator(); window.__audio.osc += 1; return o; } };
};
const VP = { phone: { width: 360, height: 640 }, small: { width: 320, height: 568 }, land: { width: 640, height: 360 } };
const mk = async (seed, vp = VP.phone) => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  const external = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
  await page.addInitScript(spyInit);
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  return { ctx, page, errs, external };
};
const shot = async (page, name) => SHOTS && (await page.screenshot({ path: `${SHOTS}/${name}.png` }));
const spoken = (page) => page.evaluate(() => window.__spoken.filter((x) => x.vol !== 0).map((x) => x.text));
const osc = (page) => page.evaluate(() => window.__audio.osc);
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const cap = (page) => page.textContent('.cap');
const nextCount = (page) => page.locator('[data-act="next"]').count();
// Parca secimi ACMA/KAPAMA dugmesidir (ayni parcaya tekrar dokunmak secimi kaldirir): zaten secili ise tekrar secme
const place = async (page, tool, slot) => {
  const sel = `[data-tool="${tool}"]`;
  if ((await page.getAttribute(sel, 'aria-pressed')) !== 'true') await page.click(sel);
  await page.click(`[data-slot="${slot}"]`);
};
const toTask = async (page) => { for (let i = 0; i < 9; i++) { if (await page.locator('[data-tool]').count()) return; await page.click('[data-act="next"]'); await page.waitForTimeout(90); } };
const openLesson = async (page, id) => { await page.click(`[data-lesson="${id}"]`); await page.waitForSelector('.learn-dots .learn-dot'); };
const rewardInfo = (page) => page.evaluate(() => {
  const r = document.querySelector('.learn-reward');
  const m = document.querySelector('.learn-meter');
  const q = (s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() || '';
  return { isNew: r?.dataset.new, badge: r?.dataset.badge, head: q('.lr-text b'), title: q('.lr-text i'), learned: q('.learn-learned'), count: m?.dataset.count, total: m?.dataset.total, on: document.querySelectorAll('.lmd.on').length, level: q('.learn-levelup'), levelId: document.querySelector('.learn-levelup')?.dataset.level || '', q: q('.learn-q'), sub: q('.learn-sub') };
});
const inView = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].every((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }), sel);
const noHOverflow = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);

const SEED = (band, extra = {}) => ({ band, sound: true, seen: true, correct: 5, games: { 'number-hunt': { correct: 9 } }, edu: { done: ['circuit-1', 'switch-1'] }, ...extra });
const W = (page, ms = 420) => page.waitForTimeout(ms); // ekran gecisi korumasi (350 ms) + animasyon
const tap = async (page, sel, ms = 420) => { await W(page, ms); await page.click(sel); };
const inViewX = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].length > 0 && [...document.querySelectorAll(s)].every((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1; }), sel);
const lit = (page) => page.evaluate(() => document.querySelector('.tk-prompt')?.dataset.lit);
const powered = (page) => page.locator('.tk-prompt svg.board.power').count();
const toHub = async (page) => { await page.goto(BASE + '?home=1'); await page.waitForSelector('.home'); await tap(page, '.tasks-entry'); await page.waitForSelector('.tk-hub'); };
const openGame = async (page, id) => { await tap(page, `[data-game="${id}"]`); await page.waitForSelector('.tk-list'); };
const openCase = async (page, id) => { await tap(page, `.tk-task[data-task="${id}"]`); await page.waitForSelector('.tk-prompt'); await W(page, 450); };
const doneInfo = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const r = document.querySelector('.tk-reward');
  return { isNew: r?.dataset.new, badge: r?.dataset.badge, head: q('.lr-text b'), note: q('.tk-replaynote'), noteCount: document.querySelectorAll('.tk-replaynote').length, alldone: document.querySelectorAll('.tk-alldone').length, count: document.querySelector('.tk-meter')?.dataset.count, total: document.querySelector('.tk-meter')?.dataset.total, trophy: q('.tk-trophy'), q: q('.tk-q') };
});
const finish = async (page) => { await tap(page, '[data-act="finish"]'); await page.waitForSelector('.tk-done'); await W(page, 500); };
const backToList = async (page) => { await tap(page, '[data-act="list"]'); await page.waitForSelector('.tk-list'); };
const tasksOf = async (page, id) => (await store(page))?.games?.[id]?.done || [];


const DET = JSON.parse(readFileSync(new URL('../assets/data/detective.json', import.meta.url), 'utf8'));
const LSD = JSON.parse(readFileSync(new URL('../assets/data/logic-science.json', import.meta.url), 'utf8'));
const NEW = ['d13-seri-lambalar', 'd14-kumanda-parcasi', 'd15-kisa-yol', 'd16-sessiz-kol', 'd17-yorgun-pil'];
const OLD6 = DET.tasks.filter((t) => t.bands.includes('6-8') && !NEW.includes(t.id)).map((t) => t.id);

// Ses izleyici: her osilatorun (olusturma anı, baslangic, bitis) kaydi -> "calma" kumeleri ve ust uste binme denetimi
const spyOsc = () => {
  window.__osc = [];
  const Base = window.AudioContext || window.webkitAudioContext;
  if (Base) window.AudioContext = class extends Base {
    createOscillator() {
      const o = super.createOscillator();
      const rec = { w: performance.now(), t0: 0, t1: 0 };
      window.__osc.push(rec);
      const s = o.start.bind(o);
      const e = o.stop.bind(o);
      o.start = (t) => { rec.t0 = t; return s(t); };
      o.stop = (t) => { rec.t1 = t; return e(t); };
      return o;
    }
  };
};
const mk2 = async (seed, vp = VP.phone, opts = {}) => {
  const r = await mk(seed, vp);
  if (opts.osc) await r.page.addInitScript(spyOsc);
  if (opts.reduced) await r.page.emulateMedia({ reducedMotion: 'reduce' });
  return r;
};
const plays = (page) => page.evaluate(() => {
  const o = window.__osc.slice().sort((a, b) => a.w - b.w);
  const out = [];
  for (const x of o) {
    const last = out[out.length - 1];
    if (last && x.w - last.w1 < 25) { last.w1 = x.w; last.n += 1; last.t0 = Math.min(last.t0, x.t0); last.t1 = Math.max(last.t1, x.t1); }
    else out.push({ w0: x.w, w1: x.w, n: 1, t0: x.t0, t1: x.t1 });
  }
  return out.map((p) => ({ at: Math.round(p.w0), n: p.n, dur: Math.round((p.t1 - p.t0) * 1000) }));
});
const openFirst = async (page, game, id) => { await toHub(page); await openGame(page, game); await openCase(page, id); };
const clickItems = async (page, order) => { for (const i of order) { await page.click(`[data-item="${i}"]`); await W(page, 90); } };
const bandSeed = (band, done = {}) => SEED(band, { games: { 'number-hunt': { correct: 9 }, ...done } });


const ENV = Object.fromEntries(readFileSync(new URL('./version.env', import.meta.url), 'utf8').split('\n').map((l) => l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/"/g, '').trim()]));
const VER = 'V' + ENV.VERSION_NAME_DEFAULT;
const STR = JSON.parse(readFileSync(new URL('../assets/data/strings.tr.json', import.meta.url), 'utf8'));
const GAMES = ['shape-complete', 'number-hunt', 'invent', 'detective', 'logic-science', 'energy-adventure'];
const VPS = [['360x640', VP.phone], ['320x568', VP.small], ['640x360 yatay', VP.land]];
const toMenu = async (page) => { await page.goto(BASE + '?home=1'); await page.waitForSelector('.menu'); await W(page, 500); };
const toGames = async (page) => { await page.goto(BASE + '#/games'); await page.waitForSelector('.home.games'); await W(page, 400); };
const maState = (page) => page.evaluate(() => { const m = document.querySelector('.mascot'); return { last: m.dataset.last, count: Number(m.dataset.count || 0), mode: m.dataset.mode, mood: m.dataset.mood, show: m.classList.contains('show'), text: m.querySelector('.m-bubble').textContent }; });

try {
  // ======================= A) Ana Menu: 4 bolum, surum, dokunma hedefi, tasma yok =======================
  if (on('A')) {
    for (const band of ['4-5', '6-8']) {
      for (const [nm, vp] of VPS) {
        const { ctx, page, errs } = await mk2(bandSeed(band), vp);
        await toMenu(page);
        const r = await page.evaluate(() => {
          const vw = innerWidth, vh = innerHeight;
          const cards = [...document.querySelectorAll('.menu-card')];
          const box = (e) => e.getBoundingClientRect();
          const mc = document.querySelector('.menu');
          return {
            titles: cards.map((c) => c.querySelector('.mc-t').textContent),
            inView: cards.every((c) => { const b = box(c); return b.left >= -1 && b.right <= vw + 1 && b.top >= -1 && b.bottom <= vh + 1; }),
            minSide: Math.min(...cards.map((c) => Math.min(box(c).width, box(c).height))),
            noH: document.documentElement.scrollWidth <= vw + 1,
            fits: mc.scrollHeight <= mc.clientHeight + 1,
            ver: document.querySelector('.menu-ver')?.textContent,
            chips: [...document.querySelectorAll('.home-ctl .btn')].every((c) => { const b = box(c); return b.left >= -1 && b.right <= vw + 1 && b.top >= -1 && b.bottom <= vh + 1; }),
            logo: (() => { const i = document.querySelector('.menu .logo'); const b = box(i); return i.complete && i.naturalWidth > 0 && b.right <= vw + 1 && b.left >= -1; })()
          };
        });
        check(`A1 ${band} ${nm}: dort bolum sirayla Oyunlar / Eğitim / Profil / Ebeveyn, hepsi ekran icinde, dokunma hedefi >= 72px`, JSON.stringify(r.titles) === JSON.stringify(['Oyunlar', 'Eğitim', 'Profil', 'Ebeveyn']) && r.inView && r.minSide >= 72, JSON.stringify(r));
        check(`A2 ${band} ${nm}: tasma yok, menu kaydirmadan sigar, yas/ses dugmeleri ve logo ekran icinde`, r.noH && r.fits && r.chips && r.logo, JSON.stringify(r));
        check(`A3 ${band} ${nm}: surum etiketi koddan: "Sürüm ${VER}" (eski V7.7 yok)`, r.ver === `Sürüm ${VER}` && !(await page.content()).includes('V7.7'), r.ver);
        const st = await page.evaluate(() => ({ prof: document.querySelector('.mc-profile .mc-dev')?.textContent, par: document.querySelector('.mc-parent .mc-dev')?.textContent, size: Math.min(...[...document.querySelectorAll('.mc-dev')].map((e) => parseFloat(getComputedStyle(e).fontSize))), live: document.querySelectorAll('.mc-profile[data-game],.mc-parent[data-game],.mc-profile[data-act="play"],.mc-parent[data-act="play"]').length }));
        check(`A4 ${band} ${nm}: Profil ve Ebeveyn kartlarinda "GELİŞTİRME AŞAMASINDA" yazisi (okunur punto >= 10px), oyun baslatici degil`, st.prof === 'GELİŞTİRME AŞAMASINDA' && st.par === 'GELİŞTİRME AŞAMASINDA' && st.size >= 10 && st.live === 0, JSON.stringify(st));
        if (band === '4-5') await shot(page, `home-menu-${nm.split(' ')[0]}`);
        check(`A5 ${band} ${nm}: sayfa/konsol hatasi yok`, errs.length === 0, errs.slice(0, 2).join('|'));
        await ctx.close();
      }
    }
    // beyaz yazi / kart zemini kontrasti (buyuk kalin yazi icin >= 3:1; en acik gradyan ucu uzerinden)
    const { ctx, page } = await mk2(bandSeed('4-5'));
    await toMenu(page);
    const cs = await page.evaluate(() => {
      const lum = (hex) => { const n = parseInt(hex.replace('#', ''), 16); const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255); };
      return ['mc-games', 'mc-edu', 'mc-profile', 'mc-parent'].map((c) => { const e = document.querySelector('.' + c); const a = getComputedStyle(e).getPropertyValue('--mc-a').trim(); const b = getComputedStyle(e).getPropertyValue('--mc-b').trim(); const r = (h) => (1.05) / (lum(h) + 0.05); return { c, a, b, ca: +r(a).toFixed(2), cb: +r(b).toFixed(2) }; });
    });
    check('A6 kart basliklari: beyaz yazi / gradyan ucu kontrasti >= 2.8 (buyuk kalin yazi + golge)', cs.every((x) => x.ca >= 2.8 && x.cb >= 2.8), JSON.stringify(cs));
    await ctx.close();
  }

  // ======================= B) Gezinme: Oyunlar -> 5 oyun, Geri, Egitim, Profil/Ebeveyn =======================
  if (on('B')) {
    const { ctx, page, errs } = await mk2(bandSeed('4-5'));
    await toMenu(page);
    const before = JSON.stringify(await store(page));
    await tap(page, '.mc-games');
    await page.waitForSelector('.home.games');
    const g = await page.evaluate(() => ({ ids: [...document.querySelectorAll('.game-card')].map((c) => c.dataset.game), title: document.querySelector('.gm-title').textContent, soon: [...document.querySelectorAll('.soon-card')].map((c) => c.dataset.soon), hasBack: !!document.querySelector('[data-act="menu"]') }));
    check('B1 Oyunlar ekrani (V7.9): 6 oyun karti (+ Enerji Macerasi) sirayla; baslik "Oyunlar"; "Cok yakinda" karti kalmadi', JSON.stringify(g.ids) === JSON.stringify(GAMES) && g.title === 'Oyunlar' && JSON.stringify(g.soon) === '[]' && g.hasBack, JSON.stringify(g));
    const names = await page.$$eval('.game-card .gc-title', (e) => e.map((x) => x.textContent));
    check('B2 oyun adlari aynen korundu', JSON.stringify(names) === JSON.stringify(['Şekli Tamamla', 'Sayı Avı', 'Mucit Atölyesi', 'Elektrik Dedektifi', 'Mantık ve Bilim', 'Enerji Soruları']), JSON.stringify(names));
    for (const id of GAMES) {
      await tap(page, `.game-card[data-game="${id}"]`);
      await page.waitForSelector('section.play', { timeout: 6000 }).catch(() => {});
      const ok = (await page.locator('section.play').count()) === 1 && (await page.evaluate(() => location.hash)) === `#/play/${id}`;
      check(`B3 ${id}: Oyunlar ekranindan acilir`, ok, await page.evaluate(() => location.hash));
      if (id === 'detective' || id === 'logic-science') check(`B4 ${id}: gorev listesi acilir (Gorevler hub'i atlanir)`, (await page.locator('.tk-list .tk-task').count()) >= 8 && (await page.locator('.tk-hub').count()) === 0);
      const r = await page.evaluate(() => window.__altezBack.handle());
      await W(page, 700);
      check(`B5 ${id}: fiziksel Geri Oyunlar ekranina doner (6 kart)`, (await page.locator('.home.games .game-card').count()) === 6, String(r));
    }
    // Geri / ok -> menu
    await tap(page, '[data-act="menu"]');
    await page.waitForSelector('.menu');
    check('B6 Oyunlar ekraninda ← dugmesi Ana Menuye doner (menu 4 kart)', (await page.locator('.menu .menu-card').count()) === 4);
    await tap(page, '.mc-games');
    await page.waitForSelector('.home.games');
    const r2 = await page.evaluate(() => window.__altezBack.handle());
    await W(page, 700);
    check('B7 Oyunlar ekraninda fiziksel Geri Ana Menuye doner', (await page.locator('.menu .menu-card').count()) === 4, String(r2));
    const r3 = await page.evaluate(() => window.__altezBack.handle());
    check('B8 Ana Menude fiziksel Geri ekrani degistirmez (uygulama arka plana: tarayicida islem yok)', r3 !== 'leave' && (await page.locator('.menu').count()) === 1, String(r3));
    // Egitim
    await tap(page, '.edu-entry');
    await page.waitForSelector('.learn-map');
    check('B9 Egitim karti mevcut Egitim Merkezini acar (8 ders, 6 asama)', (await page.locator('.learn-lesson').count()) === 8 && (await page.locator('.learn-path .lp').count()) === 6);
    await page.evaluate(() => window.__altezBack.handle());
    await W(page, 700);
    check('B10 Egitimden Geri Ana Menuye doner', (await page.locator('.menu .menu-card').count()) === 4);
    check('B11 menu ve oyun listesinde gezinmek kaydi DEGISTIRMEZ', JSON.stringify(await store(page)) === before, '');
    check('B12 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();

    // dogrudan acilis (#/games) ve Geri
    const c2 = await mk2(bandSeed('4-5'));
    await toGames(c2.page);
    await c2.page.evaluate(() => window.__altezBack.handle());
    await W(c2.page, 600);
    check('B13 #/games dogrudan acilista Geri menuye doner (V8.1: yeni ana menu 5 kart; eski menu 4 kart)', (await c2.page.locator('.menu .menu-card').count()) === 4 || (await c2.page.locator('.mm-card').count()) === 5);
    await c2.ctx.close();

    // cok yakinda panelleri
    for (const [nm, vp] of VPS) {
      const c3 = await mk2(bandSeed('4-5'), vp);
      await toMenu(c3.page);
      const b0 = JSON.stringify(await store(c3.page));
      for (const [id, msg, note] of [['profile', 'Bu bölüm henüz hazır değil.', 'giriş yapman gerekmez'], ['parental', 'Bu bölüm henüz hazır değil.', 'PIN koruması yoktur']]) {
        await tap(c3.page, `.menu-card[data-soon="${id}"]`);
        await W(c3.page, 200);
        const d = await c3.page.evaluate(() => { const e = document.querySelector('.soon-dialog'); if (!e) return null; const r = e.getBoundingClientRect(); return { text: e.textContent.replace(/\s+/g, ' '), inside: (r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1) || e.scrollHeight > e.clientHeight, focus: document.activeElement?.dataset.act }; });
        check(`B14 ${nm}: ${id} paneli: GELİŞTİRME AŞAMASINDA + mesaj + durust not; sahte giris/PIN/sure yok; oyun acilmadi`, d && d.text.includes('GELİŞTİRME AŞAMASINDA') && d.text.includes(msg) && d.text.includes(note) && d.inside && d.focus === 'soon-close' && (await c3.page.locator('section.play').count()) === 0 && !/PIN girin|giriş yap$|şifre/i.test(d.text), JSON.stringify(d));
        const rr = await c3.page.evaluate(() => window.__altezBack.handle());
        await W(c3.page, 200);
        check(`B15 ${nm}: ${id} paneli fiziksel Geri ile kapanir`, rr === 'screen' && (await c3.page.locator('.soon-dialog').count()) === 0, String(rr));
      }
      check(`B16 ${nm}: paneller kayit yazmadi`, JSON.stringify(await store(c3.page)) === b0);
      await c3.ctx.close();
    }
    const c4 = await mk2(bandSeed('4-5'));
    await toGames(c4.page);
    await tap(c4.page, '.game-card[data-game="energy-adventure"]');
    await c4.page.waitForSelector('section.play');
    check('B17 Enerji Macerasi karti (V7.9): gercek oyun acilir, bilgi paneli yok', (await c4.page.locator('.soon-dialog').count()) === 0 && (await c4.page.locator('.adv-regions').count()) === 1);
    await c4.ctx.close();
  }

  // ======================= C) Oyun ilerlemesi/kayit korunur ve kartlarda dogru gorunur =======================
  if (on('C')) {
    const old77 = ['d3-acik-anahtar', 'd4-bosluk', 'd7-guvenli-isik'];
    const { ctx, page, errs } = await mk2(bandSeed('6-8', { detective: { correct: 3, done: DET.tasks.filter((t) => t.bands.includes('6-8')).slice(0, 3).map((t) => t.id) }, 'logic-science': { correct: 1, done: ['l1-tohum'] } }));
    await toGames(page);
    const t = await page.$$eval('.game-card .lv-name', (e) => e.map((x) => x.textContent));
    check('C1 Oyunlar ekraninda kayitli ilerleme: Elektrik Dedektifi "3 / 15 vaka", Mantik ve Bilim "1 / 16 görev"', t[3] === '3 / 15 vaka' && t[4] === '1 / 16 görev', JSON.stringify(t));
    await ctx.close();
    const c2 = await mk2(bandSeed('4-5', { detective: { correct: 0, done: [] } }));
    await toGames(c2.page);
    const t2 = await c2.page.$$eval('.game-card .lv-name', (e) => e.map((x) => x.textContent));
    check('C2 4-5 yas: "0 / 8 vaka" ve "0 / 8 görev"', t2[3] === '0 / 8 vaka' && t2[4] === '0 / 8 görev', JSON.stringify(t2));
    check('C3 yas dugmesi Oyunlar ekraninda calisir (6-8): sayilar guncellenir', await (async () => { await c2.page.click('.home.games [data-act="band"]'); await W(c2.page, 300); const x = await c2.page.$$eval('.game-card .lv-name', (e) => e.map((y) => y.textContent)); return x[3] === '0 / 15 vaka' && x[4] === '0 / 16 görev'; })());
    await c2.ctx.close();
    // eski kayit (V7.7 bicimi) ve bozuk kayit
    const c3 = await mk2({ correct: 12, band: '6-8', sound: true, seen: true, games: { 'number-hunt': { correct: 9 }, invent: { correct: 3, found: ['light'] }, detective: { correct: 2, done: ['d7-guvenli-isik', 'd8-kontrol-sende'] } }, edu: { done: ['circuit-1', 'switch-1'] } });
    await toMenu(c3.page);
    check('C4 V7.7 bicimli eski kayit: menu acilir, Egitim 2/8, hata yok', (await c3.page.textContent('.edu-entry')).includes('2/8') && c3.errs.length === 0, c3.errs.join('|'));
    await c3.ctx.close();
    const c4 = await browser.newContext({ viewport: VP.phone, hasTouch: true, isMobile: true });
    const p4 = await c4.newPage();
    const e4 = [];
    p4.on('pageerror', (e) => e4.push(String(e)));
    await p4.addInitScript((k) => localStorage.setItem(k, '{bozuk json'), KEY);
    await p4.goto(BASE + '?home=1');
    await p4.waitForSelector('.menu', { timeout: 9000 });
    check('C5 bozuk kayit: uygulama yine Ana Menuyle acilir', (await p4.locator('.menu-card').count()) === 4 && e4.length === 0, e4.join('|'));
    await c4.close();
  }

  // ======================= D) Maskot: tepkiler dogru olaylarda, tekrar yok, dokunmayi engellemez =======================
  if (on('D')) {
    const MS = STR.mascot.messages;
    const { ctx, page, errs } = await mk2(bandSeed('4-5'));
    await page.goto(BASE + '?home=1');
    await page.waitForSelector('.menu');
    await W(page, 900);
    let m = await maState(page);
    check('D1 menu acilinca kisa selam: "Merhaba Minik Kâşif!" (dalga animasyonu)', m.last === 'greet' && m.text === 'Merhaba Minik Kâşif!' && m.show && m.mood === 'wave' && m.mode === 'menu', JSON.stringify(m));
    await W(page, 3500);
    m = await maState(page);
    check('D2 selam kendiliginden kapanir (bubble gizli, maskot sakin)', !m.show && m.mood === 'idle', JSON.stringify(m));
    await tap(page, '.mc-games');
    await page.waitForSelector('.home.games');
    await W(page, 900);
    m = await maState(page);
    check('D3 Oyunlar bolumune girince tesvik edici tepki (enter)', m.last === 'enter' && MS.enter.includes(m.text) && m.mode === 'games', JSON.stringify(m));
    await tap(page, '[data-act="menu"]');
    await page.waitForSelector('.menu');
    await W(page, 1000);
    m = await maState(page);
    check('D4 menuye donunce selam TEKRARLANMAZ (oturumda bir kez)', m.last !== 'greet' || m.count === 2 /* greet + enter */, JSON.stringify(m));
    check('D4b menuye donunce "Merhaba" baloncugu gorunmez', !(m.show && m.text.startsWith('Merhaba')), JSON.stringify(m));
    // gorev oyunu: dogru / yanlis / ipucu / bitis
    await tap(page, '.mc-games');
    await page.waitForSelector('.home.games');
    await tap(page, '.game-card[data-game="detective"]');
    await page.waitForSelector('.tk-list');
    await openCase(page, 'd14-kumanda-parcasi');
    const c0 = (await maState(page)).count;
    await page.click('[data-opt="wire"]');
    await W(page, 300);
    m = await maState(page);
    check('D5 yanlis cevap: uzmeden cesaretlendirme (wrong), oyun ekraninda kosede, mod play', m.last === 'wrong' && MS.wrong.includes(m.text) && m.mode === 'play' && m.show && m.count === c0 + 1, JSON.stringify(m));
    const geo = await page.evaluate(() => { const m = document.querySelector('.mascot'); const b = m.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2; const hit = document.elementFromPoint(x, y); return { pe: getComputedStyle(m).pointerEvents, dockPe: getComputedStyle(document.querySelector('.mascot-dock')).pointerEvents, hitInMascot: !!hit?.closest('.mascot'), inView: b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight + 1 && b.top >= 0 }; });
    check('D6 maskot/baloncuk dokunmayi ENGELLEMEZ (pointer-events: none, altindaki oge tiklanir) ve ekran icinde', geo.pe === 'none' && geo.dockPe === 'none' && !geo.hitInMascot && geo.inView, JSON.stringify(geo));
    await page.click('[data-opt="wire"]', { force: true });
    await W(page, 150);
    check('D7 ayni yanlisa tekrar dokunus yeni tepki uretmez (sayac ayni)', (await maState(page)).count === c0 + 1);
    await page.click('[data-opt="resistor"]');
    await W(page, 300);
    m = await maState(page);
    check('D8 2. farkli yanlis: yardim edici ipucu tepkisi (hint)', m.last === 'hint' && MS.hint.includes(m.text) && m.mood === 'think', JSON.stringify(m));
    await page.click('[data-opt="switch"]');
    await W(page, 300);
    m = await maState(page);
    check('D9 dogru cevap: sevinme (correct, joy) ve gorev cozuldu', (m.last === 'correct' || m.last === 'done') && (await page.locator('[data-act="finish"]').count()) === 1, JSON.stringify(m));
    await W(page, 2600);
    await finish(page);
    await W(page, 300);
    m = await maState(page);
    check('D10 gorev bitince kutlama (done, party)', m.last === 'done' && MS.done.includes(m.text) && m.mood === 'party', JSON.stringify(m));
    check('D11 maskot kaydi degistirmedi: yalniz gorev rozeti yazildi', JSON.stringify((await store(page)).games.detective.done) === '["d14-kumanda-parcasi"]');
    check('D12 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();

    // eski oyun: ses dinleme (Sayi Avi): bir cevap -> dogru ya da yanlis tepkisi
    const c2 = await mk2(bandSeed('4-5'));
    await toGames(c2.page);
    await tap(c2.page, '.game-card[data-game="number-hunt"]');
    await c2.page.waitForSelector('section.play');
    await W(c2.page, 900);
    const cc = (await maState(c2.page)).count;
    const btns = await c2.page.$$('.stage button:not([data-act])');
    if (btns.length) await btns[0].click({ force: true });
    await W(c2.page, 500);
    m = await maState(c2.page);
    check('D13 mevcut oyunda (Sayi Avi) cevap verince ses olayina eslik eden tepki (correct/wrong) calisir', m.count > cc && ['correct', 'wrong', 'done'].includes(m.last), JSON.stringify({ m, btns: btns.length }));
    await c2.ctx.close();

    // hareket azaltma
    for (const reduced of [false, true]) {
      const c3 = await mk2(bandSeed('4-5'), VP.phone, { reduced });
      await toMenu(c3.page);
      const an = await c3.page.evaluate(() => ({ card: getComputedStyle(document.querySelector('.menu-card .mc-in')).animationName, eyes: getComputedStyle(document.querySelector('.mascot .m-eyes')).animationName, bob: getComputedStyle(document.querySelector('.mascot .m-art')).animationName, screen: getComputedStyle(document.querySelector('.menu')).animationName }));
      if (reduced) check('D14 hareket azaltma acikken kart salinimi, goz kirpma, maskot ve gecis animasyonu KAPALI', an.card === 'none' && an.eyes === 'none' && an.bob === 'none' && an.screen === 'none', JSON.stringify(an));
      else check('D15 varsayilan: kartlar yavas salinir (mc-float), maskot goz kirpar/hafif oynar, bolum gecisi yumusak', an.card === 'mc-float' && an.eyes === 'm-blink' && an.bob === 'm-bob' && an.screen === 'scr-in', JSON.stringify(an));
      await c3.ctx.close();
    }
  }

  // ======================= E) Animasyon dokunma/kaydirmayi engellemez; hareket dusuk genlikli =======================
  if (on('E')) {
    for (const [nm, vp] of VPS) {
      const { ctx, page } = await mk2(bandSeed('4-5'), vp);
      await toMenu(page);
      const r = await page.evaluate(async () => {
        const btn = document.querySelector('.mc-games');
        const samples = [];
        let maxShift = 0;
        const b0 = btn.getBoundingClientRect();
        const inner = btn.querySelector('.mc-in');
        const base = inner.getBoundingClientRect().top;
        for (let i = 0; i < 30; i++) { await new Promise((r) => setTimeout(r, 100)); const b = btn.getBoundingClientRect(); samples.push(Math.abs(b.top - b0.top) + Math.abs(b.left - b0.left)); maxShift = Math.max(maxShift, Math.abs(inner.getBoundingClientRect().top - base)); }
        return { buttonMoved: Math.max(...samples), innerShift: +maxShift.toFixed(2), trans: getComputedStyle(inner).transitionProperty };
      });
      check(`E1 ${nm}: dugmenin dokunma kutusu salinim sirasinda SABIT; gorunen kart <= 4px oynar (dusuk genlik); basma geri yaylanma gecisi tanimli`, r.buttonMoved < 0.5 && r.innerShift <= 4 && r.innerShift > 0 && r.trans.includes('transform'), JSON.stringify(r));
      // animasyon surerken tiklama hemen calisir
      await page.click('.mc-games', { timeout: 3000 });
      await page.waitForSelector('.home.games', { timeout: 3000 });
      check(`E2 ${nm}: kart salinirken dokunus hemen Oyunlar ekranini acar`, (await page.locator('.home.games').count()) === 1);
      // kaydirma: Oyunlar listesi kaydirilabilir ve alt dugmeler erisilebilir
      const sc = await page.evaluate(async () => {
        const h = document.querySelector('.home.games');
        const before = h.scrollTop;
        h.scrollTop = h.scrollHeight;
        await new Promise((r) => setTimeout(r, 200));
        const cards = [...document.querySelectorAll('.home.games .game-card')];
        // erisilebilirlik: son kart gorunume kaydirilinca ekrana tam sigar (yatayda kartlar yan yana; alt dugmeler en altta)
        const ctlEl = document.querySelector('.home-ctl .btn');
        cards[cards.length - 1].scrollIntoView({ block: 'nearest' });
        await new Promise((r) => setTimeout(r, 150));
        const last = cards[cards.length - 1].getBoundingClientRect();
        h.scrollTop = h.scrollHeight;
        await new Promise((r) => setTimeout(r, 150));
        const ctl = document.querySelector('.home-ctl .btn').getBoundingClientRect();
        return { scrolled: h.scrollTop > before || h.scrollHeight <= h.clientHeight, lastIn: last.bottom <= innerHeight + 1 && last.top >= -1, ctlIn: ctl.bottom <= innerHeight + 1, noH: document.documentElement.scrollWidth <= innerWidth + 1 };
      });
      check(`E3 ${nm}: Oyunlar listesi kaydirilir; en alttaki oyun karti ve yas/ses dugmeleri erisilebilir; tasma yok`, sc.scrolled && sc.lastIn && sc.ctlIn && sc.noH, JSON.stringify(sc));
      const cards = await page.evaluate(async () => { const out = []; for (const c of document.querySelectorAll('.game-card')) { c.scrollIntoView({ block: 'center' }); await new Promise((r) => setTimeout(r, 60)); const b = c.getBoundingClientRect(); out.push(b.left >= -1 && b.right <= innerWidth + 1 && b.top >= -1 && b.bottom <= innerHeight + 1); } return out; });
      check(`E4 ${nm}: 6 oyun karti da ekrana tam sigar (kirpilma yok)`, cards.length === 6 && cards.every(Boolean), JSON.stringify(cards));
      if (nm === '360x640') await shot(page, 'home-games');
      await ctx.close();
    }
    // bolum gecisi: kisa
    const { ctx, page } = await mk2(bandSeed('4-5'));
    await toMenu(page);
    const css = await page.evaluate(() => { const e = document.querySelector('#app > section.home'); const cs = getComputedStyle(e); return { dur: cs.animationDuration, name: cs.animationName }; });
    check('E5 bolum gecisi animasyonu kisa (<= 0.3 sn) ve yalniz opacity/transform', css.name === 'scr-in' && parseFloat(css.dur) <= 0.3, JSON.stringify(css));
    await ctx.close();
  }

  // ======================= F) Acilis -> Ana Menu; ses kapaliyken sessiz; maskot yeni ses uretmez =======================
  if (on('F')) {
    const { ctx, page, errs } = await mk2(bandSeed('4-5', {}), VP.phone, { osc: true });
    await toMenu(page);
    await page.evaluate(() => { window.__osc.length = 0; });
    await tap(page, '.mc-games');
    await page.waitForSelector('.home.games');
    await W(page, 1200);
    const n = await page.evaluate(() => window.__osc.length);
    check('F1 ses KAPALI: menu/oyunlar gezintisi ve maskot hic ses uretmez', n === 0, String(n));
    check('F2 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 2).join('|'));
    await ctx.close();
    // ses ACIK: gezinti yalniz mevcut "tap" sesini calar; maskot kendi sesini eklemez (menu->oyunlar = 1 tap sesi grubu)
    // V8.5 BILINCLI DEGISIKLIK: menude artik ana tema MUZIGI calar (osilator uretir). Bu testin amaci 'maskot ses eklemez' oldugu icin muzik tercihi KAPALI tohumlanir; maskot denetimi ayni kalir (muzigin kendisi ui-v85-audio S1'de denetlenir).
    const c2 = await mk2({ ...bandSeed('4-5'), sound: true, mix: { music: false, amb: false, vol: 0.6 } }, VP.phone, { osc: true });
    await toMenu(c2.page);
    await c2.page.evaluate(() => { window.__osc.length = 0; });
    await W(c2.page, 2500);
    check('F3 ses ACIK: maskotun selami ve animasyonlar HICBIR ses uretmez (yalniz gorsel)', (await c2.page.evaluate(() => window.__osc.length)) === 0);
    await c2.ctx.close();
  }
} catch (e) {
  check('beklenmeyen hata', false, e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol basarili (V7.8 Ana Menu + maskot hedefli UI testi)`);
process.exit(failed.length ? 1 : 0);
