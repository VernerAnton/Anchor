# Features — a menu, not a checklist

The previous build had all of this working. That doesn't make any of it mandatory — **the
owner is choosing what this app should be.** Treat each entry as a proposal with its
reasoning attached, so it can be kept, cut or changed deliberately.

Marked **[core]** where cutting it would make the app not a to-do app; **[proposed]**
otherwise.

---

## Tasks

**[core] The basics** — create, complete, reopen, edit, delete. Delete behind an inline
confirm, not a modal.

**[core] Title, notes, due date.** Dates entered explicitly as `YYYY-MM-DD`, no
natural-language parsing. `null` is an ordinary backlog task, not a missing value.

**[core] One level of subtasks.** Not a tree. A task with a parent never has children.
Enough structure to break work down, not enough to become an outliner.

**[proposed] Priority, P1–P4.** Orders a backlog, where sorting is the actual job.
Pressing the current priority clears it.

**[proposed] Quick add** at the top of every list, which infers from context: a task added
in Today gets today's date, one added in a project gets that project.

---

## Organisation — two axes

**[core] Projects.** Where a task *belongs*. Exactly one per task. Nested one level, eight
muted colours, archived rather than deleted so history can still say where work came from.

**[proposed] Labels.** A cross-cutting second axis — what a task *needs from you*, where
you have to be, how much of you it takes. "Salesforce Admin" is a project; "quick win" and
"at the computer" are labels, and a task is both at once.

Labels are flat on purpose: projects nest because a body of work has parts, and a tag that
needs a parent is a project wearing the wrong hat.

Same palette as projects, different shape — a project is a filled dot, a label an outlined
chip. **Shape carries the axis, colour carries the item**, so a coloured circle never means
two different things on one line.

> Labels were one of the better ideas in the old build. The label view gathers tasks from
> across every project, which is the one thing a project tree can never do.

---

## Views

**[core] Today** — everything due on or before today, in two sections: **Earlier**
(overdue, on top) then **Today**.

> "Earlier", never "Overdue". Not red, not marked, not counted as a failure. See
> `decisions.md` — this one isn't stylistic, it's the product.

**[core] All tasks** — the library.

**[proposed] Upcoming** — everything after today, one section per date.

**[proposed] Per-project and per-label views**, plus a **Labels screen** for renaming and
reordering in place.

**[proposed] A completed block** at the end of each list — collapsed, newest first.

---

## Arranging

**[proposed] Sorting** — default (smart) / priority / due date / name / manual, plus a
reverse toggle. Worth having in every list.

**[proposed] Grouping** — none / project / label. Only earns its place where the list isn't
already cut along that axis: not on Upcoming (already one section per date), not inside a
single project's list.

**[proposed] Stored per view, and synced.** Today and All tasks have different jobs — one
is "what am I doing now", the other is the library. Grouping the library by project while
sorting today by priority is an ordinary thing to want, not an inconsistency to iron out.

---

## Recurrence

**[proposed, but it's the app's best feature]** A full rules engine, no natural language:

- daily; weekly by weekday set; monthly by date (several dates allowed); monthly by weekday
  ("third Tuesday", "last Friday"); yearly by date; yearly by weekday
- intervals — every N days/weeks/months/years — with an anchor giving the phase
- `grid` (stays on the calendar) vs `fromCompletion` (follows you)
- bounds: `until` a date, or `remaining` occurrences
- a live plain-language preview of the next few dates

**It already exists and it's tested** — see `mechanisms.md`. Building this from scratch is
the single biggest avoidable cost in the project.

**[proposed] The reschedule trio** — Tomorrow / In a week / Next occurrence, each labelled
with the date it lands on. Moving a task is the commonest edit a task ever gets, and a date
picker charges three decisions for something you already knew.

---

## Search

**[proposed — and it's the one thing the old build never had]** One input, matching title
and notes, case-insensitive, flat results with each task's project shown.

Keep it small: no operators, no saved searches, no fuzzy matching. But a to-do app you
actually live in needs to be able to find things.

---

## Platform

**[proposed] Cloud sync** via sync key — no accounts, no sign-in, same key on another
device means the same data. Fully local with no key, as a complete mode.

**[proposed] PWA** — installable, offline. Already configured; the owner has it installed
on several devices.

**[proposed] Light / dark / follow-the-system**, the preference synced.

**[core] `APP_VERSION` visible in the app, and an update prompt that offers a reload.**

With an installed PWA you cannot otherwise tell whether a device is on the current build —
and worse, a resumed app can sit on an old one for days without a hint. The prompt notices
when a newer build has taken over and offers **Reload** or **Later**, naming the version
you're currently on.

Offered, never forced: a reload you didn't ask for throws away whatever you were half-way
through typing. Declining costs nothing — the offer returns on the next check.

`mechanisms.md` has the detail, including the one-line mistake that turns this from an
offer into a silent reload that eats input.

**[proposed] Sample data on first run**, so an empty install isn't a blank screen.

---

## Things worth doing that the old build skimped on

The previous app was a foundation with a path bolted on, so these never got proper
attention. They're what separates "works" from "good":

- **Empty states** — every view needs one, written, not blank
- **Loading states** — the store is subscription-based and always resolves async
- **Keyboard** — Enter to add, Escape to close, arrows through the list, a shortcut to
  quick-add from anywhere
- **Focus management** when panels open and close
- **Mobile ergonomics** — tap targets, the drawer, a clear way to dismiss an overlay
- **Error states** when a write fails

---

## Deliberately excluded

Not oversights — decided against:

- **The path**, momentum, scenic mode — later phases
- **Streaks, or any value a gap can reset.** Rolling windows and running totals only
- **Accounts, collaboration, sharing, notifications, calendar sync, attachments, time
  tracking** — none have been asked for
- **Natural-language date entry** — the explicit rule editor is the deliberate alternative
