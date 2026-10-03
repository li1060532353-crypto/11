import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './App';
import './styles/index.css';
import './styles/unified.css';
import './styles/signal.css';
import './styles/workbench-ui.css';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Root element was not found');
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
