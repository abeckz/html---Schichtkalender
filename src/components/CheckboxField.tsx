/**
 * CheckboxField.
 *
 * Anzeige-Kästchen im Stil moderner Apps: ein echtes Kästchen mit Häkchen und
 * die Beschriftung rechts daneben. Anders als die Pille (ToggleSwitch) ist
 * dieses Bedienelement bewusst ein Kästchen, weil es eine Mehrfachauswahl
 * innerhalb einer Gruppe darstellt.
 *
 * Reines Bedienelement: der Kasten kennt keine Fachdaten und wird niemals
 * gedruckt.
 */

import { useId } from 'react';

export interface CheckboxFieldProps {
  /** Beschriftung rechts vom Kästchen. */
  label: string;
  /** Aktueller Zustand. */
  checked: boolean;
  /** Schaltet den Zustand um. */
  onChange: (checked: boolean) => void;
  /** Optionaler Zusatzhinweis (title/aria-description). */
  title?: string;
}

export function CheckboxField({ label, checked, onChange, title }: CheckboxFieldProps) {
  const labelId = useId();

  return (
    <label className="checkbox-field" title={title ?? label}>
      <input
        type="checkbox"
        className="checkbox-input"
        checked={checked}
        aria-labelledby={labelId}
        onChange={(event) => onChange(event.target.checked)}
      />
      {/* Sichtbares Kästchen; das eigentliche Input bleibt für Hilfstechnik erhalten. */}
      <span className="checkbox-box" aria-hidden="true">
        <span className="checkbox-mark">✓</span>
      </span>
      <span className="field-label" id={labelId}>
        {label}
      </span>
    </label>
  );
}
