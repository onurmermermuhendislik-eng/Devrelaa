// V7.7: surum tutarliligi + Gorevler (hub, Elektrik Dedektifi 12 vaka, Mantik ve Bilim 16 gorev), gorev kaydi/odul guvenligi.
// YALNIZ yeni/degisen kod icin hedefli testler; V7.4-V7.6 testleri aynen kalir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { createRng } from '../src/core/rng.js';
import { tasksFor, validTasks, taskStatus, progressOf, nextTask, taskReward, createRun, optionCount, MAX_OPTIONS_4_5 } from '../src/core/taskkit.js';
import { startState, evaluate, placeOption, tapFault, healthyHint, hintFor, validateTask as validateDet } from '../src/games/detective/logic.js';
import { shuffledItems, isNextInOrder, shuffledOptions, correctIndex, isCorrect, validateTask as validateLs } from '../src/games/logic-science/logic.js';
import { games, education, tasks as tasksHub } from '../src/games/registry.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const inv = data.game.invent;
const DET = data.game.detective;
const LS = data.game['logic-science'];
const KEY = 'altez-minilab:v1';
const mem = (init) => {
  const m = new Map(init ? [[KEY, typeof init === 'string' ? init : JSON.stringify(init)]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), raw: () => m.get(KEY) };
};

test('V7.7 kayit: completeTask ATOMIK; ilk cozumde odul, tekrarda hicbir sey yazilmaz; edu.done ve diger alanlar degismez', () => {
  const old = { correct: 12, band: '6-8', sound: true, games: { 'number-hunt': { correct: 9 }, invent: { correct: 3, found: ['light'] } }, edu: { done: ['circuit-1', 'switch-1'] } };
  const b = mem(old);
  let s = createStorage(b);
  const before = JSON.parse(b.raw() ?? JSON.stringify(old));
  assert.deepEqual(s.getTasks('detective').done, []);
  const r1 = s.completeTask('detective', 'd1-kayip-lamba');
  assert.equal(r1.firstTime, true);
  const after1 = b.raw();
  for (let i = 0; i < 5; i++) {
    const r = s.completeTask('detective', 'd1-kayip-lamba'); // cift dokunus / yeniden acma
    assert.equal(r.firstTime, false);
    assert.deepEqual(r.done, ['d1-kayip-lamba']);
  }
  assert.equal(b.raw(), after1, 'tekrar cozumde kayit DEGISMEZ');
  s = createStorage(b); // uygulama yeniden acildi
  assert.deepEqual(s.getTasks('detective').done, ['d1-kayip-lamba']);
  assert.equal(s.completeTask('detective', 'd1-kayip-lamba').firstTime, false);
  assert.deepEqual(s.getEdu().done, ['circuit-1', 'switch-1'], 'edu.done degismedi');
  assert.equal(s.get().correct, 12);
  assert.equal(s.getGame('number-hunt').correct, 9);
  assert.deepEqual(s.getGame('invent').found, ['light']);
  assert.equal(s.getGame('detective').correct, 1, 'correct = ilk kez cozulen gorev sayisi');
  assert.equal(before.edu.done.length, 2);
});

test('V7.7 kayit: eski kayitlar (gorev alani yok) bozulmadan okunur; bozuk/tekrarli/gecersiz kimlikler temizlenir; en fazla 64', () => {
  const s0 = createStorage(mem({ correct: 5, games: { detective: { correct: 2 } } }));
  assert.deepEqual(s0.getTasks('detective').done, []);
  assert.deepEqual(s0.getTasks('logic-science').done, []);
  const dirty = { correct: 1, games: { detective: { correct: 2, done: ['a', 'a', 5, null, 'b c', 'd1-kayip-lamba', 'x'.repeat(40)] } } };
  const s1 = createStorage(mem(dirty));
  assert.deepEqual(s1.getTasks('detective').done, ['a', 'd1-kayip-lamba']);
  const many = { correct: 0, games: { detective: { correct: 0, done: Array.from({ length: 80 }, (_, i) => `t${i}`) } } };
  assert.equal(createStorage(mem(many)).getTasks('detective').done.length, 64);
  const s2 = createStorage(mem('{bozuk json'));
  assert.deepEqual(s2.getTasks('detective').done, []);
  assert.equal(s2.completeTask('detective', 'bad id!').firstTime, false);
  assert.equal(s2.completeTask('bad game!', 'd1').firstTime, false);
  assert.equal(s2.completeTask('detective', 'd1-kayip-lamba').firstTime, true);
});

