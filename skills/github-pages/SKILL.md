---
name: github-pages
description: Build, restyle and publish the GitHub Pages sites of rsenn's projects (https://github.com/rsenn) with the shared generator in the rsenn/rsenn repo (tools/site, sites/<name>). Use when creating a landing page, documentation, examples page or playground for a project from scratch, editing or re-theming an existing site (shish, chaosircd, qjs-lws, qjs-opencv, qjs-modules), adding a doc page to a site's nav, or syncing/publishing a site to a project's gh-pages branch.
---

# GitHub Pages for rsenn projects

All sites are produced by **one generator** that lives in the `rsenn/rsenn` repo
(the GitHub profile repo; locally `~/Projects/rsenn/rsenn`). Never copy a
`tools/site/` into a project again — that is exactly the fork-per-project mess
this replaced.

- **Docs markdown stays in the project repo** (`README.md`, `doc/**`, `examples/`).
- **Site identity lives in `rsenn/rsenn/sites/<name>/`**: `site.config.js`
  (identity + site map), `landing.html`, `theme.css`, `favicon.svg`, optional
  `play.html`.
- **Engine, renderer, highlighter, base stylesheet** in `rsenn/rsenn/tools/site/`.
  Read `tools/site/README.md` there first — it is the reference for config keys,
  theme tokens and the publishing model; do not duplicate it here.
- **Output** goes to each project's `gh-pages` branch, which holds generated
  files only. It is synced by build-and-commit (`tools/site/sync.sh`), **never
  merged**: merging generated HTML conflicts on every file for no benefit.

Machine-specific checkout paths are in `rsenn/rsenn/sites.local` (`name=path`,
untracked). If a project is missing there, add it before anything else.

## Commands (run from the rsenn/rsenn checkout)

```sh
node tools/site/build.js <site>                 # -> _site/<site>/
python3 -m http.server -d _site 8765            # preview (background it)
tools/site/sync.sh <site>                       # commit into .cache/pages/<site>, no push
tools/site/sync.sh --push <site>                # publish
tools/site/new-site.sh <name> --tagline … --description … --accent '#rrggbb'
```

`qjsm tools/site/build.js …` gives identical output if node is unavailable.

## Outward-facing steps need explicit confirmation

`sync.sh --push`, removing a project's old workflow/`tools/site`, enabling Pages
in a repo's settings and committing to a *project* repo all publish or alter
things beyond this checkout. Do the build, the local preview and the unpushed
sync freely; **show the user `git -C .cache/pages/<site> show --stat` and ask
before each push or edit of another repo**, every time — an earlier approval
does not cover the next one.

## Procedure A — a new project, from the ground up

Work through these steps **interactively**: ask the questions of a step (use
AskUserQuestion when there are discrete options), show a result, get a nod, then
go on. Do not write a whole site from guesses. Read the project first (README,
`doc/`, `examples/`, build files, license) so questions are informed and each
comes with a recommendation.

1. **Reconnaissance (no questions yet).** Read the project's README, doc tree,
   examples, license, language, build system, whether it can run in a browser.
   Summarise in five lines: what it is, who it's for, what exists (docs /
   examples), what is missing, whether a playground is feasible.
2. **Identity.** Confirm: site `name` (= repo name), `repo`, one-line `tagline`
   (what it *is*, not marketing), `mark` (2–3 glyph brand chip: `$_`, `#`,
   `{ }`), license string. Offer 2–3 tagline candidates drawn from the README.
3. **Scope.** Which of the four pieces to build now: *landing*, *docs*,
   *examples*, *playground*. Recommend by what already exists: landing + docs
   always; examples if `examples/` has runnable, commented files; playground
   only if step 1 found a real path (see step 8).
4. **Docs and site map.** List candidate `.md` files; propose `nav` groups
   ("Start here", "Reference", "Recipes"…) with output paths under `docs/`.
   `README.md` → `getting-started.html`. Flag docs that reference local paths or
   an upstream project (leave them out, and say so in a comment as qjs-opencv's
   config does). Docs that are thin → say what is missing rather than padding.
   If the project has >15 pages turn on `search: true`; if its reference is
   member tables (`| Method | … |`), the renderer already gives each row an
   anchor and search entry.
