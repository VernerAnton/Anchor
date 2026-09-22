import { describe, expect, it } from 'vitest';
import type { Duration, Project, Recurrence, Task } from '../types/task';
import type { DayLog, PathEntry, PathPattern } from '../types/path';
import type { DayPoint } from './day';
import {
  DEFAULT_MINUTES,
  buildDay,
  clearedCount,
  dayBlocks,
  dayEndsAt,
  effectiveDuration,
  clockProgress,
  headlineFor,
  landingByProject,
  landingOn,
  pointState,
  pointsOf,
  routeStanding,
} from './day';

// 2026-08-10 is a Monday (weekday 1); 2026-08-15 is a Saturday (weekday 6).
const MON = '2026-08-10';
const SAT = '2026-08-15';

let counter = 0;
function task(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `t${counter}`,
    title: `Task ${counter}`,
    notes: null,
    projectId: null,
    parentId: null,
    priority: null,
    dueDate: MON,
    recurrence: null,
    completedAt: null,
    order: counter,
    archived: false,
    firstMove: null,
    type: null,
    defaultDuration: null,
    labelIds: [],
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
    ...overrides,
  };
}

const fixed = (minutes: number): Duration => ({ kind: 'fixed', minutes });

const weekly = (weekdays: number[]): Recurrence =>
  ({
    freq: 'weekly',
    weekdays,
    count: 'weeks',
    interval: 1,
    anchor: null,
    mode: 'grid',
    until: null,
    remaining: null,
  }) as Recurrence;

const entry = (id: string, taskId: string, startTime: string | null = null): PathEntry => ({
  kind: 'task',
  id,
  taskId,
  startTime,
});
const rest = (id: string, minutes: number, label: string | null = null): PathEntry => ({
  kind: 'rest',
  id,
  label,
  minutes,
});
const wild = (id: string, minutes: number, startTime: string | null = null): PathEntry => ({
  kind: 'wildcard',
  id,
  startTime,
  minutes,
});

function pattern(entriesByWeekday: Record<string, PathEntry[]>): PathPattern {
  return { days: entriesByWeekday, schemaVersion: 1, version: 1, updatedAt: 0 };
}

function log(overrides: Partial<DayLog> = {}): DayLog {
  return {
    date: MON,
    cleared: {},
    started: {},
    wildcards: {},
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
    ...overrides,
  };
}

/** Compact shape of a day, for readable assertions. */
function shape(tasks: Task[], p: PathPattern | null, l: DayLog | null, date = MON) {
  return buildDay(tasks, p, l, date).map((s) => {
    if (s.kind === 'point') return { point: s.task.title, at: s.startsAt, to: s.endsAt };
    if (s.kind === 'rest') return { rest: s.label ?? '', minutes: s.minutes, at: s.startsAt };
    return { opening: s.minutes, at: s.startsAt };
  });
}

describe('effectiveDuration', () => {
  it('uses a fixed length', () => {
    expect(effectiveDuration(task({ defaultDuration: fixed(45) }))).toBe(45);
  });

  it('uses the estimate for a runs-to-completion task', () => {
    expect(
      effectiveDuration(task({ defaultDuration: { kind: 'natural', estimateMinutes: 25 } })),
    ).toBe(25);
  });

  // "Show it, fill the gaps" — a task with no length still occupies the day.
  it('falls back to the default when nothing is set', () => {
    expect(effectiveDuration(task())).toBe(DEFAULT_MINUTES);
  });

  it('falls back rather than letting a zero length stall the sequence', () => {
    expect(effectiveDuration(task({ defaultDuration: fixed(0) }))).toBe(DEFAULT_MINUTES);
    expect(effectiveDuration(task({ defaultDuration: fixed(-30) }))).toBe(DEFAULT_MINUTES);
  });
});

