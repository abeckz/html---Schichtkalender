/**
 * Datums-Utilities.
 *
 * Grundsatz: Kalendertage werden niemals über lokale Date-Objekte
 * (Date.getFullYear()/Date.toISOString()) berechnet, weil diese von der
 * Browser-Zeitzone sowie von Sommer-/Winterzeit abhängen.
 *
 * Stattdessen werden alle Kalendertage über einen UTC-Anker und einen
 * stabilen ganzzahligen Tagesindex (siehe dayIndex.ts) verarbeitet.
 */

import { DAYS_PER_WEEK, dayIndex } from './dayIndex';

export const MONTH_NAMES = [
  'Januar',
  'Februar',
  'März',
  'April',
  'Mai',
  'Juni',
  'Juli',
  'August',
  'September',
  'Oktober',
  'November',
  'Dezember',
] as const;

export const MONTH_SHORT_NAMES = [
  'JAN',
  'FEB',
  'MÄR',
  'APR',
  'MAI',
  'JUN',
  'JUL',
  'AUG',
  'SEP',
  'OKT',
  'NOV',
  'DEZ',
] as const;

export const WEEKDAY_SHORT_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;

export const MIN_YEAR = 1900;
export const MAX_YEAR = 2200;

/** Grunddatentyp für Datumsvergleiche. */
export interface DateParts {
  year: number;
  /** 1 = Januar ... 12 = Dezember */
  month: number;
  /** 1..31 */
  day: number;
}

/** Prüft auf ein gültiges Kalenderjahr. */
export function isValidYear(year: number): boolean {
  return Number.isInteger(year) && year >= MIN_YEAR && year <= MAX_YEAR;
}

/** Wirft einen Fehler, wenn das Jahr außerhalb des Bereichs liegt. */
export function assertValidYear(year: number): void {
  if (!isValidYear(year)) {
    throw new RangeError(
      `Ungültiges Jahr: ${year}. Unterstützt werden ${MIN_YEAR} bis ${MAX_YEAR}.`,
    );
  }
}

/** Schaltjahr nach gregorianischer Regel. */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Anzahl der Tage eines Monats. month: 1..12 */
export function getDaysInMonth(year: number, month: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`Ungültiger Monat: ${month}`);
  }
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/** Anzahl der Tage eines Jahres (365 oder 366). */
export function getDaysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Validiert eine Kombination aus Jahr, Monat und Tag. */
export function isValidDate(year: number, month: number, day: number): boolean {
  if (!isValidYear(year)) return false;
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  if (!Number.isInteger(day) || day < 1) return false;
  return day <= getDaysInMonth(year, month);
}

/**
 * Erzeugt den Datumsschlüssel im Format YYYY-MM-DD.
 * Reine String-Arithmetik, damit keine Zeitzonenverschiebung entstehen kann.
 */
