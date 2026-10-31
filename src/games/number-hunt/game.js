// "Sayi Avi" oyun denetleyicisi: tur akisi, dokunma, geri bildirim, ipuclari. Mantik rounds.js'te, cizim render.js'te.
// Ilerleme oyuna ozel kaydedilir (storage.getGame/updateGame); Sekli Tamamla ilerlemesine dokunmaz.
import { makeRound } from './rounds.js';
import { promptHtml, optionHtml } from './render.js';
import { levelFor, didLevelUp, contentFor } from '../../core/progress.js';

const GAME_ID = 'number-hunt';
const IDLE_MS = 9000;
const NEXT_MS = 1300;

export function createGame(ctx) {
  const { data, storage, audio, voice, rng, exit } = ctx;
  const nh = data.game[GAME_ID];
  const levels = data.levels;

  let root = null;
  const el = {};
  let round = null;
  let prevId = null;
  let prevKind = null;
  let locked = false;
  let wrong = 0;
  let idleTimer = null;
  let idleStep = 0;
  let overlayClose = null;
  let dead = false;
  const timers = new Set();

  const band = () => storage.get().band;
  const correct = () => storage.getGame(GAME_ID).correct;
  const tier = () => contentFor(levelFor(correct(), levels).level, GAME_ID)?.tier ?? 0;
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

  function mount(container) {
    root = container;
    root.innerHTML = `
      <section class="play nh" data-band="${band()}">
        <header class="bar">
          <button class="btn icon" data-act="home" aria-label="Ana ekran"><span aria-hidden="true">🏠</span></button>
          <div class="level" aria-hidden="true"><span class="lv-emoji"></span><span class="lv-name"></span><span class="meter"><i></i></span></div>
          <button class="btn icon" data-act="speak" aria-label="Tekrar dinle"><span aria-hidden="true">🔊</span></button>
        </header>
        <main class="stage"><div class="prompt kind-nh"></div><p class="cap" aria-hidden="true"></p><div class="options"></div></main>
        <div class="overlay" hidden></div>
      </section>`;
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
    const { level, fraction } = levelFor(correct(), levels);
    el.emoji.textContent = level.emoji;
    el.name.textContent = level.name;
    el.meter.style.width = `${Math.round(fraction * 100)}%`;
  }

  // ---- Tur akisi -------------------------------------------------------------------
  function nextRound() {
    clearTimers();
    locked = false;
    wrong = 0;
    idleStep = 0;
    el.prompt.classList.remove('solved', 'hint');
    round = makeRound({ data, rng, band: band(), tier: tier(), prevId, prevKind });
    prevId = round.id;
    prevKind = round.kind;
    el.prompt.dataset.hint = round.hint;
    el.prompt.dataset.kind = round.kind;
    el.prompt.innerHTML = promptHtml(nh, round.prompt, band());
    el.options.className = `options n${round.options.length} nh-opts`;
    el.options.innerHTML = round.options
      .map((o, i) => `<button class="tile nh-tile ${o.view.type}" data-i="${i}" aria-label="Seçenek ${i + 1}">${optionHtml(nh, o.view, band())}</button>`)
      .join('');
    announce();
    armIdle();
  }

  // Kisa yazili yonerge + Turkce sesli yonerge (ses calismazsa yazili/gorsel yonerge kalir)
  function announce() {
    el.cap.textContent = round.voiceText;
    voice.say(round.voice, undefined, round.voiceText);
  }

  function award() {
    const before = correct();
    const after = storage.updateGame(GAME_ID, { correct: before + 1 }).correct;
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

  // ---- Ipuclari: cevabi vermez; dikkati dogru nesnelere yonlendirir, sonra yanlis secenekleri eler ------
  function armIdle() {
    clearTimeout(idleTimer);
    if (locked || dead) return;
    idleTimer = setTimeout(() => {
      if (locked || dead) return;
      idleStep += 1;
      if (idleStep === 1) el.prompt.classList.add('hint');
      else dimOneWrong();
      if (idleStep < 2) armIdle();
    }, IDLE_MS);
  }

  function dimOneWrong() {
    const open = tiles().filter((t, i) => i !== round.answer && !t.classList.contains('dim'));
    const left = tiles().filter((t) => !t.classList.contains('dim')).length;
    if (!open.length || left <= 2) return;
    open[0].classList.add('dim');
    open[0].setAttribute('aria-disabled', 'true');
  }

  // ---- Dokunma ------------------------------------------------------------------------
  function answerTile(i) {
    const tile = tiles()[i];
    if (!tile || tile.classList.contains('dim')) return;
    if (i === round.answer) {
      locked = true;
      clearTimeout(idleTimer);
      tile.classList.add('correct');
      tiles().forEach((t) => t !== tile && t.classList.add('faded'));
      audio.play('correct');
      el.prompt.innerHTML = promptHtml(nh, round.solvedPrompt, band());
      el.prompt.classList.remove('hint');
      el.prompt.classList.add('solved');
      const up = award();
      later(() => finishRound(up), NEXT_MS);
      return;
    }
    // Yanlis: ceza yok. Secenek hafifce geri cekilir; ilk seferde dikkat nesnelere yonlendirilir, sonra bir yanlis secenek elenir
    wrong += 1;
    tile.classList.add('dim', 'wobble');
    tile.setAttribute('aria-disabled', 'true');
    audio.play('gentle');
    later(() => tile.classList.remove('wobble'), 450);
    if (wrong >= 2) dimOneWrong();
    else el.prompt.classList.add('hint');
    armIdle();
  }

  // Sayma destegi: nesneye dokununca sirayla 1, 2, 3... numarasi cikar (cevabi vermez; cocuk sayar)
  function countTap(objEl) {
    if (locked || objEl.classList.contains('counted')) return;
    const n = el.prompt.querySelectorAll('.obj.counted').length + 1;
    objEl.classList.add('counted');
    objEl.querySelector('.bub').textContent = String(n);
    audio.play('tap');
    armIdle();
  }

  function onPointer() {
    audio.unlock();
    if (!locked) armIdle();
  }

  function onClick(e) {
    const t = e.target;
    if (overlayClose && t.closest('.overlay')) return overlayClose();
    const act = t.closest('[data-act]')?.dataset.act;
    if (act === 'home') return exit();
    if (act === 'speak') return voice.say(round.voice, undefined, round.voiceText);
    if (locked) return;
    const tile = t.closest('.tile');
    if (tile) return answerTile(Number(tile.dataset.i));
    const o = t.closest('.obj.cnt');
    if (o && el.prompt.contains(o)) countTap(o);
  }

  return { mount, unmount };
}
