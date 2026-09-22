# The parts bin — what to take from `archive/`

The previous implementation got a lot wrong at the surface and a lot **right** underneath.
This is the map to the right parts.

Nothing here is an obligation. But each entry represents a bug someone already hit,
diagnosed and fixed, and rewriting it from scratch means meeting that bug again — usually
at the worst moment. Read the "already knows" column before deciding to write your own.

`archive/` is excluded from the build, so copying a file means literally copying it into
`src/` and adjusting its imports.

---

## Take this one almost certainly: the recurrence engine

```
archive/src/lib/recurrence.ts         522 lines
archive/src/lib/recurrence.test.ts    537 lines, all passing
```

The hardest thing in the app, and the least fun to rediscover.

**What it already knows:**

- **`day: -1` means the last day of the month and is not the same as `31`.** 31 clamps to
  the month's length; -1 tracks it. February makes the difference visible.
- **"Every other Saturday" is unanswerable without an anchor date.** Which Saturday is the
  on-week is undefined otherwise. The rule carries `anchor`, consulted only when
  `interval > 1`.
- **Weekly intervals have two legitimate readings, and you need both.** `count: 'weeks'`
  over Mon–Fri with interval 2 means the weekdays of alternate weeks. `count: 'occurrences'`
  means every second matching day — Mon, Wed, Fri, Tue, Thu. Only weekly has the
  distinction; every other frequency yields at most one occurrence per calendar unit, so
  the readings coincide.
- **`grid` vs `fromCompletion`.** Grid keeps the rule on the calendar however late you are.
  From-completion measures from when you actually finished, so the rhythm follows you
  rather than accumulating against a schedule you didn't keep.
- **Completion advances `dueDate` rather than setting `completedAt`**, so the task stays
  live for its next occurrence. When `remaining` hits zero it completes like a normal task.
- Monthly-by-weekday (`week: -1` for "the last Friday"), yearly by date and by weekday,
  several dates per month ("the 1st and the 15th" is one rule), `until` bounds.

It also carries `describeRecurrence`, `shortRecurrence` and `previewOccurrences` — plain
language for the editor and the row, which is a surprising amount of fiddly work on its own.

**Depends on:** `archive/src/lib/dates.ts`. Take that too.

---

## Take this if you want sync: the store layer

```
archive/src/store/          ~2,100 lines including tests
```

The owner's own working Firestore setup, ported and verified. It knows nothing about the
path, so it transplants cleanly.

**What it already knows:**

- **Sync-key identity.** A user-chosen phrase *is* the credential — no accounts, no
  sign-in. The same key on another device means the same data. **No key means the app runs
  fully local from `localStorage`, which is a complete mode, not a degraded one.**
- **Conflicts resolve on integer `version`, never timestamps.** Bumped synchronously before
  any async work. This is what makes it immune to clock skew — a snapshot carrying a lower
  version than local state is a stale echo and gets refused. Timestamps look like they'd
  work and then quietly lose data on a device with a wrong clock.
- **One `undefined` field silently rejects an entire Firestore write.** This caused a real
  failure. `ignoreUndefinedProperties` is set as a second line of defence, and the model
  rule (`x: T | null`, never `x?: T`) is the first.
- **The first-connect migration is guarded** so an empty device can never wipe existing
  cloud data: nothing is deleted, and a cloud document is only overwritten by a strictly
  higher local version.
- **Cloud data is untrusted** — everything inbound is Zod-validated, and invalid documents
  are dropped with a warning rather than merged into local state.
- **IndexedDB persistence with the multi-tab manager**, so writes made offline are durably
  queued and replayed on reconnect.
- **The repository interface is subscription-shaped** (`subscribeTasks(cb)`), matching
  Firestore's `onSnapshot`, with callbacks always async **including the first**. Code
  written against a synchronous `localStorage.getItem` has to be torn up to accept that;
  code written against a subscription does not. Start subscription-shaped even while
  you're local-only.

**Two backends, one interface:** `localRepository.ts` and `firestoreRepository.ts` both
implement `repository.ts`, chosen once at boot in `index.ts`.

**Take the whole folder, minus the path bits** — `getPathPattern`/`savePathPattern`,
`getDayLogs`/`saveDayLog`, and the path entries in `keys.ts`, `schemas.ts` and
`mutations.ts`.

`archive/docs/firebase-setup.md` has the console setup, and
`archive/design/handover-firebase-sync.md` documents the whole architecture.

> If you'd rather start local-only, that's fine — but **keep the subscription shape**.
> Retrofitting it later is the expensive version.

---

## Worth reading before you write your own: the view logic

```
archive/src/lib/views.ts        + views.test.ts
archive/src/lib/sorting.ts      + sorting.test.ts
archive/src/lib/grouping.ts     + grouping.test.ts
archive/src/lib/labelSearch.ts  + labelSearch.test.ts
archive/src/lib/reschedule.ts   + reschedule.test.ts
archive/src/lib/taskRef.ts      + taskRef.test.ts
```

All pure functions returning data — no React, no styling. Whether or not you take the code,
take the ideas:

- **Absent values sort last, always**, and reversing brings them to the front. That's the
  honest consequence of asking for the reverse, not a special case to suppress.
- **Every comparator ends at the title and then the id.** Without a stable tail, adding one
  task reshuffles rows that had nothing to do with it.
- **Grouping happens before sorting.** Sorting a list you're about to cut up is work thrown
  away; the order that matters is the one you read down a section.
- **A task with two labels appears under both groups.** Grouping by project can't do that —
  a task has exactly one — which is the clearest statement of how the two axes differ.
- **Label names match case-insensitively**, and a comma finishes a label so one paste of
  "focus, deep work, errand" lands as three. **Resolve the whole list before writing
  anything** — two new names sharing one write both claim the same order and the task gets
  saved twice from the same stale copy, keeping only the last. That's a real bug that was
  really hit.