export function toDateKey(year: number, month: number, day: number): string {
  if (!isValidDate(year, month, day)) {
    throw new RangeError(`Ungültiges Datum: ${year}-${month}-${day}`);
  }
  const y = String(year).padStart(4, '0');
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Serialisiert Datumsteile zu einem dateKey. */
export function datePartsToKey(parts: DateParts): string {
  return toDateKey(parts.year, parts.month, parts.day);
}

/** Prüft, ob ein String ein syntaktisch und fachlich gültiger dateKey ist. */
export function isValidDateKey(dateKey: string): boolean {
  return parseDateKey(dateKey) !== null;
}

/**
 * Parst einen dateKey (YYYY-MM-DD). Liefert null bei ungültigen Werten
 * (falsches Format, unmögliches Datum).
 */
export function parseDateKey(dateKey: string): DateParts | null {
  if (typeof dateKey !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!isValidDate(year, month, day)) return null;
  return { year, month, day };
}

/** Rechnet Datumsteile in einen stabilen, ganzen Tagesindex um. */
export function toDayIndex(parts: DateParts): number {
  return dayIndex(parts.year, parts.month, parts.day);
}

/** Rechnet einen Tagesindex in Datumsteile zurück. */
export function fromDayIndex(index: number): DateParts {
  const date = new Date(index * 86400000);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

/** Datumsschlüssel aus einem Tagesindex. */
export function dayIndexToDateKey(index: number): string {
  const parts = fromDayIndex(index);
  return toDateKey(parts.year, parts.month, parts.day);
}

/** Addiert eine Anzahl Kalendertage auf einen dateKey. */
export function addDaysToKey(dateKey: string, days: number): string {
  const parts = parseDateKey(dateKey);
  if (!parts) {
    throw new RangeError(`Ungültiger dateKey: ${dateKey}`);
  }
  return dayIndexToDateKey(dayIndex(parts.year, parts.month, parts.day) + days);
}

/** Differenz in Kalendertagen (to - from). */
export function diffInDays(fromKey: string, toKey: string): number {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  if (!from || !to) {
    throw new RangeError(`Ungültige dateKeys: ${fromKey}, ${toKey}`);
  }
  return dayIndex(to.year, to.month, to.day) - dayIndex(from.year, from.month, from.day);
}

/** ISO-Wochentag aus einem Tagesindex: 1 = Montag ... 7 = Sonntag. */
export function isoWeekdayOf(index: number): number {
  // Der 01.01.1970 (Index 0) war ein Donnerstag (ISO-Wochentag 4).
  return (((index + 3) % DAYS_PER_WEEK) + DAYS_PER_WEEK) % DAYS_PER_WEEK + 1;
}

/** ISO-Wochentag eines Kalendertages. */
export function getIsoWeekday(year: number, month: number, day: number): number {
  return isoWeekdayOf(dayIndex(year, month, day));
}

/** Deutscher Kurzname des Wochentags ("Mo".."So"). */
export function getWeekdayShort(isoWeekday: number): string {
  return WEEKDAY_SHORT_NAMES[isoWeekday - 1];
}

/** ISO-8601-Kalenderwoche eines Kalendertages (1..53). */
export function getIsoWeek(year: number, month: number, day: number): number {
  const index = dayIndex(year, month, day);
  const thursdayIndex = index + (4 - isoWeekdayOf(index));
  const { year: isoYear } = fromDayIndex(thursdayIndex);
  const jan4Index = dayIndex(isoYear, 1, 4);
  const firstThursdayIndex = jan4Index + (4 - isoWeekdayOf(jan4Index));
  return (thursdayIndex - firstThursdayIndex) / DAYS_PER_WEEK + 1;
}

/** ISO-Jahr (kann an Jahresgrenzen vom Kalenderjahr abweichen). */
export function getIsoYear(year: number, month: number, day: number): number {
  const index = dayIndex(year, month, day);
  const thursdayIndex = index + (4 - isoWeekdayOf(index));
  return fromDayIndex(thursdayIndex).year;
}

/** Montag der ISO-Woche, in der der Tag liegt. */
export function startOfIsoWeek(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  if (!parts) throw new RangeError(`Ungültiger dateKey: ${dateKey}`);
  const index = dayIndex(parts.year, parts.month, parts.day);
  return dayIndexToDateKey(index - (isoWeekdayOf(index) - 1));
}

/** Anzahl der Tage bis zum nächsten Ziel-Wochentag (0 = heute). */
function offsetToWeekday(currentIsoWeekday: number, targetIsoWeekday: number): number {
  if (!Number.isInteger(targetIsoWeekday) || targetIsoWeekday < 1 || targetIsoWeekday > 7) {
    throw new RangeError(`Ungültiger Wochentag: ${targetIsoWeekday}`);
  }
  return (targetIsoWeekday - currentIsoWeekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
}

/**
 * Erster Wochentag eines Monats.
 * @param isoWeekday 1 = Montag ... 7 = Sonntag
 */
export function firstWeekdayOfMonth(year: number, month: number, isoWeekday: number): string {
  const firstIndex = dayIndex(year, month, 1);
  return dayIndexToDateKey(firstIndex + offsetToWeekday(isoWeekdayOf(firstIndex), isoWeekday));
}

/**
 * Letzter Wochentag eines Monats.
 * @param isoWeekday 1 = Montag ... 7 = Sonntag
 */
export function lastWeekdayOfMonth(year: number, month: number, isoWeekday: number): string {
  const lastIndex = dayIndex(year, month, getDaysInMonth(year, month));
  return dayIndexToDateKey(lastIndex - offsetToWeekday(isoWeekdayOf(lastIndex), isoWeekday));
}

/** Deutscher Langname eines Datums, z. B. "16. Juli 2027". */
export function formatGermanDate(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  if (!parts) throw new RangeError(`Ungültiger dateKey: ${dateKey}`);
  return `${parts.day}. ${MONTH_NAMES[parts.month - 1]} ${parts.year}`;
}

/** Kurzform "16.07.2027". */
export function formatShortDate(dateKey: string): string {
  const parts = parseDateKey(dateKey);
  if (!parts) throw new RangeError(`Ungültiger dateKey: ${dateKey}`);
  return `${String(parts.day).padStart(2, '0')}.${String(parts.month).padStart(2, '0')}.${parts.year}`;
}
