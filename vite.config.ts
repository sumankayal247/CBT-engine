import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
// Base path for the deployed site. Unset locally (served at '/'); the GitHub Pages
// workflow sets DEPLOY_BASE=/CBT-engine/ because the project site lives under that subpath.
const base = process.env.DEPLOY_BASE || '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'examples/*.json', 'exam.schema.json', 'FORMAT.md'],
      manifest: {
        name: 'ExamDesk CBT Practice Engine',
        short_name: 'ExamDesk',
        description: 'Your examination practice, offline and on your terms.',
        theme_color: '#123e42',
        background_color: '#f5f7f8',
        display: 'standalone',
        start_url: base,
        icons: [
          { src: `${base}icon.svg`, sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: `${base}icon-192.png`, sizes: '192x192', type: 'image/png', purpose: 'any' },
          {
            src: `${base}icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,md,woff,woff2,ttf}'],
        maximumFileSizeToCacheInBytes: 4000000,
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: { math: ['katex'], vendor: ['react', 'react-dom'], validation: ['zod'] },
      },
    },
  },
  server: { host: '0.0.0.0', allowedHosts: ['.e2b.app'] },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
    setupFiles: ['./src/test-setup.ts'],
  },
});
