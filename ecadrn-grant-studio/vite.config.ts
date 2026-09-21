import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  // Use VITE_BASE_PATH env var for GitHub Pages deployment (e.g. /ecadrn-grant-studio/)
  // Falls back to '/' for local dev
  const base = env.VITE_BASE_PATH || '/';

  return {
    base,
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // vite 8 (rolldown): manualChunks is gone — use advancedChunks groups.
          // Same package groupings as before, as regex tests.
          advancedChunks: {
            groups: [
              { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'editor', test: /[\\/]node_modules[\\/](react-quill|quill)[\\/]/ },
              { name: 'firebase', test: /[\\/]node_modules[\\/]firebase[\\/]/ },
              { name: 'motion', test: /[\\/]node_modules[\\/](motion|framer-motion)[\\/]/ },
              { name: 'icons', test: /[\\/]node_modules[\\/]lucide-react[\\/]/ },
            ],
          },
        },
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
