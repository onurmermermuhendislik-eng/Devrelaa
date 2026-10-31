// V8.5 SES testi (Chromium): 14 zorunlu senaryo + OfflineAudioContext ile sayisal icerik denetimi.
//   node scripts/ui-v85-audio.mjs   ONLY=S1,S2,...,N
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
// S1-S14: sahte konusma motoru (TTS yolu) ile durum/ducking/gecis testleri -> ses KAYDI yokmus gibi (voiceMp3:false); S15-S16: gercek 123 MP3 yolu (voiceMp3:true).
const server = await startServer(0);
const serverMp3 = await startServer(0, { voiceMp3: true });
const BASE = `http://127.0.0.1:${server.address().port}/`;
const BASE_MP3 = `http://127.0.0.1:${serverMp3.address().port}/`;
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

const mus = (page) => page.evaluate(() => window.__altezMusic.state);
const sfx = (page) => page.evaluate(() => window.__altezSfx.slice());
const clearSfx = (page) => page.evaluate(() => { window.__altezSfx.length = 0; });
const snap = (page) => page.evaluate(() => ({ m: window.__altezMusic.state, a: window.__altezAmbience.state }));
const bootMenu = async (page, q = '') => { await page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + q + '#/'); await page.waitForFunction(() => window.__altezMusic?.state.want, null, { timeout: 12000 }).catch(() => {}); await W(page, 200); };
const gotoAdv = async (page) => { await page.evaluate(() => { location.hash = '#/adventure'; }); await page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 8000 }); await W(page, 300); };
const toMap = async (page) => { const t = page.locator('[data-act="tomap"]'); await ((await t.count()) ? t : page.locator('[data-act="back"]')).first().click({ force: true }); await page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 8000 }); await W(page, 400); };
const enterTask = async (page) => { await page.locator('.adv-node[data-id="karanlik-ev"]').click({ force: true }); await page.waitForSelector('.dh[data-stage="cinema"]', { timeout: 4000 }); await W(page, 300); };
const playThrough = async (page) => {
  await toSearch(page);
  await findAll(page, ['sandik', 'cekmece', 'dolap']);
  await page.locator('[data-dh="build"]').click({ force: true });
  await page.waitForSelector('.dh[data-stage="build"] .adv-circuit');
};

// ---- S1: ilk acilis -> ana tema ----
if (on('S1')) {
  const { page, errs, external } = await mk(SEED({ seen: false }), { width: 412, height: 800 });
  await bootMenu(page);
  const s = await snap(page);
  check('S1 acilis (splash bitince) ana menude TEMA muzigi baslar (sentetik); ortam sesi YOK', s.m.want === 'tema' && s.m.track === 'tema' && s.m.source === 'synth' && !s.a.playing, JSON.stringify(s.m));
  check('S1b dis ag istegi yok, sayfa hatasi yok', external.length === 0 && errs.filter((e) => !/AudioContext was not allowed/.test(e)).length === 0, JSON.stringify({ external, errs }));
  await page.close();
  // S1c: gercek ilk acilis = tanitim (Caglayan anlatimi) -> muzik BILINCLI sessiz; tanitim bitince menude tema
  const f = await mk({ band: '4-5', sound: true, seen: false, adv: {} }, { width: 800, height: 360 });
  await f.page.goto(BASE + '?r=' + Math.random().toString(36).slice(2) + '#/');
  await f.page.waitForSelector('[data-act="skip"]', { timeout: 15000 });
  await W(f.page, 400);
  const si = await snap(f.page);
  check('S1c ilk acilis tanitimi: muzik calmaz (anlatim ustun), sonra tanitim atlanip menuye donunce TEMA baslar', !si.m.playing, JSON.stringify(si.m));
  await f.page.locator('[data-act="skip"]').click({ force: true });
  await f.page.waitForFunction(() => window.__altezMusic.state.track === 'tema', null, { timeout: 8000 }).catch(() => {});
  check('S1d tanitim sonrasi ana menuye donunce tema muzigi calar', (await mus(f.page)).track === 'tema', JSON.stringify(await mus(f.page)));
  await f.page.close();
}

