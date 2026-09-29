/**
 * Monatskalender der Bildschirmdarstellung.
 *
 * Der Monat wirkt tabellarisch: jeder Tag ist eine Zeile, die Tage laufen
 * von oben nach unten. Der Kopf zeigt Monatsname und Kennzahlen; auf eine
 * Spaltenkopfzeile wird bewusst verzichtet.
 */

import type { AnnotationMap, CalendarDay, MonthCalendar as MonthCalendarModel } from '../domain/types';
import { CalendarDayRow } from './CalendarDayRow';

export interface MonthCalendarProps {
  month: MonthCalendarModel;
  annotations: AnnotationMap;
  onOpenEditor: (day: CalendarDay) => void;
}

export function MonthCalendar({ month, annotations, onOpenEditor }: MonthCalendarProps) {
  const { statistics } = month;
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
        <span>{statistics.paidWeekdayHolidayCount} bezahlte Feiertage (Mo–Fr)</span>
      </footer>
    </section>
  );
}
