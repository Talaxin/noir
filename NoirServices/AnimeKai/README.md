# AnimeKai (Consumet API)

Anime source for Noir using the [Consumet](https://docs.consumet.org) **animekai** provider.

## API (Consumet animekai)

- **Search**: `GET /anime/animekai/{query}?page=1` → `{ results: [{ id, title, url, image, releaseDate, subOrDub }] }`
- **Info**: `GET /anime/animekai/info?id={id}` → anime details and `episodes: [{ id, number, title, url }]`
- **Watch**: `GET /anime/animekai/watch/{episodeId}?server=vidstreaming&dub=false` → `{ headers, sources: [{ url, quality, isM3U8 }] }`

## Base URL (your instance)

Default is set to a Tailscale Funnel base so it works from any device without a Tailscale client. To use a different instance, change `CONSUMET_BASE` in `animekai.js` and `baseUrl` / `searchBaseUrl` in `animekai.json`:

| Use case | Base URL |
|----------|----------|
| Same machine | `http://localhost:3000` |
| Other device on network | `http://<this-machine-IP>:3000` (e.g. `http://192.168.0.47:3000`) |
| Tailscale | `http://100.108.109.53:3000` |
| Public (Tailscale Funnel) | `https://mac2.tail58f58f.ts.net/consumet` |

API root check: `http://localhost:3000/` should return “Welcome to consumet api!”. Docs: [docs.consumet.org](https://docs.consumet.org/).

## Manifest

- **scriptUrl**: Host `animekai.js` and set this to the full URL (e.g. `https://your-host/animekai.js`).
- **baseUrl**: Your Consumet instance base URL (used for Referer/headers when playing streams).

## Behaviour

- **searchResults(keyword)** → `[{ title, image, href }]` with `href = base + "/anime/" + id`.
- **extractDetails(url)** → parses `id` from `href`, calls info API, returns `[{ description, aliases, airdate }]`.
- **extractEpisodes(url)** → same info API, returns `[{ number, href }]` with `href = episode.id` for watch.
- **extractStreamUrl(episodeId)** → calls watch API, returns `{ streams: [{ title, streamUrl, headers }], subtitles: "" }` using the API’s `Referer`/`User-Agent` when present.
