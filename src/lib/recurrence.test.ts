import { describe, expect, it } from 'vitest';
import type { Recurrence, RecurrenceSpec } from '../types/task';
import {
  describeRecurrence,
  matches,
  nextOccurrence,
  previewOccurrences,
  recurrenceBase,
} from './recurrence';
import { addDays, todayStr, weekdayOf, addMonths, weekStart, nthWeekdayOfMonth } from './dates';

// 2026-08-04 is a Tuesday.
const TUE = '2026-08-04';

/** Rules default to the calendar grid with no interval; tests override what they mean. */
type SpecInput =
  | Exclude<RecurrenceSpec, { freq: 'weekly' }>
  | { freq: 'weekly'; weekdays: number[]; count?: 'weeks' | 'occurrences' };

function rule(spec: SpecInput, extra: Partial<Recurrence> = {}): Recurrence {
  const withDefaults = spec.freq === 'weekly' ? { count: 'weeks' as const, ...spec } : spec;
  return {
    interval: 1,
    anchor: null,
    mode: 'grid',
    until: null,
    remaining: null,
    ...withDefaults,
    ...extra,
  } as Recurrence;
}

describe('daily', () => {
  it('steps forward by the interval', () => {
    expect(nextOccurrence(rule({ freq: 'daily' }), TUE)).toBe('2026-08-05');
    expect(nextOccurrence(rule({ freq: 'daily' }, { interval: 14 }), TUE)).toBe('2026-08-18');
  });

  it('crosses month and year boundaries', () => {
    expect(nextOccurrence(rule({ freq: 'daily' }, { interval: 30 }), '2026-12-15')).toBe(
      '2027-01-14',
    );
  });

  it('holds the phase against an anchor on the grid', () => {
    // Anchored to the 4th, every 3 days: the 5th and 6th are off, the 7th is on.
    const r = rule({ freq: 'daily' }, { interval: 3, anchor: TUE });
    expect(matches(r, '2026-08-05')).toBe(false);
    expect(matches(r, '2026-08-07')).toBe(true);
    expect(nextOccurrence(r, TUE)).toBe('2026-08-07');
  });
});

describe('weekly', () => {
  it('finds the next chosen weekday', () => {
    // From Tuesday, {Mon, Fri} → this Friday.
    expect(nextOccurrence(rule({ freq: 'weekly', weekdays: [1, 5] }), TUE)).toBe('2026-08-07');
  });

  it('is strictly after: the same weekday means a full week ahead', () => {
    expect(nextOccurrence(rule({ freq: 'weekly', weekdays: [2] }), TUE)).toBe('2026-08-11');
  });

  it('wraps past the weekend', () => {
    expect(nextOccurrence(rule({ freq: 'weekly', weekdays: [1] }), '2026-08-07')).toBe(
      '2026-08-10',
    );
  });

  it('always lands on a wanted weekday', () => {
    const next = nextOccurrence(rule({ freq: 'weekly', weekdays: [0, 6] }), TUE);
    expect([0, 6]).toContain(weekdayOf(next!));
  });

  // The headline case: every other Saturday.
  it('every other Saturday skips the intervening one', () => {
    const r = rule({ freq: 'weekly', weekdays: [6] }, { interval: 2, anchor: '2026-08-08' });
    const first = nextOccurrence(r, '2026-08-08')!;
    expect(first).toBe('2026-08-22');
    expect(nextOccurrence(r, first)).toBe('2026-09-05');
  });

  it('every other Saturday never lands on the off-week Saturday', () => {
    const r = rule({ freq: 'weekly', weekdays: [6] }, { interval: 2, anchor: '2026-08-08' });
    expect(matches(r, '2026-08-15')).toBe(false); // off week
    expect(matches(r, '2026-08-22')).toBe(true); // on week
  });

  it('every other week on weekdays covers Mon-Fri of alternating weeks', () => {
    const r = rule(
      { freq: 'weekly', weekdays: [1, 2, 3, 4, 5] },
      { interval: 2, anchor: '2026-08-03' }, // a Monday
    );
    // On-week: Mon 3rd through Fri 7th.
    expect(matches(r, '2026-08-05')).toBe(true);
    // Off-week: the following Wednesday.
    expect(matches(r, '2026-08-12')).toBe(false);
    // Back on: the week after that.
    expect(matches(r, '2026-08-19')).toBe(true);
    // Weekend is never included regardless of phase.
    expect(matches(r, '2026-08-08')).toBe(false);
  });

  it('phases by whole weeks, so a mid-week anchor still aligns the week', () => {
    // Anchor on Tuesday, rule fires Saturdays — the Saturday of the anchor's
    // own week is on, because the interval counts weeks and not days.
    const r = rule({ freq: 'weekly', weekdays: [6] }, { interval: 2, anchor: TUE });
    expect(weekStart('2026-08-08')).toBe(weekStart(TUE));
    expect(matches(r, '2026-08-08')).toBe(true);
  });

  it('with no weekdays selected it cannot produce a date', () => {
    expect(nextOccurrence(rule({ freq: 'weekly', weekdays: [] }), TUE)).toBeNull();
  });
});

