# DESIGN.md

The yoru design system for coding agents. `AGENTS.md` covers how the code is organised; this file covers how the interface should look and feel. When something here disagrees with what is on screen, match the existing screens and flag the difference.

## Principles

- **Calm and dense.** Dark by default, few colours, little chrome. Information sits close together and is separated by spacing and soft background steps, not by lines.
- **One accent per theme.** Every theme is a hue. All colours derive from three variables, so a screen must look right in all twelve themes and in light mode.
- **Content first.** Posters, avatars and banners carry the colour. UI around them stays neutral.
- **Quiet feedback.** Changes apply instantly (optimistic updates), with a small spinner in the corner, a sound and a toast only on errors or real results.
- **Room for text.** Layouts must fit long labels and both locales. Never truncate a label that a user must read to act.

## Tokens

All tokens live in `packages/ui/src/styles.css` and are exposed as Tailwind colours (`bg-surface`, `text-muted-foreground`, …). Never use raw hex or Tailwind palette colours (`bg-zinc-800`, `text-violet-400`) for UI; the only exceptions are listed under *Fixed colours*.

### Themes

- `--hue`, `--tint` and `--accent-c` drive every colour. Presets are in `packages/ui/src/theme.ts` (`yoru`, `sakura`, `matcha`, `umi`, `ember`, `fuji`, `momiji`, `kohaku`, `wakaba`, `kori`, `ajisai`, `sumi`), applied as `data-theme` on `<html>`.
- Light and dark are the `.light` / `.dark` classes. Dark is the default scheme.
- Colours are `oklch`. To add a theme, add a preset in `theme.ts` and a `[data-theme]` block; never add per-theme overrides for single components.

### Surfaces, from back to front

| Token | Use |
|---|---|
| `background` | Page background |
| `inset` | Recessed areas: empty states, wells inside cards |
| `surface` | Cards, panels, list rows (`Card`, profile card, people cards) |
| `muted` | Hover fill on rows and menu items, active tab fill, skeleton base |
| `raised` / `popover` | Menus, popovers, dialogs, toasts, the corner spinner |
| `field` / `field-hover` | Inputs, selects, secondary buttons, chips |

Inside overlays, `--field`, `--field-hover` and `--muted` are remapped to their `raised-*` versions automatically (see `panel` in `overlay.tsx`), so the same classes work on any layer.

For a very soft fill inside a card (stat chips, small tiles) use `bg-foreground/[0.04]`–`[0.05]` rather than another token.

### Text

| Token | Use |
|---|---|
| `foreground` | Titles, body, numbers |
| `muted-foreground` | Secondary text, descriptions, inactive tabs, meta lines |
| `subtle-foreground` | Tertiary text: dates, counts in brackets, separators, placeholders |
| `accent` | Links, active states, the brand accent |

### Accent and status

- `accent` / `accent-foreground` for primary actions and selection; `accent-soft` for tinted backgrounds (badges, icon chips, selection).
- `success`, `warning`, `danger`, `info`, each with a `-soft` variant for backgrounds. Text on a soft background uses the solid colour (`bg-danger-soft text-danger`).
- `inverse` / `inverse-foreground` for the strongest neutral button (`Button variant="primary"`).

### Fixed colours

Only these break the token rule:
- Score stars: `text-amber-500` (`StarIcon`).
- The `paused` list status tone: `oklch(0.68–0.7 0.17 50)` via `TONE_SOLID` / `TONE_TEXT` in `lib/list-status.tsx`.
- Text over images and the player: `text-white`, `bg-black/…`.

### List statuses

Use `STATUS_META`, `TONE_SOLID`, `TONE_TEXT` and `StatusIcon` from `lib/list-status.tsx`, never your own mapping:
watching and rewatching `accent`, planning `info`, completed `success`, paused orange, dropped `danger`.

Counts shown as coloured icons follow the same mapping: watching `RiPlayCircleFill text-accent`, completed `RiCheckboxCircleFill text-success`, friends `RiGroupFill text-info`.

## Typography

- Inter Variable for UI (`font-feature-settings: 'cv11', 'ss01'`), JetBrains Mono Variable for codes, episode ranges and keys.
- The root font size is 108% on phones and 120% from `sm`, so all `rem` sizes scale. Use the scale below rather than new sizes.

