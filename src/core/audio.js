// Ses servisi. Manifest'te dosya yolu verilmisse o dosya calinir (sesleri sonradan degistirmek icin);
// verilmemisse / yuklenemezse uygulamanin kendi WebAudio sentezi kullanilir. Harici kutuphane yok.

export const SOUND_MS = { tap: 90, place: 140, correct: 450, gentle: 260, levelUp: 900, circuitOn: 500, success: 2100, jingle: 2500, pick: 120, coin: 520, retry: 420 };
// V8.5: ayni efekt hizli dokunma/surukleme ile UST USTE binmesin: ayni ad icin en az bu kadar ms aralik (ms). Bastirilan cagri sessizce yok sayilir.
export const MIN_GAP_MS = { tap: 70, pick: 90, place: 110, correct: 140, gentle: 260, circuitOn: 300, coin: 220, retry: 420, success: 1500, levelUp: 1500, jingle: 3000 };

// Cok kisa, yumusak, "cam/zil" tonlu nota: temel + kismi tonlar, ustel sonum.
function note(ac, out, t0, { freq, dur = 0.3, gain = 0.15, attack = 0.008, partials = [[1, 1], [2, 0.22], [3, 0.07]], type = 'sine', glideTo = null }) {
  for (const [mult, amp] of partials) {
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * mult, t0);
    if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo * mult, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain * amp), t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }
}

const N = { D6: 1174.66, G4: 392.0, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568.0, C7: 2093.0, C3: 130.81 };

const SYNTH = {
  tap: (ac, o, t) => note(ac, o, t, { freq: 660, dur: 0.08, gain: 0.07, partials: [[1, 1]] }),
  // V8.5: nesne secme (yumusak, kisa "tik" yukari) / market alisverisi (iki parlak "ping") / yeniden deneme (nazik iki nota, ceza degil)
  pick: (ac, o, t) => note(ac, o, t, { freq: 520, glideTo: 700, dur: 0.1, gain: 0.07, partials: [[1, 1], [2, 0.15]] }),
  coin: (ac, o, t) => {
    note(ac, o, t, { freq: N.E6, dur: 0.18, gain: 0.1 });
    note(ac, o, t + 0.09, { freq: N.C7, dur: 0.34, gain: 0.09 });
  },
  retry: (ac, o, t) => {
    note(ac, o, t, { freq: N.G4, dur: 0.18, gain: 0.08 });
    note(ac, o, t + 0.13, { freq: N.C5, dur: 0.26, gain: 0.08 });
  },
  place: (ac, o, t) => note(ac, o, t, { freq: 330, dur: 0.12, gain: 0.14, type: 'triangle', partials: [[1, 1], [2, 0.3]] }),
  correct: (ac, o, t) => {
    note(ac, o, t, { freq: N.C6, dur: 0.32, gain: 0.14 });
    note(ac, o, t + 0.11, { freq: N.E6, dur: 0.36, gain: 0.14 });
  },
  // Yanlis: ceza degil; yumusak, alcak, kisa bir "hmm" tonu
  gentle: (ac, o, t) => note(ac, o, t, { freq: 294, glideTo: 247, dur: 0.22, gain: 0.07, partials: [[1, 1], [2, 0.15]] }),
  levelUp: (ac, o, t) => {
    [N.C5, N.E5, N.G5, N.C6, N.E6].forEach((f, i) => note(ac, o, t + i * 0.12, { freq: f, dur: 0.55, gain: 0.13 }));
  },
  circuitOn: (ac, o, t) => {
    note(ac, o, t, { freq: 220, glideTo: 880, dur: 0.36, gain: 0.06, type: 'triangle', partials: [[1, 1], [2, 0.2]] });
    note(ac, o, t + 0.3, { freq: 1760, dur: 0.22, gain: 0.05, partials: [[1, 1]] });
  },
  // Acilis jingle'i yedek sentezi (asil ses assets/sounds/minilab-jingle.mp3): ayni kanca melodisi
  jingle: (ac, o, t) => {
    note(ac, o, t, { freq: 280, glideTo: 1400, dur: 0.2, gain: 0.05, type: 'triangle', partials: [[1, 1]] });
    [N.E5, N.G5, N.C6, N.E6].forEach((f, i) => note(ac, o, t + 0.2 + i * 0.14 + (i === 3 ? 0.04 : 0), { freq: f, dur: i === 3 ? 0.55 : 0.3, gain: 0.12 }));
    [N.D6, N.C6, N.G5].forEach((f, i) => note(ac, o, t + 1.08 + i * 0.14, { freq: f, dur: 0.3, gain: 0.09 }));
    const t1 = t + 1.55;
    [N.C6, N.E6, N.G6].forEach((f, i) => note(ac, o, t1 + i * 0.035, { freq: f, dur: 0.9, gain: 0.1 }));
    note(ac, o, t1, { freq: N.C3, dur: 0.9, gain: 0.1, type: 'triangle', partials: [[1, 1], [2, 0.2]] });
  },
  // Kisa basari muzigi (~2.2 sn): MiniLab kancasi (Mi-Ni-Lab-da) -> tam akor -> pirilti
  success: (ac, o, t) => {
    [N.E5, N.G5, N.C6, N.E6].forEach((f, i) => note(ac, o, t + i * 0.14, { freq: f, dur: 0.24, gain: 0.12 }));
    const t1 = t + 0.62;
    note(ac, o, t1, { freq: N.C6, dur: 1.25, gain: 0.15 });
    [N.C5, N.E5, N.G5].forEach((f) => note(ac, o, t1, { freq: f, dur: 1.2, gain: 0.07, partials: [[1, 1], [2, 0.15]] }));
    note(ac, o, t1, { freq: N.C3, dur: 1.3, gain: 0.12, type: 'triangle', partials: [[1, 1], [2, 0.2]] });
    [N.E6, N.G6, N.C7].forEach((f, i) => note(ac, o, t1 + 0.35 + i * 0.13, { freq: f, dur: 0.6, gain: 0.05, partials: [[1, 1]] }));
  }
};

