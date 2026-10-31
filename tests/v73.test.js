// V7.3: surum tutarliligi + ana ekran duzeni + sesli secenek/tek durumlu vurgu (kaynak duzeyi kontroller; tarayici davranisi UI smoke'ta)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('V7.3 ana ekran: Egitim ve yas dugmeleri simge ustte / yazi altta (yigin duzeni)', () => {
  const h = rd('src/ui/home.js');
  assert.match(h, /edu-entry/);
  assert.match(h, /band-btn/);
  // V7.8: Egitim girisi buyuk Ana Menu kartina tasindi; yas dugmesi (simge ustte / yazi altta) ayni yigin duzeniyle kaldi
  assert.equal((h.match(/class="stk-icon"/g) || []).length >= 1, true);
  assert.equal((h.match(/class="stk-label"/g) || []).length >= 1, true);
  assert.match(h, /data-band="\$\{st\.band\}"/);
  const c = rd('src/ui/styles.css');
  assert.match(c, /\.btn\.chip\.stack[^}]*flex-direction:\s*column/s);
  assert.match(c, /\.stack \.stk-label[^}]*white-space:\s*nowrap/s);
  assert.match(c, /\.home-ctl[^}]*flex-wrap:\s*wrap/s);
});

test('V7.3 yas bantlari degismedi: yalniz 4-5 ve 6-8', () => {
  const h = rd('src/ui/home.js');
  assert.doesNotMatch(h, /data-band="(?!\$\{st\.band\})(?!4-5|6-8)/);
});

test('V7.3 secim vurgusu: tek durum, kenarlik + parlama (yalniz renk degil), sonsuz degil, hafif', () => {
  const c = rd('src/ui/styles.css');
  const m = c.match(/\.tile\.chosen\s*\{[^}]*\}/s)[0];
  assert.match(m, /outline:\s*4px/);
  assert.match(m, /box-shadow/);
  assert.match(m, /animation:\s*chosenGlow[^;]*\b2\b/);
  assert.doesNotMatch(m, /infinite/);
  assert.match(c, /\.tile\.chosen\.correct/);
  assert.match(c, /@keyframes chosenGlow/);
});

test('V7.3 sesli secenek: mevcut TTS (voice.say) ile ad okunur, tek chosen durumu, hata yakalanir', () => {
  const g = rd('src/games/shape-complete/game.js');
  assert.match(g, /function chooseOption/);
  assert.match(g, /function clearChosen/);
  assert.match(g, /voice\.say\('opt', undefined, name\)/);
  assert.match(g, /try\s*\{[^}]*voice\.say\('opt'/s);
  assert.match(g, /nextRound[\s\S]*clearChosen\(\)/);
});
