import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Jahr-Auswahl mit Vorjahr/Folgejahr.
 *
 * Reines Screen-Element: wird im Druck niemals angezeigt.
 *
 * Aufbau wie bei der Schichtauswahl: links die Beschriftung "JAHR", daneben die
 * Bedienelemente `<` / Auswahlfeld / `>`. Der zugängliche Name des Auswahlfelds
 * (aria-label) bleibt erhalten.
 */
import { SELECTABLE_YEARS } from '../config/appDefaults';
export function YearSelector({ year, onSelectYear, onPreviousYear, onNextYear, canGoPrevious, canGoNext, }) {
    const years = SELECTABLE_YEARS.includes(year)
        ? SELECTABLE_YEARS
        : [...SELECTABLE_YEARS, year].sort((a, b) => a - b);
    return (_jsxs("div", { className: "toolbar-group", role: "group", "aria-label": "Jahr w\u00E4hlen", children: [_jsx("span", { className: "field-label", children: "Jahr" }), _jsxs("div", { className: "year-controls", children: [_jsx("button", { type: "button", className: "icon-button", onClick: onPreviousYear, disabled: !canGoPrevious, "aria-label": "Vorjahr", title: "Vorjahr", children: "\u2039" }), _jsx("select", { className: "year-select", value: year, onChange: (event) => onSelectYear(Number(event.target.value)), "aria-label": "Jahr", children: years.map((option) => (_jsx("option", { value: option, children: option }, option))) }), _jsx("button", { type: "button", className: "icon-button", onClick: onNextYear, disabled: !canGoNext, "aria-label": "Folgejahr", title: "Folgejahr", children: "\u203A" })] })] }));
}
