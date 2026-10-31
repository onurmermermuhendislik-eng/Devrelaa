// V8.5 Ortak ORTAM SESI yoneticisi (macera platformu). Her sahne/bolum kendi ortam sesini ister; bolum degisince oncekini keser.
// KURALLAR: (1) tek anda en fazla BIR ortam sesi; (2) ses/ortam kapaliysa calmaz; (3) uygulama arka plana alinirsa durur, one gelince SAHNE HALA AKTIFSE
// ayni ses tek kez yeniden baslar; (4) ses dosyasi manifest.ambience[<sahne>] ile verilirse o dosya (dongu, kisik), yoksa/bozuksa kucuk WebAudio
// sentezi; (5) sahne kimligi KATALOGDA yoksa hicbir sey calmaz -> caglayan/su gibi sesler KORLEMESINE her yere eklenmez. Muzikten BAGIMSIZDIR.
// Katalogdaki `ready:false` sahneler henuz var olmayan bolumler icin TASARIMDIR (cagri yapan bolum yok).
// NOT: Ses ciktisini gercek cihazda duymak mumkun degil; test yalniz durum/cagri sayisini ve sentezlenen sinyalin sayisal ozelliklerini dogrular.
export const SCENES = {
  'ev-gece': { label: 'Ev (gece)', ready: true, layers: [{ noise: 'brown', cutoff: 380, gain: 0.05 }] },
  'ev-isik': { label: 'Ev (isik yanik)', ready: true, layers: [{ noise: 'brown', cutoff: 900, gain: 0.05 }, { hum: 110, gain: 0.006 }] },
  orman: { label: 'Orman (ruzgar + kus)', ready: false, layers: [{ noise: 'brown', cutoff: 520, gain: 0.05, lfo: 0.12 }, { birds: true, gain: 0.02 }] },
  'orman-selale': { label: 'Orman: selale (yalniz selale sahnesi)', ready: false, layers: [{ noise: 'white', bandpass: 1300, q: 0.35, gain: 0.05 }, { birds: true, gain: 0.012 }] },
  mahalle: { label: 'Mahalle (sokak + kus)', ready: false, layers: [{ noise: 'brown', cutoff: 420, gain: 0.03 }, { birds: true, gain: 0.018 }, { hum: 70, gain: 0.004 }] },
  'koy-dere': { label: 'Koy: dere', ready: false, layers: [{ noise: 'white', bandpass: 900, q: 0.5, gain: 0.032 }, { birds: true, gain: 0.01 }] },
  pompa: { label: 'Koy: su pompasi', ready: false, layers: [{ noise: 'white', bandpass: 800, q: 0.5, gain: 0.02 }, { pump: 1.7, gain: 0.07 }] },
  atolye: { label: 'Atolye (alet/mekanizma)', ready: false, layers: [{ noise: 'brown', cutoff: 300, gain: 0.03 }, { mech: 3.5, gain: 0.02 }] }
};
export const sceneIds = () => Object.keys(SCENES);

// Bir sahnenin sentezini `out` dugumune kurar; dondurur { stop() } (ses dugumleri + zamanlayicilar temizlenir). Cevrimdisi test icin disari acik.
export function buildScene(ctx, out, id, timers = { set: (f, ms) => setInterval(f, ms), clear: (t) => clearInterval(t) }) {
  const sc = SCENES[id];
  const stops = [];
  const noiseBuf = (kind) => {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'brown') {
        last = (last + 0.04 * w) / 1.04;
        d[i] = last * 8;
      } else d[i] = w * 0.5;
    }
    return buf;
  };
  const chirp = (t, g) => {
    const o = ctx.createOscillator();
    const e = ctx.createGain();
    const f0 = 2000 + Math.random() * 900;
    o.type = 'sine';
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(f0 * 1.35, t + 0.07);
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(g, t + 0.015);
    e.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(e);
    e.connect(out);
    o.start(t);
    o.stop(t + 0.14);
  };
  for (const L of sc.layers) {
    if (L.noise) {
      const src = ctx.createBufferSource();
      src.buffer = noiseBuf(L.noise);
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = L.bandpass ? 'bandpass' : 'lowpass';
      f.frequency.value = L.bandpass || L.cutoff;
      if (L.q) f.Q.value = L.q;
      const g = ctx.createGain();
      g.gain.value = L.gain;
      src.connect(f);
      f.connect(g);
      g.connect(out);
      src.start();
      stops.push(() => {
        try {
          src.stop();
          src.disconnect();
        } catch {
          /* yoksay */
        }
      });
      if (L.lfo) {
        const o = ctx.createOscillator();
        const og = ctx.createGain();
        o.frequency.value = L.lfo;
        og.gain.value = L.gain * 0.5;
        o.connect(og);
        og.connect(g.gain);
        o.start();
        stops.push(() => {
          try {
            o.stop();
          } catch {
            /* yoksay */
          }
        });
      }
    } else if (L.hum) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = L.hum;
      g.gain.value = L.gain;
      o.connect(g);
      g.connect(out);
      o.start();
      stops.push(() => {
        try {
          o.stop();
        } catch {
          /* yoksay */
        }
      });
    } else if (L.birds) {
      const t = timers.set(() => {
        if (Math.random() < 0.7) chirp(ctx.currentTime + 0.02, L.gain);
        if (Math.random() < 0.4) chirp(ctx.currentTime + 0.2, L.gain * 0.8);
      }, 2600);
      stops.push(() => timers.clear(t));
    } else if (L.pump) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 58;
      g.gain.value = L.gain * 0.5;
      lfo.frequency.value = L.pump;
      lg.gain.value = L.gain * 0.5;
      lfo.connect(lg);
      lg.connect(g.gain);
      o.connect(g);
      g.connect(out);
      o.start();
      lfo.start();
      stops.push(() => {
        try {
          o.stop();
          lfo.stop();
        } catch {
          /* yoksay */
        }
      });
    } else if (L.mech) {
      const t = timers.set(() => {
        const o = ctx.createOscillator();
        const e = ctx.createGain();
        const t0 = ctx.currentTime + 0.01;
        o.type = 'triangle';
        o.frequency.value = 900 + Math.random() * 300;
        e.gain.setValueAtTime(L.gain, t0);
        e.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.05);
        o.connect(e);
        e.connect(out);
        o.start(t0);
        o.stop(t0 + 0.06);
      }, Math.round(1000 / L.mech));
      stops.push(() => timers.clear(t));
    }
  }
  return { stop: () => stops.forEach((f) => f()) };
}

