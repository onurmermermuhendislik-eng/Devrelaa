// V7.6 HEDEFLI tarayici testi (Chromium): yalniz V7.6 Egitim degisiklikleri (siradaki ders karti, genel ilerleme, "Tekrar oyna", tekrarda odul yok) + kisa regresyon.
//   node scripts/ui-v76.mjs                      -> calistirir (cikis kodu 0 = hepsi basarili)
//   SHOTS=/yol/klasor node scripts/ui-v76.mjs    -> ekran goruntuleri de kaydeder
// Tam arayuz duman testi (scripts/ui-smoke.mjs) bu dosyadan AYRIDIR ve burada calistirilmaz.
// Playwright PROJE BAGIMLILIGI DEGILDIR (makinede kurulu olmali; PLAYWRIGHT_PATH ile yol verilebilir).
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

const SEED = (done, extra = {}) => ({ band: '4-5', sound: true, seen: true, correct: 5, games: { 'number-hunt': { correct: 9 } }, ...(done ? { edu: { done } } : {}), ...extra });
const ORDER = ['circuit-1', 'switch-1', 'resistor-1', 'series-1', 'parallel-1', 'usta-1', 'kasif-1', 'mucit-1'];
const mapInfo = (page) => page.evaluate(() => {
  const c = document.querySelector('.learn-nextcard');
  const o = document.querySelector('.learn-overall');
  return {
    kind: c?.dataset.kind || '', lesson: c?.dataset.target || '', head: c?.querySelector('.nc-text i')?.textContent || '', title: c?.querySelector('.nc-text b')?.textContent || '', btn: c?.querySelector('.nc-go')?.textContent.replace(/\s+/g, ' ').trim() || '',
    count: o?.dataset.count, total: o?.dataset.total, ovText: o?.textContent.replace(/\s+/g, ' ').trim() || '', cards: document.querySelectorAll('.learn-nextcard').length,
    replays: [...document.querySelectorAll('.learn-lesson .ll-replay')].length, doneCards: document.querySelectorAll('.learn-lesson.st-done').length, path: document.querySelectorAll('.learn-path .lp').length, lessons: document.querySelectorAll('.learn-lesson').length
  };
});
// circuit-1'i bitirir (7 adim: 5 anlatim, 1 gorev, 1 soru)
const playCircuit1 = async (page) => {
  await toTask(page);
  await place(page, 'led', 's1'); await place(page, 'led', 's2'); await place(page, 'led', 's3'); await place(page, 'wire', 's1');
  await page.waitForTimeout(900);
  await page.click('[data-act="next"]');
  await page.waitForSelector('.learn-opt');
  await page.click('.learn-opt:nth-child(1)');
  await page.waitForTimeout(300);
  await page.click('[data-act="next"]');
  await page.waitForSelector('.learn-done');
  await page.waitForTimeout(500);
};
const doneInfo = (page) => page.evaluate(() => {
  const q = (s) => document.querySelector(s)?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const r = document.querySelector('.learn-reward');
  return { isNew: r?.dataset.new, badge: r?.dataset.badge, head: q('.lr-text b'), note: q('.learn-replaynote'), noteCount: document.querySelectorAll('.learn-replaynote').length, levelup: document.querySelectorAll('.learn-levelup').length, allDone: document.querySelectorAll('.learn-alldone').length, count: document.querySelector('.learn-meter')?.dataset.count, trophy: q('.learn-trophy') };
});

