# AGENTS.md

Guide for coding agents working on yoru, a self-hosted anime tracker and player. `README.md` covers what the app does, deployment and configuration; this file covers how to change the code.

## Layout

Nx workspace with npm workspaces, Node.js 22.12+.

| Path | What lives there |
|---|---|
| `apps/api` | Hono server, Drizzle ORM on SQLite (`better-sqlite3`). `src/routes` (HTTP handlers), `src/services` (data sources and business logic), `src/jobs` (background pollers), `src/lib` (auth, http, settings, validation), `src/db/schema.ts`, migrations in `drizzle/` |
| `apps/web` | React 19 SPA: React Router, TanStack Query, Tailwind CSS v4, i18next. `src/pages` (one file per route, wired in `src/router.tsx`), `src/components`, `src/lib` (API client, queries, appearance, sounds, helpers), `src/locales` |
| `packages/ui` | Shared primitives (`@yoru/ui`): buttons, overlays (Radix), Segmented, StepSlider, theme, `styles.css` with design tokens and utilities |
| `packages/shared` | Types and constants shared by API and web (`@yoru/shared`), e.g. `StreamKind`, `VersionInfo`, list statuses |

The web dev server proxies `/api` to the API on port `3000`. Production is one Docker image where the API also serves the built web app.

## Commands

```bash
npm install
npm run dev          # web on :5173 and API on :3000 in watch mode
npm run typecheck    # tsc across all packages
npm run build        # production build
npm run db:generate  # new Drizzle migration after editing apps/api/src/db/schema.ts
```

There is no test suite. Before finishing a change, run the typecheck for every package you touched and `npx vite build` in `apps/web` for frontend changes. Migrations run automatically when the API starts.

## Code style

- TypeScript in strict mode with `noUnusedLocals` and `noUnusedParameters`. Unused imports fail the typecheck.
- Single quotes, no semicolons, 2-space indent, long single-line JSX attributes are normal. There is no formatter config in the repo: do not run Prettier or another formatter over files, it rewrites the whole file in a different style.
- Do not add code comments. Explain decisions in the commit message or the conversation instead.
- Match the surrounding code: Tailwind utility classes inline, `cn()` from `@yoru/ui` for conditional classes, small components in the same file as their only user.
- Effects are for syncing with things outside React (DOM APIs, subscriptions, timers, `localStorage`, media elements). Follow [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect): derive values during render (`useMemo` only when expensive), handle user actions in event handlers, reset state with a `key` or by comparing to the previous value during render, and fetch through TanStack Query. Do not use an effect to copy props or query data into state, to chain state updates, or to notify a parent.
- Prefer the existing primitives in `packages/ui` (Button, Select, Segmented, StepSlider, Tooltip, Popover, DropdownMenu, Dialog, Switch) over new ones. `DropdownMenu` defaults to `modal={false}` so it does not lock page scroll.

## Frontend conventions

- **Text**: every user-facing string goes through i18next. Add the key to both `src/locales/ru.ts` and `src/locales/en.ts`; `en` is typed against `ru`, so a missing key is a type error. Russian is the primary language. Avoid decorative arrows like `→` in UI text.
- **Data**: API calls live in `src/lib/api.ts`, query keys in `src/lib/queries.ts`. Use TanStack Query, not ad-hoc fetches.
- **Appearance settings** (theme, scheme, page width, nav position, favourite translations, etc.) live in `src/lib/appearance.tsx`, persisted to `localStorage`. New settings need a field, a normalizer in `load()` that tolerates old or missing values, and a setter.
- **Page width**: page containers use the `page-frame` utility (`apps/web/src/styles.css`) instead of `mx-auto max-w-…`. It centers content and reserves space only on the side where the navigation rail sits. Top padding uses `sm:pt-(--page-top,…)` so titles line up with the rail logo.
- **Navigation positions**: `left`, `top`, `bottom`, `right` in `app-shell.tsx`. On phones the bar is always at the top.
- **Poster grids**: use `PosterGrid` from `components/anime-cards.tsx`. It virtualizes itself from 60 items (`@tanstack/react-virtual`, window scroller) and, with `fullRows`, hides an incomplete last row while more pages can load. Keep its outer element stable; swapping it breaks column measurement.
- **Performance on cards**: no `backdrop-blur` on elements repeated per card, and no permanent `will-change`; zoom images get `group-hover:will-change-transform`.
- **Sounds** (`src/lib/sounds.ts`, built on `@foleyjs/core`): interactions are voiced globally by role. Buttons, links, tabs, options and menu items play the `glide` click (`CLICK`): on `pointerdown` for a mouse or pen, on `click` for touch taps and keyboard activation. Switches, checkboxes and `aria-pressed` toggles play `on`/`off` on `click`. Give option groups `role="radiogroup"`/`role="radio"` with `aria-checked`, and toggles `aria-pressed`. Use `data-sound="none"` to silence an element or `data-sound="<cue>"` to play a cue on click instead. Elements with `data-foley-enter` play a cue when they mount. `StepSlider` emits a tick per step through `onStep`, pitched by slider position. There is no randomness: the library's per-play pitch drift and level jitter are pinned, and each cue's volume is levelled against the switch cue by rendering it offline once per theme. While the user is active a near-silent signal keeps the audio output awake, so short cues are not lost to a sleeping device, and `duckSounds()` attenuates everything while the player is playing.
- **Assets** that must show instantly (source logos) are imported with `?inline` from `src/assets` instead of `public/`.

## Backend conventions

- Routes validate input with helpers from `src/lib/validate.ts` and return JSON; shared response types belong in `packages/shared`.
- External services go through `src/lib/http.ts`. Each optional source can be disabled in the admin panel, so code must handle a source being off (`sourceEnabled`).
- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, commit the generated SQL and the `drizzle/meta` snapshot.

## Releases

The owner tests the deployed site's update checker, which compares the running commit and version with GitHub `master`. Unless told otherwise, finish each batch of changes like this:

1. Typecheck and build.
2. Bump the version in every workspace: `npm version X.Y.Z --no-git-tag-version --workspaces --include-workspace-root`. Patch for fixes and small tweaks, minor for features or new dependencies, major only on request.
3. Commit with a Conventional Commits subject: `type: summary`, lowercase, imperative, no trailing period and no version number (e.g. `feat: add a bottom navigation bar option`). Types: `feat` for new behaviour, `fix` for bug fixes, `perf` for speedups, `refactor` for code changes without behaviour change, `style` for visual tweaks to existing UI, `docs` for documentation, `chore` for version bumps, dependencies and tooling, `build` for Docker and build setup. An optional scope is fine (`fix(import): …`). Keep unrelated changes in separate commits.
4. Push to `origin master`.

When the owner says not to push yet, leave the changes uncommitted until they confirm.
