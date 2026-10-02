"""Vectorise the supplied wordmark into an SVG that follows the theme.

The supplied art sets the word in near black with one forest green accent. A
raster carries those colours with it, which is why the interface needed a light
copy and a dark copy of the same word. Traced, the ink becomes currentColor and
takes the colour of whatever it sits on, and only the green stays fixed, so one
file serves both themes and scales to any size.

Same method as trace.py for the mark: trace the real artwork rather than redraw
it, so the letterforms stay the designer's.
"""
import numpy as np
import potrace
from PIL import Image

SRC = "/tmp/claude-0/-home-claude/fd5e6935-8b66-558d-8f36-4f6550adf89b/scratchpad/brand/offerline-wordmark.png"
OUT = "/home/claude/pass/fe/src/assets/brand/offerline-wordmark.svg"

FOREST = "#2a6a52"

im = Image.open(SRC).convert("RGBA")
a = np.asarray(im).astype(int)
alpha = a[:, :, 3] > 140
rgb = a[:, :, :3]

green = alpha & (rgb[:, :, 1] - rgb[:, :, 0] > 25) & (rgb[:, :, 1] - rgb[:, :, 2] > 10)
ink = alpha & ~green

any_ink = ink | green
ys, xs = np.where(any_ink)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
W, H = x1 - x0 + 1, y1 - y0 + 1
print("artwork box", W, H, "ink px", ink.sum(), "green px", green.sum())


def to_path(mask):
    cropped = mask[y0 : y1 + 1, x0 : x1 + 1]
    padded = np.pad(cropped, 2, constant_values=False)
    bmp = potrace.Bitmap(padded)
    path = bmp.trace(turdsize=6, alphamax=1.0, opticurve=True, opttolerance=0.2)
    ph, pw = padded.shape
    out = []
    for curve in path:
        pts = [(curve.start_point.x, curve.start_point.y)] + [
            (s.end_point.x, s.end_point.y) for s in curve
        ]
        bx = max(x for x, _ in pts) - min(x for x, _ in pts)
        by = max(y for _, y in pts) - min(y for _, y in pts)
        if bx > pw * 0.97 and by > ph * 0.97:
            continue
        sp = curve.start_point
        out.append(f"M{sp.x:.1f} {sp.y:.1f}")
        for seg in curve:
            ep = seg.end_point
            if seg.is_corner:
                c = seg.c
                out.append(f"L{c.x:.1f} {c.y:.1f}L{ep.x:.1f} {ep.y:.1f}")
            else:
                c1, c2 = seg.c1, seg.c2
                out.append(
                    f"C{c1.x:.1f} {c1.y:.1f} {c2.x:.1f} {c2.y:.1f} {ep.x:.1f} {ep.y:.1f}"
                )
        out.append("Z")
    return "".join(out)


svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
    f'role="img" aria-label="Offerline">\n  <title>Offerline</title>\n'
    '  <g transform="translate(-2,-2)">\n'
    f'    <path fill="currentColor" fill-rule="evenodd" d="{to_path(ink)}"/>\n'
    f'    <path fill="{FOREST}" fill-rule="evenodd" d="{to_path(green)}"/>\n'
    "  </g>\n</svg>\n"
)
open(OUT, "w").write(svg)
print("wrote", OUT, len(svg), "bytes")
