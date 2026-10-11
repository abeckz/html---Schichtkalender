/**
 * Werkzeugleiste.
 *
 * Anordnung an der Leiste (von links nach rechts):
 * - ganz links der Jahresselektor, darunter die Auswahl der Schichten,
 * - daneben als Block die Anzeige-Kästchen samt Umschalter (Anzeigen-Gruppe),
 * - daneben als Block der Umschalter Anzeige (Hell/Dunkel), darunter die
 *   Datei-Steuerung (Sichern/Laden),
 * - daneben die Schaltfläche "Druckansicht",
 * - ganz rechts oben der Titel "BASF Schichtkalender", darunter das ausgewählte
 *   Jahr und darunter die ausgewählte Schicht - wie in der Druckansicht am
 *   rechten Rand ausgerichtet.
 *
 * Die Leiste wird niemals gedruckt.
 */

import type { ShiftId, CalendarViewMode } from '../domain/types.ts';
import { YearSelector } from './YearSelector.tsx';
import { ShiftSelector } from './ShiftSelector.tsx';
import { ThemeToggle } from './ThemeToggle.tsx';
import { ToggleSwitch } from './ToggleSwitch.tsx';
import { CheckboxField } from './CheckboxField.tsx';
import { DataControls } from './DataControls.tsx';
import type { ThemeStore } from '../services/themeStore.ts';
import type { PersistedState } from '../domain/types.ts';

export interface ToolbarProps {
  year: number;
  selectedShift: ShiftId;
  onSelectYear: (year: number) => void;
  onPreviousYear: () => void;
  onNextYear: () => void;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onSelectShift: (shiftId: ShiftId) => void;
  /** Anzeige-Umschalter "Wochentag über Datum" (Standard: aus). */
  weekdayOverDate: boolean;
  /** Schaltet die Anzeige-Option "Wochentag über Datum" um. */
  onToggleWeekdayOverDate: (enabled: boolean) => void;
  /** Anzeige-Kästchen "Schichtkalender" (Standard: an). */
  showShiftCalendar: boolean;
  onToggleShowShiftCalendar: (enabled: boolean) => void;
  /** Anzeige-Kästchen "Geburtstage" (Standard: an). */
  showBirthdays: boolean;
  onToggleShowBirthdays: (enabled: boolean) => void;
  /** Anzeige-Kästchen "Wiederkehrende Ereignisse" (Standard: an). */
  showRecurringEvents: boolean;
  onToggleShowRecurringEvents: (enabled: boolean) => void;
  /** Betriebsart der Ansicht: Schichtkalender oder jahreslose Ansicht. */
  viewMode: CalendarViewMode;
  onToggleViewMode: (anniversaries: boolean) => void;
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
  weekdayOverDate,
  onToggleWeekdayOverDate,
  showShiftCalendar,
  onToggleShowShiftCalendar,
  showBirthdays,
  onToggleShowBirthdays,
  showRecurringEvents,
  onToggleShowRecurringEvents,
  viewMode,
  onToggleViewMode,
  onOpenPrint,
  theme,
  onSaveFile,
  onLoadFile,
  collapsed,
  onToggleCollapsed,
}: ToolbarProps) {
  return (
    <header className={collapsed ? 'toolbar no-print is-collapsed' : 'toolbar no-print'}>
      <div className="toolbar-controls" id="toolbar-controls">
        {/*
          Linker Block: Jahresselektor oben, darunter die Auswahl der Schichten.
          Beide Bedienelemente stehen als Spalte untereinander, damit sie als
          Einheit ganz links an der Leiste beginnen.
        */}
        <div className="toolbar-stack toolbar-stack-left">
          <YearSelector
            year={year}
            onSelectYear={onSelectYear}
            onPreviousYear={onPreviousYear}
            onNextYear={onNextYear}
            canGoPrevious={canGoPrevious}
            canGoNext={canGoNext}
          />
          <ShiftSelector selectedShift={selectedShift} onSelectShift={onSelectShift} />
        </div>
        {/*
          Anzeige-Gruppe: zuerst die Kästchen (Mehrfachauswahl), darunter die
          Umschalter (Ein/Aus). Alle Elemente stehen untereinander in einer
          Spalte, damit ihre Positionen sauber fluchten.
        */}
        <div className="toolbar-group display-toggles">
          <div className="checkbox-group" role="group" aria-label="Anzeigen im Kalender">
            <CheckboxField
              label="Schichtkalender"
              checked={showShiftCalendar}
              onChange={onToggleShowShiftCalendar}
              title="Schichtspalte (T/N), Schichtkennzahlen und Soll-/Werktagsangaben ein-/ausblenden"
            />
            <CheckboxField
              label="Geburtstage"
              checked={showBirthdays}
              onChange={onToggleShowBirthdays}
              title="Geburtstage in Kalender und Druck ein-/ausblenden"
            />
            <CheckboxField
              label="Wiederkehrende Ereignisse"
              checked={showRecurringEvents}
              onChange={onToggleShowRecurringEvents}
              title="Wiederkehrende Ereignisse in Kalender und Druck ein-/ausblenden"
            />
            <CheckboxField
              label="Wochentag über Datum"
              checked={weekdayOverDate}
              onChange={onToggleWeekdayOverDate}
              title="Datum unter den Wochentag setzen (Tagesnummer-Spalte entfällt)"
            />
          </div>
          <div className="toggle-group" role="group" aria-label="Anzeige-Optionen">
            {/* Umschalter der Betriebsart: jahreslose Ansicht <-> Schichtkalender.
                Linke Beschriftung nennt die jahreslose Ansicht, rechts steht die
                Gegenstellung "Schichtkalender"; der Innentext entfällt und der
                Knopf zeigt – umgedreht – auf die jeweils gewählte Seite. */}
            <ToggleSwitch
              label="Geburtstag & wiederkehrende Ereignisse"
              checked={viewMode === 'anniversaries'}
              onChange={onToggleViewMode}
              title="Jahreslose Ansicht ohne Schichten und ohne feste Tage ein-/ausschalten"
              showState={false}
              trailingLabel="Schichtkalender"
              inverted
            />
          </div>
        </div>
        {/* Anzeige (Hell/Dunkel) oben, Datei-Steuerung (Sichern/Laden) darunter. */}
        <div className="toolbar-stack">
          <ThemeToggle theme={theme} />
          <DataControls onSave={onSaveFile} onLoad={onLoadFile} />
        </div>
        <button type="button" className="primary-button" onClick={onOpenPrint}>
          Druckansicht
        </button>
      </div>
      {/*
        Rechter Abschluss der Leiste: oben der Titel, darunter das ausgewählte
        Jahr und darunter die ausgewählte Schicht - wie in der Druckansicht am
        rechten Rand ausgerichtet. Der Einklapp-Schalter folgt ganz rechts.
      */}
      <div className="toolbar-tail">
        <div className="toolbar-titles">
          <h1 className="app-title">BASF Schichtkalender</h1>
          <span className="toolbar-title-year">{year}</span>
          {viewMode === 'shift' && (
            <span className="toolbar-title-shift">Schicht {selectedShift}</span>
          )}
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
      </div>
    </header>
  );
}
