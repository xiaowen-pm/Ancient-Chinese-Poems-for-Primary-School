/** Cache policy shared by `public/_headers` and the Worker asset fallback. */

export const HASHED_ASSET_CACHE = "public, max-age=31536000, immutable";
export const DOCUMENT_CACHE = "public, max-age=0, must-revalidate";

const DOCUMENT_PATHS = new Set(["/", "/index.html"]);

/**
 * Paths the site publishes as static files. The asset router serves these
 * without the Worker. The Worker only fetches them if it was invoked anyway,
 * so a routing mistake cannot turn the pages and paintings into 404s.
 */
export function isSiteAssetPath(pathname: string): boolean {
  if (DOCUMENT_PATHS.has(pathname) || pathname === "/favicon.svg") return true;
  return pathname.startsWith("/assets/") || pathname.startsWith("/images/") || pathname.startsWith("/audio/");
}

/**
 * Header to set on a static response, or null to leave the platform default.
 * Only fingerprinted `/assets/*` are immutable. Documents stay revalidated.
 */
export function cacheControlFor(pathname: string): string | null {
  if (pathname.startsWith("/assets/")) return HASHED_ASSET_CACHE;
  if (DOCUMENT_PATHS.has(pathname) || pathname.endsWith(".html")) return DOCUMENT_CACHE;
  return null;
}

export function applyCacheControl(pathname: string, response: Response): Response {
  const cacheControl = cacheControlFor(pathname);
  if (!cacheControl) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", cacheControl);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
