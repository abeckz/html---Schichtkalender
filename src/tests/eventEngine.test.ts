import { describe, expect, it } from 'vitest';
import {
  calculateEasterSunday,
  generateCalendarEvents,
  getEventsForDate,
  groupEventsByDateKey,
} from '../engines/eventEngine';
import type { CalendarEvent } from '../domain/types';

/** Alle Namen der Ereignisse eines Tages. */
function namesOn(events: CalendarEvent[], dateKey: string): string[] {
  return events.filter((event) => event.dateKey === dateKey).map((event) => event.name);
}

describe('Osterberechnung (gregorianisch)', () => {
  it('liefert die bekannten Ostersonntage', () => {
    expect(calculateEasterSunday(2021)).toBe('2021-04-04');
    expect(calculateEasterSunday(2022)).toBe('2022-04-17');
    expect(calculateEasterSunday(2023)).toBe('2023-04-09');
    expect(calculateEasterSunday(2024)).toBe('2024-03-31');
    expect(calculateEasterSunday(2025)).toBe('2025-04-20');
    expect(calculateEasterSunday(2026)).toBe('2026-04-05');
    expect(calculateEasterSunday(2027)).toBe('2027-03-28');
    expect(calculateEasterSunday(2030)).toBe('2030-04-21');
  });

  it('liefert immer einen Sonntag zwischen 22.03. und 25.04.', () => {
    for (let year = 1990; year <= 2100; year += 1) {
      const easter = calculateEasterSunday(year);
      const [, month, day] = easter.split('-').map(Number);
      const isInRange =
        (month === 3 && day >= 22) || (month === 4 && day <= 25);
      expect({ year, isInRange }).toEqual({ year, isInRange: true });
      expect(new Date(`${easter}T00:00:00Z`).getUTCDay()).toBe(0);
    }
  });
});

describe('Verbindliche Ereignisse 2021', () => {
  const events = generateCalendarEvents(2021);

  const references: Array<[string, string[]]> = [
    ['2021-01-01', ['Neujahr']],
    ['2021-01-06', ['Heilige Drei Könige']],
    ['2021-02-16', ['Fastnacht']],
    ['2021-03-27', ['Beginn Sommerzeit']],
    ['2021-04-02', ['Karfreitag']],
    ['2021-04-04', ['Ostersonntag']],
    ['2021-04-05', ['Ostermontag']],
    ['2021-05-01', ['Maifeiertag']],
    ['2021-05-13', ['Christi Himmelfahrt']],
    ['2021-05-23', ['Pfingstsonntag']],
    ['2021-05-24', ['Pfingstmontag']],
    ['2021-06-03', ['Fronleichnam']],
    ['2021-08-15', ['Mariä Himmelfahrt']],
    ['2021-10-03', ['Tag der Deutschen Einheit', 'Erntedank']],
    ['2021-10-31', ['Ende Sommerzeit', 'Reformationstag']],
    ['2021-11-01', ['Allerheiligen']],
    ['2021-11-14', ['Volkstrauertag']],
    ['2021-11-17', ['Buß- und Bettag']],
    ['2021-11-21', ['Totensonntag']],
    ['2021-11-28', ['1. Advent']],
    ['2021-12-05', ['2. Advent']],
    ['2021-12-12', ['3. Advent']],
    ['2021-12-19', ['4. Advent']],
    ['2021-12-24', ['Heiligabend']],
    ['2021-12-25', ['1. Weihnachtstag']],
    ['2021-12-26', ['2. Weihnachtstag']],
    ['2021-12-31', ['Silvester']],
  ];

  it.each(references)('%s enthält die erwarteten Ereignisse', (dateKey, expectedNames) => {
    const actual = namesOn(events, dateKey);
    for (const name of expectedNames) {
      expect(actual).toContain(name);
    }
  });

  it('belegt den 03.10.2021 und den 31.10.2021 mehrfach', () => {
    expect(namesOn(events, '2021-10-03')).toHaveLength(2);
    expect(namesOn(events, '2021-10-31')).toHaveLength(2);
  });

  it('erzeugt keine Ereignisse an Tagen ohne Termin', () => {
    expect(namesOn(events, '2021-07-16')).toEqual([]);
    expect(namesOn(events, '2021-09-09')).toEqual([]);
  });

  it('sortiert jedes Tages-Ereignis nach Priorität', () => {
    for (const [, dayEvents] of groupEventsByDateKey(events)) {
      const priorities = dayEvents.map((event) => event.priority);
      expect(priorities).toEqual([...priorities].sort((a, b) => a - b));
    }
  });

  it('liefert Ereignisse über groupEventsByDateKey wieder auffindbar', () => {
    const byKey = groupEventsByDateKey(events);
    expect(getEventsForDate(byKey, '2021-12-24').map((event) => event.name)).toEqual([
      'Heiligabend',
    ]);
    expect(getEventsForDate(byKey, '2021-01-02')).toEqual([]);
  });
});



