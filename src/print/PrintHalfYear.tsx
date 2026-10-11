/**
 * Ein Druckhalbjahr: sechs Monatsblöcke nebeneinander in einer einzigen
 * horizontalen Reihe (1 x 6).
 *
 * Ausdrücklich kein 3-x-2- und kein 2-x-3-Raster und keine Monate
 * untereinander.
 */

import type { AnnotationColorId, AnniversaryMap, ColumnColorName, MonthCalendar } from '../domain/types.ts';
import { PrintMonth } from './PrintMonth.tsx';

export interface PrintHalfYearProps {
  months: MonthCalendar[];
  annotationLabels: Record<string, string>;
  /** Farben je Tag und Spalte (Spaltenname -> colorId). */
  annotationColors: Record<string, Partial<Record<ColumnColorName, AnnotationColorId>>>;
  /** Anzeige-Option "Wochentag über Datum" (Standard: aus). */
  weekdayOverDate?: boolean;
  /** Anzeige-Checkbox "Schichtkalender" (Standard: an). */
  showShiftCalendar?: boolean;
  /** Jahreslose Geburtstage und wiederkehrende Ereignisse. */
  anniversaries?: AnniversaryMap;
  /** Anzeige-Checkbox "Geburtstag" (Standard: an). */
  showBirthdays?: boolean;
  /** Anzeige-Checkbox "wdh. Ereignis" (Standard: an). */
  showRecurringEvents?: boolean;
  side: 1 | 2;
}

export function PrintHalfYear({
  months,
  annotationLabels,
  annotationColors,
  weekdayOverDate = false,
  showShiftCalendar = true,
  anniversaries = {},
  showBirthdays = true,
  showRecurringEvents = true,
  side,
}: PrintHalfYearProps) {
  return (
    <section className="print-half-year" data-side={side}>
      {months.map((month) => (
        <PrintMonth
          key={month.month}
          month={month}
          annotationLabels={annotationLabels}
          annotationColors={annotationColors}
          weekdayOverDate={weekdayOverDate}
          showShiftCalendar={showShiftCalendar}
          anniversaries={anniversaries}
          showBirthdays={showBirthdays}
          showRecurringEvents={showRecurringEvents}
        />
      ))}
    </section>
  );
}
