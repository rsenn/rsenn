/**
 * Site definition for __NAME__ -> https://rsenn.github.io/__NAME__/
 * See tools/site/README.md for every option.
 */
export default {
  repo: '__REPO__',
  branch: 'main',
  name: '__NAME__',
  mark: '__MARK__',
  tagline: '__TAGLINE__',
  description: '__DESCRIPTION__',
  license: '__LICENSE__',
  search: false,               // true once there are more than ~15 doc pages

  // examples: {},             // generate examples.html from the checkout's examples/
  // pages: [{ out: 'play.html', body: 'play.html', title: 'Playground', cls: 'play' }],
  // files: [{ src: 'build/wasm/app.wasm', out: 'assets/app.wasm', optional: true }],
  // siteLinks: ['play.html'], // markdown links to these stay on the site

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
