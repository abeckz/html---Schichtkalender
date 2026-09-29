import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App';
import { applyTheme, getSystemTheme, readThemePreference, resolveTheme } from './services/themeStore';
import './styles.css';
import './print/print.css';

const container = document.getElementById('root');
if (!container) {
  throw new Error('Container #root wurde nicht gefunden.');
}

// Anzeige (Hell/Dunkel) vor dem ersten Rendern setzen, damit kein heller
// Blitz entsteht. Rein kosmetisch, keine Fachlogik.
applyTheme(resolveTheme(readThemePreference(), getSystemTheme()));

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
