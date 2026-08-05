import type { Recurrence, RecurrenceMode } from '../types/task';
import { describeRecurrence, defaultRule, frequencyOf, type Frequency } from '../lib/recurrence';
import { MONTH_NAMES } from '../lib/dates';
import { NumberField } from './NumberField';

interface Props {
  recurrence: Recurrence | null;
  /** Where a new rule takes its phase from — the task's due date, or today. */
  from: string;
  onChange: (recurrence: Recurrence | null) => void;
}

// Displayed Monday-first; values are JS weekday numbers (0 = Sunday).
const WEEKDAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
];

/** Only positions that exist in every month, so a rule can't be unsatisfiable. */
const POSITIONS: { value: number; label: string }[] = [
  { value: 1, label: '1st' },
  { value: 2, label: '2nd' },
  { value: 3, label: '3rd' },
  { value: 4, label: '4th' },
  { value: -1, label: 'last' },
];

const UNIT_LABEL: Record<Frequency, string> = {
  daily: 'days',
  weekly: 'weeks',
  monthly: 'months',
  yearly: 'years',
};

const LAST_DAY = -1;

/**
 * Explicit rules, entered explicitly. No parsing and no guessing — a frequency,
 * an interval, and the selectors that frequency needs.
 *
 * The summary line at the bottom is load-bearing rather than decorative: a rule
 * assembled from five controls is easy to get subtly wrong, and reading it back
 * as a sentence is how you catch that before a task starts behaving oddly.
 */
