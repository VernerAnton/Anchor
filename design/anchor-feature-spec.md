# Anchor — Feature & Function Spec v1

*Synthesized from the Todoist baseline audit and the behavioral-science/prior-art research.*

---

## 1. Core object: the Point

| Field | Notes |
|---|---|
| Title | The action itself |
| Start time | Locked once the path is set (ideally the night before) |
| Duration | Either fixed (timer, hard stop) or "runs to natural completion" (physical tasks with their own endpoint) |
| Type | physical / abstract / rest — drives ordering logic and the physical-anchor bias |
| Status | upcoming / active / done / skipped — **skipped is never "failed"** |

**From Todoist, borrow directly:** natural-language entry ("cook chicken at 8, 25 min"), recurring rules, subtasks/task breakdown for anything that feels too big to start (research confirms this is now table-stakes — Tiimo does it with AI).

**From Todoist, deliberately drop:** priority levels (nothing on the path needs a second axis of importance — being scheduled already means it matters), Kanban view, filters/saved views, collaboration/comments.

---

## 2. Rest — first-class, not a gap

- Auto-generated between points by default, but has its own start/duration and is visually rendered as trail, not empty space
- **Never completable / checkable** — its entire job is to exist and be legitimate, not to be another thing you tick off
- Research flag: Tiimo's own guidance warns a timeline can get "just as oppressive as a written list" if every micro-moment is filled — so rest should read as *permission*, not as content

---

## 3. The path itself (implementation intentions, operationalized)

- Path is **locked in advance** (ideally the night before) — no in-the-moment re-deciding what/when
- This is the single highest-leverage feature per the research: if-then planning has one of the best-supported effect sizes in behavioral science for exactly this failure mode (not starting, getting derailed)
- Templates/chains — save a full sequence (e.g. bag → walk → gym) and drop it in wholesale
- Live vs. fixed marker — worth shipping as a **toggle**, not a permanent architecture decision, since it's unresolved which one will feel motivating vs. pressuring for you specifically

---

## 4. Momentum layer

- **"Ride it?" prompt** after a point completes — offers the next point, never forces it, dismissible with zero friction and zero consequence for declining (autonomy matters here — forced chaining is Fabulous's weak point)
- **Protected least-bad-hour slot** — defaults to a physical/starter task, since physical tasks give visible proof of progress that abstract tasks don't
- **Optional immediate celebration** on completion (small, not gamified — Tiny Habits' "Shine" moment, not Habitica's reward economy)

---

## 5. Tracking — anti-streak by design

- Rolling-window completion rate or running total — **never a chain that resets to zero**
- A missed day renders as a gap, full stop — no red, no "streak broken" language, no visual penalty
- Still show *trajectory* (are you trending up over time) — Finch's one documented weakness is that zero consequence can reduce accountability for some users, so gentle progress signal stays, punishment doesn't
- Return-friendly re-entry after a gap — a welcoming state, not a guilt state

---

## 6. Language & tone rules

- No clinical or diagnostic terms anywhere in copy (no "symptoms," no severity language)
- No blame-framed miss states ("you failed" / "streak lost")
- Neutral, non-judgmental data presentation — research specifically found this lowers the barrier to engaging with a discouraging day rather than reading it as personal failure

---

## 7. Explicitly excluded (evidence says these backfire)

- Any HP-loss / decay / "character death" mechanic tied to inactivity
- Forced sequential auto-advance through tasks with no way to decline
- Overloading the timeline with every micro-task — some blank/unscheduled space should stay genuinely open
- Streak chains as the primary tracked metric

---

## 8. Build order

**v1 (make it work):** Point/Rest data model, locked-path creation, basic CRUD, rolling-window tracking, non-clinical copy pass.
**v2 (make it Anchor):** momentum "ride it" prompts, live/fixed toggle, task breakdown assist, templates/chains.
**v3 (make it yours):** skin/location system, scenic mode, settings catalog.

---

*This is v1 — expect it to move as you actually start building and things turn out harder or easier than expected.*
