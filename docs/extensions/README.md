# yoru extensions

Extensions add your own data sources to yoru: where titles come from, how search works, and where the player finds video. That is all they can do: they cannot change the interface or add features beyond these three kinds of source. The model follows Seanime: an extension is a JSON manifest plus JavaScript code, installed by link under **Admin panel → Sources → Extensions** and updated from the same link.

Installed extensions appear in the source lists next to the built-in ones. Admins drag them into order: **Primary** (anime data and search) and **Video** (the player). yoru asks the list top to bottom until a provider answers, so an extension can be the main source or a fallback.

## Manifest

```json
{
  "id": "my-source",
  "name": "My source",
  "version": "1.0.0",
  "type": "search-provider",
  "author": "you",
  "description": "What it does, shown in the admin panel.",
  "manifestURI": "https://example.com/yoru/my-source.json",
  "payloadURI": "my-source.js",
  "settings": [{ "key": "token", "label": "API token", "type": "password" }]
}
```

| Field | |
|---|---|
| `id` | Lowercase letters, digits, `.`, `_`, `-`. Installing a manifest with an existing id updates that extension. |
| `name`, `version` | Shown in the admin panel. The update check compares `version` with the installed one. |
| `type` | `metadata-provider`, `search-provider` or `video-provider`. |
| `manifestURI` | Where yoru looks for updates. Defaults to the link the manifest was installed from. |
| `payloadURI` | Link to the code, absolute or relative to the manifest. |
| `payload` | The code itself, instead of `payloadURI`. Use it when pasting a manifest instead of linking it. |
| `settings` | Fields the admin fills in (`text` or `password`). Passwords are never sent back to the browser. |
| `kinds` | Video only: which kinds the provider offers, from `sub`, `voice`, `subEn`, `voiceEn`, `raw`. Defaults to all. |

## Code

The code defines a `class Provider`. yoru creates a new instance for every call and calls one method on it. Methods may be `async`. Return plain JSON-compatible objects; yoru checks them and records a clear error in the admin panel when the shape is wrong.

Every anime is identified by its **MyAnimeList id** (`malId`). Lists, progress and everything else hang off that id, so results without one are dropped.

### `metadata-provider`

```js
class Provider {
  async anime(malId) {
    return {
      title: 'Sousou no Frieren',
      titleEnglish: "Frieren: Beyond Journey's End",
      titleRussian: 'Провожающая в последний путь Фрирен',
      imageUrl: 'https://…/poster.jpg',
      type: 'tv',
      episodes: 28,
      status: 'finished',
      year: 2023,
      score: 9.25,
      genres: ['Adventure', 'Drama'],
      studios: ['Madhouse'],
      synopsis: '…',
    }
  }
}
```

Return `null` when the title is unknown; yoru moves on to the next provider. Only `title` is required. Optional fields: `titleEnglish`, `titleJapanese`, `titleRussian`, `synonyms`, `imageUrl`, `type`, `episodes`, `status` (`airing`, `finished`, `upcoming`), `year`, `season`, `score`, `genres`, `studios`, `synopsis`, `duration`, `rating`, `airedFrom`, `airedTo`, `trailerUrl`.

### `search-provider`

```js
class Provider {
  async search({ q, page, type, status }) {
    return { items: [{ malId: 52991, title: 'Sousou no Frieren' }], hasNextPage: false }
  }
}
```

`q` can be empty: then return what fits the filters, or what is popular now. `type` is `tv`, `movie`, `ova`, `ona`, `special` or `music`; `status` is `airing`, `complete` or `upcoming`. Each item takes the same fields as `anime` above plus a required `malId`. Genre filters are not passed to extensions; such searches go to a built-in provider.

### `video-provider`

```js
class Provider {
  async episodes(anime) {
    return { matched: true, title: 'Title on the source', episodes: [1, 2, 3] }
  }
  async translations(anime, episode, kind) {
    return [{ id: 'abc', kind: 'voice', author: 'Studio', height: 1080, quality: 'tv' }]
  }
  async stream(anime, episode, translationId) {
    return {
      sources: [{ url: 'https://…/1080.m3u8', type: 'm3u8', height: 1080 }],
      subtitlesUrl: null,
      headers: { Referer: 'https://source.example/' },
    }
  }
}
```

`anime` describes the title so the extension can find it: `malId`, `title`, `titleEnglish`, `titleJapanese`, `titleRussian`, `synonyms`, `type`, `year`, `episodes`.

- `episodes` returns `matched: false` when the source does not have the title; the player then tries the next video provider.
- `translations` lists voice-overs or subtitles of one `kind` for one episode. `id` is passed back to `stream`.
- `stream` returns direct `mp4` or `m3u8` links. When the source needs special headers (`Referer`, cookies, a token), return them in `headers`: yoru then plays the video through its own proxy and adds the headers to every request, including the HLS segments. Subtitles always go through the proxy.
- When a source only offers its own player, return `embedUrl` instead of `sources`. yoru shows that page in a frame; skipping openings, watch together and subtitles from yoru do not work there, and progress is saved only if the player reports it the way Kodik's does.

## What the code can use

Extensions run in [QuickJS](https://bellard.org/quickjs/) compiled to WebAssembly, isolated from the server. There is no file system, no database, no Node.js and no `require`. Available:

- `fetch(url, { method, headers, body })` for `http` and `https`. The response has `ok`, `status`, `url`, `headers.get(name)`, `text()` and `json()`. Bodies are limited to 5 MB and each request to 10 seconds.
- `URLSearchParams` (`append`, `set`, `get`, `getAll`, `has`, `delete`, `toString`).
- `$settings`: the values from the manifest's `settings`, read-only.
- `console.log`, `console.warn`, `console.error`: lines show up in the extension's log in the admin panel.
- Standard JavaScript: `JSON`, `Math`, `Date`, `RegExp` with Unicode properties, `encodeURIComponent`, `Promise`, classes, `async`/`await`.

Each call gets about 32 MB of memory and 15 seconds in total. A call that runs longer is stopped and counted as an error.

`fetch` can reach any address the server can, including your local network. Install only extensions you trust.

## Examples

Working examples in [`examples/`](examples):

| Extension | Type | |
|---|---|---|
| [`shikimori-anime`](examples/shikimori-anime.json) | `metadata-provider` | Anime data from Shikimori, with a setting for the Shikimori address |
| [`shikimori-search`](examples/shikimori-search.json) | `search-provider` | Search in any language through Shikimori |
| [`anilibria-video`](examples/anilibria-video.json) | `video-provider` | AniLibria voice-overs through their public API |

To try one, paste the raw link to its manifest into the admin panel, or serve the folder locally (`python -m http.server`) and install from `http://localhost:8000/<name>.json`.
