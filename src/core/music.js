// V8.5 Macera MUZIGI (ortak altyapi). TUM besteler bu projeye OZGUDUR: WebAudio ile kodla uretilir (ses dosyasi, telif/lisans sorunu YOK).
// Notalar `TRACKS` icindeki desenlerden zamanlanir; hazir kayit/ornek/kutuphane kullanilmaz. Istenirse profesyonel bir kayit `manifest.music[parca]`
// ile (dongu MP3) ayni arayuzle yerine konabilir; dosya yoksa/bozuksa uretilen muzik calar.
// TASARIM KURALLARI (cocuk guvenligi): yumusak tonlar (sinus/ucgen), tiz sivri ses yok (en yuksek nota < ~1.6 kHz), kucuk ikili sesler/tritone yok
// (pentatonik + uyumlu akorlar), ani yuksek ses yok (her parca yumusak girer; tepe genlik testle sinirli), tempo 66-120.
// SES ONCELIGI: anlatim > efekt > ortam sesi > MUZIK. Anlatim baslayinca `duck(true)` muzigi kisar, bitince yumusakca geri getirir.
// Gecis: parca degisince eskisi CAPRAZ SOLAR (ust uste binmez: en fazla bir parca + sonmekte olan bir parca). Ayni parca tekrar istenirse yeniden baslamaz.
const PENTA_MAJ = [0, 2, 4, 7, 9];
const PENTA_MIN = [0, 3, 5, 7, 10];
const PENTA_MIX = [0, 2, 4, 7, 10];

