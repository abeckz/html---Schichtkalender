/**
 * Umschalter "Wochentag über Datum" der Menübox.
 *
 * Reines Bedienelement der Bildschirmansicht: es wird niemals gedruckt und
 * verändert keine Fachdaten. Die Auswahl wirkt jedoch in Bildschirm- und
 * Druckansicht, weil sie die Spaltenaufteilung der Monatsblöcke steuert.
 *
 * Zugänglichkeit: Der Schalter ist ein Umschalter (`role="switch"`) mit
 * sichtbarer Zustandsanzeige (Ein/Aus) und zusätzlichem `aria-checked`. Die
 * Zustandsanzeige transportiert den Zustand damit nicht ausschließlich über
 * Farbe. Standard ist "Aus".
 */

export interface WeekdayOverDateToggleProps {
  /** true = Datum steht unter dem Wochentag (Tagesnummer-Spalte entfällt). */
  enabled: boolean;
  /** Schaltet die Option um. */
  onToggle: (enabled: boolean) => void;
}

export function WeekdayOverDateToggle({ enabled, onToggle }: WeekdayOverDateToggleProps) {
  const label = 'Wochentag über Datum';
  return (
    <div className="toolbar-group weekday-over-date-toggle">
      <span className="field-label" id="weekday-over-date-label">
        {label}
      </span>
      <button
        type="button"
        className={enabled ? 'switch-button is-active' : 'switch-button'}
        role="switch"
        aria-checked={enabled}
        aria-labelledby="weekday-over-date-label"
        title={
          enabled
            ? 'Datum steht unter dem Wochentag; Tagesnummer-Spalte ist ausgeblendet'
            : 'Wochentag und Tagesnummer stehen in getrennten Spalten'
        }
        onClick={() => onToggle(!enabled)}
      >
        {/* Reiner Zustandstext: macht den Wert auch ohne Farbwahrnehmung lesbar. */}
        <span className="switch-state">{enabled ? 'Ein' : 'Aus'}</span>
      </button>
    </div>
  );
}
