// Sesli yonerge (Android WebView uyumu): sahte speechSynthesis / Capacitor eklentisiyle davranis testleri.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVoice } from '../src/core/voice.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const strings = { voice: { k: 'Anahtar metin.' } };

function fakeWeb({ voices = [], behavior = 'end' } = {}) {
  const calls = { speak: [], cancel: 0 };
  let speaking = false;
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
    }
  };
  globalThis.speechSynthesis = {
    get speaking() {
      return speaking;
    },
    pending: false,
    getVoices: () => voices,
    resume() {},
    cancel() {
      calls.cancel++;
      speaking = false;
    },
    speak(u) {
      calls.speak.push(u);
      if (behavior === 'silent') return;
      setTimeout(() => {
        if (behavior === 'error') return u.onerror?.({ error: 'synthesis-failed' });
        speaking = true;
        u.onstart?.();
        setTimeout(() => {
          speaking = false;
          u.onend?.();
        }, 10);
      }, 5);
    }
  };
  return calls;
}
const cleanup = () => {
  delete globalThis.speechSynthesis;
  delete globalThis.SpeechSynthesisUtterance;
  delete globalThis.Capacitor;
};

test('ses: web TTS Turkce (tr-TR) ses secilerek konusur, bitince onEnd', async () => {
  const calls = fakeWeb({ voices: [{ name: 'English', lang: 'en-US' }, { name: 'Turkce', lang: 'tr_TR', localService: true }] });
  const v = createVoice({ strings });
  let ended = false;
  v.say('k', () => (ended = true));
  await sleep(150);
  assert.equal(calls.speak.length, 1);
  assert.equal(calls.speak[0].lang, 'tr-TR');
  assert.equal(calls.speak[0].text, 'Anahtar metin.');
  assert.equal(calls.speak[0].voice?.name, 'Turkce');
  assert.ok(ended);
  cleanup();
});

test('ses: bosta iken cancel() cagrilmaz (Android cancel->speak yutma hatasi); metin override calisir', async () => {
  const calls = fakeWeb();
  const v = createVoice({ strings });
  v.say('k', undefined, 'Doğru sayıyı bul.');
  await sleep(120);
  assert.equal(calls.cancel, 0);
  assert.equal(calls.speak[0].text, 'Doğru sayıyı bul.');
  cleanup();
});

test('ses: motor hata verirse onEnd yine cagrilir (akis kilitlenmez)', async () => {
  fakeWeb({ behavior: 'error' });
  const v = createVoice({ strings });
  let ended = false;
  v.say('k', () => (ended = true));
  await sleep(150);
  assert.ok(ended);
  cleanup();
});

test('ses: motor sessiz kalirsa (hic olay yok) watchdog akisi serbest birakir', async () => {
  fakeWeb({ behavior: 'silent' });
  const v = createVoice({ strings });
  const t0 = Date.now();
  await v.sayThen('k', 6000);
  assert.ok(Date.now() - t0 < 4500, `${Date.now() - t0}ms`);
  assert.ok(v.log().some((l) => l.includes('baslamadi')));
  cleanup();
});

test('ses: ses kapaliyken konusma baslamaz ve onEnd hemen gelir; stop cagrisi guvenli', async () => {
  const calls = fakeWeb();
  const v = createVoice({ strings, enabled: false });
  let ended = false;
  v.say('k', () => (ended = true));
  assert.ok(ended);
  await sleep(120);
  assert.equal(calls.speak.length, 0);
  v.setEnabled(true);
  v.say('k');
  await sleep(120);
  assert.equal(calls.speak.length, 1);
  v.setEnabled(false);
  assert.doesNotThrow(() => v.stop());
  cleanup();
});

test('ses: TTS hic yoksa sayThen hemen cozulur, say onEnd cagirir', async () => {
  cleanup();
  const v = createVoice({ strings });
  const t0 = Date.now();
  await v.sayThen('k', 3000);
  assert.ok(Date.now() - t0 < 100);
  let ended = false;
  v.say('k', () => (ended = true));
  await sleep(100);
  assert.ok(ended);
});

test('ses: Capacitor yerel TTS eklentisi varsa once o kullanilir (tr-TR), web kullanilmaz', async () => {
  const web = fakeWeb();
  const spoken = [];
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
    registerPlugin: () => ({ speak: async (o) => void spoken.push(o), stop: async () => {}, isLanguageSupported: async () => ({ supported: true }) })
  };
  const v = createVoice({ strings });
  let ended = false;
  v.say('k', () => (ended = true));
  await sleep(80);
  assert.equal(spoken.length, 1);
  assert.equal(spoken[0].lang, 'tr-TR');
  assert.equal(spoken[0].text, 'Anahtar metin.');
  assert.equal(web.speak.length, 0);
  assert.ok(ended);
  assert.equal((await v.diagnose()).nativeTr, true);
  cleanup();
});

test('ses: yerel eklenti hata verirse WebView TTS yedegine duser', async () => {
  const web = fakeWeb();
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    isPluginAvailable: () => true,
    registerPlugin: () => ({ speak: async () => { throw new Error('engine yok'); } })
  };
  const v = createVoice({ strings });
  let ended = false;
  v.say('k', () => (ended = true));
  await sleep(200);
  assert.equal(web.speak.length, 1);
  assert.ok(ended);
  cleanup();
});

