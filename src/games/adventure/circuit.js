// V8.0 Macera: gercek etkilesimli devre gorevi (pil + kablo + lamba [+ anahtar]). Devre durumu MEVCUT benzetimle (shape-complete/circuit-sim.js)
// degerlendirilir; bu dosyadaki `evaluateBoard` saftir (DOM yok) ve birim testlidir. Tahta: 4 kenarli kapali cerceve. V8.1: her kenar
//   'slot' (bos yer: cocuk koyar) | 'wire' (sabit kablo) | 'battery'|'lamp'|'switch' (sabit parca) | 'stone'|'leaf' (sabit yalitkan) | 'gap' (kopuk kablo).
// Gorev verisi: board.edges, board.tray [{id,type,hard?}], board.preset {kenar: parcaId} (baslangicta yerlesik; "hata avcisi"), board.fixedClosed,
// need {lit: yanmasi gereken lamba sayisi (vars. 1), thenOpen: yandiktan sonra anahtari acip sondurmeyi de iste}.
// Cocuk parcalari surukleyerek ya da (dokun-sec, dokun-yerlestir) ile koyar. Tas/yaprak elektrigi gecirmez (hata sayilir, yildizi etkiler).
import { simulate, litCount } from '../shape-complete/circuit-sim.js';
import { partSvg, esc } from './svg.js';

const NODES = { left: ['N0', 'N1'], top: ['N1', 'N2'], right: ['N2', 'N3'], bottom: ['N3', 'N0'] };
const PT = { N0: [70, 196], N1: [70, 44], N2: [330, 44], N3: [330, 196] };
const POS = { left: { x: 70, y: 120 }, top: { x: 200, y: 44 }, right: { x: 330, y: 120 }, bottom: { x: 200, y: 196 } };
const SIMTYPE = { battery: 'battery', lamp: 'led', led: 'led', resistor: 'resistor', switch: 'switch', wire: 'wire' }; // tas/yaprak: iletmez (tip yok)
export const INSULATORS = ['stone', 'leaf'];
const FIXED = ['battery', 'lamp', 'led', 'resistor', 'switch', 'stone', 'leaf'];
const LIGHTS = ['lamp', 'led']; // V8.4: LED de lamba gibi yanar
const ROT = ['battery', 'wire', 'switch', 'resistor'];
export const slotEdges = (task) => Object.entries(task.board.edges).filter(([, k]) => k === 'slot').map(([e]) => e);
// 4-5 yas bandinda `hard` isaretli ek (dikkat dagitici) parcalar tepside gosterilmez.
export const visibleTray = (task, band) => task.board.tray.filter((p) => !(p.hard && band === '4-5'));

// placed: { kenar: parcaKimligi | null }, closed: yerlestirilen anahtar kapali mi
export function evaluateBoard(task, placed, closed = false) {
  const tray = Object.fromEntries(task.board.tray.map((p) => [p.id, p]));
  const parts = [];
  const lampEdges = [];
  for (const [edge, kind] of Object.entries(task.board.edges)) {
    const [a, b] = NODES[edge];
    if (kind === 'wire') parts.push({ id: edge, type: 'wire', a, b });
    else if (kind === 'slot') {
      const p = placed[edge] ? tray[placed[edge]] : null;
      const type = p ? SIMTYPE[p.type] || null : null;
      if (LIGHTS.includes(p?.type)) lampEdges.push(edge);
      parts.push({ id: edge, type, a, b, state: type === 'switch' ? (closed ? 'closed' : 'open') : undefined });
    } else if (kind === 'gap') parts.push({ id: edge, type: null, a, b });
    else {
      const type = SIMTYPE[kind] || null;
      if (LIGHTS.includes(kind)) lampEdges.push(edge);
      parts.push({ id: edge, type, a, b, state: type === 'switch' ? (task.board.fixedClosed ? 'closed' : 'open') : undefined });
    }
  }
  const res = simulate(parts);
  const lamps = Object.fromEntries(lampEdges.map((e) => [e, (res.levels[e] || 0) > 0]));
  const litLamps = Object.values(lamps).filter(Boolean).length;
  const full = slotEdges(task).every((e) => placed[e]);
  // V8.4: yolda direnc var mi (yerlestirilen ya da sabit); LED'i korumak icin `need.resistor` gorevleri bunu ister
  const hasResistor = parts.some((p) => p.type === 'resistor');
  return { lit: litLamps > 0, litLamps, lamps, closed: res.closed, litCount: litCount(res), full, lampEdges, hasResistor };
}

