import type { Duration, Project, Task } from '../types/task';
import type { DayLog, PathEntry, PathPattern, RestEntry, WildcardEntry } from '../types/path';
import { groupByProject, landsOn } from './pathGrid';
import { minutesOfClock } from './dayTimes';
import { weekdayOf } from './dates';

/**
 * A day, built from the pattern.
 *
 * The pattern says what sits where; a task's repeat rule says which days it
 * lands on; the day's log says what actually happened. This walks all three
 * and produces the sequence to draw. Nothing here is stored — it recomputes on
 * every render.
 *
 * **The sequence is the truth; times are anchors on it.** An entry carrying a
 * clock starts at its clock; one without starts when the previous thing ends.
 * That is what makes "gym at 07:00, then shower, then emails" expressible when
 * only the first of the three has a time.
 */

/** What a task occupies when it has no duration of its own. */
export const DEFAULT_MINUTES = 15;

export interface DayPoint {
  kind: 'point';
  /** The entry that placed it — the identity that completion is recorded against. */
  entryId: string;
  /** The live task, not a copy. Renaming it renames this. */
  task: Task;
  startsAt: number;
  endsAt: number;
  /** True when this placement carried a clock rather than following on. */
  anchored: boolean;
  /**
   * Whether `startsAt` is a real wall-clock time. False for anything before
   * the day's first anchored entry: it follows what's above it, but nothing
   * above it is pinned, so the day genuinely doesn't know when it happens.
   */
  timed: boolean;
  /** When it was cleared, from the day's log. Never read from the task. */
  completedAt: number | null;
  /** Set when this point came out of a wildcard rather than the pattern. */
  fromWildcard: boolean;
}

export interface DayRest {
  kind: 'rest';
  entryId: string;
  label: string | null;
  startsAt: number;
  minutes: number;
  timed: boolean;
}

/**
 * A wildcard nobody filled. Drawn as open time rather than an empty box
 * demanding contents — having a wildcard should never itself be a task.
 */
export interface DayOpening {
  kind: 'opening';
  entryId: string;
  startsAt: number;
  minutes: number;
  timed: boolean;
}

export type DaySegment = DayPoint | DayRest | DayOpening;

export function durationMinutes(duration: Duration | null): number | null {
  if (duration === null) return null;
  const minutes = duration.kind === 'fixed' ? duration.minutes : duration.estimateMinutes;
  // A zero or negative length would make the sequence stand still.
  return minutes > 0 ? minutes : null;
}

/**
 * "50m", "1h 30m" — a length compact enough to sit at the end of a list row,
 * or null when the task hasn't been given one.
 *
 * The tilde on a runs-to-completion task is the whole distinction between a
 * slot and a guess, and it is the shortest way to say it: `50m` is time you
 * have set aside, `~50m` is time you expect it to take.
 */
export function durationLabel(duration: Duration | null): string | null {
  const minutes = durationMinutes(duration);
  if (minutes === null) return null;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const body = hours === 0 ? `${rest}m` : rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  return duration?.kind === 'natural' ? `~${body}` : body;
}

/** How long a task runs. Unset stays unset on the task; the day fills in. */
export function effectiveDuration(task: Task): number {
  return durationMinutes(task.defaultDuration) ?? DEFAULT_MINUTES;
}

/** The entries the pattern holds for the weekday this date falls on. */
export function entriesForDate(pattern: PathPattern | null, date: string): PathEntry[] {
  return pattern?.days?.[String(weekdayOf(date))] ?? [];
}

/**
 * Every task landing on a date, with how many times the pattern already places
 * it. This is what the builder offers to drag from — so a task whose rule
 * doesn't cover a day simply isn't there to be dropped on it, and the drop
 * that would have needed a guess can't be attempted.
 *
 * Placed tasks stay in the list, marked. Removing them would be the only thing
 * standing between you and placing the same task twice, and there is no reason
 * to want that.
 */
export interface LandingTask {
  task: Task;
  placed: number;
}

export function landingOn(
  tasks: Task[],
  pattern: PathPattern | null,
  date: string,
): LandingTask[] {
  const entries = entriesForDate(pattern, date);
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.kind === 'task') counts.set(entry.taskId, (counts.get(entry.taskId) ?? 0) + 1);
  }
  return tasks
    .filter((task) => landsOn(task, date))
    .map((task) => ({ task, placed: counts.get(task.id) ?? 0 }));
}

export interface LandingSection {
  key: string;
  title: string;
  /** `null` for the catch-all section holding everything unfiled. */
  project: Project | null;
  tasks: LandingTask[];
}

/**
 * What lands on a date, in the library's own project sections.
 *
 * Deliberately the same sections as the full library rather than one flat
 * list of the day's tasks. Which project something belongs to is half of what
 * tells you what it is — "Deep study block" under Study and under Admin would
 * be two different jobs — and a flat list throws that away exactly when you
 * are deciding what the day should be.
 *
 * Every section stays, empty or not. They are the shape of the place rather
 * than a result set, and a project that disappears on a quiet Tuesday is a
 * project you can't file anything into that day.
 */
