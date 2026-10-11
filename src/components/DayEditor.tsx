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
import type { AnnotationColorId, CalendarDay } from '../domain/types';
import { ColorPicker } from './ColorPicker';
import { MAX_LABEL_LENGTH } from '../services/storage';
import { formatGermanDate } from '../utils/dateUtils';
import { fitFontSize, labelLineClass } from '../utils/textFit';
import { getShiftDefinition, shiftStateDescriptions } from '../config/shiftDefinitions';
import type { ShiftId } from '../domain/types';

export interface DayEditorProps {
  day: CalendarDay;
  selectedShift: ShiftId;
  initialLabel: string;
  initialColorId: AnnotationColorId | null;
  onSave: (dateKey: string, label: string, colorId: AnnotationColorId | null) => void;
  onReset: (dateKey: string) => void;
  onClose: () => void;
}

export function DayEditor({
  day,
  selectedShift,
  initialLabel,
  initialColorId,
  onSave,
  onReset,
  onClose,
}: DayEditorProps) {
  const [label, setLabel] = useState(initialLabel);
  const [colorId, setColorId] = useState<AnnotationColorId | null>(initialColorId);
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
  const hasAnnotation = trimmedLabel !== '' || colorId !== null;
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
              onSave(day.dateKey, trimmedLabel, colorId);
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
