# Firebase / sync handover

Everything the rebuild needs about cloud sync. Self-contained — you shouldn't need the old
conversation or the old code to understand any of it, though the code is worth copying.

The system described here is **already working and verified**. It's a port of the owner's own
sync layer from another app of theirs that's been in daily use. Don't redesign it; copy it.

---

## 1. The model in one paragraph

There are no accounts and no sign-in. A **sync key** — a user-chosen phrase stored in
`localStorage` — is the identity and the credential. No key set means the app runs entirely
local, which is a complete mode rather than a degraded one. Set a key, and the app switches
to Firestore, pushing the device's existing local data up first. Enter the same key on
another device and they converge. That's the whole product surface: one text field.

---

## 2. Architecture: one interface, two backends

Everything goes through `AnchorRepository` (`src/store/repository.ts`). Two implementations:

| | |
|---|---|
| `localRepository.ts` | `localStorage`, used when no sync key is set |
| `firestoreRepository.ts` | Firestore, used when a key is set |

`src/store/index.ts` picks one at boot, before React mounts, so nothing ever observes a
half-initialised store. Switching backends is a page reload by design — it happens rarely
(entering a key), and a clean boot beats teaching every subscription to re-home itself.

### The critical design decision

**The interface is subscription-based, and callbacks always fire asynchronously — including
the first one.**

Firestore delivers data through `onSnapshot`, a live listener. Code written against a
synchronous `localStorage.getItem` has to be torn up to accept that. So the app subscribes
from the start, and the *local* backend deliberately fires its callbacks via
`queueMicrotask` even though it could answer instantly. That forces the loading state to be
handled correctly from day one rather than discovered when the network backend lands.

If you take one thing from this document, take that. It's what made adding Firestore a
one-file change instead of a rewrite.

The local backend also listens to the `storage` event, so a write in one tab pushes into
every other open tab. That's genuinely two clients syncing — and it's how you test the
subscription plumbing before any network is involved. **The two-tab test:** open the app
twice, change something in one, watch the other update without a refresh.

---

## 3. The mechanics that make it reliable

### Per-document integer versions — not timestamps

Every document carries `version: number`, bumped **synchronously before any async work**
(see `touch()` in `src/store/mutations.ts`). By the time a write is in flight, local state
already holds the higher version.

The listener then refuses any snapshot whose version is lower than one already delivered —
that's a stale echo arriving out of order. Both backends enforce this identically
(`writeVersioned` locally, `guard()` in Firestore).

This is better than last-write-wins on `updatedAt` because it's immune to clock skew between
devices. `updatedAt` is kept, but it's informational only and must never be used to resolve
a conflict.

### Conflict granularity is one document

A day is one document, so a day is the unit of conflict: last-write-wins on the whole day.
That's the right trade for one person on two devices — you are essentially never editing the
same day in two places at once, and the alternative buys nothing real.

### Offline durability comes from Firestore, not from us

`initializeFirestore` with `persistentLocalCache({ tabManager: persistentMultipleTabManager() })`.
Writes made with no network are durably queued in IndexedDB by the SDK and replayed on
reconnect; tabs share one cache and one queue. Don't hand-roll an offline queue on top of
this — the original app's manual `localStorage` mirror was dropped for exactly this reason.

### Cloud data is untrusted input

Every inbound document is schema-validated (`src/store/schemas.ts`, Zod) before it can touch
app state. Invalid documents are dropped with a console warning rather than poisoning local
state — a different build, a manual console edit or a half-finished migration can all show up
in a snapshot.

Useful side effect worth preserving: **the rest schema structurally cannot express
completion**, so the "rest is never completable" invariant holds even against data written by
something that isn't this app.

Use `.catch(...)` on fields added in later schema versions so older documents still validate
instead of being dropped wholesale.

### `ignoreUndefinedProperties: true`

Firestore rejects an **entire write** if any field is `undefined`. The original app hit this:
entries appeared locally and silently never synced. Two defences, keep both — this flag, and
making every absent value an explicit `null` in the types (`label: string | null`, never
`label?: string`).

### Client-generated ids

`crypto.randomUUID()`, never server-assigned. A task added on a phone with no signal needs
its id immediately, and it must not collide with one added on a laptop in the same offline
window.

### Guarded migration

`src/store/migrate.ts` runs on first connect: pushes local data up, **never deletes**, and
only overwrites a cloud document when the local copy carries a strictly higher version. So
connecting a fresh device to an existing key can't wipe what's already there. It's written
purely against the repository interface and knows nothing about either backend.

---

## 4. One deliberate divergence from the original app

The source app kept its own `localStorage` mirror and used snapshots only for *remote*
changes, so it skipped documents where `hasPendingWrites` is true — its own echoes.

**Anchor does the opposite on purpose.** There's no separate mirror; the UI renders straight
from the subscriptions. So pending-write snapshots are *wanted* — they are the optimistic
local update, and together with the persistent cache they keep the app fully live offline.

