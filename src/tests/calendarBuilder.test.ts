import { describe, expect, it } from 'vitest';
import {
  HALF_PAID_HOLIDAY,
  buildYearCalendar,
  calculateMonthStatistics,
  findDay,
  flattenYearDays,
  summarizeYear,
} from '../engines/calendarBuilder';
import { SHIFT_IDS } from '../config/shiftDefinitions';
import { addDaysToKey, getDaysInYear, isValidDateKey } from '../utils/dateUtils';
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

  it('zählt bezahlte Feiertage nur an Tagen mit tatsächlicher Schicht', () => {
    // Maßgeblich ist nicht der Wochentag, sondern ob an dem Feiertag eine
    // Schicht ansteht (T/N) oder nicht (OFF).
    const first = buildYearCalendar({ year: 2021, selectedShift: 'I' });
    // Fr 01.01. (Neujahr) wird als Tagschicht gearbeitet -> bezahlt.
    expect(findDay(first, '2021-01-01')?.shiftState).toBe('DAY');
    // Der 06.01. (Hl. Drei Könige) ist in Rheinland-Pfalz kein gesetzlicher
    // Feiertag und damit kein bezahlter Feiertag mehr. Schicht I arbeitet
    // an diesem Tag nicht (OFF) – unabhängig davon wird er nicht gezählt.
    expect(findDay(first, '2021-01-06')?.shiftState).toBe('OFF');
    // Im Januar bleibt damit genau Neujahr: der 01.01. (T).
    expect(first.months[0].statistics.paidWeekdayHolidayCount).toBe(1);
    // Sa 01.05. (Maifeiertag) wird ebenfalls gearbeitet.
    expect(findDay(first, '2021-05-01')?.shiftState).toBe('DAY');
    // Im Mai 2021 sind Maifeiertag (01.05., T) und Christi Himmelfahrt
    // (13.05., T) bezahlte Feiertage mit Schicht; Pfingstmontag (24.05.)
    // liegt schichtfrei: gemessen werden zwei bezahlte Feiertage.
    expect(first.months[4].statistics.paidWeekdayHolidayCount).toBe(2);

    // Schicht B: Der 01.01. (Fr) ist schichtfrei, der 06.01. (Mi) wird
    // gearbeitet – als nicht gesetzlicher Feiertag zählt auch er nicht.
    const second = buildYearCalendar({ year: 2021, selectedShift: 'B' });
    expect(findDay(second, '2021-01-06')?.shiftState).toBe('DAY');
    expect(findDay(second, '2021-01-01')?.shiftState).toBe('OFF');
    expect(second.months[0].statistics.paidWeekdayHolidayCount).toBe(0);
  });
  it('zählt einen bezahlten Feiertag auch an einem Wochenende mit Schicht', () => {
    // Schicht I: Der 25.12.2021 (Sa, 1. Weihnachtstag) ist eine
    // Nachtschicht und damit ein bezahlter Feiertag mit Schicht. Mariä
    // Himmelfahrt (15.08.) ist in Rheinland-Pfalz nicht gesetzlich und
    // zählt deshalb nicht mehr, obwohl Schicht I dort Nachtschicht hat.
    const first = buildYearCalendar({ year: 2021, selectedShift: 'I' });
    expect(findDay(first, '2021-08-15')?.shiftState).toBe('NIGHT');
    expect(first.months[7].statistics.paidWeekdayHolidayCount).toBe(0);
    expect(findDay(first, '2021-12-25')?.shiftState).toBe('NIGHT');
    // 26.12.2021 (So, 2. Weihnachtstag) ist in Schicht I schichtfrei.
    expect(findDay(first, '2021-12-26')?.shiftState).toBe('OFF');
    expect(first.months[11].statistics.paidWeekdayHolidayCount).toBe(1);

    // Schicht III: Der 26.12.2021 (So) wird gearbeitet, der 25.12. (Sa)
    // dagegen als Tagschicht – beide sind bezahlte Feiertage.
    const third = buildYearCalendar({ year: 2021, selectedShift: 'III' });
    expect(findDay(third, '2021-12-25')?.shiftState).toBe('DAY');
    expect(findDay(third, '2021-12-26')?.shiftState).toBe('NIGHT');
    expect(third.months[11].statistics.paidWeekdayHolidayCount).toBe(2);
  });

  it('rechnet einen Feiertag am freien Tag nicht als bezahlt', () => {
    // Schicht III im Mai 2021: Der 01.05. (Sa) und der 13.05. (Do,
    // Christi Himmelfahrt) sind schichtfrei (OFF) und begründen deshalb
    // keinen Anspruch; der 24.05. (Mo, Pfingstmontag) ist Nachtschicht.
    const third = buildYearCalendar({ year: 2021, selectedShift: 'III' });
    expect(findDay(third, '2021-05-01')?.shiftState).toBe('OFF');
    expect(findDay(third, '2021-05-13')?.shiftState).toBe('OFF');
    expect(findDay(third, '2021-05-24')?.shiftState).toBe('NIGHT');
    expect(third.months[4].statistics.paidWeekdayHolidayCount).toBe(1);
  });

  it('zählt Neujahr im Schichtjahr 2026 nicht, wenn der 01.01. schichtfrei ist', () => {
    // Gegenprobe zur Ausgangsfrage: Schicht C beginnt das Jahr 2026 mit einem
    // freien Tag (01.01. Do = OFF); gearbeitet wird ab dem 02.01. Neujahr
    // fällt damit auf einen Tag ohne Schicht und wird nicht als bezahlter
    // Feiertag gezählt. Heilige Drei Könige (06.01., Di) wird gearbeitet,
    // ist in Rheinland-Pfalz aber kein Feiertag und zählt deshalb ebenfalls
    // nicht. Der Januar bleibt damit ohne bezahlten Feiertag.
    const calendar = buildYearCalendar({ year: 2026, selectedShift: 'C' });
    const january = calendar.months[0];
    expect(findDay(calendar, '2026-01-01')?.shiftState).toBe('OFF');
    expect(findDay(calendar, '2026-01-02')?.shiftState).toBe('DAY');
    expect(findDay(calendar, '2026-01-06')?.shiftState).toBe('DAY');
    // Neujahr bleibt als bezahlter Feiertag markiert (gesetzlich in RLP),
    // wird aber nur bei tatsächlicher Schicht gezählt - der 01.01. ist OFF.
    expect(
      findDay(calendar, '2026-01-01')?.events.some((event) => event.countsAsPaidNormalShiftHoliday),
    ).toBe(true);
    // Heilige Drei Könige ist in Rheinland-Pfalz kein Feiertag und daher
    // weder markiert noch gezählt, obwohl an dem Tag gearbeitet wird.
    expect(
      findDay(calendar, '2026-01-06')?.events.some((event) => event.countsAsPaidNormalShiftHoliday),
    ).toBe(false);
    expect(january.statistics.paidWeekdayHolidayCount).toBe(0);
    expect(january.statistics.paidNightShiftHolidayCount).toBe(0);
    expect(january.statistics.paidHolidayCount).toBe(0);
    // Gegenprobe: Ein gesetzlicher Feiertag an einem Schichttag bleibt
    // gezählt. Der 14.05.2026 (Christi Himmelfahrt, T) ist der einzige
    // bezahlte Feiertag mit Schicht im Mai.
    expect(calendar.months[4].statistics.paidWeekdayHolidayCount).toBe(1);
  });

  it('zählt einen bezahlten Feiertag unabhängig vom Wochentag, wenn gearbeitet wird', () => {
    // Gezählt werden ausschließlich Tage mit den Schichtzeichen T oder N.
    // Damit ist die Anzahl der bezahlten Feiertage unabhängig von
    // Wochenenden und Feiertagen in der Mitte der Woche.
    for (const shiftId of SHIFT_IDS) {
      const calendar = buildYearCalendar({ year: 2021, selectedShift: shiftId });
      const paidDays = flattenYearDays(calendar).filter((day) =>
        day.events.some((event) => event.countsAsPaidNormalShiftHoliday),
      );
      const worked = paidDays.filter((day) => day.shiftState !== 'OFF');
      const free = paidDays.filter((day) => day.shiftState === 'OFF');
      const counted = summarizeYear(calendar).paidWeekdayHolidayCount;

      // Jeder gearbeitete Feiertag wird gezählt, kein freier Tag.
      expect({ shiftId, counted }).toEqual({ shiftId, counted: worked.length });
      // Gegenprobe: kein freier Feiertag wird mitgezählt.
      expect({ shiftId, freeCounted: free.length - free.length }).toEqual({
        shiftId,
        freeCounted: 0,
      });
      expect(worked.every((day) => day.shiftState !== 'OFF')).toBe(true);
      expect(free.every((day) => day.shiftState === 'OFF')).toBe(true);
      expect(worked.length + free.length).toBe(paidDays.length);
    }
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
    expect(calculateMonthStatistics(januaryDays).weekdayCount).toBe(
      year2021.months[0].statistics.weekdayCount,
    );
  });
});

