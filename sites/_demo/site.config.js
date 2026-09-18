/**
 * Site definition for _demo -> https://rsenn.github.io/_demo/
 * See tools/site/README.md for every option.
 */
export default {
  repo: 'rsenn/_demo',
  branch: 'main',
  name: '_demo',
  mark: '{ }',
  tagline: 'artwork demo',
  description: 'Example logo, decoration sprites, live wallpaper and dot-matrix font.',
  license: 'MIT',
  search: false,               // true once there are more than ~15 doc pages

  // examples: {},             // generate examples.html from the checkout's examples/
  // pages: [{ out: 'play.html', body: 'play.html', title: 'Playground', cls: 'play' }],
  // files: [{ src: 'build/wasm/app.wasm', out: 'assets/app.wasm', optional: true }],
  // siteLinks: ['play.html'], // markdown links to these stay on the site

  art: {
    logo: 'art/logo.svg',
    decor: 'art/decor.svg',
    wallpaper: { svg: 'art/wallpaper.svg', script: 'art/wallpaper.js', pages: 'all', opacity: 0.35 },
    font: { sheet: 'art/dotmatrix.svg', cols: 16, rows: 6, first: 32, upper: true },
  },

  topnav: [
    ['Get started', 'getting-started.html'],
  ],

  nav: [
    {
      group: 'Start here',
      pages: [
        ['README.md', 'getting-started.html', 'Getting started'],
      ],
    },
  ],
};
