import { defineConfig } from 'astro/config';

// En GitHub Pages la web vive en /<repo>/. En el dominio definitivo BASE_PATH será "/".
const base = process.env.BASE_PATH ?? '/libreriasindependientes-web';

export default defineConfig({
  site: process.env.SITE_URL ?? 'https://l8tepro-eng.github.io',
  base,
  trailingSlash: 'ignore',
  build: { format: 'directory' },
  vite: {
    // pdfjs-dist 4 usa top-level await
    build: { target: 'es2022' },
    optimizeDeps: { esbuildOptions: { target: 'es2022' } },
  },
});
