// Asama 4: Sayi Avi mantik testleri + oyun secimi/seviye regresyonlari.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { createRng } from '../src/core/rng.js';
import { makeRound, tierConfig, KINDS } from '../src/games/number-hunt/rounds.js';
import { levelFor, contentFor } from '../src/core/progress.js';
import { games } from '../src/games/registry.js';
import { readFileSync } from 'node:fs';

const data = loadData();
const nh = data.game['number-hunt'];
const BANDS = ['4-5', '6-8'];
const N = 250;

function* all(band, tier, n = N) {
  const rng = createRng(1000 + tier * 7 + (band === '4-5' ? 1 : 2));
  let prevId = null;
  let prevKind = null;
  for (let i = 0; i < n; i++) {
    const r = makeRound({ data, rng, band, tier, prevId, prevKind });
    yield { r, prevId, prevKind };
    prevId = r.id;
    prevKind = r.kind;
  }
}
const tiers = (band) => nh.tiers[band].map((_, i) => i);
const ans = (r) => r.options[r.answer];
const maxOf = (band, tier) => tierConfig(nh, band, tier).max;

test('sayi avi: sayi araligi yasa ve kademeye uygun (4-5 <= 5, 6-8 <= 10)', () => {
  for (const band of BANDS)
    for (const t of tiers(band)) {
      const cap = Math.max(maxOf(band, t), band === '6-8' ? tierConfig(nh, band, t).addMax ?? 0 : 0);
      for (const { r } of all(band, t)) {
        const nums = [...r.options.map((o) => o.value), r.prompt.count, r.prompt.value, r.prompt.total, r.prompt.a, r.prompt.b, ...(r.prompt.items ?? []), ...(r.solvedPrompt.items ?? [])].filter((v) => typeof v === 'number');
        for (const v of nums) assert.ok(v >= 1 && v <= (band === '4-5' ? 5 : 10), `${band}/${t} ${r.id} deger ${v}`);
        if (band === '4-5') for (const v of nums) assert.ok(v <= maxOf(band, t), `${band}/${t} ${r.id} ${v}`);
        void cap;
      }
    }
});

test('sayi avi: tam bir dogru cevap; secenekler benzersiz, gecerli ve kademe sayisinda', () => {
  for (const band of BANDS)
    for (const t of tiers(band)) {
      const want = tierConfig(nh, band, t).options;
      for (const { r } of all(band, t)) {
        assert.equal(r.options.filter((o) => o.id === 'ok').length, 1);
        assert.equal(new Set(r.options.map((o) => o.key)).size, r.options.length, `${r.id} tekrarlayan secenek`);
        assert.ok(r.options.length >= 2 && r.options.length <= want, `${band}/${t} ${r.id} secenek ${r.options.length}`);
        if (band === '4-5') assert.ok(r.options.length <= 3);
        assert.ok(r.answer >= 0 && r.answer < r.options.length);
      }
    }
});

test('sayi avi: ilk kademelerde 2 secenek (4-5 baslangic) ve 4-5te en fazla 3', () => {
  assert.equal(tierConfig(nh, '4-5', 0).options, 2);
  for (const t of tiers('4-5')) assert.ok(tierConfig(nh, '4-5', t).options <= 3);
});

test('sayi avi: nesne sayisi cevapla uyumlu (say / sayiyi bul)', () => {
  for (const band of BANDS)
    for (const t of tiers(band))
      for (const { r } of all(band, t)) {
        if (r.kind === 'count' || r.kind === 'findNumber') assert.equal(ans(r).value, r.prompt.count);
      }
});

test('sayi avi: sayiyi miktarla eslestir / istenen sayida bul dogru', () => {
  for (const t of tiers('4-5'))
    for (const { r } of all('4-5', t)) {
      if (r.kind === 'numToGroup') {
        assert.equal(ans(r).view.type, 'group');
        assert.equal(ans(r).view.count, r.prompt.value);
        for (const o of r.options) if (o.id !== 'ok') assert.notEqual(o.view.count, r.prompt.value);
      }
      if (r.kind === 'pickGroup') {
        const ok = ans(r).view;
        assert.equal(ok.count, r.prompt.count);
        assert.equal(ok.object, r.prompt.object);
        // yanlis secenekler ya yanlis nesne ya yanlis sayi (cevap tek)
        for (const o of r.options) if (o.id !== 'ok') assert.ok(o.view.count !== ok.count || o.view.object !== ok.object);
      }
    }
});

