// V8.0 Macera denetleyicisi: maskotlu tanitim -> yatay harita -> gorev -> odul -> (final). Gorsel (map.js, intro.js, svg.js, styles.css)
// ile oyun mantigi (model.js, circuit.js, choice.js, storage.completeAdvTask) AYRIDIR. Mevcut oyunlara ve eski rotalara dokunmaz.
import { deriveProgress, canPlay, starsFor, describeCompletion, taskById, regionOf, canBuy, itemById, worldStatus } from './model.js';
import { lineKey, normalizeLine } from '../../core/voicekey.js';
import { mapHtml } from './map.js';
import { mountIntro } from './intro.js';
import { mountCircuit } from './circuit.js';
import { mountChoice } from './choice.js';
import { mountIdentify } from './identify.js';
import { mountJudge } from './judge.js';
import { mountDarkHouse } from './darkhouse.js';
import { starSvg, esc } from './svg.js';
import { soundscapeFor } from '../../core/soundscape.js';

function create(ctx) {
  const { data, storage, audio, voice, mascot, registerBack, entry, exit, ambience, music, applyMix } = ctx;
  const cfg = data.game.adventure;
  const T = cfg.text;
  let root = null;
  let screen = 'none';
  let sub = null; // etkin gorev/tanitim (destroy)
  let unreg = null;
  let sheetOpen = false;
  let currentTask = null;
  let curRegion = null; // V8.4: gosterilen bolge (cfg.regions dizini)
  let pendingBuy = null; // V8.4: onay bekleyen ekipman kimligi
  let dead = false;

  const prog = () => deriveProgress(storage.getAdv(), cfg);
  const play = (n) => {
    try {
      audio.play(n);
    } catch {
      /* sessiz */
    }
  };
  const wantMusic = (id) => {
    try {
      if (id) music?.play(id);
      else music?.stop();
    } catch {
      /* muzik hatasi oyunu etkilemez */
    }
  };
  const react = (kind, msg) => {
    try {
      mascot?.react(kind, msg);
    } catch {
      /* maskot hatasi oyunu etkilemez */
    }
  };
  let offVoice = null;
  let voiceChecked = false;
  const clearSub = () => {
    sub?.destroy?.();
    sub = null;
    try {
      ambience?.stop(); // V8.5: ekran/gorev degisince onceki ortam sesi calmaya devam etmez
    } catch {
      /* sessiz */
    }
    offVoice?.();
    offVoice = null;
    try {
      voice.stop(); // gorev/ekran degisiminde onceki yonerge kesilir: sesler ust uste binmez
    } catch {
      /* sessiz */
    }
  };
  // V8.1 sesli yonerge: yalniz ses acikken; yeni konusma eskisini keser (voice.say). Sessiz mod = konusma YOK (basarili ses testi sayilmaz).
  // V8.5 konusma onceligi: prio 1 = onemli yonerge (varsayilan; her zaman soyler, eskisini keser), prio 2 = geri bildirim/sohbet
  // (konusan ONEMLI yonergeyi KESMEZ, atlanir; metin ekranda zaten gorunur). Konusma bitince (voice onEnd) durum sifirlanir.
  let spk = { prio: 0, id: 0, until: 0 };
  const speak = (txt, prio = 1) => {
    if (!txt || !storage.get().sound) return;
    const now = Date.now();
    if (prio > spk.prio && spk.prio > 0 && now < spk.until) return;
    const id = (spk.id || 0) + 1;
    spk = { prio, id, until: now + 13000 };
    const done = () => {
      if (spk.id === id) spk = { prio: 0, id, until: 0 };
    };
    try {
      // V8.4: metne ait kayitli Caglayan MP3'u varsa (manifest.voice[adv_<hash>]) o calinir; yoksa cihaz TTS'i (eski davranis)
      const key = lineKey(txt);
      voice.say(data.manifest?.voice?.[key] ? key : 'adv-task', done, normalizeLine(txt));
    } catch {
      done(); /* ses hatasi oyunu etkilemez */
    }
  };
  const warn = (msg) => {
    const el = root?.querySelector('.adv-voicewarn');
    if (!el || !msg) return;
    el.querySelector('span').textContent = msg;
    el.hidden = false;
  };

  function handleBack() {
    if (screen === 'map' && sheetOpen) {
      closeSheet();
      return true;
    }
    if (screen === 'world') {
      showMap();
      return true;
    }
    if (screen === 'shop') {
      if (pendingBuy) closeConfirm();
      else showMap();
      return true;
    }
    if (screen === 'task' || screen === 'reward') {
      showMap({ region: currentTask ? regionOf(cfg, currentTask.id) : null });
      return true;
    }
    if (screen === 'intro') {
      sub?.skip?.();
      return true;
    }
    exit?.(); // harita: Geri -> ana menu
    return true;
  }

  // ---- Tanitim --------------------------------------------------------------------------------------------
  function showIntro() {
    clearSub();
    screen = 'intro';
    wantMusic(null); // tanitimin kendi sesi (giris sesi + jingle) var; muzik yok
    mascot?.park();
    sub = mountIntro(root, {
      brand: data.manifest.brand,
      text: T,
      audio,
      voice,
      onDone: () => {
        storage.setAdvIntro(true);
        location.replace('#/'); // tanitimdan sonra ana menu (macera cocuk secince acilir)
      }
    });
  }

  // ---- Harita ---------------------------------------------------------------------------------------------
  function showMap({ newly = null, welcome = false, region = null } = {}) {
    clearSub();
    screen = 'map';
    sheetOpen = false;
    currentTask = null;
    pendingBuy = null;
    mascot?.park();
    const p = prog();
    // Bolge: acikca verildiyse o; yoksa son gosterilen; ilk acilista siradaki gorevin bolgesi (hepsi bittiyse son gorevli bolge)
    let ri = region ?? curRegion;
    if (ri == null || !cfg.regions[ri]?.tasks.length) {
      ri = p.nextId ? regionOf(cfg, p.nextId) : cfg.regions.map((r) => r.tasks.length > 0).lastIndexOf(true);
      if (ri < 0) ri = 0;
    }
    curRegion = ri;
    wantMusic(soundscapeFor('harita').music);
    root.innerHTML = mapHtml({ cfg, prog: p, text: T, sound: storage.get().sound, music: storage.getMix().music, newly, region: ri });
    requestAnimationFrame(() => {
      if (dead || screen !== 'map') return;
      if (newly) react('mapNext');
      else if (welcome || p.done === 0) react('mapStart');
    });
  }
  const sheet = () => root.querySelector('.adv-sheet');
  function openSheet() {
    sheetOpen = true;
    sheet().hidden = false;
    sheet().dataset.open = '1';
    sheet().querySelector('[data-act="mini"]').focus();
  }
  function closeSheet() {
    sheetOpen = false;
    sheet().hidden = true;
    sheet().dataset.open = '0';
  }
  function toggleSound() {
    const on = !storage.get().sound;
    storage.update({ sound: on });
    audio.setEnabled(on);
    voice.setEnabled(on);
    if (applyMix) applyMix();
    else {
      ambience?.setEnabled(on);
      music?.setEnabled(on);
    }
    root.querySelectorAll('[data-act="sound"]').forEach((b) => {
      b.querySelector('span').textContent = on ? '🔊' : '🔇';
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', on ? T.menuSoundOn : T.menuSoundOff);
    });
  }

  // ---- Gorev ----------------------------------------------------------------------------------------------
  function openTask(id) {
    const t = taskById(cfg, id);
    if (!t || !canPlay(prog(), id)) return;
    clearSub();
    screen = 'task';
    currentTask = t;
    mascot?.park();
    if (t.kind !== 'darkhouse') wantMusic(soundscapeFor('harita').music);
    const sound = storage.get().sound;
    root.innerHTML = `
      <section class="adv adv-task" data-screen="task" data-kind="${t.kind}" data-task="${esc(t.id)}" aria-label="${esc(T.taskAria)}: ${esc(t.title)}">
        <header class="adv-hud task">
          <button type="button" class="adv-btn round" data-act="back" aria-label="${esc(T.back)}"><span aria-hidden="true">✖</span></button>
          <h2 class="adv-title adv-block"><span aria-hidden="true">${esc(t.icon)}</span> ${esc(t.title)}</h2>
          <button type="button" class="adv-btn replay" data-act="replay" aria-label="${esc(T.replayAria)}"><span aria-hidden="true">🔁</span><b>${esc(T.replay)}</b></button>
          <button type="button" class="adv-btn round" data-act="sound" aria-label="${esc(sound ? T.menuSoundOn : T.menuSoundOff)}" aria-pressed="${sound}"><span aria-hidden="true">${sound ? '🔊' : '🔇'}</span></button>
        </header>
        <div class="adv-voicewarn adv-block" role="status" hidden><span></span><button type="button" class="adv-btn soft" data-act="vwclose">${esc(T.voiceClose)}</button></div>
        <main class="adv-body"></main>
        <div class="adv-rotate" aria-hidden="true"><span class="phone">📱</span><p>${esc(T.rotate)}</p></div>
      </section>`;
    const host = root.querySelector('.adv-body');
    const done = ({ mistakes }) => complete(t, mistakes);
    const args = { task: t, text: T, audio, mascot, onSolved: done, speak, band: storage.get().band, ambience, voice, music };
    const MOUNT = { circuit: mountCircuit, choice: mountChoice, identify: mountIdentify, judge: mountJudge, darkhouse: mountDarkHouse };
    sub = (MOUNT[t.kind] || mountChoice)(host, args);
    if (t.kind === 'circuit') speak(host.querySelector('[data-say]')?.textContent);
    // Ses sorunu geri bildirimi: konusma baslamazsa/motor yoksa cocuk (ve ebeveyn) anlayabilsin; sessiz calisma "ses basarili" sayilmaz.
    offVoice = voice.onStatus((st) => st.state === 'problem' && screen === 'task' && storage.get().sound && warn(T.voiceProblem));
    if (!voiceChecked && storage.get().sound) {
      voiceChecked = true;
      voice
        .ready()
        .then((r) => !dead && screen === 'task' && !r.ok && warn(r.reason === 'no-turkish' ? T.voiceNoTr : T.voiceProblem))
        .catch(() => {});
    }
    requestAnimationFrame(() => !dead && screen === 'task' && react('enter'));
  }

  // ---- Odul / final -----------------------------------------------------------------------------------------
  function complete(t, mistakes) {
    const before = prog();
    const stars = starsFor(mistakes, cfg.rewards);
    const r = storage.completeAdvTask(t.id, stars);
    const after = prog();
    const info = describeCompletion(before, after, t.id, cfg);
    screen = 'reward';
    const shownStars = r.saved ? Math.max(r.stars, stars) : stars;
    const region = info.justFinishedRegion;
    const fi = after.regions.findIndex((x, i) => x.done && !before.regions[i].done);
    const finalTitle = (fi >= 0 && cfg.regions[fi].finalTitle) || T.finalTitle;
    const lines = [];
    if (!r.saved) lines.push(`<p class="rw-note warn">${esc(T.saveFail)}</p>`);
    else if (r.firstTime) lines.push(`<p class="rw-coin" data-coin="${info.coinGain}"><i aria-hidden="true">🪙</i> ${esc(T.rewardCoin.replace('{n}', info.coinGain))}</p>`);
    else lines.push(`<p class="rw-note">${esc(T.rewardReplay)}</p>${r.improved ? `<p class="rw-note good">${esc(T.rewardBetter)}</p>` : ''}`);
    if (r.saved && r.firstTime && info.unlockedRegion) {
      const ur = cfg.regions.find((x) => x.id === info.unlockedRegion.id);
      lines.push(`<p class="rw-region">🔓 ${esc(T.regionOpen.replace('{title}', ur?.title || ''))}</p>${ur?.soon && !t.next ? `<p class="rw-note">${esc(T.regionSoon)}</p>` : ''}`);
    }
    else if (r.saved && r.firstTime && info.newlyOpen) lines.push(`<p class="rw-note good">${esc(T.unlocked)}</p>`);
    if (r.saved && r.firstTime && t.next) lines.push(`<p class="rw-note good" data-next>${esc(t.next)}</p>`);
    const confetti = region && r.firstTime ? `<div class="rw-confetti" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>` : '';
    const el = document.createElement('div');
    el.className = `adv-reward${region && r.firstTime ? ' final' : ''}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-label', T.rewardTitle);
    el.innerHTML = `${confetti}
      <div class="rw-card">
        <h2 class="rw-title">${esc(region && r.firstTime ? finalTitle : T.rewardTitle)}</h2>
        ${region && r.firstTime ? `<p class="rw-sub">${esc(T.finalSub)}</p>` : ''}
        <div class="rw-stars" data-stars="${shownStars}" aria-label="${shownStars} ${esc(T.rewardStars)}">${[1, 2, 3].map((k) => `<span style="--i:${k}">${starSvg(k <= shownStars)}</span>`).join('')}</div>
        ${lines.join('')}
        <div class="rw-actions">
          <button type="button" class="adv-btn primary big" data-act="tomap">${esc(T.toMap)}</button>
          ${r.saved ? `<button type="button" class="adv-btn soft" data-act="again">${esc(T.again)}</button>` : ''}
        </div>
      </div>`;
    root.querySelector('.adv-task').appendChild(el);
    el.querySelector('[data-act="tomap"]').focus();
    if (r.saved && r.firstTime) play('success');
    if (r.saved && region && r.firstTime) setTimeout(() => !dead && play('levelUp'), 900);
    clearSub();
    speak(region && r.firstTime ? finalTitle : T.rewardTitle); // clearSub konusmayi keser: odul cumlesi ondan SONRA
    root.dataset.newly = info.newlyOpen || '';
    el.dataset.newly = info.newlyOpen || '';
    requestAnimationFrame(() => !dead && react(region && r.firstTime ? 'mapFinal' : 'done'));
  }

  // ---- Enerji Marketi (V8.4) ------------------------------------------------------------------------------
  const MK = cfg.market;
  const MT = MK.text;
  const fill = (str, o) => String(str).replace(/\{(\w+)\}/g, (_, k) => (k in o ? o[k] : ''));
  function showShop({ fresh = null, msg = '', warn: isWarn = false } = {}) {
    clearSub(); // ortam sesi durur; muzik ayni (Market macera sesleri kontrolsuz devam etmez)
    wantMusic(soundscapeFor('harita').music);
    screen = 'shop';
    pendingBuy = null;
    mascot?.park();
    const p = prog();
    const sound = storage.get().sound;
    const items = MK.items.map((it) => {
      const own = p.inv.includes(it.id);
      const poor = !own && p.coins < it.price;
      const state = own ? 'owned' : poor ? 'poor' : 'buy';
      const action = own
        ? `<span class="shop-owned" data-act="none">✓ ${esc(MT.owned)}</span>`
        : poor
          ? `<button type="button" class="adv-btn soft shop-act" data-act="buy" data-id="${esc(it.id)}" aria-disabled="true">${esc(fill(MT.need, { n: it.price - p.coins }))}</button>`
          : `<button type="button" class="adv-btn primary shop-act" data-act="buy" data-id="${esc(it.id)}">${esc(MT.buy)}</button>`;
      return `<li class="shop-item adv-block ${state}${fresh === it.id ? ' fresh' : ''}" data-item="${esc(it.id)}" data-state="${state}" data-price="${it.price}">
        <span class="shop-ic" aria-hidden="true">${esc(it.icon)}</span>
        <div class="shop-tx"><b class="shop-name">${esc(it.title)}</b><small>${esc(it.desc)}</small></div>
        <span class="shop-price" aria-label="${it.price} coin"><i aria-hidden="true">🪙</i><b>${it.price}</b></span>
        ${action}
      </li>`;
    });
    const all = p.inv.length === MK.items.length;
    root.innerHTML = `
      <section class="adv adv-shop" data-screen="shop" aria-label="${esc(MT.title)}">
        <header class="adv-hud task">
          <button type="button" class="adv-btn round" data-act="shopback" aria-label="${esc(MT.back)}"><span aria-hidden="true">✖</span></button>
          <h2 class="adv-title adv-block"><span aria-hidden="true">🛒</span> ${esc(MT.title)}</h2>
          <div class="adv-pill adv-block coin" aria-label="${esc(T.hudCoin)}: ${p.coins}"><i aria-hidden="true">🪙</i><b data-coins="${p.coins}">${p.coins}</b></div>
          <button type="button" class="adv-btn round" data-act="sound" aria-label="${esc(sound ? T.menuSoundOn : T.menuSoundOff)}" aria-pressed="${sound}"><span aria-hidden="true">${sound ? '🔊' : '🔇'}</span></button>
        </header>
        <p class="shop-bag adv-block" data-owned="${p.inv.length}" role="status">🧰 ${esc(MT.bag)}: ${esc(fill(MT.bagCount, { n: p.inv.length, total: MK.items.length }))}${all ? ` · ${esc(MT.allBought)}` : p.inv.length === 0 ? ` · ${esc(MT.empty)}` : ''}</p>
        <p class="shop-msg adv-block${isWarn ? ' warn' : ''}" role="status" ${msg ? '' : 'hidden'}>${esc(msg)}</p>
        <ul class="shop-grid">${items.join('')}</ul>
        <div class="shop-confirm" hidden role="dialog" aria-modal="true" aria-label="${esc(MT.title)}">
          <div class="shop-confirm-in adv-block"><p class="shop-q"></p>
            <div class="shop-btns"><button type="button" class="adv-btn primary big" data-act="buyyes">${esc(MT.yes)}</button><button type="button" class="adv-btn soft" data-act="buyno">${esc(MT.no)}</button></div>
          </div>
        </div>
        <div class="adv-rotate" aria-hidden="true"><span class="phone">📱</span><p>${esc(T.rotate)}</p></div>
      </section>`;
    if (!msg) speak(MT.say);
  }
  // V8.5 Macera Dunyasi: 5 asama, durumlari ve her asama icin gereken ekipman (marketle AYNI katalog). Yapim asamasindakiler bitmis gibi gosterilmez.
  function showWorld() {
    clearSub();
    wantMusic(soundscapeFor('harita').music);
    screen = 'world';
    mascot?.park();
    const WT = cfg.world.text;
    const p = prog();
    const ws = worldStatus(storage.getAdv(), cfg);
    const sound = storage.get().sound;
    const label = { done: WT.done, open: WT.playable, needs: WT.playable, locked: WT.locked, soon: WT.soon };
    const rows = ws.map((st) => {
      const needs = st.needs.length
        ? st.needs.map((n) => `<span class="wd-need ${n.owned ? 'own' : 'miss'}" data-need="${esc(n.id)}" data-owned="${n.owned ? 1 : 0}">${esc(n.icon)} ${esc(n.title)} · ${n.owned ? '✓ ' + esc(WT.have) : esc(WT.missing)}</span>`).join(' ')
        : `<span class="wd-need own">${esc(WT.needsNone)}</span>`;
      return `<li class="shop-item adv-block wd-stage" data-stage="${esc(st.id)}" data-state="${st.state}">
        <span class="shop-ic" aria-hidden="true">${esc(st.icon)}</span>
        <div class="shop-tx"><b class="shop-name">${esc(fill(WT.stage, { n: st.n }))}: ${esc(st.title)}</b><small>${esc(st.learn)}</small><small class="wd-needs">${esc(WT.needs)}: ${needs}</small></div>
        <span class="shop-owned wd-state" data-act="none">${esc(label[st.state])}</span>
      </li>`;
    });
    const nxt = ws.find((x) => x.state !== 'done');
    root.innerHTML = `
      <section class="adv adv-shop adv-world" data-screen="world" aria-label="${esc(WT.title)}">
        <header class="adv-hud task">
          <button type="button" class="adv-btn round" data-act="worldback" aria-label="${esc(WT.back)}"><span aria-hidden="true">✖</span></button>
          <h2 class="adv-title adv-block"><span aria-hidden="true">🌍</span> ${esc(WT.title)}</h2>
          <div class="adv-pill adv-block coin" aria-label="${esc(T.hudCoin)}: ${p.coins}"><i aria-hidden="true">🪙</i><b data-coins="${p.coins}">${p.coins}</b></div>
          <button type="button" class="adv-btn round" data-act="sound" aria-label="${esc(sound ? T.menuSoundOn : T.menuSoundOff)}" aria-pressed="${sound}"><span aria-hidden="true">${sound ? '🔊' : '🔇'}</span></button>
        </header>
        <p class="shop-bag adv-block" role="status">${esc(WT.nextNeed)}: ${nxt ? esc(nxt.title) + (nxt.missing.length ? ' — ' + nxt.missing.map((m) => esc(m.title)).join(', ') : ' — ' + esc(WT.needsNone)) : ''}</p>
        <ul class="shop-grid">${rows.join('')}</ul>
        <div class="shop-btns"><button type="button" class="adv-btn primary" data-act="shop">🛒 ${esc(WT.goShop)}</button></div>
        <div class="adv-rotate" aria-hidden="true"><span class="phone">📱</span><p>${esc(T.rotate)}</p></div>
      </section>`;
  }
  function closeConfirm() {
    pendingBuy = null;
    const c = root.querySelector('.shop-confirm');
    if (c) c.hidden = true;
  }
  function askBuy(id) {
    if (screen !== 'shop') return;
    const p = prog();
    const d = canBuy(storage.getAdv(), cfg, id, p.coins);
    const it = itemById(cfg, id);
    if (!d.ok) {
      play('gentle');
      const m = d.reason === 'owned' ? MT.already : MT.noCoin;
      const el = root.querySelector('.shop-msg');
      el.textContent = m;
      el.hidden = false;
      el.classList.add('warn');
      speak(d.reason === 'owned' ? MT.already : MT.sayNo);
      return;
    }
    play('tap');
    pendingBuy = id;
    const c = root.querySelector('.shop-confirm');
    c.querySelector('.shop-q').textContent = fill(MT.confirm, { title: it.title, price: it.price });
    c.hidden = false;
    c.querySelector('[data-act="buyyes"]').focus();
  }
  // Satin alma: onay beklemiyorsa (cift tiklama) hicbir sey yapmaz. Bakiye karari TAZE durumdan verilir; yazma hatasinda coin harcanmaz.
  function doBuy() {
    const id = pendingBuy;
    if (!id || screen !== 'shop') return;
    pendingBuy = null;
    const d = canBuy(storage.getAdv(), cfg, id, prog().coins);
    const it = itemById(cfg, id);
    if (!d.ok) return showShop({ msg: d.reason === 'owned' ? MT.already : MT.noCoin, warn: true });
    const r = storage.buyItem(id);
    if (!r.saved) {
      play('gentle');
      showShop({ msg: MT.saveFail, warn: true });
      return;
    }
    if (!r.ok) return showShop({ msg: MT.already, warn: true });
    play('coin');
    showShop({ fresh: id, msg: fill(MT.bought, { title: it.title }) });
    speak(MT.sayBought);
  }

  function onClick(e) {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'node') {
      const id = b.dataset.id;
      if (b.dataset.state === 'locked') {
        play('gentle');
        b.classList.remove('shake');
        void b.offsetWidth;
        b.classList.add('shake');
        react('hint', T.lockedHint);
      } else {
        play('tap');
        openTask(id);
      }
    } else if (act === 'back') showMap();
    else if (act === 'tomap') showMap({ newly: root.querySelector('.adv-reward')?.dataset.newly || null, region: currentTask ? regionOf(cfg, currentTask.id) : null });
    else if (act === 'region') {
      play('tap');
      const ri = cfg.regions.findIndex((x) => x.id === b.dataset.region);
      if (ri >= 0 && prog().regions[ri]?.unlocked) showMap({ region: ri });
    } else if (act === 'shop') {
      play('tap');
      showShop();
    } else if (act === 'world') {
      play('tap');
      showWorld();
    } else if (act === 'worldback' || act === 'shopback') showMap();
    else if (act === 'buy') askBuy(b.dataset.id);
    else if (act === 'buyno') closeConfirm();
    else if (act === 'buyyes') doBuy();
    else if (act === 'again') {
      play('retry');
      openTask(currentTask.id);
    }
    else if (act === 'sound') toggleSound();
    else if (act === 'replay') {
      if (!storage.get().sound) warn(T.voiceOffNote);
      else speak(root.querySelector('[data-say]')?.textContent || currentTask?.say);
    } else if (act === 'vwclose') root.querySelector('.adv-voicewarn').hidden = true;
    else if (act === 'musictoggle') {
      const m = !storage.getMix().music;
      storage.setMix({ music: m });
      applyMix?.();
      b.setAttribute('aria-pressed', String(m));
      b.firstChild.textContent = `${m ? '🎵' : '🔕'} `;
      b.querySelector('span').textContent = m ? T.menuMusicOn : T.menuMusicOff;
      play('tap');
    }
    else if (act === 'menu') openSheet();
    else if (act === 'close') closeSheet();
    else if (act === 'mini') location.hash = '#/games';
    else if (act === 'intro') location.hash = '#/intro';
  }

  return {
    mount(container) {
      root = container;
      mascot?.setExplicit(true);
      unreg = registerBack?.(handleBack);
      root.addEventListener('click', onClick);
      // V8.0-proto1 gorev kimlikleri -> V8.1 kimlikleri (ilerleme/yildiz korunur; ayni gorev ikinci kez coin vermez)
      storage.migrateAdvIds(Object.fromEntries(cfg.tasks.filter((t) => t.legacy).map((t) => [t.legacy, t.id])));
      if (entry === 'intro') showIntro();
      else showMap({ welcome: true });
    },
    unmount() {
      dead = true;
      clearSub();
      unreg?.();
      root?.removeEventListener('click', onClick);
      mascot?.park();
      mascot?.setExplicit(false);
      if (root) root.innerHTML = '';
    }
  };
}

export default { id: 'adventure', icon: '🗺️', create };
