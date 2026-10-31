// V7 Egitim Bolumu: mufredat, kilit kurallari, kayit (ayri alan, bozuk veri), gorev kontrolu, ses bagimsizligi, V6 korumasi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { loadData, ROOT } from './helpers.js';
import { buildCurriculum, lessonStatus, levelStatus, isUnlocked, completeLesson, nextLessonId, taskResult, startStates, boardParts, progressCount } from '../src/games/learn/logic.js';
import { analyze } from '../src/games/invent/logic.js';
import { createStorage } from '../src/core/storage.js';
import { games, education } from '../src/games/registry.js';

const data = loadData();
const learn = data.game.learn;
const inv = data.game.invent;
const cur = buildCurriculum(learn, data.levels);
const mem = (init) => {
  const m = new Map(init ? [['altez-minilab:v1', init]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), raw: () => m.get('altez-minilab:v1') };
};
const ORDER = ['baslangic', 'cirak', 'kalfa', 'usta', 'kasif', 'mucit'];

test('seviye sirasi: Baslangic, Cirak, Kalfa, Usta, Kasif, Mucit (levels.json ile ayni)', () => {
  assert.deepEqual(cur.levels.map((l) => l.id), ORDER);
  assert.deepEqual(data.levels.map((l) => l.id), ORDER);
});

test('dersler dogru seviyeye atanmis; her dersin hedefi, adimlari ve ilk dersin icerigi var', () => {
  assert.deepEqual(cur.order, ['circuit-1', 'switch-1', 'resistor-1', 'series-1', 'parallel-1', 'usta-1', 'kasif-1', 'mucit-1']);
  assert.deepEqual(cur.levels.find((l) => l.id === 'baslangic').lessons.map((x) => x.id), ['circuit-1', 'switch-1']);
  assert.deepEqual(cur.levels.find((l) => l.id === 'cirak').lessons.map((x) => x.id), ['resistor-1']);
  assert.deepEqual(cur.levels.find((l) => l.id === 'kalfa').lessons.map((x) => x.id), ['series-1', 'parallel-1']);
  // V7.4: Usta, Kasif ve Mucit seviyelerinde de ders var (alti asamanin hepsinde en az bir ders)
  assert.deepEqual(['usta', 'kasif', 'mucit'].map((id) => cur.levels.find((l) => l.id === id).lessons.map((x) => x.id)), [['usta-1'], ['kasif-1'], ['mucit-1']]);
  for (const l of cur.levels.flatMap((x) => x.lessons)) {
    assert.ok(l.title && l.goal && l.icon, l.id);
    assert.ok(l.steps.every((s) => ['show', 'task', 'quiz'].includes(s.type) && s.say), l.id);
    assert.ok(l.steps.some((s) => s.type === 'task') && l.steps.some((s) => s.type === 'quiz'), `${l.id}: gorev + soru`);
  }
  const c1 = learn.lessons.find((l) => l.id === 'circuit-1');
  const text = JSON.stringify(c1);
  for (const k of ['Pil enerji verir', 'Kablo', 'LED enerjiyle ışık verir', 'LED yanmaz', 'LED yanabilir']) assert.ok(text.includes(k), k);
});

test('veri tutarliligi: gecersiz/yinelenen/bilinmeyen seviyeli dersler atilir, uygulama cokmez', () => {
  const bad = buildCurriculum({ lessons: [null, { id: 'a b', level: 'baslangic', steps: [{}] }, { id: 'x', level: 'yok', steps: [{}] }, { id: 'x2', level: 'cirak', steps: [] }, { id: 'ok', level: 'cirak', steps: [{ type: 'show', say: 'a' }] }, { id: 'ok', level: 'cirak', steps: [{ type: 'show', say: 'a' }] }] }, data.levels);
  assert.deepEqual(bad.order, ['ok']);
  assert.deepEqual(buildCurriculum(undefined, data.levels).order, []);
  assert.deepEqual(buildCurriculum({}, data.levels).levels.map((l) => l.lessons.length), [0, 0, 0, 0, 0, 0]);
});

