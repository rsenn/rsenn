/**
 * Static-site generator shared by every rsenn project on GitHub Pages.
 *
 *   node tools/site/build.js <site> [--src DIR] [--out DIR]
 *   qjsm tools/site/build.js <site> [--src DIR] [--out DIR]     (same thing)
 *   node tools/site/build.js --list                             (known sites)
 *   node tools/site/build.js <site> --print-src                 (resolved --src)
 *
 * <site>  a directory under sites/ holding site.config.js, landing.html,
 *         favicon.svg and theme.css (see tools/site/README.md).
 * --src   checkout of the project whose markdown is rendered. Without it:
 *         $SITE_SRC_<NAME> (upper-case, '-' -> '_'), then the `name=path`
 *         lines of sites.local at the repo root.
 * --out   where the site is written (default: _site/<site>).
 *
 * Renders the project's own markdown into a self-contained HTML site: a
 * hand-written landing page plus every page listed in the site's `nav`,
 * behind a shared shell with sidebar navigation and a per-page table of
 * contents. Inter-doc *.md links are rewritten to their generated pages;
 * links to anything else in the repo (src/, tests/, ...) become github.com
 * blob/tree URLs.
 *
 * Optional per site: client-side search (config.search), an examples page
 * generated from the project's examples/ directory (config.examples),
 * hand-written extra pages such as a playground (config.pages),
 * byte-for-byte copied files such as a wasm build (config.files), and
 * artwork (config.art: logo, decoration sprites, live wallpaper, glyph-sheet
 * font - see README "Artwork").
 *
 * Everything is relative-path linked so a site works both at
 * https://rsenn.github.io/<name>/ and from a local file:// checkout.
 */

import * as fs from 'fs';
import { render } from './lib/markdown.js';
import { highlight } from './lib/highlight.js';

const IS_NODE = typeof process !== 'undefined' && !!(process.versions && process.versions.node);
const std = IS_NODE ? null : await import('std');
const exit = code => (IS_NODE ? process.exit(code) : std.exit(code));

const SELF = dirname(import.meta.url.replace(/^file:\/\//, '')) || '.';
const REPO_ROOT = SELF + '/../..';
const SITES = REPO_ROOT + '/sites';
const ARGS = typeof scriptArgs !== 'undefined' ? scriptArgs.slice(1) : process.argv.slice(2);
const ENGINE_URL = 'https://github.com/rsenn/rsenn/tree/main/tools/site';

/* ------------------------------------------------------------ path helpers */

function dirname(p) {
  return p.indexOf('/') >= 0 ? p.slice(0, p.lastIndexOf('/')) : '';
}

function normalize(p) {
  const out = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') out.pop();
    else out.push(part);
  }
  return out.join('/');
}

/** Path from a directory to a file, both site-relative. */
function relative(fromDir, to) {
  const f = fromDir ? fromDir.split('/') : [];
  const t = to.split('/');
  let i = 0;
  while (i < f.length && i < t.length - 1 && f[i] === t[i]) i++;
  return '../'.repeat(f.length - i) + t.slice(i).join('/');
}

function mkdirp(path) {
  let cur = path.startsWith('/') ? '/' : '';
  for (const part of path.split('/')) {
    if (!part) continue;
    cur += (cur && !cur.endsWith('/') ? '/' : '') + part;
    if (!fs.existsSync(cur)) fs.mkdirSync(cur, 0o755);
  }
}

const read = path => fs.readFileSync(path, 'utf8');
const exists = path => fs.existsSync(path);

function write(path, text) {
  mkdirp(dirname(path));
  fs.writeFileSync(path, text);
}

/** Byte-for-byte copy, for wasm modules and their glue. */
function copy(from, to) {
  mkdirp(dirname(to));
  fs.copyFileSync(from, to);
}

const escAttr = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const unescape = s => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/* ------------------------------------------------------------ arguments */

function parseArgs(args) {
  const opts = { site: null, src: null, out: null, list: false, printSrc: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--src') opts.src = args[++i];
    else if (a === '--out') opts.out = args[++i];
    else if (a === '--list') opts.list = true;
    else if (a === '--print-src') opts.printSrc = true;
    else if (a.startsWith('-')) fail('unknown option ' + a);
    else if (!opts.site) opts.site = a;
    else fail('unexpected argument ' + a);
  }
  return opts;
}

function fail(msg) {
  console.log('build.js: ' + msg);
  exit(1);
}

/** `name=path` lines, '#' comments - trivially shared with sync.sh. */
function readLocal() {
  const map = {};
  const file = REPO_ROOT + '/sites.local';
  if (!exists(file)) return map;
  for (const line of read(file).split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.+?)\s*$/);
    if (m && !line.trim().startsWith('#')) map[m[1]] = m[2].replace(/^~(?=\/)/, getenv('HOME') || '~');
  }
  return map;
}

