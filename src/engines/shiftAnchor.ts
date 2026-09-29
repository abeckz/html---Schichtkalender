/**
 * Anker der Schichtzyklen.
 *
 * Der Zyklus läuft als fortlaufender Tagesindex über alle Kalendertage:
 *
 *   position = positiveModulo(dayIndex - anchorIndex, cycleLength)
 *
 * anchorIndex ist der Tagesindex des 01.01.2021. Die verbindlichen
 * Referenzwerte für Schicht C (Abschnitt 13 der Spezifikation) ergeben
 * für die Zielpositionen:
 *
 *   01.01.2021 (Tag 0): NIGHT -> C-Muster index 3
 *   04.01.2021 (Tag 3): DAY   -> C-Muster index 2
 *
 * Daraus folgt:
 *
 *   positiveModulo(3 - offset, 4) = 2
 *   => (3 - offset) mod 4 = 2  =>  offset ≡ 1 (mod 4)
 *
 * Gewählt wird der kleinste positive Offset: offset = 1.
 */

import { dayIndex } from '../utils/dayIndex';

/** Kalendertag, auf den sich die Referenzwerte der Spezifikation beziehen. */
export const SHIFT_EPOCH_YEAR = 2021;
export const SHIFT_EPOCH_MONTH = 1;
export const SHIFT_EPOCH_DAY = 1;

/** Tagesindex des 01.01.2021 (Referenzanker). */
export const SHIFT_EPOCH_DAY_INDEX = dayIndex(
  SHIFT_EPOCH_YEAR,
  SHIFT_EPOCH_MONTH,
  SHIFT_EPOCH_DAY,
);

/** Globaler Offset des Zyklus gegenüber dem Referenzanker. */
export const SHIFT_CYCLE_OFFSET = 1;
