import { describe, expect, it } from 'vitest';
import { blankThemeRequested, resolveScheme } from './theme';

describe('theme', () => {
  it('follows the device only when asked to', () => {
    expect(resolveScheme('system', true)).toBe('dark');
    expect(resolveScheme('system', false)).toBe('light');
    expect(resolveScheme('light', true)).toBe('light');
    expect(resolveScheme('dark', false)).toBe('dark');
  });

  it('recognises the blank-theme test', () => {
    expect(blankThemeRequested('?theme=none')).toBe(true);
    expect(blankThemeRequested('?theme=dark')).toBe(false);
  });
});
