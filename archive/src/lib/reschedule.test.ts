import { describe, expect, it } from 'vitest';
import type { Recurrence, Task } from '../types/task';
import { rescheduleTask } from '../store/mutations';
import { nextOccurrence } from './recurrence';
import { rescheduleOptions } from './reschedule';

let n = 0;
function task(overrides: Partial<Task> = {}): Task {
  n += 1;
  return {
    id: `t${n}`,
    title: `Task ${n}`,
    notes: null,
    projectId: null,
    parentId: null,
    priority: null,
    dueDate: null,
    recurrence: null,
    completedAt: null,
    order: n,
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

/**
 * September 2026: the 7th is a Monday, so the weekday names in these tests
 * line up with the dates without anyone having to check a calendar.
 */
const MON = '2026-09-07';
const TUE = '2026-09-08';
const WED = '2026-09-09';
const THU = '2026-09-10';

/** Every other weekday — the rule the whole re-phasing question came from. */
function everyOtherWeekday(anchor: string): Recurrence {
  return {
    freq: 'weekly',
    weekdays: [1, 2, 3, 4, 5],
    count: 'occurrences',
    interval: 2,
    anchor,
    mode: 'grid',
    until: null,
    remaining: null,
  };
}

describe('rescheduling', () => {
  it('sets the due date', () => {
    const moved = rescheduleTask(task({ dueDate: MON }), TUE);
    expect(moved.dueDate).toBe(TUE);
  });

  it('leaves a task without a rule alone beyond its date', () => {
    const moved = rescheduleTask(task({ dueDate: MON }), TUE);
    expect(moved.recurrence).toBeNull();
  });

  it('bumps the version so the write can be ordered', () => {
    const before = task({ dueDate: MON, version: 4 });
    expect(rescheduleTask(before, TUE).version).toBe(5);
  });

  it('keeps the rule and re-phases it to the new date', () => {
    const before = task({ dueDate: MON, recurrence: everyOtherWeekday(MON) });
    const after = rescheduleTask(before, TUE);

    expect(after.recurrence).toMatchObject({
      freq: 'weekly',
      weekdays: [1, 2, 3, 4, 5],
      count: 'occurrences',
      interval: 2,
      anchor: TUE,
    });
  });

  /**
   * The case the feature exists for: every other weekday, moved Mon → Tue,
   * next lands on Thursday. Held to the old Monday phase it would have said
   * Wednesday — a day later than the move, which is not what "every other"
   * means to anybody.
   */
  it('moves every other weekday from Mon to Tue, Thu', () => {
    const before = task({ dueDate: MON, recurrence: everyOtherWeekday(MON) });
    expect(nextOccurrence(before.recurrence!, MON)).toBe(WED);

    const after = rescheduleTask(before, TUE);
    expect(nextOccurrence(after.recurrence!, TUE)).toBe(THU);
  });

  it('re-phases every other week to the week it was moved into', () => {
    const weekly: Recurrence = {
      freq: 'weekly',
      weekdays: [2],
      count: 'weeks',
      interval: 2,
      anchor: '2026-09-01',
      mode: 'grid',
      until: null,
      remaining: null,
    };
    // Was on the 1st's fortnight — the 15th, not the 8th.
    expect(nextOccurrence(weekly, '2026-09-01')).toBe('2026-09-15');

    const after = rescheduleTask(task({ dueDate: '2026-09-01', recurrence: weekly }), TUE);
    // Moved into the following week, so that week is now the on-week.
    expect(nextOccurrence(after.recurrence!, TUE)).toBe('2026-09-22');
  });

  it('leaves a from-completion rule unphased, since it never reads an anchor', () => {
    const rule: Recurrence = {
      freq: 'daily',
      interval: 3,
      anchor: MON,
      mode: 'fromCompletion',
      until: null,
      remaining: null,
    };
    const after = rescheduleTask(task({ dueDate: MON, recurrence: rule }), TUE);

    expect(after.recurrence?.mode).toBe('fromCompletion');
    expect(nextOccurrence(after.recurrence!, TUE)).toBe('2026-09-11');
  });
});

describe('the moves offered', () => {
  it('always offers tomorrow and a week out', () => {
    const options = rescheduleOptions(task(), MON);
    expect(options.map((o) => [o.id, o.date])).toEqual([
      ['tomorrow', TUE],
      ['week', '2026-09-14'],
    ]);
  });

  it('says where each one lands', () => {
    const [tomorrow] = rescheduleOptions(task(), MON);
    expect(tomorrow?.dateLabel).toBe('Tue 8 Sep');
  });

  it('offers the next occurrence only when the task repeats', () => {
    const plain = rescheduleOptions(task({ dueDate: MON }), MON);
    expect(plain.some((o) => o.id === 'occurrence')).toBe(false);

    const repeating = rescheduleOptions(
      task({ dueDate: MON, recurrence: everyOtherWeekday(MON) }),
      MON,
    );
    expect(repeating.find((o) => o.id === 'occurrence')?.date).toBe(WED);
  });

  /**
   * Measured from the same place completion measures from — the due date when
   * it's still ahead, today when it has gone by — so skipping and finishing
   * can never disagree about which occurrence comes next.
   */
  it('skips from the due date when that is still ahead', () => {
    const options = rescheduleOptions(
      task({ dueDate: '2026-09-11', recurrence: everyOtherWeekday(MON) }),
      MON,
    );
    expect(options.find((o) => o.id === 'occurrence')?.date).toBe('2026-09-15');
  });

  it('does not offer a skip once the rule has run out', () => {
    const ended = everyOtherWeekday(MON);
    const options = rescheduleOptions(
      task({ dueDate: MON, recurrence: { ...ended, until: MON } }),
      MON,
    );
    expect(options.some((o) => o.id === 'occurrence')).toBe(false);
  });
});
