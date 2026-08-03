import type { MarkerMode } from './path';
import { SCHEMA_VERSION } from '../store/keys';

/**
 * User preferences, one document.
 *
 * `markerMode` lives here rather than on a Path because it describes how you
 * want the app to behave, not a fact about any particular day. Changing it
 * should apply everywhere at once, which is what anyone toggling it expects.
 */
export interface Settings {
  schemaVersion: number;
  /** Monotonic write counter. See Path.version. */
  version: number;
  /** Epoch ms of the last write. Informational only. */
  updatedAt: number;
  markerMode: MarkerMode;
}

export function defaultSettings(): Settings {
  return {
    schemaVersion: SCHEMA_VERSION,
    version: 1,
    updatedAt: Date.now(),
    markerMode: 'live',
  };
}
