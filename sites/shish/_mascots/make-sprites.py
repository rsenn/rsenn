#!/usr/bin/env python3
"""Cut the characters out of the two Gemini concept sheets (art/source/) into
transparent PNG sprites (art/sprites/).

Per crop box: pixels close to the paper colour that connect to the box border
are background (flood fill, so cream *inside* an outlined character survives);
the boundary gets a soft alpha; small stray components (sparkles, bubbles,
smoke) are dropped. Re-run after changing a box:  python3 make-sprites.py
"""
import numpy as np
from PIL import Image
from scipy import ndimage as ndi
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SHEETS = {'tools': HERE + '/source/shell-tools.jpeg', 'puns': HERE + '/source/shish-puns.jpeg',
          'common': HERE + '/source/builtins-common.jpeg', 'special': HERE + '/source/builtins-special.jpeg',
          'other': HERE + '/source/builtins-other.jpeg',
          'core': HERE + '/source/utility-core.jpeg', 'crea': HERE + '/source/utility-creatures.jpeg',
          'more': HERE + '/source/utility-more.jpeg'}

# name: (sheet, (x0, y0, x1, y1), keep components >= this fraction of the biggest)
BOXES = {
    'folder':      ('tools', (250, 165, 475, 315), 0.10),
    'chmod':       ('tools', (895, 165, 1145, 325), 0.10),
    'chown':       ('tools', (260, 450, 525, 632), 0.10),
    'chmod-green': ('tools', (800, 490, 915, 622), 0.10),
    'chown-blue':  ('tools', (930, 505, 1095, 622), 0.10),
    'folder-sad':  ('tools', (1085, 485, 1265, 628), 0.10),
    'shell-icon':  ('tools', (400, 28, 472, 96), 0.10),
    'cat':         ('puns',  (160, 180, 340, 322), 0.22),
    'fish':        ('puns',  (445, 240, 545, 292), 0.10),
    'pipe':        ('puns',  (345, 240, 395, 275), 0.10),
    'whale':       ('puns',  (765, 170, 995, 325), 0.10),
    'hookah':      ('puns',  (1095, 180, 1255, 328), 0.10),
    'tobacco':     ('puns',  (165, 530, 365, 660), 0.10),
    'shell':       ('puns',  (392, 478, 605, 662), 0.10),
    'dec':         ('puns',  (885, 452, 1195, 668), 0.10),
    # ---- builtins-common.jpeg: frequently used
    'b-cd':        ('common', (160, 118, 445, 242), 0.10),
    'b-echo':      ('common', (595, 133, 855, 247), 0.10),
    'b-pwd':       ('common', (985, 128, 1205, 247), 0.10),
    'b-export':    ('common', (182, 343, 432, 452), 0.10),
    'b-history':   ('common', (592, 338, 835, 457), 0.10),
    'b-alias':     ('common', (958, 348, 1218, 457), 0.10),
    'b-unset':     ('common', (212, 558, 440, 667), 0.10),
    'b-exit':      ('common', (588, 553, 845, 667), 0.10),
    'b-kill':      ('common', (982, 548, 1225, 667), 0.10),
    # ---- builtins-special.jpeg
    'b-eval':      ('special', (95, 55, 450, 232), 0.10),
    'b-exit-sign': ('special', (545, 68, 885, 222), 0.10),
    'b-export-box':('special', (960, 55, 1325, 227), 0.10),
    'b-set':       ('special', (100, 338, 447, 425), 0.10),
    'b-shift':     ('special', (612, 298, 890, 442), 0.10),
    'b-readonly':  ('special', (1058, 298, 1228, 452), 0.10),
    'b-source':    ('special', (98, 528, 450, 682), 0.10),
    'b-true':      ('special', (618, 518, 815, 672), 0.10),
    'b-false':     ('special', (1058, 522, 1245, 672), 0.10),
    # ---- builtins-other.jpeg: non-special
    'b-tee':       ('other', (178, 118, 420, 237), 0.10),
    'b-cat':       ('other', (618, 128, 805, 242), 0.10),
    'b-rm':        ('other', (995, 122, 1220, 242), 0.10),
    'b-mkdir':     ('other', (183, 333, 418, 452), 0.10),
    'b-mktemp':    ('other', (608, 333, 805, 452), 0.10),
    'b-rmdir':     ('other', (985, 333, 1230, 452), 0.10),
    'b-printf':    ('other', (200, 553, 455, 662), 0.10),
    'b-readlink':  ('other', (580, 548, 855, 662), 0.10),
    'b-which':     ('other', (1030, 538, 1235, 667), 0.10),
    # ---- utility-core.jpeg / utility-creatures.jpeg / utility-more.jpeg (second batch)
    'u-less':      ('core', (545, 92, 800, 295), 0.15, 58),
    'u-cat':       ('core', (60, 405, 180, 505), 0.15, 58),
    'u-pipe-glass':('core', (200, 425, 545, 485), 0.15, 58),
    'u-tail':      ('core', (733, 395, 955, 505), 0.15, 58),
    'u-pipe-steel':('core', (975, 425, 1210, 470), 0.15, 58),
    'u-cat2':      ('core', (1235, 405, 1340, 505), 0.15, 58),
    'u-grep':      ('core', (60, 585, 175, 705), 0.15, 58),
    'u-errors':    ('core', (195, 580, 375, 690), 0.15, 58),
    'u-waterpipe': ('core', (370, 575, 540, 715), 0.15, 58),
    'u-errlog':    ('core', (550, 605, 655, 705), 0.15, 58),
    'u-sort':      ('core', (735, 605, 860, 705), 0.15, 58),
    'u-stack':     ('core', (880, 610, 980, 705), 0.15, 58),
    'u-smokepipe': ('core', (985, 620, 1205, 700), 0.15, 58),
    'u-cabinet':   ('core', (1230, 590, 1340, 705), 0.15, 58),
    'u-kill':      ('crea', (115, 175, 440, 335), 0.15, 58),
    'u-chown':     ('crea', (530, 195, 875, 335), 0.15, 58),
    'u-chmod':     ('crea', (990, 190, 1300, 335), 0.15, 58),
    'u-catpipe':   ('crea', (85, 515, 450, 650), 0.15, 58),
    'u-tee':       ('crea', (525, 470, 880, 655), 0.15, 58),
    'u-rm':        ('crea', (1000, 525, 1205, 655), 0.15, 58),
    'u-echo':      ('more', (140, 115, 260, 255), 0.15, 58),
    'u-cd':        ('more', (880, 160, 1000, 270), 0.15, 58),
    'u-signpost':  ('more', (1005, 120, 1100, 262), 0.15, 58),
    'u-hash':      ('more', (240, 340, 480, 475), 0.15, 58),
    'u-eval':      ('more', (920, 315, 1130, 485), 0.15, 58),
    'u-export':    ('more', (150, 535, 610, 725), 0.15, 58),
    'u-heredoc':   ('more', (740, 572, 1000, 705), 0.15, 58),
    'u-parser':    ('more', (1085, 545, 1345, 720), 0.15, 58),
}

