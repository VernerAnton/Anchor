# Scope chosen for the to-do app

Decided with the owner on 2026-10-02, walking through `features.md` item by item. This is
the answer to "what are we building" — don't re-ask it. If something here turns out wrong
in practice, change it deliberately and note the change below.

---

## In

Everything in `features.md`, core and proposed:

**Tasks** — the core basics (create, complete, reopen, edit, delete with inline confirm;
title, notes, explicit `YYYY-MM-DD` due date; one level of subtasks), plus:
- Priority P1–P4
- Context-aware quick add at the top of every list

**Organisation** — projects (core), plus labels.

**Views** — Today (Earlier / Today) and All tasks (core), plus:
- Upcoming
- Per-project and per-label views, and a Labels screen for in-place rename/reorder
- Completed block at the end of each list, collapsed, newest first

**Arranging** — sorting (smart / priority / due date / name / manual, plus reverse) and
grouping (none / project / label), stored per view and synced.

**Recurrence** — the full rules engine, lifted from `archive/src/lib/recurrence.ts` with
its tests; a new editor with a live plain-language preview. Plus the reschedule trio
(Tomorrow / In a week / Next occurrence, each naming its date).

**Search** — one input, title and notes, case-insensitive, flat results showing project.

**Platform** — cloud sync via sync key, light / dark / system (synced), sample data on
first run (with sample labels added), PWA, visible `APP_VERSION`.

**The quality pass** — empty, loading and error states; keyboard; focus management;
mobile ergonomics. Treated as part of building each thing, not an optional extra.

## How

- **Sync arrives in phase 4.** Phases 1–3 run local-only on `localStorage`, behind a
  subscription-shaped repository (`subscribeTasks(cb)`, callbacks always async including
  the first), so the archived Firestore backend plugs in behind the same interface.
- **Manual sort: drag plus keyboard move.** Drag on desktop and touch, with move up/down
  as the keyboard-accessible fallback.

## Out

Unchanged from `features.md` "Deliberately excluded": the path and anything path-shaped,
streaks, accounts/collaboration/sharing/notifications/calendar sync/attachments/time
tracking, natural-language dates.

## How this was settled

The completed block and the reschedule trio were first left out, then brought back in when
the gaps they leave were put to the owner — where a finished task goes to be reopened, and
how to skip one occurrence of a recurring task. Both are in.
