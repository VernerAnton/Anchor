# Adding a version counter and update detection to another app

A paste-in prompt for giving any of your apps two things:

1. **A version number you can see** — so picking up a device answers "am I on the current
   build?" in one glance.
2. **An app that notices when it's stale** — checks for a new build and offers a reload,
   instead of leaving you to wonder.

Open a Claude Code session in the target repo and paste the block below. It is written to be
read cold: it detects the stack itself and adapts, so it works whether the app is a Vite PWA,
a Next.js app, or something with no service worker at all.

The appendix after the prompt has a working implementation to copy from. You don't need to
paste the appendix — only include it if the agent asks for a concrete example.

---

## The prompt

```
Add an app version counter, and update detection where the app supports it.

## Why

This app is installed on several of my devices. When I open one I currently have no way to
tell whether it's running the newest build — and if it's a PWA, a service worker can keep
serving an old build long after a new one has deployed. That has already cost me real
debugging time: a bug I'd fixed was still present on a device, and I couldn't tell whether
the fix had shipped or the device was stale.

I want two things: a version I can read at a glance, and an app that tells me when it's
behind rather than making me check.

Keep that motivation in mind — it should guide any judgment call this prompt doesn't cover.

## Step 0 — Work out what this app is, first

Before writing anything, inspect the repo and tell me what you found:

- The build tool (Vite, Next.js, Create React App, something else).
- Whether a service worker exists at all, and how it's produced — `vite-plugin-pwa`,
  `next-pwa`, a hand-written `sw.js`, Workbox directly, or nothing.
- Where a small persistent piece of UI would naturally live (a footer, a settings screen, an
  About panel) — somewhere reachable without hunting.

Then follow the branch that matches. Part 1 applies to every app; Part 2 only applies if a
service worker exists.

## Part 1 — The version counter (do this in every case)

Create a module holding one hand-maintained integer, e.g.:

    /** Bump by one whenever work ships. */
    export const APP_VERSION = 1;

Start at 1 regardless of the app's age. This is a "builds I've shipped since adding this
counter" number, not a semver release.

Deliberately hand-maintained rather than derived from git commit count or `package.json`: a
version should mark a change worth noticing, not every commit. Keeping it in its own file
makes bumping it a one-line diff that's obvious in review.

Render it somewhere always reachable — `V1` — as plain text. If the build can supply a commit
SHA and build time (for example Vercel exposes `VERCEL_GIT_COMMIT_SHA`, or you can shell out
to `git rev-parse HEAD` at build time), put those in a `title`/tooltip behind the version
rather than on screen. The version is the part a person can compare between two devices; the
SHA is forensics for when something looks wrong.

If you add build-time constants, inject them at build time (Vite: `define`; Next.js:
`env`/`NEXT_PUBLIC_*`) and wrap any git shell-out in a try/catch — a cosmetic label must
never be able to fail a build.

## Part 2 — Update detection (only if a service worker exists)

The problem: a page that is already open keeps running the JavaScript it started with, and
the browser only checks for a new worker on a cold load. An app resumed from the background
can sit on an old build for days.

Implement:

- A check on an interval (hourly is fine) **and** a check on `visibilitychange` when the
  document becomes visible. The visibility check is the one that matters — an installed app
  is switched back to far more often than it is loaded fresh.
- When a newer build is ready, show a small, dismissible prompt offering **Reload** and
  **Later**.

**Never reload automatically.** A reload nobody asked for discards whatever was half-typed
into a form. Offer it and let the offer return on the next check.

### If the app uses vite-plugin-pwa — read this before writing code

This is a real trap that produces an implementation which looks correct and silently does
nothing. Verify it against the installed plugin's own source
(`node_modules/vite-plugin-pwa/dist/client/build/register.js`) rather than trusting the docs
or your recollection:

- With `registerType: 'autoUpdate'`, the plugin **never calls `onNeedRefresh`**, and the
  `updateServiceWorker` function it returns is a **no-op**.
- In that mode it calls `window.location.reload()` **itself** unless you supply
  `onNeedReload`. Supplying `onNeedReload` is exactly what converts an unannounced reload
  into an offer.
- So: use `onNeedReload`, not `onNeedRefresh`. Reloading is then just
  `window.location.reload()`, because by the time it fires the new worker already controls
  the page.

Keep `registerType: 'autoUpdate'` rather than switching to `'prompt'`. `autoUpdate` is what
lets a new worker claim copies already installed on my devices; `'prompt'` leaves the new
worker waiting behind a prompt that a stale install may never show.

Register through `virtual:pwa-register` and set `injectRegister: null` in the plugin config,
otherwise the worker is registered twice.

### If the app uses a different service worker setup

Same behaviour, adapted: register or obtain the `ServiceWorkerRegistration`, call
`registration.update()` on the interval and on `visibilitychange`, and listen for a new
worker taking control (`updatefound` / `controllerchange`, or the equivalent your setup
exposes) to trigger the prompt. Check the actual library's source for the equivalent trap
before relying on any callback name.

### If there is no service worker

Do Part 1 only. Then tell me plainly that Part 2 was skipped and why, and what it would take
to add it — don't silently drop half the request, and don't add a service worker to an app
that doesn't have one without asking me first.

## Step 3 — Make the counter stay accurate

Add a line to this repo's agent instructions (`CLAUDE.md`, `AGENTS.md`, or whatever
convention it uses; create one if there is none) saying to bump the version constant whenever
work ships, and why. Those files are read at the start of every session, which is the only
way a manual counter survives the conversation that introduced it.

## Step 4 — Verify it, don't assert it

Required, not optional. If you skip it, say so rather than implying it passed.

For Part 1: run the app and confirm the version renders, with the build detail in the
tooltip.

For Part 2, do a real service-worker update — a mocked one proves nothing:

1. Build and serve the production build (not the dev server; service workers behave
   differently there).
2. Load the app in a browser profile that persists between page loads, and wait until
   `navigator.serviceWorker.controller` is non-null.
3. Type something into any text input and leave it there.
4. Bump the version constant and rebuild, on top of the running server, while the page stays
   open.
5. Trigger the visibility check, or call `registration.update()` directly.
6. Confirm: the prompt appears, the typed text is still there (nothing reloaded behind your
   back), and clicking Reload lands on the new version number.

Report what you actually observed at each step.

## Constraints

- Match this repo's existing conventions — styling approach, file layout, naming, comment
  density. Don't import a foreign house style.
- No new dependencies beyond what the repo already has, unless you ask me first.
- Don't restructure unrelated code while you're in there.
- Keep the UI text plain and non-technical. "A newer version is ready" — not "Service worker
  update available".
```

