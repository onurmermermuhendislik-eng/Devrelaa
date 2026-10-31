// Egitim Bolumu saf mantigi (DOM yok). Devre benzetimi ve cozumleme Mucit Atolyesi ile AYNI (games/invent/logic.js -> simulate);
// burada ikinci bir benzetim motoru YOKTUR. Yalnizca mufredat, kilit kurallari ve gorev kontrolu vardir.
import { buildParts, analyze, hintFor } from '../invent/logic.js';

const ID = /^[\w-]{1,40}$/;

// Mufredat: seviyeler levels.json sirasindadir; dersler learn.json'dan seviyeye atanir. Gecersiz veri atilir (uygulama cokmez).
export function buildCurriculum(learn, levels) {
  const byLevel = new Map(levels.map((l) => [l.id, []]));
  const seen = new Set();
  for (const ls of learn?.lessons || []) {
    if (!ls || !ID.test(ls.id) || seen.has(ls.id) || !byLevel.has(ls.level) || !Array.isArray(ls.steps) || !ls.steps.length) continue;
    seen.add(ls.id);
    byLevel.get(ls.level).push(ls);
  }
  const out = levels.map((l) => ({ id: l.id, emoji: l.emoji, name: l.name, lessons: byLevel.get(l.id) }));
  return { levels: out, order: out.flatMap((l) => l.lessons.map((x) => x.id)) };
}

const cleanDone = (done, cur) => new Set((Array.isArray(done) ? done : []).filter((x) => typeof x === 'string' && cur.order.includes(x)));

// Her ders: 'done' | 'open' | 'locked'. Ders ancak kendisinden ONCEKI tum dersler bitmisse acilir (sirali).
export function lessonStatus(cur, done) {
  const d = cleanDone(done, cur);
  const st = {};
  let allBefore = true;
  for (const id of cur.order) {
    st[id] = d.has(id) ? 'done' : allBefore ? 'open' : 'locked';
    if (!d.has(id)) allBefore = false;
  }
  return st;
}

// Seviye: 'soon' (dersi yok) | 'done' | 'open' | 'locked'
export function levelStatus(cur, done) {
  const st = lessonStatus(cur, done);
  return Object.fromEntries(
    cur.levels.map((l) => {
      if (!l.lessons.length) return [l.id, 'soon'];
      const s = l.lessons.map((x) => st[x.id]);
      if (s.every((x) => x === 'done')) return [l.id, 'done'];
      if (s.every((x) => x === 'locked')) return [l.id, 'locked'];
      return [l.id, 'open'];
    })
  );
}

export const isUnlocked = (cur, done, id) => ['open', 'done'].includes(lessonStatus(cur, done)[id]);

// Dersi tamamla: yalniz bilinen ve ACIK dersler kaydedilir; kilitli/bilinmeyen kimlik listeyi DEGISTIRMEZ. Yeni sirali liste doner.
export function completeLesson(cur, done, id) {
  const d = [...cleanDone(done, cur)];
  if (!cur.order.includes(id) || lessonStatus(cur, d)[id] === 'locked') return d.sort((a, b) => cur.order.indexOf(a) - cur.order.indexOf(b));
  if (!d.includes(id)) d.push(id);
  return d.sort((a, b) => cur.order.indexOf(a) - cur.order.indexOf(b));
}

export const nextLessonId = (cur, id) => {
  const i = cur.order.indexOf(id);
  return i >= 0 && i + 1 < cur.order.length ? cur.order[i + 1] : null;
};

// ---- Devre tahtasi (Mucit Atolyesi mantigi) ----
// board: { layout, slots:[tip|null], closed:[slotId] }; states: { slotId: 'open'|'closed' } (anahtarlar)
export function boardParts(inv, board, states = {}) {
  const L = inv.layouts[board.layout];
  return { L, parts: buildParts(L, board.slots, states) };
}

export function startStates(board) {
  return Object.fromEntries((board.closed || []).map((id) => [id, 'closed']));
}

// Gorev kosulu: devre yanmali (LED yanar, kisa devre degil) ve istenen parcalar tahtada olmali
export function taskResult(inv, goal, slots, states, layoutId = 'loop') {
  const { parts } = boardParts(inv, { layout: layoutId, slots }, states);
  const a = analyze(parts);
  const have = (t) => slots.includes(t);
  const withOk = (goal.with || []).every(have);
  const litOk = !goal.lit || (a.lit > 0 && !a.short);
  // V7.2: seri (>=2 LED ayni yolda yanar) ve paralel (iki ayri kolda farkli LED'ler yanar) hedefleri; analyze() sonucundan okunur
  const seriesOk = !goal.series || a.seriesLit;
  const parallelOk = !goal.parallel || a.parallelLit;
  const ok = litOk && withOk && seriesOk && parallelOk;
  let key = null;
  if (!ok) {
    key = hintFor(a).key;
    if (key === 'lit') key = null;
    // V7.5: eksik parca adiyla ipucu (once anahtar, direnc, kablo; en son LED). Eskiden kablo eksikse "LED ekleyelim mi?" denirdi.
    if (litOk && !withOk) {
      const need = (t) => (goal.with || []).includes(t) && !have(t);
      key = need('switch') ? 'needswitch' : need('resistor') ? 'resistor' : need('wire') ? 'needwire' : 'noled';
    } else if (litOk && withOk && !seriesOk) key = 'needseries';
    else if (litOk && withOk && !parallelOk) key = 'needparallel';
  }
  return { ok, key, analysis: a };
}

