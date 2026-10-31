// MiniLab maskotu (V7.8, V2: V7.9). Tamamen cevrimdisi: satir ici SVG + CSS. Yeni SES YOK (yalniz gorsel tepki + kisa yazi);
// mevcut ses altyapisinin calislarina ctx.audio.play uzerinden "dinleyerek" eslik eder, boylece sesle zamanlama aynidir.
// Saf mantik (createBrain) DOM'a dokunmaz ve birim testle denenir: ayni mesaj art arda tekrarlanmaz, her tepkinin bekleme suresi vardir.

// kind -> { mood, priority, cooldown(ms), hold(ms) }
export const KINDS = {
  greet: { mood: 'wave', priority: 1, cooldown: 0, hold: 3200 },
  enter: { mood: 'cheer', priority: 1, cooldown: 6000, hold: 2600 },
  correct: { mood: 'joy', priority: 2, cooldown: 1500, hold: 2200 },
  wrong: { mood: 'cheer', priority: 2, cooldown: 6000, hold: 2600 },
  hint: { mood: 'think', priority: 2, cooldown: 4000, hold: 2800 },
  done: { mood: 'party', priority: 3, cooldown: 2500, hold: 3200 },
  // V7.9: Enerji Macerasi yol arkadasi (acilista tek sefer, sakin)
  adventure: { mood: 'wave', priority: 1, cooldown: 8000, hold: 3200 },
  // V8.0 Macera haritasi (kisa yonlendirmeler)
  mapStart: { mood: 'wave', priority: 1, cooldown: 0, hold: 4200 },
  mapNext: { mood: 'cheer', priority: 2, cooldown: 0, hold: 3800 },
  mapFinal: { mood: 'party', priority: 3, cooldown: 0, hold: 4500 }
};

// Ses adi -> tepki (yalniz "acik kaynak" ekranlar icin: Sekli Tamamla, Sayi Avi, Mucit Atolyesi, Egitim). Gorev kabugu kendi olaylarini bildirir.
export const SOUND_KIND = { correct: 'correct', circuitOn: 'correct', gentle: 'wrong', success: 'done', levelUp: 'done', jingle: 'done' };

export function createBrain({ messages = {}, rng = Math.random, now = () => Date.now() } = {}) {
  const last = {}; // kind -> son gosterilen zaman
  const lastText = {}; // kind -> son metin indeksi
  let greeted = false;
  let showing = { priority: 0, until: 0 };
  return {
    clearShowing() {
      showing = { priority: 0, until: 0 };
    },
    // -> { kind, mood, text, hold } | null (bekleme suresi icinde / daha onemli tepki gorunurken)
    react(kind) {
      const k = KINDS[kind];
      if (!k) return null;
      const t = now();
      if (kind === 'greet') {
        if (greeted) return null;
      } else if (last[kind] != null && t - last[kind] < k.cooldown) return null;
      if (t < showing.until && k.priority < showing.priority) return null; // kutlama sirasinda daha kucuk tepki araya girmez
      let pool = messages[kind] || [];
      if (kind === 'greet' && greeted) pool = [];
      if (!pool.length) return null;
      let i = Math.floor(rng() * pool.length) % pool.length;
      if (pool.length > 1 && i === lastText[kind]) i = (i + 1) % pool.length; // art arda ayni cumle yok
      lastText[kind] = i;
      last[kind] = t;
      if (kind === 'greet') greeted = true;
      showing = { priority: k.priority, until: t + k.hold };
      return { kind, mood: k.mood, text: pool[i], hold: k.hold };
    }
  };
}


// ---- V7.9 Maskot V2: guvenli yerlesim (saf; DOM yok) -------------------------------------------------------------------
// Oyun ekraninda maskot gecici bir kaplamadir (dokunmayi zaten engellemez). Ama cevaplari/dugmeleri/aciklama yazisini GORSEL olarak da
// ortmemeli: kosullar buyukten kucuge, dort kosede denenir; hicbiri bos degilse yalniz kucuk maskot (balonsuz) en az ortusen yere konur.
export const PLACE_SIZES = [88, 68, 52];
export const PLACE_COMPACT = 44;
const hit = (a, b, m = 8) => a.l < b.r + m && a.r > b.l - m && a.t < b.b + m && a.b > b.t - m;
const area = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));

