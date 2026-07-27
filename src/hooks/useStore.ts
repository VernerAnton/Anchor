import { useEffect, useState } from 'react';
import type { DayRecord, Path } from '../types/path';
import type { Settings } from '../types/settings';
import { defaultSettings } from '../types/settings';
import { repository } from '../store';

/**
 * Subscriptions to stored data.
 *
 * Each returns a `loading` flag because the first callback always arrives after
 * render, never during it — the local backend enforces that deliberately so the
 * app is already written the way a networked backend needs.
 */

export function usePath(date: string): { path: Path | null; loading: boolean } {
  const [path, setPath] = useState<Path | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    return repository.subscribePath(date, (next) => {
      setPath(next);
      setLoading(false);
    });
  }, [date]);

  return { path, loading };
}

export function useDays(from: string, to: string): { days: DayRecord[]; loading: boolean } {
  const [days, setDays] = useState<DayRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    return repository.subscribeDays(from, to, (next) => {
      setDays(next);
      setLoading(false);
    });
  }, [from, to]);

  return { days, loading };
}

export function useSettings(): { settings: Settings; loading: boolean } {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  useEffect(
    () =>
      repository.subscribeSettings((next) => {
        if (next) setSettings(next);
        setLoading(false);
      }),
    [],
  );

  return { settings, loading };
}
