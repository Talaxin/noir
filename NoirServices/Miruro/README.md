# Miruro service for Noir

This service adds [Miruro](https://www.miruro.to/) as a source in Noir: **watch free anime online** in HD, subbed and dubbed.

## URL structure (miruro.to)

- **Search**: `https://www.miruro.to/search?query={keyword}&type=ANIME&sort=POPULARITY_DESC` (HTML). The script tries the **secure pipe** `path: "search"` first, then falls back to public `/api/search?q=...` if available.
- **Info**: `https://www.miruro.to/info/{anilistId}` — used as `href` for each search result. Details and episodes use the pipe API.
- **API**: `https://www.miruro.to/api/secure/pipe?e=<base64>` — single endpoint. Payload is JSON: `{ path, method, query, body }` (e.g. `{ "path": "sources", "method": "GET", "query": { "episodeId", "provider", "category", "anilistId" }, "body": null }`).
- **Streams**: HLS via **pro.ultracloud.cc** (m3u8, vtt, segment). Requests require **Referer: https://www.miruro.to/**.

## How it works

The script uses the **secure pipe API** and matches Noir’s expected JS interface:

- **searchResults(keyword)** – Pipe `path: "search"`, `query: { q, limit: 15, offset: 0, type: "ANIME", sort: "POPULARITY_DESC" }`. Returns `[{ title, image, href }]` with `href = https://www.miruro.to/info/{anilistId}`.
- **extractDetails(url)** – Reads `anilistId` from `/info/{id}`. Calls pipe `path: "info/{anilistId}"`, empty query. Returns `[{ description, aliases, airdate }]` (data from response `media`).
- **extractEpisodes(url)** – Reads `anilistId` from the info URL. Calls pipe `path: "episodes"`, `query: { anilistId }` (string). Episode list from `providers.arc.episodes.sub` / `.dub` (or kiwi). Returns `{ number, href }` with `href = episodeId|anilistId`.
- **extractStreamUrl(episodeUrl, preferredCategory?)** – Splits into `episodeId` and `anilistId`. Calls pipe `path: "sources"` for `kiwi`/`arc` and category `sub` or `dub` (when `preferredCategory` is set). Returns **streams[]** (HLS first; sub before dub) and **`subtitles`**: flat array `[label1, url1, label2, url2, …]` so the app can offer every softsub track in the player (CC menu). Streams carry referer headers; subtitles are de-duplicated by URL.

Noir’s JS environment provides `fetchv2`, `btoa`, and no extra globals.

## Install in Noir

1. **Host the files**  
   Serve both `miruro.json` and `miruro.js` over HTTPS (e.g. GitHub raw, your server).

2. **Set `scriptUrl` in the manifest**  
   In `miruro.json`, set `scriptUrl` to the full URL of your hosted `miruro.js` (replace `YOUR_HOST` or use your own URL).

3. **Add the service in Noir**  
   In Noir: **Settings → Services → “+”** and enter the URL of your hosted **`miruro.json`**.

## Requirements

- Noir’s JS environment provides `fetchv2`, `btoa` (for pipe payload encoding). No extra globals.
- If the site changes pipe path names (`search`, `anime`, `episodes`, `sources`) or response shapes, the script may need small updates to match.

## License

Use and adapt as you like. Miruro is a third-party site; respect their terms and copyright.
