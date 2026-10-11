import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ToggleSwitch.
 *
 * Zugänglicher Umschalter im Stil moderner Apps (Windows/iOS): ein runder
 * Knopf, der in einem Langloch (Pille) nach links bzw. rechts gleitet. Der
 * Zustand wird zusätzlich über den sichtbaren Text ("Ein"/"Aus") transportiert
 * und ist damit nicht ausschließlich über Farbe erfassbar.
 *
 * Reines Bedienelement: der Schalter kennt keine Fachdaten und wird niemals
 * gedruckt.
 */
import { useId } from 'react';
export function ToggleSwitch({ label, checked, onChange, title, stateLabels = ['Ein', 'Aus'], showState = true, trailingLabel, inverted = false, }) {
    const labelId = useId();
    const [onLabel, offLabel] = stateLabels;
    const stateText = checked ? onLabel : offLabel;
    return (_jsxs("div", { className: "toggle-field", children: [_jsx("span", { className: "field-label", id: labelId, children: label }), _jsxs("button", { type: "button", className: [
                    'toggle-switch',
                    checked ? 'is-checked' : '',
                    inverted ? 'is-inverted' : '',
                ]
                    .filter(Boolean)
                    .join(' '), role: "switch", "aria-checked": checked, "aria-labelledby": labelId, title: title ?? `${label}: ${stateText}`, onClick: () => onChange(!checked), children: [showState ? _jsx("span", { className: "toggle-switch-state", children: stateText }) : null, _jsx("span", { className: "toggle-switch-track", "aria-hidden": "true", children: _jsx("span", { className: "toggle-switch-knob" }) })] }), trailingLabel ? _jsx("span", { className: "toggle-field-trailing", children: trailingLabel }) : null] }));
}
