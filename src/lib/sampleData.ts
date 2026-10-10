import type { Label, Project, ProjectColor, Recurrence, Task } from '../types/task';
import { SCHEMA_VERSION } from '../store/keys';
import { addDays } from './dates';
import { matches, nextOccurrence } from './recurrence';

/**
 * A plausible week of tasks, for trying the app before it holds anything real
 * — so a fresh install isn't a blank screen.
 *
 * Every id starts with `SAMPLE_PREFIX`, which is the whole removal mechanism:
 * clearing samples deletes exactly the documents whose ids carry it and can't
 * touch anything you made yourself. A prefix rather than a flag on the model —
 * a `sample: true` field would have to be carried by every real task forever
 * to say that it isn't one.
 *
 * The content exercises what's worth seeing: daily, weekday, every-other-week
 * and twice-monthly rules; one-offs with real dates, one of them gone by (so
 * Earlier shows, neutral as ever); unscheduled backlog; subtasks; labels
 * across projects; and a task with nothing set at all.
 */

export const SAMPLE_PREFIX = 'sample-';

export function isSample(id: string): boolean {
  return id.startsWith(SAMPLE_PREFIX);
}

const sid = (id: string) => `${SAMPLE_PREFIX}${id}`;

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

function rule(spec: Partial<Recurrence> & Pick<Recurrence, 'freq'>, anchor: string): Recurrence {
  return { interval: 1, anchor, mode: 'grid', until: null, remaining: null, ...spec } as Recurrence;
}

/** A repeating task's first date on or after today. */
function firstDate(recurrence: Recurrence, today: string): string | null {
  return matches(recurrence, today) ? today : nextOccurrence(recurrence, today);
}

const meta = (now: number) => ({ schemaVersion: SCHEMA_VERSION, version: 1, updatedAt: now });

export function sampleProjects(now: number): Project[] {
  const specs: { id: string; name: string; colorId: ProjectColor }[] = [
    { id: 'health', name: 'Health', colorId: 'sage' },
    { id: 'study', name: 'Study', colorId: 'indigo' },
    { id: 'home', name: 'Home', colorId: 'ochre' },
    { id: 'admin', name: 'Admin', colorId: 'steel' },
  ];
  return specs.map((spec, i) => ({
    id: sid(`p-${spec.id}`),
    name: spec.name,
    colorId: spec.colorId,
    parentId: null,
    order: i + 1,
    archived: false,
    ...meta(now),
  }));
}

export function sampleLabels(now: number): Label[] {
  const specs: { id: string; name: string; colorId: ProjectColor }[] = [
    { id: 'quick', name: 'Quick win', colorId: 'teal' },
    { id: 'computer', name: 'At the computer', colorId: 'violet' },
    { id: 'errand', name: 'Errand', colorId: 'clay' },
  ];
  return specs.map((spec, i) => ({
    id: sid(`l-${spec.id}`),
    name: spec.name,
    colorId: spec.colorId,
    order: i + 1,
    archived: false,
    ...meta(now),
  }));
}

interface Spec extends Partial<Task> {
  id: string;
  title: string;
}

export function sampleTasks(today: string, now: number): Task[] {
  const p = (name: string) => sid(`p-${name}`);
  const l = (...names: string[]) => names.map((name) => sid(`l-${name}`));

  const specs: Spec[] = [
    {
      id: 'walk',
      title: 'Walk before the day loads in',
      projectId: p('health'),
      recurrence: rule({ freq: 'daily', mode: 'fromCompletion' }, today),
    },
    {
      id: 'study',
      title: 'Deep study block',
      projectId: p('study'),
      priority: 1,
      notes: 'Open the file and write one sentence. The rest follows.',
      labelIds: l('computer'),
      recurrence: rule({ freq: 'weekly', weekdays: WEEKDAYS, count: 'weeks' }, today),
    },
    {
      id: 'inbox',
      title: 'Inbox sweep',
      projectId: p('admin'),
      priority: 3,
      labelIds: l('computer', 'quick'),
      recurrence: rule({ freq: 'weekly', weekdays: [1, 4], count: 'weeks' }, today),
    },
    {
      id: 'cook',
      title: 'Cook properly',
      projectId: p('home'),
      recurrence: rule({ freq: 'weekly', weekdays: EVERY_DAY, count: 'weeks' }, today),
    },
    {
      id: 'plants',
      title: 'Water the plants',
      projectId: p('home'),
      labelIds: l('quick'),
      recurrence: rule({ freq: 'weekly', weekdays: [0, 3], count: 'weeks' }, today),
    },
    {
      id: 'longrun',
      title: 'Long run',
      projectId: p('health'),
      // Every other Sunday — the interval case.
      recurrence: rule({ freq: 'weekly', weekdays: [0], count: 'weeks', interval: 2 }, today),
    },
    {
      id: 'accounts',
      title: 'Go through the accounts',
      projectId: p('admin'),
      priority: 2,
      labelIds: l('computer'),
      // The 1st and the 15th: one rule.
      recurrence: rule({ freq: 'monthlyByDate', days: [1, 15] }, today),
    },
    {
      id: 'library',
      title: 'Return the library books',
      // A date that has gone by: it sits in Earlier, and nothing about it is red.
      dueDate: addDays(today, -2),
      labelIds: l('errand'),
    },
    { id: 'dentist', title: 'Dentist', projectId: p('health'), dueDate: addDays(today, 9), priority: 2 },
    {
      id: 'passport',
      title: 'Renew passport',
      projectId: p('admin'),
      dueDate: addDays(today, 17),
      notes: 'Photos are in the desk drawer.',
      labelIds: l('errand'),
    },
    { id: 'bike', title: 'Fix the bike light', projectId: p('home'), priority: 4, labelIds: l('quick') },
    { id: 'reading', title: 'Finish the book on the shelf', projectId: p('study') },
    { id: 'trip', title: 'Plan the trip' },
    { id: 'trip-a', title: 'Pick the dates', parentId: sid('trip') },
    { id: 'trip-b', title: 'Check what it costs', parentId: sid('trip'), labelIds: l('computer') },
  ];

  return specs.map((spec, i) => {
    const recurrence = spec.recurrence ?? null;
    return {
      notes: null,
      projectId: null,
      parentId: null,
      priority: null,
      completedAt: null,
      labelIds: [],
      archived: false,
      ...meta(now),
      ...spec,
      id: sid(spec.id),
      order: i + 1,
      recurrence,
      dueDate: spec.dueDate ?? (recurrence ? firstDate(recurrence, today) : null),
    };
  });
}

/** How many sample documents are present, across everything. */
export function countSamples(...collections: readonly (readonly { id: string }[])[]): number {
  return collections.reduce((sum, docs) => sum + docs.filter((doc) => isSample(doc.id)).length, 0);
}
