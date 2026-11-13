// node --test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowsOf, entry, parseRows, parseLanguages } from './scrape.mjs';

test('rows from section and tags', () => {
  const cases = [
    ['aggregator movies tv anime', 'Stream Aggregators', ['Movies', 'TV', 'Anime', 'Auto-Next'], ['movies', 'tv', 'anime']],
    ['p-stream fork', 'P-Stream Forks', ['Movies', 'TV', 'Anime', 'Auto-Next', '4K'], ['movies', 'tv', 'anime']],
    ['multi-server movies only', 'Multi-Server', ['Movies', 'Auto-Next'], ['movies']],
    ['free with ads', 'Free w/ Ads', ['Movies', 'TV', '720p'], ['movies', 'tv']],
    ['anime section ignores tags', 'Anime Streaming', ['Sub', 'Dub'], ['anime']],
    ['live sports', 'Live Sports', ['Live Events'], ['sports']],
    ['sports replays', 'Sports Replays', ['Football Replays'], ['sports']],
    ['live tv with sports', 'Live TV', ['TV', 'Sports', 'Aggregator'], ['live', 'sports']],
    ['live tv channels', 'Live TV', ['TV Channel Index'], ['live']],
    ['cartoon site', 'Cartoon Streaming', ['TV', 'Movies', 'Anime'], ['tv', 'movies', 'anime']],
    ['tv streaming', 'TV Streaming', ['TV', '3rd Party Hosts'], ['tv']],
    ['drama', 'Drama Streaming', ['TV', 'Movies'], ['tv', 'movies']],
    ['classics', 'Classics / Public Domain', ['Classic Films'], ['movies']],
    ['film archive no tags', 'Film Archives', [], ['movies']],
    ['lounge', 'Stream Lounges', ['TV'], ['more']],
    ['aggregator no tags', 'Stream Aggregators', [], ['movies', 'tv']],
    ['aggregator feature tags', 'Stream Aggregators', ['4K', 'Dual Audio', 'External Subs', 'Ad-Toggle'], ['movies', 'tv']],
    ['p-stream fork feature tags', 'P-Stream Forks', ['1080p', 'Dual Audio'], ['movies', 'tv']],
    ['dedicated server feature tags', 'Dedicated-Server', ['1080p', 'Popup + Redirect Free'], ['movies', 'tv']],
    ['multi-server source count', 'Multi-Server', ['11 Sources', 'Popup + Redirect Free'], ['movies', 'tv']],
    ['aggregator anime only', 'Stream Aggregators', ['Anime', '4K'], ['anime']],
    ['free with ads no tags stays more', 'Free w/ Ads', ['US Only'], ['more']],
    ['download section ignored', 'Download Sites', ['Movies'], []],
  ];
  for (const [name, section, tags, want] of cases) assert.deepEqual(rowsOf(section, tags), want, name);
});

test('entry: pick, mirrors, tags, internal links dropped', () => {
  const s = entry('* ⭐ **[Movy](https://movy.example)**, [2](https://movy2.example), [GitHub](https://github.com/x) - Movies / TV / [Discord](https://discord.gg/x)', 'Multi-Server');
  assert.equal(s.name, 'Movy');
  assert.equal(s.url, 'https://movy.example');
  assert.deepEqual(s.mirrors, ['https://movy2.example']);
  assert.deepEqual(s.tags, ['Movies', 'TV']);
  assert.equal(s.pick, true);
  assert.equal(s.index, false);
  assert.equal(entry('* [Wiki](https://github.com/x/y) - Guide', 'x'), null);
  assert.equal(entry('Some text', 'x'), null);
  assert.equal(entry('* 🌐 **[More Sites](https://index.example)**', 'x').index, true);
});

test('parseRows orders picks, rest, then index lists, and dedupes', () => {
  const md = [
    '# ► Streaming Sites', '## ▷ Multi-Server',
    '* 🌐 **[List](https://list.example)** - Movies',
    '* [Plain](https://plain.example) - Movies',
    '* ⭐ **[Star](https://star.example)** - Movies / TV',
    '* [Plain again](https://plain.example) - Movies',
  ].join('\n');
  const rows = parseRows(md);
  assert.deepEqual(rows.movies.map(s => s.name), ['Star', 'Plain', 'List']);
  assert.deepEqual(rows.tv.map(s => s.name), ['Star']);
  assert.deepEqual(rows.more, []);
});

test('parseLanguages keeps only Streaming subsections', () => {
  const md = [
    '# ► Spanish / Español', '## ▷ Downloading', '* [Dl](https://dl.example) - Movies',
    '## ▷ Streaming', '* [Es](https://es.example) - Movies', '* ⭐ [EsPick](https://espick.example) - TV',
    '# ► Hindi / हिन्दी', '## ▷ Streaming Sites', '* [Hi](https://hi.example)',
  ].join('\n');
  const l = parseLanguages(md);
  assert.deepEqual(Object.keys(l), ['Spanish', 'Hindi']);
  assert.deepEqual(l.Spanish.map(s => s.name), ['EsPick', 'Es']);
  assert.equal(l.Hindi[0].group, 'Hindi');
});
