import { shiftDate, toDateKey, weekday } from '../lib/time';

interface Props {
  date: string;
  today: string;
  editing: boolean;
  onChange: (date: string) => void;
  onToggleEditing: () => void;
}

/**
 * Moving between days, and the way into editing.
 *
 * Tomorrow is a first-class destination rather than a buried setting, because
 * the path is meant to be set the night before — the whole mechanism depends on
 * tomorrow being somewhere you can easily stand.
 */
export function DayNav({ date, today, editing, onChange, onToggleEditing }: Props) {
  return (
    <div className="daynav">
      <button type="button" onClick={() => onChange(shiftDate(date, -1))} aria-label="Previous day">
        ◄
      </button>
      <span className="daynav-label">{describe(date, today)}</span>
      <button type="button" onClick={() => onChange(shiftDate(date, 1))} aria-label="Next day">
        ►
      </button>
      <button
        type="button"
        className={`daynav-edit${editing ? ' on' : ''}`}
        onClick={onToggleEditing}
        aria-pressed={editing}
      >
        {editing ? 'Done' : 'Edit'}
      </button>
    </div>
  );
}

function describe(date: string, today: string): string {
  if (date === today) return 'TODAY';
  if (date === shiftDate(today, 1)) return 'TOMORROW';
  if (date === shiftDate(today, -1)) return 'YESTERDAY';

  const [, month, day] = date.split('-').map(Number);
  const parsed = new Date(date + 'T00:00:00');
  const weekdayLabel = toDateKey(parsed) === date ? weekday(parsed) : '';
  return `${weekdayLabel} ${day} / ${String(month).padStart(2, '0')}`.trim();
}
