import { z } from 'zod';
import type { Project, Task } from '../types/task';
import type { Settings } from '../types/settings';
import { PROJECT_COLOR_IDS } from '../types/task';

/**
 * Validation for everything that arrives from the cloud.
 *
 * Cloud data is untrusted input — a different build, a manual console edit, or
 * a half-migrated document can all show up in a snapshot. The working app's
 * rule, kept here: invalid data is dropped with a warning rather than allowed
 * to poison local state.
 *
 * `.passthrough()` lets fields added by future builds survive a round-trip
 * through an older one instead of being silently stripped. `.catch()` on
 * later-added fields lets documents written by older builds still validate
 * instead of being dropped wholesale.
 */

const durationSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('fixed'), minutes: z.number() }),
  z.object({ kind: z.literal('natural'), estimateMinutes: z.number() }),
]);

/**
 * Fields every recurrence rule carries, spread into each variant so the union
 * stays a true discriminated union (which is what gives precise errors and
 * lets `.catch()` apply per field).
 */
const recurrenceCommon = {
  interval: z.number().catch(1),
  anchor: z.string().nullable().catch(null),
  mode: z.enum(['grid', 'fromCompletion']).catch('grid'),
};

/**
 * Rules written before the engine grew intervals used a `kind` discriminator
 * and no shared fields. Upgrading them here — at the boundary that already
 * treats stored data as untrusted — means every task saved by an earlier build
 * keeps working with no separate migration pass.
 *
 * `everyNDays` becomes a completion-relative daily rule because that is what
 * it did: it added N days to the completion base, never consulting a calendar.
 */
function upgradeLegacyRecurrence(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  const raw = value as Record<string, unknown>;
  if (typeof raw.kind !== 'string') return value;

  switch (raw.kind) {
    case 'everyNDays':
      return {
        freq: 'daily',
        interval: typeof raw.n === 'number' ? raw.n : 1,
        anchor: null,
        mode: 'fromCompletion',
      };
    case 'weekly':
      return {
        freq: 'weekly',
        weekdays: Array.isArray(raw.weekdays) ? raw.weekdays : [],
        interval: 1,
        anchor: null,
        mode: 'grid',
      };
    case 'monthlyByDate':
      return {
        freq: 'monthlyByDate',
        day: typeof raw.day === 'number' ? raw.day : 1,
        interval: 1,
        anchor: null,
        mode: 'grid',
      };
    default:
      return value;
  }
}

export const recurrenceSchema = z.preprocess(
  upgradeLegacyRecurrence,
  z.discriminatedUnion('freq', [
    z.object({ freq: z.literal('daily'), ...recurrenceCommon }),
    z.object({ freq: z.literal('weekly'), weekdays: z.array(z.number()), ...recurrenceCommon }),
    z.object({ freq: z.literal('monthlyByDate'), day: z.number(), ...recurrenceCommon }),
    z.object({
      freq: z.literal('monthlyByWeekday'),
      week: z.number(),
      weekday: z.number(),
      ...recurrenceCommon,
    }),
    z.object({
      freq: z.literal('yearlyByDate'),
      months: z.array(z.number()),
      day: z.number(),
      ...recurrenceCommon,
    }),
    z.object({
      freq: z.literal('yearlyByWeekday'),
      months: z.array(z.number()),
      week: z.number(),
      weekday: z.number(),
      ...recurrenceCommon,
    }),
  ]),
);

export const taskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    notes: z.string().nullable().catch(null),
    projectId: z.string().nullable().catch(null),
    parentId: z.string().nullable().catch(null),
    priority: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .nullable()
      .catch(null),
    dueDate: z.string().nullable().catch(null),
    recurrence: recurrenceSchema.nullable().catch(null),
    completedAt: z.number().nullable().catch(null),
    order: z.number().catch(0),
    archived: z.boolean().catch(false),
    firstMove: z.string().nullable().catch(null),
    type: z.enum(['physical', 'abstract']).nullable().catch(null),
    defaultDuration: durationSchema.nullable().catch(null),
    schemaVersion: z.number().catch(1),
    version: z.number().catch(0),
    updatedAt: z.number().catch(0),
  })
  .passthrough();

export const projectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    colorId: z.enum(PROJECT_COLOR_IDS).catch('steel'),
    parentId: z.string().nullable().catch(null),
    order: z.number().catch(0),
    archived: z.boolean().catch(false),
    schemaVersion: z.number().catch(1),
    version: z.number().catch(0),
    updatedAt: z.number().catch(0),
  })
  .passthrough();

export const settingsSchema = z
  .object({
    schemaVersion: z.number().catch(1),
    version: z.number().catch(0),
    updatedAt: z.number().catch(0),
  })
  .passthrough();

export function parseTask(data: unknown, context: string): Task | null {
  return parse(taskSchema, data, context) as Task | null;
}

export function parseProject(data: unknown, context: string): Project | null {
  return parse(projectSchema, data, context) as Project | null;
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
