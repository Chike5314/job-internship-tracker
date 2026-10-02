# Diagrams

Appendix D of the SRS. Each diagram is here as an SVG for importing into Word,
LibreOffice or Figma, and as a PNG at 2x for viewing.

| File | Diagram |
| --- | --- |
| `offerline-use-case-diagram` | Use case diagram, three actors |
| `offerline-er-diagram` | Entity relationship diagram |
| `offerline-dfd-level0` | Data flow diagram, context level |
| `offerline-dfd-level1` | Data flow diagram, level 1 |
| `offerline-dfd-level2` | Data flow diagram, level 2, application submission |

`gen.py` emits the use case diagram and `diagrams.py` emits the other four. Both
write plain SVG with presentation attributes rather than CSS, so the files
survive import into Word and Figma. Regenerate rather than hand editing the SVG.

Still to produce: class, sequence, state machine, activity, deployment and
component diagrams.
