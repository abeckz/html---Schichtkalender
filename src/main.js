import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './components/App.tsx';
import { applyTheme, readThemePreference } from './services/themeStore';
import './styles.css';
import './print/print.css';
const container = document.getElementById('root');
if (!container) {
    throw new Error('Container #root wurde nicht gefunden.');
}
// Anzeige (Hell/Dunkel) vor dem ersten Rendern setzen, damit kein heller
// Blitz entsteht. Rein kosmetisch, keine Fachlogik.
applyTheme(readThemePreference());
createRoot(container).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