// mel/arp: 8 sekizlik adim; sayi = gam sirasi (>= gam uzunlugu -> bir oktav yukari), '.' = es. chord: koke gore yari tonlar (pad). bass: koke gore yari ton.
export const TRACKS = {
  // Ana macera teması: merak ve kesif; neseli ama sakin
  tema: {
    title: 'Ana Macera Temasi', bpm: 100, root: 60, scale: PENTA_MAJ, gain: 1, voices: ['pad', 'bass', 'pluck', 'tick'],
    bars: [
      { chord: [0, 4, 7], bass: 0, mel: '0 . 2 . 3 . 2 .' },
      { chord: [-3, 0, 4], bass: -3, mel: '4 . 3 . 2 . 3 .' },
      { chord: [-7, -3, 0], bass: -7, mel: '2 . 3 . 4 . 3 2' },
      { chord: [-5, -1, 2], bass: -5, mel: '1 . 2 . 3 . . .' },
      { chord: [0, 4, 7], bass: 0, mel: '3 . 4 . 5 . 4 3' },
      { chord: [-3, 0, 4], bass: -3, mel: '4 . 5 . 6 . 5 .' },
      { chord: [-7, -3, 0], bass: -7, mel: '5 . 4 . 3 . 2 .' },
      { chord: [-5, -1, 2], bass: -5, mel: '2 . 1 . 0 . . .' }
    ]
  },
  // Karanlik Ev 1: merak + hafif gizem (korkutmaz): seyrek, yuksek "celesta" notalari, yavas pad
  'ev-gizem': {
    title: 'Karanlik Ev - Gizem', bpm: 66, root: 57, scale: PENTA_MIN, gain: 0.9, voices: ['pad', 'celesta'],
    bars: [
      { chord: [0, 3, 7], bass: 0, mel: '. . 5 . . . 3 .' },
      { chord: [-4, 0, 3], bass: -4, mel: '. . 6 . 5 . . .' },
      { chord: [0, 3, 7], bass: 0, mel: '. 4 . . 5 . . 3' },
      { chord: [-2, 2, 5], bass: -2, mel: '. . 3 . . . 2 .' }
    ]
  },
  // Karanlik Ev 2: devre kurulurken beklenti, hafif heyecan
  'ev-heyecan': {
    title: 'Karanlik Ev - Devre Heyecani', bpm: 108, root: 57, scale: PENTA_MIN, gain: 0.95, voices: ['pad', 'bass', 'pluck', 'tick'],
    bars: [
      { chord: [0, 3, 7], bass: 0, mel: '0 1 2 3 2 1 2 3' },
      { chord: [-4, 0, 3], bass: -4, mel: '1 2 3 4 3 2 3 4' },
      { chord: [0, 3, 7], bass: 0, mel: '0 1 2 3 4 3 2 1' },
      { chord: [-2, 2, 5], bass: -2, mel: '2 3 4 5 4 3 4 .' }
    ]
  },
  // Karanlik Ev 3: lamba yandi: umut + neseli basari teması (ortam muzigiden belirgin sekilde parlak)
  'ev-basari': {
    title: 'Karanlik Ev - Isik Yandi', bpm: 120, root: 60, scale: PENTA_MAJ, gain: 1, voices: ['pad', 'bass', 'pluck', 'sparkle', 'tick'],
    bars: [
      { chord: [0, 4, 7], bass: 0, mel: '2 3 4 5 4 . 5 .', arp: '5 . 6 . 7 . 6 .' },
      { chord: [-7, -3, 0], bass: -7, mel: '4 . 5 6 5 . 4 .', arp: '6 . 5 . 4 . 5 .' },
      { chord: [-5, -1, 2], bass: -5, mel: '3 4 5 6 7 . 6 .', arp: '7 . 6 . 5 . 6 .' },
      { chord: [0, 4, 7], bass: 0, mel: '5 . 4 . 5 . . .', arp: '7 . . . 5 . . .' }
    ]
  },
  // ---- Sonraki maceralar icin TASARIM (bolumler henuz YOK; yalniz tema/ortam kataloğu hazir, bkz. soundscape.js `ready:false`) ----
  orman: {
    title: 'Ormanda Gece', bpm: 84, root: 62, scale: PENTA_MAJ, gain: 0.9, voices: ['pad', 'flute'],
    bars: [
      { chord: [0, 4, 7], bass: 0, mel: '2 . . 3 . . 4 .' },
      { chord: [-5, -1, 2], bass: -5, mel: '3 . . 2 . . 1 .' },
      { chord: [-7, -3, 0], bass: -7, mel: '2 . 3 . 4 . . .' },
      { chord: [-5, -1, 2], bass: -5, mel: '4 . 3 . 2 . . .' }
    ]
  },
  mahalle: {
    title: 'Mahallede Elektrik', bpm: 100, root: 55, scale: PENTA_MAJ, gain: 0.95, voices: ['bass', 'pluck', 'tick', 'pad'],
    bars: [
      { chord: [0, 4, 7], bass: 0, mel: '2 . 3 . 4 3 2 .' },
      { chord: [5, 9, 12], bass: 5, mel: '4 . 3 . 2 . 1 .' },
      { chord: [0, 4, 7], bass: 0, mel: '3 . 4 5 4 . 3 .' },
      { chord: [7, 11, 14], bass: 7, mel: '2 . 1 . 0 . . .' }
    ]
  },
  koy: {
    title: 'Koyde Su ve Enerji', bpm: 88, root: 53, scale: PENTA_MAJ, gain: 0.9, voices: ['pad', 'pluck', 'bass'],
    bars: [
      { chord: [0, 7, 12], bass: 0, mel: '3 . 4 . 5 . 4 .' },
      { chord: [-5, 2, 7], bass: -5, mel: '4 . 3 . 2 . 3 .' },
      { chord: [0, 7, 12], bass: 0, mel: '5 . 6 . 5 . 4 .' },
      { chord: [-5, 2, 7], bass: -5, mel: '3 . 2 . 1 . . .' }
    ]
  },
  atolye: {
    title: 'Mucit Atolyesi', bpm: 112, root: 60, scale: PENTA_MIX, gain: 0.95, voices: ['pad', 'pluck', 'tick', 'bass'],
    bars: [
      { chord: [0, 4, 7], bass: 0, mel: '0 2 4 2 0 2 4 5' },
      { chord: [5, 9, 12], bass: 5, mel: '1 3 5 3 1 3 5 6' },
      { chord: [0, 4, 7], bass: 0, mel: '2 4 5 4 2 4 5 6' },
      { chord: [-2, 2, 5], bass: -2, mel: '3 2 1 0 1 2 3 .' }
    ]
  }
};

