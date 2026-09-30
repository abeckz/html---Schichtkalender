/**
 * CalendarBuilder.
 *
 * Setzt aus ShiftEngine und EventEngine einen vollständigen Jahreskalender
 * zusammen. Es wird kein Zustand gehalten und nichts gespeichert: identische
 * Eingaben erzeugen immer identische Ausgaben.
 */

import type {
  CalendarConfiguration,
  CalendarDay,
  CalendarEvent,
  MonthCalendar,
  MonthStatistics,
  ShiftId,
  YearCalendar,
} from '../domain/types';
import { getShiftDefinition } from '../config/shiftDefinitions';
import {
  MONTH_NAMES,
  MONTH_SHORT_NAMES,
  addDaysToKey,
  assertValidYear,
  getIsoWeek,
  getIsoWeekday,
  getWeekdayShort,
  getDaysInMonth,
  toDateKey,
} from '../utils/dateUtils';
import { getShiftLabel, getShiftState } from './shiftEngine';
import { generateCalendarEvents, groupEventsByDateKey } from './eventEngine';

/** Berechnet einen einzelnen Kalendertag. */
export function buildCalendarDay(
  year: number,
  month: number,
  day: number,
  shiftId: ShiftId,
  events: readonly CalendarEvent[],
): CalendarDay {
  const isoWeekday = getIsoWeekday(year, month, day);
  const dateKey = toDateKey(year, month, day);
  return {
    dateKey,
    year,
    month,
    day,
    isoWeekday,
    weekdayShort: getWeekdayShort(isoWeekday),
    isoWeek: getIsoWeek(year, month, day),
    shiftState: getShiftState(year, month, day, shiftId),
    shiftLabel: getShiftLabel(year, month, day, shiftId),
    events: [...events],
    isWeekend: isoWeekday >= 6,
    isSunday: isoWeekday === 7,
  };
}

/** Ein halber Feiertag aus einer Nachtschicht mit Feiertag am Folgetag. */
export const HALF_PAID_HOLIDAY = 0.5;

/**
 * Monatskennzahlen.
 *
 * weekdayCount: alle Tage Montag bis Freitag des Monats; gesetzliche
 * Feiertage werden nicht herausgerechnet, weil die Schicht unabhängig vom
 * Feiertag läuft und der Feiertag separat ausgewiesen wird.
 *
 * paidNightShiftHolidayCount: Die Nachtschicht läuft von 18 bis 6 Uhr und
 * reicht damit in den Folgetag hinein. Liegt am Folgetag ein bezahlter
 * Feiertag, wird die Nachtschicht zur Hälfte auf den Feiertag angerechnet
 * (halber Feiertag). Dafür muss der Feiertag des Folgetags auch außerhalb
 * des übergebenen Monats liegen können; deshalb wird über
 * isPaidHolidayForDateKey nachgeschlagen und der Folgetag über den
 * Kalendertagesschlüssel gebildet. So funktioniert die Regel auch über die
 * Monats- und Jahresgrenze hinweg (z. B. 31.12. -> 01.01.).
 */
export function calculateMonthStatistics(
  days: readonly CalendarDay[],
  isPaidHolidayForDateKey: (dateKey: string) => boolean = () => false,
): MonthStatistics {
  let weekdayCount = 0;
  let dayShiftCount = 0;
  let nightShiftCount = 0;
  let paidWeekdayHolidayCount = 0;
  let paidNightShiftHolidayCount = 0;

  for (const day of days) {
    if (day.isoWeekday <= 5) weekdayCount += 1;
    if (day.shiftState === 'DAY') dayShiftCount += 1;
    if (day.shiftState === 'NIGHT') nightShiftCount += 1;

    // Voller Werktagsfeiertag: der Feiertag liegt am Werktag selbst.
    if (
      day.isoWeekday <= 5 &&
      day.events.some((event) => event.countsAsPaidNormalShiftHoliday)
    ) {
      paidWeekdayHolidayCount += 1;
    }

    // Nachtschichtüberhang: Feiertag am Folgetag -> halber Feiertag.
    // Die Prüfung ist unabhängig davon, ob der Nachtschichttag selbst ein
    // Feiertag ist, und unabhängig vom Wochentag des Folgetags.
    if (day.shiftState === 'NIGHT' && isPaidHolidayForDateKey(addDaysToKey(day.dateKey, 1))) {
      paidNightShiftHolidayCount += 1;
    }
  }

  return {
    weekdayCount,
    dayShiftCount,
    nightShiftCount,
    requiredShiftCount: dayShiftCount + nightShiftCount,
    paidWeekdayHolidayCount,
    paidNightShiftHolidayCount,
    paidHolidayCount: paidWeekdayHolidayCount + HALF_PAID_HOLIDAY * paidNightShiftHolidayCount,
  };
}