export function landingByProject(
  landing: LandingTask[],
  projects: Project[],
): LandingSection[] {
  const placed = new Map(landing.map((option) => [option.task.id, option.placed]));
  return groupByProject(
    landing.map((option) => option.task),
    projects,
  ).map((section) => ({
    ...section,
    tasks: section.tasks.map((task) => ({ task, placed: placed.get(task.id) ?? 0 })),
  }));
}

function restMinutes(entry: RestEntry | WildcardEntry): number {
  return entry.minutes > 0 ? entry.minutes : DEFAULT_MINUTES;
}

/**
 * The date as an ordered run of points, rest and openings.
 *
 * A task entry is skipped when its rule no longer covers this date. The entry
 * is left in the pattern rather than cleaned up: a rule may come back, and
 * silently discarding a placement because a rule changed for one week would
 * throw away arranging you did deliberately.
 *
 * An anchored entry whose clock falls before the running time still starts at
 * the time it states — the collision is drawn honestly rather than quietly
 * tidied, because tidying it would hide the reason to fix it.
 */
export function buildDay(
  tasks: Task[],
  pattern: PathPattern | null,
  log: DayLog | null,
  date: string,
): DaySegment[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const cleared = log?.cleared ?? {};
  const segments: DaySegment[] = [];
  let clock: number | null = null;
  // Until something is pinned to a clock, the day has a sequence but no times.
  let onTheClock = false;

  const place = (anchor: number | null, length: number) => {
    const startsAt = anchor ?? clock ?? 0;
    onTheClock = onTheClock || anchor !== null;
    // Never walk backwards: an overlapping entry is drawn where it says it is,
    // but the next thing still follows the furthest point reached.
    const endsAt = startsAt + length;
    clock = Math.max(clock ?? endsAt, endsAt);
    return { startsAt, endsAt };
  };

  for (const entry of entriesForDate(pattern, date)) {
    if (entry.kind === 'rest') {
      const { startsAt } = place(null, restMinutes(entry));
      segments.push({
        kind: 'rest',
        entryId: entry.id,
        label: entry.label,
        startsAt,
        minutes: restMinutes(entry),
        timed: onTheClock,
      });
      continue;
    }

    if (entry.kind === 'wildcard') {
      const filled = (log?.wildcards?.[entry.id] ?? [])
        .map((id) => byId.get(id))
        .filter((task): task is Task => task !== undefined && !task.archived);

      if (filled.length === 0) {
        const anchor = minutesOfClock(entry.startTime);
        const { startsAt } = place(anchor, restMinutes(entry));
        segments.push({
          kind: 'opening',
          entryId: entry.id,
          startsAt,
          minutes: restMinutes(entry),
          timed: onTheClock,
        });
        continue;
      }

      // Filled: the wildcard's own clock anchors the first one, and the rest
      // run on from it, so it stays a sequence rather than a pile to choose from.
      let first = true;
      for (const task of filled) {
        const anchor = first ? minutesOfClock(entry.startTime) : null;
        const { startsAt, endsAt } = place(anchor, effectiveDuration(task));
        segments.push({
          kind: 'point',
          entryId: `${entry.id}:${task.id}`,
          task,
          startsAt,
          endsAt,
          anchored: anchor !== null,
          timed: onTheClock,
          completedAt: cleared[`${entry.id}:${task.id}`] ?? null,
          fromWildcard: true,
        });
        first = false;
      }
      continue;
    }

    const task = byId.get(entry.taskId);
    if (task === undefined || task.archived || !landsOn(task, date)) continue;

    const anchor = minutesOfClock(entry.startTime);
    const { startsAt, endsAt } = place(anchor, effectiveDuration(task));
    segments.push({
      kind: 'point',
      entryId: entry.id,
      task,
      startsAt,
      endsAt,
      anchored: anchor !== null,
      timed: onTheClock,
      completedAt: cleared[entry.id] ?? null,
      fromWildcard: false,
    });
  }

  return segments;
}

/**
 * One entry, together with whatever it drew. This is what the builder edits:
 * segments are for looking at, entries are what you move and remove.
 *
 * The two don't line up one-to-one, which is the whole reason this exists. A
 * filled wildcard is one entry and several points. A task entry whose rule
 * stopped covering the date is one entry and nothing at all — it stays in the
 * pattern, invisible, ready for the rule to come back.
 */
export interface DayBlock {
  /** Position in the weekday's list — what an insert or a move refers to. */
  index: number;
  entry: PathEntry;
  segments: DaySegment[];
}

