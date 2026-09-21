# Anchor

A task manager built on one premise: **action produces motivation, not the other way
around.**

## Current state: rebuilding the to-do side

`src/` was deliberately cleared. An earlier attempt built the signature feature — the
**path**, a day rendered as a route rather than a list — and an elaborate theme before the
to-do foundation was finished, which made every small change expensive. So the project was
reset to build a complete, capable to-do app first, on plain default styling.

- **`handover/`** — what's being built and how. Start at `handover/README.md`.
- **`archive/`** — the previous implementation, kept as a parts bin. Excluded from the
  build; see `handover/mechanisms.md` for what's worth taking.
- **`CLAUDE.md`** — the structural rules every session must follow.

The path returns as a later phase, as views inside this app.

## Stack

Vite + React + TypeScript. No backend beyond Firestore, and none of that is required:
with no sync key set the app runs entirely from `localStorage`, which is a full mode,
not a fallback.

## Develop

```
npm install
npm run dev        # local server
npm run test       # unit tests (archive/ is excluded)
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