---

## Take this: sample data

```
archive/src/lib/sampleData.ts     326 lines
```

**You asked for this specifically.** A week of plausible tasks and projects so a fresh
install isn't a blank screen and the app can be tried before it holds anything real.

**What it already knows:**

- **Every sample id starts with `SAMPLE_PREFIX`, and that prefix is the whole removal
  mechanism.** Clearing samples deletes exactly the documents whose ids carry it, and
  cannot touch anything you made yourself. A `sample: true` field would instead have to be
  carried by every real task forever, just to mark that it isn't one.
- The content is chosen to **exercise the features worth seeing**: daily, weekday,
  every-other-week and monthly rules; one-offs with real dates; unscheduled backlog items;
  subtasks; and a task with nothing set at all.

**When you take it:** drop `samplePattern` and the `PathEntry`/`PathPattern` imports, and
**add sample labels** — the old file predates labels being worth showing off, and labels
are one of the better things about this app.

---

## Take this: the update prompt

```
archive/src/hooks/useAppUpdate.ts        the detection
archive/src/components/UpdatePrompt.tsx  the offer, with a Reload button
docs/app-version-and-update-prompt.md    324-line guide, still at the repo root
```

**This one matters more than its size suggests, and it has a trap in it.**

The owner has Anchor installed as a PWA on several devices. A service worker will happily
install a new build, but a page that is already open keeps running the JavaScript it
started with, and the browser only looks for a new worker on a **cold load**. An installed
app resumed from the background can therefore sit on an old build for days with no hint —
which is how a bug fixed last week is still on your phone. Without this, "did my fix
actually reach the device?" becomes unanswerable, and that question comes up constantly.

**What it already knows:**

- **Check on visibility change, not just on a timer.** This app is switched back to far
  more often than it is loaded fresh, so the `visibilitychange` listener is the one that
  actually catches updates. The hourly timer is the backstop.
- **`onNeedReload`, not `onNeedRefresh` — and this is the trap.** Registration stays on
  `autoUpdate`, which is what lets a new worker claim already-installed copies rather than
  waiting behind a prompt nobody sees. But under `autoUpdate` the plugin **never calls
  `onNeedRefresh`**, and its `updateServiceWorker` does nothing. What it *will* do is call
  `window.location.reload()` by itself unless you supply `onNeedReload`. **Supplying that
  callback is the only thing standing between "we offer you a reload" and "the app reloads
  underneath you and discards the task you were half-way through typing."**

  Wire this up from the wrong half of the plugin's API and it looks correct in testing —
  you'll see updates arrive — while silently eating input in real use.
- **By the time the prompt fires the new worker already controls the page**, so
  `window.location.reload()` is all that's needed. No `skipWaiting` dance.
- **Offered, never forced.** Declining costs nothing; the offer returns on the next check.
  Same reason as everywhere else in the app — a reload you didn't ask for throws away what
  you were typing.
- **The prompt names the version you're on** ("You're on V26"), which is what makes
  `APP_VERSION` worth maintaining rather than decorative.

**`docs/app-version-and-update-prompt.md` survived the reset and is still at the repo
root** — it's a full guide with a working implementation in its appendix, plus a section on
verifying it for real rather than asserting it. Read that before wiring this up.

The `UpdatePrompt` component itself is trivial and carries old class names, so rebuild the
markup. **Take `useAppUpdate.ts` as-is** — it's the part with the knowledge in it.

---

## Take as-is: infrastructure

Already at the repo root and working. Don't rebuild these.

- `vite.config.ts` — PWA plugin, service worker with `autoUpdate`, build-sha injection.
  Fiddly and correct.
- `index.html` — includes an inline pre-paint script that sets `data-theme` from a cached
  hint before first render. It exists to prevent a flash of the wrong scheme, and anything
  loaded over the network arrives too late to do that job.
- `public/icons/`, `.env.example`, `docs/`.

Also worth lifting:

```
archive/src/components/ErrorBoundary.tsx    small, does its job
archive/src/components/NumberField.tsx      a numeric input that behaves
archive/src/lib/theme.ts                    light/dark/system resolution
archive/src/lib/build.ts, id.ts             trivial but done
```

---

## Worth a look, but rebuild rather than copy

```
archive/src/components/RecurrenceEditor.tsx   392 lines
archive/src/components/LabelPicker.tsx
archive/src/components/DetailPanel.tsx
archive/src/components/TaskRow.tsx
```

These carry the old theme's assumptions in their markup and class names, so copying them
imports the problem this rebuild exists to remove. But **read them before designing your
own** — especially `RecurrenceEditor`, which is a genuinely hard piece of UI (six
frequencies, intervals, two counting modes, two completion modes, bounds, a live preview)
and shows one workable answer.

---

## Don't take

- `archive/src/styles/` — all three stylesheets. `app.css` alone is 3,051 lines and is
  exactly what went wrong. `styling.md` says what to do instead.
- Anything path-shaped: `Path*.tsx`, `WeekdayStrip.tsx`, `TaskPicker.tsx`,
  `ExitPathMode.tsx`, `lib/day.ts`, `lib/dayTimes.ts`, `lib/pathGrid.ts`, `types/path.ts`.
- `archive/src/App.tsx` — it's a 600-line component holding every write handler in the app.
  Read it to see what handlers you'll need, then structure it better.

---

## Also in the archive

`archive/design/` holds the mockups, the behavioural-science research report (useful when a
design decision gets questioned), the old handovers and `scope-decisions.md` — the full
record of what was decided and why. `decisions.md` in this folder is the condensed version;
go to the archive when you want the argument rather than the conclusion.
