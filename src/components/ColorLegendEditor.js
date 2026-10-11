import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
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
import { getColorHex, getColorName } from '../config/annotationColors';
import { MAX_LEGEND_TEXT_LENGTH } from '../services/storage';
export function ColorLegendEditor({ colorId, year, initialText, onSave, onClose, }) {
    const [text, setText] = useState(initialText);
    const inputRef = useRef(null);
    const dialogRef = useRef(null);
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
    const trimmedText = text.slice(0, MAX_LEGEND_TEXT_LENGTH);
    return (_jsx("div", { className: "editor-backdrop no-print", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "day-editor", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, ref: dialogRef, onClick: (event) => event.stopPropagation(), children: [_jsxs("h2", { className: "day-editor-title", id: titleId, children: ["Farbe erkl\u00E4ren \u2013 ", colorName, " ", year] }), _jsxs("p", { className: "color-legend-editor-preview", children: [_jsx("span", { className: "color-legend-swatch", style: colorHex ? { backgroundColor: colorHex } : undefined, "aria-hidden": "true" }), _jsx("span", { className: "color-legend-text", children: trimmedText || colorName })] }), _jsxs("div", { className: "editor-field", children: [_jsx("label", { className: "field-label", htmlFor: labelId, children: "Erkl\u00E4rung" }), _jsx("input", { id: labelId, ref: inputRef, type: "text", className: "text-input", value: trimmedText, maxLength: MAX_LEGEND_TEXT_LENGTH, placeholder: "z. B. Urlaub, Schulung, freier Wunschtag", onChange: (event) => setText(event.target.value.slice(0, MAX_LEGEND_TEXT_LENGTH)) }), _jsxs("span", { className: "field-counter", "aria-live": "polite", children: [trimmedText.length, "/", MAX_LEGEND_TEXT_LENGTH, " Zeichen"] })] }), _jsxs("div", { className: "editor-actions", children: [_jsx("button", { type: "button", className: "secondary-button", onClick: onClose, children: "Abbrechen" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => {
                                onSave(year, colorId, '');
                                onClose();
                            }, disabled: trimmedText === '' && initialText === '', children: "L\u00F6schen" }), _jsx("button", { type: "button", className: "primary-button", onClick: () => {
                                onSave(year, colorId, trimmedText);
                                onClose();
                            }, children: "Speichern" })] })] }) }));
}
