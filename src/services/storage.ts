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
  AnniversaryEntry,
  AnniversaryIntervalKind,
  AnniversaryKind,
  AnniversaryMap,
  AppSettings,
  CalendarViewMode,
  ColorLegendMap,
  ColumnColorName,
  ExtraColumnColorKey,
  ExtraColumns,
  PersistedState,
  ShiftId,
  UserDayAnnotation,
} from '../domain/types.ts';
import { SHIFT_IDS } from '../config/shiftDefinitions.ts';
import { isAnnotationColorId, isColumnColorName } from '../config/annotationColors.ts';
import { DEFAULT_SETTINGS } from '../config/appDefaults.ts';
import { isValidDateKey, isMonthDayKey, isPlausibleBirthYear } from '../utils/dateUtils.ts';

export const STORAGE_KEY = 'schichtkalender.state';
export const STORAGE_VERSION = 1;
export const MAX_LABEL_LENGTH = 50;

/** Kleinste Breite einer Zusatzspalte, in Einheiten à 1,6 em (~2 Zeichen). */
export const MIN_EXTRA_COLUMN_WIDTH = 1;
/** Größte Breite einer Zusatzspalte, in Einheiten à 1,6 em. */
export const MAX_EXTRA_COLUMN_WIDTH = 24;
/** Höchstzahl frei anlegbarer Zusatzspalten je Monat und Seite. */
export const MAX_EXTRA_COLUMNS = 12;

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

  // Farben der frei angelegten Zusatzspalten (`extra0`, `extra1`, …).
  const extraColors: Partial<Record<ExtraColumnColorKey, AnnotationColorId>> = {};
  const rawExtra = candidate.extraColors;
  if (rawExtra && typeof rawExtra === 'object') {
    for (const [key, colorId] of Object.entries(rawExtra as Record<string, unknown>)) {
      if (isExtraColumnColorKey(key) && isAnnotationColorId(colorId)) {
        extraColors[key] = colorId;
      }
    }
  }

  // Vollständig leere Annotationen werden nicht gespeichert.
  if (
    label === '' &&
    Object.keys(colors).length === 0 &&
    Object.keys(extraColors).length === 0
  ) {
    return null;
  }
  const annotation: UserDayAnnotation = { dateKey: candidate.dateKey, label, colors };
  if (Object.keys(extraColors).length > 0) annotation.extraColors = extraColors;
  return annotation;
}

/** Erzeugt den Farbschlüssel einer Zusatzspalte (`name` -> "extraN"). */
export function extraColumnColorKey(name: string | number): ExtraColumnColorKey {
  const index = typeof name === 'number' ? name : Number(name);
  return `extra${Number.isFinite(index) && index >= 0 ? Math.trunc(index) : 0}`;
}

/** Prüft den Farbschlüssel einer Zusatzspalte ("extra0", "extra1", …). */
export function isExtraColumnColorKey(value: unknown): value is ExtraColumnColorKey {
  return typeof value === 'string' && /^extra[0-9]+$/.test(value);
}

/** Begrenzt eine Spaltenbreite auf den zulässigen Bereich. */
export function normalizeExtraColumnWidth(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value)) return null;
  if (value < MIN_EXTRA_COLUMN_WIDTH || value > MAX_EXTRA_COLUMN_WIDTH) return null;
  return value;
}

/** Bereinigt die Anordnung der Zusatzspalten eines Monats. */
export function normalizeExtraColumns(value: unknown): ExtraColumns | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<ExtraColumns>;
  const left = normalizeExtraColumnList(candidate.left);
  const right = normalizeExtraColumnList(candidate.right);
  if (left.length === 0 && right.length === 0) return null;
  return { left, right };
}

/** Bereinigt eine einzelne Spaltenliste (höchstens MAX_EXTRA_COLUMNS Einträge). */
function normalizeExtraColumnList(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const widths: number[] = [];
  for (const entry of value) {
    const width = normalizeExtraColumnWidth(entry);
    if (width !== null) widths.push(width);
    if (widths.length >= MAX_EXTRA_COLUMNS) break;
  }
  return widths;
}

/** Bereinigt die Zusatzspalten aller Monate (Schlüssel 1..12). */
export function normalizeExtraColumnsByMonth(value: unknown): Record<number, ExtraColumns> {
  const result: Record<number, ExtraColumns> = {};
  if (!value || typeof value !== 'object') return result;
  for (const [monthKey, rawColumns] of Object.entries(value as Record<string, unknown>)) {
    const month = Number(monthKey);
    if (!Number.isInteger(month) || month < 1 || month > 12) continue;
    const columns = normalizeExtraColumns(rawColumns);
    if (columns) result[month] = columns;
  }
  return result;
}