describe('buildDay', () => {
  it('is empty with no pattern at all', () => {
    expect(buildDay([task()], null, null, MON)).toEqual([]);
  });

  it('is empty for a weekday the pattern says nothing about', () => {
    const t = task({ recurrence: weekly([1, 6]), dueDate: null });
    expect(buildDay([t], pattern({ '1': [entry('e1', t.id)] }), null, SAT)).toEqual([]);
  });

  it('places an entry at its own clock time', () => {
    const gym = task({ title: 'Gym', defaultDuration: fixed(55) });
    const p = pattern({ '1': [entry('e1', gym.id, '07:00')] });
    expect(shape([gym], p, null)).toEqual([{ point: 'Gym', at: 420, to: 475 }]);
  });

  // The case that motivated optional times.
  it('lets an entry with no clock follow the one before it', () => {
    const gym = task({ title: 'Gym', defaultDuration: fixed(55) });
    const shower = task({ title: 'Shower', defaultDuration: fixed(15) });
    const p = pattern({ '1': [entry('e1', gym.id, '07:00'), entry('e2', shower.id)] });
    expect(shape([gym, shower], p, null)).toEqual([
      { point: 'Gym', at: 420, to: 475 },
      { point: 'Shower', at: 475, to: 490 },
    ]);
  });

  it('follows the pattern order, not the tasks’ own order', () => {
    const a = task({ title: 'A', order: 9, defaultDuration: fixed(10) });
    const b = task({ title: 'B', order: 1, defaultDuration: fixed(10) });
    const p = pattern({ '1': [entry('e1', a.id), entry('e2', b.id)] });
    expect(shape([a, b], p, null).map((s) => ('point' in s ? s.point : '?'))).toEqual(['A', 'B']);
  });

  // The headline case for entry-level times.
  it('runs the same task at different times on different weekdays', () => {
    const gym = task({ title: 'Gym', recurrence: weekly([1, 6]), dueDate: null, defaultDuration: fixed(60) });
    const p = pattern({
      '1': [entry('e-mon', gym.id, '07:00')],
      '6': [entry('e-sat', gym.id, '10:00')],
    });
    expect(shape([gym], p, null, MON)).toEqual([{ point: 'Gym', at: 420, to: 480 }]);
    expect(shape([gym], p, null, SAT)).toEqual([{ point: 'Gym', at: 600, to: 660 }]);
  });

  it('places the same task twice on one day, as two independent points', () => {
    const study = task({ title: 'Study', defaultDuration: fixed(25) });
    const p = pattern({ '1': [entry('am', study.id, '09:00'), entry('pm', study.id, '14:00')] });
    const points = pointsOf(buildDay([study], p, null, MON));
    expect(points).toHaveLength(2);
    expect(points.map((pt) => pt.entryId)).toEqual(['am', 'pm']);
    expect(points.map((pt) => pt.startsAt)).toEqual([540, 840]);
  });

  it('clears one placement without touching the other', () => {
    const study = task({ title: 'Study', defaultDuration: fixed(25) });
    const p = pattern({ '1': [entry('am', study.id, '09:00'), entry('pm', study.id, '14:00')] });
    const points = pointsOf(buildDay([study], p, log({ cleared: { am: 1234 } }), MON));
    expect(points.map((pt) => pt.completedAt)).toEqual([1234, null]);
  });

  it('never reads completion from the task itself', () => {
    const done = task({ title: 'Done', completedAt: 999, dueDate: null, recurrence: weekly([1]) });
    const p = pattern({ '1': [entry('e1', done.id)] });
    // A completed task no longer lands, so it drops out entirely rather than
    // showing as a ticked point.
    expect(buildDay([done], p, null, MON)).toEqual([]);
  });

  it('skips an entry whose task no longer lands on this day', () => {
    // Placed on Mondays, but the rule now says Saturdays only.
    const moved = task({ title: 'Moved', recurrence: weekly([6]), dueDate: null });
    const p = pattern({ '1': [entry('e1', moved.id)] });
    expect(buildDay([moved], p, null, MON)).toEqual([]);
  });

  it('skips an entry pointing at a task that is gone or archived', () => {
    const gone = task({ title: 'Gone', archived: true });
    const p = pattern({ '1': [entry('e1', gone.id), entry('e2', 'no-such-task')] });
    expect(buildDay([gone], p, null, MON)).toEqual([]);
  });
});

