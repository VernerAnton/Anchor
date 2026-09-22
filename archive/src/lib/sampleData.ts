import type { Duration, Project, ProjectColor, Recurrence, Task } from '../types/task';
import type { PathEntry, PathPattern } from '../types/path';
import { SCHEMA_VERSION } from '../store/keys';
import { addDays, todayStr } from './dates';

/**
 * A week's worth of plausible data, for trying the app out before it holds
 * anything real.
 *
 * Every id starts with `SAMPLE_PREFIX`, which is the whole removal mechanism:
 * clearing samples deletes exactly the documents whose ids carry it and can't
 * touch anything you made yourself. That's why it's a prefix rather than a
 * flag on the model — a `sample: true` field would have to be carried by every
 * real task forever to mark that it isn't one.
 *
 * The content is chosen to exercise the parts worth seeing: anchored times and
 * times that follow on, the same task at different times on different days,
 * placed rest, a wildcard, fixed and runs-to-completion durations, daily and
 * weekday and every-other-week and monthly rules, one-offs with real dates,
 * unscheduled backlog, subtasks, and a task with nothing set at all so the
 * day's fill-in behaviour is visible.
 */

export const SAMPLE_PREFIX = 'sample-';

export function isSample(id: string): boolean {
  return id.startsWith(SAMPLE_PREFIX);
}

const fixed = (minutes: number): Duration => ({ kind: 'fixed', minutes });
const natural = (estimateMinutes: number): Duration => ({ kind: 'natural', estimateMinutes });

function rule(spec: Partial<Recurrence> & Pick<Recurrence, 'freq'>, anchor: string): Recurrence {
  return {
    interval: 1,
    anchor,
    mode: 'grid',
    until: null,
    remaining: null,
    ...spec,
  } as Recurrence;
}

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS = [1, 2, 3, 4, 5];

interface SampleSpec extends Partial<Task> {
  id: string;
  title: string;
}

export function sampleProjects(now = Date.now()): Project[] {
  const specs: { id: string; name: string; colorId: ProjectColor }[] = [
    { id: 'health', name: 'Health', colorId: 'sage' },
    { id: 'study', name: 'Study', colorId: 'indigo' },
    { id: 'home', name: 'Home', colorId: 'ochre' },
    { id: 'admin', name: 'Admin', colorId: 'steel' },
  ];

  return specs.map((spec, order) => ({
    id: `${SAMPLE_PREFIX}p-${spec.id}`,
    name: spec.name,
    colorId: spec.colorId,
    parentId: null,
    order,
    archived: false,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: now,
  }));
}