// vp: { w, h }, blocked: [{l,t,r,b}], bubble: { w, h } (balonun olcusu), edge: kenar boslugu
// Yerlesim turleri: 'side' (balon maskotun yaninda), 'above' (balon maskotun ustunde), balonsuz (kucuk maskot).
export function choosePlacement({ vp, blocked = [], bubble = { w: 0, h: 0 }, edge = 8, sizes = PLACE_SIZES, compact = PLACE_COMPACT, gap = 6 } = {}) {
  const build = (size, corner, layout, at = null) => {
    const left = corner.endsWith('left');
    const top = corner.startsWith('top');
    const artH = size * 1.25;
    let bw = 0;
    let bh = 0;
    if (layout === 'side') bw = Math.max(0, Math.min(bubble.w, vp.w - size - edge * 2 - gap));
    else if (layout === 'above') bw = Math.max(0, Math.min(bubble.w, vp.w - edge * 2));
    if (bw) bh = Math.ceil(bubble.h * Math.max(1, bubble.w / Math.max(1, bw)));
    const totalW = layout === 'side' ? size + (bw ? gap + bw : 0) : Math.max(size, bw);
    const totalH = layout === 'above' ? artH + (bh ? gap + bh : 0) : Math.max(artH, bh);
    const x0 = at ? at.x : left ? edge : vp.w - edge - totalW;
    const y0 = at ? at.y : top ? edge : vp.h - edge - totalH;
    const artL = layout === 'above' ? (left ? x0 : x0 + totalW - size) : left ? x0 : x0 + totalW - size;
    const art = { l: artL, t: layout === 'above' ? y0 + totalH - artH : y0 + totalH - artH, r: artL + size, b: 0 };
    art.b = art.t + artH;
    let bub = null;
    if (bw) {
      bub = layout === 'above' ? { l: left ? x0 : x0 + totalW - bw, t: y0, r: 0, b: 0 } : { l: left ? x0 + size + gap : x0, t: y0 + totalH - bh - 2, r: 0, b: 0 };
      bub.r = bub.l + bw;
      bub.b = bub.t + bh;
    }
    return { corner, size, layout: bw ? layout : 'none', art, bubble: bub, bubbleW: bw, withBubble: !!bw, union: { l: x0, t: y0, r: x0 + totalW, b: y0 + totalH } };
  };
  const corners = ['bottom-left', 'bottom-right', 'top-right', 'top-left'];
  const minW = Math.min(bubble.w, 110);
  if (bubble.w > 0) {
    for (const size of sizes) for (const layout of ['side', 'above']) for (const c of corners) {
      const p = build(size, c, layout);
      if (p.bubbleW >= minW && !blocked.some((b) => hit(p.union, b))) return { ...p, safe: true };
    }
  }
  for (const size of [...sizes, compact]) for (const c of corners) {
    const p = build(size, c, 'none');
    if (!blocked.some((b) => hit(p.union, b))) return { ...p, safe: true };
  }
  // V7.9 duzeltme: koseler dolu olsa da kenar boyunca kaydirarak bos bir yer ara (ornek: yatay ekranda gorev bitis ekrani, kosede dugmeler var).
  // Once guvenli pay (8px), sonra pay olmadan (kesin kesisimsiz); balonsuz kucuk maskot, buyukten kucuge.
  for (const m of [8, 0]) {
    for (const size of [...sizes, compact]) {
      const artH = size * 1.25;
      const xs = [];
      const ys = [];
      for (let y = vp.h - edge - artH; y >= edge; y -= 8) ys.push(Math.round(y));
      for (let x = vp.w - edge - size; x >= edge; x -= 8) xs.push(Math.round(x));
      const cand = [];
      for (const y of ys) cand.push({ x: vp.w - edge - size, y });
      for (const y of ys) cand.push({ x: edge, y });
      for (const x of xs) cand.push({ x, y: vp.h - edge - artH });
      for (const x of xs) cand.push({ x, y: edge });
      for (const at of cand) {
        const corner = `${at.y + artH / 2 > vp.h / 2 ? 'bottom' : 'top'}-${at.x + size / 2 > vp.w / 2 ? 'right' : 'left'}`;
        const p = build(size, corner, 'none', at);
        if (p.union.l < 0 || p.union.t < 0 || p.union.r > vp.w || p.union.b > vp.h) continue;
        if (!blocked.some((b) => hit(p.union, b, m))) return { ...p, safe: true };
      }
    }
  }
  // hicbir yer tamamen bos degil: en az ortusen kose, en kucuk boyut, balonsuz
  let best = null;
  for (const c of corners) {
    const p = build(compact, c, 'none');
    const o = blocked.reduce((n, b) => n + area(p.union, b), 0);
    if (!best || o < best.o) best = { ...p, o };
  }
  return { ...best, safe: false };
}

