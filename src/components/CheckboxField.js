import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * CheckboxField.
 *
 * Anzeige-Kästchen im Stil moderner Apps: ein echtes Kästchen mit Häkchen und
 * die Beschriftung rechts daneben. Anders als die Pille (ToggleSwitch) ist
 * dieses Bedienelement bewusst ein Kästchen, weil es eine Mehrfachauswahl
 * innerhalb einer Gruppe darstellt.
 *
 * Reines Bedienelement: der Kasten kennt keine Fachdaten und wird niemals
 * gedruckt.
 */
import { useId } from 'react';
export function CheckboxField({ label, checked, onChange, title }) {
    const labelId = useId();
    return (_jsxs("label", { className: "checkbox-field", title: title ?? label, children: [_jsx("input", { type: "checkbox", className: "checkbox-input", checked: checked, "aria-labelledby": labelId, onChange: (event) => onChange(event.target.checked) }), _jsx("span", { className: "checkbox-box", "aria-hidden": "true", children: _jsx("span", { className: "checkbox-mark", children: "\u2713" }) }), _jsx("span", { className: "field-label", id: labelId, children: label })] }));
}
