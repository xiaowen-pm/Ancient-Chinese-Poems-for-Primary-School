import { audioPackResponse, isAudioPackPath } from "../src/releaseAudio.ts";
import { routeApi, type SignupStore } from "../src/pdfSignup.ts";
import { applyCacheControl, isSiteAssetPath } from "./assets.ts";

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
 * Signup, PDF, and audio-pack only. Pages, paintings, the font, and other
 * files are served by the asset layer (`run_worker_first` does not list
 * them). A request that still reaches this script and matches no file is a
 * miss: answering it here avoids a second `ASSETS.fetch` that would only
 * return 404.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/favicon.ico") {
        return logged(url.pathname, "favicon", Response.redirect(new URL("/favicon.svg", url), 302));
      }
      const api = await routeApi(request, {
        env: stringVars(env),
        envKeys: Object.keys(env).sort(),
        store: env.SIGNUPS ? kvStore(env.SIGNUPS) : null,
      });
      if (api) return logged(url.pathname, "api", api);
      if (isAudioPackPath(url.pathname)) {
        return logged(url.pathname, "audio", await audioPackResponse(url, request.headers.get("range")));
      }
      if (isSiteAssetPath(url.pathname)) {
        const asset = await env.ASSETS.fetch(request);
        return logged(url.pathname, "asset", applyCacheControl(url.pathname, asset));
      }
      return logged(url.pathname, "miss", new Response(null, { status: 404 }));
    } catch (error) {
      console.error(
        JSON.stringify({
          message: "request failed",
          path: url.pathname,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      throw error;
    }
  },
};

function logged(pathname: string, route: string, response: Response): Response {
  const entry = JSON.stringify({ message: "request", path: pathname, route, status: response.status });
  if (response.status >= 500) console.error(entry);
  else console.log(entry);
  return response;
}

/** Vars and secrets arrive as strings; bindings such as KV and ASSETS are objects. */
function stringVars(env: Env): Record<string, string | undefined> {
  const vars: Record<string, string | undefined> = {};
  for (const [name, value] of Object.entries(env)) {
    if (typeof value === "string") vars[name] = value;
  }
  // Bindings can be exposed as non-enumerable getters, so read the names we
  // care about directly instead of trusting `Object.entries` alone.
  for (const name of ["RESEND_API_KEY", "resend", "RESEND_KEY", "resend_api_key", "RESEND_FROM", "MAIL_FROM"]) {
    if (vars[name] !== undefined) continue;
    const value = env[name];
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