export function mascotSvg() {
  return `<svg class="m-svg" viewBox="0 0 140 176" focusable="false" aria-hidden="true">
  <defs>
    <linearGradient id="mb-body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#d4e3ff"/></linearGradient>
    <linearGradient id="mb-visor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a3d8f"/><stop offset="1" stop-color="#0b1f4a"/></linearGradient>
    <radialGradient id="mb-glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff3a8"/><stop offset="1" stop-color="#ffd23f" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="70" cy="171" rx="34" ry="4.5" fill="#0b1f4a" opacity="0.15"/>
  <g class="m-conf"><rect x="8" y="30" width="7" height="3.5" rx="1" fill="#ff5d73"/><rect x="124" y="26" width="7" height="3.5" rx="1" fill="#2f6bff"/><rect x="18" y="64" width="6" height="3" rx="1" fill="#ffd23f"/><rect x="118" y="62" width="6" height="3" rx="1" fill="#19b6c9"/><circle cx="30" cy="14" r="3" fill="#8f6bf5"/><circle cx="112" cy="12" r="3" fill="#25a855"/></g>
  <g class="m-all">
    <rect x="44" y="150" width="21" height="17" rx="8.5" fill="#2f6bff"/><rect x="75" y="150" width="21" height="17" rx="8.5" fill="#2f6bff"/>
    <g class="m-arm m-arm-l"><rect x="14" y="104" width="16" height="36" rx="8" fill="url(#mb-body)" stroke="#2f6bff" stroke-width="3.5"/><circle cx="22" cy="143" r="8.5" fill="#2f6bff"/></g>
    <g class="m-arm m-arm-r"><rect x="110" y="104" width="16" height="36" rx="8" fill="url(#mb-body)" stroke="#2f6bff" stroke-width="3.5"/><circle cx="118" cy="143" r="8.5" fill="#2f6bff"/></g>
    <rect x="32" y="92" width="76" height="62" rx="28" fill="url(#mb-body)" stroke="#2f6bff" stroke-width="4"/>
    <circle cx="70" cy="123" r="19" fill="#2f6bff"/>
    <path d="M76 107 L60 126 h10 l-6 17 17-21 h-10 z" fill="#ffd23f" stroke="#e0a800" stroke-width="1.4" stroke-linejoin="round"/>
    <line x1="70" y1="9" x2="70" y2="22" stroke="#2f6bff" stroke-width="4" stroke-linecap="round"/>
    <circle class="m-glow" cx="70" cy="7" r="12" fill="url(#mb-glow)"/>
    <circle class="m-ant" cx="70" cy="7" r="5.8" fill="#ffd23f" stroke="#e0a800" stroke-width="1.6"/>
    <circle cx="14" cy="56" r="9" fill="#2f6bff"/><circle cx="126" cy="56" r="9" fill="#2f6bff"/>
    <rect x="16" y="20" width="108" height="78" rx="36" fill="url(#mb-body)" stroke="#2f6bff" stroke-width="4"/>
    <rect x="27" y="31" width="86" height="56" rx="27" fill="url(#mb-visor)"/>
    <g class="m-brows"><path class="m-brow m-brow-l" d="M38 38 Q47 33 56 37" stroke="#8fd3ff" stroke-width="3.2" fill="none" stroke-linecap="round"/><path class="m-brow m-brow-r" d="M84 37 Q93 33 102 38" stroke="#8fd3ff" stroke-width="3.2" fill="none" stroke-linecap="round"/></g>
    <g class="m-eyes"><ellipse cx="50" cy="57" rx="11" ry="12.5" fill="#38bdf8"/><ellipse cx="90" cy="57" rx="11" ry="12.5" fill="#38bdf8"/><circle cx="54" cy="52" r="3.8" fill="#fff"/><circle cx="94" cy="52" r="3.8" fill="#fff"/><circle cx="46" cy="62" r="1.8" fill="#fff" opacity="0.8"/><circle cx="86" cy="62" r="1.8" fill="#fff" opacity="0.8"/></g>
    <g class="m-happy"><path d="M39 60 Q50 46 61 60" stroke="#38bdf8" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M79 60 Q90 46 101 60" stroke="#38bdf8" stroke-width="5" fill="none" stroke-linecap="round"/></g>
    <ellipse class="m-blush" cx="36" cy="72" rx="7" ry="4" fill="#ff8fb1"/><ellipse class="m-blush" cx="104" cy="72" rx="7" ry="4" fill="#ff8fb1"/>
    <path class="m-mouth m-smile" d="M60 73 Q70 80 80 73" stroke="#38bdf8" stroke-width="3.8" fill="none" stroke-linecap="round"/>
    <path class="m-mouth m-open" d="M58 70 Q70 90 82 70 Z" fill="#38bdf8"/>
    <path class="m-mouth m-hm" d="M62 76 Q70 74 78 76" stroke="#38bdf8" stroke-width="3.8" fill="none" stroke-linecap="round"/>
    <path class="m-mouth m-soft" d="M60 74 Q70 82 80 73" stroke="#38bdf8" stroke-width="3.8" fill="none" stroke-linecap="round"/>
  </g>
  <g class="m-bulb"><circle cx="112" cy="12" r="15" fill="url(#mb-glow)"/><path d="M112 2 a8 8 0 0 1 5 14 v4 h-10 v-4 a8 8 0 0 1 5 -14z" fill="#ffd23f" stroke="#e0a800" stroke-width="1.6" stroke-linejoin="round"/><rect x="108" y="21" width="8" height="3.5" rx="1.5" fill="#6b7a99"/></g>
  <g class="m-spark"><path d="M14 30 l3.5 8 8 3.5 -8 3.5 -3.5 8 -3.5 -8 -8 -3.5 8 -3.5z" fill="#ffd23f"/><path d="M122 18 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" fill="#ffd23f"/><path d="M112 88 l2.4 6 6 2.4 -6 2.4 -2.4 6 -2.4 -6 -6 -2.4 6 -2.4z" fill="#19b6c9"/></g>
</svg>`;
}