/** Länge einer Spaltenliste in Einheiten (leere Spalten zählen als 1). */
export function extraColumnCount(columns: readonly number[] | undefined): number {
  if (!columns) return 0;
  return columns.reduce((total, width) => total + Math.max(1, width), 0);
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
    // Rückwärtskompatibilität: Ältere Zustände kennen die Anzeige-Option
    // nicht; sie wird dann auf den Standard (aus) gesetzt.
    weekdayOverDate:
      typeof candidate.weekdayOverDate === 'boolean'
        ? candidate.weekdayOverDate
        : DEFAULT_SETTINGS.weekdayOverDate,
    // Rückwärtskompatibilität: Fehlen die Anzeige-Checkboxen, gelten die
    // Standards (alle drei eingeschaltet).
    showShiftCalendar:
      typeof candidate.showShiftCalendar === 'boolean'
        ? candidate.showShiftCalendar
        : DEFAULT_SETTINGS.showShiftCalendar,
    showBirthdays:
      typeof candidate.showBirthdays === 'boolean'
        ? candidate.showBirthdays
        : DEFAULT_SETTINGS.showBirthdays,
    showRecurringEvents:
      typeof candidate.showRecurringEvents === 'boolean'
        ? candidate.showRecurringEvents
        : DEFAULT_SETTINGS.showRecurringEvents,
    viewMode: isCalendarViewMode(candidate.viewMode)
      ? candidate.viewMode
      : DEFAULT_SETTINGS.viewMode,
    // Rückwärtskompatibilität: ältere Zustände kennen die frei angelegten
    // Zusatzspalten nicht; sie starten dann ohne Zusatzspalten.
    extraColumns: normalizeExtraColumnsByMonth(candidate.extraColumns),
  };
}

/** Prüft einen Modus der Bildschirmansicht. */
export function isCalendarViewMode(value: unknown): value is CalendarViewMode {
  return value === 'shift' || value === 'anniversaries';
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

/** Maximale Länge eines Ereignis-/Personennamens. */
export const MAX_ANNIVERSARY_NAME_LENGTH = 50;

/** Erlaubte Zähler eines Wiederholungsrhythmus. */
export const MIN_ANNIVERSARY_INTERVAL = 1;
export const MAX_ANNIVERSARY_INTERVAL = 99;
/** Obergrenze für „alle X Tage" (Tagesrhythmus darf größer sein). */
export const MAX_DAILY_INTERVAL_COUNT = 365;
/** Rückwärtskompatibilität: früher war 99 das größte Intervall in Jahren. */
const LEGACY_MAX_YEAR_INTERVAL = MAX_ANNIVERSARY_INTERVAL;

/** Prüft die Art eines Jahrestages. */
export function isAnniversaryKind(value: unknown): value is AnniversaryKind {
  return value === 'birthday' || value === 'recurring';
}

/** Prüft die Rhythmus-Art eines wiederkehrenden Ereignisses. */
export function isAnniversaryIntervalKind(value: unknown): value is AnniversaryIntervalKind {
  return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}

/** Obergrenze des Zählers je Rhythmus-Art. */
export function maxIntervalCountFor(kind: AnniversaryIntervalKind): number {
  return kind === 'daily' ? MAX_DAILY_INTERVAL_COUNT : MAX_ANNIVERSARY_INTERVAL;
}

/** Begrenzt einen Rhythmus-Zähler auf den zur Art passenden Bereich. */
export function normalizeAnniversaryIntervalCount(
  value: unknown,
  kind: AnniversaryIntervalKind = 'yearly',
): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) return MIN_ANNIVERSARY_INTERVAL;
  return Math.min(maxIntervalCountFor(kind), Math.max(MIN_ANNIVERSARY_INTERVAL, value));
}

/**
 * Laufender Zähler für neue Jahrestag-Kennungen.
 *
 * Die Kennungen müssen innerhalb eines Tages eindeutig sein, damit mehrere
 * Einträge desselben Tages (mehrere Geburtstage bzw. Ereignisse) sicher
 * unterschieden werden können. Ein Zeitanteil plus Zähler genügt; die genaue
 * Form ist nicht fachlich relevant.
 */
let anniversaryIdCounter = 0;

/** Erzeugt eine neue, eindeutige Kennung für einen Jahrestag. */
export function createAnniversaryId(): string {
  anniversaryIdCounter += 1;
  return `a${Date.now().toString(36)}${anniversaryIdCounter.toString(36)}`;
}

/**
 * Bereinigt einen Jahrestag.
 *
 * Erwartet einen Monat-Tag-Schlüssel "MM-DD" und liefert null bei ungültigem
 * oder leerem Eintrag. Das Geburtsjahr wird nur für Geburtstage übernommen;
 * Rhythmus-Art und -Zähler nur für wiederkehrende Ereignisse. Ältere Einträge
 * mit dem früheren Feld `interval` (Jahre) werden auf 'yearly' abgebildet.
 *
 * `fallbackId` liefert die Kennung, wenn der Eintrag keine gültige `id` trägt
 * (z. B. bei älteren Zuständen). So bleiben mehrere Einträge eines Tages
 * unterscheidbar.
 */
