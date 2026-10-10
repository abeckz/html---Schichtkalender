/**
 * ColorLegendEditor.
 *
 * Eingabedialog für den Erklärtext einer Farbe in der Farblegende. Öffnet
 * sich beim Klick auf eine Farbbox der Legende und erlaubt einen Freitext
 * (maximal MAX_LEGEND_TEXT_LENGTH Zeichen).
 *
 * Bedienung wie beim DayEditor: Escape schließt, der Fokus bleibt im Dialog,
 * ein Klick außerhalb schließt ebenfalls. "Löschen" entfernt die Erklärung,
 * ohne die Farbe oder die Markierungen selbst anzutasten.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { AnnotationColorId } from '../domain/types';
import { getColorHex, getColorName } from '../config/annotationColors';
import { MAX_LEGEND_TEXT_LENGTH } from '../services/storage';

export interface ColorLegendEditorProps {
  colorId: AnnotationColorId;
  /** Jahr, auf das sich die Erklärung bezieht. */
  year: number;
  /** Aktueller Erklärtext (leer, wenn keiner hinterlegt ist). */
  initialText: string;
  onSave: (year: number, colorId: AnnotationColorId, text: string) => void;
  onClose: () => void;
}

export function ColorLegendEditor({
  colorId,
  year,
  initialText,
  onSave,
  onClose,
}: ColorLegendEditorProps) {
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const labelId = useId();

  const colorName = getColorName(colorId);
  const colorHex = getColorHex(colorId);

  // Beim Öffnen bzw. Farbwechsel den Text setzen und den Fokus ins Feld legen.
  useEffect(() => {
    setText(initialText);
  }, [colorId, year, initialText]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [colorId, year]);

  // Escape schließt den Dialog; der Fokus wird im Dialog gehalten.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const trimmedText = text.slice(0, MAX_LEGEND_TEXT_LENGTH);

  return (
    <div className="editor-backdrop no-print" role="presentation" onClick={onClose}>
      <div
        className="day-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="day-editor-title" id={titleId}>
          Farbe erklären – {colorName} {year}
        </h2>

        <p className="color-legend-editor-preview">
          <span
            className="color-legend-swatch"
            style={colorHex ? { backgroundColor: colorHex } : undefined}
            aria-hidden="true"
          />
          <span className="color-legend-text">{trimmedText || colorName}</span>
        </p>

        <div className="editor-field">
          <label className="field-label" htmlFor={labelId}>
            Erklärung
          </label>
          <input
            id={labelId}
            ref={inputRef}
            type="text"
            className="text-input"
            value={trimmedText}
            maxLength={MAX_LEGEND_TEXT_LENGTH}
            placeholder="z. B. Urlaub, Schulung, freier Wunschtag"
            onChange={(event) => setText(event.target.value.slice(0, MAX_LEGEND_TEXT_LENGTH))}
          />
          <span className="field-counter" aria-live="polite">
            {trimmedText.length}/{MAX_LEGEND_TEXT_LENGTH} Zeichen
          </span>
        </div>

        <div className="editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onSave(year, colorId, '');
              onClose();
            }}
            disabled={trimmedText === '' && initialText === ''}
          >
            Löschen
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onSave(year, colorId, trimmedText);
              onClose();
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
