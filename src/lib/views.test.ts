import { describe, expect, it } from 'vitest';
import { noteLine, shortDateLabel } from './views';
import { durationLabel } from './day';

const TODAY = '2026-09-06';

describe('a date on a row', () => {
  it('says the two days that have a word', () => {
    expect(shortDateLabel(TODAY, TODAY)).toBe('Today');
    expect(shortDateLabel('2026-09-07', TODAY)).toBe('Tomorrow');
  });

  it('is short everywhere else', () => {
    expect(shortDateLabel('2026-09-23', TODAY)).toBe('Wed 23 Sep');
  });

  it('has no relative phrasing for the past', () => {
    expect(shortDateLabel('2026-09-05', TODAY)).toBe('Sat 5 Sep');
  });
});

describe('a note on a row', () => {
  it('takes the first line', () => {
    expect(noteLine('Do it for 50 min\nand then stop')).toBe('Do it for 50 min');
  });

  it('skips the blank ones a note can start with', () => {
    expect(noteLine('\n\n  Ring the dentist')).toBe('Ring the dentist');
  });

  it('shows nothing rather than an empty line', () => {
    expect(noteLine(null)).toBeNull();
    expect(noteLine('')).toBeNull();
    expect(noteLine('   \n  ')).toBeNull();
  });
});

describe('a length on a row', () => {
  it('is minutes under an hour', () => {
    expect(durationLabel({ kind: 'fixed', minutes: 50 })).toBe('50m');
  });

  it('breaks into hours above one', () => {
    expect(durationLabel({ kind: 'fixed', minutes: 90 })).toBe('1h 30m');
    expect(durationLabel({ kind: 'fixed', minutes: 120 })).toBe('2h');
  });

  /** The tilde is the whole distinction between a slot and a guess. */
  it('marks an estimate as one', () => {
    expect(durationLabel({ kind: 'natural', estimateMinutes: 50 })).toBe('~50m');
  });

  it('says nothing when there is no length to say', () => {
    expect(durationLabel(null)).toBeNull();
    expect(durationLabel({ kind: 'fixed', minutes: 0 })).toBeNull();
  });
});