const rotCls0 = (edge, type) => ((edge === 'left' || edge === 'right') && ROT.includes(type) ? ' rot' : '');

// Tahtanin kablo ve sabit parca isaretlemesi (judge.js de kullanir: salt-okunur devre resmi)
export function boardMarkup(task, text) {
  const name = (type) => text.parts?.[type] || type;
  const wires = Object.entries(task.board.edges)
    .map(([e, kind]) => {
      const [a, b] = NODES[e];
      if (kind !== 'gap') return `<path class="cx-wire" d="M${PT[a]} L${PT[b]}"/>`;
      // kopuk kablo: ortada bosluk birakan iki kisa parca
      const [ax, ay] = PT[a];
      const [bx, by] = PT[b];
      const f = (t) => `${ax + (bx - ax) * t} ${ay + (by - ay) * t}`;
      return `<path class="cx-wire" d="M${f(0)} L${f(0.36)} M${f(0.64)} L${f(1)}"/>`;
    })
    .join('');
  const fixed = Object.entries(task.board.edges)
    .filter(([, k]) => FIXED.includes(k) || k === 'gap')
    .map(([e, k]) => {
      const pos = `left:${(POS[e].x / 400) * 100}%;top:${(POS[e].y / 240) * 100}%`;
      if (k === 'gap') return `<span class="cx-fixed gap" data-edge="${e}" data-type="gap" style="${pos}" aria-label="${esc(text.gap || 'Kopuk')}"><i aria-hidden="true">✂️</i></span>`;
      return `<span class="cx-fixed" data-edge="${e}" data-type="${k}" style="${pos}" aria-label="${esc(name(k))}"><span class="cx-in${rotCls0(e, k)}">${partSvg(k, { closed: !!task.board.fixedClosed })}</span></span>`;
    })
    .join('');
  return { wires, fixed };
}

export const BOARD_SVG = (wires) => `<svg class="cx-svg" viewBox="0 0 400 240" aria-hidden="true" focusable="false">
            <rect class="cx-table" x="6" y="8" width="388" height="224" rx="22"/>
            <g class="cx-wires">${wires}</g>
            <path class="cx-flow" d="M70 44H330V196H70Z"/>
            ${['N0', 'N1', 'N2', 'N3'].map((n) => `<circle class="cx-node" cx="${n === 'N0' || n === 'N1' ? 70 : 330}" cy="${n === 'N0' || n === 'N3' ? 196 : 44}" r="6"/>`).join('')}
          </svg>`;

export const needLit = (task) => task.need?.lit ?? 1;

