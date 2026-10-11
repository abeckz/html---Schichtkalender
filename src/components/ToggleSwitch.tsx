/**
 * ToggleSwitch.
 *
 * Zugänglicher Umschalter im Stil moderner Apps (Windows/iOS): ein runder
 * Knopf, der in einem Langloch (Pille) nach links bzw. rechts gleitet. Der
 * Zustand wird zusätzlich über den sichtbaren Text ("Ein"/"Aus") transportiert
 * und ist damit nicht ausschließlich über Farbe erfassbar.
 *
 * Reines Bedienelement: der Schalter kennt keine Fachdaten und wird niemals
 * gedruckt.
 */

import { useId } from 'react';

export interface ToggleSwitchProps {
  /** Beschriftung links vom Schalter. */
  label: string;
  /** Aktueller Zustand. */
  checked: boolean;
  /** Schaltet den Zustand um. */
  onChange: (checked: boolean) => void;
  /** Optionaler Zusatzhinweis (title/aria-description). */
  title?: string;
  /** Optionaler Zustandstext (Standard: "Ein"/"Aus"). */
  stateLabels?: [on: string, off: string];
  /**
   * Blendet den Zustandstext im Schalter aus (Standard: an).
   *
   * Für Umschalter, deren beide Stellungen durch je eine eigene Beschriftung
   * links (`label`) und rechts (`trailingLabel`) benannt sind, ist der
   * Innentext entbehrlich.
   */
  showState?: boolean;
  /** Optionaler Text rechts vom Schalter (z. B. die Gegenstellung). */
  trailingLabel?: string;
  /**
   * Dreht die Laufrichtung des Knopfes um (Standard: aus).
   *
   * Ohne diese Option wandert der Knopf beim Einschalten nach rechts. Benennen
   * die beiden Beschriftungen links und rechts jedoch je eine Stellung (z. B.
   * links „Geburtstag & wiederkehrende Ereignisse", rechts „Schichtkalender"),
   * so zeigt der Knopf erst mit umgedrehter Richtung auf die gewählte Seite.
   */
  inverted?: boolean;
}

export function ToggleSwitch({
  label,
  checked,
  onChange,
  title,
  stateLabels = ['Ein', 'Aus'],
  showState = true,
  trailingLabel,
  inverted = false,
}: ToggleSwitchProps) {
  const labelId = useId();
  const [onLabel, offLabel] = stateLabels;
  const stateText = checked ? onLabel : offLabel;

  return (
    <div className="toggle-field">
      <span className="field-label" id={labelId}>
        {label}
      </span>
      <button
        type="button"
        className={[
          'toggle-switch',
          checked ? 'is-checked' : '',
          inverted ? 'is-inverted' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        title={title ?? `${label}: ${stateText}`}
        onClick={() => onChange(!checked)}
      >
        {/* Der Zustand ist auch ohne Farbwahrnehmung lesbar. */}
        {showState ? <span className="toggle-switch-state">{stateText}</span> : null}
        <span className="toggle-switch-track" aria-hidden="true">
          <span className="toggle-switch-knob" />
        </span>
      </button>
      {trailingLabel ? <span className="toggle-field-trailing">{trailingLabel}</span> : null}
    </div>
  );
}
