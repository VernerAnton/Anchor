import { z } from 'zod';
import type { DayRecord, Path } from '../types/path';
import type { Settings } from '../types/settings';

/**
 * Validation for everything that arrives from the cloud.
 *
 * Cloud data is untrusted input — a different build, a manual console edit, or
 * a half-migrated document can all show up in a snapshot. The working app's
 * rule, kept here: invalid data is dropped with a warning rather than allowed
 * to poison local state.
 *
 * `.passthrough()` lets fields added by future builds survive a round-trip
 * through an older one instead of being silently stripped.
 */

const durationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), minutes: z.number() }),
  z.object({ kind: z.literal('natural'), estimateMinutes: z.number() }),
]);

const pointSchema = z
  .object({
    kind: z.literal('point'),
    id: z.string(),
    title: z.string(),
    firstMove: z.string(),
    startsAt: z.number(),
    duration: durationSchema,
    type: z.enum(['physical', 'abstract']),
    label: z.string().nullable(),
    startedAt: z.number().nullable(),
    completedAt: z.number().nullable(),
  })
  .passthrough();

// Note what this schema cannot express: completion. A rest with a completedAt
// field fails validation and is dropped — the invariant holds even against
// data written by something that isn't this app.
const restSchema = z
  .object({
    kind: z.literal('rest'),
    id: z.string(),
    label: z.string().nullable(),
    minutes: z.number(),
  })
  .passthrough();

export const pathSchema = z
  .object({
    id: z.string(),
    date: z.string(),
    lockedAt: z.number().nullable(),
    endsAt: z.number(),
    segments: z.array(z.discriminatedUnion('kind', [pointSchema, restSchema])),
    schemaVersion: z.number(),
    version: z.number().catch(0),
    updatedAt: z.number().catch(0),
  })
  .passthrough();

export const dayRecordSchema = z
  .object({
    date: z.string(),
    pointsCleared: z.number(),
    schemaVersion: z.number(),
    version: z.number().catch(0),
    updatedAt: z.number().catch(0),
  })
  .passthrough();

export const settingsSchema = z
  .object({
    schemaVersion: z.number(),
    version: z.number().catch(0),
    updatedAt: z.number().catch(0),
    markerMode: z.enum(['live', 'fixed']),
  })
  .passthrough();

export function parsePath(data: unknown, context: string): Path | null {
  return parse(pathSchema, data, context) as Path | null;
}

export function parseDayRecord(data: unknown, context: string): DayRecord | null {
  return parse(dayRecordSchema, data, context) as DayRecord | null;
}

export function parseSettings(data: unknown, context: string): Settings | null {
  return parse(settingsSchema, data, context) as Settings | null;
}

function parse<T>(schema: z.ZodType<T>, data: unknown, context: string): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`Dropping invalid cloud document (${context}):`, result.error.message);
    return null;
  }
  return result.data;
}
