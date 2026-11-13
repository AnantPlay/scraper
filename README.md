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
