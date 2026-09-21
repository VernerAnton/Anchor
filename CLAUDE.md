# Anchor — standing rules

> **Current phase: building the to-do app, from scratch, on default styling.**
> Read `handover/README.md` before starting work.
>
> `src/` was cleared deliberately. The previous implementation is in `archive/` as a parts
> bin — excluded from the build, there to copy from, not to restore.
>
> **The path view and any custom visual identity are later phases.** Don't build toward
> them.

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
- **One file holds every variable, per theme.** `src/styles/tokens.css`, complete in
  itself. Adding a second theme means adding one file and nothing else, and no theme may
  depend on another theme's values.
- **No inline styles for appearance.** Inline is only for genuinely computed values.
- **Components render, they don't compute.** Status, ordering, grouping and every derived
  state come from pure functions that return data. A component receives `status: 'done'`
  and renders it. Two wildly different themes must share every line of logic.
- **Semantic HTML.** Real `<button>`, `<ul>`, `<form>`, real labels. A restyle must never
  require markup changes.
- **Stylesheets split per component.** Never one file that grows to own the whole app —
  that is how the previous attempt became expensive to work in (3,051 lines).

**The test:** blank every theme file. The app must still be fully usable — ugly, but every
button clickable and every state distinguishable. **Run this for real at the end of every
phase, with a screenshot.** Theming that has never been exercised does not work, and the
previous attempt's never was.

## Product invariants

Enforced, not aspirational:

- **"Earlier", never "Overdue".** Dates that have gone by are neutral — not red, not
  badged, not counted as a failure. This is the most important rule in the app and it is
  not stylistic.
- **Nothing stores "missed."** Store what happened (`completedAt`) and derive every other
  state at render time. A missed thing is a gap, never a verdict.
- **No streaks.** Rolling windows and running totals only. No consecutive-day counter, and
  no value a gap can reset. A running total only ever goes up.
- **No clinical or diagnostic language. No blame-framed states, anywhere.** The app's
  attitude toward the user is never hostile.
- **Past days are immutable records.** Renaming a task changes the library and future
  scheduling, never history.
- **Absent values sort last.** An unprioritised task is not a P5; an undated one is not
  overdue. The end of a list implies no judgement. Reversing brings them to the front, and
  that is correct.
- **Colour carries meaning; identity is a separate axis.** State colours say what is
  happening, project and label colours say which thing this is. Never confusable on one row.
- **Rest is never completable.** It doesn't exist yet. When it does, enforce it in the type
  system. Build nothing now that would make that hard.

## Data rules

- **Every absent value is an explicit `null`, never an optional field.** Firestore rejects
  an entire write if any field is `undefined`, and `notes?: string` is how one slips in.
- **Conflicts resolve on integer `version`, never timestamps** — immune to clock skew. Bump
  it synchronously, before any async work.
- **Cloud data is untrusted.** Zod-validate everything inbound; drop invalid documents with
  a warning rather than merging them.
- **Write against a subscription-shaped store** (`subscribeTasks(cb)`, callbacks always
  async including the first), even while local-only. Retrofitting it later is expensive.

## Working style

- **Bump `APP_VERSION` in `src/version.ts` whenever work ships.** It's shown in the app and
  it's the only way to tell at a glance whether a device is on the current build — several
  devices have this installed as a PWA and can silently sit on an old one.
- Don't ask permission for things already decided in `handover/`.
- When something genuinely needs a decision, ask once and record the answer rather than
  asking again later.
- Verify with the real app, not by assertion. Screenshots at desktop and mobile widths.
- Desktop layout first, collapsing to mobile.
- **If you find yourself choosing a colour or a visual motif, you have left this phase.**
- **If you find yourself building toward the path, stop** — including "just a small hook
  for later".
