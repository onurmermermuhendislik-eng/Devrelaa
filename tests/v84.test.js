// V8.4 (Asama A-C): surum, yon kilidi kapsami (YALNIZ Enerji Macerasi yatay), Egitim dikey tasma duzeltmesi, Caglayan giris sesi saglamlastirma, geri donus noktasi korunumu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createOrientation, routeNeedsLandscape, LANDSCAPE_ROUTE } from '../src/core/orient.js';

const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');

// V8.5 SURUM DEVRI (bilincli): bu test V8.4'te tam surumu sabitliyordu; guncel surum tests/v85-version.test.js icinde sabitlenir (V8.1-V8.3 testlerinde izlenen ayni yontem). Genellestirilmis hali: 8.x, versionCode >= 25, applicationId degismez.
test('V8.4+ surum: 8.x / versionCode >= 25 / com.altez.minilab.v4 / APK adi ALTEZ-MiniLab-<tag>.apk (guncel surum tests/v85-version.test.js icinde sabitlenir)', () => {
  const env = rd('scripts/version.env');
  const g = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm'))[1];
  assert.match(g('VERSION_NAME_DEFAULT'), /^8\.\d+$/);
  assert.ok(Number(g('VERSION_CODE_DEFAULT')) >= 25);
  assert.equal(g('APP_ID_DEFAULT'), 'com.altez.minilab.v4');
  assert.equal(g('APK_NAME_DEFAULT'), `ALTEZ-MiniLab-${g('RELEASE_TAG')}.apk`);
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionCode ${g('VERSION_CODE_DEFAULT')}\\b`));
  assert.match(rd('android/app/build.gradle'), /applicationId "com\.altez\.minilab\.v4"/);
  assert.equal(JSON.parse(rd('assets/data/app-version.json')).versionName, g('VERSION_NAME_DEFAULT'));
  assert.equal(JSON.parse(rd('package.json')).version, g('VERSION_NAME_DEFAULT') + '.0');
  assert.equal(JSON.parse(rd('VERSION.json')).versionCode, Number(g('VERSION_CODE_DEFAULT')));
});

test('yon kilidi kapsami: YALNIZ Enerji Macerasi (#/adventure, #/play/energy-adventure) yatay; diger tum oyun/ekranlar serbest', () => {
  for (const h of ['#/adventure', '#/adventure/', '#/play/energy-adventure']) assert.equal(routeNeedsLandscape(h), true, h);
  for (const h of ['#/play/shape-complete', '#/play/number-hunt', '#/play/invent', '#/play/learn', '#/play/tasks', '#/play/detective', '#/play/logic-science',
    '#/', '', '#/games', '#/intro', '#/progress', '#/settings', '#/profile', '#/parent', '#/voice-test', '#/play/energy-adventure-2', '#/adventures', undefined, null]) assert.equal(routeNeedsLandscape(h), false, String(h));
  assert.ok(LANDSCAPE_ROUTE instanceof RegExp);
  assert.doesNotMatch(rd('src/core/orient.js'), /play\\\/\[\\w-\]\+\)\/\.test/); // eski "tum oyunlar" deseni geri gelmesin
});

test('orient.js: oyundan oyuna / Enerji Macerasi <-> diger oyun gecisinde kilit yalniz mod degisince cagrilir; macera->oyun kilidi kaldirir', () => {
  const log = [];
  const o = createOrientation({ win: { AltezOrientation: { lockLandscape: () => log.push('lock'), unlock: () => log.push('unlock') } } });
  const go = (h) => o.set(routeNeedsLandscape(h) ? 'landscape' : 'free');
  for (const h of ['#/', '#/play/number-hunt', '#/play/invent', '#/adventure', '#/adventure', '#/play/energy-adventure', '#/play/shape-complete', '#/games', '#/play/learn']) go(h);
  assert.deepEqual(log, ['lock', 'unlock'], 'ilk "free" ve oyun->oyun gecislerinde kilit/cozme cagrisi yok; yalniz macera girisinde kilit, cikisinda coz');
});

test('Android: uygulama geneli yatay kilit yok, donmede etkinlik yeniden olusmaz (durum korunur), yon koprusu duruyor', () => {
  const mf = rd('android/app/src/main/AndroidManifest.xml');
  assert.match(mf, /android:screenOrientation="unspecified"/);
  assert.doesNotMatch(mf, /sensorLandscape|"landscape"|"portrait"/);
  assert.match(mf, /orientation\|keyboardHidden\|keyboard\|screenSize/);
  const j = rd('android/app/src/main/java/com/altez/minilab/v4/MainActivity.java');
  assert.match(j, /"AltezOrientation"/);
  assert.match(j, /SCREEN_ORIENTATION_SENSOR_LANDSCAPE/);
  assert.match(j, /SCREEN_ORIENTATION_UNSPECIFIED/);
});

test('Egitim haritasi: dikey (412x915) tasmasi icin CSS duzeltmesi (min-width:0, minmax(0,1fr), Basla genisligi) V7.5 etiketinden ONCE', () => {
  const c = rd('src/ui/styles.css');
  const i = c.indexOf('/* V8.4: Egitim haritasi');
  assert.ok(i > 0, 'V8.4 blogu var');
  assert.ok(i < c.indexOf('/* V7.5: Egitim DERS ekranlari yatay'), 'v75 testinin kuyruk kurali: yeni CSS V7.5 etiketinden once');
  const blk = c.slice(i, i + 900);
  assert.match(blk, /\.learn-map \{ grid-template-columns: minmax\(0, 1fr\); \}/);
  assert.match(blk, /\.learn-level, \.learn-lesson, \.learn-nextcard \{ min-width: 0; max-width: 100%/);
  assert.match(blk, /\.learn-nextcard \.nc-go \{ width: auto; max-width: 46%; \}/);
});

test('giris sesi: dosya V8.3 ile BIREBIR ayni (SHA-256), yol/manifest kucuk harf tam eslesir, paket kaynaginda var', () => {
  const b = readFileSync(new URL('../assets/sounds/intro-caglayan.mp3', import.meta.url));
  assert.equal(b.length, 195822);
  assert.equal(createHash('sha256').update(b).digest('hex'), '5660c82a30e5ece38710e1069933d38d78843d1fc873044ace02bd6fe988fc53');
  assert.equal(JSON.parse(rd('assets/manifest.json')).sounds.introVoice, 'assets/sounds/intro-caglayan.mp3');
});

test('giris sesi (Asama C): bir kez, otomatik oynatma engeline karsi KISITLI ilk-dokunus yeniden denemesi, arka planda durma, cikista temizlik; yeni ses sistemi/kutuphane yok', () => {
  const code = rd('src/games/adventure/intro.js').replace(/^\s*\/\/.*$/gm, '');
  assert.match(code, /GESTURE_WINDOW_MS = 4000/);
  assert.match(code, /el\.addEventListener\('pointerdown', onGesture, \{ once: true \}\)/);
  assert.match(code, /document\.addEventListener\('visibilitychange', onVis\)/);
  assert.equal((code.match(/document\.removeEventListener\('visibilitychange', onVis\)/g) || []).length, 2, 'finish + destroy');
  assert.match(code, /audio\.enabled !== false/); // ses kapaliyken yeniden deneme yok
  assert.match(code, /if \(started \|\| !audio\?\.playFile\) return;/);
  assert.doesNotMatch(code, /new Audio|AudioContext|\.mp3|https?:\/\//);
  const pk = JSON.parse(rd('package.json'));
  assert.equal(Object.keys({ ...pk.dependencies }).filter((d) => /howler|tone|sound|audio/i.test(d)).length, 0, 'yeni ses kutuphanesi eklenmedi');
});

test('proje bellegi: CLAUDE.md var ve degismez kurallari icerir (V8.3 dokunulmaz, gradlew 100755, gercek cihaz ayri raporlanir)', () => {
  const c = rd('CLAUDE.md');
  for (const k of ['V8.3', 'gradlew', '100755', 'GERÇEK ANDROID CİHAZ TESTİ YAPILMADI', 'com.altez.minilab.v4', 'ui-smoke']) assert.ok(c.includes(k), k);
});
