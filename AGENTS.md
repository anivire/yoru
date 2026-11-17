# AGENTS.md

Guide for coding agents working on yoru, a self-hosted anime tracker and player that combines several data and video providers. `README.md` covers what the app does, deployment and configuration; this file covers how to change the code. `DESIGN.md` is the design system: tokens, type scale, spacing, components and UI patterns. Read it before changing anything visual.

## Layout

Nx workspace with npm workspaces, Node.js 22.12+.

| Path | What lives there |
|---|---|
| `apps/api` | Hono server, Drizzle ORM on SQLite (`better-sqlite3`). `src/routes` (HTTP handlers), `src/services` (data sources and business logic), `src/jobs` (background pollers), `src/lib` (auth, http, settings, validation), `src/db/schema.ts`, migrations in `drizzle/` |
| `apps/web` | React 19 SPA: React Router, TanStack Query, Tailwind CSS v4, i18next. `src/pages` (one file per route, wired in `src/router.tsx` and loaded lazily with `page()`, so a page does not land in the main bundle; shared pieces belong in `src/components`, not in a page another page imports), `src/components`, `src/lib` (API client, queries, appearance, sounds, helpers), `src/locales` |
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

- **Text**: every user-facing string goes through i18next. Add the key to both `src/locales/ru.ts` and `src/locales/en.ts`; `en` is typed against `ru`, so a missing key is a type error. Avoid decorative arrows like `→` in UI text.
- **Data**: API calls live in `src/lib/api.ts`, query keys in `src/lib/queries.ts`. Use TanStack Query, not ad-hoc fetches.
- **Optimistic updates**: update the cache in `onMutate` (or immediately, as list entries do), roll back or invalidate on error, and pass `meta: optimistic` so the saving spinner in the bottom right corner (`SavingIndicator` in `app-shell.tsx`) shows while the request is in flight. Mutations that write the same record share a `scope` so they run in order.
- **Anime links**: anime pages live at `/anime/<malId>-<romaji-slug>`. Build links with `animePath(malId, title)` from `lib/anime-title.ts`, never by hand; the page parses the leading id and replaces a missing or wrong slug.
- **People** are shown with `UserGrid` from `components/user-grid.tsx` (avatar, name, friend badge, coloured counts, `⋮` menu to add or remove friends). Pass `menu={false}` where the list already has its own actions.
- **Sources** are named and drawn with `SOURCE_NAMES` and `SourceIcon` from `components/source-logo.tsx`; do not add another name map. Debounce typed input with `useDebounced` from `lib/use-debounced.ts`.
- **Appearance settings** (theme, scheme, page width, nav position, favourite translations, etc.) live in `src/lib/appearance.tsx`, persisted to `localStorage`. Read and write browser storage through `readStorage`/`writeStorage` from `lib/storage.ts`, which survive blocked storage. New settings need a field, a normalizer in `load()` that tolerates old or missing values, and a setter.
- **Page width**: page containers use the `page-frame` utility (`apps/web/src/styles.css`) instead of `mx-auto max-w-…`. It centers content and reserves space only on the side where the navigation rail sits. Top padding uses `sm:pt-(--page-top,…)` so titles line up with the rail logo.
- **Navigation positions**: `left`, `top`, `bottom`, `right` in `app-shell.tsx`. On phones the bar is always at the top.
- **Empty and error states**: use `EmptyState` from `@yoru/ui`. When a page shows one, it grows to fill the space down to the footer: put it directly in `Page`, or mark every wrapper between `Page` and it with `grow-empty` (`apps/web/src/styles.css`), which only turns into a growing column while it holds an empty state. Loading skeletons for lists and grids do the same with `skeleton-fill`: they render more placeholders than fit and are clipped at the bottom of the free space, so pass a `count`/`rows` only for small inline placeholders such as the next-page loader.
- **Poster grids**: use `PosterGrid` from `components/anime-cards.tsx`. It virtualizes itself from 60 items (`@tanstack/react-virtual`, window scroller) and, with `fullRows`, hides an incomplete last row while more pages can load. Keep its outer element stable; swapping it breaks column measurement.
- **Performance on cards**: no `backdrop-blur` on elements repeated per card, and no permanent `will-change`; zoom images get `group-hover:will-change-transform`.
- **Sounds** (`src/lib/sounds.ts`, built on `@foleyjs/core`): interactions are voiced globally by role, following the usefoley.dev demo, and every cue goes through the chosen sound theme. Buttons and links play the click sound picked in settings (`CLICK_SOUNDS`); the default `press` is the two-part press, `press` on `pointerdown` and `release` on `pointerup`, and other choices play one cue on `pointerdown`. Touch taps and keyboard activation play the click on `click`. Tabs, radios, options and menu items play `switch` pitched up a semitone per position in their group. Switches, checkboxes and `aria-pressed` toggles play `on`/`off`. Text fields play `thock` per key, and Enter in a single-line input plays `swoosh` then `complete`, or `denied` when it is empty. `StepSlider` emits a step per notch through `onStep` (`tick`, rising with the value) and `onStepEnd` when released (`pop`). Toasts play `success`, `error`, `warning` or `ping`, new notifications `ping`. Give option groups `role="radiogroup"`/`role="radio"` with `aria-checked`, and toggles `aria-pressed`. Use `data-sound="none"` to silence an element and its children or `data-sound="<cue>"` to play a cue on click instead. Elements with `data-foley-enter` play a cue when they mount. There is no randomness: the library's per-play pitch drift and level jitter are pinned, and cues play at the library's own levels with the volume slider mapped straight to Foley's master volume. While the user is active a near-silent signal keeps the audio output awake, and `duckSounds()` attenuates everything while the player is playing.
- **Assets** that must show instantly (source logos) are imported with `?inline` from `src/assets` instead of `public/`.

