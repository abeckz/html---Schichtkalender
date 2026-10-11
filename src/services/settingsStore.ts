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
import type { AppSettings, ShiftId } from '../domain/types.ts';
import { readState } from '../services/storage.ts';
import { MAX_YEAR, MIN_YEAR, isValidYear } from '../utils/dateUtils.ts';
import { SELECTABLE_YEARS } from '../config/appDefaults.ts';

export interface SettingsStore {
  settings: AppSettings;
  setYear: (year: number) => void;
  setShift: (shiftId: ShiftId) => void;
  /** Schaltet die Anzeige-Option "Wochentag über Datum" um. */
  setWeekdayOverDate: (enabled: boolean) => void;
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

  const replaceSettings = useCallback((next: Partial<AppSettings>) => {
    setSettings((current) => ({
      selectedYear:
        next.selectedYear !== undefined ? clampYear(next.selectedYear) : current.selectedYear,
      selectedShift: next.selectedShift ?? current.selectedShift,
      weekdayOverDate: next.weekdayOverDate ?? current.weekdayOverDate,
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
    setSettings: replaceSettings,
    goToPreviousYear,
    goToNextYear,
    canGoToPreviousYear: settings.selectedYear > MIN_YEAR,
    canGoToNextYear: settings.selectedYear < MAX_YEAR,
  };
}
