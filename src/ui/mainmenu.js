// V8.1 Yatay ana menu + Ilerlemem + Ayarlar. Yalniz GERCEK ozellikler baglanir (sahte dugme YOK).
//  Oyna -> #/games (mevcut mini oyunlar)   Enerji Macerasi -> #/adventure   Egitim -> #/play/learn   Ilerlemem -> #/progress   Ayarlar -> #/settings
import { deriveProgress } from '../games/adventure/model.js';
import { levelFor } from '../core/progress.js';
import { esc } from '../games/adventure/svg.js';
import { initialsOf, fullName } from '../core/profile.js';
import { openGate } from './gate.js';

const fill = (s, o) => s.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

export function renderMainMenu(root, svc) {
  const { data, storage, audio, voice, mascot, education, play, registerBack, parental } = svc;
  const M = data.strings.mm;
  let toast = '';
  let toastT = null;
  const cfg = data.game.adventure;
  const unreg = registerBack?.(() => false); // Ana menude Geri = uygulamayi arka plana al (back.js: view 'home')
  const paint = () => {
    const st = storage.get();
    const p = deriveProgress(storage.getAdv(), cfg);
    const prof = st.profile;
    const pOn = parental.isOn();
    const lk = (id) => (parental.isBlocked(id) ? ' data-locked="1"' : '');
    const lkIc = (id) => (parental.isBlocked(id) ? '<i class="mm-lock" aria-hidden="true">🔒</i>' : '');
    const advD = p.done > 0 ? `${M.adv.cont}: ${p.done}/${p.total}` : M.adv.d;
    const ver = data.version?.versionName ? `${M.version} V${data.version.versionName}` : '';
    root.innerHTML = `
      <section class="adv mm" data-screen="menu" aria-label="${esc(M.aria)}">
        <header class="mm-top">
          <h1 class="mm-brand adv-block"><img src="${data.manifest.brand.lockup}" alt="${esc(data.strings.app)}" draggable="false"></h1>
          <p class="mm-tag adv-block">${esc(M.tagline)}</p>
          <div class="mm-id">
            <div class="mascot-slot mm-mascot" aria-hidden="true"></div>
            <button type="button" class="adv-btn round adv-block" data-act="sound" aria-pressed="${st.sound}" aria-label="${esc(st.sound ? M.soundOn : M.soundOff)}"><span aria-hidden="true">${st.sound ? '🔊' : '🔇'}</span></button>
            <button type="button" class="adv-btn round mm-prof adv-block${prof ? ' in' : ''}" data-act="profile" aria-label="${esc(prof ? fill(M.profile.loggedLabel, { name: fullName(prof) }) : M.profile.iconLabel)}"><span class="mm-prof-in" aria-hidden="true">${prof ? esc(initialsOf(prof)) : '👤'}</span></button>
            <button type="button" class="adv-btn mm-par adv-block ${pOn ? 'on' : 'off'}" data-act="parent" data-state="${pOn ? 'on' : 'off'}" aria-label="${esc(pOn ? M.parent.iconOn : M.parent.iconOff)}"><span class="mm-par-ic" aria-hidden="true">🛡️${pOn ? '<i class="mm-par-badge">✓</i>' : ''}</span><span class="mm-par-t" aria-hidden="true">${esc(pOn ? M.parent.on : M.parent.off)}</span></button>
          </div>
        </header>
        <nav class="mm-grid" aria-label="${esc(M.aria)}">
          <button type="button" class="mm-card mm-adv adv-block" data-act="adv"${lk('adventure')}>${lkIc('adventure')}<span class="mm-ic" aria-hidden="true">🗺️</span><span class="mm-t">${esc(M.adv.t)}</span><span class="mm-d">${esc(advD)}</span></button>
          <button type="button" class="mm-card mm-play adv-block" data-act="play"><span class="mm-ic" aria-hidden="true">🎮</span><span class="mm-t">${esc(M.play.t)}</span><span class="mm-d">${esc(M.play.d)}</span></button>
          <button type="button" class="mm-card mm-edu adv-block" data-act="edu"${lk('learn')}>${lkIc('learn')}<span class="mm-ic" aria-hidden="true">🎓</span><span class="mm-t">${esc(M.edu.t)}</span><span class="mm-d">${esc(M.edu.d)}</span></button>
          <button type="button" class="mm-card mm-prog adv-block" data-act="progress"><span class="mm-ic" aria-hidden="true">🏆</span><span class="mm-t">${esc(M.prog.t)}</span><span class="mm-d">${esc(M.prog.d)}</span></button>
          <button type="button" class="mm-card mm-set adv-block" data-act="settings"><span class="mm-ic" aria-hidden="true">⚙️</span><span class="mm-t">${esc(M.set.t)}</span><span class="mm-d">${esc(M.set.d)}</span></button>
        </nav>
        <button type="button" class="adv-btn soft mm-hood" data-act="mahalle">🏘️ Mahalle (prototip)</button>
        <p class="mm-ver adv-block" aria-label="${esc(ver)}">${esc(ver)}</p>
        <p class="mm-toast" role="status" aria-live="polite" hidden></p>
      </section>`;
    mascot?.attach(root.querySelector('.mm-mascot'), 'games'); // maskot ust cubukta kendi yerinde (butonlara/kartlara binmez)
  };
  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    audio.unlock?.();
    const a = b.dataset.act;
    if (a === 'sound') {
      const on = !storage.get().sound;
      storage.update({ sound: on });
      audio.setEnabled(on);
      voice.setEnabled(on);
      if (on) audio.play('tap');
      paint();
    } else {
      audio.play('tap');
      const locked = (id) => {
        if (!parental.isBlocked(id)) return false;
        const t = root.querySelector('.mm-toast');
        if (t) {
          t.textContent = M.parent.lockedGame;
          t.hidden = false;
          clearTimeout(toastT);
          toastT = setTimeout(() => (t.hidden = true), 2600);
        }
        return true;
      };
      if (a === 'adv') locked('adventure') || (location.hash = '#/adventure');
      else if (a === 'mahalle') location.hash = '#/mahalle';
      else if (a === 'play') location.hash = '#/games';
      else if (a === 'profile') location.hash = '#/profile';
      else if (a === 'parent') location.hash = '#/parent';
      else if (a === 'edu') locked('learn') || play?.('learn');
      else if (a === 'progress') location.hash = '#/progress';
      else if (a === 'settings') location.hash = '#/settings';
    }
  };
  root.addEventListener('click', onClick);
  paint();
  const greetT = setTimeout(() => mascot?.react('greet'), 450); // ekrandan cikilirsa iptal (maskot baska ekranda belirmesin)
  return {
    unmount() {
      unreg?.();
      clearTimeout(toastT);
      clearTimeout(greetT);
      root.removeEventListener('click', onClick);
    }
  };
}