test('V7.7 kayit: baska oyunun updateGame islemi gorev kaydini silmez; gorev kaydi baska oyunlarin alanlarini silmez', () => {
  const b = mem({ correct: 0, games: { invent: { correct: 1, found: ['light'] } } });
  const s = createStorage(b);
  s.completeTask('logic-science', 'l1-tohum');
  s.updateGame('invent', { correct: 4 });
  s.updateGame('logic-science', { correct: 1 });
  s.completeTask('detective', 'd3-acik-anahtar');
  const s2 = createStorage(b);
  assert.deepEqual(s2.getTasks('logic-science').done, ['l1-tohum']);
  assert.deepEqual(s2.getTasks('detective').done, ['d3-acik-anahtar']);
  assert.equal(s2.getGame('invent').correct, 4);
  assert.deepEqual(s2.getGame('invent').found, ['light']);
});

// ---------------- taskkit ----------------
test('V7.7 taskkit: yas bandina gore suzme, durum, ilerleme (bilinmeyen kimlik sayiyi sisirmez), siradaki gorev, odul', () => {
  const t4 = tasksFor(DET, '4-5');
  const t6 = tasksFor(DET, '6-8');
  assert.equal(t4.length, 8); // V7.8: 12 -> 17 vaka
  assert.equal(t6.length, 15);
  assert.equal(tasksFor(LS, '4-5').length, 8);
  assert.equal(tasksFor(LS, '6-8').length, 16);
  assert.deepEqual(progressOf(t4, []), { done: 0, total: 8 });
  assert.deepEqual(progressOf(t4, ['d1-kayip-lamba', 'yok', 'd1-kayip-lamba', 7]), { done: 1, total: 8 });
  assert.equal(taskStatus(t4, ['d1-kayip-lamba'])['d1-kayip-lamba'], 'done');
  assert.equal(nextTask(t4, []).task.id, 'd1-kayip-lamba');
  assert.equal(nextTask(t4, ['d1-kayip-lamba']).task.id, 'd2-kopuk-yol');
  assert.equal(nextTask(t4, ['d1-kayip-lamba'], 'd2-kopuk-yol').task.id, 'd3-acik-anahtar');
  const all = t4.map((t) => t.id);
  assert.equal(nextTask(t4, all).kind, 'replay');
  assert.equal(nextTask([], []).kind, 'none');
  // ilk cozum odulu / tekrar odulu
  const R1 = taskReward(t4, ['d1-kayip-lamba'], t4[0], true);
  assert.equal(R1.firstTime, true);
  assert.equal(R1.count, 1);
  const Rr = taskReward(t4, all, t4[0], false);
  assert.equal(Rr.firstTime, false);
  assert.equal(Rr.allDone, false, 'tekrarda "hepsi tamam" kutlamasi yok');
  assert.equal(taskReward(t4, all, t4[5], true).allDone, true);
  assert.equal(validTasks({ tasks: [{ id: 'a', kind: 'x', bands: ['4-5'] }, { id: 'a', kind: 'x', bands: ['4-5'] }, { id: 'bad id', kind: 'x', bands: ['4-5'] }, null, { id: 'b', kind: 'x', bands: [] }] }).length, 1);
});

test('V7.7 taskkit createRun: ayni calismada ayni olay tek kez; yeni calisma yeniden sayar', () => {
  const r = createRun();
  const a = r.start();
  assert.equal(r.claim('solved'), true);
  assert.equal(r.claim('solved'), false);
  assert.equal(r.claim('wrong:x'), true);
  const b = r.start();
  assert.equal(r.isCurrent(a), false);
  assert.equal(r.isCurrent(b), true);
  assert.equal(r.claim('solved'), true);
});

