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

`brands.mjs` builds [`collections.json`](collections.json): the brand lists AnantPlay shows, from [TMDB](https://www.themoviedb.org). `brands.json` holds them by list: a streaming service's brands (`dnp`: Disney+ > Disney, Pixar, Marvel, Star Wars, National Geographic), the film studios (`studios`: DreamWorks, Paramount, Universal...) and the children's channels (`kids`). Each brand names the TMDB companies or networks that make it up, and may have `groups`: its own queries narrowed by more TMDB parameters, a `match` on the title's name, a `kind` or `from` / `to` years (Marvel: MCU, The Infinity Saga, Avengers, X-Men...). The app shows a brand's page as rows: trending, popular and top rated (from TMDB's popularity, vote count and rating, kept per title), one row per group, animation and documentaries, then all movies and series. A GitHub Action runs it weekly with the `TMDB_KEY` repository secret; a brand that comes back with fewer than 10 titles fails the run and the old file stays.

```sh
TMDB_KEY=... node brands.mjs --check   # the names behind the ids in brands.json
TMDB_KEY=... node brands.mjs           # writes collections.json
```

## Languages

`languages.mjs` builds `languages/<Name>.json`, one file per language on AnantPlay's Movies and TV tabs (Hindi, Tamil, ...): TMDB's trending titles (popularity now) and popular ones (most votes), 20 of each, movies and series. The app shows them as the Trending and Popular rows above a language's full list. A language that has fewer than 5 titles for a row gets no row, and one that fails keeps its old file. A GitHub Action runs it weekly with the same `TMDB_KEY` secret; the first run takes about half an hour.

```sh
TMDB_KEY=... node languages.mjs          # every language
TMDB_KEY=... node languages.mjs Hindi    # one
```

This product uses the TMDB API but is not endorsed or certified by TMDB.
