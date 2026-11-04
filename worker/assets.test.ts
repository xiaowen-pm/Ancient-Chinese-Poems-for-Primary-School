import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DOCUMENT_CACHE, HASHED_ASSET_CACHE, applyCacheControl, cacheControlFor, isSiteAssetPath } from "./assets.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

assert.equal(cacheControlFor("/assets/index-Dr_5hS2w.js"), HASHED_ASSET_CACHE);
assert.equal(cacheControlFor("/assets/index-uj8Y5B0P.css"), HASHED_ASSET_CACHE);
assert.equal(cacheControlFor("/assets/NotoSerifSC-kABEGg_A.woff2"), HASHED_ASSET_CACHE);
assert.equal(cacheControlFor("/"), DOCUMENT_CACHE);
assert.equal(cacheControlFor("/index.html"), DOCUMENT_CACHE);
assert.equal(cacheControlFor("/images/jingye.webp"), null);
assert.equal(cacheControlFor("/favicon.svg"), null);
assert.equal(cacheControlFor("/audio/jiangnan.mp3"), null);

assert.equal(isSiteAssetPath("/"), true);
assert.equal(isSiteAssetPath("/assets/index-Dr_5hS2w.js"), true);
assert.equal(isSiteAssetPath("/images/jingye.webp"), true);
assert.equal(isSiteAssetPath("/audio/jiangnan.mp3"), true);
assert.equal(isSiteAssetPath("/favicon.ico"), false);
assert.equal(isSiteAssetPath("/audio-pack.mp3"), false);
assert.equal(isSiteAssetPath("/api/pdf/full.pdf"), false);
assert.equal(isSiteAssetPath("/apple-touch-icon.png"), false);

const hashed = applyCacheControl(
  "/assets/index-Dr_5hS2w.js",
  new Response("ok", { headers: { "cache-control": "public, max-age=0, must-revalidate", etag: '"abc"' } }),
);
assert.equal(hashed.headers.get("cache-control"), HASHED_ASSET_CACHE);
assert.equal(hashed.headers.get("etag"), '"abc"');
assert.equal(await hashed.text(), "ok");

const painting = applyCacheControl(
  "/images/jingye.webp",
  new Response("img", { headers: { "cache-control": "public, max-age=0, must-revalidate" } }),
);
assert.equal(painting.headers.get("cache-control"), "public, max-age=0, must-revalidate");

const headers = readFileSync(join(root, "public/_headers"), "utf8");
assert.match(headers, /\/assets\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/);
assert.match(headers, /\/\n {2}Cache-Control: public, max-age=0, must-revalidate/);

const redirects = readFileSync(join(root, "public/_redirects"), "utf8");
assert.match(redirects, /^\/favicon\.ico \/favicon\.svg 302$/m);

const wrangler = readFileSync(join(root, "wrangler.jsonc"), "utf8");
assert.match(wrangler, /"enabled": true/);
assert.match(wrangler, /"run_worker_first": \["\/api\/\*", "\/audio-pack", "\/audio-pack\.mp3"\]/);
assert.match(wrangler, /"not_found_handling": "404-page"/);
