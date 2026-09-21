# Build order

Six phases. Each one ends with the app working, committed, and `APP_VERSION` bumped —
never a half-migrated tree. Don't start a phase before the one above it is verified.

---

## Phase 0 — The strip

Work `05-repo-surgery.md` end to end. Tag the path work, delete the path UI and engine,
delete all three stylesheets, cut the path out of the store and the types, replace
`CLAUDE.md`.

The app will be **unstyled** at the end of this phase, and that is correct. Don't add
styling here — the whole point is to see the bare structure and find out what it's
actually made of.

**Done when:** typecheck, tests and build are green; every to-do feature is reachable and
usable with no stylesheet at all. Screenshot it — this is your first real blank-theme test
and it's free.

---

## Phase 1 — The default theme

Write `tokens.css` and the split stylesheets per `04-styling.md`. Style the app shell, the
sidebar, the task list, the task row, the detail panel, and the forms.

Resist the urge to improve the interface while you're styling it. Structure changes come
in phase 2. Here you are only making what exists look right.

**Done when:**
- Light and dark both look deliberate
- Desktop three-column and mobile drawer/overlay layouts both work
- The blank-theme test still passes
- Screenshots at desktop and mobile widths, in both schemes

---

## Phase 2 — The to-do side, properly finished

Now go through the app as a *user*, not a builder, and fix what the strip exposed. Expect:

- Empty states that were never written ("No tasks in this project yet")
- Loading states — the store subscribes asynchronously and always has
- Keyboard handling: Enter to add, Escape to close the panel, arrows through the list
- Focus management when the detail panel opens and closes
- Mobile ergonomics: tap targets, the drawer, the overlay's close affordance
- Error states when a write fails

Also in this phase: **anything about the existing features that is merely adequate.** This
is the phase where the to-do side stops being a foundation and becomes the product.

**Done when:** you can use it for a full day of real tasks without being annoyed by it.
Actually do that before calling it done.

---

## Phase 3 — Search

Per `01-scope.md`. One input, title and notes, case-insensitive, flat results with the
project shown. Keyboard-reachable.

Keep it genuinely small. No operators, no saved searches, no fuzzy matching.

---

## Phase 4 — Hardening

- Unit tests for anything added in phases 2–3
- Check the Firestore round trip on a real second device, not just locally
- Verify offline: airplane mode, make changes, reconnect, confirm they land
- Confirm the PWA updates cleanly on an already-installed device
- Run the blank-theme test one final time, with a screenshot in the commit

---

## Phase 5 — Hand back

Write a short `handover/STATUS.md` recording what was built, what was deliberately left,
and anything learned that contradicts `03-decisions.md`. Then the next phase — custom
design, or the path — starts from a known-good to-do app.

---

## Working rules for every phase

- **Bump `APP_VERSION` whenever work ships.** Several devices run this as a PWA and can
  silently sit on an old build; the version in the UI is the only way to tell at a glance.
- **Verify with the real app, not by assertion.** Screenshots at desktop and mobile widths.
  "Should work" is not a verification.
- **Don't ask permission for things already decided here.** The handover is the decision.
- **When something genuinely needs a decision, ask once and record the answer** in
  `design/scope-decisions.md` rather than asking again later.
- **If you catch yourself designing, stop.** Choosing a colour, an animation or a visual
  motif means you have left this phase. Use the tokens and move on.
- **If you catch yourself building the path, stop.** Including "just a small hook for
  later". The hook is the three nullable fields on `Task`, and that is all of it.
