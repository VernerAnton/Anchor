# Anchor — To-Do First: handover pack

**Hand this whole folder to a fresh chat. Start with this file.**

---

## The one paragraph

Anchor is a task manager. Its eventual signature feature is **the path** — a day rendered
as a route rather than a list — but the path is a *lens over a task library*, and the
library is not finished. A previous phase built the path UI and a heavy neon-noir theme
before the to-do side was complete, which made every small to-do change expensive: a
custom visual system and a second mode had to be reasoned about before a checkbox could
move. **This phase corrects that.** Build a genuinely complete, genuinely good to-do app,
on plain default styling, in this repo. Nothing else.

## What you are building

A to-do app that could stand on its own against Todoist or Things, with:

- Today / Upcoming / All tasks / per-project / per-label views
- Projects (nested one level), labels (flat, cross-cutting)
- A full recurrence engine
- Grouping, sorting, rescheduling
- Optional cloud sync, offline PWA, light/dark

Plain, clean, readable default styling. Not unstyled — a real type scale, real spacing,
neutral colours, something you'd be happy using daily. But **nothing custom, nothing
branded, nothing atmospheric.**

## What you are explicitly NOT building

- **The path view**, in any form — no path mode, no route, no day timeline, no rest
  blocks, no wildcards, no momentum, no scenic mode.
- **The neon-noir cyberpunk theme**, or any successor to it.
- Any UI whose purpose is to look like something rather than to do something.

These come back later, as phases on top of this work. They are not deleted from the
project's future — they are deleted from *this* phase's scope, and from `src/`, so that
they cannot quietly reassert themselves in day-to-day work.

## Reading order

| File | What it answers |
|---|---|
| `01-scope.md` | Every feature to build, and what's deliberately absent |
| `02-data-model.md` | The types, and the invariants they enforce |
| `03-decisions.md` | Product decisions already settled — do not relitigate |
| `04-styling.md` | The default-theme brief and the swappability contract |
| `05-repo-surgery.md` | Exactly which files go, stay, or get rewritten |
| `06-build-order.md` | The phases, and how each one is verified |
| `CLAUDE.md` | Replacement standing rules — **copy to the repo root first** |

## The first thing to do

1. Read all of the above.
2. Copy `handover/CLAUDE.md` over the repo's root `CLAUDE.md`. The existing one is
   written for the path-and-neon phase and will actively mislead you.
3. Work `05-repo-surgery.md` — take the path UI and the neon theme out of `src/`.
4. Confirm the app still builds, tests still pass, and the to-do side still works.
5. Then start `06-build-order.md`.

## Ground rules for this phase

- **This is the real Anchor, in the real repo.** Same name, same product, same git
  history, same Vercel project, same installed PWA. Nothing here is a prototype or a
  throwaway, and there is no second app.
- **The path work is not lost.** It is tagged and described in `05-repo-surgery.md`,
  recoverable in full when its phase begins.
- **Don't design.** If you find yourself choosing a colour, you have left this phase.
  Use the tokens in `04-styling.md` and move on.
- **Don't rebuild what works.** The logic layer and the sync layer are tested and
  correct. `05-repo-surgery.md` says what to keep.
- **Verify in the real app**, at desktop and mobile widths, not by assertion.
