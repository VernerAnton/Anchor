# Archive — the previous implementation

**This folder is reference material. It is not part of the app.**

It's excluded from `tsconfig.json` and from the vitest config, so nothing here is compiled,
type-checked, tested or shipped. It doesn't need to build, and it will slowly stop being
able to. That's fine — it's a parts bin, not a project.

## Why it's here

Anchor was rebuilt to fix an ordering mistake: the path view and an elaborate neon-noir
theme were built before the to-do side was finished, which made every small change
expensive. `src/` was cleared and the to-do app is being built properly first.

But a lot of what's in here is correct and hard-won. Rather than delete it and rediscover
the same bugs, it sits here to be copied from.

## What's worth taking

**See `handover/mechanisms.md`** — it's the annotated map: what to take, where it is, and
what each piece already knows. The short version:

| | |
|---|---|
| `src/lib/recurrence.ts` + tests | The recurrence engine. Take it. |
| `src/store/` | Firestore sync, offline queue, versioning, validation |
| `src/lib/` (views, sorting, grouping, labelSearch, reschedule, dates) | Pure view logic, tested |
| `src/lib/sampleData.ts` | A week of sample tasks for a fresh install |
| `src/components/RecurrenceEditor.tsx` | Read before designing your own |

**Don't take** `src/styles/` (3,051 lines of welded-in theme), anything path-shaped
(`Path*.tsx`, `lib/day.ts`, `lib/pathGrid.ts`, `types/path.ts`), or `src/App.tsx`.

## `design/`

Mockups, the behavioural-science research report, the old handover documents, and
`scope-decisions.md` — the full record of what was decided and why.

**`scope-decisions.md` is the valuable one.** `handover/decisions.md` has the conclusions;
this has the arguments. Go here when a decision gets questioned.

Note that these documents describe a **path-first** product. They are the input to a later
phase, not current scope. Don't build from them.

## Deleting this folder

Safe, whenever you like — the full history is on `main` and in every commit before the
reset. To make it easy to find again:

```
git tag -a path-v1 -m "Path view and neon-noir theme, complete" <the pre-reset commit>
git push origin path-v1
```
