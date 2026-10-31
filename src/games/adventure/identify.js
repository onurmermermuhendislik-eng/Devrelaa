// V8.1 "Enerjiyle Tanis": pil / lamba / kablo tanima. Her tur: soru (sesli) + buyuk parca secenekleri (4-5 yas en fazla 3; 6-8 yasta `hardOptions` eklenir).
// Dogru: kisa bilgi + sonraki tur. Yanlis: ceza yok, nazik ipucu ve tekrar deneme (hata yildizi etkiler). Gorev verisi: task.rounds[].
import { partSvg, esc } from './svg.js';

export const optionsFor = (round, band) => (band === '6-8' ? [...round.options, ...(round.hardOptions || [])] : round.options.slice(0, 3));

export function mountIdentify(host, { task, text, audio, mascot, onSolved, speak, band = '4-5' }) {
  let idx = 0;
  let mistakes = 0;
  let locked = false;
  let dead = false;
  let timer = null;
  const timers = [];
  const rounds = task.rounds;
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
    <div class="adv-identify" data-task="${esc(task.id)}">
      <div class="id-top adv-block"><span class="id-dots" aria-hidden="true"></span></div>
      <p class="id-say adv-block" data-say aria-live="polite"></p>
      <div class="id-opts" role="group" aria-label="${esc(task.title)}"></div>
      <button type="button" class="adv-btn primary pulse" data-act="finish" hidden>${esc(text.next)}</button>
    </div>`;
  const root = host.querySelector('.adv-identify');
  const sayEl = root.querySelector('.id-say');
  const optsEl = root.querySelector('.id-opts');
  const dotsEl = root.querySelector('.id-dots');
  const finishBtn = root.querySelector('[data-act="finish"]');

  function show() {
    const r = rounds[idx];
    locked = false;
    root.dataset.round = String(idx + 1);
    dotsEl.innerHTML = rounds.map((_, i) => `<i class="${i < idx ? 'done' : i === idx ? 'cur' : ''}"></i>`).join('');
    optsEl.innerHTML = optionsFor(r, band)
      .map((t, i) => `<button type="button" class="id-opt" data-type="${t}" data-i="${i}" aria-label="${esc(text.partN || 'Parça')} ${i + 1}">${partSvg(t)}<span class="id-name" aria-hidden="true"></span></button>`)
      .join('');
    talk(r.say);
  }
  const answer = (b) => {
    const r = rounds[idx];
    if (locked || b.classList.contains('bad')) return;
    if (b.dataset.type === r.answer) {
      locked = true;
      b.classList.add('good');
      b.querySelector('.id-name').textContent = text.parts?.[r.answer] || r.answer;
      optsEl.querySelectorAll('.id-opt').forEach((x) => (x.disabled = true));
      play('correct');
      say('correct');
      talk(r.learn);
      if (idx + 1 < rounds.length) {
        timer = setTimeout(() => {
          if (dead) return;
          idx += 1;
          show();
        }, 2600);
        timers.push(timer);
      } else {
        root.classList.add('solved');
        finishBtn.hidden = false;
      }
    } else {
      mistakes += 1;
      b.classList.add('bad');
      b.setAttribute('aria-disabled', 'true');
      play('gentle');
      if (mistakes >= 2 && r.hint) {
        say('hint', r.hint);
        talk(r.hint);
      } else {
        say('wrong');
        talk(text.tryAgain);
      }
    }
  };
  optsEl.addEventListener('click', (e) => {
    const b = e.target.closest('.id-opt');
    if (b) answer(b);
  });
  finishBtn.addEventListener('click', () => !dead && onSolved({ mistakes }));
  show();
  return {
    destroy() {
      dead = true;
      timers.forEach(clearTimeout);
    },
    state: () => ({ idx, mistakes, solved: root.classList.contains('solved') })
  };
}
