// Elektrik Dedektifi gorev ekrani (kabuk: games/tasks/shell.js). Devre cizimi ve benzetimi Mucit Atolyesi / Sekli Tamamla ile AYNI
// (boardSvg, analyze); o dosyalara dokunulmaz. Uc vaka turu: missing (eksik parcayi sec), build (baglantiyi tamamla), fault (ariza yerini bul).
import { boardSvg, tileSvg } from '../shape-complete/circuit-render.js';
import { analyze } from '../invent/logic.js';
import { startState, partsOf, evaluate, placeOption, tapFault, healthyHint, hintFor } from './logic.js';

const TOOL_NAME = { wire: 'Kablo', led: 'LED', resistor: 'Direnç', switch: 'Anahtar', erase: 'Sil' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function makeDetectiveView(task, env) {
  const { data, T, prompt, ctl } = env;
  const inv = data.game.invent;
  const st = startState(task);
  let slots = st.slots;
  let states = st.states;
  let tool = null;
  let hintSlots = new Set();
  let switchHint = false;
  let assistOpt = null; // missing: vurgulanan dogru secenek
  let fixed = []; // fault: duzeltilen konumlar
  let over = false; // cozuldu: tahta dokunulmaz
  const optOrder = task.kind === 'missing' ? env.rng.shuffle(task.options) : []; // secenek sirasi gorev boyunca sabit
  const L = inv.layouts[task.layout];
  const ledColors = Object.fromEntries(L.slots.map((s, i) => [s.id, data.colors.ledColors[i % data.colors.ledColors.length]]));

  // Dokunulabilir alanlar: dolu konumlar da (kablo/LED/direnc) dokunulabilir; bos konumu ve anahtari tahta kendisi cizer
  function hits(parts) {
    const N = data.circuits.layouts[L.id];
    let g = '';
    parts.forEach((p, idx) => {
      if (!p.type || p.type === 'battery' || p.type === 'switch') return;
      const i = idx - 1;
      if ((task.fixed || []).includes(i)) return;
      const [ax, ay] = N[p.a];
      const [bx, by] = N[p.b];
      const len = Math.hypot(bx - ax, by - ay);
      const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
      const w = Math.min(Math.max(len - 12, 36), 56);
      g += `<g transform="translate(${(ax + bx) / 2} ${(ay + by) / 2}) rotate(${ang.toFixed(1)})"><rect class="inv-hit${hintSlots.has(p.id) ? ' hint' : ''}" data-slot="${p.id}" x="${-w / 2}" y="-20" width="${w}" height="40" rx="10"/></g>`;
    });
    return g;
  }

  function paintBoard() {
    const { parts } = partsOf(inv, task, slots, states);
    const a = analyze(parts);
    const round = { nodes: data.circuits.layouts[L.id], viewBox: data.circuits.viewBox, parts, ledColors, silhouette: false };
    const v = { powered: a.closed, armed: task.kind === 'missing' ? !over : !!tool, hintSlots, pop: null, switchHint };
    let svg = boardSvg(round, v, a.sim);
    // build: dolu konumlar silinebilsin; fault: her konum dokunulabilir (ariza arama)
    if (!over && (task.kind === 'build' || task.kind === 'fault')) svg = svg.replace('</svg>', `<g class="inv-hits">${hits(parts)}</g></svg>`);
    prompt.innerHTML = svg;
    prompt.dataset.lit = String(a.lit);
  }

  function paintCtl() {
    if (over) return;
    if (task.kind === 'missing') {
      ctl.innerHTML = `<div class="inv-tray" role="toolbar" aria-label="Parçalar">${optOrder
        .map((o) => `<button class="tile inv-tool${assistOpt === o ? ' hint' : ''}" data-opt="${o}" aria-label="${TOOL_NAME[o]}">${tileSvg(o, data.colors.ledColors[0].hex)}</button>`)
        .join('')}</div>`;
    } else if (task.kind === 'build') {
      ctl.innerHTML = `<div class="inv-tray" role="toolbar" aria-label="Parçalar">${[...task.tools, 'erase']
        .map((t) =>
          t === 'erase'
            ? `<button class="tile inv-tool${tool === 'erase' ? ' selected' : ''}" data-tool="erase" aria-label="${TOOL_NAME.erase}" aria-pressed="${tool === 'erase'}"><span class="inv-erase" aria-hidden="true">🧽</span></button>`
            : `<button class="tile inv-tool${tool === t ? ' selected' : ''}" data-tool="${t}" aria-label="${TOOL_NAME[t]}" aria-pressed="${tool === t}">${tileSvg(t, data.colors.ledColors[0].hex)}</button>`
        )
        .join('')}</div>`;
    } else ctl.innerHTML = '';
  }

  function win() {
    over = true;
    hintSlots = new Set();
    switchHint = false;
    paintBoard(); // lamba yanar
    env.solved({ sound: 'circuitOn', text: task.win || T.solved });
  }

  // ---- missing: bir secenek secildi
  function pickOption(type) {
    if (over) return;
    const r = placeOption(inv, task, type);
    if (r.ok) {
      slots = r.slots;
      states = r.states;
      return win();
    }
    const key = r.key;
    env.wrong(`opt:${type}`, hintFor(task, T, type, key), task.hint2);
    const btn = ctl.querySelector(`[data-opt="${type}"]`);
    btn?.classList.add('soft');
    btn?.setAttribute('aria-disabled', 'true');
  }

  // ---- build
  function afterEdit() {
    hintSlots = new Set();
    paintBoard();
    paintCtl();
    const r = evaluate(inv, task, slots, states);
    if (r.ok) return win();
    env.wrong(`key:${r.key}`, hintFor(task, T, r.key, r.key), task.hint2);
  }
  function slotTapBuild(id) {
    const i = L.slots.findIndex((q) => q.id === id);
    if (i < 0 || (task.fixed || []).includes(i)) return;
    const cur = slots[i];
    if (tool === 'erase' || (!tool && cur)) {
      if (!cur) return;
      slots[i] = null;
      delete states[id];
      env.sfx('tap');
      env.progress();
      return afterEdit();
    }
    if (!tool) {
      env.sfx('gentle');
      env.say('tk_pick', T.pick);
      return;
    }
    if (cur === tool) return;
    slots[i] = tool;
    if (tool === 'switch') states[id] = 'open';
    else delete states[id];
    env.sfx('place');
    env.progress();
    afterEdit();
  }
  function switchTapBuild(id) {
    if (tool === 'erase') return slotTapBuild(id);
    if ((task.fixed || []).includes(Number(id.slice(1)) - 1)) return;
    states[id] = states[id] === 'closed' ? 'open' : 'closed';
    env.sfx('tap');
    env.progress();
    afterEdit();
  }

  // ---- fault
  function tapFaultSlot(id) {
    if (fixed.includes(id)) return;
    const r = tapFault(task, slots, states, fixed, id);
    if (r.hit) {
      slots = r.slots;
      states = r.states;
      fixed = r.fixed;
      env.sfx('place');
      env.progress();
      hintSlots = new Set();
      switchHint = false;
      paintBoard();
      const e = evaluate(inv, task, slots, states);
      if (e.ok) return win();
      env.say('tk_partial', T.partial);
      return;
    }
    env.wrong(`slot:${id}`, healthyHint(task, T, slots, states, id), task.hint2);
  }

  function onClick(e) {
    if (over) return;
    const t = e.target;
    if (task.kind === 'missing') {
      const o = t.closest('[data-opt]');
      if (o && o.getAttribute('aria-disabled') !== 'true') pickOption(o.dataset.opt);
      return;
    }
    if (task.kind === 'build') {
      const tb = t.closest('[data-tool]');
      if (tb) {
        tool = tool === tb.dataset.tool ? null : tb.dataset.tool;
        env.sfx('tap');
        paintBoard();
        paintCtl();
        return;
      }
    }
    const sw = t.closest('[data-switch]');
    if (sw) return task.kind === 'fault' ? tapFaultSlot(sw.dataset.switch) : switchTapBuild(sw.dataset.switch);
    const sl = t.closest('[data-slot]');
    if (sl) return task.kind === 'fault' ? tapFaultSlot(sl.dataset.slot) : slotTapBuild(sl.dataset.slot);
  }

  // 3. yanlistan sonra gorsel yardim (cevabi dokunmadan, yalniz vurgu)
  function assist() {
    if (over) return;
    if (task.kind === 'missing') {
      assistOpt = task.answer[0];
      paintCtl();
    } else if (task.kind === 'fault') {
      const open = (task.culprits || []).filter((c) => !fixed.includes(c.slot));
      hintSlots = new Set(open.filter((c) => c.fix !== 'close').map((c) => c.slot));
      switchHint = open.some((c) => c.fix === 'close');
      paintBoard();
    } else {
      hintSlots = new Set(L.slots.filter((s, i) => !slots[i]).map((s) => s.id));
      paintBoard();
    }
  }

  return {
    start() {
      paintBoard();
      paintCtl();
    },
    onClick,
    assist,
    destroy() {}
  };
}