const getenv = name => (IS_NODE ? process.env[name] : std.getenv(name));

function resolveSrc(opts) {
  if (opts.src) return opts.src;
  const envName = 'SITE_SRC_' + opts.site.toUpperCase().replace(/-/g, '_');
  return getenv(envName) || readLocal()[opts.site] || null;
}

/* ------------------------------------------------------------ site model */

function listSites() {
  if (typeof fs.readdirSync !== 'function') return [];
  // sites/_* (the artwork demo) are buildable by name but not part of --list/--all
  return fs
    .readdirSync(SITES)
    .filter(n => !n.startsWith('_') && exists(SITES + '/' + n + '/site.config.js'))
    .sort();
}

const opts = parseArgs(ARGS);

if (opts.list) {
  console.log(listSites().join('\n'));
  exit(0);
}

if (!opts.site) fail('usage: build.js <site> [--src DIR] [--out DIR]   (sites: ' + listSites().join(', ') + ')');

const SITE_DIR = SITES + '/' + opts.site;
if (!exists(SITE_DIR + '/site.config.js')) fail('no such site: ' + SITE_DIR + '/site.config.js');

const SRC = resolveSrc(opts);
if (opts.printSrc) {
  if (!SRC) fail('no checkout known for ' + opts.site + ' (use --src, $SITE_SRC_*, or sites.local)');
  console.log(SRC);
  exit(0);
}
if (!SRC) fail('no checkout known for ' + opts.site + ' (use --src, $SITE_SRC_*, or sites.local)');
if (!exists(SRC + '/README.md') && !exists(SRC + '/.git')) fail('--src does not look like a project checkout: ' + SRC);

const OUT = opts.out || '_site/' + opts.site;
const CONFIG = (await import(SITE_DIR + '/site.config.js')).default;

const REPO = CONFIG.repo;
const GITHUB = 'https://github.com/' + REPO;
const BRANCH = CONFIG.branch || 'main';
const NAME = CONFIG.name || opts.site;
const TAGLINE = CONFIG.tagline;

/* ------------------------------------------------------------------ nav */

const NAV = CONFIG.nav.map(g => ({ group: g.group, pages: g.pages.slice() }));

/* examples/ -> one generated page; appended to the sidebar as its own group */
const EXAMPLES = CONFIG.examples
  ? {
      dir: 'examples',
      out: 'examples.html',
      title: 'Examples',
      exts: ['.js', '.mjs', '.c', '.h', '.sh'],
      skip: ['models', 'node_modules', 'build', 'data', 'assets'],
      maxBytes: 48 * 1024,
      ...CONFIG.examples,
    }
  : null;
if (EXAMPLES) NAV.push({ group: 'Examples', pages: [[null, EXAMPLES.out, EXAMPLES.title]] });

const PAGES = [];
for (const { group, pages } of NAV)
  for (const [src, out, title] of pages) PAGES.push({ src, out, title, group });

const bySrc = new Map(PAGES.filter(p => p.src).map(p => [p.src, p]));

/* --------------------------------------------------------- link rewriting */

/** Rewrite one markdown href found in `page` into a link that works on the site. */
function linkFor(page, href) {
  if (!href || href.startsWith('#') || href.startsWith('//') || /^[a-z][a-z0-9+.-]*:/i.test(href))
    return href;

  const hash = href.indexOf('#');
  const path = hash < 0 ? href : href.slice(0, hash);
  const frag = hash < 0 ? '' : href.slice(hash);
  if (!path) return href;

  const target = normalize(dirname(page.src || '') + '/' + path);
  const hit = bySrc.get(target);
  if (hit) return relative(dirname(page.out), hit.out) + frag;

  if ((CONFIG.siteLinks || []).includes(target)) return relative(dirname(page.out), target) + frag;

  const kind = path.endsWith('/') ? 'tree' : 'blob';
  return GITHUB + '/' + kind + '/' + BRANCH + '/' + target + frag;
}

