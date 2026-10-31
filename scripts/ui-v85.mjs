// V8.5 HEDEFLI tarayici testi (Chromium): Karanlik Ev Macerasi akisi + ortak ortam sesi + coin tek seferlik + yerlesim.
//   node scripts/ui-v85.mjs   SHOTS=/yol  ONLY=A,B,...
// GERCEK ANDROID CIHAZ TESTI DEGILDIR: Chromium (Playwright) + sahte konusma motoru. Ses CIKTISI duyulmaz; yalniz cagri/durum sayilir.
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
const T = CFG.tasks.find((t) => t.id === 'karanlik-ev');
const DONE15 = Object.fromEntries([...CFG.regions[0].tasks, ...CFG.regions[1].tasks].map((i) => [i, 3]));
const server = await startServer(0);
const BASE = `http://127.0.0.1:${server.address().port}/`;
const browser = await chromium.launch();
const W = (page, ms = 400) => page.waitForTimeout(ms);
const store = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || 'null'), KEY);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` }); };

function FAKE_SPEECH() {
  const log = { speak: [], cancel: 0, overlap: 0 };
  let active = 0;
  window.__sp = log;
  window.SpeechSynthesisUtterance = function (t) { this.text = t; };
  const fake = {
    get speaking() { return active > 0; }, pending: false, getVoices: () => [{ lang: 'tr-TR', name: 'Sahte TR', localService: true }], resume() {},
    cancel() { log.cancel++; active = 0; },
    speak(u) { if (active > 0) log.overlap++; active++; log.speak.push({ text: u.text }); setTimeout(() => { u.onstart && u.onstart(); setTimeout(() => { active = 0; u.onend && u.onend(); }, 200); }, 20); }
  };
  Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
}
const spoken = (page) => page.evaluate(() => window.__sp.speak.map((s) => s.text).filter((t) => t.trim()));
const amb = (page) => page.evaluate(() => window.__altezAmbience.state);
const mk = async (seed, vp) => {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = []; const external = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  page.on('request', (r) => { const u = new URL(r.url()); if (!['127.0.0.1', 'localhost'].includes(u.hostname) && u.protocol.startsWith('http')) external.push(r.url()); });
  await page.addInitScript(FAKE_SPEECH);
  await page.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, JSON.stringify(v)); }, [KEY, seed]);
  return { ctx, page, errs, external };
};
const SEED = (o = {}) => ({ band: '4-5', sound: true, seen: true, adv: { intro: true, tasks: { ...DONE15 } }, ...o });
const openTask = async (page, vpHash = '#/adventure') => {
  await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + vpHash);
  await page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 8000 });
  await page.locator('.adv-node[data-id="karanlik-ev"]').click({ force: true });
  await page.waitForSelector('.dh[data-stage="cinema"]', { timeout: 4000 });
};
const toSearch = async (page) => { await page.locator('[data-dh="skip"]').click(); await page.waitForSelector('.dh[data-stage="search"]'); await W(page, 250); };
const findAll = async (page, ids) => { for (const id of ids) { await page.locator(`.dh-spot[data-id="${id}"]`).click({ force: true }); await W(page, 120); } };
const placeAll = async (page, order = [['battery', 'left'], ['switch', 'top'], ['lamp', 'right']]) => {
  for (const [type, edge] of order) {
    await page.locator(`.cx-tile[data-type="${type}"]`).click({ force: true });
    await page.locator(`.cx-slot[data-edge="${edge}"]`).click({ force: true });
    await W(page, 80);
  }
};
const lightUp = async (page) => { await page.locator('.cx-slot[data-edge="top"]').click({ force: true }); await W(page, 150); };
const layout = (page) => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'; };
  const rot = document.querySelector('.adv-rotate');
  const btns = [...document.querySelectorAll('button')].filter(vis);
  const off = btns.filter((b) => { const r = b.getBoundingClientRect(); return r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1; }).map((b) => b.className.slice(0, 30));
  return { sw: document.documentElement.scrollWidth, w: innerWidth, rotate: !!rot && getComputedStyle(rot).display !== 'none', off, n: btns.length };
});

try {
  if (on('A')) {
    // A1: tam akis (4-5 bandi, ses ACIK): sinematik -> kesif -> devre -> isik -> odul (+coin) -> haritaya donus
    const { page, errs, external, ctx } = await mk(SEED(), { width: 800, height: 360 });
    await openTask(page);
    const lay0 = await layout(page);
    await W(page, 300);
    const sp0 = await spoken(page);
    check('A1 sinematik acilis: karanlik ev sahnesi, ilk alt yazi gorunur ve SESLI okunur, atla dugmesi var', (await page.locator('.dh-cine[data-dark="1"]').count()) === 1 && (await page.locator('.dh-say').innerText()) === T.scenes[0].learn && sp0.includes(T.scenes[0].learn) && (await page.locator('[data-dh="skip"]').isVisible()), JSON.stringify({ sp0 }));
    check('A2 ortam sesi sinematikte baslar (ev-gece, tek ortam sesi) ve duzen tasmaz', (await amb(page)).scene === 'ev-gece' && lay0.sw <= lay0.w + 1 && !lay0.rotate && lay0.off.length === 0, JSON.stringify({ a: await amb(page), lay0 }));
    await shot(page, 'a1-sinematik');
    await W(page, 3400);
    check('A3 sinematik ilerler: 2. alt yazi (ev karanlik, lambalar yanmiyor) + karakter vardi', (await page.locator('.dh-say').innerText()) === T.scenes[1].learn && (await page.locator('.dh-cine[data-arrived="1"]').count()) === 1 && (await spoken(page)).includes(T.scenes[1].learn));
    await toSearch(page);
    const spotsN = await page.locator('.dh-spot').count();
    check('A4 kesif: gorev yonergesi sesli, 4-5 bandinda tuzak nesneler (saksi/tas) GIZLI, ipucu noktasi var', (await page.locator('.dh-say').innerText()) === T.say && (await spoken(page)).includes(T.say) && spotsN === T.spots.filter((s) => !s.hard).length && (await page.locator('.dh-spot[data-id="saksi"]').count()) === 0, JSON.stringify({ spotsN }));
    await shot(page, 'a2-kesif');
    await page.locator('.dh-spot[data-id="pencere"]').click({ force: true }); await W(page, 150);
    check('A5 ipucu noktasi parca vermez ama yonlendirir', (await page.locator('.dh').getAttribute('data-found')) === '0' && (await page.locator('.dh-say').innerText()) === T.spots.find((s) => s.id === 'pencere').say);
    check('A6 devre kurma dugmesi parcalar bulunmadan GORUNMEZ', !(await page.locator('[data-dh="build"]').isVisible()));
    await findAll(page, ['sandik', 'cekmece']);
    check('A7 iki parca bulundu: dugme hala gizli, canta 2 parca', !(await page.locator('[data-dh="build"]').isVisible()) && (await page.locator('.dh-got').count()) === 2);
    await findAll(page, ['dolap']);
    await page.locator('.dh-spot[data-id="dolap"]').click({ force: true });
    check('A8 3 parca bulundu (tekrar dokunmak ikinci parca VERMEZ), "Devreyi kur" gorunur', (await page.locator('.dh-got').count()) === 3 && (await page.locator('[data-dh="build"]').isVisible()));
    await shot(page, 'a3-bulundu');
    await page.locator('[data-dh="build"]').click({ force: true });
    await page.waitForSelector('.dh[data-stage="build"] .adv-circuit');
    const tiles = await page.locator('.cx-tile').count();
    check('A9 devre: yalniz BULUNAN 3 parca tepside (pil, anahtar, lamba); ev henuz karanlik', tiles === 3 && (await page.locator('.dh').getAttribute('data-lit')) === '0');
    await placeAll(page);
    check('A10 parcalar yerlesti ama anahtar ACIK: lamba YANMAZ', (await page.locator('.dh').getAttribute('data-lit')) === '0' && (await page.locator('.dh-buildBox').getAttribute('data-lit')) === '0');
    await lightUp(page);
    await W(page, 200);
    check('A11 anahtar kapaninca lamba yanar, ev aydinlanir (isik durumu), ortam sesi ev-isik, kazanma konusmasi', (await page.locator('.dh').getAttribute('data-lit')) === '1' && (await page.locator('.dh-buildBox').getAttribute('data-lit')) === '1' && (await amb(page)).scene === 'ev-isik' && (await spoken(page)).includes(T.win), JSON.stringify(await amb(page)));
    await shot(page, 'a4-yandi');
    await page.locator('[data-act="finish"]').click({ force: true });
    await page.waitForSelector('.dh[data-stage="lit"]');
    check('A12 isik sahnesi: pencereler yanik, karakter sevinci, "sonraki maceraya gec" sunulur', (await page.locator('.dh-cine[data-dark="0"]').count()) === 1 && (await page.locator('.dh-kid[data-joy="1"]').count()) === 1 && (await page.locator('[data-dh="next"]').isVisible()));
    await shot(page, 'a5-final');
    const before = await store(page);
    await page.locator('[data-dh="next"]').click({ force: true });
    await page.waitForSelector('.adv-reward');
    const st = await store(page);
    const coinEl = await page.locator('.rw-coin').getAttribute('data-coin');
    check('A13 odul: +coin ilk kez, 3 yildiz, kayit KALICI, sonraki macera cumlesi gosterilir', coinEl === String(T.coins) && st.adv.tasks['karanlik-ev'] === 3 && !before.adv.tasks['karanlik-ev'] && (await page.locator('[data-next]').innerText()) === T.next, JSON.stringify({ coinEl, tasks: st.adv.tasks['karanlik-ev'] }));
    await W(page, 500);
    const hit = await page.evaluate(() => { const out = {}; for (const sel of ['[data-act="tomap"]', '[data-act="again"]']) { const e = document.querySelector(sel); if (!e) { out[sel] = 'yok'; continue; } const r = e.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); out[sel] = !!h && (h === e || e.contains(h)); } return out; });
    check('A13b odul penceresindeki dugmeler GERCEKTEN dokunulabilir (ustunde baska dugme yok), "sonraki macera" dugmesi kalkti, "yakinda" notu tekrarlanmadi', hit['[data-act="tomap"]'] === true && (await page.locator('.dh-next').count()) === 0 && (await page.locator('.rw-note:not([data-next])').count()) === 0, JSON.stringify(hit));
    await shot(page, 'a6-odul');
    await page.locator('[data-act="tomap"]').click();
    await page.waitForSelector('.adv-mapscreen');
    const st2 = await amb(page);
    check('A14 haritaya donunce ortam sesi DURUR; coin ekranda; hata/ag istegi yok', st2.playing === false && st2.scene === null && errs.length === 0 && external.length === 0, JSON.stringify({ st2, errs: errs.slice(0, 2), external }));
    const coinNow = await page.locator('.adv-pill.coin b').getAttribute('data-coins');
    // tekrar oyna: coin YOK
    await page.locator('.adv-node[data-id="karanlik-ev"]').click({ force: true });
    await page.waitForSelector('.dh[data-stage="cinema"]');
    await toSearch(page); await findAll(page, ['sandik', 'cekmece', 'dolap']);
    await page.locator('[data-dh="build"]').click({ force: true }); await page.waitForSelector('.adv-circuit');
    await placeAll(page); await lightUp(page);
    await page.locator('[data-act="finish"]').click({ force: true }); await page.locator('[data-dh="next"]').click({ force: true });
    await page.waitForSelector('.adv-reward');
    const st3 = await store(page);
    check('A15 TEKRAR oynayinca coin VERILMEZ (rw-coin yok, "daha once yaptin" notu), kayit degismez', (await page.locator('.rw-coin').count()) === 0 && (await page.locator('.rw-note').first().innerText()).length > 5 && JSON.stringify(st3.adv.tasks) === JSON.stringify(st.adv.tasks) && (await page.locator('[data-next]').count()) === 0);
    await page.locator('[data-act="tomap"]').click(); await page.waitForSelector('.adv-mapscreen');
    check('A16 haritadaki coin tekrar sonrasi ARTMADI', (await page.locator('.adv-pill.coin b').getAttribute('data-coins')) === coinNow, coinNow);
    await ctx.close();
  }
  if (on('B')) {
    // B: 6-8 bandi: tuzak nesneler gorunur; tas yerlestirmek hata (yildiz 2); geri tusu; ses KAPALI
    const { page, errs, ctx } = await mk(SEED({ band: '6-8' }), { width: 740, height: 360 });
    await openTask(page); await toSearch(page);
    check('B1 6-8: tum noktalar (tuzaklar dahil) gorunur', (await page.locator('.dh-spot').count()) === T.spots.length);
    await findAll(page, ['saksi', 'tas', 'sandik', 'cekmece', 'dolap']);
    check('B2 tuzak parcalar da cantada (6-8)', (await page.locator('.dh-got').count()) === 5);
    await page.locator('[data-dh="build"]').click({ force: true }); await page.waitForSelector('.adv-circuit');
    await page.locator('.cx-tile[data-type="stone"]').click({ force: true });
    await page.locator('.cx-slot[data-edge="top"]').click({ force: true }); await W(page, 150);
    check('B3 tasi yerlestirmek lambayi YAKMAZ (iletmez) ve hata sayilir', (await page.locator('.dh').getAttribute('data-lit')) === '0');
    await page.locator('.cx-slot[data-edge="top"]').click({ force: true }); // tas geri tepsiye
    await placeAll(page); await lightUp(page);
    await page.locator('[data-act="finish"]').click({ force: true }); await page.locator('[data-dh="next"]').click({ force: true }); await page.waitForSelector('.adv-reward');
    const st = await store(page);
    check('B4 1 hatayla bitti: 2 yildiz, coin yine tek seferlik verildi', st.adv.tasks['karanlik-ev'] === 2 && (await page.locator('.rw-coin').getAttribute('data-coin')) === String(T.coins), JSON.stringify(st.adv.tasks['karanlik-ev']));
    check('B5 hata yok', errs.length === 0, errs.slice(0, 2).join('|'));
    await ctx.close();
  }
  if (on('C')) {
    // C: geri tusu/cikis: sinematik ortasinda haritaya donus -> ortam sesi durur, geciken zamanlayicilar hata/ekran degisikligi yapmaz
    const { page, errs, ctx } = await mk(SEED(), { width: 800, height: 360 });
    await openTask(page);
    await W(page, 500);
    await page.locator('[data-act="back"]').click();
    await page.waitForSelector('.adv-mapscreen');
    const a = await amb(page);
    await W(page, 10500); // sinematik zamanlayicisi (9.6 sn) tetiklenseydi kesif ekrani acilirdi
    check('C1 sinematikte Geri: harita, ortam sesi durdu, 10 sn sonra gecikmis zamanlayici ekrani BOZMADI, hata yok', a.playing === false && (await page.locator('.adv-mapscreen').count()) === 1 && (await page.locator('.dh').count()) === 0 && errs.length === 0, JSON.stringify({ a, errs }));
    // kesifte ses kapat: ortam sesi susar, konusma yok
    await page.locator('.adv-node[data-id="karanlik-ev"]').click({ force: true }); await page.waitForSelector('.dh');
    await page.locator('[data-act="sound"]').click(); await W(page, 200);
    const b = await amb(page);
    const nSp = (await spoken(page)).length;
    await toSearch(page); await W(page, 400);
    check('C2 ses KAPALIYKEN ortam sesi calmaz ve yeni konusma baslamaz', b.playing === false && b.enabled === false && (await amb(page)).playing === false && (await spoken(page)).length === nSp, JSON.stringify({ b, nSp, now: (await spoken(page)).length }));
    await ctx.close();
  }
  if (on('D')) {
    // D: sinematik kendiliginden kesife gecer (atla basilmadan); farkli ekran boyutlarinda tasma yok
    const { page, errs, ctx } = await mk(SEED(), { width: 640, height: 360 });
    await openTask(page);
    await page.waitForSelector('.dh[data-stage="search"]', { timeout: 12000 });
    check('D1 sinematik ~10 sn sonra kendiliginden kesfe gecer', true);
    await ctx.close();
    for (const [w, h] of [[568, 320], [640, 360], [800, 360], [915, 412], [1280, 800]]) {
      const r = await mk(SEED(), { width: w, height: h });
      await openTask(r.page);
      const l1 = await layout(r.page);
      await toSearch(r.page);
      const l2 = await layout(r.page);
      await findAll(r.page, ['sandik', 'cekmece', 'dolap']);
      await r.page.locator('[data-dh="build"]').click({ force: true }); await r.page.waitForSelector('.adv-circuit');
      const l3 = await layout(r.page);
      const ok = [l1, l2, l3].every((l) => l.sw <= l.w + 1 && !l.rotate && l.off.length === 0);
      check(`D2 ${w}x${h}: sinematik/kesif/devre ekranlarinda yatay tasma yok, dugmeler ekranda`, ok && r.errs.length === 0, JSON.stringify({ l1, l2, l3, errs: r.errs.slice(0, 1) }));
      await r.ctx.close();
    }
    // dikey: yatay cevirme uyarisi (macera yatay zorunlu)
    const p = await mk(SEED(), { width: 360, height: 640 });
    await p.page.goto(BASE + '?r=x#/adventure'); await p.page.waitForSelector('.adv-mapscreen'); await W(p.page, 300);
    check('D3 dikeyde macera yatay-cevir uyarisi gosterir (mevcut davranis korundu)', (await layout(p.page)).rotate === true);
    await p.ctx.close();
  }
  if (on('E')) {
    // E: kilit — Evde Enerji bitmeden Karanlik Ev acilmaz ve coin kazandirmaz
    const { page, ctx } = await mk({ band: '4-5', sound: false, seen: true, adv: { intro: true, tasks: { tanis: 3 } } }, { width: 800, height: 360 });
    await page.goto(BASE + '?r=y#/adventure'); await page.waitForSelector('.adv-mapscreen .adv-node');
    check('E1 Pil bolgesi bitmeden Karanlik Ev gorevi yok/kilitli', (await page.locator('.adv-node[data-id="karanlik-ev"]').count()) === 0);
    await ctx.close();
  }
  if (on('F')) {
    // F: bosta kalan cocuga ipucu (idleMs kisaltilarak): ses + parlayan nokta; parca bulununca ipucu temizlenir
    const { page, errs, ctx } = await mk(SEED(), { width: 800, height: 360 });
    await page.route('**/assets/data/adventure.json', async (route) => {
      const d = JSON.parse(readFileSync(new URL('../assets/data/adventure.json', import.meta.url), 'utf8'));
      d.tasks.find((t) => t.id === 'karanlik-ev').ui.idleMs = 700;
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(d) });
    });
    await openTask(page); await toSearch(page);
    await W(page, 1700);
    const nudged = await page.locator('.dh-spot.nudge').first().getAttribute('data-id');
    check('F1 bosta kalinca ipucu konusulur ve ILK EKSIK parcanin (pil) noktasi parlar', nudged === 'sandik' && (await spoken(page)).includes(T.hints.idle), JSON.stringify({ nudged }));
    await page.locator('.dh-spot[data-id="sandik"]').click({ force: true }); await W(page, 150);
    check('F2 parca bulununca parlama temizlenir', (await page.locator('.dh-spot.nudge').count()) === 0);
    await W(page, 1000);
    check('F3 sonraki ipucu siradaki eksik parcayi (anahtar -> cekmece) gosterir', (await page.locator('.dh-spot.nudge').first().getAttribute('data-id')) === 'cekmece');
    check('F4 hata yok', errs.length === 0, errs.slice(0, 2).join('|'));
    await ctx.close();
  }
  if (on('G')) {
    // G: arka plana gecme/geri donme + rota degisimi + ses ac/kapat + Tekrar dinle
    const { page, errs, ctx } = await mk(SEED(), { width: 800, height: 360 });
    await openTask(page); await toSearch(page);
    const hide = (v) => page.evaluate((x) => { Object.defineProperty(document, 'visibilityState', { value: x, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); }, v);
    const a0 = await amb(page);
    const sp0 = (await spoken(page)).length;
    const c0 = await page.evaluate(() => window.__sp.cancel);
    await hide('hidden'); await W(page, 400);
    const a1 = await amb(page);
    const c1 = await page.evaluate(() => window.__sp.cancel);
    check('G1 arka plana gecince ortam sesi DURUR ve konusma kesilir', a0.playing === true && a1.playing === false && c1 > c0, JSON.stringify({ a0: a0.playing, a1: a1.playing, c0, c1 }));
    await hide('visible'); await W(page, 300);
    const a2 = await amb(page);
    check('G2 geri donunce AYNI sahne ortam sesi yeniden baslar (tek ses), yeni konusma BASLAMAZ', a2.playing === true && a2.scene === 'ev-gece' && a2.starts === a0.starts + 1 && (await spoken(page)).length === sp0, JSON.stringify({ a2, sp0, now: (await spoken(page)).length }));
    await hide('visible'); await W(page, 150);
    check('G3 ust uste visible olaylari ikinci ortam sesi baslatmaz', (await amb(page)).starts === a2.starts);
    await page.locator('[data-act="replay"]').click({ force: true }); await W(page, 400);
    const sp = await spoken(page);
    check('G4 "Tekrar dinle": gecerli yonerge yeniden okunur (ayni metin 2. kez)', sp.filter((x) => x === T.say).length === 2, JSON.stringify(sp.slice(-3)));
    await page.locator('[data-act="sound"]').click({ force: true }); await W(page, 200);
    const off = await amb(page);
    await page.locator('[data-act="sound"]').click({ force: true }); await W(page, 300);
    const on2 = await amb(page);
    check('G5 ses kapaninca ortam sesi susar; acilinca sahne ortam sesi geri gelir', off.playing === false && on2.playing === true && on2.scene === 'ev-gece', JSON.stringify({ off: off.playing, on2: on2.playing }));
    await page.evaluate(() => { location.hash = '#/'; });
    await W(page, 700);
    const a4 = await amb(page);
    check('G6 rota degisimi (ana menu): ortam sesi kapanir, sahne kimligi sifirlanir, hata yok', a4.playing === false && a4.scene === null && errs.length === 0, JSON.stringify({ a4, errs: errs.slice(0, 2) }));
    await ctx.close();
  }
  if (on('H')) {
    // H: kayit hatasi (depolama yazamiyor): odul/coin KAZANILMIS GORUNMEZ, anlasilir uyari, gorev tekrar cozulebilir; sonra duzelince coin verilir
    const { page, errs, ctx } = await mk(SEED(), { width: 800, height: 360 });
    await openTask(page); await toSearch(page); await findAll(page, ['sandik', 'cekmece', 'dolap']);
    await page.locator('[data-dh="build"]').click({ force: true }); await page.waitForSelector('.adv-circuit');
    await placeAll(page); await lightUp(page);
    await page.locator('[data-act="finish"]').click({ force: true }); await page.locator('[data-dh="next"]').waitFor();
    await page.evaluate(() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new Error('dolu'); }; });
    await page.locator('[data-dh="next"]').click({ force: true });
    await page.waitForSelector('.adv-reward');
    const stBad = await store(page);
    check('H1 kayit YAZILAMAZSA: uyari gosterilir, +coin gosterilmez, gorev kaydedilmez', (await page.locator('.rw-note.warn').count()) === 1 && (await page.locator('.rw-coin').count()) === 0 && !stBad.adv.tasks['karanlik-ev'], JSON.stringify(stBad.adv.tasks['karanlik-ev']));
    await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; });
    await page.locator('[data-act="tomap"]').click({ force: true }); await page.waitForSelector('.adv-mapscreen');
    check('H2 coin/yildiz HARITADA artmadi (haksiz odul yok)', (await page.locator('.adv-node[data-id="karanlik-ev"]').getAttribute('data-state')) === 'open');
    await page.locator('.adv-node[data-id="karanlik-ev"]').click({ force: true }); await page.waitForSelector('.dh[data-stage="cinema"]');
    await toSearch(page); await findAll(page, ['sandik', 'cekmece', 'dolap']);
    await page.locator('[data-dh="build"]').click({ force: true }); await page.waitForSelector('.adv-circuit');
    await placeAll(page); await lightUp(page);
    await page.locator('[data-act="finish"]').click({ force: true }); await page.locator('[data-dh="next"]').click({ force: true });
    await page.waitForSelector('.adv-reward');
    const stOk = await store(page);
    check('H3 depolama duzelince ayni gorev tekrar cozulur ve coin ILK KEZ verilir (kayip yok, cift yok)', (await page.locator('.rw-coin').getAttribute('data-coin')) === String(T.coins) && stOk.adv.tasks['karanlik-ev'] === 3 && errs.length === 0, JSON.stringify({ errs: errs.slice(0, 2) }));
    // J: kalicilik: sayfa yenilenir/uygulama yeniden acilir -> kayit korunur, tekrar coin yok
    await page.locator('[data-act="tomap"]').click({ force: true }); await page.waitForSelector('.adv-mapscreen');
    const coin1 = await page.locator('.adv-pill.coin b').getAttribute('data-coins');
    await page.reload(); await page.waitForSelector('.adv-mapscreen .adv-node');
    const done = await page.locator('.adv-node[data-id="karanlik-ev"]').getAttribute('data-state');
    const coin2 = await page.locator('.adv-pill.coin b').getAttribute('data-coins');
    check('J1 uygulama yeniden acilinca gorev TAMAMLANDI, yildiz ve coin ayni (kalici)', done === 'done' && coin1 === coin2, JSON.stringify({ done, coin1, coin2 }));
    await ctx.close();
  }

  if (on('K')) {
    // K: Baglantili dunya paneli (5 asama, gereken ekipman, yapim asamasi durumlari, markete gecis)
    const { page, errs } = await mk(SEED({ adv: { intro: true, tasks: { ...DONE15 }, inv: ['pil-kutusu'] } }), { width: 800, height: 360 });
    await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + '#/adventure');
    await page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 8000 });
    await page.locator('[data-act="menu"]').click({ force: true });
    await page.locator('[data-act="world"]').click({ force: true });
    await page.waitForSelector('.adv-world');
    const rows = await page.evaluate(() => [...document.querySelectorAll('.wd-stage')].map((e) => ({ id: e.dataset.stage, st: e.dataset.state, txt: e.textContent })));
    check('K1 5 asama sirali listelenir (Karanlik Ev, Ormanda Gece Kurtarma, Mahalle, Koy, Mucit Atolyesi)', rows.map((r) => r.id).join() === 'karanlik,orman,mahalle,koy,atolye' && /Mucit Atölyesi/.test(rows[4].txt), JSON.stringify(rows.map((r) => r.id)));
    check('K2 Karanlik Ev OYNANABILIR ve ekipman gerekmez (ucretsiz baslangic); digerleri "Cok yakinda" (bitmis gibi gosterilmez)', rows[0].st === 'open' && /Ekipman gerekmez/.test(rows[0].txt) && rows.slice(1).every((r) => r.st === 'soon' && /Çok yakında/.test(r.txt)), JSON.stringify(rows.map((r) => r.st)));
    const needs = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wd-need[data-need]')].map((e) => [e.dataset.need, e.dataset.owned])));
    check('K3 sahip olunan ekipman "Sende var", olmayan "Eksik" (pil-kutusu 1, led-seti 0)', needs['pil-kutusu'] === '1' && needs['led-seti'] === '0', JSON.stringify(needs));
    check('K4 "Sonraki macera icin gerekenler" siradaki asamayi ve eksikleri gosterir', /Karanlık Ev/.test(await page.locator('.shop-bag').textContent()));
    check('K5 yapim asamasindaki asamalarda tiklanabilir dugme YOK (oynanamaz)', (await page.locator('.wd-stage button, .wd-stage [data-act]:not([data-act="none"])').count()) === 0);
    await page.locator('.adv-world [data-act="shop"]').click({ force: true });
    await page.waitForSelector('.adv-shop[data-screen="shop"]');
    check('K6 "Markete git" ayni marketi acar (ikinci market yok; 6 ekipman)', (await page.locator('.shop-item').count()) === 6);
    await page.locator('[data-act="shopback"]').click({ force: true });
    await page.waitForSelector('.adv-mapscreen .adv-node');
    await page.locator('[data-act="menu"]').click({ force: true });
    await page.locator('[data-act="world"]').click({ force: true });
    await page.waitForSelector('.adv-world');
    await page.locator('[data-act="worldback"]').click({ force: true });
    await page.waitForSelector('.adv-mapscreen .adv-node');
    const lay = await layout(page);
    check('K7 dunya panelinden haritaya donus; tasma yok', lay.sw <= lay.w + 1 && lay.off.length === 0, JSON.stringify(lay));
    check('K8 hata yok', errs.length === 0, errs.join(' | '));
    await page.close();
  }
} catch (e) {
  check('BEKLENMEYEN HATA', false, String(e).slice(0, 400));
}
await browser.close();
server.close();
const fail = results.filter((r) => !r.ok);
console.log(`\nV8.5 UI: ${results.length - fail.length}/${results.length} basarili${fail.length ? ' — BASARISIZ: ' + fail.map((f) => f.name.slice(0, 40)).join(' | ') : ''}`);
console.log('GERCEK ANDROID CIHAZ TESTI YAPILMADI (Chromium/Playwright simulasyonu).');
process.exit(fail.length ? 1 : 0);