describe('Bezahlte Feiertage', () => {
  const events = generateCalendarEvents(2021);

  it('markiert genau die bezahlten Feiertage', () => {
    // Bezugsraum ist Rheinland-Pfalz: Nur die dort gesetzlichen Feiertage
    // sind bezahlte Feiertage. Heilige Drei Könige und Mariä Himmelfahrt
    // sind dort nicht gesetzlich und werden deshalb nicht gezählt.
    const paid = events
      .filter((event) => event.countsAsPaidNormalShiftHoliday)
      .map((event) => event.name)
      .sort();
    expect(paid).toEqual(
      [
        '1. Weihnachtstag',
        '2. Weihnachtstag',
        'Allerheiligen',
        'Christi Himmelfahrt',
        'Fronleichnam',
        'Karfreitag',
        'Maifeiertag',
        'Neujahr',
        'Ostermontag',
        'Pfingstmontag',
        'Tag der Deutschen Einheit',
      ].sort(),
    );
  });

  it('zählt im Jahr 2021 genau 11 bezahlte Feiertage', () => {
    expect(events.filter((event) => event.countsAsPaidNormalShiftHoliday)).toHaveLength(11);
  });

  it('stuft Sommerzeit, Erntedank, Advent und Gedenktage als unbezahlt ein', () => {
    const unpaid = [
      'Beginn Sommerzeit',
      'Ende Sommerzeit',
      'Erntedank',
      '1. Advent',
      '2. Advent',
      '3. Advent',
      '4. Advent',
      'Volkstrauertag',
      'Totensonntag',
      'Buß- und Bettag',
      'Heiligabend',
      'Silvester',
      'Ostersonntag',
      'Pfingstsonntag',
      'Fastnacht',
      'Reformationstag',
    ];
    for (const name of unpaid) {
      const matching = events.filter((event) => event.name === name);
      expect({ name, exists: matching.length > 0 }).toEqual({ name, exists: true });
      for (const event of matching) {
        expect({ name, paid: event.countsAsPaidNormalShiftHoliday }).toEqual({
          name,
          paid: false,
        });
      }
    }
  });
});

describe('Ereignisse über mehrere Jahre', () => {
  it('erzeugt für 2027 und 2028 konsistente Ergebnisse', () => {
    const y2027 = generateCalendarEvents(2027);
    expect(namesOn(y2027, '2027-01-01')).toEqual(['Neujahr']);
    expect(namesOn(y2027, '2027-03-27')).toEqual(['Beginn Sommerzeit']);
    expect(namesOn(y2027, '2027-03-28')).toEqual(['Ostersonntag']);
    expect(namesOn(y2027, '2027-10-31')).toContain('Reformationstag');
    expect(namesOn(y2027, '2027-12-25')).toEqual(['1. Weihnachtstag']);

    const y2028 = generateCalendarEvents(2028);
    // 2028 ist ein Schaltjahr; der 29.02. ist zufällig der Fastnachtsdienstag.
    expect(namesOn(y2028, '2028-02-29')).toEqual(['Fastnacht']);
    expect(namesOn(y2028, '2028-02-28')).toEqual([]);
    expect(namesOn(y2028, '2028-01-01')).toEqual(['Neujahr']);
  });

  it('erzeugt an Advent-Sonntagen immer Sonntage', () => {
    for (let year = 2015; year <= 2040; year += 1) {
      const events = generateCalendarEvents(year);
      for (const name of ['1. Advent', '2. Advent', '3. Advent', '4. Advent']) {
        const event = events.find((candidate) => candidate.name === name);
        expect(event).toBeDefined();
        const weekday = new Date(`${event!.dateKey}T00:00:00Z`).getUTCDay();
        expect({ year, name, weekday }).toEqual({ year, name, weekday: 0 });
      }
    }
  });
});

