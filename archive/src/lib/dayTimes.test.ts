import { describe, expect, it } from 'vitest';
import { clockOf, minutesOfClock } from './dayTimes';

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
