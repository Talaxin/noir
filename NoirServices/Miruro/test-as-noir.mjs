#!/usr/bin/env node
/**
 * Run Miruro service script as Noir would: same globals (fetchv2, btoa, console)
 * and same call order (searchResults -> extractDetails -> extractEpisodes -> extractStreamUrl).
 * Node 18+ for fetch.
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { gunzipSync } from "zlib";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "miruro.js");
const jsonPath = join(__dirname, "miruro.json");

const logs = [];
const console = {
  log(...args) {
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    logs.push("[log] " + msg);
    process.stderr.write("[log] " + msg + "\n");
  },
  error(...args) {
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : String(a))).join(" ");
    logs.push("[error] " + msg);
    process.stderr.write("[error] " + msg + "\n");
  },
};

// Noir's fetchv2: returns Promise<{ _data, text(), json(), status, headers }>
// On network error Noir still resolves with an object that can have .error
function fetchv2(url, headers = {}, method = "GET", body = null, _redirect = true, _encoding) {
  const opts = {
    method: method || "GET",
    headers: headers && typeof headers === "object" && !Array.isArray(headers) ? headers : {},
  };
  if (opts.method !== "GET" && body != null) {
    opts.body = typeof body === "object" ? JSON.stringify(body) : String(body);
    if (!opts.headers["Content-Type"] && typeof body === "object") {
      opts.headers["Content-Type"] = "application/json";
    }
  }
  return fetch(url, opts)
    .then(async (res) => {
      const text = await res.text();
      // optional: if (url.includes("/api/secure/pipe")) console.log("[pipe] status:", res.status);
      return {
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        _data: text,
        text() {
          return Promise.resolve(this._data);
        },
        json() {
          try {
            return Promise.resolve(JSON.parse(this._data));
          } catch (e) {
            return Promise.reject(new Error("JSON parse error: " + e.message));
          }
        },
      };
    })
    .catch((err) => {
      console.error("fetchv2 failed:", err.message || err);
      return {
        status: 0,
        headers: {},
        _data: "",
        error: err.message || String(err),
        text() {
          return Promise.resolve(this._data || "");
        },
        json() {
          return Promise.reject(new Error(this.error || "No data"));
        },
      };
    });
}

// Noir provides btoa (UTF-8 string -> base64)
function btoa(str) {
  return Buffer.from(String(str), "utf8").toString("base64");
}

// Noir provides decodePipeResponse (base64 gzip -> JSON string) for Miruro pipe API
function decodePipeResponse(base64String) {
  try {
    const buf = Buffer.from(String(base64String), "base64");
    return gunzipSync(buf).toString("utf8");
  } catch (e) {
    return null;
  }
}

// Load manifest
let manifest;
try {
  manifest = JSON.parse(readFileSync(jsonPath, "utf8"));
  console.log("Loaded manifest:", manifest.sourceName, "scriptUrl:", manifest.scriptUrl);
} catch (e) {
  console.error("Failed to load miruro.json:", e.message);
  process.exit(1);
}

// Load and run script in a sandbox that only has fetchv2, btoa, console
const script = readFileSync(scriptPath, "utf8");
const fn = new Function(
  "fetchv2",
  "btoa",
  "decodePipeResponse",
  "console",
  "encodeURIComponent",
  "JSON",
  "parseInt",
  "String",
  "Array",
  "Object",
  "Promise",
  "Error",
  "RegExp",
  script + "\nreturn { searchResults, extractDetails, extractEpisodes, extractStreamUrl };"
);
let api;
try {
  api = fn(fetchv2, btoa, decodePipeResponse, console, encodeURIComponent, JSON, parseInt, String, Array, Object, Promise, Error, RegExp);
} catch (e) {
  console.error("Failed to load miruro.js:", e.message);
  if (e.stack) process.stderr.write(e.stack + "\n");
  process.exit(1);
}

async function run() {
  const errors = [];
  let infoUrl = null;
  let episodeHref = null;

  // 1) searchResults("frieren")
  console.log("\n--- searchResults('frieren') ---");
  try {
    const searchOut = await api.searchResults("frieren");
    const searchJson = JSON.parse(searchOut);
    if (!Array.isArray(searchJson)) {
      errors.push("searchResults did not return an array: " + typeof searchJson);
    } else if (searchJson.length && searchJson[0].href) {
      infoUrl = searchJson[0].href;
      console.log("First result href:", infoUrl);
    } else {
      console.log("Search result (first item):", searchJson[0]);
    }
  } catch (e) {
    errors.push("searchResults: " + (e.message || e));
    console.error("searchResults error:", e);
  }

  if (!infoUrl) {
    infoUrl = "https://www.miruro.to/info/154587";
    console.log("Using fallback info URL (Frieren anilistId 154587):", infoUrl);
  }

  // 2) extractDetails(infoUrl)
  console.log("\n--- extractDetails(infoUrl) ---");
  try {
    const detailsOut = await api.extractDetails(infoUrl);
    const detailsJson = JSON.parse(detailsOut);
    if (!Array.isArray(detailsJson) || !detailsJson[0]) {
      errors.push("extractDetails did not return non-empty array");
    } else {
      console.log("Description length:", (detailsJson[0].description || "").length, "airdate:", detailsJson[0].airdate);
    }
  } catch (e) {
    errors.push("extractDetails: " + (e.message || e));
    console.error("extractDetails error:", e);
  }

  // 3) extractEpisodes(infoUrl)
  console.log("\n--- extractEpisodes(infoUrl) ---");
  try {
    const episodesOut = await api.extractEpisodes(infoUrl);
    const episodesJson = JSON.parse(episodesOut);
    if (!Array.isArray(episodesJson)) {
      errors.push("extractEpisodes did not return an array");
    } else if (episodesJson.length && episodesJson[0].href) {
      episodeHref = episodesJson[0].href;
      console.log("First episode href:", episodeHref, "number:", episodesJson[0].number);
    } else {
      console.log("Episodes (first):", episodesJson[0]);
    }
  } catch (e) {
    errors.push("extractEpisodes: " + (e.message || e));
    console.error("extractEpisodes error:", e);
  }

  if (!episodeHref) {
    episodeHref = "1|154587"; // fallback: episodeId|anilistId if API format differs
    console.log("Using fallback episode href:", episodeHref);
  }

  // 4) extractStreamUrl(episodeId from episodes)
  const streamInputs = [episodeHref];
  for (const input of streamInputs) {
    console.log("\n--- extractStreamUrl(" + JSON.stringify(input) + ") ---");
    try {
      const streamOut = await api.extractStreamUrl(input);
      const streamJson = JSON.parse(streamOut);
      const streams = streamJson.streams || [];
      if (!Array.isArray(streamJson.streams)) {
        errors.push("extractStreamUrl streams is not an array for input: " + input);
      } else if (streams.length === 0) {
        console.log("extractStreamUrl returned valid JSON with 0 streams (external APIs may be down or require auth); response keys:", Object.keys(streamJson));
      } else {
        console.log("Streams:", streams.length, "first title:", streams[0].title, "url (first 80 chars):", (streams[0].streamUrl || "").slice(0, 80) + "...");
      }
    } catch (e) {
      errors.push("extractStreamUrl(" + input + "): " + (e.message || e));
      console.error("extractStreamUrl error:", e);
    }
  }

  console.log("\n========== SUMMARY ==========");
  if (errors.length) {
    console.error("Errors encountered:");
    errors.forEach((e) => console.error("  -", e));
    process.exitCode = 1;
  } else {
    console.log("All steps completed without thrown errors.");
  }
}

run().catch((e) => {
  console.error("Runner failed:", e);
  process.exitCode = 1;
});