/* ------------------------------------------------------------------ art */

/* Everything optional. All paths are relative to the site dir (sites/<name>/):
 *
 *   art: {
 *     logo: 'art/logo.svg',                       // inlined in the header
 *     decor: 'art/decor.svg',                     // <symbol> sprites -> bullets, rules, buttons
 *     wallpaper: { svg: 'art/wallpaper.svg',      // ONE svg, several <g> groups
 *                  script: 'art/wallpaper.js',    // animates it (Wallpaper.register)
 *                  pages: 'all',                  // 'all' | 'landing' | 'docs'
 *                  opacity: 0.35 },
 *     font: { sheet: 'art/dotmatrix.svg',         // one cell per character
 *             cols: 16, rows: 6, cell: [8, 8],    // cell optional for svg (from viewBox)
 *             first: 32, upper: true,             // code of the first cell; fold to upper case
 *             apply: ['.hero h1', '.doc h1'] },   // what to draw with it
 *   }
 */
const ART = CONFIG.art || {};
const TINTS = { accent: '--accent', fg: '--fg', muted: '--fg-muted', faint: '--fg-faint', line: '--line-strong' };

/** Make an svg file inlinable in HTML: no prolog, doctype or comments. */
const cleanSvg = text =>
  text.replace(/<\?xml[\s\S]*?\?>/g, '').replace(/<!DOCTYPE[\s\S]*?>/gi, '').replace(/<!--[\s\S]*?-->/g, '').trim();

const attr = (attrs, name) => {
  const m = attrs.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*"([^"]*)"'));
  return m ? m[1] : null;
};

const artFile = rel => {
  if (!exists(SITE_DIR + '/' + rel)) fail('art: missing file ' + SITE_DIR + '/' + rel);
  return read(SITE_DIR + '/' + rel);
};

const LOGO = ART.logo ? cleanSvg(artFile(ART.logo)) : null;

const WALLPAPER = ART.wallpaper
  ? (() => {
      const w = { pages: 'all', ...ART.wallpaper };
      let svg = cleanSvg(artFile(w.svg));
      const open = svg.match(/^<svg\b([^>]*)>/);
      if (!open || !attr(open[1], 'viewBox')) fail('art: ' + w.svg + ' needs an <svg viewBox="…">');
      const attrs = open[1]
        .replace(/\s(?:width|height|preserveAspectRatio)\s*=\s*"[^"]*"/g, '')
        .replace(/\s+$/, '');
      svg = '<svg' + attrs + ' preserveAspectRatio="xMidYMid slice" focusable="false">' + svg.slice(open[0].length);
      w.inline = svg;
      w.code = w.script ? artFile(w.script) : null;
      return w;
    })()
  : null;

const wallpaperOn = cls => WALLPAPER && (WALLPAPER.pages === 'all' || (WALLPAPER.pages === 'landing') === (cls === 'landing'));

/** The <symbol id> sprites of decor.svg as standalone svg images. */
function readSymbols(text) {
  const out = {};
  for (const m of cleanSvg(text).matchAll(/<symbol\b([^>]*)>([\s\S]*?)<\/symbol>/g)) {
    const id = attr(m[1], 'id');
    const vb = attr(m[1], 'viewBox');
    if (!id || !vb) fail('art: every decor <symbol> needs id and viewBox (' + (id || '?') + ')');
    const [, , vw, vh] = vb.trim().split(/[\s,]+/).map(Number);
    const w = +attr(m[1], 'width') || vw, h = +attr(m[1], 'height') || vh;
    const tint = attr(m[1], 'data-tint');
    if (tint && !TINTS[tint]) fail('art: data-tint must be one of ' + Object.keys(TINTS).join(', ') + ' (' + id + ')');
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="' + vb + '" width="' + w + '" height="' + h + '">' + m[2] + '</svg>';
    out[id] = {
      w, h, tint, svg,
      slice: +attr(m[1], 'data-slice') || 8,
      color: attr(m[1], 'data-color'),
      uri: 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '")',
    };
  }
  return out;
}

