import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getShiftDefinition } from '../config/shiftDefinitions';
/** Erste Zeile: die Systeme I–III. */
const SHIFT_ROW_I_III = ['I', 'II', 'III'];
/** Zweite Zeile: die Systeme A–D. */
const SHIFT_ROW_A_D = ['A', 'B', 'C', 'D'];
export function ShiftSelector({ selectedShift, onSelectShift }) {
    const renderShift = (shiftId) => {
        const isActive = shiftId === selectedShift;
        return (_jsx("button", { type: "button", className: isActive ? 'shift-button is-active' : 'shift-button', onClick: () => onSelectShift(shiftId), "aria-pressed": isActive, title: getShiftDefinition(shiftId).displayName, children: shiftId }, shiftId));
    };
    return (_jsxs("div", { className: "toolbar-group", role: "group", "aria-label": "Schicht w\u00E4hlen", children: [_jsx("span", { className: "field-label", children: "Schicht" }), _jsxs("div", { className: "shift-buttons", children: [_jsx("div", { className: "shift-row", children: SHIFT_ROW_I_III.map(renderShift) }), _jsx("div", { className: "shift-row", children: SHIFT_ROW_A_D.map(renderShift) })] })] }));
}
