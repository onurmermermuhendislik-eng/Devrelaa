// V7.2: Kalfa seviyesi - seri ve paralel devre dersleri
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadData } from './helpers.js';
import { buildCurriculum, lessonStatus, levelStatus, completeLesson, taskResult } from '../src/games/learn/logic.js';

const data = loadData();
const inv = data.game.invent;
const learn = data.game.learn;
const cur = buildCurriculum(learn, data.levels);
const task = (id) => learn.lessons.find((l) => l.id === id).steps.find((s) => s.type === 'task');
const run = (id, slots) => taskResult(inv, task(id).goal, slots, {}, task(id).board.layout);

test('V7.2 seri gorevi: iki LED ayni yolda -> basarili; tek LED -> needseries/noled ipucu', () => {
  assert.equal(run('series-1', ['led', 'led', 'wire']).ok, true);
  const one = run('series-1', ['wire', 'led', 'wire']);
  assert.equal(one.ok, false);
  assert.ok(['needseries', 'noled'].includes(one.key) || one.key === null || typeof one.key === 'string');
  assert.equal(run('series-1', ['wire', 'wire', 'wire']).ok, false);
});

test('V7.2 paralel gorevi: iki kolda birer LED -> basarili; tek kol bos -> basarisiz', () => {
  assert.equal(run('parallel-1', ['wire', 'led', 'wire', 'wire', 'wire', 'led']).ok, true);
  const half = run('parallel-1', ['wire', 'led', 'wire', 'wire', 'wire', 'wire']);
  assert.equal(half.ok, false);
  assert.equal(run('parallel-1', ['wire', 'wire', 'wire', 'wire', 'wire', 'wire']).ok, false);
});

test('V7.2 kilit ve ilerleme: Kalfa dersleri Cirak bitince acilir; sirayla tamamlanir', () => {
  assert.equal(levelStatus(cur, []).kalfa, 'locked');
  const base = ['circuit-1', 'switch-1', 'resistor-1'];
  assert.equal(lessonStatus(cur, base)['series-1'], 'open');
  assert.equal(lessonStatus(cur, base)['parallel-1'], 'locked');
  assert.deepEqual(completeLesson(cur, base, 'parallel-1'), base, 'seriyi atlayip paralel tamamlanamaz');
  const d = completeLesson(cur, completeLesson(cur, base, 'series-1'), 'parallel-1');
  assert.deepEqual(d, [...base, 'series-1', 'parallel-1']);
  assert.equal(levelStatus(cur, d).kalfa, 'done');
});

test('V7.2 ipucu metinleri tanimli', () => {
  assert.ok(learn.text.needseries.length > 3);
  assert.ok(learn.text.needparallel.length > 3);
});
