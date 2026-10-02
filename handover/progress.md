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
