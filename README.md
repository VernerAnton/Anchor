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

**Cloud sync** is the working system from the user's other app, ported. Identity is a
sync key — a user-chosen phrase, no accounts, no sign-in; the same key on another device
means the same data. With no key set (or no Firebase config in the build) the app runs
purely local, which is a full mode rather than a degraded one. With a key, the Firestore
backend loads via dynamic import (the SDK never reaches local-only users), Firestore's
IndexedDB cache durably queues offline writes for replay, and connecting a device first
pushes its local data up through a guarded migration that can never wipe existing cloud
data. Conflicts resolve by per-document integer versions bumped synchronously before every
write — immune to clock skew, and stale echoes are refused by both backends identically.
Setup: `docs/firebase-setup.md`.

## Building a day

Move between days with the arrows — tomorrow is a first-class destination, because a path
meant to be set the night before needs somewhere easy to stand. **Edit** turns the path from
something you walk into something you arrange: every segment gets edit, reorder and remove
controls, and `+ Point` / `+ Rest` append to the route.

Rest is editable — how long it runs, what it's for. What stays impossible is finishing it.
There is no completion control on a rest segment in either mode, and no code path that
produces one.

**Locking** is a control rather than a readout, and it stays reversible. The lock removes the
*invitation* to re-decide in the morning; it does not remove your ability to change the plan.
A path you couldn't fix on a bad morning would be a trap rather than a support.

Order is array order, and points are never silently re-sorted by time. Rest belongs *between*
two particular things, which sorting can't express — and a path that rearranges itself under
you is exactly the sort of surprise this app should never spring.

The **empty state** asks one question: what's the smallest physical thing? Physical because
it gives visible proof something moved; smallest because the bar has to be low enough that
answering feels silly to refuse. Where a previous route exists, reusing it is offered first —
rebuilding a day from nothing every night is itself a nightly chore requiring initiative,
which is the failure this app exists to route around.

Editing surfaces deliberately use none of the four meaning-carrying colours. Ember, acid,
cyan and slate each say something specific about where you are on the route, and admin is not
a place on the route.

## Where this is up to

Built: the data model, the full front page driven by it, all five node states, proportional
rest trails, the momentum offer, the anti-streak ledger, the marker toggle, persistence with
cross-tab sync, multiple days with ledger rollover, full path editing, the lock control,
reuse-yesterday, the empty state, and PWA install with genuine offline support.

Not built yet: real timers with hard stops, recurring rules, natural-language entry, saved
templates and chains, task breakdown, notifications, export/backup, skins, and scenic mode.
A fresh install is seeded once from `src/data/seed.ts` so there's something to look at.

## Stack

Vite + React + TypeScript, no backend. `vite-plugin-pwa` generates the manifest and service
worker. Deploys to Vercel as a static build with no configuration.
