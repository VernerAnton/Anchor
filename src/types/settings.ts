import { SCHEMA_VERSION } from '../store/keys';

/**
 * App-level settings. Nearly empty today; it exists from day one because the
 * settings document doubles as the "this install has been initialised" marker,
 * and because adding a field to an existing synced document is easy while
 * adding a whole document type mid-flight is not.
 */
export interface Settings {
  schemaVersion: number;
  version: number;
  updatedAt: number;
}

export function defaultSettings(): Settings {
  return {
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
  };
}
