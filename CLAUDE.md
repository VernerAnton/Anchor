# Anchor — standing rules

## Structure and styling are separate

Build structure and behaviour in a plain default theme. The neon-noir cyberpunk theme is
applied on top and must be swappable without touching a single component.

- **Class names describe meaning, never appearance.** `.task-row`, `.point--live`,
  `.point--passed`. Never `.red-card`, `.glow-border`, `.neon-text`. A class name that
  mentions a colour or an effect welds the theme to the structure.
- **No raw values outside the theme file.** Every colour, shadow, radius, font, border and
  spacing goes through a CSS variable. Components reference `var(--surface-raised)`, never
  `#0a1b25`. This includes glows and translucent borders — half-opacity hex literals are
  exactly what leaks an old theme into a new one.
- **One file holds every variable.** Swapping themes means swapping that file and nothing
  else.
- **No inline styles for appearance.** Inline is only for genuinely computed values — a
  progress bar's width, a segment's proportional height.
- **Components render, they don't compute.** Status, ordering, grouping and every derived
  state come from pure functions that return data. A component receives `status: 'live'` and
  renders it. Two wildly different themes must be able to share every line of logic.
- **Semantic HTML.** Real `<button>`, `<ul>`, `<form>`, real labels. A restyle must never
  require markup changes.

**The test:** delete the theme file. The app must still be fully usable — ugly, but every
button clickable and every state distinguishable. Run this test for real, occasionally.
Theming that has never been exercised does not work.

## Product invariants

These are enforced, not aspirational:

- **Rest is never completable.** Enforce in the type system — no status field, no
  `completedAt`, no shape of the model that could acquire one.
- **Nothing stores "missed."** Store what happened (`startedAt`, `completedAt`) and derive
  every other state at render time. A missed thing is a gap, never a verdict.
- **No streaks.** Rolling windows and running totals only. No consecutive-day counter, and
  no value a gap can reset. A running total only ever goes up.
- **No clinical or diagnostic language. No blame-framed states, anywhere.** The aesthetic may
  look hostile; the app's attitude toward the user never is.
- **Past days are immutable records.** Renaming a task changes the library and future
  scheduling, never history.
- **Colour carries meaning.** Ember = the thing pulling you now. Acid = proof something
  happened. Cyan = optional, you may decline this. Slate = neutral missed state, never red.
  Project colours are a separate muted axis: neon means state, muted means identity.

## Build order

Task manager first. Views second. Path mechanics third. Scenic mode last.

Desktop layout first, collapsing to mobile — except the path view itself, which stays narrow
because a timeline doesn't improve by being stretched.

## Working style

- **Bump `APP_VERSION` in `src/version.ts` whenever work ships.** It's the number shown in
  the app, and the only way to tell at a glance whether a device is running the current
  build — several devices have this installed as a PWA and can silently sit on an old one.
- Don't ask permission for things already decided in the handover.
- When something genuinely needs a decision, ask once and record the answer in
  `design/scope-decisions.md` rather than asking again later.
- Verify with the real app, not by assertion. Screenshots at desktop and mobile widths.
