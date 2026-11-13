// Turns the FREE-MEDIA streaming lists into sites.json, the "sites" source AnantPlay reads.
// Usage: node scrape.mjs [out.json]   (default sites.json). Exits 1 and writes nothing when the result looks wrong.
import { writeFileSync } from 'node:fs';

const LISTS = 'https://raw.githubusercontent.com/fmhy/edit/main/docs';
const MIN_SITES = 50;   // fewer means the lists changed their format: keep the last good file

// "* ⭐ **[Name](url)**, [2](url) - tags" (a pick), "* 🌟 ..." (also a pick), "* 🌐 ..." (a list of more sites) or plain "* [Name](url) - tags"
const ENTRY = /^\*\s*(⭐|🌟|🌐)?\s*(?:\*\*)?\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)(?:\*\*)?(.*)$/u;
const ANY_LINK = /\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g;
const LINK = /\[[^\]]*\]\([^)]*\)/g;
// The lists' own pages, wikis and GitHub/Telegram/Discord links are references, not sites to watch on
const INTERNAL = /^https?:\/\/(?:www\.)?(?:reddit\.com\/r\/freemediaheckyeah|fmhy\.|rentry\.(?:co|org)\/fmhy|github\.com|raw\.githubusercontent\.com|gist\.github\.com|t\.me\/|discord\.gg)/i;
const heading = line => line.replace(/^[#\s►▷]+/u, '').trim();

// Row keys in display order; the app owns their labels
export const ROWS = ['movies', 'tv', 'sports', 'anime', 'live', 'more'];
const SPORT = /(sport|football|motorsport|mma|wrestling|boxing|basketball|baseball|live event)/;

/** Which rows a site belongs in, from its section in the lists and its own tags. */
export function rowsOf(section, tags) {
  const out = [];
  const add = r => { if (!out.includes(r)) out.push(r); };
  switch (section) {
    case 'Anime Streaming': return ['anime'];
    case 'Live Sports': case 'Sports Replays': return ['sports'];
    case 'Stream Lounges': case 'Specialty Streaming': return ['more'];
    // "TV" on a live-channel site means channels, not shows: keep them in Live TV (and Sports if tagged)
    case 'Live TV':
      out.push('live');
      for (const t of tags) if (SPORT.test(t.toLowerCase())) add('sports');
      return out;
    case 'Cartoon Streaming': case 'Drama Streaming': case 'TV Streaming': out.push('tv'); break;
    case 'Stream Aggregators': case 'P-Stream Forks': case 'Dedicated-Server': case 'Multi-Server':
    case 'Video Streaming': case 'Free w/ Ads': case 'Classics / Public Domain': case 'Film Archives': break;
    default: return out;   // not a streaming section
  }
  for (const raw of tags) {
    const t = raw.toLowerCase();
    if (/(movie|film)/.test(t)) add('movies');
    if (/(\btv\b|shows?|series|cartoon|drama)/.test(t)) add('tv');
    if (/(anime|donghua)/.test(t)) add('anime');
    if (SPORT.test(t)) add('sports');
  }
  if (!out.length) {
    switch (section) {
      // The tags here are only quality / feature words (4K, Dual Audio), but every site in these sections plays movies and TV
      case 'Stream Aggregators': case 'P-Stream Forks': case 'Dedicated-Server': case 'Multi-Server': return ['movies', 'tv'];
      case 'Classics / Public Domain': case 'Film Archives': case 'Video Streaming': return ['movies'];
      default: return ['more'];
    }
  }
  return out;
}

/** One list line to a site, or null when it isn't a site entry. */
export function entry(line, group) {
  const m = ENTRY.exec(line.trim());
  if (!m || INTERNAL.test(m[3])) return null;
  const index = m[1] === '🌐';
  const rest = m[4], dash = rest.indexOf(' - ');
  // Everything before " - " is the site plus its mirrors; after it come tags and Discord/GitHub links
  const head = dash >= 0 ? rest.slice(0, dash) : rest, tail = dash >= 0 ? rest.slice(dash + 3) : '';
  const mirrors = [...head.matchAll(ANY_LINK)].map(x => x[1]).filter(u => !INTERNAL.test(u) && u !== m[3]);
  const tags = tail.replace(LINK, '').split('/').map(t => t.replace(/[*_`]/g, '').trim()).filter(t => t && t !== ',' && t !== '↪️');
  return { name: m[2].replace(/[⁠​]/g, '').trim(), url: m[3], mirrors, tags, group, pick: !!m[1] && !index, index };
}

// Picks first, then the rest, then lists of more sites; the page's own order inside each group
const ordered = list => [...list.filter(s => s.pick), ...list.filter(s => !s.pick && !s.index), ...list.filter(s => s.index)];

/** The video page: row key to its sites. */
export function parseRows(md) {
  const out = Object.fromEntries(ROWS.map(r => [r, []]));
  let section = '';
  for (const line of md.split('\n')) {
    if (line.startsWith('#')) { section = heading(line); continue; }
    const s = entry(line, section);
    if (!s) continue;
    for (const r of rowsOf(section, s.tags)) if (!out[r].some(x => x.url === s.url)) out[r].push(s);
  }
  for (const r of ROWS) out[r] = ordered(out[r]);
  return out;
}

/** The non-English page: language to its streaming sites ("# ► Spanish / Español" > "## ▷ Streaming"). */
export function parseLanguages(md) {
  const out = {};
  let lang = null, streaming = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('# ')) { lang = heading(line).split(' / ')[0].trim(); streaming = false; }
    else if (line.startsWith('#')) streaming = heading(line).toLowerCase().startsWith('streaming');
    else if (lang && streaming) {
      const s = entry(line, lang);
      if (!s) continue;
      (out[lang] ||= []);
      if (!out[lang].some(x => x.url === s.url)) out[lang].push(s);
    }
  }
  for (const l in out) out[l] = ordered(out[l]);
  return out;
}

async function get(page, mustContain) {
  const r = await fetch(`${LISTS}/${page}`);
  const text = r.ok ? await r.text() : '';
  if (!text.includes(mustContain)) throw new Error(`${page}: unexpected content (HTTP ${r.status})`);
  return text;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || 'sites.json';
  const rows = parseRows(await get('video.md', 'Streaming Sites'));
  const languages = parseLanguages(await get('non-english.md', '► '));
  const count = new Set(Object.values(rows).flat().map(s => s.url)).size;
  if (count < MIN_SITES) { console.error(`only ${count} sites found, keeping the old file`); process.exit(1); }
  writeFileSync(out, JSON.stringify({ rows, languages }, null, 1) + '\n');
  console.log(`${out}: ${count} sites in rows, ${Object.keys(languages).length} languages`);
}
