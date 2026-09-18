#!/usr/bin/env python3
"""Render a PSF1 bitmap console font (8xN) as a dot-matrix glyph sheet in SVG.

  make-dotfont.py /usr/share/consolefonts/Lat2-VGA8.psf.gz > dotmatrix.svg

One cell per character, ASCII 32..127 in reading order, 16 columns x 6 rows;
every set pixel becomes a round dot (a zero-length stroked subpath with
round caps, so the whole sheet is one small <path>). Transparent background, black dots: the site tints it with
CSS `mask`, so only the shape matters, not the colour.
"""
import gzip, sys

path = sys.argv[1]
data = (gzip.open if path.endswith('.gz') else open)(path, 'rb').read()
assert data[:2] == b'\x36\x04', 'not a PSF1 font'
h = data[3]                       # bytes per glyph == rows, width is always 8
glyphs = data[4:]
COLS, FIRST, LAST, R = 16, 32, 127, 0.42
n = LAST - FIRST + 1
ROWS = (n + COLS - 1) // COLS

def dot(cx, cy):                  # zero-length subpath; the round cap draws the dot
    return f'M{cx:g} {cy:g}h0'

d = []
for i in range(n):
    col, row = i % COLS, i // COLS
    g = glyphs[(FIRST + i) * h:(FIRST + i + 1) * h]
    for y in range(h):
        for x in range(8):
            if g[y] & (0x80 >> x):
                d.append(dot(col * 8 + x + 0.5, row * h + y + 0.5))
print(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {COLS * 8} {ROWS * h}" '
      f'width="{COLS * 8}" height="{ROWS * h}">')
print('<!-- dot-matrix glyph sheet: ASCII %d-%d, %d columns x %d rows, cell 8x%d.' % (FIRST, LAST, COLS, ROWS, h))
print('     Placeholder derived from a Linux console font - replace with your own artwork. -->')
print(f'<path fill="none" stroke="#000" stroke-width="{2 * R:g}" stroke-linecap="round" d="' + ''.join(d) + '"/>')
print('</svg>')
