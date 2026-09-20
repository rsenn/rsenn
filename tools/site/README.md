# tools/site — one site generator for every rsenn project

Renders each project's own markdown into its GitHub Pages site
(`https://rsenn.github.io/<name>/`). Replaces the five copies of
`tools/site/` that used to live in shish, chaosircd, qjs-lws, qjs-opencv and
qjs-modules. Runs on **node** or **qjsm**, output is byte-identical.

```
tools/site/
  build.js          engine: config + project checkout -> static site
  sync.sh           build + commit + push onto a project's gh-pages branch
  new-site.sh       scaffold sites/<name>/ from templates/
  lib/markdown.js   CommonMark/GFM subset renderer (member-table anchors)
  lib/highlight.js  js / sh / c tokenizer for fenced blocks
  base/base.css     the one stylesheet: tokens, docs shell, landing, playground
  base/search.js    client-side search box (sites with `search: true`)
  templates/        what new-site.sh copies
sites/<name>/       everything specific to one project
  site.config.js    identity, nav (site map), topnav, optional features
  landing.html      hand-written landing body; <x-code lang="js"> is highlighted
  theme.css         the imprint: token overrides + a few rules
  favicon.svg
  play.html …       optional hand-written pages (config.pages)
sites.local         name=/path/to/checkout for this machine (untracked)
```

The **markdown stays in the project repo** (it is the docs); the **look and the
site map live here**. That split is the whole design: a project's docs change
with its code, a site's identity changes with taste.

## Commands

```sh
node tools/site/build.js --list                 # known sites
node tools/site/build.js shish                  # -> _site/shish/ (from sites.local)
node tools/site/build.js shish --src ~/x --out /tmp/out
python3 -m http.server -d _site 8000            # look at it

tools/site/sync.sh shish                        # build + commit in .cache/pages/shish
tools/site/sync.sh --push --all                 # ... and push every site
tools/site/new-site.sh <name> --tagline … --description … --accent '#rrggbb'
```

## site.config.js

| key | meaning |
|-----|---------|
| `repo`, `branch`, `name`, `mark`, `tagline`, `description`, `license` | identity; `mark` is the glyph before the brand name |
| `nav` | `[{group, pages: [[md source, output path, sidebar label], …]}]`. A `doc/**.md` not listed is not built; links to it fall back to a github.com blob URL |
| `topnav` | `[[label, site-relative href], …]`; a GitHub link is always appended |
| `search` | `true` emits `assets/search-index.js` (pages, headings, member-table rows) and the search box |
| `examples` | `{}` adds `examples.html` built from the checkout's `examples/` (options: `dir out title exts skip maxBytes`) |
| `pages` | hand-written extra pages `{out, body, title, cls}` (playground …); `body` is a file in the site dir |
| `files` | copied verbatim: `{src, out}` from the checkout, or `{site, out}` from the site dir; `optional: true` tolerates absence |
| `art` | logo, decoration sprites, live wallpaper, glyph-sheet font — see *Artwork* below |
| `siteLinks` | markdown link targets that stay on the site instead of going to github.com |
| `sep` | separator in `<title>`, description and footer (default `' — '`; shish uses `' | '`) |

`landing.html` placeholders: `{{NAME}} {{REPO}} {{GITHUB}} {{TAGLINE}}`.

## Theming

`base.css` defines every colour, font and shape as a custom property on `:root`
**once**, with `light-dark(light, dark)`; the header toggle pins `color-scheme`
through `[data-theme]`. A `theme.css` (loaded after base) therefore overrides a
token in a single line. Tokens: `--bg --bg-raised --bg-sunken --bg-code --fg
--fg-muted --fg-faint --line --line-strong --accent --accent-fg --accent-soft`,
syntax `--t-kw --t-str --t-num --t-cm --t-fn --t-type --t-atom --t-op --t-var
--t-pre`, type/shape `--mono --sans --font-display --font-brand
--heading-tracking --radius --w-side --w-toc --wide`.

Imprint hooks (all default to "off"): `--hero-bg` (any CSS background),
`--hero-fg`, `--topbar-bg`, `--mark-bg/--mark-fg/--mark-pad` (brand chip),
`--card-bg`, `--card-shadow`, `--h2-rule`. Beyond that, add rules — the five
existing themes each add a pseudo-element or two (`$ ` before shish headings,
`#` on chaosircd's, a `⌖` on opencv's).

Landing markup has two supported vocabularies: the two-column hero
(`.hero .eyebrow .lede .section .grid .card .split .checks .note`) and the
centred one (`.hero.hero-center .tagline .badges .cards .promise .demo .start`).

## Artwork (all optional)

A site can carry its own artwork. Every piece is a file in `sites/<name>/art/`,
named in `config.art`; leave a key out and the feature is absent. A working
example of all four is `sites/_demo/` (`node tools/site/build.js _demo`; it is
not part of `--list`/`--all`), and `new-site.sh <name> --art` starts a new site
from the same files (`tools/site/templates/art/`).

```js
art: {
  logo: 'art/logo.svg',
  decor: 'art/decor.svg',
  wallpaper: { svg: 'art/wallpaper.svg', script: 'art/wallpaper.js', pages: 'all', opacity: 0.35 },
  font: { sheet: 'art/dotmatrix.svg', cols: 16, rows: 6, cell: [8, 8], first: 32, upper: true,
          apply: ['.brand-name', '.hero h1', '.doc h1'] },
}
```

