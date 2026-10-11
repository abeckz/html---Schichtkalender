/**
 * Bedienpunkt "Zusatzspalte anlegen".
 *
 * Der Punkt sitzt im Monatskopf genau auf einer vertikalen Trennlinie des
 * Monats: links auf der Kante zwischen Datum und Ereigniszelle (dort entsteht
 * die Spalte links der Ereigniszelle), rechts auf der Kante vor der
 * Schichtspalte T/N. Er ist unsichtbar und wird erst beim Überfahren des
 * Monats (oder bei Tastaturfokus) sichtbar; angezeigt wird ein von einem Kreis
 * umschlossenes Pluszeichen.
 *
 * Ein Klick legt eine neue, schmale Spalte auf dieser Seite des Monats an. Beim
 * wiederholten Anklicken derselben Trennlinie wächst die bereits dort liegende
 * Spalte, statt eine weitere anzulegen: nur die unmittelbar an der Trennlinie
 * liegende Spalte darf wachsen, damit die bereits sichtbaren Spalten ihre Lage
 * behalten und nur die Ereigniszelle schmaler wird.
 *
 * Reines Bedienelement: es kennt keine Fachdaten und wird niemals gedruckt.
 */

import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ExtraColumnSide } from '../services/settingsStore.ts';

export interface ColumnInsertHandleProps {
  /** Seite der Trennlinie: 'left' links der Ereigniszelle, 'right' vor T/N. */
  side: ExtraColumnSide;
  /**
   * Index der Spalte, die an dieser Trennlinie liegt (0 = direkt an der Linie).
   * Ohne vorhandene Spalte wird -1 übergeben; dann legt ein Klick die erste
   * Spalte an.
   */
  nearEdgeIndex: number;
  /** Führt den Klick aus (Spalte anlegen bzw. die Spalte an der Linie erweitern). */
  onActivate: (side: ExtraColumnSide, nearEdgeIndex: number) => void;
}

/** Von einem Kreis umschlossenes Pluszeichen. */
export function PlusInCircle() {
  return (
    <svg
      className="column-insert-icon"
      viewBox="0 0 16 16"
      width="100%"
      height="100%"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="8" cy="8" r="7" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M8 4.4 V11.6 M4.4 8 H11.6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ColumnInsertHandle({ side, nearEdgeIndex, onActivate }: ColumnInsertHandleProps) {
  const label =
    nearEdgeIndex >= 0
      ? 'Spalte an der Trennlinie erweitern'
      : side === 'left'
        ? 'Neue schmale Spalte links von KW/T/N einfügen'
        : 'Neue schmale Spalte links neben T/N einfügen';

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    // Der Klick steuert ausschließlich die Spaltenanlage; der Monatskopf hat
    // keine weitere Klickfunktion, die versehentlich ausgelöst werden könnte.
    event.preventDefault();
    event.stopPropagation();
    onActivate(side, nearEdgeIndex);
  };

  return (
    <button
      type="button"
      className="column-insert-handle"
      data-extra-column-side={side}
      title={label}
      aria-label={label}
      onClick={handleClick}
      onDoubleClick={(event) => event.preventDefault()}
    >
      <PlusInCircle />
    </button>
  );
}
