# Anchor

The day as a path, locked the night before, so the morning has nothing left to decide.

Anchor is built on one premise: **action produces motivation, not the other way around.**
Waiting to feel ready rarely works — starting is what generates the capacity to continue.
Everything here exists to make starting cost as little willpower and as few decisions as
possible.

Single user. No accounts, no sharing, no backend.

## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # typecheck + production build
npm run preview    # serve the build
```

Append `?now=HH:MM` to pin the clock. The states worth looking at — a point going passed,
an offer opening — are otherwise only reachable by waiting for them. `?now=08:12` loads the
route mid-morning with an offer open.

## What the code is careful about

Four product rules are enforced structurally rather than by convention, because they're the
ones the app can't survive losing.

**Rest is not completable.** `Rest` has no status field, no `completedAt`, and no shape of
the type that could acquire one. It renders with no control on it at all. Its whole job is
to exist and be legitimate, not to be one more thing to tick off. A timeline where every
minute is accounted for becomes the oppressive list it was meant to replace.

**Nothing stores "missed."** A `Point` records only `startedAt` and `completedAt` — when you
began and when it happened. Every not-done state is *derived* at render time from where you
are on the path. That's what lets a passed point read as a gap in the route rather than a
verdict, and it's why `PASSED · NOT LOGGED · STILL ON THE ROUTE` is honest rather than
euphemistic: there is no failure record, because none is kept.

**Nothing can be broken.** The ledger has a running total that only climbs and a rolling
14-day window. There's no consecutive-day counter anywhere, and no value a gap can reset —
a gap contributes nothing and costs nothing. Trajectory is still surfaced; punishment isn't.

**Declining is free.** The momentum offer is cyan, and cyan means *you may decline this*.
"Not now" sits beside "Ride it" as an equal, and choosing it writes nothing anywhere. The
lift after finishing something is real when it shows up; it must never become an obligation.

## Layout

```
src/
  types/path.ts        Point, Rest, Path, MarkerMode — the model, heavily commented
  lib/route.ts         Derives every render state from the path plus where you are
  lib/ledger.ts        Rolling window. Deliberately not a streak
  lib/time.ts          Minutes-from-midnight everywhere; formatting lives here
  data/seed.ts         The canonical mockup's route, as real data
  components/          One per piece of the front page
  styles/              Design tokens, ported visual system, self-hosted fonts
design/                Mockups, feature spec, momentum rules, research report
```

Colour carries meaning and is not decoration. **Ember** is the thing pulling you now.
**Acid** is proof something happened. **Cyan** is reserved exclusively for things you may
decline. **Slate** is the neutral passed state — never red, never punitive. Using any of
them for anything else breaks what the user learns to read at a glance.

## Marker mode

Whether the path tracks real time is a toggle, not a verdict — which reads as motivating and
which reads as pressure is a per-person question.

- **Live** — the marker moves with the clock. A point whose window elapsed without being
  logged renders as passed. Can show falling behind.
- **Held** — set and left alone. The first unlogged point stays live for as long as it takes,
  and nothing is ever overtaken by the clock. In this mode no point is ever passed.

## Storage, and the sync that's coming

State persists to `localStorage` through a repository interface shaped like Firestore, so
live multi-device sync can be dropped in later by implementing one file. The subscription
model is the part that matters: Firestore delivers data through a live listener, and code
written against a synchronous `getItem` has to be torn up to accept that. So the app
subscribes from the start, and the local backend fires its callbacks asynchronously —
including the first — to keep it honest.

Documents live at paths the Firestore implementation will reuse verbatim
(`users/{uid}/paths/{YYYY-MM-DD}`), built by `src/store/keys.ts` and flattened into
localStorage keys. A day is one document, so a day is also the unit of conflict:
last-write-wins, which is the right trade when it's one person on two devices.

**The two-tab test.** Open the app in two tabs and clear a point in one — it appears in the
other without a refresh, over the `storage` event. That's genuinely two clients syncing, and
it's how the subscription plumbing gets verified before any network is involved.

Identity is stubbed at `src/store/identity.ts`. Whatever the eventual auth model, that one
function is what changes.

## Where this is up to

Built: the data model, the full front page driven by it, all five node states, proportional
rest trails, the momentum offer, the anti-streak ledger, the marker toggle, persistence with
cross-tab sync, and PWA install with genuine offline support (fonts self-hosted and
precached).

Not built yet: multiple days and rollover, path creation and editing, the
lock-it-the-night-before flow, real timers with hard stops, templates and chains, task
breakdown, notifications, export, skins, and scenic mode. A fresh install is seeded once from
`src/data/seed.ts` so there's something to look at; a real empty state comes with editing.

## Stack

Vite + React + TypeScript, no backend. `vite-plugin-pwa` generates the manifest and service
worker. Deploys to Vercel as a static build with no configuration.