// ---------------- Elektrik Dedektifi verisi ----------------
test('V7.7 Dedektif: 17 vaka (V7.8), uc tur, benzersiz kimlik, gecerli veri; 4-5 yasta en fazla 3 secenek/parca', () => {
  assert.equal(DET.tasks.length, 17);
  assert.equal(new Set(DET.tasks.map((t) => t.id)).size, 17);
  assert.deepEqual([...new Set(DET.tasks.map((t) => t.kind))].sort(), ['build', 'fault', 'missing']);
  for (const t of DET.tasks) {
    assert.deepEqual(validateDet(t, inv), [], t.id);
    assert.ok(t.title && t.story && t.icon && t.hint2, t.id);
    assert.ok(t.story.length <= 90 && t.hint2.length <= 90, `${t.id}: kisa metin`);
    if (t.bands.includes('4-5')) assert.ok(optionCount(t) <= MAX_OPTIONS_4_5, `${t.id}: 4-5 yas secenek siniri`);
  }
  assert.ok(MAX_OPTIONS_4_5 === 3);
});

test('V7.7 Dedektif: her vaka baslangicta COZULMEMIS; Dedektif Sekli Tamamla devre bolumlerinin kopyasi degil (farkli kimlik/tur/veri)', () => {
  for (const t of DET.tasks) {
    const st = startState(t);
    assert.equal(evaluate(inv, t, st.slots, st.states).ok, false, `${t.id}: baslangicta cozulmus olmamali`);
  }
  const ids = new Set(data.circuits.stages.map((s) => s.id));
  for (const t of DET.tasks) assert.ok(!ids.has(t.id), t.id);
  assert.ok(DET.tasks.some((t) => t.kind === 'fault'), 'ariza yeri bulma var');
});

test('V7.7 Dedektif missing: TAM olarak bildirilen cevap cozer; yanlis secenekler cozmez ve ipucu verir (kisa, cevabi soylemez)', () => {
  const T = DET.text;
  for (const t of DET.tasks.filter((x) => x.kind === 'missing')) {
    const solving = t.options.filter((o) => placeOption(inv, t, o).ok).sort();
    assert.deepEqual(solving, [...t.answer].sort(), `${t.id}: cozen secenekler = answer`);
    for (const o of t.options.filter((x) => !t.answer.includes(x))) {
      const r = placeOption(inv, t, o);
      assert.equal(r.ok, false, `${t.id}/${o}`);
      const h = hintFor(t, T, o, r.key);
      assert.ok(h && h.length >= 10 && h.length <= 110, `${t.id}/${o}: ipucu "${h}"`);
      assert.ok(!h.toLowerCase().includes('hemen led koy'), t.id);
    }
  }
});

test('V7.7 Dedektif fault: dogru konumlara dokununca cozulur; saglam konuma dokunmak cozmez ve ipucu verir; ayni konum iki kez duzeltilmez', () => {
  const T = DET.text;
  for (const t of DET.tasks.filter((x) => x.kind === 'fault')) {
    const st = startState(t);
    // saglam (arıza olmayan) her konum: hit=false + ipucu
    for (let i = 0; i < t.slots.length; i++) {
      const id = `s${i + 1}`;
      if (t.culprits.some((c) => c.slot === id)) continue;
      assert.equal(tapFault(t, st.slots, st.states, [], id).hit, false, `${t.id}/${id}`);
      const h = healthyHint(t, T, st.slots, st.states, id);
      assert.ok(h && h.length >= 10 && h.length <= 110, `${t.id}/${id}: "${h}"`);
    }
    let { slots, states } = st;
    let fixed = [];
    for (let k = 0; k < t.culprits.length; k++) {
      assert.equal(evaluate(inv, t, slots, states).ok, false, `${t.id}: ${k} duzeltmeden sonra henuz cozulmemis`);
      const c = t.culprits[k];
      const r = tapFault(t, slots, states, fixed, c.slot);
      assert.equal(r.hit, true);
      ({ slots, states, fixed } = r);
      assert.equal(tapFault(t, slots, states, fixed, c.slot).hit, false, 'ayni arıza ikinci kez duzeltilmez');
    }
    assert.equal(evaluate(inv, t, slots, states).ok, true, `${t.id}: tum arizalar duzelince lamba yanar`);
  }
});

