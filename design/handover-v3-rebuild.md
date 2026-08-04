# Anchor — Handover for the rebuild (v3)

*Written to be read cold. Nothing here assumes access to the conversation that produced it.*

This supersedes the build order in the earlier handovers. The product itself is unchanged —
what changes is the sequence it gets built in.

---

## What Anchor is

A task manager built on one premise: **action produces motivation, not the other way
around.** Waiting to feel ready rarely works; starting is what generates the capacity to
continue. Every mechanic below exists to make starting cost as little willpower and as few
in-the-moment decisions as possible.

Single user. No collaboration, sharing or assignment. It is meant to fully replace Todoist
as the owner's real daily system — not to sit beside it as a side app. If it isn't as
capable as a real task manager, it won't get used, and then none of the rest matters.

---

## The end goal: the path view

The signature feature, and the reason the app exists. A day rendered as a **route** rather
than a list.

- Each **point** carries a title, a start time, a duration — either fixed (a timer with a
  hard stop) or "runs to natural completion" for things like cooking that end on their own —
  and a type: physical or abstract.
- Each point also carries a **first move**: the smallest action that begins it. The button
  says *"Pick up the knife"*, never *"Start"* and never the task name. The whole point is
  that what the app asks for is small enough to be silly to refuse.
- **Rest is a first-class segment.** Its own duration, drawn proportional to its real length,
  and **never completable**. Its job is to exist and be legitimate, not to become one more
  thing to feel guilty about skipping.
- The path is **locked in advance**, ideally the night before, so execution requires zero
  re-deciding. This is the single highest-leverage mechanic in the product — implementation
  intentions / if-then planning, which has strong support for exactly this failure mode
  (not starting, getting derailed mid-task).
- A **momentum offer** appears when a point completes: *"you're already moving — keep
  going?"* Offered, never forced. Declining costs nothing, visually or functionally, and
  nothing anywhere records that it was declined.
- **Physical tasks make better anchors** than abstract ones, because they give visible proof
  of progress on days when progress can't be felt. Bias toward leading with one.

`design/anchor-frontpage.html` is the canonical visual reference for all of this.

---

## Build order — this is the correction

1. **A capable to-do app.** Tasks, nested projects, due dates, recurrence, notes, full CRUD,
   a real desktop layout. This is the foundation and it has to stand on its own.
2. **Views over that data.** A list view first. Then the path view as one more lens — the
   differentiator, not the foundation.
3. **The path mechanics.** Locking, momentum offers, rolling-window tracking.
4. **Scenic mode, last.** Purely cosmetic alternate view, diegetically framed as signage in
   a city. Must be structurally separate and fully unmounted when inactive, so its cost never
   leaks into normal use.

**The mistake to avoid:** building the path first. The previous attempt did, and every piece
of work after it consisted of retrofitting a task manager underneath a view that already
existed — bending a path-shaped data model into a task-shaped one. Tasks are the foundation;
a path is a way of looking at them.

---

## Desktop-first

The previous build capped its layout at 720px. That suits a vertical route and badly suits a
task manager, which is what most of the time is actually spent in.

Build wide first and let it collapse to mobile: sidebar for the project tree, list in the
middle, detail panel on the right — roughly the shape of Todoist. The path view itself stays
narrow on purpose; a timeline does not improve by being stretched across 1400px.

---

## Non-negotiables

Settled. Not worth reopening.

- **Rest is never completable.** Enforce it in the type system, not by convention — no status
  field, no `completedAt`, no shape of the model that could acquire one.
- **Nothing stores "missed."** Store only what happened (`startedAt`, `completedAt`). Every
  not-done state is *derived* at render time from where the user currently is. That's what
  lets a missed point read as a gap in the route rather than a verdict, and it's why
  `PASSED · NOT LOGGED · STILL ON THE ROUTE` is honest rather than euphemistic: no failure
  record exists, because none is kept.
- **No streaks.** A rolling window (14 days) and/or running totals. No consecutive-day
  counter anywhere, and no value a gap can reset. A running total must only ever go up —
  one that shrinks as old days age out is a chain by another name.
- **Colour carries meaning** in the cyberpunk theme: **ember** = the thing pulling you now;
  **acid** = proof something happened; **cyan** = optional, you may decline this; **slate** =
  the neutral missed state, never red. Project colours are a *separate, muted* axis — the
  grammar is *neon means state, muted means identity*. A project tinted ember would claim to
  be the thing pulling you now on every task it touched.
- **Language.** No clinical or diagnostic terms. No blame-framed states ("you failed",
  "streak lost"). Neutral and non-judgemental throughout — the aesthetic is allowed to look
  hostile; the app's attitude toward the user never is.
