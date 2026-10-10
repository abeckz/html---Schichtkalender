/**
 * Tests für die Druckaufbereitung (PrintMonth).
 *
 * Die Tests prüfen ausschließlich die reine Aufbereitungslogik ohne DOM:
 * Informationstext und Rasterhöhe. Damit ist abgesichert, dass die
 * Druckansicht exakt 31 Zeilen pro Monat besitzt und Termine sowie
 * Beschriftungen gemeinsam ("·"-getrennt) dargestellt werden.
 */

import { describe, expect, it } from 'vitest';
import { buildYearCalendar } from '../engines/calendarBuilder';
import { hasPublicHoliday } from '../engines/eventEngine';
import {
  PRINT_ROWS,
  PUBLIC_HOLIDAY_MARK,
  buildPrintInformation,
} from '../print/PrintMonth';
import { getPrintEventName } from '../config/eventDefinitions';

/** Monat eines berechneten Jahres (Index 0 = Januar). */
function monthOf(year: number, month: number) {
  const calendar = buildYearCalendar({ year, selectedShift: 'C' });
  return calendar.months[month - 1];
}

/** Einzelner Tag eines berechneten Jahres. */
function dayOf(year: number, dateKey: string) {
  const month = Number(dateKey.slice(5, 7));
  const day = monthOf(year, month).days.find((entry) => entry.dateKey === dateKey);
  if (!day) throw new Error(`Tag ${dateKey} nicht gefunden.`);
  return day;
}

describe('PRINT_ROWS', () => {
  it('verwendet ein festes 31-Zeilen-Raster', () => {
    expect(PRINT_ROWS).toBe(31);
  });

  it('deckt jeden Monat des Jahres 2021 vollständig ab', () => {
    for (let month = 1; month <= 12; month += 1) {
      const days = monthOf(2021, month).days;
      expect(days.length).toBeLessThanOrEqual(PRINT_ROWS);
      expect(days.length).toBeGreaterThanOrEqual(28);
    }
  });

  it('füllt den Februar 2021 mit 28 Tagen auf 31 Positionen auf', () => {
    expect(monthOf(2021, 2).days.length).toBe(28);
    expect(PRINT_ROWS - monthOf(2021, 2).days.length).toBe(3);
  });
});

describe('buildPrintInformation', () => {
  it('schreibt den Feiertagsnamen an einem reinen gesetzlichen Feiertag aus', () => {
    const day = monthOf(2021, 1).days[0]; // 01.01.2021 = Neujahr
    // "F" gehört ausschließlich in die KW-Spalte; die Textspalte nennt den
    // Feiertag ausgeschrieben.
    expect(buildPrintInformation(day, '')).toBe('Neujahr');
    expect(buildPrintInformation(day, '')).not.toContain('F');
  });

  it('verbindet mehrere Ereignisse mit "·"', () => {
    // 03.10.2021 trägt den gesetzlichen Feiertag "Tag der Deutschen Einheit"
    // und den Erntedank.
    const day = monthOf(2021, 10).days.find((entry) => entry.day === 3);
    expect(day).toBeDefined();
    if (!day) return;

    expect(buildPrintInformation(day, '')).toBe('Tag der Deutschen Einheit · Erntedank');
  });

  it('blendet Termin- und Feiertagsnamen aus, sobald ein Kommentar vorliegt', () => {
    // 03.10.2021: gesetzlicher Feiertag (F) und Erntedank. Sobald ein
    // Kommentar eingetragen ist, steht in der Zeile ausschließlich der
    // Kommentar; der Feiertag bleibt über das rosa Kästchen erkennbar.
    const holiday = monthOf(2021, 10).days.find((entry) => entry.day === 3);
    expect(holiday).toBeDefined();
    if (!holiday) return;
    expect(buildPrintInformation(holiday, 'Urlaub')).toBe('Urlaub');

    // Reiner Brauchtumstag (24.12.): ohne Kommentar der Terminname, mit
    // Kommentar nur der Kommentar.
    const eve = monthOf(2021, 12).days.find((entry) => entry.day === 24);
    expect(eve).toBeDefined();
    if (!eve) return;
    expect(buildPrintInformation(eve, '')).toBe('Heiligabend');
    expect(buildPrintInformation(eve, 'Familie')).toBe('Familie');
  });

  it('liefert einen leeren Text an ereignis- und beschriftungsfreien Tagen', () => {
    const day = monthOf(2021, 2).days.find((entry) => entry.day === 2);
    expect(day).toBeDefined();
    if (!day) return;
    expect(day.events.length).toBe(0);
    expect(buildPrintInformation(day, '')).toBe('');
  });

  it('verwendet immer den vollständigen Namen für gesetzliche Feiertage', () => {
    // Der Feiertagsname steht ausgeschrieben in der Textspalte; die
    // Markierung "F" gehört ausschließlich in die KW-Spalte.
    expect(getPrintEventName('Neujahr')).toBe('Neujahr');
    expect(getPrintEventName('1. Weihnachtstag')).toBe('1. Weihnachtstag');
    expect(getPrintEventName('Tag der Deutschen Einheit')).toBe('Tag der Deutschen Einheit');
    expect(getPrintEventName('Christi Himmelfahrt')).toBe('Christi Himmelfahrt');
  });

  it('kürzt weiterhin die nicht mit "F" markierten Aktionstage', () => {
    expect(getPrintEventName('Beginn Sommerzeit')).toBe('Sommerzeit');
    expect(getPrintEventName('Ende Sommerzeit')).toBe('Sommerzeit');
    expect(getPrintEventName('Buß- und Bettag')).toBe('Buß-/Bettag');
  });
});