describe('rest', () => {
  it('is the gap: a placed card with its own length', () => {
    const a = task({ title: 'A', defaultDuration: fixed(30) });
    const b = task({ title: 'B', defaultDuration: fixed(30) });
    const p = pattern({ '1': [entry('e1', a.id, '07:00'), rest('r1', 40, 'Shower, eat'), entry('e2', b.id)] });
    expect(shape([a, b], p, null)).toEqual([
      { point: 'A', at: 420, to: 450 },
      { rest: 'Shower, eat', minutes: 40, at: 450 },
      { point: 'B', at: 490, to: 520 },
    ]);
  });

  it('carries no label when none was given', () => {
    const p = pattern({ '1': [rest('r1', 20)] });
    const segments = buildDay([], p, null, MON);
    expect(segments[0]).toMatchObject({ kind: 'rest', label: null, minutes: 20 });
  });

  it('falls back to a sane length rather than standing still', () => {
    const p = pattern({ '1': [rest('r1', 0)] });
    expect(buildDay([], p, null, MON)[0]).toMatchObject({ minutes: DEFAULT_MINUTES });
  });
});

describe('wildcards', () => {
  it('reads as open time when nothing was put in it', () => {
    const p = pattern({ '1': [wild('w1', 45, '16:00')] });
    expect(shape([], p, null)).toEqual([{ opening: 45, at: 960 }]);
  });

  it('expands into the tasks put in it that day, in order', () => {
    const bank = task({ title: 'Call the bank', defaultDuration: fixed(10) });
    const doc = task({ title: 'Call the doctor', defaultDuration: fixed(10) });
    const p = pattern({ '1': [wild('w1', 45, '16:00')] });
    const l = log({ wildcards: { w1: [bank.id, doc.id] } });
    expect(shape([bank, doc], p, l)).toEqual([
      { point: 'Call the bank', at: 960, to: 970 },
      { point: 'Call the doctor', at: 970, to: 980 },
    ]);
  });

  // Its contents don't need to land on the day — that's the whole point of it.
  it('takes a backlog task with no schedule of its own', () => {
    const bike = task({ title: 'Fix the bike light', dueDate: null, defaultDuration: fixed(20) });
    const p = pattern({ '1': [wild('w1', 45)] });
    expect(shape([bike], p, log({ wildcards: { w1: [bike.id] } }))).toEqual([
      { point: 'Fix the bike light', at: 0, to: 20 },
    ]);
  });

  it('completes each of its contents independently', () => {
    const a = task({ title: 'A', dueDate: null, defaultDuration: fixed(10) });
    const b = task({ title: 'B', dueDate: null, defaultDuration: fixed(10) });
    const p = pattern({ '1': [wild('w1', 45)] });
    const l = log({ wildcards: { w1: [a.id, b.id] }, cleared: { [`w1:${a.id}`]: 555 } });
    expect(pointsOf(buildDay([a, b], p, l, MON)).map((pt) => pt.completedAt)).toEqual([555, null]);
  });

  // The same task can be both placed in the pattern and dropped in a wildcard.
  it('marks its contents as having come from a wildcard', () => {
    const a = task({ title: 'A' });
    const p = pattern({ '1': [wild('w1', 45), entry('e1', a.id)] });
    const l = log({ wildcards: { w1: [a.id] } });
    expect(pointsOf(buildDay([a], p, l, MON)).map((pt) => pt.fromWildcard)).toEqual([true, false]);
  });

  it('ignores a filled task that has since been deleted', () => {
    const p = pattern({ '1': [wild('w1', 30)] });
    expect(shape([], p, log({ wildcards: { w1: ['gone'] } }))).toEqual([{ opening: 30, at: 0 }]);
  });
});

describe('times before anything is pinned to a clock', () => {
  it('reports leading entries as untimed rather than as midnight', () => {
    const a = task({ title: 'A', defaultDuration: fixed(20) });
    const b = task({ title: 'B' });
    const p = pattern({ '1': [entry('e1', a.id), entry('e2', b.id, '09:00')] });
    expect(pointsOf(buildDay([a, b], p, null, MON)).map((pt) => pt.timed)).toEqual([false, true]);
  });

  it('marks everything timed once the first entry carries a clock', () => {
    const a = task({ title: 'A', defaultDuration: fixed(30) });
    const b = task({ title: 'B' });
    const p = pattern({ '1': [entry('e1', a.id, '07:00'), entry('e2', b.id)] });
    expect(pointsOf(buildDay([a, b], p, null, MON)).map((pt) => pt.timed)).toEqual([true, true]);
  });

  it('treats a malformed stored time as no time rather than failing', () => {
    const a = task({ title: 'A', defaultDuration: fixed(20) });
    const p = pattern({ '1': [entry('e1', a.id, 'half seven')] });
    expect(shape([a], p, null)).toEqual([{ point: 'A', at: 0, to: 20 }]);
  });
});