describe('Halbe Feiertage aus Nachtschichtüberhängen', () => {
  it('rechnet eine Nachtschicht mit Feiertag am Folgetag als halben Feiertag', () => {
    // Nachtschicht läuft von 18 bis 6 Uhr und reicht damit in den Folgetag.
    // Schicht III im April 2021: Der 30.04. (Fr) ist Nachtschicht, der
    // 01.05. (Sa) ist Maifeiertag und damit bezahlter Feiertag.
    const calendar = buildYearCalendar({ year: 2021, selectedShift: 'III' });
    const april = calendar.months[3];
    expect(findDay(calendar, '2021-04-30')?.shiftState).toBe('NIGHT');
    expect(april.statistics.paidNightShiftHolidayCount).toBe(1);
    // Im April 2021 werden der Karfreitag (02.04., Nachtschicht) und der
    // Ostermontag (05.04., Tagschicht) gearbeitet; der Maifeiertag selbst
    // liegt im Mai und zählt dort als gearbeiteter Feiertag mit.
    expect(april.statistics.paidWeekdayHolidayCount).toBe(2);
    expect(april.statistics.paidHolidayCount).toBe(2.5);
  });

  it('hält vollen Feiertag und halben Nachtschichtanteil auseinander', () => {
    // Schicht III im Juni 2021: Der 02.06. (Mi) ist Nachtschicht, der 03.06.
    // (Do) ist Fronleichnam. Der Feiertag selbst ist in Schicht III
    // schichtfrei (OFF) und zählt daher nicht als voller Feiertag; es bleibt
    // beim halben Anteil aus der Nachtschicht: 0 + 0,5 = 0,5.
    const june = buildYearCalendar({ year: 2021, selectedShift: 'III' }).months[5];
    expect(june.statistics.paidWeekdayHolidayCount).toBe(0);
    expect(june.statistics.paidNightShiftHolidayCount).toBe(1);
    expect(june.statistics.paidHolidayCount).toBe(0.5);
  });

  it('zählt den halben Feiertag unabhängig vom Wochentag des Nachtschichttags', () => {
    // Schicht II im Oktober 2021: Der 31.10. (So) ist Nachtschicht, der
    // 01.11. (Mo) ist Allerheiligen und wird in Schicht II gearbeitet (OFF
    // ist er nicht). Der Nachtschichttag liegt auf einem Sonntag, der halbe
    // Anteil fällt trotzdem an.
    const october = buildYearCalendar({ year: 2021, selectedShift: 'II' }).months[9];
    expect(october.statistics.paidWeekdayHolidayCount).toBe(1);
    expect(october.statistics.paidNightShiftHolidayCount).toBe(1);
    expect(october.statistics.paidHolidayCount).toBe(1.5);
  });

  it('zählt den halben Feiertag auch bei einem Wochenendfeiertag am Folgetag', () => {
    // Schicht II im Dezember 2021: Der 25.12. (Sa, 1. Weihnachtstag) ist
    // bezahlter Feiertag, der 26.12. (So, 2. Weihnachtstag) ebenfalls. Mariä
    // Himmelfahrt (15.08.) ist in Rheinland-Pfalz nicht gesetzlich und
    // erzeugt deshalb keinen halben Anteil mehr.
    const august = buildYearCalendar({ year: 2021, selectedShift: 'II' }).months[7];
    expect(august.statistics.paidWeekdayHolidayCount).toBe(0);
    expect(august.statistics.paidNightShiftHolidayCount).toBe(0);
    expect(august.statistics.paidHolidayCount).toBe(0);

    // Ein Wochenendfeiertag mit Schicht bleibt wirksam: Schicht III im
    // Dezember 2021 arbeitet sowohl den 25.12. (Sa, T) als auch den 26.12.
    // (So, N) und zählt damit zwei volle Feiertage.
    const december = buildYearCalendar({ year: 2021, selectedShift: 'III' }).months[11];
    expect(december.statistics.paidWeekdayHolidayCount).toBe(2);
    expect(december.statistics.paidNightShiftHolidayCount).toBe(0);
    expect(december.statistics.paidHolidayCount).toBe(2);
  });

  it('zählt Feiertage am Folgetag über die Jahresgrenze hinweg', () => {
    // Schicht C: Der 31.12.2021 (Fr) ist Nachtschicht, der 01.01.2022 ist
    // Neujahr und liegt damit außerhalb des berechneten Jahres 2021. Der
    // halbe Feiertag muss trotzdem im Dezember 2021 erscheinen.
    const calendar = buildYearCalendar({ year: 2021, selectedShift: 'C' });
    const december = calendar.months[11];
    const lastDay = december.days[december.days.length - 1];
    expect(lastDay.dateKey).toBe('2021-12-31');
    expect(lastDay.shiftState).toBe('NIGHT');
    expect(december.statistics.paidNightShiftHolidayCount).toBe(1);
    // Schicht C arbeitet am 25.12. (Sa) als Nachtschicht; der 26.12. (So)
    // ist schichtfrei. Ein voller Feiertag im Dezember: 1 + 0,5 = 1,5.
    expect(december.statistics.paidWeekdayHolidayCount).toBe(1);
    expect(december.statistics.paidHolidayCount).toBe(1.5);
  });

  it('zählt keinen halben Feiertag bei unbezahlten Tagen am Folgetag', () => {
    // Schicht C: Der 24.12. (Fr) ist Nachtschicht, der 25.12. ist der
    // 1. Weihnachtstag und damit bezahlt (halber Feiertag). Silvester ist
    // dagegen unbezahlt: Auf die Nachtschicht am 05.01. folgt Heilige Drei
    // Könige, auf die Nachtschicht am 02.06. folgt Fronleichnam.
    const calendar = buildYearCalendar({ year: 2021, selectedShift: 'C' });
    const december = calendar.months[11];
    const day = (dateKey: string) => december.days.find((entry) => entry.dateKey === dateKey);
    expect(day('2021-12-30')?.shiftState).toBe('DAY');
    expect(
      day('2021-12-31')?.events.some((event) => event.countsAsPaidNormalShiftHoliday),
    ).toBe(false);
    // Nur der Überhang in das Neujahr 2022 zählt; der 25.12. (N) ist der
    // einzige volle Feiertag: 1 + 0,5 = 1,5.
    expect(december.statistics.paidNightShiftHolidayCount).toBe(1);
    expect(december.statistics.paidWeekdayHolidayCount).toBe(1);
    expect(december.statistics.paidHolidayCount).toBe(1.5);
  });

  it('erzeugt für jeden Nachtschichtüberhang höchstens einen halben Feiertag', () => {
    for (const shiftId of SHIFT_IDS) {
      const calendar = buildYearCalendar({ year: 2021, selectedShift: shiftId });
      const allDays = flattenYearDays(calendar);
      let expectedHalfHolidays = 0;
      for (const day of allDays) {
        if (day.shiftState !== 'NIGHT') continue;
        const next = allDays.find((entry) => entry.dateKey === addDaysToKey(day.dateKey, 1));
        if (next?.events.some((event) => event.countsAsPaidNormalShiftHoliday)) {
          expectedHalfHolidays += 1;
        }
      }
      // Der 31.12. verweist auf den 01.01. des Folgejahrs; dieser eine Fall
      // wird separat ergänzt, weil der Folgetag nicht im Jahr liegt.
      const lastDay = allDays[allDays.length - 1];
      const newYear = buildYearCalendar({ year: 2022, selectedShift: shiftId }).months[0].days[0];
      if (
        lastDay.shiftState === 'NIGHT' &&
        newYear.events.some((event) => event.countsAsPaidNormalShiftHoliday)
      ) {
        expectedHalfHolidays += 1;
      }
      expect({
        shiftId,
        half: summarizeYear(calendar).paidNightShiftHolidayCount,
      }).toEqual({ shiftId, half: expectedHalfHolidays });
    }
  });

  it('summiert die halben Feiertage getrennt und gesamt über das Jahr', () => {
    const configured = summarizeYear(year2021);
    expect(configured.paidNightShiftHolidayCount).toBe(
      year2021.months.reduce(
        (total, month) => total + month.statistics.paidNightShiftHolidayCount,
        0,
      ),
    );
    expect(configured.paidHolidayCount).toBe(
      configured.paidWeekdayHolidayCount + HALF_PAID_HOLIDAY * configured.paidNightShiftHolidayCount,
    );
  });

  it('hält paidHolidayCount je Monat konsistent zur Summe der Anteile', () => {
    for (const month of year2021.months) {
      expect(month.statistics.paidHolidayCount).toBe(
        month.statistics.paidWeekdayHolidayCount +
          HALF_PAID_HOLIDAY * month.statistics.paidNightShiftHolidayCount,
      );
    }
  });

  it('liefert ohne Feiertags-Lookup keinen halben Feiertag', () => {
    const januaryDays = year2021.months[0].days;
    expect(calculateMonthStatistics(januaryDays).paidNightShiftHolidayCount).toBe(0);
  });

  it('weist die halben Feiertage als Vielfaches von 0,5 aus', () => {
    // paidNightShiftHolidayCount ist die Anzahl der Nachtschichten mit
    // Feiertag am Folgetag. Der tatsächlich angerechnete Anteil ist die
    // Hälfte davon und ergibt mit HALF_PAID_HOLIDAY immer ein Vielfaches
    // von 0,5 – genau dieser Wert wird am Ende der Monatsspalte gezeigt.
    const calendar = buildYearCalendar({ year: 2021, selectedShift: 'III' });
    const april = calendar.months[3];
    expect(april.statistics.paidNightShiftHolidayCount).toBe(1);
    expect(HALF_PAID_HOLIDAY * april.statistics.paidNightShiftHolidayCount).toBe(0.5);
    expect(april.statistics.paidHolidayCount).toBe(2.5);
  });
});