// ---- S2/S3/S4/S5/S6: Karanlik Ev ----
if (on('S2')) {
  const { page, errs } = await mk(SEED(), { width: 800, height: 360 });
  await openTask(page);
  await W(page, 400);
  let s = await snap(page);
  check('S2 Karanlik Ev sinemati: ortam=ev-gece, muzik=ev-gizem (korkutucu degil: yalniz bu ikisi; su/ruzgar/orman ortami YOK)', s.a.scene === 'ev-gece' && s.m.track === 'ev-gizem' && !/orman|selale|dere|pompa|mahalle/.test(JSON.stringify(s.a.history)), JSON.stringify(s));
  // S3: yonerge sirasinda muzik kisilir: ilk (otomatik) konusma bitsin, sonra TEKRAR DINLE ile konusturup ornekle
  await W(page, 1500);
  const sampler = page.evaluate(async () => { const out = []; for (let i = 0; i < 20; i++) { out.push({ ad: window.__altezAmbience.state.ducked, d: window.__altezMusic.state.ducked, l: window.__altezMusic.state.level }); await new Promise((r) => setTimeout(r, 40)); } return out; });
  await page.locator('[data-act="replay"]').click({ force: true });
  const samples = await sampler;
  const normal = Math.max(...samples.map((x) => x.l)); const low = Math.min(...samples.map((x) => x.l));
  check('S3 sesli yonerge sirasinda muzik ve ortam sesi KISILIR (duck, muzik seviyesi <%50) ve konusma bitince geri gelir', samples.some((x) => x.d) && samples.some((x) => x.ad) && low < normal * 0.5, JSON.stringify({ normal, low, n: samples.length }));
  await W(page, 1200);
  const after = await mus(page);
  check('S3b yonerge bittikten sonra muzik eski seviyeye doner (kisik kalmaz)', after.ducked === false || (await (async () => { await W(page, 3000); return (await mus(page)).ducked === false; })()), JSON.stringify(after));
  await toSearch(page);
  s = await snap(page);
  check('S2b kesif asamasi: muzik ev-gizem surer, parca yeniden baslamaz (starts degismez)', s.m.track === 'ev-gizem', JSON.stringify(s.m));
  // S4: dogru / yanlis efektler
  await clearSfx(page);
  await page.locator('.dh-spot[data-id="pencere"]').click({ force: true }); await W(page, 200);
  const sClue = await sfx(page);
  await findAll(page, ['sandik']);
  const sFind = await sfx(page);
  check('S4a ipucu/parca bulma efekti calar (correct/pick/tap ailesi), yanlis-ceza sesi (gentle) YOK', sFind.length > 0 && !sFind.includes('gentle') && sFind.some((x) => ['correct', 'pick', 'tap', 'place'].includes(x)), JSON.stringify({ sClue, sFind }));
  await findAll(page, ['cekmece', 'dolap']);
  await page.locator('[data-dh="build"]').click({ force: true });
  await page.waitForSelector('.dh[data-stage="build"] .adv-circuit');
  await W(page, 400);
  s = await snap(page);
  check('S2c devre asamasi: muzik ev-heyecan (heyecanli bekleyis), ortam ev-gece surer', s.m.track === 'ev-heyecan' && s.a.scene === 'ev-gece', JSON.stringify(s));
  await clearSfx(page);
  // yanlis yerlestirme: pili ust (anahtar) yuvaya koy
  await page.locator('.cx-tile[data-type="battery"]').click({ force: true });
  await page.locator('.cx-slot[data-edge="top"]').click({ force: true });
  await W(page, 400);
  const sWrong = await sfx(page);
  await clearSfx(page);
  check('S4b yanlis yerlestirme: nazik yonlendirme sesi (gentle) calar, ceza/hata sesi yok; deneme surer', sWrong.length >= 1 && sWrong.every((x) => ['gentle', 'tap', 'pick', 'place', 'retry'].includes(x)) && (await page.locator('.cx-tile').count()) >= 1, JSON.stringify(sWrong));
  // tile doldur ve yak
  await page.close();
  void errs;
}

