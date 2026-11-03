/**
 * Site definition for qjs-modules -> https://rsenn.github.io/qjs-modules/
 *
 *   node tools/site/build.js qjs-modules --src <checkout of rsenn/qjs-modules> [--out DIR]
 *
 * Everything project-specific lives here and next to this file:
 * landing.html, favicon.svg, theme.css. The engine, markdown renderer,
 * highlighter and base stylesheet are shared (tools/site/).
 */
export default {
  repo: 'rsenn/qjs-modules',
  branch: 'main',
  name: 'qjs-modules',
  mark: '{ }',
  tagline: 'The standard library QuickJS deserves',
  description: 'WHATWG/W3C/Node-shaped native modules and JS helpers for QuickJS.',
  license: 'MIT',
  search: true,

  // Header links; hrefs are site-relative (the engine prefixes the root).
  topnav: [
    ['Get started', 'getting-started.html'],
    ['Docs', 'docs/index.html'],
    ['Compatibility', 'docs/runtime-compat.html'],
    ['Roadmap', 'roadmap.html'],
  ],

  // Site map: [markdown source in the project checkout, output path, sidebar label].
  // A doc/**.md file that is not listed here is not built, and links to it
  // fall back to a github.com blob URL.
  nav: [
    {
      group: 'Start here',
      pages: [
        ['README.md', 'getting-started.html', 'Getting started'],
        ['TODO.md', 'roadmap.html', 'Roadmap'],
      ],
    },
    {
      group: 'Reference',
      pages: [
        ['doc/README.md', 'docs/index.html', 'API reference'],
        ['doc/runtime-compat.md', 'docs/runtime-compat.html', 'Node / Bun / Deno compatibility'],
        ['doc/api-compatibility.md', 'docs/api-compatibility.html', 'Standards compatibility'],
        ['doc/api-compatibility-plan.md', 'docs/api-compatibility-plan.html', 'Compatibility roadmap'],
        ['doc/grammar.md', 'docs/grammar.html', 'Grammar'],
      ],
    },
    {
      group: 'Native — Data & Text',
      pages: [
        ['doc/native/README.md', 'docs/native/index.html', 'Native modules overview'],
        ['doc/native/archive.md', 'docs/native/archive.html', 'archive'],
        ['doc/native/arraybuffer-sink.md', 'docs/native/arraybuffer-sink.html', 'arraybuffer-sink'],
        ['doc/native/bcrypt.md', 'docs/native/bcrypt.html', 'bcrypt'],
        ['doc/native/bjson.md', 'docs/native/bjson.html', 'bjson'],
        ['doc/native/blob.md', 'docs/native/blob.html', 'blob'],
        ['doc/native/json.md', 'docs/native/json.html', 'json'],
        ['doc/native/lexer.md', 'docs/native/lexer.html', 'lexer'],
        ['doc/native/list.md', 'docs/native/list.html', 'list'],
        ['doc/native/textcode.md', 'docs/native/textcode.html', 'textcode'],
        ['doc/native/xml.md', 'docs/native/xml.html', 'xml'],
        ['doc/native/yaml.md', 'docs/native/yaml.html', 'yaml'],
      ],
    },
    {
      group: 'Native — System & I/O',
      pages: [
        ['doc/native/child-process.md', 'docs/native/child-process.html', 'child-process'],
        ['doc/native/directory.md', 'docs/native/directory.html', 'directory'],
        ['doc/native/gpio.md', 'docs/native/gpio.html', 'gpio'],
        ['doc/native/location.md', 'docs/native/location.html', 'location'],
        ['doc/native/magic.md', 'docs/native/magic.html', 'magic'],
        ['doc/native/misc.md', 'docs/native/misc.html', 'misc'],
        ['doc/native/mmap.md', 'docs/native/mmap.html', 'mmap'],
        ['doc/native/path.md', 'docs/native/path.html', 'path'],
        ['doc/native/serial.md', 'docs/native/serial.html', 'serial'],
        ['doc/native/sockets.md', 'docs/native/sockets.html', 'sockets'],
        ['doc/native/syscallerror.md', 'docs/native/syscallerror.html', 'syscallerror'],
      ],
    },
    {
      group: 'Native — Objects & Streams',
      pages: [
        ['doc/native/deep.md', 'docs/native/deep.html', 'deep'],
        ['doc/native/inspect.md', 'docs/native/inspect.html', 'inspect'],
        ['doc/native/pointer.md', 'docs/native/pointer.html', 'pointer'],
        ['doc/native/predicate.md', 'docs/native/predicate.html', 'predicate'],
        ['doc/native/tree-walker.md', 'docs/native/tree-walker.html', 'tree-walker'],
        ['doc/native/queue.md', 'docs/native/queue.html', 'queue'],
        ['doc/native/repeater.md', 'docs/native/repeater.html', 'repeater'],
        ['doc/native/virtual.md', 'docs/native/virtual.html', 'virtual'],
      ],
    },
    {
      group: 'Native — QuickJS core',
      pages: [
        ['doc/native/os.md', 'docs/native/os.html', 'os'],
        ['doc/native/std.md', 'docs/native/std.html', 'std'],
      ],
    },
    {
      group: 'WebAssembly',
      pages: [
        ['doc/native/wasm.md', 'docs/native/wasm.html', 'wasm (engines & API)'],
        ['doc/js/webassembly.md', 'docs/js/webassembly.html', 'WebAssembly global'],
        ['doc/js/wasi.md', 'docs/js/wasi.html', 'WASI'],
        ['doc/js/loaders/wasm.md', 'docs/js/loaders/wasm.html', '.wasm loader'],
      ],
    },
    {
      group: 'Native — Databases',
      pages: [
        ['doc/native/mysql.md', 'docs/native/mysql.html', 'mysql'],
        ['doc/native/pgsql.md', 'docs/native/pgsql.html', 'pgsql'],
        ['doc/native/sqlite.md', 'docs/native/sqlite.html', 'sqlite'],
      ],
    },
    {
      group: 'JS — Core & Extensions',
      pages: [
        ['doc/js/README.md', 'docs/js/index.html', 'JS modules overview'],
        ['doc/js/util.md', 'docs/js/util.html', 'util'],
        ['doc/js/iterator.md', 'docs/js/iterator.html', 'iterator'],
        ['doc/js/asyncIterator.md', 'docs/js/asyncIterator.html', 'asyncIterator'],
        ['doc/js/extendArray.md', 'docs/js/extendArray.html', 'extendArray'],
        ['doc/js/extendArrayBuffer.md', 'docs/js/extendArrayBuffer.html', 'extendArrayBuffer'],
        ['doc/js/extendMap.md', 'docs/js/extendMap.html', 'extendMap'],
        ['doc/js/extendSet.md', 'docs/js/extendSet.html', 'extendSet'],
        ['doc/js/extendFunction.md', 'docs/js/extendFunction.html', 'extendFunction'],
        ['doc/js/extendAsyncFunction.md', 'docs/js/extendAsyncFunction.html', 'extendAsyncFunction'],
        ['doc/js/extendGenerator.md', 'docs/js/extendGenerator.html', 'extendGenerator'],
        ['doc/js/extendAsyncGenerator.md', 'docs/js/extendAsyncGenerator.html', 'extendAsyncGenerator'],
      ],
    },
    {
      group: 'JS — Runtime',
      pages: [
        ['doc/js/assert.md', 'docs/js/assert.html', 'assert'],
        ['doc/js/assertStrict.md', 'docs/js/assertStrict.html', 'assertStrict'],
        ['doc/js/console.md', 'docs/js/console.html', 'console'],
        ['doc/js/process.md', 'docs/js/process.html', 'process'],
        ['doc/js/events.md', 'docs/js/events.html', 'events'],
        ['doc/js/abort.md', 'docs/js/abort.html', 'abort'],
        ['doc/js/timers.md', 'docs/js/timers.html', 'timers'],
        ['doc/js/timersPromises.md', 'docs/js/timersPromises.html', 'timersPromises'],
        ['doc/js/globals.md', 'docs/js/globals.html', 'globals'],
        ['doc/js/intl.md', 'docs/js/intl.html', 'intl'],
        ['doc/js/perf_hooks.md', 'docs/js/perf_hooks.html', 'perf_hooks'],
        ['doc/js/module.md', 'docs/js/module.html', 'module'],
        ['doc/js/require.md', 'docs/js/require.html', 'require'],
        ['doc/js/stack.md', 'docs/js/stack.html', 'stack'],
        ['doc/js/lazyGlobal.md', 'docs/js/lazyGlobal.html', 'lazyGlobal'],
      ],
    },
    {
      group: 'JS — Node & Bun',
      pages: [
        ['doc/js/node.md', 'docs/js/node.html', 'node'],
        ['doc/js/node-buffer.md', 'docs/js/node-buffer.html', 'node:buffer'],
        ['doc/js/node-child-process.md', 'docs/js/node-child-process.html', 'node:child_process'],
        ['doc/js/node-events.md', 'docs/js/node-events.html', 'node:events'],
        ['doc/js/node-os.md', 'docs/js/node-os.html', 'node:os'],
        ['doc/js/node-util.md', 'docs/js/node-util.html', 'node:util'],
        ['doc/js/bun.md', 'docs/js/bun.html', 'bun'],
        ['doc/js/bun-util.md', 'docs/js/bun-util.html', 'bun-util'],
        ['doc/js/loaders/commonjs.md', 'docs/js/loaders/commonjs.html', 'loaders/commonjs'],
        ['doc/js/loaders/file.md', 'docs/js/loaders/file.html', 'loaders/file'],
        ['doc/js/loaders/packages.md', 'docs/js/loaders/packages.html', 'loaders/packages'],
        ['doc/js/loaders/trace.md', 'docs/js/loaders/trace.html', 'loaders/trace'],
        ['doc/js/loaders/typescript.md', 'docs/js/loaders/typescript.html', 'loaders/typescript'],
      ],
    },
    {
      group: 'JS — I/O & Filesystem',
      pages: [
        ['doc/js/fs.md', 'docs/js/fs.html', 'fs'],
        ['doc/js/fsPromises.md', 'docs/js/fsPromises.html', 'fsPromises'],
        ['doc/js/io.md', 'docs/js/io.html', 'io'],
        ['doc/js/stream.md', 'docs/js/stream.html', 'stream'],
        ['doc/js/streams.md', 'docs/js/streams.html', 'streams'],
        ['doc/js/vfs.md', 'docs/js/vfs.html', 'vfs'],
        ['doc/js/glob.md', 'docs/js/glob.html', 'glob'],
        ['doc/js/file.md', 'docs/js/file.html', 'file'],
        ['doc/js/inotify.md', 'docs/js/inotify.html', 'inotify'],
        ['doc/js/tty.md', 'docs/js/tty.html', 'tty'],
        ['doc/js/terminal.md', 'docs/js/terminal.html', 'terminal'],
        ['doc/js/readline.md', 'docs/js/readline.html', 'readline'],
        ['doc/js/readlinePromises.md', 'docs/js/readlinePromises.html', 'readlinePromises'],
        ['doc/js/string_decoder.md', 'docs/js/string_decoder.html', 'string_decoder'],
        ['doc/js/textLineStream.md', 'docs/js/textLineStream.html', 'textLineStream'],
        ['doc/js/socklen_t.md', 'docs/js/socklen_t.html', 'socklen_t'],
      ],
    },
    {
      group: 'JS — JSON dialects',
      pages: [
        ['doc/js/json5.md', 'docs/js/json5.html', 'json5'],
        ['doc/js/jsonc.md', 'docs/js/jsonc.html', 'jsonc'],
        ['doc/js/jsonl.md', 'docs/js/jsonl.html', 'jsonl'],
        ['doc/js/jsonStreams.md', 'docs/js/jsonStreams.html', 'jsonStreams'],
      ],
    },
    {
      group: 'JS — Parsing & DOM',
      pages: [
        ['doc/js/dom.md', 'docs/js/dom.html', 'dom'],
        ['doc/js/xpath.md', 'docs/js/xpath.html', 'xpath'],
        ['doc/js/parser.md', 'docs/js/parser.html', 'parser'],
        ['doc/js/lex.md', 'docs/js/lex.html', 'lex'],
        ['doc/js/grammar-parsers.md', 'docs/js/grammar-parsers.html', 'grammar-parsers'],
        ['doc/js/parse-ast.md', 'docs/js/parse-ast.html', 'parse-ast'],
        ['doc/js/module-lexer.md', 'docs/js/module-lexer.html', 'module-lexer'],
        ['doc/js/lexers.md', 'docs/js/lexers.html', 'lexers'],
        ['doc/js/css3-selectors.md', 'docs/js/css3-selectors.html', 'css3-selectors'],
        ['doc/js/html.md', 'docs/js/html.html', 'html'],
        ['doc/js/url.md', 'docs/js/url.html', 'url'],
      ],
    },
    {
      group: 'JS — Databases',
      pages: [
        ['doc/js/sql.md', 'docs/js/sql.html', 'sql'],
        ['doc/js/db.md', 'docs/js/db.html', 'db'],
        ['doc/js/database.md', 'docs/js/database.html', 'database'],
        ['doc/js/dbi.md', 'docs/js/dbi.html', 'dbi'],
      ],
    },
    {
      group: 'JS — Tooling & Misc',
      pages: [
        ['doc/js/repl.md', 'docs/js/repl.html', 'repl'],
        ['doc/js/describe.md', 'docs/js/describe.html', 'describe'],
        ['doc/js/c-functions.md', 'docs/js/c-functions.html', 'c-functions'],
        ['doc/js/magic-string.md', 'docs/js/magic-string.html', 'magic-string'],
        ['doc/js/tinytest.md', 'docs/js/tinytest.html', 'tinytest'],
        ['doc/js/simple-queue.md', 'docs/js/simple-queue.html', 'simple-queue'],
        ['doc/js/password.md', 'docs/js/password.html', 'password'],
      ],
    },
  ],
};
