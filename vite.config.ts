import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // A service worker must ship from the very first deploy: the old app is
    // installed as a PWA on several devices, and a registered worker keeps
    // serving its cached assets until a new worker takes over. autoUpdate lets
    // this build claim those installs immediately.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/*.png'],
      workbox: {
        // Fonts are self-hosted, so precaching them is what makes the
        // installed app render correctly with no network at all.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
      },
      manifest: {
        name: 'Anchor',
        short_name: 'Anchor',
        description: 'A task manager built on one premise: action produces motivation, not the other way around.',
        start_url: '/',
        display: 'standalone',
        background_color: '#04080d',
        theme_color: '#04080d',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
});
