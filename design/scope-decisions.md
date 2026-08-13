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

## Decided during path-view design discussion (2026-08-07) — superseded

**Superseded by the 2026-08-08 section below.** Kept as a record of what was thought at the
time, per this file's convention. The approach here — a day's contents derived from due dates,
assembled in a builder and committed by pressing "Run" — was replaced before any of it
shipped. What survives from it: the path builder as its own sidebar destination, and the
cyberpunk aesthetic carried into build mode turned down rather than turned off.


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

## Decided for the path builder (2026-08-08)

**The path builder is two screens: a multi-week overview, and a single-day editor.** The
overview shows up to four weeks at once — enough to see how things lay out and whether
anything is piled up — with the current day's row picked out. It is for looking, not for
changing. Clicking a day opens that day in the editor.

Editing a whole week in one screen was tried on paper and dropped: seven days across one
screen gives each day a seventh of the width, which is cramped for something being arranged
carefully. One day at a time gets the whole screen, and it is the same editor on desktop and
phone — one thing to build, one thing to learn. It also removes dragging between days
entirely, which never had a workable phone gesture.

**Editing a day edits the rule, not that one day.** Moving something to 8am moves it
everywhere it appears; the overview is a projection of the rules four weeks forward, not four
weeks of separately editable days. A one-off override ("just today, 6am instead") is
deliberately left out for now — it can be added later without disturbing anything.

**Times are optional.** An item may carry a fixed clock time, or simply follow the one before
it in order. "Gym at 7:00" then "shower" then "emails" is a valid day — only the first has a
clock. Requiring a time on everything would turn arranging a day into filling in a form.

**Day editor layout: the day on the left, the library on the right.** The opened day sits on
the left and needs no great width. The right side lists every to-do in the app, sortable and
groupable by the obvious axes (A–Z, by project), and items are dragged or selected across into
the day. Selecting an item already placed on the path opens its repeat settings.

**The repeat engine stands, and is what "how often" means.** Every day, every other weekday,
six days a week, chosen weekdays — all already built and unit-tested in `src/lib/recurrence.ts`.
An item's repeat rule is how it says how often it appears on the path. The same rules also
drive due dates on the to-do side, which is what lets Anchor work as a plain task manager for
anyone who never opens the path.

---

## Unchanged, and not up for renegotiation

Rest is never completable. Nothing stores "missed". No streak chain, and no value a gap can
reset. Cyan means *you may decline this*, and nothing else. No clinical language, and no
blame-framed state anywhere — including in the parts of the app that look hostile on purpose.

---

## Step 4 — RUN and the mode split

**RUN leaves build mode; it does not publish anything.** Edits save as they are made, exactly
as they already do. RUN means "I'm done changing things, show me the route." The alternative —
holding edits as a draft that RUN makes real — buys the ability to abandon a session of
edits, at the cost of the app holding two versions of the week and having to decide what
happens when you leave without pressing the button. Nothing to lose and nothing to confirm is
worth more than an undo nobody asked for.

**Build mode carries a weekday strip.** MON TUE WED THU FRI SAT SUN across the top of the
builder, moving within the week currently being looked at. Building a whole week is one
sitting rather than seven trips out to the calendar and back. The calendar stays as the way to
move between weeks and to jump to a date.

**Step 4 is structural only.** The mode split and RUN, nothing else. The NOW marker, what's
passed receding, the ember glow on the thing pulling you — those are one piece of design and
land together in step 5 rather than arriving half-built a step early.

**Build mode is not remembered.** Path mode is a stored setting because it is a preference;
building is something you are doing right now. Reopening the app tomorrow should give you the
route, not the builder you left open.

**The line between the two modes is what the edit changes.** Build mode changes *the week* —
order, times, rest, where the wildcards sit. The path view changes only *today*: ticking a
point, and filling a wildcard. That is why filling a wildcard stays available outside build
mode — the whole reason a wildcard exists is the thing that turned up this morning, and going
into the builder to record it would be the wrong shape entirely.
