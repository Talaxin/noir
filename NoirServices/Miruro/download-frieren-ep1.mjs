#!/usr/bin/env node
/**
 * Download first episode of Frieren via Miruro module.
 * Usage: node download-frieren-ep1.mjs [sub|dub] [output.mp4]
 * Requires: node 18+, ffmpeg in PATH
 */

import { readFileSync } from "fs";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { gunzipSync } from "zlib";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = join(__dirname, "miruro.js");
const category = (process.argv[2] || "sub").toLowerCase() === "dub" ? "dub" : "sub";
const outName = process.argv[3] || "Frieren_S01E01.mp4";
const outPath = join(__dirname, outName);

const BASE = "https://www.miruro.to";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept": "application/json",
  "Referer": BASE + "/",
};

function fetchv2(url, headers = {}, method = "GET", body = null) {
  const opts = {
    method: method || "GET",
    headers: headers && typeof headers === "object" ? headers : {},
  };
  if (opts.method !== "GET" && body != null) {
    opts.body = typeof body === "object" ? JSON.stringify(body) : String(body);
    if (!opts.headers["Content-Type"] && typeof body === "object") opts.headers["Content-Type"] = "application/json";
  }
  return fetch(url, opts).then(async (res) => {
    const text = await res.text();
    return {
      status: res.status,
      _data: text,
      text: () => Promise.resolve(text),
      json: () => Promise.resolve(JSON.parse(text)),
    };
  }).catch((err) => {
    return { status: 0, _data: "", text: () => Promise.resolve(""), json: () => Promise.reject(err) };
  });
}

function btoa(str) {
  return Buffer.from(String(str), "utf8").toString("base64");
}

function decodePipeResponse(base64String) {
  try {
    return gunzipSync(Buffer.from(String(base64String), "base64")).toString("utf8");
  } catch (e) {
    return null;
  }
}

const script = readFileSync(scriptPath, "utf8");
const fn = new Function(
  "fetchv2", "btoa", "decodePipeResponse", "console",
  "encodeURIComponent", "JSON", "parseInt", "String", "Array", "Object", "Promise", "Error", "RegExp",
  script + "\nreturn { extractEpisodes, extractStreamUrl };"
);
const api = fn(fetchv2, btoa, decodePipeResponse, console, encodeURIComponent, JSON, parseInt, String, Array, Object, Promise, Error, RegExp);

async function main() {
  const infoUrl = "https://www.miruro.to/info/154587";
  console.log("Fetching episodes for Frieren...");
  const episodesOut = await api.extractEpisodes(infoUrl);
  const episodes = JSON.parse(episodesOut);
  if (!Array.isArray(episodes) || !episodes.length || !episodes[0].href) {
    console.error("No episodes found");
    process.exit(1);
  }
  const firstHref = episodes[0].href;
  console.log("Episode 1 href:", firstHref.split("|")[0].slice(0, 30) + "...");

  console.log("Fetching stream URL (" + category + ")...");
  const streamOut = await api.extractStreamUrl(firstHref, category);
  const streamJson = JSON.parse(streamOut);
  const streams = streamJson.streams || [];
  const first = streams.find((s) => (s.streamUrl || "").includes("m3u8") || (s.streamUrl || "").includes(".m3u8")) || streams[0];
  if (!first || !first.streamUrl) {
    console.error("No stream URL in response");
    process.exit(1);
  }
  const streamUrl = first.streamUrl;
  const referer = (first.headers && first.headers["Referer"]) || BASE + "/";
  console.log("Stream URL (first 60 chars):", streamUrl.slice(0, 60) + "...");
  console.log("Referer:", referer);

  const tmpDir = join(__dirname, ".tmp");
  if (!existsSync(tmpDir)) mkdirSync(tmpDir, { recursive: true });
  const masterPath = join(tmpDir, "master.m3u8");
  const variantPath = join(tmpDir, "variant.m3u8");

  console.log("Downloading master playlist...");
  const masterRes = await fetch(streamUrl, { headers: { Referer: referer, "User-Agent": HEADERS["User-Agent"] } });
  let masterText = await masterRes.text();
  if (!masterText.includes("#EXTM3U")) {
    console.error("Invalid master playlist");
    process.exit(1);
  }

  let playlistUrl = streamUrl;
  let playlistText = masterText;
  if (masterText.includes("#EXT-X-STREAM-INF")) {
    const lines = masterText.split("\n").filter((l) => l.trim());
    let variantLine = null;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("#EXT-X-STREAM-INF")) {
        if (i + 1 < lines.length && !lines[i + 1].startsWith("#")) {
          variantLine = lines[i + 1].trim();
          break;
        }
      }
    }
    if (variantLine) {
      const base = streamUrl.replace(/\/[^/]*$/, "/");
      const variantUrl = variantLine.startsWith("http") ? variantLine : (base + variantLine);
      console.log("Downloading variant playlist...");
      const variantRes = await fetch(variantUrl, { headers: { Referer: referer, "User-Agent": HEADERS["User-Agent"] } });
      playlistText = await variantRes.text();
      playlistUrl = variantUrl;
    }
  }

  playlistText = playlistText.replace(/\.[a-zA-Z0-9]+(\s*)$/gm, ".ts$1");
  const baseForSegments = playlistUrl.replace(/\/[^/]*$/, "/");
  const fixedLines = playlistText.split("\n").map((line) => {
    const t = line.trim();
    if (t && !t.startsWith("#") && !t.startsWith("http")) {
      return baseForSegments + t;
    }
    return line;
  });
  writeFileSync(variantPath, fixedLines.join("\n"), "utf8");

  console.log("Running ffmpeg...");
  const ffmpegArgs = [
    "-y", "-hide_banner", "-loglevel", "warning",
    "-allowed_extensions", "ALL",
    "-protocol_whitelist", "file,http,https,tcp,tls,crypto",
    "-i", variantPath,
    "-c", "copy", "-bsf:a", "aac_adtstoasc",
    outPath
  ];
  try {
    execFileSync("ffmpeg", ffmpegArgs, { stdio: "inherit", cwd: __dirname });
  } catch (e) {
    console.error("ffmpeg failed:", e.message || e);
    process.exit(1);
  }
  console.log("Saved:", outPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
