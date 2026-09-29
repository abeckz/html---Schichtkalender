/**
 * ShiftEngine.
 *
 * Bestimmt den Schichtzustand eines Kalendertages ausschließlich aus:
 *
 *   - stabiler Tagesindex (UTC-Anker, siehe utils/dayIndex.ts)
 *   - Zykluslänge und Muster der gewählten Schicht
 *   - globalem Zyklus-Offset (engines/shiftAnchor.ts)
 *
 * Es findet kein Reset bei Monats-, Jahres- oder Kalenderwochenwechsel
 * statt. Uhrzeit, Zeitzone und Sommerzeit haben keinen Einfluss.
 */

import type { ShiftId, ShiftState } from '../domain/types';
import { getShiftDefinition, shiftStateLabels } from '../config/shiftDefinitions';
import { positiveModulo } from '../utils/modulo';
import { dayIndex } from '../utils/dayIndex';
import { SHIFT_CYCLE_OFFSET, SHIFT_EPOCH_DAY_INDEX } from './shiftAnchor';

/** Position des Tages innerhalb des Schichtzyklus (0 .. cycleLength - 1). */
export function getCyclePosition(
  year: number,
  month: number,
  day: number,
  shiftId: ShiftId,
): number {
  const definition = getShiftDefinition(shiftId);
  const index = dayIndex(year, month, day);
  return positiveModulo(index - SHIFT_EPOCH_DAY_INDEX - SHIFT_CYCLE_OFFSET, definition.cycleLength);
}

/** Schichtzustand eines Kalendertages. */
export function getShiftState(
  year: number,
  month: number,
  day: number,
  shiftId: ShiftId,
): ShiftState {
  const definition = getShiftDefinition(shiftId);
  return definition.pattern[getCyclePosition(year, month, day, shiftId)];
}

/** Anzeigezeichen ("T", "N" oder "") eines Kalendertages. */
export function getShiftLabel(
  year: number,
  month: number,
  day: number,
  shiftId: ShiftId,
): string {
  return shiftStateLabels[getShiftState(year, month, day, shiftId)];
}

/**
 * Liefert die Anzahl der T-, N- und OFF-Positionen eines Zyklus.
 * Dient als Grundlage für die Invariantentests.
 */
export function countStatesInCycle(shiftId: ShiftId): Record<ShiftState, number> {
  const definition = getShiftDefinition(shiftId);
  const counts: Record<ShiftState, number> = { DAY: 0, NIGHT: 0, OFF: 0 };
  for (const state of definition.pattern) {
    counts[state] += 1;
  }
  return counts;
}