describe('Gesetzliche Feiertage in Rheinland-Pfalz (Markierung "F!")', () => {
  const events = generateCalendarEvents(2021);

  /** Namen aller gesetzlich markierten Ereignisse eines Jahres. */
  function publicHolidayNames(year: number): string[] {
    return generateCalendarEvents(year)
      .filter((event) => event.isPublicHoliday)
      .map((event) => event.name)
      .sort();
  }

  it('markiert 2021 genau die gesetzlichen Feiertage von Rheinland-Pfalz', () => {
    expect(publicHolidayNames(2021)).toEqual(
      [
        '1. Weihnachtstag',
        '2. Weihnachtstag',
        'Allerheiligen',
        'Christi Himmelfahrt',
        'Fronleichnam',
        'Karfreitag',
        'Maifeiertag',
        'Neujahr',
        'Ostermontag',
        'Pfingstmontag',
        'Tag der Deutschen Einheit',
      ].sort(),
    );
    expect(publicHolidayNames(2021)).toHaveLength(11);
  });

  it('markiert Heilige Drei Könige, Mariä Himmelfahrt und Ostersonntag/Pfingstsonntag nicht', () => {
    // Heilige Drei Könige (06.01.) und Mariä Himmelfahrt (15.08.) sind
    // ausschließlich in anderen Bundesländern gesetzliche Feiertage, in
    // Rheinland-Pfalz dagegen nicht. Ostersonntag und Pfingstsonntag
    // fallen ohnehin immer auf einen Sonntag.
    for (const name of [
      'Heilige Drei Könige',
      'Mariä Himmelfahrt',
      'Ostersonntag',
      'Pfingstsonntag',
    ]) {
      const matching = events.filter((event) => event.name === name);
      expect({ name, exists: matching.length > 0 }).toEqual({ name, exists: true });
      for (const event of matching) {
        expect({ name, isPublicHoliday: event.isPublicHoliday }).toEqual({
          name,
          isPublicHoliday: false,
        });
      }
    }
  });

  it('kennzeichnet Brauchtumstage und Aktionstage nicht als gesetzlichen Feiertag', () => {
    const notPublic = [
      'Reformationstag',
      'Heiligabend',
      'Silvester',
      'Fastnacht',
      'Beginn Sommerzeit',
      'Ende Sommerzeit',
      'Erntedank',
      '1. Advent',
      '2. Advent',
      '3. Advent',
      '4. Advent',
      'Volkstrauertag',
      'Totensonntag',
      'Buß- und Bettag',
    ];
    for (const name of notPublic) {
      const matching = events.filter((event) => event.name === name);
      expect({ name, exists: matching.length > 0 }).toEqual({ name, exists: true });
      for (const event of matching) {
        expect({ name, isPublicHoliday: event.isPublicHoliday }).toEqual({
          name,
          isPublicHoliday: false,
        });
      }
    }
  });

  it('führt nicht gesetzliche Feiertage nicht als bezahlte Feiertage', () => {
    // Heilige Drei Könige und Mariä Himmelfahrt sind in Rheinland-Pfalz
    // nicht gesetzlich. Sie bleiben als Termin sichtbar, sind aber keine
    // bezahlten Feiertage der Schichtplanung.
    for (const name of ['Heilige Drei Könige', 'Mariä Himmelfahrt']) {
      const matching = events.filter((event) => event.name === name);
      expect({ name, exists: matching.length > 0 }).toEqual({ name, exists: true });
      for (const event of matching) {
        expect({ name, paid: event.countsAsPaidNormalShiftHoliday }).toEqual({
          name,
          paid: false,
        });
        expect({ name, isPublicHoliday: event.isPublicHoliday }).toEqual({
          name,
          isPublicHoliday: false,
        });
      }
    }
  });
});
