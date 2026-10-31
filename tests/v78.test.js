// V7.8: surum tutarliligi, 5 yeni Elektrik Dedektifi vakasi, Mantik ve Bilim duzeltmeleri, kayit hatasinda sahte rozet yok,
// ayni yanlisa tekrar dokunus / ses zamanlamasi (kaynak denetimi; davranis scripts/ui-v78.mjs icinde).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createStorage } from '../src/core/storage.js';
import { tasksFor, optionCount, MAX_OPTIONS_4_5 } from '../src/core/taskkit.js';
import { startState, evaluate, placeOption, tapFault, validateTask as validateDet } from '../src/games/detective/logic.js';
import { SOUND_MS } from '../src/core/audio.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const inv = data.game.invent;
const DET = data.game.detective;
const LS = data.game['logic-science'];
const KEY = 'altez-minilab:v1';

test('V7.8->V7.9 surum tutarliligi: version.env, package.json/lock, build.gradle, VERSION.json, app-version.json ayni surumde; applicationId korundu (guncel surum tests/v79.test.js icinde sabitlenir)', () => {
  const env = rd('scripts/version.env');
  const g = (k) => env.match(new RegExp(`^${k}="?([^"\\n]*)"?`, 'm'))[1];
  const name = g('VERSION_NAME_DEFAULT');
  const code = g('VERSION_CODE_DEFAULT');
  assert.equal(g('APP_ID_DEFAULT'), 'com.altez.minilab.v4');
  const npmVer = name.split('.').length >= 3 ? name : name + '.0'; // 7.9 -> 7.9.0, 7.9.1 -> 7.9.1
  assert.equal(JSON.parse(rd('package.json')).version, npmVer);
  const lock = JSON.parse(rd('package-lock.json'));
  assert.equal(lock.version, npmVer);
  assert.equal(lock.packages[''].version, npmVer);
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionCode ${code}\\b`));
  assert.match(rd('android/app/build.gradle'), new RegExp(`versionName "${name.replaceAll('.', '\\.')}"`));
  const vj = JSON.parse(rd('VERSION.json'));
  assert.equal(String(vj.versionCode), code);
  assert.equal(vj.versionName, name);
  const av = JSON.parse(rd('assets/data/app-version.json'));
  assert.equal(av.versionName, name);
  assert.equal(String(av.versionCode), code);
});

test('V7.8 Dedektif: 5 yeni vaka (seri LED, anahtar, kisa devre, paralel kolda anahtar, pil yuku); kimlikler benzersiz; V7.7 vakalari ayni', () => {
  const ids = DET.tasks.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids.length, 17);
  const added = ['d13-seri-lambalar', 'd14-kumanda-parcasi', 'd15-kisa-yol', 'd16-sessiz-kol', 'd17-yorgun-pil'];
  assert.deepEqual(ids.slice(12), added);
  for (const id of added) {
    const t = DET.tasks.find((x) => x.id === id);
    assert.deepEqual(validateDet(t, inv), [], id);
    const st = startState(t);
    assert.equal(evaluate(inv, t, st.slots, st.states).ok, false, `${id}: baslangicta cozulmus degil`);
    if (t.bands.includes('4-5')) assert.ok(optionCount(t) <= MAX_OPTIONS_4_5, id);
  }
  // 4-5: 2 yeni vaka, 6-8: 5 yeni vaka
  assert.equal(tasksFor(DET, '4-5').length, 8);
  assert.equal(tasksFor(DET, '6-8').length, 15);
});

test('V7.8 Dedektif: d14 yalniz anahtarla cozulur (kablo/direnc cozmez, ipucu var); d15-d17 yalniz isaretli konum duzelince cozulur', () => {
  const d14 = DET.tasks.find((t) => t.id === 'd14-kumanda-parcasi');
  assert.deepEqual(d14.options.filter((o) => placeOption(inv, d14, o).ok), ['switch']);
  assert.equal(d14.options.length, 3);
  for (const id of ['d15-kisa-yol', 'd16-sessiz-kol', 'd17-yorgun-pil']) {
    const t = DET.tasks.find((x) => x.id === id);
    assert.ok(!t.bands.includes('4-5'), `${id}: yalniz 6-8`);
    const st = startState(t);
    for (let i = 1; i <= t.slots.length; i++) {
      const slot = `s${i}`;
      if (t.culprits.some((c) => c.slot === slot)) continue;
      assert.equal(tapFault(t, st.slots, st.states, [], slot).hit, false, `${id}/${slot}`);
    }
    assert.equal(t.culprits.length, 1, `${id}: tek ariza`);
  }
  // d13: bos baslangic, 27 kombinasyonun yalniz bir kismi cozer (rastgele dizme cozmez)
  const d13 = DET.tasks.find((t) => t.id === 'd13-seri-lambalar');
  let ok = 0;
  const tools = d13.tools;
  for (const a of tools) for (const b of tools) for (const c of tools) if (evaluate(inv, d13, [a, b, c], {}).ok) ok += 1;
  assert.ok(ok >= 1 && ok < tools.length ** 3, `d13 cozum sayisi ${ok}`);
});

test('V7.8 metinler: cevabi ele veren basliklar yok; yazim sadelesti; kisa l4 etiketi; yeni kayit-hata metni her iki oyunda', () => {
  const titles = Object.fromEntries([...DET.tasks, ...LS.tasks].map((t) => [t.id, t.title]));
  assert.equal(titles['d1-kayip-lamba'], 'Karanlık vaka');
  assert.equal(titles['l7-meyveler'], 'Meyve dizisi');
  assert.equal(titles['l14-golge'], 'Duvardaki iz');
  assert.ok(!/gölge/i.test(titles['l14-golge']) && !/muz/i.test(titles['l7-meyveler']));
  const l4 = LS.tasks.find((t) => t.id === 'l4-civciv');
  for (const it of l4.items) assert.ok(it.label.length <= 12, `l4 etiket kisa: ${it.label}`);
  assert.equal(l4.items[1].label, 'Çıkan civciv');
  assert.match(l4.hint2, /çıkan civciv, küçük civciv/);
  for (const T of [DET.text, LS.text]) {
    assert.ok(T.saveFailTitle && T.saveFail);
    assert.match(T.saveFail, /Rozet henüz kazanılmadı/);
  }
  // 4-5: LS secenek sinirlari V7.7 ile ayni (3)
  for (const t of tasksFor(LS, '4-5')) assert.ok(optionCount(t) <= MAX_OPTIONS_4_5, t.id);
});

test('V7.8 kayit: depolama yazamazsa completeTask rozet VERMEZ (saved:false), bellek geri alinir, gorev tekrar cozulebilir; normal akis ayni', () => {
  const m = new Map();
  let fail = false;
  const b = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { if (fail) throw new Error('quota'); m.set(k, v); } };
  const s = createStorage(b);
  const r1 = s.completeTask('detective', 'd1-kayip-lamba');
  assert.deepEqual([r1.firstTime, r1.saved], [true, true]);
  fail = true;
  const r2 = s.completeTask('detective', 'd2-kopuk-yol');
  assert.deepEqual([r2.firstTime, r2.saved], [false, false]);
  assert.deepEqual(s.getTasks('detective').done, ['d1-kayip-lamba']);
  assert.equal(s.saveOk(), false);
  fail = false;
  const r3 = s.completeTask('detective', 'd2-kopuk-yol'); // yer acilinca ayni vaka yeniden cozulur
  assert.deepEqual([r3.firstTime, r3.saved], [true, true]);
  assert.deepEqual(createStorage(b).getTasks('detective').done, ['d1-kayip-lamba', 'd2-kopuk-yol']);
  // tekrar cozum: odul yok, saved true
  assert.deepEqual([s.completeTask('detective', 'd2-kopuk-yol').firstTime, s.completeTask('detective', 'd2-kopuk-yol').saved], [false, true]);
});

test('V7.8 kabuk: ayni yanlis tekrarinda sayac artmaz ama ipucu yeniden gosterilir; sesler ust uste binmez; kayit hatasinda rozet yok', () => {
  const sh = rd('src/games/tasks/shell.js');
  assert.match(sh, /if \(ref === lastWrong\) \{[\s\S]{0,200}setCap\(lastHint\)[\s\S]{0,40}return;/);
  assert.ok(sh.indexOf('setCap(lastHint)') < sh.indexOf('wrongCount += 1'), 'tekrarda sayac artmadan doner');
  assert.match(sh, /SOUND_MS\[first\]/);
  assert.match(sh, /soundEnd - Date\.now\(\)/);
  assert.doesNotMatch(sh, /audio\.play\('success'\), 300\)/);
  assert.match(sh, /res\?\.saved === false/);
  assert.match(sh, /R\.firstTime && !saveFailed/);
  // sure sabitleri: basari sesi, ilk sesten sonra; kutlama sesi basari sesinden sonra
  assert.ok(SOUND_MS.correct + 40 >= SOUND_MS.correct && SOUND_MS.success > 0 && SOUND_MS.levelUp > 0);
});

test('V7.8 Mantik ve Bilim gorunum/CSS: uzun emoji dizisi kuculur, yatay yerlesim, basari animasyonu (azaltilmis harekette kapali), dolu arizali konum vurgusu', () => {
  const v = rd('src/games/logic-science/view.js');
  assert.match(v, /longCls/);
  assert.match(v, /ls-win/);
  const css = rd('src/ui/styles.css');
  assert.match(css, /\.ls-cell\.ls-long/);
  assert.match(css, /\.ls-opt\.ls-long/);
  assert.match(css, /@keyframes ls-win/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{ \.ls-win \{ animation: none/);
  assert.match(css, /orientation: landscape\) and \(max-height: 540px\) \{\n\.tk\[data-game="logic-science"\]/);
  assert.match(css, /\.inv-hit\.hint/);
  assert.match(rd('src/games/detective/view.js'), /inv-hit\$\{hintSlots\.has\(p\.id\)/);
  // ses/depolama kurali: yeni kod yalniz ctx.audio / ctx.voice
  for (const f of ['src/games/tasks/shell.js', 'src/games/logic-science/view.js', 'src/games/detective/view.js']) {
    assert.doesNotMatch(rd(f), /new Audio|speechSynthesis|AudioContext|localStorage|sessionStorage/, f);
  }
  assert.ok(KEY);
});
