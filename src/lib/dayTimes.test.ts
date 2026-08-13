import { describe, expect, it } from 'vitest';
import type { Task } from '../types/task';
import { clockOf, minutesOfClock, minutesOnDate, timeOnDate } from './dayTimes';

// 2026-08-10 is a Monday (weekday 1); 2026-08-15 is a Saturday (weekday 6).
const MON = '2026-08-10';
const SAT = '2026-08-15';

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    title: 'Gym',
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
    startTime: null,
    weekdayTimes: {},
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
    ...overrides,
  };
}

describe('minutesOfClock', () => {
  it('reads a time', () => {
    expect(minutesOfClock('00:00')).toBe(0);
    expect(minutesOfClock('07:30')).toBe(450);
    expect(minutesOfClock('23:59')).toBe(1439);
  });

  it('accepts a single-digit hour, which is what some pickers emit', () => {
    expect(minutesOfClock('7:05')).toBe(425);
  });

  it('trims surrounding space rather than rejecting it', () => {
    expect(minutesOfClock(' 08:00 ')).toBe(480);
  });

  // Untrusted input: a bad value is "no time", never a thrown render.
  it('returns null for anything that is not a time', () => {
    for (const bad of ['', 'lunch', '7', '07:5', '07-30', '24:00', '07:60', '-1:00']) {
      expect(minutesOfClock(bad)).toBeNull();
    }
    expect(minutesOfClock(null)).toBeNull();
  });
});

describe('clockOf', () => {
  it('pads both halves', () => {
    expect(clockOf(0)).toBe('00:00');
    expect(clockOf(425)).toBe('07:05');
    expect(clockOf(1439)).toBe('23:59');
  });

  it('wraps past midnight rather than showing an impossible hour', () => {
    expect(clockOf(1500)).toBe('01:00');
  });

  it('is the inverse of reading a time', () => {
    for (const clock of ['00:00', '06:15', '13:45', '23:59']) {
      expect(clockOf(minutesOfClock(clock)!)).toBe(clock);
    }
  });
});

describe('timeOnDate', () => {
  it('uses the task default when there is no override', () => {
    expect(timeOnDate(task({ startTime: '07:00' }), MON)).toBe('07:00');
    expect(timeOnDate(task({ startTime: '07:00' }), SAT)).toBe('07:00');
  });

  // The headline case: weekdays at 07:00, Saturday at 10:00, one task.
  it('lets a weekday override beat the default', () => {
    const gym = task({ startTime: '07:00', weekdayTimes: { '6': '10:00' } });
    expect(timeOnDate(gym, MON)).toBe('07:00');
    expect(timeOnDate(gym, SAT)).toBe('10:00');
  });

  it('an override works with no default at all', () => {
    const t = task({ weekdayTimes: { '1': '09:00' } });
    expect(timeOnDate(t, MON)).toBe('09:00');
    expect(timeOnDate(t, SAT)).toBeNull();
  });

  it('is null when the task carries no time', () => {
    expect(timeOnDate(task(), MON)).toBeNull();
  });

  it('survives a task stored before weekdayTimes existed', () => {
    const legacy = { ...task({ startTime: '08:00' }), weekdayTimes: undefined } as unknown as Task;
    expect(timeOnDate(legacy, MON)).toBe('08:00');
  });
});

describe('minutesOnDate', () => {
  it('gives the override in minutes', () => {
    const gym = task({ startTime: '07:00', weekdayTimes: { '6': '10:00' } });
    expect(minutesOnDate(gym, MON)).toBe(420);
    expect(minutesOnDate(gym, SAT)).toBe(600);
  });

  it('treats a malformed stored time as no time', () => {
    expect(minutesOnDate(task({ startTime: 'half seven' }), MON)).toBeNull();
  });
});
