/**
 * Standardwerte der Anwendung.
 *
 * Das Startjahr ist grundsätzlich das aktuelle Jahr: die Jahresauswahl
 * startet damit immer beim laufenden Jahr und nicht bei einem festen
 * Bezugsjahr. Liegt das aktuelle Jahr außerhalb des Auswahlbereichs, wird
 * auf den nächstliegenden Rand begrenzt.
 *
 * 2021 bleibt als fachliches Referenzjahr erhalten: für dieses Jahr liegt
 * die verbindliche Referenzberechnung der Spezifikation vor.
 */

import type { AppSettings } from '../domain/types';

/** Fachliches Referenzjahr der Spezifikation. */
export const REFERENCE_YEAR = 2021;

/** Jahr für die Jahresauswahl. */
export const SELECTABLE_YEARS: readonly number[] = Array.from(
  { length: 31 },
  (_, index) => 2020 + index,
);

/** Kleinstes wählbares Jahr. */
export const FIRST_SELECTABLE_YEAR = SELECTABLE_YEARS[0];

/** Größtes wählbares Jahr. */
export const LAST_SELECTABLE_YEAR = SELECTABLE_YEARS[SELECTABLE_YEARS.length - 1];

/**
 * Begrenzt ein Jahr auf den Auswahlbereich der Jahresauswahl.
 * Vor dem ersten wählbaren Jahr wird 2021 (Referenzjahr) verwendet, weil
 * das früheste wählbare Jahr 2020 ist, aber 2021 das verbindliche
 * Referenzjahr darstellt.
 */
export function clampToSelectableYear(year: number): number {
  if (!Number.isInteger(year)) return REFERENCE_YEAR;
  if (year < FIRST_SELECTABLE_YEAR) return REFERENCE_YEAR;
  return Math.min(LAST_SELECTABLE_YEAR, year);
}

/**
 * Startjahr der Anwendung: immer das aktuelle Jahr (bei Randlagen
 * begrenzt auf den Auswahlbereich).
 */
export function defaultYear(now: Date = new Date()): number {
  return clampToSelectableYear(now.getFullYear());
}

export const DEFAULT_YEAR = defaultYear();

export const DEFAULT_SHIFT = 'C' as const;

export const DEFAULT_SETTINGS: AppSettings = {
  selectedYear: DEFAULT_YEAR,
  selectedShift: DEFAULT_SHIFT,
};
