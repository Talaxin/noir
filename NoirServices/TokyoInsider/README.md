# Tokyo Insider service for Noir

This service lets Noir search and resolve **direct download links** for anime from [Tokyo Insider](https://www.tokyoinsider.com/). The logic is inspired by [Tokyo-Downloader](https://www.tokyoinsider.com/) (Python), adapted to the Noir/Sora JS service API.

## Behaviour

- **Search**: Uses Tokyo Insider’s letter index (e.g. `/anime/B` for “Bleach”). No public search API; results are filtered client-side by keyword.
- **Details**: Fetches the anime page and returns a short description when available.
- **Episodes**: Parses the anime page for episode/OVA/special/movie links (class `download-link` and type from `<em>`).
- **Stream URL**: Fetches the episode page, finds download entries (divs with class `c_h2`/`c_h2b`), picks the “Most Downloaded” option, and returns the direct file URL as the “stream” (so Noir can play or enqueue for download).

Tokyo Insider does not stream; it indexes **direct file links** (e.g. mp4/mkv). Noir treats the resolved URL as a single stream; use “Download” in the app to save the file.

## Install in Noir

1. **Host the files**  
   You must serve both `tokyoinsider.json` and `tokyoinsider.js` over HTTPS (e.g. GitHub raw, your own server, or a Gist).

2. **Set `scriptUrl` in the manifest**  
   In `tokyoinsider.json`, set `scriptUrl` to the full URL of your hosted `tokyoinsider.js`, for example:
   - `https://your-domain.example/NoirServices/TokyoInsider/tokyoinsider.js`
   - or `https://your-domain.com/tokyoinsider.js`

3. **Add the service in Noir**  
   In Noir: **Settings → Services → “+”** and enter the URL of your hosted **`tokyoinsider.json`** (the JSON URL, not the script URL). Noir will fetch the manifest and then the script from `scriptUrl`.

## Files

- `tokyoinsider.json` – Service manifest (update `scriptUrl` to your hosted JS).
- `tokyoinsider.js` – Service script (`searchResults`, `extractDetails`, `extractEpisodes`, `extractStreamUrl`).
- `README.md` – This file.

## Requirements

- Noir’s JS environment provides `fetchv2` (and optionally `fetch`). No extra globals.
- Tokyo Insider pages must remain parseable (same class names and structure). If the site changes its HTML, the script may need updates.

## License

Use and adapt as you like. Tokyo Insider and Tokyo-Downloader are third-party; respect their terms and copyright.