describe('monthlyByDate', () => {
  it('stays in the current month when the day is still ahead', () => {
    expect(nextOccurrence(rule({ freq: 'monthlyByDate', days: [15] }), TUE)).toBe('2026-08-15');
  });

  it('moves to next month when the day has passed', () => {
    expect(nextOccurrence(rule({ freq: 'monthlyByDate', days: [1] }), TUE)).toBe('2026-09-01');
  });

  it('is strictly after: due on its own day rolls a month forward', () => {
    expect(nextOccurrence(rule({ freq: 'monthlyByDate', days: [4] }), TUE)).toBe('2026-09-04');
  });

  it('clamps day 31 to shorter months', () => {
    expect(nextOccurrence(rule({ freq: 'monthlyByDate', days: [31] }), '2026-04-01')).toBe(
      '2026-04-30',
    );
    expect(nextOccurrence(rule({ freq: 'monthlyByDate', days: [31] }), '2026-04-30')).toBe(
      '2026-05-31',
    );
  });

  it('clamps in February, including leap years', () => {
    expect(nextOccurrence(rule({ freq: 'monthlyByDate', days: [30] }), '2026-02-01')).toBe(
      '2026-02-28',
    );
    expect(nextOccurrence(rule({ freq: 'monthlyByDate', days: [30] }), '2028-02-01')).toBe(
      '2028-02-29',
    );
  });

  it('day -1 tracks the last day rather than clamping to a fixed number', () => {
    const r = rule({ freq: 'monthlyByDate', days: [-1] });
    expect(nextOccurrence(r, '2026-01-31')).toBe('2026-02-28');
    expect(nextOccurrence(r, '2026-02-28')).toBe('2026-03-31');
    expect(nextOccurrence(r, '2026-03-31')).toBe('2026-04-30');
    // Leap year February.
    expect(nextOccurrence(r, '2028-01-31')).toBe('2028-02-29');
  });

  it('every 3 months holds the phase', () => {
    const r = rule({ freq: 'monthlyByDate', days: [15] }, { interval: 3, anchor: '2026-08-15' });
    const first = nextOccurrence(r, '2026-08-15')!;
    expect(first).toBe('2026-11-15');
    expect(nextOccurrence(r, first)).toBe('2027-02-15');
  });

  it('every 3 months skips the intervening months', () => {
    const r = rule({ freq: 'monthlyByDate', days: [15] }, { interval: 3, anchor: '2026-08-15' });
    expect(matches(r, '2026-09-15')).toBe(false);
    expect(matches(r, '2026-10-15')).toBe(false);
    expect(matches(r, '2026-11-15')).toBe(true);
  });

  it('crosses the year boundary', () => {
    expect(nextOccurrence(rule({ freq: 'monthlyByDate', days: [5] }), '2026-12-20')).toBe(
      '2027-01-05',
    );
  });
});

