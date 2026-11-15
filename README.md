<div align="center">

<img src="apps/web/public/favicon.svg" width="96" alt="yoru logo">

# yoru

A self-hosted anime tracker and player built around [Anime365](https://smotret-anime.app): Russian subtitles over the original audio or Russian voice-over, your lists, a release calendar and a discovery page, all in one place for you and the people you invite.

</div>

![yoru home page](docs/home.webp)

![My lists](docs/lists.webp)

![Discover page](docs/discover.webp)

## Features

- **Player** with Anime365 translations: pick subtitles or voice-over, choose the author, resume where you stopped.
- **Lists** with statuses, progress, scores, rewatches and notes; grid and table views with filters and sorting.
- **Home** with continue watching, upcoming episodes from your lists, a GitHub-style watch activity grid and what you are watching now. Sections can be reordered and hidden.
- **Schedule** as a month calendar: aired episodes, the ones still waiting for a translation, and what comes next.
- **Discover**: seasonal highlights, trending by genre, recently released translations, top rated and upcoming.
- **Notifications** when a new episode with subtitles or voice-over appears for anime in your lists.
- **Import** from AniList, Shikimori and MyAnimeList, or from a Seanime offline account; **export** to JSON, CSV and MAL XML.
- **Invites only**: the admin creates invite links, there is no open registration.
- **Themes**: light and dark schemes, a dozen color presets and an adjustable page width.

## Install

yoru ships as a single Docker image with the API, the web app and an SQLite database in a volume.

```bash
git clone https://github.com/anivire/yoru.git
cd yoru
cp .env.example .env
```

Set at least `APP_URL` (the address you will open in the browser) and, ideally, `ANIME365_TOKEN`, then start it:

```bash
docker compose up -d --build
```

The container listens on port `3000`. The compose file publishes it on a random host port so it can sit behind a reverse proxy; change `"3000"` to `"3000:3000"` in `docker-compose.yml` to expose it directly.

### First login

On an empty database yoru creates the first admin in one of two ways:

- set `ADMIN_USERNAME` and `ADMIN_PASSWORD` (8+ characters) in `.env`, or
- leave them empty and open the invite link the server prints to its log on start: `[yoru] no admin yet, create one at …/invite/<code>`.

Everyone else joins through invites created in the admin panel.

## Anime365 token

Anime365 only hands out video links to accounts with an active subscription, so yoru needs an `access_token`.

1. Log in at [smotret-anime.app](https://smotret-anime.app) in your browser.
2. Create an API app and generate an `access_token`.
3. Paste it into **Admin panel → Data sources → Anime365** to share it with everyone, or into **Settings → Account** to use your own.

A personal token wins over the shared one. `ANIME365_TOKEN` in `.env` works as the shared token too.

## Data sources

| Service | Used for | Required |
|---|---|---|
| [Anime365](https://smotret-anime.app) | Video, translations and subtitles, released episodes and notifications, recently released on Discover, metadata when Jikan is off | Yes |
| [Jikan](https://jikan.moe) (MyAnimeList) | Synopses, posters, studios, trailers, weekly airing times, episode titles and thumbnails, search filters | No, Anime365 can serve metadata instead |
| [Shikimori](https://shikimori.io) | Discover, release calendar and upcoming episodes, banner screenshots, Shikimori list import | No |
| GitHub | Version and update check in the footer | No |
| AniList, Shikimori, MyAnimeList OAuth | List import | No |

Every source has a card in **Admin panel → Data sources** with its live status, an on/off switch and an API URL override. Values from `.env` are the defaults; whatever you change in the panel applies right away without a restart.

### Self-hosted Jikan

If `api.jikan.moe` is unreachable from your server, run your own instance next to yoru:

```env
COMPOSE_PROFILES=jikan
JIKAN_URL=http://jikan:8080/v4
JIKAN_DB_PASSWORD=change-me
JIKAN_REDIS_PASSWORD=change-me
JIKAN_TYPESENSE_KEY=change-me
```

The `jikan` profile starts jikan-rest with MongoDB, Redis and Typesense. Expect around 1 GB of RAM for the whole stack.

## Configuration

| Variable | Default | What it does |
|---|---|---|
| `APP_URL` | `http://localhost:5173` | Public address; used for invite links, OAuth redirects and secure cookies on `https://` |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | | First admin on an empty database |
| `ANIME365_TOKEN` | | Shared Anime365 token |
| `METADATA_SOURCE` | `jikan` | `jikan` or `anime365` |
| `ANIME365_URL`, `JIKAN_URL`, `SHIKIMORI_URL`, `ANILIST_URL` | public instances | API base URLs |
| `ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET` | | AniList import |
| `SHIKIMORI_CLIENT_ID`, `SHIKIMORI_CLIENT_SECRET` | | Shikimori import |
| `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET` | | MyAnimeList import |
| `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TOKEN` | `anivire/yoru`, `master` | Update check; the token is only needed for a private repository |
| `HTTPS_PROXY` | | Route outgoing requests through a proxy |
| `RELEASE_POLL_MINUTES` | `5` | How often new Anime365 releases are checked |
| `SESSION_DAYS` | `30` | Login session lifetime |
| `DATA_DIR`, `DATABASE_PATH` | `./data`, `<DATA_DIR>/yoru.db` | Where the database lives; the Docker image uses `/data` |

OAuth keys and the GitHub settings can also be entered in the admin panel.

## Import and export

**From a service.** Create an OAuth app on AniList, Shikimori or MyAnimeList with the redirect URI shown in the admin panel (`<APP_URL>/api/import/<provider>/callback`), add its keys, and every user gets an import button in **Settings → Import and export**.

**From Seanime.** Seanime keeps an offline list in `offline/local.db` inside its data folder:

| OS | Path |
|---|---|
| Windows | `%APPDATA%\Seanime\offline\local.db` |
| macOS | `~/Library/Application Support/Seanime/offline/local.db` |
| Linux | `~/.config/Seanime/offline/local.db` |

Close Seanime and upload that file under **Import from a file**. Statuses, progress, scores, rewatches, notes and dates are carried over; entries without a MyAnimeList ID are skipped.

**Export** gives you JSON (a full copy), CSV for spreadsheets, or MAL XML that MyAnimeList, Shikimori and AniList can import.

## Updates

The footer shows the running version and commit. When the configured GitHub branch has newer commits, an **Update available** badge links to the comparison. Pull and rebuild to update:

```bash
git pull
docker compose up -d --build
```

Database migrations run automatically on start.

## Development

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev
```

The web app runs on [localhost:5173](http://localhost:5173) and proxies `/api` to the API on port `3000`. The API reads `.env` from the repository root and keeps its database in `apps/api/data`.

| Command | What it does |
|---|---|
| `npm run dev` | Web and API in watch mode |
| `npm run build` | Production build of every package |
| `npm run typecheck` | TypeScript checks across the workspace |
| `npm run db:generate` | New Drizzle migration from schema changes |

The repository is an Nx workspace: `apps/api` (Hono, Drizzle, SQLite), `apps/web` (React, React Router, TanStack Query, Tailwind CSS), `packages/ui` (shared components) and `packages/shared` (types and validation).