test('V7.7 Dedektif build: her baglanti vakasi COZULEBILIR (arac kombinasyonlarindan); bos baslangic cozulmus degil; ipuclari kisa', () => {
  const T = DET.text;
  for (const t of DET.tasks.filter((x) => x.kind === 'build')) {
    const free = t.slots.map((s, i) => (!s && !(t.fixed || []).includes(i) ? i : -1)).filter((i) => i >= 0);
    let solvable = false;
    const tools = t.tools;
    const walk = (k, slots, states) => {
      if (solvable) return;
      if (k === free.length) {
        // anahtar varsa kapali dene
        const st2 = { ...states };
        for (const [i, x] of slots.entries()) if (x === 'switch') st2[`s${i + 1}`] = 'closed';
        if (evaluate(inv, t, slots, st2).ok) solvable = true;
        return;
      }
      for (const tool of [null, ...tools]) {
        const s2 = slots.slice();
        s2[free[k]] = tool;
        walk(k + 1, s2, states);
      }
    };
    walk(0, startState(t).slots, startState(t).states);
    assert.ok(solvable, `${t.id}: cozulebilir olmali`);
    for (const k of Object.keys(T.hints)) assert.ok(T.hints[k].length <= 90, k);
  }
});

test('V7.7 Dedektif: yanlis baglanti ipuclari parca adiyla (direnc/anahtar/kablo/LED), genel metinler kisa; saglam konum metinleri var', () => {
  const T = DET.text;
  for (const k of ['gap', 'noled', 'short', 'switch', 'resistor', 'needswitch', 'needwire', 'ledoff', 'weak', 'needseries', 'needparallel', 'notall']) assert.ok(T.hints[k] && T.hints[k].length >= 10, k);
  for (const k of ['wire', 'led', 'resistor', 'switch']) assert.ok(T.healthy[k], k);
  const d7 = DET.tasks.find((t) => t.id === 'd7-direnc');
  const st = startState(d7);
  const filled = st.slots.slice();
  filled[2] = 'wire'; // yanan ama dirençsiz
  const r = evaluate(inv, d7, filled, st.states);
  assert.equal(r.ok, false);
  assert.equal(r.key, 'resistor');
  const d8 = DET.tasks.find((t) => t.id === 'd8-anahtar');
  const f8 = startState(d8).slots.slice();
  f8[2] = 'wire';
  assert.equal(evaluate(inv, d8, f8, startState(d8).states).key, 'needswitch');
  const d11 = DET.tasks.find((t) => t.id === 'd11-iki-lamba');
  const f11 = startState(d11).slots.slice();
  f11[3] = 'led';
  f11[5] = 'wire'; // ikinci kol kisa devre
  const r11 = evaluate(inv, d11, f11, startState(d11).states);
  assert.equal(r11.ok, false);
});

// ---------------- Mantik ve Bilim verisi ----------------
test('V7.7 Mantik-Bilim: 16 gorev, dort tur x4, benzersiz kimlik, gecerli veri; 4-5 yasta en fazla 3 secenek/oge', () => {
  assert.equal(LS.tasks.length, 16);
  assert.equal(new Set(LS.tasks.map((t) => t.id)).size, 16);
  for (const k of ['order', 'pattern', 'cause', 'science']) assert.equal(LS.tasks.filter((t) => t.kind === k).length, 4, k);
  for (const t of LS.tasks) {
    assert.deepEqual(validateLs(t), [], t.id);
    assert.ok(t.title && t.icon && t.say && t.hint2, t.id);
    if (t.bands.includes('4-5')) assert.ok(optionCount(t) <= MAX_OPTIONS_4_5, `${t.id}: 4-5 yas secenek siniri`);
    assert.ok(t.say.length <= 90 && t.hint2.length <= 90, `${t.id}: kisa metin`);
  }
});

test('V7.7 Mantik-Bilim: her secenekli gorevde TAM bir dogru; yanlis her secenekte kisa, cevabi vermeyen ipucu', () => {
  for (const t of LS.tasks.filter((x) => x.kind !== 'order')) {
    assert.equal(t.options.filter((o) => o.ok).length, 1, t.id);
    const right = t.options[correctIndex(t)];
    assert.equal(isCorrect(t, correctIndex(t)), true);
    for (let i = 0; i < t.options.length; i++) {
      if (t.options[i].ok) continue;
      assert.equal(isCorrect(t, i), false);
      const h = t.options[i].hint;
      assert.ok(typeof h === 'string' && h.length >= 10 && h.length <= 90, `${t.id}/${i}: ${h}`);
      assert.ok(!h.toLowerCase().includes(right.text.toLowerCase()), `${t.id}/${i}: ipucu cevabi dogrudan soylemez`);
    }
    if (t.kind === 'pattern') {
      assert.ok(t.seq.length >= 3);
      assert.ok(t.options.some((o) => o.ok));
    } else assert.ok(t.observe.icon && t.observe.text.length >= 15 && t.observe.text.length <= 120, `${t.id}: gozlem metni`);
  }
});

