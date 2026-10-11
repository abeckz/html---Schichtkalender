/**
 * ExtraColumnEditor.
 *
 * Eigener Editor für eine frei angelegte Zusatzspalte. Er gleicht in Aufbau und
 * Bedienung dem `DayEditor` (mehrzeilige Beschriftung, persönliche Farbe,
 * Escape schließt, Fokus bleibt im Dialog), ergänzt aber zwei Dinge:
 *
 * - Er wirkt **auf eine markierte Spanne** (Streifen-Auswahl) einer
 *   Zusatzspalte: die Farbe färbt alle markierten Zellen ein, der Text wird als
 *   ein Eintrag über die Spanne gespeichert.
 * - Eine Checkbox „Querliegender Text": ist sie aktiv, wird der Text um 90°
 *   nach links gedreht mittig über die Gesamtzahl der markierten Zellen gesetzt.
 *
 * Anders als der `DayEditor` kennt er weder Schicht noch Termin: er ist bewusst
 * auf die Zusatzspalte zugeschnitten (rein darstellungsbezogen, nicht gedruckt).
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { AnnotationColorId, ExtraColumnColorKey } from '../domain/types';
import { ColorPicker } from './ColorPicker';
import { CheckboxField } from './CheckboxField';
import { MAX_EXTRA_TEXT_LENGTH } from '../services/storage';
import { fitFontSize, labelLineClass } from '../utils/textFit';

export interface ExtraColumnEditorProps {
  /** Farbschlüssel der Spalte ('extra0', 'extra1', …). */
  colorKey: ExtraColumnColorKey;
  /** Anzeigename der Spalte (z. B. "Zusatzspalte 0"). */
  columnLabel: string;
  /** Markierte Spanne (chronologisch sortierte dateKeys). */
  dateKeys: readonly string[];
  /** Aktuelle Farbe der Spanne (null, wenn keine gesetzt ist). */
  initialColorId: AnnotationColorId | null;
  /** Bereits hinterlegter Text der Spanne (leer, wenn keiner existiert). */
  initialText: string;
  /** Bereits gesetzte Ausrichtung „Querliegender Text". */
  initialVertical: boolean;
  /** Setzt bzw. entfernt die Farbe der gesamten Spanne. */
  onSave: (
    dateKeys: readonly string[],
    colorKey: ExtraColumnColorKey,
    colorId: AnnotationColorId | null,
  ) => void;
  /** Setzt bzw. entfernt den querliegenden Text der Spanne. */
  onSaveText: (
    dateKeys: readonly string[],
    colorKey: ExtraColumnColorKey,
    columnLabel: string,
    vertical: boolean,
    text: string,
  ) => void;
  onClose: () => void;
}

export function ExtraColumnEditor({
  colorKey,
  columnLabel,
  dateKeys,
  initialColorId,
  initialText,
  initialVertical,
  onSave,
  onSaveText,
  onClose,
}: ExtraColumnEditorProps) {
  const [text, setText] = useState(initialText);
  const [vertical, setVertical] = useState(initialVertical);
  const [colorId, setColorId] = useState<AnnotationColorId | null>(initialColorId);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const labelId = useId();
  const colorGroupId = useId();

  // Beim Öffnen (bzw. Wechsel der Spalte/Spanne) den Zustand neu setzen.
  useEffect(() => {
    setText(initialText);
    setVertical(initialVertical);
    setColorId(initialColorId);
  }, [colorKey, dateKeys.join(','), initialText, initialVertical, initialColorId]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [colorKey]);

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

  const trimmedText = text.slice(0, MAX_EXTRA_TEXT_LENGTH);
  const lineClass = labelLineClass(trimmedText);
  const fontPx = fitFontSize(trimmedText);
  const hasChanges =
    trimmedText !== initialText || vertical !== initialVertical || colorId !== initialColorId;
  const first = dateKeys[0];
  const last = dateKeys[dateKeys.length - 1];
  const spanLabel =
    dateKeys.length === 0 ? '' : dateKeys.length === 1 ? first : `${first} – ${last}`;

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
          {columnLabel}
        </h2>

        <dl className="day-facts">
          <div className="day-fact">
            <dt>Bereich</dt>
            <dd>
              {dateKeys.length} {dateKeys.length === 1 ? 'Zelle' : 'Zellen'} ({spanLabel})
            </dd>
          </div>
        </dl>

        <div className="editor-field">
          <label className="field-label" htmlFor={labelId}>
            Text
          </label>
          <textarea
            id={labelId}
            ref={inputRef}
            className={`text-input editor-textarea ${lineClass}`}
            value={trimmedText}
            maxLength={MAX_EXTRA_TEXT_LENGTH}
            rows={3}
            placeholder="z. B. Urlaub, Schulung, Sperrzeit"
            style={{ fontSize: `${fontPx}px` }}
            onChange={(event) => setText(event.target.value.slice(0, MAX_EXTRA_TEXT_LENGTH))}
          />
          <span className="field-counter" aria-live="polite">
            {trimmedText.length}/{MAX_EXTRA_TEXT_LENGTH} Zeichen
          </span>
        </div>

        <div className="editor-field">
          <CheckboxField
            label="Querliegender Text"
            checked={vertical}
            onChange={setVertical}
            title="Text um 90° nach links gedreht mittig über die markierten Zellen setzen"
          />
        </div>

        <div className="editor-field" id={colorGroupId}>
          <span className="field-label">Farbe</span>
          <ColorPicker selectedColorId={colorId} onSelectColor={setColorId} />
        </div>

        <div className="editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onSaveText(dateKeys, colorKey, columnLabel, false, '');
              onClose();
            }}
            disabled={!hasChanges && initialText === ''}
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onSave(dateKeys, colorKey, colorId);
              onSaveText(dateKeys, colorKey, columnLabel, vertical, trimmedText);
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
