<div align="center">

<img src="docs/hero.webp" alt="yoru">

<br>

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL--3.0-blue?style=flat-square)](LICENSE)
[![Version](https://img.shields.io/github/package-json/v/anivire/yoru?style=flat-square&color=5b54d6&label=version)](https://github.com/anivire/yoru/commits/master)
[![Container](https://img.shields.io/badge/ghcr.io-anivire%2Fyoru-2496ED?style=flat-square&logo=docker&logoColor=white)](https://github.com/anivire/yoru/pkgs/container/yoru)
[![Interface](https://img.shields.io/badge/interface-English_%C2%B7_Russian-8b5cf6?style=flat-square)](#features)

[Features](#features) · [Getting started](#getting-started) · [Dokploy](docs/deploy/dokploy.md) · [Coolify](docs/deploy/coolify.md) · [Sources](#sources) · [Extensions](docs/extensions/README.md)

</div>


## Features

Lists, a player with subtitles or dubs, a release calendar, friends and a shared feed. Titles and video come from the providers you pick and put in order, and extensions add your own.

**Watch**
- Player with video from Anime365, Kodik or your own extensions. If the first source has no episode, the next one is used.
- Subtitles or voice-over, a favourite translation author for each, and playback that resumes where you stopped.
- Skip buttons for openings and endings.
- Watch together (beta): a room where pause, seeking, speed, the episode and the translation stay in sync for everyone.

**Track**
- Lists with statuses, progress, scores, rewatches and notes, in a grid or a table with filters and sorting.
- Notes in Markdown on any anime or episode, private or shared with friends.
- Stats: hours watched, scores, genres, studios, seasons and more.
- Notifications when a new episode gets subtitles or voice-over, and optionally when a new title premieres.
- Import from AniList, Shikimori, MyAnimeList or Seanime; export to JSON, CSV and MAL XML.

**Discover**
- Home page with continue watching, upcoming episodes and a watch activity grid.
- Discover page with seasonal highlights, trending, top rated, upcoming and fresh translations.
- Schedule as a month calendar of aired and upcoming episodes.
- Anime pages with related titles in watch order, characters and voice actors, similar anime, screenshots and the trailer.

**Together**
- Profiles with an avatar (GIFs too), favourites and privacy settings for the list, stats and friends.
- Friends, a feed of their activity, reactions and comments.
- Recommend an anime to a friend or invite friends to a watch together room.
- Blocking, and moderation tools for admins.
- Public read-only link to your list or stats, for people without an account.

**Make it yours**
- Light and dark themes, colour presets, page width, and navigation on any side of the screen.
- Anime titles in romaji, English, Japanese or Russian.
- Interface in Russian and English.
- Interface sounds with several themes (off by default).

## Screenshots

![Home page](docs/home.webp)

![My lists](docs/lists.webp)

![Discover page](docs/discover.webp)

## Getting started

### Docker (recommended)

A multi-arch image (`amd64`, `arm64`) is published to GHCR on every push to `master`. Everything yoru stores lives on one `/data` volume, and database migrations run on start.

```bash
curl -fsSL https://raw.githubusercontent.com/anivire/yoru/master/docs/deploy/docker-compose.yml -o docker-compose.yml
docker compose up -d
docker compose logs yoru
```

Open the link from the log (`[yoru] no admin yet, create one at …/invite/<code>`) to create the admin account. There is no open registration: invite people under **Management → Invites**.

Before you share yoru, set `APP_URL` in `docker-compose.yml` to the address people will open it at and put it behind a reverse proxy (Caddy, Traefik, nginx) for HTTPS. Invite links and link previews are built from `APP_URL`, and login cookies are marked secure when it starts with `https://`. Behind nginx, forward WebSockets so watch together rooms work: `proxy_http_version 1.1`, `proxy_set_header Upgrade $http_upgrade` and `proxy_set_header Connection "upgrade"`.

### Updating

When a new version is out, the footer in yoru says so and links to its [release notes](https://github.com/anivire/yoru/releases). To update:

```bash
docker compose pull
docker compose up -d
```

Your data stays in the `yoru-data` volume, and database migrations run on start.

The image tag in `docker-compose.yml` decides what you get:

| Tag | What you get |
|---|---|
| `latest` | The newest release. Recommended |
| `0.68` | Only fixes for 0.68, no new features |
| `0.68.0` | Exactly this release, it never changes |
| `edge` | Every change as soon as it lands in `master`, before a release. Can break |

### Dokploy and Coolify

Step-by-step guides: [Dokploy](docs/deploy/dokploy.md), [Coolify](docs/deploy/coolify.md). Both build the image on your server from the repository, so they follow `master` like the `edge` tag.

<details>
<summary>Building from source</summary>

```bash
git clone https://github.com/anivire/yoru.git
cd yoru
cp .env.example .env    # set APP_URL, and ADMIN_USERNAME and ADMIN_PASSWORD if you want
docker compose up -d --build
```

The `docker-compose.yml` in the repository builds the image itself and reads settings from `.env`; the first build takes a few minutes. To update, run `git pull` and the same `docker compose up -d --build`.

</details>

### Video tokens

- **Anime365** gives video only to accounts with an active subscription. Create an API app on [smotret-anime.app](https://smotret-anime.app), generate an `access_token` and paste it into the Anime365 settings under **Management → Sources** (for everyone) or **Settings → Account** (just for you).
- **Kodik** issues tokens on request; paste it into the Kodik settings. Kodik plays in its own player, so skip buttons and watch together are not available with it.

## Sources

Everything yoru takes from other services is set up in **Management → Sources**. Drag providers into order, switch them on or off and open their settings; changes apply without a restart, and values from `.env` are only the defaults.

| Group | Providers | Used for |
|---|---|---|
| **Primary** | [MyAnimeList](https://myanimelist.net) via [Jikan](https://jikan.moe), [AniList](https://anilist.co), [Shikimori](https://shikimori.io), [Kitsu](https://kitsu.app), [Anime365](https://smotret-anime.app) | Anime data and search. Providers are asked top to bottom until one answers; only MyAnimeList is on by default. |
| **Video** | [Anime365](https://smotret-anime.app), [AniLibria](https://anilibria.top), Kodik | The player, in order. |
| **Features** | Shikimori, AniList, [AniSkip](https://aniskip.com), GitHub | Discover and schedule, screenshots, Russian titles, related titles and characters, skip times, the update check. Each has its own switch. |

## Configuration

All variables are optional except `APP_URL`. Tokens, OAuth keys, API addresses and the GitHub settings can also be changed in the admin panel.

| Variable | Default | What it does |
|---|---|---|
| `APP_URL` | `http://localhost:5173` | Public address, used for invite links, OAuth redirects and secure cookies |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD` | | First admin on an empty database |
| `ANIME365_TOKEN`, `KODIK_TOKEN` | | Shared video tokens; Kodik stays off without one |
| `ANILIST_CLIENT_ID`, `ANILIST_CLIENT_SECRET` | | AniList import |
| `SHIKIMORI_CLIENT_ID`, `SHIKIMORI_CLIENT_SECRET` | | Shikimori import |
| `MAL_CLIENT_ID`, `MAL_CLIENT_SECRET` | | MyAnimeList import |
| `ANIME365_URL`, `JIKAN_URL`, `SHIKIMORI_URL`, `ANILIST_URL`, `KITSU_URL`, `ANILIBRIA_URL`, `KODIK_URL` | public instances | API addresses |
| `GITHUB_REPO`, `GITHUB_BRANCH`, `GITHUB_TOKEN` | `anivire/yoru`, `master` | Update check; the token is only for a private repository |
| `RELEASE_POLL_MINUTES` | `5` | How often new Anime365 releases are checked |
| `SESSION_DAYS` | `30` | Login session lifetime |
| `DATA_DIR`, `DATABASE_PATH` | `./data`, `<DATA_DIR>/yoru.db` | Database location; the Docker image uses `/data` |
| `METADATA_SOURCE` | `jikan` | Legacy: `anime365` puts Anime365 first until the order is saved in the admin panel |

## Development

Requires Node.js 22.12 or newer.

```bash
npm install
npm run dev          # web on localhost:5173, API on port 3000
npm run typecheck    # TypeScript across the workspace
npm run build        # production build
npm run db:generate  # new Drizzle migration after schema changes
```

The API reads `.env` from the repository root and keeps its database in `apps/api/data`. The repository is an Nx workspace: `apps/api` (Hono, Drizzle, SQLite), `apps/web` (React, TanStack Query, Tailwind CSS), `packages/ui` (shared components) and `packages/shared` (types). See [AGENTS.md](AGENTS.md) for code conventions and [DESIGN.md](DESIGN.md) for the design system.

## License

yoru is licensed under the [GNU Affero General Public License v3.0](LICENSE).
