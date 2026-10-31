import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorage } from '../src/core/storage.js';

const mem = (initial) => {
  const m = new Map(initial ? [['altez-minilab:v1', JSON.stringify(initial)]] : []);
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), raw: () => JSON.parse(m.get('altez-minilab:v1') || 'null') };
};
const V3 = { correct: 37, band: '6-8', sound: false, seen: true, circuit: { '4-5': { stage: 5, plays: 1 }, '6-8': { stage: 9, plays: 0 } } };

test('V3 kaydi aynen okunur; yeni oyun alani yoktur ve yazilmaz', () => {
  const b = mem(V3);
  const s = createStorage(b);
  assert.equal(s.get().correct, 37);
  assert.equal(s.get().band, '6-8');
  assert.equal(s.get().sound, false);
  assert.deepEqual(s.get().circuit['6-8'], { stage: 9, plays: 0 });
  assert.equal('games' in s.get(), false);
  assert.deepEqual(s.getGame('number-hunt'), { correct: 0 });
  s.update({ band: '4-5' });
  assert.equal('games' in b.raw(), false, 'oyun bazli kayit yalnizca ilgili oyun oynaninca yazilir');
});

test('Sayi Avi ilerlemesi ayri tutulur; Sekli Tamamla (correct) ve devre ilerlemesi degismez', () => {
  const b = mem(V3);
  const s = createStorage(b);
  s.updateGame('number-hunt', { correct: 4 });
  s.updateGame('number-hunt', { correct: 5 });
  assert.equal(s.getGame('number-hunt').correct, 5);
  assert.equal(s.get().correct, 37);
  assert.deepEqual(s.get().circuit['4-5'], { stage: 5, plays: 1 });
  // Sekli Tamamla ilerlemesi de Sayi Avi'ni etkilemez
  s.update({ correct: 38 });
  assert.equal(s.getGame('number-hunt').correct, 5);
  // yeniden aciliste korunur
  const s2 = createStorage({ getItem: b.getItem, setItem: b.setItem });
  assert.equal(s2.getGame('number-hunt').correct, 5);
  assert.equal(s2.get().correct, 38);
});

test('yeni oyun eklenmesi eski kayitlari silmez; bozuk oyun kaydi yoksayilir', () => {
  const s = createStorage(mem({ ...V3, games: { 'number-hunt': { correct: 12 }, future: { correct: 3 }, bad: { correct: -1 }, 'x y': { correct: 1 } } }));
  assert.equal(s.getGame('number-hunt').correct, 12);
  assert.equal(s.getGame('future').correct, 3, 'bilinmeyen oyunun kaydi korunur');
  assert.equal(s.getGame('bad').correct, 0);
  s.updateGame('number-hunt', { correct: 13 });
  assert.equal(s.getGame('future').correct, 3);
});

test('depolama kapaliyken (bellek) oyun ilerlemesi yine calisir', () => {
  const s = createStorage({ getItem: () => { throw new Error('kapali'); }, setItem: () => { throw new Error('dolu'); } });
  assert.equal(s.updateGame('number-hunt', { correct: 2 }).correct, 2);
});
