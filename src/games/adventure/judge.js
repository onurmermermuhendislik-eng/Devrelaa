// V8.1 "Devre Dedektifi": salt-okunur devre resmi + "kapali mi, acik mi?" Dogru cevap SIMULASYONDAN turetilir (evaluateBoard): lamba yanarsa kapali devre.
// Sahneler task.scenes[]; `hard` isaretli sahneler yalniz 6-8 yasta. Yanlis cevap cezasiz: ipucu + tekrar deneme (hata yildizi etkiler).
import { evaluateBoard, boardMarkup, BOARD_SVG } from './circuit.js';
import { esc } from './svg.js';

export const scenesFor = (task, band) => task.scenes.filter((s) => !(s.hard && band === '4-5'));
export const sceneTruth = (scene) => evaluateBoard({ board: { edges: scene.edges, fixedClosed: !!scene.fixedClosed, tray: [] } }, {}, false).lit;

export function mountJudge(host, { task, text, audio, mascot, onSolved, speak, band = '4-5' }) {
  const scenes = scenesFor(task, band);
  let idx = 0;
  let mistakes = 0;
  let locked = false;
  let dead = false;
  const timers = [];
  const say = (kind, msg) => {
    try {
      mascot?.react(kind, msg);
    } catch {
      /* maskot hatasi oyunu etkilemez */
    }
  };
  const talk = (t) => {
    if (!t) return;
    sayEl.textContent = t;
    try {
      speak?.(t);
    } catch {
      /* ses hatasi oyunu etkilemez */
    }
  };
  const play = (n) => {
    try {
      audio.play(n);
    } catch {
      /* sessiz */
    }
  };
  host.innerHTML = `
    <div class="adv-judge" data-task="${esc(task.id)}">
      <div class="cx-left">
        <div class="cx-board jd-board adv-block" role="img" aria-label="${esc(text.boardAria)}"></div>
        <p class="cx-say adv-block" data-say aria-live="polite"></p>
      </div>
      <aside class="jd-side adv-block">
        <span class="id-dots" aria-hidden="true"></span>
        <div class="jd-opts" role="group" aria-label="${esc(task.title)}">
          <button type="button" class="jd-opt" data-ans="closed"><span aria-hidden="true">💡</span><b>${esc(text.closedCircuit)}</b></button>
          <button type="button" class="jd-opt" data-ans="open"><span aria-hidden="true">✂️</span><b>${esc(text.openCircuit)}</b></button>
        </div>
        <button type="button" class="adv-btn primary pulse" data-act="finish" hidden>${esc(text.next)}</button>
      </aside>
    </div>`;
  const root = host.querySelector('.adv-judge');
  const sayEl = root.querySelector('.cx-say');
  const boardEl = root.querySelector('.jd-board');
  const dotsEl = root.querySelector('.id-dots');
  const finishBtn = root.querySelector('[data-act="finish"]');
  const optBtns = [...root.querySelectorAll('.jd-opt')];

  function show() {
    const sc = scenes[idx];
    locked = false;
    root.dataset.round = String(idx + 1);
    root.dataset.truth = sceneTruth(sc) ? 'closed' : 'open';
    const t = { board: { edges: sc.edges, fixedClosed: !!sc.fixedClosed } };
    const { wires, fixed } = boardMarkup(t, text);
    boardEl.innerHTML = BOARD_SVG(wires) + fixed;
    boardEl.dataset.lit = '0';
    boardEl.querySelectorAll('.cx-fixed[data-type="lamp"]').forEach((e) => (e.dataset.on = '0'));
    dotsEl.innerHTML = scenes.map((_, i) => `<i class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"></i>`).join('');
    optBtns.forEach((b) => {
      b.disabled = false;
      b.classList.remove('good', 'bad');
    });
    talk(task.say);
  }
  const reveal = (sc) => {
    const lit = sceneTruth(sc);
    boardEl.dataset.lit = lit ? '1' : '0';
    boardEl.querySelectorAll('.cx-fixed[data-type="lamp"]').forEach((e) => (e.dataset.on = lit ? '1' : '0'));
  };
  root.querySelector('.jd-opts').addEventListener('click', (e) => {
    const b = e.target.closest('.jd-opt');
    if (!b || locked || b.classList.contains('bad')) return;
    const sc = scenes[idx];
    const truth = sceneTruth(sc) ? 'closed' : 'open';
    if (b.dataset.ans === truth) {
      locked = true;
      b.classList.add('good');
      optBtns.forEach((x) => (x.disabled = true));
      reveal(sc);
      play(truth === 'closed' ? 'circuitOn' : 'correct');
      say('correct');
      talk(sc.learn);
      if (idx + 1 < scenes.length) {
        timers.push(
          setTimeout(() => {
            if (dead) return;
            idx += 1;
            show();
          }, 3200)
        );
      } else {
        root.classList.add('solved');
        finishBtn.hidden = false;
      }
    } else {
      mistakes += 1;
      b.classList.add('bad');
      play('gentle');
      if (mistakes >= 2 && sc.hint) {
        say('hint', sc.hint);
        talk(sc.hint);
      } else {
        say('wrong');
        talk(text.tryAgain);
      }
    }
  });
  finishBtn.addEventListener('click', () => !dead && onSolved({ mistakes }));
  show();
  return {
    destroy() {
      dead = true;
      timers.forEach(clearTimeout);
    },
    state: () => ({ idx, mistakes, total: scenes.length, solved: root.classList.contains('solved') })
  };
}
