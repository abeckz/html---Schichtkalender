import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** Von einem Kreis umschlossenes Pluszeichen. */
export function PlusInCircle() {
    return (_jsxs("svg", { className: "column-insert-icon", viewBox: "0 0 16 16", width: "100%", height: "100%", "aria-hidden": "true", focusable: "false", children: [_jsx("circle", { cx: "8", cy: "8", r: "7", fill: "var(--color-surface)", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M8 4.4 V11.6 M4.4 8 H11.6", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }));
}
/** Von einem Kreis umschlossenes Minuszeichen (Spalte entfernen). */
export function MinusInCircle() {
    return (_jsxs("svg", { className: "column-insert-icon", viewBox: "0 0 16 16", width: "100%", height: "100%", "aria-hidden": "true", focusable: "false", children: [_jsx("circle", { cx: "8", cy: "8", r: "7", fill: "var(--color-surface)", stroke: "currentColor", strokeWidth: "1.4" }), _jsx("path", { d: "M4.4 8 H11.6", stroke: "currentColor", strokeWidth: "1.4", strokeLinecap: "round" })] }));
}
export function ColumnInsertHandle({ side, onActivate }) {
    const label = side === 'left'
        ? 'Neue schmale Zusatzspalte links der Ereigniszelle anfügen'
        : 'Neue schmale Zusatzspalte vor T/N anfügen';
    const handleClick = (event) => {
        // Der Klick steuert ausschließlich die Spaltenanlage; der Monatskopf hat
        // keine weitere Klickfunktion, die versehentlich ausgelöst werden könnte.
        event.preventDefault();
        event.stopPropagation();
        onActivate(side);
    };
    return (_jsx("button", { type: "button", className: "column-insert-handle", "data-extra-column-side": side, title: label, "aria-label": label, onClick: handleClick, onDoubleClick: (event) => event.preventDefault(), children: _jsx(PlusInCircle, {}) }));
}
/**
 * Bedienpunkt "Zusatzspalte entfernen".
 *
 * Er sitzt - wie der `+`-Punkt - im Monatskopf auf der jeweiligen Trennlinie,
 * ist jedoch tiefer versetzt, damit sich beide Punkte nicht überlagern. Ein
 * Klick entfernt die Spalte an der Trennlinie vollständig; die übrigen Spalten
 * der Seite rücken nach. Ohne Spalte an der Linie (nearEdgeIndex < 0) wird der
 * Punkt nicht dargestellt: es gibt nichts zu entfernen.
 */
export function ColumnRemoveHandle({ side, nearEdgeIndex, onActivate }) {
    if (nearEdgeIndex < 0)
        return null;
    const label = side === 'left' ? 'Zusatzspalte links entfernen' : 'Zusatzspalte rechts entfernen';
    const handleClick = (event) => {
        event.preventDefault();
        event.stopPropagation();
        onActivate(side, nearEdgeIndex);
    };
    return (_jsx("button", { type: "button", className: "column-remove-handle", "data-extra-column-side": side, title: label, "aria-label": label, onClick: handleClick, onDoubleClick: (event) => event.preventDefault(), children: _jsx(MinusInCircle, {}) }));
}
