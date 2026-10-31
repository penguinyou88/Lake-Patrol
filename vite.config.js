import { defineConfig } from 'vite';

// Relative base so the same build works on GitHub Pages, Vercel and itch.io.
export default defineConfig({
  base: './',
  server: { host: true },
  build: { chunkSizeWarningLimit: 1000 },
});