- **Past days are frozen.** A scheduled point stores what it said on the day, plus a task id
  for provenance. Renaming a task changes the library and every future scheduling of it, and
  reaches nothing already walked. The ledger stands in for a felt sense of progress the
  owner often can't access directly — evidence that rewrites itself isn't evidence.
- **Logging is not planning.** Recording that something happened (done early, done late, done
  after the clock moved past it) belongs in the running view and should be frictionless.
  Changing the plan belongs in the build area. That line resolves most edge cases by itself.

---

## Decisions already settled

- **Projects only** — no saved filters. (Labels: see open questions.)
- **Priority on tasks only**, for ordering a backlog where sorting is the actual job. Never
  rendered on a scheduled point: at the moment of starting, a second axis of importance is
  one more decision, and a visible "low priority" badge is an invitation to skip.
- **No natural-language date parsing.** Explicit, technical entry of times and recurrence
  rules is preferred, and fits the app's wider goal of removing ambiguity.
- **Push notifications are not a priority**, including when the app isn't running. Do not
  treat PWA notification limits as a blocker for any stack decision.
- **Kanban dropped.** List + path.
- **Two modes.** A build area where things are created, organised and scheduled, and the
  path as the place the day is actually run. The app always *opens* on the path — the build
  area is somewhere you go deliberately. This isn't a compromise against the premise; it's
  the premise made structural, since deciding and doing are supposed to happen at different
  times in different states.

---

## Still open

Ask once, early. Don't relitigate.

- **Labels.** The owner says they organise by projects and don't use labels. Their Todoist
  Today view is nonetheless grouped by label with a chip on every task. Genuinely unresolved.
- **Recurrence.** Essential rather than optional — every task in their Todoist screenshot
  recurs. They have an existing recurrence engine in another app and prefer porting it over
  rebuilding, so ask for it first. If it doesn't arrive, explicit rules (every N days /
  chosen weekdays / monthly-by-date) match the stated preference. Note that a flat recurrence
  engine may not natively express point types or "runs to natural completion" durations.
- **Weekly programming.** They want to plan a whole week ahead, since their actions don't
  vary much week to week. Open whether that's a repeating week template that generates days
  you can then tweak, or a week laid out by hand each time. The first mostly falls out of
  recurrence; the second is a separate feature.

---

## What to carry over from the old repo

Branch `claude/nice-davinci-eve0kc`.

**`src/store/` — the sync layer. Take this wholesale.** It is the owner's own working
Firestore system, ported and verified, and it knows nothing about paths:

- **Sync-key identity** — a user-chosen phrase is the credential. No accounts, no sign-in.
  Same key on another device means the same data; no key means the app runs fully local,
  which is a complete mode rather than a degraded one.
- **Firestore's persistent IndexedDB cache** with the multi-tab manager, so writes made
  offline are durably queued and replayed on reconnect.
- **Per-document integer versions**, bumped synchronously before any async work. This — not
  timestamps — resolves conflicts, which makes it immune to clock skew. A snapshot carrying
  a lower version than local state is a stale echo and is refused.
- **A guarded local→cloud migration** on first connect: nothing deleted, a cloud document
  only overwritten by a strictly higher local version, so an empty device can never wipe
  existing data.
- **Zod validation of everything inbound.** Cloud data is untrusted; invalid documents are
  dropped with a warning rather than poisoning local state.
- `ignoreUndefinedProperties`, guarding a real failure the original hit: one `undefined`
  field silently rejecting an entire write.

Also worth taking:

- **`design/`** — the mockups, the behavioural-science research report (useful when a design
  decision gets questioned), `momentum-rules.md`, `scope-decisions.md`.
- **`docs/firebase-setup.md`** — console steps and the Firestore rules for the sync-key model.
- **Self-hosted fonts** (`public/fonts/`, `src/styles/fonts.css`) — Chakra Petch, Fraunces,
  Space Mono, latin subset, so an installed PWA renders correctly with no network.
- **PWA setup** — `vite-plugin-pwa` config, manifest, icons.

**Do not carry over** the components or the path-first data model.

---

## Reference material to attach to the new chat

`anchor-frontpage.html` (canonical visual reference), `anchor-handover-v2.md` (full scope),
`anchor-feature-spec.md`, `momentum-rules.md`, `scope-decisions.md`, the research report,
and this document.

Also put `CLAUDE.md` (see `design/CLAUDE-template.md`) at the new repo root before starting.
It carries the structural rules into every future session, rather than only the one where
they were first stated.
