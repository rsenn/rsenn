/* Live wallpaper, example: shapes drift, bunch together, collide and merge.
 *
 * Loaded after the wallpaper host (assets/wallpaper-host.js) as a plain
 * script. It registers one function; the host calls it once with:
 *
 *   svg        the inlined <svg> element
 *   groups     { id: <g> }   every <g id> in the file
 *   width/height             viewBox size
 *   bounds()   {x,y,w,h}     the part of the viewBox currently on screen
 *   reduced    true if the visitor asked for reduced motion (render still)
 *   rand()     seeded 0..1 random (same sequence every load)
 *   frame(fn)  fn(timeMs, dtSeconds) every animation frame; paused when the
 *              tab is hidden. Not called repeatedly when `reduced`.
 *   css(name)  computed value of a CSS variable, e.g. css('--accent')
 *
 * Here: every child of a <g class="shapes"> is an actor.
 *  - near actors attract each other (bunching)
 *  - overlapping actors merge: the bigger one absorbs the smaller (area adds
 *    up), the smaller respawns at the edge after a few seconds
 *  - an actor that grows too big bursts into two halves
 */
Wallpaper.register(function (ctx) {
  var actors = [];

  Object.keys(ctx.groups).forEach(function (id) {
    var g = ctx.groups[id];
    if (!g.classList.contains('shapes')) return;
    Array.prototype.forEach.call(g.children, function (el) {
      var b = el.getBBox();
      var a = {
        el: el,
        cx: b.x + b.width / 2, cy: b.y + b.height / 2,   // authored centre
        x: b.x + b.width / 2, y: b.y + b.height / 2,
        r0: Math.max(b.width, b.height) / 2 * 0.9,        // collision radius
        s: 1, rot: ctx.rand() * 360, spin: (ctx.rand() - 0.5) * 24,
        vx: (ctx.rand() - 0.5) * 30, vy: (ctx.rand() - 0.5) * 30,
        alive: true, wake: 0, fade: 1
      };
      actors.push(a);
    });
  });

  function draw(a) {
    a.el.setAttribute('transform',
      'translate(' + a.x.toFixed(1) + ' ' + a.y.toFixed(1) + ') rotate(' + a.rot.toFixed(1) +
      ') scale(' + a.s.toFixed(3) + ') translate(' + (-a.cx) + ' ' + (-a.cy) + ')');
    a.el.style.opacity = a.alive ? '' : '0';
  }

  function radius(a) { return a.r0 * a.s; }

  function respawn(a) {
    var b = ctx.bounds(), edge = Math.floor(ctx.rand() * 4);
    a.s = 1;
    a.x = edge === 0 ? b.x : edge === 1 ? b.x + b.w : b.x + ctx.rand() * b.w;
    a.y = edge === 2 ? b.y : edge === 3 ? b.y + b.h : b.y + ctx.rand() * b.h;
    a.vx = (b.x + b.w / 2 - a.x) * 0.02 + (ctx.rand() - 0.5) * 20;
    a.vy = (b.y + b.h / 2 - a.y) * 0.02 + (ctx.rand() - 0.5) * 20;
    a.alive = true;
  }

  function merge(big, small) {
    var m1 = radius(big) * radius(big), m2 = radius(small) * radius(small), m = m1 + m2;
    big.vx = (big.vx * m1 + small.vx * m2) / m;
    big.vy = (big.vy * m1 + small.vy * m2) / m;
    big.s = Math.sqrt(m) / big.r0;                         // areas add up
    small.alive = false;
    small.wake = 4 + ctx.rand() * 6;                       // seconds until respawn
    if (big.s > 2.6) burst(big);
  }

  function burst(a) {
    var twin = actors.filter(function (o) { return !o.alive; })[0];
    a.s /= Math.SQRT2;
    if (!twin) return;
    twin.alive = true; twin.wake = 0;
    twin.x = a.x; twin.y = a.y; twin.s = a.s;
    twin.vx = -a.vx - 25; twin.vy = -a.vy + 25;
    a.vx += 25; a.vy -= 25;
  }

  function step(dt) {
    var b = ctx.bounds(), i, j, a, o, dx, dy, d, f;

    for (i = 0; i < actors.length; i++) {
      a = actors[i];
      if (!a.alive) { if ((a.wake -= dt) <= 0) respawn(a); continue; }
      for (j = i + 1; j < actors.length; j++) {
        o = actors[j];
        if (!o.alive) continue;
        dx = o.x - a.x; dy = o.y - a.y;
        d = Math.sqrt(dx * dx + dy * dy) || 1;
        if (d < radius(a) + radius(o)) {                   // collision -> merge
          if (radius(a) >= radius(o)) merge(a, o); else merge(o, a);
          if (!a.alive) break;
          continue;
        }
        if (d < 320) {                                     // gentle attraction
          f = 900 / (d * d) * dt * 60;
          a.vx += dx / d * f * (radius(o) / 40); a.vy += dy / d * f * (radius(o) / 40);
          o.vx -= dx / d * f * (radius(a) / 40); o.vy -= dy / d * f * (radius(a) / 40);
        }
      }
    }

    actors.forEach(function (a) {
      if (!a.alive) return;
      var sp = Math.sqrt(a.vx * a.vx + a.vy * a.vy), max = 46;
      if (sp > max) { a.vx *= max / sp; a.vy *= max / sp; }
      a.x += a.vx * dt; a.y += a.vy * dt; a.rot += a.spin * dt;
      if (a.x < b.x - 80) a.x = b.x + b.w + 80; else if (a.x > b.x + b.w + 80) a.x = b.x - 80;   // wrap
      if (a.y < b.y - 80) a.y = b.y + b.h + 80; else if (a.y > b.y + b.h + 80) a.y = b.y - 80;
      if (a.s > 1.0001) a.s = Math.max(1, a.s - dt * 0.02);   // slowly deflate again
    });
  }

  actors.forEach(draw);
  if (ctx.reduced) return;                                   // still picture only
  ctx.frame(function (t, dt) { step(dt); actors.forEach(draw); });
});