## Social features

- **Profiles** live at `/u/:username` and are only reachable after login: every `/api/users/*`, `/api/friends/*` and `/api/comments/*` route uses `requireAuth`. Public share links (`/share/:token`, `/api/public/*`) stay reachable without login and ignore the profile privacy settings; they only follow the share toggles.
- **Identity**: `username` is the login and the profile address and keeps its strict rules. `displayName` (spaces and Cyrillic allowed) is what the UI shows; use `nameOf()` and `UserAvatar` from `components/user-avatar.tsx` instead of printing `username`. API responses carry people as `UserCard` (`toCard()` / `cardColumns` in `services/social.ts`).
- **Visibility**: check `canSee(viewer, owner, visibility)` for the list and stats, `profileVisibility` for the profile, and `shareActivity` for feed events shown to friends. Private notes are visible only to their author. Blocking hides two people from each other everywhere: filter by `hiddenUserIds()` whenever you list other users' content.
- **Notifications** for social events go through `notify()` (it skips self and blocked pairs) into `social_notifications`, shown in the same popover as episode notifications.
- **Moderation**: admins can delete any comment or note and reset avatars, names and bios, from profiles and from the Moderation tab in the admin panel. Avatars are stored in `DATA_DIR/avatars/<userId>` and must be removed together with the account.

## Backend conventions

- Routes validate input with helpers from `src/lib/validate.ts` and return JSON; shared response types belong in `packages/shared`.
- External services go through `src/lib/http.ts`: `upstream()`/`upstreamJson()` for requests (User-Agent, timeout, `UpstreamError`) and `cached()` for responses. `cached()` keeps expired entries for a week and serves them when the service fails, except for `SourceOffError`, which services throw when an admin switched them off. Each optional source can be disabled in the admin panel, so code must handle a source being off (`sourceEnabled`) and fall back where possible. When a source gains a new use, add it to that source's list in the admin panel (`admin.sources.*` in the locales).
- **Providers** (`src/providers/`): metadata, search and video run through ordered chains of providers with a common interface (`types.ts`). `chain.ts` stores two admin-ordered groups: *primary* (metadata and search share one order: Jikan, AniList, Shikimori, Kitsu, Anime365, with only the first one on by default and new providers added switched off) and *video* (Anime365, AniLibria, Kodik). Kodik needs a token and plays in its own embedded player (`embedUrl`, `components/player/embed-player.tsx`). Each call goes down the list until a provider answers; a provider that is off, fails, times out or does not find the title is skipped, and search skips providers that cannot handle the query (`accepts`, e.g. Jikan with Cyrillic). Genre filters go to the provider that supplied the genre list. New built-in providers go in `builtin.ts` / `video.ts`; do not branch on a source name elsewhere.
- **Video** endpoints are generic: `/api/stream/providers`, `/:malId/:provider/episodes`, `/translations`, `/stream`. The player picks the first provider that has the title and episode unless the viewer chose one.
- **Extensions** (`src/extensions/`): Seanime-style manifest plus JS code, installed by link, stored in the `extensions` table, run in a QuickJS WebAssembly sandbox (`sandbox.ts`, only `fetch`, `URLSearchParams`, `$settings` and `console`). `manager.ts` validates results and registers extensions as providers with ids `ext:<id>`; `proxy.ts` streams video that needs extra headers and rewrites HLS playlists. The format for authors is in `docs/extensions/README.md` with working examples; keep both in sync with the code.
- **Features** (`lib/features.ts`, `FEATURES` in shared): Discover and schedule, screenshots, Russian titles (Shikimori), related titles and characters (AniList), skip times (AniSkip) and the update check (GitHub) each have their own switch, independent of whether the same service is used as a provider. Check `featureEnabled(id)` where a feature is used; `sourceEnabled` stays the service-wide kill switch.
- **Releases** (`jobs/release-watcher.ts`): every `RELEASE_POLL_MINUTES` the watcher reads new uploads from each active video source (Anime365 by cursor, AniLibria's latest releases, Kodik's `/list` by `updated_at`) and aired episodes from the Shikimori calendar (`discover` feature). Each one goes into `provider_releases`; notifications are unique per user, anime, episode and kind, so the source that has an episode first sends it and records itself in `notifications.provider`. A source that is switched off is not polled, and the first poll of a new source only records what is there without notifying. Each user can pick one source for episode notifications and one for new anime premieres (`users.notify_source`, `users.premiere_source`; null means any enabled source, and a chosen source that gets switched off falls back to any). Premieres are detected from every source: episode 1 of a recent title seen for the first time from that source.
- **Link previews** (`lib/link-preview.ts`): when the API serves the web app it adds Open Graph and Twitter tags to `index.html` for the home page (`apps/web/public/og.jpg`), anime pages (only titles already in the database, so a visitor cannot make the server fetch anything), shared lists and invites, in Russian or English by `Accept-Language`. The site is kept out of search engines with `noindex` (meta tag and `X-Robots-Tag`), not with `robots.txt`, so link preview bots can still read pages.
- Errors the user can see are thrown as short upper-case codes (`notFound('LIST_HIDDEN')`, `HTTPException(400, { message: 'INVITE_INVALID' })`) and translated in `errorMessage()` in `apps/web/src/lib/queries.ts`.
- Invites can be single-use or reusable (`invites.multi_use`, counted in `uses`); who invited a user is stored on `users.invited_by`.
- Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, rename the generated file to a descriptive name (`0016_multi_use_invites.sql`) and update its `tag` in `drizzle/meta/_journal.json`, add any backfill `UPDATE`s to the same file, and commit the SQL with the `drizzle/meta` snapshot.