5. **Scaffold.** Run `new-site.sh`, add the `sites.local` line, paste the nav
   into `site.config.js`, build. Verify: every nav page produced, no `github.com`
   fallback for a doc that *should* be on the site (`grep -o 'github.com/[^"]*/blob' `
   over the output for links to `.md` files), then preview.
6. **Landing page.** Draft with the user, in this order: hero (headline that
   states the concrete benefit + one 6–12 line sample that actually runs),
   3 cards (real differentiators, each backed by a fact from the repo: size,
   speed, dependency count, a feature the alternatives lack), a "why it exists"
   or numbers strip if there is a true story/number, install/build steps, links.
   Facts must come from the repo, not invention — measure or grep before
   claiming a size or count. Use `<x-code lang="js|sh|c">` for samples so they are
   highlighted; use `{{NAME}} {{GITHUB}} {{TAGLINE}}` placeholders.
   If the project has JS examples, verify the landing sample parses/runs.
7. **Examples.** Either `examples: {}` in the config (auto page from `examples/`;
   the first comment block of each file becomes its description — so tell the
   user which example files lack a leading comment, and offer to add one) or a
   curated doc page. Skip `models/`, data dirs, files >48 KB (defaults).
8. **Playground** (only if agreed). Pick the mechanism *with* the user:
   - *WASM build of the project* (shish model): emscripten output copied in via
     `files`, a hand-written `play.html`, and `pages: [{out:'play.html', …, cls:'play'}]`.
     Reference implementation: `sites/shish/play.html`. Everything runs in the
     tab; say so on the page.
   - *Pure-JS library*: a `<textarea>` + a `new Function`/module `import()` of a
     bundled build; keep it to the pure-JS surface.
   - *Native-only project* (chaosircd, qjs-lws): no live playground. Offer a
     recorded-session page (pre-rendered transcript in `.codeblock`s) instead of
     faking one.
   Playground CSS classes exist in base.css (`.play .playgrid .playcol .playsrc
   .term .playbar .playtabs`); reuse them.
9. **Imprint (style + artwork).** Go to Procedure B for the project's look, and B2 if the user has (or wants to make) a logo, decoration, live wallpaper or dot font.
10. **Review.** Build, serve, screenshot landing + one long doc page + one table
    page at desktop and phone width, light and dark (toggle the header button or
    set `data-theme`). Check: contrast of the accent as link text, code blocks
    coloured, sidebar/TOC not overflowing, long tables scroll inside `.tablewrap`.
11. **Publish.** `sync.sh <site>` (unpushed), show the stat, get a yes, then
    `--push`. Then, with confirmation, in the *project* repo: remove the old
    `tools/site/`, any `pages.yml`/`publish.sh` publisher (they force-push
    gh-pages and would overwrite the sync), point its README at the site, and
    make sure Settings → Pages serves `gh-pages` / root. First-time projects
    have no `gh-pages` branch: create an orphan branch with an empty commit and
    push it once, then use sync.sh.

## Procedure B — imprint a look on a site

Goal: each site is recognisably itself, while structure, accessibility and
behaviour stay shared. **Only `sites/<name>/theme.css` (plus favicon and landing
markup) differ.** Change `tools/site/base/base.css` only for a fix or a new hook
that helps *every* site, and rebuild all sites after (`for s in $(node tools/site/build.js --list)`).

1. **Find the concept.** Ask what the project *feels* like (terminal? network?
   vision? library shelf?) and pick one motif to express it: a glyph
   (`$ `, `#`, `⌖`), a background pattern (`--hero-bg`: scanlines, dots, grid,
   tiles), a shape language (`--radius`), a type stance (`--font-display: var(--mono)`).
   One motif done well beats five. Keep each site's hue distinct from the others
   (current accents: shish orange `#b4531f`, chaosircd violet `#5b3fa0`,
   qjs-lws teal `#0b7c72`, qjs-opencv blue `#1d63c9`, qjs-modules rose `#b0286b`);
   check `sites/*/theme.css` before choosing.