---

## Appendix — a working implementation

From a Vite + React + `vite-plugin-pwa` app, TypeScript. Include this only if the agent wants
a concrete model to follow.

**`src/version.ts`**

```ts
/** Bump by one whenever work ships to main. */
export const APP_VERSION = 1;
```

**`src/hooks/useAppUpdate.ts`**

```ts
import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

/** Hourly is frequent enough for an app deployed a few times a week. */
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

export interface AppUpdate {
  /** A newer build is active and waiting for a reload. */
  needRefresh: boolean;
  /** Pick it up now. */
  updateApp: () => void;
  /** Keep this build for now; the offer returns on the next check. */
  dismiss: () => void;
}

export function useAppUpdate(): AppUpdate {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    let onVisible: (() => void) | undefined;

    registerSW({
      immediate: true,
      // NOT onNeedRefresh: under registerType 'autoUpdate' that is never
      // called, and the returned updateServiceWorker is a no-op. Without
      // onNeedReload the plugin reloads the page on its own.
      onNeedReload() {
        if (!cancelled) setNeedRefresh(true);
      },
      onRegisteredSW(_url, registration) {
        if (!registration) return;
        const check = () => void registration.update();
        timer = window.setInterval(check, UPDATE_INTERVAL_MS);
        onVisible = () => {
          if (document.visibilityState === 'visible') check();
        };
        document.addEventListener('visibilitychange', onVisible);
      },
    });

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      if (onVisible) document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return {
    needRefresh,
    // The new worker already controls the page by this point, so a plain
    // reload is all that's needed.
    updateApp: () => window.location.reload(),
    dismiss: () => setNeedRefresh(false),
  };
}
```

**`src/components/UpdatePrompt.tsx`**

```tsx
import { APP_VERSION } from '../version';

interface Props {
  onReload: () => void;
  onDismiss: () => void;
}

export function UpdatePrompt({ onReload, onDismiss }: Props) {
  return (
    <div className="update-prompt" role="status">
      <p className="update-prompt__text">
        A newer version is ready. You're on V{APP_VERSION}.
      </p>
      <div className="field-row">
        <button type="button" className="btn btn--primary" onClick={onReload}>
          Reload
        </button>
        <button type="button" className="btn btn--quiet" onClick={onDismiss}>
          Later
        </button>
      </div>
    </div>
  );
}
```

**Wiring it up** — call the hook in the root component (unconditionally, above any early
return, as hooks require) and render the prompt:

```tsx
const update = useAppUpdate();

// …

{update.needRefresh && (
  <UpdatePrompt onReload={update.updateApp} onDismiss={update.dismiss} />
)}
```

**`vite.config.ts`** — the plugin must not also inject its own registration:

```ts
VitePWA({
  registerType: 'autoUpdate',
  injectRegister: null, // we register via virtual:pwa-register ourselves
  // …
})
```

**Build-time constants** for the tooltip, in `vite.config.ts`:

```ts
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

export default defineConfig({
  define: {
    __BUILD_SHA__: JSON.stringify(sha ? sha.slice(0, 7) : 'dev'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  // …
});
```

with matching ambient declarations in a `.d.ts` inside the source root:

```ts
declare const __BUILD_SHA__: string;
declare const __BUILD_TIME__: string;
```
