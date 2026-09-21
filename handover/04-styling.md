# Styling — the default theme, and the contract that makes it swappable

This is the file that exists because of what went wrong last time. Read it properly.

---

## The problem being solved

The previous phase built a 3,000-line stylesheet expressing a specific neon-noir
atmosphere, and then every to-do-side change had to be made *through* it. Moving a
checkbox meant reasoning about glow, scanlines and a custom type scale. Feature work
slowed to a crawl because the visual system was in the way of it.

So: **this phase ships one plain theme, and the app must be provably able to have it
replaced.** Not "designed to be swappable" — *demonstrated* to be.

---

## What "default but good looking" means here

Aim for the quiet competence of a well-made system app. Specifically:

- **Neutral greys, one accent.** No brand, no atmosphere, no personality.
- **A real type scale** — four or five sizes, not fourteen ad-hoc ones.
- **A real spacing rhythm** — a 4px base, used consistently.
- **Generous line height and comfortable density.** A task list is read all day.
- **Flat.** Hairline borders and one subtle shadow for genuinely floating things
  (the mobile detail overlay, the drawer). No gradients, no glow, no texture.
- **Light and dark**, both first-class, through the existing theme machinery.
- **Visible focus rings on everything.** Not decoration — the blank-theme test below
  depends on interactive things being reachable.

Aim for "a colleague would call this clean", not "a colleague would call this striking".
Striking is a later phase and it is not your job.

---

## The contract

These rules are already in the repo's `CLAUDE.md` and they carry forward unchanged. They
are the reason a future theme is one file rather than a rewrite.

### 1. Class names describe meaning, never appearance

`.task-row`, `.task-row--done`, `.priority-flag`, `.meta-due`. Never `.red-card`,
`.glow-border`, `.neon-text`, `.big-shadow`. **A class name that mentions a colour or an
effect welds the theme to the structure.**

### 2. No raw values outside the token file

Every colour, shadow, radius, font, border, spacing step and transition goes through a CSS
variable. Components reference `var(--surface-raised)`, never `#f4f4f5`.

**This includes translucent borders and half-opacity hex literals** — `#ffffff22` in a
component is exactly what leaks one theme into the next. If you need a translucent value,
it is a token.

### 3. One file holds every variable, per theme

`src/styles/tokens.css` holds the default theme and is **complete in itself**. Adding a
second theme later means adding one file, defining the same token names, and nothing else.
No theme may depend on another theme's values.

### 4. No inline styles for appearance

Inline styles are for genuinely computed values only — a progress bar's width, a
proportional height. Never for colour, spacing or borders.

### 5. Components render, they don't compute

Status, ordering, grouping and every derived state come from pure functions that return
data. A component receives `status: 'done'` and renders it. It never works out *whether*
something is done. This is what lets two wildly different themes share every line of logic
— and it's already how `src/lib/` is written. Keep it that way.

### 6. Semantic HTML

Real `<button>`, `<ul>`, `<form>`, real `<label>`s, real `<details>`. A restyle must never
require a markup change. This is also most of your accessibility for free.

---

## The test — run it for real

**Blank every theme file. The app must still be fully usable.** Ugly, but:

- every button clickable and obviously a button
- every state distinguishable without colour
- every form field labelled
- nothing overlapping, nothing invisible, nothing trapped off-screen

Run this at the end of each build phase in `06-build-order.md`, with a screenshot. Not as
an assertion — actually empty the file and look at it. **Theming that has never been
exercised does not work.** Last phase's theming was never exercised.

A good trick: keep a `?theme=none` escape hatch or a one-line comment toggle at the top of
`tokens.css` so the test takes ten seconds and therefore actually gets run.

---

## Token inventory

The default theme must define at least these. Names describe **role**, so a later theme
redefines values without renaming anything.

### Surfaces and text
```
--surface-page        the app background
--surface-raised      panels, rows, cards
--surface-sunken      inputs, wells
--surface-overlay     drawer and mobile detail panel
--text-primary        titles, body
--text-secondary      meta, labels
--text-muted          placeholders, disabled
--text-on-accent
```

### Structure
```
--border-subtle       hairlines between rows
--border-strong       input outlines, focused containers
--focus-ring          the visible focus outline
--shadow-overlay      the one shadow, for genuinely floating surfaces
--radius-sm / --radius-md / --radius-lg
--space-1 … --space-8         (4px base)
--font-sans / --font-mono
--text-xs … --text-xl         (a four-or-five step scale)
--leading-tight / --leading-normal
--transition-fast
```

### Meaning colours

Anchor has four state meanings. They are currently expressed as ember/acid/cyan/slate;
in the default theme they are quiet and neutral, but **the meanings must stay
distinguishable** because a later theme re-expresses these same four roles.

```
--state-now           the thing pulling you now
--state-done          proof something happened
--state-optional      you may decline this
--state-past          a date that has gone by — NEUTRAL, never red
```

`--state-past` being neutral is a product rule, not a style choice. See `03-decisions.md`.

### Identity colours
```
--project-steel, --project-violet, --project-teal, --project-sage,
--project-ochre, --project-plum, --project-indigo, --project-clay
```

Muted, mutually distinguishable, and distinguishable in both light and dark. **Neon means
state, muted means identity** — the two axes must never be confusable on one row.

### Priority
```
--priority-1 … --priority-4
```
A single hue at four weights is fine and probably best. Priority must also be readable
without colour, since the row shows "P1"–"P4" as text.

---

## Structure of the stylesheet

Do **not** produce another single 3,000-line file. Split by component, mirroring `src/`:

```
src/styles/
  tokens.css        every variable, one theme, complete
  base.css          reset, element defaults, typography
  layout.css        app shell, sidebar, panel, responsive breakpoints
  components/
    task-row.css
    task-list.css
    detail-panel.css
    sidebar.css
    label-picker.css
    recurrence-editor.css
    ...
```

A file per component means a change is findable, and a component that gets rebuilt takes
its styles with it.

---

## Layout

**Desktop first, collapsing to mobile.** Three columns at wide widths — sidebar, task
list, detail panel. Below the breakpoint the sidebar becomes a drawer and the detail panel
an overlay. This already works in the current build; preserve the behaviour.

Verify both widths with real screenshots at the end of every phase.