export function sampleTasks(today = todayStr(), now = Date.now()): Task[] {
  const p = (name: string) => `${SAMPLE_PREFIX}p-${name}`;

  const specs: SampleSpec[] = [
    // ── The morning: one anchor, then things that follow it ──────────────
    {
      id: 'walk',
      title: 'Walk before the day loads in',
      projectId: p('health'),
      recurrence: rule({ freq: 'weekly', weekdays: EVERY_DAY, count: 'weeks' }, today),
      defaultDuration: fixed(20),
      firstMove: 'Shoes on, door open',
      type: 'physical',
      order: 1,
    },
    {
      id: 'gym',
      title: 'Gym — preset plan, no deciding',
      projectId: p('health'),
      // Saturday included so the same task can be seen at two different times.
      recurrence: rule({ freq: 'weekly', weekdays: [1, 3, 5, 6], count: 'weeks' }, today),
      defaultDuration: fixed(55),
      firstMove: 'Put the bag by the door',
      type: 'physical',
      order: 2,
    },
    {
      id: 'shower',
      title: 'Shower and eat',
      projectId: p('home'),
      recurrence: rule({ freq: 'weekly', weekdays: EVERY_DAY, count: 'weeks' }, today),
      // Follows whatever comes before it on the path.
      defaultDuration: fixed(35),
      type: 'physical',
      order: 3,
    },

    // ── The middle of the day ────────────────────────────────────────────
    {
      id: 'study',
      title: 'Deep study block',
      projectId: p('study'),
      recurrence: rule({ freq: 'weekly', weekdays: WEEKDAYS, count: 'weeks' }, today),
      defaultDuration: natural(50),
      firstMove: 'Open the file and write one sentence',
      type: 'abstract',
      priority: 1,
      order: 4,
    },
    {
      id: 'notes',
      title: 'Read back yesterday’s notes',
      projectId: p('study'),
      recurrence: rule({ freq: 'weekly', weekdays: WEEKDAYS, count: 'weeks' }, today),
      defaultDuration: fixed(15),
      firstMove: 'Open the notebook',
      type: 'abstract',
      order: 5,
    },
    {
      id: 'inbox',
      title: 'Inbox sweep',
      projectId: p('admin'),
      recurrence: rule({ freq: 'weekly', weekdays: [1, 4], count: 'weeks' }, today),
      defaultDuration: fixed(25),
      firstMove: 'Open the inbox, reply to one',
      type: 'abstract',
      priority: 3,
      order: 6,
    },

    // ── Evening ──────────────────────────────────────────────────────────
    {
      id: 'cook',
      title: 'Cook properly',
      projectId: p('home'),
      recurrence: rule({ freq: 'weekly', weekdays: EVERY_DAY, count: 'weeks' }, today),
      defaultDuration: natural(40),
      firstMove: 'Pick up the knife',
      type: 'physical',
      order: 7,
    },
    {
      id: 'plants',
      title: 'Water the plants',
      projectId: p('home'),
      recurrence: rule({ freq: 'weekly', weekdays: [0, 3], count: 'weeks' }, today),
      // Nothing else set — shows a day filling in the gaps.
      order: 8,
    },

    // ── Less often ───────────────────────────────────────────────────────
    {
      id: 'laundry',
      title: 'Laundry — one load, not the situation',
      projectId: p('home'),
      recurrence: rule({ freq: 'weekly', weekdays: [6], count: 'weeks' }, today),
      defaultDuration: fixed(30),
      firstMove: 'Carry the basket down',
      type: 'physical',
      order: 9,
    },
    {
      id: 'longrun',
      title: 'Long run',
      projectId: p('health'),
      // Every other Sunday — the interval case.
      recurrence: rule({ freq: 'weekly', weekdays: [0], count: 'weeks', interval: 2 }, today),
      defaultDuration: natural(75),
      firstMove: 'Fill the bottle',
      type: 'physical',
      order: 10,
    },
    {
      id: 'accounts',
      title: 'Go through the accounts',
      projectId: p('admin'),
      // Monthly, on the 1st and the 15th.
      recurrence: rule({ freq: 'monthlyByDate', days: [1, 15] }, today),
      defaultDuration: fixed(45),
      firstMove: 'Open the statement',
      type: 'abstract',
      priority: 2,
      order: 11,
    },

    // ── One-offs, with real dates ────────────────────────────────────────
    {
      id: 'dentist',
      title: 'Dentist',
      projectId: p('health'),
      dueDate: addDays(today, 9),
      defaultDuration: fixed(40),
      priority: 2,
      order: 12,
    },
    {
      id: 'passport',
      title: 'Renew passport',
      projectId: p('admin'),
      dueDate: addDays(today, 17),
      firstMove: 'Find the old one',
      type: 'abstract',
      order: 13,
    },

    // ── Backlog: filed, never scheduled ──────────────────────────────────
    {
      id: 'bike',
      title: 'Fix the bike light',
      projectId: p('home'),
      priority: 4,
      order: 14,
    },
    {
      id: 'reading',
      title: 'Finish the book on the shelf',
      projectId: p('study'),
      order: 15,
    },
    {
      id: 'trip',
      title: 'Plan the trip',
      projectId: null,
      order: 16,
    },
    // Subtasks hang off it, so the nesting is visible.
    { id: 'trip-a', title: 'Pick the dates', parentId: `${SAMPLE_PREFIX}trip`, order: 17 },
    { id: 'trip-b', title: 'Check what it costs', parentId: `${SAMPLE_PREFIX}trip`, order: 18 },
  ];

  return specs.map((spec) => ({
    notes: null,
    projectId: null,
    parentId: null,
    priority: null,
    dueDate: null,
    recurrence: null,
    completedAt: null,
    archived: false,
    firstMove: null,
    type: null,
    defaultDuration: null,
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: now,
    ...spec,
    id: `${SAMPLE_PREFIX}${spec.id}`,
    order: spec.order ?? 0,
  })) as Task[];
}

/**
 * The week, arranged. Times live here rather than on the tasks, which is what
 * lets the gym sit at 07:15 on weekdays and 10:00 on Saturday — two entries,
 * two times, one task.
 *
 * Weekdays get a wildcard after lunch: a hole committed to in advance for
 * whatever the week throws up, so an errand on a random Tuesday never means
 * editing the pattern.
 */
export function samplePattern(now = Date.now()): PathPattern {
  const t = (name: string, startTime: string | null = null): PathEntry => ({
    kind: 'task',
    id: `${SAMPLE_PREFIX}e-${name}`,
    taskId: `${SAMPLE_PREFIX}${name.split('@')[0]}`,
    startTime,
  });
  const rest = (name: string, label: string | null, minutes: number): PathEntry => ({
    kind: 'rest',
    id: `${SAMPLE_PREFIX}r-${name}`,
    label,
    minutes,
  });
  const wild = (name: string, startTime: string | null, minutes: number): PathEntry => ({
    kind: 'wildcard',
    id: `${SAMPLE_PREFIX}w-${name}`,
    startTime,
    minutes,
  });

  const weekday = (day: number): PathEntry[] => [
    t(`walk@${day}`, '06:45'),
    t(`gym@${day}`, '07:15'),
    rest(`morning@${day}`, 'Shower, eat', 40),
    t(`shower@${day}`),
    t(`study@${day}`, '10:00'),
    t(`notes@${day}`),
    rest(`lunch@${day}`, 'Lunch', 60),
    t(`inbox@${day}`, '13:30'),
    // The same task, twice in one day — two entries, two ids, cleared
    // independently. A morning block and an afternoon one.
    t(`study@${day}-pm`, '14:15'),
    wild(`admin@${day}`, '16:00', 45),
    t(`cook@${day}`, '18:00'),
    t(`plants@${day}`),
  ];

  return {
    days: {
      '0': [t('walk@0', '08:00'), t('longrun@0', '09:00'), rest('sun', null, 45), t('cook@0', '18:00'), t('plants@0')],
      '1': weekday(1),
      '2': weekday(2),
      '3': weekday(3),
      '4': weekday(4),
      '5': weekday(5),
      // Saturday runs late and easy — same gym task, three hours later.
      '6': [t('walk@6', '09:00'), t('gym@6', '10:00'), rest('sat', 'Shower, eat', 40), t('laundry@6', '11:30'), wild('sat', null, 60), t('cook@6', '18:00')],
    },
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: now,
  };
}
