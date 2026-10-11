import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * App-Container.
 *
 * Verbindet Einstellungen, Annotationen und die berechnete Kalenderstruktur.
 * Die Berechnung erfolgt genau einmal (Single Source of Truth) und wird von
 * Bildschirm- und Druckdarstellung gemeinsam verwendet.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { buildYearCalendar, summarizeYear } from '../engines/calendarBuilder.ts';
import { usedAnnotationColors } from '../config/annotationColors.ts';
import { useSettingsStore } from '../services/settingsStore.ts';
import { useAnnotationStore } from '../services/annotationStore.ts';
import { useAnniversaryStore } from '../services/anniversaryStore.ts';
import { useColorLegendStore } from '../services/colorLegendStore.ts';
import { useThemeStore } from '../services/themeStore.ts';
import { STORAGE_VERSION } from '../services/storage.ts';
import { saveState } from '../services/persistence.ts';
import { useUnsavedChangesGuard } from '../services/unsavedChanges.ts';
import { monthDayOfDateKey } from '../utils/dateUtils.ts';
import { anniversariesAt } from '../engines/anniversaryEngine.ts';
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
export function App() {
    const { settings, setYear, setShift, setWeekdayOverDate, setShowShiftCalendar, setShowBirthdays, setShowRecurringEvents, setViewMode, addExtraColumn, removeExtraColumn, setSettings, goToPreviousYear, goToNextYear, canGoToPreviousYear, canGoToNextYear, } = useSettingsStore();
    const { annotations, setAnnotation, resetAnnotation, setColumnColorForDateKeys, setExtraColumnText, replaceAnnotations, } = useAnnotationStore(settings);
    // Erklärtexte der Farblegende (jahresbezogen); rein darstellungsbezogen.
    const { colorLegend, setColorLegendText, replaceColorLegend } = useColorLegendStore(settings, annotations);
    // Jahreslose Geburtstage und wiederkehrende Ereignisse (nach Monat-Tag "MM-DD").
    const { anniversaries, replaceDay, resetAnniversary, replaceAnniversaries } = useAnniversaryStore(settings);
    // Anzeige-Einstellung (Hell/Dunkel): reine Darstellung, keine Fachdaten.
    const theme = useThemeStore();
    const [view, setView] = useState('screen');
    const [editingDay, setEditingDay] = useState(null);
    // Zusatzspalte, deren eigener Editor gerade geöffnet ist (Fast-Spanne).
    const [editingExtraColumn, setEditingExtraColumn] = useState(null);
    // Jahrestag-Tag, dessen Editor gerade geöffnet ist ("MM-DD" oder null).
    const [editingAnniversary, setEditingAnniversary] = useState(null);
    // Farbe, deren Erklärung gerade bearbeitet wird (öffnet den Eingabedialog).
    const [editingLegendColor, setEditingLegendColor] = useState(null);
    // Menübar und Legendenbox oben gemeinsam ein-/ausklappen (reine Anzeige).
    const [collapsed, setCollapsed] = useState(false);
    const handleToggleCollapsed = useCallback(() => setCollapsed((current) => !current), []);
    // Hinweis-Fenster bei ungespeicherten Daten (Schließen-Versuch).
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    // Aktueller Zustand als ein Objekt; Grundlage für Signatur und Speicherung.
    const currentState = useMemo(() => ({ version: STORAGE_VERSION, settings, annotations, colorLegend, anniversaries }), [settings, annotations, colorLegend, anniversaries]);
    // Überwachung ungespeicherter Änderungen: blockiert das Schließen des
    // Fensters (beforeunload) und öffnet zusätzlich den eigenen Hinweis.
    const unsaved = useUnsavedChangesGuard(currentState, () => setShowUnsavedDialog(true));
    // Streifen-Auswahl (vertikales Ziehen mit gedrückter Maustaste). Die
    // markierten Tage werden beim Loslassen in einem eigenen Fenster eingefärbt.
    // `streakColumn` merkt sich das genaue Zieh-Ziel (Wochentag, Tagesnummer, T/N
    // oder eine einzelne Breiteneinheit einer Zusatzspalte wie 'extra0#1'); nur
    // dieses Ziel wird hervorgehoben und danach eingefärbt.
    const [streakKeys, setStreakKeys] = useState([]);
    const [streakActive, setStreakActive] = useState(false);
    const [streakColumn, setStreakColumn] = useState(null);
    const [streakDays, setStreakDays] = useState([]);
    // Jahreskalender: hängt ausschließlich von Jahr und Schicht ab.
    const calendar = useMemo(() => buildYearCalendar({ year: settings.selectedYear, selectedShift: settings.selectedShift }), [settings.selectedYear, settings.selectedShift]);
    // Gearbeitete Schichten insgesamt (Tag- plus Nachtschichten) des Jahres.
    const workedShiftCount = useMemo(() => summarizeYear(calendar).requiredShiftCount, [calendar]);
    // Für die Farblegende: die im Jahr tatsächlich benutzten Farben sowie die
    // jahresbezogenen Erklärungstexte. Beides ist reine Darstellungsableitung.
    const usedColors = useMemo(() => usedAnnotationColors(annotations, settings.selectedYear), [annotations, settings.selectedYear]);
    const colorTexts = useMemo(() => colorLegend[settings.selectedYear] ?? {}, [colorLegend, settings.selectedYear]);
    // Schnellzugriff dateKey -> Tag, damit die Auswahl chronologisch sortiert
    // und das Streifen-Fenster mit vollständigen Tagesdaten gefüllt werden kann.
    const dayByKey = useMemo(() => {
        const map = new Map();
        for (const month of calendar.months) {
            for (const day of month.days) {
                map.set(day.dateKey, day);
            }
        }
        return map;
    }, [calendar]);
    const streakKeySet = useMemo(() => new Set(streakKeys), [streakKeys]);
    const handleOpenEditor = useCallback((day) => {
        setEditingDay(day);
    }, []);
    // Öffnet den Jahrestag-Editor für einen Kalendertag (Jahres- oder
    // jahreslose Ansicht). Der Monat-Tag-Schlüssel ist jahresunabhängig.
    const handleOpenAnniversary = useCallback((day) => {
        setEditingAnniversary(monthDayOfDateKey(day.dateKey));
    }, []);
    // Speichert alle Einträge eines Tages (mehrere Geburtstage und mehrere
    // wiederkehrende Ereignisse). Der Editor liefert die vollständige Liste; sie
    // ersetzt die bisherigen Einträge des Tages in einem Schritt.
    const handleSaveAnniversary = useCallback((monthDay, entries) => {
        replaceDay(monthDay, entries);
    }, [replaceDay]);
    const handleResetAnniversary = useCallback((monthDay) => {
        resetAnniversary(monthDay);
    }, [resetAnniversary]);
    /**
     * Anzeigename einer Zusatzspalte aus ihrem Farbschlüssel (`extraN`).
     *
     * Der Name folgt dem Spaltenindex ("Zusatzspalte 0", "1", …). Da die Spalten
     * erst beim Anlegen der Zelle bekannt sind, wird die Nummer direkt aus dem
     * Farbschlüssel abgeleitet - Farben und Texte hängen nicht von der Lage ab.
     */
    const extraColumnLabel = useCallback((colorKey) => `Zusatzspalte ${extraColumnIndex(colorKey)}`, []);
    const handleStreakStart = useCallback((day, column) => {
        setStreakActive(true);
        setStreakColumn(column);
        setStreakKeys([day.dateKey]);
    }, []);
    const handleStreakEnter = useCallback((day) => {
        if (!streakActive)
            return;
        setStreakKeys((current) => (current.includes(day.dateKey) ? current : [...current, day.dateKey]));
    }, [streakActive]);
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
        if (keys.length === 0)
            return;
        const days = keys
            .map((key) => dayByKey.get(key))
            .filter((day) => Boolean(day))
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
    const handleStreakApply = useCallback((dateKeys, column, colorId) => {
        setColumnColorForDateKeys(dateKeys, column, colorId);
        setStreakKeys([]);
        setStreakColumn(null);
        setStreakDays([]);
    }, [setColumnColorForDateKeys]);
    const handleStreakClose = useCallback(() => {
        setStreakKeys([]);
        setStreakColumn(null);
        setStreakDays([]);
    }, []);
    /** Farbe der Zusatzspalten-Spanne über den eigenen Editor speichern. */
    const handleSaveExtraColumn = useCallback((dateKeys, colorKey, colorId) => {
        setColumnColorForDateKeys(dateKeys, colorKey, colorId);
    }, [setColumnColorForDateKeys]);
    /**
     * Entfernt eine Zusatzspalte an der Trennlinie und verschiebt die
     * Annotationen (`extraN`) der verbleibenden Spalten um eine Position nach
     * innen, damit Farben und querliegende Texte bei ihrer Spalte bleiben.
     */
    const handleRemoveExtraColumn = useCallback((month, side, index) => {
        if (index !== 0)
            return;
        const before = settings.extraColumns[month];
        if (!before)
            return;
        // Anzahl linker Spalten VOR dem Entfernen bestimmt den Schlüsselbereich
        // der rechten Seite.
        const leftCountBefore = before.left.reduce((total, width) => total + Math.max(1, Math.trunc(width)), 0);
        const startKey = side === 'left' ? 0 : leftCountBefore;
        removeExtraColumn(month, side, index);
        replaceAnnotations(shiftMonthExtraAnnotations(annotations, month, startKey));
    }, [removeExtraColumn, settings.extraColumns, annotations, replaceAnnotations]);
    // Läuft ein Ziehen aus dem Kalender heraus, muss die Auswahl dennoch
    // sauber abgeschlossen werden.
    useEffect(() => {
        if (!streakActive)
            return;
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
    const handleSaveFile = useCallback(async () => {
        const state = {
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
    const handleLoadFile = useCallback((state) => {
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
    }, [setSettings, replaceAnnotations, replaceColorLegend, replaceAnniversaries, unsaved]);
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
        if (typeof window !== 'undefined')
            window.close();
    }, [unsaved]);
    // Im Hinweis-Fenster: Schließen abbrechen (zur Anwendung zurückkehren).
    const handleDialogCancel = useCallback(() => {
        setShowUnsavedDialog(false);
    }, []);
    return (_jsxs("div", { className: "app", children: [_jsx(Toolbar, { year: settings.selectedYear, selectedShift: settings.selectedShift, onSelectYear: setYear, onPreviousYear: goToPreviousYear, onNextYear: goToNextYear, canGoPrevious: canGoToPreviousYear, canGoNext: canGoToNextYear, onSelectShift: setShift, weekdayOverDate: settings.weekdayOverDate, onToggleWeekdayOverDate: setWeekdayOverDate, showShiftCalendar: settings.showShiftCalendar, onToggleShowShiftCalendar: setShowShiftCalendar, showBirthdays: settings.showBirthdays, onToggleShowBirthdays: setShowBirthdays, showRecurringEvents: settings.showRecurringEvents, onToggleShowRecurringEvents: setShowRecurringEvents, viewMode: settings.viewMode, onToggleViewMode: (anniversaries) => setViewMode(anniversaries ? 'anniversaries' : 'shift'), onOpenPrint: () => setView('print'), theme: theme, onSaveFile: handleSaveFile, onLoadFile: handleLoadFile, collapsed: collapsed, onToggleCollapsed: handleToggleCollapsed }), view === 'screen' ? (settings.viewMode === 'anniversaries' ? (_jsx("main", { className: "screen-view screen-only", children: _jsx(AnniversaryYearCalendar, { year: settings.selectedYear, anniversaries: anniversaries, onOpenEditor: handleOpenAnniversary }) })) : (_jsxs("main", { className: "screen-view screen-only", children: [!collapsed && (_jsx("div", { className: "legend-box", id: "legend-box", children: _jsx(CalendarLegend, { year: settings.selectedYear, selectedShift: settings.selectedShift, workedShiftCount: workedShiftCount, usedColors: usedColors, colorTexts: colorTexts, onEditColor: setEditingLegendColor }) })), _jsx(YearCalendar, { calendar: calendar, annotations: annotations, weekdayOverDate: settings.weekdayOverDate, onOpenEditor: handleOpenEditor, showShiftCalendar: settings.showShiftCalendar, anniversaries: anniversaries, showBirthdays: settings.showBirthdays, showRecurringEvents: settings.showRecurringEvents, selectedKeys: streakKeySet, selectedColumn: streakColumn, extraColumns: settings.extraColumns, onAddExtraColumn: addExtraColumn, onRemoveExtraColumn: handleRemoveExtraColumn, onStreakStart: handleStreakStart, onStreakEnter: handleStreakEnter, onStreakEnd: handleStreakEnd })] }))) : (_jsx("main", { className: "screen-view", children: _jsx(PrintCalendar, { calendar: calendar, annotations: annotations, colorLegend: colorTexts, weekdayOverDate: settings.weekdayOverDate, showShiftCalendar: settings.showShiftCalendar, anniversaries: anniversaries, showBirthdays: settings.showBirthdays, showRecurringEvents: settings.showRecurringEvents, extraColumns: settings.extraColumns, onPrint: handlePrint, onBack: () => setView('screen') }) })), editingDay && (_jsx(DayEditor, { day: editingDay, selectedShift: settings.selectedShift, initialLabel: annotations[editingDay.dateKey]?.label ?? '', initialColorId: annotations[editingDay.dateKey]?.colors.info ?? null, onSave: setAnnotation, onReset: resetAnnotation, onClose: () => setEditingDay(null) })), editingExtraColumn && (_jsx(ExtraColumnEditor, { colorKey: editingExtraColumn.colorKey, columnLabel: editingExtraColumn.columnLabel, dateKeys: editingExtraColumn.dateKeys, initialColorId: annotations[editingExtraColumn.dateKeys[0]]?.extraColors?.[editingExtraColumn.colorKey] ?? null, initialText: annotations[editingExtraColumn.dateKeys[0]]?.extraTexts?.[editingExtraColumn.colorKey]?.text ?? '', initialVertical: annotations[editingExtraColumn.dateKeys[0]]?.extraTexts?.[editingExtraColumn.colorKey]?.vertical ?? true, onSave: handleSaveExtraColumn, onSaveText: setExtraColumnText, onClose: () => setEditingExtraColumn(null) })), editingAnniversary && (_jsx(AnniversaryEditor, { monthDay: editingAnniversary, initialEntries: anniversariesAt(anniversaries, editingAnniversary), onSave: (entries) => handleSaveAnniversary(editingAnniversary, entries), onReset: () => handleResetAnniversary(editingAnniversary), onClose: () => setEditingAnniversary(null) })), editingLegendColor && (_jsx(ColorLegendEditor, { colorId: editingLegendColor, year: settings.selectedYear, initialText: colorTexts[editingLegendColor] ?? '', onSave: setColorLegendText, onClose: () => setEditingLegendColor(null) })), streakDays.length > 0 && streakColumn && isFixedColumn(streakColumn) && (_jsx(StreakEditor, { days: streakDays, column: streakColumn, onApply: handleStreakApply, onClose: handleStreakClose })), showUnsavedDialog && (_jsx(UnsavedChangesDialog, { onSave: handleDialogSave, onDiscard: handleDialogDiscard, onCancel: handleDialogCancel }))] }));
}
/**
 * Prüft, ob ein Streifen-Ziel eine feste Farbspalte benennt ('weekday', 'day'
 * oder 'shift') - im Unterschied zu einer Breiteneinheit einer Zusatzspalte
 * ('extra0', 'extra0#1', …).
 */
function isFixedColumn(column) {
    return column === 'weekday' || column === 'day' || column === 'shift';
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
function extraColorKeyOfUnit(column) {
    const match = /^(extra[0-9]+)(?:#[0-9]+)?$/.exec(column);
    return match ? match[1] : null;
}
/** Nummer einer Zusatzspalte aus ihrem Farbschlüssel (`extra0` -> 0). */
function extraColumnIndex(colorKey) {
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
function shiftMonthExtraAnnotations(annotations, month, startKey) {
    const monthKey = String(month).padStart(2, '0');
    const next = {};
    for (const [dateKey, annotation] of Object.entries(annotations)) {
        // Monat aus dem dateKey (YYYY-MM-DD) ableiten.
        if (dateKey.slice(5, 7) !== monthKey) {
            next[dateKey] = annotation;
            continue;
        }
        const shiftedColors = shiftExtraMap(annotation.extraColors, startKey);
        const shiftedTexts = shiftExtraTextMap(annotation.extraTexts, startKey);
        const updated = { ...annotation };
        if (shiftedColors) {
            updated.extraColors = shiftedColors;
        }
        else {
            delete updated.extraColors;
        }
        if (shiftedTexts) {
            updated.extraTexts = shiftedTexts;
        }
        else {
            delete updated.extraTexts;
        }
        const isEmpty = updated.label === '' &&
            Object.keys(updated.colors).length === 0 &&
            !updated.extraColors &&
            !updated.extraTexts;
        if (!isEmpty)
            next[dateKey] = updated;
    }
    return next;
}
/** Verschiebt eine `extraN`-Farbmap um eine Position nach innen. */
function shiftExtraMap(map, startKey) {
    if (!map)
        return undefined;
    const result = {};
    for (const [key, value] of Object.entries(map)) {
        const index = extraColumnIndex(key);
        if (index < startKey) {
            result[key] = value;
        }
        else if (index > startKey) {
            result[`extra${index - 1}`] = value;
        }
        // index === startKey: entfällt (Spalte wurde entfernt).
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
/** Verschiebt die querliegenden Texte eines Monats um eine Position nach innen. */
function shiftExtraTextMap(map, startKey) {
    if (!map)
        return undefined;
    const result = {};
    for (const [key, value] of Object.entries(map)) {
        const index = extraColumnIndex(key);
        if (index < startKey) {
            result[key] = value;
        }
        else if (index > startKey) {
            const newKey = `extra${index - 1}`;
            result[newKey] = { ...value, colorKey: newKey };
        }
        // index === startKey: Text der entfernten Spalte entfällt.
    }
    return Object.keys(result).length > 0 ? result : undefined;
}
