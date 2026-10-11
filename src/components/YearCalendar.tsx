/**
 * Jahreskalender der Bildschirmdarstellung.
 *
 * Responsiv: auf großen Bildschirmen mehrere Monate nebeneinander, auf
 * Tablets weniger und auf Smartphones ein Monat pro Bereich. Die
 * Druckdarstellung ist davon vollständig unabhängig.
 */

import type { AnnotationMap, AnniversaryMap, CalendarDay, ColumnColorName, ExtraColumns, YearCalendar as YearCalendarModel } from '../domain/types.ts';
import { MonthCalendar } from './MonthCalendar.tsx';
import type { ExtraColumnSide } from '../services/settingsStore.ts';

export interface YearCalendarProps {
  calendar: YearCalendarModel;
  annotations: AnnotationMap;
  /**
   * Anzeige-Option "Wochentag über Datum" (Standard: aus). Ist sie gesetzt,
   * steht das Datum unter dem Wochentag und die Tagesnummer-Spalte entfällt.
   */
  weekdayOverDate?: boolean;
  onOpenEditor: (day: CalendarDay) => void;
  /** Anzeige-Checkbox "Schichtkalender" (Standard: an). */
  showShiftCalendar?: boolean;
  /** Jahreslose Geburtstage und wiederkehrende Ereignisse. */
  anniversaries?: AnniversaryMap;
  /** Anzeige-Checkbox "Geburtstag" (Standard: an). */
  showBirthdays?: boolean;
  /** Anzeige-Checkbox "wdh. Ereignis" (Standard: an). */
  showRecurringEvents?: boolean;
  selectedKeys?: ReadonlySet<string>;
  /** Spalte, die während der aktuellen Streifen-Auswahl hervorgehoben wird. */
  selectedColumn?: ColumnColorName | null;
  /** Frei angelegte Zusatzspalten, geschlüsselt nach Monat (1..12). */
  extraColumns?: Record<number, ExtraColumns>;
  /** Legt eine schmale Zusatzspalte an einer der beiden Trennlinien an. */
  onAddExtraColumn?: (month: number, side: ExtraColumnSide) => void;
  /** Erweitert die Spalte unmittelbar an der Trennlinie um eine Einheit. */
  onWidenExtraColumn?: (month: number, side: ExtraColumnSide, index: number) => void;
  onStreakStart?: (day: CalendarDay, column: ColumnColorName) => void;
  onStreakEnter?: (day: CalendarDay) => void;
  onStreakEnd?: () => void;
}

export function YearCalendar({
  calendar,
  annotations,
  weekdayOverDate = false,
  onOpenEditor,
  showShiftCalendar = true,
  anniversaries = {},
  showBirthdays = true,
  showRecurringEvents = true,
  selectedKeys,
  selectedColumn,
  extraColumns,
  onAddExtraColumn,
  onWidenExtraColumn,
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
          weekdayOverDate={weekdayOverDate}
          onOpenEditor={onOpenEditor}
          showShiftCalendar={showShiftCalendar}
          anniversaries={anniversaries}
          showBirthdays={showBirthdays}
          showRecurringEvents={showRecurringEvents}
          selectedKeys={selectedKeys}
          selectedColumn={selectedColumn}
          extraColumns={extraColumns?.[month.month]}
          onAddExtraColumn={onAddExtraColumn}
          onWidenExtraColumn={onWidenExtraColumn}
          onStreakStart={onStreakStart}
          onStreakEnter={onStreakEnter}
          onStreakEnd={onStreakEnd}
        />
      ))}
    </div>
  );
}