test('kilit: yalniz ilk ders acik; sonraki dersler onceki bitmeden acilmaz', () => {
  assert.deepEqual(lessonStatus(cur, []), { 'circuit-1': 'open', 'switch-1': 'locked', 'resistor-1': 'locked', 'series-1': 'locked', 'parallel-1': 'locked', 'usta-1': 'locked', 'kasif-1': 'locked', 'mucit-1': 'locked' });
  assert.equal(isUnlocked(cur, [], 'switch-1'), false);
  assert.equal(isUnlocked(cur, [], 'resistor-1'), false);
  assert.deepEqual(lessonStatus(cur, ['circuit-1']), { 'circuit-1': 'done', 'switch-1': 'open', 'resistor-1': 'locked', 'series-1': 'locked', 'parallel-1': 'locked', 'usta-1': 'locked', 'kasif-1': 'locked', 'mucit-1': 'locked' });
  // sirayi atlayarak kayit edilmis (hileli/bozuk) bitis kilidi acmaz: resistor-1 tek basina 'done' ise switch-1 hala ilk bitmemis dersten sonra sayilir
  const s = lessonStatus(cur, ['resistor-1']);
  assert.equal(s['circuit-1'], 'open');
  assert.equal(s['switch-1'], 'locked');
});

test('seviye durumlari: Baslangic acik, diger tum seviyeler kilitli (V7.4: hepsinde ders var) -> Baslangic bitince Cirak acik', () => {
  assert.deepEqual(levelStatus(cur, []), { baslangic: 'open', cirak: 'locked', kalfa: 'locked', usta: 'locked', kasif: 'locked', mucit: 'locked' });
  assert.equal(levelStatus(cur, ['circuit-1', 'switch-1']).cirak, 'open');
  assert.equal(levelStatus(cur, ['circuit-1', 'switch-1']).baslangic, 'done');
  assert.equal(levelStatus(cur, ['circuit-1', 'switch-1', 'resistor-1']).cirak, 'done');
});

test('tamamlama: yalniz acik ders kaydedilir; kilitli/bilinmeyen/yinelenen kimlik listeyi bozmaz; sira korunur', () => {
  assert.deepEqual(completeLesson(cur, [], 'circuit-1'), ['circuit-1']);
  assert.deepEqual(completeLesson(cur, [], 'switch-1'), [], 'kilitli ders tamamlanamaz');
  assert.deepEqual(completeLesson(cur, [], 'resistor-1'), []);
  assert.deepEqual(completeLesson(cur, [], 'yok'), []);
  assert.deepEqual(completeLesson(cur, ['circuit-1'], 'circuit-1'), ['circuit-1']);
  assert.deepEqual(completeLesson(cur, ['circuit-1'], 'switch-1'), ['circuit-1', 'switch-1']);
  assert.equal(nextLessonId(cur, 'circuit-1'), 'switch-1');
  assert.equal(nextLessonId(cur, 'resistor-1'), 'series-1');
  assert.equal(nextLessonId(cur, 'parallel-1'), 'usta-1');
  assert.equal(nextLessonId(cur, 'mucit-1'), null);
  assert.deepEqual(progressCount(cur, ['circuit-1', 'zzz', 7]), { done: 1, total: 8 });
});

test('gorev (ders 1): pil + kablo + LED kapali devre -> basari; kopuk devre -> yanmaz; ayni Mucit Atolyesi benzetimi', () => {
  const g = learn.lessons.find((l) => l.id === 'circuit-1').steps.find((s) => s.type === 'task').goal;
  assert.equal(taskResult(inv, g, ['wire', 'led', 'wire'], {}).ok, true);
  assert.equal(taskResult(inv, g, ['led', 'wire', 'wire'], {}).ok, true, 'dizilim fark etmez (seri dongu)');
  const broken = taskResult(inv, g, ['wire', 'led', null], {});
  assert.equal(broken.ok, false);
  assert.equal(broken.analysis.lit, 0);
  assert.equal(broken.key, 'gap');
  assert.equal(taskResult(inv, g, [null, null, null], {}).ok, false);
  assert.equal(taskResult(inv, g, ['wire', 'wire', 'wire'], {}).ok, false, 'LED yok -> yanmaz');
  // ikinci, celisen bir simulasyon yok: sonuc dogrudan Mucit Atolyesi analizinden gelir
  const { parts } = boardParts(inv, { layout: 'loop', slots: ['wire', 'led', 'wire'] }, {});
  assert.equal(analyze(parts).lit, taskResult(inv, g, ['wire', 'led', 'wire'], {}).analysis.lit);
});

