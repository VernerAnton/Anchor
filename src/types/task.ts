import type { Duration, PointType } from './path';

/**
 * The library — what exists, as opposed to what's scheduled.
 *
 * A Task is a thing you might do; a Point is that thing placed on a day at a
 * time. Keeping them separate is what lets the same task appear on Tuesday and
 * next Tuesday without either day owning it, and it's what makes a build mode
 * possible at all: you can't organise a library that only exists inside days.
 */

/**
 * Project colours are a different axis from the four that carry meaning on the
 * path. Ember says "now", acid says "it happened", cyan says "you may decline
 * this", slate says "this went by" — a project tinted any of them would start
 * making claims about state that it can't possibly know.
 *
 * So the grammar is: **neon means state, muted means identity.** Every colour
 * here is deliberately lower-saturation than the semantic four, which is also
 * why a project marker never competes with the status word beside it.
 */
export const PROJECT_COLORS = {
  steel: '#6a8ca8',
  violet: '#8f7bc4',
  teal: '#4fa89b',
  sage: '#84a172',
  ochre: '#b8944e',
  plum: '#a86e8c',
  indigo: '#6b78bd',
  clay: '#b07a63',
} as const;

export type ProjectColor = keyof typeof PROJECT_COLORS;

export const PROJECT_COLOR_IDS = Object.keys(PROJECT_COLORS) as ProjectColor[];

export interface Project {
  id: string;
  name: string;
  colorId: ProjectColor;
  /** Manual ordering in the sidebar. */
  order: number;
  /**
   * Archived rather than deleted. Points carry a snapshot of the project they
   * were scheduled under, and a past day should still be able to say where its
   * work came from.
   */
  archived: boolean;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

/**
 * Priority exists to order an unscheduled backlog, where sorting is the actual
 * job. It is a build-mode concept only and never reaches a Point — at the
 * moment of doing, a second axis of importance is one more decision at the
 * worst possible time, and a visible "low priority" tag on something you're
 * about to start is an invitation to skip it.
 */
export type Priority = 1 | 2 | 3 | 4;

export interface Task {
  id: string;
  title: string;
  /** The smallest move that starts it. Copied onto each scheduled Point. */
  firstMove: string;
  type: PointType;
  /** What a Point gets when this task is scheduled, before any per-day tweak. */
  defaultDuration: Duration;
  projectId: string | null;
  priority: Priority | null;
  archived: boolean;
  schemaVersion: number;
  version: number;
  updatedAt: number;
}
