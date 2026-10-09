import { useId } from 'react';
import type { Recurrence, RecurrenceMode } from '../types/task';
import { defaultRule, frequencyOf, type Frequency } from '../lib/recurrence';
import { MONTH_NAMES } from '../lib/dates';
import { NumberField } from './NumberField';

interface Props {
  recurrence: Recurrence | null;
  /** Where a new rule takes its phase from — the task's due date, or today. */
  from: string;
  /** The rule read back as a sentence, and its next dates — decided upstream. */
  summary: string | null;
  preview: string | null;
  onChange(recurrence: Recurrence | null): void;
}

// Displayed Monday-first; values are JS weekday numbers (0 = Sunday).
const WEEKDAYS = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

/** Only positions that exist in every month, so a rule can't be unsatisfiable. */
const POSITIONS = [
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: -1, label: 'last' },
];

const UNIT: Record<Frequency, string> = { daily: 'days', weekly: 'weeks', monthly: 'months', yearly: 'years' };

const LAST_DAY = -1;

/** Toggles one value in a set that must keep at least one member. */
function toggled(values: number[], value: number): number[] | null {
  const next = values.includes(value) ? values.filter((v) => v !== value) : [...values, value];
  return next.length === 0 ? null : next;
}

/**
 * Explicit rules, entered explicitly. No parsing and no guessing — a
 * frequency, an interval, and the selectors that frequency needs.
 *
 * Every choice is a native control — checkboxes for sets of days, radios for
 * either/or — so what's selected reads with no theme at all. The summary and
 * preview at the bottom are load-bearing: a rule assembled from five controls
 * is easy to get subtly wrong, and reading it back as a sentence and a list of
 * real dates is how you catch that.
 */