export const trackIds = () => Object.keys(TRACKS);
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const parsePattern = (s) => String(s || '').trim().split(/\s+/).map((t) => (t === '.' ? null : Number(t)));
export const degreeMidi = (spec, deg) => spec.root + spec.scale[deg % spec.scale.length] + 12 * Math.floor(deg / spec.scale.length);
export const stepSec = (spec) => 60 / spec.bpm / 2;
export const barSec = (spec) => stepSec(spec) * 8;
// Bir parcanin TUM notalari (test/analiz): [{ voice, midi, hz, bar, step }]
export function noteList(id) {
  const spec = TRACKS[id];
  const out = [];
  spec.bars.forEach((b, bar) => {
    for (const k of ['chord']) b[k].forEach((c) => out.push({ voice: 'pad', midi: spec.root - 12 + c, bar, step: 0 }));
    out.push({ voice: 'bass', midi: spec.root - 24 + b.bass, bar, step: 0 });
    parsePattern(b.mel).forEach((d, step) => d != null && out.push({ voice: 'mel', midi: degreeMidi(spec, d), bar, step }));
    if (b.arp) parsePattern(b.arp).forEach((d, step) => d != null && out.push({ voice: 'arp', midi: degreeMidi(spec, d) + 12, bar, step }));
  });
  return out.map((n) => ({ ...n, hz: midiHz(n.midi) }));
}

// ---- Sentez parcalari ------------------------------------------------------------------------------------------------
function tone(ctx, out, t, hz, { type = 'sine', gain = 0.1, attack = 0.01, dur = 0.4, partials = [[1, 1]], rel = 0.05 }) {
  for (const [mult, amp] of partials) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz * mult, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * amp), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + rel + 0.05);
  }
}
const noiseCache = new WeakMap();
function tick(ctx, out, t, gain) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    noiseCache.set(ctx, buf);
  }
  const s = ctx.createBufferSource();
  const hp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  s.buffer = buf;
  hp.type = 'highpass';
  hp.frequency.value = 3000;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.045);
  s.connect(hp);
  hp.connect(g);
  g.connect(out);
  s.start(t);
}

// Bir olcu (8 adim) zamanla. out = parca dugumu; echo = (istege bagli) yanki girisi.
export function scheduleBar(ctx, out, id, barIndex, t0, echo = null) {
  const spec = TRACKS[id];
  const bar = spec.bars[barIndex % spec.bars.length];
  const st = stepSec(spec);
  const has = (v) => spec.voices.includes(v);
  const G = spec.gain;
  if (has('pad')) bar.chord.forEach((c) => tone(ctx, out, t0, midiHz(spec.root - 12 + c), { type: 'sine', gain: 0.034 * G, attack: Math.min(1, st * 3), dur: st * 8 - 0.1, rel: st * 1.5, partials: [[1, 1], [2, 0.12]] }));
  if (has('bass')) {
    tone(ctx, out, t0, midiHz(spec.root - 24 + bar.bass), { type: 'triangle', gain: 0.07 * G, attack: 0.02, dur: st * 3.4 });
    tone(ctx, out, t0 + st * 4, midiHz(spec.root - 24 + bar.bass + (bar.chord[2] - bar.chord[0] === 7 ? 7 : 0)), { type: 'triangle', gain: 0.055 * G, attack: 0.02, dur: st * 3 });
  }
  parsePattern(bar.mel).forEach((d, i) => {
    if (d == null) return;
    const hz = midiHz(degreeMidi(spec, d));
    const t = t0 + i * st;
    if (has('pluck')) tone(ctx, out, t, hz, { type: 'triangle', gain: 0.075 * G, attack: 0.008, dur: st * 1.5, partials: [[1, 1], [2, 0.18]] });
    if (has('celesta')) {
      tone(ctx, out, t, hz * 2, { type: 'sine', gain: 0.05 * G, attack: 0.01, dur: st * 3.2, partials: [[1, 1], [3, 0.05]] });
      if (echo) tone(ctx, echo, t, hz * 2, { type: 'sine', gain: 0.025 * G, attack: 0.01, dur: st * 3.2 });
    }
    if (has('flute')) tone(ctx, out, t, hz, { type: 'sine', gain: 0.07 * G, attack: st * 0.5, dur: st * 3, partials: [[1, 1], [2, 0.08]] });
  });
  if (bar.arp && has('sparkle')) parsePattern(bar.arp).forEach((d, i) => d != null && tone(ctx, out, t0 + i * st, midiHz(degreeMidi(spec, d) + 12), { type: 'sine', gain: 0.03 * G, attack: 0.006, dur: st * 1.1 }));
  if (has('tick')) for (let i = 1; i < 8; i += 2) tick(ctx, out, t0 + i * st, 0.012 * G);
}

// ---- Calar (gercek zamanli yonetici) ----------------------------------------------------------------------------------
const MUSIC_MAX = 0.8; // 1.0 ayar = bu ust sinir (varsayilan 0.6 ayar: tepe ~0.1)
const DUCK = 0.35;
const FADE = 1.2;

