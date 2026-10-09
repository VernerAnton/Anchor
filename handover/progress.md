# Progress

What has shipped, phase by phase, and the decisions made along the way that the next
session shouldn't have to rediscover. Scope itself is in `scope-chosen.md`.

---

## Phase 1 — Skeleton (V27)

**Shipped:** the three-column shell (sidebar / list / detail), collapsing below 60rem
to a drawer and a full-screen detail overlay. One view, All tasks, with quick add,
complete/reopen, a collapsed Completed block, and delete behind an inline confirm.
Tasks persist in `localStorage` behind the subscription-shaped repository.

**Where things are:**

- `src/types/task.ts` — the full `Task` shape for the chosen scope, recurrence included
  (the engine comes in phase 3; the stored shape is fixed now).
- `src/store/` — `repository.ts` (interface), `localRepository.ts`, `schemas.ts` (Zod),
  `mutations.ts` (pure, version bumped synchronously), `actions.ts` (mutation + save —
  write handlers live here, not in App).
- `src/lib/views.ts` — every derived state, as data. Components render, they don't compute.
- `src/styles/` — `tokens.css`, `base.css`, `layout.css`, one file per component.
- `src/styles/contract.test.ts` — fails if a raw colour or shadow appears outside
  `tokens.css`, or if a token rule isn't keyed off `data-theme`.

**Decisions made:**

- **Storage namespace is `v3`** (`anchor:v3:*`, `users/{id}/v3-tasks`). Devices that ran
  the previous build hold `v2` documents with path fields and old samples; the owner
  confirmed nothing needs keeping, so this build starts clean rather than inheriting them.
- **The blank-theme test is `?theme=none`.** It sets `data-theme="none"`, which no rule in
  `tokens.css` matches — equivalent to emptying the file, and the contract test keeps it
  that way.
- **Column widths are layout literals, not tokens.** The first blank-theme run caught
  this: with widths in the token file, no theme meant no columns, and the sticky sidebar
  sat on top of the list swallowing clicks. A theme restyles; it doesn't re-lay-out.
- **Border and outline *styles* are set in components; widths and colours are tokens.**
  With no theme, buttons and focus rings fall back to the browser's default width in the
  text colour — ugly, but every button has an edge and focus is always visible.
- **Overlays fall back to the `Canvas` system colour** (`var(--surface-overlay, Canvas)`),
  so the drawer and mobile detail stay opaque with no theme. System colours belong to the
  browser, not to a theme. Used only where blank would otherwise be unusable.
- **Focus moves after React commits** (`useFocusAfterRender`), never on a timer. Closing
  the drawer returns to Menu; closing a task returns to its row; completing a row from the
  keyboard moves to the row that takes its place; reopening follows the row.
- **Compact sizing keys off `(pointer: fine)`, not width.** Touch gets 44px targets
  whatever the screen size.

**Not yet:** the service worker isn't registered by `src/` (the archive did it in
`useAppUpdate`); that and the update prompt are phase 4. Installed devices still pick up
new builds through the browser's own `sw.js` update check.

---

## Phase 2 — The core to-do app (V28)

