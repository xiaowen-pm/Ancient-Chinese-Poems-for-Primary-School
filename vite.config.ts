import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import { defineConfig } from "vite";
import { audioPackResponse, isAudioPackPath } from "./src/releaseAudio.ts";
import { memorySignupStore, routeApi } from "./src/pdfSignup.ts";

// Relative base so `dist/` can be hosted at a domain root or a project subpath
// (GitHub Pages) without rewriting asset URLs.
export default defineConfig({
  base: "./",
  server: {
    host: "127.0.0.1",
    port: 4731,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 4731,
    strictPort: true,
  },
  plugins: [
    {
      name: "local-worker-routes",
      configureServer(server) {
        server.middlewares.use(serveApi);
        server.middlewares.use(serveAudioPack);
      },
      configurePreviewServer(server) {
        server.middlewares.use(serveApi);
        server.middlewares.use(serveAudioPack);
      },
    },
  ],
});

/** Same checks and the same in-memory KV as the Worker, kept for one dev process. */
const devStore = memorySignupStore();

function serveApi(request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction): void {
  const host = typeof request.headers.host === "string" ? request.headers.host : "127.0.0.1:4731";
  const url = new URL(request.url ?? "/", `http://${host}`);
  if (!url.pathname.startsWith("/api/")) {
    next();
    return;
  }
  void (async () => {
    const headers = new Headers();
    for (const [key, value] of Object.entries(request.headers)) {
      if (typeof value !== "string") continue;
      if (key === "host" || key === "connection" || key === "content-length" || key === "transfer-encoding") continue;
      headers.set(key, value);
    }
    const method = request.method ?? "GET";
    const body = method === "GET" || method === "HEAD" ? undefined : await readBody(request);
    const answer = await routeApi(new Request(url, { method, headers, body }), { env: localEnv(), store: devStore });
    if (!answer) {
      response.statusCode = 404;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end("没有这个接口。\n");
      return;
    }
    response.statusCode = answer.status;
    answer.headers.forEach((value, key) => response.setHeader(key, value));
    if (!answer.body || method === "HEAD") {
      response.end();
      return;
    }
    // Streaming a fetch body in Node can abort mid-transfer when the upstream
    // (GitHub) times out; swallow that error instead of crashing the server.
    const stream = Readable.fromWeb(answer.body as unknown as Parameters<typeof Readable.fromWeb>[0]);
    stream.on("error", () => response.destroy());
    response.on("close", () => stream.destroy());
    stream.pipe(response);
  })().catch((error: unknown) => {
    const tooLarge = error instanceof Error && error.message === "too-large";
    response.statusCode = tooLarge ? 413 : 502;
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.end(JSON.stringify({ ok: false, message: tooLarge ? "内容太长。" : "本地接口出错了，请看终端日志。" }));
  });
}

function readBody(request: IncomingMessage): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 1_000_000) {
        reject(new Error("too-large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(new Uint8Array(Buffer.concat(chunks))));
    request.on("error", reject);
  });
}

/**
 * Local stand-in for the Worker's bindings: `.dev.vars` first, then the
 * process environment. `npm run dev` with `RESEND_API_KEY` in either place
 * sends real mail, so keep the key out of git.
 */
function localEnv(): Record<string, string | undefined> {
  return { ...readDevVars(), ...process.env };
}

let devVarsCache: { at: number; vars: Record<string, string> } | null = null;

function readDevVars(): Record<string, string> {
  const now = Date.now();
  if (devVarsCache && now - devVarsCache.at < 2000) return devVarsCache.vars;
  const vars: Record<string, string> = {};
  try {
    const raw = readFileSync(join(process.cwd(), ".dev.vars"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
      if (!match || !match[1]) continue;
      const value = (match[2] ?? "").replace(/^['"]|['"]$/g, "");
      if (value) vars[match[1]] = value;
    }
  } catch {
    // No .dev.vars is the normal case for `npm run dev`.
  }
  devVarsCache = { at: now, vars };
  return vars;
}

function serveAudioPack(request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction): void {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (!isAudioPackPath(url.pathname)) {
    next();
    return;
  }
  const range = Array.isArray(request.headers.range) ? request.headers.range[0] : (request.headers.range ?? null);
  void audioPackResponse(url, range)
    .then(async (packed) => {
      response.statusCode = packed.status;
      packed.headers.forEach((value, key) => response.setHeader(key, value));
      if (!packed.body) {
        response.end();
        return;
      }
      const reader = packed.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        response.write(Buffer.from(chunk.value));
      }
      response.end();
    })
    .catch((error: unknown) => {
      response.statusCode = 502;
      response.end(error instanceof Error ? error.message : "音频读取失败");
    });
}
