/**
 * StreakEditor.
 *
 * Öffnet sich, nachdem mit gedrückter und gezogener Maustaste ein senkrechter
 * Streifen über mehrere Tage markiert wurde (Wochentag, Tagesnummer oder
 * T/N-Spalte). Er erlaubt ausschließlich das Einfärben dieses Streifens über
 * die bestehende Farbpalette - vergleichbar mit einem durchgehenden
 * Ferien-Balken.
 *
 * Bestehende Beschriftungen der markierten Tage bleiben unverändert
 * erhalten; der StreakEditor setzt nur die Farbwahl. "Farbe entfernen" nimmt
 * die Farbe wieder weg, ohne eine Beschriftung zu löschen.
 *
 * Bedienung wie beim DayEditor: Escape schließt, der Fokus bleibt im Dialog.
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { AnnotationColorId, CalendarDay, ColumnColorName } from '../domain/types';
import { ColorPicker } from './ColorPicker';

export interface StreakEditorProps {
  /** Markierte Tage in chronologischer Reihenfolge. */
  days: readonly CalendarDay[];
  /** Spalte, in der der Streifen gezogen wurde (Wochentag, Tagesnummer oder T/N). */
  column: ColumnColorName;
  onApply: (
    dateKeys: readonly string[],
    column: ColumnColorName,
    colorId: AnnotationColorId | null,
  ) => void;
  onClose: () => void;
}

/** Beschriftung der gefärbten Spalte für die Zusammenfassung. */
const COLUMN_LABELS: Record<ColumnColorName, string> = {
  weekday: 'Wochentag',
  day: 'Tagesnummer',
  shift: 'T/N',
  info: 'Info',
};

export function StreakEditor({ days, column, onApply, onClose }: StreakEditorProps) {
  const [colorId, setColorId] = useState<AnnotationColorId | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const colorGroupId = useId();

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

  const dateKeys = useMemo(() => days.map((day) => day.dateKey), [days]);
  const dayCount = days.length;
  const first = days[0];
  const last = days[dayCount - 1];
  const rangeLabel =
    dayCount === 0
      ? ''
      : dayCount === 1
        ? `${first.day}.${first.month}.`
        : `${first.day}.${first.month}. – ${last.day}.${last.month}.`;

  if (dayCount === 0) return null;

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
          Streifen einfärben
        </h2>

        <p className="streak-summary">
          Spalte „{COLUMN_LABELS[column]}“ – {dayCount} {dayCount === 1 ? 'Tag' : 'Tage'} markiert ({rangeLabel})
        </p>

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
              onApply(dateKeys, column, null);
              onClose();
            }}
          >
            Farbe entfernen
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={colorId === null}
            onClick={() => {
              onApply(dateKeys, column, colorId);
              onClose();
            }}
          >
            Einfärben
          </button>
        </div>
      </div>
    </div>
  );
}