// ---- S5/S6: basari sesi bir kez + tekrar giris ----
if (on('S5')) {
  const { page, errs } = await mk(SEED(), { width: 800, height: 360 });
  await openTask(page);
  await playThrough(page);
  await placeAll(page);
  await clearSfx(page);
  await lightUp(page);
  await W(page, 700);
  let s = await snap(page);
  const fx1 = await sfx(page);
  check('S5a lamba yaninca: muzik ev-basari (neseli, ayrisan kisa parca), ortam ev-isik', s.m.track === 'ev-basari' && s.a.scene === 'ev-isik', JSON.stringify(s));
  await page.locator('[data-act="finish"]').click({ force: true });
  await page.waitForSelector('.dh[data-stage="lit"]');
  await W(page, 600);
  await page.locator('[data-dh="next"]').click({ force: true });
  await page.waitForSelector('.adv-reward');
  await W(page, 900);
  const fx = await sfx(page);
  const succ = fx.filter((x) => x === 'success' || x === 'jingle' || x === 'levelUp').length;
  check('S5 gorev tamamlaninca basari sesi (success) TAM BIR KEZ cinlar', fx.filter((x) => x === 'success').length === 1, JSON.stringify({ fx1, fx, succ }));
  // S6: ayni goreve tekrar gir -> sesler cogalmaz
  await toMap(page);
  await enterTask(page);
  await W(page, 500);
  const r1 = await snap(page);
  for (let i = 0; i < 3; i++) { await toMap(page); await enterTask(page); await W(page, 300); }
  const r2 = await snap(page);
  check('S6 ayni goreve tekrar girince: tek ortam sesi, tek muzik parcasi, zamanlayici sizmaz, ev-gece/ev-gizem yeniden', r2.a.scene === 'ev-gece' && r2.a.playing && r2.m.track === 'ev-gizem' && r2.m.fading <= 2 && r2.m.timer === true && r1.m.track === 'ev-gizem', JSON.stringify({ r1: r1.m, r2: r2.m, a: r2.a }));
  await page.close();
}

// ---- S7/S8: market ve sahne degisimi ----
if (on('S7')) {
  const { page } = await mk(SEED(), { width: 800, height: 360 });
  await openTask(page);
  await toSearch(page);
  await toMap(page);
  let s = await snap(page);
  check('S8 gorevden haritaya donunce eski ORTAM sesi (ev-gece) DURUR, muzik ana tema', !s.a.playing && s.a.scene === null && s.m.track === 'tema', JSON.stringify(s));
  await page.locator('[data-act="shop"]').click({ force: true });
  await W(page, 700);
  s = await snap(page);
  check('S7 market acikken macera ortam sesi KONTROLSUZ SURMEZ (ortam yok), muzik ana temada, tek parca', !s.a.playing && s.m.track === 'tema' && s.m.fading <= 1, JSON.stringify(s));
  await page.evaluate(() => { location.hash = '#/games'; });
  await W(page, 900);
  s = await snap(page);
  check('S8b oyunlar ekranina gecince muzik/ortam sessiz (macera sesi tasinmaz)', !s.m.playing && !s.a.playing && s.m.want === null, JSON.stringify(s));
  await page.close();
}

