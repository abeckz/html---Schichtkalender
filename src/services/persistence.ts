/**
 * Dateibasierte Persistenz des Schichtkalenders.
 *
 * Der Browser-Speicher (localStorage) hält den Zustand nur lokal und
 * verliert ihn, sobald der Cache geleert oder ein anderer Rechner/ Browser
 * verwendet wird. Diese Schicht ergänzt eine dauerhafte Speicher- und
 * Lade-Möglichkeit über eine herunterladbare JSON-Datei.
 *
 * Die Funktionen sind reine Bausteine ohne UI: Serialisierung, Validierung
 * und der eigentliche Download. Der DOM-Zugriff ist defensiv gekapselt; es
 * wird nie geworfen. Fachlogik (Kalenderberechnung) wird nicht verändert,
 * gespeichert wird ausschließlich der bestehende `PersistedState`.
 */

import type { PersistedState } from '../domain/types';
import {
  STORAGE_VERSION,
  normalizeAnnotations,
  normalizeColorLegend,
  normalizeSettings,
} from './storage';
import {
  canUseOpenPicker,
  canUseSavePicker,
  loadTextWithPicker,
  saveTextWithPicker,
  type LoadWithPickerResult,
  type SaveWithPickerResult,
} from './fileSystemAccess';

/** Dateiendung der Sicherungsdatei. */
export const EXPORT_FILE_EXTENSION = 'json';

/**
 * Erzeugt einen sprechenden Dateinamen für die Sicherung.
 * Beispiel: "schichtkalender-2026.json".
 */
export function buildExportFileName(year: number): string {
  const safeYear = Number.isInteger(year) ? year : '';
  return `schichtkalender-${safeYear}.${EXPORT_FILE_EXTENSION}`;
}

/**
 * Serialisiert den Zustand als lesbares JSON.
 *
 * Gespeichert werden nur die bekannten Felder (version, settings,
 * annotations); der Zustand wird dabei über die bestehenden Normalisierer
 * bereinigt, damit die Datei immer gültig ist.
 */
export function serializeState(state: PersistedState): string {
  const payload: PersistedState = {
    version: STORAGE_VERSION,
    settings: normalizeSettings(state.settings),
    annotations: normalizeAnnotations(state.annotations),
    colorLegend: normalizeColorLegend(state.colorLegend),
  };
  return JSON.stringify(payload, null, 2);
}

/**
 * Parst und validiert eine zuvor gespeicherte Datei.
 *
 * Liefert den bereinigten Zustand oder null bei ungültigem Inhalt. Es wird
 * nie geworfen; fehlende Felder werden auf gültige Standardwerte gesetzt.
 */
export function parseState(text: string): PersistedState | null {
  if (typeof text !== 'string' || text.trim() === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const candidate = parsed as Partial<PersistedState>;
  return {
    version: STORAGE_VERSION,
    settings: normalizeSettings(candidate.settings),
    annotations: normalizeAnnotations(candidate.annotations),
    colorLegend: normalizeColorLegend(candidate.colorLegend),
  };
}

/** Löst einen Blob zu einem Dateidownload auf (defensiv, nie werfend). */
export function triggerDownload(
  text: string,
  fileName: string,
  doc: Document | null = typeof document === 'undefined' ? null : document,
): boolean {
  if (!doc || typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }
  let url: string | null = null;
  try {
    const blob = new Blob([text], { type: 'application/json' });
    url = URL.createObjectURL(blob);
    const link = doc.createElement('a');
    link.href = url;
    link.download = fileName;
    link.rel = 'noopener';
    link.style.display = 'none';
    doc.body.appendChild(link);
    link.click();
    doc.body.removeChild(link);
    return true;
  } catch {
    return false;
  } finally {
    if (url) {
      // Erst nach dem Klick freigeben; die Garbage-Collection kümmert sich um
      // den Rest, falls der Browser die URL noch benötigt.
      try {
        URL.revokeObjectURL(url);
      } catch {
        // absichtlich ignorieren
      }
    }
  }
}

/** Bietet den Zustand als herunterladbare Datei an. */
export function downloadState(
  state: PersistedState,
  doc: Document | null = typeof document === 'undefined' ? null : document,
): boolean {
  return triggerDownload(
    serializeState(state),
    buildExportFileName(state.settings.selectedYear),
    doc,
  );
}

/**
 * Ergebnis eines Speicherversuchs im Sinne der Oberfläche.
 *
 * - 'saved'        : erfolgreich gespeichert (Dialog oder Download).
 * - 'cancelled'    : vom Benutzer im Systemdialog abgebrochen.
 * - 'unavailable'  : kein Speicherweg möglich (selten; z. B. kein DOM).
 */
export type SaveOutcome = 'saved' | 'cancelled' | 'unavailable';

/**
 * Speichert den Zustand möglichst über den Betriebssystem-Dateidialog.
 *
 * Chrome und Edge bieten mit der File System Access API einen echten
 * Speichern-Dialog (Dateiname und Speicherort frei wählbar). Fehlt die API
 * (z. B. Firefox/Safari) oder schlägt der Dialog fehl, wird auf den
 * klassischen Download in den Download-Ordner zurückgegriffen. Bricht der
 * Benutzer den Systemdialog ab, erfolgt bewusst kein Download.
 */
export async function saveState(
  state: PersistedState,
  doc: Document | null = typeof document === 'undefined' ? null : document,
): Promise<SaveOutcome> {
  const text = serializeState(state);
  const fileName = buildExportFileName(state.settings.selectedYear);

  if (canUseSavePicker()) {
    const result: SaveWithPickerResult = await saveTextWithPicker(text, fileName);
    if (result === 'saved') return 'saved';
    if (result === 'cancelled') return 'cancelled';
    // 'unsupported' oder 'failed': auf den Download zurückfallen.
  }

  return triggerDownload(text, fileName, doc) ? 'saved' : 'unavailable';
}

/** Ergebnis eines Ladeversuchs im Sinne der Oberfläche. */
export type LoadOutcome =
  | { status: 'loaded'; state: PersistedState }
  | { status: 'cancelled' }
  | { status: 'unavailable' }
  | { status: 'invalid' };

/**
 * Lädt den Zustand möglichst über den Betriebssystem-Dateidialog.
 *
 * Fehlt die API, wird 'unavailable' gemeldet; die Oberfläche öffnet dann den
 * klassischen Datei-Eingabedialog (`<input type="file">`). Ein vom Benutzer
 * abgebrochener Dialog liefert 'cancelled', eine unlesbare/ungültige Datei
 * 'invalid'.
 */
export async function loadState(): Promise<LoadOutcome> {
  if (!canUseOpenPicker()) return { status: 'unavailable' };
  const result: LoadWithPickerResult = await loadTextWithPicker();
  if (result.status === 'loaded') {
    const parsed = parseState(result.text);
    return parsed ? { status: 'loaded', state: parsed } : { status: 'invalid' };
  }
  if (result.status === 'cancelled') return { status: 'cancelled' };
  return { status: 'unavailable' };
}