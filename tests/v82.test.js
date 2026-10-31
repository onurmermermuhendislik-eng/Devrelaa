// V8.2: surum, yon kilidi (orient.js + Android koprusu), ebeveyn kilidi (parental.js), yerel profil, kayit uyumu, tanitim sesi, test ayristirici.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createOrientation, routeNeedsLandscape } from '../src/core/orient.js';
import { createParental, hashPin, validPin, newChallenge } from '../src/core/parental.js';
import { initialsOf, fullName } from '../src/core/profile.js';
import { createStorage } from '../src/core/storage.js';
import { parseUnit, parseUi } from '../scripts/parse-test-output.mjs';

const rd = (f) => readFileSync(new URL('../' + f, import.meta.url), 'utf8');
const mem = (init) => { let v = init ? JSON.stringify(init) : null; return { getItem: () => v, setItem: (_k, x) => { v = x; }, raw: () => v }; };

test('V8.2+ surum: 8.x / versionCode >= 23 / com.altez.minilab.v4 / APK adi ALTEZ-MiniLab-<tag>.apk (guncel surum tests/v83.test.js icinde sabitlenir)', () => {
  const env = rd('scripts/version.env');
  const g = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm'))[1];
  assert.match(g('VERSION_NAME_DEFAULT'), /^8\.\d+(\.\d+)?$/);
  assert.equal(g('RELEASE_TAG'), 'V' + g('VERSION_NAME_DEFAULT'));
  assert.ok(Number(g('VERSION_CODE_DEFAULT')) >= 23);
  assert.equal(g('APP_ID_DEFAULT'), 'com.altez.minilab.v4');
  assert.equal(g('APK_NAME_DEFAULT'), `ALTEZ-MiniLab-${g('RELEASE_TAG')}.apk`);
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionCode ${g('VERSION_CODE_DEFAULT')}\\b`));
  assert.match(rd('android/app/build.gradle'), /applicationId "com\.altez\.minilab\.v4"/);
  assert.equal(JSON.parse(rd('assets/data/app-version.json')).versionName, g('VERSION_NAME_DEFAULT'));
  assert.match(JSON.parse(rd('package.json')).version, /^8\.\d+\.\d+$/);
});

test('yon kilidi: hangi rota yatay? (oyun/macera/egitim evet; menu, tanitim, liste, ayarlar, profil, ebeveyn hayir)', () => {
  // V8.4: kapsam daraldi (eski beklenti: tum #/play/* yatay). Yalniz Enerji Macerasi yatay; diger oyunlar serbest (tests/v84.test.js ayrintili sinar).
  for (const h of ['#/adventure', '#/play/energy-adventure']) assert.equal(routeNeedsLandscape(h), true, h);
  for (const h of ['#/play/number-hunt', '#/play/learn', '#/play/shape-complete', '#/play/invent', '#/play/tasks']) assert.equal(routeNeedsLandscape(h), false, h);
  for (const h of ['#/', '', '#/intro', '#/games', '#/progress', '#/settings', '#/profile', '#/parent', '#/voice-test']) assert.equal(routeNeedsLandscape(h), false, h);
});

test('orient.js: yerel kopru varsa onu kullanir; yalniz mod degisince cagirir; kopru yoksa screen.orientation; hata menuyu bozmaz', () => {
  const log = [];
  const win = { AltezOrientation: { lockLandscape: () => log.push('lock'), unlock: () => log.push('unlock') } };
  const o = createOrientation({ win });
  o.set('free'); // ayni mod: cagri yok
  o.set('landscape'); o.set('landscape'); o.set('free');
  assert.deepEqual(log, ['lock', 'unlock']);
  o.set('free', true); // zorla
  assert.deepEqual(log, ['lock', 'unlock', 'unlock']);
  assert.equal(o.hasNative(), true);
  const wl = [];
  const w2 = createOrientation({ win: { screen: { orientation: { lock: (m) => { wl.push('lock:' + m); return Promise.reject(new Error('x')); }, unlock: () => wl.push('unlock') } } } });
  w2.set('landscape'); w2.set('free');
  assert.deepEqual(wl, ['lock:landscape', 'unlock']);
  const bad = createOrientation({ win: { AltezOrientation: { lockLandscape() { throw new Error('boom'); }, unlock() {} } } });
  assert.doesNotThrow(() => bad.set('landscape'));
  assert.doesNotThrow(() => createOrientation({ win: {} }).set('landscape'));
  assert.equal(createOrientation({ win: {} }).calls.length, 0);
});

test('Android: uygulama geneli yatay kilit YOK; MainActivity yon koprusu (kilitle/coz) var; yeni eklenti/bagimlilik eklenmedi', () => {
  const mf = rd('android/app/src/main/AndroidManifest.xml');
  assert.doesNotMatch(mf, /sensorLandscape/);
  assert.match(mf, /android:screenOrientation="unspecified"/);
  assert.match(mf, /orientation\|keyboardHidden\|keyboard\|screenSize/); // donmede etkinlik yeniden olusturulmaz (durum korunur)
  const j = rd('android/app/src/main/java/com/altez/minilab/v4/MainActivity.java');
  assert.match(j, /addJavascriptInterface\(new OrientationBridge\(\), "AltezOrientation"\)/);
  assert.match(j, /SCREEN_ORIENTATION_SENSOR_LANDSCAPE/);
  assert.match(j, /SCREEN_ORIENTATION_UNSPECIFIED/);
  assert.match(j, /@JavascriptInterface/);
  const pk = JSON.parse(rd('package.json'));
  assert.ok(!Object.keys({ ...pk.dependencies, ...pk.devDependencies }).some((d) => /orientation/i.test(d)), 'yon eklentisi eklenmemeli');
});

test('app.js: rota basina yon uygulanir; kilitli oyun/macera rotadan da acilmaz; profil/ebeveyn rotalari var', () => {
  const a = rd('src/core/app.js');
  assert.match(a, /orient\.set\(routeNeedsLandscape\(location\.hash\)/);
  assert.match(a, /#\/profile/);
  assert.match(a, /#\/parent/);
  assert.match(a, /parental\.isBlocked\('adventure'\)/);
  assert.match(a, /parental\.isBlocked\(game\.id\)/);
});

test('ebeveyn kilidi: PIN ozeti (acik PIN saklanmaz), dogrulama, aktif/pasif, kilit yalniz AKTIFken gecerli, PIN olmadan aktif olmaz', () => {
  const b = mem();
  const st = createStorage(b);
  const p = createParental(st, { rng: () => 0.5 });
  assert.equal(p.isOn(), false);
  assert.equal(p.setOn(true), false); // PIN yok
  assert.equal(p.isOn(), false);
  assert.equal(p.setPin('12a4'), false);
  assert.equal(p.setPin('1234'), true);
  assert.equal(p.verifyPin('1234'), true);
  assert.equal(p.verifyPin('1235'), false);
  assert.equal(p.verifyPin('123'), false);
  assert.ok(!b.raw().includes('"1234"') && !/pin":"1234/.test(b.raw()));
  p.setBlocked('adventure', true);
  assert.equal(p.isBlocked('adventure'), false); // pasif: kilit uygulanmaz
  assert.equal(p.setOn(true), true);
  assert.equal(p.isBlocked('adventure'), true);
  assert.equal(p.isBlocked('learn'), false);
  p.setBlocked('adventure', false);
  assert.equal(p.isBlocked('adventure'), false);
  p.setOn(false);
  assert.equal(p.isOn(), false);
  // yeniden yukleme: durum kalici
  const p2 = createParental(createStorage(mem(JSON.parse(b.raw()))));
  assert.equal(p2.hasPin(), true);
  assert.equal(p2.verifyPin('1234'), true);
  assert.ok(validPin('0000') && !validPin('00000') && !validPin(1234));
  assert.notEqual(hashPin('1234', 'aa'), hashPin('1234', 'bb'));
});

test('yetiskin sorusu: cevabi dogru hesaplanir, cocuk icin kolay degil (iki basamakli carpma)', () => {
  for (const r of [0, 0.3, 0.99]) {
    const c = newChallenge(() => r);
    const m = c.q.match(/(\d+) × (\d+) \+ (\d+)/);
    assert.equal(c.a, +m[1] * +m[2] + +m[3]);
    assert.ok(+m[1] >= 12 && c.a >= 75);
  }
});

test('profil: baş harfler (Onur Altay -> OA; Turkce i/ı kurali), eksik ad/soyad profil sayilmaz, yalniz yerel alanlar', () => {
  assert.equal(initialsOf({ first: 'Onur', last: 'Altay' }), 'OA');
  assert.equal(initialsOf({ first: 'ilker', last: 'ışık' }), 'İI');
  assert.equal(initialsOf({ first: 'Ayşe Nur', last: 'Yılmaz Kaya' }), 'AK');
  assert.equal(initialsOf(null), '');
  assert.equal(initialsOf({ first: 'Onur', last: '' }), '');
  assert.equal(fullName({ first: 'Onur', last: 'Altay' }), 'Onur Altay');
  const st = createStorage(mem());
  st.update({ profile: { first: 'Onur', last: '' } });
  assert.equal(st.get().profile, undefined);
  st.update({ profile: { first: '  Onur<b> ', last: 'Altay1' } });
  assert.deepEqual(st.get().profile, { first: 'Onurb', last: 'Altay' });
  st.update({ profile: { first: 'x'.repeat(50), last: 'y' } });
  assert.equal(st.get().profile.first.length, 20);
  st.update({ profile: null });
  assert.equal(st.get().profile, undefined);
});

test('kayit uyumu: V8.1 kaydi aynen korunur (profil/ebeveyn yok -> varsayilan); yeni alanlar bozuksa atilir; yeni alan eski ilerlemeyi silmez', () => {
  const old = { correct: 7, band: '6-8', sound: true, seen: true, circuit: { '4-5': { stage: 1, plays: 2 }, '6-8': { stage: 3, plays: 5 } }, games: { 'number-hunt': { correct: 4 } }, edu: { done: ['circuit-1'] }, adv: { intro: true, tasks: { tanis: 3 } } };
  const st = createStorage(mem(old));
  const s = st.get();
  assert.equal(s.correct, 7); assert.equal(s.band, '6-8'); assert.deepEqual(s.edu, { done: ['circuit-1'] }); assert.deepEqual(s.adv, old.adv); assert.deepEqual(s.games, old.games);
  assert.equal(s.profile, undefined); assert.equal(s.parent, undefined);
  const bad = createStorage(mem({ ...old, profile: 'x', parent: { on: true, pin: 'ZZ', blocked: [1, '<x>', 'adventure'] } })).get();
  assert.equal(bad.profile, undefined);
  assert.equal(bad.parent.on, false); // PIN yok -> aktif olamaz
  assert.equal(bad.parent.pin, undefined);
  assert.deepEqual(bad.parent.blocked, ['adventure']);
  assert.equal(bad.correct, 7);
  // profil/ebeveyn yazmak ilerlemeyi bozmaz
  const st2 = createStorage(mem(old));
  st2.update({ profile: { first: 'A', last: 'B' } });
  createParental(st2).setPin('4321');
  assert.equal(st2.get().correct, 7); assert.deepEqual(st2.get().adv, old.adv); assert.deepEqual(st2.get().games, old.games);
});

test('tanitim sesi (kok neden duzeltmesi): intro.js mevcut voice/audio altyapisini kullanir; yeni ses modeli/dosyasi yok; hata yakalanir', () => {
  const i = rd('src/games/adventure/intro.js');
  assert.match(i, /voice\?\.say\('adv-intro'/);
  assert.match(i, /audio\?\.play\('circuitOn'\)/);
  assert.match(i, /spoken\.has\(i\)/); // ayni sahne iki kez konusmaz
  assert.match(i, /voice\?\.stop\(\)/);
  assert.match(i, /try \{/);
  assert.doesNotMatch(i.replace(/^\s*\/\/.*$/gm, ''), /new Audio|\.mp3|\.wav|piper|xtts|mms/i); // V8.3: giris sesi dosyasi manifest anahtariyla ('introVoice') cagrilir, yolu kodda yok
  assert.match(rd('src/games/adventure/index.js'), /audio,\s*\n\s*voice,\s*\n\s*onDone/);
  assert.match(rd('src/core/voice.js'), /VOICE_BUILD = 'ses-3-nativePromise'/);
});

test('arayuz: ana menude ayri Profil ve Ebeveyn dugmeleri; menu/tanitimda "cihazi cevir" yok; portre menu CSS; kart izgarasi', () => {
  const m = rd('src/ui/mainmenu.js');
  assert.match(m, /data-act="profile"/);
  assert.match(m, /data-act="parent"/);
  assert.doesNotMatch(m.slice(0, m.indexOf('// ---- Ilerlemem')), /adv-rotate/);
  assert.doesNotMatch(rd('src/games/adventure/intro.js'), /adv-rotate/);
  const c = rd('src/ui/styles.css');
  assert.match(c, /@media \(orientation: portrait\) \{\s*\n\s*\.mm-grid \{ grid-template-columns: repeat\(2/);
  assert.match(c, /\.home\.games \.game-cards \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 270px\)/);
  assert.match(c, /env\(safe-area-inset-top/);
  const tail = c.slice(c.indexOf('/* V7.5: Egitim DERS'));
  assert.ok(tail.length > 100);
  const s = JSON.parse(rd('assets/data/strings.tr.json'));
  for (const k of ['profile', 'parent', 'gate']) assert.ok(s.mm[k] && Object.keys(s.mm[k]).length > 5, k);
  assert.doesNotMatch(rd('src/ui/profile.js') + rd('src/ui/parent.js') + rd('src/ui/gate.js'), /https?:\/\/|fetch\(|XMLHttpRequest|google\.|firebase/i);
});

test('test sonucu ayristirici: TAP, spec ve Turkce UI bicimlerini tanir; taninmayan cikti BASARI SAYILMAZ; FAIL satiri basarisizdir', () => {
  assert.deepEqual(parseUnit('# tests 10\n# pass 9\n# fail 1\n'), { pass: 9, total: 10, fail: 1 });
  assert.deepEqual(parseUnit('ℹ tests 5\nℹ suites 0\nℹ pass 5\nℹ fail 0\n'), { pass: 5, total: 5, fail: 0 });
  assert.equal(parseUnit('hicbir sey'), null);
  assert.deepEqual(parseUi('  ok a\n112/112 kontrol basarili (V8)\n'), { pass: 112, total: 112, fail: 0 });
  assert.deepEqual(parseUi('  ok x\nV8.2 UI: 84/84 gecti\n'), { pass: 84, total: 84, fail: 0 });
  assert.deepEqual(parseUi('FAIL  A1 x\nV8.2 UI: 83/84 gecti, 1 BASARISIZ\n'), { pass: 83, total: 84, fail: 1 });
  assert.deepEqual(parseUi('10/10 passed\nFAIL surpriz\n'), { pass: 10, total: 10, fail: 1 });
  assert.equal(parseUi('sonuc yok'), null);
  const ib = rd('install-and-build.sh');
  assert.match(ib, /parse-test-output\.mjs unit/);
  assert.match(ib, /parse-test-output\.mjs ui/);
  assert.doesNotMatch(ib, /\^\[0-9\]\+\/\[0-9\]\+ kontrol basarili/); // eski, tek bicime bagli ayristirma kalktı
});
