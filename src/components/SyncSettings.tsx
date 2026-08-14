import { useState } from 'react';
import type { SyncMode } from '../store';
import type { ThemeId } from '../types/settings';
import { getSyncKey, setSyncKey } from '../store/identity';
import { hasFirebaseConfig } from '../store/firebaseConfig';

interface Props {
  mode: SyncMode;
  theme: ThemeId;
  onSetTheme: (theme: ThemeId) => void;
  sampleCount: number;
  onLoadSamples: () => Promise<void>;
  onClearSamples: () => Promise<void>;
  onClose: () => void;
}

/**
 * The whole of sync, as one field. Same key on another device, same data —
 * no account, no sign-in, nothing else to configure. The model is ported
 * from the app where it's been working in daily use.
 */
export function SyncSettings({
  mode,
  theme,
  onSetTheme,
  sampleCount,
  onLoadSamples,
  onClearSamples,
  onClose,
}: Props) {
  const [key, setKey] = useState(getSyncKey());
  const [busy, setBusy] = useState(false);
  const [samplesBusy, setSamplesBusy] = useState(false);
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
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Sync settings"
        onClick={(event) => event.stopPropagation()}
      >
        <h2>Sync · {mode === 'cloud' ? 'Connected' : 'This device only'}</h2>

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

            <div className="field-row modal__actions">
              {mode === 'cloud' ? (
                <button type="button" className="btn btn--quiet" onClick={disconnect}>
                  Disconnect
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={!trimmed || busy}
                  onClick={connect}
                >
                  {busy ? 'Connecting…' : 'Connect'}
                </button>
              )}
              <button type="button" className="btn btn--quiet" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        )}

        {/*
          Two complete themes rather than one dimmed: the night one is the
          console, the daylight one is paper. Remembered and synced, because
          which one you want is a decision about how you work.
        */}
        <section className="field">
          <h3 className="field__title">Theme</h3>
          <div className="field-row">
            <button
              type="button"
              className="pick"
              aria-pressed={theme === 'noir'}
              onClick={() => onSetTheme('noir')}
            >
              Noir
            </button>
            <button
              type="button"
              className="pick"
              aria-pressed={theme === 'blossom'}
              onClick={() => onSetTheme('blossom')}
            >
              Blossom
            </button>
          </div>
          <p className="sync-note">
            Noir is the night console. Blossom is the same app in daylight — sakura, sumi ink and
            indigo, readable with the sun on the screen.
          </p>
        </section>

        {/*
          Something to try the app on before it holds anything real. Every
          sample carries a marked id, so clearing them removes exactly those
          and can't reach anything you made yourself.
        */}
        <section className="field modal__danger">
          <h3 className="field__title">Sample data</h3>
          {sampleCount > 0 ? (
            <>
              <p className="sync-note">
                {sampleCount} sample {sampleCount === 1 ? 'item' : 'items'} loaded. Clearing them
                leaves anything you made yourself untouched.
              </p>
              <div className="field-row">
                <button
                  type="button"
                  className="btn btn--quiet"
                  disabled={samplesBusy}
                  onClick={async () => {
                    setSamplesBusy(true);
                    await onClearSamples();
                    setSamplesBusy(false);
                  }}
                >
                  {samplesBusy ? 'Clearing…' : 'Clear the samples'}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="sync-note">
                A week of plausible tasks and four projects — repeat rules, times, rest and a
                backlog — so there's something to move around before you put your own things in.
              </p>
              <div className="field-row">
                <button
                  type="button"
                  className="btn"
                  disabled={samplesBusy}
                  onClick={async () => {
                    setSamplesBusy(true);
                    await onLoadSamples();
                    setSamplesBusy(false);
                  }}
                >
                  {samplesBusy ? 'Loading…' : 'Load sample data'}
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
