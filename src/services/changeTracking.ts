/**
 * Erkennung ungespeicherter Änderungen.
 *
 * Die Anwendung hält ihren Zustand (Einstellungen + persönliche
 * Tagesmarkierungen) zusätzlich im Browser-Speicher (localStorage), damit ein
 * versehentliches Neuladen nichts verliert. Eine dauerhafte Datei-Sicherung
 * erfolgt jedoch nur auf ausdrücklichen Wunsch über den Speichern-Dialog.
 *
 * Damit das Schließen des Fensters gewarnt werden kann, wird der jeweils
 * zuletzt gesicherte Zustand über eine stabile Signatur mit dem aktuellen
 * Zustand verglichen. Die Signatur ist eine reine, deterministische Funktion
 * der Nutzdaten (Jahr, Schicht und alle Annotationen) und unabhängig von
 * Schlüsselreihenfolgen und Formatierung.
 *
 * Alle Funktionen sind rein und werfen nie.
 */

import type { PersistedState } from '../domain/types';
import { DEFAULT_SETTINGS } from '../config/appDefaults';
import { normalizeAnnotations, normalizeSettings, STORAGE_VERSION } from './storage';

/**
 * Berechnet eine stabile Signatur des Zustands.
 *
 * Es werden nur die Nutzdaten berücksichtigt (Jahr, Schicht und die
 * bereinigten Annotationen). Schlüsselreihenfolgen werden sortiert, sodass
 * zwei inhaltlich gleiche Zustände immer dieselbe Signatur ergeben.
 */
export function stateSignature(state: PersistedState): string {
  const settings = normalizeSettings(state.settings);
  const annotations = normalizeAnnotations(state.annotations);
  const normalized: unknown = {
    version: STORAGE_VERSION,
    settings: {
      selectedYear: settings.selectedYear,
      selectedShift: settings.selectedShift,
    },
    annotations: Object.keys(annotations)
      .sort()
      .map((dateKey) => {
        const annotation = annotations[dateKey];
        const colors = annotation.colors ?? {};
        return {
          dateKey,
          label: annotation.label,
          colors: Object.keys(colors)
            .sort()
            .map((column) => [column, colors[column as keyof typeof colors]]),
        };
      }),
  };
  return JSON.stringify(normalized);
}

/**
 * Prüft, ob der aktuelle Zustand vom zuletzt gesicherten abweicht.
 *
 * @param savedSignature Signatur des zuletzt gesicherten Zustands (null,
 *                       solange noch nie gesichert wurde).
 * @param current        aktueller Zustand.
 */
export function hasUnsavedChanges(
  savedSignature: string | null,
  current: PersistedState,
): boolean {
  if (savedSignature === null) {
    // Ohne vorangegangene Sicherung gibt es nur dann etwas zu verlieren, wenn
    // tatsächlich benutzerdefinierte Daten vorhanden sind.
    return !isStateEmpty(current);
  }
  return stateSignature(current) !== savedSignature;
}

/**
 * true, wenn der Zustand keinerlei persönliche Daten enthält und damit dem
 * Auslieferungszustand entspricht (keine Markierungen, Standardeinstellungen).
 */
export function isStateEmpty(state: PersistedState): boolean {
  const annotations = normalizeAnnotations(state.annotations);
  if (Object.keys(annotations).length > 0) return false;
  const settings = normalizeSettings(state.settings);
  return (
    settings.selectedYear === DEFAULT_SETTINGS.selectedYear &&
    settings.selectedShift === DEFAULT_SETTINGS.selectedShift
  );
}