/** CSS for decor sprites and the glyph font, generated per site into assets/art.css. */
function artCss() {
  let css = '/* generated by tools/site/build.js from config.art - do not edit */\n';

  if (ART.decor) {
    const sym = readSymbols(artFile(ART.decor));
    // single-colour art (data-tint) is used as a mask painted with a theme token
    const paint = (s, size, rep) => {
      const geom = 'center / ' + size + ' ' + rep;
      return s.tint
        ? 'background-color:var(' + TINTS[s.tint] + ');-webkit-mask:' + s.uri + ' ' + geom + ';mask:' + s.uri + ' ' + geom + ';'
        : 'background:' + s.uri + ' ' + geom + ';';
    };

    if (sym.bullet)
      css += `.doc ul:not(.checks) { list-style: none; }
.doc ul:not(.checks) > li { position: relative; }
.doc ul:not(.checks) > li::before { content: ""; position: absolute; left: -1.2rem; top: 0.55em; width: 0.75em; height: 0.75em; ${paint(sym.bullet, 'contain', 'no-repeat')} }
.checks li::before { content: ""; top: 0.5em; width: 0.85em; height: 0.85em; ${paint(sym.bullet, 'contain', 'no-repeat')} }
`;

    if (sym.rule) {
      const r = sym.rule;
      css += `.doc hr { border: 0; height: ${r.h}px; ${paint(r, 'auto 100%', 'repeat-x').replace('center /', 'left center /')} }
.landing .section { border-top: 0; position: relative; }
.landing .section::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: ${r.h}px; ${paint(r, 'auto 100%', 'repeat-x').replace('center /', 'left center /')} }
`;
    }

    for (const [id, sel] of [['btn', '.btn'], ['btn-primary', '.btn.primary']]) {
      const b = sym[id];
      if (!b) continue;
      if (b.tint) console.log('warning: art: ' + id + ' cannot be tinted (9-slice); using it as authored');
      css += `${sel} { border: ${b.slice}px solid transparent; border-image: ${b.uri} ${b.slice} fill / ${b.slice}px stretch; background: none; padding: 0.15rem 0.75rem;${b.color ? ' color: ' + b.color + ';' : ''} }
`;
    }
  }

  if (ART.font) {
    const f = FONT;
    css += `:root { --dm-sheet: url("${f.file}"); --dm-cols: ${f.cols}; --dm-rows: ${f.rows}; --dm-aspect: ${+(f.cell[0] / f.cell[1]).toFixed(4)}; }
.dm { display: inline-block; width: calc(1em * var(--dm-aspect)); height: 1em; vertical-align: -0.12em; background: currentColor;
  -webkit-mask: var(--dm-sheet) no-repeat; mask: var(--dm-sheet) no-repeat;
  -webkit-mask-size: calc(var(--dm-cols) * 1em * var(--dm-aspect)) calc(var(--dm-rows) * 1em); mask-size: calc(var(--dm-cols) * 1em * var(--dm-aspect)) calc(var(--dm-rows) * 1em);
  -webkit-mask-position: calc(var(--c) * -1em * var(--dm-aspect)) calc(var(--r) * -1em); mask-position: calc(var(--c) * -1em * var(--dm-aspect)) calc(var(--r) * -1em); }
.dm-word { white-space: nowrap; }
.dm-on { word-spacing: 0.3em; text-transform: none; letter-spacing: 0; }
`;
  }
  return css;
}

/* font metrics, resolved once; an svg sheet may omit `cell` and derive it from its viewBox */
const FONT = ART.font
  ? (() => {
      const f = { first: 32, upper: false, apply: ['.brand-name', '.hero h1', '.doc h1', '.play .playhead h1'], ...ART.font };
      if (!f.cols || !f.rows) fail('art.font needs cols and rows');
      if (!f.cell) {
        const vb = f.sheet.endsWith('.svg') && attr((cleanSvg(artFile(f.sheet)).match(/^<svg\b([^>]*)>/) || [, ''])[1], 'viewBox');
        if (!vb) fail('art.font.cell is required for a non-svg sheet (or an svg without viewBox)');
        const [, , vw, vh] = vb.trim().split(/[\s,]+/).map(Number);
        f.cell = [vw / f.cols, vh / f.rows];
      }
      f.file = f.sheet.slice(f.sheet.lastIndexOf('/') + 1);
      return f;
    })()
  : null;

const HAS_ART_CSS = !!(ART.decor || ART.font);

/* ------------------------------------------------------------- html shell */

