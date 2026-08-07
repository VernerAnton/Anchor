# Scope decisions

Where `anchor-feature-spec.md` and `anchor-handover-v2.md` disagree, this is what was
decided and why. The two source documents are kept unedited — they're a record of what was
thought at the time, not a spec to be retconned.

---

## Superseded by v2

**Natural-language entry — dropped.** The feature spec listed "cook chicken at 8, 25 min"
under *borrow directly from Todoist*. v2 explicitly does not want it: explicit, technical
entry of times and recurrence rules is preferred, which also fits the app's wider goal of
removing ambiguity.

**Push notifications — not a priority.** Previously flagged as the one genuine architectural
fork, since web push is unreliable on iOS. v2 settles it: not wanted, and not a blocker for
anything. The stack stays a plain PWA.

---

## Decided

**Views: path + list. No kanban.**
The feature spec drops kanban; v2 offers it as optional. Dropped. A list view is needed
regardless — unscheduled tasks and the backlog have to live somewhere the path can't show —
but kanban would need a column concept (status? project? day?) that nothing in the model
implies, and inventing one to fill a board is the wrong reason to add a feature.

**Priority levels: in, on tasks only — never rendered on the path.**
This overrides the feature spec, which dropped priorities on the grounds that "being
scheduled already means it matters." That argument is still right *about the path*, and the
reason is the whole thesis: at the moment of doing, a second axis of importance is one more
decision at exactly the wrong time, and a visible "low priority" tag on a point you're about
to start is an invitation to skip it.

It is not right about the backlog. An unscheduled list with no ordering is just a pile, and
sorting it is a planning-time activity where deciding is the actual job.

So: priority is a field on `Task`, used for ordering and filtering the list view. It does not
appear on a `Point`, and it does not survive onto the path. Nothing is ever labelled
low-priority in a place where you are being asked to start it.

**History: past paths are frozen.**
A `Point` stores what it said on the day — title, first move, type — plus a `taskId` for
provenance. Renaming or editing a task changes the library and every *future* scheduling of
it; it does not reach backwards.

This is not a storage nicety. The ledger is evidence of what actually happened, and it's the
only thing standing in for the felt sense of progress that this app's users often can't
access. Evidence that silently rewrites itself is not evidence. A day should always be able
to answer "what did I actually do" truthfully, including when the answer is embarrassing or
the task has since been renamed to something else entirely.

---

## Decided at the start of the rebuild (2026-08-04)

**Labels: out.** Projects are the only organising axis, matching how the owner actually
works. The Zod schemas use `.catch()` defaults, so a labels field can be added later without
invalidating existing documents — skipping now doesn't close the door.

**Recurrence: built new, explicit rules only.** The existing engine is not being ported.
Three rule shapes: every N days, weekly on chosen weekdays, monthly by date (clamped to
month length). Entered through explicit controls, never parsed from text. Completing a
recurring task advances its due date — from the due date when completing early, from today
when overdue, so nothing ever backfills a "missed" occurrence. The engine is pure functions
in `src/lib/recurrence.ts`, unit-tested.

**Subtasks: in, one level flat.** `parentId` on Task, checklist-style children under a
top-level task. Covers the Todoist-parity need without deep-nesting complexity.

**Sync layer: ported as decided.** The rebuild copies the verified store from the previous
attempt wholesale (`src/store/`), with only schemas and mutations rewritten for the
task-first model. New namespaces (`v2-tasks`, `v2-projects`, `v2-settings`, localStorage
`anchor:v2:*`) so old and new data coexist in the same Firebase project and on installed
devices.

---

## Decided during path-view design discussion (2026-08-07)

**Path generation is pattern-based, not a daily or weekly chore — this settles the weekly
programming question above.** Build mode assembles a pattern once — a week, or open-ended —
not a single day at a time. Path view for any given day derives its points from whichever
tasks' recurrence rules say "today," the same mechanism the list view's Today section already
uses to decide what's due. This is exactly why `firstMove`, `type` and `defaultDuration` were
carried onto `Task` as nullable fields from the first session: a task with those set isn't
just a to-do, it's a template for a recurring point. Completing a point in path view advances
the underlying task's due date, identical to completing it in the list view — nothing
regenerates unless the pattern itself changes. If nothing changes for months, the same
structure keeps repeating with no return to build mode required.

**"Run" commits a pattern and transitions into path view — a named, deliberate threshold.**
Mirrors `setLocked` / `addPointFromTask` from the old reference code: assembling in build mode
produces the artifact, Run is the moment it's committed and launched. A short transition
animation marks the crossing — scoped separately and far more modestly than scenic mode,
which stays the last, most expensive phase. Reaching back into build mode to change a
committed pattern is the deliberate door back, not an accident — no inline editing controls
live in path view itself.

**Build mode is where you go only to change something, never on a schedule.** The app's
default view is the path (unchanged from the v3 handover); build mode is a destination you
visit deliberately when something needs to change, then leave.

**The path builder gets its own sidebar destination, not a sub-view of All Tasks.** Sits as a
fourth item in the views group, next to Today / Upcoming / All tasks — reachable in one click
from the same region, but its own screen. Assembling a route (times, order, rest) is a
different interaction from browsing a flat list, and merging the two risks both jobs working
worse.

**Build mode carries the cyberpunk aesthetic too, turned down rather than turned off.** Not a
calmer, different theme — the same dark surfaces, the same ember/acid/cyan grammar, the same
three typefaces, just fewer things glowing at once. Path mode's continuous pulsing animation
on the active point stays reserved for path mode specifically, where "this is live, pay
attention" is the actual point; a task list triaged for ten minutes shouldn't be animating the
whole time you're in it.

---

## Unchanged, and not up for renegotiation

Rest is never completable. Nothing stores "missed". No streak chain, and no value a gap can
reset. Cyan means *you may decline this*, and nothing else. No clinical language, and no
blame-framed state anywhere — including in the parts of the app that look hostile on purpose.
