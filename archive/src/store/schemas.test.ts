import { describe, expect, it } from 'vitest';
import { parseTask, recurrenceSchema } from './schemas';

/**
 * The validation boundary is where stored data is upgraded, so this is what
 * stands between an existing task and being silently dropped after the
 * recurrence model changed shape.
 */

function legacyTask(recurrence: unknown) {
  return {
    id: 'task-1',
    title: 'Water the plants',
    notes: null,
    projectId: null,
    parentId: null,
    priority: null,
    dueDate: '2026-08-04',
    recurrence,
    completedAt: null,
    order: 0,
    archived: false,
    firstMove: null,
    type: null,
    defaultDuration: null,
    schemaVersion: 1,
    version: 3,
    updatedAt: 1,
  };
}

describe('legacy recurrence upgrade', () => {
  it('turns everyNDays into a completion-relative daily rule', () => {
    // It added N days to the completion base, so that is what it becomes.
    expect(recurrenceSchema.parse({ kind: 'everyNDays', n: 3 })).toEqual({
      freq: 'daily',
      interval: 3,
      anchor: null,
      mode: 'fromCompletion',
      until: null,
      remaining: null,
    });
  });

  it('keeps weekly rules on the calendar', () => {
    expect(recurrenceSchema.parse({ kind: 'weekly', weekdays: [1, 5] })).toEqual({
      freq: 'weekly',
      weekdays: [1, 5],
      count: 'weeks',
      interval: 1,
      anchor: null,
      mode: 'grid',
      until: null,
      remaining: null,
    });
  });

  it('carries monthlyByDate across', () => {
    // The single day becomes a one-element list — two generations upgraded.
    expect(recurrenceSchema.parse({ kind: 'monthlyByDate', day: 15 })).toEqual({
      freq: 'monthlyByDate',
      days: [15],
      interval: 1,
      anchor: null,
      mode: 'grid',
      until: null,
      remaining: null,
    });
  });

  it('does not drop a whole task because its rule is the old shape', () => {
    const parsed = parseTask(legacyTask({ kind: 'everyNDays', n: 2 }), 'legacy');
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe('Water the plants');
    expect(parsed!.recurrence).toMatchObject({ freq: 'daily', interval: 2 });
  });
});

describe('current recurrence shapes', () => {
  it('round-trips a rule with an interval and an anchor', () => {
    const rule = {
      freq: 'weekly',
      weekdays: [6],
      count: 'occurrences',
      interval: 2,
      anchor: '2026-08-08',
      mode: 'grid',
      until: '2026-12-31',
      remaining: 10,
    };
    expect(recurrenceSchema.parse(rule)).toEqual(rule);
  });

  it('accepts the positional and yearly forms', () => {
    const monthly = {
      freq: 'monthlyByWeekday',
      week: -1,
      weekday: 5,
      interval: 1,
      anchor: null,
      mode: 'grid',
      until: null,
      remaining: null,
    };
    expect(recurrenceSchema.parse(monthly)).toEqual(monthly);

    const yearly = {
      freq: 'yearlyByDate',
      months: [1, 7],
      day: -1,
      interval: 2,
      anchor: '2026-01-31',
      mode: 'grid',
      until: null,
      remaining: null,
    };
    expect(recurrenceSchema.parse(yearly)).toEqual(yearly);
  });

  it('defaults the shared fields when an older build omitted them', () => {
    expect(recurrenceSchema.parse({ freq: 'weekly', weekdays: [3] })).toEqual({
      freq: 'weekly',
      weekdays: [3],
      count: 'weeks',
      interval: 1,
      anchor: null,
      mode: 'grid',
      until: null,
      remaining: null,
    });
  });

  it('upgrades a session-2 monthly single day to a list', () => {
    expect(
      recurrenceSchema.parse({
        freq: 'monthlyByDate',
        day: 15,
        interval: 3,
        anchor: '2026-08-15',
        mode: 'grid',
      }),
    ).toMatchObject({ freq: 'monthlyByDate', days: [15], interval: 3, anchor: '2026-08-15' });
  });

  it('keeps a task whose rule is unrecognisable, dropping only the rule', () => {
    // The field carries `.catch(null)`, so an unreadable rule costs you the
    // repeat and nothing else. Losing a schedule is recoverable; losing the
    // task it belonged to is not.
    const parsed = parseTask(legacyTask({ freq: 'fortnightly-ish' }), 'nonsense');
    expect(parsed).not.toBeNull();
    expect(parsed!.title).toBe('Water the plants');
    expect(parsed!.recurrence).toBeNull();
  });
});
