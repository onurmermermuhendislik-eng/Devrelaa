// "Gorevler" hub ekrani: iki buyuk kart (Elektrik Dedektifi, Mantik ve Bilim). Secilen oyun ayni kokte acilir (Egitim'in harita -> ders
// yapisi gibi); boylece router/Geri tusu altyapisi degismez: oyun listesinde Geri -> hub, hub'da Geri -> ana ekran.
import { subGames } from './subgames.js';
import { tasksFor, progressOf } from '../../core/taskkit.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function createGame(ctx) {
  const { data, storage, audio, voice, exit, registerBack } = ctx;
  const S = data.strings.games || {};
  const title = S.tasks?.title || 'Görevler';
  let root = null;
  let sub = null;
  let subBack = null;
  let unregBack = null;
  let leaving = false;
  let dead = false;

  const meta = (g) => S[g.id] || { title: g.id, desc: '' };

  function renderHub() {
    const band = storage.get().band;
    const cards = subGames
      .map((g) => {
        const m = meta(g);
        const unit = data.game[g.id].text.tasksWord;
        const p = progressOf(tasksFor(data.game[g.id], band), storage.getTasks(g.id).done);
        const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
        return `<button class="tk-card" data-act="game" data-game="${esc(g.id)}" aria-label="${esc(m.title + '. ' + m.desc + ' ' + p.done + ' / ' + p.total + ' ' + unit)}">
          <span class="tc-icon" aria-hidden="true">${g.icon}</span>
          <span class="tc-text"><b>${esc(m.title)}</b><i>${esc(m.desc)}</i></span>
          <span class="tc-prog" aria-hidden="true"><span class="lo-bar"><span class="lo-fill" style="width:${pct}%"></span></span><small>${p.done} / ${p.total} ${esc(unit)}</small></span>
        </button>`;
      })
      .join('');
    root.innerHTML = `
      <section class="play inv learn tk tk-hub-screen" data-band="${band}">
        <header class="bar">
          <button class="btn icon" data-act="home" aria-label="Ana ekran"><span aria-hidden="true">🏠</span></button>
          <div class="level tk-title" aria-hidden="true">🕵️ ${esc(title)}</div>
          <button class="btn icon" data-act="speak" aria-label="Tekrar dinle"><span aria-hidden="true">🔊</span></button>
        </header>
        <main class="stage learn-stage tk-stage"><div class="learn-map tk-hub"><p class="cap learn-cap tk-cap" aria-live="polite">${esc(S.tasks?.desc || '')}</p>${cards}</div></main>
      </section>`;
  }

  function open(id) {
    const g = subGames.find((x) => x.id === id);
    if (!g || sub) return;
    audio.play('tap');
    sub = g.create({
      ...ctx,
      exit: toHub,
      registerBack: (fn) => {
        subBack = fn;
        return () => {
          if (subBack === fn) subBack = null;
        };
      }
    });
    sub.mount(root);
  }

  function toHub() {
    if (dead) return;
    sub?.unmount();
    sub = null;
    subBack = null;
    renderHub();
  }

  function onClick(e) {
    if (sub) return; // oyun acikken tiklamalari oyunun kendi kabugu isler
    const act = e.target.closest('[data-act]');
    if (!act) return;
    audio.unlock();
    const a = act.dataset.act;
    if (a === 'home') {
      if (leaving) return; // cift dokunus: tek cikis
      leaving = true;
      return exit();
    }
    if (a === 'speak') return voice.say('tk_hub', undefined, S.tasks?.desc || title);
    if (a === 'game') return open(act.dataset.game);
  }

  function mount(container) {
    root = container;
    root.addEventListener('click', onClick);
    // Fiziksel Geri: acik oyun varsa once oyunun kendi katmani, yoksa hub'a doner (true); hub'dayken app.js ana ekrana doner (false)
    unregBack = registerBack
      ? registerBack(() => {
          if (!sub) return false;
          if (subBack && subBack() === true) return true;
          toHub();
          return true;
        })
      : null;
    renderHub();
  }

  function unmount() {
    dead = true;
    sub?.unmount();
    sub = null;
    voice.stop();
    if (root) {
      root.removeEventListener('click', onClick);
      root.innerHTML = '';
    }
    unregBack?.();
    unregBack = null;
  }

  return { mount, unmount };
}