export function createAmbience({ manifest = {}, base = '', enabled = true, getContext = null, AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let on = enabled;
  let id = null; // calmasi istenen sahne
  let via = null; // 'file' | 'synth' | null
  let el = null; // Audio (dosya)
  let ac = null;
  let grp = null; // { out, scene }
  let starts = 0; // tani/test: baslatma sayisi
  let ducked = false; // konusma onceligi: ortam sesi konusurken yariya iner
  const lvl = () => (ducked ? 0.5 : 1);
  const history = [];

  const stopSynth = () => {
    const g = grp;
    grp = null;
    if (!g) return;
    try {
      g.out.gain.setTargetAtTime(0.0001, ac.currentTime, 0.05);
    } catch {
      /* yoksay */
    }
    setTimeout(() => {
      try {
        g.scene.stop();
        g.out.disconnect();
      } catch {
        /* yoksay */
      }
    }, 220);
  };
  const stopEl = () => {
    try {
      if (el) {
        el.pause();
        el.removeAttribute('src');
        el.load?.();
      }
    } catch {
      /* yoksay */
    }
    el = null;
  };
  const halt = () => {
    stopSynth();
    stopEl();
    via = null;
  };

  function startSynth(sceneId) {
    try {
      ac = getContext?.() || ac || (AudioCtx ? new AudioCtx() : null);
      if (!ac) return false;
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      const out = ac.createGain();
      out.gain.value = 0.0001;
      out.connect(ac.destination);
      const scene = buildScene(ac, out, sceneId);
      out.gain.setTargetAtTime(lvl(), ac.currentTime, 0.4);
      grp = { out, scene };
      return true;
    } catch {
      grp = null;
      return false;
    }
  }

  function begin() {
    halt();
    const sc = SCENES[id];
    if (!on || !sc) return;
    const path = manifest.ambience?.[id];
    if (path && typeof Audio !== 'undefined') {
      try {
        const a = new Audio(new URL(path, base || globalThis.document?.baseURI || 'file:///').href);
        a.loop = true;
        a.volume = 0.35;
        const asked = id;
        const fallback = () => {
          if (el === a && id === asked) {
            stopEl();
            via = startSynth(id) ? 'synth' : null;
          }
        };
        a.addEventListener('error', fallback);
        el = a;
        via = 'file';
        starts += 1;
        a.play().catch(fallback);
        return;
      } catch {
        stopEl();
      }
    }
    if (startSynth(id)) {
      via = 'synth';
      starts += 1;
    }
  }

  const onVis = () => {
    // Arka plana gecince DUR (sahne kimligi korunur); one gelince sahne hala aktifse ve ses aciksa YENIDEN baslar. begin() once her seyi durdurur: cift ses olmaz.
    if (globalThis.document?.visibilityState === 'hidden') halt();
    else if (id && on && !via) begin();
  };
  try {
    globalThis.document?.addEventListener?.('visibilitychange', onVis);
  } catch {
    /* yoksay */
  }

  return {
    // Sahne ortam sesini baslat. Ayni sahne zaten caliyorsa tekrar baslatmaz; baska sahne oncekini keser.
    play(scene) {
      history.push(scene);
      if (history.length > 30) history.shift();
      if (scene === id && via) return via;
      id = scene;
      begin();
      return via;
    },
    stop() {
      id = null;
      halt();
    },
    duck(v) {
      ducked = !!v;
      try {
        if (grp) grp.out.gain.setTargetAtTime(lvl(), ac.currentTime, ducked ? 0.05 : 0.35);
        if (el) el.volume = lvl();
      } catch {
        /* yoksay */
      }
    },
    setEnabled(v) {
      on = !!v;
      if (!on) halt();
      else if (id) begin();
    },
    get state() {
      return { scene: id, via, enabled: on, starts, playing: !!via, ducked, history: history.slice() };
    },
    catalog: () => sceneIds()
  };
}
