#!/usr/bin/env python3
"""Second sketchbook: add the u-* sprites (utility-*.jpeg sheets) to wallpaper.svg
as <g id="w-u-*"> groups. Idempotent: rewrites the block between the markers.
Sizes come from the PNGs; roles: creature (pair scene, <=250 wide), mid (between the
pair, 150 tall), pipe (long tube centred on the flow line), solo (centred, <=560 wide)."""
import os, re
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
S = HERE + '/sprites/'
ROLE = {
  'creature': ['cat', 'less', 'tail', 'cat2', 'errors', 'waterpipe', 'stack', 'cabinet', 'sort', 'smokepipe', 'heredoc', 'parser'],
  'mid': ['grep', 'sort-mid'],
  'pipe': ['pipe-glass', 'pipe-steel'],
  'solo': ['kill', 'chown', 'chmod', 'catpipe', 'tee', 'rm', 'echo', 'hash', 'eval', 'export', 'less-solo', 'tail-solo'],
}
ALIAS = {'sort-mid': 'sort', 'less-solo': 'less', 'tail-solo': 'tail'}
EMIT = {'smokepipe': '<g class="emit" data-kind="smoke" data-x="{x}" data-y="{y}"/>'}
WAG = {'pipe': None}

def size(n): return Image.open(S + 'u-%s.png' % ALIAS.get(n, n)).size

def fit(n, role):
    w, h = size(n)
    wmax, hmax = {'creature': (250, 235), 'mid': (200, 140), 'pipe': (400, 90), 'solo': (560, 250)}[role]
    k = min(wmax / w, hmax / h, 2.8)
    return w * k, h * k

def group(n, role):
    src = ALIAS.get(n, n)
    w, h = fit(n, role)
    if role == 'pipe':
        return '<g id="w-u-%s"><path class="flow" d="M-330 64H330"/><image href="@/assets/sprites/u-%s.png" x="%d" y="%d" width="%d" height="%d"/></g>' % (n, src, -w/2, 64 - h/2, w, h)
    extra = ''
    if n in EMIT: extra = EMIT[n].format(x=int(-w*0.42), y=int(130 - h*0.9))
    return ('<g id="w-u-%s"><g data-wag="1.8,1.3" data-pivot="0 130"><image href="@/assets/sprites/u-%s.png" x="%d" y="%d" width="%d" height="%d"/></g>%s</g>'
            % (n, src, -w/2, 130 - h, w, h, extra))

def composite(name, parts):
    out = []
    for n, x, wmax, hmax in parts:
        w, h = size(n); k = min(wmax / w, hmax / h, 2.8); w, h = w*k, h*k
        out.append('<g data-wag="1.8,1.3" data-pivot="%d 130"><image href="@/assets/sprites/u-%s.png" x="%d" y="%d" width="%d" height="%d"/></g>' % (x, n, x - w/2, 130 - h, w, h))
    return '<g id="w-u-%s">%s</g>' % (name, ''.join(out))

lines = ['<!-- second sketchbook (utility-*.jpeg) -->']
for role, names in ROLE.items():
    for n in names: lines.append('  ' + group(n, role))
lines.append('  ' + composite('cd', [('cd', -110, 240, 200), ('signpost', 120, 150, 240)]))
block = '\n'.join(lines)

p = HERE + '/wallpaper.svg'
s = open(p).read()
B, E_ = '<!-- BEGIN second-sketchbook -->', '<!-- END second-sketchbook -->'
new = B + '\n' + block + '\n' + E_
if B in s: s = re.sub(re.escape(B) + '.*?' + re.escape(E_), lambda m: new, s, flags=re.S)
else: s = s.replace('</defs>', new + '\n</defs>', 1)
open(p, 'w').write(s)
print('ok', len(lines) - 1, 'groups')