2. **Tokens first.** Override `--accent/--accent-fg/--accent-soft`, then tint the
   neutrals (`--bg … --line-strong`) a few percent toward the hue, then the
   syntax tokens that clash with it. Always as `light-dark(light, dark)` — one
   line per token, both modes.
3. **Hooks, then rules.** Use the imprint hooks before writing selectors; add
   pseudo-element/decorative rules last, small, and never on things that carry
   information. Respect `prefers-reduced-motion` for any animation.
4. **Favicon** in the accent colour, matching the `mark`.
5. **Verify in a real browser** (claude-in-chrome: `resize_window` to 1280×800
   first, then screenshots of landing and a doc page, dark and light). Contrast:
   accent on `--bg` as link text ≥ 4.5:1 in both modes; `--accent-fg` on
   `--accent` for buttons likewise.
6. Show the user before/after; iterate on their reaction, not on your own taste.

## Procedure B2 — artwork (logo, decoration, live wallpaper, dot font)

All optional, all in `sites/<name>/art/`, wired by `config.art`; the file
contracts (symbol ids, `data-tint`, `Wallpaper.register` API, glyph-sheet layout)
are in `tools/site/README.md` → "Artwork". A complete working example is
`sites/_demo/` (`node tools/site/build.js _demo`); `new-site.sh <name> --art`
copies it as a starting point. The artwork is the user's own work: **ask them
for the files** rather than inventing final art, and use the demo files only as
placeholders (say so). When they hand files over, check before building:

- logo: has `viewBox`; if it uses `var(--accent)` it needs a separate `favicon.svg`
- decor: each `<symbol>` has `id` + `viewBox`; single-colour art gets `data-tint`,
  buttons are drawn in real colours with `data-slice`
- wallpaper.svg: `viewBox` present, shapes in *groups with ids*; colours via
  `style="fill:var(--accent)"` so both modes work; keep opacity low enough that
  body text stays readable (`--wallpaper-opacity`, `--wallpaper-veil` in theme.css)
- wallpaper.js: only the documented `ctx` API; must be cheap per frame; must
  render a sensible still frame when `ctx.reduced`
- font sheet: transparent background, opaque glyphs, equal cells, code order from
  `first`; ask if it is caps-only (`upper`) and what `cols`/`rows`/cell size are

Preview needs a *foreground* tab for animation (background tabs pause the loop by
design); to test the script logic headlessly, drive its `frame` callback by hand.

## Planned, NOT implemented yet: `autonav` and `--check`

Status: **postponed by the user. Neither exists in `build.js`.** Today every page
must be listed in `nav` by hand; do not claim otherwise, and do not add either
feature unless the user asks. This section is the agreed design, so that when
asked it is built exactly this way.

**Problem.** A `.md` file missing from `nav` is silently not built, and links to
it fall back to github.com. Unlisted today: shish `doc/wasm-playground-plan.md`;
qjs-opencv `doc/vector-arguments.md`, `migration-opencv5.md`, `next-3-todos.md`
(and the deliberately excluded `doc/opencv-js-*.md`); qjs-modules `doc/js/sql.md`,
`doc/native/sqlite.md`, `stream-utils.md`, `ASSESSMENT.md`, `inspect-compacting.md`.

**Config** (per site, off unless present):

```js
autonav: {
  group: 'More',                       // sidebar group appended after `nav`
  roots: ['doc'],                      // directories scanned recursively for *.md
  files: [],                           // extra single files, e.g. ['ChangeLog.md']
  out: 'docs/',                        // doc/a/b.md -> docs/a/b.html
  exclude: ['CLAUDE.md', 'TODO.md', 'doc/opencv-js-*.md'],   // globs, relative to --src
}
```

**Discovery** (one function in `build.js`, run right after `NAV` is copied from
the config and before `PAGES` is computed, so links, sidebar, search index and
the edit link all treat these pages like listed ones):

1. list `*.md` under each of `roots` (skip `node_modules`, `build`, `.git`,
   `_site`), plus `files`; sort by path so output is stable
2. drop anything already a source in `nav`, anything matching `exclude`
   (`*` = within a path segment, `**` = across segments), and empty files
