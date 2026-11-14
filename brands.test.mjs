// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toTitle, finish } from './brands.mjs';

test('toTitle: shape, and what is left out', () => {
  const t = toTitle('tv', { id: 85271, name: 'WandaVision', first_air_date: '2021-01-15', poster_path: '/a.jpg' }, 'tt9140560', '2026-11-14');
  assert.deepEqual(t, { id: 'tt9140560', type: 'series', name: 'WandaVision', year: '2021', poster: 'https://image.tmdb.org/t/p/w342/a.jpg', tmdb: '85271', date: '2021-01-15' });
  assert.equal(toTitle('movie', { id: 1, title: 'No id', release_date: '2020-01-01' }, '', '2026-11-14'), null);
  assert.equal(toTitle('movie', { id: 2, title: 'Not out yet', release_date: '2027-05-01' }, 'tt1', '2026-11-14'), null);
  assert.equal(toTitle('movie', { id: 3, title: 'No date' }, 'tt2', '2026-11-14'), null);
});

test('finish: each title once, newest first, no working date, and a guard for a brand that came back nearly empty', () => {
  const titles = Array.from({ length: 11 }, (_, i) => ({ id: 'tt' + i, type: 'movie', name: 'T' + i, year: String(2000 + i), poster: '', tmdb: String(i), date: `${2000 + i}-01-01` }));
  const out = finish('marvel', [...titles, titles[3], null]);
  assert.equal(out.length, 11);
  assert.deepEqual(out.slice(0, 2).map(t => t.name), ['T10', 'T9']);
  assert.equal('date' in out[0], false);
  assert.throws(() => finish('marvel', titles.slice(0, 9)), /only 9 titles/);
});
