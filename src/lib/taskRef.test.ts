import { describe, expect, it } from 'vitest';
import type { Project, Task } from '../types/task';
import { taskRef } from './taskRef';

function task(id: string, projectId: string | null = null): Task {
  return {
    id,
    title: 'Water the plants',
    notes: null,
    projectId,
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
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
  };
}

function project(id: string, name: string): Project {
  return {
    id,
    name,
    colorId: 'steel',
    parentId: null,
    order: 0,
    archived: false,
    schemaVersion: 1,
    version: 1,
    updatedAt: 0,
  };
}

const HEALTH = project('p1', 'Health');

describe('taskRef', () => {
  // First three letters, not a hand-picked abbreviation: you can look at a
  // reference and know which project it came from without learning a code.
  it('takes three letters from the project and pads the number', () => {
    expect(taskRef(task('abc', 'p1'), [HEALTH])).toMatch(/^HEA-\d{3}$/);
  });

  it('uses GEN for an unfiled task', () => {
    expect(taskRef(task('abc'), [])).toMatch(/^GEN-\d{3}$/);
  });

  it('is stable — the same task always gets the same reference', () => {
    const t = task('550e8400-e29b-41d4-a716-446655440000', 'p1');
    expect(taskRef(t, [HEALTH])).toBe(taskRef(t, [HEALTH]));
  });

  it('gives different tasks different numbers', () => {
    const refs = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id) => taskRef(task(id), [])),
    );
    expect(refs.size).toBeGreaterThan(6);
  });

  it('follows the task when it is re-filed', () => {
    const study = project('p2', 'Study');
    expect(taskRef(task('abc', 'p1'), [HEALTH, study])).toMatch(/^HEA-/);
    expect(taskRef(task('abc', 'p2'), [HEALTH, study])).toMatch(/^STU-/);
  });

  it('pads a short project name rather than producing a stub', () => {
    expect(taskRef(task('abc', 'p3'), [project('p3', 'Do')])).toMatch(/^DOG-\d{3}$/);
  });

  it('ignores spaces and punctuation in a project name', () => {
    expect(taskRef(task('abc', 'p4'), [project('p4', 'Side project!')])).toMatch(/^SID-\d{3}$/);
  });

  it('handles the non-uuid id fallback shape', () => {
    expect(taskRef(task('id-lz4k2p-8fj2ka9x'), [])).toMatch(/^GEN-\d{3}$/);
  });

  it('never produces a number outside 001–999', () => {
    for (let i = 0; i < 400; i++) {
      const ref = taskRef(task(`task-${i}-${i * 7919}`), []);
      const n = Number(ref.slice(4));
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(999);
    }
  });
});
