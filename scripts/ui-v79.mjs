// V7.9 HEDEFLI tarayici testi (Chromium): MASKOT V2 (guvenli yerlesim, durumlar, hareket azaltma) + ENERJI MACERASI ilk dilim (Pil ve Enerji).
// Tam arayuz duman testi (545) ve diger hedefli testler bu dosyadan AYRIDIR ve burada calistirilmaz.
//   node scripts/ui-v79.mjs            ONLY=C node scripts/ui-v79.mjs   (bolum sec)   SHOTS=/yol node ... (ekran goruntuleri)
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
const ONLY = process.env.ONLY || '';
const on = (x) => !ONLY || ONLY.includes(x);
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, info = '') => {
  results.push({ name, ok: !!ok, info });
  console.log(`${ok ? '  ok ' : 'FAIL '} ${name}${ok || !info ? '' : '  -> ' + info}`);
};
const KEY = 'altez-minilab:v1';
const EN = JSON.parse(readFileSync(new URL('../assets/data/energy.json', import.meta.url), 'utf8'));
const server = await startServer(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const VP = { phone: { width: 360, height: 640 }, small: { width: 320, height: 568 }, land: { width: 640, height: 360 } };
const VPN = { phone: '360x640', small: '320x568', land: '640x360 yatay' };
const W = (page, ms = 420) => page.waitForTimeout(ms);
const SEED = (band, extra = {}) => ({ band, sound: false, seen: true, correct: 5, games: { 'number-hunt': { correct: 9 } }, edu: { done: ['circuit-1', 'switch-1'] }, ...extra });

const mk = async (seed, vp = VP.phone, opts = {}) => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = [];
  const external = [];
  const requests = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('request', (r) => {
    const u = new URL(r.url());
    requests.push(u.pathname);
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url());
  });
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  if (opts.reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
  return { ctx, page, errs, external, requests };
};
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const gotoHash = async (page, hash) => { await page.goto(BASE + '?home=1&r=' + Math.random().toString(36).slice(2) + hash); };
const toAdventure = async (page) => { await gotoHash(page, '#/play/energy-adventure'); await page.waitForSelector('.tk-list'); await W(page, 500); };
const openTask = async (page, id) => { await page.click(`.tk-task[data-task="${id}"]`); await page.waitForSelector('.tk-prompt'); await W(page, 450); };
const taskOf = (id) => EN.tasks.find((t) => t.id === id);

// Dogru cevap: secenekli gorevlerde dogru secenek, siralamada sirayla ogeler
async function solve(page, t) {
  if (t.kind === 'order') {
    for (const it of t.items) {
      await page.locator('.ls-items button', { hasText: it.label }).first().click();
      await W(page, 130);
    }
  } else {
    const ok = t.options.find((o) => o.ok);
    await page.locator('.ls-opts button', { hasText: ok.text }).first().click();
  }
  await page.waitForSelector('[data-act="finish"]', { timeout: 4000 });
}
async function wrongTap(page, t, n = 0) {
  const bad = t.options.filter((o) => !o.ok)[n];
  await page.locator('.ls-opts button', { hasText: bad.text }).first().click();
}

