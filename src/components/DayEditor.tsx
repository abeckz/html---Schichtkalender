/**
 * DayEditor.
 *
 * Öffnet sich als Dialog bei Klick oder Touch auf einen Kalendertag und
 * erlaubt eine mehrzeilige Beschriftung (maximal 50 Zeichen, bis zu drei
 * Zeilen) sowie eine persönliche Farbe.
 *
 * Die Schrift des Eingabefeldes passt sich der Zeilenzahl an: eine einzelne
 * Zeile erscheint groß, drei Zeilen deutlich kleiner. Dafür wird dieselbe
 * messfreie Logik wie in Kalender- und Druckzelle verwendet
 * (`labelLineClass` / `fitFontSize`).
 *
 * "Zurücksetzen" entfernt ausschließlich Beschriftung und Farbe; alle
 * automatisch berechneten Daten (Events, Schicht, Datum) bleiben erhalten.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { AnnotationColorId, CalendarDay, ExtraColumnColorKey } from '../domain/types';
import { ColorPicker } from './ColorPicker';
import { MAX_LABEL_LENGTH } from '../services/storage';
import { formatGermanDate } from '../utils/dateUtils';
import { fitFontSize, labelLineClass } from '../utils/textFit';
import { getShiftDefinition, shiftStateDescriptions } from '../config/shiftDefinitions';
import type { ShiftId } from '../domain/types';

/**
 * Ein Farbfeld einer frei angelegten Zusatzspalte im DayEditor.
 *
 * Für jede an diesem Tag vorhandene Zusatzspalte wird ein eigenes Feld
 * angeboten; `key` ist der stabile Farbschlüssel (`extra0`, `extra1`, …),
 * `label` der Anzeigename (z. B. "Zusatzspalte 0").
 */
export interface ExtraColumnColorField {
  key: ExtraColumnColorKey;
  label: string;
  colorId: AnnotationColorId | null;
}

export interface DayEditorProps {
  day: CalendarDay;
  selectedShift: ShiftId;
  initialLabel: string;
  initialColorId: AnnotationColorId | null;
  /**
   * Vorhandene Zusatzspalten des Tages mit ihrer aktuellen Farbe. Der Editor
   * zeigt je Spalte ein eigenes Farbfeld. Ohne Eintrag bleibt der Editor wie
   * bisher (nur Beschriftung und Info-Farbe).
   */
  extraColumnFields?: ExtraColumnColorField[];
  onSave: (
    dateKey: string,
    label: string,
    colorId: AnnotationColorId | null,
    extraColors?: Partial<Record<ExtraColumnColorKey, AnnotationColorId | null>>,
  ) => void;
  onReset: (dateKey: string) => void;
  onClose: () => void;
}

/**
 * Ausgangsfarben der Zusatzspalten-Felder: Farbschlüssel -> aktuelle Farbe.
 */
function initialExtraColors(
  fields: readonly ExtraColumnColorField[],
): Partial<Record<ExtraColumnColorKey, AnnotationColorId | null>> {
  const result: Partial<Record<ExtraColumnColorKey, AnnotationColorId | null>> = {};
  for (const field of fields) {
    result[field.key] = field.colorId;
  }
  return result;
}

export function DayEditor({
  day,
  selectedShift,
  initialLabel,
  initialColorId,
  extraColumnFields = [],
  onSave,
  onReset,
  onClose,
}: DayEditorProps) {
  const [label, setLabel] = useState(initialLabel);
  const [colorId, setColorId] = useState<AnnotationColorId | null>(initialColorId);
  // Farbe je Zusatzspalte, geschlüsselt nach dem stabilen Farbschlüssel.
  const [extraColors, setExtraColors] = useState<
    Partial<Record<ExtraColumnColorKey, AnnotationColorId | null>>
  >(() => initialExtraColors(extraColumnFields));
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const labelId = useId();
  const colorGroupId = useId();

  // Beim Öffnen und beim Wechsel des Tages den Zustand neu setzen und den
  // Fokus in das Beschriftungsfeld legen (Fokusmanagement laut Spezifikation).
  useEffect(() => {
    setLabel(initialLabel);
    setColorId(initialColorId);
    setExtraColors(initialExtraColors(extraColumnFields));
    // extraColumnFields wird bewusst nicht als Abhängigkeit geführt: die Felder
    // gehören zum geöffneten Tag und ändern sich nicht während der Bearbeitung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day.dateKey, initialLabel, initialColorId]);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, [day.dateKey]);

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

  const trimmedLabel = label.slice(0, MAX_LABEL_LENGTH);
  const hasExtraColor = Object.values(extraColors).some((value) => value !== null && value !== undefined);
  const hasAnnotation = trimmedLabel !== '' || colorId !== null || hasExtraColor;
  const lineClass = labelLineClass(trimmedLabel);
  const fontPx = fitFontSize(trimmedLabel);

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
          {formatGermanDate(day.dateKey)}
        </h2>

        <dl className="day-facts">
          <div className="day-fact">
            <dt>Schicht</dt>
            <dd>
              {getShiftDefinition(selectedShift).displayName} ·{' '}
              {shiftStateDescriptions[day.shiftState]}
            </dd>
          </div>
          {day.events.length > 0 && (
            <div className="day-fact">
              <dt>Termin</dt>
              <dd>{day.events.map((event) => event.name).join(' · ')}</dd>
            </div>
          )}
        </dl>

        <div className="editor-field">
          <label className="field-label" htmlFor={labelId}>
            Beschriftung
          </label>
          <textarea
            id={labelId}
            ref={inputRef}
            className={`text-input editor-textarea ${lineClass}`}
            value={trimmedLabel}
            maxLength={MAX_LABEL_LENGTH}
            rows={3}
            placeholder="z. B. Urlaub, Arzt, Schulung"
            style={{ fontSize: `${fontPx}px` }}
            onChange={(event) => setLabel(event.target.value.slice(0, MAX_LABEL_LENGTH))}
          />
          <span className="field-counter" aria-live="polite">
            {trimmedLabel.length}/{MAX_LABEL_LENGTH} Zeichen
          </span>
        </div>

        <div className="editor-field" id={colorGroupId}>
          <span className="field-label">Farbe</span>
          <ColorPicker selectedColorId={colorId} onSelectColor={setColorId} />
        </div>

        {extraColumnFields.length > 0 && (
          <div className="editor-field editor-extra-colors">
            <span className="field-label">Zusatzspalten</span>
            {extraColumnFields.map((field) => (
              <div className="editor-extra-color" key={field.key}>
                <span className="editor-extra-color-name">{field.label}</span>
                <ColorPicker
                  selectedColorId={extraColors[field.key] ?? null}
                  onSelectColor={(selected) =>
                    setExtraColors((current) => ({ ...current, [field.key]: selected }))
                  }
                />
              </div>
            ))}
          </div>
        )}

        <div className="editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              onReset(day.dateKey);
              onClose();
            }}
            disabled={!hasAnnotation}
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onSave(
                day.dateKey,
                trimmedLabel,
                colorId,
                extraColumnFields.length > 0 ? extraColors : undefined,
              );
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
