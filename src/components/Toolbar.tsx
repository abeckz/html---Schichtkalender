/**
 * Werkzeugleiste.
 *
 * Enthält Titel, Jahresauswahl, Schichtauswahl, den Umschalter für die
 * Anzeige (Hell/Dunkel) und den Wechsel in die Druckansicht. Die Leiste wird
 * niemals gedruckt.
 */

import type { ShiftId } from '../domain/types';
import { YearSelector } from './YearSelector';
import { ShiftSelector } from './ShiftSelector';
import { ThemeToggle } from './ThemeToggle';
import type { ThemeStore } from '../services/themeStore';

export interface ToolbarProps {
  year: number;
  selectedShift: ShiftId;
  onSelectYear: (year: number) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onSelectShift: (shiftId: ShiftId) => void;
  onOpenPrint: () => void;
  theme: ThemeStore;
}

export function Toolbar({
  year,
  selectedShift,
  onSelectYear,
  onPreviousYear,
  onNextYear,
  canGoPrevious,
  canGoNext,
  onSelectShift,
  onOpenPrint,
  theme,
}: ToolbarProps) {
  return (
    <header className="toolbar no-print">
      <h1 className="app-title">BASF Schichtkalender</h1>
      <div className="toolbar-controls">
        <YearSelector
          year={year}
          onSelectYear={onSelectYear}
          onPreviousYear={onPreviousYear}
          onNextYear={onNextYear}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
        />
        <ShiftSelector selectedShift={selectedShift} onSelectShift={onSelectShift} />
        <ThemeToggle theme={theme} />
        <button type="button" className="primary-button" onClick={onOpenPrint}>
          Druckansicht
        </button>
      </div>
    </header>
  );
}
