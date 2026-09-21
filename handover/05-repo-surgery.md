# Repo surgery — taking the path and the neon theme out of `src/`

Do this **first**, before any feature work, and get the app green afterwards. Building the
to-do side while the old UI is still in the tree is exactly the problem this phase exists
to fix.

---

## Before you start: preserve the path work

The path implementation is good work and it is coming back. It must be recoverable with
one command, by someone who doesn't remember any of this.

```bash
git tag -a path-v1 -m "Path view and neon-noir theme, complete as of the to-do-first reset" main
git push origin path-v1
```

Then every file below can be deleted freely. `git show path-v1:src/components/PathDay.tsx`
brings any of it back.

**Record the tag name in `design/scope-decisions.md`** with a one-line note saying what it
holds, so the path phase starts by reading a pointer rather than by archaeology.

---

## Delete

### Components — the path UI
```
src/components/PathArea.tsx
src/components/PathDay.tsx
src/components/PathInsert.tsx
src/components/PathLibrary.tsx
src/components/PathOverview.tsx
src/components/WeekdayStrip.tsx
src/components/TaskPicker.tsx      (picks tasks onto a day — path-only)
src/components/ExitPathMode.tsx
```

### Logic — the path engine
```
src/lib/day.ts          src/lib/day.test.ts
src/lib/dayTimes.ts     src/lib/dayTimes.test.ts
src/lib/pathGrid.ts     src/lib/pathGrid.test.ts
```

### Types
```
src/types/path.ts
```

### Styles — all of it
```
src/styles/app.css            (3,051 lines; replaced entirely — see 04-styling.md)
src/styles/tokens.css         (neon-noir; replaced by the new default theme)
src/styles/tokens-blossom.css (the daylight counterpart; not needed with one theme)
```

Keep `src/styles/fonts.css` and `public/fonts/` **only if** the default theme uses those
faces. It probably shouldn't — a system font stack is the right default and removes a
network dependency. If you drop them, delete the font files too; don't leave 800KB of
unreferenced woff2 in `public/`.

---

## Edit

### `src/App.tsx`
Remove path mode entirely: the `settings.pathMode` branch, the `PathArea`/`PathLibrary`/
`ExitPathMode` render path, `pickedDate` / `pathDate` / `selectPathDate` / `building`
state, `useNow`, and every path mutation import (`insertEntry`, `removeEntry`, `moveEntry`,
`editEntry`, `setEntryCleared`, `setEntryStarted`, `setWildcardTasks`).

This file is doing a lot. Once the path is out, consider splitting the remaining write
handlers out of the component — but don't let that refactor block the strip.

### `src/lib/views.ts`
Remove `{ kind: 'path' }` from `Selection`, and its cases in `buildTaskList` and `countFor`.

### `src/components/Sidebar.tsx`
Remove the `Path` entry from `VIEWS`.

### `src/components/TaskRow.tsx`
Remove the `durationLabel` import and the length column. `defaultDuration` has no UI in
this phase, so the column would always be empty.

### `src/components/DetailPanel.tsx`
Remove the whole `<details className="field-group">` "For the path" fold — type, first
move and duration — plus the `DEFAULT_MINUTES` import, the `pathOpen`/`onPathOpen` props,
and whatever stores that fold's per-device open state.

> **These two edits are the only couplings between the to-do side and the path engine.**
> Once they're done, nothing outside the deleted files imports `lib/day`, and the strip is
> complete.

### `src/lib/views.test.ts`
Drop the `durationLabel` import and its cases (they move out with the length column).

### `src/lib/sampleData.ts`
Remove `samplePattern` and the `PathEntry`/`PathPattern` imports. Keep `sampleTasks` and
`sampleProjects`, and add sample **labels** if there aren't any — the label features should
be visible on a fresh install.

### `src/store/` — drop the path collections
- `keys.ts` — remove `pathDoc`, `dayLogsCollection`, `dayLogDoc`
- `repository.ts` — remove `getPathPattern` / `subscribePathPattern` / `savePathPattern`
  and `getDayLogs` / `subscribeDayLogs` / `saveDayLog` from `AnchorRepository`
- `localRepository.ts`, `firestoreRepository.ts` — remove those implementations
- `schemas.ts` — remove the path and day-log schemas
- `mutations.ts` — remove `emptyPattern`, `taskEntry`, `restEntry`, `wildcardEntry`,
  `entriesOn`, `insertEntry`, `removeEntry`, `moveEntry`, `editEntry`, `EntryChanges`,
  `emptyDayLog`, `setEntryCleared`, `setEntryStarted`, `setWildcardTasks`
