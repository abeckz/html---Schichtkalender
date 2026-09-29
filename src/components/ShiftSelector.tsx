/**
 * Schicht-Auswahl.
 *
 * Alle sieben Schichtsysteme sind direkt wählbar; die aktive Schicht wird
 * deutlich hervorgehoben (nicht nur über Farbe, sondern auch über
 * aria-pressed und Fettschrift).
 */

import type { ShiftId } from '../domain/types';
import { SHIFT_IDS, getShiftDefinition } from '../config/shiftDefinitions';

export interface ShiftSelectorProps {
  selectedShift: ShiftId;
  onSelectShift: (shiftId: ShiftId) => void;
}

export function ShiftSelector({ selectedShift, onSelectShift }: ShiftSelectorProps) {
  return (
    <div className="toolbar-group" role="group" aria-label="Schicht wählen">
      <span className="field-label">Schicht</span>
      <div className="shift-buttons">
        {SHIFT_IDS.map((shiftId) => {
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
        })}
      </div>
    </div>
  );
}
