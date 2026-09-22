# Build order

A suggestion, not a contract — you know what you want to build. But each phase ends with a
working, committed app rather than a half-built tree, and that part is worth keeping.

**Bump `APP_VERSION` whenever work ships.**

---

## Phase 1 — Skeleton

The shell and the data, with no features: app layout (sidebar / list / detail), the store
interface, a `Task` type, and the ability to add, complete and delete a task in memory.

Decide early whether you're going local-first or straight to Firestore. Either is fine —
but **write against a subscription-shaped store from the start** (`subscribeTasks(cb)`, all
callbacks async including the first), because retrofitting that later is the expensive
version. `mechanisms.md` explains why.

**Done when:** you can add a task, see it, complete it, and it survives a reload.

---

## Phase 2 — The core to-do app

Projects, the views you want, the detail panel, subtasks, priority, due dates.

Structure the logic as **pure functions returning data**, separate from components, from
the very first view. It costs nothing now and it's the thing that makes phase 5 cheap.

**Done when:** it's genuinely usable for simple task management.

---

## Phase 3 — The hard parts

Recurrence and labels. **This is where the archive earns its place** — take
`archive/src/lib/recurrence.ts` and its tests rather than rewriting them.

Then the reschedule trio, grouping and sorting.

**Done when:** a repeating task behaves correctly across completion, skipping and
rescheduling. Run the archived test suite against whatever you build.

---

## Phase 4 — Platform

Sync, PWA verification, light/dark, the update prompt, sample data.

Test sync on a real second device, not just two browser tabs. Test offline for real:
airplane mode, make changes, reconnect, confirm they land.

---

## Phase 5 — Make it good

The pass that the previous build never got: empty states, loading states, keyboard
handling, focus management, mobile ergonomics, error states. Plus search.

**Done when:** you can use it for a full day of real tasks without being annoyed by it.
Actually do that before calling it done.

---

## Phase 6 — Then, and only then

Custom visual identity. Then the path.

If the contract in `styling.md` held, the visual phase is one new token file. **That's the
test of whether this rebuild worked.**

---

## Working rules

- **Verify with the real app.** Screenshots at desktop and mobile widths. "Should work" is
  not verification.
- **Run the blank-theme test at the end of every phase**, with a screenshot.
- **Don't design.** Choosing a colour or a visual motif means you've left this phase.
- **Don't build toward the path** — including "just a small hook for later".
- **Ask once, record the answer**, don't re-ask later.