test('gorev (ders 2): anahtar acikken yanmaz, kapaninca yanar; dersteki anahtar gorevi anahtar ister', () => {
  const l = learn.lessons.find((x) => x.id === 'switch-1');
  const tasks = l.steps.filter((s) => s.type === 'task');
  const fixed = tasks[0];
  assert.equal(taskResult(inv, fixed.goal, fixed.board.slots, startStates(fixed.board)).ok, false);
  assert.equal(taskResult(inv, fixed.goal, fixed.board.slots, { s3: 'closed' }).ok, true);
  const build = tasks[1];
  assert.equal(taskResult(inv, build.goal, ['wire', 'led', 'wire'], {}).ok, false, 'anahtarsiz devre bu gorevi gecmez');
  assert.equal(taskResult(inv, build.goal, ['wire', 'led', 'wire'], {}).key, 'needswitch');
  assert.equal(taskResult(inv, build.goal, ['wire', 'led', 'switch'], { s3: 'open' }).ok, false);
  assert.equal(taskResult(inv, build.goal, ['wire', 'led', 'switch'], { s3: 'closed' }).ok, true);
});

test('gorev (ders 3): direnc eklenince LED yanar ama daha soluk (kismak)', () => {
  const t = learn.lessons.find((x) => x.id === 'resistor-1').steps.find((s) => s.type === 'task');
  const r = taskResult(inv, t.goal, ['wire', 'led', 'resistor'], {});
  assert.equal(r.ok, true);
  const plain = taskResult(inv, t.goal, ['wire', 'led', 'wire'], {}).analysis.brightest;
  assert.ok(r.analysis.brightest < plain, 'direnc isigi kisar');
  assert.equal(taskResult(inv, t.goal, ['wire', 'led', 'wire'], {}).ok, false, 'direncsiz devre bu gorevi gecmez');
});

test('sorular: her sorunun tam bir dogru secenegi var; yanlis secenek cezalandirici metin icermez', () => {
  for (const l of learn.lessons) for (const s of l.steps.filter((x) => x.type === 'quiz')) {
    assert.equal(s.options.filter((o) => o.ok).length, 1, l.id);
    assert.ok(s.options.length >= 2 && s.options.every((o) => o.text && o.icon));
  }
  for (const k of ['quizWrong', 'again']) assert.ok(!/yanl[ıi]ş|hata|kötü|başarısız/i.test(learn.text[k]), k);
});

test('kayit: egitim ilerlemesi AYRI alanda; yeniden acilinca korunur; oyun kayitlari degismez', () => {
  const seed = JSON.stringify({ correct: 12, band: '6-8', sound: false, seen: true, games: { invent: { correct: 2, found: ['light'], saved: [{ layout: 'loop', slots: ['wire', 'led', 'wire'], sw: ['open', 'open', 'open'] }] }, 'number-hunt': { correct: 5 } } });
  const b = mem(seed);
  const s1 = createStorage(b);
  const before = JSON.stringify({ ...s1.get(), edu: undefined });
  s1.updateEdu(['circuit-1']);
  assert.deepEqual(s1.getEdu().done, ['circuit-1']);
  assert.equal(JSON.stringify({ ...s1.get(), edu: undefined }), before, 'oyun/ayar alanlari ayni');
  const s2 = createStorage(b); // uygulama yeniden acildi
  assert.deepEqual(s2.getEdu().done, ['circuit-1']);
  assert.equal(s2.get().correct, 12);
  assert.equal(s2.getGame('invent').saved.length, 1);
  assert.equal(s2.getGame('number-hunt').correct, 5);
  // diger guncellemeler egitim alanini silmez
  s2.update({ sound: true });
  s2.updateGame('invent', { correct: 3 });
  assert.deepEqual(s2.getEdu().done, ['circuit-1']);
});

test('kayit: egitim kaydi hic yoksa V6 ile ayni bicim (edu alani yazilmaz)', () => {
  const b = mem();
  const s = createStorage(b);
  s.update({ sound: false });
  assert.ok(!('edu' in JSON.parse(b.raw())));
});

