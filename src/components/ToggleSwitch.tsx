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
}

export function ToggleSwitch({
  label,
  checked,
  onChange,
  title,
  stateLabels = ['Ein', 'Aus'],
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
        className={checked ? 'toggle-switch is-checked' : 'toggle-switch'}
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        title={title ?? `${label}: ${stateText}`}
        onClick={() => onChange(!checked)}
      >
        {/* Der Zustand ist auch ohne Farbwahrnehmung lesbar. */}
        <span className="toggle-switch-state">{stateText}</span>
        <span className="toggle-switch-track" aria-hidden="true">
          <span className="toggle-switch-knob" />
        </span>
      </button>
    </div>
  );
}