## Releases

There are two channels. Every push to `master` is **edge**: the Docker image `ghcr.io/anivire/yoru:edge` (and `sha-<commit>`), and the owner's Dokploy site, which builds from the repository and is what they test. A **stable** release is a `vX.Y.Z` tag: it publishes the image as `latest`, `X.Y.Z` and `X.Y` and a GitHub Release. The image knows its channel (`RELEASE_CHANNEL`, set by `.github/workflows/docker.yml`): stable instances compare their version with the latest GitHub Release, edge instances compare their commit with `master`. The in-app changelog groups commits by `chore: release X.Y.Z` commits and shows the commits after the last one as the next version on edge only.

Unless told otherwise, finish each batch of changes like this:

1. Typecheck and build.
2. Commit with a Conventional Commits subject: `type: summary`, lowercase, imperative, no trailing period and no version number (e.g. `feat: add a bottom navigation bar option`). Types: `feat` for new behaviour, `fix` for bug fixes, `perf` for speedups, `refactor` for code changes without behaviour change, `style` for visual tweaks to existing UI, `docs` for documentation, `chore` for version bumps, dependencies and tooling, `build` for Docker and build setup. An optional scope is fine (`fix(import): …`). Keep unrelated changes in separate commits.
   The subjects of `feat`, `fix`, `perf` and `style` commits are shown to users on the in-app changelog page (`/changelog`), so write them for people using the app: say what changed for them in plain, general words. Name the feature or screen, not the code. No library, package, component, file or function names, no internal jargon, no references to where an idea came from. Bad: `feat: voice controls like the foley demo`, `fix: wrap StepSlider labels in a span`. Good: `feat: add sounds to buttons, tabs and text fields`, `fix: keep volume labels from overlapping on phones`. Technical detail belongs in the commit body.
3. Push to `origin master`. Do not bump the version.

When the owner asks for a release:

1. Pick the version from the commits since the last `v*` tag: patch for fixes and small tweaks, minor for features or new dependencies, major only on request.
2. Bump every workspace: `npm version X.Y.Z --no-git-tag-version --workspaces --include-workspace-root`, and commit it as `chore: release X.Y.Z`.
3. Create an annotated tag whose message is two or three sentences about the highlights, written for people using the app: `git tag -a vX.Y.Z -m "…"`. `.github/workflows/release.yml` puts it on top of the release notes and lists the `feat`, `perf`, `style` and `fix` commits under it (`.github/scripts/release-notes.mjs`).
4. Push both: `git push origin master vX.Y.Z`.

The repository `docker-compose.yml` builds from source because the Dokploy and Coolify guides deploy from the repository; the README quick start downloads `docs/deploy/docker-compose.yml`, which uses the published `latest` image.

When the owner says not to push yet, leave the changes uncommitted until they confirm.
