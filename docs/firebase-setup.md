# Firebase setup for Anchor sync

Anchor runs fully local until this is done — nothing is broken without it, and local mode is
a complete mode rather than a degraded one. This takes about five minutes of console
clicking.

The sync layer itself is already built and verified end to end against the Firestore
emulator (two devices converging, offline replay, the version guard, the migration guard).
What follows is only about giving it a project to talk to.

**Use a new project for Anchor.** Don't point it at the project belonging to another app —
they'd share a database for no benefit, and a mistake in one could reach the other.

## 1. Create the project

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Name it `anchor` (or `anchor-sync`). Google Analytics: off — not needed.
3. **Build → Firestore Database → Create database.**
   Choose **production mode** and a region near you (e.g. `europe-north1`).
   Production mode is correct here: the rules below are what grant access, and test mode
   would silently expire after 30 days and break sync with no warning.

## 2. Register the web app

1. Project overview → the `</>` (web) icon → register an app, name it `anchor`.
   No Firebase Hosting needed — Vercel serves the app.
2. It shows a `firebaseConfig` object. Copy the six values into `.env.local` at the repo root
   (template in `.env.example`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

`.env.local` is gitignored and must stay that way.

## 3. Firestore rules

Pick your sync key now — the phrase you're about to use in the app — and put it directly in
the rule. Build → Firestore Database → **Rules** tab, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{syncKey}/{document=**} {
      allow read, write: if syncKey == "YOUR-CHOSEN-KEY-HERE";
    }
  }
}
```

Swap in your real key (keep the quotes) and publish. The `{document=**}` wildcard covers
every path the app uses — `users/{syncKey}/v2-tasks/…`, `v2-projects/…` and
`v2-settings/app` (see `src/store/keys.ts`) — and `allow read` already covers both `get` and
`list`, which is what the live task/project subscriptions need.

**The key is verified server-side, not just obscure.** Only requests carrying the exact key
you put in the rule are allowed through; a wrong or guessed key gets denied by Firestore
itself. Rules text isn't visible to end users, only to people with access to the Firebase
project, so this is a real password check, not security by obscurity.

The one cost: changing your key later means editing and republishing this rule, not just
retyping it in the app's Sync field. Fine for a personal key you're not rotating often.

## 4. Vercel

Project settings → **Environment Variables** → add the same six `VITE_FIREBASE_*` values.

**Then redeploy.** Vite bakes `VITE_*` values into the bundle at build time, so saving them
in Vercel changes nothing until a new build runs. A deploy that predates the variables will
keep running local-only, and the app will look like sync is broken when it simply was never
compiled in.

## 5. Connect

Open Anchor → **Sync** → enter your key → **Connect**.

The device's existing local data is pushed up first, guarded so that connecting a fresh
device to an existing key can never wipe what's already there. Enter the same key on the next
device and they converge.

To check it worked: the sidebar footer reads `Sync · connected`, and a task added on one
device appears on the other without a reload.

## Trying it without a project

The sync layer can be exercised locally against the Firestore emulator — useful for testing
changes without risking real data:

```bash
npx firebase-tools emulators:start --only firestore --project anchor-emu-test
```

with a `firebase.json` pointing at an open `allow read, write: if true` rules file — the
emulator has no real data to protect, so there's no reason to key-gate it — then in
`.env.local`:

```
VITE_FIRESTORE_EMULATOR=127.0.0.1:8080
```

plus any six placeholder `VITE_FIREBASE_*` values (the emulator does not check them). The
variable is read in `src/store/firebase.ts` and is absent from real builds, so production is
unaffected.
