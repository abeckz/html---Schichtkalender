/**
 * EventEngine.
 *
 * Erzeugt alle Kalenderereignisse eines Jahres:
 *
 *  - feste Termine (Monat/Tag)
 *  - Osterfestkreis (berechnet aus dem gregorianischen Ostersonntag)
 *  - Sommerzeitbeginn/-ende (letzter Sonntag im März/Oktober)
 *  - Erntedank (erster Sonntag im Oktober)
 *  - Adventssonntage (deterministisch aus Weihnachten)
 *  - Volkstrauertag, Totensonntag, Buß- und Bettag
 *
 * Mehrfachbelegungen bleiben vollständig erhalten.
 */

import type { CalendarDay, CalendarEvent } from '../domain/types';
import {
  easterRelativeEvents,
  fixedEvents,
  type FixedEventDefinition,
} from '../config/eventDefinitions';
import {
  addDaysToKey,
  dayIndexToDateKey,
  firstWeekdayOfMonth,
  getIsoWeekday,
  lastWeekdayOfMonth,
  toDateKey,
} from '../utils/dateUtils';
import { dayIndex } from '../utils/dayIndex';

/** Ostersonntag im gregorianischen Kalender (Meeus/Jones/Butcher). */
export function calculateEasterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return toDateKey(year, month, day);
}

/**
 * 4. Advent: der letzte Sonntag vor Heiligabend (24.12.).
 * Ist der 24.12. selbst ein Sonntag, wird dieser nicht mitgezählt.
 */
export function getFourthAdvent(year: number): string {
  const christmasEveIndex = dayIndex(year, 12, 24);
  const offset = getIsoWeekday(year, 12, 24) % 7;
  return dayIndexToDateKey(christmasEveIndex - offset);
}

/** 1. Advent (für abhängige Gedenktage). */
export function getFirstAdvent(year: number): string {
  return addDaysToKey(getFourthAdvent(year), -21);
}


function createEvent(
  id: string,
  name: string,
  dateKey: string,
  countsAsPaidNormalShiftHoliday: boolean,
  isPublicHoliday: boolean,
  priority: number,
): CalendarEvent {
  return {
    id: `${id}@${dateKey}`,
    name,
    dateKey,
    countsAsPaidNormalShiftHoliday,
    isPublicHoliday,
    priority,
  };
}

function fixedEventToCalendarEvent(
  definition: FixedEventDefinition,
  year: number,
): CalendarEvent {
  return createEvent(
    definition.id,
    definition.name,
    toDateKey(year, definition.month, definition.day),
    definition.countsAsPaidNormalShiftHoliday,
    definition.isPublicHoliday,
    definition.priority,
  );
}

/**
 * Erzeugt alle Ereignisse eines Jahres, sortiert nach Datum und Priorität.
 */
export function generateCalendarEvents(year: number): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  // Feste Termine
  for (const definition of fixedEvents) {
    events.push(fixedEventToCalendarEvent(definition, year));
  }

  // Osterfestkreis
  const easter = calculateEasterSunday(year);
  for (const definition of easterRelativeEvents) {
    events.push(
      createEvent(
        definition.id,
        definition.name,
        addDaysToKey(easter, definition.offset),
        definition.countsAsPaidNormalShiftHoliday,
        definition.isPublicHoliday,
        definition.priority,
      ),
    );
  }

  // Sommerzeit
  events.push(
    createEvent(
      'dst-start',
      'Beginn Sommerzeit',
      lastWeekdayOfMonth(year, 3, 7),
      false,
      false,
      50,
    ),
  );
  events.push(
    createEvent('dst-end', 'Ende Sommerzeit', lastWeekdayOfMonth(year, 10, 7), false, false, 50),
  );

  // Erntedank: erster Sonntag im Oktober
  events.push(
    createEvent('harvest-festival', 'Erntedank', firstWeekdayOfMonth(year, 10, 7), false, false, 40),
  );

  // Advent (1. bis 4.), deterministisch aus Weihnachten
  const fourthAdvent = getFourthAdvent(year);
  const adventNames: Array<[number, string]> = [
    [0, '4. Advent'],
    [-7, '3. Advent'],
    [-14, '2. Advent'],
    [-21, '1. Advent'],
  ];
  for (const [offset, name] of adventNames) {
    events.push(
      createEvent(`advent-${name.charAt(0)}`, name, addDaysToKey(fourthAdvent, offset), false, false, 30),
    );
  }

  // Gedenktage (Bezug laut Spezifikation: 1. bzw. 4. Advent)
  const firstAdvent = getFirstAdvent(year);
  events.push(
    createEvent('mourning-day', 'Volkstrauertag', addDaysToKey(fourthAdvent, -35), false, false, 40),
  );
  events.push(
    createEvent('sunday-of-the-dead', 'Totensonntag', addDaysToKey(firstAdvent, -7), false, false, 40),
  );
  events.push(
    createEvent('repentance-day', 'Buß- und Bettag', addDaysToKey(firstAdvent, -11), false, false, 40),
  );

  return sortEvents(events);
}

/** Sortiert nach Datum, dann Priorität, dann Name. */
export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
  return [...events].sort((left, right) => {
    if (left.dateKey !== right.dateKey) return left.dateKey < right.dateKey ? -1 : 1;
    if (left.priority !== right.priority) return left.priority - right.priority;
    return left.name.localeCompare(right.name, 'de');
  });
}

/**
 * Gruppiert Ereignisse nach dateKey. Die Reihenfolge innerhalb eines Tages
 * bleibt erhalten (Priorität, dann Name).
 */
export function groupEventsByDateKey(events: readonly CalendarEvent[]): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const bucket = map.get(event.dateKey);
    if (bucket) {
      bucket.push(event);
    } else {
      map.set(event.dateKey, [event]);
    }
  }
  return map;
}

/** Liefert alle Ereignisse eines Tages. */
export function getEventsForDate(
  eventsByKey: Map<string, CalendarEvent[]>,
  dateKey: string,
): CalendarEvent[] {
  return eventsByKey.get(dateKey) ?? [];
}

/**
 * Prüft, ob an einem Tag mindestens ein gesetzlicher Feiertag liegt.
 *
 * Grundlage für die "F"-Markierung in der KW-Spalte. Mehrfachbelegungen
 * (z. B. Ostersonntag und Sommerzeitbeginn) werden korrekt behandelt.
 */
export function hasPublicHoliday(day: CalendarDay): boolean {
  return day.events.some((event) => event.isPublicHoliday);
}
