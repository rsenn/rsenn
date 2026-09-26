/**
 * Site definition for qjs-ffi -> https://rsenn.github.io/qjs-ffi/
 * See tools/site/README.md for every option.
 */
export default {
  repo: 'rsenn/qjs-ffi',
  branch: 'main',
  name: 'qjs-ffi',
  mark: 'ffi',
  tagline: 'Call any C library from QuickJS',
  description: 'libffi and dlopen as a loadable QuickJS module: define C prototypes, call functions, pass callbacks, plus ready-made bindings for cairo, SDL2, freetype, libcurl and more.',
  license: 'MIT',
  search: false,               // true once there are more than ~15 doc pages

  // pages: [{ out: 'play.html', body: 'play.html', title: 'Playground', cls: 'play' }],
  // files: [{ src: 'build/wasm/app.wasm', out: 'assets/app.wasm', optional: true }],
  // siteLinks: ['play.html'], // markdown links to these stay on the site

  // art: {
  //   logo: 'art/logo.svg',
  //   decor: 'art/decor.svg',
  //   wallpaper: { svg: 'art/wallpaper.svg', script: 'art/wallpaper.js', pages: 'all', opacity: 0.35 },
  //   font: { sheet: 'art/dotmatrix.svg', cols: 16, rows: 6, first: 32, upper: true },
  // },

  topnav: [
    ['Get started', 'getting-started.html'],
    ['CFunction', 'docs/c-function.html'],
    ['JSCallback', 'docs/js-callback.html'],
  ],

  // TODO.md is left out on purpose: it is a working list, not documentation.
  nav: [
    {
      group: 'Start here',
      pages: [
        ['README.md', 'getting-started.html', 'Getting started'],
      ],
    },
    {
      group: 'Reference',
      pages: [
        ['doc/c-function.md', 'docs/c-function.html', 'CFunction'],
        ['doc/js-callback.md', 'docs/js-callback.html', 'JSCallback'],
      ],
    },
  ],
};
