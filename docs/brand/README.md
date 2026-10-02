# Offerline brand assets

Everything the interface needs to look like Offerline. `tokens.json` is the
source for colour, type, spacing, radii and glass; the frontend generates its
`tokens.css` from it through `frontend/scripts/build-tokens.mjs`, so change the
JSON and rebuild rather than editing CSS by hand.

## Logo

`logo/offerline-logo-source.png` is the file as supplied. Everything else is
derived from it.

| File | Use |
| --- | --- |
| `logo/offerline-mark.svg` | The mark on its own. This is what the interface uses. |
| `logo/offerline-mark.png` | The mark as pixels, transparent, for anywhere SVG is awkward. |
| `logo/offerline-wordmark.png` | The word on its own, transparent. |
| `logo/offerline-lockup.png` | Mark, word and tagline, transparent. |
| `logo/offerline-lockup-notag.png` | Mark and word, no tagline. |

The SVG is traced from the supplied artwork rather than redrawn by eye, so the
curves are the designer's. Its three colours are snapped to the tokens: the
supplied art was already within about two percent of them, and snapping means
the mark and the interface cannot drift apart later.

- Forest `#2a6a52`, the frame and the first line
- Pale `#c7cfc0`, the middle line
- Vermilion `#d8431c`, the last line and the chevron

Keep clear space around the mark of at least the height of one of its inner
lines. Below about 20px the three inner lines start to merge, so use the mark
alone there and not the lockup.

The earlier `offerline-wordmark-dark.png`, `offerline-wordmark-light.png`,
`offerline-mark-dark.png` and `offerline-mark-light.png` carry a bright blue
from a palette that was dropped. They are superseded by the files above and
should be deleted along with their copies under `frontend/`.

## Icons

`icons/offerline-icons.svg` is one sprite holding 58 icons, built by
`icons.py` from Lucide (ISC licence) and drawn at the mark's own weight: 1.75
stroke, round caps and joins.

```html
<svg class="icon" aria-hidden="true"><use href="/icons.svg#i-interview"/></svg>
```

```css
.icon { width: 20px; height: 20px; }
```

Every icon strokes in `currentColor`, so it takes the colour of the text beside
it and there is no separate dark theme version. An icon that carries meaning on
its own, rather than repeating an adjacent label, needs a `title` inside the
`svg` or an `aria-label` on the control holding it.

The set is curated to the actions this product has, in six groups: navigation
and chrome, opportunity, application, status and feedback, actions, and insight
and moderation. Adding an icon means adding a line to `icons.py` and rebuilding,
so the sprite stays a list of things the product does rather than a library.

The sprite replaces `frontend/public/icons.svg`, which at the time of writing
still held Bluesky, Discord and a purple documentation icon left over from a
starter template.
