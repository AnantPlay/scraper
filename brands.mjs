// Builds collections.json, the brand lists inside a platform (Disney+ > Marvel, Pixar...) that AnantPlay shows, from TMDB.
// Usage: TMDB_KEY=<v3 key or v4 token> node brands.mjs [out.json]   (default collections.json)
//        TMDB_KEY=... node brands.mjs --check                        prints the names behind brands.json's company / network ids
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const API = 'https://api.themoviedb.org/3', IMG = 'https://image.tmdb.org/t/p/w342';
const MIN = 10;      // fewer titles for a brand means a wrong id or a TMDB change: fail, keep the old file
const PAGES = 10;    // per query: the 200 most popular
const MIN_GROUP = 5;

const key = process.env.TMDB_KEY || '';
const wait = ms => new Promise(r => setTimeout(r, ms));
async function tmdb(path, params = {}) {
  const u = new URL(API + path);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const bearer = key.length > 40;   // a v4 token goes in a header, a v3 key in the address
  if (!bearer) u.searchParams.set('api_key', key);
  for (let i = 0; ; i++) {
    let r;
    try {
      r = await fetch(u, bearer ? { headers: { Authorization: `Bearer ${key}` } } : {});
    } catch (e) {   // a dropped connection: a few more tries before giving up
      if (i >= 5) throw e;
      await wait(1500 * (i + 1));
      continue;
    }
    if (r.status === 429 && i < 5) { await wait(2000 * (i + 1)); continue; }
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  }
}

const ANIMATION = 16;   // TMDB's genre id, the same for movies and series

/**
 * One TMDB result as the app's title; null without an IMDb id (the app keys titles by it) or before it is out.
 * `tags` are the brand's groups it belongs to (brands.json "groups": "mcu"); "animation" is added from its genres.
 */
export function toTitle(kind, item, imdb, today, tags = []) {
  const date = item.release_date || item.first_air_date || '';
  if (!imdb || !/^tt\d+$/.test(imdb) || !date || date > today) return null;
  const all = (item.genre_ids || []).includes(ANIMATION) ? [...tags, 'animation'] : tags;
  return { id: imdb, type: kind === 'tv' ? 'series' : 'movie', name: item.title || item.name || '', year: date.slice(0, 4),
    poster: item.poster_path ? IMG + item.poster_path : '', tmdb: String(item.id), ...(all.length ? { tags: all } : {}), date };
}

/**
 * The groups the app offers as chips on a brand's page: the brand's own (brands.json), then Animation. One that holds
 * fewer than MIN_GROUP titles, or nearly every title (Pixar is all animation), would be a chip that changes nothing: left out.
 */
export function groupsOf(own, titles) {
  return [...(own || []).map(g => ({ id: g.id, name: g.name })), { id: 'animation', name: 'Animation' }].filter(g => {
    const n = titles.filter(t => (t.tags || []).includes(g.id)).length;
    return n >= MIN_GROUP && n <= titles.length * 0.9;
  });
}

/** A brand's titles: each once, newest first, without the working `date`. Throws when there are too few. */
export function finish(brand, titles) {
  const seen = new Set();
  const out = titles.filter(t => t && t.name && !seen.has(t.id) && seen.add(t.id)).sort((a, b) => b.date.localeCompare(a.date));
  if (out.length < MIN) throw new Error(`${brand}: only ${out.length} titles, keeping the old file`);
  return out.map(({ date, ...t }) => t);
}

/** A discover query's results, most popular first, PAGES pages at most. */
async function* discover(kind, query) {
  const params = { ...query, sort_by: 'popularity.desc', include_adult: 'false', 'vote_count.gte': kind === 'tv' ? '10' : '30' };
  for (let page = 1; page <= PAGES; page++) {
    const d = await tmdb(`/discover/${kind}`, { ...params, page: String(page) });
    yield* d.results;
    if (page >= d.total_pages) break;
  }
}

async function build(config, old) {
  // IMDb ids found before are kept: one TMDB call per new title only
  const known = new Map();
  for (const p of Object.values((old && old.platforms) || {})) for (const b of p.brands || []) for (const t of b.titles || []) known.set(t.type + t.tmdb, t.id);
  const today = new Date().toISOString().slice(0, 10);
  const out = { platforms: {} };
  for (const [pid, p] of Object.entries(config.platforms)) {
    out.platforms[pid] = { brands: [] };
    for (const b of p.brands) {
      // A group is the brand's own queries narrowed further (MCU = Marvel's titles with TMDB's MCU keyword)
      const inGroup = new Map();   // "movie299534" > ["mcu"]
      for (const { id, name, ...extra } of b.groups || [])
        for (const { kind, match, ...query } of b.queries)
          for await (const item of discover(kind, { ...query, ...extra })) inGroup.set(kind + item.id, [...(inGroup.get(kind + item.id) || []), id]);
      const titles = [];
      // `match`: only titles whose name fits (a studio that makes more than the brand: Lucasfilm also made Indiana Jones)
      for (const { kind, match, ...query } of b.queries) {
        const fits = match ? new RegExp(match, 'i') : null;
        for await (const item of discover(kind, query)) {
          if (fits && !fits.test(item.title || item.name || '')) continue;
          let imdb = known.get((kind === 'tv' ? 'series' : 'movie') + item.id);
          if (!imdb) imdb = (await tmdb(`/${kind}/${item.id}/external_ids`)).imdb_id || '';
          titles.push(toTitle(kind, item, imdb, today, inGroup.get(kind + item.id)));
        }
      }
      const done = finish(b.id, titles);
      console.log(`${pid} ${b.id}: ${done.length} titles`);
      const groups = groupsOf(b.groups, done);
      if (groups.length) console.log(`  chips: ${groups.map(g => `${g.name} ${done.filter(t => (t.tags || []).includes(g.id)).length}`).join(', ')}`);
      out.platforms[pid].brands.push({ id: b.id, name: b.name, color: b.color, ...(groups.length ? { groups } : {}), titles: done });
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!key) { console.error('TMDB_KEY is not set'); process.exit(1); }
  const config = JSON.parse(readFileSync('brands.json', 'utf8'));
  if (process.argv[2] === '--check') {
    for (const p of Object.values(config.platforms)) for (const b of p.brands) for (const q of b.queries) {
      for (const id of (q.with_companies || '').split('|').filter(Boolean)) console.log(b.id, 'company', id, (await tmdb(`/company/${id}`)).name);
      for (const id of (q.with_networks || '').split('|').filter(Boolean)) console.log(b.id, 'network', id, (await tmdb(`/network/${id}`)).name);
    }
  } else {
    const file = process.argv[2] || 'collections.json';
    const old = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
    writeFileSync(file, JSON.stringify(await build(config, old), null, 1) + '\n');
  }
}