**logo.svg** is inlined in the header instead of the text `mark`, at height
`--logo-h`. Because it is inline it can use theme colours:
`style="fill:var(--accent)"`, `currentColor`. It also becomes the favicon when
the site has no `favicon.svg` — but a favicon cannot see CSS variables, so give
a logo that uses them a separate `favicon.svg`.

**decor.svg** is one file with `<symbol id viewBox>` sprites; the build turns
them into `assets/art.css`:

| id | used for | notes |
|----|----------|-------|
| `bullet` | `ul` bullets in docs, `.checks` items | ~16×16, scales with the text |
| `rule` | `hr` and the rule above landing sections | a tile repeated along x; its height is the rule's height |
| `btn` | `.btn` frame | 9-slice; `data-slice="8"` = corner size in svg units |
| `btn-primary` | `.btn.primary` frame | `data-color="#fff"` sets the label colour |

`data-tint="accent|fg|muted|faint|line"` paints a symbol in that theme colour
(only its silhouette is used, so it follows light/dark). Without `data-tint` the
symbol is used exactly as drawn, colours included. Buttons are never tinted (CSS
cannot 9-slice a mask), so draw them in real colours.

**wallpaper.svg** is ONE svg whose `<g id="…">` groups the script animates. It
is inlined behind the page (`position: fixed`, `preserveAspectRatio="slice"`,
`aria-hidden`), so shapes may use CSS variables and follow the theme. `pages`
is `'all'`, `'landing'` or `'docs'`; `--wallpaper-opacity` and
`--wallpaper-veil` (how opaque the reading column stays over it) are tokens a
theme can set. The `viewBox` is required.

**wallpaper.js** is a classic script that calls `Wallpaper.register(ctx => …)`.
`ctx`: `svg`, `groups`, `width`/`height`, `reduced`, `bounds()` (the part of the
viewBox on screen), `rand()` (seeded, reproducible), `css(name)`,
`frame((timeMs, dtSeconds) => …)` (paused in hidden tabs, called once under
`prefers-reduced-motion`). The example moves every child of `<g class="shapes">`:
neighbours attract, overlapping shapes merge (areas add), oversized ones burst,
absorbed ones respawn at the edge. Without a script the wallpaper is a still
picture.

**Raster artwork.** Not everything has to be SVG. `art.logo` may be a `.png`/`.webp`
(shown with `<img>`; then also give the site a `favicon.svg`). `art.assets:
['art/sprites']` copies a folder of images to `assets/sprites/`, and inside
`wallpaper.svg` (and `{{svg:…}}` inlines) a `href="@/assets/sprites/x.png"` means
"site root", so sprites work at any page depth. A wallpaper can therefore be
built from transparent PNG characters (`<image>` elements) animated by the same
script API; see `sites/shish/_mascots/` (retired shish artwork: sprites cut out of AI-generated concept
sheets by `make-sprites.py`, which flood-fills the paper colour from each crop
box and keeps the outlined shapes). `data-tint` also accepts any custom
property, e.g. `data-tint="--teal"`. In `landing.html`, `{{svg:art/foo.svg}}`
inlines an illustration from the site dir.

**font.sheet** is a glyph sheet: one equal cell per character, in code order from
`first`, `cols` per row, drawn as **transparent background + opaque glyphs**
(the site paints them with CSS `mask` in the text colour). SVG or PNG. For an
SVG the `cell` size is derived from its `viewBox`; for a PNG give `cell: [w, h]`.
`upper: true` folds lower case onto upper case for all-caps fonts. `apply` lists
the CSS selectors to draw with it (default: brand name, hero title, doc titles).
It is a progressive enhancement: the text stays real text (`aria-label`, search,
copy) and is only swapped for glyphs once the sheet has loaded; characters
outside the sheet stay ordinary text. Glyph height is `1em`, so change
`font-size` on a selector to scale it. `templates/art/make-dotfont.py` renders a
Linux console (PSF) font as a dot-matrix sheet; the demo sheet is such a
placeholder.

## Publishing model

`gh-pages` of each project holds **generated output only**. So it is never
merged: `sync.sh` keeps a private clone per site in `.cache/pages/`, resets it to
`origin/gh-pages`, empties it, builds into it, and commits on top of the remote
history. The push is a plain fast-forward (never `--force`), so a concurrent
change to the branch fails loudly instead of being overwritten.

**Old publishers must be retired first.** qjs-opencv and qjs-modules have
`.github/workflows/pages.yml`, which force-pushes an orphan `gh-pages` on every
docs change — it would replace the themed site. shish and chaosircd have
`tools/site/publish.sh`; qjs-lws is published by hand. Remove those (and the old
`tools/site/` copies) in each project when its site is switched over.

## Known gaps

- The project checkout is read from its working tree, not from `origin/main`;
  `sync.sh` records the sha and `+dirty` in the commit message.
- `sites/qjs-lws/check-examples.js` is qjs-lws-specific (it checks imports
  against the built `lws.so`); it is kept for reference and not wired up.
- Old shish/chaosircd stylesheets referenced `.t-keyword`/`.t-string`, but the
  highlighter emits `.t-kw`/`.t-str`, so their code blocks were never coloured.
  `base.css` styles both names.
