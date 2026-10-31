// "Şekli Tamamla" oyun denetleyicisi: tur akisi, dokunma, geri bildirim, ipuclari.
// Mantik saf modullerde (rounds / circuit-*); burasi sadece DOM + zamanlama.
import { makeGeometryRound, planKind } from './rounds.js';
import { makeCircuitRound, advanceCircuit, allFilled } from './circuit-rounds.js';
import { simulate } from './circuit-sim.js';
import { sceneToSvg } from './render.js';
import { boardSvg, tileSvg, TYPE_NAME } from './circuit-render.js';
import { levelFor, didLevelUp, contentFor } from '../../core/progress.js';
import { SOUND_MS } from '../../core/audio.js';

const IDLE_MS = 9000;
const NEXT_MS = 1100;

export function createGame(ctx) {
  const { data, storage, audio, voice, rng, exit } = ctx;
  const levels = data.levels;

  let root = null;
  const el = {};
  let round = null;
  let index = 0;
  let prevId = null;
  let prevKind = null;
  let locked = false;
  let wrong = 0;
  let selected = null; // devre: secili komponent karosu
  let chosen = null; // V7.3: sesli okunan/vurgulanan secenek indeksi (TEK gercek secim durumu; ses ve parlak vurgu buradan turer)
  let lastSpoken = { i: -1, t: 0 };
  let pendingPlace = null; // tek bos konumda kisa vurgu sonrasi yerlestirme zamanlayicisi
  let cview = null; // devre gorunum durumu
  let idleTimer = null;
  let idleStep = 0;
  let overlayClose = null;
  let dead = false;
  const timers = new Set();

  const band = () => storage.get().band;
  // Zorluk kademesi: seviyenin bu oyun icin icerik kaydindan (levels.json) gelir
  const level = () => contentFor(levelFor(storage.get().correct, levels).level, 'shape-complete')?.tier ?? 0;
  const tiles = () => [...el.options.querySelectorAll('.tile')];

  function later(fn, ms) {
    const t = setTimeout(() => {
      timers.delete(t);
      if (!dead) fn();
    }, ms);
    timers.add(t);
    return t;
  }
  function clearTimers() {
    timers.forEach(clearTimeout);
    timers.clear();
    clearTimeout(idleTimer);
  }

  // ---- V7.3: sesli secenek + tek durumlu parlak vurgu -----------------------------
  const NAME_GLOW_MS = 450; // tek bos konumda: adi okunurken kart kisaca parlar, sonra yerlesir
  const nameOfOption = (o) => {
    if (!o) return '';
    if (o.type) return TYPE_NAME[o.type] || '';
    const k = String(o.key || '');
    if (k.startsWith('col:')) return data.colors.palette.find((c) => c.id === k.slice(4))?.tr || '';
    if (k.startsWith('shape:')) return data.shapes.shapes[k.slice(6)]?.label || '';
    return ''; // adi olmayan secenek turleri (eksik parca, desen, donme, simetri): okunmaz
  };
  // Tek durumdan turetilir: ayni anda en fazla bir kart `chosen` olur (yanlis/dogru geri bildirimiyle cakismaz)
  function syncChosen() {
    tiles().forEach((t, k) => {
      const on = k === chosen;
      t.classList.toggle('chosen', on);
      if (t.dataset.type) t.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
  function clearChosen() {
    chosen = null;
    if (pendingPlace) {
      clearTimeout(pendingPlace);
      timers.delete(pendingPlace);
      pendingPlace = null;
    }
    if (el.options) syncChosen();
  }
  // Dokunulan secenegin adini Turkce okutur (yeni konusma onceki konusmayi keser) ve yazili olarak da gosterir
  function chooseOption(i, name) {
    chosen = i;
    syncChosen();
    if (!name) return;
    el.cap.textContent = name; // ses kapaliysa/Turkce ses yoksa da hangi secenegin secildigi yazili gorunur
    const now = Date.now();
    if (lastSpoken.i === i && now - lastSpoken.t < 800) return; // ayni karta hizli tekrar: tekrar baslatma
    lastSpoken = { i, t: now };
    try {
      voice.say('opt', undefined, name);
    } catch {
      /* ses hatasi oyunu durdurmaz */
    }
  }

  // ---- Kabuk -----------------------------------------------------------------
  function mount(container) {
    root = container;
    root.innerHTML = `
      <section class="play" data-band="${band()}">
        <header class="bar">
          <button class="btn icon" data-act="home" aria-label="Ana ekran"><span aria-hidden="true">🏠</span></button>
          <div class="level" aria-hidden="true"><span class="lv-emoji"></span><span class="lv-name"></span><span class="meter"><i></i></span></div>
          <button class="btn icon" data-act="speak" aria-label="Tekrar dinle"><span aria-hidden="true">🔊</span></button>
        </header>
        <main class="stage"><div class="prompt"></div><p class="cap" aria-hidden="true"></p><div class="options"></div></main>
        <div class="overlay" hidden></div>
      </section>`;
    el.play = root.querySelector('.play');
    el.prompt = root.querySelector('.prompt');
    el.options = root.querySelector('.options');
    el.cap = root.querySelector('.cap');
    el.overlay = root.querySelector('.overlay');
    el.emoji = root.querySelector('.lv-emoji');
    el.name = root.querySelector('.lv-name');
    el.meter = root.querySelector('.meter i');
    root.addEventListener('click', onClick);
    root.addEventListener('pointerdown', onPointer, { passive: true });
    paintLevel();
    nextRound();
  }

  function unmount() {
    dead = true;
    clearTimers();
    voice.stop();
    if (root) {
      root.removeEventListener('click', onClick);
      root.removeEventListener('pointerdown', onPointer);
      root.innerHTML = '';
    }
  }

  function paintLevel() {
    const { level: lv, fraction } = levelFor(storage.get().correct, levels);
    el.emoji.textContent = lv.emoji;
    el.name.textContent = lv.name;
    el.meter.style.width = `${Math.round(fraction * 100)}%`;
  }

  // ---- Tur akisi -------------------------------------------------------------
  function nextRound() {
    clearTimers();
    locked = false;
    wrong = 0;
    selected = null;
    chosen = null;
    pendingPlace = null;
    lastSpoken = { i: -1, t: 0 };
    idleStep = 0;
    el.prompt.classList.remove('solved');
    if (planKind(index) === 'circuit') {
      round = makeCircuitRound({ data, rng, band: band(), circuitState: storage.get().circuit[band()] });
      renderCircuit();
    } else {
      round = makeGeometryRound({ data, rng, band: band(), level: level(), prevId, prevKind });
      renderGeometry();
    }
    prevId = round.id;
    prevKind = round.kind;
    index += 1;
    announce();
    armIdle();
  }

  // Kisa yazili yonerge + Turkce sesli yonerge (ses calismazsa gorsel/yazili yonerge kalir)
  function announce() {
    el.cap.textContent = data.strings.voice[round.voice] || '';
    voice.say(round.voice);
  }

  function award() {
    const before = storage.get().correct;
    const after = storage.update({ correct: before + 1 }).correct;
    paintLevel();
    return didLevelUp(before, after, levels);
  }

  function finishRound(levelUp) {
    if (!levelUp) return nextRound();
    audio.play('levelUp');
    el.overlay.hidden = false;
    el.overlay.innerHTML = `<div class="lvlup"><div class="lv-big">${levelUp.emoji}</div><div class="lv-title">${levelUp.name}</div></div>`;
    let closed = false;
    overlayClose = () => {
      if (closed) return;
      closed = true;
      el.overlay.hidden = true;
      el.overlay.innerHTML = '';
      overlayClose = null;
      nextRound();
    };
    later(overlayClose, 2600);
  }

  // ---- Bosta kalinca nazik ipucu ---------------------------------------------
  function armIdle() {
    clearTimeout(idleTimer);
    if (locked || dead) return;
    idleTimer = setTimeout(() => {
      if (locked || dead) return;
      idleStep += 1;
      showHint(idleStep);
      if (idleStep < 2) armIdle();
    }, IDLE_MS);
  }

  function showHint(step) {
    if (round.kind === 'circuit') {
      if (cview.switchHint) return;
      if (round.parts.some((p) => p.fault)) {
        if (step === 1) {
          cview.hintFault = true;
          paintBoard();
        }
        return; // 2. adimda bozuk parca bulunduktan sonraki cevap verilmez
      }
      const empties = round.slots.filter((s) => !partOf(s.id).type);
      if (!empties.length) return;
      if (step === 1) {
        empties.forEach((s) => cview.hintSlots.add(s.id));
        paintBoard();
      } else glowTile(empties[0].accepts);
      return;
    }
    if (step === 1) el.prompt.classList.add('hint');
    else if (round.hintMode === 'narrow') dimOneWrong();
    else tiles()[round.answer]?.classList.add('glow-hint');
  }

  // Yeni gorevlerde ipucu cevabi vermez: yanlis seceneklerden birini eler (en az 2 secenek kalir)
  function dimOneWrong() {
    const open = tiles().filter((t, i) => i !== round.answer && !t.classList.contains('dim'));
    const left = tiles().filter((t) => !t.classList.contains('dim')).length;
    if (!open.length || left <= 2) return;
    const t = open[0];
    t.classList.add('dim');
    t.setAttribute('aria-disabled', 'true');
  }

  // ---- Geometri turlari --------------------------------------------------------
  function renderGeometry() {
    el.prompt.className = `prompt kind-${round.kind}`;
    el.prompt.dataset.hint = round.hint;
    delete el.prompt.dataset.stage;
    el.prompt.innerHTML = sceneToSvg(round.prompt, 'scene main');
    el.options.className = `options n${round.options.length}`;
    el.options.innerHTML = round.options
      .map((o, i) => `<button class="tile" data-i="${i}" aria-label="Seçenek ${i + 1}">${sceneToSvg(o.scene, 'scene')}</button>`)
      .join('');
  }

  function geometryTile(i) {
    const tile = tiles()[i];
    if (!tile || tile.classList.contains('dim')) return;
    chooseOption(i, nameOfOption(round.options[i])); // adi olan secenekler (renk/sekil) okunur ve parlar; digerleri yalniz mevcut geri bildirimi alir
    if (i === round.answer) {
      locked = true;
      clearTimeout(idleTimer);
      tile.classList.add('correct');
      if (round.answerTurn) {
        // Merak: dogru secenek donerek hedef sekille ayni konuma gelir ("ayni sekil, sadece donmus")
        tile.style.setProperty('--back', `${-90 * round.answerTurn}deg`);
        tile.classList.add('unrotate');
      }
      tiles().forEach((t) => t !== tile && t.classList.add('faded'));
      audio.play('correct');
      el.prompt.innerHTML = sceneToSvg(round.solvedPrompt, 'scene main');
      el.prompt.classList.remove('hint');
      el.prompt.classList.add('solved');
      const up = award();
      later(() => finishRound(up), NEXT_MS);
      return;
    }
    // Yanlis: ceza yok. Sessiz soluklasir + nazik ipucu (once hedef, sonra dogru secenek)
    wrong += 1;
    tile.classList.add('dim', 'wobble');
    tile.setAttribute('aria-disabled', 'true');
    audio.play('gentle');
    later(() => tile.classList.remove('wobble'), 450);
    later(() => chosen === i && clearChosen(), 700); // gecici secim vurgusu yanlis geri bildirimiyle karismaz
    const remaining = tiles().filter((t) => !t.classList.contains('dim')).length;
    if (round.hintMode === 'narrow') {
      // Yeni gorevler: once hedef vurgulanir, sonra yanlis seceneklerden biri elenir; dogru secenek parlatilmaz
      if (wrong >= 2) dimOneWrong();
      else el.prompt.classList.add('hint');
    } else if (wrong >= 2 || remaining <= 1) tiles()[round.answer].classList.add('glow-hint');
    else el.prompt.classList.add('hint');
    armIdle();
  }

  // ---- Devre turlari -----------------------------------------------------------
  const partOf = (id) => round.parts.find((p) => p.id === id);
  const emptySlots = () => round.slots.filter((s) => !partOf(s.id).type);
  const board = () => el.prompt.querySelector('.board');

  function paintBoard() {
    el.prompt.innerHTML = boardSvg(round, cview, simulate(round.parts));
  }

  function renderCircuit() {
    cview = { powered: round.startPowered, armed: false, hintSlots: new Set(), pop: null, switchHint: false };
    round.options.forEach((o) => (o.used = false));
    el.prompt.className = 'prompt kind-circuit';
    el.prompt.dataset.hint = '';
    el.prompt.dataset.stage = round.stageId;
    paintBoard();
    const ledSlot = round.slots.find((s) => s.accepts === 'led');
    const hex = round.ledColors[ledSlot?.id ?? Object.keys(round.ledColors)[0]]?.hex;
    el.options.className = `options n${round.options.length} tray`;
    el.options.innerHTML = round.options
      .map((o, i) => `<button class="tile comp" data-i="${i}" data-type="${o.type}" aria-label="${TYPE_NAME[o.type]}">${tileSvg(o.type, hex)}</button>`)
      .join('');
  }

  function glowTile(type) {
    const i = round.options.findIndex((o) => o.type === type && !o.used);
    if (i >= 0) tiles()[i].classList.add('glow-hint');
  }

  function circuitTile(i) {
    const opt = round.options[i];
    if (!opt || opt.used || cview.switchHint) return;
    if (pendingPlace && chosen === i) return; // ayni kart zaten okunuyor/yerlesiyor
    clearChosen(); // onceki secim vurgusu ve bekleyen yerlestirme iptal (yalniz son dokunulan gecerli)
    audio.play('tap');
    chooseOption(i, nameOfOption(opt));
    if (round.parts.some((p) => p.fault)) {
      // Once bozuk parca bulunmali: parcayi vurgula (cevabi vermez), secimi bekletme
      cview.hintFault = true;
      paintBoard();
      later(() => chosen === i && clearChosen(), 900);
      armIdle();
      return;
    }
    const empties = emptySlots();
    if (empties.length === 1) {
      // Tek bos konum: ad okunurken kart kisaca parlar, sonra yerlesir (dogru/yanlis degerlendirmesi place() icinde, degismedi)
      pendingPlace = later(() => {
        pendingPlace = null;
        if (round.options[i] && !round.options[i].used) place(i, empties[0]);
      }, NAME_GLOW_MS);
      return;
    }
    selected = i;
    tiles().forEach((t, k) => t.classList.toggle('selected', k === i));
    cview.armed = true;
    paintBoard();
  }

  function clearFault(id) {
    partOf(id).fault = false;
    cview.hintFault = false;
    audio.play('place');
    round.voice = round.slots.length === 1 ? `circuit_${round.slots[0].accepts}` : 'circuit_multi';
    announce();
    paintBoard();
    armIdle();
  }

  function circuitSlot(id) {
    if (partOf(id).type) return;
    if (partOf(id).fault) return clearFault(id);
    if (selected === null) {
      audio.play('tap');
      el.options.classList.add('nudge');
      later(() => el.options.classList.remove('nudge'), 900);
      return;
    }
    place(selected, round.slots.find((s) => s.id === id));
  }

  function place(i, slot) {
    const opt = round.options[i];
    const part = partOf(slot.id);
    const tile = tiles()[i];
    tiles().forEach((t) => t.classList.remove('selected'));
    clearChosen();
    selected = null;
    cview.armed = false;
    if (opt.type !== slot.accepts) {
      // Yanlis yer: komponent tepsiye geri doner; konum nazikce vurgulanir, 2. denemede dogru komponent parlar
      wrong += 1;
      audio.play('gentle');
      tile.classList.add('wobble');
      later(() => tile.classList.remove('wobble'), 450);
      cview.hintSlots = new Set([slot.id]);
      if (wrong >= 2) glowTile(slot.accepts);
      paintBoard();
      armIdle();
      return;
    }
    part.type = opt.type;
    if (part.type === 'switch') part.state = 'open';
    opt.used = true;
    tile.classList.remove('glow-hint');
    tile.classList.add('used');
    cview.hintSlots.clear();
    cview.pop = part.id;
    audio.play('place');
    paintBoard();
    if (!allFilled(round)) return armIdle();
    if (round.finish === 'switch') {
      cview.switchHint = true;
      paintBoard();
      voice.say('circuitSwitch');
      armIdle();
      return;
    }
    powerUp();
  }

  function circuitSwitch() {
    if (locked || !cview.switchHint) return;
    partOf(round.parts.find((p) => p.type === 'switch').id).state = 'closed';
    cview.switchHint = false;
    audio.play('place');
    paintBoard();
    powerUp();
  }

  // Devre tamamlandi: enerji akisi -> LED yanar -> basari muzigi -> sonraki bolum
  function powerUp() {
    locked = true;
    clearTimeout(idleTimer);
    tiles().forEach((t) => !t.classList.contains('used') && t.classList.add('faded'));
    const t0 = round.startPowered ? 150 : 350;
    later(() => {
      board()?.classList.add('power');
      audio.play('circuitOn');
    }, t0);
    later(() => {
      el.prompt.classList.add('solved');
      audio.play('success');
    }, t0 + 700);
    const up = award();
    storage.setCircuit(band(), advanceCircuit(storage.get().circuit[band()], data, band()));
    // Muzik bitince "Harika! Devre tamamlandi." (ses yoksa/kapaliysa beklemeden) -> sonraki bolum
    later(() => voice.sayThen('circuitDone').then(() => !dead && finishRound(up)), t0 + 700 + SOUND_MS.success + 100);
  }

  // ---- Olaylar -----------------------------------------------------------------
  function onPointer() {
    audio.unlock();
    armIdleIfActive();
  }
  function armIdleIfActive() {
    if (!locked) armIdle();
  }

  function onClick(e) {
    const t = e.target;
    if (overlayClose && t.closest('.overlay')) return overlayClose();
    const act = t.closest('[data-act]')?.dataset.act;
    if (act === 'home') return exit();
    if (act === 'speak') return voice.say(round.kind === 'circuit' && cview.switchHint ? 'circuitSwitch' : round.voice);
    if (locked) return;
    const tile = t.closest('.tile');
    if (tile) {
      const i = Number(tile.dataset.i);
      return round.kind === 'circuit' ? circuitTile(i) : geometryTile(i);
    }
    if (round.kind !== 'circuit') return;
    const slot = t.closest('[data-slot]');
    if (slot) return circuitSlot(slot.dataset.slot);
    if (t.closest('[data-switch]')) return circuitSwitch();
  }

  return { mount, unmount };
}
