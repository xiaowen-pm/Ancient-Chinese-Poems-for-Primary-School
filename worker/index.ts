import { audioPackResponse, isAudioPackPath } from "../src/releaseAudio.ts";
import { routeApi, type SignupStore } from "../src/pdfSignup.ts";

type AssetBinding = {
  fetch(request: Request): Promise<Response>;
};

type SignupKv = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
};

type Env = {
  ASSETS: AssetBinding;
  SIGNUPS?: SignupKv;
  /** Resend key, under whichever name the dashboard uses (`RESEND_API_KEY` or `resend`). */
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
  [name: string]: unknown;
};

/**
 * Same-origin PDF signup and audio reader, then the static site.
 * GitHub's blob host does not send CORS headers, so the browser cannot
 * slice a zip itself. Ranges are copied here and returned as audio/mpeg.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const api = await routeApi(request, {
      env: stringVars(env),
      store: env.SIGNUPS ? kvStore(env.SIGNUPS) : null,
    });
    if (api) return api;
    if (isAudioPackPath(url.pathname)) {
      return audioPackResponse(url, request.headers.get("range"));
    }
    return env.ASSETS.fetch(request);
  },
};

/** Vars and secrets arrive as strings; bindings such as KV and ASSETS are objects. */
function stringVars(env: Env): Record<string, string | undefined> {
  const vars: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === "string") vars[name] = value;
  }
  return vars;
}

function kvStore(kv: SignupKv): SignupStore {
  return {
    get: (key) => kv.get(key),
    put: (key, value, options) => kv.put(key, value, options),
  };
}