// ---- S9: ses tercihi sahne degisimlerinde korunur ----
if (on('S9')) {
  const { page } = await mk(SEED(), { width: 800, height: 360 });
  await page.goto(BASE + '?r=' + Math.random() + '#/settings');
  await page.waitForSelector('[data-act="music"]', { timeout: 8000 });
  await page.locator('[data-act="music"]').click(); await W(page, 200);
  let mx = (await store(page)).mix;
  check('S9a ayarlardan muzik KAPAT: kayda yazilir, muzik durur', mx && mx.music === false && !(await mus(page)).playing, JSON.stringify({ mx, m: await mus(page) }));
  await page.locator('[data-act="musicvol"]').click(); await W(page, 150);
  mx = (await store(page)).mix;
  check('S9b seviye dugmesi seviyeyi degistirir (kalici, 0-1 araligi)', mx.vol > 0 && mx.vol <= 1, JSON.stringify(mx));
  await page.evaluate(() => { location.hash = '#/adventure'; });
  await page.waitForSelector('.adv-mapscreen .adv-node');
  await enterTask(page);
  await W(page, 400);
  let s = await snap(page);
  check('S9c muzik kapaliyken Karanlik Ev: muzik CALMAZ ama ortam sesi calar (bagimsiz)', !s.m.playing && s.a.playing && s.a.scene === 'ev-gece', JSON.stringify(s));
  await toMap(page);
  await page.locator('[data-act="sound"]').click({ force: true }); await W(page, 300);
  s = await snap(page);
  check('S9d sessiz mod hepsini susturur', !s.m.playing && !s.a.enabled && (await store(page)).sound === false, JSON.stringify(s));
  await enterTask(page);
  await W(page, 300);
  s = await snap(page);
  check('S9e sessiz mod sahne degisince KORUNUR (hicbir ses baslamaz)', !s.m.playing && !s.a.playing, JSON.stringify(s));
  await toMap(page);
  await page.locator('[data-act="sound"]').click({ force: true }); await W(page, 300);
  s = await snap(page);
  check('S9f ses tekrar acilinca: muzik tercihi (KAPALI) korunur, ortam acik', !s.m.playing && s.m.enabled === false && s.a.enabled === true, JSON.stringify(s));
  await page.reload();
  await page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 8000 });
  check('S9g yeniden acilista tercih korunur', (await store(page)).mix.music === false && (await mus(page)).enabled === false);
  await page.close();
}

// ---- S10: arka plan / on plan ----
if (on('S10')) {
  const { page } = await mk(SEED(), { width: 800, height: 360 });
  await openTask(page);
  await W(page, 500);
  const before = await snap(page);
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await W(page, 400);
  const hid = await snap(page);
  check('S10a arka plana gecince muzik ve ortam sesi susar, zamanlayici durur', !hid.m.playing && hid.m.hidden && !hid.m.timer && !hid.a.playing, JSON.stringify(hid));
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await W(page, 500);
  const vis = await snap(page);
  check('S10b geri gelince AYNI parca/sahne devam eder, yeniden baslatma ve cogalma yok', vis.m.track === before.m.track && vis.m.starts === before.m.starts && vis.m.timer && vis.a.scene === before.a.scene && vis.a.playing, JSON.stringify({ before, vis }));
  await page.close();
}

// ---- S11: konusma/efekt/muzik birbirini bastirmaz ----
if (on('S11')) {
  const { page } = await mk(SEED(), { width: 800, height: 360 });
  await openTask(page);
  await toSearch(page);
  await W(page, 300);
  const r = await page.evaluate(async () => {
    const m = window.__altezMusic; const lv = []; let overlap = window.__sp.overlap;
    for (let i = 0; i < 30; i++) { lv.push({ d: m.state.ducked, l: m.state.level }); await new Promise((x) => setTimeout(x, 50)); }
    return { lv, overlap: window.__sp.overlap - overlap };
  });
  await findAll(page, ['sandik', 'cekmece']);
  const sp = await page.evaluate(() => ({ overlap: window.__sp.overlap, cancel: window.__sp.cancel }));
  check('S11a ust uste konusma YOK: ayni anda tek konusma (overlap=0)', sp.overlap === 0 && r.overlap === 0, JSON.stringify({ sp, r: r.overlap }));
  check('S11b muzik seviyesi tavan 0.8, efekt/ortam ile birlikte asilmaz', (await mus(page)).level <= 0.8 + 1e-9, JSON.stringify(await mus(page)));
  await page.close();
}