test('V7.7 Mantik-Bilim siralama: dogru sira yalniz yazim sirasidir; karistirma asla dogru sirayi vermez; yanlis ogenin ipucu var', () => {
  for (const t of LS.tasks.filter((x) => x.kind === 'order')) {
    for (let seed = 1; seed <= 25; seed++) {
      const o = shuffledItems(t, createRng(seed));
      assert.deepEqual([...o].sort((a, b) => a - b), t.items.map((_, i) => i), 'permutasyon');
      assert.equal(o.every((v, i) => v === i), false, `${t.id}: sira karistirilmis olmali`);
    }
    for (let i = 0; i < t.items.length; i++) {
      assert.equal(isNextInOrder(i, i), true);
      assert.equal(isNextInOrder(i, (i + 1) % t.items.length), t.items.length === 1);
      assert.ok(t.items[i].hint.length >= 10 && t.items[i].hint.length <= 90, `${t.id}/${i}`);
    }
  }
  const o = shuffledOptions(LS.tasks.find((t) => t.kind === 'pattern'), createRng(3));
  assert.equal(o.length, 3);
  assert.deepEqual(o.map((x) => x.i).sort(), [0, 1, 2]);
});

test('V7.7 Mantik-Bilim: dogru yanitlar bilimsel olarak tutarli (kasitli kontrol listesi: veri degisirse bu liste de gozden gecirilir)', () => {
  const ans = Object.fromEntries(LS.tasks.filter((t) => t.kind !== 'order').map((t) => [t.id, t.options[correctIndex(t)].text]));
  assert.deepEqual(ans, {
    'l5-renkler': 'Mavi', 'l6-hayvanlar': 'Köpek', 'l7-meyveler': 'Muz', 'l8-yildizlar': 'Dört yıldız',
    'l9-anahtar': 'Yanar', 'l10-yagmur': 'Şemsiye', 'l11-pil': 'Durur', 'l12-buz': 'Buz olur',
    'l13-miknatis': 'Çivi', 'l14-golge': 'Gölge', 'l15-batar': 'Taş', 'l16-isik': 'Cam'
  });
  const orders = Object.fromEntries(LS.tasks.filter((t) => t.kind === 'order').map((t) => [t.id, t.items.map((i) => i.label).join('>')]));
  assert.equal(orders['l1-tohum'], 'Tohum>Filiz>Çiçek');
  assert.equal(orders['l2-kucukten'], 'Karınca>Kedi>Fil');
  assert.equal(orders['l3-gun'], 'Sabah>Öğle>Akşam>Gece');
  assert.equal(orders['l4-civciv'], 'Yumurta>Çıkan civciv>Küçük civciv>Tavuk');
  // orutuler gercekten orutu
  const p = Object.fromEntries(LS.tasks.filter((t) => t.kind === 'pattern').map((t) => [t.id, t]));
  assert.deepEqual(p['l5-renkler'].seq, ['🔴', '🔵', '🔴', '🔵', '🔴']);
  assert.deepEqual(p['l7-meyveler'].seq, ['🍎', '🍎', '🍌', '🍎', '🍎']);
  assert.deepEqual(p['l8-yildizlar'].seq.map((s) => [...s].length), [1, 2, 3]);
  assert.equal([...p['l8-yildizlar'].options[0].icon].length, 4);
});

