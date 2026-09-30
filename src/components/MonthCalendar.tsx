/**
 * Monatskalender der Bildschirmdarstellung.
 *
 * Der Monat wirkt tabellarisch: jeder Tag ist eine Zeile, die Tage laufen
 * von oben nach unten. Der Kopf zeigt Monatsname und Kennzahlen; auf eine
 * Spaltenkopfzeile wird bewusst verzichtet.
 */

import type { AnnotationMap, CalendarDay, MonthCalendar as MonthCalendarModel } from '../domain/types';
import { HALF_PAID_HOLIDAY } from '../engines/calendarBuilder';
import { CalendarDayRow } from './CalendarDayRow';

export interface MonthCalendarProps {
  month: MonthCalendarModel;
  annotations: AnnotationMap;
  onOpenEditor: (day: CalendarDay) => void;
}

/**
 * Formatiert eine Feiertagszahl deutsch mit Komma und ohne überflüssige
 * Nullen: 1,5 bleibt "1,5", 2 wird "2".
 */
export function formatHolidayCount(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace('.', ',');
}

/**
 * Formatiert halbe Feiertage: halfHolidayCount ist die Anzahl der
 * Nachtschichten mit Feiertag am Folgetag, jede zählt 0,5. Vier
 * Nachtschichten ergeben 2, eine ergibt 0,5.
 */
export function formatHalfHolidayCount(halfHolidayCount: number): string {
  return formatHolidayCount(HALF_PAID_HOLIDAY * halfHolidayCount);
}

export function MonthCalendar({ month, annotations, onOpenEditor }: MonthCalendarProps) {
  const { statistics } = month;
  // Halbe Feiertage (Nachtschicht mit Feiertag am Folgetag) werden nur
  // ausgewiesen, wenn sie tatsächlich anfallen; so bleibt die Fußzeile an
  // Monaten ohne Nachtschichtüberhang unverändert kurz.
  const hasHalfHolidays = statistics.paidNightShiftHolidayCount > 0;
  const nightShiftHolidayText = formatHalfHolidayCount(statistics.paidNightShiftHolidayCount);
  return (
    <section className="month-card" aria-label={`${month.name} ${month.year}`}>
      <header className="month-header">
        <span className="month-stat" title="Werktage Montag bis Freitag">
          {statistics.weekdayCount} Werktage
        </span>
        <h2 className="month-title" aria-label={`${month.name}, ${statistics.weekdayCount} Werktage, ${statistics.requiredShiftCount} Sollschichten`}>
          {month.name}
        </h2>
        <span className="month-stat" title="Sollschichten (T + N)">
          {statistics.requiredShiftCount} Soll
        </span>
      </header>

      <div className="day-table" role="table" aria-label={`Tage im ${month.name}`}>
        {month.days.map((day) => (
          <CalendarDayRow
            key={day.dateKey}
            day={day}
            annotation={annotations[day.dateKey]}
            onOpenEditor={onOpenEditor}
          />
        ))}
      </div>

      <footer className="month-footer">
        <span>{statistics.dayShiftCount} × T</span>
        <span>{statistics.nightShiftCount} × N</span>
        <span title="Bezahlte Werktagsfeiertage (Mo–Fr) ohne die halben Anteile aus Nachtschichten">
          {statistics.paidWeekdayHolidayCount} bezahlte Feiertage (Mo–Fr)
        </span>
        {hasHalfHolidays && (
          <span title="Nachtschicht mit Feiertag am Folgetag: je Nachtschicht ein halber Feiertag">
            + {nightShiftHolidayText} durch Nachtschicht
          </span>
        )}
        <span title="Bezahlte Feiertage insgesamt: Werktagsfeiertage plus halbe Anteile aus Nachtschichten">
          {formatHolidayCount(statistics.paidHolidayCount)} bezahlt gesamt
        </span>
      </footer>
    </section>
  );
}