export function RecurrenceEditor({ recurrence, from, onChange }: Props) {
  const frequency = recurrence ? frequencyOf(recurrence) : null;

  const setFrequency = (next: string) => {
    if (next === 'none') return onChange(null);
    const rule = defaultRule(next as Frequency, from);
    // Interval and mode are properties of the schedule, not of the frequency,
    // so they survive switching between weekly and monthly.
    onChange(
      recurrence
        ? { ...rule, interval: recurrence.interval, mode: recurrence.mode }
        : rule,
    );
  };

  const patch = (changes: Partial<Recurrence>) => {
    if (!recurrence) return;
    onChange({ ...recurrence, ...changes } as Recurrence);
  };

  const toggleWeekday = (day: number) => {
    if (recurrence?.freq !== 'weekly') return;
    const has = recurrence.weekdays.includes(day);
    const weekdays = has
      ? recurrence.weekdays.filter((d) => d !== day)
      : [...recurrence.weekdays, day];
    // At least one day stays selected — a weekly rule on no days is a riddle,
    // and the engine would have nothing to land on.
    if (weekdays.length === 0) return;
    onChange({ ...recurrence, weekdays });
  };

  const toggleMonth = (month: number) => {
    if (recurrence?.freq !== 'yearlyByDate' && recurrence?.freq !== 'yearlyByWeekday') return;
    const has = recurrence.months.includes(month);
    const months = has
      ? recurrence.months.filter((m) => m !== month)
      : [...recurrence.months, month];
    if (months.length === 0) return;
    onChange({ ...recurrence, months });
  };

  /** Monthly and yearly each have a by-date form and a by-weekday form. */
  const setForm = (byWeekday: boolean) => {
    if (!recurrence) return;
    const shared = { interval: recurrence.interval, anchor: recurrence.anchor, mode: recurrence.mode };
    const months =
      recurrence.freq === 'yearlyByDate' || recurrence.freq === 'yearlyByWeekday'
        ? recurrence.months
        : [1];

    if (frequency === 'monthly') {
      onChange(
        byWeekday
          ? { freq: 'monthlyByWeekday', week: 1, weekday: 1, ...shared }
          : { freq: 'monthlyByDate', day: 1, ...shared },
      );
    } else if (frequency === 'yearly') {
      onChange(
        byWeekday
          ? { freq: 'yearlyByWeekday', months, week: 1, weekday: 1, ...shared }
          : { freq: 'yearlyByDate', months, day: 1, ...shared },
      );
    }
  };

  const byWeekday =
    recurrence?.freq === 'monthlyByWeekday' || recurrence?.freq === 'yearlyByWeekday';

  const positionControls = (week: number, weekday: number) => (
    <div className="field-row">
      <span>On the</span>
      <select value={week} onChange={(e) => patch({ week: Number(e.target.value) })} aria-label="Position in month">
        {POSITIONS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <select
        value={weekday}
        onChange={(e) => patch({ weekday: Number(e.target.value) })}
        aria-label="Weekday"
      >
        {WEEKDAYS.map((d) => (
          <option key={d.value} value={d.value}>
            {d.label}
          </option>
        ))}
      </select>
    </div>
  );

  const dayControls = (day: number) => (
    <>
      {day !== LAST_DAY && (
        <div className="field-row">
          <span>On day</span>
          <NumberField
            value={day}
            min={1}
            max={31}
            label="Day of month"
            onCommit={(v) => patch({ day: v })}
          />
        </div>
      )}
      <label className="inline-check">
        <input
          type="checkbox"
          checked={day === LAST_DAY}
          onChange={(e) => patch({ day: e.target.checked ? LAST_DAY : 1 })}
        />
        <span>Last day of the month</span>
      </label>
    </>
  );

  return (
    <fieldset className="field">
      <legend>Repeats</legend>

      <select
        value={frequency ?? 'none'}
        onChange={(event) => setFrequency(event.target.value)}
        aria-label="Repeat frequency"
      >
        <option value="none">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="yearly">Yearly</option>
      </select>

      {recurrence && frequency && (
        <>
          <div className="field-row recurrence-detail">
            <span>Every</span>
            <NumberField
              value={recurrence.interval}
              min={1}
              max={999}
              label="Repeat interval"
              onCommit={(interval) => patch({ interval })}
            />
            <span>{UNIT_LABEL[frequency]}</span>
          </div>

          {recurrence.freq === 'weekly' && (
            <div className="field-row weekday-picker" role="group" aria-label="Weekdays">
              {WEEKDAYS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className="weekday-toggle"
                  aria-pressed={recurrence.weekdays.includes(value)}
                  onClick={() => toggleWeekday(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {(frequency === 'monthly' || frequency === 'yearly') && (
            <div className="field-row" role="group" aria-label="Rule form">
              <button
                type="button"
                className="segmented"
                aria-pressed={!byWeekday}
                onClick={() => setForm(false)}
              >
                On a date
              </button>
              <button
                type="button"
                className="segmented"
                aria-pressed={byWeekday}
                onClick={() => setForm(true)}
              >
                On a weekday
              </button>
            </div>
          )}

          {(recurrence.freq === 'yearlyByDate' || recurrence.freq === 'yearlyByWeekday') && (
            <div className="field-row month-picker" role="group" aria-label="Months">
              {MONTH_NAMES.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  className="weekday-toggle"
                  aria-pressed={recurrence.months.includes(index + 1)}
                  onClick={() => toggleMonth(index + 1)}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {recurrence.freq === 'monthlyByDate' && dayControls(recurrence.day)}
          {recurrence.freq === 'yearlyByDate' && dayControls(recurrence.day)}
          {recurrence.freq === 'monthlyByWeekday' &&
            positionControls(recurrence.week, recurrence.weekday)}
          {recurrence.freq === 'yearlyByWeekday' &&
            positionControls(recurrence.week, recurrence.weekday)}

          <label className="field-row">
            <span>Repeat from</span>
            <select
              value={recurrence.mode}
              onChange={(e) => patch({ mode: e.target.value as RecurrenceMode })}
              aria-label="Repeat measured from"
            >
              <option value="grid">The calendar schedule</option>
              <option value="fromCompletion">When I complete it</option>
            </select>
          </label>

          <p className="recurrence-summary">{describeRecurrence(recurrence)}</p>
        </>
      )}
    </fieldset>
  );
}
