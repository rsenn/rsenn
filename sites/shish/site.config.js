/**
 * Site definition for shish -> https://rsenn.github.io/shish/
 *
 *   node tools/site/build.js shish --src <checkout of rsenn/shish> [--out DIR]
 *
 * Everything project-specific lives here and next to this file:
 * landing.html, favicon.svg, theme.css. The engine, markdown renderer,
 * highlighter and base stylesheet are shared (tools/site/).
 */
export default {
  repo: 'rsenn/shish',
  branch: 'main',
  name: 'shish',
  mark: '$_',
  tagline: 'a small POSIX-ish shell in C',
  description: '139 KB stripped, 184 KB of WebAssembly, with cat/rm/mkdir built in: a shell for containers, agent sandboxes and the browser.',
  license: 'GPL v2',
  search: false,

  // Title/footer separator: this site does not use the em dash.
  sep: ' | ',

  // No artwork block: the look is type. Title font VT323 (SIL OFL) ships from fonts/ (see files below).
  // Retired mascot artwork and the dot-matrix experiment live in _mascots/ and art/, not built.

  // Header links; hrefs are site-relative (the engine prefixes the root).
  topnav: [
    ['Get started', 'getting-started.html'],
    ['Containers', 'docs/containers.html'],
    ['WASM', 'docs/wasm.html'],
    ['Playground', 'play.html'],
  ],

  // Site map: [markdown source in the project checkout, output path, sidebar label].
  // A doc/**.md file that is not listed here is not built, and links to it
  // fall back to a github.com blob URL.
  nav: [
    {
      group: 'Start here',
      pages: [
        ['README.md', 'getting-started.html', 'Getting started'],
        ['doc/building.md', 'docs/building.html', 'Building'],
        ['doc/builtins.md', 'docs/builtins.html', 'Builtins'],
      ],
    },
    {
      group: 'Where it runs',
      pages: [
        ['doc/containers.md', 'docs/containers.html', 'Containers'],
        ['doc/agents.md', 'docs/agents.html', 'Agent sandboxes'],
        ['doc/wasm.md', 'docs/wasm.html', 'WebAssembly'],
      ],
    },
    {
      group: 'Reference',
      pages: [['doc/conformance.md', 'docs/conformance.html', 'Conformance']],
    },
  ],

  // Hand-written pages, not generated from markdown.
  pages: [
    { out: 'play.html', body: 'play.html', title: 'Playground', cls: 'play' },
  ],

  // Copied byte-for-byte out of the project checkout / this site dir.
  // `optional` skips a missing file (the wasm build is not always present).
  files: [
    { src: 'build/emscripten-all/shish.js', out: 'assets/shish.js' },
    { src: 'build/emscripten-all/shish.wasm', out: 'assets/shish.wasm' },
    { src: 'build/emscripten-all/shutil.js', out: 'assets/shutil.js' },
    { src: 'build/emscripten-all/shutil.wasm', out: 'assets/shutil.wasm' },
    { site: 'shutil-client.js', out: 'assets/shutil-client.js' },
    { site: 'fonts/vt323.woff2', out: 'assets/vt323.woff2' },
    { site: 'fonts/OFL.txt', out: 'assets/OFL-VT323.txt' },
  ],

  // Markdown links to these paths stay site-local instead of going to github.com.
  siteLinks: ['play.html'],
};