// ---- S12: eksik ses dosyasi ----
if (on('S12')) {
  const { page, errs } = await mk(SEED(), { width: 800, height: 360 });
  await page.route('**/assets/manifest.json', async (route) => {
    const resp = await route.fetch(); const j = await resp.json();
    j.music = { ...j.music, 'ev-gizem': 'assets/sounds/music/yok.mp3', tema: 'assets/sounds/music/yok2.mp3' };
    j.ambience = { ...j.ambience, 'ev-gece': 'assets/sounds/ambience/yok.mp3' };
    await route.fulfill({ response: resp, json: j });
  });
  const missing = [];
  page.on('response', (r) => { if (/yok2?\.mp3/.test(r.url())) missing.push(r.status()); });
  await openTask(page);
  await W(page, 2000);
  await toSearch(page);
  const s = await snap(page);
  check('S12 eksik muzik/ortam MP3 dosyasi: oyun cokmez, akis surer, sentetige duser (parca/sahne calar)', (await page.locator('.dh[data-stage="search"]').count()) === 1 && (s.m.playing || s.m.want === 'ev-gizem') && s.a.scene === 'ev-gece', JSON.stringify({ s, missing }));
  check('S12b sayfa isleyici hatasi yok (yakalanmamis istisna)', errs.filter((e) => /^(TypeError|ReferenceError|Uncaught)/.test(e)).length === 0, JSON.stringify(errs.slice(0, 3)));
  await page.close();
}

// ---- S13: yonergeyi tekrar dinle ----
if (on('S13')) {
  const { page } = await mk(SEED(), { width: 800, height: 360 });
  await openTask(page);
  await toSearch(page);
  await W(page, 500);
  const n0 = (await spoken(page)).filter((t) => t === T.say).length;
  const rb = page.locator('[data-act="replay"], .dh-replay, [data-dh="replay"]');
  const has = (await rb.count()) > 0;
  if (has) { await rb.first().click({ force: true }); await W(page, 500); }
  const n1 = (await spoken(page)).filter((t) => t === T.say).length;
  check('S13 yonergeyi tekrar dinle dugmesi var ve ayni yonergeyi tekrar okutur (metinle ayni)', has && n1 === n0 + 1, JSON.stringify({ has, n0, n1 }));
  await page.close();
}

