/**
 * Site definition for qjs-opencv -> https://rsenn.github.io/qjs-opencv/
 *
 *   node tools/site/build.js qjs-opencv --src <checkout of rsenn/qjs-opencv> [--out DIR]
 *
 * Everything project-specific lives here and next to this file:
 * landing.html, favicon.svg, theme.css. The engine, markdown renderer,
 * highlighter and base stylesheet are shared (tools/site/).
 */
export default {
  repo: 'rsenn/qjs-opencv',
  branch: 'main',
  name: 'qjs-opencv',
  mark: '{ }',
  tagline: 'OpenCV bindings for QuickJS',
  description: 'Mat, contours, imgproc, calib3d, dnn and video I/O in a loadable QuickJS module.',
  license: 'MIT',
  search: false,

  // Generate examples.html from the checkout's examples/ directory.
  examples: {},

  // Header links; hrefs are site-relative (the engine prefixes the root).
  topnav: [
    ['Get started', 'getting-started.html'],
    ['Docs', 'docs/algorithms.html'],
    ['Examples', 'examples.html'],
    ['Roadmap', 'docs/roadmap.html'],
  ],

  // Site map: [markdown source in the project checkout, output path, sidebar label].
  // A doc/**.md file that is not listed here is not built, and links to it
  // fall back to a github.com blob URL.
  // doc/opencv-js-api.md and doc/opencv-js-examples.md are deliberately absent:
  // they document upstream opencv.js (the porting target), not this project,
  // and cite local checkout paths.
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
        ['doc/algorithms.md', 'docs/algorithms.html', 'Custom algorithms'],
        ['TODO.md', 'docs/roadmap.html', 'Binding roadmap'],
      ],
    },
  ],
};
