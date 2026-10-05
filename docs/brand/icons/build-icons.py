"""Build the Offerline icon set as one SVG sprite.

Lucide, drawn at the brand's own weight rather than its defaults: 1.75 stroke
with round caps and joins, which is what the mark's own strokes do. The set is
curated to the actions this product actually has, so every symbol in the sprite
has a place it is used. A general icon library dropped in whole leaves hundreds
of unused symbols and no guidance on which to reach for.
"""
import os
import re

SRC = "../type/node_modules/lucide-static/icons"
OUT = "offerline-icons.svg"

# name in the sprite -> lucide file, grouped by where it is used.
GROUPS = {
    "Navigation and chrome": {
        "search": "search",
        "bell": "bell",
        "notification": "bell-dot",
        "account": "circle-user-round",
        "settings": "settings",
        "sign-out": "log-out",
        "menu": "menu",
        "close": "x",
        "chevron-down": "chevron-down",
        "chevron-right": "chevron-right",
        "back": "arrow-left",
        "forward": "arrow-right",
    },
    "Opportunity": {
        "job": "briefcase-business",
        "internship": "graduation-cap",
        "company": "building-2",
        "location": "map-pin",
        "remote": "globe",
        "salary": "banknote",
        "deadline": "clock",
        "openings": "users",
        "skills": "tags",
        "posting": "megaphone",
    },
    "Application": {
        "document": "file-text",
        "cv": "file-user",
        "upload": "upload",
        "download": "download",
        "attachment": "paperclip",
        "link": "link",
        "history": "history",
        "interview": "calendar-check",
        "calendar": "calendar-days",
        "message": "mail",
    },
    "Status and feedback": {
        "submitted": "circle-dashed",
        "under-review": "eye",
        "offer": "circle-check",
        "rejected": "circle-x",
        "withdrawn": "circle-minus",
        "warning": "triangle-alert",
        "info": "info",
        "verified": "badge-check",
        "pending": "circle-ellipsis",
        "loading": "loader-circle",
    },
    "Actions": {
        "edit": "square-pen",
        "delete": "trash-2",
        "filter": "list-filter",
        "sort": "arrow-up-down",
        "add": "plus",
        "confirm": "check",
        "copy": "copy",
        "export": "file-down",
        "open-external": "external-link",
        "bulk": "list-checks",
    },
    "Insight and moderation": {
        "analytics": "chart-column",
        "funnel": "filter",
        "trend": "trending-up",
        "admin": "shield-check",
        "suspend": "circle-slash",
        "approve": "thumbs-up",
    },
    # The applicant dashboard board: its rail, its stat tiles, the interview
    # card's calendar action and the profile nudge.
    "Applicant dashboard": {
        "dashboard": "layout-grid",
        "applications": "file-check",
        "file": "file",
        "folder": "folder",
        "date": "calendar",
        "star": "star",
        "send": "send",
        "save": "arrow-down-to-line",
    },
    # The phone board's bottom tab bar.
    "Phone navigation": {
        "home": "house",
        "person": "user",
    },
    # The posting editor board: the CV row that cannot be removed.
    "Posting editor": {
        "lock": "lock",
    },
}

BODY = re.compile(r"<svg[^>]*>(.*)</svg>", re.S)


def body_of(lucide_name):
    path = os.path.join(SRC, f"{lucide_name}.svg")
    with open(path, encoding="utf-8") as fh:
        raw = fh.read()
    inner = BODY.search(raw).group(1)
    # Lucide files carry their own stroke attributes on the root. Stripping any
    # that leaked onto children keeps the sprite's single set authoritative.
    inner = re.sub(r'\s(stroke-width|stroke-linecap|stroke-linejoin)="[^"]*"', "", inner)
    return inner.strip()


symbols, manifest = [], []
missing = []
for group, icons in GROUPS.items():
    manifest.append(f"\n  <!-- {group} -->")
    for name, lucide in icons.items():
        if not os.path.exists(os.path.join(SRC, f"{lucide}.svg")):
            missing.append((name, lucide))
            continue
        # The stroke attributes go on the symbol itself. A <symbol> is its own
        # rendering context, so anything set on a group wrapping the symbols
        # never reaches the instantiated content and every icon comes out as a
        # black silhouette.
        symbols.append(
            f'  <symbol id="i-{name}" viewBox="0 0 24 24" fill="none"\n'
            f'          stroke="currentColor" stroke-width="1.75"\n'
            f'          stroke-linecap="round" stroke-linejoin="round">\n'
            f"    {body_of(lucide)}\n"
            f"  </symbol>"
        )
        manifest.append(f"  <!-- i-{name} ({lucide}) -->")

sprite = (
    '<svg xmlns="http://www.w3.org/2000/svg" style="display:none">\n'
    "  <!-- Offerline icon set. Lucide (ISC), drawn at the brand's weight.\n"
    "       Use: <svg class=\"icon\"><use href=\"/icons.svg#i-job\"/></svg>\n"
    "       The stroke colour comes from currentColor, so an icon takes the\n"
    "       colour of the text it sits beside and needs no per-theme variant. -->\n"
    + "\n".join(symbols)
    + "\n</svg>\n"
)
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(sprite)

total = sum(len(v) for v in GROUPS.values()) - len(missing)
print(f"wrote {OUT}: {total} icons in {len(GROUPS)} groups, {len(sprite)} bytes")
if missing:
    print("MISSING from lucide:", missing)
