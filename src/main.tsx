import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { startTheme } from './lib/theme';

// Tokens first: every later sheet refers to them. Each component's styles sit
// beside nothing else — one file per component, no file owning the app.
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/components/button.css';
import './styles/components/fields.css';
import './styles/components/identity.css';
import './styles/components/sidebar.css';
import './styles/components/task-list.css';
import './styles/components/task-row.css';
import './styles/components/quick-add.css';
import './styles/components/detail-panel.css';
import './styles/components/project-editor.css';
import './styles/components/view-options.css';
import './styles/components/recurrence.css';
import './styles/components/label-picker.css';
import './styles/components/labels-screen.css';
import './styles/components/notices.css';

// `?theme=none` paints with no theme at all — the blank-theme test.
startTheme();

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
