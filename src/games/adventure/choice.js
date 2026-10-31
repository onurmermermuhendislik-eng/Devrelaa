// V8.0 Macera: kisa secmeli gorev (sahne + soru + 3 buyuk secenek). Hata sayisi yildizi belirler. Gorsel: yatay (sol sahne/soru, sag secenekler).
import { esc } from './svg.js';

export function mountChoice(host, { task, text, audio, mascot, onSolved, speak }) {
  let mistakes = 0;
  let solved = false;
  let dead = false;
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
  host.innerHTML = `
    <div class="adv-choice" data-task="${esc(task.id)}">
      <div class="ch-left">
        <div class="ch-scene" aria-hidden="true">${esc(task.scene)}</div>
        <p class="ch-say adv-block" data-say aria-live="polite">${esc(task.say)}</p>
      </div>
      <div class="ch-right adv-block">
        <div class="ch-opts" role="group" aria-label="${esc(task.say)}">
          ${task.options.map((o, i) => `<button type="button" class="ch-opt" data-i="${i}">${esc(o.text)}</button>`).join('')}
        </div>
        <button type="button" class="adv-btn primary pulse" data-act="finish" hidden>${esc(text.next)}</button>
      </div>
    </div>`;
  const root = host.querySelector('.adv-choice');
  const sayEl = root.querySelector('.ch-say');
  const finishBtn = root.querySelector('[data-act="finish"]');
  root.querySelector('.ch-opts').addEventListener('click', (e) => {
    const b = e.target.closest('.ch-opt');
    if (!b || solved || b.classList.contains('bad')) return;
    const o = task.options[Number(b.dataset.i)];
    if (o.ok) {
      solved = true;
      b.classList.add('good');
      root.classList.add('solved');
      root.querySelectorAll('.ch-opt').forEach((x) => (x.disabled = true));
      talk(task.learn || text.boardWin);
      try {
        audio.play('correct');
      } catch {
        /* sessiz */
      }
      say('correct');
      finishBtn.hidden = false;
    } else {
      mistakes += 1;
      b.classList.add('bad');
      b.setAttribute('aria-disabled', 'true');
      try {
        audio.play('gentle');
      } catch {
        /* sessiz */
      }
      if (mistakes >= 2 && task.hint) {
        say('hint', task.hint);
        talk(task.hint);
      } else {
        say('wrong');
        try {
          speak?.(text.tryAgain); // soru yazisi ekranda kalir; yalniz nazik sesli geri bildirim
        } catch {
          /* ses hatasi oyunu etkilemez */
        }
      }
    }
  });
  finishBtn.addEventListener('click', () => !dead && onSolved({ mistakes }));
  talk(task.say); // V8.4: gorev acilinca soru sesli okunur (ses kapaliysa speak sessiz kalir)
  return {
    destroy() {
      dead = true;
    },
    state: () => ({ mistakes, solved })
  };
}