| Role | Classes |
|---|---|
| Page title (`PageHeader`) | `text-2xl font-semibold tracking-tight` |
| Section title (`Section`, tab headers) | `text-xl font-semibold tracking-tight` |
| Card or block title | `text-[0.9375rem] font-semibold tracking-tight` or `text-sm font-semibold` |
| Body | `text-sm`, `text-[0.9375rem]` for prominent body (bio, descriptions) |
| Meta and hints | `text-[0.8125rem] text-muted-foreground` |
| Captions, chips | `text-xs` |
| Micro labels (small badges) | `text-[0.6875rem] font-medium` |

- Numbers: `tabular-nums`. Large counts are shortened with `Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })` and the exact value goes in a tooltip.
- Dates: `formatDate` from `lib/format.ts`; full dates as `{ day: 'numeric', month: 'long', year: 'numeric' }`.
- Separate inline meta with ` · `, never with `|`, `/` or arrows.
- Truncate single-line names with `truncate` inside a `min-w-0` parent; clamp bios with `line-clamp-*`.

## Shape

| Element | Radius |
|---|---|
| Small controls (`sm` buttons, small badges, chips) | `rounded-md` |
| Buttons, inputs, menu items, tiles | `rounded-lg` |
| Cards, rows, empty states, posters | `rounded-xl` |
| Large containers: hero, profile card, banners | `rounded-2xl` |
| Avatars, pills, `lg` buttons, badges | `rounded-full` |

## Spacing and layout

- **Pages** use `Page` (`page-frame` + `px-4 sm:px-6 pb-8`, top padding from `--page-top`). Never set your own `max-w-*` + `mx-auto`.
- **Page header**: `PageHeader` with `mb-8`.
- **Sections** on a page: `Section` (icon chip, title, optional hint and action) with `mt-10` between sections and `mb-4` under the header. Denser pages (statistics, profile tabs) use `gap-6` / `mt-6` between sections.
- **Cards**: padding `p-4 sm:p-5`; rows `p-3`; tiles `px-3 py-2`.
- **Grids**: `gap-3` for cards and people, `gap-2` for compact lists, `gap-x-3 gap-y-4` for poster grids.
- **Filters**: rows of controls `gap-3`, then `mb-6` before the results.
- **Sidebar layouts** (profile): a `lg:w-64` card pinned with `lg:sticky lg:top-[calc(var(--page-top,2.5rem)*2)]` beside a `min-w-0 flex-1` column; on smaller screens the card stacks on top.
- Prefer flex/grid gaps over margins between siblings.

### Breakpoints

- Mobile first. `sm` (40rem) switches type size and padding; `md` shows the desktop navigation; `lg` enables side-by-side layouts.
- `desk:` = at least 64rem with a fine pointer, for hover-heavy desktop layouts. `wide:` follows the wide page setting.
- On phones the navigation is always at the top. The rail can sit left, right, top or bottom on desktop; anything fixed to the screen must respect `--rail-left`, `--rail-right` and the bottom dock.

## Dividers and depth

- Avoid `border-t` / `divide-y` lines between blocks; the owner finds them heavy. Separate with spacing, a background step (`surface` on `background`), or a soft fill.
- Rows of a list sit directly in their card, like the home sections in `components/layout-settings.tsx`. Do not wrap them in an extra tinted well inside the card; a card inside a card reads as noise.
- Borders are fine for dashed placeholders (`border-2 border-dashed border-border`) and inputs that need an edge.
- Shadows only on overlays (the `panel` shadow) and on hovered poster cards (`group-hover:shadow-xl`).

## Components

Use what exists before writing something new.

### `@yoru/ui` (`packages/ui`)

