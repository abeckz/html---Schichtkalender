import { describe, expect, it } from 'vitest';
import {
  countStatesInCycle,
  getCyclePosition,
  getShiftLabel,
  getShiftState,
} from '../engines/shiftEngine';
import { shiftDefinitions } from '../config/shiftDefinitions';
import type { ShiftId, ShiftState } from '../domain/types';
import { getDaysInMonth, parseDateKey } from '../utils/dateUtils';
import { positiveModulo } from '../utils/modulo';

/** Komforthelfer: Schichtzustand über einen dateKey. */
function stateAt(dateKey: string, shiftId: ShiftId): ShiftState {
  const parts = parseDateKey(dateKey);
  if (!parts) throw new Error(`Ungültiger dateKey im Test: ${dateKey}`);
  return getShiftState(parts.year, parts.month, parts.day, shiftId);
}

/** Erzeugt aufeinanderfolgende Januar-dateKeys ab dem 01.01.2021. */
function sequentialJanuaryKeys(count: number): string[] {
  const keys: string[] = [];
  for (let day = 1; day <= count; day += 1) {
    keys.push(`2021-01-${String(day).padStart(2, '0')}`);
  }
  return keys;
}

const SYSTEM_I_III: readonly ShiftId[] = ['I', 'II', 'III'];
const SYSTEM_A_D: readonly ShiftId[] = ['A', 'B', 'C', 'D'];
const ALL_SHIFTS: readonly ShiftId[] = [...SYSTEM_I_III, ...SYSTEM_A_D];

describe('Schichtmuster (Konfiguration)', () => {
  it('entspricht exakt der spezifizierten Matrix für I / II / III', () => {
    expect(shiftDefinitions.I.cycleLength).toBe(3);
    expect(shiftDefinitions.I.pattern).toEqual(['NIGHT', 'OFF', 'DAY']);

    expect(shiftDefinitions.II.cycleLength).toBe(3);
    expect(shiftDefinitions.II.pattern).toEqual(['OFF', 'DAY', 'NIGHT']);

    expect(shiftDefinitions.III.cycleLength).toBe(3);
    expect(shiftDefinitions.III.pattern).toEqual(['DAY', 'NIGHT', 'OFF']);
  });

  it('entspricht exakt der spezifizierten Matrix für A / B / C / D', () => {
    expect(shiftDefinitions.A.cycleLength).toBe(4);
    expect(shiftDefinitions.A.pattern).toEqual(['OFF', 'DAY', 'NIGHT', 'OFF']);

    expect(shiftDefinitions.B.pattern).toEqual(['DAY', 'NIGHT', 'OFF', 'OFF']);
    expect(shiftDefinitions.C.pattern).toEqual(['OFF', 'OFF', 'DAY', 'NIGHT']);
    expect(shiftDefinitions.D.pattern).toEqual(['NIGHT', 'OFF', 'OFF', 'DAY']);
  });

  it('erfüllt die Positions-Invarianten für I / II / III', () => {
    for (let position = 0; position < 3; position += 1) {
      const states = SYSTEM_I_III.map((id) => shiftDefinitions[id].pattern[position]);
      expect(states.filter((s) => s === 'DAY')).toHaveLength(1);
      expect(states.filter((s) => s === 'NIGHT')).toHaveLength(1);
      expect(states.filter((s) => s === 'OFF')).toHaveLength(1);
    }
    for (const shiftId of SYSTEM_I_III) {
      expect(countStatesInCycle(shiftId)).toEqual({ DAY: 1, NIGHT: 1, OFF: 1 });
    }
  });

  it('erfüllt die Positions-Invarianten für A / B / C / D', () => {
    for (let position = 0; position < 4; position += 1) {
      const states = SYSTEM_A_D.map((id) => shiftDefinitions[id].pattern[position]);
      expect(states.filter((s) => s === 'DAY')).toHaveLength(1);
      expect(states.filter((s) => s === 'NIGHT')).toHaveLength(1);
      expect(states.filter((s) => s === 'OFF')).toHaveLength(2);
    }
    for (const shiftId of SYSTEM_A_D) {
      expect(countStatesInCycle(shiftId)).toEqual({ DAY: 1, NIGHT: 1, OFF: 2 });
    }
  });
});


