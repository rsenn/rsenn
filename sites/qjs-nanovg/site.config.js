/**
 * Site definition for qjs-nanovg -> https://rsenn.github.io/qjs-nanovg/
 * See tools/site/README.md for every option.
 */
export default {
  repo: 'rsenn/qjs-nanovg',
  branch: 'main',
  name: 'qjs-nanovg',
  mark: 'NanoVG',
  tagline: 'Canvas-style 2D vector graphics for QuickJS',
  description: 'NanoVG antialiased OpenGL vector graphics as a loadable QuickJS module: paths, gradients, text, images, framebuffers. Also builds to WebAssembly for the browser.',
  license: 'MIT',
  search: true,                // member-table rows and headings of the API doc

  // Generate examples.html from the checkout's examples/.
  // skip replaces the default list, so the defaults are repeated here.
  examples: { skip: ['models', 'node_modules', 'build', 'data', 'assets', 'emerald-run'] },
  pages: [{ out: 'canvas2d.html', body: 'canvas2d.html', title: 'Canvas2D' }],
  // pages: [{ out: 'play.html', body: 'play.html', title: 'Playground', cls: 'play' }],
  // files: [{ src: 'build/wasm/app.wasm', out: 'assets/app.wasm', optional: true }],
  // siteLinks: ['play.html'], // markdown links to these stay on the site

  art: {
    logo: 'art/logo.svg',
  },
  // art: {
  //   logo: 'art/logo.svg',
  //   decor: 'art/decor.svg',
  //   wallpaper: { svg: 'art/wallpaper.svg', script: 'art/wallpaper.js', pages: 'all', opacity: 0.35 },
  //   font: { sheet: 'art/dotmatrix.svg', cols: 16, rows: 6, first: 32, upper: true },
  // },

  topnav: [
    ['API', 'docs/api.html'],
    ['Browser', 'docs/web.html'],
    ['Canvas2D', 'canvas2d.html'],
    ['Examples', 'examples.html'],
  ],

  // web/TODO.md is left out on purpose: it is a working list of gaps, not documentation.
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
        ['doc/api-documentation.md', 'docs/api.html', 'API reference'],
      ],
    },
    {
      group: 'Browser',
      pages: [
        ['web/README.md', 'docs/web.html', 'Browser version'],
      ],
    },
  ],
};
