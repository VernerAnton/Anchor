import { z } from 'zod';
import type { Label, Project, Task } from '../types/task';
import type { Settings } from '../types/settings';
import { PROJECT_COLOR_IDS } from '../types/task';

/**
 * Validation for everything read from storage.
 *
 * Stored data is untrusted input — a different build, a manual console edit,
 * or a half-written document can all turn up. Invalid documents are dropped
 * with a warning rather than allowed into app state.
 *
 * `.passthrough()` lets fields added by a future build survive a round-trip
 * through an older one. `.catch()` on non-identity fields lets a document
 * written before a field existed still validate instead of being dropped
 * wholesale.
 */

const recurrenceCommon = {
  interval: z.number().catch(1),
  anchor: z.string().nullable().catch(null),
  mode: z.enum(['grid', 'fromCompletion']).catch('grid'),
  until: z.string().nullable().catch(null),
  remaining: z.number().nullable().catch(null),
};

export const recurrenceSchema = z.discriminatedUnion('freq', [
  z.object({ freq: z.literal('daily'), ...recurrenceCommon }),
  z.object({
    freq: z.literal('weekly'),
    weekdays: z.array(z.number()),
    count: z.enum(['weeks', 'occurrences']).catch('weeks'),
    ...recurrenceCommon,
  }),
  z.object({ freq: z.literal('monthlyByDate'), days: z.array(z.number()), ...recurrenceCommon }),
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
]);

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
    labelIds: z.array(z.string()).catch([]),
    order: z.number().catch(0),
    archived: z.boolean().catch(false),
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

export const labelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    colorId: z.enum(PROJECT_COLOR_IDS).catch('steel'),
    order: z.number().catch(0),
    archived: z.boolean().catch(false),
    schemaVersion: z.number().catch(1),
    version: z.number().catch(0),
    updatedAt: z.number().catch(0),
  })
  .passthrough();

/* An unknown sort or group name from a future build reads as the default
   rather than as a broken list. */
const viewOptionsSchema = z.object({
  groupBy: z.enum(['none', 'project', 'label']).catch('none'),
  sortBy: z.enum(['smart', 'priority', 'due', 'name', 'manual']).catch('smart'),
  reverse: z.boolean().catch(false),
});

export const settingsSchema = z
  .object({
    theme: z.enum(['system', 'light', 'dark']).catch('system'),
    views: z.record(z.string(), viewOptionsSchema).catch({}),
    schemaVersion: z.number().catch(1),
    version: z.number().catch(0),
    updatedAt: z.number().catch(0),
  })
  .passthrough();

export function parseLabel(data: unknown, context: string): Label | null {
  return parse(labelSchema, data, context) as Label | null;
}

export function parseSettings(data: unknown, context: string): Settings | null {
  return parse(settingsSchema, data, context) as Settings | null;
}

export function parseProject(data: unknown, context: string): Project | null {
  return parse(projectSchema, data, context) as Project | null;
}

export function parseTask(data: unknown, context: string): Task | null {
  return parse(taskSchema, data, context) as Task | null;
}

function parse<T>(schema: z.ZodType<T>, data: unknown, context: string): T | null {
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`Dropping invalid stored document (${context}):`, result.error.message);
    return null;
  }
  return result.data;
}
