/**
 * Umschalter für die Anzeige (System / Hell / Dunkel).
 *
 * Reines Bedienelement der Bildschirmansicht: wird niemals gedruckt und
 * beeinflusst keine Fachdaten. Die Auswahl ist eine zugängliche
 * Radio-Gruppe; der aktive Zustand wird zusätzlich über das Symbol
 * (◐/☀/☾) transportiert, also nicht ausschließlich über Farbe.
 */

import { ThemeToggleButton } from './ThemeToggleButton';
import {
  themePreferenceNames,
  type ThemePreference,
  type ThemeStore,
} from '../services/themeStore';

export interface ThemeToggleProps {
  theme: ThemeStore;
}

const OPTIONS: readonly ThemePreference[] = ['system', 'light', 'dark'];

const SYMBOLS: Record<ThemePreference, string> = {
  system: '◐',
  light: '☀',
  dark: '☾',
};

export function ThemeToggle({ theme }: ThemeToggleProps) {
  return (
    <div className="toolbar-group theme-toggle" role="radiogroup" aria-label="Anzeige">
      {OPTIONS.map((option) => (
        <ThemeToggleButton
          key={option}
          symbol={SYMBOLS[option]}
          name={themePreferenceNames[option]}
          isSelected={theme.preference === option}
          onSelect={theme.setPreference}
          preference={option}
        />
      ))}
    </div>
  );
}
