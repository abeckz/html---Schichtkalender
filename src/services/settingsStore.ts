/**
 * SettingsStore-Hook.
 *
 * Hält Jahr und Schicht und persistiert Änderungen. Die Fachlogik wird
 * dabei nicht verändert: ein Jahreswechsel berechnet den Kalender neu, ein
 * Schichtwechsel nur die Schichtdarstellung. Annotationen bleiben in beiden
 * Fällen erhalten, weil sie getrennt und global nach dateKey gespeichert
 * werden.
 */

import { useCallback, useState } from 'react';
import type { AppSettings, CalendarViewMode, ShiftId } from '../domain/types.ts';
import {
  MAX_EXTRA_COLUMNS,
  MAX_EXTRA_COLUMN_WIDTH,
  readState,
} from '../services/storage.ts';
import { MAX_YEAR, MIN_YEAR, isValidYear } from '../utils/dateUtils.ts';
import { SELECTABLE_YEARS } from '../config/appDefaults.ts';

/**
 * Seite einer Zusatzspalte.
 *
 * - 'left':  links der Ereignis-/Info-Zelle (zwischen Datum und Info); die neue
 *            Spalte schiebt Info, KW und Schicht (T/N) nach rechts, wobei die
 *            Info-Spalte den Rest der Breite abgibt,
 * - 'right': zwischen der KW-Spalte und der Schichtspalte; die neue Spalte
 *            schiebt die Schichtspalte (T/N) nach rechts.
 */
export type ExtraColumnSide = 'left' | 'right';

export interface SettingsStore {
  settings: AppSettings;
  setYear: (year: number) => void;
  setShift: (shiftId: ShiftId) => void;
  /** Schaltet die Anzeige-Option "Wochentag über Datum" um. */
  setWeekdayOverDate: (enabled: boolean) => void;
  /** Anzeige-Checkbox "Schichtkalender". */
  setShowShiftCalendar: (enabled: boolean) => void;
  /** Anzeige-Checkbox "Geburtstag". */
  setShowBirthdays: (enabled: boolean) => void;
  /** Anzeige-Checkbox "wdh. Ereignis". */
  setShowRecurringEvents: (enabled: boolean) => void;
  /** Wechselt zwischen Schichtkalender und jahresloser Ansicht. */
  setViewMode: (mode: CalendarViewMode) => void;
  /**
   * Legt eine schmale Zusatzspalte an: `side` = 'left' links der
   * Ereigniszelle (zwischen Datum und Info), 'right' zwischen KW und T/N.
   */
  addExtraColumn: (month: number, side: ExtraColumnSide) => void;
  /**
   * Erweitert eine vorhandene Zusatzspalte um eine Einheit.
   *
   * Nur die direkt an der Trennlinie liegende Spalte darf wachsen; sonst würde
   * sich die Anordnung der bereits vorhandenen Spalten verschieben (die neue
   * Spalte soll die Ansicht nach außen schieben).
   */
  widenExtraColumn: (month: number, side: ExtraColumnSide, index: number) => void;
  /**
   * Entfernt eine Zusatzspalte vollständig bzw. verkleinert sie (Bedienpunkt
   * `−`).
   *
   * Die Spalte unmittelbar an der Trennlinie (`index`) ist die einzige, die
   * entfernt werden kann; ist sie breiter als eine Einheit, verliert sie nur
   * eine Einheit, andernfalls entfällt sie ganz und die Anordnung der übrigen
   * Spalten der Seite rückt nach. Die zugehörigen Farben und querliegenden
   * Texte (`extraN`) werden beim Entfernen aus allen Annotationen des Monats
   * geräumt.
   */
  removeExtraColumn: (month: number, side: ExtraColumnSide, index: number) => void;
  /** Übernimmt Jahr und Schicht gemeinsam (z. B. beim Laden einer Datei). */
  setSettings: (next: Partial<AppSettings>) => void;
  goToPreviousYear: () => void;
  goToNextYear: () => void;
  canGoToPreviousYear: boolean;
  canGoToNextYear: boolean;
}

/** Begrenzt ein Jahr auf den unterstützten Bereich. */
export function clampYear(year: number): number {
  if (!Number.isInteger(year)) return MIN_YEAR;
  return Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
}

/** Vorjahr innerhalb der Auswahlliste (oder MIN_YEAR). */
export function previousSelectableYear(year: number): number {
  const index = SELECTABLE_YEARS.indexOf(year);
  if (index > 0) return SELECTABLE_YEARS[index - 1];
  return clampYear(year - 1);
}

/** Folgejahr innerhalb der Auswahlliste (oder MAX_YEAR). */
export function nextSelectableYear(year: number): number {
  const index = SELECTABLE_YEARS.indexOf(year);
  if (index >= 0 && index < SELECTABLE_YEARS.length - 1) return SELECTABLE_YEARS[index + 1];
  return clampYear(year + 1);
}

