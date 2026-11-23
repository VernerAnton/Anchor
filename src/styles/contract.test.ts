import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The styling contract (CLAUDE.md, handover/styling.md), checked rather than
 * hoped for. Every raw colour or shadow lives in tokens.css; and every rule in
 * tokens.css is keyed off `data-theme`, so `?theme=none` really is the same as
 * emptying the file.
 */

const STYLES = join(process.cwd(), 'src/styles');

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith('.css') ? [path] : [];
  });
}

const stripComments = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, '');

describe('styling contract', () => {
  it('keeps raw colours and shadows out of every stylesheet but tokens.css', () => {
    const raw = /#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|oklch|oklab|lab|lch|color-mix)\(|box-shadow:(?!\s*(?:var\(|none))/i;
    const offenders = cssFiles(STYLES)
      .filter((file) => !file.endsWith('tokens.css'))
      .filter((file) => raw.test(stripComments(readFileSync(file, 'utf8'))));
    expect(offenders).toEqual([]);
  });

  it('keys every token rule off data-theme, so ?theme=none blanks them all', () => {
    const tokens = stripComments(readFileSync(join(STYLES, 'tokens.css'), 'utf8'));
    const selectors = [...tokens.matchAll(/([^{}]+)\{/g)].map((match) => match[1]!.trim());
    expect(selectors.length).toBeGreaterThan(0);
    for (const group of selectors) {
      for (const selector of group.split(',')) {
        expect(selector.trim()).toMatch(/^:root(\[data-theme='(light|dark)'\]|:not\(\[data-theme\]\))$/);
      }
    }
  });
});