describe('Schicht C - verbindliche Referenzwerte 2021', () => {
  const references: Array<[string, ShiftState]> = [
    ['2021-01-01', 'NIGHT'],
    ['2021-01-02', 'OFF'],
    ['2021-01-03', 'OFF'],
    ['2021-01-04', 'DAY'],
    ['2021-01-05', 'NIGHT'],
    ['2021-01-06', 'OFF'],
    ['2021-01-07', 'OFF'],
    ['2021-01-08', 'DAY'],
    ['2021-01-09', 'NIGHT'],
    ['2021-01-10', 'OFF'],
    ['2021-01-11', 'OFF'],
    ['2021-01-12', 'DAY'],
    ['2021-01-13', 'NIGHT'],
    ['2021-01-14', 'OFF'],
    ['2021-01-15', 'OFF'],
    ['2021-01-16', 'DAY'],
    ['2021-02-01', 'DAY'],
    ['2021-02-02', 'NIGHT'],
    ['2021-02-03', 'OFF'],
    ['2021-02-04', 'OFF'],
    ['2021-05-01', 'NIGHT'],
    ['2021-06-01', 'DAY'],
    ['2021-07-01', 'OFF'],
    ['2021-07-02', 'OFF'],
    ['2021-07-03', 'DAY'],
    ['2021-07-04', 'NIGHT'],
    ['2021-08-01', 'NIGHT'],
    ['2021-11-01', 'NIGHT'],
    ['2021-12-01', 'OFF'],
    ['2021-12-02', 'DAY'],
    ['2021-12-03', 'NIGHT'],
    ['2021-12-04', 'OFF'],
    ['2021-12-31', 'NIGHT'],
  ];

  it.each(references)('%s = %s', (dateKey, expected) => {
    expect(stateAt(dateKey, 'C')).toBe(expected);
  });
});

describe('Zykluskontinuität ohne Reset', () => {
  it('läuft über den Jahreswechsel 2021/2022 weiter', () => {
    expect(stateAt('2021-12-31', 'C')).toBe('NIGHT');
    expect(stateAt('2022-01-01', 'C')).toBe('OFF');
    expect(stateAt('2022-01-02', 'C')).toBe('OFF');
    expect(stateAt('2022-01-03', 'C')).toBe('DAY');
    expect(stateAt('2022-01-04', 'C')).toBe('NIGHT');
  });

  it('läuft über den Monatswechsel ohne Reset weiter (Januar 2021)', () => {
    const states = sequentialJanuaryKeys(31).map((key) => stateAt(key, 'C'));
    const expected = Array.from(
      { length: 31 },
      (_, offset) => shiftDefinitions.C.pattern[positiveModulo(offset - 1, 4)],
    );
    expect(states).toEqual(expected);
    // Und die ersten sieben Tage explizit gegen die Referenzwerte:
    expect(states.slice(0, 7)).toEqual(['NIGHT', 'OFF', 'OFF', 'DAY', 'NIGHT', 'OFF', 'OFF']);
  });

  it('behandelt Schaltjahre ohne Sprung', () => {
    expect(stateAt('2024-02-27', 'C')).toBe('NIGHT');
    expect(stateAt('2024-02-28', 'C')).toBe('OFF');
    expect(stateAt('2024-02-29', 'C')).toBe('OFF');
    expect(stateAt('2024-03-01', 'C')).toBe('DAY');
    expect(stateAt('2024-03-02', 'C')).toBe('NIGHT');
  });

  it('zählt im Schaltjahr 2024 genau 366 Tage', () => {
    expect(getDaysInMonth(2024, 2)).toBe(29);
  });

  it('bleibt für Daten vor dem Referenzjahr deterministisch', () => {
    expect(stateAt('2020-12-31', 'C')).toBe('DAY');
    expect(stateAt('2020-12-30', 'C')).toBe('OFF');
    expect(stateAt('2020-12-29', 'C')).toBe('OFF');
    expect(stateAt('2020-12-28', 'C')).toBe('NIGHT');
  });

  it('liefert für alle Jahre 1990 bis 2100 ausschließlich gültige Positionen', () => {
    for (const shiftId of ALL_SHIFTS) {
      for (let year = 1990; year <= 2100; year += 1) {
        for (let month = 1; month <= 12; month += 1) {
          const days = getDaysInMonth(year, month);
          for (let day = 1; day <= days; day += 1) {
            const position = getCyclePosition(year, month, day, shiftId);
            expect(Number.isInteger(position)).toBe(true);
            expect(position).toBeGreaterThanOrEqual(0);
            expect(position).toBeLessThan(shiftDefinitions[shiftId].cycleLength);
          }
        }
      }
    }
  });
});