def cut(im, box, keep, thr=26):
    x0, y0, x1, y1 = box
    a = np.asarray(im.crop(box).convert('RGB')).astype(np.float32)
    h, w, _ = a.shape
    # paper colour: median of a thin frame at the box border
    frame = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    paper = np.median(frame, axis=0)
    dist = np.sqrt(((a - paper) ** 2).sum(axis=2))
    bgish = dist < 26
    if thr > 26:      # graph-paper sheet: 1-2 px grid lines (mid distance) count as paper too
        mid = (dist >= 26) & (dist < 115)
        bgish = bgish | (mid & ~ndi.binary_opening(mid, structure=np.ones((3, 3))))
    lab, n = ndi.label(bgish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(border))
    # soft edge: pixels touching the background get alpha from their distance
    near = ndi.binary_dilation(bg, iterations=2) & ~bg
    alpha = np.ones((h, w), np.float32)
    alpha[bg] = 0
    alpha[near] = np.clip((dist[near] - 14) / 40, 0, 1)
    # keep only the big components
    lab2, n2 = ndi.label(alpha > 0.05, structure=np.ones((3, 3)))
    if n2:
        sizes = ndi.sum(np.ones_like(lab2), lab2, index=range(1, n2 + 1))
        ok = [i + 1 for i, s in enumerate(sizes) if s >= keep * max(sizes)]
        alpha[~np.isin(lab2, ok)] = 0
    out = np.dstack([a, alpha * 255]).astype(np.uint8)
    img = Image.fromarray(out, 'RGBA')
    bb = img.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
    return img.crop(bb) if bb else img

if __name__ == '__main__':
    only = sys.argv[1:] or list(BOXES)
    sheets = {k: Image.open(v) for k, v in SHEETS.items()}
    for name in only:
        sheet, box, keep, *thr = BOXES[name]
        s = cut(sheets[sheet], box, keep, *thr)
        s.save(f'{HERE}/sprites/{name}.png', optimize=True)
        print(f'{name:12s} {s.size[0]:4d}x{s.size[1]:<4d}')
