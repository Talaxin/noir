/**
 * AnimeKai service for Noir via Consumet API
 * Routes: /anime/animekai/{query}, /anime/animekai/info?id=, /anime/animekai/watch/{episodeId}
 * See: https://docs.consumet.org (animekai provider)
 * Base URL: your Consumet instance. Examples:
 *   Same machine:     http://localhost:3000
 *   Tailscale network: http://100.108.109.53:3000
 *   Public (Funnel):   https://mac2.tail58f58f.ts.net/consumet
 */
const CONSUMET_BASE = "https://mac2.tail58f58f.ts.net/consumet";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:146.0) Gecko/20100101 Firefox/146.0",
  "Accept": "application/json"
};

function safeText(res) {
  if (!res || typeof res.text !== "function") return Promise.resolve("");
  return res.text().then(function (t) { return t != null ? String(t) : ""; }).catch(function () { return ""; });
}

function parseIdFromHref(url) {
  if (!url || typeof url !== "string") return "";
  // href is BASE + "/anime/" + id (e.g. https://api.consumet.org/anime/naruto-shippuden-1)
  var idx = url.indexOf("/anime/");
  if (idx < 0) return url;
  return url.slice(idx + 7).split("?")[0].split("/")[0];
}

async function searchResults(keyword) {
  try {
    var q = (keyword || "").trim();
    if (!q) return JSON.stringify([{ title: "No results found", image: "", href: "" }]);
    var url = CONSUMET_BASE + "/anime/animekai/" + encodeURIComponent(q) + "?page=1";
    var response = await fetchv2(url, HEADERS);
    var text = await safeText(response);
    if (!response || response.status !== 200 || !text || text.trim().charAt(0) !== "{") {
      throw new Error("Search failed or invalid response");
    }
    var json = JSON.parse(text);
    var results = json.results || [];
    var out = results.map(function (item) {
      return {
        title: item.title || "Unknown",
        image: item.image || "",
        href: CONSUMET_BASE + "/anime/" + (item.id || "")
      };
    });
    return JSON.stringify(out.length ? out : [{ title: "No results found", image: "", href: "" }]);
  } catch (err) {
    console.error("AnimeKai search error:", err);
    return JSON.stringify([{ title: "Search failed", image: "", href: "" }]);
  }
}

async function extractDetails(url) {
  try {
    var id = parseIdFromHref(url);
    if (!id) throw new Error("Invalid URL");
    var apiUrl = CONSUMET_BASE + "/anime/animekai/info?id=" + encodeURIComponent(id);
    var response = await fetchv2(apiUrl, HEADERS);
    var text = await safeText(response);
    if (!response || response.status !== 200 || !text || text.trim().charAt(0) !== "{") {
      throw new Error("Info failed or invalid response");
    }
    var json = JSON.parse(text);
    return JSON.stringify([{
      description: json.description || "N/A",
      aliases: json.otherName || "N/A",
      airdate: json.releaseDate || json.status || "N/A"
    }]);
  } catch (err) {
    console.error("AnimeKai extractDetails error:", err);
    return JSON.stringify([{ description: "Error loading details", aliases: "", airdate: "" }]);
  }
}

async function extractEpisodes(url) {
  try {
    var id = parseIdFromHref(url);
    if (!id) return JSON.stringify([{ number: 1, href: "" }]);
    var apiUrl = CONSUMET_BASE + "/anime/animekai/info?id=" + encodeURIComponent(id);
    var response = await fetchv2(apiUrl, HEADERS);
    var text = await safeText(response);
    if (!response || response.status !== 200 || !text || text.trim().charAt(0) !== "{") {
      throw new Error("Info failed");
    }
    var json = JSON.parse(text);
    var episodes = json.episodes || [];
    var out = episodes.map(function (ep) {
      var num = parseInt(ep.number, 10) || 0;
      var href = ep.id != null ? String(ep.id) : "";
      return { number: num, href: href };
    });
    return JSON.stringify(out.length ? out : [{ number: 1, href: "" }]);
  } catch (err) {
    console.error("AnimeKai extractEpisodes error:", err);
    return JSON.stringify([{ number: 1, href: "" }]);
  }
}

async function extractStreamUrl(episodeIdOrUrl) {
  try {
    var episodeId = episodeIdOrUrl;
    if (typeof episodeIdOrUrl !== "string") episodeId = "";
    else if (episodeIdOrUrl.indexOf("/anime/") >= 0) {
      // URL like .../watch/naruto-shippuden-1-episode-1 or .../anime/... we need episode id
      var match = episodeIdOrUrl.match(/\/watch\/([^/?]+)/);
      if (match) episodeId = match[1];
      else episodeId = parseIdFromHref(episodeIdOrUrl);
    }
    if (!episodeId) return JSON.stringify({ streams: [], subtitles: "" });
    // Omit server param so provider uses default (vidstreaming can fail on some instances)
    var watchUrl = CONSUMET_BASE + "/anime/animekai/watch/" + encodeURIComponent(episodeId) + "?dub=true";
    var response = await fetchv2(watchUrl, HEADERS);
    var text = await safeText(response);
    if (!response || response.status !== 200 || !text || text.trim().charAt(0) !== "{") {
      throw new Error("Watch failed or invalid response");
    }
    var json = JSON.parse(text);
    var apiHeaders = json.headers || {};
    var ref = apiHeaders.Referer || CONSUMET_BASE + "/";
    var origin = ref;
    // Derive Origin from Referer host when possible (e.g. https://4spromax.site/e/... → https://4spromax.site)
    var m = typeof ref === "string" ? ref.match(/^(https?:\/\/[^/]+)/i) : null;
    if (m && m[1]) origin = m[1];
    var streamHeaders = {
      "Referer": ref,
      "Origin": apiHeaders.Origin || origin,
      "User-Agent": apiHeaders["User-Agent"] || HEADERS["User-Agent"]
    };
    var sources = json.sources || [];
    var streams = sources.map(function (s) {
      var quality = (s.quality || "default").toUpperCase();
      return {
        title: quality,
        streamUrl: s.url || "",
        headers: streamHeaders
      };
    }).filter(function (s) { return s.streamUrl; });
    // AnimeKai subtitle sidecar tracks can trigger aggressive retries in AVPlayer
    // (repeated .vtt/.srt/.gif pulls) and cause stalls. Keep playback stable by
    // not auto-attaching external subtitles here.
    return JSON.stringify({ streams: streams, subtitles: "" });
  } catch (err) {
    console.error("AnimeKai extractStreamUrl error:", err);
    return JSON.stringify({ streams: [], subtitles: "" });
  }
}