test('bozuk/eski kayit uygulamayi cokertmez', () => {
  for (const raw of ['{', 'null', '[]', '"x"', JSON.stringify({ edu: 5 }), JSON.stringify({ edu: { done: 'circuit-1' } }), JSON.stringify({ edu: { done: [1, null, {}, '../x', 'a'.repeat(50)] } }), JSON.stringify({ edu: null, correct: 3 })]) {
    const s = createStorage(mem(raw));
    assert.deepEqual(s.getEdu().done, []);
    assert.deepEqual(lessonStatus(cur, s.getEdu().done)['circuit-1'], 'open');
  }
  const s = createStorage(mem(JSON.stringify({ edu: { done: ['circuit-1', 'gelecek-ders', 7] }, correct: 4 })));
  assert.deepEqual(s.getEdu().done, ['circuit-1', 'gelecek-ders']); // bilinmeyen kimlik saklanir (gelecek surum silinmez)
  assert.equal(progressCount(cur, s.getEdu().done).done, 1); // ama sayilmaz / kilit acmaz
  assert.equal(s.get().correct, 4);
});

test('kayit yazimi basarisiz olsa da oturum surer (cokme yok)', () => {
  const b = { getItem: () => null, setItem() { throw new Error('dolu'); } };
  const s = createStorage(b);
  assert.doesNotThrow(() => s.updateEdu(['circuit-1']));
  assert.equal(s.saveOk(), false);
  assert.deepEqual(s.getEdu().done, ['circuit-1']);
});

test('ses kapaliyken ders tamamlanabilir: gorev/soru mantigi konusmaya bagli degil, metinler yazili', () => {
  const src = readFileSync(join(ROOT, 'src/games/learn/game.js'), 'utf8');
  assert.ok(!/sayThen|onEnd|await .*voice/.test(src), 'hicbir adim konusmanin bitmesini beklemez');
  // tum adimlarin metni (altyazi) mevcut: ses kapaliyken de okunur
  for (const l of learn.lessons) for (const s of l.steps) assert.ok(typeof s.say === 'string' && s.say.length > 3);
  // simule edilmis tam gecis: yalniz mantik cagrilariyla (ses yok) uc ders de tamamlanir
  let done = [];
  for (const id of cur.order) {
    const l = cur.levels.flatMap((x) => x.lessons).find((x) => x.id === id);
    assert.ok(isUnlocked(cur, done, id));
    for (const s of l.steps.filter((x) => x.type === 'task')) {
      const SOL = { 'series-1': ['led', 'led', 'wire'], 'parallel-1': ['wire', 'led', 'wire', 'wire', 'wire', 'led'], 'usta-1': ['led', 'resistor', 'switch'], 'kasif-1': ['wire', 'led', 'wire'], 'mucit-1': ['wire', 'wire', 'wire', 'led', 'switch', 'led'] };
      const slots = SOL[id] || s.board.slots.map((t, i) => t ?? ['wire', 'led', (s.goal.with.includes('resistor') ? 'resistor' : s.goal.with.includes('switch') ? 'switch' : 'wire')][i]);
      const states = Object.fromEntries(slots.map((t, i) => [`s${i + 1}`, t === 'switch' ? 'closed' : undefined]).filter(([, v]) => v));
      assert.equal(taskResult(inv, s.goal, slots, states, s.board.layout).ok, true, `${id} gorevi cozulebilir`);
    }
    done = completeLesson(cur, done, id);
  }
  assert.deepEqual(done, cur.order);
});

test('mevcut oyunlar korunur: oyun listesi aynen, egitim ayri; V4 koruma ozetleri degismedi', () => {
  assert.deepEqual(games.map((g) => g.id), ['shape-complete', 'number-hunt', 'invent']);
  assert.equal(education.id, 'learn');
  assert.equal(typeof education.create, 'function');
  const guard = JSON.parse(readFileSync(join(ROOT, 'tests/v4-guard.json'), 'utf8'));
  for (const [f, h] of Object.entries(guard)) assert.equal(createHash('sha256').update(readFileSync(join(ROOT, f))).digest('hex'), h, f);
  // Mucit Atolyesi mantigi ve benzetim dosyasi V6 ile ayni kaldi (yeniden kullanilir, kopyalanmaz)
  const sim = readFileSync(join(ROOT, 'src/games/shape-complete/circuit-sim.js'), 'utf8');
  assert.ok(!/learn/.test(sim));
});
