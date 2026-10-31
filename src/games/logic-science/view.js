// Mantik ve Bilim gorev ekrani (kabuk: games/tasks/shell.js). Dort tur: order, pattern, cause, science.
import { shuffledItems, isNextInOrder, shuffledOptions, correctIndex } from './logic.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// V7.8: uzun emoji dizileri (⭐⭐⭐⭐) kucuk ekranda kesilmesin diye kucultulur
const longCls = (t) => ([...String(t)].length > 2 ? ' ls-long' : '');

export function makeLogicView(task, env) {
  const { T, prompt, ctl } = env;
  let over = false;

  // ---- order: ogeleri sirayla dokun
  if (task.kind === 'order') {
    const order = shuffledItems(task, env.rng);
    let placed = 0;
    let assistIdx = -1;
    const paint = () => {
      prompt.innerHTML = `<div class="ls-order" aria-label="${esc(T.orderSlotsLabel)}">${task.items
        .map((it, i) => `<span class="ls-slot${i < placed ? ' on' : ''}" data-slot-i="${i}">${i < placed ? esc(it.icon) : i + 1}</span>`)
        .join('')}</div>`;
      ctl.innerHTML = `<div class="learn-opts ls-items" role="group" aria-label="${esc(T.orderPick)}">${order
        .map((idx) => {
          const it = task.items[idx];
          const used = idx < placed;
          return `<button class="learn-opt ls-item${used ? ' soft used' : ''}${idx === assistIdx ? ' hint' : ''}" data-item="${idx}" aria-label="${esc(it.label)}" ${used ? 'aria-disabled="true"' : ''}><span class="ls-ic" aria-hidden="true">${esc(it.icon)}</span><b>${esc(it.label)}</b></button>`;
        })
        .join('')}</div>`;
    };
    return {
      start: paint,
      onClick(e) {
        const b = e.target.closest('[data-item]');
        if (!b || over || b.getAttribute('aria-disabled') === 'true') return;
        const i = Number(b.dataset.item);
        if (isNextInOrder(placed, i)) {
          placed += 1;
          assistIdx = -1;
          env.progress();
          env.sfx('place');
          paint();
          if (placed === task.items.length) {
            over = true;
            prompt.classList.add('ls-win');
            env.solved({ text: T.solved });
          }
        } else env.wrong(`item:${i}`, task.items[i].hint, task.hint2);
      },
      assist() {
        assistIdx = placed;
        paint();
      },
      destroy() {}
    };
  }

  // ---- pattern / cause / science: secenekli
  const opts = shuffledOptions(task, env.rng);
  let assistI = -1;
  const dead = new Set();
  const paint = () => {
    if (task.kind === 'pattern') {
      prompt.innerHTML = `<div class="ls-seq" aria-label="${esc(task.say)}">${task.seq.map((s) => `<span class="ls-cell${longCls(s)}">${esc(s)}</span>`).join('')}<span class="ls-cell ls-q" aria-hidden="true">?</span></div>`;
    } else prompt.innerHTML = `<div class="ls-scene" aria-hidden="true">${esc(task.scene || task.icon || '')}</div>`;
    ctl.innerHTML = `<div class="learn-opts ls-opts" role="group" aria-label="${esc(task.say)}">${opts
      .map((o) => `<button class="learn-opt ls-opt${longCls(o.icon)}${dead.has(o.i) ? ' soft' : ''}${o.i === assistI ? ' hint' : ''}" data-opt="${o.i}" aria-label="${esc(o.text)}" ${dead.has(o.i) ? 'aria-disabled="true"' : ''}><span class="ls-ic" aria-hidden="true">${esc(o.icon)}</span><b>${esc(o.text)}</b></button>`)
      .join('')}</div>`;
  };
  return {
    start: paint,
    onClick(e) {
      const b = e.target.closest('[data-opt]');
      if (!b || over || b.getAttribute('aria-disabled') === 'true') return;
      const i = Number(b.dataset.opt);
      const o = task.options[i];
      if (!o) return;
      if (o.ok) {
        over = true;
        // cozum: dogru secenek isaretlenir; bilim/neden-sonuc gorevlerinde "Gozlem:" paneli gosterilir
        if (task.kind === 'pattern') prompt.querySelector('.ls-q').textContent = o.icon;
        else if (task.observe) prompt.innerHTML = `<div class="ls-observe"><span class="ls-big" aria-hidden="true">${esc(task.observe.icon)}</span><p><b>${esc(T.observeLabel)}</b> ${esc(task.observe.text)}</p></div>`;
        ctl.innerHTML = '';
        prompt.classList.add('ls-win'); // V7.8: hafif basari animasyonu (azaltilmis harekette kapali)
        env.solved({ text: task.kind === 'pattern' ? T.solved : `${T.solved} ${task.observe?.text || ''}`.trim() });
      } else {
        dead.add(i);
        env.wrong(`opt:${i}`, o.hint, task.hint2);
        paint();
      }
    },
    assist() {
      assistI = correctIndex(task);
      paint();
    },
    destroy() {}
  };
}