export function mountCircuit(host, { task, text, audio, mascot, onSolved, speak, band = '4-5' }) {
  const tray = Object.fromEntries(task.board.tray.map((p) => [p.id, p]));
  const shown = visibleTray(task, band);
  const placed = Object.fromEntries(slotEdges(task).map((e) => [e, (task.board.preset || {})[e] || null]));
  let selected = null;
  let closed = false;
  let mistakes = 0;
  let solved = false;
  let phase2 = false;
  let noResHint = false;
  let dead = false;
  const H = task.hints || {};
  const name = (type) => text.parts?.[type] || type;
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
  const rotCls = (edge, type) => ((edge === 'left' || edge === 'right') && ROT.includes(type) ? ' rot' : '');

  const { wires, fixed } = boardMarkup(task, text);
  host.innerHTML = `
    <div class="adv-circuit" data-task="${esc(task.id)}" data-lit="0">
      <div class="cx-left">
        <div class="cx-board adv-block" role="group" aria-label="${esc(text.boardAria)}">
          <svg class="cx-svg" viewBox="0 0 400 240" aria-hidden="true" focusable="false">
            <rect class="cx-table" x="6" y="8" width="388" height="224" rx="22"/>
            <g class="cx-wires">${wires}</g>
            <path class="cx-flow" d="M70 44H330V196H70Z"/>
            ${['N0', 'N1', 'N2', 'N3'].map((n) => `<circle class="cx-node" cx="${n === 'N0' || n === 'N1' ? 70 : 330}" cy="${n === 'N0' || n === 'N3' ? 196 : 44}" r="6"/>`).join('')}
          </svg>
          ${fixed}
          ${slotEdges(task)
            .map((e) => `<button type="button" class="cx-slot" data-edge="${e}" style="left:${(POS[e].x / 400) * 100}%;top:${(POS[e].y / 240) * 100}%" aria-label="${esc(text.slotEmpty)}"></button>`)
            .join('')}
        </div>
        <p class="cx-say adv-block" data-say aria-live="polite">${esc(H.start || task.say)}</p>
      </div>
      <aside class="cx-side adv-block">
        <h3 class="cx-h">${esc(text.tray)}</h3>
        <div class="cx-tiles"></div>
        <div class="cx-actions">
          <button type="button" class="adv-btn soft" data-act="reset" aria-label="${esc(text.reset)}">↺ ${esc(text.reset)}</button>
          <button type="button" class="adv-btn primary pulse" data-act="finish" hidden>${esc(text.next)}</button>
        </div>
      </aside>
    </div>`;
  const root = host.querySelector('.adv-circuit');
  const sayEl = root.querySelector('.cx-say');
  const tilesEl = root.querySelector('.cx-tiles');
  const finishBtn = root.querySelector('[data-act="finish"]');
  const slotEls = Object.fromEntries([...root.querySelectorAll('.cx-slot')].map((b) => [b.dataset.edge, b]));
  const fixedEls = Object.fromEntries([...root.querySelectorAll('.cx-fixed')].map((b) => [b.dataset.edge, b]));

  function paint() {
    // bosta kalan (yerlestirilmemis) parcalar tepside
    const inUse = new Set(Object.values(placed).filter(Boolean));
    tilesEl.innerHTML = shown
      .filter((p) => !inUse.has(p.id))
      .map((p) => `<button type="button" class="cx-tile${selected === p.id ? ' sel' : ''}" data-part="${p.id}" data-type="${p.type}" aria-label="${esc(name(p.type))}" aria-pressed="${selected === p.id}">${partSvg(p.type)}<span>${esc(name(p.type))}</span></button>`)
      .join('');
    for (const [edge, el] of Object.entries(slotEls)) {
      const id = placed[edge];
      const p = id ? tray[id] : null;
      el.classList.toggle('filled', !!p);
      el.classList.toggle('want', !!selected && !p);
      el.dataset.type = p ? p.type : '';
      el.innerHTML = p ? `<span class="cx-in${rotCls(edge, p.type)}">${partSvg(p.type, { closed })}</span>` : '';
      el.setAttribute('aria-label', p ? `${name(p.type)} ${text.placed}${p.type === 'switch' ? (closed ? ' (kapalı)' : ' (açık)') : ''}` : text.slotEmpty);
    }
    const ev = evaluateBoard(task, placed, closed);
    root.dataset.lit = ev.lit ? '1' : '0';
    for (const e of ev.lampEdges) (slotEls[e] || fixedEls[e]).dataset.on = ev.lamps[e] ? '1' : '0';
    return ev;
  }

  function win() {
    solved = true;
    root.classList.add('solved');
    talk(task.win || text.boardWin);
    try {
      audio.play('circuitOn');
    } catch {
      /* sessiz */
    }
    say('correct');
    finishBtn.hidden = false;
    root.querySelector('[data-act="reset"]').hidden = true;
    tilesEl.querySelectorAll('button').forEach((b) => (b.disabled = true));
    Object.values(slotEls).forEach((b) => (b.disabled = true));
  }

  function after(ev) {
    if (solved) return;
    if (phase2) {
      if (ev.litLamps === 0 && !closed) win(); // anahtar acildi, lamba sondu
      return;
    }
    if (ev.litLamps >= needLit(task)) {
      if (task.need?.resistor && !ev.hasResistor) {
        // V8.4: LED direncsiz yanmaz sayilir (gercek hayatta LED'i direnc korur). Ceza yok: ipucu verilir, cocuk direnci koyunca devam eder.
        if (!noResHint) {
          noResHint = true;
          say('hint', H.noResistor);
          talk(H.noResistor);
        }
        return;
      }
      noResHint = false;
      if (task.need?.thenOpen) {
        phase2 = true; // once yaksin; sonra anahtari acip sondurmesini iste
        try {
          audio.play('circuitOn');
        } catch {
          /* sessiz */
        }
        say('correct');
        talk(H.thenOpen);
      } else win();
    }
  }

  function place(edge, partId) {
    if (solved || !slotEls[edge] || !tray[partId]) return;
    for (const e of Object.keys(placed)) if (placed[e] === partId) placed[e] = null; // baska yerdeyse tasi
    placed[edge] = partId; // eski parca tepsiye doner (paint, kullanilmayanlari tepside gosterir)
    selected = null;
    const type = tray[partId].type;
    try {
      audio.play('place');
    } catch {
      /* sessiz */
    }
    if (INSULATORS.includes(type)) {
      mistakes += 1;
      try {
        audio.play('gentle');
      } catch {
        /* sessiz */
      }
      slotEls[edge].classList.remove('shake');
      void slotEls[edge].offsetWidth;
      slotEls[edge].classList.add('shake');
      say('hint', H.insulator);
      talk(H.insulator);
    }
    const ev = paint();
    if (!INSULATORS.includes(type) && !ev.lit && ev.full && shown.some((p) => p.type === 'switch') && !closed) {
      say('hint', H.switch);
      talk(H.switch);
    } else if (!INSULATORS.includes(type) && !ev.lit && ev.full) {
      say('hint', H.incomplete);
    }
    after(ev);
  }

  function onSlot(edge) {
    if (solved) return;
    const id = placed[edge];
    if (selected) return place(edge, selected);
    if (!id) return;
    if (tray[id].type === 'switch') {
      closed = !closed;
      try {
        audio.play('tap');
      } catch {
        /* sessiz */
      }
      return after(paint());
    }
    placed[edge] = null; // dokununca parca tepsiye doner
    try {
      audio.play('tap');
    } catch {
      /* sessiz */
    }
    paint();
  }

  // ---- Dokunma / surukleme ----
  let ghost = null;
  const slotAt = (x, y) => document.elementsFromPoint(x, y).map((n) => n.closest?.('.cx-slot')).find(Boolean) || null;
  tilesEl.addEventListener('pointerdown', (e) => {
    const tile = e.target.closest('.cx-tile');
    if (!tile || solved || e.button > 0) return;
    const part = tile.dataset.part;
    const sx = e.clientX;
    const sy = e.clientY;
    let drag = false;
    const mv = (ev) => {
      if (!drag && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 9) {
        drag = true;
        ghost = document.createElement('div');
        ghost.className = 'cx-ghost';
        ghost.innerHTML = partSvg(tray[part].type);
        document.body.appendChild(ghost);
        tile.classList.add('dragging');
      }
      if (drag && ghost) {
        ghost.style.left = `${ev.clientX}px`;
        ghost.style.top = `${ev.clientY}px`;
        Object.values(slotEls).forEach((s) => s.classList.remove('over'));
        slotAt(ev.clientX, ev.clientY)?.classList.add('over');
      }
    };
    const end = (ev) => {
      window.removeEventListener('pointermove', mv);
      window.removeEventListener('pointerup', end);
      window.removeEventListener('pointercancel', end);
      Object.values(slotEls).forEach((s) => s.classList.remove('over'));
      if (drag) {
        ghost?.remove();
        ghost = null;
        tile.classList.remove('dragging');
        const s = ev.type === 'pointerup' ? slotAt(ev.clientX, ev.clientY) : null;
        if (s) place(s.dataset.edge, part);
        else paint();
      } else if (ev.type === 'pointerup') {
        selected = selected === part ? null : part;
        if (selected) {
          try {
            audio.play('pick'); // V8.5: parca secme sesi (kisa, yumusak; hizli dokunusta MIN_GAP_MS ile sinirli)
          } catch {
            /* sessiz */
          }
        }
        paint();
      }
    };
    window.addEventListener('pointermove', mv);
    window.addEventListener('pointerup', end);
    window.addEventListener('pointercancel', end);
  });
  // Klavye/erisilebilirlik: dokunma olayi olmadan (detail=0) tiklama
  tilesEl.addEventListener('click', (e) => {
    const tile = e.target.closest('.cx-tile');
    if (!tile || solved || e.detail !== 0) return;
    selected = selected === tile.dataset.part ? null : tile.dataset.part;
    if (selected) {
      try {
        audio.play('pick');
      } catch {
        /* sessiz */
      }
    }
    paint();
  });
  root.querySelector('.cx-board').addEventListener('click', (e) => {
    const s = e.target.closest('.cx-slot');
    if (s) onSlot(s.dataset.edge);
  });
  root.querySelector('[data-act="reset"]').addEventListener('click', () => {
    if (solved) return;
    for (const e of Object.keys(placed)) placed[e] = (task.board.preset || {})[e] || null;
    selected = null;
    closed = false;
    phase2 = false;
    noResHint = false;
    sayEl.textContent = H.start || task.say;
    paint();
  });
  finishBtn.addEventListener('click', () => !dead && onSolved({ mistakes }));
  paint();
  return {
    destroy() {
      dead = true;
      ghost?.remove();
    },
    state: () => ({ placed: { ...placed }, closed, mistakes, solved })
  };
}
