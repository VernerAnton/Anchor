# Anchor — standing rules

> **Current phase: the to-do side, on default styling.** The full brief is in `handover/`.
> Read `handover/README.md` before starting work. The path view and the neon-noir theme are
> a later phase, removed from `src/` and preserved at the `path-v1` git tag — do not build
> toward them, and do not reintroduce them.

## Structure and styling are separate

Build structure and behaviour against a plain default theme. Any future theme is applied on
top and must be swappable without touching a single component.

- **Class names describe meaning, never appearance.** `.task-row`, `.task-row--done`,
  `.priority-flag`. Never `.red-card`, `.glow-border`, `.neon-text`. A class name that
  mentions a colour or an effect welds the theme to the structure.
- **No raw values outside the theme file.** Every colour, shadow, radius, font, border and
  spacing step goes through a CSS variable. Components reference `var(--surface-raised)`,
  never `#f4f4f5`. This includes translucent borders — half-opacity hex literals are
  exactly what leaks one theme into the next.
- **One file holds every variable, per theme.** There is one now: `tokens.css`. It is
  complete in itself. Adding a second theme means adding one file and nothing else, and no
  theme may depend on another theme's values.
- **No inline styles for appearance.** Inline is only for genuinely computed values — a
  progress bar's width, a proportional height.
- **Components render, they don't compute.** Status, ordering, grouping and every derived
  state come from pure functions that return data. A component receives `status: 'done'`
  and renders it. Two wildly different themes must be able to share every line of logic.
- **Semantic HTML.** Real `<button>`, `<ul>`, `<form>`, real labels. A restyle must never
  require markup changes.
- **Stylesheets are split per component**, mirroring `src/components/`. Never one large
  file — that is how the previous phase became expensive to work in.

**The test:** blank every theme file. The app must still be fully usable — ugly, but every
button clickable and every state distinguishable. **Run this for real at the end of every
phase, with a screenshot.** Theming that has never been exercised does not work.

**Colour meaning survives the theme, the hue does not.** The four state meanings — the
thing pulling you now, proof something happened, you may decline this, a date that has gone
by — are named for what they mean. A later theme re-expresses each at the same weight on
its own ground, rather than as a pale version of the same hue. A theme that keeps the
colour and loses the meaning has failed.

## Product invariants

These are enforced, not aspirational:

- **Nothing stores "missed."** Store what happened (`completedAt`) and derive every other
  state at render time. A missed thing is a gap, never a verdict.
- **No streaks.** Rolling windows and running totals only. No consecutive-day counter, and
  no value a gap can reset. A running total only ever goes up.
- **No clinical or diagnostic language. No blame-framed states, anywhere.** Not in copy,
  not in colour, not in an empty state. The app's attitude toward the user is never hostile.
- **Overdue is called "Earlier", is neutral in colour, and is never counted as a failure.**
- **Past days are immutable records.** Renaming a task changes the library and future
  scheduling, never history.
- **Absent values sort last.** An unprioritised task is not a P5; an undated one is not
  overdue. The end of a list is the position that implies no judgement.
- **Colour carries meaning, and identity is a separate axis.** Project and label colours
  are muted and say *which thing this is*; state colours say *what is happening*. The two
  must never be confusable on one row.
- **Rest is never completable.** It doesn't exist yet. When it does, enforce it in the type
  system — no status field, no `completedAt`, no shape that could acquire one. Build
  nothing now that would make that hard.

## Data rules

- **Every absent value is an explicit `null`, never an optional field.** Firestore rejects
  an entire write if any field is `undefined`, and `label?: string` is how one slips in.
- **Conflicts resolve on integer `version`, never timestamps** — immune to clock skew. Bump
  it synchronously, before any async work.
- **Cloud data is untrusted.** Zod-validate everything inbound; drop invalid documents with
  a warning rather than merging them.
- **`Task.firstMove`, `Task.type` and `Task.defaultDuration` are reserved for a later
  phase.** They stay on the type, nullable, with no UI, so that phase needs no migration
  across synced devices. Don't remove them; don't surface them.

## Build order

The strip, then the default theme, then finishing the to-do side, then search, then
hardening. `handover/06-build-order.md` has the detail. Don't start a phase before the
previous one is verified.

Desktop layout first, collapsing to mobile.

## Working style

- **Bump `APP_VERSION` in `src/version.ts` whenever work ships.** It's the number shown in
  the app, and the only way to tell at a glance whether a device is running the current
  build — several devices have this installed as a PWA and can silently sit on an old one.
- Don't ask permission for things already decided in `handover/`.
- When something genuinely needs a decision, ask once and record the answer in
  `design/scope-decisions.md` rather than asking again later.
- Verify with the real app, not by assertion. Screenshots at desktop and mobile widths.
- **If you find yourself choosing a colour or a visual motif, you have left this phase.**
- **If you find yourself building toward the path, stop** — including "just a small hook
  for later".
