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

/**
 * Monatskennzahlen.
 *
 * weekdayCount: alle Tage Montag bis Freitag des Monats; gesetzliche
 * Feiertage werden nicht herausgerechnet, weil die Schicht unabhängig vom
 * Feiertag läuft und der Feiertag separat ausgewiesen wird.
 */
export function calculateMonthStatistics(days: readonly CalendarDay[]): MonthStatistics {
  let weekdayCount = 0;
  let dayShiftCount = 0;
  let nightShiftCount = 0;
  let paidWeekdayHolidayCount = 0;

  for (const day of days) {
    if (day.isoWeekday <= 5) weekdayCount += 1;
    if (day.shiftState === 'DAY') dayShiftCount += 1;
    if (day.shiftState === 'NIGHT') nightShiftCount += 1;
    if (day.isoWeekday <= 5 && day.events.some((event) => event.countsAsPaidNormalShiftHoliday)) {
      paidWeekdayHolidayCount += 1;
    }
  }

  return {
    weekdayCount,
    dayShiftCount,
    nightShiftCount,
    requiredShiftCount: dayShiftCount + nightShiftCount,
    paidWeekdayHolidayCount,
  };
}

/** Berechnet einen Monat des Jahres. */
export function buildMonthCalendar(
  year: number,
  month: number,
  shiftId: ShiftId,
  eventsByDateKey: Map<string, CalendarEvent[]>,
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
    statistics: calculateMonthStatistics(days),
  };
}

/** Berechnet ein vollständiges Kalenderjahr. */
export function buildYearCalendar(configuration: CalendarConfiguration): YearCalendar {
  const { year, selectedShift } = configuration;
  assertValidYear(year);
  // Wirft bei unbekannter Schichtkennung, bevor irgendetwas berechnet wird.
  getShiftDefinition(selectedShift);

  const eventsByDateKey = groupEventsByDateKey(generateCalendarEvents(year));
  const months: MonthCalendar[] = [];
  for (let month = 1; month <= 12; month += 1) {
    months.push(buildMonthCalendar(year, month, selectedShift, eventsByDateKey));
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
    }),
    {
      weekdayCount: 0,
      dayShiftCount: 0,
      nightShiftCount: 0,
      requiredShiftCount: 0,
      paidWeekdayHolidayCount: 0,
    },
  );
}