function sidebar(page) {
  const here = dirname(page.out);
  let html = '';
  for (const { group, pages } of NAV) {
    html += '<div class="navgroup"><h3>' + group + '</h3><ul>';
    for (const [, out, title] of pages) {
      const cls = out === page.out ? ' class="here"' : '';
      html += '<li><a href="' + escAttr(relative(here, out)) + '"' + cls + '>' + title + '</a></li>';
    }
    html += '</ul></div>';
  }
  return html;
}

function toc(headings) {
  const items = headings.filter(h => h.level >= 2 && h.level <= 3);
  if (items.length < 2) return '';
  const links = items
    .map(h => '<li class="lvl' + h.level + '"><a href="#' + escAttr(h.id) + '">' + escAttr(h.text) + '</a></li>')
    .join('');
  return '<nav class="toc"><h3>On this page</h3><ul>' + links + '</ul></nav>';
}

function shell({ title, root, body, cls, head }) {
  const topnav = CONFIG.topnav
    .map(([label, href]) => `<a href="${root}${escAttr(href)}">${escAttr(label)}</a>`)
    .join('\n    ');
  const search = CONFIG.search
    ? `\n  <div class="search">
    <input id="site-search" type="search" placeholder="Search docs… ( / )" autocomplete="off" spellcheck="false">
  </div>`
    : '';
  const searchScripts = CONFIG.search
    ? `<script src="${root}assets/search-index.js"></script>
<script src="${root}assets/search.js"></script>
`
    : '';
  const artCssLink = HAS_ART_CSS ? `<link rel="stylesheet" href="${root}assets/art.css">\n` : '';
  const theme = HAS_THEME ? `<link rel="stylesheet" href="${root}assets/theme.css">\n` : '';
  const brandMark = LOGO
    ? `<span class="logo" aria-hidden="true">${LOGO}</span>`
    : `<span class="mark">${escAttr(CONFIG.mark || '')}</span>`;
  const wall = wallpaperOn(cls)
    ? `<div class="wallpaper" aria-hidden="true"${WALLPAPER.opacity != null ? ` style="--wallpaper-opacity:${+WALLPAPER.opacity}"` : ''}>${WALLPAPER.inline}</div>\n`
    : '';
  const artScripts =
    (wall ? `<script src="${root}assets/wallpaper-host.js"></script>\n` + (WALLPAPER.code ? `<script src="${root}assets/wallpaper.js"></script>\n` : '') : '') +
    (FONT
      ? `<script>window.DOTFONT=${JSON.stringify({ sheet: root + 'assets/' + FONT.file, cols: FONT.cols, rows: FONT.rows, first: FONT.first, upper: FONT.upper, apply: FONT.apply })};</script>\n<script src="${root}assets/dotfont.js"></script>\n`
      : '');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escAttr(title)}</title>
<meta name="description" content="${escAttr(NAME + ' — ' + TAGLINE + '. ' + (CONFIG.description || ''))}">
<link rel="stylesheet" href="${root}assets/base.css">
${artCssLink}${theme}<link rel="icon" href="${root}assets/favicon.svg" type="image/svg+xml">
<script>try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
${head || ''}</head>
<body class="${cls}" data-site="${escAttr(opts.site)}" data-root="${root}">
${wall}<header class="topbar">
  <a class="brand" href="${root}index.html">${brandMark} <span class="brand-name">${escAttr(NAME)}</span></a>${search}
  <nav class="topnav">
    ${topnav}
    <a href="${GITHUB}" target="_blank" rel="noopener">GitHub</a>
  </nav>
  <button class="themetoggle" type="button" aria-label="Toggle colour scheme">◐</button>
</header>
${body}
<footer class="sitefoot">
  <p>${escAttr(NAME)} — ${escAttr(CONFIG.license || '')}. Built from the repo's own markdown by
     <a href="${ENGINE_URL}">rsenn/rsenn tools/site</a>.</p>
</footer>
${searchScripts}${artScripts}<script>
document.querySelector('.themetoggle').addEventListener('click', function () {
  var d = document.documentElement;
  var dark = d.dataset.theme ? d.dataset.theme === 'dark'
    : matchMedia('(prefers-color-scheme: dark)').matches;
  d.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', d.dataset.theme); } catch (e) {}
});
</script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ build */

const SEARCH = [];
const HAS_THEME = exists(SITE_DIR + '/theme.css');

