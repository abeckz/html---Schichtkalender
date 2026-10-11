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
import { DataControls } from './DataControls';
import type { ThemeStore } from '../services/themeStore';
import type { PersistedState } from '../domain/types';

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
  /** Sichert den Zustand als Datei; Rückgabe: Erfolg. */
  onSaveFile: () => Promise<boolean>;
  /** Lädt einen zuvor gesicherten Zustand aus einer Datei. */
  onLoadFile: (state: PersistedState) => void;
  /** true = Menübar und Legendenbox sind eingeklappt (nur Titel und Pfeil). */
  collapsed: boolean;
  /** Schaltet das Einklappen von Menübar und Legendenbox um. */
  onToggleCollapsed: () => void;
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
  onSaveFile,
  onLoadFile,
  collapsed,
  onToggleCollapsed,
}: ToolbarProps) {
  return (
    <header className={collapsed ? 'toolbar no-print is-collapsed' : 'toolbar no-print'}>
      <h1 className="app-title">BASF Schichtkalender</h1>
      <div className="toolbar-controls" id="toolbar-controls">
        <YearSelector
          year={year}
          onSelectYear={onSelectYear}
          onPreviousYear={onPreviousYear}
          onNextYear={onNextYear}
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
        />
        <ShiftSelector selectedShift={selectedShift} onSelectShift={onSelectShift} />
        {/* Anzeige (Hell/Dunkel) oben, Datei-Steuerung (Sichern/Laden) darunter. */}
        <div className="toolbar-stack">
          <ThemeToggle theme={theme} />
          <DataControls onSave={onSaveFile} onLoad={onLoadFile} />
        </div>
        <button type="button" className="primary-button" onClick={onOpenPrint}>
          Druckansicht
        </button>
      </div>
      <button
        type="button"
        className="toolbar-collapse-toggle"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        aria-controls="toolbar-controls legend-box"
        title={collapsed ? 'Menübar und Legende einblenden' : 'Menübar und Legende einklappen'}
        aria-label={collapsed ? 'Menübar und Legende einblenden' : 'Menübar und Legende einklappen'}
      >
        {/* Dreieckspfeil, Spitze nach unten; gedreht bei eingeklapptem Zustand. */}
        <span className="toolbar-collapse-arrow" aria-hidden="true">
          ▼
        </span>
      </button>
    </header>
  );
}
