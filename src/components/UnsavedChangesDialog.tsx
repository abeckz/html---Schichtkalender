/**
 * UnsavedChangesDialog.
 *
 * Weist auf noch nicht in einer Datei gesicherte Änderungen hin und
 * blockiert das Schließen des Fensters zunächst. Der Dialog erscheint, wenn
 * der Benutzer die Browser-Registerkarte schließen oder neu laden möchte,
 * während persönliche Markierungen oder Einstellungen noch nicht gesichert
 * wurden.
 *
 * Aufbau und Bedienung folgen dem DayEditor (Overlay, `role="dialog"`,
 * Escape schließt, Fokusfalle) und werden nie gedruckt.
 */

import { useEffect, useId, useRef } from 'react';

export interface UnsavedChangesDialogProps {
  /** Speichert die Daten und schließt den Dialog bei Erfolg. */
  onSave: () => void;
  /** Schließt/verwirft ohne Speichern. */
  onDiscard: () => void;
  /** Kehrt zur Anwendung zurück (bricht das Schließen ab). */
  onCancel: () => void;
}

export function UnsavedChangesDialog({ onSave, onDiscard, onCancel }: UnsavedChangesDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const textId = useId();

  // Fokus beim Öffnen auf die harmloseste Aktion (Abbrechen) legen.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  // Escape bricht das Schließen ab; der Fokus bleibt im Dialog.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
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
  }, [onCancel]);

  return (
    <div className="editor-backdrop no-print" role="presentation" onClick={onCancel}>
      <div
        className="day-editor unsaved-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="day-editor-title" id={titleId}>
          Ungespeicherte Daten
        </h2>
        <p className="unsaved-dialog-text" id={textId}>
          Es gibt Änderungen, die noch nicht in einer Datei gesichert wurden. Wenn Sie das Fenster
          jetzt schließen, gehen diese Änderungen verloren.
        </p>
        <div className="editor-actions">
          <button type="button" className="secondary-button" onClick={onCancel} ref={cancelRef}>
            Abbrechen
          </button>
          <button type="button" className="secondary-button" onClick={onDiscard}>
            Ohne Speichern schließen
          </button>
          <button type="button" className="primary-button" onClick={onSave}>
            Jetzt sichern
          </button>
        </div>
      </div>
    </div>
  );
}