try {
  // ======================= A) Bos kayit: ilk ders onerilir =======================
  if (on('A')) {
    const { ctx, page, errs, external } = await mk(SEED(null));
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    const m = await mapInfo(page);
    check('A1 bos kayit: tek "Siradaki ders" karti, ilk ders (Elektrik devresi nedir?)', m.cards === 1 && m.kind === 'next' && m.lesson === 'circuit-1' && m.head === 'Sıradaki ders' && m.title === 'Elektrik devresi nedir?', JSON.stringify(m));
    check('A2 buton "Basla"', m.btn.includes('Başla'), m.btn);
    check('A3 genel ilerleme 0 / 8 ders', m.count === '0' && m.total === '8' && m.ovText === '0 / 8 ders', m.ovText);
    check('A4 bos kayitta "Tekrar oyna" etiketi yok; 8 ders + 6 asama yolu aynen', m.replays === 0 && m.lessons === 8 && m.path === 6, JSON.stringify(m));
    check('A5 mevcut yapi: rozet seridi ve asama yolu duruyor, ana yonerge yazisi ayni', (await page.locator('.learn-badges .lb').count()) === 8 && (await cap(page)) === 'Bir ders seç ve öğrenmeye başla!');
    check('A6 kart + ilerleme 360x640 ekranda, yatay tasma yok', (await inView(page, '.learn-nextcard, .learn-overall')) && (await noHOverflow(page)));
    await shot(page, 'a-map-empty');
    // hizli cift dokunus: tek ders acilir, tek calisma
    await page.dblclick('.nc-go', { noWaitAfter: true }).catch(() => {});
    await page.waitForSelector('.learn-dots .learn-dot');
    check('A7 karttan ders acilir (7 nokta); cift dokunus tek ders acar', (await page.locator('.learn-dot').count()) === 7 && (await page.locator('.learn-dots').count()) === 1);
    check('A8 acilis kaydi degistirmez (edu yazilmadi)', !(await store(page)).edu);
    check('A9 sayfa/konsol hatasi yok, harici adres yok', errs.length === 0 && external.length === 0, errs.slice(0, 2).join('|') + external.join(','));
    await ctx.close();
  }

  // ======================= B) Kismi ilerleme: siradaki ders + tekrar etiketleri =======================
  if (on('B')) {
    const { ctx, page } = await mk(SEED(['circuit-1', 'switch-1', 'resistor-1']));
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    const m = await mapInfo(page);
    check('B1 3 ders bitti: kart 4. dersi (series-1) onerir', m.kind === 'next' && m.lesson === 'series-1' && m.cards === 1, JSON.stringify(m));
    check('B2 genel ilerleme 3 / 8 ders', m.ovText === '3 / 8 ders' && m.count === '3' && m.total === '8', m.ovText);
    check('B3 tamamlanan 3 derste "Tekrar oyna" etiketi; acik/kilitli derslerde yok', m.doneCards === 3 && m.replays === 3);
    check('B4 etiket metni ve erisilebilir ad', await page.evaluate(() => { const b = document.querySelector('.learn-lesson.st-done'); return b.querySelector('.ll-replay').textContent.includes('Tekrar oyna') && b.getAttribute('aria-label').includes('Tekrar oyna'); }));
    check('B5 kilitli ders hala kilitli (aria-disabled), kilit kurali bozulmadi', (await page.locator('.learn-lesson.st-locked[aria-disabled="true"]').count()) === 4);
    check('B6 asama yolunda "Simdi buradasin" asamasi bozulmadi', (await page.locator('.learn-path .lp-now').count()) === 1);
    await page.click('.nc-go');
    await page.waitForSelector('.learn-dots .learn-dot');
    check('B7 karttaki buton series-1 dersini acar (5 nokta)', (await page.locator('.learn-dot').count()) === 5);
    await ctx.close();
    // tamamlanan derse listeden dokunmak calisir
    const c2 = await mk(SEED(['circuit-1', 'switch-1']));
    await c2.page.goto(BASE + '#/play/learn');
    await c2.page.waitForSelector('.learn-map');
    await c2.page.click('.learn-lesson[data-lesson="circuit-1"]');
    await c2.page.waitForSelector('.learn-dots .learn-dot');
    check('B8 tamamlanan ders listeden acilir (tekrar)', (await c2.page.locator('.learn-dot').count()) === 7);
    await c2.ctx.close();
  }

  // ======================= C) Hepsi bitti: tekrar onerisi =======================
  if (on('C')) {
    const { ctx, page } = await mk(SEED(ORDER));
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    const m = await mapInfo(page);
    check('C1 8/8: kart "tekrar" kipinde (ilk ders), metin "Hepsini bitirdin"', m.kind === 'replay' && m.lesson === 'circuit-1' && m.head.startsWith('Hepsini bitirdin'), JSON.stringify(m));
    check('C2 buton "Tekrar oyna"; ilerleme 8 / 8 ders; 8 ders etiketli', m.btn.includes('Tekrar oyna') && m.ovText === '8 / 8 ders' && m.replays === 8, JSON.stringify(m));
    await shot(page, 'c-map-all');
    await page.click('.nc-go');
    await page.waitForSelector('.learn-dots .learn-dot');
    check('C3 tekrar karti dersi acar', (await page.locator('.learn-dot').count()) === 7);
    await ctx.close();
  }

  // ======================= D) Tekrar oynama: yeni rozet / odul / kutlama YOK =======================
  if (on('D')) {
    // D1: 2 ders bitik (Baslangic asamasi tamam); circuit-1 tekrar
    const { ctx, page, errs } = await mk(SEED(['circuit-1', 'switch-1']));
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    const before = await store(page);
    await openLesson(page, 'circuit-1');
    await playCircuit1(page);
    const d = await doneInfo(page);
    check('D1 tekrar bitis: rozet YENI degil (data-new=0), "tekrar" notu tek kez gorunur', d.isNew === '0' && d.noteCount === 1 && d.note.includes('tekrar oynadın') && d.note.includes('yeni rozet yok'), JSON.stringify(d));
    check('D2 tekrar bitis: "Yeni rozet kazandin" yok, asama/hepsi tamam kutlamasi yok', d.head === 'Bu rozet zaten sende.' && d.levelup === 0 && d.allDone === 0, JSON.stringify(d));
    check('D3 tekrar bitis: sayac degismedi (2 / 8), kupa yerine onay isareti', d.count === '2' && d.trophy === '✅', JSON.stringify(d));
    const after = await store(page);
    check('D4 kayit AYNI: edu.done degismedi, edu yalniz {done}, diger alanlar ayni', JSON.stringify(after.edu.done) === '["circuit-1","switch-1"]' && Object.keys(after.edu).join() === 'done' && after.correct === before.correct && JSON.stringify(after.games) === JSON.stringify(before.games), JSON.stringify(after));
    const sp = await spoken(page);
    check('D5 tekrar bitis: konusma tek ve "yeni rozet" demez', sp.filter((t) => t.startsWith('Harika! Ders tamamlandı.')).length === 1 && !sp.some((t) => t.includes('Yeni rozet kazandın')) && sp.some((t) => t.includes('tekrar oynadın')), JSON.stringify(sp.slice(-2)));
    const o = await osc(page);
    await page.click('[data-act="map"]');
    await page.waitForSelector('.learn-map');
    const m = await mapInfo(page);
    check('D6 haritaya donunce ilerleme hala 2 / 8, siradaki ders resistor-1', m.ovText === '2 / 8 ders' && m.lesson === 'resistor-1', JSON.stringify(m));
    await shot(page, 'd-replay-map');
    check('D7 tekrar sirasinda sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 2).join('|'));
    void o;
    await ctx.close();

    // D8: hepsi bitik, bir ders tekrar -> "tum dersler tamam" kutlamasi tekrarlanmaz
    const c2 = await mk(SEED(ORDER));
    await c2.page.goto(BASE + '#/play/learn');
    await c2.page.waitForSelector('.learn-map');
    await openLesson(c2.page, 'circuit-1');
    await playCircuit1(c2.page);
    const d2 = await doneInfo(c2.page);
    const st2 = await store(c2.page);
    check('D8 8/8 iken tekrar: hepsi-tamam / asama kutlamasi yok, rozet yeni degil, kayit 8 ders aynen', d2.isNew === '0' && d2.allDone === 0 && d2.levelup === 0 && d2.count === '8' && JSON.stringify(st2.edu.done) === JSON.stringify(ORDER), JSON.stringify(d2));
    await c2.ctx.close();
  }

  // ======================= E) Ilk kez tamamlama hala odul verir (regresyon) =======================
  if (on('E')) {
    const { ctx, page } = await mk(SEED(null));
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    await page.click('.nc-go');
    await page.waitForSelector('.learn-dots .learn-dot');
    await playCircuit1(page);
    const d = await doneInfo(page);
    check('E1 ilk kez: YENI rozet, tekrar notu YOK, kupa', d.isNew === '1' && d.head === 'Yeni rozet kazandın!' && d.noteCount === 0 && d.trophy === '⭐' && d.count === '1', JSON.stringify(d));
    check('E2 kayit: edu.done = [circuit-1]', JSON.stringify((await store(page)).edu.done) === '["circuit-1"]');
    await page.click('[data-act="map"]');
    await page.waitForSelector('.learn-map');
    const m = await mapInfo(page);
    check('E3 haritada: 1 / 8, siradaki ders switch-1, circuit-1 "Tekrar oyna" etiketli', m.ovText === '1 / 8 ders' && m.lesson === 'switch-1' && m.replays === 1, JSON.stringify(m));
    await ctx.close();
  }

  // ======================= F) Ses kapali =======================
  if (on('F')) {
    const { ctx, page } = await mk(SEED(['circuit-1'], { sound: false }));
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    const o0 = await osc(page);
    await openLesson(page, 'circuit-1');
    await playCircuit1(page);
    await page.waitForTimeout(500);
    const d = await doneInfo(page);
    check('F1 ses kapali tekrar: konusma yok, ses uretilmez', (await spoken(page)).length === 0 && (await osc(page)) === o0, `${o0}->${await osc(page)} ${JSON.stringify(await spoken(page))}`);
    check('F2 ses kapali: tekrar notu ve rozet metni yazili olarak gorunur', d.noteCount === 1 && d.head === 'Bu rozet zaten sende.', JSON.stringify(d));
    await page.click('[data-act="map"]');
    await page.waitForSelector('.learn-map');
    await page.click('.nc-go');
    await page.waitForSelector('.learn-dots .learn-dot');
    check('F3 ses kapali: karttan ders acilir, konusma yok', (await spoken(page)).length === 0);
    await ctx.close();
  }

  // ======================= G) Ekran boyutlari ve geri tusu =======================
  if (on('G')) {
    for (const [nm, vp] of [['phone', VP.phone], ['small', VP.small], ['land', VP.land]]) {
      const { ctx, page } = await mk(SEED(['circuit-1', 'switch-1', 'resistor-1']), vp);
      await page.goto(BASE + '#/play/learn');
      await page.waitForSelector('.learn-map');
      check(`G1 ${nm}: kart ve buton ekranda, yatay tasma yok`, (await inView(page, '.learn-nextcard, .nc-go')) && (await noHOverflow(page)));
      check(`G2 ${nm}: buton dokunma hedefi >= 44px`, await page.evaluate(() => { const r = document.querySelector('.nc-go').getBoundingClientRect(); return r.height >= 44 && r.width >= 44; }));
      if (nm === 'land') {
        const sc = await page.evaluate(() => { const m = document.querySelector('.learn-map'); const before = m.scrollTop; m.scrollTop = 9999; const after = m.scrollTop; return { can: m.scrollHeight > m.clientHeight, moved: after > before || m.scrollHeight <= m.clientHeight }; });
        check('G3 yatay: liste hala kaydirilabilir (V7.5 duzeltmesi korundu)', sc.moved);
        await page.evaluate(() => { document.querySelector('.learn-map').scrollTop = 0; });
        await shot(page, 'g-land-map');
      }
      await shot(page, `g-${nm}`);
      await ctx.close();
    }
    const { ctx, page, errs } = await mk(SEED(['circuit-1']));
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    await openLesson(page, 'switch-1');
    const handled = await page.evaluate(() => window.__altezBack.handle());
    await page.waitForTimeout(200);
    check('G4 fiziksel Geri dersi kapatir, listeye doner; kart yeniden cizilir', handled !== false && (await page.locator('.learn-map').count()) === 1 && (await page.locator('.learn-nextcard').count()) === 1);
    await page.evaluate(() => window.__altezBack.handle());
    await page.waitForTimeout(500);
    check('G5 listede Geri ana menuye doner; 4 bolum karti, Egitim yazisi ve sayac (V7.8; V8.1: yeni ana menu Egitim karti)', ((await page.locator('.menu .menu-card').count()) === 4 && (await page.textContent('.edu-entry')).includes('Eğitim') && (await page.textContent('.edu-entry')).includes('1/8')) || ((await page.locator('.mm-card').count()) === 5 && (await page.textContent('.mm-card[data-act="edu"]')).includes('Eğitim')));
    for (const g of ['shape-complete', 'number-hunt', 'invent']) {
      await page.goto(BASE + '#/play/' + g);
      await page.waitForSelector('.play', { timeout: 5000 }).catch(() => {});
      check(`G6 oyun acilir: ${g}`, (await page.locator('.play').count()) === 1);
    }
    const st = await store(page);
    check('G7 mevcut oyun kayitlari ve Egitim kaydi bozulmadi', st.correct === 5 && st.games['number-hunt'].correct === 9 && JSON.stringify(st.edu.done) === '["circuit-1"]');
    check('G8 sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ======================= H) Eski kayit uyumu =======================
  if (on('H')) {
    // V7.4/V7.5 bicimli kayit (yeni alan yok) + bozuk/bilinmeyen kimlikler
    const { ctx, page } = await mk(SEED(['circuit-1', 'olmayan-ders', 'switch-1', 'circuit-1']));
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    const m = await mapInfo(page);
    check('H1 bilinmeyen/tekrarli kimlikler ilerlemeyi sisirmez: 2 / 8', m.ovText === '2 / 8 ders' && m.lesson === 'resistor-1', JSON.stringify(m));
    await ctx.close();
  }
} catch (e) {
  check('beklenmeyen hata', false, e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol basarili (V7.6 hedefli UI testi)`);
process.exit(failed.length ? 1 : 0);
