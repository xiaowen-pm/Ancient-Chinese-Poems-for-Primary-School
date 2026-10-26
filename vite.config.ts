import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import { defineConfig } from "vite";
import { audioPackResponse, isAudioPackPath } from "./src/releaseAudio.ts";
import { handlePdfHttp, memorySignupStore } from "./src/pdfSignup.ts";

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
      name: "release-audio-pack",
      configureServer(server) {
        server.middlewares.use(servePdfSignup);
        server.middlewares.use(serveAudioPack);
      },
      configurePreviewServer(server) {
        server.middlewares.use(servePdfSignup);
        server.middlewares.use(serveAudioPack);
      },
    },
  ],
});

const devSignups = memorySignupStore();

function servePdfSignup(request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction): void {
  const hostHeader = typeof request.headers.host === "string" ? request.headers.host : "127.0.0.1:4731";
  const url = new URL(request.url ?? "/", `http://${hostHeader}`);
  if (url.pathname !== "/api/pdf-request") {
    next();
    return;
  }
  void readRaw(request)
    .then(async (raw) => {
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (key === "host" || key === "connection" || key === "content-length" || key === "transfer-encoding") continue;
        if (typeof value === "string") headers.set(key, value);
        else if (Array.isArray(value)) headers.set(key, value.join(", "));
      }
      const packed = await handlePdfHttp(
        new Request(url, {
          method: request.method,
          headers,
          body: request.method === "GET" || request.method === "HEAD" ? undefined : raw,
        }),
        {
          store: devSignups,
          resendApiKey: process.env.RESEND_API_KEY,
          resendFrom: process.env.RESEND_FROM,
        },
      );
      response.statusCode = packed.status;
      packed.headers.forEach((value, key) => response.setHeader(key, value));
      response.end(Buffer.from(await packed.arrayBuffer()));
    })
    .catch((error: unknown) => {
      const tooLarge = error instanceof Error && error.message === "too-large";
      response.statusCode = tooLarge ? 413 : 400;
      response.setHeader("content-type", "application/json; charset=utf-8");
      response.end(JSON.stringify({ ok: false, message: tooLarge ? "内容太长。" : "请再填写一次。" }));
    });
}

function readRaw(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 4096) {
        reject(new Error("too-large"));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", reject);
  });
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