describe('monthlyByWeekday', () => {
  it('finds the third Tuesday', () => {
    // August 2026: Tuesdays fall on 4, 11, 18, 25.
    expect(nextOccurrence(rule({ freq: 'monthlyByWeekday', week: 3, weekday: 2 }), TUE)).toBe(
      '2026-08-18',
    );
  });

  it('finds the first Monday of the next month once this one has gone', () => {
    expect(
      nextOccurrence(rule({ freq: 'monthlyByWeekday', week: 1, weekday: 1 }), '2026-08-10'),
    ).toBe('2026-09-07');
  });

  it('last Friday differs from the fourth when the month has five', () => {
    // July 2026 has Fridays on 3, 10, 17, 24, 31 — five of them.
    expect(nthWeekdayOfMonth(2026, 7, 4, 5)).toBe('2026-07-24');
    expect(nthWeekdayOfMonth(2026, 7, -1, 5)).toBe('2026-07-31');
  });

  it('last Friday equals the fourth when the month has only four', () => {
    // August 2026 has Fridays on 7, 14, 21, 28.
    expect(nthWeekdayOfMonth(2026, 8, 4, 5)).toBe('2026-08-28');
    expect(nthWeekdayOfMonth(2026, 8, -1, 5)).toBe('2026-08-28');
  });

  it('skips months with no fifth occurrence rather than inventing one', () => {
    // Week 5 is never offered by the editor, but the engine must not fabricate.
    expect(nthWeekdayOfMonth(2026, 8, 5, 5)).toBeNull();
  });

  it('every other month holds the phase', () => {
    const r = rule(
      { freq: 'monthlyByWeekday', week: 1, weekday: 1 },
      { interval: 2, anchor: '2026-08-03' },
    );
    const first = nextOccurrence(r, '2026-08-03')!;
    expect(first).toBe('2026-10-05');
    expect(matches(r, '2026-09-07')).toBe(false);
  });
});

describe('yearly', () => {
  it('finds the next occurrence of a month and day', () => {
    expect(
      nextOccurrence(rule({ freq: 'yearlyByDate', months: [3], day: 12 }), TUE),
    ).toBe('2027-03-12');
  });

  it('supports several months in one rule', () => {
    const r = rule({ freq: 'yearlyByDate', months: [1, 7], day: 1 });
    const first = nextOccurrence(r, TUE)!;
    expect(first).toBe('2027-01-01');
    expect(nextOccurrence(r, first)).toBe('2027-07-01');
  });

  it('every 2 years holds the phase', () => {
    const r = rule({ freq: 'yearlyByDate', months: [3], day: 12 }, { interval: 2, anchor: '2026-03-12' });
    expect(matches(r, '2027-03-12')).toBe(false);
    expect(matches(r, '2028-03-12')).toBe(true);
  });

  it('handles a positional yearly rule', () => {
    // Last Monday in May 2027 — May 2027 has Mondays on 3, 10, 17, 24, 31.
    expect(
      nextOccurrence(rule({ freq: 'yearlyByWeekday', months: [5], week: -1, weekday: 1 }), TUE),
    ).toBe('2027-05-31');
  });

  it('clamps a yearly 29 February to 28 in common years', () => {
    expect(
      nextOccurrence(rule({ freq: 'yearlyByDate', months: [2], day: 29 }), '2026-03-01'),
    ).toBe('2027-02-28');
  });
});

