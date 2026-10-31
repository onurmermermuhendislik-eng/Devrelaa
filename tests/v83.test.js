// V8.3: surum + kayitli ElevenLabs CAGLAYAN giris sesi (yerel MP3), audio.playFile davranisi, intro.js baglantisi, anahtar/ag guvenligi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createAudio } from '../src/core/audio.js';

const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const MP3 = new URL('../assets/sounds/intro-caglayan.mp3', import.meta.url);

test('V8.3+ surum: 8.x / versionCode >= 24 / com.altez.minilab.v4 / APK adi ALTEZ-MiniLab-<tag>.apk (guncel surum tests/v84.test.js icinde sabitlenir)', () => {
  const env = rd('scripts/version.env');
  const g = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm'))[1];
  assert.match(g('VERSION_NAME_DEFAULT'), /^8\.\d+$/);
  assert.equal(g('RELEASE_TAG'), 'V' + g('VERSION_NAME_DEFAULT'));
  assert.ok(Number(g('VERSION_CODE_DEFAULT')) >= 24);
  assert.equal(g('APP_ID_DEFAULT'), 'com.altez.minilab.v4');
  assert.equal(g('APK_NAME_DEFAULT'), `ALTEZ-MiniLab-${g('RELEASE_TAG')}.apk`);
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionCode ${g('VERSION_CODE_DEFAULT')}\\b`));
  assert.equal(JSON.parse(rd('assets/data/app-version.json')).versionName, g('VERSION_NAME_DEFAULT'));
  assert.match(JSON.parse(rd('package.json')).version, /^8\.\d+\.\d+$/);
});

test('giris sesi dosyasi: kullanicinin ElevenLabs CAGLAYAN MP3 dosyasi, bayt bayt ayni (SHA-256), gecerli MP3 basligi, ~11 sn', () => {
  const b = readFileSync(MP3);
  assert.equal(b.length, 195822);
  assert.equal(createHash('sha256').update(b).digest('hex'), '5660c82a30e5ece38710e1069933d38d78843d1fc873044ace02bd6fe988fc53');
  assert.equal(b.subarray(0, 3).toString('latin1'), 'ID3');
  // V8.4: `voice/` klasoru (satir MP3'leri + VOICE-MANIFEST.json) eklendi; ust duzeydeki ses dosyalari DEGISMEDI
  assert.deepEqual(readdirSync(new URL('../assets/sounds', import.meta.url)).filter((n) => n !== 'voice').sort(), ['intro-caglayan.mp3', 'minilab-jingle.mp3']);
  const m = JSON.parse(rd('assets/manifest.json'));
  assert.equal(m.sounds.introVoice, 'assets/sounds/intro-caglayan.mp3');
  assert.equal(m.sounds.jingle, 'assets/sounds/minilab-jingle.mp3'); // eski ses korunur
  assert.ok(statSync(new URL('../' + m.sounds.introVoice, import.meta.url)).isFile());
});

function fakeAudioEnv(behaviour) {
  const made = [];
  const prev = globalThis.Audio;
  globalThis.Audio = class {
    constructor(src) { this.src = src; this.paused = true; this.ended = false; this.currentTime = 0; this.n = 0; this.p = 0; this.h = {}; made.push(this); }
    addEventListener(e, f) { this.h[e] = f; }
    play() { this.n++; if (behaviour === 'reject') return Promise.reject(new Error('NotAllowedError')); if (behaviour === 'throw') throw new Error('x'); this.paused = false; return Promise.resolve(); }
    pause() { this.p++; this.paused = true; }
  };
  return { made, restore: () => { globalThis.Audio = prev; } };
}

test('audio.playFile: calar (true), calan dosya tekrar baslatilmaz, stop durdurur, ses kapaliysa calmaz (false)', async () => {
  const env = fakeAudioEnv('ok');
  try {
    const a = createAudio({ manifest: { sounds: { introVoice: 'assets/sounds/intro-caglayan.mp3' } }, base: 'http://x/', enabled: true, AudioCtx: null });
    assert.equal(await a.playFile('introVoice'), true);
    assert.equal(await a.playFile('introVoice'), true); // zaten caliyor
    assert.equal(env.made[0].n, 1, 'ust uste ikinci play baslatilmaz');
    a.stop('introVoice');
    assert.equal(env.made[0].p, 1);
    assert.equal(await a.playFile('introVoice'), true);
    assert.equal(env.made[0].n, 2);
    a.stop('introVoice');
    a.setEnabled(false);
    assert.equal(await a.playFile('introVoice'), false);
    assert.equal(env.made[0].n, 2, 'ses kapaliyken play cagrilmaz');
  } finally { env.restore(); }
});

test('audio.playFile: dosya yok/bozuk/otomatik oynatma engeli/istisna -> false, hata FIRLATMAZ (cagiran TTS yedegine duser)', async () => {
  let env = fakeAudioEnv('ok');
  try {
    const a = createAudio({ manifest: { sounds: {} }, base: 'http://x/', AudioCtx: null });
    assert.equal(await a.playFile('introVoice'), false); // manifestte yok
    const b = createAudio({ manifest: { sounds: { introVoice: 'assets/sounds/intro-caglayan.mp3' } }, base: 'http://x/', AudioCtx: null });
    env.made[0].h.error(); // yukleme hatasi
    assert.equal(await b.playFile('introVoice'), false);
  } finally { env.restore(); }
  for (const mode of ['reject', 'throw']) {
    env = fakeAudioEnv(mode);
    try {
      const c = createAudio({ manifest: { sounds: { introVoice: 'a.mp3' } }, base: 'http://x/', AudioCtx: null });
      assert.equal(await c.playFile('introVoice'), false, mode);
    } finally { env.restore(); }
  }
});

test('intro.js: giris sesi BIR kez denenir, calarsa TTS susar (ust uste yok), calmazsa V8.2 TTS yedegi, cikista durdurulur; yolu kodda yok', () => {
  const i = rd('src/games/adventure/intro.js');
  const code = i.replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /audio\.playFile\('introVoice'\)/);
  assert.match(code, /if \(started \|\| !audio\?\.playFile\) return;/);
  assert.match(code, /if \(!line \|\| recorded \|\| spoken\.has\(i\)\) return;/);
  assert.match(code, /audio\?\.stop\?\.\('introVoice'\)/);
  assert.equal((code.match(/stopRecorded\(\)/g) || []).length >= 2, true); // finish + destroy
  assert.doesNotMatch(code, /new Audio|\.mp3|https?:\/\//);
  assert.match(code, /voice\?\.say\('adv-intro'/); // TTS yedegi korundu
});

test('guvenlik/cevrimdisi: API anahtari yok, uygulama kodunda ElevenLabs/harici adres yok, giris sesi yerel varlik', () => {
  const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(d + '/' + e.name) : [d + '/' + e.name]));
  const root = new URL('..', import.meta.url).pathname;
  for (const f of [...walk(root + 'src'), ...walk(root + 'assets/data'), root + 'assets/manifest.json', root + 'index.html', root + 'capacitor.config.json']) {
    const t = readFileSync(f, 'utf8').replace(/^\s*\/\/.*$/gm, ''); // yorum satirlari (ornegin 'ElevenLabs ile uretildi' notu) kod degildir
    assert.doesNotMatch(t, /elevenlabs|xi-api-key|sk_[0-9a-f]{20}|storage\.googleapis/i, f);
  }
  assert.match(rd('src/core/audio.js'), /new Audio\(new URL\(path, base/); // yerel/goreli yol
});
