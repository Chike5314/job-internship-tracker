# Material 3 Expressive pass

New files
- src/styles/m3.css            shape, motion, state-layer tokens; colour roles derived from the brand palette
- src/ui/ripple.ts             one delegated touch-ripple listener (opt in with data-ripple)
- src/ui/CountUp.tsx           animated figure used by StatTile
- src/lib/usePageEnter.ts      route-change enter animation (no remount)
- src/ui/illustrations/        original SVG art (theme-aware): HeroScene, AuthScene, CompanyScene, empty states

Changed
- Button / ButtonLink (pill, press morph, tonal variant, size), Chip, StatusTag, Dialog, Toast, Spinner, text fields
- SideRail, PhoneTabBar, AppBar search, StatTile, EmptyState (optional `art` prop)
- LandingPage, AuthLayout, AppShell / CompanyShell / AdminShell, and empty-state call sites

Untouched on purpose: src/styles/tokens.css (generated from docs/brand/tokens.json).
Photos: none bundled; illustrations stand in. Swap in photography where wanted.
