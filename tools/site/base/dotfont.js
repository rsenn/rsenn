/**
 * Dot-font: draws chosen headings/labels with a glyph-sheet font (dot-matrix,
 * pixel, ...) instead of a system font.
 *
 * The build defines window.DOTFONT = { sheet, cols, first, upper, apply } and
 * assets/art.css carries the glyph geometry. Each mapped character becomes an
 * inline-block <span class="dm" style="--c:col;--r:row"> whose CSS mask picks
 * one cell out of the sheet and is painted with currentColor - so it follows
 * theme, hover colour and light/dark for free.
 *
 * Progressive enhancement: nothing changes until the sheet has loaded; the
 * original text stays readable to assistive tech through aria-label, and
 * characters outside the sheet stay ordinary text.
 */
(function () {
  var cfg = window.DOTFONT;
  if (!cfg) return;

  function glyph(ch) {
    if (cfg.upper) ch = ch.toUpperCase();
    var i = ch.charCodeAt(0) - cfg.first;
    if (i < 0 || i >= cfg.cols * cfg.rows) return null;
    var s = document.createElement('span');
    s.className = 'dm';
    s.style.setProperty('--c', i % cfg.cols);
    s.style.setProperty('--r', Math.floor(i / cfg.cols));
    s.setAttribute('aria-hidden', 'true');
    return s;
  }

  /* one nowrap span per word, so a title breaks between words, never inside one */
  function convert(node) {
    var frag = document.createDocumentFragment();
    node.nodeValue.split(/(\s+)/).forEach(function (part) {
      if (!part) return;
      if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
      var word = document.createElement('span'), buf = '';
      word.className = 'dm-word';
      function flush() { if (buf) { word.appendChild(document.createTextNode(buf)); buf = ''; } }
      Array.from(part).forEach(function (ch) {
        var g = glyph(ch);
        if (g) { flush(); word.appendChild(g); } else buf += ch;
      });
      flush();
      frag.appendChild(word);
    });
    node.parentNode.replaceChild(frag, node);
  }

  function apply(el) {
    if (el.classList.contains('dm-on')) return;
    var label = el.textContent.trim();
    var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n;
    while ((n = walker.nextNode())) if (n.nodeValue.trim() && !n.parentNode.closest('.anchor')) nodes.push(n);
    nodes.forEach(convert);
    el.classList.add('dm-on');
    el.setAttribute('aria-label', label);
  }

  function run() {
    document.querySelectorAll(cfg.apply.join(',')).forEach(apply);
  }

  var img = new Image();
  img.onload = function () {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
    else run();
  };
  img.src = cfg.sheet;
})();
