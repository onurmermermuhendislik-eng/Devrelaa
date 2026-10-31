// V8.5 Karanlik Ev Macerasi (ortak macera platformunun ilk "sinematik + kesif + devre" bolumu).
// AKIS: 1 sinematik acilis (akşam, ev karanlik, lambalar yanmiyor) -> 2 sesli gorev -> 3 KESIF (karanlik odada parcalari bul) ->
//       4 DEVRE (mevcut devre motoru: pil + anahtar + lamba) -> 5 lamba yanar, ev aydinlanir (isik/animasyon/ses/karakter tepkisi) -> 6 sonraki maceraya gecis.
// Yeniden kullanir: circuit.js (devre tahtasi + benzetim), index.js (coin/yildiz/odul: ayni gorev ikinci kez coin VERMEZ), voice.speak, audio, ambience.
// Gorsel: katmanli SVG/CSS (video yok; ag yok). Hareket azaltma tercihinde sinematik animasyonsuz gecer. GUVENLIK: yalniz pil gibi kucuk
// oyun parcalari; priz/sebeke/kablo cekme/islak elle dokunma ASLA yok (test denetler).
import { mountCircuit } from './circuit.js';
import { partSvg, esc } from './svg.js';
import { createSceneRuntime, idleHint, reducedMotion } from './scene-kit.js';

const CAPTION_AT = [0, 3200, 6400]; // sinematik alt yazi zamanlari (ms)
const CINEMA_END = 9600;

const childSvg = () => `<svg class="dh-kid-svg" viewBox="0 0 60 100" aria-hidden="true" focusable="false">
  <ellipse cx="30" cy="96" rx="16" ry="3.5" fill="#000" opacity=".28"/>
  <g class="dh-legs"><rect class="l1" x="20" y="66" width="8" height="26" rx="4" fill="#2f4a8a"/><rect class="l2" x="32" y="66" width="8" height="26" rx="4" fill="#2f4a8a"/></g>
  <rect x="14" y="36" width="32" height="36" rx="12" fill="#ffb02e"/><rect x="14" y="52" width="32" height="6" fill="#e5483e" opacity=".85"/>
  <g class="dh-arms"><rect x="6" y="40" width="9" height="24" rx="4.5" fill="#ffb02e"/><rect x="45" y="40" width="9" height="24" rx="4.5" fill="#ffb02e"/></g>
  <circle cx="30" cy="24" r="16" fill="#ffd9b0"/><path d="M14 22q2-16 16-16t16 16q-8-8-16-8t-16 8z" fill="#5b3a1e"/>
  <circle cx="24" cy="26" r="2.2" fill="#2b2b2b"/><circle cx="36" cy="26" r="2.2" fill="#2b2b2b"/><path class="dh-mouth" d="M24 33q6 5 12 0" stroke="#8a3b2b" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`;

const houseSvg = () => `<svg class="dh-house-svg" viewBox="0 0 320 200" preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
  <polygon class="dh-roof" points="40,86 160,16 280,86"/>
  <rect class="dh-wall" x="58" y="84" width="204" height="106" rx="4"/>
  <rect class="dh-door" x="140" y="120" width="40" height="70" rx="6"/><circle cx="170" cy="156" r="3" fill="#ffd23f"/>
  <rect class="dh-win" x="76" y="104" width="44" height="40" rx="5"/><rect class="dh-win" x="200" y="104" width="44" height="40" rx="5"/>
  <path d="M98 104v40M76 124h44M222 104v40M200 124h44" stroke="#0b1226" stroke-width="3" opacity=".6"/>
  <rect x="226" y="40" width="22" height="40" class="dh-chimney"/></svg>`;

