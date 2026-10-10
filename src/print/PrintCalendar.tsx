/**
 * Druckansicht.
 *
 * Greift ausschließlich auf den bereits berechneten YearCalendar zu. Es
 * findet hier keine zweite Berechnung von Schichten, Events oder
 * Monatsstatistiken statt.
 *
 * Die Vorschau zeigt exakt zwei verkleinerte A3-Seiten: Januar bis Juni und
 * Juli bis Dezember. Beim Drucken werden die Steuerelemente ausgeblendet,
 * sodass genau zwei Seiten entstehen.
 */

import { useMemo } from 'react';
import type { AnnotationColorId, AnnotationMap, ColumnColorName, YearCalendar } from '../domain/types';
import { usedAnnotationColors } from '../config/annotationColors';
import { summarizeYear } from '../engines/calendarBuilder';
import { PrintHeader } from './PrintHeader';
import { PrintHalfYear } from './PrintHalfYear';

export interface PrintCalendarProps {
  calendar: YearCalendar;
  annotations: AnnotationMap;
  /** Erklärungstexte der Farblegende des gedruckten Jahres. */
  colorLegend?: Partial<Record<AnnotationColorId, string>>;
  onPrint: () => void;
  onBack: () => void;
}

export function PrintCalendar({
  calendar,
  annotations,
  colorLegend = {},
  onPrint,
  onBack,
}: PrintCalendarProps) {
  const firstHalf = calendar.months.slice(0, 6);
  const secondHalf = calendar.months.slice(6, 12);

  // Gearbeitete Schichten insgesamt (Tag- plus Nachtschichten) des Jahres.
  const workedShiftCount = summarizeYear(calendar).requiredShiftCount;

  // Benutzte Markierungsfarben des Jahres für die Farblegende im Seitenkopf.
  const usedColors = usedAnnotationColors(annotations, calendar.year);

  // Die Aufbereitung ist reine Darstellungslogik und verändert keine
  // Fachdaten: Beschriftungen und Farb-IDs werden aus der AnnotationMap
  // gelesen, nicht neu berechnet.
  const annotationLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [dateKey, annotation] of Object.entries(annotations)) {
      if (annotation.label !== '') map[dateKey] = annotation.label;
    }
    return map;
  }, [annotations]);

  const annotationColors = useMemo(() => {
    const map: Record<
      string,
      Partial<Record<ColumnColorName, NonNullable<AnnotationColorId>>>
    > = {};
    for (const [dateKey, annotation] of Object.entries(annotations)) {
      if (Object.keys(annotation.colors).length > 0) map[dateKey] = annotation.colors;
    }
    return map;
  }, [annotations]);

  return (
    <div className="print-view">
      <div className="print-controls no-print">
        <button type="button" className="primary-button" onClick={onPrint}>
          Drucken
        </button>
        <button type="button" className="secondary-button" onClick={onBack}>
          Zurück
        </button>
        <p className="print-hint">
          Druckempfehlung: DIN A3, Querformat, beidseitig drucken.
          <br />
          Wendung an der für A3-Querformat passenden Kante wählen.
          <br />
          Beide Seiten füllen das Blatt vollständig aus – Skalierung auf 100 % bzw. „An Seite anpassen“ deaktiviert lassen.
          <br />
          Hintergrundfarben aktivieren, damit Farbmarkierungen und das rosa Feiertagsfeld (F) farbig gedruckt werden.
        </p>
      </div>

      <div className="print-preview print-only-root">
        <article className="print-page" data-page="1">
          <PrintHeader
            year={calendar.year}
            selectedShift={calendar.selectedShift}
            workedShiftCount={workedShiftCount}
            usedColors={usedColors}
            colorLegend={colorLegend}
          />
          <PrintHalfYear
            months={firstHalf}
            annotationLabels={annotationLabels}
            annotationColors={annotationColors}
            side={1}
          />
        </article>

        <article className="print-page" data-page="2">
          <PrintHeader
            year={calendar.year}
            selectedShift={calendar.selectedShift}
            workedShiftCount={workedShiftCount}
            usedColors={usedColors}
            colorLegend={colorLegend}
          />
          <PrintHalfYear
            months={secondHalf}
            annotationLabels={annotationLabels}
            annotationColors={annotationColors}
            side={2}
          />
        </article>
      </div>
    </div>
  );
}
