// V7.8 yeni Ana Menu + MiniLab maskotu: saf mantik (createBrain) ve kaynak/CSS denetimleri. DOM davranisi scripts/ui-v78-home.mjs icinde.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadData } from './helpers.js';
import { createBrain, KINDS, SOUND_KIND, mascotSvg } from '../src/ui/mascot.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const data = loadData();
const MSG = data.strings.mascot.messages;
const clock = (t0 = 1000) => { let t = t0; const f = () => t; f.adv = (ms) => (t += ms); return f; };

test('V7.8 maskot mesajlari: her tepki icin en az bir kisa cumle; cocuk dostu uzunluk', () => {
  for (const k of Object.keys(KINDS)) {
    assert.ok(Array.isArray(MSG[k]) && MSG[k].length >= 1, k);
    for (const t of MSG[k]) assert.ok(t.length >= 4 && t.length <= 40, `${k}: ${t}`);
  }
  for (const k of ['enter', 'correct', 'wrong', 'hint', 'done']) assert.ok(MSG[k].length >= 3, `${k}: tekrar azaltmak icin 3+ cumle`);
  assert.deepEqual(MSG.greet, ['Merhaba Minik Kâşif!']);
});

test('V7.8 maskot beyni: selam oturumda bir kez; ayni cumle art arda gelmez; bekleme suresi icinde tekrar tepki yok', () => {
  const now = clock();
  const b = createBrain({ messages: MSG, rng: () => 0, now });
  assert.equal(b.react('greet').text, 'Merhaba Minik Kâşif!');
  assert.equal(b.react('greet'), null, 'selam tekrarlanmaz');
  now.adv(10000);
  const seen = [];
  for (let i = 0; i < 6; i++) { const r = b.react('correct'); assert.ok(r, 'bekleme sonrasi tepki'); seen.push(r.text); now.adv(2000); }
  for (let i = 1; i < seen.length; i++) assert.notEqual(seen[i], seen[i - 1], 'art arda ayni cumle yok');
  // bekleme suresi: 'wrong' 6 sn
  now.adv(10000);
  assert.ok(b.react('wrong'));
  now.adv(1000);
  assert.equal(b.react('wrong'), null, 'yanlista ust uste yorum yok');
  now.adv(6000);
  assert.ok(b.react('wrong'));
  assert.equal(b.react('bilinmeyen'), null);
});

test('V7.8 maskot beyni: kutlama gorunurken kucuk tepki araya girmez; kutlama kucugun yerine gecer; clearShowing ekran degisiminde', () => {
  const now = clock();
  const b = createBrain({ messages: MSG, rng: () => 0.5, now });
  assert.equal(b.react('correct').mood, 'joy');
  now.adv(300);
  assert.equal(b.react('done').mood, 'party', 'kutlama dogru cevabin yerine gecer');
  now.adv(300);
  assert.equal(b.react('hint'), null, 'kutlama bitmeden ipucu tepkisi yok');
  assert.equal(b.react('enter'), null);
  b.clearShowing();
  now.adv(5000);
  assert.ok(b.react('enter'));
});

test('V7.8 maskot: ses adlari dogru tepkiye eslenir; yeni ses/konusma/harici kaynak yok; SVG sari simsek ve mavi goz icerir', () => {
  assert.deepEqual(SOUND_KIND, { correct: 'correct', circuitOn: 'correct', gentle: 'wrong', success: 'done', levelUp: 'done', jingle: 'done' });
  const m = rd('src/ui/mascot.js');
  assert.doesNotMatch(m, /new Audio|AudioContext|speechSynthesis|SpeechSynthesisUtterance|localStorage|fetch\(|https?:\/\//);
  const svg = mascotSvg();
  assert.match(svg, /#ffd23f/i); // sari simsek
  assert.match(svg, /#38bdf8/i); // mavi gozler
  assert.match(svg, /class="m-eyes"/);
  assert.doesNotMatch(svg, /<image|href=/);
});

test('V7.8 Ana Menu: dort bolum (Oyunlar, Egitim, Profil, Ebeveyn); Profil/Ebeveyn GELISTIRME ASAMASINDA ve gercek islev yok; versiyon koddan', () => {
  const h = rd('src/ui/home.js');
  for (const c of ['mc-games', 'mc-edu', 'mc-profile', 'mc-parent']) assert.match(h, new RegExp(c));
  assert.match(h, /data-act="goto" data-to="games"/);
  assert.match(h, /data-game="learn"/);
  assert.match(h, /devCard\('profile'/);
  assert.match(h, /devCard\('parental'/);
  assert.doesNotMatch(h, /data-game="(profile|parental)"/);
  assert.equal(data.strings.menu.dev, 'GELİŞTİRME AŞAMASINDA');
  assert.match(h, /data\.version\?\.versionName/);
  assert.equal(data.strings.menu.games.title, 'Oyunlar');
  assert.equal(data.strings.menu.edu.title, 'Eğitim');
  assert.equal(data.strings.menu.profile.title, 'Profil');
  assert.equal(data.strings.menu.parent.title, 'Ebeveyn');
  assert.match(data.strings.soon.items.parental.note, /PIN koruması yoktur/);
  // Oyunlar ekrani: Enerji Macerasi yalniz "Cok yakinda"; Profil/Ebeveyn bu ekranda gosterilmez
  assert.match(h, /mode !== 'games' \|\| it\.id === 'adventure'/);
});

test('V7.8 yonlendirme: #/games Oyunlar ekrani; dogrudan oyun yollari; maskot park/serbest; ses sarmalayici oyunu bozmaz', () => {
  const a = rd('src/core/app.js');
  assert.match(a, /#\/games/);
  assert.match(a, /\.\.\.subGames/);
  assert.match(a, /mascot\.park\(\)/);
  assert.match(a, /mascot\.setMuted\(true\)/);
  assert.match(a, /const r = rawPlay\(\.\.\.a\);/);
  assert.match(a, /catch \{[\s\S]{0,80}maskot hatasi/);
  const reg = rd('src/games/registry.js');
  assert.match(reg, /export const games = \[shapeComplete, numberHunt, invent\];/);
  assert.equal(data.strings.games.detective.title, 'Elektrik Dedektifi');
});

test('V7.8 CSS: hareket yalniz transform/opacity/translate; kartlar dokunmayi engellemez; hareket azaltma kapatir; kart yuzeyi animasyonu duragan dugmeyi oynatmaz', () => {
  const c = rd('src/ui/styles.css');
  const tail = c.slice(c.indexOf('V7.8: yeni Ana Menu'));
  assert.match(tail, /@keyframes mc-float \{[^}]*translate/s);
  assert.match(tail, /\.mc-in \{[^}]*animation: mc-float 4\.4s/s);
  assert.doesNotMatch(tail, /\.menu-card \{[^}]*animation:/s, 'animasyon dugmede degil ic yuzeyde (dokunma hedefi sabit)');
  assert.match(tail, /\.mascot, \.mascot \* \{ pointer-events: none; \}/);
  assert.match(tail, /\.mascot-dock \{[^}]*pointer-events: none/s);
  assert.match(tail, /prefers-reduced-motion: reduce\) \{\n\.mc-in, \.mascot \*, \.mascot, #app > section\.home, #app > section\.play \{ animation: none !important/);
  assert.doesNotMatch(tail, /@keyframes[^{]*\{[^}]*(width|height|top|left|margin)\s*:/s, 'yerlesimi tetikleyen animasyon yok');
  assert.match(tail, /orientation: landscape\) and \(max-height: 540px\) \{\n\.home\.menu/);
  assert.match(tail, /\.mc-dev/);
});
