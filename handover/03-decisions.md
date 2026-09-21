# Decisions already settled

These were argued out and decided. **Implement them; don't reopen them.** If one turns out
to be wrong in practice, say so explicitly and record the change — don't drift away from it
quietly.

Condensed from `design/scope-decisions.md`, which holds the full history if you need it.

---

## Labels

**A second identity axis, not a second kind of project.** A task lives in exactly one
project — where it belongs — and carries any number of labels, which say something true
about it from a different direction: what it needs from you, where you have to be, how
much of you it takes. "Salesforce Admin" is a project; "quick win" and "deep work" are
labels, and a task is both at once.

**Flat.** Projects nest because a body of work has parts. A tag that needs a parent is a
project wearing the wrong hat, and the moment labels grow a hierarchy there are two answers
to "where does this live".

**Same palette as projects, different shape.** A project is a filled dot; a label is an
outlined chip.

**The label view gathers across projects** — the thing a project tree can never do. A
labelled subtask appears there on its own merits, not only under a labelled parent.

**Deleting a label takes it off every task.** Leaving the id behind would be a task
pointing at nothing — invisible until the id was reused, at which point the label would
reappear.

**Labels live on a screen, not in the sidebar.** They're a small set you arrange
occasionally and then stop thinking about. One line in the views list, and a screen of
their own where renaming and reordering happen in place — a modal would take away the list
of names you came to compare against.

### The label picker

**One box that searches and creates.** A wall of every label as a toggle answers "which are
on" perfectly at five labels and not at all at fifty. The chips above the box keep that
answer; the box serves the commoner case of knowing what you want and typing three letters.

**Names match case-insensitively**, so "Focus" and "focus" are one label. A picker that
quietly made a second one would be lying about what typing a name does. Archived names are
free again — asking for one means a new label.

**A comma finishes a label.** One paste of "focus, deep work, errand" lands as three —
which is why the whole list must be resolved **before anything is written**: two new names
sharing one write would both claim the same order and the task would be saved twice from
the same stale copy, keeping only the last.

**Suggestions sit in the flow, not floating over the fields below.** An overlay needs a
background to hide what's under it — exactly what stops working when a theme file is
missing — and inside a panel that already scrolls it is fiddly on a phone.

---

## Grouping

**A second cut through rows a view already chose.** Offered top-right on Today and All
tasks. Upcoming doesn't get it — already one section per date, and grouping would nest a
project inside a day. Nor does a project's or a label's own list, which are already the
answer to grouping by that thing.

**Structural date sections survive it.** Today's "Earlier" stays on top when grouping is
on: overdue is a fact about the date, and burying it inside "Salesforce" would lose the one
thing that section exists to say.

**Per view, not one setting for all of them.** Today and All tasks have different jobs —
one is "what am I doing now", the other is the library. Grouping the library by project
while sorting today by priority is an ordinary thing to want, not an inconsistency to iron
out. A view with no entry uses the defaults, so nothing is written for views never touched.
It syncs, like the theme.

**A task with two labels appears under both.** That is what having two labels means.
Grouping by project can't do this — a task has exactly one — which is the clearest
statement of how the two axes differ.

**Empty groups are left out; the ungrouped group is named and last.** "No label" at the
bottom is true and useful to read; an untitled section of leftovers is a puzzle.

---

## Sorting

**Separate from grouping, and both answered at once.** Grouping decides which pile a row
goes in; sorting decides where it sits in that pile. Turning one on never turns the other
off, and **grouping happens first** — sorting a list that is about to be cut up is work
thrown away.

**Absent values sort last, always.** Something has to go somewhere, and the end is the
position that implies no judgement. Reversing brings them to the front, which is the honest
consequence of asking for the reverse — not a special case worth suppressing.

**Reversing negates the whole comparator, tiebreaks included**, so the reversed list is
exactly the list read from the bottom. Anything else leaves equal pairs in a third order
nobody asked for.

**Every comparator ends at the title and then the id.** Without a stable tail, adding one
task somewhere else in the list reshuffles rows that had nothing to do with it.

**Sorting is offered on every task list; grouping is not.** A sort has something to say
inside any list. Grouping only earns its place where the list isn't already cut along that
axis.

---

## Rescheduling

**Three moves under the title: Tomorrow, In a week, Next occurrence.** Moving a thing is
the commonest edit a task ever gets, and a date picker charges three decisions — month,
week, day — for something you already knew. The first two always show, so a dateless
backlog task can be given a date this way. The third only appears when the task repeats and
the rule can still produce a date; a disabled button that can't say where it would go is
worse than no button.

**Each button says where it lands before you press it.** "Tomorrow" needs no explanation;
"next occurrence" very much does, and a move you can't predict isn't one you'll trust.

**Moving a task moves the phase its rule counts from.** The rule keeps its shape — every
other weekday stays every other weekday — but the anchor follows the task to its new date.
Moved Monday to Tuesday, "every other weekday" runs Tue, Thu, Mon. Held to the old Monday
phase it would say Wednesday, one day after the move, which is not what "every other" means
to anybody. A `fromCompletion` rule has no phase to re-stamp, so for those this is a plain
date change.

**Skipping measures from exactly where completing would** — the due date when it's still
ahead, today when it has gone by — so finishing and skipping can never disagree about which
occurrence comes next. **Skipping records nothing.** It is a scheduling move, not a verdict,
and nothing in the app should be able to say an occurrence was missed.

**The button matching the current due date is marked, not disabled.** It is the only
feedback the press has — the date field is far enough down the panel to be off-screen on a
phone, and a button that appears to do nothing gets pressed again.

**The moves disappear once a task is done.** A completed task with a future due date is a
state nothing else in the app can produce, and nothing should start.

---

## What a row shows

**A row carries what separates this task from its neighbours.** Three consecutive tasks
that each spelled out "every week · Mon Tue Wed Thu Fri · from completion" spent their
longest line agreeing with each other. The rule's mechanism — from completion, until,
repeats left — comes off the row and stays in the panel, where there is room to read it.

**The note's first line, not a marker that a note exists.** A glyph meaning "something is
written here, but not what" is the one thing on a row that can't be acted on: it costs a
click to learn what a line of text would have said outright. One line, then an ellipsis —
a row that grows with the length of a note stops being a row.

**Meta is suppressed where it would say nothing.** The project is hidden inside that
project's list; the date is hidden under a heading that states it; the label you're viewing
is hidden from every row in that view.

---

## Dates and language

**Explicit dates, no relative phrasing beyond Today and Tomorrow.** Section headings get
"Wednesday · 5 Aug"; rows get "Wed 23 Sep". No "in 3 days", no "last week".

**"Earlier", never "Overdue".** The section on Today holding dates that have gone by is
called Earlier. It is not red, not marked, not counted as a failure. This is the single
most important tone decision in the app and it is not stylistic — it is the product.

---

## Theming

**Structure and styling are separate, and the separation is tested.** Full contract in
`04-styling.md`. The short version: class names describe meaning and never appearance, no
raw colour/shadow/radius/font/spacing values live outside the one token file, no inline
styles for appearance, and components render rather than compute.

**Colour meaning survives a theme change; the hue does not.** When a second theme arrives,
each meaning is re-expressed at the same weight on the new ground rather than as a pale
version of the same hue. A theme that keeps the colour and loses the meaning has failed.
