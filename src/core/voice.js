// Sesli yonerge: manifest'te kayitli ses dosyasi varsa onu, yoksa cihazin Turkce TTS'ini (cevrimdisi) kullanir.
// Sira: (1) Capacitor yerel TTS eklentisi (Android'de en guvenilir; eklenti kuruluysa), (2) WebView speechSynthesis.
// TTS yoksa/ciksiz kalirsa sessizce atlanir; oyun yine tamamen gorsel olarak anlasilir ve akis ASLA beklemede kalmaz.
//
// Android WebView notlari (gercek cihazda "ses yok" sorununun bilinen nedenleri):
//  - speechSynthesis.cancel() hemen ardindan speak() cagrisi Android Chromium'da yutuluyor -> cancel sadece konusma varsa, speak kisa gecikmeyle.
//  - Utterance referansi tutulmazsa GC onend/onerror'u yutabiliyor -> referans tutulur.
//  - Turkce ses secilmezse / sesler gec yuklenirse (voiceschanged) motor varsayilan dile dusebiliyor -> tr sesi acikca secilir.
//  - Android 11+ paket gorunurlugu: AndroidManifest'te <queries> TTS_SERVICE yoksa motor bulunamaz -> scripts/android-prep.mjs ekler.
// KOK NEDEN (Capacitor kaynak kodundan): Bu uygulama paketleyicisiz (statik ES modulu) calisiyor; @capacitor/core JS'i sayfada YUKLU DEGIL.
//  Android'in enjekte ettigi native-bridge.js yalnizca cap.isNativePlatform / cap.nativePromise / cap.nativeCallback tanimlar;
//  cap.registerPlugin ve cap.Plugins.<Eklenti> yalnizca @capacitor/core calisma zamani (registerPlugin) tarafindan olusturulur.
//  Eski kod `typeof Capacitor.registerPlugin === 'function'` sart kosuyordu -> eklenti kurulu olsa bile native=false.
//  Cozum: registerPlugin yoksa dogrudan Capacitor.nativePromise('TextToSpeech', 'speak', ...) kullanilir (paket/bundler gerekmez).
export const VOICE_BUILD = 'ses-3-nativePromise';
const LANG = 'tr-TR';
const RATE = 0.9;
const PITCH = 1.1;
const START_WATCHDOG_MS = 3000; // konusma bu surede baslamazsa akis serbest birakilir
const MAX_SPEECH_MS = 12000; // hicbir yonerge bundan uzun bekletmez
const PLUGIN = 'TextToSpeech';

