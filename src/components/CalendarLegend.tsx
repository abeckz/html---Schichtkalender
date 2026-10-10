/**
 * Kompakte Legende.
 *
 * Erklärt die Buchstaben und Kennzahlen. Informationen werden immer als Text
 * transportiert, niemals ausschließlich über Farbe.
 *
 * In der ersten Zeile steht die Gesamtzahl der im gewählten Jahr für die
 * gewählte Schicht gearbeiteten Schichten (Tag- plus Nachtschichten).
 *
 * Darunter folgt zuerst die Farblegende (sofern Markierungsfarben benutzt
 * werden) und danach die Erklärung der Buchstaben und Kennzahlen. Ein Klick
 * auf einen Farbblock öffnet den Eingabedialog der Farblegende.
 */

import type { AnnotationColorId, ShiftId } from '../domain/types';
import { PUBLIC_HOLIDAY_MARK, PUBLIC_HOLIDAY_TITLE } from '../print/PrintMonth';
import { ColorLegendBox } from './ColorLegendBox';

export interface CalendarLegendProps {
  compact?: boolean;
  /** Ausgewähltes Jahr der Jahresübersicht. */
  year: number;
  /** Ausgewählte Schicht der Jahresübersicht. */
  selectedShift: ShiftId;
  /** Gearbeitete Schichten insgesamt (Tag- plus Nachtschichten) des Jahres. */
  workedShiftCount: number;
  /** Benutzte Markierungsfarben des Jahres (in Palettenreihenfolge). */
  usedColors?: readonly AnnotationColorId[];
  /** Erklärungstexte je Farbe des Jahres. */
  colorTexts?: Partial<Record<AnnotationColorId, string>>;
  /** Klick auf eine Farbbox (öffnet den Eingabedialog). */
  onEditColor?: (colorId: AnnotationColorId) => void;
}

export function CalendarLegend({
  compact = false,
  year,
  selectedShift,
  workedShiftCount,
  usedColors = [],
  colorTexts = {},
  onEditColor,
}: CalendarLegendProps) {
  return (
    <div className={compact ? 'legend legend-compact' : 'legend'}>
      <span className="legend-item legend-total">
        <strong>Arbeitsschichten gesamt</strong> im Jahr {year} für Schicht{' '}
        {selectedShift}: {workedShiftCount}
      </span>
      {usedColors.length > 0 && (
        <span className="legend-item legend-colors">
          <strong>Farben</strong>
          <ColorLegendBox
            colors={usedColors}
            texts={colorTexts}
            onEditColor={onEditColor}
            className="legend-color-box"
          />
        </span>
      )}
      <span className="legend-item">
        <strong>T</strong> = Tagschicht von 6 bis 18 Uhr
      </span>
      <span className="legend-item">
        <strong>N</strong> = Nachtschicht von 18 bis 6 Uhr
      </span>
      <span className="legend-item">
        <strong>Werktage</strong> = Anzahl Montag bis Freitag
      </span>
      <span className="legend-item">
        <strong>Sollschichten</strong> = Anzahl T + N
      </span>
      <span className="legend-item">
        <span className="holiday-mark" aria-hidden="true">
          {PUBLIC_HOLIDAY_MARK}
        </span>{' '}
        = {PUBLIC_HOLIDAY_TITLE}
      </span>
    </div>
  );
}