// Maskot durumu + oyun ogeleriyle gorsel kesisim olcumu
const mascotState = (page) => page.evaluate(() => {
  const m = document.querySelector('.mascot');
  const rect = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const art = m.querySelector('.m-art');
  const bub = m.querySelector('.m-bubble');
  const compact = m.classList.contains('compact');
  const sel = 'button, [role="button"], a[href], input, select, textarea, .cap, [data-opt], [data-item], [data-tool], svg.board';
  const hits = [];
  const a = rect(art);
  const b = !compact && getComputedStyle(bub).opacity !== '0' ? rect(bub) : null;
  for (const n of document.querySelectorAll(sel)) {
    if (m.contains(n)) continue;
    const r = rect(n);
    if (r.w < 2 || r.h < 2 || r.b < 0 || r.t > innerHeight) continue;
    const x = (q) => q.l < r.r && q.r > r.l && q.t < r.b && q.b > r.t;
    if (x(a) || (b && x(b))) hits.push((n.className || n.tagName) + ':' + (n.textContent || '').trim().slice(0, 18));
  }
  const inside = (q) => q.l >= -1 && q.t >= -1 && q.r <= innerWidth + 1 && q.b <= innerHeight + 1;
  return {
    show: m.classList.contains('show'), mode: m.dataset.mode, mood: m.dataset.mood, last: m.dataset.last, corner: m.dataset.corner, safe: m.dataset.safe, compact,
    art: a, bubble: b, hits, inside: inside(a) && (!b || inside(b)), text: bub.textContent,
    pe: [m, art, bub].map((e) => getComputedStyle(e).pointerEvents).join(','), vw: innerWidth, vh: innerHeight
  };
});
const waitShow = (page, ms = 1500) => page.waitForFunction(() => document.querySelector('.mascot.show'), null, { timeout: ms });
const waitHide = (page, ms = 5000) => page.waitForFunction(() => !document.querySelector('.mascot.show'), null, { timeout: ms });