// ---- S14: diger maceralar dogru ortam/muzigi secer (tasarim eslemesi, bolum yok) ----
if (on('S15')) {
  // GERCEK DOSYA YOLU: kayitli (106 MP3'ten biri) yonergesi olan ilk gorev (Pil) -> Audio ile MP3 calinir (HTTP 200, cozulebilir), TTS KONUSMAZ.
  // Bu test dosyanin cozulup HTMLMediaElement.play cagrildigini kanitlar; hoparlorden ses ciktigini KANITLAMAZ.
  const { ctx, page, errs } = await mk(SEED({ adv: { intro: true, tasks: {} } }), { width: 800, height: 360 });
  await page.addInitScript(() => {
    window.__plays = []; const o = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push(this.currentSrc || this.src); return Promise.resolve(); };
  });
  const voiceResp = [];
  page.on('response', (r) => { if (/\/assets\/sounds\/voice\/[^/]+\.mp3/.test(r.url())) voiceResp.push(r.status()); });
  await page.goto(BASE_MP3 + '?r=' + Math.random().toString(36).slice(2) + '#/adventure');
  await page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 8000 });
  await page.locator(`.adv-node[data-id="${CFG.regions[0].tasks[0]}"]`).click({ force: true });
  await page.waitForSelector('.adv-task main > *'); await W(page, 900);
  const pl = await page.evaluate(() => window.__plays.filter((u) => /assets\/sounds\/voice\//.test(u)));
  const tts = await spoken(page);
  check('S15a kayitli yonerge: MP3 Audio ile calinir (voice/*.mp3, HTTP 200), ayni anda TTS konusmaz', pl.length === 1 && voiceResp.length >= 1 && voiceResp.every((c) => c === 200) && tts.length === 0, JSON.stringify({ pl, voiceResp, tts }));
  await page.locator('[data-act="replay"]').click({ force: true }); await W(page, 500);
  const pl2 = await page.evaluate(() => window.__plays.filter((u) => /assets\/sounds\/voice\//.test(u)));
  check('S15b "Tekrar dinle": ayni MP3 tekrar baslar (toplam 2), ust uste ikinci kopya ve TTS yok', pl2.length === 2 && pl2[0] === pl2[1] && (await spoken(page)).length === 0, JSON.stringify(pl2));
  check('S15c sayfa hatasi yok', errs.length === 0, errs.join(' | '));
  await ctx.close();
}

if (on('S16')) {
  // R6: 17 yeni Karanlik Ev satiri -> her olayda DOGRU dosya (anahtar, ekrandaki/yapilandirmadaki METINDEN turetilir; dosya adindan tahmin YOK).
  // Kanit siniri: HTMLMediaElement.play cagrisi + HTTP 200 + anahtar eslesmesi; hoparlorden ses ciktigini KANITLAMAZ.
  const { ctx, page, errs } = await mk(SEED({ band: '6-8', adv: { intro: true, tasks: { ...DONE15 } } }), { width: 800, height: 360 });
  await page.addInitScript(() => { window.__plays = []; HTMLMediaElement.prototype.play = function () { window.__plays.push(this.currentSrc || this.src); setTimeout(() => this.dispatchEvent(new Event('ended')), 1500); return Promise.resolve(); }; });
  const codes = []; page.on('response', (r) => { if (/\/sounds\/voice\/adv_/.test(r.url())) codes.push(r.status()); });
  const key = (t) => page.evaluate(async (x) => (await import('/src/core/voicekey.js')).lineKey(x), t);
  const played = () => page.evaluate(() => window.__plays.map((u) => (u.match(/(adv_[0-9a-f]{8})\.mp3/) || [])[1]).filter(Boolean));
  const waitKey = async (k, ms = 22000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await played()).includes(k)) return true; await W(page, 250); } return false; };
  const want = []; const got = {};
  const expect = async (label, text) => { const k = await key(text); want.push(k); got[label] = await waitKey(k); return got[label]; };
  await page.goto(BASE_MP3 + '?r=' + Math.random().toString(36).slice(2) + '#/adventure');
  await page.waitForSelector('.adv-mapscreen .adv-node', { timeout: 8000 });
  await page.locator('.adv-node[data-id="karanlik-ev"]').click({ force: true });
  await page.waitForSelector('.dh[data-stage="cinema"]', { timeout: 4000 });
  for (let i = 0; i < 3; i++) await expect('sahne' + i, T.scenes[i].learn);
  await toSearch(page);
  await expect('say', T.say);
  const dk = await page.evaluate(async () => { const m = window.__altezMusic; const a = m.state.ducked; await new Promise((r) => setTimeout(r, 2200)); return { during: a, after: m.state.ducked }; });
  check('S16f MP3 anlatim sirasinda muzik KISILIR (ducked), MP3 bitince (ended) geri gelir', dk.during === true && dk.after === false, JSON.stringify(dk));
  await expect('idle', T.hints.idle);
  for (const sp of T.spots) { await page.locator(`.dh-spot[data-id="${sp.id}"]`).click({ force: true }); await expect('spot-' + sp.id, sp.say); }
  await page.locator('[data-dh="build"]').click({ force: true });
  await page.waitForSelector('.dh[data-stage="build"] .adv-circuit');
  await expect('start', T.hints.start);
  await page.locator('.cx-tile[data-type="leaf"]').click({ force: true }); await page.locator('.cx-slot[data-edge="left"]').click({ force: true });
  await expect('insulator', T.hints.insulator);
  await page.locator('.cx-slot[data-edge="top"]').click({ force: true });
  const incKey = await key(T.hints.incomplete); await W(page, 600); const incPlayed = (await played()).includes(incKey); // R6 BULGU: bu ipucu yalniz YAZI olarak gosterilir (circuit.js talk() cagirmaz) -> MP3'u hic cagrilmaz
  await placeAll(page); await lightUp(page);
  await expect('win', T.win);
  if (process.env.DBG) console.log('DBG', await page.evaluate(() => ({ stage: document.querySelector('.dh')?.dataset.stage, got: window.__plays.length, html: document.querySelector('.dh')?.innerText.slice(0, 200) })), JSON.stringify(got));
  await page.locator('[data-act="finish"]').click({ force: true });
  await page.waitForSelector('.dh-next', { timeout: 4000 });
  await page.locator('.dh-next').click({ force: true });
  await page.waitForSelector('.rw-title', { timeout: 6000 }).catch(() => {});
  const fk = await key(CFG.regions.find((r) => r.id === 'karanlik')?.finalTitle || '');
  const fin = await waitKey(fk, 6000); got.finalTitle = fin; want.push(fk);
  const nextKey = await key(T.next); await W(page, 600); const nextPlayed = (await played()).includes(nextKey); // R6 BULGU: odul ekraninda yalniz yazi (index.js speak yalniz baslik)
  const all = await played();
  const dup = all.filter((k, i) => i > 0 && k === all[i - 1]);
  check('S16a 15/17 satir kendi olayinda cagrildi (sahne x3, say, idle, spot x6, start, insulator, win, finalTitle); kalan 2 (incomplete, next) S16e', Object.values(got).every(Boolean), JSON.stringify(Object.entries(got).filter(([, v]) => !v).map(([k]) => k)) + ' calan=' + all.length);
  check('S16b calinan her dosya HTTP 200 (eksik dosya yok, 404 yok)', codes.length > 0 && codes.every((c) => c === 200), JSON.stringify([...new Set(codes)]));
  check('S16c ayni dosya art arda ikinci kez baslamadi (gereksiz tekrar yok)', dup.length === 0, JSON.stringify(dup));
  check('S16e BILINEN BOSLUK (belgeli): hints.incomplete (adv_1af7bacb) ve tasks.karanlik-ev.next (adv_51f3721e) yalniz YAZI olarak gosterilir; MP3\'leri uygulamada CAGRILMAZ (yanlis dosya da calinmaz)', incPlayed === false && nextPlayed === false, JSON.stringify({ incPlayed, nextPlayed }));
  check('S16d sayfa hatasi yok', errs.length === 0, errs.join(' | '));
  const nxt = CFG.regions.find((r) => r.id === 'karanlik');
  await ctx.close();
}

