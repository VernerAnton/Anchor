import type { SyncStatus } from '../store/repository';

/**
 * Sync status as words. Plain and calm: being offline is a normal state for a
 * phone, and the app keeps working through it — nothing here says "error".
 */
export interface SyncStatusText {
  /** For the sidebar footer. */
  short: string;
  /** For the settings screen. */
  long: string;
}

export function syncStatusText(status: SyncStatus | null): SyncStatusText {
  switch (status) {
    case null:
      return { short: '', long: '' };
    case 'local':
      return {
        short: 'On this device',
        long: 'Everything is kept on this device. Nothing leaves it.',
      };
    case 'synced':
      return { short: 'Synced', long: 'Synced. Every change made here is in the cloud, for any device using the same key.' };
    case 'sending':
      return { short: 'Sending…', long: 'Sending recent changes. They’re already saved on this device.' };
    case 'offline':
      return {
        short: 'Offline',
        long: 'Offline. Changes are kept on this device and go up when the connection returns.',
      };
  }
}
