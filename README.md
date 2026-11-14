# AnantPlay scraper

Turns the FREE-MEDIA streaming lists (the video page and the non-English page) into [`sites.json`](sites.json), the **sites** source that [AnantPlay](https://github.com/AnantPlay/android) reads. A GitHub Action runs it every 12 hours and commits the file when it changed.

- Rows: `movies`, `tv`, `sports`, `anime`, `live`, `more`, decided from each site's section and tags. In each row the lists' picks come first, then the rest, then lists of more sites.
- Languages: the streaming sites of each language on the non-English page.
- When a run finds fewer than 50 sites (the lists changed their format), it fails and the last good `sites.json` stays.

```sh
node --test          # tests
node scrape.mjs      # writes sites.json
```

Node 20 or newer, no dependencies. The site lists belong to their maintainers; this repository only reshapes them.

`extra.json` adds hand-picked sites on top of the lists (`{"rows": {"anime": [site, ...]}}`): a site already in a row takes the extra's fields (`"pick": true` moves it to the top), a new one is added.

## Brands

`brands.mjs` builds [`collections.json`](collections.json): the brand lists AnantPlay shows inside a platform (Disney+ > Disney, Pixar, Marvel, Star Wars, National Geographic), from [TMDB](https://www.themoviedb.org). `brands.json` says which TMDB companies, networks and keywords make up each brand. A GitHub Action runs it weekly with the `TMDB_KEY` repository secret; a brand that comes back with fewer than 10 titles fails the run and the old file stays. A brand's `groups` (Marvel: MCU, by TMDB keyword) and animated titles are tagged, and the app shows them as chips on the brand's page.

```sh
TMDB_KEY=... node brands.mjs --check   # the names behind the ids in brands.json
TMDB_KEY=... node brands.mjs           # writes collections.json
```

This product uses the TMDB API but is not endorsed or certified by TMDB.
