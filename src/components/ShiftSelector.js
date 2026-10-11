import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { SHIFT_IDS, getShiftDefinition } from '../config/shiftDefinitions';
export function ShiftSelector({ selectedShift, onSelectShift }) {
    return (_jsxs("div", { className: "toolbar-group", role: "group", "aria-label": "Schicht w\u00E4hlen", children: [_jsx("span", { className: "field-label", children: "Schicht" }), _jsx("div", { className: "shift-buttons", children: SHIFT_IDS.map((shiftId) => {
                    const isActive = shiftId === selectedShift;
                    return (_jsx("button", { type: "button", className: isActive ? 'shift-button is-active' : 'shift-button', onClick: () => onSelectShift(shiftId), "aria-pressed": isActive, title: getShiftDefinition(shiftId).displayName, children: shiftId }, shiftId));
                }) })] }));
}
