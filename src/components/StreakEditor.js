import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { ColorPicker } from './ColorPicker';
/** Beschriftung der festen Farbspalten für die Zusammenfassung. */
const COLUMN_LABELS = {
    weekday: 'Wochentag',
    day: 'Tagesnummer',
    shift: 'T/N',
    info: 'Info',
};
export function StreakEditor({ days, column, columnLabel, onApply, onClose }) {
    const [colorId, setColorId] = useState(null);
    const dialogRef = useRef(null);
    const titleId = useId();
    const colorGroupId = useId();
    // Escape schließt den Dialog; der Fokus wird im Dialog gehalten.
    useEffect(() => {
        function handleKeyDown(event) {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
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
    }, [onClose]);
    const dateKeys = useMemo(() => days.map((day) => day.dateKey), [days]);
    const dayCount = days.length;
    const first = days[0];
    const last = days[dayCount - 1];
    const rangeLabel = dayCount === 0
        ? ''
        : dayCount === 1
            ? `${first.day}.${first.month}.`
            : `${first.day}.${first.month}. – ${last.day}.${last.month}.`;
    if (dayCount === 0)
        return null;
    const displayColumn = columnLabel ?? COLUMN_LABELS[column];
    return (_jsx("div", { className: "editor-backdrop no-print", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "day-editor", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, ref: dialogRef, onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { className: "day-editor-title", id: titleId, children: "Streifen einf\u00E4rben" }), _jsxs("p", { className: "streak-summary", children: ["Spalte \u201E", displayColumn, "\u201C \u2013 ", dayCount, " ", dayCount === 1 ? 'Tag' : 'Tage', " markiert (", rangeLabel, ")"] }), _jsxs("div", { className: "editor-field", id: colorGroupId, children: [_jsx("span", { className: "field-label", children: "Farbe" }), _jsx(ColorPicker, { selectedColorId: colorId, onSelectColor: setColorId })] }), _jsxs("div", { className: "editor-actions", children: [_jsx("button", { type: "button", className: "secondary-button", onClick: onClose, children: "Abbrechen" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => {
                                onApply(dateKeys, column, null);
                                onClose();
                            }, children: "Farbe entfernen" }), _jsx("button", { type: "button", className: "primary-button", disabled: colorId === null, onClick: () => {
                                onApply(dateKeys, column, colorId);
                                onClose();
                            }, children: "Einf\u00E4rben" })] })] }) }));
}
