import { defineConfig } from 'vite';

// A GitHub project page is served from https://<user>.github.io/<repo>/, so
// the production build needs that prefix. Locally the base stays "/".
// Override with BASE_PATH=/ when deploying to a custom domain or user page.
const base = process.env.BASE_PATH ?? (process.env.GITHUB_ACTIONS ? '/action-chess/' : '/');

export default defineConfig({
  base,
  build: {
    // the piece art and the engine wasm are already compressed; don't warn
    chunkSizeWarningLimit: 2048,
  },
});
