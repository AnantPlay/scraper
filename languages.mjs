// Builds languages/<Name>.json: for each language AnantPlay lists on its Movies and TV tabs, TMDB's new titles (newest release first, whatever
// their popularity) and its popular ones (most votes), movies and series. The app shows them as rows above the language's full list.
// Usage: TMDB_KEY=<v3 key or v4 token> node languages.mjs [Name ...]   (every language without names; one file each, the old one stays on a failure)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { discover, tmdb, toTitle } from './brands.mjs';

// The names the app's language lists use > TMDB's original_language
export const LANGUAGES = {
  Hindi: 'hi', Tamil: 'ta', Telugu: 'te', Malayalam: 'ml', Kannada: 'kn', Bengali: 'bn', Marathi: 'mr', Punjabi: 'pa', Urdu: 'ur', Sinhalese: 'si',
  Nepali: 'ne', Japanese: 'ja', Korean: 'ko', Mandarin: 'zh', Malay: 'ms', Thai: 'th', Vietnamese: 'vi', Indonesian: 'id', Tagalog: 'tl',
  Turkish: 'tr', Persian: 'fa', Hebrew: 'he', Arabic: 'ar', Kurdish: 'ku', Russian: 'ru', Ukrainian: 'uk', Belarusian: 'be', Kazakh: 'kk',
  Uzbek: 'uz', Georgian: 'ka', Armenian: 'hy', Polish: 'pl', Czech: 'cs', Slovak: 'sk', Hungarian: 'hu', Romanian: 'ro', Bulgarian: 'bg',
  Greek: 'el', Serbian: 'sr', Croatian: 'hr', Slovenian: 'sl', Albanian: 'sq', German: 'de', French: 'fr', Italian: 'it', Dutch: 'nl',
  Spanish: 'es', Catalan: 'ca', Portuguese: 'pt', Swedish: 'sv', Norwegian: 'no', Danish: 'da', Finnish: 'fi', Estonian: 'et', Latvian: 'lv',
  Lithuanian: 'lt', Afrikaans: 'af', Zulu: 'zu', Swahili: 'sw', Somali: 'so', English: 'en', Irish: 'ga',
};
// Nothing is hidden: New is every release of the last year, Popular the 100 most voted for; the app shows 15 of a row and More opens all of it.
// What is left out: films under an hour (shorts) and titles TMDB has no IMDb id for (the app's title pages are built on it).
const POPULAR_TOP = 100;
const NEW_DAYS = 365;

/** A row as the app reads it: the titles without the working `date`. */
export function row(titles) {
  return titles.map(({ date, ...t }) => t);
}

/** The date `days` before `today` ("2026-11-15"). */
export function before(today, days) {
  return new Date(Date.parse(today + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);
}

async function build(code, old, today) {
  // IMDb ids found before are kept: one TMDB call per new title only
  const known = new Map();
  for (const rows of Object.values(old || {})) for (const list of Object.values(rows)) for (const t of list) known.set(t.type + t.tmdb, t.id);
  async function collect(kind, type, query, top = Infinity) {
    const titles = [];
    for await (const item of discover(kind, { with_original_language: code, ...query }, top === Infinity ? 100 : Math.ceil(top / 20) * 2)) {
      if (titles.length >= top) break;
      let imdb = known.get(type + item.id);
      if (!imdb) imdb = (await tmdb(`/${kind}/${item.id}/external_ids`)).imdb_id || '';
      const t = toTitle(kind, item, imdb, today);   // one with no poster gets the app's letter tile
      if (t) titles.push(t);
    }
    return titles;
  }
  const out = {};
  for (const [kind, type] of [['movie', 'movie'], ['tv', 'series']]) {
    out[type] = { popular: row(await collect(kind, type, { sort_by: 'vote_count.desc' }, POPULAR_TOP)) };
    // New: every release of the last year, newest first, whatever its votes (a film just out has none yet); films of an hour or more
    const date = kind === 'movie' ? 'primary_release_date' : 'first_air_date';
    const fresh = await collect(kind, type, { sort_by: date + '.desc', [date + '.lte']: today, [date + '.gte']: before(today, NEW_DAYS), 'vote_count.gte': '0',
      ...(kind === 'movie' ? { 'with_runtime.gte': '60' } : {}) });
    out[type].new = row(fresh.sort((a, b) => b.date.localeCompare(a.date)));
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.TMDB_KEY) { console.error('TMDB_KEY is not set'); process.exit(1); }
  const names = process.argv.length > 2 ? process.argv.slice(2) : Object.keys(LANGUAGES);
  const today = new Date().toISOString().slice(0, 10);
  mkdirSync('languages', { recursive: true });
  let written = 0;
  for (const name of names) {
    if (!LANGUAGES[name]) { console.error(`${name}: not a language of the table`); process.exit(1); }
    const file = `languages/${name}.json`;
    try {
      const data = await build(LANGUAGES[name], existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null, today);
      const sizes = Object.entries(data).map(([type, rows]) => Object.entries(rows).map(([r, l]) => `${type} ${r} ${l.length}`)).flat();
      if (!sizes.some(s => !s.endsWith(' 0'))) { console.log(`${name}: nothing to show`); continue; }
      writeFileSync(file, JSON.stringify(data) + '\n');
      written++;
      console.log(`${name}: ${sizes.join(', ')}`);
    } catch (e) {   // this language keeps its old file; the run only fails when none could be written
      console.error(`${name}: ${e.message}`);
    }
  }
  if (!written) process.exit(1);
}
