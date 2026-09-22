import { describe, expect, it } from 'vitest';
import type { Project, Recurrence, Task } from '../types/task';
import { buildGrid, groupByProject, landsOn } from './pathGrid';
import { weekDates } from './dates';

// 2026-08-04 is a Tuesday; the Monday of its week is 2026-08-03.
const TUE = '2026-08-04';
const MON = '2026-08-03';

let counter = 0;
function task(overrides: Partial<Task> = {}): Task {
  counter += 1;
  return {
    id: `t${counter}`,
    title: 'Water the plants',
    notes: null,
    projectId: null,
    parentId: null,
    priority: null,
    dueDate: null,
    recurrence: null,
    completedAt: null,
    order: 0,
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

const weekly = (weekdays: number[], extra: Partial<Recurrence> = {}): Recurrence =>
  ({
    freq: 'weekly',
    weekdays,
    count: 'weeks',
    interval: 1,
    anchor: null,
    mode: 'grid',
    until: null,
    remaining: null,
    ...extra,
  }) as Recurrence;

describe('landsOn', () => {
  it('puts a task with no rule on its due date only', () => {
    const t = task({ dueDate: TUE });
    expect(landsOn(t, TUE)).toBe(true);
    expect(landsOn(t, '2026-08-05')).toBe(false);
  });

  it('puts a repeating task on every date its rule matches', () => {
    // Mon, Wed, Fri — the "four times a week is normal" shape.
    const t = task({ recurrence: weekly([1, 3, 5]) });
    expect(landsOn(t, MON)).toBe(true);
    expect(landsOn(t, TUE)).toBe(false);
    expect(landsOn(t, '2026-08-05')).toBe(true); // Wednesday
    expect(landsOn(t, '2026-08-07')).toBe(true); // Friday
  });

  it('keeps a repeating task on the same weekdays the following week', () => {
    const t = task({ recurrence: weekly([2]) });
    expect(landsOn(t, TUE)).toBe(true);
    expect(landsOn(t, '2026-08-11')).toBe(true);
    expect(landsOn(t, '2026-08-18')).toBe(true);
  });

  it('honours every-other-week', () => {
    const t = task({ recurrence: weekly([2], { interval: 2, anchor: TUE }) });
    expect(landsOn(t, TUE)).toBe(true);
    expect(landsOn(t, '2026-08-11')).toBe(false);
    expect(landsOn(t, '2026-08-18')).toBe(true);
  });

  it('leaves out archived and completed tasks', () => {
    expect(landsOn(task({ dueDate: TUE, archived: true }), TUE)).toBe(false);
    expect(landsOn(task({ dueDate: TUE, completedAt: 1 }), TUE)).toBe(false);
  });

  it('leaves out a task with neither a rule nor a due date', () => {
    expect(landsOn(task(), TUE)).toBe(false);
  });
});

describe('buildGrid', () => {
  it('starts on the Monday of the given date’s week, so no row is half a week', () => {
    const grid = buildGrid([], TUE, 4);
    expect(grid).toHaveLength(4);
    expect(grid[0]!.start).toBe(MON);
    expect(grid[1]!.start).toBe('2026-08-10');
    expect(grid[3]!.start).toBe('2026-08-24');
  });

  it('gives every week seven consecutive days, Monday first', () => {
    const grid = buildGrid([], TUE, 1);
    const week = grid[0]!;
    expect(week.days).toHaveLength(7);
    expect(week.days.map((d) => d.date)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
    expect(week.days.map((d) => d.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0]);
  });

  it('repeats a weekly task into every row', () => {
    const gym = task({ title: 'Gym', recurrence: weekly([1, 3, 5]) });
    const grid = buildGrid([gym], TUE, 4);
    for (const week of grid) {
      const hits = week.days.filter((d) => d.tasks.some((t) => t.id === gym.id));
      expect(hits.map((d) => d.weekday)).toEqual([1, 3, 5]);
    }
  });

  it('shows a one-off on exactly one day across the whole grid', () => {
    const taxes = task({ title: 'File taxes', dueDate: '2026-08-13' });
    const grid = buildGrid([taxes], TUE, 4);
    const days = grid.flatMap((w) => w.days).filter((d) => d.tasks.length > 0);
    expect(days.map((d) => d.date)).toEqual(['2026-08-13']);
  });

  it('orders a day’s tasks by their manual order', () => {
    const second = task({ title: 'Second', dueDate: TUE, order: 5 });
    const first = task({ title: 'First', dueDate: TUE, order: 1 });
    const grid = buildGrid([second, first], TUE, 1);
    const tuesday = grid[0]!.days.find((d) => d.date === TUE)!;
    expect(tuesday.tasks.map((t) => t.title)).toEqual(['First', 'Second']);
  });

  it('leaves days genuinely empty rather than inventing filler', () => {
    const grid = buildGrid([], TUE, 2);
    expect(grid.flatMap((w) => w.days).every((d) => d.tasks.length === 0)).toBe(true);
  });
});

function project(id: string, name: string, order = 0): Project {
  return {
    id,
    name,
    colorId: 'steel',
    parentId: null,
    order,
    archived: false,
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
  };
}

describe('groupByProject', () => {
  it('leads with All tasks, holding everything unfiled', () => {
    const loose = task({ title: 'Loose', dueDate: TUE });
    const filed = task({ title: 'Filed', projectId: 'p1', dueDate: TUE });
    const sections = groupByProject([loose, filed], [project('p1', 'Health')]);

    expect(sections[0]!.title).toBe('All tasks');
    expect(sections[0]!.project).toBeNull();
    expect(sections[0]!.tasks.map((t) => t.title)).toEqual(['Loose']);
    expect(sections[1]!.title).toBe('Health');
    expect(sections[1]!.tasks.map((t) => t.title)).toEqual(['Filed']);
  });

  it('keeps a project with nothing in it, so it can still be scrolled to', () => {
    const sections = groupByProject([], [project('p1', 'Health')]);
    expect(sections.map((s) => s.title)).toEqual(['All tasks', 'Health']);
    expect(sections[1]!.tasks).toEqual([]);
  });

  it('orders projects by their own order, then name', () => {
    const sections = groupByProject(
      [],
      [project('p2', 'Study', 2), project('p1', 'Health', 1), project('p3', 'Admin', 1)],
    );
    expect(sections.map((s) => s.title)).toEqual(['All tasks', 'Admin', 'Health', 'Study']);
  });

  it('leaves out archived projects, subtasks, and finished or archived tasks', () => {
    const sub = task({ title: 'Sub', parentId: 'parent', dueDate: TUE });
    const done = task({ title: 'Done', completedAt: 1 });
    const gone = task({ title: 'Gone', archived: true });
    const live = task({ title: 'Live', dueDate: TUE });
    const sections = groupByProject(
      [sub, done, gone, live],
      [project('p1', 'Health'), { ...project('p2', 'Old'), archived: true }],
    );

    expect(sections.map((s) => s.title)).toEqual(['All tasks', 'Health']);
    expect(sections[0]!.tasks.map((t) => t.title)).toEqual(['Live']);
  });

  it('includes a task with no date at all — the library is not the path', () => {
    const someday = task({ title: 'Someday' });
    const sections = groupByProject([someday], []);
    expect(sections[0]!.tasks.map((t) => t.title)).toEqual(['Someday']);
  });
});

describe('weekDates', () => {
  // The strip is the week you are in, so it has to agree with the calendar
  // above it — both start their weeks on a Monday.
  it('gives the seven days of a date’s week, Monday first', () => {
    expect(weekDates(TUE)).toEqual([
      '2026-08-03',
      '2026-08-04',
      '2026-08-05',
      '2026-08-06',
      '2026-08-07',
      '2026-08-08',
      '2026-08-09',
    ]);
  });

  it('gives the same week for every day in it', () => {
    const week = weekDates(MON);
    for (const day of week) expect(weekDates(day)).toEqual(week);
  });

  // Sunday is 0 in JS but the end of a Monday-based week, and getting that
  // backwards would put the strip a week out for one day in seven.
  it('treats Sunday as the end of its week, not the start of the next', () => {
    expect(weekDates('2026-08-09')[0]).toBe(MON);
  });

  it('carries across a month boundary', () => {
    expect(weekDates('2026-09-01')).toEqual([
      '2026-08-31',
      '2026-09-01',
      '2026-09-02',
      '2026-09-03',
      '2026-09-04',
      '2026-09-05',
      '2026-09-06',
    ]);
  });
});