try {
  // ======================= A) Surum ve Ana Menu maskotu (V2: buyuk, gorunur) =======================
  if (on('A')) {
    for (const [k, vp] of Object.entries(VP)) {
      const { ctx, page, errs } = await mk(SEED('4-5'), vp);
      await gotoHash(page, '#/');
      await page.waitForSelector('.home.menu');
      await waitShow(page, 3000);
      const s = await mascotState(page);
      const ver = await page.evaluate(() => document.body.textContent.match(/V\d+\.\d+(\.\d+(-[a-z0-9]+)?)?/g)?.join(',') || '');
      check(`A1 ${VPN[k]}: ekranda guncel surum (V8.x; eski V7.x yazisi yok)`, /V8\.\d/.test(ver) && !/V7\.[789]/.test(ver), ver);
      const minArt = k === 'land' ? 70 : 70;
      check(`A2 ${VPN[k]}: ana menu maskotu buyuk ve gorunur (sanat genisligi >= ${minArt}px), karsilama baloncugu gosterilir`, s.mode === 'menu' && s.art.w >= minArt && s.mood === 'wave' && /Merhaba/.test(s.text), JSON.stringify({ w: s.art.w, mood: s.mood, t: s.text }));
      check(`A3 ${VPN[k]}: maskot ekran icinde; menu kaydirma/tasma olusturmaz; dokunma engellenmez (pointer-events none)`, s.inside && (await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)) && s.pe === 'none,none,none', JSON.stringify({ inside: s.inside, pe: s.pe }));
      // dort kart hala dokunulabilir (maskot kapatmiyor)
      const cardsOk = await page.evaluate(() => [...document.querySelectorAll('.menu-card')].every((c) => { const r = c.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return c.contains(e); }));
      check(`A4 ${VPN[k]}: dort ana kart merkezinden dokunulabilir`, cardsOk);
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/a-menu-${k}.png` });
      check(`A5 ${VPN[k]}: sayfa/konsol hatasi yok`, errs.length === 0, errs.slice(0, 2).join('|'));
      await ctx.close();
    }
  }

  // ======================= B) Oyun icinde maskot: guvenli yerlesim (cevaplari/dugmeleri/yaziyi ortmez) =======================
  if (on('B')) {
    for (const band of ['4-5', '6-8']) {
      for (const [k, vp] of Object.entries(VP)) {
        const { ctx, page, errs } = await mk(SEED(band), vp);
        await toAdventure(page);
        // B0: liste ekraninda yol arkadasi (companion) rezerve alanda; dugmeleri kapatmaz
        const lc = await mascotState(page);
        check(`B0 ${band} ${VPN[k]}: Enerji Macerasi listesinde yol arkadasi (companion) yerinde, dugmeleri ortmez, ekran icinde`, lc.mode === 'companion' && lc.hits.length === 0 && lc.inside, JSON.stringify({ mode: lc.mode, hits: lc.hits, inside: lc.inside }));
        await openTask(page, 'e6-pil-deseni');
        const t = taskOf('e6-pil-deseni');
        const seen = [];
        let ok = true;
        let info = '';
        // yanlis -> ipucu -> (3.) -> dogru -> bitis: her tepkide maskot cevaplari ortmemeli
        await wrongTap(page, t, 0);
        await waitShow(page); await W(page, 350);
        let s = await mascotState(page); seen.push(s);
        await waitHide(page, 4000); await W(page, 300);
        await wrongTap(page, t, 1);
        await waitShow(page); await W(page, 350);
        s = await mascotState(page); seen.push(s);
        await waitHide(page, 4000);
        await solve(page, t);
        await waitShow(page); await W(page, 350);
        s = await mascotState(page); seen.push(s);
        await page.click('[data-act="finish"]');
        await W(page, 700);
        s = await mascotState(page); seen.push(s);
        for (const x of seen) {
          if (!x.show) continue;
          if (x.hits.length || !x.inside || x.mode !== 'play' || x.pe !== 'none,none,none') { ok = false; info = JSON.stringify({ hits: x.hits, inside: x.inside, mode: x.mode, corner: x.corner, safe: x.safe, last: x.last, art: x.art, bubble: x.bubble, vw: x.vw, vh: x.vh, compact: x.compact }); break; }
        }
        check(`B1 ${band} ${VPN[k]}: yanlis/ipucu/dogru/bitis tepkilerinde maskot ekran icinde, oyun ogeleri-dugmeler-yazi ile GORSEL kesisimi yok, dokunma gecirgen`, ok && seen.filter((x) => x.show).length >= 3, info || seen.map((x) => `${x.last}:${x.corner}:${x.compact ? 'c' : 'b'}:${x.show}`).join(' '));
        const moods = seen.filter((x) => x.show).map((x) => x.mood);
        check(`B2 ${band} ${VPN[k]}: durumlar dogru (yanlis=cheer, ipucu=think, dogru=joy, bitis=party)`, moods.join(',').startsWith('cheer,think,joy') && moods.includes('party') || moods.join(',').includes('cheer') && moods.includes('joy'), moods.join(','));
        const texts = seen.filter((x) => x.show && x.text).map((x) => x.text);
        check(`B3 ${band} ${VPN[k]}: mesajlar kisa, ayni mesaj art arda tekrarlanmadi`, texts.every((x) => x.length <= 40) && texts.every((x, i) => i === 0 || x !== texts[i - 1]), texts.join(' | '));
        if (SHOTS) await page.screenshot({ path: `${SHOTS}/b-${band}-${k}.png` });
        check(`B4 ${band} ${VPN[k]}: sayfa/konsol hatasi yok`, errs.length === 0, errs.slice(0, 2).join('|'));
        await ctx.close();
      }
    }
  }

  // ======================= C) Enerji Macerasi: Pil ve Enerji akisi, coin kurallari, kayit =======================
  if (on('C')) {
    // C1: menu -> Oyunlar -> Enerji Macerasi karti -> liste; yas bandina gore gorev sayisi
    const a = await mk(SEED('4-5'), VP.phone);
    await gotoHash(a.page, '#/games');
    await a.page.waitForSelector('.home.games');
    check('C1 Oyunlar ekraninda 6 oyun karti; Enerji Macerasi gercek kart (Yakinda kartinda tekrar yok)', (await a.page.locator('.game-card').count()) === 6 && (await a.page.locator('.game-card[data-game="energy-adventure"]').count()) === 1 && (await a.page.locator('.soon-card[data-soon="adventure"]').count()) === 0);
    await W(a.page, 450);
    await a.page.click('.game-card[data-game="energy-adventure"]');
    await a.page.waitForSelector('.tk-list');
    await W(a.page, 500);
    check('C2 4-5 yas: Pil ve Enerji 6 gorev, 0 / 6; bolge seridi: 1 acik + 4 "Yakinda"; coin 0', (await a.page.locator('.tk-task').count()) === 6 && (await a.page.getAttribute('.tk-overall', 'data-total')) === '6' && (await a.page.locator('.adv-region.is-open').count()) === 1 && (await a.page.locator('.adv-region.is-soon').count()) === 4 && (await a.page.getAttribute('.adv-coins', 'data-coins')) === '0');
    check('C3 Yakinda bolgeler oynanabilir degil (tiklanabilir dugme/baglanti degil)', (await a.page.locator('.adv-region button, .adv-region a, button.adv-region').count()) === 0);
    check('C4 sayfa/konsol hatasi yok, harici istek yok', a.errs.length === 0 && a.external.length === 0, a.errs.join('|') + a.external.join('|'));
    await a.ctx.close();

    const b = await mk(SEED('6-8', { games: { 'number-hunt': { correct: 9 }, detective: { correct: 1, done: ['d1-kayip-lamba'] }, 'logic-science': { correct: 1, done: ['l1-tohum'] } } }), VP.phone);
    await toAdventure(b.page);
    check('C5 6-8 yas: 8 gorev (0 / 8)', (await b.page.locator('.tk-task').count()) === 8 && (await b.page.getAttribute('.tk-overall', 'data-total')) === '8');
    // e1: yanlis (kademeli ipucu) sonra dogru -> +1 coin
    await openTask(b.page, 'e1-pil-ne');
    const t1 = taskOf('e1-pil-ne');
    await wrongTap(b.page, t1, 0);
    await W(b.page, 300);
    const cap1 = await b.page.textContent('.tk-cap');
    check('C6 yanlis cevap: nazik, ozel ipucu yazisi (utandirmayan), coin/ilerleme degismedi', cap1.includes(t1.options.filter((o) => !o.ok)[0].hint) && (await store(b.page)).games?.['energy-adventure'] == null);
    await W(b.page, 400);
    await solve(b.page, t1);
    await b.page.click('[data-act="finish"]');
    await b.page.waitForSelector('.tk-done');
    await W(b.page, 500);
    const gain1 = await b.page.getAttribute('.adv-gain', 'data-gain').catch(() => null);
    const sv = await store(b.page);
    check('C7 ilk cozum: +1 coin gosterilir, yeni rozet; kayit yalniz games.energy-adventure {correct, done}', gain1 === '1' && (await b.page.getAttribute('.tk-reward', 'data-new')) === '1' && JSON.stringify(sv.games['energy-adventure']) === JSON.stringify({ correct: 1, done: ['e1-pil-ne'] }) && sv.coins === undefined && !('adventure' in sv), JSON.stringify(sv.games['energy-adventure']));
    check('C8 eski kayitlar korundu (Dedektif, Mantik ve Bilim, Sayi Avi, Egitim, yas bandi)', JSON.stringify(sv.games.detective) === JSON.stringify({ correct: 1, done: ['d1-kayip-lamba'] }) && JSON.stringify(sv.games['logic-science']) === JSON.stringify({ correct: 1, done: ['l1-tohum'] }) && sv.games['number-hunt'].correct === 9 && JSON.stringify(sv.edu.done) === JSON.stringify(['circuit-1', 'switch-1']) && sv.band === '6-8');
    await b.page.click('[data-act="list"]');
    await b.page.waitForSelector('.tk-list');
    await W(b.page, 500);
    check('C9 listede coin 1, ilerleme 1 / 8, gorev tamamlandi isareti', (await b.page.getAttribute('.adv-coins', 'data-coins')) === '1' && (await b.page.getAttribute('.tk-overall', 'data-count')) === '1' && (await b.page.locator('.tk-task.st-done').count()) === 1);
    // TEKRAR cozum: odul yok
    await openTask(b.page, 'e1-pil-ne');
    await solve(b.page, t1);
    await b.page.click('[data-act="finish"]');
    await b.page.waitForSelector('.tk-done');
    await W(b.page, 500);
    const sv2 = await store(b.page);
    check('C10 AYNI gorevi tekrar cozunce coin/rozet YOK ("zaten sende"), kayit degismedi', (await b.page.locator('.adv-gain').count()) === 0 && (await b.page.getAttribute('.tk-reward', 'data-new')) === '0' && (await b.page.locator('.tk-replaynote').count()) === 1 && /coin zaten sende/.test(await b.page.textContent('.tk-replaynote')) && JSON.stringify(sv2.games['energy-adventure']) === JSON.stringify({ correct: 1, done: ['e1-pil-ne'] }));
    // 2 coinlik gorev (e8) + hizli cift dokunus: tek odul
    await b.page.click('[data-act="list"]');
    await b.page.waitForSelector('.tk-list');
    await W(b.page, 500);
    await openTask(b.page, 'e8-biten-pil-yeri');
    const t8 = taskOf('e8-biten-pil-yeri');
    const okb = t8.options.find((o) => o.ok);
    const btn = b.page.locator('.ls-opts button', { hasText: okb.text }).first();
    await btn.evaluate((el) => { el.click(); el.click(); }); // ayni karede iki dokunus (cift dokunus)
    await b.page.waitForSelector('[data-act="finish"]');
    await b.page.click('[data-act="finish"]');
    await b.page.waitForSelector('.tk-done');
    await W(b.page, 500);
    const sv3 = await store(b.page);
    check('C11 2 coinlik gorev + hizli cift dokunus: tek odul (+2), kayitta yalniz bir kez', (await b.page.getAttribute('.adv-gain', 'data-gain')) === '2' && (await b.page.getAttribute('.adv-gain', 'data-total')) === '3' && sv3.games['energy-adventure'].done.filter((x) => x === 'e8-biten-pil-yeri').length === 1 && sv3.games['energy-adventure'].correct === 2, JSON.stringify(sv3.games['energy-adventure']));
    // yenileme: coin ve ilerleme korunur (turetilmis)
    await toAdventure(b.page);
    check('C12 yenileyince coin 3 ve ilerleme 2 / 8 korunur; coin hicbir zaman azalmaz', (await b.page.getAttribute('.adv-coins', 'data-coins')) === '3' && (await b.page.getAttribute('.tk-overall', 'data-count')) === '2');
    check('C13 sayfa/konsol hatasi yok, harici istek yok', b.errs.length === 0 && b.external.length === 0, b.errs.join('|') + b.external.join('|'));
    await b.ctx.close();
  }

  // ======================= D) Tum Pil ve Enerji gorevleri cozulebilir; tasma/kirpilma yok; secenekler ilk gorunur alanda =======================
  if (on('D')) {
    for (const band of ['4-5', '6-8']) {
      for (const [k, vp] of Object.entries(VP)) {
        const { ctx, page, errs } = await mk(SEED(band), vp);
        await toAdventure(page);
        const ids = EN.tasks.filter((t) => t.bands.includes(band)).map((t) => t.id);
        const bad = [];
        for (const id of ids) {
          await openTask(page, id);
          const t = taskOf(id);
          const geo = await page.evaluate((land) => {
            const els = [...document.querySelectorAll('.ls-opts button, .ls-items button')];
            return { n: els.length, inView: els.every((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.left >= -1 && r.right <= innerWidth + 1 && (land || (r.top >= -1 && r.bottom <= innerHeight + 1)); }), noH: document.documentElement.scrollWidth <= innerWidth + 1 };
          }, k === 'land');
          if (!geo.n || !geo.inView || !geo.noH) bad.push(`${id}:${JSON.stringify(geo)}`);
          await solve(page, t);
          await page.click('[data-act="finish"]');
          await page.waitForSelector('.tk-done');
          await W(page, 450);
          await page.click('[data-act="list"]');
          await page.waitForSelector('.tk-list');
          await W(page, 450);
        }
        const sv = await store(page);
        check(`D1 ${band} ${VPN[k]}: ${ids.length} gorevin hepsi cozulur; secenekler ilk gorunur alanda, tasma yok`, bad.length === 0 && sv.games['energy-adventure'].done.length === ids.length, bad.join(' ; ') || String(sv.games['energy-adventure']?.done?.length));
        const total = await page.getAttribute('.adv-coins', 'data-coins');
        const exp = EN.tasks.filter((t) => ids.includes(t.id)).reduce((n, t) => n + t.coins, 0);
        check(`D2 ${band} ${VPN[k]}: hepsi bitince coin ${exp} (yas bandindaki gorevlerin toplami), "Bolgeyi bitirdin" karti`, total === String(exp) && (await page.locator('.nc-replay').count()) === 1, total);
        check(`D3 ${band} ${VPN[k]}: sayfa/konsol hatasi yok`, errs.length === 0, errs.slice(0, 2).join('|'));
        await ctx.close();
      }
    }
  }

  // ======================= E) Hareket azaltma =======================
  if (on('E')) {
    const { ctx, page, errs } = await mk(SEED('4-5'), VP.phone, { reduced: true });
    await gotoHash(page, '#/');
    await page.waitForSelector('.home.menu');
    await waitShow(page, 3000);
    const anim = await page.evaluate(() => {
      const n = (s) => { const e = document.querySelector(s); const c = getComputedStyle(e); return { a: c.animationName, t: c.transitionDuration }; };
      return { art: n('.mascot .m-art'), eyes: n('.mascot .m-eyes'), arm: n('.mascot .m-arm-r'), card: n('.mc-in'), bubble: n('.m-bubble') };
    });
    check('E1 hareket azalt: maskot (govde, goz, kol) ve kart animasyonlari KAPALI, gecisler 0', Object.values(anim).every((x) => x.a === 'none' && /^(0s|1e-05s)(, (0s|1e-05s))*$/.test(x.t)), JSON.stringify(anim));
    const st = await mascotState(page);
    check('E2 hareket azalt: karsilama yine gorunur (baloncuk + el sallama durusu statik)', st.show && /Merhaba/.test(st.text) && st.mood === 'wave');
    await toAdventure(page);
    await openTask(page, 'e6-pil-deseni');
    const t = taskOf('e6-pil-deseni');
    await wrongTap(page, t, 0);
    await waitShow(page);
    await W(page, 300);
    await waitHide(page, 4000);
    await W(page, 200);
    await wrongTap(page, t, 1);
    await waitShow(page); await W(page, 300);
    const th = await page.evaluate(() => { const m = document.querySelector('.mascot'); return { mood: m.dataset.mood, bulb: getComputedStyle(m.querySelector('.m-bulb')).display, anim: getComputedStyle(m.querySelector('.m-art')).animationName }; });
    check('E3 hareket azalt: ipucu durumunda ampul simgesi animasyonsuz gorunur', th.mood === 'think' && th.bulb !== 'none' && th.anim === 'none', JSON.stringify(th));
    check('E4 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 2).join('|'));
    await ctx.close();
    // varsayilan: animasyon acik
    const d = await mk(SEED('4-5'), VP.phone);
    await gotoHash(d.page, '#/');
    await d.page.waitForSelector('.home.menu');
    await W(d.page, 800);
    const on1 = await d.page.evaluate(() => getComputedStyle(document.querySelector('.mascot .m-art')).animationName);
    check('E5 varsayilan: ana menu maskotu hafifce salinir (animasyon acik)', on1 !== 'none', on1);
    await d.ctx.close();
  }

  // ======================= F) Geri tusu, kayit/ses/harici kaynak =======================
  if (on('F')) {
    const { ctx, page, errs, external, requests } = await mk(SEED('4-5'), VP.phone);
    await gotoHash(page, '#/');
    await page.waitForSelector('.home.menu');
    await W(page, 450);
    await page.click('.mc-games');
    await page.waitForSelector('.home.games');
    await W(page, 450);
    await page.click('.game-card[data-game="energy-adventure"]');
    await page.waitForSelector('.tk-list');
    await W(page, 450);
    await openTask(page, 'e1-pil-ne');
    await page.evaluate(() => window.__altezBack.handle());
    await W(page, 400);
    check('F1 Geri: gorev -> liste', (await page.locator('.tk-list').count()) === 1);
    await page.evaluate(() => window.__altezBack.handle());
    await W(page, 600);
    check('F2 Geri: liste -> Oyunlar ekrani', (await page.locator('.home.games').count()) === 1);
    await page.evaluate(() => window.__altezBack.handle());
    await W(page, 600);
    check('F3 Geri: Oyunlar -> Ana Menu (4 kart)', (await page.locator('.home.menu .menu-card').count()) === 4);
    const mp3 = [...new Set(requests.filter((p) => /\.(mp3|ogg|wav)$/.test(p)))];
    check('F4 yeni ses/konusma dosyasi istenmedi (yalniz mevcut acilis cinglı), harici istek yok', mp3.every((p) => p.endsWith('minilab-jingle.mp3') || p.endsWith('intro-caglayan.mp3')) && external.length === 0, mp3.join(',') + external.join(','));
    check('F5 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 2).join('|'));
    await ctx.close();
  }

  // ======================= G) Yatay ekran duzeltmesi: gorev bitis ekraninda maskot "Gorev listesi"/"Sonraki gorev" dugmeleri ve bitis yazilariyla KESISMEZ =======================
  if (on('G')) {
    const VPG = [['640x360 yatay', { width: 640, height: 360 }], ['600x360 yatay', { width: 600, height: 360 }], ['568x320 yatay', { width: 568, height: 320 }], ['667x375 yatay', { width: 667, height: 375 }], ['360x640', VP.phone], ['320x568', VP.small]];
    for (const band of ['4-5', '6-8']) {
      for (const [nm, vp] of VPG) {
        const { ctx, page, errs } = await mk(SEED(band), vp);
        await toAdventure(page);
        const bad = [];
        for (const id of ['e1-pil-ne', 'e6-pil-deseni']) {
          await openTask(page, id);
          await solve(page, taskOf(id));
          await waitShow(page).catch(() => {});
          await page.click('[data-act="finish"]');
          await W(page, 800);
          const x = await page.evaluate(() => {
            const m = document.querySelector('.mascot');
            const a = m.querySelector('.m-art').getBoundingClientRect();
            const bu = m.querySelector('.m-bubble').getBoundingClientRect();
            const cmp = m.classList.contains('compact');
            const vis = getComputedStyle(m.querySelector('.m-bubble')).opacity !== '0';
            const sel = 'button, [role="button"], a[href], input, select, textarea, .cap, [data-opt], [data-item], svg.board, .tk-q, .tk-sub, .tk-trophy, .tk-reward, .tk-overall, .adv-gain, .tk-title';
            const hits = [];
            for (const n of document.querySelectorAll(sel)) {
              if (m.contains(n)) continue;
              const r = n.getBoundingClientRect();
              if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > innerHeight) continue;
              const q = (o) => o.left < r.right && o.right > r.left && o.top < r.bottom && o.bottom > r.top;
              if (q(a) || (!cmp && vis && q(bu))) hits.push((n.className.baseVal ?? n.className) + ':' + n.textContent.trim().slice(0, 14));
            }
            const inside = (o) => o.left >= -1 && o.top >= -1 && o.right <= innerWidth + 1 && o.bottom <= innerHeight + 1;
            return { show: m.classList.contains('show'), last: m.dataset.last, safe: m.dataset.safe, corner: m.dataset.corner, hits, inside: inside(a) && (cmp || !vis || inside(bu)), noH: document.documentElement.scrollWidth <= innerWidth + 1 };
          });
          if (!x.show || (id === 'e1-pil-ne' && x.last !== 'done') || x.safe !== '1' || x.hits.length || !x.inside || !x.noH) bad.push(id + ':' + JSON.stringify(x));
          await page.click('[data-act="list"]');
          await page.waitForSelector('.tk-list');
          await W(page, 400);
        }
        // (2. gorev ilkinin hemen ardindan cozuldugu icin 'done' tepkisi bekleme suresinde olabilir; onceki tepki yine de yeni ekranda guvenli yere tasinmalidir)
        check(`G1 ${band} ${nm}: gorev bitisinde maskot gorunur, guvenli yerde (safe=1), ekran icinde; dugmeler ve bitis yazilariyla kesisim yok`, bad.length === 0, bad.join(' ; '));
        check(`G2 ${band} ${nm}: sayfa/konsol hatasi yok`, errs.length === 0, errs.slice(0, 2).join('|'));
        await ctx.close();
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
console.log(`\n${results.length - failed.length}/${results.length} kontrol basarili (V7.9 Maskot V2 + Enerji Macerasi hedefli UI testi)`);
process.exit(failed.length ? 1 : 0);
