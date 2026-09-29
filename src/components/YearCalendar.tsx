/**
 * Jahreskalender der Bildschirmdarstellung.
 *
 * Responsiv: auf großen Bildschirmen mehrere Monate nebeneinander, auf
 * Tablets weniger und auf Smartphones ein Monat pro Bereich. Die
 * Druckdarstellung ist davon vollständig unabhängig.
 */

import type { AnnotationMap, CalendarDay, YearCalendar as YearCalendarModel } from '../domain/types';
import { MonthCalendar } from './MonthCalendar';

export interface YearCalendarProps {
  calendar: YearCalendarModel;
  annotations: AnnotationMap;
  onOpenEditor: (day: CalendarDay) => void;
}

export function YearCalendar({ calendar, annotations, onOpenEditor }: YearCalendarProps) {
  return (
    <div className="year-calendar">
      {calendar.months.map((month) => (
        <MonthCalendar
          key={month.month}
          month={month}
          annotations={annotations}
          onOpenEditor={onOpenEditor}
        />
      ))}
    </div>
  );
}
