/**
 * Farblegende-Box.
 *
 * Zeigt für jede tatsächlich benutzte Markierungsfarbe einen Farbblock mit
 * ihrer Erklärung. Der Text ist die jahresbezogene Erklärung aus der
 * Farblegende; fehlt sie, erscheint der deutsche Farbname als Vorgabe.
 *
 * In der Bildschirmansicht ist die Box interaktiv: ein Klick auf einen Block
 * öffnet den Eingabedialog (ColorLegendEditor). In der Druckansicht wird die
 * Box mit `interactive={false}` ausschließlich dargestellt.
 *
 * Die Information wird niemals allein über Farbe transportiert: jeder Block
 * steht grundsätzlich neben seinem Text.
 */

import type { AnnotationColorId } from '../domain/types';
import { getColorHex, getColorName } from '../config/annotationColors';

export interface ColorLegendBoxProps {
  /** Benutzte Farben in Anzeigereihenfolge (Palette). */
  colors: readonly AnnotationColorId[];
  /** Erklärungstexte je Farbe (fehlende Einträge fallen auf den Farbnamen zurück). */
  texts: Partial<Record<AnnotationColorId, string>>;
  /** true (Standard) = Klick öffnet den Bearbeitungsdialog. */
  interactive?: boolean;
  /** Klick auf eine Farbbox (nur wenn `interactive`). */
  onEditColor?: (colorId: AnnotationColorId) => void;
  /** Zusätzliche CSS-Klasse (z. B. für die Druckansicht). */
  className?: string;
}

export function ColorLegendBox({
  colors,
  texts,
  interactive = true,
  onEditColor,
  className,
}: ColorLegendBoxProps) {
  if (colors.length === 0) return null;

  return (
    <div className={className ? `color-legend ${className}` : 'color-legend'}>
      {colors.map((colorId) => {
        const hex = getColorHex(colorId);
        const text = texts[colorId] ?? getColorName(colorId);
        const label = `${getColorName(colorId)}: ${text}`;
        const swatch = (
          <span
            className="color-legend-swatch"
            style={hex ? { backgroundColor: hex } : undefined}
            aria-hidden="true"
          />
        );
        const content = (
          <>
            {swatch}
            <span className="color-legend-text">{text}</span>
          </>
        );

        if (!interactive) {
          return (
            <span className="color-legend-item color-legend-item-static" key={colorId} title={label}>
              {content}
            </span>
          );
        }

        return (
          <button
            type="button"
            className="color-legend-item"
            key={colorId}
            onClick={() => onEditColor?.(colorId)}
            title={`${label} – klicken zum Bearbeiten`}
            aria-label={`${label} – klicken zum Bearbeiten`}
          >
            {content}
          </button>
        );
      })}
    </div>
  );
}