export function createAudio({ manifest = { sounds: {} }, base = '', enabled = true, AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext } = {}) {
  let ac = null;
  let master = null;
  let on = enabled;
  const files = {};
  const broken = new Set();
  const lastAt = {};

  for (const [name, path] of Object.entries(manifest.sounds || {})) {
    if (!path || typeof Audio === 'undefined') continue;
    const a = new Audio(new URL(path, base || globalThis.document?.baseURI || 'file:///').href);
    a.preload = 'auto';
    a.addEventListener('error', () => broken.add(name));
    files[name] = a;
  }

  function ensure() {
    if (!AudioCtx) return null;
    if (!ac) {
      try {
        ac = new AudioCtx();
        master = ac.createGain();
        master.gain.value = 0.9;
        // Hafif yapay yanki: kisa, sonumlu gurultu darbe yaniti
        const len = Math.floor(ac.sampleRate * 1.2);
        const buf = ac.createBuffer(2, len, ac.sampleRate);
        for (let c = 0; c < 2; c++) {
          const d = buf.getChannelData(c);
          for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
        }
        const conv = ac.createConvolver();
        conv.buffer = buf;
        const wet = ac.createGain();
        wet.gain.value = 0.22;
        master.connect(ac.destination);
        master.connect(conv);
        conv.connect(wet);
        wet.connect(ac.destination);
      } catch {
        ac = null;
        return null;
      }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }

  return {
    // Ilk dokunusta cagrilir (tarayici/WebView otomatik oynatma kisiti icin)
    unlock: () => void ensure(),
    setEnabled(v) {
      on = !!v;
    },
    get enabled() {
      return on;
    },
    get context() {
      return ac;
    },
    play(name) {
      if (!on) return;
      // V8.5: hizli tekrar (parmak surukleme/cift dokunma) ayni sesi ust uste bindirmez
      const gap = MIN_GAP_MS[name];
      if (gap) {
        const now = (globalThis.performance?.now?.() ?? Date.now());
        if (now - (lastAt[name] ?? -1e9) < gap) return;
        lastAt[name] = now;
      }
      const f = files[name];
      if (f && !broken.has(name)) {
        try {
          f.currentTime = 0;
          const p = f.play();
          if (p && p.catch) p.catch(() => SYNTH[name] && this.synth(name));
          return;
        } catch {
          /* sentez ile devam */
        }
      }
      this.synth(name);
    },
    // V8.3: kayitli (ElevenLabs CAGLAYAN) ses dosyasini calar. Sonuc: true = gercekten calmaya basladi; false = ses kapali/dosya yok/bozuk/otomatik oynatma engeli.
    // Sentez YEDEGI YOK (cagiran Turkce TTS'e dusebilir). Ayni dosya zaten caliyorsa ikinci kez baslatilmaz (true doner).
    async playFile(name) {
      if (!on) return false;
      const f = files[name];
      if (!f || broken.has(name)) return false;
      try {
        if (!f.paused && !f.ended) return true;
        f.currentTime = 0;
        const p = f.play();
        if (p && p.then) await p;
        return !broken.has(name);
      } catch {
        return false;
      }
    },
    stop(name) {
      try {
        files[name]?.pause();
      } catch {
        /* yoksay */
      }
    },
    synth(name) {
      const fn = SYNTH[name];
      const c = ensure();
      if (!fn || !c) return;
      // Acilis jingle'i: WebView otomatik oynatmayi engellediyse (baglam askida) sonradan gecikmis calmasin
      if (name === 'jingle' && c.state === 'suspended' && !(typeof OfflineAudioContext !== 'undefined' && c instanceof OfflineAudioContext)) return;
      fn(c, master, c.currentTime + 0.01);
    }
  };
}
