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
 * Ein Klick legt eine **neue, eigenständige** schmale Spalte auf dieser Seite
 * des Monats an. Jede Spalte ist eine individuelle Spalte mit eigenem
 * Farbschlüssel (`extra0`, `extra1`, …), eigenem Text und eigener Farbe; ein
 * wiederholter Klick an derselben Trennlinie fügt daher eine weitere Spalte an
 * der Linie ein, während die bereits sichtbaren Spalten nach außen rücken.
 *
 * Reines Bedienelement: es kennt keine Fachdaten und wird niemals gedruckt.
 */

import type { MouseEvent as ReactMouseEvent } from 'react';
import type { ExtraColumnSide } from '../services/settingsStore.ts';

export interface ColumnInsertHandleProps {
  /** Seite der Trennlinie: 'left' links der Ereigniszelle, 'right' vor T/N. */
  side: ExtraColumnSide;
  /** Führt den Klick aus (legt eine neue, eigenständige Spalte an). */
  onActivate: (side: ExtraColumnSide) => void;
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

/** Von einem Kreis umschlossenes Minuszeichen (Spalte entfernen). */
export function MinusInCircle() {
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
      <path d="M4.4 8 H11.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

export function ColumnInsertHandle({ side, onActivate }: ColumnInsertHandleProps) {
  const label =
    side === 'left'
      ? 'Neue schmale Zusatzspalte links der Ereigniszelle anfügen'
      : 'Neue schmale Zusatzspalte vor T/N anfügen';

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    // Der Klick steuert ausschließlich die Spaltenanlage; der Monatskopf hat
    // keine weitere Klickfunktion, die versehentlich ausgelöst werden könnte.
    event.preventDefault();
    event.stopPropagation();
    onActivate(side);
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

export interface ColumnRemoveHandleProps {
  /** Seite der Trennlinie: 'left' links der Ereigniszelle, 'right' vor T/N. */
  side: ExtraColumnSide;
  /**
   * Index der Spalte, die an dieser Trennlinie liegt (0 = direkt an der Linie).
   * Ohne vorhandene Spalte wird -1 übergeben; dann bleibt der Bedienpunkt
   * inaktiv (ausgeblendet).
   */
  nearEdgeIndex: number;
  /** Führt den Klick aus (Spalte an der Trennlinie verkleinern bzw. entfernen). */
  onActivate: (side: ExtraColumnSide, nearEdgeIndex: number) => void;
}

/**
 * Bedienpunkt "Zusatzspalte entfernen".
 *
 * Er sitzt - wie der `+`-Punkt - im Monatskopf auf der jeweiligen Trennlinie,
 * ist jedoch tiefer versetzt, damit sich beide Punkte nicht überlagern. Ein
 * Klick entfernt die Spalte an der Trennlinie vollständig; die übrigen Spalten
 * der Seite rücken nach. Ohne Spalte an der Linie (nearEdgeIndex < 0) wird der
 * Punkt nicht dargestellt: es gibt nichts zu entfernen.
 */
export function ColumnRemoveHandle({ side, nearEdgeIndex, onActivate }: ColumnRemoveHandleProps) {
  if (nearEdgeIndex < 0) return null;

  const label = side === 'left' ? 'Zusatzspalte links entfernen' : 'Zusatzspalte rechts entfernen';

  const handleClick = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    onActivate(side, nearEdgeIndex);
  };

  return (
    <button
      type="button"
      className="column-remove-handle"
      data-extra-column-side={side}
      title={label}
      aria-label={label}
      onClick={handleClick}
      onDoubleClick={(event) => event.preventDefault()}
    >
      <MinusInCircle />
    </button>
  );
}
