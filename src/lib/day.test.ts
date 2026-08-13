import { describe, expect, it } from 'vitest';
import type { Duration, Recurrence, Task } from '../types/task';
import { DEFAULT_MINUTES, buildDay, dayEndsAt, effectiveDuration, pointsOf } from './day';

// 2026-08-10 is a Monday; 2026-08-15 is a Saturday.
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
    startTime: null,
    weekdayTimes: {},
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

/** Compact shape of a day, for readable assertions. */
function shape(tasks: Task[], date = MON) {
  return buildDay(tasks, date).map((s) =>
    s.kind === 'point'
      ? { point: s.task.title, at: s.startsAt, to: s.endsAt }
      : { rest: s.minutes, at: s.startsAt },
  );
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
  it('is empty for a day with nothing on it', () => {
    expect(buildDay([], MON)).toEqual([]);
  });

  it('places an anchored task at its own clock time', () => {
    const gym = task({ title: 'Gym', startTime: '07:00', defaultDuration: fixed(55) });
    expect(shape([gym])).toEqual([{ point: 'Gym', at: 420, to: 475 }]);
  });

  // The case that motivated optional times.
  it('lets an untimed task follow the one before it', () => {
    const gym = task({ title: 'Gym', order: 1, startTime: '07:00', defaultDuration: fixed(55) });
    const shower = task({ title: 'Shower', order: 2, defaultDuration: fixed(15) });
    const email = task({ title: 'Email', order: 3, defaultDuration: fixed(30) });

    expect(shape([gym, shower, email])).toEqual([
      { point: 'Gym', at: 420, to: 475 },
      { point: 'Shower', at: 475, to: 490 },
      { point: 'Email', at: 490, to: 520 },
    ]);
  });

  it('fills a real gap with rest, and leaves none when things run back to back', () => {
    const first = task({ title: 'First', order: 1, startTime: '07:00', defaultDuration: fixed(30) });
    const gapped = task({ title: 'Later', order: 2, startTime: '08:00', defaultDuration: fixed(30) });
    expect(shape([first, gapped])).toEqual([
      { point: 'First', at: 420, to: 450 },
      { rest: 30, at: 450 },
      { point: 'Later', at: 480, to: 510 },
    ]);

    const tight = task({ title: 'Tight', order: 2, startTime: '07:30', defaultDuration: fixed(30) });
    expect(shape([first, tight])).toEqual([
      { point: 'First', at: 420, to: 450 },
      { point: 'Tight', at: 450, to: 480 },
    ]);
  });

  it('draws rest proportionally, so a long gap is a long gap', () => {
    const a = task({ title: 'A', order: 1, startTime: '06:00', defaultDuration: fixed(30) });
    const b = task({ title: 'B', order: 2, startTime: '07:30', defaultDuration: fixed(30) });
    const c = task({ title: 'C', order: 3, startTime: '08:15', defaultDuration: fixed(30) });
    const rests = buildDay([a, b, c], MON).filter((s) => s.kind === 'rest');
    expect(rests.map((r) => (r.kind === 'rest' ? r.minutes : 0))).toEqual([60, 15]);
  });

  // Deliberate: the collision is shown, not silently tidied away.
  it('shows an anchored task at its stated time even when that overlaps', () => {
    const long = task({ title: 'Long', order: 1, startTime: '07:00', defaultDuration: fixed(120) });
    const early = task({ title: 'Early', order: 2, startTime: '07:30', defaultDuration: fixed(30) });
    expect(shape([long, early])).toEqual([
      { point: 'Long', at: 420, to: 540 },
      { point: 'Early', at: 450, to: 480 },
    ]);
  });

  it('keeps following the furthest point reached after an overlap', () => {
    const long = task({ title: 'Long', order: 1, startTime: '07:00', defaultDuration: fixed(120) });
    const early = task({ title: 'Early', order: 2, startTime: '07:30', defaultDuration: fixed(30) });
    const after = task({ title: 'After', order: 3, defaultDuration: fixed(10) });
    // Long ends at 540; After follows that rather than Early's earlier 480.
    expect(shape([long, early, after])).toContainEqual({ point: 'After', at: 540, to: 550 });
  });

  it('opens the day at the first item when nothing carries a clock', () => {
    const a = task({ title: 'A', order: 1, defaultDuration: fixed(20) });
    const b = task({ title: 'B', order: 2, defaultDuration: fixed(20) });
    // Starts at zero without inventing a leading stretch of rest from midnight.
    expect(shape([a, b])).toEqual([
      { point: 'A', at: 0, to: 20 },
      { point: 'B', at: 20, to: 40 },
    ]);
  });

  it('sequences by order, not by the order tasks happen to arrive in', () => {
    const later = task({ title: 'Later', order: 9, defaultDuration: fixed(10) });
    const first = task({ title: 'First', order: 1, defaultDuration: fixed(10) });
    expect(shape([later, first]).map((s) => ('point' in s ? s.point : 'rest'))).toEqual([
      'First',
      'Later',
    ]);
  });

  it('uses the weekday override on the day it applies to', () => {
    const gym = task({
      title: 'Gym',
      dueDate: null,
      recurrence: weekly([1, 6]),
      startTime: '07:00',
      weekdayTimes: { '6': '10:00' },
      defaultDuration: fixed(60),
    });
    expect(shape([gym], MON)).toEqual([{ point: 'Gym', at: 420, to: 480 }]);
    expect(shape([gym], SAT)).toEqual([{ point: 'Gym', at: 600, to: 660 }]);
  });

  it('treats a malformed stored time as no time, rather than failing', () => {
    const broken = task({ title: 'Broken', startTime: 'half seven', defaultDuration: fixed(20) });
    expect(shape([broken])).toEqual([{ point: 'Broken', at: 0, to: 20 }]);
  });

  it('includes a task with nothing but a title', () => {
    const bare = task({ title: 'Bare' });
    expect(shape([bare])).toEqual([{ point: 'Bare', at: 0, to: DEFAULT_MINUTES }]);
  });

  it('leaves out anything not landing on the date', () => {
    const elsewhere = task({ title: 'Elsewhere', dueDate: '2026-09-01' });
    const archived = task({ title: 'Archived', archived: true });
    const done = task({ title: 'Done', completedAt: 1 });
    expect(buildDay([elsewhere, archived, done], MON)).toEqual([]);
  });

  it('marks which points carry their own clock', () => {
    const anchored = task({ title: 'A', order: 1, startTime: '09:00' });
    const following = task({ title: 'B', order: 2 });
    expect(pointsOf(buildDay([anchored, following], MON)).map((p) => p.anchored)).toEqual([
      true,
      false,
    ]);
  });

  it('carries the live task through, so the view can read its other fields', () => {
    const gym = task({ title: 'Gym', firstMove: 'Bag by the door' });
    expect(pointsOf(buildDay([gym], MON))[0]!.task.firstMove).toBe('Bag by the door');
  });

  it('never emits rest with no length', () => {
    const a = task({ order: 1, startTime: '07:00', defaultDuration: fixed(30) });
    const b = task({ order: 2, startTime: '07:30', defaultDuration: fixed(30) });
    const rests = buildDay([a, b], MON).filter((s) => s.kind === 'rest');
    expect(rests).toEqual([]);
  });
});

describe('dayEndsAt', () => {
  it('is when the last thing finishes', () => {
    const a = task({ order: 1, startTime: '07:00', defaultDuration: fixed(30) });
    const b = task({ order: 2, startTime: '09:00', defaultDuration: fixed(45) });
    expect(dayEndsAt(buildDay([a, b], MON))).toBe(585);
  });

  it('is null for an empty day', () => {
    expect(dayEndsAt(buildDay([], MON))).toBeNull();
  });
});