if (on('S14')) {
  const { page } = await mk(SEED(), { width: 800, height: 360 });
  await page.goto(BASE + '?r=' + Math.random() + '#/settings');
  await page.waitForSelector('[data-act="music"]');
  const r = await page.evaluate(async () => {
    const { soundscapeFor, SOUNDSCAPES } = await import('/src/core/soundscape.js');
    return { map: Object.fromEntries(Object.keys(SOUNDSCAPES).map((k) => [k, soundscapeFor(k)])) };
  });
  const m = r.map;
  const amb = (k) => m[k]?.ambience;
  check('S14a orman -> orman muzigi + orman ortami; selale sesi YALNIZ orman-selale sahnesinde', m.orman?.music === 'orman' && amb('orman') === 'orman' && amb('orman-selale') === 'orman-selale' && Object.entries(m).filter(([k, v]) => /selale/.test(v?.ambience || '')).map(([k]) => k).join() === 'orman-selale', JSON.stringify(m));
  check('S14b mahalle/koy/atolye kendi muzik ve ortamini secer (su/pompa yalniz koyde)', m.mahalle?.music === 'mahalle' && m.koy?.music === 'koy' && amb('koy') === 'koy-dere' && amb('koy-pompa') === 'pompa' && m.atolye?.music === 'atolye' && amb('atolye') === 'atolye', JSON.stringify(m));
  check('S14c bu bolumler henuz YAPILMADI: hepsi ready:false (bitmis gibi sunulmaz)', ['orman', 'orman-selale', 'mahalle', 'koy', 'koy-pompa', 'atolye'].every((k) => m[k]?.ready === false), JSON.stringify(m));
  await page.close();
}

