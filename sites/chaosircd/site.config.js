/**
 * Site definition for chaosircd -> https://rsenn.github.io/chaosircd/
 *
 *   node tools/site/build.js chaosircd --src <checkout of rsenn/chaosircd> [--out DIR]
 *
 * Everything project-specific lives here and next to this file:
 * landing.html, favicon.svg, theme.css. The engine, markdown renderer,
 * highlighter and base stylesheet are shared (tools/site/).
 */
export default {
  repo: 'rsenn/chaosircd',
  branch: 'main',
  name: 'chaosircd',
  mark: '#',
  tagline: 'an IRC daemon with (re)loadable modules',
  description: 'Loadable command/chanmode/usermode modules, a dedicated DNS/ident/proxy-scan process, and an in-process WebSocket gateway for browser clients.',
  license: 'GPL v2 (LGPL v2 for the core library)',
  search: false,

  // Header links; hrefs are site-relative (the engine prefixes the root).
  topnav: [
    ['Get started', 'getting-started.html'],
    ['IRCv3 plan', 'docs/ircv3.html'],
  ],

  // Site map: [markdown source in the project checkout, output path, sidebar label].
  // A doc/**.md file that is not listed here is not built, and links to it
  // fall back to a github.com blob URL.
  nav: [
    {
      group: 'Start here',
      pages: [['README.md', 'getting-started.html', 'Getting started']],
    },
    {
      group: 'Reference',
      pages: [['IRCv3.md', 'docs/ircv3.html', 'IRCv3 migration plan']],
    },
  ],
};
