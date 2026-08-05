import type { Recurrence } from '../types/task';
import { describeRecurrence } from '../lib/recurrence';

interface Props {
  recurrence: Recurrence | null;
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

/**
 * Explicit rules, entered explicitly. No parsing, no guessing — the three
 * shapes the engine supports, as plain controls.
 */
export function RecurrenceEditor({ recurrence, onChange }: Props) {
  const kind = recurrence?.kind ?? 'none';

  const setKind = (next: string) => {
    switch (next) {
      case 'none':
        return onChange(null);
      case 'everyNDays':
        return onChange({ kind: 'everyNDays', n: 1 });
      case 'weekly':
        return onChange({ kind: 'weekly', weekdays: [1] });
      case 'monthlyByDate':
        return onChange({ kind: 'monthlyByDate', day: 1 });
    }
  };

  const toggleWeekday = (day: number) => {
    if (recurrence?.kind !== 'weekly') return;
    const has = recurrence.weekdays.includes(day);
    const weekdays = has
      ? recurrence.weekdays.filter((d) => d !== day)
      : [...recurrence.weekdays, day];
    // At least one day stays selected — a weekly rule on no days is a riddle.
    if (weekdays.length === 0) return;
    onChange({ kind: 'weekly', weekdays });
  };

  return (
    <fieldset className="field">
      <legend>Repeats</legend>
      <select value={kind} onChange={(event) => setKind(event.target.value)} aria-label="Repeat rule">
        <option value="none">Does not repeat</option>
        <option value="everyNDays">Every N days</option>
        <option value="weekly">Weekly, on chosen days</option>
        <option value="monthlyByDate">Monthly, on a date</option>
      </select>

      {recurrence?.kind === 'everyNDays' && (
        <label className="field-row recurrence-detail">
          <span>Every</span>
          <input
            type="number"
            min={1}
            max={365}
            value={recurrence.n}
            onChange={(event) =>
              onChange({ kind: 'everyNDays', n: Math.max(1, Number(event.target.value) || 1) })
            }
          />
          <span>days</span>
        </label>
      )}

      {recurrence?.kind === 'weekly' && (
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

      {recurrence?.kind === 'monthlyByDate' && (
        <label className="field-row recurrence-detail">
          <span>On day</span>
          <input
            type="number"
            min={1}
            max={31}
            value={recurrence.day}
            onChange={(event) =>
              onChange({
                kind: 'monthlyByDate',
                day: Math.min(31, Math.max(1, Number(event.target.value) || 1)),
              })
            }
          />
          <span>of the month</span>
        </label>
      )}

      {recurrence && <p className="recurrence-summary">{describeRecurrence(recurrence)}</p>}
    </fieldset>
  );
}
