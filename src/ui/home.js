// Ana ekran = oyun secimi. Kartlar games kaydindan uretilir; yeni oyun eklemek bu dosyayi degistirmez.
// Alt kisimda yas grubu ve ses ayari (iki oyun icin ortak).
import { levelFor } from '../core/progress.js';
import { tasksFor, progressOf } from '../core/taskkit.js';

// V7.8: iki sablon. mode 'menu' = Ana Menu (Oyunlar / Egitim / Profil / Ebeveyn); mode 'games' = Oyunlar bolumu (onceki ana ekran
// kartlari + Elektrik Dedektifi ve Mantik ve Bilim). Acilan "Cok yakinda" paneli (Profil, Ebeveyn, Enerji Macerasi) iki modda da ortaktir.
export function renderHome(root, svc) {
  const { data, storage, audio, voice, games, education, tasks, play, registerBack, mode = 'menu', taskGames = [], mascot, goGames, goMenu } = svc;
  const s = data.strings;

  // Her oyunun kendi ilerlemesi: Sekli Tamamla ust duzey `correct`, digerleri `games.<id>.correct`
  const correctOf = (id) => (id === 'shape-complete' ? storage.get().correct : storage.getGame(id).correct);

  // V8.2 ebeveyn kilidi: kilitli oyun karti acilmaz (rota da korumali); kart gorunur kalir, kilit simgesi gosterir
  const isLocked = (id) => !!svc.parental?.isBlocked(id);
  const lockAttr = (id) => (isLocked(id) ? ' data-locked="1"' : '');
  const lockIc = (id) => (isLocked(id) ? '<i class="gc-lock" aria-hidden="true">🔒</i>' : '');
  const lockLabel = (id) => (isLocked(id) ? `. ${s.mm?.parent?.lockedGame ?? 'Kilitli'}` : '');
  function card(g) {
    const meta = s.games?.[g.id] ?? { title: g.id, desc: '' };
    // Oyun kendi rozetini tanimlayabilir (g.badge); yoksa ortak seviye sistemi (kendi ilerlemesiyle)
    const b = g.badge?.({ storage, data });
    const lv = b ? null : levelFor(correctOf(g.id), data.levels);
    const emoji = b ? b.emoji : lv.level.emoji;
    const name = b ? b.name : lv.level.name;
    const fraction = b ? b.fraction : lv.fraction;
    return `<button class="game-card" data-act="play" data-game="${g.id}"${lockAttr(g.id)} aria-label="${meta.title}. ${meta.desc}${lockLabel(g.id)}">${lockIc(g.id)}
        <span class="gc-icon" aria-hidden="true">${g.icon}</span>
        <span class="gc-text"><span class="gc-title">${meta.title}</span><span class="gc-desc">${meta.desc}</span></span>
        <span class="gc-level" aria-hidden="true"><span class="lv-emoji">${emoji}</span><span class="lv-name">${name}</span><span class="meter"><i style="width:${Math.round(fraction * 100)}%"></i></span></span>
      </button>`;
  }

  // V7.8: gorev oyunlari (Elektrik Dedektifi, Mantik ve Bilim) Oyunlar bolumunde kendi kartiyla; ilerleme = cozulen / toplam gorev
  function taskCard(g) {
    const meta = s.games?.[g.id] ?? { title: g.id, desc: '' };
    const unit = data.game?.[g.id]?.text?.tasksWord ?? 'görev';
    const p = progressOf(tasksFor(data.game[g.id], storage.get().band), storage.getTasks(g.id).done);
    const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
    return `<button class="game-card" data-act="play" data-game="${g.id}"${lockAttr(g.id)} aria-label="${meta.title}. ${meta.desc} ${p.done} / ${p.total} ${unit}${lockLabel(g.id)}">${lockIc(g.id)}
        <span class="gc-icon" aria-hidden="true">${g.icon}</span>
        <span class="gc-text"><span class="gc-title">${meta.title}</span><span class="gc-desc">${meta.desc}</span></span>
        <span class="gc-level" aria-hidden="true"><span class="lv-emoji">${g.icon}</span><span class="lv-name">${p.done} / ${p.total} ${unit}</span><span class="meter"><i style="width:${pct}%"></i></span></span>
      </button>`;
  }

  // V7.7: gelecek ozellik kartlari (Enerji Macerasi, Profil, Ebeveyn). Liste assets/data/soon.json'dan, metinler strings.tr.json > soon'dan gelir.
  // Hazir olmayan kart HICBIR oyun baslatmaz: yalniz bilgi paneli acar. Etkinlestirme: soon.json'da enabled=true + kayitli gameId.
  const soonItems = () => data.game?.soon?.items ?? [];
  // V7.9: Enerji Macerasi artik gercek oyun kartidir (taskGames); "Cok yakinda" kartinda tekrar gosterilmez. Profil/Ebeveyn Ana Menu'de.
  const advLive = () => taskGames.some((g) => g.id === 'energy-adventure');
  const soonShown = () => soonItems().filter((it) => (mode !== 'games' || it.id === 'adventure') && !(it.id === 'adventure' && advLive()));
  const playable = (it) => it.enabled === true && !!it.gameId && [...games, education, tasks].some((g) => g && g.id === it.gameId);
  function soonCard(it) {
    const t = s.soon?.items?.[it.id];
    if (!t) return '';
    const art = (it.art ?? []).length ? `<span class="sc-art" aria-hidden="true">${it.art.map((a) => `<i>${a}</i>`).join('')}</span>` : '';
    if (playable(it)) return `<button class="game-card soon-live" data-act="play" data-game="${it.gameId}"><span class="gc-icon" aria-hidden="true">${it.icon}</span><span class="gc-text"><span class="gc-title">${t.title}</span><span class="gc-desc">${t.desc}</span></span></button>`;
    return `<button class="soon-card${it.featured ? ' featured' : ''}" data-act="soon" data-soon="${it.id}" aria-haspopup="dialog" aria-label="${t.title}. ${s.soon.status}. ${t.desc}">
        <span class="sc-top"><span class="sc-icon" aria-hidden="true">${it.icon}</span><span class="sc-title">${t.title}</span></span>
        ${art}
        <span class="sc-status">${s.soon.status}</span>
        <span class="sc-desc">${t.desc}</span>
      </button>`;
  }
  function soonSection() {
    const cards = soonShown().map(soonCard).join('');
    if (!cards || !s.soon) return '';
    return `<section class="soon" aria-label="${s.soon.heading}"><h2 class="soon-h">${s.soon.heading}</h2><div class="soon-row">${cards}</div></section>`;
  }
  let dialog = null;
  function closeDialog() {
    if (dialog && !dialog.el.isConnected) dialog = null;
    if (!dialog) return false;
    const opener = dialog.opener;
    dialog.el.remove();
    dialog = null;
    opener?.focus?.({ preventScroll: true });
    return true;
  }
  function openSoon(id, opener) {
    const it = soonItems().find((x) => x.id === id);
    const t = s.soon?.items?.[id];
    if (dialog && !dialog.el.isConnected) dialog = null; // yeniden cizimde (yas/ses) panel DOM'dan kalkmis olabilir
    if (!it || !t || dialog) return;
    const el = document.createElement('div');
    el.className = 'soon-back';
    el.innerHTML = `<div class="soon-dialog" role="dialog" aria-modal="true" aria-labelledby="soon-t">
        <span class="sc-icon big" aria-hidden="true">${it.icon}</span>
        <h3 id="soon-t">${t.title}</h3>
        <p class="sc-status">${s.soon.status}</p>
        <p class="sd-msg">${t.message}</p>
        <p class="sd-note">${t.note}</p>
        <button class="btn chip" data-act="soon-close">${s.soon.ok}</button>
      </div>`;
    root.appendChild(el);
    dialog = { el, opener };
    el.querySelector('[data-act="soon-close"]').focus({ preventScroll: true });
  }
  const unregBack = registerBack?.(() => closeDialog()); // fiziksel Geri: once bilgi panelini kapatir (true = isledi)

  // ekran acilis tepkisi: gecis animasyonu bittikten sonra; ekrandan cikilirsa iptal (baska ekranda ust uste gorunmez)
  let greetTimer = null;
  const greet = (kind) => {
    clearTimeout(greetTimer);
    greetTimer = setTimeout(() => mascot?.react(kind), 450);
  };
  const M = s.menu ?? {};
  const bandBtn = (st) => `<button class="btn chip stack band-btn" data-act="band" data-band="${st.band}" aria-label="Yaş grubu: ${st.band === '4-5' ? '4–5' : '6–8'} yaş. Değiştirmek için dokun"><span class="stk-icon" aria-hidden="true">${st.band === '4-5' ? '🐣' : '🦉'}</span><span class="stk-label" aria-hidden="true">${st.band === '4-5' ? '4–5' : '6–8'} yaş</span></button>`;
  const soundBtn = (st) => `<button class="btn icon" data-act="sound" aria-label="Ses"><span aria-hidden="true">${st.sound ? '🔊' : '🔇'}</span></button>`;

  function paintMenu(st) {
    const p = education?.progress?.({ storage, data }) ?? { done: 0, total: 0 };
    const ver = data.version?.versionName ? `${M.versionLabel ?? 'Sürüm'} V${data.version.versionName}` : '';
    const dev = M.dev ?? s.soon?.status ?? '';
    const devCard = (id, cls, icon, t) => `<button class="menu-card ${cls}" data-act="soon" data-soon="${id}" aria-haspopup="dialog" aria-label="${t.title}. ${dev}. ${t.desc}">
          <span class="mc-in"><span class="mc-ic" aria-hidden="true">${icon}</span><span class="mc-t">${t.title}</span><span class="mc-d">${t.desc}</span><span class="mc-dev">${dev}</span></span></button>`;
    root.innerHTML = `
      <section class="home menu" data-mode="menu">
        <header class="menu-top"><span class="menu-ver" aria-label="${ver}">${ver}</span></header>
        <div class="menu-brand">
          <h1 class="brand"><img class="logo" src="${data.manifest.brand.lockup}" alt="${s.app}" draggable="false"></h1>
          <p class="tagline">${s.tagline ?? 'Keşfet • Öğren • Mucit Ol'}</p>
        </div>
        <nav class="menu-grid" aria-label="${M.aria ?? 'Ana bölümler'}">
          <button class="menu-card mc-games" data-act="goto" data-to="games" aria-label="${M.games?.title}. ${M.games?.desc}">
            <span class="mc-in"><span class="mc-ic" aria-hidden="true">🎮</span><span class="mc-t">${M.games?.title}</span><span class="mc-d">${M.games?.desc}</span><span class="mc-go" aria-hidden="true">➜</span></span></button>
          <button class="menu-card mc-edu edu-entry" data-act="play" data-game="learn" aria-label="${M.edu?.title}. ${M.edu?.desc}. ${p.done} / ${p.total} ders tamamlandı">
            <span class="mc-in"><span class="mc-ic" aria-hidden="true">🎓</span><span class="mc-t">${M.edu?.title}</span><span class="mc-d">${M.edu?.desc}</span><span class="mc-prog" aria-hidden="true">${p.done}/${p.total}</span><span class="mc-go" aria-hidden="true">➜</span></span></button>
          ${devCard('profile', 'mc-profile', '👤', M.profile ?? {})}
          ${devCard('parental', 'mc-parent', '🛡️', M.parent ?? {})}
        </nav>
        <div class="mascot-slot menu-mascot"></div>
        <footer class="home-ctl"><button class="btn chip stack" data-act="adv" aria-label="Macera haritası"><span class="stk-icon" aria-hidden="true">🗺️</span><span class="stk-label" aria-hidden="true">Macera</span></button>${bandBtn(st)}${soundBtn(st)}</footer>
      </section>`;
    mascot?.attach(root.querySelector('.mascot-slot'), 'menu');
    greet('greet');
  }

  function paintGames(st) {
    root.innerHTML = `
      <section class="home games" data-mode="games">
        <header class="games-top">
          <button class="btn icon gm-back" data-act="menu" aria-label="${M.back ?? 'Ana menü'}"><span aria-hidden="true">←</span></button>
          <h1 class="gm-title">${M.gamesTitle ?? 'Oyunlar'}</h1>
          <div class="mascot-slot games-mascot"></div>
        </header>
        <div class="game-cards">${games.map(card).join('')}${taskGames.map(taskCard).join('')}</div>
        ${soonSection()}
        <footer class="home-ctl">${bandBtn(st)}${soundBtn(st)}</footer>
        <p class="mm-toast" role="status" aria-live="polite" hidden></p>
      </section>`;
    mascot?.attach(root.querySelector('.mascot-slot'), 'games');
    greet('enter');
  }

  function paint() {
    const st = storage.get();
    if (mode === 'games') paintGames(st);
    else paintMenu(st);
  }

  function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    audio.unlock();
    const act = btn.dataset.act;
    if (act === 'soon') {
      audio.play('tap');
      return openSoon(btn.dataset.soon, btn);
    }
    if (act === 'soon-close') {
      audio.play('tap');
      return void closeDialog();
    }
    if (act === 'adv') return void (location.hash = '#/adventure');
    if (act === 'goto') return void goGames?.();
    if (act === 'menu') return void goMenu?.();
    if (act === 'play') {
      if (isLocked(btn.dataset.game)) {
        const t = root.querySelector('.mm-toast');
        if (t) {
          t.textContent = s.mm?.parent?.lockedGame ?? 'Kilitli';
          t.hidden = false;
          clearTimeout(t._h);
          t._h = setTimeout(() => (t.hidden = true), 2600);
        }
        return;
      }
      return play(btn.dataset.game);
    }
    if (act === 'band') {
      storage.update({ band: storage.get().band === '4-5' ? '6-8' : '4-5' });
      audio.play('tap');
      return paint();
    }
    if (act === 'sound') {
      const on = !storage.get().sound;
      storage.update({ sound: on });
      audio.setEnabled(on);
      voice.setEnabled(on);
      if (on) audio.play('tap');
      paint();
    }
  }

  // Panelin arka planina dokunmak da kapatir (panelin kendisine dokunmak kapatmaz)
  const onBackdrop = (e) => {
    if (dialog && e.target === dialog.el) closeDialog();
  };
  root.addEventListener('click', onClick);
  root.addEventListener('click', onBackdrop);
  paint();
  return {
    unmount() {
      clearTimeout(greetTimer);
      mascot?.park();
      unregBack?.();
      closeDialog();
      root.removeEventListener('click', onBackdrop);
      root.removeEventListener('click', onClick);
    }
  };
}