**Shipped:** projects (one level of nesting, eight identity colours, archive/unarchive,
inline editor above the project's own list), and the views Today (Earlier / Today),
Upcoming (one section per date), All tasks and per-project — each with a Completed block.
The detail panel edits everything in place: title, done/reopen, due date, priority,
project, notes, subtasks, delete. Quick add infers its context. Sidebar counts.

**Where things are:**

- `src/lib/views.ts` — `buildList` (sections, rows, completed, empty text, quick-add
  context), `taskDetail`, `countFor`. Rows arrive with every meta decision made.
- `src/lib/projects.ts`, `src/lib/sidebar.ts`, `src/lib/selection.ts`,
  `src/lib/dateLabels.ts`, `src/lib/sorting.ts` — all pure.
- `src/store/actions.ts` — every write, including multi-document ones (re-filing a task
  with its subtasks, deleting a task with its subtasks, archiving a project with its
  sub-projects).

**Decisions made:**

- **Views live in the URL hash** (`#today`, `#upcoming`, `#all`, `#project/<id>`), so
  reload and Back keep your place. An unknown project falls back to Today without leaving
  a history entry.
- **Quick add in Upcoming lands on tomorrow**, and every quick add's placeholder says
  where the task will go ("Add a task for today", "Add a task to Home"). A task that
  vanished from the list it was typed into would read as a failed press.
- **A subtask has no project of its own**; it follows its parent, and re-filing the
  parent moves its subtasks. The panel says so instead of offering a choice.
- **In Today and Upcoming, an undated subtask follows its parent's date.** A subtask sits
  nested when its parent is in the same section; otherwise it stands alone with
  "Part of …". Nothing is shown twice, nothing is lost.
- **Completing a parent doesn't complete its subtasks.** Nothing records an event that
  didn't happen; open subtasks of a done parent stay listed, saying whose they are.
- **A project's list includes its sub-projects' tasks**, each under its own heading.
- **Projects archive; deletion is offered only for a project nothing was ever filed
  under.** Archiving a parent archives its sub-projects too.
- **Priority's current value is stated in words** under the buttons ("Press P1 again to
  clear it."), so it reads with no theme. Pressing the current one clears it.
- **Text fields save on blur and on the way out** — closing the panel mid-edit with
  Escape still saves what was typed.
- **Hover styles only apply on devices that hover** (`@media (hover: hover)`); on touch
  they stuck after a tap.
- **Dates:** rows say "Today", "Tomorrow" or "Wed 23 Sep"; headings "Tomorrow · Saturday
  3 Oct" or "Monday · 5 Oct". The year appears only when it isn't this one. A date that
  has gone by is written exactly like any other and styled with the neutral
  `--state-past`.

---

## Phase 3 — The hard parts (V29)

**Shipped:** repeating tasks (the archived engine, unchanged, with its 537-line test suite
passing as-is), a rebuilt rule editor with the rule read back as a sentence plus the next
four dates, the reschedule trio, labels (picker, label views, a Labels screen, sidebar
section, row chips), sorting (Default / Priority / Due date / Name / Manual, plus Reverse),
grouping (None / Project / Label on Today and All tasks), per-view options in a synced
settings document, and manual reordering by drag or by arrow keys.

**Where things are:**

- `src/lib/recurrence.ts`, `src/lib/reschedule.ts`, `src/lib/labelSearch.ts` — lifted
  from the archive with their tests.
- `src/lib/sorting.ts`, `src/lib/grouping.ts`, `src/lib/reorder.ts` — pure, tested.
- `src/types/settings.ts` — `Settings`, `ViewOptions`. Stored at `v3-settings/app`.
- `src/components/TaskRows.tsx` — rows plus the drag/keyboard reordering; the only DOM
  geometry in the app lives here. What to write is `reorderPlan`'s decision.

**Decisions made:**

- **Completing a repeating task says where it went, with Undo.** Its tick undoes itself on
  screen as it moves to the next date, which would otherwise read as a press that did
  nothing. Undo writes the old document back with a *higher* version, so every device takes
  it as newest.
- **A rule set on a task with no date gives it its first occurrence** (today if the rule
  falls today). A rule that never put the task on a day would be a rule in name only.
- **Every choice in the rule editor is a native checkbox, radio or select**, not a pressed
  button, so the selected days read with no theme. The archived editor used `aria-pressed`
  buttons, which are indistinguishable when the theme is blank.
- **The current reschedule option is marked in words** ("· current") as well as styled.
- **Labels are deleted, not archived.** Deleting takes the label off every task first (one
  write per task), behind an inline confirm. The `archived` field stays on the model.
- **A label's view adds that label to tasks added there**, and its placeholder says so.
- **Grouping isn't offered on Upcoming, a project, or a label** — each is already cut along
  that axis. Today's Earlier stays on top, ungrouped, whatever the grouping.
- **Sidebar counts ignore grouping**, so a task with two labels is never counted twice.
- **Manual moves write one task** — it takes a value halfway between its new neighbours —
  and renumber the list only when neighbours have collided. Drag uses pointer events
  (mouse, pen and touch alike); the handle also takes ArrowUp/ArrowDown.
- **Reverse is a checkbox**, not a toggle button, for the same no-theme reason.

**Open question for the owner:** when a repeating task with subtasks moves to its next
date, its subtasks currently stay as they were (done ones stay done). Resetting them for
each occurrence is the common expectation, but it means clearing their `completedAt`.
Not changed without asking.
