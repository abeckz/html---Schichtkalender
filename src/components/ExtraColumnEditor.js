import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
import { ColorPicker } from './ColorPicker';
import { CheckboxField } from './CheckboxField';
import { MAX_EXTRA_TEXT_LENGTH } from '../services/storage';
import { fitFontSize, labelLineClass } from '../utils/textFit';
export function ExtraColumnEditor({ colorKey, columnLabel, dateKeys, initialColorId, initialText, initialVertical, onSave, onSaveText, onClose, }) {
    const [text, setText] = useState(initialText);
    const [vertical, setVertical] = useState(initialVertical);
    const [colorId, setColorId] = useState(initialColorId);
    const inputRef = useRef(null);
    const dialogRef = useRef(null);
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
    const trimmedText = text.slice(0, MAX_EXTRA_TEXT_LENGTH);
    const lineClass = labelLineClass(trimmedText);
    const fontPx = fitFontSize(trimmedText);
    const hasChanges = trimmedText !== initialText || vertical !== initialVertical || colorId !== initialColorId;
    const first = dateKeys[0];
    const last = dateKeys[dateKeys.length - 1];
    const spanLabel = dateKeys.length === 0 ? '' : dateKeys.length === 1 ? first : `${first} – ${last}`;
    return (_jsx("div", { className: "editor-backdrop no-print", role: "presentation", onClick: onClose, children: _jsxs("div", { className: "day-editor", role: "dialog", "aria-modal": "true", "aria-labelledby": titleId, ref: dialogRef, onClick: (event) => event.stopPropagation(), children: [_jsx("h2", { className: "day-editor-title", id: titleId, children: columnLabel }), _jsx("dl", { className: "day-facts", children: _jsxs("div", { className: "day-fact", children: [_jsx("dt", { children: "Bereich" }), _jsxs("dd", { children: [dateKeys.length, " ", dateKeys.length === 1 ? 'Zelle' : 'Zellen', " (", spanLabel, ")"] })] }) }), _jsxs("div", { className: "editor-field", children: [_jsx("label", { className: "field-label", htmlFor: labelId, children: "Text" }), _jsx("textarea", { id: labelId, ref: inputRef, className: `text-input editor-textarea ${lineClass}`, value: trimmedText, maxLength: MAX_EXTRA_TEXT_LENGTH, rows: 3, placeholder: "z. B. Urlaub, Schulung, Sperrzeit", style: { fontSize: `${fontPx}px` }, onChange: (event) => setText(event.target.value.slice(0, MAX_EXTRA_TEXT_LENGTH)) }), _jsxs("span", { className: "field-counter", "aria-live": "polite", children: [trimmedText.length, "/", MAX_EXTRA_TEXT_LENGTH, " Zeichen"] })] }), _jsx("div", { className: "editor-field", children: _jsx(CheckboxField, { label: "Querliegender Text", checked: vertical, onChange: setVertical, title: "Text um 90\u00B0 nach links gedreht mittig \u00FCber die markierten Zellen setzen" }) }), _jsxs("div", { className: "editor-field", id: colorGroupId, children: [_jsx("span", { className: "field-label", children: "Farbe" }), _jsx(ColorPicker, { selectedColorId: colorId, onSelectColor: setColorId })] }), _jsxs("div", { className: "editor-actions", children: [_jsx("button", { type: "button", className: "secondary-button", onClick: onClose, children: "Abbrechen" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => {
                                onSaveText(dateKeys, colorKey, columnLabel, false, '');
                                onClose();
                            }, disabled: !hasChanges && initialText === '', children: "Zur\u00FCcksetzen" }), _jsx("button", { type: "button", className: "primary-button", onClick: () => {
                                onSave(dateKeys, colorKey, colorId);
                                onSaveText(dateKeys, colorKey, columnLabel, vertical, trimmedText);
                                onClose();
                            }, children: "Speichern" })] })] }) }));
}
