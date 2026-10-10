/**
 * Persistenzschicht für Einstellungen und persönliche Tagesmarkierungen.
 *
 * Alle Zugriffe auf localStorage sind gekapselt und defensiv: bei fehlendem
 * Speicher, defekten Daten oder unbekannten Farbwerten wird auf gültige
 * Standardwerte zurückgefallen. Es wird nie geworfen.
 */

import type {
  AnnotationColorId,
  AnnotationMap,
  AppSettings,
  ColorLegendMap,
  ColumnColorName,
  PersistedState,
  ShiftId,
  UserDayAnnotation,
} from '../domain/types';
import { SHIFT_IDS } from '../config/shiftDefinitions';
import { isAnnotationColorId, isColumnColorName } from '../config/annotationColors';
import { DEFAULT_SETTINGS } from '../config/appDefaults';
import { isValidDateKey } from '../utils/dateUtils';

export const STORAGE_KEY = 'schichtkalender.state';
export const STORAGE_VERSION = 1;
export const MAX_LABEL_LENGTH = 50;

/** Minimale, gekapselte Storage-Schnittstelle (erleichtert Tests). */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** Liefert localStorage oder null (z. B. SSR, Privatmodus, deaktiviert). */
export function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Freitext auf 50 Zeichen begrenzen und trimmen. */
export function normalizeLabel(label: string): string {
  return typeof label === 'string' ? label.slice(0, MAX_LABEL_LENGTH) : '';
}

/** Prüft eine Schichtkennung. */
export function isShiftId(value: unknown): value is ShiftId {
  return typeof value === 'string' && (SHIFT_IDS as readonly string[]).includes(value);
}

/** Prüft ein gültiges Kalenderjahr. */
function isPlausibleYear(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 2200;
}

/** Bereinigt ein einzelnes Annotationsobjekt oder liefert null. */
export function normalizeAnnotation(value: unknown): UserDayAnnotation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<UserDayAnnotation> & { colorId?: unknown };
  if (typeof candidate.dateKey !== 'string' || !isValidDateKey(candidate.dateKey)) return null;
  const label = normalizeLabel(candidate.label ?? '');

  const colors: Partial<Record<ColumnColorName, AnnotationColorId>> = {};
  const rawColors = candidate.colors;
  if (rawColors && typeof rawColors === 'object') {
    for (const [column, colorId] of Object.entries(rawColors as Record<string, unknown>)) {
      if (isColumnColorName(column) && isAnnotationColorId(colorId)) {
        colors[column] = colorId;
      }
    }
  }
  // Rückwärtskompatibilität: die frühere Tagesfarbe (`colorId`) entsprach der
  // Farbe der Informationsspalte und wird dorthin übernommen.
  if (candidate.colorId !== undefined && colors.info === undefined && isAnnotationColorId(candidate.colorId)) {
    colors.info = candidate.colorId;
  }

  // Vollständig leere Annotationen werden nicht gespeichert.
  if (label === '' && Object.keys(colors).length === 0) return null;
  return { dateKey: candidate.dateKey, label, colors };
}

/** Bereinigt Einstellungen. */
export function normalizeSettings(value: unknown): AppSettings {
  if (!value || typeof value !== 'object') return { ...DEFAULT_SETTINGS };
  const candidate = value as Partial<AppSettings>;
  return {
    selectedYear: isPlausibleYear(candidate.selectedYear)
      ? candidate.selectedYear
      : DEFAULT_SETTINGS.selectedYear,
    selectedShift: isShiftId(candidate.selectedShift)
      ? candidate.selectedShift
      : DEFAULT_SETTINGS.selectedShift,
  };
}

/** Bereinigt eine komplette Annotationsliste. */
export function normalizeAnnotations(value: unknown): AnnotationMap {
  const result: AnnotationMap = {};
  if (!value || typeof value !== 'object') return result;
  for (const entry of Object.values(value as Record<string, unknown>)) {
    const annotation = normalizeAnnotation(entry);
    if (annotation) {
      result[annotation.dateKey] = annotation;
    }
  }
  return result;
}

/** Maximale Länge eines Erklärtextes der Farblegende. */
export const MAX_LEGEND_TEXT_LENGTH = 50;

/** Freitext eines Legendeneintrags auf die Maximallänge begrenzen. */
export function normalizeLegendText(text: unknown): string {
  return typeof text === 'string' ? text.slice(0, MAX_LEGEND_TEXT_LENGTH) : '';
}

/**
 * Bereinigt die Erklärtexte der Farblegende.
 *
 * Erwartet die Struktur Jahr -> colorId -> Text. Ungültige Jahre, unbekannte
 * Farben und leere Texte werden verworfen; es wird nie geworfen.
 */
export function normalizeColorLegend(value: unknown): ColorLegendMap {
  const result: ColorLegendMap = {};
  if (!value || typeof value !== 'object') return result;
  for (const [yearKey, colors] of Object.entries(value as Record<string, unknown>)) {
    const year = Number(yearKey);
    if (!isPlausibleYear(year) || !colors || typeof colors !== 'object') continue;
    const entry: Partial<Record<AnnotationColorId, string>> = {};
    for (const [colorKey, text] of Object.entries(colors as Record<string, unknown>)) {
      if (!isAnnotationColorId(colorKey)) continue;
      const normalized = normalizeLegendText(text);
      if (normalized !== '') entry[colorKey] = normalized;
    }
    if (Object.keys(entry).length > 0) result[year] = entry;
  }
  return result;
}

/** Liest und validiert den persistierten Zustand. */
export function readState(
  storage: StorageLike | null = getDefaultStorage(),
): PersistedState {
  const fallback: PersistedState = {
    version: STORAGE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    annotations: {},
    colorLegend: {},
  };
  if (!storage) return fallback;

  let raw: string | null = null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return fallback;
  }
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return {
      version: STORAGE_VERSION,
      settings: normalizeSettings(parsed.settings),
      annotations: normalizeAnnotations(parsed.annotations),
      colorLegend: normalizeColorLegend(parsed.colorLegend),
    };
  } catch {
    return fallback;
  }
}

/** Schreibt den Zustand; Fehler werden geschluckt (Speicher kann fehlen). */
export function writeState(
  state: PersistedState,
  storage: StorageLike | null = getDefaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    const payload: PersistedState = {
      version: STORAGE_VERSION,
      settings: normalizeSettings(state.settings),
      annotations: normalizeAnnotations(state.annotations),
      colorLegend: normalizeColorLegend(state.colorLegend),
    };
    storage.setItem(STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** Entfernt den persistierten Zustand vollständig. */
export function clearState(storage: StorageLike | null = getDefaultStorage()): void {
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // absichtlich ignorieren
  }
}

/** Einstellungen einzeln speichern (praktisch für die UI). */
export function saveSettings(
  settings: AppSettings,
  annotations: AnnotationMap,
  storage: StorageLike | null = getDefaultStorage(),
  colorLegend: ColorLegendMap = {},
): boolean {
  return writeState({ version: STORAGE_VERSION, settings, annotations, colorLegend }, storage);
}

/** Farbe der Informationsspalte einer Annotation (null, wenn keine gesetzt ist). */
export function getAnnotationColorId(
  annotations: AnnotationMap,
  dateKey: string,
): AnnotationColorId | null {
  return annotations[dateKey]?.colors.info ?? null;
}

/** Farbe einer beliebigen Spalte einer Annotation (null, wenn keine gesetzt ist). */
export function getColumnColorId(
  annotations: AnnotationMap,
  dateKey: string,
  column: ColumnColorName,
): AnnotationColorId | null {
  return annotations[dateKey]?.colors[column] ?? null;
}