// Bos/hatali kayit icin guvenli ders durumu
export const progressCount = (cur, done) => {
  const d = cleanDone(done, cur);
  return { done: d.size, total: cur.order.length };
};

// ---- V7.5 ----
// Gorev ipucu metni: once adimin kendi `hints[anahtar]` metni (gorev/parcaya ozel), yoksa genel `text[anahtar]`. Anahtar yoksa ''.
export function hintText(step, T, key) {
  if (!key) return '';
  const own = step && step.hints && typeof step.hints[key] === 'string' ? step.hints[key] : '';
  if (own) return own;
  return T && typeof T[key] === 'string' ? T[key] : '';
}

// Parca karti: adimdaki `meet` kimligini parca sozlugunde (learn.json > parts) bulur. Gecersizse null (kart cizilmez, uygulama cokmez).
export function meetOf(parts, step) {
  const m = step && typeof step.meet === 'string' ? parts?.[step.meet] : null;
  if (!m || typeof m.name !== 'string' || typeof m.job !== 'string') return null;
  return { id: step.meet, icon: m.icon || '', name: m.name, job: m.job, like: m.like || '', try: m.try || '', spoken: `${m.name}. ${m.job} ${step.type === 'task' ? m.try || m.like || '' : m.like || ''}`.trim() };
}

// Ders bitis odulu (saf): rozet YENI mi, asama bitti mi, kac rozet var. Kayit `completeLesson` ile AYNI kural (yalniz acik/bilinen ders eklenir);
// rozetler ayri kayit tutmaz: tamamlanan ders = rozet (Egitim Merkezi ile ayni kaynak: edu.done).
export function lessonReward(cur, doneBefore, id) {
  const level = cur.levels.find((l) => l.lessons.some((x) => x.id === id));
  const lesson = level && level.lessons.find((x) => x.id === id);
  if (!lesson) return null;
  const before = cleanDone(doneBefore, cur);
  const done = completeLesson(cur, doneBefore, id);
  const after = new Set(done);
  const earned = after.has(id);
  const firstTime = earned && !before.has(id);
  const levelAfter = level.lessons.every((x) => after.has(x.id));
  const levelBefore = level.lessons.every((x) => before.has(x.id));
  return {
    earned,
    firstTime,
    done,
    badge: { id, icon: lesson.icon, title: lesson.title },
    count: done.length,
    total: cur.order.length,
    levelId: level.id,
    levelName: level.name,
    levelEmoji: level.emoji,
    levelJustDone: firstTime && levelAfter && !levelBefore,
    allDone: firstTime && done.length === cur.order.length,
    learned: typeof lesson.learned === 'string' ? lesson.learned : ''
  };
}

// Tek seferlik koruma: ayni ders calismasi (run) icinde ayni olay (basari sesi, odul, ayni yanlis dokunus) yalniz BIR kez isler.
// start(): yeni ders/liste gecisi; bekleyen zamanlayicilar `isCurrent` ile gecersiz sayilir.
export function createRun() {
  let seq = 0;
  const claimed = new Set();
  return {
    start() {
      seq += 1;
      claimed.clear();
      return seq;
    },
    get id() {
      return seq;
    },
    isCurrent: (n) => n === seq,
    claim(tag) {
      const k = `${seq}:${tag}`;
      if (claimed.has(k)) return false;
      claimed.add(k);
      return true;
    }
  };
}

// ---- V7.6 ----
// Siradaki ders karti: mevcut edu.done'dan turetilir (YENI kayit alani yok). kind: 'next' (ilk acik ders) | 'replay' (hepsi bitti; ilk ders onerilir) | 'none'.
// count/total genel ilerleme (ornek 3 / 8); yalniz bilinen ders kimlikleri sayilir (bozuk kayit sayiyi sisirmez).
export function nextAction(cur, done) {
  const st = lessonStatus(cur, done);
  const total = cur.order.length;
  const count = cur.order.filter((id) => st[id] === 'done').length;
  const nextId = cur.order.find((id) => st[id] === 'open') || null;
  if (nextId) return { kind: 'next', lessonId: nextId, count, total };
  if (total && count === total) return { kind: 'replay', lessonId: cur.order[0], count, total };
  return { kind: 'none', lessonId: null, count, total };
}