// DOM denetleyicisi. Tek ornek; ekranlar attach(slot, mode) ile icine yerlestirir, park() ile bos "dock"a alir.
// mode: 'menu' | 'games' | 'companion' (ekran icinde, yer ayrilmis, surekli gorunur) | 'play' (oyun ekrani: yalniz tepki sirasinda,
// guvenli kosede, dokunmayi ve kaydirmayi engellemez; cevaplari/dugmeleri gorsel olarak da ortmez - choosePlacement)
const BLOCK_SEL = 'button, [role="button"], a[href], input, select, textarea, .cap, [data-opt], [data-item], [data-tool], svg.board, .tk-reward, .tk-overall, .adv-gain, .tk-q, .tk-sub, .tk-trophy, .tk-title, .adv-block';
export function createMascot({ strings = {}, doc = globalThis.document, rng = Math.random, now = () => Date.now() } = {}) {
  const brain = createBrain({ messages: strings.messages || {}, rng, now });
  const el = doc.createElement('div');
  el.className = 'mascot';
  el.dataset.mode = 'play';
  el.dataset.mood = 'idle';
  el.innerHTML = `<div class="m-bubble" role="status" aria-live="polite"></div><div class="m-art" aria-hidden="true">${mascotSvg()}</div>`;
  const bubble = el.querySelector('.m-bubble');
  const dock = doc.createElement('div');
  dock.className = 'mascot-dock';
  dock.appendChild(el);
  doc.body.appendChild(dock);
  let timer = null;
  let explicit = false;
  let muted = false; // acilis ekraninda (jingle) maskot tepki vermez
  let count = 0;
  let lastPlace = null;
  let raf = 0;

  const hide = () => {
    clearTimeout(timer);
    if (typeof globalThis.cancelAnimationFrame === 'function') cancelAnimationFrame(raf);
    brain.clearShowing();
    el.classList.remove('show');
    el.dataset.mood = 'idle';
  };

  // Oyun ekrani: gorunur ve dokunulabilir ogeleri engel say, maskotu bos bir koseye yerlestir
  function placePlay() {
    const vw = doc.documentElement.clientWidth || globalThis.innerWidth || 360;
    const vh = globalThis.innerHeight || doc.documentElement.clientHeight || 640;
    el.classList.add('measuring');
    el.classList.remove('rev', 'compact', 'above');
    bubble.style.maxWidth = `${Math.max(90, Math.min(200, vw - PLACE_SIZES[PLACE_SIZES.length - 1] - 24))}px`;
    bubble.style.width = 'max-content';
    const br = bubble.getBoundingClientRect();
    const blocked = [];
    for (const n of doc.querySelectorAll(BLOCK_SEL)) {
      if (el.contains(n)) continue;
      const r = n.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      blocked.push({ l: r.left, t: r.top, r: r.right, b: r.bottom });
    }
    let pl = choosePlacement({ vp: { w: vw, h: vh }, blocked, bubble: { w: Math.ceil(br.width), h: Math.ceil(br.height) } });
    // Olcu duzeltme: balon dar genislikte tahminden fazla satira sarilabilir; gercek olculerle en fazla 3 kez yeniden hesapla
    const apply = (p) => {
      el.style.left = `${Math.round(p.union.l)}px`;
      el.style.top = `${Math.round(p.union.t)}px`;
      el.style.width = `${Math.round(p.union.r - p.union.l)}px`;
      el.style.setProperty('--m-size', `${p.size}px`);
      // DOM sirasi: balon, maskot. rev = maskot solda (balon sagda)
      el.classList.toggle('rev', p.corner.endsWith('left'));
      el.classList.toggle('compact', !p.withBubble);
      el.classList.toggle('above', p.layout === 'above');
      if (p.withBubble) bubble.style.maxWidth = `${Math.floor(p.bubbleW)}px`;
    };
    for (let i = 0; i < 3; i++) {
      apply(pl);
      if (!pl.withBubble) break;
      const rb = bubble.getBoundingClientRect();
      const re = el.getBoundingClientRect();
      const off = re.top < 0 || re.bottom > vh + 0.5 || re.left < 0 || re.right > vw + 0.5;
      const bad = off || blocked.some((q) => hit({ l: re.left, t: re.top, r: re.right, b: re.bottom }, q, 4));
      if (!bad) break;
      pl = choosePlacement({ vp: { w: vw, h: vh }, blocked, bubble: { w: Math.ceil(rb.width), h: Math.ceil(rb.height) } });
    }
    apply(pl);
    lastPlace = pl;
    el.classList.remove('measuring');
    el.dataset.corner = pl.corner;
    el.dataset.safe = pl.safe ? '1' : '0';
  }

  // override (V8.0): gorev ekranina ozel kisa ipucu metni; verilmezse havuzdan secilir
  function react(kind, override) {
    if (muted) return null;
    const r = brain.react(kind);
    if (!r) return null;
    clearTimeout(timer);
    count += 1;
    bubble.textContent = override || r.text;
    el.dataset.mood = r.mood;
    el.dataset.last = r.kind;
    el.dataset.count = String(count);
    const reveal = () => {
      if (el.dataset.mode === 'play') {
        el.classList.remove('show');
        try {
          placePlay();
        } catch {
          /* yerlesim hatasi oyunu etkilemez: varsayilan kose */
        }
      }
      // animasyonu yeniden baslat (ayni mood arka arkaya gelirse)
      el.classList.remove('show');
      void el.offsetWidth;
      el.classList.add('show');
      clearTimeout(timer);
      timer = setTimeout(hide, r.hold);
    };
    // Oyun ekraninda yerlesim, ayni olayda yapilan ekran degisikliklerinden (ornek: "Devam" dugmesi) SONRA olculur
    if (el.dataset.mode === 'play' && typeof globalThis.requestAnimationFrame === 'function') {
      cancelAnimationFrame(raf);
      timer = setTimeout(hide, r.hold + 200);
      raf = requestAnimationFrame(reveal);
    } else reveal();
    return r;
  }
  return {
    el,
    react,
    // Acik kaynak: Gorev kabugu kendi olaylarini bildirdiginde ses dinleme kapatilir (cift tepki olmasin)
    setExplicit(v) {
      explicit = !!v;
    },
    setMuted(v) {
      muted = !!v;
    },
    onSound(name) {
      if (explicit || muted) return;
      const kind = SOUND_KIND[name];
      if (kind) react(kind);
    },
    attach(slot, mode) {
      if (!slot) return;
      hide();
      el.dataset.mode = mode;
      el.removeAttribute('style');
      el.classList.remove('rev', 'compact', 'above', 'measuring');
      bubble.style.maxWidth = '';
      bubble.style.width = '';
      slot.appendChild(el);
    },
    // V7.9 duzeltme: ekran icerigi degisti (ornek: gorev bitis ekrani) ve maskot hala gorunuyorsa yeniden, guvenli yere yerlestir
    refresh() {
      if (el.dataset.mode !== 'play' || !el.classList.contains('show')) return;
      const again = () => {
        if (el.dataset.mode !== 'play' || !el.classList.contains('show')) return;
        try {
          placePlay();
        } catch {
          /* yerlesim hatasi oyunu etkilemez */
        }
      };
      if (typeof globalThis.requestAnimationFrame === 'function') requestAnimationFrame(again);
      else again();
    },
    park() {
      hide();
      el.dataset.mode = 'play';
      el.removeAttribute('style');
      el.classList.remove('rev', 'compact', 'above', 'measuring');
      bubble.style.maxWidth = '';
      bubble.style.width = '';
      dock.appendChild(el);
    },
    stats: () => ({ count, mode: el.dataset.mode, mood: el.dataset.mood, last: el.dataset.last, corner: el.dataset.corner, safe: el.dataset.safe, size: lastPlace?.size })
  };
}
