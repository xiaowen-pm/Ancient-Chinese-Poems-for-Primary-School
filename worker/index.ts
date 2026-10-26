import { audioPackResponse } from "../src/releaseAudio.ts";

type AssetBinding = {
  fetch(request: Request): Promise<Response>;
};

/**
 * Same-origin reader for Release zip audio, then the static site.
 * GitHub's blob host does not send CORS headers, so the browser cannot
 * slice a zip itself. Ranges are copied here and returned as audio/mpeg.
 */
export default {
  async fetch(request: Request, env: { ASSETS: AssetBinding }): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/audio-pack") {
      return audioPackResponse(url, request.headers.get("range"));
    }
    return env.ASSETS.fetch(request);
  },
};
