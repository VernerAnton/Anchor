import { useState } from 'react';
import type { SyncMode } from '../store';
import { getSyncKey, setSyncKey } from '../store/identity';
import { hasFirebaseConfig } from '../store/firebaseConfig';
import { useScrollIntoView } from '../hooks/useScrollIntoView';

interface Props {
  mode: SyncMode;
  onClose: () => void;
}

/**
 * The whole of sync, as one field. Same key on another device, same data —
 * no account, no sign-in, nothing else to configure. The model is ported
 * from the app where it's been working in daily use.
 */
export function SyncSettings({ mode, onClose }: Props) {
  const [key, setKey] = useState(getSyncKey());
  const [busy, setBusy] = useState(false);
  const configured = hasFirebaseConfig();
  const trimmed = key.trim();

  const connect = async () => {
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      // Push local data up first — guarded, so a fresh device connecting to an
      // existing key can never wipe what's already in the cloud.
      const [{ createFirestoreRepository }, { migrateLocalToCloud }] = await Promise.all([
        import('../store/firestoreRepository'),
        import('../store/migrate'),
      ]);
      await migrateLocalToCloud(createFirestoreRepository(trimmed));
      setSyncKey(trimmed);
      // A clean boot on the new backend beats every subscription in the app
      // learning to re-home itself.
      window.location.reload();
    } catch (error) {
      console.warn('Could not connect sync:', error);
      setBusy(false);
    }
  };

  const disconnect = () => {
    setSyncKey('');
    window.location.reload();
  };

  return (
    <div className="editor" ref={useScrollIntoView<HTMLDivElement>()}>
      <div className="editor-hd">Sync · {mode === 'cloud' ? 'Connected' : 'This device only'}</div>

      {!configured ? (
        <p className="sync-note">
          No cloud configured in this build. Add the VITE_FIREBASE values to .env.local
          and rebuild — until then everything lives on this device, fully working.
        </p>
      ) : (
        <>
          <label className="field">
            <span>Sync key</span>
            <input
              value={key}
              onChange={(event) => setKey(event.target.value)}
              placeholder="a phrase only you would use"
              autoFocus
            />
            <small>
              The same key on another device means the same data. There is no account —
              the key is the whole of it, so make it yours and keep it.
            </small>
          </label>

          <div className="editor-row">
            {mode === 'cloud' ? (
              <button type="button" className="cancel" onClick={disconnect}>
                Disconnect
              </button>
            ) : (
              <button type="button" className="save" disabled={!trimmed || busy} onClick={connect}>
                {busy ? 'Connecting…' : 'Connect'}
              </button>
            )}
            <button type="button" className="cancel" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}
