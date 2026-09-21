# Anchor — Handover to Build Chat (v2, scope confirmed)

*For: New chat / Claude Code, starting the actual repo*
*From: Anchor Design Chat*

This supersedes the previous handover's scope section — the app has grown from "path-view
prototype" to "full Todoist replacement, plus two features Todoist doesn't have." Everything
about the path/momentum/anti-streak mechanics is unchanged.

## What Anchor Is

A task manager meant to fully replace Todoist, built around one core mechanism: action
produces motivation, not the other way around. Waiting to feel ready before starting a task
rarely works; starting is what generates the capacity to continue. Every mechanic below
exists to make starting require as little willpower and as few in-the-moment decisions as
possible.

Two things make it more than a Todoist clone:

1. **The path view** — a way of seeing and running a day/week that Todoist doesn't have.
2. **Scenic mode** — a purely cosmetic, non-functional visual mode (see below). This ships
   last, after the functional replacement is solid — it's confirmed as the final-version
   feature, not something to build early.

Everything else — task storage, organizing, grouping, recurrence — needs to reach real
Todoist-replacement parity, because this is meant to be the person's actual daily task
system, not a side app.

## Task Backend (the "Todoist-replacement" layer)

This needs standard full-featured task-manager capability:

- Create/edit/delete/organize tasks
- Grouping (projects/categories — whatever grouping concept fits)
- Recurrence (repeating tasks, custom patterns)
- Multiple views over the same underlying tasks — path view is the primary/signature one, but
  a kanban or list view should also exist as an alternate lens on the same data
- **Weekly programming** — the person wants to be able to plan a whole week of path/tasks
  ahead of time, not just one day, since their actual actions don't vary much week to week.
  This is the same "remove the decision in advance" philosophy as locking a single day's
  path, just applied at a larger scale.

### Explicitly de-scoped / not needed — don't spend build time here

- **Natural-language date parsing** ("next Tuesday at 3") — not wanted. The person prefers a
  more explicit/technical way of entering times and recurrence rules, which also fits the
  app's broader philosophy of removing ambiguity.
- **Cross-device push notifications** — not a priority, including when the app isn't running.
  Don't treat PWA notification limitations as a blocker for anything.

### Reuse, don't rebuild

The person already has recurrence/routine logic and offline-first sync built in another app
of theirs. The plan is to port that logic into Anchor rather than build it from scratch. When
starting the backend, **ask them for that existing implementation first** — check whether its
data model maps cleanly onto Points (which carry `type: physical/abstract/rest`, and duration
semantics that a flat recurrence engine may not natively support) or needs adapting.

## The Core Concept: The Path

- The day (or week) is a path — a route with points on it.
- Each point: title, start time, duration (fixed/timer, or "runs to natural completion" for
  tasks like cooking that end on their own), and a type: physical, abstract, or rest.
- Rest is first-class, not empty space — its own segment, its own duration, and explicitly
  **not completable**. Its whole job is to exist and be legitimate, not to become one more
  thing to feel guilty about skipping.
- The path (or week) is ideally **locked in advance**, so execution time requires zero
  re-deciding. This is the single most important mechanic — it's implementation-intention /
  if-then planning, well-supported in behavioral science specifically for people who struggle
  to start or get derailed mid-task.

## Momentum

- After a point completes, the app can **offer — never force** — the next one ("keep going?").
  Declining costs nothing, visually or functionally.
- Physical tasks (cooking, exercise) are treated as better "anchor" tasks than abstract ones
  (studying) because they give visible proof of progress even on days when someone can't
  emotionally feel that progress happened. Bias the day/week toward leading with a physical
  anchor where possible.

## Tracking — Anti-Streak by Design

- No streak chains that reset to zero. Use a rolling window (e.g. 14 days) and/or running
  totals.
- A missed point renders neutrally — a gap, not a failure. In the mockups this is the
  `PASSED` state: cold, unlit, labeled like "not logged, still on the route." Never red,
  never framed as failure, anywhere in the app.

## Language Rules

- No clinical/diagnostic terms anywhere in copy.
- No blame-framed states ("you failed," "streak lost").
- Neutral, non-judgmental language throughout — this applies even inside the aggressive
  visual skin; the aesthetic can be hostile-looking, the app's attitude toward the user never
  is.

## Visual Design

Aesthetic: neon noir cyberpunk — dramatic, aggressive, saturated, dark backgrounds, glowing
accents.

Color carries meaning, not just mood:

- **Ember red** — the thing pulling you now
- **Acid green** — proof something happened (completed points, the tracking ledger)
- **Cyan** — reserved exclusively for optional things (momentum offer, live position marker)
  — cyan = "you may decline this"
- **Slate/cold grey** — the neutral missed state — never red, never punitive

Canonical mockup: `anchor-frontpage.html` — if any mockup conflicts with another, this one
wins (it's the newest and most complete: proportional rest-segment lengths, the neutral
`PASSED` state, the momentum offer card, the anti-streak ledger).

Other files are concept history, not visual reference:

- `anchor-path-neonnoir.html` — earlier path exploration, superseded by the front page
- `anchor-app-mockup.html` — original single-card layout, pre-path, superseded
- `anchor-path-mockup.html` — first path version, non-cyberpunk palette, superseded

## Scenic Mode (confirmed: build last)

- Purely cosmetic, no functional purpose — a "fun/atmospheric" alternate view, diegetically
  framed as some kind of signage (a menu board, departure board, ad, etc.) somewhere in a
  city.
- Focus mode (the normal functional UI — everything above this section) should cost near-zero
  energy. Scenic mode can be visually expensive since sessions there will be short — but it
  must be **structurally separate** (fully unmounted when inactive, not just hidden) so its
  cost never leaks into focus mode.
- Confirmed to ship in the **last version**, after the full task-backend + path + momentum +
  anti-streak system is working and in real daily use. Do not let scenic-mode ambition delay
  or complicate the functional core.

## Tech Plan

- Claude Code for implementation
- GitHub repo — `anchor` or `anchor-app`
- Vercel, deployed as a PWA
- Framework (Next.js vs. Vite+React) still open
- Notifications and offline push are not priorities — don't let PWA limitations here block
  the stack decision
- Persistence: likely needs to go beyond simple `localStorage` given the full-replacement
  scope and the existing offline-first sync system being ported in — confirm with the person
  how that existing sync system works before designing storage

## Suggested Build Order

1. Port/adapt the existing recurrence + offline-sync system into a `Task`/`Point` data model
   (physical/abstract/rest typing, duration semantics, rest-as-uncompletable).
2. Build basic CRUD + grouping + recurrence on top of that model — this is the
   Todoist-replacement layer, needs to actually be usable day to day.
3. Build the path view (and optionally a kanban/list view) as lenses over the same task data
   — front page mockup is the visual reference.
4. Implement locking (day and/or week), the momentum offer, and rolling-window tracking.
5. Only once 1–4 are solid and in real use: scenic mode.

## Reference Material to Attach

- `anchor-frontpage.html` (canonical visual reference)
- `anchor-path-neonnoir.html` (secondary/historical reference)
- Feature/function spec document
- Research report (prior-art + behavioral-science backing — useful if a design decision gets
  questioned during implementation)
- This handover