// ---- Ilerlemem ------------------------------------------------------------------------------------------------
export function renderProgress(root, svc) {
  const { data, storage, audio, games = [], education, mascot, registerBack, exit } = svc;
  const M = data.strings.mm;
  const P = M.progress;
  const cfg = data.game.adventure;
  const unreg = registerBack?.(() => false);
  const p = deriveProgress(storage.getAdv(), cfg);
  const edu = education?.progress?.({ storage, data }) ?? { done: 0, total: 0 };
  const correctOf = (id) => (id === 'shape-complete' ? storage.get().correct : storage.getGame(id).correct);
  const bar = (v, t) => `<span class="meter"><i style="width:${t ? Math.round((v / t) * 100) : 0}%"></i></span>`;
  const rows = games
    .map((g) => {
      const n = correctOf(g.id) || 0;
      const lv = levelFor(n, data.levels);
      const meta = data.strings.games?.[g.id] ?? { title: g.id };
      return `<li class="pg-row"><span class="pg-ic" aria-hidden="true">${esc(g.icon)}</span><span class="pg-name">${esc(meta.title)}</span><span class="pg-val">${lv.level.emoji} ${fill(P.gamesLine, { n })}</span></li>`;
    })
    .join('');
  const advStars = `${p.stars} / ${p.maxStars}`;
  root.innerHTML = `
    <section class="adv mm mm-sub" data-screen="progress" aria-label="${esc(P.title)}">
      <header class="adv-hud task">
        <button type="button" class="adv-btn round" data-act="back" aria-label="${esc(M.back)}"><span aria-hidden="true">←</span></button>
        <h2 class="adv-title">${esc(P.title)}</h2><span class="adv-spacer"></span>
      </header>
      <main class="pg-body">
        <div class="pg-card adv-block"><h3>🗺️ ${esc(P.adv)}</h3>
          <p class="pg-big">${fill(P.advLine, { done: p.done, total: p.total })}</p>${bar(p.done, p.total)}
          <p class="pg-line"><span>🪙 <b>${p.coins}</b> ${esc(P.coins)}</span><span>⭐ <b>${advStars}</b> ${esc(P.stars)}</span></p></div>
        <div class="pg-card adv-block"><h3>🎓 ${esc(P.edu)}</h3>
          <p class="pg-big">${fill(P.eduLine, { done: edu.done, total: edu.total })}</p>${bar(edu.done, edu.total)}</div>
        <div class="pg-card pg-games adv-block"><h3>🎮 ${esc(P.games)}</h3><ul class="pg-list">${rows}</ul></div>
      </main>
    </section>`;
  const onClick = (e) => {
    if (e.target.closest('[data-act="back"]')) {
      audio.play('tap');
      exit?.();
    }
  };
  root.addEventListener('click', onClick);
  mascot?.park();
  return {
    unmount() {
      unreg?.();
      root.removeEventListener('click', onClick);
    }
  };
}

