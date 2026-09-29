import { describe, expect, it } from 'vitest';
import {
  buildYearCalendar,
  calculateMonthStatistics,
  findDay,
  flattenYearDays,
  summarizeYear,
} from '../engines/calendarBuilder';
import { SHIFT_IDS } from '../config/shiftDefinitions';
import { getDaysInYear, isValidDateKey } from '../utils/dateUtils';
import type { CalendarDay, ShiftId } from '../domain/types';

const year2021 = buildYearCalendar({ year: 2021, selectedShift: 'C' });

describe('Struktur des Jahreskalenders', () => {
  it('erzeugt 12 Monate mit den deutschen Namen und Kurznamen', () => {
    expect(year2021.months).toHaveLength(12);
    expect(year2021.months[0].name).toBe('Januar');
    expect(year2021.months[0].shortName).toBe('JAN');
    expect(year2021.months[11].name).toBe('Dezember');
    expect(year2021.months[11].shortName).toBe('DEZ');
  });

  it('erzeugt lückenlos alle 365 Tage des Jahres 2021', () => {
    const days = flattenYearDays(year2021);
    expect(days).toHaveLength(getDaysInYear(2021));
    expect(days[0].dateKey).toBe('2021-01-01');
    expect(days[days.length - 1].dateKey).toBe('2021-12-31');
    for (const day of days) {
      expect(isValidDateKey(day.dateKey)).toBe(true);
    }
  });

  it('erzeugt im Schaltjahr 2024 alle 366 Tage inklusive 29.02.', () => {
    const days = flattenYearDays(buildYearCalendar({ year: 2024, selectedShift: 'C' }));
    expect(days).toHaveLength(366);
    expect(days.some((day) => day.dateKey === '2024-02-29')).toBe(true);
  });

  it('füllt die Kalenderfelder eines Tages korrekt', () => {
    const day = findDay(year2021, '2021-01-04');
    expect(day).toBeDefined();
    expect(day).toMatchObject<Partial<CalendarDay>>({
      year: 2021,
      month: 1,
      day: 4,
      isoWeekday: 1,
      weekdayShort: 'Mo',
      isWeekend: false,
      isSunday: false,
    });
  });

  it('markiert Wochenenden und Sonntage korrekt', () => {
    expect(findDay(year2021, '2021-01-02')?.isWeekend).toBe(true);
    expect(findDay(year2021, '2021-01-03')?.isSunday).toBe(true);
    expect(findDay(year2021, '2021-01-03')?.isWeekend).toBe(true);
    expect(findDay(year2021, '2021-01-01')?.isWeekend).toBe(false);
  });

  it('wirft bei ungültigem Jahr oder unbekannter Schicht', () => {
    expect(() => buildYearCalendar({ year: 1800, selectedShift: 'C' })).toThrow(RangeError);
    expect(() =>
      buildYearCalendar({ year: 2021, selectedShift: 'X' as unknown as ShiftId }),
    ).toThrow(RangeError);
  });
});

describe('Schichtwerte im Jahreskalender', () => {
  it('bleibt unabhängig vom Jahr, solange die Zyklusposition gleich ist', () => {
    for (const shiftId of SHIFT_IDS) {
      const a = buildYearCalendar({ year: 2021, selectedShift: shiftId });
      const b = buildYearCalendar({ year: 2025, selectedShift: shiftId });
      // Abstand 2021-01-01 -> 2025-01-01 beträgt 1461 Tage = Vielfaches von 3? Nein:
      // 1461 = 3 * 487, also identische Position in 3er-Zyklen; bei 4er-Zyklen
      // verschiebt sich das Muster und wird separat geprüft.
      if (shiftId === 'I' || shiftId === 'II' || shiftId === 'III') {
        expect(findDay(a, '2021-03-15')?.shiftState).toBe(
          findDay(b, '2025-03-15')?.shiftState,
        );
      }
    }
  });

  it('setzt c-Achse laut Referenz: C ist 2021-01-01 Nachtschicht und 2021-01-04 Tagschicht', () => {
    expect(findDay(year2021, '2021-01-01')?.shiftState).toBe('NIGHT');
    expect(findDay(year2021, '2021-01-04')?.shiftState).toBe('DAY');
    expect(findDay(year2021, '2021-01-05')?.shiftState).toBe('NIGHT');
    expect(findDay(year2021, '2021-01-02')?.shiftState).toBe('OFF');
    expect(findDay(year2021, '2021-01-03')?.shiftState).toBe('OFF');
  });

  it('setzt die Anzeigezeichen T, N und leer konsistent zu den Zuständen', () => {
    const expected: Record<string, string> = { DAY: 'T', NIGHT: 'N', OFF: '' };
    for (const day of flattenYearDays(year2021)) {
      expect(day.shiftLabel).toBe(expected[day.shiftState]);
    }
  });

  it('hält den 4er-Zyklus über Jahresgrenzen hinweg ein', () => {
    const year2022 = buildYearCalendar({ year: 2022, selectedShift: 'C' });
    const chain: string[] = [];
    for (let day = 28; day <= 31; day += 1) {
      chain.push(findDay(year2021, `2021-12-${String(day).padStart(2, '0')}`)!.shiftState);
    }
    for (let day = 1; day <= 4; day += 1) {
      chain.push(findDay(year2022, `2022-01-${String(day).padStart(2, '0')}`)!.shiftState);
    }
    // Der 31.12.2021 und der 04.01.2022 liegen exakt einen Zyklus auseinander.
    expect(chain).toHaveLength(8);
    expect(chain[0]).toBe(chain[4]);
    expect(chain[3]).toBe(chain[7]);
    expect(chain).toEqual([chain[0], chain[1], chain[2], chain[3], chain[0], chain[1], chain[2], chain[3]]);
  });
});


