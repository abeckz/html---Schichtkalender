/**
 * Seitenheader der Druckansicht.
 *
 * Sehr kompakt: Titel, Jahr, Schicht sowie die einmalige Erklärung der
 * Kennzahlen links und rechts am Monatsnamen.
 */

import type { ShiftId } from '../domain/types';
import { PUBLIC_HOLIDAY_MARK } from './PrintMonth';

export interface PrintHeaderProps {
  year: number;
  selectedShift: ShiftId;
}

export function PrintHeader({ year, selectedShift }: PrintHeaderProps) {
  return (
    <header className="print-page-header">
      <div className="print-header-row">
        <span className="print-header-title">BASF Schichtkalender</span>
        <span className="print-header-year">{year}</span>
        <span className="print-header-shift">Schicht {selectedShift}</span>
      </div>
      <div className="print-header-legend">
        <span>T = Tagschicht 6-18 Uhr</span>
        <span>N = Nachtschicht 18-6 Uhr</span>
        <span>Zahl links am Monat: Werktage Mo-Fr</span>
        <span>Zahl rechts am Monat: Sollschichten T+N</span>
        <span>
          {PUBLIC_HOLIDAY_MARK} im Text und rosa Kästchen in der KW-Spalte: gesetzlicher
          Feiertag (Rheinland-Pfalz)
        </span>
      </div>
    </header>
  );
}
