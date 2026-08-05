# Anchor

A task manager built on one premise: **action produces motivation, not the other way
around.** The signature feature — a day rendered as a route rather than a list — arrives in
a later phase; the foundation is a capable to-do app that stands on its own.

Design history, handovers and standing decisions live in `design/`. The structural rules
every session must follow are in `CLAUDE.md`.

## Stack

Vite + React + TypeScript. No backend beyond Firestore, and none of that is required:
with no sync key set the app runs entirely from `localStorage`, which is a full mode,
not a fallback.

## Develop

```
npm install
npm run dev        # local server
npm run test       # recurrence engine unit tests
npm run typecheck
npm run build      # tsc + vite build, service worker included
```

## Cloud sync

Optional. See `docs/firebase-setup.md` for the five-minute console setup, then copy
`.env.example` to `.env.local` and fill in the six `VITE_FIREBASE_*` values. In the app:
**Sync → enter a key → Connect.** The same key on another device means the same data.

## Deploying to the existing Vercel project

Two traps, both documented in `design/handover-firebase-sync.md` §7:

1. **Vercel tracks repos by ID, not name.** To point the existing Vercel project (and its
   domain) at this repo: Settings → Git → Disconnect → Connect this repository. The domain
   and environment variables belong to the project and survive.
2. **The old app is installed as a PWA on several devices.** This build ships a service
   worker (`vite-plugin-pwa`, `registerType: 'autoUpdate'`) from its very first deploy, so
   those installs update instead of serving the old cached app indefinitely.

Remember that Vite bakes `VITE_*` env values in at build time — changing them in Vercel
requires a redeploy, not just a save.
