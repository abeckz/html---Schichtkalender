/**
 * Jahreskalender der Bildschirmdarstellung.
 *
 * Responsiv: auf großen Bildschirmen mehrere Monate nebeneinander, auf
 * Tablets weniger und auf Smartphones ein Monat pro Bereich. Die
 * Druckdarstellung ist davon vollständig unabhängig.
 */

import type { AnnotationMap, CalendarDay, ColumnColorName, YearCalendar as YearCalendarModel } from '../domain/types';
import { MonthCalendar } from './MonthCalendar';

export interface YearCalendarProps {
  calendar: YearCalendarModel;
  annotations: AnnotationMap;
  onOpenEditor: (day: CalendarDay) => void;
  selectedKeys?: ReadonlySet<string>;
  /** Spalte, die während der aktuellen Streifen-Auswahl hervorgehoben wird. */
  selectedColumn?: ColumnColorName | null;
  onStreakStart?: (day: CalendarDay, column: ColumnColorName) => void;
  onStreakEnter?: (day: CalendarDay) => void;
  onStreakEnd?: () => void;
}

export function YearCalendar({
  calendar,
  annotations,
  onOpenEditor,
  selectedKeys,
  selectedColumn,
  onStreakStart,
  onStreakEnter,
  onStreakEnd,
}: YearCalendarProps) {
  return (
    <div className="year-calendar">
      {calendar.months.map((month) => (
        <MonthCalendar
          key={month.month}
          month={month}
          annotations={annotations}
          onOpenEditor={onOpenEditor}
          selectedKeys={selectedKeys}
          selectedColumn={selectedColumn}
          onStreakStart={onStreakStart}
          onStreakEnter={onStreakEnter}
          onStreakEnd={onStreakEnd}
        />
      ))}
    </div>
  );
}
