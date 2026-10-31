// Egitim Bolumu ekrani (V7): ders listesi -> ders adimlari (anlat / gorev / soru) -> tamamlandi.
// Devre cizimi ve benzetimi Mucit Atolyesi / Sekli Tamamla ile AYNI (boardSvg, analyze); o dosyalara dokunulmaz.
// Ses kapaliyken de her gorev tamamlanir: konusma yalnizca eslik eder, hicbir adim konusmanin bitmesini BEKLEMEZ.
import { boardSvg, tileSvg } from '../shape-complete/circuit-render.js';
import { analyze } from '../invent/logic.js';
import { buildCurriculum, lessonStatus, levelStatus, nextLessonId, boardParts, startStates, taskResult, hintText, meetOf, lessonReward, createRun, nextAction } from './logic.js';

const TOOL_NAME = { wire: 'Kablo', led: 'LED', resistor: 'Direnç', switch: 'Anahtar', erase: 'Sil' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createGame(ctx) {
  const { data, storage, audio, voice, exit, registerBack } = ctx;
  const T = data.game.learn.text;
  const inv = data.game.invent;
  const cur = buildCurriculum(data.game.learn, data.levels);
  const lessonById = Object.fromEntries(cur.levels.flatMap((l) => l.lessons.map((x) => [x.id, x])));

  let root = null;
  let dead = false;
  let unregBack = null;
  const timers = new Set();
  let screen = 'map'; // 'map' | 'lesson' | 'done'
  let lesson = null;
  let stepIdx = 0;
  let slots = [];
  let states = {};
  let tool = null;
  let stepDone = false;
  let hintSlots = new Set();
  let msg = '';
  let doneSpoken = ''; // bitis ekraninda okunan metin ("Tekrar dinle" bunu tekrarlar)
  const run = createRun(); // V7.5: ders calismasi basina tek seferlik koruma (basari sesi, odul, ayni yanlis dokunus)
  const el = {};

  const done = () => storage.getEdu().done;
  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) fn();
    }, ms);
    timers.add(t);
  };
  const say = (key, text) => {
    msg = text || '';
    if (el.cap) el.cap.textContent = msg;
    if (text) voice.say(key, undefined, text);
  };

  // ---- Iskelet ----------------------------------------------------------------------------
  function mount(container) {
    root = container;
    root.innerHTML = `
      <section class="play inv learn" data-band="${storage.get().band}">
        <header class="bar">
          <button class="btn icon" data-act="back" aria-label="Ana ekran"><span aria-hidden="true">🏠</span></button>
          <div class="level learn-dots" aria-hidden="true"></div>
          <button class="btn icon" data-act="speak" aria-label="Tekrar dinle"><span aria-hidden="true">🔊</span></button>
        </header>
        <main class="stage learn-stage"></main>
      </section>`;
    el.back = root.querySelector('[data-act="back"]');
    el.dots = root.querySelector('.learn-dots');
    el.stage = root.querySelector('.learn-stage');
    root.addEventListener('click', onClick);
    root.addEventListener('pointerdown', () => audio.unlock(), { passive: true });
    // Fiziksel Geri tusu: ders aciksa dersi kapatip listeye doner (true); listedeyse app.js ana ekrana doner (false).
    unregBack = registerBack ? registerBack(() => (screen !== 'map' ? (toMap(), true) : false)) : null;
    toMap();
  }

  function unmount() {
    dead = true;
    timers.forEach(clearTimeout);
    timers.clear();
    voice.stop();
    if (root) {
      root.removeEventListener('click', onClick);
      root.innerHTML = '';
    }
    unregBack?.();
    unregBack = null;
  }

  function setHeader() {
    const inLesson = screen !== 'map';
    el.back.dataset.act = inLesson ? 'close' : 'back';
    el.back.setAttribute('aria-label', inLesson ? 'Dersi kapat' : 'Ana ekran');
    el.back.firstElementChild.textContent = inLesson ? '✖' : '🏠';
    if (screen === 'lesson') {
      el.dots.innerHTML = lesson.steps.map((_, i) => `<span class="learn-dot${i < stepIdx ? ' on' : i === stepIdx ? ' cur' : ''}"></span>`).join('');
    } else el.dots.innerHTML = '';
  }

  // ---- Ders listesi --------------------------------------------------------------------------
  function toMap() {
    run.start(); // bekleyen basari sesi zamanlayicisi bu ders icin gecersiz olur
    screen = 'map';
    lesson = null;
    tool = null;
    voice.stop();
    const ls = lessonStatus(cur, done());
    const lv = levelStatus(cur, done());
    const badge = { done: '✔', open: '▶', locked: '🔒', soon: '⏳' };
    const nowLevel = cur.levels.find((l) => lv[l.id] === 'open') || null;
    // V7.4: asama yolu (6 asama, sirayla) + rozetler (tamamlanan dersler; ayri kayit yok, ders kaydindan turetilir)
    const path = `<ol class="learn-path" aria-label="Öğrenme yolu">${cur.levels
      .map((l) => {
        const s = lv[l.id];
        const n = l.lessons.filter((x) => ls[x.id] === 'done').length;
        const now = nowLevel && nowLevel.id === l.id;
        return `<li class="lp lp-${s}${now ? ' lp-now' : ''}" data-level="${l.id}" aria-label="${esc(l.name)}. ${n} / ${l.lessons.length} ${esc(T.lessonsOf)}${now ? '. ' + esc(T.stageNow) : ''}"><span class="lp-emoji" aria-hidden="true">${l.emoji}</span><span class="lp-name" aria-hidden="true">${esc(l.name)}</span></li>`;
      })
      .join('')}</ol>`;
    const allLessons = cur.levels.flatMap((l) => l.lessons);
    const badges = `<div class="learn-badges" role="group" aria-label="${esc(T.badgesTitle)}"><b>${esc(T.badgesTitle)}</b>${allLessons
      .map((x) => `<span class="lb ${ls[x.id] === 'done' ? 'lb-on' : 'lb-off'}" data-badge="${esc(x.id)}" role="img" aria-label="${esc(x.title)}. ${ls[x.id] === 'done' ? esc(T.badgeEarned) : esc(T.badgeLocked)}">${x.icon}</span>`)
      .join('')}</div>`;
    // V7.6: siradaki ders karti + genel ilerleme (edu.done'dan turetilir; yeni kayit alani yok)
    const na = nextAction(cur, done());
    const naLesson = na.lessonId ? lessonById[na.lessonId] : null;
    const nextCard = naLesson
      ? `<div class="learn-nextcard nc-${na.kind}" data-kind="${na.kind}" data-target="${esc(naLesson.id)}">
          <span class="nc-icon" aria-hidden="true">${naLesson.icon}</span>
          <span class="nc-text"><i>${esc(na.kind === 'next' ? T.nextUp : T.allDoneCard)}</i><b>${esc(naLesson.title)}</b></span>
          <button class="btn start nc-go" data-act="nextcard" data-target="${esc(naLesson.id)}" aria-label="${esc((na.kind === 'next' ? T.nextUp : T.replayLabel) + '. ' + naLesson.title)}"><span aria-hidden="true">${na.kind === 'next' ? '▶' : '↻'}</span> ${esc(na.kind === 'next' ? T.startNext : T.replayStart)}</button>
        </div>`
      : '';
    const overall = `<p class="learn-overall" data-count="${na.count}" data-total="${na.total}" aria-label="${esc(T.overallLabel)}: ${na.count} / ${na.total} ${esc(T.lessonsOf)}"><span class="lo-bar" aria-hidden="true"><span class="lo-fill" style="width:${na.total ? Math.round((na.count / na.total) * 100) : 0}%"></span></span><b>${na.count} / ${na.total} ${esc(T.lessonsOf)}</b></p>`;
    el.stage.innerHTML = `
      <div class="learn-map">
        <p class="cap learn-cap" aria-live="polite">${esc(T.intro)}</p>
        ${nextCard}${overall}${path}${badges}
        ${cur.levels
          .map((l) => {
            const s = lv[l.id];
            const lessons = l.lessons
              .map((x) => {
                const st = ls[x.id];
                const label = `${x.title}. ${st === 'done' ? T.doneLabel + '. ' + T.replayLabel : st === 'locked' ? T.lockedLabel : ''}`;
                return `<button class="learn-lesson st-${st}" data-act="open" data-lesson="${esc(x.id)}" aria-label="${esc(label)}" ${st === 'locked' ? 'aria-disabled="true"' : ''}>
                  <span class="ll-icon" aria-hidden="true">${x.icon}</span>
                  <span class="ll-text"><b>${esc(x.title)}</b><i>${esc(x.goal || '')}</i>${st === 'done' ? `<em class="ll-replay" aria-hidden="true">↻ ${esc(T.replayLabel)}</em>` : ''}</span>
                  <span class="ll-state" aria-hidden="true">${badge[st]}</span></button>`;
              })
              .join('');
            const soon = s === 'soon' ? `<button class="learn-soon" data-act="soon" aria-label="${esc(l.name)}. ${esc(T.soon)}"><span aria-hidden="true">⏳</span> ${esc(T.soon)}</button>` : '';
            return `<section class="learn-level lv-${s}" data-level="${l.id}">
              <h2><span aria-hidden="true">${l.emoji}</span> ${esc(l.name)} <small aria-hidden="true">${s === 'done' ? '✔' : s === 'locked' || s === 'soon' ? '🔒' : ''}</small>${l.lessons.length ? `<em class="lv-count" aria-hidden="true">${l.lessons.filter((x) => ls[x.id] === 'done').length}/${l.lessons.length}</em>` : ''}</h2>
              ${lessons}${soon}</section>`;
          })
          .join('')}
      </div>`;
    el.cap = el.stage.querySelector('.learn-cap');
    setHeader();
  }

  function openLesson(id) {
    const x = lessonById[id];
    if (!x) return;
    if (lessonStatus(cur, done())[id] === 'locked') {
      audio.play('gentle');
      return say('learn_locked', T.locked);
    }
    run.start(); // yeni ders calismasi: onceki calismanin zamanlayicilari/odulleri sayilmaz
    lesson = x;
    screen = 'lesson';
    stepIdx = 0;
    audio.play('tap');
    toStep();
  }

  // ---- Adimlar ---------------------------------------------------------------------------------
  const step = () => lesson.steps[stepIdx];
  const ledColors = (L) => Object.fromEntries(L.slots.map((s, i) => [s.id, data.colors.ledColors[i % data.colors.ledColors.length]]));

  function toStep() {
    const s = step();
    stepDone = false;
    tool = null;
    hintSlots = new Set();
    if (s.board) {
      slots = s.board.slots.slice();
      states = startStates(s.board);
    }
    paintStep();
    say(`learn_${lesson.id}_${stepIdx}`, s.say);
    // Anlatim ve soru adimlarinda "Devam" hemen; gorevde basari sonrasi
    if (s.type === 'show') stepDone = true;
    paintControls();
  }

  function overlayHits(L, parts, fixed) {
    const N = data.circuits.layouts[L.id];
    let g = '';
    parts.forEach((p, idx) => {
      if (!p.type || p.type === 'battery' || p.type === 'switch') return;
      const i = idx - 1;
      if (fixed.includes(i)) return;
      const [ax, ay] = N[p.a];
      const [bx, by] = N[p.b];
      const len = Math.hypot(bx - ax, by - ay);
      const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
      const w = Math.min(Math.max(len - 12, 36), 56);
      g += `<g transform="translate(${(ax + bx) / 2} ${(ay + by) / 2}) rotate(${ang.toFixed(1)})"><rect class="inv-hit" data-slot="${p.id}" x="${-w / 2}" y="-20" width="${w}" height="40" rx="10"/></g>`;
    });
    return g;
  }

  function boardHtml(interactive) {
    const s = step();
    const { L, parts } = boardParts(inv, { layout: s.board.layout, slots }, states);
    const a = analyze(parts);
    const round = { nodes: data.circuits.layouts[L.id], viewBox: data.circuits.viewBox, parts, ledColors: ledColors(L), silhouette: false };
    const view = { powered: a.closed, armed: !!tool, hintSlots, pop: null, switchHint: false };
    const svg = boardSvg(round, view, a.sim);
    return interactive ? svg.replace('</svg>', `<g class="inv-hits">${overlayHits(L, parts, s.fixed || [])}</g></svg>`) : svg;
  }

  function paintStep() {
    setHeader();
    const s = step();
    if (s.type === 'quiz') {
      el.stage.innerHTML = `
        <div class="prompt learn-quiz-q"><p class="learn-q">${esc(s.say)}</p></div>
        <p class="cap" aria-live="polite"></p>
        <div class="learn-ctl"></div>`;
    } else {
      el.stage.innerHTML = `
        <div class="prompt kind-circuit" data-lit="0"></div>
        ${meetHtml(s)}
        <p class="cap" aria-live="polite"></p>
        <div class="learn-ctl"></div>`;
      paintBoard();
    }
    el.cap = el.stage.querySelector('.cap');
    el.ctl = el.stage.querySelector('.learn-ctl');
  }

  // V7.5: parca karti. Anlatim adiminda "ne yapar + benzetme", gorevde "Dene:" yonergesi. Dokununca parca adi + anlatim okunur
  // (yalniz dokununca; otomatik uzun konusma yok). Ses kapaliysa voice.say sessizdir; kart her durumda okunabilir yazidir.
  function meetHtml(s) {
    const m = meetOf(data.game.learn.parts, s);
    if (!m) return '';
    const extra = s.type === 'task' ? `<i><strong>${esc(T.tryLabel)}</strong> ${esc(m.try.replace(/^Dene:\s*/, ''))}</i>` : m.like ? `<i>${esc(m.like)}</i>` : '';
    return `<button class="learn-meet" data-act="meet" data-part="${esc(m.id)}" aria-label="${esc(m.name + '. ' + m.job + ' ' + T.meetListen)}">
      <span class="lm-icon" aria-hidden="true">${m.icon}</span>
      <span class="lm-text"><span class="lm-head"><b>${esc(m.job)}</b></span>${extra}</span>
      <span class="lm-ear" aria-hidden="true">🔊</span></button>`;
  }

  function paintBoard() {
    const s = step();
    const pr = el.stage.querySelector('.prompt');
    pr.innerHTML = boardHtml(s.type === 'task');
    const { parts } = boardParts(inv, { layout: s.board.layout, slots }, states);
    pr.dataset.lit = String(analyze(parts).lit);
  }

  function paintControls() {
    const s = step();
    let h = '';
    if (s.type === 'task' && !stepDone && (s.tools || []).length) {
      h += `<div class="inv-tray" role="toolbar" aria-label="Parçalar">${[...s.tools, 'erase']
        .map((t) =>
          t === 'erase'
            ? `<button class="tile inv-tool${tool === 'erase' ? ' selected' : ''}" data-tool="erase" aria-label="${TOOL_NAME.erase}" aria-pressed="${tool === 'erase'}"><span class="inv-erase" aria-hidden="true">🧽</span></button>`
            : `<button class="tile inv-tool${tool === t ? ' selected' : ''}" data-tool="${t}" aria-label="${TOOL_NAME[t]}" aria-pressed="${tool === t}">${tileSvg(t, data.colors.ledColors[0].hex)}</button>`
        )
        .join('')}</div>`;
    }
    if (s.type === 'quiz' && !stepDone) {
      h += `<div class="learn-opts">${s.options.map((o, i) => `<button class="learn-opt" data-act="answer" data-i="${i}" aria-label="${esc(o.text)}"><span aria-hidden="true">${o.icon}</span><b>${esc(o.text)}</b></button>`).join('')}</div>`;
    }
    if (stepDone) {
      const last = stepIdx === lesson.steps.length - 1;
      h += `<button class="btn start learn-next" data-act="next" aria-label="${esc(T.next)}"><span aria-hidden="true">${last ? '⭐' : '▶'}</span> ${esc(T.next)}</button>`;
    }
    el.ctl.innerHTML = h;
  }

  // ---- Gorev ---------------------------------------------------------------------------------------
  function afterEdit() {
    const s = step();
    hintSlots = new Set();
    paintBoard();
    const r = taskResult(inv, s.goal, slots, states, s.board.layout);
    if (r.ok) {
      stepDone = true;
      // V7.4: basari sesi yalniz ayni adimda hala isek ve bir kez calar (stepDone korumasi + adim kontrolu)
      // V7.5: ek olarak ders calismasi basina adim basina TEK talep (run.claim): hizli/tekrarlanan dokunuslar ikinci ses veya konusma uretmez
      const sl = lesson, si = stepIdx, rid = run.id;
      if (run.claim(`ok:${si}`)) {
        audio.play('circuitOn');
        later(() => run.isCurrent(rid) && lesson === sl && stepIdx === si && audio.play('success'), 300);
        say(`learn_ok`, T.taskOk);
      }
      paintControls();
      return;
    }
    const hint = hintText(s, T, r.key); // V7.5: adima/parcaya ozel ipucu, yoksa genel metin
    el.cap.textContent = hint;
    if (hint) voice.say(`learn_hint_${r.key}`, undefined, hint); // ses kapaliysa voice.say sessizdir
    paintControls();
  }

  function slotTap(id) {
    const s = step();
    if (s.type !== 'task' || stepDone) return;
    const i = inv.layouts[s.board.layout].slots.findIndex((q) => q.id === id);
    if (i < 0 || (s.fixed || []).includes(i)) return;
    const curT = slots[i];
    if (tool === 'erase' || (!tool && curT)) {
      if (!curT) return;
      slots[i] = null;
      delete states[id];
      audio.play('tap');
      return afterEdit();
    }
    if (!tool) {
      audio.play('gentle');
      el.cap.textContent = T.pick;
      voice.say('learn_pick', undefined, T.pick);
      return;
    }
    if (curT === tool) return;
    slots[i] = tool;
    if (tool === 'switch') states[id] = 'open';
    else delete states[id];
    audio.play('place');
    afterEdit();
  }

  function switchTap(id) {
    const s = step();
    if (s.type !== 'task' || stepDone) return;
    if (tool === 'erase') return slotTap(id);
    states[id] = states[id] === 'closed' ? 'open' : 'closed';
    audio.play('tap');
    afterEdit();
  }

  function setTool(t) {
    if (stepDone) return;
    tool = tool === t ? null : t;
    audio.play('tap');
    paintBoard();
    paintControls();
  }

  // ---- Soru --------------------------------------------------------------------------------------------
  function answer(i) {
    const s = step();
    if (s.type !== 'quiz' || stepDone) return;
    const o = s.options[i];
    if (!o) return;
    const btn = el.ctl.querySelector(`[data-i="${i}"]`);
    if (o.ok) {
      stepDone = true;
      if (run.claim(`right:${stepIdx}`)) {
        audio.play('correct');
        say('learn_right', T.quizRight);
      }
      paintControls();
    } else {
      // V7.5: ayni yanlis secenege tekrar dokunus ek ses/konusma uretmez (ipucu ekranda kalir)
      if (!run.claim(`wrong:${stepIdx}:${i}`)) return;
      audio.play('gentle'); // cezalandirici mesaj yok: nazik tekrar
      btn?.classList.add('soft');
      btn?.setAttribute('aria-disabled', 'true');
      say('learn_wrong', o.hint || T.quizWrong); // V7.4: yanlista cevabi vermeden kisa ogretici ipucu
    }
  }

  // ---- Ilerleme / bitis ---------------------------------------------------------------------------------
  function next() {
    if (!stepDone) return;
    if (stepIdx < lesson.steps.length - 1) {
      stepIdx += 1;
      return toStep();
    }
    finishLesson();
  }

  function finishLesson() {
    // V7.5: odul/ses ders calismasi basina BIR kez; ayni bitis ikinci kez tetiklenirse (cift dokunus vb.) hicbir sey tekrarlanmaz
    if (!run.claim('reward')) return;
    const R = lessonReward(cur, done(), lesson.id);
    // Kayit: mevcut rozet/ilerleme sistemi (edu.done) ile AYNI kural. Rozet ayri kayit degildir; tamamlanan ders = rozet.
    if (R) storage.updateEdu(R.done); // kayit basarisiz olsa da oturum surer; yalniz Egitim alani yazilir
    screen = 'done';
    setHeader();
    const nid = nextLessonId(cur, lesson.id);
    const canNext = nid && lessonStatus(cur, done())[nid] === 'open';
    const isNew = !!R?.firstTime;
    const reward = R
      ? `<div class="learn-reward ${isNew ? 'lr-new' : 'lr-have'}" data-badge="${esc(R.badge.id)}" data-new="${isNew ? 1 : 0}" role="group" aria-label="${esc(T.badgesTitle)}">
          <span class="lr-badge" aria-hidden="true">${R.badge.icon}</span>
          <span class="lr-text"><b>${esc(isNew ? T.badgeNew : T.badgeHave)}</b><i>${esc(R.badge.title)}</i></span></div>
        ${isNew ? '' : `<p class="learn-replaynote" data-replay="1">↻ ${esc(T.replayNote)}</p>`}
        ${R.learned ? `<p class="learn-learned">${esc(R.learned)}</p>` : ''}
        <p class="learn-meter" data-count="${R.count}" data-total="${R.total}" aria-label="${R.count} / ${R.total} ${esc(T.badgeWord)}">${Array.from({ length: R.total }, (_, i) => `<span class="lmd${i < R.count ? ' on' : ''}" aria-hidden="true"></span>`).join('')}<span class="lm-n">${R.count} / ${R.total} ${esc(T.badgeWord)}</span></p>
        ${R.levelJustDone ? `<p class="learn-levelup" data-level="${esc(R.levelId)}">${R.levelEmoji} ${esc(R.levelName)} ${esc(T.levelDoneSuffix)}</p>` : ''}
        ${R.allDone ? `<p class="learn-levelup learn-alldone">🏆 ${esc(T.allDone)}</p>` : ''}`
      : '';
    el.stage.innerHTML = `
      <div class="prompt learn-done"><div class="ld-in"><div class="ld-a"><div class="learn-trophy" aria-hidden="true">${isNew ? '⭐' : '✅'}</div><p class="learn-q">${esc(T.wellDone)}</p><p class="learn-sub">${esc(lesson.title)}</p></div><div class="ld-b">${reward}</div></div></div>
      <p class="cap" aria-live="polite"></p>
      <div class="learn-ctl">
        ${canNext ? `<button class="btn start learn-next" data-act="open" data-lesson="${esc(nid)}" aria-label="${esc(T.nextLesson)}"><span aria-hidden="true">▶</span> ${esc(T.nextLesson)}</button>` : ''}
        <button class="btn chip" data-act="map" aria-label="${esc(T.toMap)}">${esc(T.toMap)}</button>
      </div>`;
    el.cap = el.stage.querySelector('.cap');
    const spoken = [T.wellDone, isNew ? T.badgeNew : T.replayNote];
    if (R?.levelJustDone) spoken.push(`${R.levelName} ${T.levelDoneSuffix}`);
    if (R?.allDone) spoken.push(T.allDone);
    doneSpoken = spoken.join(' ');
    msg = T.wellDone;
    el.cap.textContent = T.wellDone;
    audio.play('levelUp');
    voice.say('learn_done', undefined, doneSpoken); // tam metin (rozet + asama), TEK konusma; ses kapaliysa sessiz
  }

  // ---- Olaylar ------------------------------------------------------------------------------------------------
  function onClick(e) {
    const t = e.target;
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'back') return exit();
      if (a === 'close' || a === 'map') return toMap();
      if (a === 'speak') return voice.say('learn_repeat', undefined, (screen === 'done' && doneSpoken) || el.cap?.textContent || T.intro);
      if (a === 'meet') {
        if (screen !== 'lesson') return;
        const m = meetOf(data.game.learn.parts, step());
        audio.play('tap');
        return m ? voice.say(`learn_meet_${m.id}`, undefined, m.spoken) : undefined;
      }
      if (a === 'open') return openLesson(act.dataset.lesson);
      if (a === 'nextcard') return screen === 'map' ? openLesson(act.dataset.target) : undefined;
      if (a === 'soon') {
        audio.play('gentle');
        return say('learn_soon', T.soon);
      }
      if (a === 'next') return next();
      if (a === 'answer') return answer(Number(act.dataset.i));
    }
    if (screen !== 'lesson') return;
    const toolBtn = t.closest('[data-tool]');
    if (toolBtn) return setTool(toolBtn.dataset.tool);
    const sw = t.closest('[data-switch]');
    if (sw) return switchTap(sw.dataset.switch);
    const slot = t.closest('[data-slot]');
    if (slot) return slotTap(slot.dataset.slot);
  }

  return { mount, unmount };
}
