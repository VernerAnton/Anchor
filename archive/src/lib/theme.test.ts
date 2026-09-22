import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

describe('resolveTheme', () => {
  it('follows the device when nothing has been chosen', () => {
    expect(resolveTheme('system', true)).toBe('noir');
    expect(resolveTheme('system', false)).toBe('blossom');
  });

  // The whole point of picking one: it stops following.
  it('ignores the device once a theme has been chosen', () => {
    expect(resolveTheme('noir', false)).toBe('noir');
    expect(resolveTheme('noir', true)).toBe('noir');
    expect(resolveTheme('blossom', true)).toBe('blossom');
    expect(resolveTheme('blossom', false)).toBe('blossom');
  });

  // Dark is the app's own register, so an unreadable device preference lands
  // there rather than on the daylight theme.
  it('treats anything it does not recognise as following the device', () => {
    expect(resolveTheme('nonsense' as never, true)).toBe('noir');
    expect(resolveTheme('nonsense' as never, false)).toBe('blossom');
  });
});
