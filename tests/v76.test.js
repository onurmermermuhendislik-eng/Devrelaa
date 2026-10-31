// V7.6: surum tutarliligi + Egitim "Siradaki ders" karti, genel ilerleme, "Tekrar oyna", tekrarda odul yok, release.sh SMOKE_SCRIPT aktarimi
// (YALNIZ degisen kod icin hedefli testler; V7.4/V7.5 testleri aynen kalir)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { buildCurriculum, lessonStatus, completeLesson, lessonReward, nextAction, progressCount } from '../src/games/learn/logic.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const learn = data.game.learn;
const cur = buildCurriculum(learn, data.levels);
const ORDER = ['circuit-1', 'switch-1', 'resistor-1', 'series-1', 'parallel-1', 'usta-1', 'kasif-1', 'mucit-1'];
const mem = (init) => {
  const m = new Map(init ? [['altez-minilab:v1', init]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
};

// (V7.6 surum-tutarlilik testi V7.7'de tests/v77.test.js icine tasindi: surum numaralari yeni surumle degisir.)

test('V7.6 nextAction: bos kayit -> ilk ders; kismi -> ilk ACIK ders; hepsi bitik -> tekrar onerisi', () => {
  assert.deepEqual(nextAction(cur, []), { kind: 'next', lessonId: 'circuit-1', count: 0, total: 8 });
  assert.deepEqual(nextAction(cur, ['circuit-1', 'switch-1', 'resistor-1']), { kind: 'next', lessonId: 'series-1', count: 3, total: 8 });
  assert.deepEqual(nextAction(cur, ORDER), { kind: 'replay', lessonId: 'circuit-1', count: 8, total: 8 });
  // her ilerleme durumunda onerilen ders ACIK ve sirali (kilitli ders onerilmez)
  let done = [];
  for (const id of ORDER) {
    const a = nextAction(cur, done);
    assert.equal(a.kind, 'next');
    assert.equal(a.lessonId, id);
    assert.equal(lessonStatus(cur, done)[a.lessonId], 'open');
    done = completeLesson(cur, done, id);
  }
});

test('V7.6 nextAction: bozuk/bilinmeyen/tekrarli kimlikler ilerlemeyi sisirmez; sira atlanmis kayit kilit kuralina uyar', () => {
  assert.equal(nextAction(cur, ['yok', 'circuit-1', 'circuit-1', 5, null]).count, 1);
  assert.equal(nextAction(cur, undefined).lessonId, 'circuit-1');
  assert.equal(nextAction(cur, 'bozuk').count, 0);
  // yalniz 3. ders kayitli (1-2 yok): ders 3 'done' sayilir ama oneri yine ilk ACIK ders (circuit-1)
  const a = nextAction(cur, ['resistor-1']);
  assert.equal(a.lessonId, 'circuit-1');
  assert.equal(a.count, 1);
  assert.equal(nextAction({ levels: [], order: [] }, []).kind, 'none');
  const p = progressCount(cur, ['circuit-1', 'switch-1']);
  const n = nextAction(cur, ['circuit-1', 'switch-1']);
  assert.equal(n.count, p.done);
  assert.equal(n.total, p.total);
});

test('V7.6 tekrar oynama: odul/rozet/asama kutlamasi YOK, edu.done AYNI kalir (mukerrer yok)', () => {
  for (const id of ORDER) {
    const R = lessonReward(cur, ORDER, id);
    assert.equal(R.earned, true, id);
    assert.equal(R.firstTime, false, id);
    assert.equal(R.levelJustDone, false, id);
    assert.equal(R.allDone, false, id);
    assert.deepEqual(R.done, ORDER, id);
    assert.equal(R.count, 8);
  }
  const part = ['circuit-1', 'switch-1'];
  const R = lessonReward(cur, part, 'circuit-1');
  assert.equal(R.firstTime, false);
  assert.equal(R.levelJustDone, false);
  assert.deepEqual(R.done, part);
  // ilk kez bitirme hala odul verir
  const F = lessonReward(cur, ['circuit-1'], 'switch-1');
  assert.equal(F.firstTime, true);
  assert.equal(F.levelJustDone, true);
});

test('V7.6 kayit: tekrar sonrasi yazilan edu.done degismez; eski (V7.4/V7.5) kayit aynen okunur; yeni alan yazilmaz', () => {
  const old = JSON.stringify({ correct: 12, band: '6-8', games: { 'number-hunt': { correct: 9 } }, edu: { done: ['circuit-1', 'switch-1', 'resistor-1'] } });
  const b = mem(old);
  let s = createStorage(b);
  const before = s.getEdu().done;
  for (let i = 0; i < 3; i++) s.updateEdu(lessonReward(cur, s.getEdu().done, 'circuit-1').done);
  s = createStorage(b);
  assert.deepEqual(s.getEdu().done, before);
  const raw = JSON.parse(b.getItem('altez-minilab:v1'));
  assert.deepEqual(Object.keys(raw.edu), ['done']);
  assert.equal(raw.correct, 12);
  assert.equal(raw.games['number-hunt'].correct, 9);
  const base = JSON.parse(JSON.stringify(createStorage(mem(old)).get()));
  assert.deepEqual(Object.keys(raw).sort(), Object.keys(base).sort(), 'tekrar sonrasi ust duzey anahtarlar bastaki okumayla ayni (yeni alan yok)');
});

test('V7.6 metinler: yeni anahtarlar var, kisa ve Turkce; eski anahtarlar korunur', () => {
  const T = learn.text;
  for (const k of ['nextUp', 'startNext', 'overallLabel', 'allDoneCard', 'replayLabel', 'replayNote', 'replayStart']) {
    assert.equal(typeof T[k], 'string', k);
    assert.ok(T[k].length >= 3 && T[k].length < 80, k);
  }
  for (const k of ['badgeHave', 'badgeNew', 'wellDone', 'nextLesson', 'toMap', 'intro', 'stageNow']) assert.equal(typeof T[k], 'string', k);
  assert.match(T.replayNote, /tekrar/);
  assert.deepEqual(cur.order, ORDER);
});

test('V7.6 kaynak: siradaki ders karti nextAction ile kurulur, eski data-lesson/data-act="open" secicileriyle CAKISMAZ; tekrar notu yalniz tekrarda; ses yalniz ctx.audio/voice', () => {
  const g = rd('src/games/learn/game.js');
  assert.match(g, /nextAction\(cur, done\(\)\)/);
  assert.match(g, /data-act="nextcard" data-target=/);
  assert.doesNotMatch(g, /nc-go" data-act="open"/);
  assert.match(g, /class="learn-nextcard/);
  assert.match(g, /class="learn-overall"/);
  assert.match(g, /ll-replay/);
  assert.match(g, /isNew \? '' : `<p class="learn-replaynote"/);
  assert.match(g, /if \(!run\.claim\('reward'\)\) return;/, 'V7.5 mukerrer odul korumasi duruyor');
  assert.match(g, /storage\.updateEdu\(R\.done\)/);
  assert.doesNotMatch(g, /new Audio|speechSynthesis|AudioContext/);
  assert.doesNotMatch(g, /localStorage/);
});

test('V7.6 CSS: kart/ilerleme/etiket tanimli, yatay kisa ekran kurali, dokunma hedefi >= 44px', () => {
  const c = rd('src/ui/styles.css');
  for (const sel of ['.learn-nextcard', '.learn-overall', '.ll-replay', '.learn-replaynote']) assert.ok(c.includes(sel), sel);
  assert.match(c, /\.learn-nextcard \.nc-go \{[^}]*min-height: 48px/);
  const tail = c.slice(c.indexOf('V7.6: Siradaki ders karti'));
  assert.match(tail, /orientation: landscape\) and \(max-height: 540px\)/);
  assert.match(tail, /\.learn \.learn-nextcard/);
});

test('V7.6 release.sh: SMOKE_SCRIPT her iki alt surece (kaynak + temiz dizin) acikca aktarilir; install-and-build.sh varsayilan TAM smoke', () => {
  const r = rd('scripts/release.sh');
  assert.equal((r.match(/SMOKE_SCRIPT="\$\{SMOKE_SCRIPT:-scripts\/ui-smoke\.mjs\}"/g) || []).length, 2);
  const ib = rd('install-and-build.sh');
  assert.match(ib, /SMK="\$\{SMOKE_SCRIPT:-scripts\/ui-smoke\.mjs\}"/);
  assert.match(ib, /HEDEFLI; tam scripts\/ui-smoke\.mjs bu calismada KOSULMADI/);
  assert.ok(rd('scripts/ui-v76.mjs').includes('V7.6 hedefli UI testi'));
});

test('V7.6 ozellik envanteri: learn ozelligi bu testi icerir', () => {
  const f = JSON.parse(rd('release/features.json'));
  const l = f.features.find((x) => x.id === 'learn');
  assert.ok(l.tests.includes('tests/v76.test.js'));
  assert.ok(l.tests.includes('tests/v75.test.js'));
});
