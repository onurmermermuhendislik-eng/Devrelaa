// V7.7 Gorevler ortak kabugu: gorev listesi -> gorev -> bitis. Iki oyun (Elektrik Dedektifi, Mantik ve Bilim) bu kabugu kullanir;
// her oyun yalniz gorev ekranini (makeView) cizer. Ilerleme: storage.completeTask (games.<id>.done), odul yalniz ilk cozumde.
// Ses/konusma yalniz ctx.audio / ctx.voice ile (sessiz modda ikisi de sessizdir). Egitim (learn) ve edu.done'a DOKUNMAZ.
import { SOUND_MS } from '../../core/audio.js';
import { tasksFor, progressOf, taskStatus, nextTask, taskReward, createRun } from '../../core/taskkit.js';

const NAV_GUARD_MS = 350;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createTaskGame(ctx, spec) {
  const { data, storage, audio, voice, rng, exit, registerBack, mascot } = ctx;
  const { gameId, cfg, makeView } = spec;
  const T = cfg.text;
  const band = () => storage.get().band;
  const list = () => tasksFor(cfg, band());
  const doneIds = () => storage.getTasks(gameId).done;

  let root = null;
  let dead = false;
  let unregBack = null;
  const timers = new Set();
  const el = {};
  const run = createRun();
  let screen = 'list'; // 'list' | 'task' | 'done'
  let task = null;
  let view = null;
  let solved = false;
  let res = null; // { firstTime } storage.completeTask sonucu
  let wrongCount = 0;
  let lastWrong = null;
  let lastHint = '';
  let soundEnd = 0; // V7.8: basari sesinin bitecegi an (kutlama sesi ustune binmesin)
  let doneSpoken = '';
  let msg = '';
  let navAt = 0; // son ekran gecisi: hizli cift dokunus ikinci tiklamasi yeni ekrandaki ogeye (tahta/dugme) dusmesin
  const navOk = () => Date.now() - navAt > NAV_GUARD_MS;

  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) fn();
    }, ms);
    timers.add(t);
    return t;
  };
  const setCap = (text) => {
    msg = text || '';
    if (el.cap) el.cap.textContent = msg;
  };
  const say = (key, text) => {
    setCap(text);
    if (text) voice.say(key, undefined, text); // sessiz modda voice.say konusmaz
  };

  function mount(container) {
    root = container;
    mascot?.setExplicit(true); // V7.8: maskot gorev olaylarini dogrudan buradan alir (ses dinlemesi kapali: cift tepki olmaz)
    root.innerHTML = `
      <section class="play inv learn tk ${esc(spec.cls || '')}" data-band="${band()}" data-game="${esc(gameId)}">
        <header class="bar">
          <button class="btn icon" data-act="back" aria-label="Geri"><span aria-hidden="true">←</span></button>
          <div class="level tk-title" aria-hidden="true"></div>
          <button class="btn icon" data-act="speak" aria-label="Tekrar dinle"><span aria-hidden="true">🔊</span></button>
        </header>
        <main class="stage learn-stage tk-stage"></main>
      </section>`;
    el.back = root.querySelector('[data-act="back"]');
    el.title = root.querySelector('.tk-title');
    el.stage = root.querySelector('.tk-stage');
    root.addEventListener('click', onClick);
    root.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
    // Fiziksel Geri: gorev/bitis aciksa listeye doner (true); listedeyse ust katman (hub) karar verir (false)
    unregBack = registerBack ? registerBack(() => (screen !== 'list' ? (toList(), true) : false)) : null;
    toList();
  }

  function unmount() {
    dead = true;
    mascot?.setExplicit(false);
    timers.forEach(clearTimeout);
    timers.clear();
    voice.stop();
    view?.destroy?.();
    view = null;
    if (root) {
      root.removeEventListener('click', onClick);
      root.innerHTML = '';
    }
    unregBack?.();
    unregBack = null;
  }

  function setHeader() {
    const inTask = screen !== 'list';
    el.back.dataset.act = inTask ? 'close' : 'back';
    el.back.setAttribute('aria-label', inTask ? T.closeTask || 'Kapat' : 'Görevler');
    el.back.firstElementChild.textContent = inTask ? '✖' : '←';
    el.title.textContent = `${cfg.icon || ''} ${T.title}`;
  }

  // ---- Liste ---------------------------------------------------------------------------------------
  function toList() {
    run.start(); // bekleyen zamanlayici/odul bu calisma icin gecersiz olur
    navAt = Date.now();
    view?.destroy?.();
    view = null;
    screen = 'list';
    task = null;
    solved = false;
    res = null;
    voice.stop();
    const tasks = list();
    const done = doneIds();
    const st = taskStatus(tasks, done);
    const p = progressOf(tasks, done);
    const na = nextTask(tasks, done);
    const card = na.task
      ? `<div class="learn-nextcard tk-nextcard nc-${na.kind}" data-kind="${na.kind}" data-target="${esc(na.task.id)}">
          <span class="nc-icon" aria-hidden="true">${na.task.icon || '⭐'}</span>
          <span class="nc-text"><i>${esc(na.kind === 'next' ? T.nextUp : T.allDoneCard)}</i><b>${esc(na.task.title)}</b></span>
          <button class="btn start nc-go" data-act="opennext" data-target="${esc(na.task.id)}" aria-label="${esc((na.kind === 'next' ? T.nextUp : T.replayLabel) + '. ' + na.task.title)}"><span aria-hidden="true">${na.kind === 'next' ? '▶' : '↻'}</span> ${esc(na.kind === 'next' ? T.start : T.replayStart)}</button>
        </div>`
      : '';
    const overall = `<p class="learn-overall tk-overall" data-count="${p.done}" data-total="${p.total}" aria-label="${esc(T.overall)}: ${p.done} / ${p.total} ${esc(T.tasksWord)}"><span class="lo-bar" aria-hidden="true"><span class="lo-fill" style="width:${p.total ? Math.round((p.done / p.total) * 100) : 0}%"></span></span><b>${p.done} / ${p.total} ${esc(T.tasksWord)}</b></p>`;
    const rows = tasks
      .map((t) => {
        const d = st[t.id] === 'done';
        return `<button class="learn-lesson tk-task st-${st[t.id]}" data-act="open" data-task="${esc(t.id)}" aria-label="${esc(t.title + '. ' + (d ? T.doneLabel + '. ' + T.replayLabel : ''))}">
          <span class="ll-icon tt-icon" aria-hidden="true">${t.icon || '⭐'}</span>
          <span class="ll-text tt-text"><b>${esc(t.title)}</b>${d ? `<em class="ll-replay tt-replay" aria-hidden="true">↻ ${esc(T.replayLabel)}</em>` : ''}</span>
          <span class="ll-state tt-state" aria-hidden="true">${d ? '✔' : '▶'}</span></button>`;
      })
      .join('');
    el.stage.innerHTML = `
      <div class="learn-map tk-list">
        <p class="cap learn-cap tk-cap" aria-live="polite">${esc(T.intro)}</p>
        ${spec.extras?.listTop?.({ tasks, done, st }) || ''}
        ${card}${overall}
        ${rows}
      </div>`;
    el.cap = el.stage.querySelector('.tk-cap');
    msg = T.intro;
    setHeader();
    spec.extras?.onList?.(el.stage); // V7.9: Enerji Macerasi yol arkadasi (maskot) alani
  }

  // ---- Gorev ---------------------------------------------------------------------------------------
  function openTask(id) {
    const t = list().find((x) => x.id === id);
    if (!t) return;
    run.start();
    navAt = Date.now();
    task = t;
    screen = 'task';
    solved = false;
    res = null;
    wrongCount = 0;
    lastWrong = null;
    lastHint = '';
    soundEnd = 0;
    audio.play('tap');
    spec.extras?.onLeaveList?.();
    el.stage.innerHTML = `
      <div class="prompt tk-prompt kind-${esc(t.kind)}" data-lit="0"></div>
      <p class="cap tk-cap" aria-live="polite"></p>
      <div class="learn-ctl tk-ctl"></div>`;
    el.prompt = el.stage.querySelector('.tk-prompt');
    el.cap = el.stage.querySelector('.tk-cap');
    el.ctl = el.stage.querySelector('.tk-ctl');
    setHeader();
    const env = {
      data,
      band: band(),
      rng,
      cfg,
      T,
      prompt: el.prompt,
      ctl: el.ctl,
      audio,
      later,
      sfx: (n) => audio.play(n),
      say,
      setCap,
      wrong,
      progress: () => {
        lastWrong = null;
        lastHint = '';
      },
      solved: onSolved,
      isSolved: () => solved
    };
    view = makeView(t, env);
    view.start();
    say(`tk_${t.id}`, t.story || t.say || '');
  }

  // Yanlis cevap/baglanti: kademeli ipucu. 1. yanlis: secenege ozel metin; 2.: guclu ipucu (hint2); 3.+: gorsel yardim (view.assist).
  // Ayni referansa art arda dokunus ek ses/konusma uretmez (V7.5 ile ayni yaklasim).
  function wrong(ref, text, hint2) {
    if (solved || screen !== 'task') return;
    if (ref === lastWrong) {
      // V7.8: ayni yanlisa tekrar dokunus: sayac ARTMAZ, ek ses yok; ipucu kaybolmasin diye yeniden gosterilir
      if (lastHint) setCap(lastHint);
      return;
    }
    lastWrong = ref;
    wrongCount += 1;
    audio.play('gentle'); // cezalandirici ses yok: nazik tekrar
    const out = wrongCount >= 2 && hint2 ? hint2 : text || hint2 || T.tryAgain || '';
    lastHint = out;
    say('tk_hint', out);
    if (wrongCount >= 3) {
      view?.assist?.();
      mascot?.react('hint');
    } else if (wrongCount === 2) mascot?.react('hint');
    else mascot?.react('wrong');
  }

  function onSolved(opts = {}) {
    if (solved || screen !== 'task') return;
    if (!run.claim('solved')) return; // cift dokunus / ikinci cozum bildirimi: tek odul, tek ses
    solved = true;
    res = storage.completeTask(gameId, task.id); // ATOMIK: gorev zaten kayitliysa firstTime=false, kayit degismez
    const rid = run.id;
    const tk = task;
    const first = opts.sound || 'correct';
    audio.play(first);
    // V7.8: sesler ust uste binmez: basari sesi, ilk sesin suresi bittikten sonra baslar
    const gap = (SOUND_MS[first] || SOUND_MS.correct) + 40;
    soundEnd = Date.now() + gap + SOUND_MS.success;
    later(() => run.isCurrent(rid) && task === tk && audio.play('success'), gap);
    say('tk_ok', opts.text || T.solved);
    mascot?.react('correct');
    el.ctl.innerHTML = `<button class="btn start learn-next tk-next" data-act="finish" aria-label="${esc(T.next)}"><span aria-hidden="true">▶</span> ${esc(T.next)}</button>`;
  }

  // ---- Bitis ---------------------------------------------------------------------------------------
  function finish() {
    if (screen !== 'task' || !solved || !task) return;
    screen = 'done';
    navAt = Date.now();
    setHeader();
    const tasks = list();
    const doneNow = doneIds();
    const saveFailed = res?.saved === false;
    const R = taskReward(tasks, doneNow, task, !!res?.firstTime);
    const na = nextTask(tasks, doneNow, task.id);
    const canNext = na.kind === 'next' && na.task.id !== task.id;
    const reward = saveFailed
      ? `<div class="learn-reward tk-reward lr-have tk-savefail" data-new="0" data-savefail="1" role="group" aria-label="${esc(T.saveFailTitle || '')}">
        <span class="lr-badge" aria-hidden="true">⚠️</span>
        <span class="lr-text"><b>${esc(T.saveFailTitle || 'Kayıt yazılamadı')}</b><i>${esc(T.saveFail || '')}</i></span></div>`
      : `<div class="learn-reward tk-reward ${R.firstTime ? 'lr-new' : 'lr-have'}" data-new="${R.firstTime ? 1 : 0}" data-badge="${esc(R.badge.id)}" role="group" aria-label="${esc(T.badgeNew)}">
        <span class="lr-badge" aria-hidden="true">${R.badge.icon}</span>
        <span class="lr-text"><b>${esc(R.firstTime ? T.badgeNew : T.badgeHave)}</b><i>${esc(R.badge.title)}</i></span></div>
      ${R.firstTime || saveFailed ? '' : `<p class="learn-replaynote tk-replaynote" data-replay="1">↻ ${esc(T.replayNote)}</p>`}
      ${task.learn ? `<p class="learn-learned tk-learned">${esc(task.learn)}</p>` : ''}
      ${saveFailed ? '' : `<p class="learn-meter tk-meter" data-count="${R.count}" data-total="${R.total}" aria-label="${R.count} / ${R.total} ${esc(T.badgeWord)}">${Array.from({ length: R.total }, (_, i) => `<span class="lmd${i < R.count ? ' on' : ''}" aria-hidden="true"></span>`).join('')}<span class="lm-n">${R.count} / ${R.total} ${esc(T.badgeWord)}</span></p>`}
      ${R.allDone && !saveFailed ? `<p class="learn-levelup learn-alldone tk-alldone">🏆 ${esc(T.allDone)}</p>` : ''}`;
    const extraDone = saveFailed ? '' : spec.extras?.done?.({ task, firstTime: !!res?.firstTime, saved: res?.saved }) || '';
    el.stage.innerHTML = `
      <div class="prompt learn-done tk-done"><div class="ld-in"><div class="ld-a"><div class="learn-trophy tk-trophy" aria-hidden="true">${saveFailed ? '✅' : R.firstTime ? '⭐' : '✅'}</div><p class="learn-q tk-q">${esc(T.solvedTitle)}</p><p class="learn-sub tk-sub">${esc(task.title)}</p></div><div class="ld-b">${reward}${extraDone}</div></div></div>
      <p class="cap tk-cap" aria-live="polite"></p>
      <div class="learn-ctl tk-ctl">
        ${canNext ? `<button class="btn start learn-next tk-next" data-act="opennext" data-target="${esc(na.task.id)}" aria-label="${esc(T.nextTask)}"><span aria-hidden="true">▶</span> ${esc(T.nextTask)}</button>` : ''}
        <button class="btn chip" data-act="list" aria-label="${esc(T.toList)}">${esc(T.toList)}</button>
      </div>`;
    el.cap = el.stage.querySelector('.tk-cap');
    const spoken = [T.solvedTitle, saveFailed ? T.saveFail || '' : R.firstTime ? T.badgeNew : T.replayNote];
    if (R.allDone && !saveFailed) spoken.push(T.allDone);
    doneSpoken = spoken.join(' ');
    setCap(T.solvedTitle);
    if (R.firstTime && !saveFailed) {
      // kutlama sesi yalniz ilk (ve gercekten kaydedilen) cozumde; basari sesi bitmediyse bitisine kadar beklenir
      const rid = run.id;
      const tk = task;
      later(() => run.isCurrent(rid) && task === tk && audio.play('levelUp'), Math.max(0, soundEnd - Date.now()));
    }
    voice.say('tk_done', undefined, doneSpoken);
    if (!saveFailed) mascot?.react('done');
    mascot?.refresh?.(); // gorunen onceki tepki (bekleme suresi yuzunden 'done' atlandiysa) yeni ekrandaki dugmelere binmesin
  }

  // ---- Olaylar -------------------------------------------------------------------------------------
  function onClick(e) {
    const act = e.target.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'back') return exit();
      if (a === 'speak') return voice.say('tk_repeat', undefined, (screen === 'done' && doneSpoken) || msg || T.intro);
      if (!navOk()) return;
      if (a === 'close' || a === 'list') return toList();
      if (a === 'open') return screen === 'list' ? openTask(act.dataset.task) : undefined;
      if (a === 'opennext') return screen === 'list' || screen === 'done' ? openTask(act.dataset.target) : undefined;
      if (a === 'finish') return finish();
    }
    if (screen === 'task' && view && navOk()) view.onClick?.(e);
  }

  return { mount, unmount };
}