/** Wrap rendered article HTML in the sidebar/toc layout and write the page. */
function writeDocPage(page, html, headings, members = []) {
  const depth = page.out.split('/').length - 1;
  const root = '../'.repeat(depth);
  const h1 = headings.find(h => h.level === 1);
  const pageTitle = h1 ? h1.text : page.title;

  if (CONFIG.search) {
    SEARCH.push({ u: page.out, t: pageTitle, k: 'page' });
    for (const h of headings)
      if (h.level >= 2) SEARCH.push({ u: page.out + '#' + h.id, t: h.text, p: pageTitle, k: 'section' });
    for (const m of members)
      SEARCH.push({ u: page.out + '#' + m.id, t: m.text, p: m.section || pageTitle, k: 'member' });
  }

  const edit = page.src
    ? `<p class="editlink"><a href="${GITHUB}/blob/${BRANCH}/${page.src}">Edit this page on GitHub →</a></p>\n`
    : '';

  const body = `<div class="layout">
<aside class="sidebar">${sidebar(page)}</aside>
<main class="doc">
<article>${html}</article>
${edit}</main>
${toc(headings)}
</div>`;

  write(OUT + '/' + page.out, shell({ title: pageTitle + ' — ' + NAME, root, body, cls: 'has-sidebar' }));
}

function buildPage(page) {
  const { html, headings, members } = render(read(SRC + '/' + page.src), {
    link: href => linkFor(page, href),
    highlight,
  });
  writeDocPage(page, html, headings, members);
}

/** Strip the common leading indentation from a block of source text. */
function dedent(text) {
  const lines = text.replace(/^\n+|\s+$/g, '').split('\n');
  const pad = Math.min(...lines.filter(l => l.trim()).map(l => l.match(/^ */)[0].length));
  return lines.map(l => l.slice(pad)).join('\n');
}

/**
 * Landing pages are hand-written HTML, so code samples are marked up as
 * <x-code lang="js">…</x-code> and expanded here through the same highlighter
 * the markdown pages use.
 */
function expandCode(html) {
  return html.replace(/<x-code lang="([^"]*)">([\s\S]*?)<\/x-code>/g, (m, lang, body) => {
    const src = unescape(dedent(body));
    return (
      '<div class="codeblock" data-lang="' + escAttr(lang) + '"><pre><code class="language-' +
      escAttr(lang) + '">' + highlight(src, lang) + '</code></pre></div>'
    );
  });
}

/** Placeholders first: they also appear inside <x-code>, where expansion
 * would otherwise scatter them across highlight spans. */
function fill(html) {
  return html
    .replace(/\{\{GITHUB\}\}/g, GITHUB)
    .replace(/\{\{REPO\}\}/g, REPO)
    .replace(/\{\{NAME\}\}/g, NAME)
    .replace(/\{\{TAGLINE\}\}/g, TAGLINE);
}

function buildLanding() {
  write(
    OUT + '/index.html',
    shell({
      title: NAME + ' — ' + TAGLINE,
      root: '',
      body: expandCode(fill(read(SITE_DIR + '/landing.html'))),
      cls: 'landing',
    })
  );
}

/** Hand-written extra pages (playground, ...) in the shared shell. */
function buildExtraPage({ out, body, title, cls }) {
  const depth = out.split('/').length - 1;
  write(
    OUT + '/' + out,
    shell({
      title: title + ' — ' + NAME,
      root: '../'.repeat(depth),
      body: expandCode(fill(read(SITE_DIR + '/' + body))),
      cls: cls || 'page',
    })
  );
}

/* ---- examples/ -> examples.html */

const LANG = { '.js': 'js', '.mjs': 'js', '.c': 'c', '.h': 'c', '.sh': 'sh' };

function walk(dir, depth = 0, out = []) {
  if (!exists(dir)) return out;
  for (const name of fs.readdirSync(dir).sort()) {
    const path = dir + '/' + name;
    if (fs.statSync(path).isDirectory()) {
      if (depth < 2 && !EXAMPLES.skip.includes(name)) walk(path, depth + 1, out);
    } else if (EXAMPLES.exts.some(e => name.endsWith(e))) out.push(path);
  }
  return out;
}

