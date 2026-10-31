// V7.8 HEDEFLI tarayici testi (Chromium): yalniz V7.8 degisiklikleri (yeni vakalar, kucuk ekran/yatay yerlesim, tekrar yanlis, ses zamanlamasi,
// kayit hatasi, basari animasyonu). Tam arayuz duman testi (545) ve V7.7 testi bu dosyadan AYRIDIR.
//   node scripts/ui-v78.mjs                      -> calistirir (cikis kodu 0 = hepsi basarili)
//   ONLY=C node scripts/ui-v78.mjs               -> yalniz C bolumu; SHOTS=/yol node ... -> ekran goruntuleri de kaydeder
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
const toHub = async (page) => { await page.goto(BASE + '?r=' + Date.now() + '#/play/tasks'); await page.waitForSelector('.tk-hub'); };
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

try {
  // ======================= A) Tum gorevler: tasma yok, secenekler ilk gorunen alanda (320x568, 360x640, 640x360 yatay) =======================
  if (on('A')) {
    for (const band of ['4-5', '6-8']) {
      for (const [nm, vp] of [['360x640', VP.phone], ['320x568', VP.small], ['640x360 yatay', VP.land]]) {
        const { ctx, page, errs } = await mk2(bandSeed(band), vp);
        const bad = [];
        let n = 0;
        for (const game of ['detective', 'logic-science']) {
          await toHub(page);
          await openGame(page, game);
          const ids = await page.$$eval('.tk-task', (els) => els.map((e) => e.dataset.task));
          for (const id of ids) {
            await openCase(page, id);
            n += 1;
            const r = await page.evaluate((game) => {
              const vw = innerWidth, vh = innerHeight;
              const fits = (sel, vert) => [...document.querySelectorAll(sel)].every((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.left >= -1 && b.right <= vw + 1 && (!vert || (b.top >= -1 && b.bottom <= vh + 1)); });
              const clipped = [...document.querySelectorAll('.ls-cell, .ls-ic, .ls-item b, .ls-opt b, .ls-slot')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow !== 'visible');
              const overflowText = [...document.querySelectorAll('.ls-cell, .ls-opt, .ls-item')].filter((e) => { const b = e.getBoundingClientRect(); return b.right > vw + 1 || b.left < -1; });
              return {
                hov: document.documentElement.scrollWidth > vw + 1,
                prompt: fits('.tk-prompt > *', false),
                ctl: fits('[data-opt], [data-item], [data-tool]', game === 'logic-science'),
                clipped: clipped.length,
                outside: overflowText.length,
                cap: fits('.tk-cap', false)
              };
            }, game);
            if (r.hov || !r.prompt || !r.ctl || r.clipped || r.outside || !r.cap) bad.push(`${game}/${id}:${JSON.stringify(r)}`);
            await page.click('[data-act="close"]');
            await page.waitForSelector('.tk-list');
            await W(page, 380);
          }
        }
        check(`A1 ${band} ${nm}: ${n} gorevin hicbiri tasmaz/kesilmez; Mantik secenekleri ilk gorunen alanda`, bad.length === 0 && n > 0, bad.slice(0, 3).join(' | '));
        check(`A2 ${band} ${nm}: sayfa/konsol hatasi yok`, errs.length === 0, errs.slice(0, 2).join('|'));
        await ctx.close();
      }
    }
  }

  // ======================= B) l8 yildizlar / l4 civciv: kucuk ekranda kesilme yok =======================
  if (on('B')) {
    for (const [nm, vp] of [['320x568', VP.small], ['360x640', VP.phone], ['640x360 yatay', VP.land]]) {
      const { ctx, page } = await mk2(bandSeed('6-8'), vp);
      await openFirst(page, 'logic-science', 'l8-yildizlar');
      const r = await page.evaluate(() => ({
        long: document.querySelectorAll('.ls-long').length,
        cells: [...document.querySelectorAll('.ls-cell')].map((e) => { const b = e.getBoundingClientRect(); return b.left >= -1 && b.right <= innerWidth + 1 && e.scrollWidth <= e.clientWidth + 1; }),
        opts: [...document.querySelectorAll('.ls-opt')].map((e) => { const b = e.getBoundingClientRect(); const ic = e.querySelector('.ls-ic'); return b.left >= -1 && b.right <= innerWidth + 1 && ic.scrollWidth <= e.clientWidth; })
      }));
      check(`B1 ${nm}: l8 yildiz hucreleri ve secenekleri ekran icinde, kesilmiyor (${r.cells.length} hucre, ${r.opts.length} secenek)`, r.long >= 3 && r.cells.every(Boolean) && r.opts.every(Boolean), JSON.stringify(r));
      await ctx.close();
      const c2 = await mk2(bandSeed('6-8'), vp);
      await openFirst(c2.page, 'logic-science', 'l4-civciv');
      const l4 = await c2.page.evaluate(() => [...document.querySelectorAll('.ls-item')].map((e) => { const b = e.querySelector('b'); const r = e.getBoundingClientRect(); return { t: b.textContent, ok: b.scrollWidth <= b.clientWidth + 1 && r.right <= innerWidth + 1 && r.left >= -1, lines: Math.round(b.getBoundingClientRect().height / (parseFloat(getComputedStyle(b).fontSize) * 1.25)) }; }));
      check(`B2 ${nm}: l4 etiketleri kisa ve kesilmiyor (en cok 2 satir)`, l4.length === 4 && l4.every((x) => x.ok && x.t.length <= 12 && x.lines <= 2), JSON.stringify(l4));
      await c2.ctx.close();
    }
  }

  // ======================= C) Ayni yanlisa tekrar: ipucu kalir, sayac artmaz; 3. FARKLI yanlista gorsel yardim (dolu arizali konum dahil) =======================
  if (on('C')) {
    const { ctx, page, errs } = await mk2(bandSeed('6-8'));
    await openFirst(page, 'detective', 'd15-kisa-yol');
    const T = DET.text;
    await page.click('.inv-hit[data-slot="s1"]');
    await W(page, 150);
    const hint1 = await cap(page);
    check('C1 d15 saglam konum: yonlendirici ipucu', hint1.length >= 10, hint1);
    const sp0 = (await spoken(page)).length;
    for (let i = 0; i < 3; i++) {
      await page.evaluate(() => { document.querySelector('.tk-cap').textContent = ''; }); // ipucu kaybolmus gibi
      await page.click('.inv-hit[data-slot="s1"]');
      await W(page, 80);
      check(`C2.${i} ayni yanliga tekrar dokunus: ipucu yeniden gosterilir`, (await cap(page)) === hint1, await cap(page));
    }
    check('C3 tekrar dokunuslar ek konusma uretmez', (await spoken(page)).length === sp0);
    check('C4 tekrar dokunuslar SAYACI artirmaz: gorsel yardim henuz yok', (await page.locator('.inv-hit.hint').count()) === 0);
    await page.click('.inv-hit[data-slot="s2"]'); // 2. farkli yanlis -> guclu ipucu
    await W(page, 150);
    check('C5 2. farkli yanlis: guclu ipucu (hint2), yardim yok', (await cap(page)) === DET.tasks.find((t) => t.id === 'd15-kisa-yol').hint2 && (await page.locator('.inv-hit.hint').count()) === 0, await cap(page));
    await page.click('.inv-hit[data-slot="s1"]'); // 3. sayilan yanlis -> yardim
    await W(page, 200);
    check('C6 3. sayilan yanlis: DOLU arizali konum (s6) vurgulanir; baska konum vurgulanmaz', (await page.locator('.inv-hit.hint[data-slot="s6"]').count()) === 1 && (await page.locator('.inv-hit.hint').count()) === 1);
    check('C7 vurgu cevabi kendiliginden cozmez', (await page.locator('[data-act="finish"]').count()) === 0);
    check('C8 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 2).join('|'));
    await ctx.close();

    // d17: dolu direnc konumu vurgusu; d16: anahtar icin mevcut vurgu korunur
    const c2 = await mk2(bandSeed('6-8'));
    await openFirst(c2.page, 'detective', 'd17-yorgun-pil');
    for (const s of ['s1', 's2', 's1', 's2', 's1']) { await c2.page.click(`.inv-hit[data-slot="${s}"]`); await W(c2.page, 90); }
    check('C9 d17: dolu arizali konum (s5 direnc) vurgulanir', (await c2.page.locator('.inv-hit.hint[data-slot="s5"]').count()) === 1, String(await c2.page.locator('.inv-hit.hint').count()));
    await c2.ctx.close();

    // missing (4-5): ayni secenek kilitlenir; ipucu kaybolmaz
    const c3 = await mk2(bandSeed('4-5'));
    await openFirst(c3.page, 'detective', 'd14-kumanda-parcasi');
    await c3.page.click('[data-opt="wire"]');
    await W(c3.page, 150);
    const w1 = await cap(c3.page);
    await c3.page.click('[data-opt="wire"]', { force: true }); // pasif dugmeye tekrar dokunus (gercek parmak dokunusu gibi)
    await W(c3.page, 100);
    check('C10 d14 yanlis secenek tekrar: ipucu kaybolmaz, secenek pasif', (await cap(c3.page)) === w1 && w1.length > 8 && (await c3.page.getAttribute('[data-opt="wire"]', 'aria-disabled')) === 'true', w1);
    await c3.ctx.close();

    // Mantik ve Bilim: ayni yanlis secenek pasif; sayac artmaz (yardim 3. farkli yanlistan sonra)
    const c4 = await mk2(bandSeed('4-5'));
    await openFirst(c4.page, 'logic-science', 'l9-anahtar');
    const wr = await c4.page.$$eval('[data-opt]', (els) => els.map((e) => e.dataset.opt));
    const bad = LSD.tasks.find((t) => t.id === 'l9-anahtar').options.map((o, i) => (o.ok ? -1 : i)).filter((i) => i >= 0);
    await c4.page.click(`[data-opt="${bad[0]}"]`);
    await W(c4.page, 120);
    const h4 = await cap(c4.page);
    await c4.page.click(`[data-opt="${bad[0]}"]`, { force: true });
    await W(c4.page, 80);
    check('C11 l9 ayni yanlis secenege tekrar: ipucu kaybolmaz; yardim (hint) cikmaz', (await cap(c4.page)) === h4 && h4.length > 8 && (await c4.page.locator('.ls-opt.hint').count()) === 0 && wr.length === 3, h4);
    await c4.ctx.close();
  }

  // ======================= D) 5 yeni vaka: cozulur, yanlis yollar cozmez, tek odul =======================
  if (on('D')) {
    const run = async (band, id, steps) => {
      const { ctx, page, errs } = await mk2(bandSeed(band));
      await openFirst(page, 'detective', id);
      await steps(page);
      return { ctx, page, errs };
    };
    const solved = async (page, nm) => {
      await W(page, 1000);
      const ok = (await page.locator('[data-act="finish"]').count()) === 1;
      if (!ok) return false;
      await finish(page);
      return true;
    };
    // d13 (4-5 ve 6-8): yalniz kablolar -> kisa devre ipucu; sonra iki LED + kablo
    for (const band of ['4-5', '6-8']) {
      const r = await run(band, 'd13-seri-lambalar', async (page) => {
        await place(page, 'wire', 's1'); await place(page, 'wire', 's2'); await place(page, 'wire', 's3');
        await W(page, 400);
      });
      check(`D1 ${band} d13: yalniz kablo cozmez, kisa ipucu`, (await r.page.locator('[data-act="finish"]').count()) === 0 && (await cap(r.page)).length > 8, await cap(r.page));
      await place(r.page, 'led', 's1'); await place(r.page, 'led', 's2');
      await W(r.page, 200);
      check(`D2 ${band} d13: tek bir LED yeterli degil... iki LED + kablo ile cozulur (lit=2)`, (await lit(r.page)) === '2' && (await solved(r.page)), await lit(r.page));
      const d = await doneInfo(r.page);
      check(`D3 ${band} d13: yeni rozet, kayit games.detective.done = [d13]`, d.isNew === '1' && JSON.stringify(await tasksOf(r.page, 'detective')) === '["d13-seri-lambalar"]', JSON.stringify(d));
      check(`D4 ${band} d13: sayfa/konsol hatasi yok`, r.errs.length === 0, r.errs.slice(0, 2).join('|'));
      await r.ctx.close();
    }
    // d14 (4-5, 6-8): kablo ve direnc cozmez; anahtar cozer
    for (const band of ['4-5', '6-8']) {
      const r = await run(band, 'd14-kumanda-parcasi', async (page) => {
        await page.click('[data-opt="wire"]'); await W(page, 200);
      });
      const h1 = await cap(r.page);
      await r.page.click('[data-opt="resistor"]'); await W(r.page, 200);
      check(`D5 ${band} d14: kablo ve direnc cozmez, her biri kendi ipucunu verir`, h1.length > 8 && (await cap(r.page)).length > 8 && (await r.page.locator('[data-act="finish"]').count()) === 0 && h1 !== (await cap(r.page)), `${h1} | ${await cap(r.page)}`);
      await r.page.click('[data-opt="switch"]');
      check(`D6 ${band} d14: anahtar cozer`, await solved(r.page));
      await r.ctx.close();
    }
    // d15 / d16 / d17 (6-8)
    const faults = [
      ['d15-kisa-yol', 's6', 's1', '.inv-hit'],
      ['d16-sessiz-kol', 's4', 's1', '[data-switch]'],
      ['d17-yorgun-pil', 's5', 's1', '.inv-hit']
    ];
    for (const [id, culprit, healthy, kind] of faults) {
      const r = await run('6-8', id, async (page) => {
        await page.click(`.inv-hit[data-slot="${healthy}"]`); await W(page, 200);
      });
      check(`D7 ${id}: saglam konum cozmez, ipucu verir`, (await r.page.locator('[data-act="finish"]').count()) === 0 && (await cap(r.page)).length > 8, await cap(r.page));
      await r.page.click(kind === '[data-switch]' ? `[data-switch="${culprit}"]` : `.inv-hit[data-slot="${culprit}"]`);
      check(`D8 ${id}: dogru ariza yeri duzelince lamba yanar, cozuldu`, await solved(r.page));
      const d = await doneInfo(r.page);
      check(`D9 ${id}: yeni rozet ve kayit`, d.isNew === '1' && (await tasksOf(r.page, 'detective')).includes(id), JSON.stringify(d));
      await r.ctx.close();
    }
  }

  // ======================= E) Kayit hatasi: sahte rozet YOK; yer acilinca ayni gorev gercek rozet verir =======================
  if (on('E')) {
    const { ctx, page, errs } = await mk2(bandSeed('4-5'));
    await openFirst(page, 'logic-science', 'l1-tohum');
    await page.evaluate(() => { window.__origSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('QuotaExceeded'); }; });
    await clickItems(page, [0, 1, 2]);
    await W(page, 500);
    await finish(page);
    const d = await page.evaluate(() => ({ isNew: document.querySelector('.tk-reward')?.dataset.new, fail: document.querySelector('.tk-reward')?.dataset.savefail, text: document.querySelector('.tk-reward')?.textContent.replace(/\s+/g, ' ').trim(), meter: document.querySelectorAll('.tk-meter').length, alldone: document.querySelectorAll('.tk-alldone').length, replay: document.querySelectorAll('.tk-replaynote').length, trophy: document.querySelector('.tk-trophy')?.textContent }));
    check('E1 kayit yazilamadi: "Rozet henuz kazanilmadi" gosterilir; yeni rozet/sayac/tamam mesaji YOK', d.fail === '1' && d.isNew === '0' && d.text.includes('Rozet henüz kazanılmadı') && d.meter === 0 && d.alldone === 0 && d.trophy === '✅', JSON.stringify(d));
    check('E2 kayit gercekten yazilmadi (done bos)', (await tasksOf(page, 'logic-science')).length === 0);
    await page.evaluate(() => { Storage.prototype.setItem = window.__origSet; });
    await backToList(page);
    check('E3 gorev listede tamamlandi isaretli DEGIL ve ilerleme 0', (await page.locator('.tk-task.st-done').count()) === 0 && (await page.getAttribute('.tk-overall', 'data-count')) === '0');
    await openCase(page, 'l1-tohum');
    await clickItems(page, [0, 1, 2]);
    await W(page, 500);
    await finish(page);
    const d2 = await doneInfo(page);
    check('E4 yer acilinca ayni gorev: GERCEK yeni rozet ve kayit', d2.isNew === '1' && (await tasksOf(page, 'logic-science')).length === 1, JSON.stringify(d2));
    check('E5 sayfa/konsol hatasi yok (kayit hatasi yutuldu, uygulama calisiyor)', errs.length === 0, errs.slice(0, 2).join('|'));
    await ctx.close();
  }

  // ======================= F) Ses zamanlamasi: dogru sesi -> basari sesi -> kutlama sesi ust uste binmez =======================
  if (on('F')) {
    const { ctx, page } = await mk2(bandSeed('4-5'), VP.phone, { osc: true });
    await openFirst(page, 'logic-science', 'l1-tohum');
    await page.evaluate(() => { window.__osc.length = 0; });
    await clickItems(page, [0, 1, 2]);
    await page.waitForSelector('[data-act="finish"]');
    await W(page, 420); // gecis korumasi: "Devam" hemen dokunulabilir en erken an
    await page.click('[data-act="finish"]'); // basari sesi hala caliyor olmali
    await page.waitForSelector('.tk-done');
    await W(page, 4200);
    const p = await plays(page);
    const big = p.filter((x) => x.n >= 4); // tap/place/gentle kisa seslerini ele
    check('F1 sesler: dogru + basari + kutlama ayri calmalar olarak olusur', big.length >= 3, JSON.stringify(p));
    let ok = big.length >= 3;
    const gaps = [];
    for (let i = 1; i < big.length; i++) { const gap = big[i].at - big[i - 1].at; gaps.push(gap); }
    check('F2 dogru sesi (450 ms) bitmeden basari sesi baslamaz', gaps[0] >= 450, JSON.stringify(gaps));
    check('F3 kutlama sesi, basari sesi (2100 ms) bitmeden baslamaz (hizli Devam dokunusuna ragmen)', gaps[1] >= 2000, JSON.stringify({ gaps, p }));
    await ctx.close();
  }

  // ======================= G) Mantik ve Bilim basari animasyonu =======================
  if (on('G')) {
    for (const reduced of [false, true]) {
      const { ctx, page } = await mk2(bandSeed('4-5'), VP.phone, { reduced });
      await openFirst(page, 'logic-science', 'l5-renkler');
      const ans = await page.evaluate(() => null);
      void ans;
      const okIdx = LSD.tasks.find((t) => t.id === 'l5-renkler').options.findIndex((o) => o.ok);
      await page.click(`[data-opt="${okIdx}"]`);
      await W(page, 150);
      const a = await page.evaluate(() => { const p = document.querySelector('.tk-prompt'); return { cls: p.classList.contains('ls-win'), anim: getComputedStyle(p).animationName }; });
      check(`G1 ${reduced ? 'azaltilmis hareket: animasyon kapali' : 'dogru cevapta hafif animasyon calisir'}`, a.cls && (reduced ? a.anim === 'none' : a.anim === 'ls-win'), JSON.stringify(a));
      await ctx.close();
    }
    const { ctx, page } = await mk2(bandSeed('4-5'));
    await openFirst(page, 'logic-science', 'l1-tohum');
    await clickItems(page, [0, 1, 2]);
    await W(page, 150);
    check('G2 siralama gorevi tamamlaninca da animasyon sinifi', await page.evaluate(() => document.querySelector('.tk-prompt').classList.contains('ls-win')));
    await ctx.close();
  }

  // ======================= H) Eski kayit uyumu ve sayilar =======================
  if (on('H')) {
    const { ctx, page, errs } = await mk2(bandSeed('6-8', { detective: { correct: OLD6.length, done: OLD6 } }));
    await toHub(page);
    const cards = await page.$$eval('.tk-card', (els) => els.map((e) => e.querySelector('small')?.textContent.replace(/\s+/g, ' ').trim()));
    check(`H1 V7.7 kaydi (10 vaka tamam) bozulmadan okunur: 10 / 15 vaka, 0 / 16 gorev`, cards[0].includes(`${OLD6.length} / 15`) && cards[1].includes('0 / 16'), JSON.stringify(cards));
    await openGame(page, 'detective');
    check('H2 siradaki vaka karti ilk YENI vaka (d13)', (await page.getAttribute('.tk-nextcard', 'data-target')) === 'd13-seri-lambalar' && (await page.locator('.tk-task.st-done').count()) === OLD6.length);
    check('H3 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 2).join('|'));
    await ctx.close();
    // bozuk kayit: acilis bozulmaz
    const c2 = await browser.newContext({ viewport: VP.phone, hasTouch: true, isMobile: true });
    const p2 = await c2.newPage();
    const e2 = [];
    p2.on('pageerror', (e) => e2.push(String(e)));
    await p2.addInitScript((k) => localStorage.setItem(k, '{bozuk json'), KEY);
    await p2.goto(BASE + '?home=1');
    await p2.waitForSelector('.home, .band, .splash', { timeout: 8000 });
    check('H4 bozuk kayit: uygulama acilir', e2.length === 0, e2.join('|'));
    await c2.close();
  }
} catch (e) {
  check('beklenmeyen hata', false, e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol basarili (V7.8 hedefli UI testi)`);
process.exit(failed.length ? 1 : 0);
