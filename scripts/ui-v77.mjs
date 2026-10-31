// V7.7 HEDEFLI tarayici testi (Chromium): yalniz V7.7 Gorevler (hub, Elektrik Dedektifi, Mantik ve Bilim) + kisa regresyon.
//   node scripts/ui-v77.mjs                      -> calistirir (cikis kodu 0 = hepsi basarili)
//   ONLY=C node scripts/ui-v77.mjs               -> yalniz C bolumu; SHOTS=/yol node ... -> ekran goruntuleri de kaydeder
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
// V7.8: Gorevler hub'i artik Ana Menu'de dugme DEGIL (Elektrik Dedektifi / Mantik ve Bilim Oyunlar ekraninda kartlarla acilir); hub kodu '#/play/tasks' ile dogrudan test edilir
const toHub = async (page) => { await page.goto(BASE + '?home=1#/play/tasks'); await page.waitForSelector('.tk-hub'); };
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

try {
  // A) (V7.8) Ana ekran artik 4 bolumlu Ana Menu: kontroller scripts/ui-v78-home.mjs icindedir.

  // ======================= B) Hub =======================
  if (on('B')) {
    const { ctx, page, errs, external } = await mk(SEED('4-5'));
    await toHub(page);
    const hub = await page.evaluate(() => ({ cards: [...document.querySelectorAll('.tk-card')].map((c) => c.querySelector('b').textContent + '|' + c.querySelector('small').textContent) }));
    check('B1 hub: iki kart, ad ve ilerleme (4-5: 8 vaka, 8 gorev)', JSON.stringify(hub.cards) === JSON.stringify(['Elektrik Dedektifi|0 / 8 vaka', 'Mantık ve Bilim|0 / 8 görev']), JSON.stringify(hub.cards));
    check('B2 hub 360x640: kartlar ekranda, tasma yok', (await inViewX(page, '.tk-card')) && (await noHOverflow(page)));
    await shot(page, 'b-hub');
    await openGame(page, 'detective');
    check('B3 Dedektif listesi: 8 vaka, siradaki vaka karti ilk vaka, ilerleme 0 / 8', (await page.locator('.tk-task').count()) === 8 && (await page.getAttribute('.tk-nextcard', 'data-target')) === 'd1-kayip-lamba' && (await page.textContent('.tk-overall')).includes('0 / 8 vaka'));
    await tap(page, '[data-act="back"]');
    await page.waitForSelector('.tk-hub');
    check('B4 listeden geri -> hub', (await page.locator('.tk-card').count()) === 2);
    await openGame(page, 'logic-science');
    check('B5 Mantik ve Bilim listesi: 8 gorev (4-5), ilk gorev l1-tohum', (await page.locator('.tk-task').count()) === 8 && (await page.getAttribute('.tk-nextcard', 'data-target')) === 'l1-tohum');
    await tap(page, '[data-act="back"]');
    await page.waitForSelector('.tk-hub');
    await tap(page, '[data-act="home"]');
    await page.waitForSelector('.menu .menu-card');
    check('B6 hub -> ana menu (dogrudan acilan hub 🏠 ile menuye doner); menude 4 bolum karti', (await page.locator('.menu .menu-card').count()) === 4);
    check('B7 sayfa/konsol hatasi yok, harici adres yok', errs.length === 0 && external.length === 0, errs.slice(0, 2).join('|') + external.join(','));
    await ctx.close();
    const c6 = await mk(SEED('6-8'));
    await toHub(c6.page);
    const t6 = await c6.page.evaluate(() => [...document.querySelectorAll('.tk-card small')].map((s) => s.textContent));
    check('B8 6-8 yas hub: 15 vaka, 16 gorev', JSON.stringify(t6) === JSON.stringify(['0 / 15 vaka', '0 / 16 görev']), JSON.stringify(t6));
    await c6.ctx.close();
  }

  // ======================= C) Elektrik Dedektifi (4-5 yas) =======================
  if (on('C')) {
    const { ctx, page, errs } = await mk(SEED('4-5'));
    await toHub(page);
    await openGame(page, 'detective');
    // --- d1 missing: iki yanlis, sonra dogru; kademeli ipucu
    await openCase(page, 'd1-kayip-lamba');
    check('C1 d1: vaka hikayesi yazisi, 3 secenek (4-5 siniri), devre cizili, lamba yanmiyor', (await cap(page)).startsWith('Lamba yanmıyor') && (await page.locator('[data-opt]').count()) === 3 && (await lit(page)) === '0' && (await powered(page)) === 0);
    await shot(page, 'c-d1-start');
    await tap(page, '[data-opt="wire"]', 100);
    await W(page, 300);
    check('C2 d1 1. yanlis (kablo): secenege ozel ipucu, secenek soluk, vaka cozulmedi', (await cap(page)).includes('Kablo yolu bağlar ama ışık vermez') && (await page.locator('[data-opt="wire"][aria-disabled="true"]').count()) === 1 && (await page.locator('[data-act="finish"]').count()) === 0);
    await page.click('[data-opt="resistor"]');
    await W(page, 300);
    check('C3 d1 2. yanlis (direnc): GUCLU ipucu (hint2) gosterilir', (await cap(page)) === 'Işık veren parçanın adı LED. Aşağıda onu bul.', await cap(page));
    const sp0 = (await spoken(page)).length;
    await page.click('[data-opt="wire"]', { force: true }).catch(() => {});
    await page.click('[data-opt="wire"]', { force: true }).catch(() => {});
    await W(page, 300);
    check('C4 solgun yanlis secenege tekrar dokunus: ek ses/konusma yok', (await spoken(page)).length === sp0);
    const o1 = await osc(page);
    await page.click('[data-opt="led"]');
    await W(page, 1200);
    check('C5 d1 dogru (LED): lamba yanar (.power, lit=1), basari geri bildirimi, Devam dugmesi', (await lit(page)) === '1' && (await powered(page)) === 1 && (await cap(page)).includes('Lamba yandı') && (await page.locator('[data-act="finish"]').count()) === 1);
    check('C6 basari sesi calar', (await osc(page)) > o1, `${o1}->${await osc(page)}`);
    await shot(page, 'c-d1-solved');
    check('C7 kayit: games.detective.done=[d1], correct=1; edu.done degismedi', JSON.stringify(await tasksOf(page, 'detective')) === '["d1-kayip-lamba"]' && (await store(page)).games.detective.correct === 1 && JSON.stringify((await store(page)).edu.done) === '["circuit-1","switch-1"]');
    await finish(page);
    const d = await doneInfo(page);
    check('C8 bitis: "Vaka cozuldu!", YENI rozet, sayac 1 / 8 vaka', d.q === 'Vaka çözüldü!' && d.isNew === '1' && d.head === 'Yeni rozet kazandın!' && d.badge === 'd1-kayip-lamba' && d.count === '1' && d.total === '8' && d.noteCount === 0, JSON.stringify(d));
    await shot(page, 'c-d1-done');
    await tap(page, '[data-act="opennext"]');
    await page.waitForSelector('.tk-prompt');
    await W(page, 450);
    // --- d2 missing (2 secenek)
    check('C9 "Sonraki vaka" d2 acar; iki secenek', (await page.locator('[data-opt]').count()) === 2);
    await page.click('[data-opt="switch"]');
    await W(page, 300);
    check('C10 d2 yanlis (anahtar): ipucu "anahtar acik"', (await cap(page)).includes('anahtar açık'));
    await page.click('[data-opt="wire"]');
    await W(page, 900);
    check('C11 d2 dogru (kablo): lamba yanar', (await lit(page)) === '1' && (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // --- d3 fault: acik anahtar
    await openCase(page, 'd3-acik-anahtar');
    check('C12 d3 ariza: parca tepsisi yok, devre tam gorunur ama lamba yanmiyor', (await page.locator('[data-tool],[data-opt]').count()) === 0 && (await lit(page)) === '0');
    await page.click('[data-slot="s1"]');
    await W(page, 300);
    check('C13 d3 saglam kabloya dokunma: "Bu kablo saglam" ipucu, cozulmedi', (await cap(page)).includes('Bu kablo sağlam') && (await lit(page)) === '0');
    await page.click('[data-slot="s2"]');
    await W(page, 300);
    check('C14 d3 2. yanlis (lamba): guclu ipucu', (await cap(page)) === 'Yolu açıp kapatan parçaya bak.', await cap(page));
    await page.click('[data-switch="s3"]');
    await W(page, 1000);
    check('C15 d3 anahtara dokun: yol kapanir, lamba yanar, vaka cozuldu', (await lit(page)) === '1' && (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // --- d4 fault: bosluk
    await openCase(page, 'd4-bosluk');
    await page.click('[data-slot="s1"]');
    await W(page, 250);
    await page.click('[data-slot="s2"]');
    await W(page, 1000);
    check('C16 d4 bosluga dokun: kopuk yol onarilir, lamba yanar', (await lit(page)) === '1' && (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // --- d5 build
    await openCase(page, 'd5-tamamla');
    check('C17 d5: parca tepsisi (3 parca + sil = 4 dugme)', (await page.locator('[data-tool]').count()) === 4);
    await page.click('[data-slot="s1"]');
    await W(page, 250);
    check('C18 d5 parca secmeden dokunma: "Once bir parca sec" yonergesi', (await cap(page)).includes('Önce aşağıdan bir parça seç'));
    await place(page, 'wire', 's1');
    await W(page, 300);
    check('C19 d5 yarim baglanti: bosluk ipucu, cozulmedi', (await cap(page)).includes('boşluk') && (await lit(page)) === '0');
    await place(page, 'wire', 's3');
    await W(page, 1000);
    check('C20 d5 tamamlandi: lamba yanar, Devam', (await lit(page)) === '1' && (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // --- d6 build bos
    await openCase(page, 'd6-kendin-kur');
    await place(page, 'wire', 's1'); await place(page, 'wire', 's2'); await place(page, 'wire', 's3');
    await W(page, 300);
    check('C21 d6 yalniz kablo (kisa devre): "LED yok" ipucu, cozulmedi', /LED/.test(await cap(page)) && (await lit(page)) === '0', await cap(page));
    await place(page, 'led', 's2');
    await W(page, 1000);
    check('C22 d6 LED eklenince lamba yanar', (await lit(page)) === '1' && (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    const m = await page.evaluate(() => ({ n: document.querySelector('.tk-overall').dataset.count, rep: document.querySelectorAll('.tk-task .ll-replay').length, next: document.querySelector('.tk-nextcard')?.dataset.kind }));
    check('C23 6 vaka bitince: ilerleme 6 / 8, 6 "Tekrar oyna" etiketi, kart siradaki (d13) kipinde', m.n === '6' && m.rep === 6 && m.next === 'next', JSON.stringify(m));
    const dd = await doneInfo(page).catch(() => null);
    void dd;
    check('C24 kayit: 6 vaka, sira korunur', JSON.stringify(await tasksOf(page, 'detective')) === '["d1-kayip-lamba","d2-kopuk-yol","d3-acik-anahtar","d4-bosluk","d5-tamamla","d6-kendin-kur"]');
    check('C25 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();
  }

  // ======================= D) Elektrik Dedektifi (6-8 yas): ileri vakalar + 3. yanlistan sonra gorsel yardim =======================
  if (on('D')) {
    const { ctx, page, errs } = await mk(SEED('6-8'));
    await toHub(page);
    await openGame(page, 'detective');
    check('D1 6-8: 15 vaka listelenir (d1/d2 yalniz 4-5)', (await page.locator('.tk-task').count()) === 15 && (await page.locator('.tk-task[data-task="d1-kayip-lamba"]').count()) === 0);
    // d9 paralel ariza: 3 yanlis -> gorsel yardim
    await openCase(page, 'd9-paralel-ariza');
    await page.click('[data-slot="s6"]');
    await W(page, 250);
    check('D2 d9 1. yanlis (yanan lamba): vakaya ozel ipucu', (await cap(page)).includes('Bu lamba yanıyor, sağlam'), await cap(page));
    await page.click('[data-slot="s1"]');
    await W(page, 250);
    check('D3 d9 2. yanlis: guclu ipucu', (await cap(page)) === 'Yanmayan lambanın yolunda kesik çizgi var.', await cap(page));
    check('D4 henuz gorsel yardim yok', (await page.locator('.board .slot.hint').count()) === 0);
    await page.click('[data-slot="s3"]');
    await W(page, 300);
    check('D5 3. yanlistan sonra bosluk VURGULANIR (gorsel yardim), cevap otomatik uygulanmaz, vaka cozulmedi', (await page.locator('.board .slot.hint').count()) === 1 && (await lit(page)) === '1' && (await page.locator('[data-act="finish"]').count()) === 0, `lit=${await lit(page)}`);
    await shot(page, 'd-d9-assist');
    await page.click('[data-slot="s2"]');
    await W(page, 1000);
    check('D6 d9 bosluga dokun: iki lamba da yanar, vaka cozuldu', (await page.locator('.tk-prompt svg.board.power').count()) === 1 && (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // d7 direnc
    await openCase(page, 'd7-direnc');
    check('D7 d7: 4 arac (+sil)', (await page.locator('[data-tool]').count()) === 5);
    await place(page, 'wire', 's3');
    await W(page, 300);
    check('D8 d7 kablo ile yanar ama direnc yok: "direnc koy" ipucu, cozulmedi', (await cap(page)).includes('direnç') && (await page.locator('[data-act="finish"]').count()) === 0, await cap(page));
    await place(page, 'resistor', 's3');
    await W(page, 1000);
    check('D9 d7 direnc: vaka cozuldu', (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // d8 anahtar
    await openCase(page, 'd8-anahtar');
    await place(page, 'switch', 's3');
    await W(page, 300);
    check('D10 d8 anahtar koyuldu ama acik: "Anahtar acik" ipucu', (await cap(page)).includes('Anahtar açık') && (await page.locator('[data-act="finish"]').count()) === 0, await cap(page));
    await page.click('[data-switch="s3"]');
    await W(page, 1000);
    check('D11 d8 anahtar kapatilinca lamba yanar, vaka cozuldu', (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // d10 iki lamba (missing, ladder)
    await openCase(page, 'd10-iki-lamba-parca');
    await page.click('[data-opt="wire"]');
    await W(page, 250);
    check('D12 d10 kablo: kisa devre ipucu', (await cap(page)).includes('kısa devre'));
    await page.click('[data-opt="resistor"]');
    await W(page, 250);
    await page.click('[data-opt="led"]');
    await W(page, 1000);
    check('D13 d10 LED: iki lamba yanar, cozuldu', (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // d11 iki lamba
    await openCase(page, 'd11-iki-lamba');
    await place(page, 'led', 's4');
    await W(page, 300);
    await place(page, 'wire', 's6');
    await W(page, 300);
    check('D14 d11 ikinci kola kablo (kisa devre): cozulmedi', (await page.locator('[data-act="finish"]').count()) === 0);
    await place(page, 'led', 's6');
    await W(page, 1000);
    check('D15 d11 iki kola birer LED: cozuldu', (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // d12 iki ariza
    await openCase(page, 'd12-iki-ariza');
    await page.click('[data-slot="s1"]');
    await W(page, 400);
    check('D16 d12 ilk ariza duzeltildi: "Bir sorunu buldun" mesaji, lamba hala yanmaz, cozulmedi', (await cap(page)).includes('Bir sorunu buldun') && (await lit(page)) === '0' && (await page.locator('[data-act="finish"]').count()) === 0, await cap(page));
    await page.click('[data-switch="s3"]');
    await W(page, 1000);
    check('D17 d12 ikinci ariza (anahtar): cozuldu', (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    check('D18 6-8: 6 vaka cozuldu (d9,d7,d8,d10,d11,d12), kayit games.detective.done 6 eleman', (await tasksOf(page, 'detective')).length === 6);
    check('D19 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();
  }

  // ======================= E) Mantik ve Bilim =======================
  if (on('E')) {
    const { ctx, page, errs } = await mk(SEED('4-5'));
    await toHub(page);
    await openGame(page, 'logic-science');
    // l1 siralama (3 oge)
    await openCase(page, 'l1-tohum');
    const items = await page.evaluate(() => [...document.querySelectorAll('[data-item]')].map((b) => b.dataset.item));
    check('E1 siralama: 3 oge karistirilmis (dogru sirada degil), 3 hedef kutu', items.length === 3 && items.join() !== '0,1,2' && (await page.locator('.ls-slot').count()) === 3, items.join());
    await page.click('[data-item="2"]');
    await W(page, 250);
    check('E2 yanlis oge (cicek once): ogeye ozel ipucu, kutuya yerlesmez', (await cap(page)).includes('Çiçek en son açar') && (await page.locator('.ls-slot.on').count()) === 0);
    await page.click('[data-item="1"]');
    await W(page, 250);
    check('E3 2. yanlis: guclu ipucu (hint2)', (await cap(page)).startsWith('Bir bitki önce tohumdur'), await cap(page));
    await page.click('[data-item="0"]');
    await W(page, 250);
    check('E4 dogru ilk oge yerlesir (1 kutu dolu); gorev bitmedi', (await page.locator('.ls-slot.on').count()) === 1 && (await page.locator('[data-act="finish"]').count()) === 0);
    await page.click('[data-item="0"]', { force: true }).catch(() => {});
    await W(page, 200);
    check('E5 yerlesmis ogeye tekrar dokunmak bir sey yapmaz', (await page.locator('.ls-slot.on').count()) === 1);
    await page.click('[data-item="1"]');
    await W(page, 250);
    await page.click('[data-item="2"]');
    await W(page, 800);
    check('E6 siralama tamam: 3 kutu dolu, Devam', (await page.locator('.ls-slot.on').count()) === 3 && (await page.locator('[data-act="finish"]').count()) === 1);
    await shot(page, 'e-order-solved');
    await finish(page);
    check('E7 bitis: yeni rozet + "Ogrendin" bilgisi (learn)', (await page.textContent('.tk-learned')).includes('Bitkiler tohumdan') && (await doneInfo(page)).isNew === '1');
    await backToList(page);
    // l5 orutu
    await openCase(page, 'l5-renkler');
    check('E8 orutu: 5 hucre + ? ve 3 secenek', (await page.locator('.ls-cell').count()) === 6 && (await page.locator('[data-opt]').count()) === 3);
    const idx = (txt) => page.evaluate((t) => [...document.querySelectorAll('[data-opt]')].find((b) => b.getAttribute('aria-label') === t).dataset.opt, txt);
    await page.click(`[data-opt="${await idx('Yeşil')}"]`);
    await W(page, 250);
    check('E9 orutu yanlis: ipucu cevabi soylemez', (await cap(page)) === 'Dizide yeşil yok. İki renk sırayla tekrar ediyor.', await cap(page));
    await page.click(`[data-opt="${await idx('Mavi')}"]`);
    await W(page, 800);
    check('E10 orutu dogru: ? yerine mavi gelir, cozuldu', (await page.textContent('.ls-q')).includes('🔵') && (await page.locator('[data-act="finish"]').count()) === 1);
    await finish(page);
    await backToList(page);
    // l9 neden-sonuc
    await openCase(page, 'l9-anahtar');
    await page.click(`[data-opt="${await idx('Patlar')}"]`);
    await W(page, 250);
    check('E11 neden-sonuc yanlis: ipucu', (await cap(page)).includes('Lamba patlamaz'));
    await page.click(`[data-opt="${await idx('Yanar')}"]`);
    await W(page, 800);
    check('E12 neden-sonuc dogru: "Gozlem:" paneli gorunur', (await page.textContent('.ls-observe')).includes('Gözlem:') && (await page.textContent('.ls-observe')).includes('lamba yanar'));
    await finish(page);
    await backToList(page);
    // l13 bilim
    await openCase(page, 'l13-miknatis');
    await page.click(`[data-opt="${await idx('Elma')}"]`);
    await W(page, 250);
    await page.click(`[data-opt="${await idx('Oyuncak ayı')}"]`);
    await W(page, 250);
    check('E13 bilim: iki yanlistan sonra guclu ipucu', (await cap(page)) === 'Mıknatıs demir gibi metalleri çeker.', await cap(page));
    await page.click(`[data-opt="${await idx('Çivi')}"]`);
    await W(page, 800);
    check('E14 bilim dogru: gozlem metni (mıknatıs demir parcalari ceker)', (await page.textContent('.ls-observe')).includes('demir parçaları çeker'));
    await shot(page, 'e-science-observe');
    await finish(page);
    await backToList(page);
    check('E15 4 gorev bitti; kayit games["logic-science"].done 4 eleman; edu.done ayni', (await tasksOf(page, 'logic-science')).length === 4 && JSON.stringify((await store(page)).edu.done) === '["circuit-1","switch-1"]');
    check('E16 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();
    // 6-8: 4 ogeli siralama, 4 secenekli orutu
    const c6 = await mk(SEED('6-8'));
    await toHub(c6.page);
    await openGame(c6.page, 'logic-science');
    check('E17 6-8: 16 gorev listelenir', (await c6.page.locator('.tk-task').count()) === 16);
    await openCase(c6.page, 'l3-gun');
    check('E18 6-8 siralama: 4 oge', (await c6.page.locator('[data-item]').count()) === 4);
    for (const i of [0, 1, 2, 3]) { await c6.page.click(`[data-item="${i}"]`); await W(c6.page, 200); }
    await W(c6.page, 700);
    check('E19 6-8 siralama dogru sirayla cozulur', (await c6.page.locator('[data-act="finish"]').count()) === 1);
    await finish(c6.page);
    await backToList(c6.page);
    await openCase(c6.page, 'l7-meyveler');
    check('E20 6-8 orutu: 4 secenek', (await c6.page.locator('[data-opt]').count()) === 4);
    await c6.ctx.close();
  }

  // ======================= F) Odul ve tekrar guvenligi =======================
  if (on('F')) {
    const { ctx, page, errs } = await mk(SEED('4-5'));
    await toHub(page);
    await openGame(page, 'detective');
    await openCase(page, 'd1-kayip-lamba');
    // hizli cift/cok dokunus: tek odul, tek basari sesi
    const o0 = await osc(page);
    for (let i = 0; i < 6; i++) await page.click('[data-opt="led"]', { force: true, noWaitAfter: true }).catch(() => {});
    await W(page, 1300);
    const oAfter = await osc(page);
    check('F1 hizli tekrar dokunus: kayitta TEK gorev, correct=1', JSON.stringify(await tasksOf(page, 'detective')) === '["d1-kayip-lamba"]' && (await store(page)).games.detective.correct === 1);
    const spS = (await spoken(page)).filter((t) => t.includes('Lamba yandı')).length;
    check('F2 hizli dokunus: basari konusmasi TEK, basari sesi tek seferlik (ek ses yok)', spS === 1 && (await osc(page)) === oAfter && oAfter > o0, `spoken=${spS} osc ${o0}->${oAfter}`);
    // cift dokunus Devam: yeni ekrandaki ogeye dusmez
    await tap(page, '[data-act="finish"]', 100);
    await W(page, 80);
    await page.click('[data-act="finish"]', { force: true, noWaitAfter: true }).catch(() => {});
    await page.waitForSelector('.tk-done');
    await W(page, 700);
    check('F3 Devam cift dokunus: bitis ekrani acik kalir (sonraki vakaya atlamaz)', (await page.locator('.tk-done').count()) === 1 && (await page.locator('.tk-prompt:not(.tk-done)').count()) === 0);
    const afterFirst = JSON.stringify(await store(page));
    // yeniden ac: tekrar oyna
    await backToList(page);
    const lab = await page.evaluate(() => ({ rep: document.querySelector('.tk-task[data-task="d1-kayip-lamba"] .ll-replay')?.textContent || '', aria: document.querySelector('.tk-task[data-task="d1-kayip-lamba"]').getAttribute('aria-label') }));
    check('F4 listede cozulen vaka: "Tekrar oyna" etiketi + ✔', lab.rep.includes('Tekrar oyna') && lab.aria.includes('Çözüldü'));
    await openCase(page, 'd1-kayip-lamba');
    await page.click('[data-opt="led"]');
    await W(page, 1200);
    check('F5 tekrar cozum: lamba yanar, geri bildirim var', (await lit(page)) === '1' && (await page.locator('[data-act="finish"]').count()) === 1);
    check('F6 tekrar cozumde kayit DEGISMEDI (odul yok)', JSON.stringify(await store(page)) === afterFirst);
    const oRep = await osc(page);
    await finish(page);
    const d = await doneInfo(page);
    check('F7 tekrar bitis: rozet YENI degil, "tekrar" notu, sayac artmadi, kupa yerine onay', d.isNew === '0' && d.head === 'Bu rozet zaten sende.' && d.noteCount === 1 && d.note.includes('yeni rozet yok') && d.count === '1' && d.trophy === '✅' && d.alldone === 0, JSON.stringify(d));
    check('F8 tekrar bitis: kutlama sesi (levelUp) calmaz', (await osc(page)) === oRep, `${oRep}->${await osc(page)}`);
    check('F9 tekrar bitis: konusma "tekrar" der, "yeni rozet" demez', await (async () => { const sp = await spoken(page); return sp.some((t) => t.includes('tekrar çözdün')) && !sp.slice(-1)[0].includes('Yeni rozet kazandın'); })());
    check('F10 tekrar sonrasi kayit hala AYNI', JSON.stringify(await store(page)) === afterFirst);
    // yeniden yukle (uygulama yeniden acilsin): ilerleme kalir, tekrar yine odulsuz
    await page.reload(); // rota (#/play/tasks) korunur: uygulama dogrudan Gorevler hub'ina acilir
    await page.waitForSelector('.tk-hub', { timeout: 8000 });
    check('F11 yeniden acinca hub ilerlemesi 1 / 8 vaka', (await page.textContent('.tk-card small')).includes('1 / 8'));
    await openGame(page, 'detective');
    await openCase(page, 'd1-kayip-lamba');
    await page.click('[data-opt="led"]');
    await W(page, 1000);
    await finish(page);
    check('F12 yeniden acilista tekrar: yine odul yok, kayit ayni', (await doneInfo(page)).isNew === '0' && JSON.stringify(await store(page)) === afterFirst);
    // Mantik gorevinde tekrar
    await backToList(page);
    await tap(page, '[data-act="back"]');
    await page.waitForSelector('.tk-hub');
    await openGame(page, 'logic-science');
    await openCase(page, 'l1-tohum');
    for (const i of [0, 1, 2]) { await page.click(`[data-item="${i}"]`); await W(page, 200); }
    await W(page, 700);
    await finish(page);
    const sAfter = JSON.stringify(await store(page));
    await backToList(page);
    await openCase(page, 'l1-tohum');
    for (const i of [0, 1, 2]) { await page.click(`[data-item="${i}"]`); await W(page, 200); }
    await W(page, 700);
    await finish(page);
    const dl = await doneInfo(page);
    check('F13 Mantik gorevi tekrari: odul yok, kayit ayni; ilk cozumde yeni rozet verilmisti', dl.isNew === '0' && JSON.stringify(await store(page)) === sAfter && (await tasksOf(page, 'logic-science')).length === 1);
    // hepsi bitince 'hepsi tamam' yalniz ilk (son) cozumde
    check('F14 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();
    // 6. vaka ilk cozumde hepsi tamam; sonra tekrar -> yok
    const c2 = await mk(SEED('4-5', { games: { 'number-hunt': { correct: 9 }, detective: { correct: 7, done: ['d1-kayip-lamba', 'd2-kopuk-yol', 'd3-acik-anahtar', 'd4-bosluk', 'd5-tamamla', 'd13-seri-lambalar', 'd14-kumanda-parcasi'] } } }));
    await toHub(c2.page);
    await openGame(c2.page, 'detective');
    check('F15 7/8 iken siradaki vaka karti d6', (await c2.page.getAttribute('.tk-nextcard', 'data-target')) === 'd6-kendin-kur');
    await openCase(c2.page, 'd6-kendin-kur');
    await place(c2.page, 'led', 's2'); await place(c2.page, 'wire', 's1'); await place(c2.page, 'wire', 's3');
    await W(c2.page, 1000);
    await finish(c2.page);
    const dA = await doneInfo(c2.page);
    check('F16 son vaka ilk cozumde: yeni rozet + "Butun vakalari cozdun" (8 / 8)', dA.isNew === '1' && dA.alldone === 1 && dA.count === '8', JSON.stringify(dA));
    await backToList(c2.page);
    await openCase(c2.page, 'd6-kendin-kur');
    await place(c2.page, 'led', 's2'); await place(c2.page, 'wire', 's1'); await place(c2.page, 'wire', 's3');
    await W(c2.page, 1000);
    await finish(c2.page);
    const dB = await doneInfo(c2.page);
    check('F17 hepsi bitikken tekrar: "hepsi tamam" kutlamasi TEKRARLANMAZ', dB.isNew === '0' && dB.alldone === 0, JSON.stringify(dB));
    await c2.ctx.close();
  }

  // ======================= G) Ses kapali =======================
  if (on('G')) {
    const { ctx, page, errs } = await mk(SEED('4-5', { sound: false }));
    await toHub(page);
    const o0 = await osc(page);
    await openGame(page, 'detective');
    await openCase(page, 'd1-kayip-lamba');
    await page.click('[data-opt="wire"]');
    await W(page, 300);
    const hintTxt = await cap(page);
    await page.click('[data-opt="led"]');
    await W(page, 1200);
    check('G1 ses kapali: yanlis ipucu YAZI olarak gorunur, vaka yine cozulur, lamba yanar', hintTxt.includes('Kablo yolu bağlar') && (await lit(page)) === '1');
    await finish(page);
    const d = await doneInfo(page);
    await W(page, 400);
    check('G2 ses kapali: konusma YOK, ses uretilmez (dogru/yanlis/ipucu/tamamlanma/kutlama)', (await spoken(page)).length === 0 && (await osc(page)) === o0, `${o0}->${await osc(page)} ${JSON.stringify(await spoken(page))}`);
    check('G3 ses kapali: rozet/odul metni yazili gorunur', d.isNew === '1' && d.head === 'Yeni rozet kazandın!');
    await backToList(page);
    await tap(page, '[data-act="back"]');
    await page.waitForSelector('.tk-hub');
    await openGame(page, 'logic-science');
    await openCase(page, 'l13-miknatis');
    const ix = (t) => page.evaluate((x) => [...document.querySelectorAll('[data-opt]')].find((b) => b.getAttribute('aria-label') === x).dataset.opt, t);
    await page.click(`[data-opt="${await ix('Elma')}"]`);
    await page.click(`[data-opt="${await ix('Çivi')}"]`);
    await W(page, 900);
    check('G4 ses kapali Mantik-Bilim: gozlem yazisi gorunur, ses/konusma yok', (await page.textContent('.ls-observe')).includes('Gözlem:') && (await spoken(page)).length === 0 && (await osc(page)) === o0);
    check('G5 ses kapali: sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();
    // ses ACIK: konusma ve ses vardir (kontrol testi: yukaridaki sessizlik gercekten ayardan geliyor)
    const on_ = await mk(SEED('4-5'));
    await toHub(on_.page);
    await openGame(on_.page, 'detective');
    await openCase(on_.page, 'd1-kayip-lamba');
    await on_.page.click('[data-opt="wire"]');
    await W(on_.page, 400);
    check('G6 ses ACIK iken ipucu okunur ve ses calar (sessizlik testinin kontrolu)', (await spoken(on_.page)).some((t) => t.includes('Kablo yolu bağlar')) && (await osc(on_.page)) > 0);
    await on_.ctx.close();
  }

  // ======================= H) Geri tusu zinciri =======================
  if (on('H')) {
    const { ctx, page, errs } = await mk(SEED('4-5'));
    await toHub(page);
    await openGame(page, 'detective');
    await openCase(page, 'd1-kayip-lamba');
    const back = async () => { const r = await page.evaluate(() => window.__altezBack.handle()); await W(page, 600); return r; };
    let r = await back();
    check('H1 gorevde fiziksel Geri: gorev kapanir, liste acilir (ilerleme yazilmaz)', r === 'screen' && (await page.locator('.tk-list').count()) === 1 && !(await store(page)).games?.detective?.done);
    r = await back();
    check('H2 listede Geri: hub', (await page.locator('.tk-hub').count()) === 1 && (await page.locator('.tk-card').count()) === 2, r);
    r = await back();
    check('H3 hub\'da Geri: ana menu', (await page.locator('.menu .menu-card').count()) === 4, r);
    // Mantik gorevi + cozulmus ekran
    await toHub(page);
    await openGame(page, 'logic-science');
    await openCase(page, 'l1-tohum');
    for (const i of [0, 1, 2]) { await page.click(`[data-item="${i}"]`); await W(page, 200); }
    await W(page, 700);
    await finish(page);
    r = await back();
    check('H4 bitis ekraninda Geri: liste (ilerleme korunur)', (await page.locator('.tk-list').count()) === 1 && (await tasksOf(page, 'logic-science')).length === 1);
    // X dugmesi
    await openCase(page, 'l2-kucukten');
    await tap(page, '.bar .btn.icon');
    await page.waitForSelector('.tk-list');
    check('H5 X dugmesi gorevi kapatir', (await page.locator('.tk-prompt').count()) === 0);
    // oyun icinde geri-ok dugmesi hub'a
    await tap(page, '[data-act="back"]');
    await page.waitForSelector('.tk-hub');
    await tap(page, '[data-act="home"]');
    await page.waitForSelector('.home');
    check('H6 hub 🏠 -> ana menu; tarayici gecmisi bozulmadi (Egitim hala acilir)', (await page.locator('.menu .menu-card').count()) === 4);
    await tap(page, '.edu-entry');
    await page.waitForSelector('.learn-map');
    check('H7 Egitim girisi hala calisir: 8 ders, ders listesi', (await page.locator('.learn-lesson').count()) === 8 && (await page.locator('.learn-path .lp').count()) === 6);
    r = await back();
    check('H8 Egitimde Geri: ana menu', (await page.locator('.menu .menu-card').count()) === 4, r);
    check('H9 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();
  }

  // ======================= I) Kisa regresyon: mevcut oyunlar =======================
  if (on('I')) {
    const { ctx, page, errs } = await mk(SEED('4-5', { correct: 4, games: { 'number-hunt': { correct: 3 } } }));
    await page.goto(BASE + '#/games'); // V7.8: oyun kartlari Oyunlar ekraninda
    await page.waitForSelector('.home.games');
    for (const g of ['shape-complete', 'number-hunt', 'invent']) {
      await tap(page, `.game-card[data-game="${g}"]`);
      await page.waitForSelector('.play', { timeout: 5000 }).catch(() => {});
      check(`I1 oyun acilir: ${g}`, (await page.locator('.play').count()) === 1);
      await page.evaluate(() => window.__altezBack.handle());
      await W(page, 600);
      check(`I2 ${g}: Geri Oyunlar ekranina doner (6 oyun karti, V7.9)`, (await page.locator('.home.games .game-card').count()) === 6);
    }
    const st = await store(page);
    check('I3 mevcut kayitlar bozulmadi (correct, number-hunt, edu.done)', st.correct === 4 && st.games['number-hunt'].correct === 3 && JSON.stringify(st.edu.done) === '["circuit-1","switch-1"]');
    check('I4 gorev girisi acmak kayit YAZMAZ (games.detective yok)', !st.games.detective && !st.games['logic-science']);
    check('I5 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join('|'));
    await ctx.close();
  }

  // ======================= J) Yerlesim: 320 / 360 / yatay =======================
  if (on('J')) {
    for (const [nm, vp] of [['360x640', VP.phone], ['320x568', VP.small], ['640x360 yatay', VP.land]]) {
      const { ctx, page } = await mk(SEED('6-8'), vp);
      await toHub(page);
      check(`J1 ${nm}: hub kartlari ekranda, tasma yok`, (await inViewX(page, '.tk-card')) && (await noHOverflow(page)));
      await openGame(page, 'detective');
      check(`J2 ${nm}: vaka listesi ve siradaki vaka karti ekranda, tasma yok`, (await inViewX(page, '.tk-nextcard, .tk-task')) && (await noHOverflow(page)));
      await openCase(page, 'd7-direnc');
      const g = await page.evaluate(() => { const r = (s) => document.querySelector(s)?.getBoundingClientRect(); const b = r('.tk-prompt svg'); const c = r('.tk-ctl .inv-tray'); const cap = r('.tk-cap'); return { board: b && [Math.round(b.width), Math.round(b.height)], tray: !!c && c.left >= -1 && c.right <= innerWidth + 1, capVisible: !!cap && cap.width > 0 }; });
      check(`J3 ${nm}: gorevde devre tahtasi (>=100px), parca tepsisi ve yazili ipucu gorunur`, g.board && g.board[0] >= 100 && g.board[1] >= 60 && g.tray && g.capVisible, JSON.stringify(g));
      await shot(page, `j-${nm.split(' ')[0]}-task`);
      await place(page, 'resistor', 's3');
      await W(page, 1000);
      await finish(page);
      check(`J4 ${nm}: bitis ekrani dugmeleri ekranda, tasma yok`, (await inViewX(page, '.tk-ctl .btn')) && (await noHOverflow(page)));
      await shot(page, `j-${nm.split(' ')[0]}-done`);
      await backToList(page);
      await tap(page, '[data-act="back"]');
      await page.waitForSelector('.tk-hub');
      await openGame(page, 'logic-science');
      await openCase(page, 'l3-gun');
      check(`J5 ${nm}: siralama gorevi: ogeler ve kutular ekranda, tasma yok`, (await inViewX(page, '.ls-item, .ls-slot')) && (await noHOverflow(page)));
      await shot(page, `j-${nm.split(' ')[0]}-order`);
      await ctx.close();
    }
  }

  // ======================= K) Acilis ekrani, merkezi surum, gelecek ozellik kartlari =======================
  if (on('K')) {
    const env = Object.fromEntries(readFileSync(new URL('./version.env', import.meta.url), 'utf8').split('\n').map((l) => l.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim()]));
    const expectVer = 'V' + env.VERSION_NAME_DEFAULT;
    for (const [nm, vp] of [['360x640', VP.phone], ['320x568', VP.small], ['640x360 yatay', VP.land], ['800x1280 tablet', { width: 800, height: 1280 }]]) {
      const { ctx, page, errs } = await mk(SEED('4-5', { seen: false }), vp);
      const t0 = Date.now();
      await page.goto(BASE + '?home=1');
      await page.waitForSelector('.splash');
      await W(page, 2300);
      const sp = await page.evaluate(() => {
        const e = document.querySelector('.splash');
        const r = (x) => x.getBoundingClientRect();
        const items = [...e.querySelectorAll('.sp-plate,.sp-tag,.sp-foot span')];
        return { tag: e.querySelector('.sp-tag').textContent, ver: e.querySelector('.sp-ver')?.textContent, dev: e.querySelector('.sp-dev')?.textContent, inside: items.every((x) => r(x).left >= -1 && r(x).right <= innerWidth + 1 && r(x).top >= -1 && r(x).bottom <= innerHeight + 1), noOverlap: r(e.querySelector('.sp-tag')).bottom <= r(e.querySelector('.sp-foot')).top + 1, imgs: [...e.querySelectorAll('img')].every((i) => i.naturalWidth > 0), noH: document.documentElement.scrollWidth <= innerWidth + 1, bg: getComputedStyle(e).backgroundImage.includes('gradient') };
      });
      check(`K1 ${nm}: acilis ekrani: slogan "Keşfet · Öğren · Üret", altta "Uygulama sürümü ${expectVer}" ve "ALTEZ Enerji"`, sp.tag === 'Keşfet · Öğren · Üret' && sp.ver === `Uygulama sürümü ${expectVer}` && sp.dev === 'ALTEZ Enerji', JSON.stringify(sp));
      check(`K2 ${nm}: acilis ekraninda yazilar/gorsel ekran icinde, slogan alt satirla cakismaz, gorseller yuklendi, yatay tasma yok`, sp.inside && sp.noOverlap && sp.imgs && sp.noH && sp.bg, JSON.stringify(sp));
      await shot(page, `k-splash-${nm.split(' ')[0]}`);
      await page.waitForSelector('.home', { timeout: 6000 });
      check(`K3 ${nm}: ilk acilis ana ekrana <= 3.6 sn'de gecer (uzun bekleme yok)`, Date.now() - t0 <= 3600, String(Date.now() - t0));
      check(`K4 ${nm}: sayfa/konsol hatasi yok`, errs.length === 0, errs.slice(0, 2).join('|'));
      await ctx.close();
    }
    // dokunarak atlama + surum merkezi kaynakla ayni
    {
      const { ctx, page } = await mk(SEED('4-5', { seen: false }));
      await page.goto(BASE + '?home=1');
      await page.waitForSelector('.splash');
      await W(page, 200);
      await page.click('.splash');
      await page.waitForSelector('.home', { timeout: 2000 });
      check('K5 splash dokununca atlanir (ana menu < 2 sn)', (await page.locator('.menu .menu-card').count()) === 4);
      const av = await page.evaluate(async () => (await fetch('assets/data/app-version.json')).json());
      check('K6 ekran surumu = scripts/version.env = app-version.json (tek kaynak)', 'V' + av.versionName === expectVer && String(av.versionCode) === env.VERSION_CODE_DEFAULT && av.tag === env.RELEASE_TAG, JSON.stringify(av));
      await ctx.close();
    }
    // K7-K17 (Cok yakinda seridi: 3 kart) V7.8'de Ana Menu / Oyunlar ekranina tasindi; yeni kontroller scripts/ui-v78-home.mjs icindedir.
  }
} catch (e) {
  check('beklenmeyen hata', false, e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol basarili (V7.7 hedefli UI testi)`);
process.exit(failed.length ? 1 : 0);
