import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Which commit is this? Baked in at build time so a running app can answer it.
 *
 * That matters more here than it would elsewhere: the app is installed as a
 * PWA on several devices, and a service worker can keep serving an old build
 * long after a new one has deployed. A visible stamp is how you tell a stale
 * install from a current one without guessing.
 *
 * Vercel supplies the commit through the environment. Locally we ask git, in a
 * try/catch — a missing git binary or a tarball checkout must never be able to
 * fail a build over a cosmetic label.
 */
function gitSha(): string {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
  } catch {
    return '';
  }
}

const sha = process.env.VERCEL_GIT_COMMIT_SHA || gitSha();
const ref = process.env.VERCEL_GIT_COMMIT_REF || '';

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(sha ? sha.slice(0, 7) : 'dev'),
    __BUILD_REF__: JSON.stringify(ref),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
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
