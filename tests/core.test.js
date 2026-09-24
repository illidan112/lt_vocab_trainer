import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProgress, addWord, dueIds, reviewWord, addDays, readProgress, writeProgress, moveToEnd, importProgress } from '../js/core.js';
const ids = new Set(['namas', 'vanduo']);
const day = '2026-12-31';
test('repeat, due dates and year boundary', () => {
  let state = addWord(emptyProgress(), 'namas', day);
  assert.deepEqual(addWord(state, 'namas', day), state);
  assert.deepEqual(dueIds(state, day, ids), ['namas']);
  state = reviewWord(state, 'namas', 1, day);
  assert.equal(state.words.namas.nextReviewDate, '2027-01-01');
  assert.deepEqual(dueIds(state, day, ids), []);
  assert.deepEqual(dueIds(state, '2027-01-02', ids), ['namas']);
  assert.equal(addDays(day, 3), '2027-01-03');
  assert.equal(addDays(day, 7), '2027-01-07');
  assert.deepEqual(dueIds(reviewWord(state, 'namas', 'learned', '2027-01-02'), '2027-01-03', ids), []);
});
test('again moves to end without duplication', () => assert.deepEqual(moveToEnd(['namas', 'vanduo'], 'namas'), ['vanduo', 'namas']));
test('storage roundtrip and malformed data handling', () => {
  let value; const storage = { getItem: () => value, setItem: (_, next) => { value = next; } };
  writeProgress(storage, addWord(emptyProgress(), 'namas', day));
  assert.equal(readProgress(storage).words.namas.nextReviewDate, day);
  value = '{broken'; assert.throws(() => readProgress(storage), /Не удалось прочитать/);
});
test('import refuses foreign words', () => assert.throws(() => importProgress({ app: 'lt-words', progress: addWord(emptyProgress(), 'unknown', day) }, ids), /нет в текущем словаре/));
