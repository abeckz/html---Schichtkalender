import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Umschalter für die Anzeige (Hell / Dunkel).
 *
 * Reines Bedienelement der Bildschirmansicht: wird niemals gedruckt und
 * beeinflusst keine Fachdaten. Die Auswahl ist eine zugängliche
 * Radio-Gruppe; der aktive Zustand wird zusätzlich über das Symbol
 * (☀/☾) transportiert, also nicht ausschließlich über Farbe.
 */
import { ThemeToggleButton } from './ThemeToggleButton';
import { themePreferenceNames, } from '../services/themeStore';
const OPTIONS = ['light', 'dark'];
const SYMBOLS = {
    light: '☀',
    dark: '☾',
};
export function ThemeToggle({ theme }) {
    return (_jsx("div", { className: "toolbar-group theme-toggle", role: "radiogroup", "aria-label": "Anzeige", children: OPTIONS.map((option) => (_jsx(ThemeToggleButton, { symbol: SYMBOLS[option], name: themePreferenceNames[option], isSelected: theme.preference === option, onSelect: theme.setPreference, preference: option }, option))) }));
}
