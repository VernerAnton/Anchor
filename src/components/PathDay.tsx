import { Fragment, useState } from 'react';
import type { Project, Task } from '../types/task';
import type { DayLog, PathPattern, RestEntry, WildcardEntry } from '../types/path';
import type { DayBlock, DayPoint, DaySegment, LandingTask } from '../lib/day';
import type { EntryChanges } from '../store/mutations';
import { MONTH_NAMES, dayOf, weekdayOf } from '../lib/dates';
import { dayBlocks, landingOn } from '../lib/day';
import { clockOf } from '../lib/dayTimes';
import { ENTRY_DRAG, PathInsert } from './PathInsert';
import { TaskPicker } from './TaskPicker';
import { NumberField } from './NumberField';

interface Props {
  tasks: Task[];
  projects: Project[];
  pattern: PathPattern | null;
  log: DayLog | null;
  date: string;
  today: string;
  selectedTaskId: string | null;
  onOpenCalendar: () => void;
  onSelectTask: (id: string) => void;
  /** Clears one placement, by entry id — never the task itself. */
  onClearEntry: (entryId: string, cleared: boolean) => void;
  onInsertEntry: (index: number, entry: import('../types/path').PathEntry) => void;
  onMoveEntry: (from: number, to: number) => void;
  onRemoveEntry: (entryId: string) => void;
  onEditEntry: (entryId: string, changes: EntryChanges) => void;
  onFillWildcard: (entryId: string, taskIds: string[]) => void;
  /**
   * Whether the week itself can be changed here. Off, the day is the route:
   * you can still tick a point and still fill a wildcard, because both are
   * facts about today rather than changes to the week.
   */
  building: boolean;
  /** The mode switch — BUILD or RUN, depending which side of it you're on. */
  action?: React.ReactNode;
}

const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/**
 * Drawn rather than typed: an emoji depends on a font being present, and it
 * renders as an empty box wherever it isn't. `currentColor` keeps it a theme
 * decision, not a hardcoded one.
 */
function CalendarIcon() {
  return (
    <svg
      className="path-day-view__calendar"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="1.5" y="3" width="13" height="11.5" rx="1.5" />
      <path d="M1.5 6.5h13M5 1.5V4M11 1.5V4" />
    </svg>
  );
}

/**
 * One day, as a route — and where it gets built.
 *
 * The date at the top is the button that opens the four-week calendar: the
 * date is exactly what that view changes, whereas a corner of the screen is
 * next to controls that have nothing to do with it.
 *
 * The day is derived, never stored. `dayBlocks` pairs each thing the pattern
 * holds with whatever it drew, which is what lets the same control both edit
 * an entry and show its clock: a filled wildcard is one entry and several
 * points, and a task whose rule stopped covering today is one entry and
 * nothing at all.
 *
 * Ticking a point clears *that placement* — the same task placed twice is two
 * entries, and clearing one leaves the other open.
 */
