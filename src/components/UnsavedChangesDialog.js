import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
export function UnsavedChangesDialog({ onSave, onDiscard, onCancel }) {
    const dialogRef = useRef(null);
    const cancelRef = useRef(null);
    const titleId = useId();
    const textId = useId();
    // Fokus beim Öffnen auf die harmloseste Aktion (Abbrechen) legen.
    useEffect(() => {
        cancelRef.current?.focus();
    }, []);
    // Escape bricht das Schließen ab; der Fokus bleibt im Dialog.
    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onCancel();
                return;
            }
            if (event.key === 'Tab' && dialogRef.current) {
                const focusable = dialogRef.current.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
                if (focusable.length === 0)
                    return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                }
                else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onCancel]);
    return (_jsx("div", { className: "editor-backdrop no-print", role: "presentation", onClick: onCancel, children: _jsxs("div", { className: "day-editor unsaved-dialog", role: "alertdialog", "aria-modal": "true", "aria-labelledby": titleId, "aria-describedby": textId, ref: dialogRef, onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { className: "day-editor-title", id: titleId, children: "Ungespeicherte Daten" }), _jsx("p", { className: "unsaved-dialog-text", id: textId, children: "Es gibt \u00C4nderungen, die noch nicht in einer Datei gesichert wurden. Wenn Sie das Fenster jetzt schlie\u00DFen, gehen diese \u00C4nderungen verloren." }), _jsxs("div", { className: "editor-actions", children: [_jsx("button", { type: "button", className: "secondary-button", onClick: onCancel, ref: cancelRef, children: "Abbrechen" }), _jsx("button", { type: "button", className: "secondary-button", onClick: onDiscard, children: "Ohne Speichern schlie\u00DFen" }), _jsx("button", { type: "button", className: "primary-button", onClick: onSave, children: "Jetzt sichern" })] })] }) }));
}