// ---------------- Mimari / ana ekran / ses ----------------
test('V7.7 ana ekran: UC oyun karti degismedi; Gorevler hub kartlarin disinda (Egitim gibi); oyun kimlikleri ve siralari ayni', () => {
  assert.deepEqual(games.map((g) => g.id), ['shape-complete', 'number-hunt', 'invent']);
  assert.equal(education.id, 'learn');
  assert.equal(tasksHub.id, 'tasks');
  assert.ok(!games.some((g) => ['tasks', 'detective', 'logic-science'].includes(g.id)));
  const home = rd('src/ui/home.js');
  // V7.8: Gorevler dugmesi kalkti; Elektrik Dedektifi ve Mantik ve Bilim Oyunlar ekraninda kendi kartlariyla (taskGames)
  assert.match(home, /taskGames\.map\(taskCard\)/);
  assert.match(home, /data-game="learn"/);
  const app = rd('src/core/app.js');
  assert.match(app, /\[\.\.\.games, education, tasks, \.\.\.subGames, energyAdventure\]\.find/);
  assert.equal(data.manifest.gameData.detective, 'assets/data/detective.json');
  assert.equal(data.manifest.gameData['logic-science'], 'assets/data/logic-science.json');
  assert.equal(data.strings.games.tasks.title, 'Görevler');
  assert.equal(data.strings.games.detective.title, 'Elektrik Dedektifi');
  assert.equal(data.strings.games['logic-science'].title, 'Mantık ve Bilim');
  // mevcut oyun kartlari metinleri ayni
  assert.equal(data.strings.games['shape-complete'].title, 'Şekli Tamamla');
  assert.equal(data.strings.games.learn.title, 'Eğitim');
});

test('V7.7 hub: tek giris, iki kart; Geri tusu zinciri kaynakta (oyun -> hub -> ana ekran); cift dokunus korumasi', () => {
  const g = rd('src/games/tasks/game.js');
  assert.match(g, /data-act="game"/);
  assert.match(g, /registerBack/);
  assert.match(g, /if \(subBack && subBack\(\) === true\) return true;/);
  assert.match(g, /if \(leaving\) return;/);
  assert.match(g, /if \(sub\) return;/);
  const idx = rd('src/games/tasks/index.js');
  assert.match(idx, /progress:/);
  assert.match(rd('src/games/tasks/subgames.js'), /subGames = \[detective, logicScience\]/);
});

