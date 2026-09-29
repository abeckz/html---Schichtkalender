/**
 * Eine einzelne Option des Anzeige-Umschalters.
 *
 * Bewusst als eigene Komponente, damit die Radio-Gruppe eine reine
 * Auswahlliste bleibt und keine Logik doppelt enthält.
 */

import type { ThemePreference } from '../services/themeStore';

export interface ThemeToggleButtonProps {
  preference: ThemePreference;
  symbol: string;
  name: string;
  isSelected: boolean;
  onSelect: (preference: ThemePreference) => void;
}

export function ThemeToggleButton({
  preference,
  symbol,
  name,
  isSelected,
  onSelect,
}: ThemeToggleButtonProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      tabIndex={isSelected ? 0 : -1}
      className={isSelected ? 'theme-button is-active' : 'theme-button'}
      onClick={() => onSelect(preference)}
      title={`Anzeige ${name}`}
      aria-label={`Anzeige ${name}`}
    >
      <span className="theme-symbol" aria-hidden="true">
        {symbol}
      </span>
      <span className="theme-name">{name}</span>
    </button>
  );
}
