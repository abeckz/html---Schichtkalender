/**
 * Seitenheader der Druckansicht.
 *
 * Sehr kompakt: Titel, Jahr, Schicht sowie die einmalige Erklärung der
 * Kennzahlen links und rechts am Monatsnamen.
 *
 * Die erste Legendenzeile nennt die Gesamtzahl der im Jahr für die gewählte
 * Schicht gearbeiteten Schichten (Tag- plus Nachtschichten). Darunter folgt
 * zuerst die Farblegende (sofern Markierungsfarben benutzt werden) und danach
 * die Erklärung der Buchstaben und Kennzahlen.
 */

import type { AnnotationColorId, ShiftId } from '../domain/types';
import { ColorLegendBox } from '../components/ColorLegendBox';
import { PUBLIC_HOLIDAY_MARK, PUBLIC_HOLIDAY_TITLE } from './PrintMonth';

export interface PrintHeaderProps {
  year: number;
  selectedShift: ShiftId;
  /** Gearbeitete Schichten insgesamt (Tag- plus Nachtschichten) des Jahres. */
  workedShiftCount: number;
  /** Benutzte Markierungsfarben des Jahres (in Palettenreihenfolge). */
  usedColors?: readonly AnnotationColorId[];
  /** Erklärungstexte der Farblegende des Jahres. */
  colorLegend?: Partial<Record<AnnotationColorId, string>>;
}

export function PrintHeader({
  year,
  selectedShift,
  workedShiftCount,
  usedColors = [],
  colorLegend = {},
}: PrintHeaderProps) {
  return (
    <header className="print-page-header">
      <div className="print-header-row">
        <span className="print-header-title">BASF Schichtkalender</span>
        <span className="print-header-year">{year}</span>
        <span className="print-header-shift">Schicht {selectedShift}</span>
      </div>
      <div className="print-header-legend">
        <span className="print-header-total">
          Arbeitsschichten gesamt im Jahr {year} für Schicht {selectedShift}:{' '}
          {workedShiftCount}
        </span>
        {usedColors.length > 0 && (
          <ColorLegendBox
            colors={usedColors}
            texts={colorLegend}
            interactive={false}
            className="print-header-colors"
          />
        )}
        <span>T = Tagschicht von 6 bis 18 Uhr</span>
        <span>N = Nachtschicht von 18 bis 6 Uhr</span>
        <span>Werktage = Anzahl Montag bis Freitag</span>
        <span>Sollschichten = Anzahl T + N</span>
        <span>{PUBLIC_HOLIDAY_MARK} = {PUBLIC_HOLIDAY_TITLE}</span>
      </div>
    </header>
  );
}
