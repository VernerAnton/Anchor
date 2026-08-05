import { describe, expect, it } from 'vitest';
import { nextOccurrence, recurrenceBase } from './recurrence';
import { addDays, todayStr, weekdayOf } from './dates';

// 2026-08-04 is a Tuesday.
const TUE = '2026-08-04';

describe('everyNDays', () => {
  it('steps forward N days', () => {
    expect(nextOccurrence({ kind: 'everyNDays', n: 1 }, TUE)).toBe('2026-08-05');
    expect(nextOccurrence({ kind: 'everyNDays', n: 14 }, TUE)).toBe('2026-08-18');
  });

  it('crosses month and year boundaries', () => {
    expect(nextOccurrence({ kind: 'everyNDays', n: 30 }, '2026-12-15')).toBe('2027-01-14');
  });

  it('treats n < 1 as 1 rather than standing still', () => {
    expect(nextOccurrence({ kind: 'everyNDays', n: 0 }, TUE)).toBe('2026-08-05');
  });
});

describe('weekly', () => {
  it('finds the next chosen weekday', () => {
    // From Tuesday, {Mon, Fri} → this Friday.
    expect(nextOccurrence({ kind: 'weekly', weekdays: [1, 5] }, TUE)).toBe('2026-08-07');
  });

  it('is strictly after: the same weekday means a full week ahead', () => {
    expect(nextOccurrence({ kind: 'weekly', weekdays: [2] }, TUE)).toBe('2026-08-11');
  });

  it('wraps past the weekend', () => {
    // From Friday, {Mon} → next Monday.
    expect(nextOccurrence({ kind: 'weekly', weekdays: [1] }, '2026-08-07')).toBe('2026-08-10');
  });

  it('falls back to a week ahead when no valid weekdays are given', () => {
    expect(nextOccurrence({ kind: 'weekly', weekdays: [] }, TUE)).toBe('2026-08-11');
    expect(nextOccurrence({ kind: 'weekly', weekdays: [9] }, TUE)).toBe('2026-08-11');
  });

  it('always lands on a wanted weekday', () => {
    const next = nextOccurrence({ kind: 'weekly', weekdays: [0, 6] }, TUE);
    expect([0, 6]).toContain(weekdayOf(next));
  });
});

describe('monthlyByDate', () => {
  it('stays in the current month when the day is still ahead', () => {
    expect(nextOccurrence({ kind: 'monthlyByDate', day: 15 }, TUE)).toBe('2026-08-15');
  });

  it('moves to next month when the day has passed', () => {
    expect(nextOccurrence({ kind: 'monthlyByDate', day: 1 }, TUE)).toBe('2026-09-01');
  });

  it('is strictly after: due on its own day rolls a month forward', () => {
    expect(nextOccurrence({ kind: 'monthlyByDate', day: 4 }, TUE)).toBe('2026-09-04');
  });

  it('clamps day 31 to shorter months', () => {
    expect(nextOccurrence({ kind: 'monthlyByDate', day: 31 }, '2026-04-01')).toBe('2026-04-30');
    expect(nextOccurrence({ kind: 'monthlyByDate', day: 31 }, '2026-04-30')).toBe('2026-05-31');
  });

  it('clamps in February, including leap years', () => {
    expect(nextOccurrence({ kind: 'monthlyByDate', day: 30 }, '2026-02-01')).toBe('2026-02-28');
    expect(nextOccurrence({ kind: 'monthlyByDate', day: 30 }, '2028-02-01')).toBe('2028-02-29');
  });

  it('crosses the year boundary', () => {
    expect(nextOccurrence({ kind: 'monthlyByDate', day: 5 }, '2026-12-20')).toBe('2027-01-05');
  });
});

describe('recurrenceBase', () => {
  it('uses the due date when completing early', () => {
    expect(recurrenceBase('2026-08-10', TUE)).toBe('2026-08-10');
  });

  it('uses today when overdue — no backfill of missed occurrences', () => {
    expect(recurrenceBase('2026-07-01', TUE)).toBe(TUE);
  });

  it('uses today when there is no due date', () => {
    expect(recurrenceBase(null, TUE)).toBe(TUE);
  });
});

describe('dates', () => {
  it('addDays is DST-safe across a transition', () => {
    // European DST change 2026-03-29; a naive local-time add can land on the
    // same day twice or skip one.
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('todayStr formats a local date', () => {
    expect(todayStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
