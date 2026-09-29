/**
 * Zentrale, datengetriebene Schichtkonfiguration.
 *
 * Die Muster folgen den verbindlichen Matrizen der Spezifikation
 * (Abschnitte 9 bis 11).
 */

import type { ShiftDefinition, ShiftId, ShiftState } from '../domain/types';

export const SHIFT_IDS: readonly ShiftId[] = ['I', 'II', 'III', 'A', 'B', 'C', 'D'];

export const shiftDefinitions: Record<ShiftId, ShiftDefinition> = {
  I: {
    id: 'I',
    displayName: 'Schicht I',
    cycleLength: 3,
    pattern: ['NIGHT', 'OFF', 'DAY'],
  },
  II: {
    id: 'II',
    displayName: 'Schicht II',
    cycleLength: 3,
    pattern: ['OFF', 'DAY', 'NIGHT'],
  },
  III: {
    id: 'III',
    displayName: 'Schicht III',
    cycleLength: 3,
    pattern: ['DAY', 'NIGHT', 'OFF'],
  },
  A: {
    id: 'A',
    displayName: 'Schicht A',
    cycleLength: 4,
    pattern: ['OFF', 'DAY', 'NIGHT', 'OFF'],
  },
  B: {
    id: 'B',
    displayName: 'Schicht B',
    cycleLength: 4,
    pattern: ['DAY', 'NIGHT', 'OFF', 'OFF'],
  },
  C: {
    id: 'C',
    displayName: 'Schicht C',
    cycleLength: 4,
    pattern: ['OFF', 'OFF', 'DAY', 'NIGHT'],
  },
  D: {
    id: 'D',
    displayName: 'Schicht D',
    cycleLength: 4,
    pattern: ['NIGHT', 'OFF', 'OFF', 'DAY'],
  },
};

/** Anzeigezeichen eines Schichtzustands: "T", "N" oder "" (OFF). */
export const shiftStateLabels: Record<ShiftState, string> = {
  DAY: 'T',
  NIGHT: 'N',
  OFF: '',
};

/** Deutsche Klartextbezeichnung eines Schichtzustands. */
export const shiftStateDescriptions: Record<ShiftState, string> = {
  DAY: 'Tagschicht 6-18 Uhr',
  NIGHT: 'Nachtschicht 18-6 Uhr',
  OFF: 'keine T-/N-Schicht',
};

/** Liefert die Definition einer Schicht oder wirft bei unbekannter Kennung. */
export function getShiftDefinition(shiftId: ShiftId): ShiftDefinition {
  const definition = shiftDefinitions[shiftId];
  if (!definition) {
    throw new RangeError(`Unbekannte Schicht: ${String(shiftId)}`);
  }
  return definition;
}