describe('Monats- und Jahreskennzahlen', () => {
  it('zählt die Werktage eines Monats Montag bis Freitag', () => {
    // Januar 2021: 31 Tage mit 4 Wochenenden -> 21 Werktage.
    const january = year2021.months[0];
    expect(january.statistics.weekdayCount).toBe(21);
  });

  it('zählt bezahlte Feiertage nur an Werktagen', () => {
    // 01.01.2021 (Fr) und 06.01.2021 (Mi) sind bezahlte Feiertage an Werktagen.
    expect(year2021.months[0].statistics.paidWeekdayHolidayCount).toBe(2);
    // 03.10.2021 ist ein Sonntag -> zählt nicht als Werktagsfeiertag.
    expect(year2021.months[9].statistics.paidWeekdayHolidayCount).toBe(0);
    // 01.11.2021 (Mo); 25./26.12.2021 fallen auf Sa/So.
    expect(year2021.months[10].statistics.paidWeekdayHolidayCount).toBe(1);
    expect(year2021.months[11].statistics.paidWeekdayHolidayCount).toBe(0);
  });

  it('setzt requiredShiftCount immer als Summe von Tag- und Nachtschicht', () => {
    for (const month of year2021.months) {
      expect(month.statistics.requiredShiftCount).toBe(
        month.statistics.dayShiftCount + month.statistics.nightShiftCount,
      );
    }
  });

  it('trifft die verifizierten Schichtzahlen 2021 je System', () => {
    // 2021 hat 365 Tage. Muster enthalten je genau eine Tages- und eine
    // Nachtschicht pro Zyklus; wirksam sind daher floor/ceil(365/Zyklus).
    const expected: Record<ShiftId, [number, number]> = {
      I: [122, 122],
      II: [121, 122],
      III: [122, 121],
      A: [91, 91],
      B: [91, 91],
      C: [91, 92],
      D: [92, 91],
    };
    for (const shiftId of SHIFT_IDS) {
      const configured = summarizeYear(buildYearCalendar({ year: 2021, selectedShift: shiftId }));
      expect({
        shiftId,
        day: configured.dayShiftCount,
        night: configured.nightShiftCount,
      }).toEqual({
        shiftId,
        day: expected[shiftId][0],
        night: expected[shiftId][1],
      });
      expect(configured.requiredShiftCount).toBe(
        configured.dayShiftCount + configured.nightShiftCount,
      );
      expect(configured.requiredShiftCount).toBeLessThanOrEqual(365);
    }
  });

  it('summiert die Monatswerte identisch zum Jahresergebnis', () => {
    const manual = year2021.months.reduce(
      (total, month) => total + month.statistics.dayShiftCount,
      0,
    );
    expect(summarizeYear(year2021).dayShiftCount).toBe(manual);
  });

  it('berechnet die Kennzahlen aus einer Tagesliste reproduzierbar', () => {
    const januaryDays = year2021.months[0].days;
    expect(calculateMonthStatistics(januaryDays)).toEqual(year2021.months[0].statistics);
  });
});
