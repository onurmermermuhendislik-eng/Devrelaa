// V8.2 Ebeveyn ekrani (#/parent): once dogrulama (gate), sonra: kontrol ac/kapat, cocuk profili + yas grubu, sesli yonergeler,
// tamamlananlar, oyun erisimi (kilitler), PIN degistir. Cocuk ilerlemesine ve giris durumuna DOKUNMAZ (ayri alanlar).
import { esc } from '../games/adventure/svg.js';
import { deriveProgress } from '../games/adventure/model.js';
import { levelFor } from '../core/progress.js';
import { fullName } from '../core/profile.js';
import { openGate } from './gate.js';

const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

export function parentItems(svc) {
  const { data, games = [], education } = svc;
  const M = data.strings.mm;
  return [
    { id: 'adventure', icon: '🗺️', title: M.adv.t },
    ...(education ? [{ id: 'learn', icon: '🎓', title: M.edu.t }] : []),
    ...games.map((g) => ({ id: g.id, icon: g.icon, title: data.strings.games?.[g.id]?.title ?? g.id }))
  ];
}

export function renderParent(root, svc) {
  const { data, storage, audio, voice, parental, mascot, registerBack, exit } = svc;
  const M = data.strings.mm;
  const P = M.parent;
  let gate = null;
  let unlocked = false;
  const items = parentItems(svc);
  const unreg = registerBack?.(() => {
    if (gate?.isOpen()) {
      gate.cancel(); // dogrulama acikken Geri: dogrulamayi iptal eder -> ana menu
      return true;
    }
    return false;
  });
  const sw = (on, act, label, extra = '') => `<button type="button" class="pc-sw${on ? ' on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" ${extra} aria-label="${esc(label)}"><i></i></button>`;
  const paint = () => {
    const st = storage.get();
    const on = parental.isOn();
    const adv = deriveProgress(storage.getAdv(), data.game.adventure);
    const edu = svc.education?.progress?.({ storage, data }) ?? { done: 0, total: 0 };
    const correctOf = (id) => (id === 'shape-complete' ? st.correct : storage.getGame(id).correct);
    const rows = (svc.games || [])
      .map((g) => {
        const lv = levelFor(correctOf(g.id) || 0, data.levels);
        return `<li class="pg-row"><span class="pg-ic" aria-hidden="true">${esc(g.icon)}</span><span class="pg-name">${esc(data.strings.games?.[g.id]?.title ?? g.id)}</span><span class="pg-val">${lv.level.emoji} ${correctOf(g.id) || 0}</span></li>`;
      })
      .join('');
    root.querySelector('.pc-panel')?.remove();
    const panel = document.createElement('section');
    panel.className = 'adv mm mm-sub pc-panel';
    panel.dataset.screen = 'parent';
    panel.dataset.state = on ? 'on' : 'off';
    panel.setAttribute('aria-label', P.title);
    panel.innerHTML = `
      <header class="adv-hud task">
        <button type="button" class="adv-btn round" data-act="back" aria-label="${esc(M.back)}"><span aria-hidden="true">←</span></button>
        <h2 class="adv-title">${esc(P.title)}</h2><span class="adv-spacer"></span>
      </header>
      <main class="pc-body">
        <div class="pg-card pc-status ${on ? 'on' : 'off'} adv-block"><span class="pc-shield" aria-hidden="true">${on ? '🛡️✅' : '🛡️'}</span>
          <span class="pc-st-tx"><b>${esc(P.state)}: <span class="pc-st-word">${esc(on ? P.on : P.off)}</span></b><small>${esc(P.stateHelp)}</small></span>
          ${sw(on, 'toggle-on', `${P.state}: ${on ? P.on : P.off}`)}</div>
        <div class="pg-card adv-block"><h3>👧 ${esc(P.child)}</h3>
          <p class="pg-big">${esc(fullName(st.profile) || P.noProfile)}</p>
          <div class="pc-seg" role="group" aria-label="${esc(P.band)}"><button type="button" class="pc-opt${st.band === '4-5' ? ' on' : ''}" data-act="band" data-band="4-5" aria-pressed="${st.band === '4-5'}">🐣 4–5</button><button type="button" class="pc-opt${st.band === '6-8' ? ' on' : ''}" data-act="band" data-band="6-8" aria-pressed="${st.band === '6-8'}">🦉 6–8</button></div></div>
        <div class="pg-card pc-row adv-block"><span class="pc-st-tx"><b>🗣️ ${esc(P.voice)}</b><small>${esc(P.voiceHelp)}</small></span>${sw(st.sound, 'sound', P.voice)}</div>
        <div class="pg-card adv-block"><h3>📊 ${esc(P.done)}</h3>
          <p class="pg-line"><span>🗺️ <b>${adv.done}/${adv.total}</b> ${esc(P.tasks)}</span><span>🎓 <b>${edu.done}/${edu.total}</b> ${esc(P.lessons)}</span></p>
          <ul class="pg-list">${rows}</ul></div>
        <div class="pg-card adv-block"><h3>🔒 ${esc(P.access)}</h3><p class="pc-help">${esc(P.accessHelp)}</p>
          <ul class="pc-acc">${items
            .map((it) => {
              const bl = parental.blocked().includes(it.id);
              return `<li class="pc-accrow"><span class="pg-ic" aria-hidden="true">${esc(it.icon)}</span><span class="pg-name">${esc(it.title)}</span>${sw(!bl, 'acc', `${it.title}: ${bl ? P.blocked : P.allowed}`, `data-id="${esc(it.id)}"`)}<small class="pc-accst">${esc(bl ? P.blocked : P.allowed)}</small></li>`;
            })
            .join('')}</ul></div>
        <button type="button" class="st-row adv-block pc-pinbtn" data-act="pin"><span class="st-ic" aria-hidden="true">🔑</span><span class="st-tx"><b>${esc(P.changePin)}</b></span></button>
        <p class="st-msg adv-block good" role="status" aria-live="polite"></p>
      </main>`;
    root.appendChild(panel);
  };
  const say = (t) => {
    const m = root.querySelector('.st-msg');
    if (m) m.textContent = t;
  };
  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !unlocked || gate?.isOpen()) return;
    audio.unlock?.();
    const a = b.dataset.act;
    if (a === 'back') {
      audio.play('tap');
      exit?.();
    } else if (a === 'toggle-on') {
      parental.setOn(!parental.isOn());
      paint();
    } else if (a === 'band') {
      storage.update({ band: b.dataset.band });
      paint();
    } else if (a === 'sound') {
      const on = !storage.get().sound;
      storage.update({ sound: on });
      audio.setEnabled(on);
      voice.setEnabled(on);
      if (on) audio.play('tap');
      paint();
    } else if (a === 'acc') {
      parental.setBlocked(b.dataset.id, !parental.blocked().includes(b.dataset.id));
      paint();
    } else if (a === 'pin') {
      gate = openGate(root, { parental, strings: M.gate, mode: 'newpin', onPass: () => say(P.pinChanged), onCancel: () => {} });
    }
  };
  root.addEventListener('click', onClick);
  mascot?.park();
  // Ekran acilir acilmaz dogrulama; iptal -> ana menu
  gate = openGate(root, {
    parental,
    strings: M.gate,
    onPass: () => {
      unlocked = true;
      paint();
    },
    onCancel: () => exit?.()
  });
  return {
    unmount() {
      unreg?.();
      gate?.close();
      root.removeEventListener('click', onClick);
    }
  };
}
