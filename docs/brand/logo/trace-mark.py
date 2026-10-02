"""Vectorise the supplied mark, one colour at a time, into a single clean SVG.

Tracing the real artwork rather than redrawing it by eye: the shape then matches
the file the brand came from, and the colours are snapped to the design tokens so
the mark and the interface cannot drift apart.
"""
import numpy as np
import potrace
from PIL import Image

SRC = "offerline-mark.png"
# The tokens, not the raster's own values. The supplied art sits within about two
# percent of these already, so snapping costs nothing visually and keeps one
# source of truth for the colour.
FOREST = "#2a6a52"
VERM = "#d8431c"
PALE = "#c7cfc0"

im = Image.open(SRC).convert("RGBA")
a = np.asarray(im).astype(int)
alpha = a[:, :, 3] > 140
rgb = a[:, :, :3]

masks = {
    FOREST: alpha & (rgb[:, :, 1] - rgb[:, :, 0] > 25) & (rgb[:, :, 1] - rgb[:, :, 2] > 10) & (rgb[:, :, 1] < 140),
    PALE: alpha & (abs(rgb[:, :, 0] - rgb[:, :, 2]) < 25) & (rgb[:, :, 1] > 180) & (rgb[:, :, 1] < 225) & (rgb[:, :, 0] > 170),
    VERM: alpha & (rgb[:, :, 0] - rgb[:, :, 1] > 70) & (rgb[:, :, 0] > 150),
}

# Trim to the artwork so the viewBox has no dead padding.
any_ink = np.zeros_like(alpha)
for m in masks.values():
    any_ink |= m
ys, xs = np.where(any_ink)
x0, x1, y0, y1 = xs.min(), xs.max(), ys.min(), ys.max()
W, H = x1 - x0 + 1, y1 - y0 + 1
print("artwork box", W, H)


def to_path(mask):
    # A false border, because a shape touching the bitmap edge makes potrace
    # trace the canvas boundary itself and the fill comes out inverted.
    cropped = mask[y0 : y1 + 1, x0 : x1 + 1]
    padded = np.pad(cropped, 2, constant_values=False)
    # potracer compares against blacklevel 0.5, so the boolean mask goes in as is.
    bmp = potrace.Bitmap(padded)
    path = bmp.trace(turdsize=12, alphamax=1.0, opticurve=True, opttolerance=0.2)
    ph, pw = padded.shape
    out = []
    for curve in path:
        # potracer emits a curve following the canvas boundary as well as the
        # real outlines. It spans the whole bitmap, so it is recognisable and
        # dropped; left in, it inverts every fill under the even-odd rule.
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


parts = []
for colour, mask in masks.items():
    d = to_path(mask)
    parts.append(f'    <path fill="{colour}" fill-rule="evenodd" d="{d}"/>')

svg = (
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
    f'role="img" aria-label="Offerline">\n  <title>Offerline</title>\n'
    + '  <g transform="translate(-2,-2)">\n'
    + "\n".join(parts)
    + "\n  </g>\n</svg>\n"
)
open("offerline-mark.svg", "w").write(svg)
print("wrote offerline-mark.svg", len(svg), "bytes")
