# Example extensions

Working extensions for each type. To install one, copy its manifest link into **Admin panel → Sources → Extensions**.

| Extension | Type | Manifest link |
|---|---|---|
| Shikimori anime data | `metadata-provider` | `https://raw.githubusercontent.com/anivire/yoru/master/docs/extensions/examples/shikimori-anime.json` |
| Shikimori search | `search-provider` | `https://raw.githubusercontent.com/anivire/yoru/master/docs/extensions/examples/shikimori-search.json` |
| AniLibria video | `video-provider` | `https://raw.githubusercontent.com/anivire/yoru/master/docs/extensions/examples/anilibria-video.json` |

Each manifest points to the code next to it (`payloadURI`), so a copy of this folder works from any server: serve it with `python -m http.server` and install from `http://localhost:8000/<name>.json`. The format is described in [the extension guide](../README.md).