test('ses: eklenti kurulu degilse (web tarayici) Capacitor yok sayilir', async () => {
  const web = fakeWeb();
  globalThis.Capacitor = { isNativePlatform: () => false };
  const v = createVoice({ strings });
  v.say('k');
  await sleep(120);
  assert.equal(web.speak.length, 1);
  cleanup();
});

// --- Kok neden regresyonu: paketleyicisiz uygulamada @capacitor/core yok; native-bridge yalnizca nativePromise/isNativePlatform tanimlar ---
test('ses: registerPlugin YOKKEN (statik uygulama) Capacitor.nativePromise ile yerel TTS kullanilir (tr-TR)', async () => {
  const web = fakeWeb();
  const calls = [];
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    PluginHeaders: [{ name: 'App' }, { name: 'TextToSpeech' }],
    nativePromise: async (plugin, method, opts) => {
      calls.push({ plugin, method, opts });
      return method === 'isLanguageSupported' ? { supported: true } : undefined;
    }
  };
  const v = createVoice({ strings });
  let ended = false;
  v.say('k', () => (ended = true));
  await sleep(80);
  const sp = calls.find((c) => c.method === 'speak');
  assert.ok(sp, 'nativePromise(TextToSpeech, speak) cagrilmadi');
  assert.equal(sp.plugin, 'TextToSpeech');
  assert.equal(sp.opts.lang, 'tr-TR');
  assert.equal(sp.opts.text, 'Anahtar metin.');
  assert.equal(web.speak.length, 0);
  assert.ok(ended);
  const d = await v.diagnose();
  assert.equal(d.native, true);
  assert.equal(d.env.registerPlugin, 'undefined');
  assert.equal(d.nativeTr, true);
  cleanup();
});

test('ses: PluginHeaders icinde TextToSpeech yoksa (sync yapilmamis) yerel yol kullanilmaz, nedeni kaydedilir, web yedegi calisir', async () => {
  const web = fakeWeb();
  globalThis.Capacitor = { isNativePlatform: () => true, PluginHeaders: [{ name: 'App' }], nativePromise: async () => assert.fail('cagrilmamali') };
  const v = createVoice({ strings });
  v.say('k');
  await sleep(120);
  assert.equal(web.speak.length, 1);
  assert.ok(v.log().some((l) => l.includes('PluginHeaders icinde yok')));
  cleanup();
});

test('ses: yerel cagri reddedilirse hata detayi kaydedilir ve akis serbest kalir', async () => {
  fakeWeb({ behavior: 'silent' });
  globalThis.Capacitor = { isNativePlatform: () => true, nativePromise: async () => { throw { message: 'Failed to read text.', code: 'FAILED' }; } };
  const v = createVoice({ strings });
  const t0 = Date.now();
  await v.sayThen('k', 6000);
  assert.ok(Date.now() - t0 < 4500);
  assert.ok(v.log().some((l) => l.includes('native hata') && l.includes('Failed to read text.')));
  cleanup();
});

// --- Eklenti kaynak kodu dogrulamasi (text-to-speech@8.0.2): queueStrategy 0=FLUSH; motor hazir degilse UNAVAILABLE ---
test('ses: yerel speak queueStrategy=0 (FLUSH) ile cagrilir; 1 (ADD) birikmeye yol acar', async () => {
  fakeWeb();
  const seen = [];
  globalThis.Capacitor = { isNativePlatform: () => true, nativePromise: async (p, m, o) => void (m === 'speak' && seen.push(o)) };
  const v = createVoice({ strings });
  v.say('k');
  await sleep(60);
  assert.equal(seen[0].queueStrategy, 0);
  assert.equal(seen[0].volume, 1);
  cleanup();
});

test('ses: motor henuz hazir degilken (UNAVAILABLE) yeniden dener, kalici olarak yerel yolu birakmaz', async () => {
  const web = fakeWeb();
  let n = 0;
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    nativePromise: async (p, m) => {
      if (m !== 'speak') return {};
      if (++n < 3) throw { code: 'UNAVAILABLE', message: 'Not yet initialized or not available on this device.' };
    }
  };
  const v = createVoice({ strings });
  let ended = false;
  v.say('k', () => (ended = true));
  await sleep(1400);
  assert.equal(n, 3);
  assert.equal(web.speak.length, 0);
  assert.ok(ended);
  assert.equal((await v.diagnose()).nativeBroken, false);
  cleanup();
});

test('ses: dil desteklenmiyorsa ("This language is not supported.") web yedegine duser ve neden kaydedilir', async () => {
  const web = fakeWeb();
  globalThis.Capacitor = { isNativePlatform: () => true, nativePromise: async () => { throw { message: 'This language is not supported.' }; } };
  const v = createVoice({ strings });
  v.say('k');
  await sleep(200);
  assert.equal(web.speak.length, 1);
  assert.ok(v.log().some((l) => l.includes('This language is not supported.')));
  assert.equal((await v.diagnose()).nativeBroken, true);
  cleanup();
});