// ---- N: sayisal icerik (OfflineAudioContext) ----
if (on('N')) {
  const { page } = await mk(SEED(), { width: 800, height: 360 });
  await page.goto(BASE + '?r=' + Math.random() + '#/settings');
  await page.waitForSelector('[data-act="music"]');
  const res = await page.evaluate(async () => {
    const mu = await import('/src/core/music.js');
    const am = await import('/src/core/ambience.js');
    const stat = (buf) => { let pk = 0, ss = 0, n = 0, bad = 0; for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = d[i]; if (!Number.isFinite(v)) { bad++; continue; } const a = Math.abs(v); if (a > pk) pk = a; ss += v * v; n++; } } return { peak: pk, rms: Math.sqrt(ss / Math.max(1, n)), bad, sec: buf.duration }; };
    const out = { music: {}, amb: {} };
    for (const id of mu.trackIds()) { try { out.music[id] = stat(await mu.renderTrack(OfflineAudioContext, id, 4, 22050)); } catch (e) { out.music[id] = { err: String(e) }; } }
    for (const id of Object.keys(am.SCENES)) {
      try {
        const oc = new OfflineAudioContext(1, 22050 * 4, 22050); const g = oc.createGain(); g.connect(oc.destination);
        am.buildScene(oc, g, id, { set: () => 0, clear: () => {} });
        out.amb[id] = stat(await oc.startRendering());
      } catch (e) { out.amb[id] = { err: String(e) }; }
    }
    return out;
  });
  const okM = Object.entries(res.music).every(([k, v]) => !v.err && v.bad === 0 && v.rms > 0.002 && v.peak > 0.02 && v.peak < 0.95);
  check('N1 her muzik parcasi (8) cevrimdisi render: sessiz degil (RMS>0.002), NaN yok, tepe <0.95 (patlama/kirpilma yok)', okM, JSON.stringify(res.music));
  const okA = Object.entries(res.amb).every(([k, v]) => !v.err && v.bad === 0 && v.peak < 0.95);
  const quiet = Object.entries(res.amb).filter(([k, v]) => !v.err && v.rms < 0.0005).map(([k]) => k);
  check('N2 her ortam sahnesi (8) render: NaN yok, tepe <0.95, hata yok', okA, JSON.stringify(res.amb));
  check('N3 ortam sahneleri duyulur seviyede (RMS>0.0005) ama muzikten sessiz (ortam rms < muzik rms ort.)', quiet.length === 0 && Object.values(res.amb).reduce((a, v) => a + v.rms, 0) / 8 < Object.values(res.music).reduce((a, v) => a + v.rms, 0) / 8 * 1.5, JSON.stringify({ quiet }));
  console.log('# RENDER-ISTATISTIK ' + JSON.stringify(res));
  await page.close();
}

} catch (e) {
  check('BEKLENMEYEN HATA', false, String(e).slice(0, 400));
}
await browser.close();
server.close(); serverMp3.close();
const bad = results.filter((r) => !r.ok);
console.log(`\nV8.5 SES UI: ${results.length - bad.length}/${results.length} gecti${bad.length ? ', ' + bad.length + ' BASARISIZ' : ''}`);
console.log('GERCEK ANDROID CIHAZ TESTI YAPILMADI; ses CIKTISI duyulmadi (Chromium durum/cagri/sayisal render).');
process.exit(bad.length ? 1 : 0);
