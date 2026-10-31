// V7.7 Gorevler ortak cekirdegi (saf, DOM yok): yas bandina gore gorev suzme, gorev durumu, ilerleme, siradaki gorev,
// tek seferlik koruma. Egitim (learn) modulunden BAGIMSIZDIR; Egitim'in edu.done alanina dokunmaz.
// Gorev kaydi: games.<oyun>.done (storage.completeTask) - odul yalniz ilk basarili cozumde.
const ID = /^[\w-]{1,30}$/;

// Gecerli gorevler (bozuk veri atilir, uygulama cokmez) ve yas bandina gore suzme
export const validTasks = (cfg) => {
  const seen = new Set();
  return (cfg?.tasks || []).filter((t) => {
    const ok = t && typeof t.id === 'string' && ID.test(t.id) && !seen.has(t.id) && typeof t.kind === 'string' && Array.isArray(t.bands) && t.bands.length;
    if (ok) seen.add(t.id);
    return ok;
  });
};
export const tasksFor = (cfg, band) => validTasks(cfg).filter((t) => t.bands.includes(band));

const cleanDone = (done) => new Set((Array.isArray(done) ? done : []).filter((x) => typeof x === 'string'));

export function taskStatus(tasks, done) {
  const d = cleanDone(done);
  return Object.fromEntries(tasks.map((t) => [t.id, d.has(t.id) ? 'done' : 'open']));
}

// Genel ilerleme: yalniz bu yas grubunda gorunen gorevler sayilir (bilinmeyen/bozuk kimlikler sayiyi sisirmez)
export function progressOf(tasks, done) {
  const st = taskStatus(tasks, done);
  return { done: tasks.filter((t) => st[t.id] === 'done').length, total: tasks.length };
}

// Siradaki gorev: ilk tamamlanmamis gorev; hepsi bitmisse 'replay' (ilk gorev); gorev yoksa 'none'
export function nextTask(tasks, done, afterId = null) {
  const st = taskStatus(tasks, done);
  const open = tasks.filter((t) => st[t.id] === 'open');
  if (open.length) {
    const i = afterId ? tasks.findIndex((t) => t.id === afterId) : -1;
    const later = open.find((t) => tasks.indexOf(t) > i);
    return { kind: 'next', task: later || open[0] };
  }
  return tasks.length ? { kind: 'replay', task: tasks[0] } : { kind: 'none', task: null };
}

// Gorev bitis odulu (saf): kayit storage.completeTask'ten gelen firstTime ile. Rozet = cozulen gorev (ayri kayit yok).
export function taskReward(tasks, doneAfter, task, firstTime) {
  const p = progressOf(tasks, doneAfter);
  return { firstTime: !!firstTime, badge: { id: task.id, icon: task.icon || '⭐', title: task.title }, count: p.done, total: p.total, allDone: !!firstTime && p.total > 0 && p.done === p.total };
}

// 4-5 yas: en fazla uc secenek (kurallari veriden dogrular; test ve calisma zamani korumasi)
export const MAX_OPTIONS_4_5 = 3;
export const optionCount = (t) => (Array.isArray(t.options) ? t.options.length : Array.isArray(t.tools) ? t.tools.length : Array.isArray(t.items) ? t.items.length : 0);

// Tek seferlik koruma: ayni gorev calismasi (run) icinde ayni olay (cozum odulu, basari sesi) yalniz BIR kez isler.
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