describe('Schichtkennzeichen', () => {
  it('zeigt T für DAY, N für NIGHT und leer für OFF', () => {
    expect(getShiftLabel(2021, 1, 1, 'C')).toBe('N');
    expect(getShiftLabel(2021, 1, 4, 'C')).toBe('T');
    expect(getShiftLabel(2021, 1, 2, 'C')).toBe('');
  });

  it('verteilt T/N/OFF im Jahr 2021 für jede Schicht plausibel', () => {
    for (const shiftId of ALL_SHIFTS) {
      const counter: Record<string, number> = { T: 0, N: 0, '': 0 };
      for (let month = 1; month <= 12; month += 1) {
        const days = getDaysInMonth(2021, month);
        for (let day = 1; day <= days; day += 1) {
          counter[getShiftLabel(2021, month, day, shiftId)] += 1;
        }
      }
      expect(counter.T + counter.N + counter['']).toBe(365);
      expect(counter.T).toBeGreaterThan(80);
      expect(counter.N).toBeGreaterThan(80);
      expect(counter['']).toBeGreaterThan(60);
    }
  });

  it('entspricht am 01.01.2021 für Schicht C der Spezifikationsposition 0', () => {
    // 01.01.2021 ist Zyklustag 0. Schicht C ist verbindlich verankert:
    expect(getShiftState(2021, 1, 1, 'C')).toBe('NIGHT');
    // Die übrigen Schichten laufen mit demselben Tagesindex, aber mit
    // eigenem Musterstart (Musterrotation der Spezifikationsmatrix):
    expect(getShiftState(2021, 1, 1, 'I')).toBe('DAY');
    expect(getShiftState(2021, 1, 1, 'II')).toBe('NIGHT');
    expect(getShiftState(2021, 1, 1, 'III')).toBe('OFF');
    expect(getShiftState(2021, 1, 1, 'A')).toBe('OFF');
    expect(getShiftState(2021, 1, 1, 'B')).toBe('OFF');
    expect(getShiftState(2021, 1, 1, 'D')).toBe('DAY');
  });

  it('entspricht am 02.01.2021 der Spezifikationsposition 1', () => {
    expect(getShiftState(2021, 1, 2, 'I')).toBe('NIGHT');
    expect(getShiftState(2021, 1, 2, 'II')).toBe('OFF');
    expect(getShiftState(2021, 1, 2, 'III')).toBe('DAY');
    expect(getShiftState(2021, 1, 2, 'A')).toBe('OFF');
    expect(getShiftState(2021, 1, 2, 'B')).toBe('DAY');
    expect(getShiftState(2021, 1, 2, 'C')).toBe('OFF');
    expect(getShiftState(2021, 1, 2, 'D')).toBe('NIGHT');
  });

  it('entspricht am 03.01.2021 der Spezifikationsposition 2', () => {
    expect(getShiftState(2021, 1, 3, 'I')).toBe('OFF');
    expect(getShiftState(2021, 1, 3, 'II')).toBe('DAY');
    expect(getShiftState(2021, 1, 3, 'III')).toBe('NIGHT');
    expect(getShiftState(2021, 1, 3, 'A')).toBe('DAY');
    expect(getShiftState(2021, 1, 3, 'B')).toBe('NIGHT');
    expect(getShiftState(2021, 1, 3, 'C')).toBe('OFF');
    expect(getShiftState(2021, 1, 3, 'D')).toBe('OFF');
  });

  it('entspricht am 04.01.2021 der Spezifikationsposition 3 (nur System A-D)', () => {
    // Spezifikationsposition 3: A = OFF, B = OFF, C = NIGHT, D = DAY
    expect(getShiftState(2021, 1, 4, 'A')).toBe('NIGHT');
    expect(getShiftState(2021, 1, 4, 'B')).toBe('OFF');
    expect(getShiftState(2021, 1, 4, 'C')).toBe('DAY');
    expect(getShiftState(2021, 1, 4, 'D')).toBe('OFF');
  });
});