- `Button`: variants `accent` (main action), `secondary` (default), `ghost` (toolbar and icon buttons), `primary` (inverse), `outline`, `danger`, `link`; sizes `sm`, `md`, `lg`, `icon`, `icon-sm`. Use `loading` instead of hand-made spinners and `asChild` for links.
- `Badge` (`outline`, `neutral`, `accent`, `success`, `warning`, `danger`, `info`, `solid`) and `StatusDot`.
- `Card` with `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter`.
- `Input`, `Textarea`, `Label`, `Field`, `Select`, `Switch`, `Segmented`, `StepSlider`.
- `Popover`, `HoverCard`, `Dialog` + `DialogContent`, `Lightbox`, `DropdownMenu` (non-modal by default), `Tooltip`.
- `EmptyState` with a mascot `mood`: `idle`, `happy`, `sleepy` (nothing here yet), `thinking` (no results), `error`.
- `Skeleton`, `Progress`, `Spinner`, `Kbd`, `Code`, `Image` (fades in), `StarIcon`, `Mascot`, `Logo`, `LogoMark`.
- `useSlidingIndicator` for tab-like groups with a moving highlight (`Segmented`, the profile tab menu).

### App components (`apps/web`)

- Layout: `Page`, `PageHeader`, `Section` (`components/app-shell.tsx`).
- Links: `TLink` / `TNavLink` / `useTransitionNavigate` for in-app navigation with view transitions. Anime pages are linked with `animePath(malId, title)` from `lib/anime-title.ts`.
- Anime: `AnimeCard`, `PosterGrid`, `Rail` (`size="poster"` for poster cards, `wide` for wide cards), skeletons in `components/skeletons.tsx`, titles via `AnimeTitle` / `useAnimeTitle` (respects the title language setting).
- People: `UserAvatar`, `nameOf` (`components/user-avatar.tsx`), `UserGrid` and `UserGridSkeleton` (`pages/profile.tsx`) for every list of people.
- Statuses: `StatusIcon`, `STATUS_META`.

## Patterns

- **Icons**: Remix Icon, the `Fill` style (`RiUser3Fill`), `Line` only where the fill version reads poorly. Default size comes from the parent (`[&_svg]:size-4`); do not set sizes on each icon.
- **Section and tab headers** get an icon chip: `grid size-9 place-items-center rounded-xl bg-accent-soft text-accent [&_svg]:size-[1.125rem]`.
- **Icon-only information** (stat chips, buttons) gets a `Tooltip` and an `aria-label` or `sr-only` label.
- **Menus**: a `⋮` ghost `icon-sm` button with `RiMore2Fill`; every item has an icon; destructive items use `text-danger data-[highlighted]:bg-danger-soft [&_svg]:text-danger` and come first or are separated with `DropdownMenuSeparator`.
- **Reordering**: anything the user can put in order (home sections, favourite voice-overs, providers) is sorted by drag and drop with `@dnd-kit`, never with up/down buttons. Follow `SortableSection` in `components/layout-settings.tsx`: a `RiDraggable` grab handle on the left (also the keyboard handle), `restrictToVertical`, `PointerSensor` with a 4px activation distance plus `KeyboardSensor`, the dragged row lifted with `bg-raised shadow-lg`, and a `Switch` on the right when items can be turned off.
- **Tabs**: `Segmented` for horizontal tabs; a vertical list with the sliding indicator inside a sidebar card. Hidden or locked options stay visible, dimmed, with a lock icon and a tooltip explaining why.
- **Loading**: skeletons shaped like the real content, `skeleton-fill` for lists, `Button loading` for actions. Optimistic mutations set `meta: optimistic` (from `lib/queries.ts`) so the corner spinner shows.
- **Empty and error states**: `EmptyState`, growing to the footer (see `AGENTS.md`).
- **Toasts**: `toast.success` / `toast.error` with `errorMessage(e, t)` for API errors. Do not toast for every successful optimistic change.
- **Banners and posters as backgrounds**: blurred (`blur-[2px]`–`blur-sm`, `scale-110`) and faded into the surface with a gradient or `mask-l-from-*`, never sharp behind text.
- **Motion**: 150–200 ms, `ease-out` or `cubic-bezier(0.16,1,0.3,1)` for moving indicators; `animate-pop` for overlays, `animate-fade` / `animate-zoom` for appearing content. Respect `prefers-reduced-motion`.
- **Sounds**: interactions are voiced by role; see *Sounds* in `AGENTS.md` and give controls the right roles.

## Writing

- Every string goes through i18next, in every locale.
- Sentence case, short, no exclamation marks, no decorative arrows.
- Name things the way users see them in the interface, not by internal terms.
