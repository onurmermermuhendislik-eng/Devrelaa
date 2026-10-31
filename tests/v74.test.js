// V7.4: surum tutarliligi + Egitim yazisi gorunurlugu (CSS) + Egitim Merkezi: alti asama, dersler, gorevler, ipuclari, ilerleme
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { buildCurriculum, lessonStatus, levelStatus, completeLesson, progressCount, taskResult } from '../src/games/learn/logic.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const learn = data.game.learn;
const inv = data.game.invent;
const cur = buildCurriculum(learn, data.levels);
const ORDER = ['baslangic', 'cirak', 'kalfa', 'usta', 'kasif', 'mucit'];
const mem = (init) => {
  const m = new Map(init ? [['altez-minilab:v1', init]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

// (V7.4 surum-tutarlilik testi V7.5'te tests/v75.test.js icine tasindi: surum numaralari yeni surumle degisir; V7.4 icerik testleri aynen korunur.)

test('V7.4 Egitim dugmesi: koyu mor zemin kuralinin ozgullugu .btn.chip ile ayni/yuksek (beyaz-uzeri-beyaz hatasi yok)', () => {
  const c = rd('src/ui/styles.css');
  assert.match(c, /\.btn\.chip\.edu-entry\s*\{[^}]*background:\s*#7a4df0[^}]*color:\s*#fff/s);
  assert.doesNotMatch(c, /(^|\n)\.edu-entry\s*\{/);
});

test('V7.4 alti asama dogru sirada; her asamada en az bir ders; her derste ogretim + uygulamali gorev + soru', () => {
  assert.deepEqual(cur.levels.map((l) => l.id), ORDER);
  assert.deepEqual(cur.levels.map((l) => l.name), ['Başlangıç', 'Çırak', 'Kalfa', 'Usta', 'Kaşif', 'Mucit']);
  for (const l of cur.levels) {
    assert.ok(l.lessons.length >= 1, `${l.id}: ders var`);
    for (const x of l.lessons) {
      assert.ok(x.title && x.goal && x.icon, x.id);
      assert.ok(x.steps.some((s) => s.type === 'show' && s.board), `${x.id}: gorsel/sema`);
      assert.ok(x.steps.some((s) => s.type === 'task'), `${x.id}: gorev`);
      assert.ok(x.steps.some((s) => s.type === 'quiz'), `${x.id}: soru`);
    }
  }
});

test('V7.4 erisim: ders sirayla acilir; ileri asamalar onceki bitmeden kilitli; tum dersler bitince hepsi tamam', () => {
  const lv0 = levelStatus(cur, []);
  assert.equal(lv0.baslangic, 'open');
  for (const id of ORDER.slice(1)) assert.equal(lv0[id], 'locked', id);
  let done = [];
  const seen = [];
  for (const id of cur.order) {
    assert.equal(lessonStatus(cur, done)[id], 'open', `${id} sirasi gelince acik`);
    done = completeLesson(cur, done, id);
    seen.push(levelStatus(cur, done));
  }
  assert.deepEqual(Object.values(levelStatus(cur, done)), ORDER.map(() => 'done'));
  assert.deepEqual(progressCount(cur, done), { done: 8, total: 8 });
});

test('V7.4 gorev: Usta (LED+direnc+anahtar), Kasif (acik->kapali devre), Mucit (iki LED + anahtar, paralel) dogru; eksik/yanlis -> yanmaz + ipucu', () => {
  const T = (id) => learn.lessons.find((l) => l.id === id).steps.find((s) => s.type === 'task');
  const run = (id, slots, states = {}) => taskResult(inv, T(id).goal, slots, states, T(id).board.layout);
  // Usta
  assert.equal(run('usta-1', ['led', 'resistor', 'switch'], { s3: 'closed' }).ok, true);
  const u = run('usta-1', ['led', 'resistor', 'switch'], { s3: 'open' });
  assert.equal(u.ok, false);
  assert.equal(u.analysis.lit, 0, 'anahtar acikken LED yanmaz');
  assert.equal(run('usta-1', ['led', 'wire', 'switch'], { s3: 'closed' }).key, 'resistor', 'direnc eksikse ipucu: direnc');
  // Kasif: bosluk acik devre, kablo kapatir
  const gap = run('kasif-1', ['wire', 'led', null]);
  assert.equal(gap.ok, false);
  assert.equal(gap.analysis.lit, 0);
  assert.equal(gap.key, 'gap');
  assert.equal(run('kasif-1', ['wire', 'led', 'wire']).ok, true);
  // Mucit
  assert.equal(run('mucit-1', ['wire', 'wire', 'wire', 'led', 'switch', 'led'], { s5: 'closed' }).ok, true);
  assert.equal(run('mucit-1', ['wire', 'wire', 'wire', 'led', 'switch', 'led'], { s5: 'open' }).ok, false, 'anahtar acik: LED yok');
  const one = run('mucit-1', ['wire', 'wire', 'wire', 'led', 'switch', null], { s5: 'closed' });
  assert.equal(one.ok, false);
  assert.equal(one.key, 'needparallel');
});

test('V7.4 yanlis cevapta cevap verilmez, kisa ogretici ipucu verilir: her yanlis soru secenegi ipucu tasir', () => {
  for (const l of learn.lessons) {
    const q = l.steps.find((s) => s.type === 'quiz');
    assert.equal(q.options.filter((o) => o.ok).length, 1, l.id);
    for (const o of q.options.filter((x) => !x.ok)) {
      assert.ok(typeof o.hint === 'string' && o.hint.length > 10 && o.hint.length < 80, `${l.id}: ipucu`);
      assert.ok(!o.hint.includes(q.options.find((x) => x.ok).text), `${l.id}: ipucu cevabi dogrudan soylemez`);
    }
  }
});

test('V7.4 ilerleme kalici: yeniden baslatinca korunur; ayni ders tekrar tamamlanirsa kayit bozulmaz; mevcut oyun kayitlariyla cakismaz', () => {
  const b = mem(JSON.stringify({ correct: 12, band: '6-8', games: { 'number-hunt': { correct: 9 } } }));
  let s = createStorage(b);
  let done = [];
  for (const id of ['circuit-1', 'switch-1', 'resistor-1']) {
    done = completeLesson(cur, done, id);
    s.updateEdu(done);
  }
  s.updateEdu(completeLesson(cur, s.getEdu().done, 'resistor-1'));
  s = createStorage(b); // uygulama yeniden acildi
  assert.deepEqual(s.getEdu().done, ['circuit-1', 'switch-1', 'resistor-1']);
  assert.equal(s.get().correct, 12);
  assert.equal(s.get().band, '6-8');
  assert.equal(s.getGame('number-hunt').correct, 9);
});

test('V7.4 Egitim ekrani: asama yolu, ders sayaci, rozetler ve ipucu konusmasi kaynakta; ses kapaliysa voice.say sessiz (mevcut altyapi)', () => {
  const g = rd('src/games/learn/game.js');
  assert.match(g, /class="learn-path"/);
  assert.match(g, /data-badge=/);
  assert.match(g, /lv-count/);
  assert.match(g, /o\.hint \|\| T\.quizWrong/);
  assert.match(g, /voice\.say\(`learn_hint_/);
  assert.match(g, /lesson === sl && stepIdx === si && audio\.play\('success'\)/);
  const v = rd('src/core/voice.js');
  assert.match(v, /sound|enabled|muted/i);
});
