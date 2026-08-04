import { shiftDate, toDateKey, weekday } from '../lib/time';

interface Props {
  date: string;
  today: string;
  onChange: (date: string) => void;
}

/**
 * Moving between days.
 *
 * Tomorrow is a first-class destination rather than a buried setting, because
 * the path is meant to be set the night before — the whole mechanism depends on
 * tomorrow being somewhere you can easily stand.
 *
 * There is deliberately no edit control here any more. Rearranging the route
 * while standing on it is the in-the-moment re-deciding the app exists to
 * prevent; that work lives in the workshop now.
 */
export function DayNav({ date, today, onChange }: Props) {
  return (
    <div className="daynav">
      <button type="button" onClick={() => onChange(shiftDate(date, -1))} aria-label="Previous day">
        ◄
      </button>
      <span className="daynav-label">{describe(date, today)}</span>
      <button type="button" onClick={() => onChange(shiftDate(date, 1))} aria-label="Next day">
        ►
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