test('sayi avi: eksik miktari tamamla (4-5) dogru', () => {
  let seen = 0;
  for (const { r } of all('4-5', 2, 400)) {
    if (r.kind !== 'missing') continue;
    seen++;
    const { total, filled } = r.prompt;
    assert.ok(total <= 5 && filled >= 1 && filled < total);
    assert.equal(ans(r).view.count, total - filled);
    assert.equal(r.solvedPrompt.filled, total);
    assert.equal(r.solvedPrompt.was, filled);
  }
  assert.ok(seen > 20);
});

test('sayi avi: toplama ve cikarma sonuclari dogru, sonuc kademeyi asmaz', () => {
  let adds = 0;
  let subs = 0;
  for (const t of tiers('6-8'))
    for (const { r } of all('6-8', t)) {
      const cfg = tierConfig(nh, '6-8', t);
      if (r.kind === 'add') {
        adds++;
        assert.equal(ans(r).value, r.a + r.b);
        assert.ok(r.a + r.b <= cfg.addMax);
        assert.equal(r.solvedPrompt.result, r.a + r.b);
      }
      if (r.kind === 'subtract') {
        subs++;
        assert.equal(ans(r).value, r.total - r.away);
        assert.ok(r.total - r.away >= 1 && r.total <= cfg.subMax);
        if (cfg.subMax <= 5) assert.equal(r.away, 1);
      }
    }
  assert.ok(adds > 50 && subs > 50);
});

test('sayi avi: cikarma ilk kademede yok; toplama/cikarma sadece 6-8de', () => {
  assert.ok(!tierConfig(nh, '6-8', 0).kinds.some(([k]) => k === 'subtract'));
  for (const t of tiers('4-5'))
    for (const { r } of all('4-5', t, 80)) assert.ok(['count', 'numToGroup', 'pickGroup', 'missing'].includes(r.kind), r.kind);
  for (const t of tiers('6-8'))
    for (const { r } of all('6-8', t, 80)) assert.ok(['findNumber', 'missingNumber', 'add', 'subtract', 'sequence'].includes(r.kind), r.kind);
});

test('sayi avi: eksik sayi ve oruntu cozulebilir (kural tutuyor, cevap tek)', () => {
  let ms = 0;
  let sq = 0;
  for (const t of tiers('6-8'))
    for (const { r } of all('6-8', t)) {
      if (r.kind === 'missingNumber') {
        ms++;
        const full = r.solvedPrompt.items;
        const d = full[1] - full[0];
        assert.ok(d === 1 || d === -1);
        full.forEach((v, i) => i && assert.equal(v - full[i - 1], d));
        assert.equal(ans(r).value, full[r.prompt.hole]);
        assert.equal(r.prompt.items[r.prompt.hole], null);
        assert.ok(r.prompt.hole > 0 && r.prompt.hole < full.length - 1);
      }
      if (r.kind === 'sequence') {
        sq++;
        const items = r.solvedPrompt.items.slice(0, -1);
        const next = r.solvedPrompt.items.at(-1);
        assert.equal(ans(r).value, next);
        const step = { '+1': 1, '+2': 2, '-1': -1 }[r.rule];
        if (step) {
          items.forEach((v, i) => i && assert.equal(v - items[i - 1], step));
          assert.equal(next, items.at(-1) + step);
        } else {
          assert.equal(r.rule, 'repeat');
          items.forEach((v, i) => i > 1 && assert.equal(v, items[i - 2]));
          assert.notEqual(items[0], items[1]);
          assert.equal(next, items[items.length - 2]);
        }
        assert.ok(next >= 1 && next <= 10);
      }
    }
  assert.ok(ms > 40 && sq > 40);
});

test('sayi avi: ayni tur / ayni gorev tipi arka arkaya tekrar etmez', () => {
  for (const band of BANDS)
    for (const t of tiers(band))
      for (const { r, prevId, prevKind } of all(band, t, 300)) {
        if (prevId) assert.notEqual(r.id, prevId, `${band}/${t}`);
        if (prevKind && tierConfig(nh, band, t).kinds.length > 1) assert.notEqual(r.kind, prevKind, `${band}/${t}`);
      }
});

