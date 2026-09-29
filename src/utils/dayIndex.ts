/**
 * Stabiler, zeitzonenunabhängiger Kalendertagsindex.
 *
 * dayIndex(year, month, day) = floor(Date.UTC(year, month - 1, day) / 86400000)
 *
 * Der UTC-Wert dient ausschließlich als ganzzahliger, fortlaufender
 * Tageszähler. Er ist unabhängig von Uhrzeit, Zeitzone, Sommer- und
 * Winterzeit und läuft lückenlos über Monats- und Jahresgrenzen.
 */

export const MS_PER_DAY = 86400000;
export const DAYS_PER_WEEK = 7;

export function dayIndex(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / MS_PER_DAY);
}
