# Swiss Homepage Preview — EXPERIMENTAL

> **Route:** `/preview/swiss-home` · **Branch:** `design/swiss-homepage-preview`
> **Status:** preview only — do NOT merge without owner review.
> No existing file was modified; everything lives under `src/app/preview/swiss-home/`
> and `src/components/preview/swiss/`.

## How to access

```bash
git checkout design/swiss-homepage-preview
bun run dev        # :3000 (webpack per AGENTS.md)
# open http://localhost:3000/preview/swiss-home
```

Viewports to check: **375px** (mobile) · **768px** (tablet) · **1440px** (desktop).
Toggle dark mode via the site theme switcher (`.dark` class) — the preview
supports both. `robots: noindex` is set so it never gets indexed.

## Design principles (Swiss Developer Aesthetic)

1. **Monochrome & minimal** — black/white only, grays for structure. No gradients,
   no heavy shadows, no decorative color. Accent `#0066ff` is defined as a token
   but intentionally unused in this pass.
2. **Grid & typography-first** — 12-col feel via `max-w-6xl` + 3-col grids,
   4px→96px 8pt spacing scale, hairline 1px borders as the only separators.
   Hero is pure type: spec row → 64px headline → subtitle → 2 CTAs → stat strip.
3. **Micro-interactions** — 150ms `ease-out` on color/border/background only.
   Links underline on hover, cards shift border + background. 2px focus ring kept.
4. **Utility-first** — every element carries data (index codes `01–05`,
   mono spec lines like `$ ls ./mods`, tabular-nums stats). No decoration.

## Color palette

| Token    | Light     | Dark      | Use                  |
| -------- | --------- | --------- | -------------------- |
| bg       | `#ffffff` | `#000000` | page                 |
| text     | `#000000` | `#ffffff` | headings             |
| text-2   | `#525252` | `#a3a3a3` | body/secondary       |
| border   | `#e5e5e5` | `#262626` | 1px dividers         |
| hover bg | `#f5f5f5` | `#0a0a0a` | hover shift          |
| mute     | `#a3a3a3` | `#525252` | mono meta/indices    |
| accent   | `#0066ff` | `#0066ff` | reserved, unused     |

Shadows: none (only `0 1px 2px rgba(0,0,0,.05)` would be allowed — unused).
Radius: `0` (badges/counters use `2px` max).

## Typography scale

- Headings: `Geist, -apple-system, …` + Arabic `Cairo (self-hosted, next/font)`
  → `IBM Plex Sans Arabic / Tajawal` fallback. Line-height **1.2**, tight tracking.
- Arabic body: line-height **1.6–1.8** for readability.
- Mono: `Geist Mono / JetBrains Mono` for indices, dates, stats (`tabular-nums`).
- Sizes used: `12 / 14 / 16 / 20 / 24 / 32 / 48 / 64` px.
- Weights: `400 / 500 / 600 / 700`.

## Spacing system (8pt)

`xs 4 · sm 8 · md 16 · lg 24 · xl 32 · 2xl 48 · 3xl 64 · 4xl 96` px.
Sections: `py-16 / sm:py-24`. Cards: `p-4 / p-6`. Gaps: `gap-3/4/6/8`.

## Components (`src/components/preview/swiss/`)

| File                  | Purpose                                              |
| --------------------- | ---------------------------------------------------- |
| `swiss-button.tsx`    | `primary / outline / ghost`, `sm/md/lg`, mono option |
| `swiss-badge.tsx`     | `default / outline / mono` status chips              |
| `swiss-card.tsx`      | bordered card: index + category + date + stat + CTA  |
| `swiss-header.tsx`    | sticky hairline header, mobile menu (client)         |
| `swiss-hero.tsx`      | type-only hero + grid backdrop + stat strip          |
| `swiss-features.tsx`  | 6 cells, Lucide 1.5px line icons, `F.01–F.06`        |
| `swiss-content-grid.tsx` | mods / games / news (static mock data)            |
| `swiss-footer.tsx`    | 3 link cols + text socials + mono copyright bar      |

Theme: `src/app/preview/swiss-home/swiss-theme.css` — **all rules scoped to
`.swiss-scope`**, CSS vars, grid backdrop, spinner/skeleton, `prefers-reduced-motion`,
print stylesheet. Layout: `layout.tsx` is pass-through by design.

## RTL implementation

- Page root sets `dir="rtl" lang="ar"` explicitly (root `<html>` is already RTL).
- Borders use `border-s` (logical) in the stat strip — flips correctly.
- Icons are symmetric line icons (no mirroring needed); directional arrows use
  `←` which reads correctly in RTL flow.
- Numbers/dates/specs use `dir="ltr"`-safe mono spans + `tabular-nums` where needed.
- Arabic line-heights raised (1.6–1.8) vs Latin 1.2–1.5.

## Responsive breakpoints

- `<640px`: single column, stacked CTAs, 32px headline, 2-col stat strip,
  hamburger menu.
- `640–1024px`: 2-col features, stacked content cards → 1-col (md breakpoint),
  stat strip 4-col from `md:`.
- `>1024px`: full 3-col grids, 64px headline, inline nav + actions.

## Comparison with current design

| Current (`/`)              | Swiss preview (`/preview/swiss-home`)      |
| -------------------------- | ------------------------------------------ |
| Rich cards + thumbnails    | Border-only type cards, no images          |
| Teal/navy theme + shadows  | Monochrome hairlines, zero shadows         |
| Marketing hero w/ visuals  | Type-only hero + spec meta                 |
| Heavy sections             | 5 numbered sections, strict rhythm         |

## Pros / cons

**Pros:** fastest paint (no images), highest contrast/readability, trivial dark
mode (variable swap), timeless engineering-brand feel, cheap to maintain.
**Cons:** less emotional/marketing punch, no visual game-art hook (deliberate),
needs real data wiring + AppShell opt-out before any merge, double header/footer
currently visible because root `AppShell` still wraps the preview.

## Customizing

- Colors: edit vars in `swiss-theme.css` (`.swiss-scope` + `.dark .swiss-scope`).
- Content: replace `MODS/GAMES/NEWS` arrays in `swiss-content-grid.tsx` with a
  fetch to existing APIs; replace `FEATURES`/`STATS` inline.
- Accent: token `--swiss-accent` exists; apply to one element max (e.g. focus
  ring or a single CTA) if the owner approves color.

## Verification

- `npx tsc --noEmit` — must be clean.
- `npx jest --ci` — existing suite must still pass (no files touched).
- `git status --short` — only `src/components/preview/` + `src/app/preview/` new.