export function normalizeAnniversary(
  value: unknown,
  fallbackId?: string,
): AnniversaryEntry | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<AnniversaryEntry>;
  if (!isMonthDayKey(candidate.monthDay)) return null;
  if (!isAnniversaryKind(candidate.kind)) return null;
  const name = normalizeAnniversaryName(candidate.name ?? '');
  const id =
    typeof candidate.id === 'string' && candidate.id !== ''
      ? candidate.id
      : fallbackId ?? candidate.monthDay;
  if (name === '') return null;

  const entry: AnniversaryEntry = {
    id,
    monthDay: candidate.monthDay,
    name,
    kind: candidate.kind,
  };
  if (candidate.kind === 'birthday' && isPlausibleBirthYear(candidate.birthYear)) {
    entry.birthYear = candidate.birthYear;
  }
  if (candidate.kind === 'recurring') {
    // Ohne Rhythmus-Art gilt der frühere Zustand: Intervall in Jahren.
    const kind = isAnniversaryIntervalKind(candidate.intervalKind)
      ? candidate.intervalKind
      : 'yearly';
    entry.intervalKind = kind;
    if (isAnniversaryIntervalKind(candidate.intervalKind)) {
      entry.intervalCount = normalizeAnniversaryIntervalCount(candidate.intervalCount, kind);
    } else {
      // Altbestand: `interval` war auf 99 Jahre begrenzt.
      const legacyYears =
        typeof candidate.interval === 'number' && Number.isInteger(candidate.interval)
          ? Math.min(LEGACY_MAX_YEAR_INTERVAL, Math.max(MIN_ANNIVERSARY_INTERVAL, candidate.interval))
          : MIN_ANNIVERSARY_INTERVAL;
      entry.intervalCount = legacyYears;
    }
  }
  return entry;
}

/** Freitext eines Ereignis-/Personennamens begrenzen und trimmen. */
export function normalizeAnniversaryName(name: unknown): string {
  return typeof name === 'string' ? name.slice(0, MAX_ANNIVERSARY_NAME_LENGTH) : '';
}

/**
 * Bereinigt die Map der Jahrestage.
 *
 * Erwartet die neue Struktur `MM-DD -> AnniversaryEntry[]`. Für
 * Rückwärtskompatibilität werden zusätzlich zwei ältere Formen übernommen:
 * - eine flache Liste von Einträgen,
 * - eine nach `"MM-DD:kind"` indizierte Map (Wert = einzelner Eintrag).
 * Mehrere Einträge desselben Tages bleiben in fester Reihenfolge (Geburtstage
 * zuerst, dann wiederkehrende Ereignisse) erhalten. Ungültige Einträge werden
 * verworfen; es wird nie geworfen.
 */
export function normalizeAnniversaries(value: unknown): AnniversaryMap {
  const result: AnniversaryMap = {};
  if (!value || typeof value !== 'object') return result;

  const push = (entry: AnniversaryEntry | null): void => {
    if (!entry) return;
    const list = result[entry.monthDay] ?? (result[entry.monthDay] = []);
    list.push(entry);
  };

  if (Array.isArray(value)) {
    // Flache Liste von Einträgen.
    for (const raw of value) push(normalizeAnniversary(raw));
    return sortAnniversaryMap(result);
  }

  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(raw)) {
      // Neue Struktur: Liste von Einträgen eines Tages.
      for (const item of raw) push(normalizeAnniversary(item));
      continue;
    }
    // Einzelner Eintrag: entweder neuer Schlüssel "MM-DD" oder alter
    // zusammengesetzter Schlüssel "MM-DD:kind". Der Tag wird aus dem Eintrag
    // (oder ersatzweise aus dem Schlüssel) abgeleitet.
    const legacyKind = key.includes(':') ? key.split(':')[1] : undefined;
    const fallbackId = `${key}`;
    const entry = normalizeAnniversary(
      legacyKind && (raw as { kind?: unknown })?.kind === undefined
        ? { ...(raw as object), kind: legacyKind }
        : raw,
      fallbackId,
    );
    push(entry);
  }
  return sortAnniversaryMap(result);
}

/** Sortiert die Einträge jedes Tages: Geburtstage zuerst, dann Ereignisse. */
function sortAnniversaryMap(map: AnniversaryMap): AnniversaryMap {
  for (const list of Object.values(map)) {
    list.sort((a, b) => {
      if (a.kind === b.kind) return 0;
      return a.kind === 'birthday' ? -1 : 1;
    });
  }
  return map;
}

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
    anniversaries: {},
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
      anniversaries: normalizeAnniversaries(parsed.anniversaries),
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
      anniversaries: normalizeAnniversaries(state.anniversaries),
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
  anniversaries: AnniversaryMap = {},
): boolean {
  return writeState(
    { version: STORAGE_VERSION, settings, annotations, colorLegend, anniversaries },
    storage,
  );
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