export function createMusic({ getContext = null, manifest = {}, base = '', enabled = true, volume = 0.6, timer = { set: (f, ms) => setInterval(f, ms), clear: (id) => clearInterval(id) } } = {}) {
  let on = enabled;
  let vol = Math.min(1, Math.max(0, volume));
  let ducked = false;
  let hidden = false;
  let want = null; // istenen parca kimligi (ses kapali/arka planda da hatirlanir)
  let cur = null; // calan parca ornegi
  let fading = []; // sonmekte olan ornekler
  let ctx = null;
  let bus = null;
  let tid = null;
  let duckT = null;
  let starts = 0;
  let ticks = 0;
  const log = [];
  const note = (m) => {
    log.push(m);
    if (log.length > 40) log.shift();
  };

  const level = () => (on && !hidden ? vol * MUSIC_MAX * (ducked ? DUCK : 1) : 0);
  const ensure = () => {
    if (ctx && bus) return true;
    try {
      ctx = getContext?.() || null;
      if (!ctx) return false;
      if (ctx.state === 'suspended') ctx.resume?.().catch?.(() => {});
      bus = ctx.createGain();
      bus.gain.value = 0.0001;
      bus.connect(ctx.destination);
      return true;
    } catch {
      ctx = null;
      bus = null;
      return false;
    }
  };
  const applyLevel = (tau = 0.12) => {
    if (!bus) return;
    try {
      bus.gain.setTargetAtTime(Math.max(0.0001, level()), ctx.currentTime, tau);
    } catch {
      /* yoksay */
    }
  };
  const killInst = (inst) => {
    try {
      inst.out.disconnect();
      inst.echo?.disconnect();
    } catch {
      /* yoksay */
    }
    if (inst.el) {
      try {
        inst.el.pause();
      } catch {
        /* yoksay */
      }
    }
  };
  const fadeOut = (inst, sec = FADE) => {
    inst.dead = true;
    try {
      if (inst.out?.gain) inst.out.gain.setTargetAtTime(0.0001, ctx.currentTime, sec / 4);
    } catch {
      /* yoksay */
    }
    fading.push(inst);
    setTimeout(() => {
      killInst(inst);
      fading = fading.filter((f) => f !== inst);
    }, sec * 1000 + 150);
  };
  const stopTimer = () => {
    if (tid != null) {
      timer.clear(tid);
      tid = null;
    }
  };
  const startTimer = () => {
    if (tid == null) tid = timer.set(tickFn, 120);
  };
  function tickFn() {
    ticks += 1;
    if (!cur || !ctx || hidden || !on) return;
    if (cur.spec) {
      const ahead = ctx.currentTime + 0.7;
      let guard = 0;
      while (cur.next < ahead && guard++ < 4) {
        if (cur.next < ctx.currentTime - 0.05) cur.next = ctx.currentTime + 0.05; // geride kaldiysa topluca calma
        scheduleBar(ctx, cur.out, cur.id, cur.bar, cur.next, cur.echo);
        cur.next += barSec(cur.spec);
        cur.bar += 1;
      }
    }
  }
  function begin(id) {
    if (!TRACKS[id] && !manifest.music?.[id]) return false;
    if (!ensure()) return false;
    const inst = { id, out: ctx.createGain(), echo: null, spec: TRACKS[id] || null, bar: 0, next: ctx.currentTime + 0.1, dead: false, el: null };
    inst.out.gain.value = 0.0001;
    inst.out.connect(bus);
    const path = manifest.music?.[id];
    if (path && typeof Audio !== 'undefined') {
      try {
        const a = new Audio(new URL(path, base || globalThis.document?.baseURI || 'file:///').href);
        a.loop = true;
        a.addEventListener('error', () => {
          inst.el = null;
          inst.spec = TRACKS[id] || null; // dosya bozuksa uretilen muzik
        });
        try {
          ctx.createMediaElementSource(a).connect(inst.out); // dosya muzigi de ayni ses seviyesi/kisma yoluna girer
        } catch {
          /* kaynak baglanamazsa dogrudan calar (kisma uygulanmaz) */
        }
        inst.el = a;
        inst.spec = null;
        a.play().catch(() => {
          inst.el = null;
          inst.spec = TRACKS[id] || null;
        });
      } catch {
        inst.el = null;
        inst.spec = TRACKS[id] || null;
      }
    }
    if (inst.spec && inst.spec.voices.includes('celesta')) {
      try {
        const d = ctx.createDelay(1);
        const fb = ctx.createGain();
        const wet = ctx.createGain();
        d.delayTime.value = (60 / inst.spec.bpm) * 0.75;
        fb.gain.value = 0.28;
        wet.gain.value = 0.5;
        d.connect(fb);
        fb.connect(d);
        d.connect(wet);
        wet.connect(inst.out);
        inst.echo = d;
      } catch {
        inst.echo = null;
      }
    }
    try {
      inst.out.gain.setTargetAtTime(1, ctx.currentTime, FADE / 4);
    } catch {
      /* yoksay */
    }
    if (cur) fadeOut(cur);
    cur = inst;
    starts += 1;
    note(`play ${id}`);
    applyLevel();
    startTimer();
    tickFn();
    return true;
  }

  const api = {
    // Parca iste. Ayni parca zaten caliyorsa YENIDEN baslamaz. Ses/muzik kapaliysa yalniz hatirlanir (acilinca baslar).
    play(id) {
      want = id;
      if (!on || hidden) return false;
      if (cur && !cur.dead && cur.id === id) return true;
      return begin(id);
    },
    stop() {
      want = null;
      if (cur) {
        fadeOut(cur, 0.8);
        cur = null;
      }
      stopTimer();
      note('stop');
    },
    setEnabled(v) {
      const was = on;
      on = !!v;
      if (!on) {
        if (cur) {
          fadeOut(cur, 0.4);
          cur = null;
        }
        stopTimer();
        applyLevel();
      } else if (!was && want && !hidden) begin(want);
    },
    setVolume(v) {
      vol = Math.min(1, Math.max(0, Number(v) || 0));
      applyLevel(0.08);
    },
    // Konusma onceligi: konusurken muzik kisilir, bitince yumusakca geri doner
    duck(v) {
      clearTimeout(duckT);
      if (v) duckT = setTimeout(() => api.duck(false), 15000); // guvenlik: konusma bitis olayi gelmezse muzik sonsuza dek kisik kalmaz
      if (ducked === !!v) return;
      ducked = !!v;
      applyLevel(ducked ? 0.05 : 0.35);
    },
    // Uygulama arka plana gecti: sus, zamanlayiciyi durdur. One gelince AYNI parca kaldigi yerden devam eder (yeniden baslamaz).
    suspend() {
      hidden = true;
      stopTimer();
      applyLevel(0.02);
    },
    resume() {
      if (!hidden) return;
      hidden = false;
      if (!on) return;
      try {
        ctx?.resume?.();
      } catch {
        /* yoksay */
      }
      if (cur && !cur.dead && (!want || cur.id === want)) {
        cur.next = Math.max(cur.next, (ctx?.currentTime || 0) + 0.1);
        applyLevel(0.3);
        startTimer();
      } else if (want) begin(want);
    },
    // test icin elle zamanlama
    _tick: tickFn,
    get state() {
      return { track: cur?.id ?? null, want, playing: !!cur && on && !hidden, enabled: on, volume: vol, ducked, hidden, level: level(), starts, fading: fading.length, ticks, timer: tid != null, source: cur?.el ? 'file' : cur ? 'synth' : null, log: log.slice() };
    }
  };
  return api;
}

// Cevrimdisi (OfflineAudioContext) render: bir parcayi `bars` olcu boyunca zamanlar (test/analiz). Dondurur: AudioBuffer
export async function renderTrack(OfflineCtor, id, bars = 4, sampleRate = 22050) {
  const spec = TRACKS[id];
  const sec = barSec(spec) * bars + 1.5;
  const ctx = new OfflineCtor(1, Math.ceil(sec * sampleRate), sampleRate);
  const out = ctx.createGain();
  out.connect(ctx.destination);
  let echo = null;
  if (spec.voices.includes('celesta')) {
    echo = ctx.createDelay(1);
    const fb = ctx.createGain();
    fb.gain.value = 0.28;
    echo.delayTime.value = (60 / spec.bpm) * 0.75;
    echo.connect(fb);
    fb.connect(echo);
    echo.connect(out);
  }
  for (let b = 0; b < bars; b++) scheduleBar(ctx, out, id, b, 0.05 + b * barSec(spec), echo);
  return ctx.startRendering();
}