export function PathDay({
  tasks,
  projects,
  pattern,
  log,
  date,
  today,
  selectedTaskId,
  onOpenCalendar,
  onSelectTask,
  onClearEntry,
  onInsertEntry,
  onMoveEntry,
  onRemoveEntry,
  onEditEntry,
  onFillWildcard,
  building,
  action,
}: Props) {
  // A stale entry draws nothing but keeps its place in the list, so the gap
  // numbers still line up with what you can see.
  const blocks = dayBlocks(tasks, pattern, log, date).filter((b) => b.segments.length > 0);
  const landing = landingOn(tasks, pattern, date);

  const heading =
    date === today
      ? 'Today'
      : `${WEEKDAY_NAMES[weekdayOf(date)]} ${dayOf(date)} ${MONTH_NAMES[Number(date.slice(5, 7)) - 1]}`;

  // Outside build mode there are no gaps at all: nothing can be put anywhere,
  // so an empty slot between every two things would be a control that does
  // nothing but take up the day.
  const gap = (index: number) =>
    building ? (
      <li className="path-gap" role="presentation">
        <PathInsert index={index} landing={landing} onInsert={onInsertEntry} onMove={onMoveEntry} />
      </li>
    ) : null;

  return (
    <section className="path-day-view" aria-label="Today's path">
      <header className="path-day-view__head">
        <button type="button" className="path-day-view__date" onClick={onOpenCalendar}>
          <span className="path-day-view__heading">{heading}</span>
          <CalendarIcon />
          <span className="visually-hidden">Open the four-week calendar</span>
        </button>
        {action}
      </header>

      {blocks.length === 0 && (
        <p className="path-day-view__clear">
          Nothing on the path today. That's a legitimate answer, not an empty one.
        </p>
      )}

      <ol className="path-points">
        {gap(0)}
        {blocks.map((block) => (
          <Fragment key={block.entry.id}>
            <Block
              block={block}
              tasks={tasks}
              projects={projects}
              landing={landing}
              log={log}
              selectedTaskId={selectedTaskId}
              onSelectTask={onSelectTask}
              onClearEntry={onClearEntry}
              onMoveEntry={onMoveEntry}
              onRemoveEntry={onRemoveEntry}
              onEditEntry={onEditEntry}
              onFillWildcard={onFillWildcard}
              blocks={blocks}
              building={building}
            />
            {gap(block.index + 1)}
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

interface BlockProps {
  block: DayBlock;
  blocks: DayBlock[];
  tasks: Task[];
  projects: Project[];
  landing: LandingTask[];
  log: DayLog | null;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onClearEntry: (entryId: string, cleared: boolean) => void;
  onMoveEntry: (from: number, to: number) => void;
  onRemoveEntry: (entryId: string) => void;
  onEditEntry: (entryId: string, changes: EntryChanges) => void;
  onFillWildcard: (entryId: string, taskIds: string[]) => void;
  building: boolean;
}

/**
 * One thing on the day, whichever of the three it is.
 *
 * Draggable for the mouse, with move buttons doing the same job for everything
 * else — HTML drag doesn't exist on touch, and this is a phone app as much as
 * a desktop one.
 */
function Block(props: BlockProps) {
  const { block, blocks, building, onMoveEntry, onRemoveEntry } = props;
  const [dragging, setDragging] = useState(false);

  // Neighbours by what's on screen, not by stored position: stepping over an
  // entry that draws nothing would look like the button did nothing at all.
  const seat = blocks.indexOf(block);
  const above = blocks[seat - 1];
  const below = blocks[seat + 1];

  return (
    <li
      className={dragging ? 'path-block path-block--dragging' : 'path-block'}
      draggable={building}
      onDragStart={(event) => {
        event.dataTransfer.setData(ENTRY_DRAG, String(block.index));
        event.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      {block.entry.kind === 'task' && <TaskBlock {...props} />}
      {block.entry.kind === 'rest' && <RestBlock {...props} entry={block.entry} />}
      {block.entry.kind === 'wildcard' && <WildcardBlock {...props} entry={block.entry} />}

      {building && (
      <div className="entry-tools">
        <button
          type="button"
          className="entry-tools__button"
          disabled={above === undefined}
          aria-label="Move earlier"
          onClick={() => above && onMoveEntry(block.index, above.index)}
        >
          ↑
        </button>
        <button
          type="button"
          className="entry-tools__button"
          disabled={below === undefined}
          aria-label="Move later"
          onClick={() => below && onMoveEntry(block.index, below.index + 1)}
        >
          ↓
        </button>
        <button
          type="button"
          className="entry-tools__button"
          aria-label="Take this off the day"
          onClick={() => onRemoveEntry(block.entry.id)}
        >
          ✕
        </button>
      </div>
      )}
    </li>
  );
}

function TaskBlock({
  block,
  projects,
  selectedTaskId,
  onSelectTask,
  onClearEntry,
  onEditEntry,
  building,
}: BlockProps) {
  const segment = block.segments[0];
  if (segment === undefined || segment.kind !== 'point') return null;

  return (
    <Point
      segment={segment}
      projects={projects}
      selectedTaskId={selectedTaskId}
      onSelectTask={onSelectTask}
      onClearEntry={onClearEntry}
      clock={
        <Clock
          segment={segment}
          onSet={
            building ? (startTime) => onEditEntry(block.entry.id, { startTime }) : null
          }
        />
      }
    />
  );
}

/** The parts every point shares, wherever it came from. */
function Point({
  segment,
  projects,
  selectedTaskId,
  onSelectTask,
  onClearEntry,
  clock,
  extra,
}: {
  segment: DayPoint;
  projects: Project[];
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onClearEntry: (entryId: string, cleared: boolean) => void;
  clock: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const { task } = segment;
  const done = segment.completedAt !== null;
  const color = projects.find((p) => p.id === task.projectId)?.colorId ?? null;

  const classes = ['path-point'];
  if (done) classes.push('path-point--done');
  if (segment.fromWildcard) classes.push('path-point--wildcard');
  if (task.id === selectedTaskId) classes.push('path-point--selected');

  return (
    <div className={classes.join(' ')}>
      {clock}
      <button
        type="button"
        className="task-check"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
        onClick={() => onClearEntry(segment.entryId, !done)}
      />
      <button
        type="button"
        className="path-point__body brackets"
        onClick={() => onSelectTask(task.id)}
      >
        <span className="path-point__title">{task.title}</span>
        {task.firstMove !== null && (
          <span className="path-point__first-move">{task.firstMove}</span>
        )}
        <span className="path-point__length">
          {segment.endsAt - segment.startsAt} min
          {task.defaultDuration?.kind === 'natural' && ' · runs to completion'}
        </span>
      </button>
      {color !== null && <span className="project-dot" data-color={color} aria-hidden="true" />}
      {extra}
    </div>
  );
}

/**
 * A placement's clock, set here rather than on the task.
 *
 * Blank means "follow whatever is above you", which is the honest default: in
 * a sequence, most things happen when the thing before them finishes, and
 * saying so is better than inventing a time you'd then have to maintain.
 */
function Clock({
  segment,
  onSet,
}: {
  segment: DaySegment & { startsAt: number };
  /** `null` outside build mode: the clock is a reading, not a control. */
  onSet: ((startTime: string | null) => void) | null;
}) {
  const [editing, setEditing] = useState(false);
  const anchored = 'anchored' in segment ? segment.anchored : false;
  const timed = segment.timed;

  if (onSet === null) {
    return (
      <span
        className={
          anchored ? 'path-point__clock' : 'path-point__clock path-point__clock--follows'
        }
      >
        {timed ? clockOf(segment.startsAt) : '—'}
      </span>
    );
  }

  if (editing) {
    return (
      <span className="path-point__clock path-point__clock--editing">
        <input
          type="time"
          autoFocus
          defaultValue={anchored ? clockOf(segment.startsAt) : ''}
          aria-label="Start time"
          onBlur={(event) => {
            onSet(event.target.value === '' ? null : event.target.value);
            setEditing(false);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
            if (event.key === 'Escape') setEditing(false);
          }}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={
        anchored
          ? 'path-point__clock'
          : 'path-point__clock path-point__clock--follows'
      }
      aria-label={anchored ? 'Change the start time' : 'Pin a start time'}
      onClick={() => setEditing(true)}
    >
      {/* Nothing above this is pinned to a clock yet, so the day genuinely
          doesn't know when it happens. */}
      {timed ? clockOf(segment.startsAt) : '—'}
    </button>
  );
}

/**
 * Rest, drawn as the gap it is.
 *
 * It has no check and never will: rest is not a thing you complete, and giving
 * it a box to tick would quietly turn resting into another item owed.
 */
function RestBlock({ block, entry, onEditEntry, building }: BlockProps & { entry: RestEntry }) {
  const [editing, setEditing] = useState(false);
  const segment = block.segments[0];
  const minutes = segment && 'minutes' in segment ? segment.minutes : entry.minutes;

  const face = (
    <>
      <span className="path-rest__mark" aria-hidden="true">
        ↳
      </span>
      <span className="path-rest__label">
        Rest{entry.label ? ` // ${entry.label}` : ''} · {minutes} min
      </span>
      <span className="path-rest__flag">no action</span>
    </>
  );

  /* Outside build mode it isn't a control at all — there is nothing to press
     and nothing rest would ever ask of you. */
  if (!building) {
    return (
      <div
        className="path-rest"
        style={{ '--rest-minutes': minutes } as React.CSSProperties}
      >
        {face}
      </div>
    );
  }

  if (editing) {
    return (
      <RestForm
        label={entry.label ?? ''}
        minutes={minutes}
        onSubmit={(label, mins) => {
          onEditEntry(entry.id, { label, minutes: mins });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <button
      type="button"
      className="path-rest"
      /* The sanctioned inline style: a genuinely computed value. */
      style={{ '--rest-minutes': minutes } as React.CSSProperties}
      onClick={() => setEditing(true)}
    >
      {face}
    </button>
  );
}

function RestForm({
  label,
  minutes,
  onSubmit,
  onCancel,
}: {
  label: string;
  minutes: number;
  onSubmit: (label: string | null, minutes: number) => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(label);
  const [mins, setMins] = useState(minutes);

  return (
    <form
      className="insert-form insert-form--inline"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft.trim() === '' ? null : draft.trim(), mins);
      }}
    >
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Shower, eat — or leave it blank"
        aria-label="What you're doing with the rest"
      />
      <NumberField value={mins} min={5} max={720} label="Minutes" onCommit={setMins} />
      <button type="submit" className="btn btn--primary">
        Save
      </button>
      <button type="button" className="btn btn--quiet" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}

/**
 * The hole you left for whatever the week turns up.
 *
 * What goes in it is offered from the *whole* library rather than from what
 * lands today, and that is the entire point of it: the errand that appeared
 * this morning was never scheduled for this morning. Everywhere else on the
 * day, only what already lands can be placed — this is the one door for
 * everything else, which is why it exists.
 */
function WildcardBlock({
  block,
  entry,
  tasks,
  projects,
  log,
  selectedTaskId,
  onSelectTask,
  onClearEntry,
  onEditEntry,
  onFillWildcard,
  building,
}: BlockProps & { entry: WildcardEntry }) {
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState(false);
  const held = log?.wildcards?.[entry.id] ?? [];

  const offer: LandingTask[] = tasks
    .filter((task) => !task.archived && task.completedAt === null && !held.includes(task.id))
    .map((task) => ({ task, placed: 0 }));

  const picker = picking && (
    <TaskPicker
      landing={offer}
      emptyNote="Nothing left in the library to put here."
      onPick={(taskId) => {
        onFillWildcard(entry.id, [...held, taskId]);
        setPicking(false);
      }}
      onCancel={() => setPicking(false)}
    />
  );

  const addButton = (
    <button
      type="button"
      className="path-wildcard__add brackets"
      aria-expanded={picking}
      onClick={() => setPicking(!picking)}
    >
      + Put something here
    </button>
  );

  const segments = block.segments;
  const empty = segments.length === 0 || segments[0]?.kind === 'opening';

  if (empty) {
    const opening = segments[0];
    const minutes = opening && 'minutes' in opening ? opening.minutes : entry.minutes;

    if (editing) {
      return (
        <WildcardForm
          startTime={entry.startTime ?? ''}
          minutes={minutes}
          onSubmit={(startTime, mins) => {
            onEditEntry(entry.id, { startTime, minutes: mins });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      );
    }

    const face = (
      <>
        <span className="path-rest__mark" aria-hidden="true">
          ↳
        </span>
        <span className="path-rest__label">
          Open{entry.startTime ? ` // ${entry.startTime}` : ''} · {minutes} min
        </span>
        <span className="path-rest__flag">yours</span>
      </>
    );

    return (
      <div className="path-wildcard">
        {building ? (
          <button
            type="button"
            className="path-rest path-rest--open"
            style={{ '--rest-minutes': minutes } as React.CSSProperties}
            onClick={() => setEditing(true)}
          >
            {face}
          </button>
        ) : (
          <div
            className="path-rest path-rest--open"
            style={{ '--rest-minutes': minutes } as React.CSSProperties}
          >
            {face}
          </div>
        )}
        {addButton}
        {picker}
      </div>
    );
  }

  return (
    <div className="path-wildcard path-wildcard--filled">
      <p className="path-wildcard__tag">Wildcard</p>
      {segments.map((segment, position) =>
        segment.kind !== 'point' ? null : (
          <Point
            key={segment.entryId}
            segment={segment}
            projects={projects}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
            onClearEntry={onClearEntry}
            clock={
              /*
               * Only the first one is settable. The clock belongs to the
               * wildcard, not to what happens to be inside it today — letting
               * the third thing set it would silently move the whole block,
               * and tomorrow that thing may not be there at all.
               */
              position === 0 ? (
                <Clock
                  segment={segment}
                  onSet={
                    building ? (startTime) => onEditEntry(entry.id, { startTime }) : null
                  }
                />
              ) : (
                <span className="path-point__clock path-point__clock--follows">
                  {segment.timed ? clockOf(segment.startsAt) : '—'}
                </span>
              )
            }
            extra={
              <button
                type="button"
                className="entry-tools__button"
                aria-label={`Take ${segment.task.title} out of the wildcard`}
                onClick={() => onFillWildcard(entry.id, held.filter((id) => id !== segment.task.id))}
              >
                ✕
              </button>
            }
          />
        ),
      )}
      {addButton}
      {picker}
    </div>
  );
}

function WildcardForm({
  startTime,
  minutes,
  onSubmit,
  onCancel,
}: {
  startTime: string;
  minutes: number;
  onSubmit: (startTime: string | null, minutes: number) => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState(startTime);
  const [mins, setMins] = useState(minutes);

  return (
    <form
      className="insert-form insert-form--inline"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(time === '' ? null : time, mins);
      }}
    >
      <input
        type="time"
        autoFocus
        value={time}
        onChange={(event) => setTime(event.target.value)}
        aria-label="Start time"
      />
      <NumberField value={mins} min={5} max={720} label="Minutes" onCommit={setMins} />
      <button type="submit" className="btn btn--primary">
        Save
      </button>
      <button type="button" className="btn btn--quiet" onClick={onCancel}>
        Cancel
      </button>
    </form>
  );
}