export function useSettingsStore(initial?: Partial<AppSettings>): SettingsStore {
  const [settings, setSettings] = useState<AppSettings>(() => {
    const persisted = readState().settings;
    return {
      selectedYear: isValidYear(initial?.selectedYear ?? persisted.selectedYear)
        ? (initial?.selectedYear ?? persisted.selectedYear)
        : persisted.selectedYear,
      selectedShift: initial?.selectedShift ?? persisted.selectedShift,
      weekdayOverDate: initial?.weekdayOverDate ?? persisted.weekdayOverDate,
      showShiftCalendar: initial?.showShiftCalendar ?? persisted.showShiftCalendar,
      showBirthdays: initial?.showBirthdays ?? persisted.showBirthdays,
      showRecurringEvents: initial?.showRecurringEvents ?? persisted.showRecurringEvents,
      viewMode: initial?.viewMode ?? persisted.viewMode,
      extraColumns: initial?.extraColumns ?? persisted.extraColumns,
    };
  });

  const setYear = useCallback((year: number) => {
    setSettings((current) => ({ ...current, selectedYear: clampYear(year) }));
  }, []);

  const setShift = useCallback((shiftId: ShiftId) => {
    setSettings((current) => ({ ...current, selectedShift: shiftId }));
  }, []);

  const setWeekdayOverDate = useCallback((enabled: boolean) => {
    setSettings((current) => ({ ...current, weekdayOverDate: enabled }));
  }, []);

  const setShowShiftCalendar = useCallback((enabled: boolean) => {
    setSettings((current) => ({ ...current, showShiftCalendar: enabled }));
  }, []);

  const setShowBirthdays = useCallback((enabled: boolean) => {
    setSettings((current) => ({ ...current, showBirthdays: enabled }));
  }, []);

  const setShowRecurringEvents = useCallback((enabled: boolean) => {
    setSettings((current) => ({ ...current, showRecurringEvents: enabled }));
  }, []);

  const setViewMode = useCallback((mode: CalendarViewMode) => {
    setSettings((current) => ({ ...current, viewMode: mode }));
  }, []);

  const addExtraColumn = useCallback((month: number, side: ExtraColumnSide) => {
    setSettings((current) => {
      const existing = current.extraColumns[month];
      const left = [...(existing?.left ?? [])];
      const right = [...(existing?.right ?? [])];
      const target = side === 'left' ? left : right;
      if (target.length >= MAX_EXTRA_COLUMNS) return current;
      target.unshift(1);
      return {
        ...current,
        extraColumns: { ...current.extraColumns, [month]: { left, right } },
      };
    });
  }, []);

  const widenExtraColumn = useCallback(
    (month: number, side: ExtraColumnSide, index: number) => {
      setSettings((current) => {
        const existing = current.extraColumns[month];
        if (!existing) return current;
        const list = [...(side === 'left' ? existing.left : existing.right)];
        if (index !== 0 || list.length === 0) return current;
        if (list[0] + 1 > MAX_EXTRA_COLUMN_WIDTH) return current;
        list[0] += 1;
        return {
          ...current,
          extraColumns: {
            ...current.extraColumns,
            [month]: side === 'left' ? { left: list, right: existing.right } : { left: existing.left, right: list },
          },
        };
      });
    },
    [],
  );

  const removeExtraColumn = useCallback(
    (month: number, side: ExtraColumnSide, index: number) => {
      setSettings((current) => {
        const existing = current.extraColumns[month];
        if (!existing) return current;
        const list = [...(side === 'left' ? existing.left : existing.right)];
        if (index !== 0 || list.length === 0) return current;
        // Nur die Spalte an der Trennlinie lässt sich entfernen: ist sie
        // breiter als eine Einheit, verliert sie eine Einheit; andernfalls
        // entfällt sie ganz und die übrigen Spalten rücken nach.
        if (list[0] > 1) {
          list[0] -= 1;
        } else {
          list.shift();
        }
        // Ist die Liste danach leer, wird der Monatseintrag entfernt.
        const nextMonth = side === 'left' ? { left: list, right: existing.right } : { left: existing.left, right: list };
        const extraColumns = { ...current.extraColumns };
        if (nextMonth.left.length === 0 && nextMonth.right.length === 0) {
          delete extraColumns[month];
        } else {
          extraColumns[month] = nextMonth;
        }
        return { ...current, extraColumns };
      });
    },
    [],
  );

  const replaceSettings = useCallback((next: Partial<AppSettings>) => {
    setSettings((current) => ({
      selectedYear:
        next.selectedYear !== undefined ? clampYear(next.selectedYear) : current.selectedYear,
      selectedShift: next.selectedShift ?? current.selectedShift,
      weekdayOverDate: next.weekdayOverDate ?? current.weekdayOverDate,
      showShiftCalendar: next.showShiftCalendar ?? current.showShiftCalendar,
      showBirthdays: next.showBirthdays ?? current.showBirthdays,
      showRecurringEvents: next.showRecurringEvents ?? current.showRecurringEvents,
      viewMode: next.viewMode ?? current.viewMode,
      extraColumns: next.extraColumns ?? current.extraColumns,
    }));
  }, []);

  const goToPreviousYear = useCallback(() => {
    setSettings((current) => ({
      ...current,
      selectedYear: previousSelectableYear(current.selectedYear),
    }));
  }, []);

  const goToNextYear = useCallback(() => {
    setSettings((current) => ({
      ...current,
      selectedYear: nextSelectableYear(current.selectedYear),
    }));
  }, []);

  return {
    settings,
    setYear,
    setShift,
    setWeekdayOverDate,
    setShowShiftCalendar,
    setShowBirthdays,
    setShowRecurringEvents,
    setViewMode,
    addExtraColumn,
    widenExtraColumn,
    removeExtraColumn,
    setSettings: replaceSettings,
    goToPreviousYear,
    goToNextYear,
    canGoToPreviousYear: settings.selectedYear > MIN_YEAR,
    canGoToNextYear: settings.selectedYear < MAX_YEAR,
  };
}
