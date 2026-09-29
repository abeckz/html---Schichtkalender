/**
 * Jahr-Auswahl mit Vorjahr/Folgejahr.
 *
 * Reines Screen-Element: wird im Druck niemals angezeigt.
 */

import { SELECTABLE_YEARS } from '../config/appDefaults';
import { MIN_YEAR, MAX_YEAR } from '../utils/dateUtils';

export interface YearSelectorProps {
  year: number;
  onSelectYear: (year: number) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
}

export function YearSelector({
  year,
  onSelectYear,
  onPreviousYear,
  onNextYear,
  canGoPrevious,
  canGoNext,
}: YearSelectorProps) {
  const years = SELECTABLE_YEARS.includes(year)
    ? SELECTABLE_YEARS
    : [...SELECTABLE_YEARS, year].sort((a, b) => a - b);

  return (
    <div className="toolbar-group" role="group" aria-label="Jahr wählen">
      <button
        type="button"
        className="icon-button"
        onClick={onPreviousYear}
        disabled={!canGoPrevious}
        aria-label="Vorjahr"
        title="Vorjahr"
      >
        ‹
      </button>
      <label className="field">
        <span className="field-label">Jahr</span>
        <select
          className="year-select"
          value={year}
          onChange={(event) => onSelectYear(Number(event.target.value))}
          aria-label="Jahr"
        >
          {years.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="icon-button"
        onClick={onNextYear}
        disabled={!canGoNext}
        aria-label="Folgejahr"
        title="Folgejahr"
      >
        ›
      </button>
      <span className="field-hint">
        {MIN_YEAR}–{MAX_YEAR} möglich
      </span>
    </div>
  );
}
