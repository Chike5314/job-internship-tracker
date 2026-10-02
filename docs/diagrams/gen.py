#!/usr/bin/env python3
"""Emit a standalone use case diagram SVG using presentation attributes only,
so it survives import into Word, LibreOffice, Figma and Illustrator."""

INK = "#1c1a15"
MUTED = "#5c5748"
SUBTLE = "#736d5c"
RULE = "#c2bba8"
HAIR = "#ded8c9"
FOREST = "#1f5540"
VERM = "#b93514"
UCFILL = "#ffffff"
PAPER = "#f4f2ed"
PANEL = "#fdfbf7"

SANS = "'Source Sans 3','Segoe UI',Helvetica,Arial,sans-serif"
MONO = "'IBM Plex Mono',Consolas,'Courier New',monospace"

o = []
A = o.append

A('<?xml version="1.0" encoding="UTF-8"?>')
A('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 1140" width="1440" height="1140" '
  'role="img" aria-label="Use case diagram for the Offerline application tracker.">')
A(f'<rect x="0" y="0" width="1440" height="1140" fill="{PANEL}"/>')

# arrow markers
A('<defs>')
for mid, col in (("arrI", FOREST), ("arrE", VERM)):
    A(f'<marker id="{mid}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" '
      f'orient="auto-start-reverse"><path d="M0.5,0.5 L9.5,5 L0.5,9.5" fill="none" stroke="{col}" '
      f'stroke-width="1.6"/></marker>')
A('</defs>')

# system boundary
A(f'<rect x="200" y="200" width="1040" height="880" rx="18" fill="{PAPER}" stroke="{RULE}" stroke-width="1.5"/>')

def text(x, y, s, size=13, weight="500", fill=INK, anchor="middle", family=SANS, ls=None):
    extra = f' letter-spacing="{ls}"' if ls else ""
    A(f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" '
      f'fill="{fill}" text-anchor="{anchor}"{extra}>{s}</text>')

text(224, 238, "Offerline Application Tracker", size=15, weight="600", anchor="start")
for x, s in ((400, "APPLICANT"), (720, "INCLUDED AND EXTENDING"), (1040, "COMPANY ACCOUNT")):
    text(x, 274, s, size=11, weight="600", fill=SUBTLE, ls="1.1")
text(1040, 862, "ADMIN", size=11, weight="600", fill=SUBTLE, ls="1.1")

def line(x1, y1, x2, y2, col=RULE, w=1.4, dash=None, marker=None):
    d = f' stroke-dasharray="{dash}"' if dash else ""
    m = f' marker-end="url(#{marker})"' if marker else ""
    A(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{col}" stroke-width="{w}" fill="none"{d}{m}/>')

def assoc(ax, ay, elbow, entry, cy):
    """Actor to a use case, bent at a vertical bus in the margin so no line
    ever crosses an intervening ellipse."""
    A(f'<polyline points="{ax},{ay} {elbow},{cy} {entry},{cy}" fill="none" '
      f'stroke="{RULE}" stroke-width="1.4" stroke-linejoin="round"/>')

for cy in (330, 420, 510, 600, 690, 780, 870, 960):
    assoc(116, 645, 252, 280, cy)
for cy in (330, 420, 510, 600, 690, 780):
    assoc(1324, 555, 1188, 1160, cy)
for cy in (900, 990):
    assoc(1324, 945, 1188, 1160, cy)
line(720, 172, 720, 342)

def uc(cx, cy, lines):
    A(f'<ellipse cx="{cx}" cy="{cy}" rx="120" ry="33" fill="{UCFILL}" stroke="{RULE}" stroke-width="1.5"/>')
    if len(lines) == 1:
        text(cx, cy + 5, lines[0])
    else:
        text(cx, cy - 4, lines[0])
        text(cx, cy + 13, lines[1])

for cy, lab in (
    (330, ["Register and sign in"]), (420, ["Manage profile"]), (510, ["Find opportunities"]),
    (600, ["Submit application"]), (690, ["Amend or withdraw", "application"]),
    (780, ["Track application", "status"]), (870, ["Respond to offer"]),
    (960, ["Respond to interview", "invitation"])):
    uc(400, cy, lab)

for cy, lab in (
    (375, ["Sign in with Google"]), (465, ["View applicant", "documents"]),
    (555, ["Update applications", "in bulk"]), (645, ["Upload documents"]),
    (735, ["Issue calendar", "invitation"])):
    uc(720, cy, lab)

for cy, lab in (
    (330, ["Register company"]), (420, ["Manage postings"]), (510, ["Review applications"]),
    (600, ["Update application", "status"]), (690, ["Schedule interview"]),
    (780, ["View analytics", "and export"]), (900, ["Verify company"]),
    (990, ["Suspend company", "or posting"])):
    uc(1040, cy, lab)

# relationships
rels = [
    (613, 360, 507, 345, VERM, "arrE", 560, 337, "«extend»"),
    (933, 495, 827, 480, FOREST, "arrI", 880, 472, "«include»"),
    (827, 570, 933, 585, VERM, "arrE", 880, 562, "«extend»"),
    (507, 615, 613, 630, FOREST, "arrI", 560, 607, "«include»"),
    (933, 705, 827, 720, FOREST, "arrI", 880, 697, "«include»"),
]
for x1, y1, x2, y2, col, mk, tx, ty, lab in rels:
    line(x1, y1, x2, y2, col=col, dash="7 5", marker=mk)
    text(tx, ty, lab, size=11, weight="500", fill=col, family=MONO)

def actor(x, y, label, sub=None):
    A(f'<circle cx="{x}" cy="{y}" r="11" fill="{UCFILL}" stroke="{INK}" stroke-width="1.6"/>')
    for x1, y1, x2, y2 in ((x, y+11, x, y+36), (x-17, y+22, x+17, y+22),
                           (x, y+36, x-13, y+58), (x, y+36, x+13, y+58)):
        A(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{INK}" stroke-width="1.6" '
          f'stroke-linecap="round"/>')
    text(x, y + 78, label, size=13, weight="600")
    if sub:
        text(x, y + 94, sub, size=11, weight="400", fill=SUBTLE)

actor(100, 615, "Applicant")
actor(1340, 525, "Recruiter", "company account")
actor(1340, 915, "Admin")
actor(720, 80, "Google OAuth")

# legend
ly = 1108
A(f'<line x1="224" y1="{ly}" x2="268" y2="{ly}" stroke="{RULE}" stroke-width="1.4"/>')
text(276, ly + 4, "association", size=12, weight="400", fill=MUTED, anchor="start")
A(f'<line x1="392" y1="{ly}" x2="428" y2="{ly}" stroke="{FOREST}" stroke-width="1.4" '
  f'stroke-dasharray="7 5" marker-end="url(#arrI)"/>')
text(444, ly + 4, "«include» always happens as part of the base", size=12, weight="400",
     fill=MUTED, anchor="start")
A(f'<line x1="840" y1="{ly}" x2="876" y2="{ly}" stroke="{VERM}" stroke-width="1.4" '
  f'stroke-dasharray="7 5" marker-end="url(#arrE)"/>')
text(892, ly + 4, "«extend» optional variation of the base", size=12, weight="400",
     fill=MUTED, anchor="start")

A('</svg>')

open("/tmp/claude-0/-home-claude/fd5e6935-8b66-558d-8f36-4f6550adf89b/scratchpad/usecase/"
     "offerline-use-case-diagram.svg", "w", encoding="utf-8").write("\n".join(o))
print("svg written")