- `mutations.test.ts` — remove the corresponding tests
- `hooks/useStore.ts` — remove `usePathPattern` and `useDayLogs`

**Do not delete the Firestore documents.** Leaving `v2-path` and `v2-daylogs` in the
database costs nothing and means anyone still carrying that data keeps it.

### `src/types/settings.ts`
Remove `pathMode` from `Settings` and `defaultSettings()`. Make the Zod schema **tolerate**
`pathMode` on inbound documents and ignore it — older builds on other devices will keep
writing it for a while.

### `src/components/StatusBar.tsx`
Drop the `cleared` and `total` props — both are path statistics. What remains (date, clock,
sync state, build) is fine to keep, or fine to remove: the sidebar already shows the build
label. Your call once you see it in the new styling.

### Root `CLAUDE.md`
Replace with `handover/CLAUDE.md`. The current one is written for the path-and-neon phase.

### `README.md`
Update the description to match: the to-do app is the product right now, the path is a
later phase. Keep the Firebase and Vercel sections — they're still accurate and still
contain the two deployment traps.

---

## Keep — do not rewrite

This is tested, working code and **none of it is what went wrong.** The failure was in the
components and the stylesheet, not here.

### Logic (`src/lib/`)
| File | Why |
|---|---|
| `recurrence.ts` | 522 lines, 537 lines of tests. The hardest thing in the app. Do not rewrite it. |
| `dates.ts` | Date helpers, used everywhere |
| `reschedule.ts` | The Tomorrow / In a week / Next occurrence logic |
| `views.ts` | Every view's section-building, as pure functions |
| `grouping.ts` | Group-by, with the structural-section rule |
| `sorting.ts` | The comparators, with stable tiebreaks |
| `labelSearch.ts` | Case-insensitive matching, comma splitting |
| `taskRef.ts` | The project reference on a row |
| `priorities.ts`, `id.ts`, `build.ts`, `theme.ts` | Small and correct |

### Store (`src/store/`)
**Take the whole sync layer as it is**, minus the path collections above. It is the
owner's own working Firestore system, ported and verified: sync-key identity, IndexedDB
persistence with the multi-tab manager, integer per-document versioning, a guarded
local→cloud migration that cannot wipe existing data, and Zod validation of everything
inbound. `design/handover-firebase-sync.md` documents all of it.

### Components worth keeping and restyling rather than rebuilding
`RecurrenceEditor.tsx` (392 lines of fiddly, correct UI), `LabelPicker.tsx`,
`LabelsPanel.tsx`, `ProjectEditor.tsx`, `NumberField.tsx`, `SyncSettings.tsx`,
`ErrorBoundary.tsx`, `UpdatePrompt.tsx`.

`TaskRow.tsx`, `TaskListPanel.tsx`, `DetailPanel.tsx` and `Sidebar.tsx` are the ones most
worth reworking — they carry the most styling assumptions and the most layout — but their
*structure* is sound. Start from them; don't start from nothing.

### Infrastructure
`vite.config.ts` (PWA setup), `index.html`, `public/icons/`, `.env.example`,
`docs/firebase-setup.md`, `docs/app-version-and-update-prompt.md`, and all of `design/`.

---

## `design/` — leave it in place

Don't delete the path mockups, the feature spec, the research report or the old handovers.
They are the path phase's input and they cost nothing sitting there.

**Add one line to the top of `design/README.md`** (create it if absent) saying: *the
current phase is the to-do side; see `handover/`. The path documents here describe a later
phase and are not current scope.* That's enough to stop a future session building from the
wrong document — which is roughly how this situation arose.

---

## Verify the strip before moving on

```bash
npm run typecheck     # clean
npm run test          # green, minus the removed path suites
npm run build         # succeeds
npm run dev           # app boots
```

Then, by hand:

- [ ] Today, Upcoming, All tasks, a project and a label all render
- [ ] Create, complete, reopen, edit and delete a task
- [ ] Grouping and sorting still work, and still persist
- [ ] The recurrence editor opens and previews correctly
- [ ] Sync settings open; local mode still works with no key
- [ ] `grep -rn "path\|Path" src/` returns only false positives (file paths, `parentId`,
      SVG `<path>`)

Commit the strip on its own, with a message that says what it is and names the `path-v1`
tag. **Bump `APP_VERSION`** — devices need to be able to tell they're on the new build.
