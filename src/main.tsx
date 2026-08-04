import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { initRepository } from './store';

import './styles/fonts.css';
import './styles/tokens.css';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('No #root element');

// The backend is chosen before anything renders, so no component ever sees a
// half-initialised store. Local mode resolves in a microtask; cloud mode adds
// one dynamic-import round trip on boot.
initRepository().then((mode) => {
  createRoot(root).render(
    <StrictMode>
      <App syncMode={mode} />
    </StrictMode>,
  );
});
