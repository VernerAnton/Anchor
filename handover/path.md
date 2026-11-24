# The path — the plan

**Decided with the owner, November 2026. This replaces the earlier path design** (weekly
pattern, four-week builder, day editor with drag between columns, wildcards, clock-driven
route — see `archive/design/scope-decisions.md` and `types/path.ts` in the archive). That
design is superseded, not deferred. Build this.

**Comes after phase 5.** Until phase 5 is done, CLAUDE.md's rule stands: don't build toward
the path.

---

## The idea

A path is a short ordered list of what you'll do, **built for one day** — today in the
morning, or tomorrow the night before — then **locked in** and **run one step at a time**.
It lasts until every step is done or you leave it, and it ends with that day. Nothing about
it repeats, and nothing carries over.

The shape comes from the owner's own daily use: the EXIT flow in `recovery-companion`
(build or pick steps → Lock in → one step at a time → "Where now?") worked well in practice.
That app was built independently; the overlap is coincidence, and a useful sign the shape is
right. Its *ideas* carry over; its code does not (its components carry Tailwind colour
classes, which breaks Anchor's styling contract).

It sits on top of the task library: ticking a step ticks the real task. The library and the
schedule stay separate, as `data-model.md` always intended.

---

## Decided

**Which day.** Build for today or for tomorrow. Building opens with that day's open tasks
(Today's list for today; tomorrow's due tasks for tomorrow), in the order you already
arranged them, so building is remove / add / reorder, not starting from blank. Daily
repeating tasks appear with no setup.

**Step kinds.**
- **Task step** — points at a task. Done ticks the task; a repeating task moves on as usual.
- **Typed step** — "Fill the water bottle". Exists only in this path; never added to the
  task list.
- **Rest step** — "Rest", "Shower, eat", with an **optional length**. With a length it shows
  a quiet countdown. **Never tickable**: you move past it with Continue, any time, countdown
  or not. Enforced in the type — a rest step has no done field and can't acquire one.

**First move.** A task can carry a `firstMove` ("Open the file and write one sentence"),
saved on the task so it's written once. The running step shows it large. A typed step is
already its own first move.

**Lock in.** Commits the path and records the moment. For today's path it starts the run;
for tomorrow's it's saved and runs tomorrow. The path can still be edited after locking —
it's your plan — but locking is the deliberate "decided" moment.

**Running — full screen, at every width,** like EXIT. The current step large, with its first
move and **Done** / **Not now**. Steps done recede; what's still ahead is listed small below.
**Leave the path** at any time; reopening the same day resumes where it was.

**Not now** moves on without recording anything about that step — a scheduling move, not a
verdict, like skipping a repeating task. The task stays in Today, untouched.

**The end.** When the last step is passed: an optional **What next?** offering the next open
task from Today, or simply "That's the path". Never pushed.

**Day rollover.** A path whose date has gone by becomes a read-only record. It is never
carried into the new day, and nothing shows what was left. The unfinished tasks are still in
Today as usual.

**Syncs.** The path is stored like everything else, so it can be built on the laptop at night
and run on the phone in the morning, and a reload mid-path lands on the same step.

**The record.** What happened, never what didn't: paths run and steps done, as a running
total that only goes up. No "3 of 5", no streaks, no left-over count anywhere.

---

## Left out — deliberately

- **Clock times.** EXIT has none and works. Times invite "you're behind", which this app is
  built to avoid. Can be added later as optional.
- **Saved presets / templates.** Only if rebuilding the same path daily turns out tedious;
  starting from the day's tasks mostly covers it.
- **Weekly patterns, the four-week overview, wildcards, drag between columns.** Not needed
  with a path built per day.
- **Anything like BREAK** from recovery-companion. Specific to that app.

---

## Data shape (to confirm when building — no user input needed)

```ts
// On Task — explicit null, never optional
firstMove: string | null;

// One document per date: users/{key}/v3-paths/{YYYY-MM-DD}
interface DayPath {
  date: string;                 // the day it's for
  steps: PathStep[];
  lockedAt: number | null;      // when it was locked in
  cursor: number;               // which step is current; steps.length = finished
  schemaVersion: number; version: number; updatedAt: number;
}

type PathStep =
  | { kind: 'task'; id: string; taskId: string; title: string; doneAt: number | null }
  | { kind: 'typed'; id: string; text: string; doneAt: number | null }
  | { kind: 'rest'; id: string; label: string | null; minutes: number | null }; // no doneAt, ever
```

- **`title` is a snapshot** taken when the step is added, so a past path still reads as it
  did that day after the task is renamed — past days are immutable records.
- **`cursor`, not a per-step "skipped" flag.** Not now advances the cursor and writes nothing
  about the step. Nothing stores "missed".
- **One document per date**, so tomorrow's path can be built while today's is running, and a
  past date's document is the record. Version-guarded and Zod-validated like every other
  document.
- Adding `firstMove` to tasks is a schema addition with a `.catch(null)` default — existing
  documents keep validating.

---

## Done when

- A path can be built for today and for tomorrow from that day's tasks, with typed and rest
  steps, reordered, and locked in.
- Running it on a phone: full screen, Done ticks the real task, Not now records nothing, rest
  counts down and can't be ticked, Leave and resume work, a reload lands on the same step.
- Built on one device, run on another (emulator test, as in phase 4).
- The day after, the path is a read-only record and nothing carries over.
- Blank-theme test passes on the run screen, with a screenshot.
