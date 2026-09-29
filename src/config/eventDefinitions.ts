/**
 * Zentrale Ereignisdefinitionen.
 *
 * Feste Termine werden über Monat/Tag definiert. Bewegliche Termine
 * werden in der EventEngine relativ zum Ostersonntag bzw. zu Weihnachten
 * beziehungsweise über generische Wochentagshelfer berechnet.
 */

/** Definition eines festen Kalendertermins. */
export interface FixedEventDefinition {
  id: string;
  name: string;
  month: number;
  day: number;
  countsAsPaidNormalShiftHoliday: boolean;
  /** Gesetzlicher Feiertag: wird in der KW-Spalte als rosa "F!" angezeigt. */
  isPublicHoliday: boolean;
  priority: number;
}

/**
 * Prioritäten: kleinere Zahl = wichtigere Anzeige.
 * Die Reihenfolge im Datenmodell bleibt unverändert; die Priorität dient
 * nur der Anzeige-Reihenfolge.
 *
 * Rheinland-Pfalz gilt als Bezugsraum:
 * gesetzliche Feiertage sind Neujahr, Karfreitag, Ostermontag, Maifeiertag,
 * Christi Himmelfahrt, Pfingstmontag, Fronleichnam, Tag der Deutschen
 * Einheit, Allerheiligen sowie 1. und 2. Weihnachtstag.
 * Fronleichnam ist in Rheinland-Pfalz ganzflächig gesetzlicher Feiertag.
 *
 * Nicht gesetzlich in Rheinland-Pfalz und damit ohne "F!"-Markierung:
 * Heilige Drei Könige (nur Baden-Württemberg, Bayern, Sachsen-Anhalt) und
 * Mariä Himmelfahrt (nur Saarland und Bayern). Beide bleiben in der
 * Schichtplanung bezahlte Werktagsfeiertage (countsAsPaidNormalShiftHoliday);
 * bezahlte Freistellung und "F!"-Markierung sind bewusst getrennte Angaben.
 * Der Reformationstag ist in Rheinland-Pfalz kein gesetzlicher Feiertag.
 * Brauchtumstage (Heiligabend, Silvester, Fastnacht ...) werden ebenfalls
 * normal (ohne "F!") angezeigt.
 */
export const fixedEvents: readonly FixedEventDefinition[] = [
  { id: 'new-year', name: 'Neujahr', month: 1, day: 1, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'epiphany', name: 'Heilige Drei Könige', month: 1, day: 6, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: false, priority: 20 },
  { id: 'labour-day', name: 'Maifeiertag', month: 5, day: 1, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'assumption', name: 'Mariä Himmelfahrt', month: 8, day: 15, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: false, priority: 20 },
  { id: 'german-unity', name: 'Tag der Deutschen Einheit', month: 10, day: 3, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'reformation', name: 'Reformationstag', month: 10, day: 31, countsAsPaidNormalShiftHoliday: false, isPublicHoliday: false, priority: 20 },
  { id: 'all-saints', name: 'Allerheiligen', month: 11, day: 1, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'christmas-eve', name: 'Heiligabend', month: 12, day: 24, countsAsPaidNormalShiftHoliday: false, isPublicHoliday: false, priority: 30 },
  { id: 'christmas-day-1', name: '1. Weihnachtstag', month: 12, day: 25, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'christmas-day-2', name: '2. Weihnachtstag', month: 12, day: 26, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'new-years-eve', name: 'Silvester', month: 12, day: 31, countsAsPaidNormalShiftHoliday: false, isPublicHoliday: false, priority: 30 },
];

/**
 * Ereignisse relativ zum Ostersonntag (Offsets in Kalendertagen).
 */
export const easterRelativeEvents: readonly {
  id: string;
  name: string;
  offset: number;
  countsAsPaidNormalShiftHoliday: boolean;
  isPublicHoliday: boolean;
  priority: number;
}[] = [
  { id: 'carnival', name: 'Fastnacht', offset: -47, countsAsPaidNormalShiftHoliday: false, isPublicHoliday: false, priority: 40 },
  { id: 'good-friday', name: 'Karfreitag', offset: -2, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'easter-sunday', name: 'Ostersonntag', offset: 0, countsAsPaidNormalShiftHoliday: false, isPublicHoliday: false, priority: 20 },
  { id: 'easter-monday', name: 'Ostermontag', offset: 1, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'ascension', name: 'Christi Himmelfahrt', offset: 39, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'whitsun-sunday', name: 'Pfingstsonntag', offset: 49, countsAsPaidNormalShiftHoliday: false, isPublicHoliday: false, priority: 20 },
  { id: 'whitsun-monday', name: 'Pfingstmontag', offset: 50, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
  { id: 'corpus-christi', name: 'Fronleichnam', offset: 60, countsAsPaidNormalShiftHoliday: true, isPublicHoliday: true, priority: 10 },
];

/**
 * Kurzbezeichnungen für die Printansicht: ausschließlich Brauchtums- und
 * Aktionstage, die nicht als gesetzlicher Feiertag mit "F!" markiert sind.
 *
 * Gesetzliche Feiertage stehen hier bewusst nicht: Sie werden in der
 * KW-Spalte durch das "F!"-Kästchen gekennzeichnet, während ihr
 * ausgeschriebener Name im Informationstext erhalten bleibt. Ein Kurztext
 * würde den Feiertag ein zweites Mal nennen - genau das soll vermieden
 * werden.
 */
export const printShortNames: Record<string, string> = {
  'Beginn Sommerzeit': 'Sommerzeit',
  'Ende Sommerzeit': 'Sommerzeit',
  'Buß- und Bettag': 'Buß-/Bettag',
};

/** Liefert den Printnamen (Kurzform, falls definiert). */
export function getPrintEventName(name: string): string {
  return printShortNames[name] ?? name;
}
