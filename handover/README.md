# Anchor — building the to-do app

**Start here. Read this whole folder before writing code.**

---

## What this is

Anchor is a task manager. Its eventual signature feature is **the path** — a day rendered
as a route rather than a list — but the path is a lens over a task library, and the library
was never finished. A previous attempt built the path view and an elaborate neon-noir theme
first, which made every small to-do change expensive: a custom visual system and a second
mode had to be reasoned about before a checkbox could move.

So the project has been reset to its foundation. **`src/` is empty. You are building the
to-do app, from scratch, the way it should be.**

## The archive is a parts bin, not a spec

`archive/` holds the entire previous implementation. It is **not** compiled, type-checked,
tested or shipped — it's excluded in `tsconfig.json` and in the vitest config.

It is there for one reason: some of it is genuinely hard, correct, and already debugged.
**`mechanisms.md` is the map** — what's worth taking, where it lives, and what each piece
already knows that you would otherwise learn the hard way.

Take from it freely. Ignore the rest. You are not restoring the old app and nothing in the
archive is an obligation.

## What you're building

A to-do app the owner will use every day. Not a foundation for something else — the
product, right now.

**Plain default styling.** Neutral, readable, genuinely nice to look at, but with no brand
and no atmosphere. A custom visual identity comes later, and `styling.md` sets the contract
that makes it a one-file change rather than a rewrite. The last attempt failed that test,
which is most of why we're here.

**No path.** No path mode, no route view, no day timeline, no rest blocks, no wildcards, no
momentum, no scenic mode. Not even "a small hook for later."

## Reading order

| File | What it answers |
|---|---|
| `features.md` | The menu of what a to-do Anchor could do — **you pick**, it's not a checklist |
| `mechanisms.md` | The parts bin: what to take from `archive/`, and what each part already solves |
| `data-model.md` | The entity shapes, and the rules that keep sync from corrupting data |
| `decisions.md` | Tone and product rules that outlive any rebuild |
| `styling.md` | The default-theme brief and the swappability contract |
| `build-order.md` | Suggested phases |

## The state you're starting from

```
src/            empty but bootable — App.tsx is a placeholder, replace it
archive/        the previous implementation, excluded from the build
handover/       this folder
public/icons/   PWA icons, still live
package.json    React 19 + Vite 7 + TypeScript + Zod + Firebase, all current
vite.config.ts  PWA/service-worker setup, working — don't rebuild this
```

`npm install && npm run dev` boots a placeholder page. That's your starting line.

## Ground rules

- **This is the real Anchor**, in the real repo, deployed to the real domain, installed as
  a PWA on several of the owner's devices. Not a prototype.
- **Bump `APP_VERSION` in `src/version.ts` whenever work ships.** It's shown in the app and
  it's the only way to tell at a glance whether a device is on the current build — an
  installed PWA can silently sit on an old one.
- **Don't design.** If you're choosing a colour or a visual motif, you've left this phase.
- **Don't build toward the path.**
- **Verify in the real app**, at desktop and mobile widths. Screenshots, not assertions.
- **When something genuinely needs a decision, ask once, then record it** in
  `archive/design/scope-decisions.md` or a new `decisions` note — don't re-ask later.