/**
 * Berechnet einen Monat des Jahres.
 *
 * isPaidHolidayForDateKey liefert die bezahlten Feiertage für die
 * Nachtschichtüberhänge und kann auf Tage außerhalb des Monats verweisen
 * (Monats- bzw. Jahresgrenze). Ohne Angabe fällt kein halber Feiertag an.
 */
export function buildMonthCalendar(
  year: number,
  month: number,
  shiftId: ShiftId,
  eventsByDateKey: Map<string, CalendarEvent[]>,
  isPaidHolidayForDateKey: (dateKey: string) => boolean = () => false,
): MonthCalendar {
  const days: CalendarDay[] = [];
  const dayCount = getDaysInMonth(year, month);
  for (let day = 1; day <= dayCount; day += 1) {
    const dateKey = toDateKey(year, month, day);
    days.push(
      buildCalendarDay(year, month, day, shiftId, eventsByDateKey.get(dateKey) ?? []),
    );
  }

  return {
    year,
    month,
    name: MONTH_NAMES[month - 1],
    shortName: MONTH_SHORT_NAMES[month - 1],
    days,
    statistics: calculateMonthStatistics(days, isPaidHolidayForDateKey),
  };
}

/** Berechnet ein vollständiges Kalenderjahr. */
export function buildYearCalendar(configuration: CalendarConfiguration): YearCalendar {
  const { year, selectedShift } = configuration;
  assertValidYear(year);
  // Wirft bei unbekannter Schichtkennung, bevor irgendetwas berechnet wird.
  getShiftDefinition(selectedShift);

  const eventsByDateKey = groupEventsByDateKey(generateCalendarEvents(year));

  // Der Nachtschichtüberhang des 31.12. kann auf einen Feiertag des Folgejahrs
  // (01.01. = Neujahr) verweisen. Dafür werden die Ereignisse des Folgejahrs
  // zusätzlich indiziert, ohne in die Tageslisten des berechneten Jahres
  // einzugehen.
  const eventsOfNextYear = groupEventsByDateKey(generateCalendarEvents(year + 1));
  const paidHolidayDateKeys = new Set<string>();
  for (const [dateKey, events] of eventsByDateKey) {
    if (events.some((event) => event.countsAsPaidNormalShiftHoliday)) {
      paidHolidayDateKeys.add(dateKey);
    }
  }
  for (const [dateKey, events] of eventsOfNextYear) {
    if (events.some((event) => event.countsAsPaidNormalShiftHoliday)) {
      paidHolidayDateKeys.add(dateKey);
    }
  }

  const months: MonthCalendar[] = [];
  for (let month = 1; month <= 12; month += 1) {
    months.push(
      buildMonthCalendar(year, month, selectedShift, eventsByDateKey, (dateKey) =>
        paidHolidayDateKeys.has(dateKey),
      ),
    );
  }

  return { year, selectedShift, months };
}

/** Alle Tage eines Jahres in Kalenderreihenfolge. */
export function flattenYearDays(calendar: YearCalendar): CalendarDay[] {
  return calendar.months.flatMap((month) => month.days);
}

/** Sucht einen einzelnen Tag innerhalb eines berechneten Jahres. */
export function findDay(calendar: YearCalendar, dateKey: string): CalendarDay | undefined {
  return flattenYearDays(calendar).find((day) => day.dateKey === dateKey);
}

/** Summierte Jahreskennzahlen. */
export function summarizeYear(calendar: YearCalendar): MonthStatistics {
  return calendar.months.reduce<MonthStatistics>(
    (total, month) => ({
      weekdayCount: total.weekdayCount + month.statistics.weekdayCount,
      dayShiftCount: total.dayShiftCount + month.statistics.dayShiftCount,
      nightShiftCount: total.nightShiftCount + month.statistics.nightShiftCount,
      requiredShiftCount: total.requiredShiftCount + month.statistics.requiredShiftCount,
      paidWeekdayHolidayCount:
        total.paidWeekdayHolidayCount + month.statistics.paidWeekdayHolidayCount,
      paidNightShiftHolidayCount:
        total.paidNightShiftHolidayCount + month.statistics.paidNightShiftHolidayCount,
      paidHolidayCount: total.paidHolidayCount + month.statistics.paidHolidayCount,
    }),
    {
      weekdayCount: 0,
      dayShiftCount: 0,
      nightShiftCount: 0,
      requiredShiftCount: 0,
      paidWeekdayHolidayCount: 0,
      paidNightShiftHolidayCount: 0,
      paidHolidayCount: 0,
    },
  );
}