Related: the original used `setDoc(..., { merge: true })` because it updated per-entry maps
inside day documents. Anchor uses whole-document `setDoc`, because a full replace means a
removed segment stays removed.

If you reintroduce a local mirror, revisit both decisions. If you keep rendering from
subscriptions, keep them as they are.

---

## 5. Files to copy

From the old repo, branch `claude/nice-davinci-eve0kc`:

| File | What it is |
|---|---|
| `src/store/repository.ts` | The interface. Start here. |
| `src/store/index.ts` | Backend selection + dynamic import of Firestore |
| `src/store/identity.ts` | Sync key get/set |
| `src/store/keys.ts` | Document paths, shared by both backends |
| `src/store/firebase.ts` | SDK init (cache, tab manager, undefined handling) |
| `src/store/firebaseConfig.ts` | Env reading, kept separate from the SDK — see below |
| `src/store/firestoreRepository.ts` | Firestore implementation |
| `src/store/localRepository.ts` | localStorage implementation |
| `src/store/migrate.ts` | Guarded local→cloud migration |
| `src/store/schemas.ts` | Zod validation (rewrite the schemas for new types) |
| `src/components/SyncSettings.tsx` | The one-field UI |
| `docs/firebase-setup.md`, `.env.example` | Setup |

Only `schemas.ts` and the document types need rewriting for a new data model. Everything else
is model-agnostic.

### Keep the bundle split

`firebaseConfig.ts` exists separately from `firebase.ts` so the app can ask "is cloud sync
even possible?" without importing the SDK. Firestore is **~181 kB gzipped** and loads only
via dynamic import, only when a sync key is set. Local-only users pay none of it. Verify this
holds — check that the firestore chunk is never requested when no key is set.

### Document paths

`keys.ts` returns path *segments*, so `doc(db, ...pathDoc(uid, date))` works directly and the
local backend joins the same segments with colons. One definition of where a document lives
means swapping backends can't silently relocate anything.

```
users/{syncKey}/paths/{YYYY-MM-DD}
users/{syncKey}/days/{YYYY-MM-DD}
users/{syncKey}/tasks/{id}
users/{syncKey}/projects/{id}
users/{syncKey}/settings/app
```

**Use different collection names in the rebuild.** The old app's documents may already be
sitting in the same Firebase project under these paths, and the new data model differs. Fresh
names (or a `v2/` prefix) means old and new can coexist without one confusing the other.

---

## 6. Setup

Console steps, the exact Firestore rules, the six env values and the Vercel notes are in
`docs/firebase-setup.md` — copy it across. Summary:

1. Firebase console → new project → Firestore Database → **production mode**
2. Register a web app → copy six `VITE_FIREBASE_*` values into `.env.local`
3. Paste the rules (below)
4. Add the same six values to Vercel's environment variables
5. In-app: **Sync** → enter key → Connect

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{syncKey}/{document=**} {
      allow read, write: if true;
    }
  }
}
```

**The trust model is deliberate**: the key *is* the credential, so it should be treated like
a password. Anyone who knows a key can read and write that key's data — and nothing else.
This matches the working app. If that's ever not acceptable, the fix is real auth, not
tighter rules on top of a guessable key.

---

## 7. Deployment gotchas

These bit us or nearly did. All specific to this project's situation.

**Vercel tracks repositories by GitHub repo ID, not by name.** Renaming repos to swap which
one deploys does not work — Vercel follows the rename and keeps deploying the same repo. To
point an existing Vercel project at a new repo: **Settings → Git → Disconnect → Connect**
the new one. The domain and environment variables belong to the Vercel *project*, so they
survive.

**The app is installed as a PWA on ~4 devices.** Keeping the same Vercel domain is why the
reconnect approach matters. But a registered service worker keeps serving its cached assets
even when the server has entirely different content — so **the rebuild must ship a service
worker from its very first deploy**. `vite-plugin-pwa` with `registerType: 'autoUpdate'` (the
old config, copyable as-is) lets the new worker take over immediately. Deploy without one and
those devices can sit on the old cached app more or less indefinitely, while a fresh browser
on the same URL sees the new one.

**Old client-side data persists.** `localStorage` and IndexedDB are per-origin, so old
`anchor:v1:*` keys will still be on those devices. Harmless if the rebuild uses a different
key prefix — which it should, for exactly this reason.

**Vite bakes env values in at build time.** Adding or changing `VITE_FIREBASE_*` in Vercel
requires a redeploy, not just a save.

---

## 8. Verification checklist

1. **No-key regression** — everything works on the local backend: two-tab test, reload
   persistence, offline reload with the network cut.
2. **Bundle split** — the firestore chunk is never requested when no sync key is set.
3. **Version guard** — write a document at version 99 behind the app's back, then have the
   app save from its stale copy. The stored version must stay 99.
4. **Two devices** (two browser contexts, same key) — change something in one, it appears in
   the other with no refresh.
5. **Offline replay** — context A offline, make a change, reconnect, confirm B converges.
6. **Migration guard** — a fresh empty device connecting to an existing key must not wipe
   cloud data.
