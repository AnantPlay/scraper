// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES, before, row } from './languages.mjs';

test('row: every title, without the working date', () => {
  const titles = Array.from({ length: 3 }, (_, i) => ({ id: 'tt' + i, type: 'movie', name: 'T' + i, year: '2020', poster: '', tmdb: String(i), pop: 1, date: '2020-01-01' }));
  assert.equal(row(titles).length, 3);
  assert.equal('date' in row(titles)[0], false);
});

test('before: a year back, across a leap day', () => {
  assert.equal(before('2026-11-15', 365), '2025-11-15');
  assert.equal(before('2028-03-01', 1), '2028-02-29');
});

test('LANGUAGES: a two-letter code for every name', () => {
  for (const [name, code] of Object.entries(LANGUAGES)) assert.match(code, /^[a-z]{2}$/, name);
  assert.equal(LANGUAGES.Hindi, 'hi');
});
