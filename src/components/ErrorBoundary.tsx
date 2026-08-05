import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Keeps a render failure from taking the whole app with it.
 *
 * React unmounts the entire tree when a render throws, which leaves a blank
 * page and — because the same stored data is read again on reload — a blank
 * page every time after that. For an app whose job is to be openable on a bad
 * morning, "reopen it and it breaks again" is close to the worst failure it
 * can have.
 *
 * So the boundary shows what went wrong and offers a way onward, rather than
 * silently swallowing it. The message stays plain: something in the app broke,
 * not something the person did wrong.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Anchor hit an unexpected error:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <main className="crash">
        <h1>Anchor couldn't draw this screen.</h1>
        <p>
          Your tasks are safe — this is a display problem, and nothing has been deleted.
        </p>
        <div className="field-row">
          <button type="button" className="btn btn--primary" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
          <button type="button" className="btn btn--quiet" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
        <pre className="crash__detail">{error.message}</pre>
      </main>
    );
  }
}