export function RecurrenceEditor({ recurrence, from, summary, preview, onChange }: Props) {
  const id = useId();
  const frequency = recurrence ? frequencyOf(recurrence) : null;

  const setFrequency = (next: string) => {
    if (next === 'none') return onChange(null);
    const rule = defaultRule(next as Frequency, from);
    // Interval, mode and end conditions belong to the schedule, not the
    // frequency, so they survive switching between weekly and monthly.
    onChange(
      recurrence
        ? { ...rule, interval: recurrence.interval, mode: recurrence.mode, until: recurrence.until, remaining: recurrence.remaining }
        : rule,
    );
  };

  const patch = (changes: Partial<Recurrence>) => {
    if (recurrence) onChange({ ...recurrence, ...changes } as Recurrence);
  };

  /** Monthly and yearly each have an on-a-date form and an on-a-weekday form. */
  const setForm = (byWeekday: boolean) => {
    if (!recurrence) return;
    const shared = {
      interval: recurrence.interval,
      anchor: recurrence.anchor,
      mode: recurrence.mode,
      until: recurrence.until,
      remaining: recurrence.remaining,
    };
    const months = 'months' in recurrence ? recurrence.months : [1];
    if (frequency === 'monthly') {
      onChange(
        byWeekday
          ? { freq: 'monthlyByWeekday', week: 1, weekday: 1, ...shared }
          : { freq: 'monthlyByDate', days: [1], ...shared },
      );
    } else if (frequency === 'yearly') {
      onChange(
        byWeekday
          ? { freq: 'yearlyByWeekday', months, week: 1, weekday: 1, ...shared }
          : { freq: 'yearlyByDate', months, day: 1, ...shared },
      );
    }
  };

  const byWeekday = recurrence?.freq === 'monthlyByWeekday' || recurrence?.freq === 'yearlyByWeekday';

  const positionControls = (week: number, weekday: number) => (
    <div className="recurrence__row">
      <span>On the</span>
      <select
        className="text-input"
        value={week}
        aria-label="Which one in the month"
        onChange={(e) => patch({ week: Number(e.target.value) })}
      >
        {POSITIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        className="text-input"
        value={weekday}
        aria-label="Weekday"
        onChange={(e) => patch({ weekday: Number(e.target.value) })}
      >
        {WEEKDAYS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <fieldset className="field recurrence">
      <legend className="field__label">Repeats</legend>
      <select
        className="text-input"
        aria-label="How often it repeats"
        value={frequency ?? 'none'}
        onChange={(event) => setFrequency(event.target.value)}
      >
        <option value="none">Doesn’t repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>

      {recurrence && frequency && (
        <>
          <div className="recurrence__row">
            <span>Every</span>
            <NumberField
              value={recurrence.interval}
              min={1}
              max={999}
              label="Repeat interval"
              onCommit={(interval) => patch({ interval })}
            />
            {recurrence.freq === 'weekly' ? (
              <select
                className="text-input"
                aria-label="What the interval counts"
                value={recurrence.count}
                onChange={(e) => patch({ count: e.target.value as 'weeks' | 'occurrences' })}
              >
                <option value="weeks">weeks</option>
                <option value="occurrences">chosen days</option>
              </select>
            ) : (
              <span>{UNIT[frequency]}</span>
            )}
          </div>

          {recurrence.freq === 'weekly' && (
            <fieldset className="choice-set">
              <legend className="visually-hidden">On these days</legend>
              {WEEKDAYS.map(({ value, label }) => (
                <label key={value} className="choice">
                  <input
                    type="checkbox"
                    checked={recurrence.weekdays.includes(value)}
                    onChange={() => {
                      // At least one day stays selected — a weekly rule on no
                      // days would have nothing to land on.
                      const weekdays = toggled(recurrence.weekdays, value);
                      if (weekdays) patch({ weekdays });
                    }}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}

          {(frequency === 'monthly' || frequency === 'yearly') && (
            <fieldset className="choice-set">
              <legend className="visually-hidden">Repeat on</legend>
              <label className="choice">
                <input type="radio" name={`${id}-form`} checked={!byWeekday} onChange={() => setForm(false)} />
                On a date
              </label>
              <label className="choice">
                <input type="radio" name={`${id}-form`} checked={byWeekday} onChange={() => setForm(true)} />
                On a weekday
              </label>
            </fieldset>
          )}

          {(recurrence.freq === 'yearlyByDate' || recurrence.freq === 'yearlyByWeekday') && (
            <fieldset className="choice-set">
              <legend className="visually-hidden">In these months</legend>
              {MONTH_NAMES.map((name, index) => (
                <label key={name} className="choice">
                  <input
                    type="checkbox"
                    checked={recurrence.months.includes(index + 1)}
                    onChange={() => {
                      const months = toggled(recurrence.months, index + 1);
                      if (months) patch({ months });
                    }}
                  />
                  {name}
                </label>
              ))}
            </fieldset>
          )}

          {recurrence.freq === 'monthlyByDate' && (
            <fieldset className="choice-set choice-set--days">
              <legend className="visually-hidden">On these days of the month</legend>
              {[...Array.from({ length: 31 }, (_, i) => i + 1), LAST_DAY].map((day) => (
                <label key={day} className="choice">
                  <input
                    type="checkbox"
                    checked={recurrence.days.includes(day)}
                    onChange={() => {
                      const days = toggled(recurrence.days, day);
                      if (days) patch({ days });
                    }}
                  />
                  {day === LAST_DAY ? 'Last' : day}
                </label>
              ))}
            </fieldset>
          )}

          {recurrence.freq === 'yearlyByDate' && (
            <div className="recurrence__row">
              {recurrence.day !== LAST_DAY && (
                <>
                  <span>On day</span>
                  <NumberField
                    value={recurrence.day}
                    min={1}
                    max={31}
                    label="Day of the month"
                    onCommit={(day) => patch({ day })}
                  />
                </>
              )}
              <label className="choice">
                <input
                  type="checkbox"
                  checked={recurrence.day === LAST_DAY}
                  onChange={(e) => patch({ day: e.target.checked ? LAST_DAY : 1 })}
                />
                Last day of the month
              </label>
            </div>
          )}

          {(recurrence.freq === 'monthlyByWeekday' || recurrence.freq === 'yearlyByWeekday') &&
            positionControls(recurrence.week, recurrence.weekday)}

          <label className="recurrence__row">
            <span>Next one counts from</span>
            <select
              className="text-input"
              value={recurrence.mode}
              onChange={(e) => patch({ mode: e.target.value as RecurrenceMode })}
            >
              <option value="grid">the calendar</option>
              <option value="fromCompletion">when I finish it</option>
            </select>
          </label>

          {recurrence.interval > 1 && recurrence.mode === 'grid' && (
            // The phase, made visible: "every other Saturday" depends on which
            // Saturday is the on-week, and that should be inspectable.
            <label className="recurrence__row">
              <span>Counting from</span>
              <input
                className="text-input"
                type="date"
                value={recurrence.anchor ?? from}
                onChange={(e) => patch({ anchor: e.target.value || from })}
              />
            </label>
          )}

          <div className="recurrence__row">
            <label className="recurrence__row">
              <span>Ends</span>
              <select
                className="text-input"
                value={recurrence.until !== null ? 'until' : recurrence.remaining !== null ? 'times' : 'never'}
                onChange={(e) => {
                  // The endings are mutually exclusive; choosing one clears the other.
                  if (e.target.value === 'never') patch({ until: null, remaining: null });
                  if (e.target.value === 'until') patch({ until: from, remaining: null });
                  if (e.target.value === 'times') patch({ until: null, remaining: 5 });
                }}
              >
                <option value="never">never</option>
                <option value="until">on a date</option>
                <option value="times">after a number of times</option>
              </select>
            </label>
            {recurrence.until !== null && (
              <input
                className="text-input"
                type="date"
                aria-label="Last date it repeats"
                value={recurrence.until}
                onChange={(e) => patch({ until: e.target.value || null })}
              />
            )}
            {recurrence.remaining !== null && (
              <NumberField
                value={recurrence.remaining}
                min={1}
                max={999}
                label="Times left"
                onCommit={(remaining) => patch({ remaining })}
              />
            )}
          </div>

          {summary && <p className="recurrence__summary">{summary}</p>}
          {preview && <p className="recurrence__preview">{preview}</p>}
        </>
      )}
    </fieldset>
  );
}