// Deliberate: the collision is shown, not silently tidied away.
describe('overlaps', () => {
  it('draws an entry at its stated time even when that overlaps', () => {
    const long = task({ title: 'Long', defaultDuration: fixed(120) });
    const early = task({ title: 'Early', defaultDuration: fixed(30) });
    const p = pattern({ '1': [entry('e1', long.id, '07:00'), entry('e2', early.id, '07:30')] });
    expect(shape([long, early], p, null)).toEqual([
      { point: 'Long', at: 420, to: 540 },
      { point: 'Early', at: 450, to: 480 },
    ]);
  });

  it('keeps following the furthest point reached', () => {
    const long = task({ title: 'Long', defaultDuration: fixed(120) });
    const early = task({ title: 'Early', defaultDuration: fixed(30) });
    const after = task({ title: 'After', defaultDuration: fixed(10) });
    const p = pattern({
      '1': [entry('e1', long.id, '07:00'), entry('e2', early.id, '07:30'), entry('e3', after.id)],
    });
    expect(shape([long, early, after], p, null)).toContainEqual({ point: 'After', at: 540, to: 550 });
  });
});

describe('landingOn', () => {
  it('offers only what the rules put on that day', () => {
    const monOnly = task({ title: 'Mon', recurrence: weekly([1]), dueDate: null });
    const satOnly = task({ title: 'Sat', recurrence: weekly([6]), dueDate: null });
    expect(landingOn([monOnly, satOnly], null, MON).map((l) => l.task.title)).toEqual(['Mon']);
    expect(landingOn([monOnly, satOnly], null, SAT).map((l) => l.task.title)).toEqual(['Sat']);
  });

  it('keeps a placed task in the list, counted', () => {
    const study = task({ title: 'Study' });
    const p = pattern({ '1': [entry('am', study.id), entry('pm', study.id)] });
    expect(landingOn([study], p, MON)).toEqual([{ task: study, placed: 2 }]);
  });

  it('counts zero for something landing but not yet placed', () => {
    const study = task({ title: 'Study' });
    expect(landingOn([study], pattern({ '1': [] }), MON)).toEqual([{ task: study, placed: 0 }]);
  });

  it('leaves out backlog, archived and finished tasks', () => {
    const backlog = task({ title: 'Backlog', dueDate: null });
    const archived = task({ title: 'Archived', archived: true });
    const done = task({ title: 'Done', completedAt: 1 });
    expect(landingOn([backlog, archived, done], null, MON)).toEqual([]);
  });
});

describe('dayEndsAt and clearedCount', () => {
  it('ends when the last thing finishes', () => {
    const a = task({ title: 'A', defaultDuration: fixed(30) });
    const b = task({ title: 'B', defaultDuration: fixed(45) });
    const p = pattern({ '1': [entry('e1', a.id, '07:00'), entry('e2', b.id, '09:00')] });
    expect(dayEndsAt(buildDay([a, b], p, null, MON))).toBe(585);
  });

  it('is null for an empty day', () => {
    expect(dayEndsAt(buildDay([], null, null, MON))).toBeNull();
  });

  it('counts only what was cleared', () => {
    const a = task({ title: 'A' });
    const b = task({ title: 'B' });
    const p = pattern({ '1': [entry('e1', a.id), entry('e2', b.id)] });
    expect(clearedCount(buildDay([a, b], p, log({ cleared: { e1: 1 } }), MON))).toBe(1);
  });
});

