// V7.5 HEDEFLI tarayici testi (Chromium): yalniz V7.5'te degisen davranislar + kisa regresyon.
//   node scripts/ui-v75.mjs                      -> calistirir (cikis kodu 0 = hepsi basarili)
//   SHOTS=/yol/klasor node scripts/ui-v75.mjs    -> ekran goruntuleri de kaydeder
// Tam arayuz duman testi (scripts/ui-smoke.mjs, V7.4'te 545 kontrol) bu dosyadan AYRIDIR ve burada tekrar calistirilmaz.
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

try {
  // ======================= A) Ses ACIK, ilk kez: parca karti, yanlis baglanti ipuclari, basari sesi tek, odul =======================
  if (on('A')) {
    const { ctx, page, errs, external } = await mk({ band: '4-5', sound: true, seen: true, correct: 5, games: { 'number-hunt': { correct: 9 } } });
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    await openLesson(page, 'circuit-1');
    check('A1 adim noktalari degismedi (7)', (await page.locator('.learn-dot').count()) === 7);
    check('A2 anlatim adimi: Pil karti (ad + ne yapar + benzetme) gorunur', await page.evaluate(() => { const c = document.querySelector('.learn-meet'); return !!c && c.textContent.includes('Pil') && c.textContent.includes('Pil enerji verir.') && c.textContent.includes('devrenin kalbi'); }));
    check('A3 ana yonerge yazisi (.cap) degismedi, kart ayri ogedir', (await cap(page)) === 'Bu bir elektrik devresi! Pil enerji verir.');
    const s0 = (await spoken(page)).length;
    await page.click('.learn-meet');
    await page.waitForTimeout(500);
    const sp = await spoken(page);
    check('A4 karta dokununca parca adi + anlatim okunur (otomatik uzun konusma yok)', sp.length > s0 && sp.some((t) => t.startsWith('Pil. Pil enerji verir. Pil, devrenin kalbi gibidir.')), JSON.stringify(sp.slice(-2)));
    await page.click('[data-act="next"]'); await page.waitForTimeout(90);
    check('A5 Kablo karti', (await page.textContent('.learn-meet')).includes('Kablo yolu bağlar.'));
    await page.click('[data-act="next"]'); await page.waitForTimeout(90);
    check('A6 LED karti', (await page.textContent('.learn-meet')).includes('LED ışık verir.'));
    await page.click('[data-act="next"]'); await page.waitForTimeout(90);
    check('A7 karti olmayan adimda kart cizilmez', (await page.locator('.learn-meet').count()) === 0);
    await toTask(page);
    check('A8 gorev adiminda kartta "Dene:" yonergesi var', await page.evaluate(() => { const c = document.querySelector('.learn-meet'); return !!c && c.textContent.includes('Dene:') && c.textContent.includes('Kablo'); }));
    check('A9 gorevde parcalar ve devre ekranda, kart tepsiyi/tahtayi ezmez (360x640)', await inView(page, '.learn-meet, [data-tool], .learn-ctl') && (await page.evaluate(() => document.querySelector('.prompt svg').getBoundingClientRect().height)) > 110);
    await shot(page, 'a-task-card');
    // yanlis baglanti: LED'ler var, kablo yok
    await place(page, 'led', 's1'); await place(page, 'led', 's2'); await place(page, 'led', 's3');
    await page.waitForTimeout(500);
    const h1 = await cap(page);
    check('A10 yanlis baglanti (kablo yok): kisa ipucu "kablo" der, yazilir ve okunur, gorev tamamlanmaz', /kablo/i.test(h1) && h1.length < 80 && (await nextCount(page)) === 0 && (await spoken(page)).includes(h1), h1);
    await shot(page, 'a-wrong-hint');
    // dogru baglanti: tek kablo yeter (2 LED + kablo)
    const oBefore = await osc(page);
    await place(page, 'wire', 's1');
    await page.waitForTimeout(1500);
    const o1 = await osc(page);
    check('A11 dogru baglanti: gorev tamam (Devam), basari sesi calar', (await nextCount(page)) === 1 && o1 > oBefore && (await cap(page)) === 'Harika! Başardın.', `${oBefore}->${o1}`);
    // hizli tekrar dokunuslar: ek ses/konusma yok
    const spBefore = (await spoken(page)).length;
    for (let i = 0; i < 8; i++) await page.click(i % 2 ? '[data-slot="s3"]' : '[data-tool="led"]', { force: true, noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(1000);
    check('A12 hizli tekrar dokunuslar: ikinci basari sesi/konusma yok, gorev tamam kalir', (await osc(page)) === o1 && (await spoken(page)).length === spBefore && (await nextCount(page)) === 1, JSON.stringify([o1, await osc(page), spBefore, (await spoken(page)).length]));
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-opt');
    await page.click('.learn-opt:nth-child(2)');
    await page.waitForTimeout(600);
    const wrong = await cap(page);
    check('A13 yanlis cevap: benzetmeli ogretici ipucu, cevap verilmez, okunur', wrong === 'Kopuk köprüden geçilmez. Enerji de kopuk yoldan geçemez.' && (await spoken(page)).filter((t) => t === wrong).length === 1 && (await nextCount(page)) === 0, wrong);
    const oW = await osc(page);
    for (let i = 0; i < 6; i++) await page.click('.learn-opt:nth-child(2)', { force: true, noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(700);
    check('A14 ayni yanlis secenege tekrar dokunus: ek ses/konusma yok', (await osc(page)) === oW && (await spoken(page)).filter((t) => t === wrong).length === 1, `${oW}->${await osc(page)}`);
    await page.click('.learn-opt:nth-child(1)');
    await page.waitForTimeout(300);
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-done');
    await page.waitForTimeout(500);
    const R = await rewardInfo(page);
    check('A15 bitis: "Harika! Ders tamamlandi." + ders adi', R.q === 'Harika! Ders tamamlandı.' && R.sub === 'Elektrik devresi nedir?', JSON.stringify(R));
    check('A16 bitis: YENI rozet (ikon + ad), "Ogrendin" satiri', R.isNew === '1' && R.badge === 'circuit-1' && R.head === 'Yeni rozet kazandın!' && R.title === 'Elektrik devresi nedir?' && R.learned.startsWith('Öğrendin:'), JSON.stringify(R));
    check('A17 bitis: rozet sayaci 1 / 8, asama henuz bitmedi (Baslangic 2 dersli)', R.count === '1' && R.total === '8' && R.on === 1 && R.level === '', JSON.stringify(R));
    check('A18 bitis: tam metin (rozet dahil) tek konusma olarak okunur', (await spoken(page)).includes('Harika! Ders tamamlandı. Yeni rozet kazandın!'), JSON.stringify((await spoken(page)).slice(-3)));
    const st = await store(page);
    check('A19 kayit: edu.done = [circuit-1]; mevcut oyun kayitlari ve sayac bozulmadi', JSON.stringify(st.edu.done) === '["circuit-1"]' && st.correct === 5 && st.games['number-hunt'].correct === 9 && st.sound === true, JSON.stringify(st));
    check('A20 bitis ekrani 360x640: dugmeler ekran icinde, tasma yok', await inView(page, '.learn-ctl .btn') && (await noHOverflow(page)));
    await shot(page, 'a-reward-new');
    // ---- B) ikinci ders: Baslangic asamasi biter ----
    await page.click('[data-act="open"]');
    await page.waitForSelector('.learn-dots .learn-dot');
    check('B1 "Sonraki ders" Anahtar dersini acar (5 nokta), Anahtar karti', (await page.locator('.learn-dot').count()) === 5 && (await page.textContent('.learn-meet')).includes('Anahtar yolu açar ve kapatır.'));
    await page.click('[data-act="next"]'); await page.waitForTimeout(90);
    check('B2 Anahtara dokun gorevi: kartta "Dene:" anahtar', (await page.textContent('.learn-meet')).includes('Dene:'));
    await page.click('[data-switch="s3"]');
    await page.waitForTimeout(700);
    check('B3 anahtar kapaninca gorev tamam', (await nextCount(page)) === 1);
    await page.click('[data-act="next"]'); await page.waitForTimeout(90);
    await toTask(page);
    await place(page, 'switch', 's3');
    await page.waitForTimeout(400);
    const b4 = await cap(page);
    check('B4 yalnizca anahtar: ipucu LED ister', /LED/.test(b4) && (await nextCount(page)) === 0, b4);
    await place(page, 'led', 's2');
    await page.waitForTimeout(400);
    const b5 = await cap(page);
    check('B5 bosluk var: ipucu "bosluk" der', /boşluk/i.test(b5), b5);
    await place(page, 'wire', 's1');
    await page.waitForTimeout(400);
    const b6 = await cap(page);
    check('B6 anahtar acik: ipucu "Anahtar acik... dokun" der', /Anahtar açık/.test(b6) && (await nextCount(page)) === 0, b6);
    await page.click('[data-switch="s3"]');
    await page.waitForTimeout(700);
    check('B7 anahtar kapaninca LED yanar, gorev tamam', (await nextCount(page)) === 1);
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-opt');
    await page.click('.learn-opt:nth-child(2)');
    await page.waitForTimeout(400);
    check('B8 anahtar sorusu: yanlista benzetmeli ipucu', (await cap(page)) === 'Anahtar açıkken yol kopuktur. Enerji geçemez.', await cap(page));
    await page.click('.learn-opt:nth-child(1)');
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-done');
    await page.waitForTimeout(500);
    const R2 = await rewardInfo(page);
    check('B9 asama tamam: "Baslangic asamasini bitirdin!" + yeni rozet + 2 / 8', R2.level === '🌱 Başlangıç aşamasını bitirdin!' && R2.levelId === 'baslangic' && R2.isNew === '1' && R2.badge === 'switch-1' && R2.count === '2' && R2.on === 2, JSON.stringify(R2));
    check('B10 asama tamam metni de okunur', (await spoken(page)).includes('Harika! Ders tamamlandı. Yeni rozet kazandın! Başlangıç aşamasını bitirdin!'), JSON.stringify((await spoken(page)).slice(-2)));
    check('B11 kayit: edu.done = [circuit-1, switch-1]', JSON.stringify((await store(page)).edu.done) === '["circuit-1","switch-1"]');
    await shot(page, 'b-reward-level');
    // ---- C) liste: rozet/asama yolu tutarli; ayni dersi tekrar bitirmek ----
    await page.click('[data-act="map"]');
    await page.waitForSelector('.learn-map');
    const M = await page.evaluate(() => ({ badges: [...document.querySelectorAll('.learn-badges .lb')].map((e) => (e.classList.contains('lb-on') ? 1 : 0)).join(''), path: [...document.querySelectorAll('.learn-path .lp')].map((e) => e.dataset.level + ':' + e.className.match(/lp-(done|open|locked|soon)/)[1]).join(','), counts: [...document.querySelectorAll('.learn-level .lv-count')].map((e) => e.textContent).join(',') }));
    check('C1 Egitim Merkezi: rozetler/asama yolu/sayaclar odulle tutarli (2 rozet, Baslangic tamam, Cirak acik)', M.badges === '11000000' && M.path.startsWith('baslangic:done,cirak:open') && M.counts === '2/2,0/1,0/2,0/1,0/1,0/1', JSON.stringify(M));
    await openLesson(page, 'switch-1');
    await page.click('[data-act="next"]'); await page.waitForTimeout(90);
    await page.click('[data-switch="s3"]'); await page.waitForTimeout(600);
    await page.click('[data-act="next"]'); await page.waitForTimeout(90);
    await toTask(page);
    await place(page, 'wire', 's1'); await place(page, 'led', 's2'); await place(page, 'switch', 's3');
    await page.click('[data-switch="s3"]'); await page.waitForTimeout(700);
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-opt');
    await page.click('.learn-opt:nth-child(1)');
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-done');
    await page.waitForTimeout(400);
    const R3 = await rewardInfo(page);
    check('C2 ayni dersi tekrar bitirince: "Bu rozet zaten sende.", asama duyurusu YOK, sayac 2 / 8 (mukerrer odul yok)', R3.isNew === '0' && R3.head === 'Bu rozet zaten sende.' && R3.level === '' && R3.count === '2' && R3.on === 2, JSON.stringify(R3));
    check('C3 tekrar sonrasi kayit degismez (2 ders)', JSON.stringify((await store(page)).edu.done) === '["circuit-1","switch-1"]');
    check('C4 tekrarda "Sonraki ders" (Direnc) sunulur', (await page.locator('[data-act="open"]').count()) === 1);
    await page.reload();
    await page.waitForSelector('.learn-map');
    check('C5 uygulama yeniden acilinca rozetler korunur (2)', (await page.locator('.learn-badges .lb-on').count()) === 2);
    check('C6 Egitim akisinda sayfa/konsol hatasi yok, harici ag istegi yok', errs.length === 0 && external.length === 0, [...errs, ...external].slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ======================= D) Ses KAPALI: hicbir ses/konusma yok; gorevler ve odul yine calisir =======================
  if (on('D')) {
    const { ctx, page, errs } = await mk({ band: '4-5', sound: false, seen: true });
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    await openLesson(page, 'circuit-1');
    await page.click('.learn-meet');
    await page.waitForTimeout(300);
    await toTask(page);
    await place(page, 'led', 's1');
    await page.waitForTimeout(300);
    check('D1 ses kapali: yanlis baglanti ipucu yine YAZIYLA gorunur', (await cap(page)).length > 10);
    await place(page, 'wire', 's2'); await place(page, 'wire', 's3');
    await page.waitForTimeout(800);
    check('D2 ses kapali: gorev yine tamamlanir', (await nextCount(page)) === 1);
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-opt');
    await page.click('.learn-opt:nth-child(2)');
    await page.waitForTimeout(300);
    check('D3 ses kapali: soru ipucu yazili', (await cap(page)).length > 10);
    await page.click('.learn-opt:nth-child(1)');
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-done');
    await page.waitForTimeout(600);
    const R = await rewardInfo(page);
    check('D4 ses kapali: rozet/ogrendin yazili gorunur ve kaydedilir', R.isNew === '1' && R.head === 'Yeni rozet kazandın!' && R.learned.startsWith('Öğrendin:') && JSON.stringify((await store(page)).edu.done) === '["circuit-1"]', JSON.stringify(R));
    check('D5 ses kapali: HICBIR konusma ve HICBIR ses (osilator) uretilmedi', (await spoken(page)).length === 0 && (await osc(page)) === 0, JSON.stringify([(await spoken(page)).length, await osc(page)]));
    check('D6 ses kapali: sayfa hatasi yok', errs.length === 0, errs[0] || '');
    await ctx.close();
  }

  // ======================= E) Dar/yatay ekranlar: kart + tepsi + tahta + odul ekrani sigar =======================
  for (const [name, vp] of on('E') ? [['320x568', VP.small], ['640x360-yatay', VP.land]] : []) {
    const { ctx, page, errs } = await mk({ band: '4-5', sound: false, seen: true }, vp);
    await page.goto(BASE + '#/play/learn');
    await page.waitForSelector('.learn-map');
    await openLesson(page, 'circuit-1');
    check(`E ${name}: anlatim adimi - kart ekran icinde, tasma yok`, (await inView(page, '.learn-meet')) && (await noHOverflow(page)));
    await toTask(page);
    const lay = await page.evaluate(() => { const t = [...document.querySelectorAll('[data-tool]')].map((e) => e.getBoundingClientRect()); const b = document.querySelector('.prompt svg').getBoundingClientRect(); const c = document.querySelector('.learn-meet').getBoundingClientRect(); return { toolsIn: t.every((r) => r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth), boardH: Math.round(b.height), cardH: Math.round(c.height), cardIn: c.top >= 0 && c.bottom <= innerHeight, vh: innerHeight, minTool: Math.min(...t.map((r) => Math.min(r.width, r.height))) }; });
    check(`E ${name}: gorev - parca tepsisi tamamen gorunur ve >= 44px, kart ekran icinde, devre okunur boyutta`, lay.toolsIn && lay.cardIn && lay.minTool >= 44 && lay.boardH >= (vp.height < 400 ? 90 : 110), JSON.stringify(lay));
    await shot(page, `e-${name}-task`);
    await place(page, 'wire', 's1'); await place(page, 'led', 's2'); await place(page, 'wire', 's3');
    await page.waitForTimeout(500);
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-opt');
    await page.click('.learn-opt:nth-child(1)');
    await page.click('[data-act="next"]');
    await page.waitForSelector('.learn-done');
    await page.waitForTimeout(300);
    const fin = await page.evaluate(() => { const d = document.querySelector('.learn-done'); const btn = [...document.querySelectorAll('.learn-ctl .btn')].map((e) => e.getBoundingClientRect()); const ld = document.querySelector('.ld-in').getBoundingClientRect(); return { btnIn: btn.every((r) => r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth), scrollable: d.scrollHeight > d.clientHeight + 1, fits: ld.height <= d.clientHeight + 1, hasReward: !!document.querySelector('.learn-reward'), ovf: document.documentElement.scrollWidth > innerWidth + 1 }; });
    check(`E ${name}: odul ekrani - dugmeler gorunur, yatay tasma yok, icerik sigar ya da kaydirilabilir`, fin.btnIn && !fin.ovf && fin.hasReward && (fin.fits || fin.scrollable), JSON.stringify(fin));
    await shot(page, `e-${name}-reward`);
    check(`E ${name}: sayfa hatasi yok`, errs.length === 0, errs[0] || '');
    await ctx.close();
  }

  // ======================= F) Kisa regresyon: ana ekran, Egitim yazisi, geri tusu, V7.4 ders listesi, diger oyunlar =======================
  if (on('F')) {
    const { ctx, page, errs } = await mk({ band: '4-5', sound: false, seen: true, correct: 4, games: { 'number-hunt': { correct: 3 } }, edu: { done: ['circuit-1', 'switch-1', 'resistor-1'] } });
    await page.goto(BASE + '?home=1');
    await page.waitForSelector('.menu .menu-card');
    // V7.8: Ana Menu 4 buyuk bolum karti (Oyunlar, Egitim, Profil, Ebeveyn); Egitim girisi `.edu-entry` karti
    check('F1 ana menu: 4 bolum karti + Egitim karti ("Egitim" yazisi gorunur)', (await page.locator('.menu-card').count()) === 4 && (await page.locator('.edu-entry').count()) === 1 && (await page.textContent('.edu-entry .mc-t')).trim() === 'Eğitim');
    check('F2 ana ekran: tasma yok, Egitim dugmesi ekran icinde', (await noHOverflow(page)) && (await inView(page, '.edu-entry')));
    await page.click('.edu-entry');
    await page.waitForSelector('.learn-map');
    const m = await page.evaluate(() => ({ names: [...document.querySelectorAll('.learn-path .lp-name')].map((e) => e.textContent).join(','), path: [...document.querySelectorAll('.learn-path .lp')].map((e) => e.dataset.level + ':' + e.className.match(/lp-(done|open|locked|soon)/)[1] + (e.classList.contains('lp-now') ? '*' : '')).join(','), badges: [...document.querySelectorAll('.learn-badges .lb')].map((e) => (e.classList.contains('lb-on') ? 1 : 0)).join(''), lessons: [...document.querySelectorAll('.learn-lesson')].map((e) => e.className.split('st-')[1]).join(), counts: [...document.querySelectorAll('.lv-count')].map((e) => e.textContent).join(',') }));
    check('F3 Egitim Merkezi: alti asama sirasi, yol, rozetler, ders durumlari V7.4 ile ayni', m.names === 'Başlangıç,Çırak,Kalfa,Usta,Kaşif,Mucit' && m.path === 'baslangic:done,cirak:done,kalfa:open*,usta:locked,kasif:locked,mucit:locked' && m.badges === '11100000' && m.lessons === 'done,done,done,open,locked,locked,locked,locked' && m.counts === '2/2,1/1,0/2,0/1,0/1,0/1', JSON.stringify(m));
    // fiziksel Geri: ders icinde dersi kapatir, listede ana ekrana doner
    await openLesson(page, 'series-1');
    check('F4 Kalfa dersi acilir (5 nokta), kartsiz anlatim adimi', (await page.locator('.learn-dot').count()) === 5 && (await page.locator('.learn-meet').count()) === 0);
    const handled = await page.evaluate(() => window.__altezBack.handle());
    await page.waitForTimeout(200);
    check('F5 fiziksel Geri: dersi kapatip listeye doner, ilerleme yazilmaz', handled !== false && (await page.locator('.learn-map').count()) === 1 && JSON.stringify((await store(page)).edu.done) === '["circuit-1","switch-1","resistor-1"]', String(handled));
    await openLesson(page, 'series-1');
    await page.click('.bar .btn.icon');
    await page.waitForSelector('.learn-map');
    check('F6 X dugmesi dersi kapatir', (await page.locator('.learn-dots .learn-dot').count()) === 0);
    await page.evaluate(() => window.__altezBack.handle());
    await page.waitForTimeout(500);
    check('F7 fiziksel Geri listede ana menuye doner', (await page.locator('.menu .menu-card').count()) === 4);
    for (const g of ['shape-complete', 'number-hunt', 'invent']) {
      await page.goto(BASE + '#/play/' + g);
      await page.waitForSelector('.play', { timeout: 5000 }).catch(() => {});
      check(`F8 oyun acilir: ${g}`, (await page.locator('.play').count()) === 1);
    }
    const st = await store(page);
    check('F9 mevcut oyun kayitlari ve Egitim kaydi bozulmadi', st.correct === 4 && st.games['number-hunt'].correct === 3 && st.edu.done.length === 3);
    check('F10 regresyon: sayfa/konsol hatasi yok', errs.length === 0, errs.slice(0, 3).join(' | '));
    await ctx.close();
  }
} catch (e) {
  check('beklenmeyen hata', false, e.stack || String(e));
} finally {
  await browser.close();
  server.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} kontrol basarili (V7.5 hedefli UI testi)`);
process.exit(failed.length ? 1 : 0);