test('V7.7 kabuk: ses ve konusma YALNIZ ctx.audio/ctx.voice; odul storage.completeTask + run.claim; edu.done ve localStorage kullanilmaz', () => {
  const files = ['src/games/tasks/shell.js', 'src/games/tasks/game.js', 'src/games/detective/view.js', 'src/games/detective/logic.js', 'src/games/logic-science/view.js', 'src/games/logic-science/logic.js', 'src/core/taskkit.js'];
  for (const f of files) {
    const c = rd(f);
    assert.doesNotMatch(c, /new Audio|speechSynthesis|AudioContext|SpeechSynthesisUtterance/, f);
    assert.doesNotMatch(c, /localStorage|sessionStorage/, f);
    assert.doesNotMatch(c, /getEdu|updateEdu|\.edu\b/, `${f}: Egitim kaydina dokunmaz`);
  }
  const sh = rd('src/games/tasks/shell.js');
  assert.match(sh, /if \(!run\.claim\('solved'\)\) return;/);
  assert.match(sh, /storage\.completeTask\(gameId, task\.id\)/);
  assert.match(sh, /audio\.play\('levelUp'\)/);
  assert.match(sh, /voice\.say\(/);
  assert.match(sh, /run\.isCurrent\(rid\) && task === tk && audio\.play\('success'\)/);
  assert.match(sh, /if \(ref === lastWrong\) \{/);
  assert.match(sh, /if \(wrongCount >= 3\) \{\s*view\?\.assist\?\.\(\);/);
});

test('V7.7 CSS: hub/gorev stilleri tanimli; Egitim yerlesim siniflari yeniden kullanilir; dokunma hedefi', () => {
  const c = rd('src/ui/styles.css');
  for (const sel of ['.tasks-entry', '.tk-card', '.ls-order', '.ls-seq', '.ls-observe', '.learn-opt.hint']) assert.ok(c.includes(sel), sel);
  const sh = rd('src/games/tasks/shell.js');
  for (const cls of ['learn-map', 'learn-stage', 'learn-nextcard', 'learn-lesson', 'learn-done', 'learn-reward', 'learn-ctl']) assert.ok(sh.includes(cls), cls);
});

test('V7.7 ozellik envanteri: tasks ozelligi bu testi ve tum kaynaklarini icerir', () => {
  const f = JSON.parse(rd('release/features.json'));
  const t = f.features.find((x) => x.id === 'tasks');
  assert.ok(t.tests.includes('tests/v77.test.js'));
  for (const s of t.sources) assert.ok(rd(s).length > 50, s);
  for (const d of t.data) assert.ok(rd(d).length > 20, d);
  assert.ok(f.features.find((x) => x.id === 'learn').tests.includes('tests/v76.test.js'));
});

// ---------- V7.7 ek: acilis ekrani, merkezi surum, gelecek ozellik kartlari ----------
test('V7.7 surum tek kaynak: app-version.json version.env\'den uretilir; build.gradle ve ekran surumu ayni', async () => {
  const { parseEnv, versionInfo } = await import('../scripts/gen-version.mjs');
  const env = parseEnv(rd('scripts/version.env'));
  const info = versionInfo(env);
  const av = JSON.parse(rd('assets/data/app-version.json'));
  assert.equal(av.versionName, info.versionName);
  assert.equal(av.versionCode, info.versionCode);
  assert.equal(av.tag, info.tag);
  const gr = rd('android/app/build.gradle');
  assert.match(gr, new RegExp(`versionName "${info.versionName.replace('.', '\\.')}"`));
  assert.match(gr, new RegExp(`versionCode ${info.versionCode}\\b`));
  assert.equal('V' + av.versionName, info.tag, 'ekranda gosterilen V7.7 = RELEASE_TAG');
  // elle yazilmis surum metni kaynakta yok (splash/home surumu koda gommez)
  for (const f of ['src/ui/splash.js', 'src/ui/home.js', 'src/core/assets.js']) assert.doesNotMatch(rd(f).replace(/^\s*\/\/.*$/gm, ''), /V7\.\d/, f + ' sabit surum icermemeli (yorumlar haric)');
  assert.match(rd('scripts/build.mjs'), /genVersion/);
  assert.ok(data.manifest.data.version, 'manifest.data.version');
});

test('V7.7 gelecek ozellik kartlari: 3 kart, ortak durum etiketi tek noktada, hazir degil -> oyun baslatmaz', () => {
  const soon = data.game.soon;
  assert.deepEqual(soon.items.map((i) => i.id), ['adventure', 'profile', 'parental']);
  const st = data.strings.soon;
  assert.equal(st.status, 'GELİŞTİRME AŞAMASINDA');
  assert.equal(st.items.adventure.title, 'Enerji Macerası');
  assert.equal(st.items.adventure.desc, 'Atölyeden santrale, keşfederek öğren!');
  assert.equal(st.items.adventure.message, 'Enerji Macerası üzerinde çalışıyoruz. Tamamlandığında burada oynayabileceksin!');
  assert.equal(st.items.profile.title, 'Kullanıcı Girişi ve Profil');
  assert.equal(st.items.profile.desc, 'Profilini oluştur, ilerlemeni takip et.');
  assert.equal(st.items.parental.title, 'Ebeveyn Kontrolü');
  assert.equal(st.items.parental.desc, 'Oyun süresini ve kullanım saatlerini yönet.');
  const ids = new Set([...games, education, tasksHub].map((g) => g.id));
  for (const it of soon.items) {
    assert.equal(it.enabled, false, it.id + ' henuz etkin degil');
    assert.ok(!ids.has(it.gameId), it.id + ' mevcut bir oyunu acmamali');
    assert.ok(st.items[it.id].message && st.items[it.id].note);
  }
  assert.equal(soon.items[0].orientation, 'landscape', 'Enerji Macerasi yatay (yalniz bu kart)');
  assert.equal(soon.items.filter((i) => i.orientation).length, 1);
  // sahte islev yok: giris saglayicisi / PIN / sure sinirina dair "calisiyor" iddiasi yok
  const all = JSON.stringify(st);
  assert.doesNotMatch(all, /Google|Apple|bulut|senkron/i);
  assert.match(st.items.parental.note, /yoktur/);
  // ilk acilis metinleri
  assert.equal(data.strings.slogan, 'Keşfet · Öğren · Üret');
  assert.equal(data.strings.splash.developer, 'ALTEZ Enerji');
  assert.equal(data.strings.tagline, 'Keşfet • Öğren • Mucit Ol', 'ana ekran sloganı ve eski testler degismedi');
});

test('V7.7 ana ekran kaynagi: 3 oyun karti games kaydindan, yeni kartlar oyun karti DEGIL ve data-act=play kullanmaz', () => {
  const h = rd('src/ui/home.js');
  assert.match(h, /data-act="soon"/);
  assert.match(h, /enabled === true && !!it\.gameId/);
  assert.equal(games.length, 3);
  assert.match(rd('src/ui/styles.css'), /\.soon-card/);
});