describe('dayBlocks', () => {
  it('pairs every entry with what it drew, keeping its position', () => {
    const walk = task({ recurrence: weekly([1]) });
    const blocks = dayBlocks(
      [walk],
      pattern({ '1': [entry('e1', walk.id), rest('e2', 20, 'Coffee')] }),
      null,
      MON,
    );
    expect(blocks.map((b) => [b.index, b.entry.id, b.segments.length])).toEqual([
      [0, 'e1', 1],
      [1, 'e2', 1],
    ]);
  });

  // The entry stays in the pattern, drawing nothing, ready for the rule to
  // come back. Its position has to survive so an insert after it still lands
  // where it looks like it will.
  it('gives an entry whose rule misses the day no segments and keeps its index', () => {
    const gym = task({ recurrence: weekly([6]) });
    const cook = task({ recurrence: weekly([1]) });
    const blocks = dayBlocks(
      [gym, cook],
      pattern({ '1': [entry('e1', gym.id), entry('e2', cook.id)] }),
      null,
      MON,
    );
    expect(blocks.map((b) => [b.index, b.segments.length])).toEqual([
      [0, 0],
      [1, 1],
    ]);
  });

  it('collects every point of a filled wildcard under its one entry', () => {
    const a = task();
    const b = task();
    const blocks = dayBlocks(
      [a, b],
      pattern({ '1': [wild('w1', 60)] }),
      log({ wildcards: { w1: [a.id, b.id] } }),
      MON,
    );
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.segments.map((s) => s.kind)).toEqual(['point', 'point']);
  });

  it('is empty for a day the pattern never arranged', () => {
    expect(dayBlocks([], pattern({ '1': [] }), null, MON)).toEqual([]);
    expect(dayBlocks([], null, null, MON)).toEqual([]);
  });
});

describe('landingByProject', () => {
  const project = (id: string, name: string, order: number): Project => ({
    id,
    name,
    colorId: 'steel',
    parentId: null,
    order,
    archived: false,
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
  });

  const health = project('p-health', 'Health', 0);
  const study = project('p-study', 'Study', 1);

  it('files the day\'s tasks into the library\'s own sections', () => {
    const walk = task({ projectId: health.id, recurrence: weekly([1]) });
    const notes = task({ projectId: study.id, recurrence: weekly([1]) });
    const loose = task({ projectId: null, recurrence: weekly([1]) });

    const sections = landingByProject(
      landingOn([walk, notes, loose], null, MON),
      [health, study],
    );
    expect(sections.map((s) => [s.title, s.tasks.map((t) => t.task.title)])).toEqual([
      ['All tasks', [loose.title]],
      ['Health', [walk.title]],
      ['Study', [notes.title]],
    ]);
  });

  // The sections are the shape of the place, not a result set — a project that
  // vanishes on a quiet day is a project you can't file into that day.
  it('keeps every section even when nothing lands in it', () => {
    const sections = landingByProject([], [health, study]);
    expect(sections.map((s) => s.title)).toEqual(['All tasks', 'Health', 'Study']);
    expect(sections.every((s) => s.tasks.length === 0)).toBe(true);
  });

  it('carries how many times each one is already placed', () => {
    const walk = task({ projectId: health.id, recurrence: weekly([1]) });
    const sections = landingByProject(
      landingOn([walk], pattern({ '1': [entry('e1', walk.id), entry('e2', walk.id)] }), MON),
      [health],
    );
    expect(sections[1]!.tasks[0]).toMatchObject({ placed: 2 });
  });

  it('leaves out a task whose rule does not cover the day', () => {
    const gym = task({ projectId: health.id, recurrence: weekly([6]) });
    const sections = landingByProject(landingOn([gym], null, MON), [health]);
    expect(sections[1]!.tasks).toEqual([]);
    expect(landingByProject(landingOn([gym], null, SAT), [health])[1]!.tasks).toHaveLength(1);
  });
});

describe('pointState', () => {
  const at = (startsAt: number, endsAt: number, overrides: Partial<DayPoint> = {}): DayPoint => ({
    kind: 'point',
    entryId: 'e1',
    task: task(),
    startsAt,
    endsAt,
    anchored: true,
    timed: true,
    completedAt: null,
    fromWildcard: false,
    ...overrides,
  });

  it('is cleared whenever it was cleared, whatever the clock says', () => {
    expect(pointState(at(540, 600, { completedAt: 1 }), 60)).toBe('cleared');
    expect(pointState(at(540, 600, { completedAt: 1 }), 1400)).toBe('cleared');
  });

  it('is live while the clock is inside it', () => {
    expect(pointState(at(540, 600), 540)).toBe('live');
    expect(pointState(at(540, 600), 599)).toBe('live');
  });

  it('is queued before it and passed after it', () => {
    expect(pointState(at(540, 600), 539)).toBe('queued');
    expect(pointState(at(540, 600), 600)).toBe('passed');
  });

  // A day you are not standing in cannot be behind.
  it('is only ever queued on a day that is not today', () => {
    expect(pointState(at(540, 600), null)).toBe('queued');
  });

  // The clock can't have gone past something that isn't at a time.
  it('is queued when nothing above it is pinned to a clock', () => {
    expect(pointState(at(0, 60, { timed: false }), 1400)).toBe('queued');
  });
});

