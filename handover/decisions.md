# Decisions that outlive the rebuild

Rules about **tone and behaviour**, not implementation. They were argued out properly and
they're most of what makes Anchor different from any other to-do app. The full record, with
the arguments rather than just the conclusions, is in `archive/design/scope-decisions.md`.

If one of these turns out to be wrong in practice, say so and change it deliberately.
Don't drift away from it quietly.

---

## Tone — the important part

**The app's attitude toward the user is never hostile.** A later visual phase may look
severe; the copy and the states never are.

**No clinical or diagnostic language. No blame-framed states, anywhere.** Not in copy, not
in colour, not in an empty state.

**"Earlier", never "Overdue".** The section on Today holding dates that have gone by is
called Earlier. It isn't red, isn't badged, isn't counted as a failure. **This is the
single most important decision in the app and it is not stylistic.** Every to-do app makes
you feel bad about the pile; this one doesn't. If you implement one thing from this file,
implement this.

**Nothing stores "missed."** Store what happened; derive everything else at render time. A
missed thing is a gap, never a verdict. There should be no value anywhere in the model that
could be read as "you failed to do this."

**No streaks, and no value a gap can reset.** Rolling windows and running totals only. A
running total only ever goes up. Streaks are the mechanic that turns one bad week into
quitting, and the research report in `archive/design/` is there if this gets questioned.

**Skipping records nothing.** It's a scheduling move, not a confession.

---

## Colour

**Colour carries meaning, and identity is a separate axis.**

- **State** colours say *what is happening* — the thing pulling you now, proof something
  happened, you may decline this, a date that has gone by.
- **Identity** colours say *which thing this is* — projects and labels, muted.

The two must never be confusable on one row. In the old build the shorthand was "neon means
state, muted means identity"; in a plain theme it's quieter, but the separation holds.

**A date that has gone by is neutral, never red.** That's the tone rule above, expressed in
colour.

**Meaning must survive a theme change even when the hue doesn't.** When a second theme
arrives, each meaning gets re-expressed at the same weight on the new ground — not as a
pale version of the same hue. A theme that keeps the colour and loses the meaning has
failed.

---

## Dates and language

**Explicit dates, no relative phrasing beyond Today and Tomorrow.** Section headings get
room to spell it out — "Wednesday · 5 Aug"; rows get "Wed 23 Sep". No "in 3 days", no "last
week", no "2 months ago".

**Past days are immutable records.** Renaming a task changes the library and future
scheduling, never history.

---

## Rows and panels

**A row carries what separates this task from its neighbours**, not everything true about
it. Three consecutive rows each spelling out "every week · Mon Tue Wed Thu Fri · from
completion" spend their longest line agreeing with each other. Mechanism belongs in the
panel, where there's room to read it.

**Show the note's first line, not a marker that a note exists.** A glyph meaning "something
is written here, but not what" is the one thing on a row that can't be acted on: it costs a
click to learn what a line of text would have said outright. One line, then an ellipsis.

**Suppress meta that says nothing.** Hide the project inside that project's own list; hide
the date under a heading that already states it; hide the label you're currently viewing
from every row in that view.

---

## Ordering

**Absent values sort last, always.** An unprioritised task is not a P5 and an undated one
is not overdue, but something has to go somewhere, and the end is the position that implies
no judgement.

**Reversing negates the whole comparator, tiebreaks included**, so the reversed list is
exactly the list read from the bottom — absent values included, now at the front. That's
the honest consequence of asking for the reverse, not a special case to suppress.

**Every comparator ends at the title and then the id.** Without a stable tail, adding one
task somewhere else in the list reshuffles rows that had nothing to do with it.

---

## Interaction

**Prefer in-place editing to modals** where the thing you're editing is also the thing
you're comparing against. Renaming labels happens on the labels screen, not in a dialog,
because a modal takes away the list of names you came to compare against.

**A button that can't say what it will do shouldn't be there.** "Next occurrence" needs to
name the date it lands on; a move you can't predict isn't one you'll trust.

**Feedback for every press.** A button that appears to do nothing gets pressed again —
mark the option that's already current rather than disabling it.

---

## Structure

**Semantic HTML throughout.** Real `<button>`, `<ul>`, `<form>`, real `<label>`s, real
`<details>`. A restyle must never require a markup change, and it's most of your
accessibility for free.

**Components render, they don't compute.** Status, ordering and grouping come from pure
functions returning data. A component receives `status: 'done'` and renders it; it never
works out *whether* something is done. This is the rule that makes a visual overhaul cheap.
