import type { Duration, Task } from '../types/task';
import { landsOn } from './pathGrid';
import { minutesOnDate } from './dayTimes';

/**
 * A day, as a sequence.
 *
 * Everything here is derived and nothing is stored. `buildDay` is called on
 * every render and answers only "given these tasks and their rules, what does
 * this date look like". Freezing a finished day into a record that can't
 * change is a real requirement — a past day has to be able to say truthfully
 * what happened — but that belongs with the ledger, and inventing stored day
 * documents before the shape of a day is settled is exactly the mistake that
 * cost the last attempt.
 *
 * **The sequence is the truth; times are anchors on it.** Tasks are ordered
 * first, then walked: anything carrying a clock starts at its clock, anything
 * without one starts the moment the previous thing ends. That's what makes
 * "gym at 07:00, then shower, then emails" expressible when only the first of
 * the three has a time.
 */

/** What a task occupies when it has no duration of its own. */
export const DEFAULT_MINUTES = 15;

export interface DayPoint {
  kind: 'point';
  /**
   * The live task, not a copy of its fields. A day is a view of the library,
   * so renaming a task changes today's view of it — which is correct until
   * days are frozen into records, at which point the record holds the copy.
   */
  task: Task;
  /** Minutes from midnight. */
  startsAt: number;
  endsAt: number;
  /** True when the task carried a clock for this date rather than following on. */
  anchored: boolean;
}

/**
 * Rest is the gap, given a name. It has no completable-shaped field and never
 * will — its whole job is to exist and be legitimate, not to be ticked off.
 */
export interface DayRest {
  kind: 'rest';
  startsAt: number;
  minutes: number;
}

export type DaySegment = DayPoint | DayRest;

/** How long a task runs. Unset stays unset on the task; the day fills in. */
export function effectiveDuration(task: Task): number {
  return durationMinutes(task.defaultDuration) ?? DEFAULT_MINUTES;
}

function durationMinutes(duration: Duration | null): number | null {
  if (duration === null) return null;
  const minutes = duration.kind === 'fixed' ? duration.minutes : duration.estimateMinutes;
  // A zero or negative length would make the sequence stand still.
  return minutes > 0 ? minutes : null;
}

/**
 * The tasks landing on this date, in sequence order. Ordering is `task.order`
 * for now — whether rearranging a day should rewrite that shared field or earn
 * one of its own is a question for the day editor, and doesn't need answering
 * to compute a day.
 */
export function tasksOnDate(tasks: Task[], date: string): Task[] {
  return tasks.filter((task) => landsOn(task, date)).sort((a, b) => a.order - b.order);
}

/**
 * The date as an ordered run of points and the rest between them.
 *
 * An anchored task whose clock falls before the running time still starts at
 * the time it states — overlapping is shown honestly rather than quietly
 * shuffled, because the fix is to rearrange the day and hiding the collision
 * would hide the reason.
 */
export function buildDay(tasks: Task[], date: string): DaySegment[] {
  const segments: DaySegment[] = [];
  let clock: number | null = null;

  for (const task of tasksOnDate(tasks, date)) {
    const anchor = minutesOnDate(task, date);
    // The first item with no clock simply opens the day: there is no invented
    // midnight to measure from, and so no leading stretch of rest.
    const startsAt = anchor ?? clock ?? 0;

    if (clock !== null && startsAt > clock) {
      segments.push({ kind: 'rest', startsAt: clock, minutes: startsAt - clock });
    }

    const endsAt = startsAt + effectiveDuration(task);
    segments.push({ kind: 'point', task, startsAt, endsAt, anchored: anchor !== null });
    // Never walk backwards: an overlapping point is drawn where it says it is,
    // but the next thing still follows the furthest point reached.
    clock = Math.max(clock ?? endsAt, endsAt);
  }

  return segments;
}

/** Just the points, for anything counting or checking what's on a day. */
export function pointsOf(segments: DaySegment[]): DayPoint[] {
  return segments.filter((s): s is DayPoint => s.kind === 'point');
}

/** When the day's last thing finishes, or `null` for an empty day. */
export function dayEndsAt(segments: DaySegment[]): number | null {
  const points = pointsOf(segments);
  return points.length === 0 ? null : Math.max(...points.map((p) => p.endsAt));
}