/** First comment block of an example file, as plain prose. */
function leadComment(text) {
  const lines = text.replace(/^#!.*\n/, '').split('\n');
  const got = [];
  let block = false;
  for (const line of lines) {
    const t = line.trim();
    if (!got.length && !t) continue;
    if (!block && t.startsWith('/*')) block = true;
    if (block) {
      got.push(t.replace(/^\/\*+\s?|\s?\*+\/$/g, '').replace(/^\*\s?/, ''));
      if (t.includes('*/')) break;
    } else if (/^(\/\/|#)/.test(t)) got.push(t.replace(/^(\/\/+|#+)\s?/, ''));
    else break;
  }
  return got.join('\n').trim();
}

function buildExamples(page) {
  const files = walk(SRC + '/' + EXAMPLES.dir);
  let md = '# ' + EXAMPLES.title + '\n\nEvery file below lives in [`' + EXAMPLES.dir + '/`](' +
    GITHUB + '/tree/' + BRANCH + '/' + EXAMPLES.dir + '/) and is shown here as it ships.\n';

  for (const path of files) {
    const rel = path.slice(SRC.length + 1);
    if (fs.statSync(path).size > EXAMPLES.maxBytes) continue;
    const text = read(path);
    const lang = LANG[rel.slice(rel.lastIndexOf('.'))] || '';
    const lead = leadComment(text);
    md += '\n## ' + rel.slice(EXAMPLES.dir.length + 1) + '\n\n';
    if (lead) {
      const first = lead.split(/\n\s*\n/)[0].replace(/\s+/g, ' ').replace(/`/g, '');
      md += (first.length > 300 ? first.slice(0, 297) + '…' : first) + '\n\n';
    }
    md += '[source on GitHub](' + GITHUB + '/blob/' + BRANCH + '/' + rel + ')\n\n~~~~~' + lang + '\n' +
      text.replace(/\n+$/, '') + '\n~~~~~\n';
  }
  const { html, headings } = render(md, { link: h => h, highlight });
  writeDocPage(page, html, headings);
  return files.length;
}

/* ------------------------------------------------------------------ run */

buildLanding();
for (const p of CONFIG.pages || []) buildExtraPage(p);
for (const page of PAGES) {
  if (page.src) buildPage(page);
  else if (EXAMPLES && page.out === EXAMPLES.out) buildExamples(page);
}

for (const f of CONFIG.files || []) {
  const from = f.site ? SITE_DIR + '/' + f.site : SRC + '/' + f.src;
  if (exists(from)) copy(from, OUT + '/' + f.out);
  else if (!f.optional) fail('missing file for site: ' + from);
  else console.log('warning: skipped missing ' + from);
}

if (CONFIG.search) {
  /* Entries are our own generated strings (headings, table cells), never
   * arbitrary input, so JSON.stringify is enough. Loaded as a plain <script>
   * rather than fetched, so the site still works from file://, where fetch()
   * of a same-origin JSON file is blocked. */
  write(OUT + '/assets/search-index.js', 'window.SEARCH_INDEX = ' + JSON.stringify(SEARCH) + ';\n');
  write(OUT + '/assets/search.js', read(SELF + '/base/search.js'));
}

write(OUT + '/assets/base.css', read(SELF + '/base/base.css'));
if (HAS_THEME) write(OUT + '/assets/theme.css', read(SITE_DIR + '/theme.css'));
if (HAS_ART_CSS) write(OUT + '/assets/art.css', artCss());
if (WALLPAPER) {
  write(OUT + '/assets/wallpaper-host.js', read(SELF + '/base/wallpaper-host.js'));
  if (WALLPAPER.code) write(OUT + '/assets/wallpaper.js', WALLPAPER.code);
}
if (FONT) {
  write(OUT + '/assets/dotfont.js', read(SELF + '/base/dotfont.js'));
  copy(SITE_DIR + '/' + FONT.sheet, OUT + '/assets/' + FONT.file);
}
if (exists(SITE_DIR + '/favicon.svg')) write(OUT + '/assets/favicon.svg', read(SITE_DIR + '/favicon.svg'));
else if (LOGO) write(OUT + '/assets/favicon.svg', LOGO.includes('xmlns=') ? LOGO : LOGO.replace(/^<svg\b/, '<svg xmlns="http://www.w3.org/2000/svg"'));
else fail('site has neither favicon.svg nor art.logo');
write(OUT + '/.nojekyll', '');

console.log(
  'built ' + opts.site + ': ' + (PAGES.length + 1 + (CONFIG.pages || []).length) + ' pages' +
    (CONFIG.search ? ', ' + SEARCH.length + ' search entries' : '') + ' into ' + OUT + '/'
);
