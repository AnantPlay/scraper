// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, row, since } from './languages.mjs';

test('row: no working date, and nothing when too few titles', () => {
  const titles = Array.from({ length: 5 }, (_, i) => ({ id: 'tt' + i, type: 'movie', name: 'T' + i, year: '2020', poster: '', tmdb: String(i), pop: 1, date: '2020-01-01' }));
  assert.equal(row(titles).length, 5);
  assert.equal('date' in row(titles)[0], false);
  assert.deepEqual(row(titles.slice(0, 4)), []);
});

test('LANGUAGES: a two-letter code for every name', () => {
  for (const [name, code] of Object.entries(LANGUAGES)) assert.match(code, /^[a-z]{2}$/, name);
  assert.equal(LANGUAGES.Hindi, 'hi');
});

test('since: months back, across a year end', () => {
  assert.equal(since('2026-11-15', 18), '2025-05-15');
  assert.equal(since('2026-01-31', 3), '2025-10-31');
});
