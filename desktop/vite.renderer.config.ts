import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import baselineUtilities from './tailwind-baseline.json';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./', import.meta.url)),
  base: '/',
  publicDir: fileURLToPath(new URL('../public', import.meta.url)),
  plugins: [
    {
      name: 'thunder-cut-stable-css-sources',
      enforce: 'pre',
      transform(code, id) {
        if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/app/globals.css')) return;
        // The former workspace scanned generated files and unrelated documents.
        // Preserve its shipped utility set, then scan only actual renderer sources.
        // This changes build inputs in memory; Cam's stylesheet remains untouched.
        const sources = [
          '@import "tailwindcss" source(none);',
          '@theme static { --ease-in: cubic-bezier(0.4, 0, 1, 1); --ease-out: cubic-bezier(0, 0, 0.2, 1); --ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); }',
          '@source "./";',
          '@source "../desktop/index.html";',
          '@source "../desktop/renderer.tsx";',
          '@source "../desktop/next-image-shim.tsx";',
          `@source inline("${baselineUtilities.join(' ')}");`,
        ].join('\n');
        return code.replace(/@import\s+['"]tailwindcss['"];?/, sources);
      },
    },
    react(),
  ],
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: {
    alias: [
      {
        find: 'next/image',
        replacement: fileURLToPath(new URL('./next-image-shim.tsx', import.meta.url)),
      },
      {
        find: '@',
        replacement: projectRoot,
      },
    ],
  },
  build: {
    target: 'es2022',
    outDir: fileURLToPath(new URL('../desktop-app/renderer', import.meta.url)),
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./index.html', import.meta.url)),
    },
  },
});
