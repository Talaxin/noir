# Miruro service – test as Noir

Run: `node test-as-noir.mjs` to simulate Noir (manifest + script, then search → details → episodes → stream).

## What’s fixed

- **Episodes**: Tries Consumet public API first (`/meta/anilist/info/{id}`), then Miruro proxy, then info-page links. Episode `href` is always normalized to `anilistId-episodeNum` (e.g. `154587-1`).
- **Stream URL**: Tries (1) Miruro proxy watch, (2) Consumet public API watch (`/meta/anilist/watch/{episodeId}`) for each base, (3) Miruro pipe. Uses `safeText(res)` so bad or error responses don’t throw.
- **Pipe**: Only one episode id format is used (`animetrix:anime:154587-1`), so the 400 “episodeId and provider are required” from the alternate id is gone.
- **Robustness**: All `response.text()` usage goes through `safeText()`; JSON is only parsed when status is 200 and body looks like JSON.

## What still depends on external APIs

- **Streams**: Work when at least one of these works:
  - **Consumet API** returns sources for `/meta/anilist/watch/{episodeId}`. Per [Consumet GitHub](https://docs.consumet.org#installation), the API is **no longer publicly available**; self-hosting is required. Add your self-hosted base URL to `CONSUMET_BASES` in `miruro.js` for reliable streams.
  - Miruro pipe returns 200 with m3u8 URL (in practice this needs browser cookies/auth; from the app you get 444).
- If you don’t self-host Consumet and Miruro pipe keeps returning 444, you’ll see “failed to get a valid stream URL” until you have a working Consumet instance or Miruro session.

## Run test

```bash
cd NoirServices/Miruro && node test-as-noir.mjs
```

**Expected**: All four steps complete without errors. Search returns Frieren, details and episodes return valid data. `extractStreamUrl` always returns valid JSON `{ streams: [...], subtitles: "" }`; `streams` may be empty when Consumet and Miruro pipe are unavailable (pipe often returns 444 without browser auth).
