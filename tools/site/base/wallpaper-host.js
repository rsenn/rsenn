/**
 * Wallpaper host: gives a site's wallpaper.js a small, stable API.
 *
 * The build inlines wallpaper.svg into <div class="wallpaper"> and loads this
 * file, then the site's own script, which calls Wallpaper.register(fn).
 * fn(ctx) runs once after the DOM is ready; see templates/art/wallpaper.js.
 *
 *   ctx.svg, ctx.groups (only <g id> elements), ctx.width, ctx.height, ctx.reduced
 *   ctx.bounds()   visible part of the viewBox {x,y,w,h} (the svg is fitted
 *                  with preserveAspectRatio="slice", so some of it is cropped)
 *   ctx.rand()     seeded PRNG (mulberry32): same sequence on every load
 *   ctx.frame(fn)  fn(timeMs, dtSeconds) per animation frame, dt clamped to
 *                  50 ms; stops while the tab is hidden; runs once (dt = 0)
 *                  under prefers-reduced-motion
 *   ctx.css(name)  computed value of a CSS custom property
 */
(function () {
  var registered = [];
  window.Wallpaper = { register: function (fn) { registered.push(fn); } };

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function start() {
    var box = document.querySelector('.wallpaper');
    var svg = box && box.querySelector('svg');
    if (!svg || !registered.length) return;

    var vb = svg.viewBox.baseVal;
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    var groups = {};
    svg.querySelectorAll('g[id]').forEach(function (g) { groups[g.id] = g; });

    var frames = [], last = 0, raf = 0;

    function tick(now) {
      raf = 0;
      var dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
      last = now;
      frames.slice().forEach(function (fn) {
        try { fn(now, dt); }
        catch (e) { console.error('wallpaper script failed, its animation stops:', e); frames.splice(frames.indexOf(fn), 1); }
      });
      if (!document.hidden) raf = requestAnimationFrame(tick);
    }

    var ctx = {
      svg: svg, groups: groups, width: vb.width, height: vb.height, reduced: reduced,
      rand: mulberry32(0x5eed),
      css: function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); },
      bounds: function () {
        var W = box.clientWidth || innerWidth, H = box.clientHeight || innerHeight;
        var s = Math.max(W / vb.width, H / vb.height);      // "slice" scale
        var w = W / s, h = H / s;
        return { x: vb.x + (vb.width - w) / 2, y: vb.y + (vb.height - h) / 2, w: w, h: h };
      },
      frame: function (fn) {
        if (reduced) { fn(0, 0); return; }
        frames.push(fn);
        if (!raf) raf = requestAnimationFrame(tick);
      }
    };

    registered.forEach(function (fn) { fn(ctx); });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf) cancelAnimationFrame(raf); raf = 0; last = 0; }
      else if (frames.length && !raf) raf = requestAnimationFrame(tick);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
