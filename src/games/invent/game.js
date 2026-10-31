// Mucit Atolyesi denetleyicisi: serbest devre kurma + canli sonuc + kesifler + buluslarim. Mantik logic.js'te.
// Devre cizimi ve benzetimi Sekli Tamamla'dakiyle AYNI (boardSvg / simulate); o oyunun koduna dokunulmaz.
import { boardSvg, tileSvg } from '../shape-complete/circuit-render.js';
import { buildParts, analyze, hintFor, discoveriesIn, switchDiscovery, signature, TOOLS } from './logic.js';

const GAME_ID = 'invent';
const IDLE_MS = 12000;
const TOOL_NAME = { wire: 'Kablo', led: 'LED', resistor: 'Direnç', switch: 'Anahtar', erase: 'Sil' };

export function createGame(ctx) {
  const { data, storage, audio, voice, exit, registerBack } = ctx;
  let unregBack = null;
  const inv = data.game[GAME_ID];
  const T = inv.text;
  const nodesOf = (id) => data.circuits.layouts[id];

  let root = null;
  const el = {};
  let layoutId = 'loop';
  const boards = {}; // layoutId -> [tip|null]
  let states = {}; // slotId -> 'open'|'closed'
  let tool = null; // null | 'wire'|'led'|'resistor'|'switch'|'erase'
  let prev = null; // onceki cozumleme (gecis algilama)
  let hint = { slots: new Set(), switchHint: false, tool: null };
  let idleTimer = null;
  let dead = false;
  const timers = new Set();

  const layout = () => inv.layouts[layoutId];
  const slotsNow = () => (boards[layoutId] ||= Array(layout().slots.length).fill(null));
  const found = () => new Set(storage.getGame(GAME_ID).found || []);
  const saved = () => storage.getGame(GAME_ID).saved || [];

  const later = (fn, ms) => {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) fn();
    }, ms);
    timers.add(t);
  };

  function ledColors(L) {
    const pal = data.colors.ledColors;
    const out = {};
    L.slots.forEach((s, i) => (out[s.id] = pal[i % pal.length]));
    return out;
  }

  function mount(container) {
    root = container;
    root.innerHTML = `
      <section class="play inv" data-band="${storage.get().band}">
        <header class="bar">
          <button class="btn icon" data-act="home" aria-label="Ana ekran"><span aria-hidden="true">🏠</span></button>
          <div class="level inv-stars" aria-hidden="true"></div>
          <button class="btn icon" data-act="speak" aria-label="Tekrar dinle"><span aria-hidden="true">🔊</span></button>
        </header>
        <main class="stage">
          <div class="prompt kind-circuit"></div>
          <p class="cap" aria-live="polite"></p>
          <div class="inv-side">
            <div class="inv-tray" role="toolbar" aria-label="Parçalar"></div>
            <div class="inv-acts"></div>
          </div>
        </main>
        <div class="overlay" hidden></div>
      </section>`;
    for (const k of ['prompt', 'cap', 'overlay']) el[k] = root.querySelector(`.${k === 'prompt' ? 'prompt' : k}`);
    el.stars = root.querySelector('.inv-stars');
    el.tray = root.querySelector('.inv-tray');
    el.acts = root.querySelector('.inv-acts');
    root.addEventListener('click', onClick);
    root.addEventListener('pointerdown', onPointer, { passive: true });
    window.addEventListener('popstate', onPop);
    // Fiziksel Geri tusu: Buluslarim acikse yalniz onu kapatir (true), degilse app.js oyundan cikarir.
    unregBack = registerBack ? registerBack(() => (mineOpen ? (closeMine(), true) : false)) : null;
    // Sayfa 'Buluslarim' acikken yeniden yuklendiyse gecmiste ölü bir cekmece girdisi kalir (Geri bir kez bosa basar): at.
    try {
      if (history.state && history.state.invMine) history.back();
    } catch {
      /* yoksay */
    }
    paint();
    say('intro');
  }

  function unmount() {
    dead = true;
    clearTimeout(idleTimer);
    timers.forEach(clearTimeout);
    timers.clear();
    voice.stop();
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('pointerdown', onPointer);
      root.innerHTML = '';
    }
    window.removeEventListener('popstate', onPop);
    unregBack?.();
    unregBack = null;
    mineOpen = false;
    editing = null;
  }

  // ---- Cizim --------------------------------------------------------------------------
  function overlayHits(L, parts) {
    const N = nodesOf(L.id);
    let g = '';
    for (const p of parts) {
      if (!p.type || p.type === 'battery' || p.type === 'switch') continue;
      const [ax, ay] = N[p.a];
      const [bx, by] = N[p.b];
      const len = Math.hypot(bx - ax, by - ay);
      const ang = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI;
      const w = Math.min(Math.max(len - 12, 36), 56);
      g += `<g transform="translate(${(ax + bx) / 2} ${(ay + by) / 2}) rotate(${ang.toFixed(1)})"><rect class="inv-hit" data-slot="${p.id}" x="${-w / 2}" y="-20" width="${w}" height="40" rx="10"/></g>`;
    }
    return g;
  }

  function paint() {
    const L = layout();
    const parts = buildParts(L, slotsNow(), states);
    const a = analyze(parts);
    const round = { nodes: nodesOf(L.id), viewBox: data.circuits.viewBox, parts, ledColors: ledColors(L), silhouette: false };
    const view = {
      powered: a.closed,
      armed: !!tool && tool !== 'erase',
      hintSlots: hint.slots,
      pop: null,
      switchHint: hint.switchHint
    };
    el.prompt.innerHTML = boardSvg(round, view, a.sim).replace('</svg>', `<g class="inv-hits">${overlayHits(L, parts)}</g></svg>`);
    el.prompt.dataset.lit = String(a.lit);
    el.prompt.dataset.short = a.short ? '1' : '0';
    paintTray();
    paintActs();
    paintStars();
    return a;
  }

  function paintTray() {
    el.tray.innerHTML =
      TOOLS.map(
        (t) =>
          `<button class="tile inv-tool${tool === t ? ' selected' : ''}${hint.tool === t ? ' glow-hint' : ''}" data-tool="${t}" aria-label="${TOOL_NAME[t]}" aria-pressed="${tool === t}">${tileSvg(t, data.colors.ledColors[0].hex)}</button>`
      ).join('') +
      `<button class="tile inv-tool${tool === 'erase' ? ' selected' : ''}" data-tool="erase" aria-label="${TOOL_NAME.erase}" aria-pressed="${tool === 'erase'}"><span class="inv-erase" aria-hidden="true">🧽</span></button>`;
  }

  function paintActs() {
    const layoutBtns = Object.values(inv.layouts)
      .map((l) => `<button class="btn icon inv-act${l.id === layoutId ? ' on' : ''}" data-act="layout" data-layout="${l.id}" aria-label="Tahta: ${l.id}" aria-pressed="${l.id === layoutId}"><span aria-hidden="true">${l.icon}</span></button>`)
      .join('');
    el.acts.innerHTML =
      layoutBtns +
      `<button class="btn icon inv-act" data-act="clear" aria-label="Temizle"><span aria-hidden="true">🧹</span></button>` +
      `<button class="btn icon inv-act" data-act="hint" aria-label="İpucu"><span aria-hidden="true">💡</span></button>` +
      `<button class="btn icon inv-act" data-act="save" aria-label="Buluşu kaydet"><span aria-hidden="true">⭐</span></button>` +
      `<button class="btn icon inv-act" data-act="mine" aria-label="Buluşlarım"><span aria-hidden="true">📂</span></button>`;
  }

  function paintStars() {
    const f = found();
    el.stars.innerHTML = inv.discoveries.map((d) => `<span class="inv-star${f.has(d.id) ? ' on' : ''}" title="${d.tr}">${d.icon}</span>`).join('');
  }

  // ---- Konusma / yazi ------------------------------------------------------------------
  const say = (key, speak = true) => {
    el.cap.textContent = T[key] || '';
    if (speak && T[key]) voice.say(`inv_${key}`, undefined, T[key]);
  };

  // ---- Ipuclari (cevabi dayatmaz; dikkati yonlendirir) -----------------------------------
  function clearHint() {
    hint = { slots: new Set(), switchHint: false, tool: null };
  }
  function showHint(speak) {
    const a = analyze(buildParts(layout(), slotsNow(), states));
    const h = hintFor(a);
    clearHint();
    if (h.focus === 'led') hint.tool = 'led';
    if (h.focus === 'switch') hint.switchHint = true;
    if (h.focus === 'gaps') hint.slots = new Set(a.gaps);
    paint();
    say(h.key, speak);
  }
  function armIdle() {
    clearTimeout(idleTimer);
    if (dead) return;
    idleTimer = setTimeout(() => {
      const a = analyze(buildParts(layout(), slotsNow(), states));
      if (a.lit === 0 && !dead) showHint(false);
    }, IDLE_MS);
  }

  // ---- Degisiklik sonrasi: canli sonuc, kesifler ---------------------------------------------
  function afterChange({ switched = false } = {}) {
    clearHint();
    const L = layout();
    const a = paint();
    const before = prev;
    prev = a;
    // Kesifler
    const f = found();
    const fresh = discoveriesIn(a, L.id).filter((id) => !f.has(id));
    if (switched && before && switchDiscovery(before, a) && !f.has('switch')) fresh.push('switch');
    if (a.lit > 0 && !a.short) {
      if (!before || before.lit === 0) audio.play('circuitOn');
    } else if (a.short && (!before || !before.short)) audio.play('gentle');
    if (fresh.length) {
      fresh.forEach((id) => f.add(id));
      storage.updateGame(GAME_ID, { correct: f.size, found: [...f] });
      paintStars();
      const names = fresh.map((id) => inv.discoveries.find((d) => d.id === id)?.tr).filter(Boolean).join(', ');
      el.cap.textContent = `${T.new} ${names}`;
      later(() => audio.play('success'), 350);
      voice.say('inv_new', undefined, `${T.new} ${names}`);
    } else {
      const h = hintFor(a);
      // Sonuc yazisi (sessiz): kurulan devrenin durumunu anlatir; konusma sadece ilk isikta
      el.cap.textContent = T[h.key] || '';
      if (a.lit > 0 && !a.short && (!before || before.lit === 0)) voice.say('inv_lit', undefined, T.lit);
      if (a.short && (!before || !before.short)) voice.say('inv_short', undefined, T.short);
      if (a.weak && (!before || !before.weak)) voice.say('inv_weak', undefined, T.weak);
    }
    armIdle();
  }

  // ---- Eylemler ------------------------------------------------------------------------------
  function slotIndex(id) {
    return layout().slots.findIndex((s) => s.id === id);
  }

  function slotTap(id) {
    const i = slotIndex(id);
    if (i < 0) return;
    const slots = slotsNow();
    const cur = slots[i];
    if (tool === 'erase' || (!tool && cur)) {
      if (!cur) return;
      slots[i] = null;
      delete states[id];
      audio.play('tap');
      return afterChange();
    }
    if (!tool) {
      // Parca secilmeden bosluga dokunuldu: nazikce tepsiyi vurgula
      hint = { slots: new Set(), switchHint: false, tool: 'led' };
      paint();
      say('pick', false);
      audio.play('gentle');
      return armIdle();
    }
    if (cur === tool) return;
    slots[i] = tool;
    if (tool === 'switch') states[id] = 'open';
    else delete states[id];
    audio.play('place');
    afterChange();
  }

  function switchTap(id) {
    if (tool === 'erase') return slotTap(id);
    states[id] = states[id] === 'closed' ? 'open' : 'closed';
    audio.play('tap');
    afterChange({ switched: true });
  }

  function setTool(t) {
    tool = tool === t ? null : t;
    clearHint();
    audio.play('tap');
    paint();
    armIdle();
  }

  function clearBoard() {
    boards[layoutId] = Array(layout().slots.length).fill(null);
    states = {};
    prev = null;
    editing = null;
    audio.play('tap');
    afterChange();
    say('cleared');
  }

  function setLayout(id) {
    if (id === layoutId || !inv.layouts[id]) return;
    layoutId = id;
    states = {};
    prev = null;
    tool = null;
    editing = null;
    audio.play('tap');
    afterChange();
  }

  // ---- Buluslar: en fazla 6, sessizce silme YOK, duzenleyip tekrar kaydedince guncelleme, basarisiz kayitta basari mesaji YOK ----
  const MAX_SAVED = 6;
  let editing = null; // yuklenen / yeni kaydedilen buluşun sirasi (tekrar kaydedince guncellenir)
  let mineOpen = false;

  const entryOf = () => ({ layout: layoutId, slots: slotsNow().slice(), sw: layout().slots.map((s) => (states[s.id] === 'closed' ? 'closed' : 'open')) });
  const sigOf = (e) => signature(e.layout, e.slots, Object.fromEntries((e.slots || []).map((_, i) => [`s${i + 1}`, e.sw?.[i]])));
  const validEntry = (e) => !!e && !!inv.layouts[e.layout] && Array.isArray(e.slots) && e.slots.length === inv.layouts[e.layout].slots.length;

  // Yazma gercekten basarili oldu mu? Olmadiysa onceki liste geri yuklenir (ekranda hayalet kayit kalmaz)
  function persistSaved(list) {
    const before = saved();
    storage.updateGame(GAME_ID, { saved: list });
    if (!storage.saveOk() || saved().length !== list.length) {
      storage.updateGame(GAME_ID, { saved: before });
      return false;
    }
    return true;
  }

  function saveCurrent() {
    const a = analyze(buildParts(layout(), slotsNow(), states));
    if (!(a.lit > 0 && !a.short)) {
      audio.play('gentle');
      return say('savefirst');
    }
    const entry = entryOf();
    const mine = saved();
    const dup = mine.findIndex((e) => validEntry(e) && sigOf(e) === sigOf(entry));
    if (dup >= 0) {
      editing = dup;
      audio.play('correct');
      return say('saved'); // ayni buluş zaten kayitli: yeni kayit olusturulmaz
    }
    let list;
    let key = 'saved';
    if (editing !== null && mine[editing]) {
      list = mine.slice();
      list[editing] = entry; // guncelle
      key = 'updated';
    } else if (mine.length >= MAX_SAVED) {
      audio.play('gentle');
      return say('full'); // mevcut kayitlar korunur
    } else {
      list = [...mine, entry];
    }
    if (!persistSaved(list)) {
      audio.play('gentle');
      return say('savefail');
    }
    if (key === 'saved') editing = list.length - 1;
    audio.play('correct');
    say(key);
  }

  function hideMine() {
    el.overlay.hidden = true;
    el.overlay.innerHTML = '';
  }
  // Android Geri tusu: Buluslarim acikken once onu kapatir (bir gecmis girdisi eklenir/silinir)
  const onPop = () => {
    if (mineOpen) {
      mineOpen = false;
      hideMine();
    }
  };
  function closeMine() {
    hideMine();
    if (mineOpen) {
      mineOpen = false;
      try {
        history.back();
      } catch {
        /* yoksay */
      }
    }
  }

  function openMine() {
    const mine = saved();
    el.overlay.hidden = false;
    const items = mine
      .map((e, i) => {
        const del = `<button class="btn icon inv-del" data-act="del" data-i="${i}" aria-label="Sil"><span aria-hidden="true">🗑</span></button>`;
        if (!validEntry(e)) return `<div class="inv-item"><span class="tile inv-save broken" aria-label="Açılamayan buluş"><span aria-hidden="true">❔</span></span>${del}</div>`;
        const L = inv.layouts[e.layout];
        const st = Object.fromEntries(L.slots.map((s, k) => [s.id, e.sw?.[k]]));
        const parts = buildParts(L, e.slots, st);
        const a = analyze(parts);
        const round = { nodes: nodesOf(L.id), viewBox: data.circuits.viewBox, parts, ledColors: ledColors(L), silhouette: false };
        return `<div class="inv-item"><button class="tile inv-save${editing === i ? ' selected' : ''}" data-act="load" data-i="${i}" aria-label="Buluş ${i + 1}">${boardSvg(round, { powered: a.closed, hintSlots: new Set() }, a.sim)}</button>${del}</div>`;
      })
      .join('');
    el.overlay.innerHTML = `<div class="inv-mine"><div class="inv-mine-grid">${items || `<p class="inv-empty">${T.empty}</p>`}</div><button class="btn icon" data-act="closeMine" aria-label="Kapat"><span aria-hidden="true">✖</span></button></div>`;
    if (!mineOpen) {
      mineOpen = true;
      try {
        history.pushState({ invMine: 1 }, '');
      } catch {
        mineOpen = false;
      }
    }
  }

  function deleteSaved(i) {
    const mine = saved();
    if (!mine[i]) return;
    const list = mine.filter((_, k) => k !== i);
    if (!persistSaved(list)) {
      audio.play('gentle');
      return say('savefail');
    }
    if (editing === i) editing = null;
    else if (editing !== null && editing > i) editing -= 1;
    audio.play('tap');
    openMine();
    el.cap.textContent = T.removed;
  }

  function loadSaved(i) {
    const e = saved()[i];
    if (!validEntry(e)) {
      closeMine();
      audio.play('gentle');
      return say('broken');
    }
    layoutId = e.layout;
    boards[layoutId] = e.slots.slice();
    states = Object.fromEntries(layout().slots.map((s, k) => [s.id, e.sw?.[k]]).filter(([, v]) => v === 'closed'));
    tool = null;
    prev = null;
    editing = i;
    closeMine();
    audio.play('place');
    afterChange();
  }

  // ---- Olaylar ---------------------------------------------------------------------------------
  function onPointer() {
    audio.unlock();
    armIdle();
  }

  function onClick(e) {
    const t = e.target;
    const act = t.closest('[data-act]');
    if (act) {
      const a = act.dataset.act;
      if (a === 'home') return exit();
      if (a === 'speak') return voice.say('inv_intro', undefined, el.cap.textContent || T.intro);
      if (a === 'hint') return showHint(true);
      if (a === 'clear') return clearBoard();
      if (a === 'save') return saveCurrent();
      if (a === 'mine') return openMine();
      if (a === 'closeMine') return closeMine();
      if (a === 'load') return loadSaved(Number(act.dataset.i));
      if (a === 'del') return deleteSaved(Number(act.dataset.i));
      if (a === 'layout') return setLayout(act.dataset.layout);
    }
    if (!el.overlay.hidden) return;
    const toolBtn = t.closest('[data-tool]');
    if (toolBtn) return setTool(toolBtn.dataset.tool);
    const sw = t.closest('[data-switch]');
    if (sw) return switchTap(sw.dataset.switch);
    const slot = t.closest('[data-slot]');
    if (slot) return slotTap(slot.dataset.slot);
  }

  return { mount, unmount };
}
