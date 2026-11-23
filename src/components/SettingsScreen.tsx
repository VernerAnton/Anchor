import { useState, type FormEvent, type Ref } from 'react';
import type { ThemePreference } from '../types/settings';
import type { BuildInfo } from '../lib/build';

interface Props {
  /** Whether this build was given a cloud to talk to at all. */
  cloudAvailable: boolean;
  connected: boolean;
  statusText: string;
  theme: ThemePreference;
  sampleCount: number;
  build: BuildInfo;
  onOpenMenu: (() => void) | null;
  menuButtonRef: Ref<HTMLButtonElement>;
  headingRef: Ref<HTMLHeadingElement>;
  onTheme(theme: ThemePreference): void;
  onConnect(key: string): Promise<void>;
  onDisconnect(): void;
  onLoadSamples(): void;
  onClearSamples(): void;
}

const THEMES: { id: ThemePreference; label: string }[] = [
  { id: 'system', label: 'Match this device' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
];

/**
 * Sync, appearance, sample tasks and which build this is — each a plain
 * section on one page, not a dialog.
 */
export function SettingsScreen(props: Props) {
  const { onOpenMenu, menuButtonRef, headingRef } = props;
  return (
    <section className="list-panel settings" aria-labelledby="list-heading">
      <header className="list-panel__header">
        {onOpenMenu && (
          <button type="button" className="button" ref={menuButtonRef} onClick={onOpenMenu} aria-controls="sidebar">
            Menu
          </button>
        )}
        <h1 id="list-heading" className="list-panel__title" tabIndex={-1} ref={headingRef}>
          Settings
        </h1>
      </header>

      <SyncSection {...props} />

      <section className="settings__section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="settings__heading">
          Appearance
        </h2>
        <fieldset className="choice-set">
          <legend className="visually-hidden">Colour scheme</legend>
          {THEMES.map((option) => (
            <label key={option.id} className="choice">
              <input
                type="radio"
                name="theme"
                checked={props.theme === option.id}
                onChange={() => props.onTheme(option.id)}
              />
              {option.label}
            </label>
          ))}
        </fieldset>
        <p className="field__hint">Remembered with your tasks, so every device you sync follows it.</p>
      </section>

      <section className="settings__section" aria-labelledby="samples-heading">
        <h2 id="samples-heading" className="settings__heading">
          Sample tasks
        </h2>
        {props.sampleCount > 0 ? (
          <>
            <p className="settings__text">
              Sample tasks, projects and labels are here so the app isn’t empty while you try it.
              Clearing them removes only those — nothing you made yourself.
            </p>
            <div className="button-row">
              <button type="button" className="button" onClick={props.onClearSamples}>
                Clear sample tasks
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="settings__text">No sample tasks on this device.</p>
            <div className="button-row">
              <button type="button" className="button" onClick={props.onLoadSamples}>
                Add sample tasks
              </button>
            </div>
          </>
        )}
      </section>

      <section className="settings__section" aria-labelledby="about-heading">
        <h2 id="about-heading" className="settings__heading">
          This version
        </h2>
        <p className="settings__text">{props.build.detail}</p>
      </section>
    </section>
  );
}

function SyncSection({ cloudAvailable, connected, statusText, onConnect, onDisconnect }: Props) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = key.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setFailure(null);
    try {
      await onConnect(trimmed);
    } catch (error) {
      console.warn('Could not connect sync:', error);
      setFailure(
        'Couldn’t reach the cloud with that key. Check the connection, and that the key is the one in your Firestore rules. Nothing on this device has changed.',
      );
      setBusy(false);
    }
  };

  return (
    <section className="settings__section" aria-labelledby="sync-heading">
      <h2 id="sync-heading" className="settings__heading">
        Sync
      </h2>
      <p className="settings__text" role="status">
        {statusText}
      </p>

      {!cloudAvailable ? (
        <p className="settings__text">
          This build has no cloud set up, so sync isn’t available. Everything works on this
          device.
        </p>
      ) : connected ? (
        <>
          <p className="settings__text">
            Any device using the same key shows the same tasks. Disconnecting returns this device
            to what it held before it connected; the cloud keeps everything.
          </p>
          <div className="button-row">
            <button type="button" className="button" onClick={onDisconnect}>
              Disconnect this device
            </button>
          </div>
        </>
      ) : (
        <form className="settings__form" onSubmit={(event) => void submit(event)}>
          <label className="field__label" htmlFor="sync-key">
            Sync key
          </label>
          <input
            id="sync-key"
            className="text-input"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={key}
            onChange={(event) => setKey(event.target.value)}
          />
          <p className="field__hint">
            There’s no account: the key is the whole of it. The same key on another device means
            the same tasks. This device’s tasks go up first, and nothing already in the cloud is
            overwritten by an older copy.
          </p>
          <div className="button-row">
            <button type="submit" className="button button--primary" disabled={busy}>
              {busy ? 'Connecting…' : 'Connect'}
            </button>
          </div>
          {failure && (
            <p className="settings__failure" role="alert">
              {failure}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