export function dayBlocks(
  tasks: Task[],
  pattern: PathPattern | null,
  log: DayLog | null,
  date: string,
): DayBlock[] {
  const segments = buildDay(tasks, pattern, log, date);
  return entriesForDate(pattern, date).map((entry, index) => ({
    index,
    entry,
    // A wildcard's points are keyed `<entry>:<task>`, so the prefix collects
    // them; ids never contain a colon, so nothing else can match by accident.
    segments: segments.filter(
      (segment) => segment.entryId === entry.id || segment.entryId.startsWith(`${entry.id}:`),
    ),
  }));
}

/** Just the points, for anything counting or checking what's on a day. */
export function pointsOf(segments: DaySegment[]): DayPoint[] {
  return segments.filter((s): s is DayPoint => s.kind === 'point');
}

/**
 * Where a point stands against the clock. Derived on every render and stored
 * nowhere — which is the whole point of it. `passed` is a reading of the time,
 * not a record of a failure, and it goes back to `live` if you start the thing
 * late. Nothing about it survives the day.
 */
export type PointState = 'cleared' | 'live' | 'passed' | 'queued';

/**
 * `now` is minutes since midnight, or null on any day that isn't today —
 * yesterday has no "now" in it, and neither does next Tuesday. Without one,
 * everything not already cleared is simply queued: a day you are not standing
 * in cannot be behind.
 */
export function pointState(point: DayPoint, now: number | null): PointState {
  if (point.completedAt !== null) return 'cleared';
  // Nothing above it is pinned to a clock, so it has a place in the order but
  // no hour — the clock can't have gone past something that isn't at a time.
  if (now === null || !point.timed) return 'queued';
  if (now >= point.endsAt) return 'passed';
  if (now >= point.startsAt) return 'live';
  return 'queued';
}

/**
 * How far the clock has run through a point, 0 to 1. Only ever the clock's
 * progress through the window you set aside — never a claim about how much of
 * the work is done, which the app has no way of knowing and no business
 * guessing at.
 */
export function clockProgress(point: DayPoint, now: number | null): number {
  if (now === null || !point.timed) return 0;
  const length = point.endsAt - point.startsAt;
  if (length <= 0) return now >= point.startsAt ? 1 : 0;
  return Math.min(1, Math.max(0, (now - point.startsAt) / length));
}

/** Where the day stands as a whole — what the route's headline reads from. */
export interface RouteStanding {
  cleared: number;
  /** Points the clock has gone past that aren't cleared. A count, not a verdict. */
  passed: number;
  queued: number;
  total: number;
  /** What's running right now, if the clock is inside something. */
  live: DayPoint | null;
  /** The next thing queued, whether or not anything is live. */
  next: DayPoint | null;
}

export function routeStanding(segments: DaySegment[], now: number | null): RouteStanding {
  const points = pointsOf(segments);
  const standing: RouteStanding = {
    cleared: 0,
    passed: 0,
    queued: 0,
    total: points.length,
    live: null,
    next: null,
  };

  for (const point of points) {
    const state = pointState(point, now);
    if (state === 'cleared') standing.cleared += 1;
    else if (state === 'passed') standing.passed += 1;
    else if (state === 'live') standing.live ??= point;
    else {
      standing.queued += 1;
      standing.next ??= point;
    }
  }

  return standing;
}

/**
 * The line at the top of the route, in two parts — the second is the one that
 * carries the colour.
 *
 * Every one of these is a statement about the route, never about you. "Two
 * points behind you" is where the marker is; it is not a score, it does not
 * accumulate, and tomorrow it starts again at nothing. The path holds its
 * shape whatever the number says — which is the sentence the whole app is
 * built around, and the reason none of this is stored.
 */
export interface Headline {
  lead: string;
  emphasis: string;
}

export function headlineFor(standing: RouteStanding): Headline {
  const { total, cleared, passed, live } = standing;

  if (total === 0) return { lead: 'Nothing on', emphasis: 'the route.' };
  if (cleared === total) return { lead: 'Route', emphasis: 'clear.' };

  if (passed > 0) {
    const count = passed === 1 ? 'One point' : `${numberWord(passed)} points`;
    return { lead: count, emphasis: 'behind you.' };
  }

  if (live !== null) return { lead: 'You are on', emphasis: 'the marker.' };
  if (cleared > 0) return { lead: 'Route', emphasis: 'running.' };
  return { lead: 'Route', emphasis: 'ready.' };
}

/**
 * Small numbers read as words in a headline; past that the digits are clearer
 * than "seventeen" and the sentence has stopped being a sentence anyway.
 */
function numberWord(n: number): string {
  const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  return words[n] ?? String(n);
}

/** When the day's last thing finishes, or `null` for an empty day. */
export function dayEndsAt(segments: DaySegment[]): number | null {
  const points = pointsOf(segments);
  return points.length === 0 ? null : Math.max(...points.map((p) => p.endsAt));
}

/** How many of the day's points were cleared. */
export function clearedCount(segments: DaySegment[]): number {
  return pointsOf(segments).filter((p) => p.completedAt !== null).length;
}
