/**
 * App-Container.
 *
 * Verbindet Einstellungen, Annotationen und die berechnete Kalenderstruktur.
 * Die Berechnung erfolgt genau einmal (Single Source of Truth) und wird von
 * Bildschirm- und Druckdarstellung gemeinsam verwendet.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { AnnotationColorId, CalendarDay, ColumnColorName } from '../domain/types';
import { buildYearCalendar, summarizeYear } from '../engines/calendarBuilder';
import { useSettingsStore } from '../services/settingsStore';
import { useAnnotationStore } from '../services/annotationStore';
import { useThemeStore } from '../services/themeStore';
import { Toolbar } from './Toolbar';
import { YearCalendar } from './YearCalendar';
import { CalendarLegend } from './CalendarLegend';
import { DayEditor } from './DayEditor';
import { StreakEditor } from './StreakEditor';
import { PrintCalendar } from '../print/PrintCalendar';

export type AppView = 'screen' | 'print';

export function App() {
  const { settings, setYear, setShift, goToPreviousYear, goToNextYear, canGoToPreviousYear, canGoToNextYear } =
    useSettingsStore();
  const { annotations, setAnnotation, resetAnnotation, setColumnColorForDateKeys } =
    useAnnotationStore(settings);
  // Anzeige-Einstellung (Hell/Dunkel): reine Darstellung, keine Fachdaten.
  const theme = useThemeStore();

  const [view, setView] = useState<AppView>('screen');
  const [editingDay, setEditingDay] = useState<CalendarDay | null>(null);

  // Streifen-Auswahl (vertikales Ziehen mit gedrückter Maustaste). Die
  // markierten Tage werden beim Loslassen in einem eigenen Fenster eingefärbt.
  // `streakColumn` merkt sich, in welcher Spalte (Wochentag, Tagesnummer, T/N)
  // der Streifen gestartet wurde; nur diese Spalte wird hervorgehoben und
  // eingefärbt.
  const [streakKeys, setStreakKeys] = useState<string[]>([]);
  const [streakActive, setStreakActive] = useState(false);
  const [streakColumn, setStreakColumn] = useState<ColumnColorName | null>(null);
  const [streakDays, setStreakDays] = useState<CalendarDay[]>([]);

  // Jahreskalender: hängt ausschließlich von Jahr und Schicht ab.
  const calendar = useMemo(
    () => buildYearCalendar({ year: settings.selectedYear, selectedShift: settings.selectedShift }),
    [settings.selectedYear, settings.selectedShift],
  );

  // Gearbeitete Schichten insgesamt (Tag- plus Nachtschichten) des Jahres.
  const workedShiftCount = useMemo(() => summarizeYear(calendar).requiredShiftCount, [calendar]);

  // Schnellzugriff dateKey -> Tag, damit die Auswahl chronologisch sortiert
  // und das Streifen-Fenster mit vollständigen Tagesdaten gefüllt werden kann.
  const dayByKey = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    for (const month of calendar.months) {
      for (const day of month.days) {
        map.set(day.dateKey, day);
      }
    }
    return map;
  }, [calendar]);

  const streakKeySet = useMemo(() => new Set(streakKeys), [streakKeys]);

  const handleOpenEditor = useCallback((day: CalendarDay) => {
    setEditingDay(day);
  }, []);

  const handleStreakStart = useCallback((day: CalendarDay, column: ColumnColorName) => {
    setStreakActive(true);
    setStreakColumn(column);
    setStreakKeys([day.dateKey]);
  }, []);

  const handleStreakEnter = useCallback(
    (day: CalendarDay) => {
      if (!streakActive) return;
      setStreakKeys((current) => (current.includes(day.dateKey) ? current : [...current, day.dateKey]));
    },
    [streakActive],
  );

  const handleStreakEnd = useCallback(() => {
    setStreakActive(false);
    setStreakKeys((current) => {
      if (current.length === 0) return current;
      const days = current
        .map((key) => dayByKey.get(key))
        .filter((day): day is CalendarDay => Boolean(day))
        .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
      setStreakDays(days);
      return current;
    });
  }, [dayByKey]);

  const handleStreakApply = useCallback(
    (dateKeys: readonly string[], column: ColumnColorName, colorId: AnnotationColorId | null) => {
      setColumnColorForDateKeys(dateKeys, column, colorId);
      setStreakKeys([]);
      setStreakColumn(null);
      setStreakDays([]);
    },
    [setColumnColorForDateKeys],
  );

  const handleStreakClose = useCallback(() => {
    setStreakKeys([]);
    setStreakColumn(null);
    setStreakDays([]);
  }, []);

  // Läuft ein Ziehen aus dem Kalender heraus, muss die Auswahl dennoch
  // sauber abgeschlossen werden.
  useEffect(() => {
    if (!streakActive) return;
    const end = () => handleStreakEnd();
    window.addEventListener('mouseup', end);
    return () => window.removeEventListener('mouseup', end);
  }, [streakActive, handleStreakEnd]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  return (
    <div className="app">
      <Toolbar
        year={settings.selectedYear}
        selectedShift={settings.selectedShift}
        onSelectYear={setYear}
        onPreviousYear={goToPreviousYear}
        onNextYear={goToNextYear}
        canGoPrevious={canGoToPreviousYear}
        canGoNext={canGoToNextYear}
        onSelectShift={setShift}
        onOpenPrint={() => setView('print')}
        theme={theme}
      />

      {view === 'screen' ? (
        <main className="screen-view screen-only">
          <CalendarLegend
            year={settings.selectedYear}
            selectedShift={settings.selectedShift}
            workedShiftCount={workedShiftCount}
          />
          <YearCalendar
            calendar={calendar}
            annotations={annotations}
            onOpenEditor={handleOpenEditor}
            selectedKeys={streakKeySet}
            selectedColumn={streakColumn}
            onStreakStart={handleStreakStart}
            onStreakEnter={handleStreakEnter}
            onStreakEnd={handleStreakEnd}
          />
        </main>
      ) : (
        <main className="screen-view">
          <PrintCalendar
            calendar={calendar}
            annotations={annotations}
            onPrint={handlePrint}
            onBack={() => setView('screen')}
          />
        </main>
      )}

      {editingDay && (
        <DayEditor
          day={editingDay}
          selectedShift={settings.selectedShift}
          initialLabel={annotations[editingDay.dateKey]?.label ?? ''}
          initialColorId={annotations[editingDay.dateKey]?.colors.info ?? null}
          onSave={setAnnotation}
          onReset={resetAnnotation}
          onClose={() => setEditingDay(null)}
        />
      )}

      {streakDays.length > 0 && streakColumn && (
        <StreakEditor
          days={streakDays}
          column={streakColumn}
          onApply={handleStreakApply}
          onClose={handleStreakClose}
        />
      )}
    </div>
  );
}