const roomSvg = () => `<svg class="dh-room-svg" viewBox="0 0 400 240" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
  <defs><linearGradient id="dhw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#26335f"/><stop offset="1" stop-color="#1a2244"/></linearGradient>
  <radialGradient id="dhmoon" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#cfe0ff" stop-opacity=".55"/><stop offset="1" stop-color="#cfe0ff" stop-opacity="0"/></radialGradient></defs>
  <rect width="400" height="240" fill="url(#dhw)"/><rect class="dh-floor" y="170" width="400" height="70"/>
  <path d="M0 170h400" stroke="#0b1226" stroke-width="3" opacity=".5"/>
  <g class="dh-window"><rect x="228" y="26" width="86" height="64" rx="6" fill="#0d1a3d" stroke="#3b4a80" stroke-width="4"/><path d="M271 26v64M228 58h86" stroke="#3b4a80" stroke-width="3"/><circle cx="296" cy="44" r="9" fill="#e9f1ff"/><ellipse cx="270" cy="150" rx="76" ry="22" fill="url(#dhmoon)"/></g>
  <rect x="30" y="118" width="86" height="56" rx="8" fill="#4a3322"/><rect x="30" y="118" width="86" height="12" rx="6" fill="#6b4a30"/>
  <rect x="150" y="128" width="96" height="46" rx="6" fill="#3a3f66"/><rect x="156" y="136" width="40" height="14" rx="3" fill="#2a2f52"/><rect x="204" y="136" width="36" height="14" rx="3" fill="#2a2f52"/>
  <rect x="318" y="66" width="62" height="108" rx="6" fill="#3d2e24"/><path d="M349 70v100" stroke="#241912" stroke-width="3"/>
  <ellipse cx="200" cy="205" rx="120" ry="14" fill="#000" opacity=".22"/></svg>`;

