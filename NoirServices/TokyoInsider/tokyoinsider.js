/**
 * Tokyo Insider service for Noir/Sora
 * Fetches anime download links from https://www.tokyoinsider.com/
 * Logic adapted from Tokyo-Downloader: https://www.tokyoinsider.com/
 */

const BASE = "https://www.tokyoinsider.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US, en;q=0.5"
};

function getLetter(keyword) {
  const c = (keyword || "").trim().charAt(0).toUpperCase();
  if (/[A-Z]/.test(c)) return c;
  if (/[0-9]/.test(c)) return "0";
  return "0";
}

async function searchResults(keyword) {
  const results = [];
  try {
    const letter = getLetter(keyword);
    const url = `${BASE}/anime/${letter}`;
    const response = await fetchv2(url, HEADERS);
    const html = await response.text();
    const query = (keyword || "").toLowerCase().trim();
    const regex = /\[([^\]]+)\]\((https:\/\/www\.tokyoinsider\.com\/anime\/[^)]+)\)/g;
    let match;
    const seen = new Set();
    while ((match = regex.exec(html)) !== null) {
      const title = decodeHtmlEntities(match[1].trim());
      const href = match[2];
      if (seen.has(href)) continue;
      if (query && !title.toLowerCase().includes(query)) continue;
      seen.add(href);
      results.push({ title, image: "", href });
      if (results.length >= 40) break;
    }
    return JSON.stringify(results.length ? results : [{ title: "No results found", image: "", href: "" }]);
  } catch (err) {
    console.error("Tokyo Insider search error:", err);
    return JSON.stringify([{ title: "Search failed: " + (err.message || err), image: "", href: "" }]);
  }
}

async function extractDetails(url) {
  try {
    const fullUrl = url.startsWith("http") ? url : BASE + url;
    const response = await fetchv2(fullUrl, HEADERS);
    const html = await response.text();
    const descMatch = html.match(/<div[^>]*class="[^"]*desc[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
    const description = descMatch ? stripHtml(descMatch[1]).trim().slice(0, 500) : "No description available.";
    return JSON.stringify([{
      description,
      aliases: "Tokyo Insider – direct download links",
      airdate: ""
    }]);
  } catch (err) {
    console.error("Tokyo Insider extractDetails error:", err);
    return JSON.stringify([{ description: "Error loading details", aliases: "", airdate: "" }]);
  }
}

async function extractEpisodes(url) {
  const episodes = [];
  try {
    const fullUrl = url.startsWith("http") ? url : BASE + url;
    const response = await fetchv2(fullUrl, HEADERS);
    const html = await response.text();
    const linkRegex = /\[([^\]]+)\]\((https:\/\/www\.tokyoinsider\.com\/anime\/[^)]+(?:\/(?:episode|ova|special|movie)\/[^)]+)?)\)/g;
    const seen = new Set();
    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[2];
      if (!href.includes("/episode/") && !href.includes("/ova/") && !href.includes("/special/") && !href.includes("/movie/")) continue;
      if (seen.has(href)) continue;
      seen.add(href);
      const numMatch = href.match(/\/(?:episode|ova|special|movie)\/([^\/\?]+)/i);
      const number = numMatch ? (parseInt(numMatch[1], 10) || seen.size) : seen.size;
      episodes.push({ number, href });
    }
    episodes.sort((a, b) => a.number - b.number);
    return JSON.stringify(episodes.map(({ number, href }) => ({ number, href })));
  } catch (err) {
    console.error("Tokyo Insider extractEpisodes error:", err);
    return JSON.stringify([{ number: 1, href: "", title: "Error" }]);
  }
}

async function extractStreamUrl(episodePageUrl) {
  try {
    const url = episodePageUrl.startsWith("http") ? episodePageUrl : BASE + "/" + episodePageUrl.replace(/^\/+/, "");
    const response = await fetchv2(url, HEADERS);
    let html = await response.text();
    html = cleanJsonHtml(html);
    const divRegex = /<div[^>]*class="[^"]*(?:c_h2|c_h2b)[^"]*"[^>]*>([\s\S]*?)<\/div>/gi;
    const divs = [];
    let divMatch;
    while ((divMatch = divRegex.exec(html)) !== null) {
      divs.push(divMatch[1]);
    }
    if (divs.length === 0) {
      const altRegex = /<div[^>]*class="[^"]*c_h2[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>/gi;
      const altMatch = altRegex.exec(html);
      if (altMatch) {
        const rawLink = altMatch[1];
        const downloadUrl = rawLink.startsWith("http") ? rawLink : BASE + "/" + rawLink.replace(/^\/+/, "");
        if (downloadUrl.indexOf("tokyoinsider") !== -1 || downloadUrl.indexOf("media.") !== -1) {
          return JSON.stringify({
            streams: [{ title: "Direct", streamUrl: downloadUrl }],
            subtitles: ""
          });
        }
      }
      return JSON.stringify({ streams: [], subtitles: "" });
    }
    const withMeta = divs.map(block => {
      const bTexts = (block.match(/<b[^>]*>([^<]*)<\/b>/gi) || []).map(s => s.replace(/<[^>]+>/g, "").trim());
      const links = (block.match(/<a[^>]+href="([^"]+)"[^>]*>/gi) || []);
      const hrefs = links.map(lnk => {
        const h = lnk.match(/href="([^"]+)"/);
        return h ? h[1] : "";
      }).filter(Boolean);
      const downloadLink = hrefs[1] || hrefs[0] || "";
      const sizeStr = bTexts[1] || "0 MB";
      const downloads = parseInt((bTexts[2] || "0").replace(/,/g, ""), 10) || 0;
      const dateStr = bTexts[4] || "";
      return { block, downloadLink, sizeStr, downloads, dateStr };
    });
    withMeta.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
    const best = withMeta.find(w => w.downloadLink && (w.downloadLink.indexOf("tokyoinsider") !== -1 || w.downloadLink.indexOf("media.") !== -1)) || withMeta[0];
    if (!best || !best.downloadLink) {
      return JSON.stringify({ streams: [], subtitles: "" });
    }
    let streamUrl = best.downloadLink;
    if (!streamUrl.startsWith("http")) streamUrl = BASE + "/" + streamUrl.replace(/^\/+/, "");
    return JSON.stringify({
      streams: [{ title: "Direct download", streamUrl }],
      subtitles: ""
    });
  } catch (err) {
    console.error("Tokyo Insider extractStreamUrl error:", err);
    return JSON.stringify({ streams: [], subtitles: "" });
  }
}

function cleanJsonHtml(str) {
  if (!str) return "";
  return str
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r");
}

function stripHtml(html) {
  if (!html) return "";
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text) {
  if (!text) return "";
  return text
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}
