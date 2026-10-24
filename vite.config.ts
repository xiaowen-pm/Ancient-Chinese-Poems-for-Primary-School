import { defineConfig } from "vite";

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
});
