# Firebase setup for Anchor sync

Anchor runs fully local until this is done — no rush, nothing is broken without it.
This takes about five minutes of console clicking.

## 1. Create the project

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project**.
2. Name it (e.g. `anchor-sync`). Google Analytics: off — not needed.
3. In the project: **Build → Firestore Database → Create database**.
   Choose **production mode** and a region near you (e.g. `europe-north1`).

## 2. Register the web app

1. Project overview → the `</>` (web) icon → register app, name it `anchor`.
   No Firebase Hosting needed.
2. It shows a `firebaseConfig` object. Copy the six values into `.env.local`
   at the repo root (template in `.env.example`):

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

## 3. Firestore rules

Build → Firestore Database → **Rules** tab, replace with:

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

This is the sync-key trust model from the other app: the key *is* the credential, so pick
one you'd treat like a password. Anyone who knows a key can read and write that key's data
— and nothing else.

## 4. Vercel

Project settings → **Environment Variables** → add the same six `VITE_FIREBASE_*`
values, then redeploy. (Vite bakes env values in at build time, so a redeploy is
required, not just a save.)

## 5. Connect

Open Anchor → **SYNC** → enter your key → Connect. The device's existing local data is
pushed up first (guarded — connecting a fresh device to an existing key can never wipe
cloud data). Enter the same key on the next device and it converges.