describe('clockProgress', () => {
  const point = (startsAt: number, endsAt: number, timed = true): DayPoint => ({
    kind: 'point',
    entryId: 'e1',
    task: task(),
    startsAt,
    endsAt,
    anchored: true,
    timed,
    completedAt: null,
    fromWildcard: false,
  });

  it('runs nothing to all of it across the window', () => {
    expect(clockProgress(point(540, 600), 540)).toBe(0);
    expect(clockProgress(point(540, 600), 570)).toBeCloseTo(0.5);
    expect(clockProgress(point(540, 600), 600)).toBe(1);
  });

  it('clamps rather than running past either end', () => {
    expect(clockProgress(point(540, 600), 100)).toBe(0);
    expect(clockProgress(point(540, 600), 1400)).toBe(1);
  });

  it('is nothing without a clock to read', () => {
    expect(clockProgress(point(540, 600), null)).toBe(0);
    expect(clockProgress(point(540, 600, false), 570)).toBe(0);
  });
});

describe('routeStanding and its headline', () => {
  const walk = task({ defaultDuration: fixed(30) });
  const gym = task({ defaultDuration: fixed(30) });
  const cook = task({ defaultDuration: fixed(30) });
  const three = pattern({
    '1': [
      entry('e1', walk.id, '06:00'),
      entry('e2', gym.id, '09:00'),
      entry('e3', cook.id, '18:00'),
    ],
  });
  const standing = (l: DayLog | null, now: number | null) =>
    routeStanding(buildDay([walk, gym, cook], three, l, MON), now);

  it('counts what is behind, running and still ahead', () => {
    // 09:10 — the first is behind, the second is running, the third is ahead.
    const s = standing(null, 550);
    expect(s).toMatchObject({ passed: 1, queued: 1, cleared: 0, total: 3 });
    expect(s.live?.task.id).toBe(gym.id);
    expect(s.next?.task.id).toBe(cook.id);
  });

  it('never counts a cleared point as behind', () => {
    const s = standing(log({ cleared: { e1: 1, e2: 2 } }), 550);
    expect(s).toMatchObject({ cleared: 2, passed: 0, queued: 1 });
    expect(s.live).toBeNull();
  });

  it('has nothing behind it on a day that is not today', () => {
    expect(standing(null, null)).toMatchObject({ passed: 0, queued: 3, live: null });
  });

  it('reads the route back, never the person', () => {
    expect(headlineFor(standing(null, 550))).toEqual({ lead: 'One point', emphasis: 'behind you.' });
    expect(headlineFor(standing(null, 1000))).toEqual({
      lead: 'Two points',
      emphasis: 'behind you.',
    });
    expect(headlineFor(standing(null, 360))).toEqual({ lead: 'You are on', emphasis: 'the marker.' });
    expect(headlineFor(standing(null, 0))).toEqual({ lead: 'Route', emphasis: 'ready.' });
    expect(headlineFor(standing(log({ cleared: { e1: 1, e2: 2, e3: 3 } }), 1400))).toEqual({
      lead: 'Route',
      emphasis: 'clear.',
    });
    expect(headlineFor(routeStanding([], 600))).toEqual({
      lead: 'Nothing on',
      emphasis: 'the route.',
    });
  });

  // A running total that a gap can reset is a streak by another name.
  it('says nothing that could read as a score', () => {
    const words = Object.values(headlineFor(standing(null, 1000))).join(' ').toLowerCase();
    for (const banned of ['missed', 'failed', 'streak', 'behind schedule', 'late']) {
      expect(words).not.toContain(banned);
    }
  });
});