export function mountDarkHouse(host, { task, text, audio, mascot, onSolved, speak, band = '4-5', ambience = null, voice = null, music = null }) {
  const U = task.ui;
  const cap = (i) => task.scenes[i]?.learn || '';
  const spots = task.spots.filter((s) => !(s.hard && band === '4-5'));
  const NEED = ['battery', 'switch', 'lamp'];
  const found = new Set(); // bulunan spot kimlikleri
  const foundTypes = () => [...found].map((id) => task.spots.find((s) => s.id === id)?.finds).filter(Boolean);
  let stage = 'cinema';
  let sub = null; // devre alt gorevi
  let dead = false;
  let obs = null;
  let idle = null;
  const rt = createSceneRuntime({ audio, mascot, voice, speak, ambience, music }); // ortak sahne calisma zamani (zamanlayici/ses/maskot/arka plan)
  const { later, play, react } = rt;
  const reduce = reducedMotion;

  host.innerHTML = `
    <section class="dh" data-stage="cinema" data-lit="0" data-found="0" aria-label="${esc(task.title)}">
      <div class="dh-view" aria-hidden="false"></div>
      <p class="dh-say adv-block" data-say aria-live="polite"></p>
      <button type="button" class="adv-btn soft dh-skip" data-dh="skip">${esc(U.skip)}</button>
    </section>`;
  const root = host.querySelector('.dh');
  const view = root.querySelector('.dh-view');
  const sayEl = root.querySelector('.dh-say');
  const skipBtn = root.querySelector('.dh-skip');
  const setStage = (s) => {
    stage = s;
    root.dataset.stage = s;
  };
  const talk = (t, prio = 1) => rt.say(sayEl, t, prio);
  const snd = (st) => rt.scene(task.sound?.[st]);

  // ---- 1. Sinematik acilis ----------------------------------------------------------------------------------
  function cinema() {
    setStage('cinema');
    skipBtn.hidden = false;
    snd('cinema');
    view.innerHTML = `<div class="dh-cine${reduce() ? ' still' : ''}" data-dark="1">
      <div class="dh-sky" aria-hidden="true"><i class="dh-moon"></i><b></b><b></b><b></b><b></b><b></b></div>
      <div class="dh-houseWrap">${houseSvg()}</div>
      <div class="dh-ground" aria-hidden="true"></div>
      <div class="dh-kid" data-pos="walk">${childSvg()}</div>
    </div>`;
    talk(cap(0));
    later(() => {
      root.querySelector('.dh-cine')?.setAttribute('data-arrived', '1');
      react('hint');
      talk(cap(1));
    }, CAPTION_AT[1]);
    later(() => talk(cap(2)), CAPTION_AT[2]);
    later(() => search(), CINEMA_END);
  }

  // ---- 2-3. Gorev + kesif -----------------------------------------------------------------------------------
  function search() {
    if (stage !== 'cinema') return;
    rt.clearTimers();
    setStage('search');
    skipBtn.hidden = true;
    snd('search');
    view.innerHTML = `<div class="dh-search">
      <div class="dh-roomBox">${roomSvg()}
        <div class="dh-beam" aria-hidden="true"></div>
        ${spots
          .map((s) => `<button type="button" class="dh-spot${s.finds ? '' : ' clue'}" data-dh="spot" data-id="${esc(s.id)}" data-finds="${esc(s.finds || '')}" style="left:${s.x}%;top:${s.y}%" aria-label="${esc(s.label)}"><span aria-hidden="true">${esc(s.icon)}</span></button>`)
          .join('')}
      </div>
      <aside class="dh-bag adv-block" aria-label="${esc(U.bag)}">
        <h3 class="cx-h">${esc(U.bag)}</h3>
        <div class="dh-bagItems" data-n="0"></div>
        <button type="button" class="adv-btn primary pulse dh-build" data-dh="build" hidden>${esc(U.build)}</button>
      </aside>
    </div>`;
    talk(task.say);
    // Bosta kalan cocuga ipucu: ses + maskot + siradaki eksik parcanin noktasi parlar (yas bandina uygun: tuzaklar gosterilmez)
    idle = idleHint(rt, task.ui.idleMs ?? 14000, () => {
      if (stage !== 'search') return;
      const miss = NEED.filter((n) => !foundTypes().includes(n));
      const spot = spots.find((sp) => sp.finds === miss[0] && !found.has(sp.id));
      view.querySelectorAll('.dh-spot.nudge').forEach((e) => e.classList.remove('nudge'));
      if (spot) view.querySelector(`.dh-spot[data-id="${spot.id}"]`)?.classList.add('nudge');
      react('hint');
      talk(task.hints.idle, 2);
    });
    const box = view.querySelector('.dh-roomBox');
    const beam = (e) => {
      const r = box.getBoundingClientRect();
      if (!r.width) return;
      box.style.setProperty('--fx', `${Math.round(((e.clientX - r.left) / r.width) * 100)}%`);
      box.style.setProperty('--fy', `${Math.round(((e.clientY - r.top) / r.height) * 100)}%`);
    };
    box.addEventListener('pointermove', beam);
    box.addEventListener('pointerdown', beam);
  }

  function paintBag() {
    const el = view.querySelector('.dh-bagItems');
    if (!el) return;
    const types = foundTypes();
    el.dataset.n = String(types.length);
    root.dataset.found = String(types.length);
    el.innerHTML = types.map((t) => `<span class="dh-got" data-type="${esc(t)}">${partSvg(t)}<small>${esc(text.parts?.[t] || t)}</small></span>`).join('') || `<small class="dh-empty">${esc(U.empty)}</small>`;
    const ready = NEED.every((n) => types.includes(n));
    const b = view.querySelector('.dh-build');
    if (b) b.hidden = !ready;
    root.dataset.ready = ready ? '1' : '0';
  }

  function onSpot(btn) {
    if (stage !== 'search') return;
    const s = task.spots.find((x) => x.id === btn.dataset.id);
    if (!s) return;
    if (!s.finds) {
      play('tap');
      talk(s.say, 2);
      return;
    }
    if (found.has(s.id)) {
      play('tap');
      return;
    }
    found.add(s.id);
    btn.classList.add('got');
    btn.dataset.got = '1';
    btn.setAttribute('aria-label', `${s.label} (${U.opened})`);
    const bad = s.finds === 'stone' || s.finds === 'leaf';
    play(bad ? 'gentle' : 'correct');
    react(bad ? 'hint' : 'correct');
    talk(s.say, 2);
    paintBag();
    view.querySelectorAll('.dh-spot.nudge').forEach((e) => e.classList.remove('nudge'));
    idle?.poke();
  }

  // ---- 4. Devre ---------------------------------------------------------------------------------------------
  function build() {
    if (stage !== 'search' || !NEED.every((n) => foundTypes().includes(n))) return;
    setStage('build');
    idle?.stop();
    snd('build');
    const types = new Set(foundTypes());
    const ctask = { ...task, kind: 'circuit', board: { ...task.board, tray: task.board.tray.filter((p) => types.has(p.type)) } };
    view.innerHTML = `<div class="dh-buildBox" data-lit="0"><div class="dh-circHost"></div></div>`;
    const box = view.querySelector('.dh-buildBox');
    sayEl.hidden = true; // devre kendi [data-say] yonergesini gosterir
    sub = mountCircuit(box.querySelector('.dh-circHost'), {
      task: ctask,
      text,
      audio,
      mascot,
      band,
      speak,
      onSolved: ({ mistakes }) => lit(mistakes)
    });
    talk(task.hints.start, 2); // R6: devre asamasinin yonergesi (kayitli MP3) sesli okunur; sayEl gizli, metin devrenin kendi satirinda
    const c = box.querySelector('.adv-circuit');
    root.dataset.lit = '0';
    // lamba yaninca ev aydinlanir (devre motorunun data-lit durumunu dinler)
    obs = new MutationObserver(() => {
      const v = c.dataset.lit === '1' ? '1' : '0';
      box.dataset.lit = v;
      root.dataset.lit = v;
      if (v === '1') snd('lit'); // lamba yandi: muzik UMUT VEREN basari temasina doner
    });
    obs.observe(c, { attributes: true, attributeFilter: ['data-lit'] });
  }

  // ---- 5-6. Isik yandi + sonraki maceraya gecis ---------------------------------------------------------------
  function lit(mistakes) {
    if (stage !== 'build') return;
    obs?.disconnect();
    sub?.destroy?.();
    sub = null;
    setStage('lit');
    root.dataset.lit = '1';
    sayEl.hidden = false;
    snd('lit');
    view.innerHTML = `<div class="dh-cine dh-final" data-dark="0" data-arrived="1">
      <div class="dh-sky" aria-hidden="true"><i class="dh-moon"></i><b></b><b></b><b></b></div>
      <div class="dh-houseWrap">${houseSvg()}</div><div class="dh-ground" aria-hidden="true"></div>
      <div class="dh-kid" data-pos="door" data-joy="1">${childSvg()}</div>
      <div class="dh-sparks" aria-hidden="true">${Array.from({ length: 12 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
      <button type="button" class="adv-btn primary big pulse dh-next" data-dh="next">${esc(U.next)}</button>
    </div>`;
    react('done'); // basari muzigi/sesi tek yerden: odul ekraninda (index.js complete)
    sayEl.textContent = task.win; // R6: "Basardin..." cumlesini devre asamasi (circuit.js) zaten SESLI okudu; burada yalniz yazi (ayni MP3 ikinci kez calinmasin)
    view.querySelector('.dh-next').dataset.m = String(mistakes || 0);
  }

  function finish(mistakes) {
    if (dead || stage !== 'lit') return;
    view.querySelector('.dh-next')?.remove(); // odul penceresinin altinda kalip dokunmayi engellemesin / cift tetiklenmesin
    onSolved({ mistakes });
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-dh]');
    if (!b) return;
    const act = b.dataset.dh;
    if (act === 'skip') search();
    else if (act === 'spot') onSpot(b);
    else if (act === 'build') build();
    else if (act === 'next') finish(Number(b.dataset.m) || 0);
  });

  cinema();
  return {
    destroy() {
      dead = true;
      idle?.stop();
      obs?.disconnect();
      sub?.destroy?.();
      rt.destroy();
    },
    skip: () => search(),
    state: () => ({ stage, found: [...found], lit: root.dataset.lit === '1', circuit: sub?.state?.() || null })
  };
}
