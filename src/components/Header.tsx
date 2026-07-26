import { toClock, weekday } from '../lib/time';

interface Props {
  date: Date;
  now: number;
  routeNumber: number;
}

export function Header({ date, now, routeNumber }: Props) {
  return (
    <header className="bar">
      <span className="mark">
        ANCH<i>O</i>R
      </span>
      <span className="clock">
        {weekday(date)} · ROUTE {String(routeNumber).padStart(2, '0')}
        <b>{toClock(now)}</b>
      </span>
    </header>
  );
}