describe('Kennzeichnung gesetzlicher Feiertage (Rheinland-Pfalz)', () => {
  it('markiert Neujahr 2021, Ostermontag 2021 und den 1. Weihnachtstag 2021', () => {
    expect(hasPublicHoliday(dayOf(2021, '2021-01-01'))).toBe(true);
    expect(hasPublicHoliday(dayOf(2021, '2021-04-05'))).toBe(true);
    expect(hasPublicHoliday(dayOf(2021, '2021-12-25'))).toBe(true);
  });

  it('markiert reine Brauchtumstage nicht', () => {
    // Reformationstag, Heiligabend und Silvester sind keine gesetzlichen
    // Feiertage im Bezugsraum und dürfen kein "F" erhalten.
    expect(hasPublicHoliday(dayOf(2021, '2021-10-31'))).toBe(false);
    expect(hasPublicHoliday(dayOf(2021, '2021-12-24'))).toBe(false);
    expect(hasPublicHoliday(dayOf(2021, '2021-12-31'))).toBe(false);
  });

  it('markiert die nur in anderen Bundesländern geltenden Feiertage nicht', () => {
    // Heilige Drei Könige (06.01.) und Mariä Himmelfahrt (15.08.) sind in
    // Rheinland-Pfalz keine gesetzlichen Feiertage.
    expect(hasPublicHoliday(dayOf(2021, '2021-01-06'))).toBe(false);
    expect(hasPublicHoliday(dayOf(2021, '2021-08-15'))).toBe(false);
  });

  it('markiert die Feiertage an Ostersonntag und Pfingstsonntag nicht', () => {
    // Beide Tage sind in Rheinland-Pfalz keine zusätzlich markierten
    // gesetzlichen Feiertage; sie sind ohnehin immer Sonntage.
    expect(hasPublicHoliday(dayOf(2021, '2021-04-04'))).toBe(false);
    expect(hasPublicHoliday(dayOf(2021, '2021-05-23'))).toBe(false);
  });

  it('markiert einen unbedeutenden Werktag nicht', () => {
    expect(hasPublicHoliday(dayOf(2021, '2021-02-02'))).toBe(false);
  });

  it('verwendet "F" als Markierungszeichen', () => {
    expect(PUBLIC_HOLIDAY_MARK).toBe('F');
  });
});

