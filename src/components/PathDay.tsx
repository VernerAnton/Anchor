import { Fragment, useState } from 'react';
import type { Project, Task } from '../types/task';
import type { DayLog, PathEntry, PathPattern, RestEntry, WildcardEntry } from '../types/path';
import type { DayBlock, DayPoint, DaySegment, LandingTask, PointState } from '../lib/day';
import type { EntryChanges } from '../store/mutations';
import { MONTH_NAMES, dayOf, weekdayOf } from '../lib/dates';
import {
  clockProgress,
  dayBlocks,
  headlineFor,
  landingOn,
  pointState,
  routeStanding,
} from '../lib/day';
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
  /** Minutes since midnight, or null on any day that isn't today. */
  now: number | null;
  selectedTaskId: string | null;
  onOpenCalendar: () => void;
  onSelectTask: (id: string) => void;
  /** Clears one placement, by entry id — never the task itself. */
  onClearEntry: (entryId: string, cleared: boolean) => void;
  /** Stamps the moment you began. Says nothing about finishing. */
  onStartEntry: (entryId: string, started: boolean) => void;
  onInsertEntry: (index: number, entry: PathEntry) => void;
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

const STATE_WORD: Record<PointState, string> = {
  cleared: 'Cleared',
  live: 'Live',
  passed: 'Passed',
  queued: 'Queued',
};

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
 * The day, as a route — drawn to `design/anchor-path-neonnoir.html`.
 *
 * A spine down the left with a station at every point, times on the rail
 * outside it, notched panels alongside. What differs from the reference is the
 * spine's polarity, deliberately: there, everything done glows and everything
 * ahead is dark. Here it is the other way round, so attention falls on what is
 * still in front of you and finished work recedes instead of competing for it.
 *
 * Every state on it — cleared, live, passed, queued — is read off the clock at
 * render time and stored nowhere. `passed` is the position of the marker, not
 * a verdict: start something late and it goes back to live, and tomorrow the
 * whole reading begins again from nothing.
 *
 * The same component serves the builder. What build mode adds is the ability
 * to change the week; what it takes away is the route's own commentary, which
 * is about today and has nothing to say while you are arranging a Tuesday.
 */
