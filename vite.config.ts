import type { IncomingMessage, ServerResponse } from "node:http";
import type { Connect } from "vite";
import { defineConfig } from "vite";
import { audioPackResponse } from "./src/releaseAudio.ts";

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
        server.middlewares.use(serveAudioPack);
      },
      configurePreviewServer(server) {
        server.middlewares.use(serveAudioPack);
      },
    },
  ],
});

function serveAudioPack(request: IncomingMessage, response: ServerResponse, next: Connect.NextFunction): void {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  if (url.pathname !== "/audio-pack") {
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
