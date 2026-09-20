/* shish wallpaper: a looping series of shell puns, drawn by the sprites from
 * art/sprites/ (cut out of the Gemini concept sheets).
 *
 * Every BEAT seconds the stage shows one (source | pipe-or-effect | sink)
 * picture with a terminal-style caption. Only what changes between two beats
 * cross-fades, so a pair that stays keeps standing there while its caption
 * and the thing between them change.
 *
 * Edit BEATS to add or reorder scenes. The drawings are the <g id="w-*">
 * library in wallpaper.svg; elements in there may carry
 *   data-wag="deg,speed" data-pivot="x y"    sway around a pivot (the feet)
 *   data-mood="happy|sad"                    two faces of one creature
 *   <g class="emit" data-kind data-x data-y> particle source:
 *        smoke | steam | bubble | sparkle | drop
 */
Wallpaper.register(function (ctx) {
  var NS = 'http://www.w3.org/2000/svg';
  var g = ctx.groups;
  var BEAT = 6, FADE = 0.6, PACKETS = 6;

  /* [source, sink, command, output line, between, sink's mood]
     mood: 'happy' | 'sad' | 'wake' (sad -> happy) | 'sleep' (happy -> sad) */
  var BEATS = [
    ['w-cat',     'w-fish',   'cat file.txt | less',         'a cat, a pipe and a fish',         'w-pipe', 'happy'],
    ['w-whale',   'w-hookah', 'whale -file.doc | waterpipe', 'the whale meets a waterpipe',      'w-pipe', 'happy'],
    ['w-tobacco', 'w-shell',  'shell -option | shisha',      "ceci n'est pas une pipe",          'w-pipe', 'happy'],
    ['w-dec',     'w-fish',   "ls -l | grep 'fish'",         'shish@DEC:~/shell_puns$',          'w-pipe', 'happy'],
    // chmod and chown meet a folder (sad = permission denied, happy = allowed)
    ['w-chmod',   'w-folder', 'chmod +x install.sh',         'permissions set.',                 'w-sparkle', 'wake'],
    ['w-chown',   'w-folder', 'chown new_user file.txt',     'ownership transferred.',           'w-sparkle', 'wake'],
    ['w-chmod',   'w-folder', 'chmod 000 file.txt',          'nobody may read this. sorry.',     'w-sparkle', 'sleep'],
    ['w-chown',   'w-folder', 'chown -R me dir',             'the whole tree has an owner now.', 'w-sparkle', 'happy'],
    ['w-duo',     'w-folder', 'ls -l file.txt',              '# check ownership and mode',       'w-sparkle', 'sad'],
    // second sketchbook: the utilities and what runs between them
    ['w-u-cat',   'w-u-less', 'cat file.txt | less',         'two pals and a glass pipe',        'w-u-pipe-glass', 'happy'],
    ['w-u-tail',  'w-u-cat2', 'tail -f app.log | cat',       'watching the log grow',            'w-u-pipe-steel', 'happy'],
    ['w-u-errors','w-u-waterpipe', "grep ERROR app.log | waterpipe", 'filter the noise, keep the smoke', 'w-u-sort-mid', 'happy'],
    ['w-u-stack', 'w-u-cabinet', 'sort names.txt > cabinet', 'alphabetical, and filed',          'w-u-sort-mid', 'happy'],
    ['w-u-stack', 'w-u-smokepipe', 'sort names.txt | smoking pipe', "ceci n'est pas une pipe, either", 'w-u-sort-mid', 'happy'],
    ['w-u-heredoc', 'w-u-parser', 'cat <<EOF | parser',      'the parser eats the branch',       null, 'happy'],
  ].map(function (b) { return { src: b[0], sink: b[1], cmd: '$> ' + b[2], note: b[3], pipe: b[4], mood: b[5], dur: BEAT }; });


  /* the builtins parade: one mascot at a time, centred, 3.6 s each */
  var PARADE = [
    ['cd', 'cd ~/docs', '# change directory'],
    ['echo', 'echo "hello shish"', '# display text'],
    ['pwd', 'pwd', '# print working directory'],
    ['export', 'export MY_VAR="value"', '# set environment variable'],
    ['history', 'history', '# show command history'],
    ['alias', "alias m='make'", '# create shortcut'],
    ['unset', 'unset MY_VAR', '# remove variable'],
    ['exit', 'exit', '# exit shell'],
    ['kill', 'kill 1234', '# terminate process'],
    ['eval', 'eval "echo $HOME"', '# run a string as code'],
    ['exit-sign', 'exit 0', '# exit with status 0'],
    ['export-box', 'export MY_VAR="val"', '# the same, by crate'],
    ['set', 'set -o vi', '# options on and off'],
    ['shift', 'shift 2', '# drop two positional parameters'],
    ['readonly', 'readonly MY_CONST', '# no more changes'],
    ['source', '. script.sh', '# run a file in this shell'],
    ['true', 'true && echo yes', '# always succeeds'],
    ['false', 'false || echo no', '# always fails'],
    ['tee', 'echo "data" | tee out.txt', '# sends data to stdout and out.txt'],
    ['cat', 'cat long_file.txt', '# displays contents of long_file.txt'],
    ['rm', 'rm temp_file', '# removes temp_file'],
    ['mkdir', 'mkdir new_project', '# creates new_project directory'],
    ['mktemp', 'mktemp', '# creates a unique temporary file'],
    ['rmdir', 'rmdir empty_dir', '# removes empty_dir'],
    ['printf', 'printf "User: %s, Date: %s\\n" "$USER" "$(date)"', '# formatted output'],
    ['readlink', 'readlink link.so', '# shows target of a symbolic link'],
    ['which', 'which ls', '# finds the executable for ls'],
    // second sketchbook
    ['u-less-solo', 'less /var/log/syslog', '# a pager that reads slowly'],
    ['u-tail-solo', 'tail -f app.log', '# follow the roll'],
    ['u-kill', 'kill -9 1234', '# the reaper visits'],
    ['u-chown', 'chown alice:staff report.pdf', '# ownership transferred'],
    ['u-chmod', 'chmod 755 project/', '# rwx for the owner'],
    ['u-catpipe', 'cat notes.txt | cat', '# two cats, one pipe'],
    ['u-tee', 'echo data | tee a.txt b.txt', '# one stream, two files'],
    ['u-rm', 'rm -rf build/', '# sweep it up'],
    ['u-echo', 'echo hello', '# hello, hello, hello ...'],
    ['u-cd', 'cd ~/mountain', '# a slow trip to a signpost'],
    ['u-hash', 'hash sha256 file.iso', '# a1b2#c3d4#'],
    ['u-eval', 'eval "$(ssh-agent)"', '# a string becomes code'],
    ['u-export', 'export MY_VAR=1', '# ships to every child process']
  ].map(function (p) { return { src: p[0].indexOf('u-') === 0 ? 'w-' + p[0] : 'w-b-' + p[0], sink: null, cmd: 'shish$ ' + p[1], note: p[2], pipe: null, mood: 'happy', dur: 3.6, solo: true }; });
  BEATS = BEATS.concat(PARADE);

  var slotSrc = g['wp-src'], slotPipe = g['wp-pipe'], slotSink = g['wp-sink'], fx = g['wp-fx'], stage = g['wp-stage'];
  var capG = g['wp-cap'], panel = ctx.svg.querySelector('#wp-panel'), capCmd = ctx.svg.querySelector('#wp-cmd'), capSub = ctx.svg.querySelector('#wp-sub');   // groups() only lists <g>
  var SRC_X = -370, SINK_X = 370;

  var slots = {
    src:  { el: slotSrc,  x: SRC_X,  id: null, wag: [], mood: [], emit: [], alpha: 1 },
    pipe: { el: slotPipe, x: 0,      id: null, wag: [], mood: [], emit: [], alpha: 1, flow: null },
    sink: { el: slotSink, x: SINK_X, id: null, wag: [], mood: [], emit: [], alpha: 1 },
  };
  var particles = [], packets = [], ambient = [];

  function num(s, d) { var n = parseFloat(s); return isNaN(n) ? d : n; }
  function el(tag, cls) { var n = document.createElementNS(NS, tag); if (cls) n.setAttribute('class', cls); return n; }

  /* ---------------------------------------------------------------- slots */

  function put(slot, id) {
    slot.el.textContent = '';
    slot.id = id;
    if (!id) { slot.wag = []; slot.mood = []; slot.emit = []; if ('flow' in slot) slot.flow = null; return; }
    var node = g[id].cloneNode(true);
    node.removeAttribute('id');
    slot.el.appendChild(node);
    slot.wag = [].map.call(node.querySelectorAll('[data-wag]'), function (e) {
      var w = e.getAttribute('data-wag').split(','), p = (e.getAttribute('data-pivot') || '0 0').split(/\s+/);
      return { el: e, amp: num(w[0], 2), speed: num(w[1], 1), px: num(p[0], 0), py: num(p[1], 0), ph: ctx.rand() * 6.28 };
    });
    slot.mood = [].map.call(node.querySelectorAll('[data-mood]'), function (e) {
      return { el: e, happy: e.getAttribute('data-mood') === 'happy' };
    });
    slot.emit = [].map.call(node.querySelectorAll('.emit'), function (e) {
      return { kind: e.getAttribute('data-kind'), x: num(e.getAttribute('data-x'), 0), y: num(e.getAttribute('data-y'), 0),
               h: num(e.getAttribute('data-h'), 40), acc: ctx.rand(), slot: slot };
    });
    if ('flow' in slot) slot.flow = node.querySelector('.flow');
  }

  function sway(slot, t) {
    slot.wag.forEach(function (w) {
      var a = Math.sin(t * w.speed * 2 + w.ph) * w.amp;
      w.el.setAttribute('transform', 'rotate(' + a.toFixed(2) + ' ' + w.px + ' ' + w.py + ')');
    });
  }

  /* how happy the sink creature is (0 sad .. 1 happy) over the beat */
  function happiness(mode, local) {
    if (mode === 'happy') return 1;
    if (mode === 'sad') return 0;
    var u = Math.max(0, Math.min(1, (local - 1.2) / 1.4)), e = u * u * (3 - 2 * u);
    return mode === 'wake' ? e : 1 - e;
  }

  function setMood(slot, h) {
    slot.mood.forEach(function (m) { m.el.style.opacity = m.happy ? h : 1 - h; });
  }

  /* ------------------------------------------------------------ particles */

  var KIND = {                       // spawns per second, lifetime in seconds
    smoke:   { rate: 0.6, life: 4.2 },
    steam:   { rate: 1.2, life: 3.0 },
    bubble:  { rate: 2.4, life: 1.8 },
    sparkle: { rate: 1.5, life: 1.5 },
    drop:    { rate: 0.7, life: 1.4 },
  };

  var STAR = 'M0 -1Q.18 -.18 1 0Q.18 .18 0 1Q-.18 .18 -1 0Q-.18 -.18 0 -1Z';

  function spawn(e) {
    var k = KIND[e.kind], p = { kind: e.kind, x: e.x + (e.slot.x || 0), y: e.y, age: 0, life: k.life, h: e.h, r: ctx.rand(), slot: e.slot };
    if (e.kind === 'smoke') { p.node = el('ellipse', 'wisp'); p.node.setAttribute('rx', 5); p.node.setAttribute('ry', 2.5); }
    else if (e.kind === 'steam') { p.node = el('circle', 'wisp'); p.node.setAttribute('r', 5); }
    else if (e.kind === 'bubble') { p.node = el('circle', 'bub'); p.node.setAttribute('r', 4 + p.r * 7); p.x += (p.r - 0.5) * 50; }
    else if (e.kind === 'sparkle') {
      p.node = el('path'); p.node.setAttribute('d', STAR);
      p.node.setAttribute('style', 'fill:' + (p.r > 0.5 ? 'var(--accent)' : 'var(--teal)'));
      p.x += (p.r - 0.5) * 90; p.y += (ctx.rand() - 0.5) * 90;
    }
    else { p.node = el('path', 'bub'); p.node.setAttribute('d', 'M0 -9C7 0 7 7 0 7S-7 0 0 -9Z'); }
    fx.appendChild(p.node);
    particles.push(p);
  }

  function moveParticle(p) {
    var u = p.age / p.life, x = p.x, y = p.y, a = Math.sin(Math.PI * Math.min(1, u * 1.15));
    if (p.kind === 'smoke') {
      y -= u * 120; x += Math.sin(u * 6 + p.r * 6) * 14 + u * 26;
      p.node.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + (1 + u * 5).toFixed(2) + ')');
    } else if (p.kind === 'steam') {
      y -= u * 90; x += Math.sin(u * 9 + p.r * 6) * 10; p.node.setAttribute('cx', x.toFixed(1)); p.node.setAttribute('cy', y.toFixed(1));
    } else if (p.kind === 'bubble') {
      y -= u * p.h * 2; x += Math.sin(u * 8 + p.r * 6) * 6; a = 1 - u * u; p.node.setAttribute('cx', x.toFixed(1)); p.node.setAttribute('cy', y.toFixed(1));
    } else if (p.kind === 'sparkle') {
      y -= u * 24; var s = (10 + p.r * 12) * Math.sin(Math.PI * u); a = 1;
      p.node.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ') scale(' + s.toFixed(2) + ') rotate(' + (u * 60).toFixed(0) + ')');
    } else {
      y += u * u * 70; a = 1 - u; p.node.setAttribute('transform', 'translate(' + x.toFixed(1) + ' ' + y.toFixed(1) + ')');
    }
    p.node.style.opacity = Math.max(0, a) * p.slot.alpha;
  }

  function stepParticles(dt) {
    ['src', 'pipe', 'sink'].forEach(function (name) {
      slots[name].emit.forEach(function (e) {
        e.acc += KIND[e.kind].rate * dt;
        while (e.acc >= 1) { e.acc -= 1; spawn(e); }
      });
    });
    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.age += dt;
      if (p.age >= p.life || p.slot.emit.every(function (e) { return e.kind !== p.kind; })) { fx.removeChild(p.node); particles.splice(i, 1); }
      else moveParticle(p);
    }
  }

  /* -------------------------------------------------------- data packets */

  for (var n = 0; n < PACKETS; n++) {
    var r = el('rect');
    r.setAttribute('width', 16); r.setAttribute('height', 16); r.setAttribute('x', -8); r.setAttribute('y', -8); r.setAttribute('rx', 4);
    r.setAttribute('style', 'fill:var(--accent);stroke:var(--fg);stroke-width:2');
    fx.appendChild(r);
    packets.push(r);
  }

  function stepPackets(t) {
    var f = slots.pipe.flow, len = f && f.getTotalLength ? f.getTotalLength() : 0;
    packets.forEach(function (r, i) {
      if (!len) { r.style.opacity = 0; return; }
      var u = (t * 0.2 + i / PACKETS) % 1, pt = f.getPointAtLength(u * len);
      r.setAttribute('transform', 'translate(' + pt.x.toFixed(1) + ' ' + pt.y.toFixed(1) + ') rotate(' + (u * 300).toFixed(0) + ')');
      r.style.opacity = slots.pipe.alpha * Math.sin(Math.PI * u);
    });
  }

  /* ------------------------------------------------------------- caption */

  function setCaption(b) {
    capCmd.textContent = b.cmd;
    capSub.textContent = b.note;
    capCmd.setAttribute('x', 0); capCmd.setAttribute('y', 0);
    capSub.setAttribute('x', 0); capSub.setAttribute('y', 40);
    var w = Math.max(capCmd.getComputedTextLength() || 0, capSub.getComputedTextLength() || 0);
    panel.setAttribute('x', -24); panel.setAttribute('y', -40);
    panel.setAttribute('width', (w + 48).toFixed(0)); panel.setAttribute('height', 100);
    capG.setAttribute('transform', 'translate(' + (-w / 2).toFixed(0) + ' 200)');
  }

  /* --------------------------------------------------- bubbles & sparkles */

  [].forEach.call(ctx.svg.querySelectorAll('#wp-ambient > g'), function (n) {
    ambient.push({ el: n, x: num(n.getAttribute('data-x'), 0), y: num(n.getAttribute('data-y'), 0), v: 8 + ctx.rand() * 14, ph: ctx.rand() * 6.28 });
  });

  function drift(dt, t) {
    ambient.forEach(function (a) {
      a.y -= a.v * dt;
      if (a.y < -60) a.y = 960;
      a.el.setAttribute('transform', 'translate(' + (a.x + Math.sin(t * 0.4 + a.ph) * 16).toFixed(1) + ' ' + a.y.toFixed(1) + ')');
    });
  }

  /* -------------------------------------------------------------- layout */

  function layout() {
    var b = ctx.bounds();
    var s = Math.max(0.42, Math.min(b.w * 0.92 / 1120, b.h * 0.42 / 470, 0.8));
    stage.setAttribute('transform', 'translate(' + (b.x + b.w / 2).toFixed(0) + ' ' + (b.y + b.h - 310 * s).toFixed(0) + ') scale(' + s.toFixed(3) + ')');
  }
  window.addEventListener('resize', layout);

  /* -------------------------------------------------------------- frames */

  var STARTS = [], TOTAL = 0;
  BEATS.forEach(function (b) { STARTS.push(TOTAL); TOTAL += b.dur; });

  var t = 0, beatIdx = -1;

  function alphaFor(name, i, local) {
    var len = BEATS.length, cur = BEATS[i], prev = BEATS[(i + len - 1) % len], next = BEATS[(i + 1) % len];
    var a = 1;
    if (prev[name] !== cur[name] && local < FADE) a *= local / FADE;
    if (next[name] !== cur[name] && cur.dur - local < FADE) a *= (cur.dur - local) / FADE;
    return a;
  }

  function setBeat(i) {
    var b = BEATS[i];
    slots.src.x = b.solo ? 0 : SRC_X;
    if (slots.src.id !== b.src) put(slots.src, b.src);
    if (slots.sink.id !== b.sink) put(slots.sink, b.sink);
    if (slots.pipe.id !== b.pipe) {
      put(slots.pipe, b.pipe);
      particles.slice().forEach(function (p) { if (p.slot === slots.pipe) { fx.removeChild(p.node); particles.splice(particles.indexOf(p), 1); } });
    }
    setCaption(b);
    beatIdx = i;
  }

  layout();

  ctx.frame(function (now, dt) {
    t += dt;
    var tt = t % TOTAL, i = 0;
    while (i < BEATS.length - 1 && tt >= STARTS[i + 1]) i++;
    var local = tt - STARTS[i], b = BEATS[i];
    if (i !== beatIdx) setBeat(i);

    ['src', 'pipe', 'sink'].forEach(function (name) {
      var s = slots[name];
      s.alpha = alphaFor(name, i, local);
      s.el.style.opacity = s.alpha;
      s.el.setAttribute('transform', 'translate(' + s.x + ' ' + (name === 'pipe' ? 0 : (Math.sin(t * 1.5 + (name === 'src' ? 1 : 2.4)) * 4).toFixed(1)) + ')');
      sway(s, t);
    });
    setMood(slots.sink, happiness(b.mood, local));
    setMood(slots.src, 1);

    capG.style.opacity = Math.max(0, Math.min(local / FADE, (b.dur - local) / FADE, 1));

    stepPackets(t);
    stepParticles(dt);
    drift(dt, t);
  });
});
