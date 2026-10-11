import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { ColorPicker } from './ColorPicker';
import { MAX_LABEL_LENGTH } from '../services/storage';
import { formatGermanDate } from '../utils/dateUtils';
import { fitFontSize, labelLineClass } from '../utils/textFit';
import { getShiftDefinition, shiftStateDescriptions } from '../config/shiftDefinitions';
export function DayEditor({ day, selectedShift, initialLabel, initialColorId, onSave, onReset, onClose, }) {
    const [label, setLabel] = useState(initialLabel);
    const [colorId, setColorId] = useState(initialColorId);
    const inputRef = useRef(null);
    const dialogRef = useRef(null);
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
    const trimmedLabel = label.slice(0, MAX_LABEL_LENGTH);
    const hasAnnotation = trimmedLabel !== '' || colorId !== null;
    const lineClass = labelLineClass(trimmedLabel);
    const fontPx = fitFontSize(trimmedLabel);
    return (_jsx("div", { className: "editor-backdrop no-print", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "day-editor", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, ref: dialogRef, onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { className: "day-editor-title", id: titleId, children: formatGermanDate(day.dateKey) }), _jsxs("dl", { className: "day-facts", children: [_jsxs("div", { className: "day-fact", children: [_jsx("dt", { children: "Schicht" }), _jsxs("dd", { children: [getShiftDefinition(selectedShift).displayName, " \u00B7", ' ', shiftStateDescriptions[day.shiftState]] })] }), day.events.length > 0 && (_jsxs("div", { className: "day-fact", children: [_jsx("dt", { children: "Termin" }), _jsx("dd", { children: day.events.map((event) => event.name).join(' · ') })] }))] }), _jsxs("div", { className: "editor-field", children: [_jsx("label", { className: "field-label", htmlFor: labelId, children: "Beschriftung" }), _jsx("textarea", { id: labelId, ref: inputRef, className: `text-input editor-textarea ${lineClass}`, value: trimmedLabel, maxLength: MAX_LABEL_LENGTH, rows: 3, placeholder: "z. B. Urlaub, Arzt, Schulung", style: { fontSize: `${fontPx}px` }, onChange: (event) => setLabel(event.target.value.slice(0, MAX_LABEL_LENGTH)) }), _jsxs("span", { className: "field-counter", "aria-live": "polite", children: [trimmedLabel.length, "/", MAX_LABEL_LENGTH, " Zeichen"] })] }), _jsxs("div", { className: "editor-field", id: colorGroupId, children: [_jsx("span", { className: "field-label", children: "Farbe" }), _jsx(ColorPicker, { selectedColorId: colorId, onSelectColor: setColorId })] }), _jsxs("div", { className: "editor-actions", children: [_jsx("button", { type: "button", className: "secondary-button", onClick: onClose, children: "Abbrechen" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => {
                                onReset(day.dateKey);
                                onClose();
                            }, disabled: !hasAnnotation, children: "Zur\u00FCcksetzen" }), _jsx("button", { type: "button", className: "primary-button", onClick: () => {
                                onSave(day.dateKey, trimmedLabel, colorId);
                                onClose();
                            }, children: "Speichern" })] })] }) }));
}
