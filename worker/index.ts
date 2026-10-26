import { audioPackResponse, isAudioPackPath } from "../src/releaseAudio.ts";
import { handlePdfHttp, type SignupStore } from "../src/pdfSignup.ts";

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
  RESEND_API_KEY?: string;
  RESEND_FROM?: string;
};

/**
 * Same-origin reader for Release zip audio, the PDF signup, then the static site.
 * GitHub's blob host does not send CORS headers, so the browser cannot
 * slice a zip itself. Ranges are copied here and returned as audio/mpeg.
 */
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/pdf-request") {
      return handlePdfHttp(request, {
        store: env.SIGNUPS ? kvStore(env.SIGNUPS) : null,
        resendApiKey: env.RESEND_API_KEY,
        resendFrom: env.RESEND_FROM,
      });
    }
    if (isAudioPackPath(url.pathname)) {
      return audioPackResponse(url, request.headers.get("range"));
    }
    return env.ASSETS.fetch(request);
  },
};

function kvStore(kv: SignupKv): SignupStore {
  return {
    get: (key) => kv.get(key),
    put: (key, value, options) => kv.put(key, value, options),
  };
}
