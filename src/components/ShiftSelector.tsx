/**
 * Schicht-Auswahl.
 *
 * Alle sieben Schichtsysteme sind direkt wählbar; die aktive Schicht wird
 * deutlich hervorgehoben (nicht nur über Farbe, sondern auch über
 * aria-pressed und Fettschrift).
 *
 * Die Anordnung erfolgt in zwei Zeilen: oben die Systeme I–III, unten die
 * Systeme A–D.
 */

import type { ShiftId } from '../domain/types';
import { getShiftDefinition } from '../config/shiftDefinitions';

export interface ShiftSelectorProps {
  selectedShift: ShiftId;
  onSelectShift: (shiftId: ShiftId) => void;
}

/** Erste Zeile: die Systeme I–III. */
const SHIFT_ROW_I_III: readonly ShiftId[] = ['I', 'II', 'III'];
/** Zweite Zeile: die Systeme A–D. */
const SHIFT_ROW_A_D: readonly ShiftId[] = ['A', 'B', 'C', 'D'];

export function ShiftSelector({ selectedShift, onSelectShift }: ShiftSelectorProps) {
  const renderShift = (shiftId: ShiftId) => {
    const isActive = shiftId === selectedShift;
    return (
      <button
        key={shiftId}
        type="button"
        className={isActive ? 'shift-button is-active' : 'shift-button'}
        onClick={() => onSelectShift(shiftId)}
        aria-pressed={isActive}
        title={getShiftDefinition(shiftId).displayName}
      >
        {shiftId}
      </button>
    );
  };

  return (
    <div className="toolbar-group" role="group" aria-label="Schicht wählen">
      <span className="field-label">Schicht</span>
      <div className="shift-buttons">
        <div className="shift-row">{SHIFT_ROW_I_III.map(renderShift)}</div>
        <div className="shift-row">{SHIFT_ROW_A_D.map(renderShift)}</div>
      </div>
    </div>
  );
}
