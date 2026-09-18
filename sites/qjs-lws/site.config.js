/**
 * Site definition for qjs-lws -> https://rsenn.github.io/qjs-lws/
 *
 *   node tools/site/build.js qjs-lws --src <checkout of rsenn/qjs-lws> [--out DIR]
 *
 * Everything project-specific lives here and next to this file:
 * landing.html, favicon.svg, theme.css. The engine, markdown renderer,
 * highlighter and base stylesheet are shared (tools/site/).
 */
export default {
  repo: 'rsenn/qjs-lws',
  branch: 'main',
  name: 'qjs-lws',
  mark: '{ }',
  tagline: 'libwebsockets bindings for QuickJS',
  description: 'HTTP/1.1, HTTP/2, WebSocket, raw TCP/UDP and TLS in a QuickJS module.',
  license: 'MIT',
  search: true,

  // Header links; hrefs are site-relative (the engine prefixes the root).
  topnav: [
    ['Get started', 'getting-started.html'],
    ['Docs', 'docs/index.html'],
    ['Changelog', 'changelog.html'],
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
        ['doc/README.md', 'docs/index.html', 'API reference'],
        ['ChangeLog.md', 'changelog.html', 'Changelog'],
      ],
    },
    {
      group: 'Native API',
      pages: [
        ['doc/native/module.md', 'docs/native/module.html', 'Module exports'],
        ['doc/native/LWSContext.md', 'docs/native/LWSContext.html', 'LWSContext'],
        ['doc/native/LWSVhost.md', 'docs/native/LWSVhost.html', 'LWSVhost'],
        ['doc/native/LWSSocket.md', 'docs/native/LWSSocket.html', 'LWSSocket'],
        ['doc/native/LWSSPA.md', 'docs/native/LWSSPA.html', 'LWSSPA'],
        ['doc/native/LWSSockAddr46.md', 'docs/native/LWSSockAddr46.html', 'LWSSockAddr46'],
        ['doc/native/protocols.md', 'docs/native/protocols.html', 'Protocol handlers'],
        ['doc/native/callbacks.md', 'docs/native/callbacks.html', 'Callback reference'],
        ['doc/native/mounts.md', 'docs/native/mounts.html', 'Mounts'],
        ['doc/native/tls.md', 'docs/native/tls.html', 'TLS'],
        ['doc/native/event-loop.md', 'docs/native/event-loop.html', 'Event loop'],
        ['doc/native/constants.md', 'docs/native/constants.html', 'Constants'],
      ],
    },
    {
      group: 'Recipes',
      pages: [
        ['doc/native/ws-server.md', 'docs/native/ws-server.html', 'WebSocket server'],
        ['doc/native/ws-client.md', 'docs/native/ws-client.html', 'WebSocket client'],
        ['doc/native/http-server.md', 'docs/native/http-server.html', 'HTTP server'],
        ['doc/native/http-client.md', 'docs/native/http-client.html', 'HTTP client'],
        ['doc/native/raw-tcp.md', 'docs/native/raw-tcp.html', 'Raw TCP'],
        ['doc/native/examples.md', 'docs/native/examples.html', 'All examples'],
      ],
    },
    {
      group: 'JavaScript layer',
      pages: [
        ['doc/js/helpers.md', 'docs/js/helpers.html', 'lib/ helpers'],
        ['doc/js/bun.md', 'docs/js/bun.html', 'Bun-compatible serve()'],
        ['doc/js/middleware.md', 'docs/js/middleware.html', 'Middleware & routing'],
        ['doc/api-compatibility.md', 'docs/api-compatibility.html', 'API compatibility'],
      ],
    },
  ],
};
