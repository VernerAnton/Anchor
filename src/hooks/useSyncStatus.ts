import { useEffect, useState } from 'react';
import { repository, type SyncStatus } from '../store';

/** Where the data stands with the cloud. `null` until the store has said. */
export function useSyncStatus(): SyncStatus | null {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  useEffect(() => repository.subscribeStatus(setStatus), []);
  return status;
}
