# Scope — what the to-do side must do

Everything in **In scope** exists in the current codebase and must work at least as well
after this phase. Everything in **New in this phase** does not exist yet and should.
Everything in **Out of scope** is a later phase.

---

## In scope — existing behaviour, must survive

### Views

| View | Contents |
|---|---|
| **Today** | Everything due on or before today. Two sections: **Earlier** (overdue, on top) then **Today**. "Earlier" is a date that has gone by, never a verdict — no red, no "overdue!", no blame. |
| **Upcoming** | Everything due after today, one section per date, ascending. |
| **All tasks** | Every active top-level task, subtasks nested beneath. |
| **Project** | One project's active tasks. |
| **Label** | One label's tasks, gathered across every project. Includes labelled subtasks on their own merits, not only under a labelled parent. |
| **Labels** | A management screen, not a task list: rename, reorder, recolour, archive. |

Each task list ends with a collapsed **completed** block ("Done today" on Today, "Done"
elsewhere), newest first.

The sidebar shows the views with live badge counts, then the project tree with per-project
counts, then a sync entry and the build label.

### Tasks

- **Fields:** title, notes (multi-line), project (one, or none), parent (one level of
  subtasks), priority (P1–P4 or none), due date (explicit `YYYY-MM-DD` or none),
  labels (any number), recurrence (or none), manual order, archived flag.
- **Quick add** at the top of every list. A task added in Today gets today's date; one
  added in a project gets that project. Otherwise no date, no project.
- **Complete / reopen** by checkbox on the row and in the detail panel.
- **Delete** with an inline confirm step, from the detail panel.
- **Subtasks** one level deep, added from the parent's detail panel, shown nested on the
  parent's row.

### What a task row shows

Row content is deliberate — see `03-decisions.md` §"What a row shows". In short: the
project reference, the title, priority flag, project dot and name, label chips, due date,
a compact recurrence summary, and the note's **first line** (not a "has a note" glyph).

Meta is suppressed where it would say nothing: the project is hidden inside that project's
own list, the date is hidden under a heading that already states it, and the label you are
currently viewing is hidden from every row in that view.

### Detail panel

Opens beside the list on desktop, as an overlay on mobile. Contains, in order:

1. Breadcrumb to the parent task, if this is a subtask
2. Complete checkbox and editable title
3. **Reschedule trio** — Tomorrow / In a week / Next occurrence, each labelled with the
   date it would land on. The third appears only when the task repeats and the rule can
   still produce a date. The button matching the current due date is marked, not disabled.
   The whole group disappears once the task is done.
4. Notes
5. Project select
6. Due date (date input + Clear)
7. Label picker — one box that searches existing labels and creates new ones
8. Priority picker — P1–P4, pressing the current one clears it
9. Recurrence editor
10. Subtasks list + quick add
11. Delete, behind a confirm

### Recurrence

A full rules engine, no natural-language parsing:

- **Frequencies:** daily, weekly (by weekday set), monthly by date (several dates allowed),
  monthly by weekday ("third Tuesday", "last Friday"), yearly by date, yearly by weekday.
- **Interval** — every N days/weeks/months/years, with an **anchor** date giving the phase
  so "every other Saturday" is answerable.
- **Weekly counting mode** — `weeks` (the calendar reading: weekdays of alternate weeks)
  vs `occurrences` (every second matching day).
- **Completion mode** — `grid` keeps the rule on the calendar however late you are;
  `fromCompletion` measures from when you actually finished.
- **Bounds** — `until` (a last date) and `remaining` (a countdown of occurrences).
- Completing a recurring task **advances its due date** rather than setting `completedAt`,
  so it stays live for its next occurrence. When `remaining` runs out it completes like a
  normal task.
- The editor previews the next few occurrences in plain language.

### Grouping and sorting

- **Grouping:** none / project / label. Offered on Today and All tasks only — Upcoming is
  already one section per date, and a project's or label's own list is already the answer
  to grouping by that thing.
- **Sorting:** Default (smart) / Priority / Due date / Name / Manual, plus a reverse toggle.
  Offered on every task list.
- Both stored **per view**, and synced.
- Grouping happens before sorting. Structural date sections (Today's "Earlier") survive
  grouping and stay on top. Empty groups are dropped; the ungrouped group is named
  ("No project", "No label") and goes last.

### Projects and labels

- **Projects** nest one level. Eight muted colours. Archived rather than deleted.
  Create, rename, recolour, reparent, archive from the project editor.
- **Labels** are flat and cross-cutting — the second identity axis. Case-insensitive
  matching, so "Focus" and "focus" are one label. A comma finishes a label, so pasting
  "focus, deep work, errand" lands as three. Deleting a label takes it off every task.

### Platform

- **Cloud sync** — Firestore, addressed by a user-chosen **sync key**. No accounts, no
  sign-in. The same key on another device means the same data. **No key means the app
  runs fully local from `localStorage` — a complete mode, not a degraded one.**
  Per-document integer versions resolve conflicts (not timestamps, so clock skew can't
  corrupt anything). All inbound cloud data is Zod-validated and invalid documents are
  dropped rather than allowed to poison local state.
- **PWA** — installable, offline-capable, self-hosted fonts, service worker with
  auto-update.
- **Theme machinery** — light/dark/system switching, the preference synced. This phase
  ships **one** default theme through it; see `04-styling.md`.
- **`APP_VERSION`** in `src/version.ts`, shown in the app, plus the update prompt. Bump it
  whenever work ships — several devices run this as a PWA and can silently sit on an old
  build.
- **Sample data** on first run, so an empty install isn't a blank screen.

---

## New in this phase

### Search — build it

The current to-do side has no way to find a task by name. Everything else here is
parity work; this is the one genuine gap. A to-do app you actually live in needs it.

Scope it small: one input, matches title and notes, case-insensitive, results as a flat
list with each task's project shown. No operators, no saved searches, no fuzzy matching.

### Everything else the strip exposes

Removing the path is likely to reveal to-do-side rough edges that were previously hidden
behind it — empty states that were never written, keyboard handling that was never
finished, mobile layouts that were never checked. Fixing those is in scope. That is the
entire point of this phase.

---

## Out of scope — later phases, do not build

- **The path** — path mode, the day-as-route view, the week pattern builder, rest blocks,
  wildcard slots, drag-to-arrange, the path overview grid, day logs, the running total.
- **Momentum** — the whole layer.
- **Scenic mode.**
- **The neon-noir theme**, and the daylight "blossom" theme built as its counterpart.
- **Accounts, collaboration, sharing, notifications, calendar integration, natural-language
  date entry, attachments, time tracking.** None of these have been asked for.

---

## Product invariants — these outlive every phase

These are enforced, not aspirational. They constrain the to-do side too.

- **Nothing stores "missed."** Store what happened (`completedAt`); derive every other
  state at render time. A missed thing is a gap, never a verdict.
- **No streaks.** Rolling windows and running totals only. No consecutive-day counter, and
  no value a gap can reset.
- **No clinical or diagnostic language, and no blame-framed states, anywhere.** Not in
  copy, not in colour, not in an empty state.
- **Past days are immutable records.** Renaming a task changes the library and future
  scheduling, never history.
- **Absent values sort last, always.** An unprioritised task is not a P5 and an undated one
  is not overdue. The end of the list is the position that implies no judgement.
