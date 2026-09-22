# Styling — the default theme, and the contract that makes it replaceable

This file exists because of exactly what went wrong last time. Read it properly.

---

## The problem being solved

The previous attempt built a 3,051-line stylesheet expressing a specific neon-noir
atmosphere, and then every to-do change had to be made *through* it. Moving a checkbox
meant reasoning about glow, scanlines and a custom type scale. Feature work slowed to a
crawl because the visual system was in the way of it.

The theme was also never actually tested as a theme — it was welded to the markup, so
"swap it later" was a hope, not a property of the code.

**So: this phase ships one plain theme, and the app must be provably able to have it
replaced.** Not "designed to be swappable" — *demonstrated* to be, repeatedly, by running
the test below.

---

## What "default but good looking" means

Aim for the quiet competence of a well-made system app:

- **Neutral greys, one accent.** No brand, no atmosphere, no personality.
- **A real type scale** — four or five sizes, not fourteen ad-hoc ones.
- **A real spacing rhythm** — a 4px base, used consistently.
- **Generous line height, comfortable density.** A task list is read all day.
- **Flat.** Hairline borders, and one subtle shadow for genuinely floating things (the
  mobile drawer, the detail overlay). No gradients, no glow, no texture.
- **System font stack.** The archived build self-hosted three families; a system stack
  looks right everywhere and removes a network dependency from an offline-capable app.
- **Light and dark, both first-class.**
- **Visible focus rings on everything.** Not decoration — the test below depends on
  interactive things being reachable.

Aim for "a colleague would call this clean", not "a colleague would call this striking".
Striking is a later phase and it is not your job.

---

## The contract

### 1. Class names describe meaning, never appearance

`.task-row`, `.task-row--done`, `.priority-flag`, `.meta-due`. Never `.red-card`,
`.glow-border`, `.neon-text`, `.big-shadow`. **A class name that mentions a colour or an
effect welds the theme to the structure.**

### 2. No raw values outside the token file

Every colour, shadow, radius, font, border, spacing step and transition goes through a CSS
variable. Components reference `var(--surface-raised)`, never `#f4f4f5`.

**This includes translucent borders and half-opacity hex literals.** A `#ffffff22` sitting
in a component is precisely what leaks one theme into the next. If you need a translucent
value, it is a token.

### 3. One file holds every variable, per theme

`src/styles/tokens.css` holds the default theme and is **complete in itself**. Adding a
second theme later means adding one file that defines the same token names, and changing
nothing else. No theme may reference another theme's values.

### 4. No inline styles for appearance

Inline is for genuinely computed values only — a progress bar's width, a proportional
height. Never colour, spacing or borders.

### 5. Components render, they don't compute

A component receives `status: 'done'` and renders it. It never derives that. Two wildly
different themes must be able to share every line of logic.

### 6. Semantic HTML

A restyle must never require a markup change.

---

## The test — and actually run it

**Blank every theme file. The app must still be fully usable.** Ugly, but:

- every button clickable and obviously a button
- every state distinguishable without colour
- every form field labelled
- nothing overlapping, invisible, or trapped off-screen

Run it at the end of every phase, with a screenshot. Not as an assertion — actually empty
the file and look.

**Make it a one-liner so it actually gets run.** A `?theme=none` query param, or a
commented-out import at the top of `main.tsx`. Theming that has never been exercised does
not work, and the last attempt's never was.

---

## Token inventory

Names describe **role**, so a later theme redefines values without renaming anything.

### Surfaces and text
```
--surface-page        the app background
--surface-raised      panels, rows, cards
--surface-sunken      inputs, wells
--surface-overlay     drawer and mobile detail panel
--text-primary        titles, body
--text-secondary      meta
--text-muted          placeholders, disabled
--text-on-accent
```

### Structure
```
--accent, --accent-hover
--border-subtle       hairlines between rows
--border-strong       input outlines
--focus-ring
--shadow-overlay      the one shadow
--radius-sm / --radius-md / --radius-lg
--space-1 … --space-8          (4px base)
--font-sans / --font-mono
--text-xs … --text-xl          (four or five steps)
--leading-tight / --leading-normal
--transition-fast
```

### Meaning
```
--state-now           the thing pulling you now
--state-done          proof something happened
--state-optional      you may decline this
--state-past          a date that has gone by — NEUTRAL, never red
```

Quiet and neutral in this theme, but **kept distinguishable**, because a later theme
re-expresses these same four roles at full strength. `--state-past` being neutral is a
product rule, not a style choice — see `decisions.md`.

### Identity
```
--project-steel, --project-violet, --project-teal, --project-sage,
--project-ochre, --project-plum, --project-indigo, --project-clay
```

Muted, mutually distinguishable, and distinguishable in both light and dark.

### Priority
```
--priority-1 … --priority-4
```
One hue at four weights is fine and probably best. Priority must also read without colour,
since the row shows "P1"–"P4" as text.

---

## Structure of the stylesheet

**Do not produce another single enormous file.** Split by component, mirroring `src/`:

```
src/styles/
  tokens.css        every variable, one theme, complete
  base.css          reset, element defaults, typography
  layout.css        app shell, sidebar, panel, breakpoints
  components/
    task-row.css
    task-list.css
    detail-panel.css
    sidebar.css
    ...
```

A file per component means a change is findable, and a rebuilt component takes its styles
with it. CSS Modules or similar are fine too — what matters is that no file grows to own
the whole app.

---

## Layout

**Desktop first, collapsing to mobile.** Three columns at wide widths — sidebar, task list,
detail panel. Below the breakpoint the sidebar becomes a drawer and the detail panel an
overlay.

Verify both widths with real screenshots at the end of every phase.

---

## A note on the pre-paint script

`index.html` carries an inline script that sets `data-theme` on `<html>` from a cached hint
before anything renders, so the first paint isn't the wrong scheme. Keep it, and keep your
theme selectors keyed off `data-theme` plus a `prefers-color-scheme` fallback. Anything
loaded over the network arrives too late to prevent the flash it exists to prevent.
