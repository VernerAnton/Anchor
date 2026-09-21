import { useEffect, useState } from 'react';
import type { SyncMode } from '../store';
import { MONTH_NAMES, dayOf, weekdayOf } from '../lib/dates';
import { APP_VERSION } from '../version';

interface Props {
  today: string;
  syncMode: SyncMode;
  cleared: number;
  total: number;
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function clockOf(now: Date): string {
  return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/**
 * One hairline row across the top of the app: what day it is, what time it
 * is, where the data lives, and which build you're on.
 *
 * It frames everything under it as readout rather than page, which is most of
 * what separates a console from a website. It also quietly answers the
 * question that used to need a version number hunted down in a corner —
 * several devices have this installed, and "am I on the current build" should
 * be answerable without looking for it.
 */
export function StatusBar({ today, syncMode, cleared, total }: Props) {
  const [clock, setClock] = useState(() => clockOf(new Date()));

  useEffect(() => {
    // Ticks on the minute rather than the second: a seconds display on a
    // planning screen is a stopwatch, and nothing here is being raced.
    const id = window.setInterval(() => setClock(clockOf(new Date())), 20_000);
    return () => window.clearInterval(id);
  }, []);

  const month = MONTH_NAMES[Number(today.slice(5, 7)) - 1];

  return (
    <div className="statusbar">
      <span className="statusbar__item">
        <span
          className={syncMode === 'cloud' ? 'statusbar__lamp' : 'statusbar__lamp statusbar__lamp--local'}
          aria-hidden="true"
        />
        {syncMode === 'cloud' ? 'SYNCED' : 'LOCAL'}
      </span>
      <span className="statusbar__item">
        {WEEKDAYS[weekdayOf(today)]} {pad(dayOf(today))} {month?.toUpperCase()}
      </span>
      <span className="statusbar__item statusbar__item--clock">{clock}</span>
      <span className="statusbar__gap" />
      <span className="statusbar__item">
        CLEARED <b>{pad(cleared)}</b> / {pad(total)}
      </span>
      <span className="statusbar__item">BUILD {pad(APP_VERSION)}</span>
    </div>
  );
}