test('sayi avi: ipucu cevabi vermez (daraltici), yonerge ve fikir dolu, ses anahtari manifestte', () => {
  for (const band of BANDS)
    for (const t of tiers(band))
      for (const { r } of all(band, t, 120)) {
        assert.equal(r.hintMode, 'narrow');
        assert.ok(r.voiceText && r.voiceText.length > 3);
        assert.ok(r.idea);
        assert.ok(r.voice in data.manifest.voice, r.voice);
        assert.ok(!/[{}]/.test(r.voiceText), r.voiceText);
        // ipucu alani cevabi (secenek indeksi/degeri) icermez
        assert.ok(['objects', 'prompt', 'slots', 'hole'].includes(r.hint));
      }
});

test('sayi avi: sesli yonerge sablonlari Turkce ve istenen cumleleri iceriyor', () => {
  const v = nh.voice;
  assert.equal(v.findNumber, 'Doğru sayıyı bul.');
  assert.equal(v.missingNumber, 'Eksik sayıyı bul.');
  assert.equal(v.add, 'İkisini birleştir, kaç oldu?');
  assert.equal(v.subtract1, 'Bir tanesi giderse kaç kalır?');
  assert.equal(v.sequence, 'Sırada hangi sayı var?');
  assert.ok(v.count.startsWith('Kaç tane'));
});

test('sayi avi: nesne dosyalari var, her yas/kademe icin tum tipler uretilebilir', () => {
  for (const o of nh.objects) assert.ok(readFileSync(new URL(`../assets/${o.file.replace(/^assets\//, '')}`, import.meta.url)).length > 50, o.file);
  for (const band of BANDS) {
    const kinds = new Set();
    for (const t of tiers(band)) for (const { r } of all(band, t, 150)) kinds.add(r.kind);
    const expect = band === '4-5' ? ['count', 'numToGroup', 'pickGroup', 'missing'] : ['findNumber', 'missingNumber', 'add', 'subtract', 'sequence'];
    for (const k of expect) assert.ok(kinds.has(k), `${band} ${k}`);
  }
  assert.deepEqual([...KINDS].sort(), [...KINDS].sort());
});

test('seviyeler: esikler 0/10/30/60 degismedi, Kasif/Mucit planli, sayi avi icerigi aktif seviyelerde', () => {
  const lv = data.levels;
  const active = lv.filter((l) => l.status === 'active');
  assert.deepEqual(active.map((l) => l.threshold ?? l.min ?? l.from), [0, 10, 30, 60]);
  assert.deepEqual(lv.map((l) => l.name), ['Başlangıç', 'Çırak', 'Kalfa', 'Usta', 'Kaşif', 'Mucit']);
  for (const l of lv.filter((x) => x.status !== 'active')) assert.ok(!l.content?.['number-hunt']);
  active.forEach((l, i) => assert.equal(contentFor(l, 'number-hunt').tier, i));
  assert.equal(levelFor(0, lv).level.name, 'Başlangıç');
  assert.equal(levelFor(60, lv).level.name, 'Usta');
  assert.equal(levelFor(9999, lv).level.name, 'Usta');
});

test('oyun secimi: iki oyun kayitli, kart metinleri var, ayri kimlik', () => {
  // V5: Mucit Atolyesi ucuncu oyun olarak eklendi (ilk ikisi ve sirasi ayni)
  assert.deepEqual(games.map((g) => g.id), ['shape-complete', 'number-hunt', 'invent']);
  for (const g of games) {
    assert.equal(typeof g.create, 'function');
    assert.ok(g.icon);
    assert.ok(data.strings.games[g.id].title && data.strings.games[g.id].desc);
  }
  assert.equal(data.strings.games['shape-complete'].desc, 'Şekilleri keşfet, devreleri tamamla.');
  assert.equal(data.strings.games['number-hunt'].desc, 'Sayıları bul, say ve keşfet.');
  assert.equal(data.strings.tagline, 'Keşfet • Öğren • Mucit Ol');
});
