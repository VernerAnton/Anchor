import type { Task } from '../types/task';
import { addDays, shortDate } from './dates';
import { nextOccurrence, recurrenceBase } from './recurrence';

/**
 * The handful of moves that cover almost every reschedule.
 *
 * Opening a date picker to say "tomorrow" is three decisions — month, week,
 * day — for a thing you already knew. These are the three answers worth having
 * to hand, as data: which ones apply to a given task, where each one lands,
 * and what to call it. The panel renders them and nothing more.
 *
 * Every option carries the date it produces, so the button can say where it
 * goes before you press it. "Tomorrow" needs no explanation; "next occurrence"
 * very much does, and a move you can't predict isn't one you'll trust.
 */

export type RescheduleId = 'tomorrow' | 'week' | 'occurrence';

export interface RescheduleOption {
  id: RescheduleId;
  /** What the move is called. */
  label: string;
  /** Where it lands. The value the mutation takes. */
  date: string;
  /** The same date, ready to read. */
  dateLabel: string;
}

function option(id: RescheduleId, label: string, date: string): RescheduleOption {
  return { id, label, date, dateLabel: shortDate(date) };
}

/**
 * The moves available for a task today.
 *
 * The first two are always there — a task with no date at all can be given one
 * this way, which is the fastest route from "someday" to "tomorrow".
 *
 * The third only appears when the task repeats *and* the rule can still
 * produce a date. It skips to the occurrence the rule was going to reach
 * anyway, measured from exactly where completion would measure from: the due
 * date when it's still ahead, today when it has already gone by. Pressing it
 * is "not this one, the next one" — which is a scheduling move, not a verdict,
 * and leaves no record that anything was missed.
 */
export function rescheduleOptions(task: Task, today: string): RescheduleOption[] {
  const options = [
    option('tomorrow', 'Tomorrow', addDays(today, 1)),
    option('week', 'In a week', addDays(today, 7)),
  ];

  const rule = task.recurrence;
  if (rule !== null) {
    const next = nextOccurrence(rule, recurrenceBase(task.dueDate, today));
    if (next !== null) options.push(option('occurrence', 'Next occurrence', next));
  }

  return options;
}
