import type { PathPattern } from '../types/path';
import { dayOf, weekDates, weekdayOf } from '../lib/dates';
import { entriesOn } from '../store/mutations';

interface Props {
  /** The day being built. The strip moves within whichever week this is in. */
  date: string;
  today: string;
  pattern: PathPattern | null;
  onSelect: (date: string) => void;
}

const SHORT = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;

/**
 * The week, while you're building it.
 *
 * Building a week used to mean seven trips out to the calendar and back, which
 * made a week feel like seven separate jobs rather than one. The strip moves
 * inside the week you're already looking at; the calendar keeps its own job of
 * moving between weeks.
 *
 * Each day carries how many things the pattern holds for it, so an empty
 * Sunday says so from here rather than after you've navigated to it. The count
 * is of what's *placed*, not what will draw — an entry whose rule has moved on
 * is still something you put there, and still yours to remove.
 */
export function WeekdayStrip({ date, today, pattern, onSelect }: Props) {
  const dates = weekDates(date);

  return (
    <nav className="weekday-strip" aria-label="Days of this week">
      <ul className="weekday-strip__days">
        {dates.map((day, index) => {
          const placed = entriesOn(pattern, weekdayOf(day)).length;
          const classes = ['weekday'];
          if (day === date) classes.push('weekday--current');
          if (day === today) classes.push('weekday--today');

          return (
            <li key={day}>
              <button
                type="button"
                className={classes.join(' ')}
                aria-current={day === date ? 'true' : undefined}
                onClick={() => onSelect(day)}
              >
                <span className="weekday__name">{SHORT[index]}</span>
                <span className="weekday__number">{dayOf(day)}</span>
                <span className="weekday__count">
                  {placed > 0 ? String(placed).padStart(2, '0') : '—'}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