describe('mode: fromCompletion', () => {
  it('daily measures from the completion date, not a grid', () => {
    const r = rule({ freq: 'daily' }, { interval: 3, mode: 'fromCompletion', anchor: TUE });
    // Completed four days late; the next is still three days from *now*.
    expect(nextOccurrence(r, '2026-08-08')).toBe('2026-08-11');
  });

  it('ignores anchor phase, which is the point of the mode', () => {
    const gridRule = rule({ freq: 'daily' }, { interval: 3, anchor: TUE });
    const loose = rule({ freq: 'daily' }, { interval: 3, mode: 'fromCompletion', anchor: TUE });
    // 2026-08-09 is off-phase for the grid rule, so the two disagree.
    expect(nextOccurrence(gridRule, '2026-08-09')).toBe('2026-08-10');
    expect(nextOccurrence(loose, '2026-08-09')).toBe('2026-08-12');
  });

  it('weekly steps the interval then settles on a chosen weekday', () => {
    const r = rule(
      { freq: 'weekly', weekdays: [6] },
      { interval: 2, mode: 'fromCompletion', anchor: '2026-08-08' },
    );
    // Completed on a Wednesday: +2 weeks lands on a Wednesday, then forward to Saturday.
    const next = nextOccurrence(r, '2026-08-12')!;
    expect(weekdayOf(next)).toBe(6);
    expect(next).toBe('2026-08-29');
  });

  it('monthly steps whole months and clamps the day', () => {
    const r = rule(
      { freq: 'monthlyByDate', days: [31] },
      { interval: 1, mode: 'fromCompletion' },
    );
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(nextOccurrence(r, '2026-01-31')).toBe('2026-02-28');
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

describe('describeRecurrence', () => {
  it('reads naturally for the cases that motivated the engine', () => {
    expect(
      describeRecurrence(rule({ freq: 'weekly', weekdays: [6] }, { interval: 2 })),
    ).toBe('every 2 weeks · Sat');

    expect(describeRecurrence(rule({ freq: 'monthlyByDate', days: [15] }, { interval: 3 }))).toBe(
      'every 3 months · day 15',
    );

    expect(describeRecurrence(rule({ freq: 'monthlyByDate', days: [-1] }))).toBe(
      'every month · last day',
    );

    expect(describeRecurrence(rule({ freq: 'monthlyByWeekday', week: -1, weekday: 5 }))).toBe(
      'every month · last Fri',
    );
  });

  it('notes when a rule follows completion rather than the calendar', () => {
    expect(
      describeRecurrence(rule({ freq: 'daily' }, { interval: 3, mode: 'fromCompletion' })),
    ).toBe('every 3 days · from completion');
  });
});

describe('dates', () => {
  it('addDays is DST-safe across a transition', () => {
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('todayStr formats a local date', () => {
    expect(todayStr(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('weekStart is Monday-based', () => {
    expect(weekStart('2026-08-04')).toBe('2026-08-03'); // Tuesday → Monday
    expect(weekStart('2026-08-09')).toBe('2026-08-03'); // Sunday ends that same week
    expect(weekStart('2026-08-10')).toBe('2026-08-10'); // Monday is its own start
  });
});

describe('occurrence-counted intervals', () => {
  // The gap that motivated this: "every other weekday".
  it('every 2nd weekday steps Mon → Wed → Fri → Tue → Thu → Mon', () => {
    const r = rule(
      { freq: 'weekly', weekdays: [1, 2, 3, 4, 5], count: 'occurrences' },
      { interval: 2, anchor: '2026-08-03' }, // a Monday
    );
    const seq = ['2026-08-03'];
    for (let i = 0; i < 5; i++) seq.push(nextOccurrence(r, seq[seq.length - 1]!)!);
    expect(seq).toEqual([
      '2026-08-03', // Mon (anchor, occurrence 0)
      '2026-08-05', // Wed
      '2026-08-07', // Fri
      '2026-08-11', // Tue (skipping Mon 10th)
      '2026-08-13', // Thu
      '2026-08-17', // Mon
    ]);
  });

  it('phase holds against the anchor: off-days do not match', () => {
    const r = rule(
      { freq: 'weekly', weekdays: [1, 2, 3, 4, 5], count: 'occurrences' },
      { interval: 2, anchor: '2026-08-03' },
    );
    expect(matches(r, '2026-08-03')).toBe(true); // Mon, occurrence 0
    expect(matches(r, '2026-08-04')).toBe(false); // Tue, occurrence 1
    expect(matches(r, '2026-08-05')).toBe(true); // Wed, occurrence 2
    expect(matches(r, '2026-08-08')).toBe(false); // Saturday is never selected
  });

  it('every 3rd Sat-or-Sun', () => {
    const r = rule(
      { freq: 'weekly', weekdays: [0, 6], count: 'occurrences' },
      { interval: 3, anchor: '2026-08-08' }, // a Saturday
    );
    // Weekend days from the anchor, indexed: Sat 8 (0), Sun 9 (1), Sat 15 (2),
    // Sun 16 (3), Sat 22 (4), Sun 23 (5), Sat 29 (6) — on-phase at 0, 3, 6.
    expect(nextOccurrence(r, '2026-08-08')).toBe('2026-08-16');
    expect(nextOccurrence(r, '2026-08-16')).toBe('2026-08-29');
  });

  it('fromCompletion counts matching days from the completion date', () => {
    const r = rule(
      { freq: 'weekly', weekdays: [1, 2, 3, 4, 5], count: 'occurrences' },
      { interval: 2, mode: 'fromCompletion' },
    );
    // Completed Wed 5th: weekdays after are Thu 6, Fri 7 → the 2nd is Friday.
    expect(nextOccurrence(r, '2026-08-05')).toBe('2026-08-07');
    // Completed Sat 8th: weekdays after are Mon 10, Tue 11 → Tuesday.
    expect(nextOccurrence(r, '2026-08-08')).toBe('2026-08-11');
  });

  it('interval 1 over all selected days is just every matching day', () => {
    const r = rule(
      { freq: 'weekly', weekdays: [1, 2, 3, 4, 5], count: 'occurrences' },
      { anchor: '2026-08-03' },
    );
    expect(nextOccurrence(r, '2026-08-06')).toBe('2026-08-07'); // Thu → Fri
    expect(nextOccurrence(r, '2026-08-07')).toBe('2026-08-10'); // Fri → Mon
  });
});

describe('day lists', () => {
  it('the 1st and the 15th both fire each month', () => {
    const r = rule({ freq: 'monthlyByDate', days: [1, 15] });
    expect(nextOccurrence(r, '2026-08-04')).toBe('2026-08-15');
    expect(nextOccurrence(r, '2026-08-15')).toBe('2026-09-01');
    expect(nextOccurrence(r, '2026-09-01')).toBe('2026-09-15');
  });

  it('a list may include the tracking last day', () => {
    const r = rule({ freq: 'monthlyByDate', days: [15, -1] });
    expect(nextOccurrence(r, '2026-02-15')).toBe('2026-02-28');
    expect(nextOccurrence(r, '2026-02-28')).toBe('2026-03-15');
  });

  it('describes a list in day order with last-day last', () => {
    expect(describeRecurrence(rule({ freq: 'monthlyByDate', days: [15, 1, -1] }))).toBe(
      'every month · day 1, day 15, last day',
    );
  });
});

describe('end conditions', () => {
  it('until stops production past the boundary date', () => {
    const r = rule({ freq: 'daily' }, { until: '2026-08-06' });
    expect(nextOccurrence(r, '2026-08-04')).toBe('2026-08-05');
    expect(nextOccurrence(r, '2026-08-05')).toBe('2026-08-06');
    expect(nextOccurrence(r, '2026-08-06')).toBeNull();
  });

  it('preview truncates at until and says so', () => {
    const r = rule({ freq: 'daily' }, { until: '2026-08-06' });
    expect(previewOccurrences(r, '2026-08-04', 4)).toEqual({
      dates: ['2026-08-05', '2026-08-06'],
      ends: true,
    });
  });

  it('preview shows at most remaining occurrences and marks the end', () => {
    const r = rule({ freq: 'daily' }, { remaining: 2 });
    expect(previewOccurrences(r, '2026-08-04', 4)).toEqual({
      dates: ['2026-08-05', '2026-08-06'],
      ends: true,
    });
  });

  it('preview reports an open horizon when nothing ends inside it', () => {
    const r = rule({ freq: 'daily' });
    expect(previewOccurrences(r, '2026-08-04', 3)).toEqual({
      dates: ['2026-08-05', '2026-08-06', '2026-08-07'],
      ends: false,
    });
  });

  it('describe mentions the end conditions', () => {
    expect(describeRecurrence(rule({ freq: 'daily' }, { until: '2026-09-30' }))).toBe(
      'every day · until 30 Sep',
    );
    expect(describeRecurrence(rule({ freq: 'daily' }, { remaining: 3 }))).toBe(
      'every day · 3 times left',
    );
  });
});
