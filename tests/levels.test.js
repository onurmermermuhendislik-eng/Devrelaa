import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadData, ROOT } from './helpers.js';
import { levelFor, didLevelUp, contentFor } from '../src/core/progress.js';
import { makeCircuitRound } from '../src/games/shape-complete/circuit-rounds.js';
import { createRng } from '../src/core/rng.js';

const data = loadData();
const levels = data.levels;

test('nihai seviye sirasi: Baslangic, Cirak, Kalfa, Usta, Kasif, Mucit', () => {
  assert.deepEqual(levels.map((l) => l.name), ['Başlangıç', 'Çırak', 'Kalfa', 'Usta', 'Kaşif', 'Mucit']);
  assert.deepEqual(levels.map((l) => l.emoji), ['🌱', '🔧', '🛠️', '⭐', '🔭', '💡']);
});

test('mevcut dogru cevap esikleri korunur (0/10/30/60); planli seviyelerin esigi yok', () => {
  assert.deepEqual(levels.filter((l) => l.status === 'active').map((l) => l.min), [0, 10, 30, 60]);
  for (const l of levels.filter((l) => l.status === 'planned')) {
    assert.equal(l.min, null);
    assert.deepEqual(l.content, {}); // sahte icerik yok
  }
});

test('seviye atlama: 9->10 Cirak, 29->30 Kalfa, 59->60 Usta; Usta sonrasi planli seviyeye gecilmez', () => {
  const name = (n) => levelFor(n, levels).level.name;
  assert.deepEqual([0, 9, 10, 29, 30, 59, 60, 500].map(name), ['Başlangıç', 'Başlangıç', 'Çırak', 'Çırak', 'Kalfa', 'Kalfa', 'Usta', 'Usta']);
  assert.equal(didLevelUp(9, 10, levels).name, 'Çırak');
  assert.equal(didLevelUp(59, 60, levels).name, 'Usta');
  assert.equal(didLevelUp(60, 61, levels), null);
  assert.equal(levelFor(500, levels).next, null);
  assert.equal(levelFor(500, levels).fraction, 1);
  assert.equal(levelFor(35, levels).next.name, 'Usta');
});

test('aktif her seviyenin Sekli Tamamla icerigi var ve kademeleri benzersiz', () => {
  const tiers = levels.filter((l) => l.status === 'active').map((l) => contentFor(l, 'shape-complete')?.tier);
  assert.deepEqual(tiers, [0, 1, 2, 3]);
  assert.equal(contentFor(levels[4], 'shape-complete'), null);
});

test('her devre bolumunun sesli yonergesi var (metin + manifest anahtari)', () => {
  const rng = createRng(3);
  for (const band of ['4-5', '6-8']) {
    const n = data.circuits.stages.filter((s) => s.bands.includes(band)).length;
    for (let stage = 0; stage < n; stage++) {
      const r = makeCircuitRound({ data, rng, band, circuitState: { stage, plays: 0 } });
      assert.ok(data.strings.voice[r.voice], `${r.stageId}: ${r.voice}`);
      assert.ok(r.voice in data.manifest.voice, `manifest: ${r.voice}`);
    }
  }
  assert.ok(data.strings.voice.circuitDone && 'circuitDone' in data.manifest.voice);
});

test('marka ve ses dosyalari assets altinda mevcut', () => {
  for (const p of Object.values(data.manifest.brand)) assert.ok(existsSync(join(ROOT, p)), p);
  assert.ok(existsSync(join(ROOT, data.manifest.sounds.jingle)));
  assert.equal(data.strings.tagline, 'Keşfet • Öğren • Mucit Ol');
});
