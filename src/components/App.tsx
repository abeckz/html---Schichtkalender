/**
 * App-Container.
 *
 * Verbindet Einstellungen, Annotationen und die berechnete Kalenderstruktur.
 * Die Berechnung erfolgt genau einmal (Single Source of Truth) und wird von
 * Bildschirm- und Druckdarstellung gemeinsam verwendet.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  AnnotationColorId,
  AnnotationMap,
  AnniversaryEntry,
  CalendarDay,
  ColumnColorName,
  ExtraColumnColorKey,
  ExtraColumnText,
  PersistedState,
  StreakTarget,
  UserDayAnnotation,
} from '../domain/types.ts';
import { buildYearCalendar, summarizeYear } from '../engines/calendarBuilder.ts';
import { usedAnnotationColors } from '../config/annotationColors.ts';
import { useSettingsStore } from '../services/settingsStore.ts';
import { useAnnotationStore } from '../services/annotationStore.ts';
import { useAnniversaryStore } from '../services/anniversaryStore.ts';
import { useColorLegendStore } from '../services/colorLegendStore.ts';
import { useThemeStore } from '../services/themeStore.ts';
import { STORAGE_VERSION, extraColumnTextId } from '../services/storage.ts';
import { saveState } from '../services/persistence.ts';
import { useUnsavedChangesGuard } from '../services/unsavedChanges.ts';
import { monthDayOfDateKey } from '../utils/dateUtils.ts';
import { anniversariesAt, matchesForDateKey } from '../engines/anniversaryEngine.ts';
import { Toolbar } from './Toolbar.tsx';
import { YearCalendar } from './YearCalendar.tsx';
import { CalendarLegend } from './CalendarLegend.tsx';
import { ColorLegendEditor } from './ColorLegendEditor.tsx';
import { DayEditor } from './DayEditor.tsx';
import { ExtraColumnEditor } from './ExtraColumnEditor.tsx';
import { AnniversaryEditor } from './AnniversaryEditor.tsx';
import { AnniversaryYearCalendar } from './AnniversaryYearCalendar.tsx';
import { StreakEditor } from './StreakEditor.tsx';
import { UnsavedChangesDialog } from './UnsavedChangesDialog.tsx';
import { PrintCalendar } from '../print/PrintCalendar.tsx';

export type AppView = 'screen' | 'print';

export function App() {
  const {
    settings,
    setYear,
    setShift,
    setWeekdayOverDate,
    setShowShiftCalendar,
    setShowBirthdays,
    setShowRecurringEvents,
    setViewMode,
    addExtraColumn,
    removeExtraColumn,
    setSettings,
    goToPreviousYear,
    goToNextYear,
    canGoToPreviousYear,
    canGoToNextYear,
  } = useSettingsStore();
  const {
    annotations,
    setAnnotation,
    resetAnnotation,
    setColumnColorForDateKeys,
    setExtraColumnText,
    replaceAnnotations,
  } = useAnnotationStore(settings);
  // Erklärtexte der Farblegende (jahresbezogen); rein darstellungsbezogen.
  const { colorLegend, setColorLegendText, replaceColorLegend } = useColorLegendStore(
    settings,
    annotations,
  );
  // Jahreslose Geburtstage und wiederkehrende Ereignisse (nach Monat-Tag "MM-DD").
  const {
    anniversaries,
    replaceDay,
    resetAnniversary,
    setOccurrenceExcluded,
    setSeriesEnd,
    replaceAnniversaries,
  } = useAnniversaryStore(settings);
  // Anzeige-Einstellung (Hell/Dunkel): reine Darstellung, keine Fachdaten.
  const theme = useThemeStore();

  const [view, setView] = useState<AppView>('screen');
  const [editingDay, setEditingDay] = useState<CalendarDay | null>(null);
  // Zusatzspalte, deren eigener Editor gerade geöffnet ist (Fast-Spanne).
  const [editingExtraColumn, setEditingExtraColumn] = useState<{
    colorKey: ExtraColumnColorKey;
    columnLabel: string;
    dateKeys: string[];
  } | null>(null);
  // Jahrestag-Tag, dessen Editor gerade geöffnet ist ("MM-DD" oder null).
  const [editingAnniversary, setEditingAnniversary] = useState<{
    monthDay: string;
    dateKey: string;
  } | null>(null);
  // Farbe, deren Erklärung gerade bearbeitet wird (öffnet den Eingabedialog).
  const [editingLegendColor, setEditingLegendColor] = useState<AnnotationColorId | null>(null);

  // Menübar und Legendenbox oben gemeinsam ein-/ausklappen (reine Anzeige).
  const [collapsed, setCollapsed] = useState(false);
  const handleToggleCollapsed = useCallback(() => setCollapsed((current) => !current), []);

  // Hinweis-Fenster bei ungespeicherten Daten (Schließen-Versuch).
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  // Aktueller Zustand als ein Objekt; Grundlage für Signatur und Speicherung.
  const currentState: PersistedState = useMemo(
    () => ({ version: STORAGE_VERSION, settings, annotations, colorLegend, anniversaries }),
    [settings, annotations, colorLegend, anniversaries],
  );

  // Überwachung ungespeicherter Änderungen: blockiert das Schließen des
  // Fensters (beforeunload) und öffnet zusätzlich den eigenen Hinweis.
  const unsaved = useUnsavedChangesGuard(currentState, () => setShowUnsavedDialog(true));

  // Streifen-Auswahl (vertikales Ziehen mit gedrückter Maustaste). Die
  // markierten Tage werden beim Loslassen in einem eigenen Fenster eingefärbt.
  // `streakColumn` merkt sich das genaue Zieh-Ziel (Wochentag, Tagesnummer, T/N
  // oder eine einzelne Breiteneinheit einer Zusatzspalte wie 'extra0#1'); nur
  // dieses Ziel wird hervorgehoben und danach eingefärbt.
  const [streakKeys, setStreakKeys] = useState<string[]>([]);
  const [streakActive, setStreakActive] = useState(false);
  const [streakColumn, setStreakColumn] = useState<StreakTarget | null>(null);
  const [streakDays, setStreakDays] = useState<CalendarDay[]>([]);

  // Jahreskalender: hängt ausschließlich von Jahr und Schicht ab.
  const calendar = useMemo(
    () => buildYearCalendar({ year: settings.selectedYear, selectedShift: settings.selectedShift }),
    [settings.selectedYear, settings.selectedShift],
  );

  // Gearbeitete Schichten insgesamt (Tag- plus Nachtschichten) des Jahres.
  const workedShiftCount = useMemo(() => summarizeYear(calendar).requiredShiftCount, [calendar]);

  // Für die Farblegende: die im Jahr tatsächlich benutzten Farben sowie die
  // jahresbezogenen Erklärungstexte. Beides ist reine Darstellungsableitung.
  const usedColors = useMemo(
    () => usedAnnotationColors(annotations, settings.selectedYear),
    [annotations, settings.selectedYear],
  );
  const colorTexts = useMemo(
    () => colorLegend[settings.selectedYear] ?? {},
    [colorLegend, settings.selectedYear],
  );

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

  // Öffnet den Jahrestag-Editor für einen Kalendertag (Jahres- oder
  // jahreslose Ansicht). Der Monat-Tag-Schlüssel ist jahresunabhängig; das
  // konkrete Datum (`dateKey`) wird zusätzlich festgehalten, damit einzelne
  // Vorkommen einer Serie gezielt ausgenommen werden können.
  const handleOpenAnniversary = useCallback((day: CalendarDay) => {
    const monthDay = monthDayOfDateKey(day.dateKey);
    if (!monthDay) return;
    setEditingAnniversary({ monthDay, dateKey: day.dateKey });
  }, []);

  // Speichert alle Einträge eines Tages (mehrere Geburtstage und mehrere
  // wiederkehrende Ereignisse). Der Editor liefert die vollständige Liste; sie
  // ersetzt die bisherigen Einträge des Tages in einem Schritt. Serien, die an
  // einem anderen Tag verankert sind und hier nur als Vorkommen erscheinen,
  // werden nicht übernommen (der Anker bleibt dort, wo er ist).
  const handleSaveAnniversary = useCallback(
    (monthDay: string, entries: AnniversaryEntry[]) => {
      replaceDay(monthDay, entries);
    },
    [replaceDay],
  );

  const handleResetAnniversary = useCallback(
    (monthDay: string) => {
      resetAnniversary(monthDay);
    },
    [resetAnniversary],
  );

  // Nimmt ein einzelnes Vorkommen einer Ereignisserie aus ("nur dieses
  // Vorkommen löschen"). Die Serie bleibt an allen übrigen Terminen erhalten.
  const handleExcludeAnniversaryOccurrence = useCallback(
    (monthDay: string, id: string, dateKey: string, excluded: boolean) => {
      setOccurrenceExcluded(monthDay, id, dateKey, excluded);
    },
    [setOccurrenceExcluded],
  );

  // Beendet eine Serie ab dem angeklickten Tag ("Serie ab diesem Datum nicht
  // weiterführen"); ein leerer Wert hebt das Ende wieder auf.
  const handleEndAnniversarySeries = useCallback(
    (monthDay: string, id: string, until: string) => {
      setSeriesEnd(monthDay, id, until);
    },
    [setSeriesEnd],
  );

  /**
   * Anzeigename einer Zusatzspalte aus ihrem Farbschlüssel (`extraN`).
   *
   * Der Name folgt dem Spaltenindex ("Zusatzspalte 0", "1", …). Da die Spalten
   * erst beim Anlegen der Zelle bekannt sind, wird die Nummer direkt aus dem
   * Farbschlüssel abgeleitet - Farben und Texte hängen nicht von der Lage ab.
   */
  const extraColumnLabel = useCallback(
    (colorKey: ExtraColumnColorKey) => `Zusatzspalte ${extraColumnIndex(colorKey)}`,
    [],
  );

  const handleStreakStart = useCallback((day: CalendarDay, column: StreakTarget) => {
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

  /**
   * Schließt den Zieh-Vorgang ab.
   *
   * Bei den festen Farbspalten öffnet sich der bekannte `StreakEditor`
   * (Einfärben). Bei einer Zusatzspalte wird stattdessen direkt der eigene
   * `ExtraColumnEditor` geöffnet: er bündelt Farbe und querliegenden Text der
   * markierten Spanne, ohne dass ein zusätzliches Einfärbe-Fenster erscheint.
   *
   * Die Nebenwirkungen (Editor öffnen) laufen bewusst außerhalb des
   * State-Updaters, damit sie im StrictMode nicht doppelt ausgelöst werden.
   */
  const handleStreakEnd = useCallback(() => {
    setStreakActive(false);
    const keys = streakKeys;
    const column = streakColumn;
    if (keys.length === 0) return;
    const days = keys
      .map((key) => dayByKey.get(key))
      .filter((day): day is CalendarDay => Boolean(day))
      .sort((a, b) => (a.dateKey < b.dateKey ? -1 : a.dateKey > b.dateKey ? 1 : 0));
    const colorKey = column ? extraColorKeyOfUnit(column) : null;
    if (colorKey) {
      // Zusatzspalte: eigenen Editor öffnen, keinen Einfärbe-Dialog. Die Spanne
      // gilt für die gesamte (ggf. erweiterte) Spalte, also für ihren
      // Farbschlüssel - nicht nur für die gezogene Breiteneinheit.
      setEditingExtraColumn({
        colorKey,
        columnLabel: extraColumnLabel(colorKey),
        dateKeys: days.map((day) => day.dateKey),
      });
      setStreakKeys([]);
      setStreakColumn(null);
      return;
    }
    setStreakDays(days);
  }, [dayByKey, streakKeys, streakColumn, extraColumnLabel]);

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

  /** Farbe der Zusatzspalten-Spanne über den eigenen Editor speichern. */
  const handleSaveExtraColumn = useCallback(
    (dateKeys: readonly string[], colorKey: ExtraColumnColorKey, colorId: AnnotationColorId | null) => {
      setColumnColorForDateKeys(dateKeys, colorKey, colorId);
    },
    [setColumnColorForDateKeys],
  );

  /**
   * Entfernt eine Zusatzspalte an der Trennlinie und verschiebt die
   * Annotationen (`extraN`) der verbleibenden Spalten um eine Position nach
   * innen, damit Farben und querliegende Texte bei ihrer Spalte bleiben.
   */
  const handleRemoveExtraColumn = useCallback(
    (month: number, side: 'left' | 'right', index: number) => {
      if (index !== 0) return;
      const before = settings.extraColumns[month];
      if (!before) return;
      // Anzahl linker Spalten VOR dem Entfernen bestimmt den Schlüsselbereich
      // der rechten Seite.
      const leftCountBefore = before.left.reduce(
        (total, width) => total + Math.max(1, Math.trunc(width)),
        0,
      );
      const startKey = side === 'left' ? 0 : leftCountBefore;
      removeExtraColumn(month, side, index);
      replaceAnnotations(
        shiftMonthExtraAnnotations(annotations, month, startKey),
      );
    },
    [removeExtraColumn, settings.extraColumns, annotations, replaceAnnotations],
  );

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

  // Datei-Sicherung: der aktuelle Zustand (Einstellungen + Annotationen)
  // wird als JSON-Datei gesichert. Bevorzugt über den Systemdialog
  // (Chrome/Edge), sonst als Download. Nach Erfolg gilt der Zustand als
  // gesichert (keine Warnung mehr beim Schließen).
  const handleSaveFile = useCallback(async (): Promise<boolean> => {
    const state: PersistedState = {
      version: STORAGE_VERSION,
      settings,
      annotations,
      colorLegend,
      anniversaries,
    };
    const outcome = await saveState(state);
    if (outcome === 'saved') {
      unsaved.markSaved(state);
      setShowUnsavedDialog(false);
      return true;
    }
    return false;
  }, [settings, annotations, colorLegend, anniversaries, unsaved]);

  // Datei laden: übernimmt Einstellungen und Annotationen gemeinsam. Die
  // Werte sind bereits durch parseState bereinigt; der Handler bleibt daher
  // schlank und verändert keine Fachdaten. Der geladene Zustand stammt aus
  // einer Datei und gilt daher sofort als gesichert.
  const handleLoadFile = useCallback(
    (state: PersistedState) => {
      setSettings(state.settings);
      replaceAnnotations(state.annotations);
      replaceColorLegend(state.colorLegend);
      replaceAnniversaries(state.anniversaries);
      unsaved.markLoaded(state);
      // Nach dem Laden keine offene Tages-/Streifen-/Legenden-Auswahl stehen lassen.
      setEditingDay(null);
      setEditingAnniversary(null);
      setEditingLegendColor(null);
      setStreakKeys([]);
      setStreakColumn(null);
      setStreakDays([]);
    },
    [setSettings, replaceAnnotations, replaceColorLegend, replaceAnniversaries, unsaved],
  );

  // Im Hinweis-Fenster: jetzt sichern (bei Erfolg schließt das Fenster).
  const handleDialogSave = useCallback(() => {
    void handleSaveFile();
  }, [handleSaveFile]);

  // Im Hinweis-Fenster: Schließen ohne Speichern bestätigen. Danach wird die
  // Warnung zurückgesetzt und das Fenster erneut geschlossen.
  const handleDialogDiscard = useCallback(() => {
    unsaved.clear();
    setShowUnsavedDialog(false);
    // Erneuter Schließversuch; da nun keine Änderungen mehr gemeldet werden,
    // blockiert der Browser nicht mehr.
    if (typeof window !== 'undefined') window.close();
  }, [unsaved]);

  // Im Hinweis-Fenster: Schließen abbrechen (zur Anwendung zurückkehren).
  const handleDialogCancel = useCallback(() => {
    setShowUnsavedDialog(false);
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
        weekdayOverDate={settings.weekdayOverDate}
        onToggleWeekdayOverDate={setWeekdayOverDate}
        showShiftCalendar={settings.showShiftCalendar}
        onToggleShowShiftCalendar={setShowShiftCalendar}
        showBirthdays={settings.showBirthdays}
        onToggleShowBirthdays={setShowBirthdays}
        showRecurringEvents={settings.showRecurringEvents}
        onToggleShowRecurringEvents={setShowRecurringEvents}
        viewMode={settings.viewMode}
        onToggleViewMode={(anniversaries) => setViewMode(anniversaries ? 'anniversaries' : 'shift')}
        onOpenPrint={() => setView('print')}
        theme={theme}
        onSaveFile={handleSaveFile}
        onLoadFile={handleLoadFile}
        collapsed={collapsed}
        onToggleCollapsed={handleToggleCollapsed}
      />

      {view === 'screen' ? (
        settings.viewMode === 'anniversaries' ? (
          <main className="screen-view screen-only">
            <AnniversaryYearCalendar
              year={settings.selectedYear}
              anniversaries={anniversaries}
              onOpenEditor={handleOpenAnniversary}
            />
          </main>
        ) : (
          <main className="screen-view screen-only">
            {!collapsed && (
              <div className="legend-box" id="legend-box">
                <CalendarLegend
                  year={settings.selectedYear}
                  selectedShift={settings.selectedShift}
                  workedShiftCount={workedShiftCount}
                  usedColors={usedColors}
                  colorTexts={colorTexts}
                  onEditColor={setEditingLegendColor}
                />
              </div>
            )}
            <YearCalendar
              calendar={calendar}
              annotations={annotations}
              weekdayOverDate={settings.weekdayOverDate}
              onOpenEditor={handleOpenEditor}
              showShiftCalendar={settings.showShiftCalendar}
              anniversaries={anniversaries}
              showBirthdays={settings.showBirthdays}
              showRecurringEvents={settings.showRecurringEvents}
              selectedKeys={streakKeySet}
              selectedColumn={streakColumn}
              extraColumns={settings.extraColumns}
              onAddExtraColumn={addExtraColumn}
              onRemoveExtraColumn={handleRemoveExtraColumn}
              onStreakStart={handleStreakStart}
              onStreakEnter={handleStreakEnter}
              onStreakEnd={handleStreakEnd}
            />
          </main>
        )
      ) : (
        <main className="screen-view">
          <PrintCalendar
            calendar={calendar}
            annotations={annotations}
            colorLegend={colorTexts}
            weekdayOverDate={settings.weekdayOverDate}
            showShiftCalendar={settings.showShiftCalendar}
            anniversaries={anniversaries}
            showBirthdays={settings.showBirthdays}
            showRecurringEvents={settings.showRecurringEvents}
            extraColumns={settings.extraColumns}
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

      {editingExtraColumn && (
        <ExtraColumnEditor
          colorKey={editingExtraColumn.colorKey}
          columnLabel={editingExtraColumn.columnLabel}
          dateKeys={editingExtraColumn.dateKeys}
          initialColorId={
            annotations[editingExtraColumn.dateKeys[0]]?.extraColors?.[
              editingExtraColumn.colorKey
            ] ?? null
          }
          initialText={
            // Der Editor bearbeitet die Spanne mit dem Anker (kleinster Tag).
            // Innerhalb der Spalte kann es weitere unabhängige Spannen geben;
            // gesucht wird daher gezielt der Text dieser Spanne (id aus
            // Farbschlüssel + Anker).
            findExtraColumnText(
              annotations[editingExtraColumn.dateKeys[0]]?.extraTexts?.[
                editingExtraColumn.colorKey
              ],
              editingExtraColumn.dateKeys[0] ?? '',
            )?.text ?? ''
          }
          initialVertical={
            findExtraColumnText(
              annotations[editingExtraColumn.dateKeys[0]]?.extraTexts?.[
                editingExtraColumn.colorKey
              ],
              editingExtraColumn.dateKeys[0] ?? '',
            )?.vertical ?? true
          }
          onSave={handleSaveExtraColumn}
          onSaveText={setExtraColumnText}
          onClose={() => setEditingExtraColumn(null)}
        />
      )}

      {editingAnniversary && (
        <AnniversaryEditor
          monthDay={editingAnniversary.monthDay}
          dateKey={editingAnniversary.dateKey}
          year={settings.selectedYear}
          initialEntries={entriesForAnniversaryEditor(
            anniversaries,
            editingAnniversary.monthDay,
            editingAnniversary.dateKey,
            settings.selectedYear,
          )}
          onSave={(entries) => handleSaveAnniversary(editingAnniversary.monthDay, entries)}
          onReset={() => handleResetAnniversary(editingAnniversary.monthDay)}
          onToggleOccurrence={handleExcludeAnniversaryOccurrence}
          onEndSeries={handleEndAnniversarySeries}
          onClose={() => setEditingAnniversary(null)}
        />
      )}

      {editingLegendColor && (
        <ColorLegendEditor
          colorId={editingLegendColor}
          year={settings.selectedYear}
          initialText={colorTexts[editingLegendColor] ?? ''}
          onSave={setColorLegendText}
          onClose={() => setEditingLegendColor(null)}
        />
      )}

      {streakDays.length > 0 && streakColumn && isFixedColumn(streakColumn) && (
        <StreakEditor
          days={streakDays}
          column={streakColumn}
          onApply={handleStreakApply}
          onClose={handleStreakClose}
        />
      )}

      {showUnsavedDialog && (
        <UnsavedChangesDialog
          onSave={handleDialogSave}
          onDiscard={handleDialogDiscard}
          onCancel={handleDialogCancel}
        />
      )}
    </div>
  );
}

/**
 * Prüft, ob ein Streifen-Ziel eine feste Farbspalte benennt ('weekday', 'day'
 * oder 'shift') - im Unterschied zu einer Breiteneinheit einer Zusatzspalte
 * ('extra0', 'extra0#1', …).
 */
function isFixedColumn(column: StreakTarget): column is ColumnColorName {
  return column === 'weekday' || column === 'day' || column === 'shift';
}

/**
 * Ermittelt die Startliste für den Jahrestag-Editor eines konkreten Tages.
 *
 * Neben den an diesem Tag verankerten Einträgen (`anniversariesAt`) werden auch
 * die an diesem Tag stattfindenden wiederkehrenden Vorkommen berücksichtigt.
 * So lassen sich an einem Folgetag „nur dieses Vorkommen löschen" und „Serie ab
 * hier beenden" direkt im Editor bedienen - die Serie bleibt dort sichtbar, wo
 * sie tatsächlich auftritt. Geburtstage erscheinen ohnehin nur an ihrem Tag.
 *
 * Als Basisjahr dient das angezeigte Jahr selbst, damit das Muster stabil
 * bleibt (vgl. `AnniversaryMonthCard`).
 */
function entriesForAnniversaryEditor(
  anniversaries: Parameters<typeof anniversariesAt>[0],
  monthDay: string,
  dateKey: string,
  year: number,
): AnniversaryEntry[] {
  const occurring = matchesForDateKey(anniversaries, dateKey, year, year).map(
    ({ entry }) => entry,
  );
  // Ausgenommene Vorkommen des Tages sind nicht Teil der Anzeige, müssen aber
  // im Editor sichtbar bleiben, solange die Serie dort verankert ist.
  const anchoredAndExcluded = anniversariesAt(anniversaries, monthDay).filter(
    (entry) => !occurring.some((other) => other.id === entry.id),
  );
  return [...occurring, ...anchoredAndExcluded];
}

/**
 * Liefert den Farbschlüssel einer Zusatzspalte zu einem Zieh-Ziel - oder null,
 * wenn das Ziel eine feste Farbspalte ist.
 *
 * Eine Zusatzspalte wird über ihren Farbschlüssel gefärbt (`extra0`); für die
 * Streifen-Auswahl ist zusätzlich die einzelne Breiteneinheit als Zieh-Ziel
 * unterscheidbar (`extra0#1`). Beide Formen werden hier auf den Farbschlüssel
 * zurückgeführt, damit auch eine erweiterte Spalte vollständig eingefärbt und
 * beschriftet wird.
 */
function extraColorKeyOfUnit(column: StreakTarget): ExtraColumnColorKey | null {
  const match = /^(extra[0-9]+)(?:#[0-9]+)?$/.exec(column);
  return match ? (match[1] as ExtraColumnColorKey) : null;
}

/** Nummer einer Zusatzspalte aus ihrem Farbschlüssel (`extra0` -> 0). */
function extraColumnIndex(colorKey: ExtraColumnColorKey): number {
  const match = /^extra([0-9]+)$/.exec(colorKey);
  return match ? Number(match[1]) : 0;
}

/**
 * Verschiebt die Annotationen (`extraN`) eines Monats um eine Position nach
 * innen.
 *
 * Wird beim Entfernen einer Zusatzspalte an der Trennlinie aufgerufen: alle
 * Farben und querliegenden Texte, deren Schlüssel im Schlüsselbereich der
 * betroffenen Seite (ab `startKey`) liegt, rücken auf `extraN-1`. Der Eintrag
 * mit dem kleinsten Schlüssel (`startKey`) entfällt, weil seine Spalte entfernt
 * wurde. Dadurch bleiben die Markierungen bei ihrer jeweiligen Spalte.
 */
function shiftMonthExtraAnnotations(
  annotations: AnnotationMap,
  month: number,
  startKey: number,
): AnnotationMap {
  const monthKey = String(month).padStart(2, '0');
  const next: AnnotationMap = {};
  for (const [dateKey, annotation] of Object.entries(annotations)) {
    // Monat aus dem dateKey (YYYY-MM-DD) ableiten.
    if (dateKey.slice(5, 7) !== monthKey) {
      next[dateKey] = annotation;
      continue;
    }
    const shiftedColors = shiftExtraMap(annotation.extraColors, startKey);
    const shiftedTexts = shiftExtraTextMap(annotation.extraTexts, startKey);
    const updated: UserDayAnnotation = { ...annotation };
    if (shiftedColors) {
      updated.extraColors = shiftedColors;
    } else {
      delete updated.extraColors;
    }
    if (shiftedTexts) {
      updated.extraTexts = shiftedTexts;
    } else {
      delete updated.extraTexts;
    }
    const isEmpty =
      updated.label === '' &&
      Object.keys(updated.colors).length === 0 &&
      !updated.extraColors &&
      !updated.extraTexts;
    if (!isEmpty) next[dateKey] = updated;
  }
  return next;
}

/** Verschiebt eine `extraN`-Farbmap um eine Position nach innen. */
function shiftExtraMap<T>(
  map: Partial<Record<ExtraColumnColorKey, T>> | undefined,
  startKey: number,
): Partial<Record<ExtraColumnColorKey, T>> | undefined {
  if (!map) return undefined;
  const result: Partial<Record<ExtraColumnColorKey, T>> = {};
  for (const [key, value] of Object.entries(map) as Array<[ExtraColumnColorKey, T]>) {
    const index = extraColumnIndex(key);
    if (index < startKey) {
      result[key] = value;
    } else if (index > startKey) {
      result[`extra${index - 1}`] = value;
    }
    // index === startKey: entfällt (Spalte wurde entfernt).
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Sucht in der Liste der querliegenden Texte einer Zusatzspalte den Eintrag,
 * dessen Spanne am Anker (`anchorKey`) beginnt. Da in derselben Spalte mehrere
 * unabhängige Spannen existieren dürfen, ist dies der gezielte Zugriff für den
 * Zusatzspalten-Editor.
 */
function findExtraColumnText(
  texts: readonly ExtraColumnText[] | undefined,
  anchorKey: string,
): ExtraColumnText | undefined {
  return texts?.find((text) => text.dateKeys[0] === anchorKey);
}

/** Verschiebt die querliegenden Texte eines Monats um eine Position nach innen. */
function shiftExtraTextMap(
  map: Partial<Record<ExtraColumnColorKey, ExtraColumnText[]>> | undefined,
  startKey: number,
): Partial<Record<ExtraColumnColorKey, ExtraColumnText[]>> | undefined {
  if (!map) return undefined;
  const result: Partial<Record<ExtraColumnColorKey, ExtraColumnText[]>> = {};
  for (const [key, list] of Object.entries(map) as Array<[ExtraColumnColorKey, ExtraColumnText[]]>) {
    const index = extraColumnIndex(key);
    if (!list || list.length === 0) continue;
    if (index < startKey) {
      result[key] = list;
    } else if (index > startKey) {
      const newKey = `extra${index - 1}` as ExtraColumnColorKey;
      // Farbschlüssel und `id` der Texte mitführen, damit die Bindung an die
      // (jetzt umbenannte) Spalte erhalten bleibt.
      result[newKey] = list.map((text) => ({
        ...text,
        colorKey: newKey,
        id: extraColumnTextId(newKey, text.dateKeys[0] ?? ''),
      }));
    }
    // index === startKey: Texte der entfernten Spalte entfallen.
  }
  return Object.keys(result).length > 0 ? result : undefined;
}