export function createVoice({ manifest = { voice: {} }, strings, base = '', enabled = true } = {}) {
  let on = enabled;
  let current = null;
  let nativeBroken = false;
  let speakTimer = null;
  let primed = false;
  const keep = new Set(); // aktif utterance referanslari (GC koruma)
  // V8.1: ses durumu. state: 'unknown' (henuz denenmedi) | 'ok' (konusma gercekten basladi/bitti) | 'problem' (motor yok/baslamadi).
  // Kod cagrisinin basarili olmasi "ses cikti" demek DEGILDIR: 'ok' yalniz native konusma sozu cozulunce veya web onstart/onend gelince yazilir.
  const status = { state: 'unknown', reason: '', at: 0, via: null };
  const listeners = new Set();
  let gen = 0; // her say() yeni kuşak: eski konusmanin gec gelen sonucu durumu bozmaz
  let lastLine = null;
  const setStatus = (state, reason = '', via = null, g = gen) => {
    if (g !== gen) return; // eskimis konusma
    status.state = state;
    status.reason = reason;
    status.via = via;
    status.at = Date.now();
    listeners.forEach((fn) => {
      try {
        fn({ ...status });
      } catch {
        /* dinleyici hatasi sesi etkilemez */
      }
    });
  };
  const log = [];
  const note = (msg) => {
    const line = `${new Date().toISOString().slice(11, 23)} ${msg}`;
    log.push(line);
    if (log.length > 60) log.shift();
    try {
      console.info(`[voice] ${msg}`);
    } catch {
      /* yoksay */
    }
  };

  const synthOf = () => globalThis.speechSynthesis || null;
  const hasWeb = () => !!(synthOf() && typeof globalThis.SpeechSynthesisUtterance !== 'undefined');

  // Capacitor yerel eklentisi (@capacitor-community/text-to-speech). Iki yol:
  //  1) @capacitor/core yukluyse registerPlugin proxy'si, 2) degilse (bu uygulamanin gercek durumu) native-bridge'in nativePromise'i.
  let proxy = null;
  const capOf = () => globalThis.Capacitor || null;
  const callNative = (method, opts) => {
    const cap = capOf();
    if (typeof cap?.registerPlugin === 'function') {
      proxy ??= cap.registerPlugin(PLUGIN);
      return Promise.resolve(proxy[method](opts));
    }
    if (typeof cap?.nativePromise === 'function') return Promise.resolve(cap.nativePromise(PLUGIN, method, opts));
    return Promise.reject(new Error('Capacitor koprusu (registerPlugin/nativePromise) yok'));
  };
  let nativeNoted = false;
  const nativeUsable = () => {
    if (nativeBroken) return false;
    const cap = capOf();
    let ok = false;
    let why = '';
    try {
      if (!cap) why = 'window.Capacitor tanimsiz (native-bridge enjekte edilmedi/CSP engellemis olabilir)';
      else if (cap.isNativePlatform?.() !== true) why = `isNativePlatform=${String(cap.isNativePlatform?.())}`;
      else if (typeof cap.registerPlugin !== 'function' && typeof cap.nativePromise !== 'function') why = 'registerPlugin ve nativePromise yok';
      else if (Array.isArray(cap.PluginHeaders) && cap.PluginHeaders.length && !cap.PluginHeaders.some((h) => h.name === PLUGIN)) why = `${PLUGIN} eklentisi PluginHeaders icinde yok (cap sync yapilmadi/eklenti kayitli degil): ${cap.PluginHeaders.map((h) => h.name).join(',')}`;
      else ok = true;
    } catch (e) {
      why = `istisna: ${e?.message || e}`;
    }
    if (!nativeNoted) {
      nativeNoted = true;
      note(ok ? `yerel TTS yolu: ${typeof cap.registerPlugin === 'function' ? 'registerPlugin' : 'nativePromise'}` : `yerel TTS KULLANILAMIYOR: ${why}`);
    }
    return ok;
  };
  const getNative = () =>
    nativeUsable()
      ? {
          speak: (o) => callNative('speak', o),
          stop: () => callNative('stop', {}),
          isLanguageSupported: (o) => callNative('isLanguageSupported', o)
        }
      : null;
  // CSP/guvenlik ihlallerini kaydet (enjekte betik engellenirse burada gorunur)
  try {
    globalThis.document?.addEventListener?.('securitypolicyviolation', (e) => note(`CSP ihlali: ${e.violatedDirective} ${e.blockedURI || ''}`));
  } catch {
    /* yoksay */
  }
  const hasTts = () => !!getNative() || hasWeb();

  // Turkce ses secimi (sesler gec yuklenebilir: bos ise motor varsayilanina birakilir, lang yine tr-TR)
  const pickVoice = () => {
    try {
      const list = synthOf()?.getVoices?.() || [];
      const norm = (v) => String(v.lang || '').replace('_', '-').toLowerCase();
      return list.find((v) => norm(v) === 'tr-tr' && v.localService) || list.find((v) => norm(v) === 'tr-tr') || list.find((v) => norm(v).startsWith('tr')) || null;
    } catch {
      return null;
    }
  };

  // Her konusma icin tek seferlik bitis (end/error/watchdog hangisi once gelirse)
  const once = (onEnd) => {
    let done = false;
    return (why) => {
      if (done) return;
      done = true;
      if (why) note(`bitti: ${why}`);
      onEnd?.();
    };
  };

  const webSpeak = (text, finish, g = gen) => {
    const synth = synthOf();
    if (!hasWeb()) {
      note('speechSynthesis yok');
      setStatus('problem', 'no-engine', 'web', g);
      return finish('web-yok');
    }
    try {
      if (synth.speaking || synth.pending) synth.cancel();
      clearTimeout(speakTimer);
      // Android: cancel() sonrasi hemen speak() yutuluyor -> kisa gecikme
      speakTimer = setTimeout(() => {
        try {
          try {
            synth.resume();
          } catch {
            /* yoksay */
          }
          const u = new globalThis.SpeechSynthesisUtterance(text);
          u.lang = LANG;
          u.rate = RATE;
          u.pitch = PITCH;
          u.volume = 1;
          const v = pickVoice();
          if (v) u.voice = v;
          keep.add(u);
          let started = false;
          const release = () => keep.delete(u);
          const watchdog = setTimeout(() => {
            if (!started) {
              note(`TTS ${START_WATCHDOG_MS}ms icinde baslamadi (motor yok/hazir degil olabilir)`);
              release();
              setStatus('problem', 'not-started', 'web', g);
              finish('baslamadi');
            }
          }, START_WATCHDOG_MS);
          const cap = setTimeout(() => {
            release();
            finish('sure-asimi');
          }, MAX_SPEECH_MS);
          u.onstart = () => {
            started = true;
            clearTimeout(watchdog);
            setStatus('ok', '', 'web', g);
            note(`web konusma basladi (${v ? v.name + ' ' + v.lang : 'varsayilan ses'})`);
          };
          u.onend = () => {
            clearTimeout(watchdog);
            clearTimeout(cap);
            release();
            finish('web-end');
          };
          u.onerror = (e) => {
            clearTimeout(watchdog);
            clearTimeout(cap);
            release();
            note(`web hata: ${e?.error || 'bilinmiyor'}`);
            // 'interrupted'/'canceled' = baska konusma kesti (hata degil)
            if (!/interrupted|canceled|cancelled/i.test(String(e?.error || ''))) setStatus('problem', String(e?.error || 'error'), 'web', g);
            finish('web-error');
          };
          synth.speak(u);
        } catch (e) {
          note(`web speak istisna: ${e?.message || e}`);
          finish('web-istisna');
        }
      }, 60);
    } catch (e) {
      note(`web istisna: ${e?.message || e}`);
      finish('web-istisna');
    }
  };

  const tts = (text, onEnd) => {
    const g = gen;
    const finish = once(onEnd);
    const native = getNative();
    if (native) {
      let settled = false;
      const cap = setTimeout(() => {
        if (!settled) finish('native-sure-asimi');
      }, MAX_SPEECH_MS);
      // Eklenti kaynak kodu (text-to-speech@8.0.2): queueStrategy 0=FLUSH (yeni konusma eskisini keser), 1=ADD (siraya ekler -> tekrarlarda birikir).
      // Motor asenkron baslar: hazir degilse speak "UNAVAILABLE / Not yet initialized..." ile reddeder -> kisa araliklarla yeniden denenir.
      const transient = (e) => e?.code === 'UNAVAILABLE' || /initiali[sz]ed|not available/i.test(String(e?.message || ''));
      const attempt = (n) =>
        native
          .speak({ text, lang: LANG, rate: RATE, pitch: PITCH, volume: 1, category: 'ambient', queueStrategy: 0 })
          .then(() => {
            settled = true;
            clearTimeout(cap);
            note('native konusma bitti');
            setStatus('ok', '', 'native', g);
            finish();
          })
          .catch((e) => {
            if (settled) return;
            const msg = e?.message || JSON.stringify(e);
            if (transient(e) && n < 4) {
              note(`native hazir degil (deneme ${n + 1}/5): ${msg}`);
              return new Promise((r) => setTimeout(r, 500)).then(() => attempt(n + 1));
            }
            settled = true;
            clearTimeout(cap);
            // Kalici hata (ör. "This language is not supported.") -> bu oturumda yerel yolu birak; gecici hata tukenirse sadece bu konusma web'e duser
            if (!transient(e)) nativeBroken = true;
            note(`native hata, web'e geciliyor: ${msg} (kod: ${e?.code ?? '-'})`);
            webSpeak(text, finish, g);
          });
      Promise.resolve().then(() => attempt(0));
      return;
    }
    webSpeak(text, finish, g);
  };

  const api = {
    setEnabled(v) {
      on = !!v;
      if (!on) api.stop();
    },
    stop() {
      try {
        clearTimeout(speakTimer);
        synthOf()?.cancel();
        if (nativeNoted && !nativeBroken && nativeUsable()) callNative('stop', {}).catch(() => {});
        if (current) current.pause();
      } catch {
        /* yoksay */
      }
    },
    // Ilk kullanici dokunusunda motoru uyandirir (sessiz): ilk gercek yonerge gecikmesin/yutulmasin.
    prime() {
      if (primed || !on) return;
      primed = true;
      try {
        synthOf()?.getVoices?.();
        const synth = synthOf();
        if (synth && hasWeb() && !getNative()) {
          const u = new globalThis.SpeechSynthesisUtterance(' ');
          u.volume = 0;
          u.lang = LANG;
          keep.add(u);
          u.onend = u.onerror = () => keep.delete(u);
          synth.speak(u);
        }
        note('prime (kullanici etkilesimi sonrasi)');
      } catch (e) {
        note(`prime hata: ${e?.message || e}`);
      }
    },
    // text: sesli yonergenin yazisi (verilmezse strings.voice[key]); kayitli ses dosyasi varsa o calinir.
    say(key, onEnd, text) {
      if (!on) return onEnd?.();
      const line = text ?? strings?.voice?.[key];
      const path = manifest.voice?.[key];
      gen += 1; // yeni konusma = yeni kuşak
      lastLine = { key, text: line ?? null };
      // V8.1: ust uste binme olmasin. Kayitli ses dosyasi caliyorsa durdur (native FLUSH ve web cancel zaten kendi icinde keser).
      try {
        if (current && !current.paused) current.pause();
      } catch {
        /* yoksay */
      }
      note(`say ${key}: ${line ?? '(metin yok)'}`);
      if (path && typeof Audio !== 'undefined') {
        try {
          const a = new Audio(new URL(path, base || globalThis.document?.baseURI || 'file:///').href);
          current = a;
          a.addEventListener('ended', () => onEnd?.());
          a.addEventListener('error', () => tts(line, onEnd));
          a.play().catch(() => tts(line, onEnd));
          return;
        } catch {
          /* TTS'e dus */
        }
      }
      if (line) tts(line, onEnd);
      else onEnd?.();
    },
    // V8.1: son yonergeyi tekrar oku ("Tekrar Dinle"). Ses kapaliysa hicbir sey yapmaz ve false doner.
    replay(onEnd) {
      if (!on || !lastLine) {
        onEnd?.();
        return false;
      }
      api.say(lastLine.key, onEnd, lastLine.text ?? undefined);
      return true;
    },
    get status() {
      return { ...status };
    },
    isEnabled: () => on,
    onStatus(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    // Motor hazir mi? Yerel eklenti varsa Turkce destegini sorar; yoksa WebView konusma motorunu arar. Sonuc kesin degildir
    // (Android WebView sesleri gec/bos listeleyebilir): kesin kanit yalniz status.state === 'ok' (gercek konusma basladi).
    async ready() {
      try {
        const n = getNative();
        if (n) {
          const r = await n.isLanguageSupported({ lang: LANG });
          return r?.supported === false ? { ok: false, via: 'native', reason: 'no-turkish' } : { ok: true, via: 'native', reason: '' };
        }
        if (hasWeb()) {
          const tr = (synthOf().getVoices?.() || []).some((v) => String(v.lang).toLowerCase().replace('_', '-').startsWith('tr'));
          return { ok: true, via: 'web', reason: tr ? '' : 'no-tr-voice-listed' };
        }
        return { ok: false, via: 'none', reason: 'no-engine' };
      } catch (e) {
        return { ok: false, via: 'native', reason: String(e?.message || e) };
      }
    },
    // Konusma bitince (en gec maxMs sonra) cozulur. Ses kapali/yoksa hemen cozulur; oyun akisi takilmaz.
    sayThen(key, maxMs = 2200) {
      return new Promise((resolve) => {
        const usable = on && (hasTts() || manifest.voice?.[key]);
        if (!usable) return resolve();
        const timer = setTimeout(resolve, maxMs);
        api.say(key, () => {
          clearTimeout(timer);
          resolve();
        });
      });
    },
    // Tani (cihazda #/voice-test sayfasi gosterir)
    async diagnose() {
      const cap = capOf();
      const d = {
        build: VOICE_BUILD,
        enabled: on,
        native: !!getNative(),
        nativeBroken,
        web: hasWeb(),
        voices: 0,
        trVoices: [],
        nativeTr: null,
        env: {
          capacitor: !!cap,
          platform: cap?.getPlatform?.() ?? null,
          isNative: cap?.isNativePlatform?.() ?? null,
          registerPlugin: typeof cap?.registerPlugin,
          nativePromise: typeof cap?.nativePromise,
          pluginHeaders: Array.isArray(cap?.PluginHeaders) ? cap.PluginHeaders.map((h) => h.name) : null,
          androidBridge: typeof globalThis.androidBridge,
          speechSynthesis: typeof globalThis.speechSynthesis,
          utterance: typeof globalThis.SpeechSynthesisUtterance,
          ua: globalThis.navigator?.userAgent ?? null
        }
      };
      try {
        const list = synthOf()?.getVoices?.() || [];
        d.voices = list.length;
        d.trVoices = list.filter((v) => String(v.lang).toLowerCase().replace('_', '-').startsWith('tr')).map((v) => `${v.name} (${v.lang}${v.localService ? ', yerel' : ''})`);
      } catch (e) {
        d.webError = String(e?.message || e);
      }
      try {
        const n = getNative();
        if (n) d.nativeTr = (await n.isLanguageSupported({ lang: LANG }))?.supported ?? null;
      } catch (e) {
        d.nativeError = String(e?.message || JSON.stringify(e));
      }
      return d;
    },
    log: () => log.slice()
  };
  return api;
}
