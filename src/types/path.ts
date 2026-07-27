/**
 * The Anchor data model.
 *
 * Two rules are enforced by these types rather than by convention, because
 * they are the two the product cannot survive losing:
 *
 *   1. Rest has no completion field of any kind. It is not completable, and
 *      there is no shape of this model in which it becomes completable. Its
 *      job is to exist and be legitimate, not to be one more thing to tick.
 *
 *   2. A Point stores only whether it happened (`completedAt`). It never
 *      stores "missed" or "failed". Every not-done state is *derived* at
 *      render time from where you are on the path — which is what lets a
 *      passed point read as a gap in the route rather than a verdict.
 */

/** Drives ordering logic and the lead-with-the-physical-one bias. */
export type PointType = 'physical' | 'abstract';

/**
 * How a point ends. Deciding this up front is the whole point: an open-ended
 * task is heavier to start because part of you is still calculating how long
 * it will go on.
 */
export type Duration =
  /** A timer with a hard stop. When it rings, stopping is allowed. */
  | { kind: 'fixed'; minutes: number }
  /** Has its own endpoint — the chicken is done when it's cut. */
  | { kind: 'natural'; estimateMinutes: number };

export interface Point {
  kind: 'point';
  id: string;
  /** The action itself. */
  title: string;
  /**
   * The smallest move that starts it — "pick up the knife", not "cook
   * dinner". Rendered as the action button, so what the app asks you to do
   * is always the trivial version.
   */
  firstMove: string;
  /** Minutes from midnight. Locked when the path is locked. */
  startsAt: number;
  duration: Duration;
  type: PointType;
  /**
   * Optional tag override for the node header, e.g. "MOVEMENT".
   *
   * Explicitly `null` rather than optional: Firestore rejects `undefined`
   * outright, so every absent value in a stored document has to be a real null.
   */
  label: string | null;
  /**
   * Minutes from midnight the first move was actually made, or null. Kept
   * separate from `startsAt` because when you began and when the path said
   * you would are different facts, and only the first one is evidence.
   */
  startedAt: number | null;
  /** Minutes from midnight, or null if it hasn't happened. Never "failed". */
  completedAt: number | null;
}

export interface Rest {
  kind: 'rest';
  id: string;
  /** Flavour: "COFFEE", "SHOWER, EAT". Rest without a label is fine — null. */
  label: string | null;
  minutes: number;
  // Deliberately no status, no completedAt, no anything. See rule 1 above.
}

export type Segment = Point | Rest;

/**
 * Whether the path tracks real time.
 *
 * `live`  — the marker moves with the clock. A point whose window elapsed
 *           without being logged renders as passed. Can show falling behind.
 * `fixed` — set in the morning and left alone. The first unlogged point is
 *           always the live one; nothing is ever overtaken by the clock.
 *
 * Shipped as a toggle on purpose: which of these reads as motivating and
 * which reads as pressure is a per-person question, not a design verdict.
 */
export type MarkerMode = 'live' | 'fixed';

/**
 * One day, one document.
 *
 * Keeping a whole day in a single document means a day is also the unit of
 * conflict: two devices editing the same day resolve last-write-wins. That's
 * the right trade here — you are essentially never editing the same day on two
 * devices at once, and the alternative buys nothing for real use.
 */
export interface Path {
  id: string;
  /** YYYY-MM-DD. Also the document id, so a date addresses a day directly. */
  date: string;
  /**
   * Minutes from midnight the night before, or null if the path is still
   * open for editing. Once locked, the morning has nothing left to decide.
   */
  lockedAt: number | null;
  /** Minutes from midnight. Past this the day is unscheduled and yours. */
  endsAt: number;
  segments: Segment[];
  schemaVersion: number;
  /** Epoch ms. Last-write-wins when two devices disagree. */
  updatedAt: number;
}

/**
 * How a point renders. `done` and `passed` are both just facts about where
 * the point sits relative to you — neither is a judgement, and only `done`
 * corresponds to anything stored.
 */
export type PointStatus = 'done' | 'live' | 'passed' | 'next';

/** A day's worth of logging, for the rolling window. Never a chain. */
export interface DayRecord {
  /** YYYY-MM-DD. Also the document id. */
  date: string;
  pointsCleared: number;
  schemaVersion: number;
  /** Epoch ms. Last-write-wins when two devices disagree. */
  updatedAt: number;
}
