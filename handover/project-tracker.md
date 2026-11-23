# Project tracker — a later phase

**Status: parked, by the owner's choice (2026-11).** Get the to-do app running and in daily
use first, through phase 5 and the full-day test. Then come back to this. Nothing here is
built yet, and nothing should be built toward it until it's picked up.

---

## The idea

A project tracker alongside the to-do lists and the path. Not a separate app and not a
second store: **a third lens over the same tasks and projects**, the way the path is a lens
over the library. Projects already exist as the "where does this belong" axis, so the
tracker reads what's already there.

## Where it goes in the order

After phase 5 (and the full-day test), **before the path**. The rebuild happened because a
second mode was built before the to-do side was finished; this note exists so the same thing
doesn't happen with a third.

## The tone rules decide its shape

Most project trackers are built from things `decisions.md` rules out. A tracker that fits
Anchor uses the app's own grammar instead.

| Typical tracker | Anchor's version |
|---|---|
| Red / amber / green status | No verdict colours. State colours say what's happening, never how badly |
| "Behind schedule", "at risk" | Never. A target date that has gone by is a date, like Earlier |
| % complete that drops when work is added | A running total of what got done — it only goes up |
| Overdue milestones | Milestones carry plain dates, neutral once passed |
| Burndown charts | Rolling windows ("done in the last 4 weeks"), no line to fall behind |

What it *can* show: what's open, what's next, what got done recently, an optional target
date, and notes on where the project stands, in the owner's words.

## Still to decide — ask when this is picked up

"Project tracker" covers several different things. The owner hasn't chosen yet; these were
offered:

1. **Project overview** — a page per project: next steps, recent progress, notes, optional
   target date. Smallest, and the most natural fit.
2. **Board** — To do / Doing / Done columns. Needs a new "in progress" state on tasks, which
   the model doesn't have.
3. **Milestones or timeline** — phases or dated checkpoints within a project.
4. **Goals** — long-running outcomes that several projects or tasks feed into.

Possibly a mix.

## The data question to settle early

Whichever is chosen may need new fields on `Project` — likely candidates: a description or
status note, an optional `targetDate`, a paused state, maybe milestones. Every new field must
be an explicit `null`, never optional (see `data-model.md`).

Adding fields to synced documents is cheap while the app holds nothing real and costs a
migration once it does. So **decide the fields before the owner starts relying on the app
daily**, even if the screens come much later. The schemas already tolerate absent fields
(`.catch()` defaults), so adding them later is possible — just less clean.

## What would carry over unchanged

- Projects, sub-projects, colours and archiving (phase 2)
- Labels as the cross-cutting axis (phase 3)
- Per-view sort and grouping stored in settings (phase 3)
- Sync, which already covers projects (phase 4)
