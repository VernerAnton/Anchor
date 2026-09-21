# Data model

The current model is sound and should be **kept, not redesigned**. It is defined in
`src/types/task.ts` and `src/types/settings.ts`, validated in `src/store/schemas.ts`, and
covered by tests. This file explains why it is shaped the way it is, so you don't
"simplify" something load-bearing.

---

## The one structural idea

**A Task is a thing you might do. It is not a thing scheduled on a day.**

The library (what exists) and the schedule (what's placed where) are separate. That
separation is what will later let the same task appear on Tuesday and next Tuesday without
either day owning it. In this phase you only build the library — but don't collapse the
distinction, because the whole later phase depends on it.

---

## Entities

### Task

```
id, title, notes, projectId, parentId, priority, dueDate,
recurrence, completedAt, order, archived, labelIds,
firstMove, type, defaultDuration,
schemaVersion, version, updatedAt
```

- `parentId` gives **one** level of subtasks. Not a tree. A task with a parent never has
  children.
- `priority` is `1 | 2 | 3 | 4 | null`. 1 is the strongest pull. It exists to order a
  backlog — planning only.
- `dueDate` is `YYYY-MM-DD` or `null`, entered explicitly. `null` is an ordinary backlog
  task, not a missing value.
- `completedAt` is a timestamp or `null`. **Recurring tasks never set it** — completion
  advances `dueDate` instead.
- `labelIds` is a set stored as an array (Firestore has no set type). Ids, not names, so
  renaming a label renames it everywhere at once.
- `order` is manual ordering within a project.

### Project

```
id, name, colorId, parentId, order, archived, schemaVersion, version, updatedAt
```

Nests one level. `colorId` is one of eight muted ids (`steel`, `violet`, `teal`, `sage`,
`ochre`, `plum`, `indigo`, `clay`) — **ids only; the actual colour values are theme
tokens**, so a restyle never touches this file. Archived rather than deleted, because
history should still be able to say where work came from.

### Label

```
id, name, colorId, order, archived, schemaVersion, version, updatedAt
```

Flat, deliberately. Same palette as projects, different shape: a project renders as a
filled dot, a label as an outlined chip. **Shape carries the axis, colour carries the
item** — so a coloured circle never means two different things on one line.

### Settings

One document, synced. Holds the theme preference and the per-view grouping/sorting
options. It doubles as the "this install has been initialised" marker, which is why it
exists from day one.

**`pathMode` comes out of Settings in this phase.** It is the stored toggle between the
two sides of the app, and there is only one side now. Removing a field from a synced
document is safe; the Zod schema should tolerate its presence on documents written by
older builds and simply ignore it.

---

## Rules that are not negotiable

### Every absent value is an explicit `null`, never an optional field

Firestore rejects an **entire write** if any field is `undefined`, and `label?: string` is
exactly how one slips in. Write `label: string | null`. This has already caused a real
failure in this codebase; `ignoreUndefinedProperties` is set as a second line of defence,
not a licence to use optionals.

### Versioning is integer, not timestamp

Every document carries `version`, bumped **synchronously before any async work**. This —
not `updatedAt` — resolves conflicts, which makes it immune to clock skew. A snapshot
carrying a lower version than local state is a stale echo and is refused. `updatedAt`
exists for display and ordering only.

### Cloud data is untrusted

Everything inbound is Zod-validated. Invalid documents are dropped with a warning, never
merged into local state.

---

## The three path-ready fields

`Task` carries `firstMove`, `type` and `defaultDuration`. They are nullable, the to-do side
never reads them, and **their UI (the "For the path" fold in the detail panel) is removed
in this phase.**

**Keep the fields on the type. Remove the UI.**

Keeping three unread nullable fields costs one line each and a comment. Removing them
means that when the path phase begins, every task document on every synced device needs a
migration — across devices that may be offline, running old builds, or installed as PWAs
that update at their own pace. That is a real and avoidable cost, paid for a cosmetic
tidiness gain.

Mark them clearly:

```ts
// Reserved for a later phase. Nothing in the to-do side reads these, and no UI
// sets them. They stay on the type so adding that phase needs no migration
// across synced devices.
firstMove: string | null;
type: TaskType | null;
defaultDuration: Duration | null;
```

If you disagree, raise it — don't silently drop them.

---

## What to delete from the model

- `src/types/path.ts` entirely — `PathEntry`, `PathPattern`, `RestEntry`, `WildcardEntry`,
  `DayLog`.
- The path collections from `src/store/keys.ts` (`pathDoc`, `dayLogsCollection`,
  `dayLogDoc`).
- The path methods from `AnchorRepository` and both backends.
- The path mutations from `src/store/mutations.ts` (entries, patterns, day logs).
- `pathMode` from `Settings`.

`05-repo-surgery.md` has the exact list.

---

## One invariant you must carry forward

**Rest is never completable.** It does not appear in this phase, but when it does it must
be enforced in the type system — no status field, no `completedAt`, no shape of the model
that could acquire one. Don't build anything now that would make that hard later.