3. `out`: the path under its root prefixed with `out`, `.md` -> `.html`
   (`doc/` -> `docs/`; a file directly in the project root -> `<name>.html`,
   lower-cased); a `README.md` in a subdirectory becomes that directory's
   `index.html`
4. if a computed `out` equals an existing page's `out`, skip it and print
   `warning: autonav: <src> would overwrite <out>` — never overwrite
5. label = first ATX `# ` heading with backticks stripped, else the file name
6. append one group `{ group, pages: [[src, out, label], …] }` to `NAV`

Explicit `nav` always wins on order and grouping; autonav only fills the rest.

**`--check`** (new flag on `build.js`, builds nothing):

```
node tools/site/build.js <site> --check
```

Runs the same discovery with `roots: ['doc']` + root-level `*.md` when the site
has no `autonav`, and prints one line per problem:
`unlisted: doc/js/sql.md` (exists, not in `nav`, not excluded) and
`missing: doc/gone.md` (in `nav`, no such file — a build would otherwise fail
mid-way). Exit 0 = clean, 1 = something printed. `exclude` (from `autonav` or,
absent that, a top-level `exclude` key) silences deliberate omissions, which is
how `CLAUDE.md`/`TODO.md` and the opencv.js docs stay out.

**`sync.sh`**: run `--check` before building; print its output as warnings but
do not stop, and add `--strict` to make a non-zero check abort.

**Per-project `CLAUDE.md`** (append to the existing "GitHub Pages site" section):
"To regenerate the site after doc changes run `<rel>/tools/site/sync.sh <name>`
and report anything `--check` prints; do not push without the user's yes."

**Risk to state whenever it is offered:** autonav publishes whatever it finds, so
a planning note or draft under `doc/` goes live on the next sync. Recommend it
only where `doc/` is curated (qjs-modules); keep it off where the user wants full
control, and always pair it with `--check` output shown to the user first.

**Tests before calling it done:** (1) with `autonav` absent every site's output
is byte-identical to before (`diff -r` old/new build dirs); (2) qjs-modules with
autonav on gains exactly the pages `--check` listed as unlisted minus its
`exclude`; (3) `qjsm` and `node` outputs stay identical; (4) a collision case
prints the warning and keeps the explicit page.

## Procedure C — maintain an existing site

- **Add/move a doc page:** edit `nav` in `sites/<name>/site.config.js` (a page
  not listed is not built; automatic pickup is only *planned*, see the
  `autonav` section above). Rebuild; check the sidebar and that inbound links
  resolve on-site.
- **Landing text/facts changed in the project:** re-verify each number before
  keeping it; landing pages contain hard facts (sizes, counts, dates).
- **Renderer bug or missing markdown feature:** fix `tools/site/lib/markdown.js`
  once, rebuild *all* sites and diff a page or two per site; never patch per site.
  It intentionally lacks blockquote/image/reference-link/raw-HTML support — add
  only what a real doc needs.
- **Refresh after project changes:** `sync.sh <site>`; it reads the project's
  working tree, so make sure the checkout is on the intended branch and clean
  (the commit message records sha/branch/`+dirty`).
- **A sync push is rejected** (someone/CI changed gh-pages): do not force. Rerun
  sync (it resets to the remote and rebuilds) and find what else is writing to
  gh-pages — normally a leftover `pages.yml`.

## Pitfalls seen in the wild

- Two publishers on one branch: the old `pages.yml` (qjs-opencv, qjs-modules)
  force-pushes over anything synced. Retire it in the same change.
- `qjs-lws` has remotes `origin` (GitHub), `gitlab`, `sr.ht`; `sync.sh` uses
  `origin`, override with `PAGES_REMOTE=…` if needed.
- Pages needs `.nojekyll` (the engine emits it) or `_`-prefixed paths vanish.
- Everything is relative-linked; test through `http.server` *and* `file://`.
- Markdown headings become anchors via GitHub-style slugs: renaming a heading
  breaks inbound `#fragment` links, including ones in other docs.
- shish's playground needs `build/emscripten-all/*.wasm` in the checkout; the
  build fails loudly if they are missing (mark `optional: true` to publish
  without).
