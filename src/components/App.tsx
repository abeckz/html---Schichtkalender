/**
 * App-Container.
 *
 * Verbindet Einstellungen, Annotationen und die berechnete Kalenderstruktur.
 * Die Berechnung erfolgt genau einmal (Single Source of Truth) und wird von
 * Bildschirm- und Druckdarstellung gemeinsam verwendet.
 */

import { useCallback, useMemo, useState } from 'react';
import type { CalendarDay } from '../domain/types';
import { buildYearCalendar } from '../engines/calendarBuilder';
import { useSettingsStore } from '../services/settingsStore';
import { useAnnotationStore } from '../services/annotationStore';
import { useThemeStore } from '../services/themeStore';
import { Toolbar } from './Toolbar';
import { YearCalendar } from './YearCalendar';
import { CalendarLegend } from './CalendarLegend';
import { DayEditor } from './DayEditor';
import { PrintCalendar } from '../print/PrintCalendar';

export type AppView = 'screen' | 'print';

export function App() {
  const { settings, setYear, setShift, goToPreviousYear, goToNextYear, canGoToPreviousYear, canGoToNextYear } =
    useSettingsStore();
  const { annotations, setAnnotation, resetAnnotation } = useAnnotationStore(settings);
  // Anzeige-Einstellung (Hell/Dunkel): reine Darstellung, keine Fachdaten.
  const theme = useThemeStore();

  const [view, setView] = useState<AppView>('screen');
  const [editingDay, setEditingDay] = useState<CalendarDay | null>(null);

  // Jahreskalender: hängt ausschließlich von Jahr und Schicht ab.
  const calendar = useMemo(
    () => buildYearCalendar({ year: settings.selectedYear, selectedShift: settings.selectedShift }),
    [settings.selectedYear, settings.selectedShift],
  );

  const handleOpenEditor = useCallback((day: CalendarDay) => {
    setEditingDay(day);
  }, []);

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
          <CalendarLegend />
          <YearCalendar
            calendar={calendar}
            annotations={annotations}
            onOpenEditor={handleOpenEditor}
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
          initialColorId={annotations[editingDay.dateKey]?.colorId ?? null}
          onSave={setAnnotation}
          onReset={resetAnnotation}
          onClose={() => setEditingDay(null)}
        />
      )}
    </div>
  );
}
