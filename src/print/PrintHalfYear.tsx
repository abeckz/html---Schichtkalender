/**
 * Ein Druckhalbjahr: sechs Monatsblöcke nebeneinander in einer einzigen
 * horizontalen Reihe (1 x 6).
 *
 * Ausdrücklich kein 3-x-2- und kein 2-x-3-Raster und keine Monate
 * untereinander.
 */

import type { AnnotationColorId, ColumnColorName, MonthCalendar } from '../domain/types';
import { PrintMonth } from './PrintMonth';

export interface PrintHalfYearProps {
  months: MonthCalendar[];
  annotationLabels: Record<string, string>;
  /** Farben je Tag und Spalte (Spaltenname -> colorId). */
  annotationColors: Record<string, Partial<Record<ColumnColorName, AnnotationColorId>>>;
  side: 1 | 2;
}

export function PrintHalfYear({
  months,
  annotationLabels,
  annotationColors,
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
        />
      ))}
    </section>
  );
}
