import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ThemeToggleButton({ preference, symbol, name, isSelected, onSelect, }) {
    return (_jsxs("button", { type: "button", role: "radio", "aria-checked": isSelected, tabIndex: isSelected ? 0 : -1, className: isSelected ? 'theme-button is-active' : 'theme-button', onClick: () => onSelect(preference), title: `Anzeige ${name}`, "aria-label": `Anzeige ${name}`, children: [_jsx("span", { className: "theme-symbol", "aria-hidden": "true", children: symbol }), _jsx("span", { className: "theme-name", children: name })] }));
}