// ---- Ayarlar (ses, yas grubu, ses testi, tanitim) ---------------------------------------------------------------
export function renderSettings(root, svc) {
  const { data, storage, audio, voice, mascot, registerBack, exit, parental, applyMix } = svc;
  const M = data.strings.mm;
  const S = M.settings;
  const VOLS = [0.2, 0.4, 0.6, 0.8, 1]; // V8.5 muzik seviyeleri (dokununca sirayla)
  const volName = (v) => (v <= 0.4 ? S.volLow : v <= 0.6 ? S.volMid : S.volHigh);
  let gate = null;
  const unreg = registerBack?.(() => {
    if (gate?.isOpen()) {
      gate.cancel();
      return true;
    }
    return false;
  });
  let msg = '';
  let msgKind = '';
  let testing = false;
  const paint = () => {
    const st = storage.get();
    const mix = storage.getMix();
    root.innerHTML = `
      <section class="adv mm mm-sub" data-screen="settings" aria-label="${esc(S.title)}">
        <header class="adv-hud task">
          <button type="button" class="adv-btn round" data-act="back" aria-label="${esc(M.back)}"><span aria-hidden="true">←</span></button>
          <h2 class="adv-title">${esc(S.title)}</h2><span class="adv-spacer"></span>
        </header>
        <main class="st-body">
          <button type="button" class="st-row adv-block" data-act="sound" aria-pressed="${st.sound}"><span class="st-ic" aria-hidden="true">${st.sound ? '🔊' : '🔇'}</span><span class="st-tx"><b>${esc(S.sound)}: ${st.sound ? "Açık" : "Kapalı"}</b><small>${esc(S.soundHelp)}</small></span></button>
          <button type="button" class="st-row adv-block" data-act="music" aria-pressed="${st.sound && mix.music}"><span class="st-ic" aria-hidden="true">${mix.music ? '🎵' : '🔕'}</span><span class="st-tx"><b>${esc(S.music)}: ${mix.music ? S.on : S.off}</b><small>${esc(st.sound ? S.musicHelp : S.soundOffNote)}</small></span></button>
          <button type="button" class="st-row adv-block" data-act="musicvol" data-vol="${mix.vol}"><span class="st-ic" aria-hidden="true">🎚️</span><span class="st-tx"><b>${esc(S.musicVol)}: ${esc(volName(mix.vol))}</b><small>${esc(S.musicVolHelp)}</small></span></button>
          <button type="button" class="st-row adv-block" data-act="amb" aria-pressed="${st.sound && mix.amb}"><span class="st-ic" aria-hidden="true">${mix.amb ? '🍃' : '🔕'}</span><span class="st-tx"><b>${esc(S.amb)}: ${mix.amb ? S.on : S.off}</b><small>${esc(st.sound ? S.ambHelp : S.soundOffNote)}</small></span></button>
          <button type="button" class="st-row adv-block" data-act="vtest" ${testing ? 'disabled' : ''}><span class="st-ic" aria-hidden="true">🗣️</span><span class="st-tx"><b>${esc(S.voiceTest)}</b><small>${esc(S.voiceTestHelp)}</small></span></button>
          <button type="button" class="st-row adv-block" data-act="band" data-band="${st.band}"><span class="st-ic" aria-hidden="true">${st.band === '4-5' ? '🐣' : '🦉'}</span><span class="st-tx"><b>${esc(S.band)}: ${esc(st.band === '4-5' ? S.band45 : S.band68)}</b><small>${esc(parental.isOn() ? S.bandLocked : '4–5 / 6–8')}</small></span>${parental.isOn() ? '<i class="mm-lock st-lock" aria-hidden="true">🔒</i>' : ''}</button>
          <button type="button" class="st-row adv-block" data-act="intro"><span class="st-ic" aria-hidden="true">🎬</span><span class="st-tx"><b>${esc(S.intro)}</b><small>${esc(S.introHelp)}</small></span></button>
          <p class="st-msg adv-block ${msgKind}" role="status" aria-live="polite">${esc(msg)}</p>
        </main>
      </section>`;
  };
  const onClick = (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    audio.unlock?.();
    const a = b.dataset.act;
    if (a === 'back') {
      audio.play('tap');
      voice.stop();
      exit?.();
    } else if (a === 'sound') {
      const on = !storage.get().sound;
      storage.update({ sound: on });
      audio.setEnabled(on);
      voice.setEnabled(on);
      applyMix?.();
      if (on) audio.play('tap');
      msg = '';
      paint();
    } else if (a === 'music' || a === 'amb' || a === 'musicvol') {
      // V8.5: muzik/ortam sesi BAGIMSIZ ayarlar (sessiz mod hepsinin ustunde; ses kapaliyken anahtar kayda gecer, ses acilinca uygulanir)
      const mx = storage.getMix();
      if (a === 'music') storage.setMix({ music: !mx.music });
      else if (a === 'amb') storage.setMix({ amb: !mx.amb });
      else storage.setMix({ vol: VOLS[(VOLS.findIndex((v) => v >= mx.vol - 0.001) + 1) % VOLS.length] });
      applyMix?.();
      audio.play('tap');
      msg = '';
      paint();
    } else if (a === 'band') {
      const flip = () => {
        storage.update({ band: storage.get().band === '4-5' ? '6-8' : '4-5' });
        audio.play('tap');
        paint();
      };
      // Ebeveyn kontrolu ACIKKEN yas grubu degisimi ebeveyn dogrulamasi ister (gercek erisim kontrolu)
      if (parental.isOn()) gate = openGate(root, { parental, strings: M.gate, onPass: flip, onCancel: () => {} });
      else flip();
    } else if (a === 'intro') location.hash = '#/intro';
    else if (a === 'vtest') {
      if (!storage.get().sound) {
        msg = S.voiceOff;
        msgKind = 'warn';
        return paint();
      }
      testing = true;
      msg = S.voiceTesting;
      msgKind = '';
      paint();
      const off = voice.onStatus((s) => {
        if (s.state === 'ok') {
          msg = S.voiceOk;
          msgKind = 'good';
        } else if (s.state === 'problem') {
          msg = S.voiceBad;
          msgKind = 'warn';
        } else return;
        off();
        testing = false;
        paint();
      });
      voice.say('settings-test', () => {
        // Konusma bitti ama durum hic degismediyse (ses dosyasi/eski yol): sonucu "sorun" sayma, belirsiz birak
        if (testing) {
          off();
          testing = false;
          if (voice.status.state === 'ok') {
            msg = S.voiceOk;
            msgKind = 'good';
          } else {
            msg = S.voiceBad;
            msgKind = 'warn';
          }
          paint();
        }
      }, S.voiceSample);
    }
  };
  root.addEventListener('click', onClick);
  paint();
  mascot?.park();
  return {
    unmount() {
      unreg?.();
      gate?.close();
      voice.stop();
      root.removeEventListener('click', onClick);
    }
  };
}
