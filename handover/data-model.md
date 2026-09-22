# Data model

**There is no data to preserve.** The owner confirmed they have no real tasks in Anchor
yet, so you are free to shape these however you like. What follows is the previous model
with its reasoning — worth starting from, because the shapes are sound and the *rules* at
the bottom are the ones that stop sync corrupting data.

The old definitions are in `archive/src/types/task.ts` and `archive/src/types/settings.ts`,
with Zod validation in `archive/src/store/schemas.ts`.

---

## The one structural idea worth keeping

**A Task is a thing you might do. It is not a thing scheduled on a day.**

The library (what exists) and the schedule (what's placed where) stay separate. Today that
distinction costs you nothing — a task just carries a `dueDate`. Later it's what lets the
same task appear on Tuesday and next Tuesday without either day owning it.

You don't have to build for that now. Just don't build something that makes it impossible.

---

## Suggested shapes

### Task

```ts
interface Task {
  id: string;
  title: string;
  notes: string | null;
  projectId: string | null;
  parentId: string | null;        // one level of subtasks; null = top level
  priority: 1 | 2 | 3 | 4 | null; // 1 is the strongest pull
  dueDate: string | null;         // YYYY-MM-DD, explicit
  recurrence: Recurrence | null;
  completedAt: number | null;     // recurring tasks never set this
  labelIds: string[];             // a set, stored as an array
  order: number;                  // manual ordering
  archived: boolean;

  schemaVersion: number;
  version: number;
  updatedAt: number;
}
```

`labelIds` holds **ids, not names**, so renaming a label renames it everywhere at once and
a task can never disagree with the label list about what it's called. It's an array because
Firestore has no set type.

### Project

```ts
interface Project {
  id: string;
  name: string;
  colorId: ProjectColor;   // an id, never a hex value
  parentId: string | null; // nests one level
  order: number;
  archived: boolean;
  schemaVersion: number; version: number; updatedAt: number;
}
```

**`colorId` is an id and the actual colour is a theme token.** That single choice is why a
restyle never has to touch the data model.

### Label

Same shape minus `parentId` — flat by design.

### Settings

One synced document: theme preference, per-view grouping and sorting. It doubles as the
"this install has been initialised" marker, which is why it's worth having from day one —
adding a field to an existing synced document is easy, adding a whole document type
mid-flight is not.

---

## The rules that actually matter

These are not style preferences. Each one is a bug that was hit and fixed.

### Every absent value is an explicit `null`, never an optional field

```ts
notes: string | null;   // yes
notes?: string;         // no
```

**Firestore rejects an entire write if any field is `undefined`**, and `notes?: string` is
exactly how one slips in. This caused a real failure. `ignoreUndefinedProperties` is set as
a second line of defence, not a licence to use optionals.

### Conflicts resolve on an integer `version`, never a timestamp

Every document carries `version`, bumped **synchronously before any async work**. A
snapshot carrying a lower version than local state is a stale echo and is refused.

Timestamps look like they'd work here and then quietly lose data on a device with a wrong
clock. `updatedAt` exists for display and ordering only — never for conflict resolution.

### Cloud data is untrusted

Zod-validate everything inbound. Drop invalid documents with a warning rather than letting
them into local state.

### Derive state, don't store it

Store what happened — `completedAt`, and that's nearly all of it. Compute overdue, due
today, upcoming, and every other status at render time, in pure functions that return data.

This is what lets the UI be rebuilt without touching logic, and it's why the old view
functions transplant cleanly even though the components around them were wrong.

**Nothing stores "missed."** A missed thing is a gap, never a verdict — see `decisions.md`.

---

## If you ever add the path

Leave yourself the option, cheaply: a `Task` can later carry `firstMove`, `type` and
`defaultDuration` as nullable fields with no UI. You don't need them now and adding them
now would be building toward the path, which you shouldn't.

Just be aware that adding fields later means a migration across synced devices — which is
painless while the app holds nothing real, and less so once it does. Worth a thought before
the owner starts using it daily.

**One invariant to protect either way: rest is never completable.** When rest eventually
exists, enforce it in the type system — no status field, no `completedAt`, no shape that
could acquire one. Don't build anything now that would make that hard.