export function PathDay({
  tasks,
  projects,
  pattern,
  log,
  date,
  today,
  now,
  selectedTaskId,
  onOpenCalendar,
  onSelectTask,
  onClearEntry,
  onStartEntry,
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
  const segments = blocks.flatMap((block) => block.segments);
  const standing = routeStanding(segments, now);
  const headline = headlineFor(standing);

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

  /*
   * Station numbers run across the whole day, counting points rather than
   * entries: rest isn't a station, and a wildcard holding three things is
   * three of them. Numbered here rather than in the loop so a wildcard's
   * contents keep counting instead of all sharing their entry's number.
   */
  const stations = new Map<string, number>();
  for (const block of blocks) {
    for (const segment of block.segments) {
      if (segment.kind === 'point') stations.set(segment.entryId, stations.size + 1);
    }
  }

  return (
    <section className="path-day-view" aria-label="The day's route">
      <header className="path-day-view__head">
        <button type="button" className="path-day-view__date" onClick={onOpenCalendar}>
          <span className="path-day-view__heading">{heading}</span>
          <CalendarIcon />
          <span className="visually-hidden">Open the four-week calendar</span>
        </button>
        {action}
      </header>

      {!building && blocks.length > 0 && (
        <div className="route-head">
          <h2 className="route-head__line">
            {headline.lead}
            <br />
            <em>{headline.emphasis}</em>
          </h2>
          <p className="route-head__sub">
            {standing.total} {standing.total === 1 ? 'point' : 'points'} // {standing.cleared}{' '}
            cleared
            {now !== null && <span className="route-head__marker"> // marker tracking live</span>}
          </p>
        </div>
      )}

      {blocks.length === 0 && (
        <p className="path-day-view__clear">
          Nothing on the path today. That's a legitimate answer, not an empty one.
        </p>
      )}

      <ol className="path-points">
        {gap(0)}
        {blocks.map((block) => {
          return (
            <Fragment key={block.entry.id}>
              <Block
                block={block}
                blocks={blocks}
                stations={stations}
                tasks={tasks}
                projects={projects}
                landing={landing}
                log={log}
                now={now}
                selectedTaskId={selectedTaskId}
                onSelectTask={onSelectTask}
                onClearEntry={onClearEntry}
                onStartEntry={onStartEntry}
                onMoveEntry={onMoveEntry}
                onRemoveEntry={onRemoveEntry}
                onEditEntry={onEditEntry}
                onFillWildcard={onFillWildcard}
                building={building}
              />
              {gap(block.index + 1)}
            </Fragment>
          );
        })}
      </ol>

      {!building && blocks.length > 0 && (
        <p className="route-foot">
          Route set before the day // <b>zero morning decisions</b>
          <br />
          Fall behind the marker → the path holds // <b>no reset</b>
        </p>
      )}
    </section>
  );
}

interface BlockProps {
  block: DayBlock;
  blocks: DayBlock[];
  /** Entry id → its number on the route. Rest and openings aren't in it. */
  stations: Map<string, number>;
  tasks: Task[];
  projects: Project[];
  landing: LandingTask[];
  log: DayLog | null;
  now: number | null;
  selectedTaskId: string | null;
  onSelectTask: (id: string) => void;
  onClearEntry: (entryId: string, cleared: boolean) => void;
  onStartEntry: (entryId: string, started: boolean) => void;
  onMoveEntry: (from: number, to: number) => void;
  onRemoveEntry: (entryId: string) => void;
  onEditEntry: (entryId: string, changes: EntryChanges) => void;
  onFillWildcard: (entryId: string, taskIds: string[]) => void;
  building: boolean;
}

/**
 * One station on the route, whichever of the three kinds it is.
 *
 * Draggable for the mouse in build mode, with move buttons doing the same job
 * for everything else — HTML drag doesn't exist on touch, and this is a phone
 * app as much as a desktop one.
 */
function Block(props: BlockProps) {
  const { block, blocks, building, now, onMoveEntry, onRemoveEntry } = props;
  const [dragging, setDragging] = useState(false);

  // Neighbours by what's on screen, not by stored position: stepping over an
  // entry that draws nothing would look like the button did nothing at all.
  const seat = blocks.indexOf(block);
  const above = blocks[seat - 1];
  const below = blocks[seat + 1];

  const first = block.segments[0];
  const state =
    first !== undefined && first.kind === 'point' ? pointState(first, now) : null;

  const classes = ['path-node'];
  if (state !== null) classes.push(`path-node--${state}`);
  if (block.entry.kind === 'rest') classes.push('path-node--rest');
  if (block.entry.kind === 'wildcard') classes.push('path-node--open');
  if (dragging) classes.push('path-node--dragging');

  return (
    <li
      className={classes.join(' ')}
      draggable={building}
      onDragStart={(event) => {
        event.dataTransfer.setData(ENTRY_DRAG, String(block.index));
        event.dataTransfer.effectAllowed = 'move';
        setDragging(true);
      }}
      onDragEnd={() => setDragging(false)}
    >
      {block.entry.kind === 'task' && <TaskNode {...props} />}
      {block.entry.kind === 'rest' && <RestNode {...props} entry={block.entry} />}
      {block.entry.kind === 'wildcard' && <WildcardNode {...props} entry={block.entry} />}

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

function TaskNode(props: BlockProps) {
  const { block, now, onEditEntry, building } = props;
  const segment = block.segments[0];
  if (segment === undefined || segment.kind !== 'point') return null;

  return (
    <Point
      {...props}
      segment={segment}
      clock={
        <Clock
          segment={segment}
          now={now}
          onSet={building ? (startTime) => onEditEntry(block.entry.id, { startTime }) : null}
        />
      }
    />
  );
}

/**
 * A station: the pip on the spine, the time on the rail, and the panel.
 *
 * The pip is the checkbox. It fills when the point is cleared, which is what
 * it does on the route anyway — making it the control adds nothing to the
 * drawing and saves putting a second tick-shaped thing next to a tick.
 */
function Point({
  segment,
  stations,
  projects,
  log,
  now,
  selectedTaskId,
  onSelectTask,
  onClearEntry,
  onStartEntry,
  clock,
  extra,
}: BlockProps & {
  segment: DayPoint;
  clock: React.ReactNode;
  extra?: React.ReactNode;
}) {
  const { task } = segment;
  const state = pointState(segment, now);
  const done = state === 'cleared';
  const color = projects.find((p) => p.id === task.projectId)?.colorId ?? null;
  const startedAt = log?.started?.[segment.entryId] ?? null;
  const run = Math.round(clockProgress(segment, now) * 100);

  return (
    <>
      {clock}
      <button
        type="button"
        className="path-node__pip"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `Reopen ${task.title}` : `Clear ${task.title}`}
        onClick={() => onClearEntry(segment.entryId, !done)}
      />
      {state === 'live' && <span className="path-node__here">◄ You are here</span>}

      <div className="path-card">
        <div className="path-card__kicker">
          <span>
            Node {String(stations.get(segment.entryId) ?? 0).padStart(2, '0')}
            {task.type !== null && ` // ${task.type}`}
          </span>
          <span className={state === 'live' ? 'path-card__state path-card__state--live' : 'path-card__state'}>
            {STATE_WORD[state]}
          </span>
        </div>

        <button
          type="button"
          className={
            task.id === selectedTaskId ? 'path-card__title path-card__title--selected' : 'path-card__title'
          }
          onClick={() => onSelectTask(task.id)}
        >
          {task.title}
        </button>

        <div className="path-card__length">
          <span>
            {segment.endsAt - segment.startsAt} min
            {task.defaultDuration?.kind === 'natural' && ' // runs to completion'}
          </span>
          {/* The sanctioned inline style: a genuinely computed value. This is
              the clock's progress through the window, never a claim about how
              much of the work is done. */}
          <span
            className="path-card__rail"
            style={{ '--run': `${run}%` } as React.CSSProperties}
            aria-hidden="true"
          />
          {color !== null && <span className="project-dot" data-color={color} aria-hidden="true" />}
        </div>

        {/*
         * The clock went past and nothing was written down. Said plainly and
         * once, with the half that matters — it is still there, and the day
         * has not closed it off.
         */}
        {state === 'passed' && (
          <p className="path-card__note">Not logged // still on the route</p>
        )}

        {/*
         * The one button on the route, and only where it can be pressed
         * truthfully: on the thing that is running, before you have started
         * it. It records that you began — it does not mark anything done,
         * which you would notice the moment you pressed it.
         */}
        {state === 'live' && startedAt === null && (
          <button
            type="button"
            className="path-card__start"
            onClick={() => onStartEntry(segment.entryId, true)}
          >
            {task.firstMove ?? 'Begin'} ►
          </button>
        )}
        {startedAt !== null && !done && (
          <p className="path-card__running">
            Running since {clockOf(new Date(startedAt).getHours() * 60 + new Date(startedAt).getMinutes())}
          </p>
        )}

        {extra}
      </div>
    </>
  );
}

/**
 * A placement's clock, on the rail outside the spine.
 *
 * Blank means "follow whatever is above you", which is the honest default: in
 * a sequence, most things happen when the thing before them finishes, and
 * saying so is better than inventing a time you'd then have to maintain.
 */
function Clock({
  segment,
  now,
  onSet,
}: {
  segment: DaySegment & { startsAt: number };
  now: number | null;
  onSet: ((startTime: string | null) => void) | null;
}) {
  const [editing, setEditing] = useState(false);
  const anchored = 'anchored' in segment ? segment.anchored : false;
  const live =
    segment.kind === 'point' && pointState(segment, now) === 'live';

  const face = (
    <>
      {segment.timed ? clockOf(segment.startsAt) : '—'}
      {live && (
        <>
          <br />
          <b>Now</b>
        </>
      )}
    </>
  );

  const classes = ['path-node__time'];
  if (!anchored) classes.push('path-node__time--follows');

  if (onSet === null) return <span className={classes.join(' ')}>{face}</span>;

  if (editing) {
    return (
      <span className="path-node__time path-node__time--editing">
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
      className={classes.join(' ')}
      aria-label={anchored ? 'Change the start time' : 'Pin a start time'}
      onClick={() => setEditing(true)}
    >
      {face}
    </button>
  );
}

/**
 * Rest, drawn as the gap it is.
 *
 * It has no check and never will: rest is not a thing you complete, and giving
 * it a box to tick would quietly turn resting into another item owed. Its pip
 * is a smaller mark for the same reason — it is on the route, but it is not a
 * station.
 */
function RestNode({ block, entry, onEditEntry, building }: BlockProps & { entry: RestEntry }) {
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

  if (editing) {
    return (
      <>
        <span className="path-node__pip path-node__pip--rest" aria-hidden="true" />
        <RestForm
          label={entry.label ?? ''}
          minutes={minutes}
          onSubmit={(label, mins) => {
            onEditEntry(entry.id, { label, minutes: mins });
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      </>
    );
  }

  return (
    <>
      <span className="path-node__pip path-node__pip--rest" aria-hidden="true" />
      {building ? (
        <button
          type="button"
          className="path-card path-card--rest"
          /* The sanctioned inline style: a genuinely computed value. */
          style={{ '--rest-minutes': minutes } as React.CSSProperties}
          onClick={() => setEditing(true)}
        >
          {face}
        </button>
      ) : (
        <div
          className="path-card path-card--rest"
          style={{ '--rest-minutes': minutes } as React.CSSProperties}
        >
          {face}
        </div>
      )}
    </>
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
function WildcardNode(props: BlockProps & { entry: WildcardEntry }) {
  const { block, entry, tasks, log, now, onEditEntry, onFillWildcard, building } = props;
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

    if (editing) {
      return (
        <>
          <span className="path-node__pip path-node__pip--rest" aria-hidden="true" />
          <WildcardForm
            startTime={entry.startTime ?? ''}
            minutes={minutes}
            onSubmit={(startTime, mins) => {
              onEditEntry(entry.id, { startTime, minutes: mins });
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        </>
      );
    }

    return (
      <>
        <span className="path-node__pip path-node__pip--rest" aria-hidden="true" />
        <div className="path-wildcard">
          {building ? (
            <button
              type="button"
              className="path-card path-card--rest path-card--open"
              style={{ '--rest-minutes': minutes } as React.CSSProperties}
              onClick={() => setEditing(true)}
            >
              {face}
            </button>
          ) : (
            <div
              className="path-card path-card--rest path-card--open"
              style={{ '--rest-minutes': minutes } as React.CSSProperties}
            >
              {face}
            </div>
          )}
          {addButton}
          {picker}
        </div>
      </>
    );
  }

  return (
    <>
      <span className="path-node__pip path-node__pip--rest" aria-hidden="true" />
      <div className="path-wildcard path-wildcard--filled">
        <p className="path-wildcard__tag">Wildcard</p>
        {segments.map((segment, position) =>
          segment.kind !== 'point' ? null : (
            <div className="path-node path-node--inset" key={segment.entryId}>
              <Point
                {...props}
                segment={segment}
                clock={
                  /*
                   * Only the first one is settable. The clock belongs to the
                   * wildcard, not to what happens to be inside it today —
                   * letting the third thing set it would silently move the
                   * whole block, and tomorrow that thing may not be there.
                   */
                  <Clock
                    segment={segment}
                    now={now}
                    onSet={
                      building && position === 0
                        ? (startTime) => onEditEntry(entry.id, { startTime })
                        : null
                    }
                  />
                }
                extra={
                  <button
                    type="button"
                    className="path-card__drop"
                    aria-label={`Take ${segment.task.title} out of the wildcard`}
                    onClick={() =>
                      onFillWildcard(
                        entry.id,
                        held.filter((id) => id !== segment.task.id),
                      )
                    }
                  >
                    Take it out
                  </button>
                }
              />
            </div>
          ),
        )}
        {addButton}
        {picker}
      </div>
    </>
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
