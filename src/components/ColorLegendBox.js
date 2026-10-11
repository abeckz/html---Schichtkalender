import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { getColorHex, getColorName } from '../config/annotationColors';
export function ColorLegendBox({ colors, texts, interactive = true, onEditColor, className, }) {
    if (colors.length === 0)
        return null;
    return (_jsx("div", { className: className ? `color-legend ${className}` : 'color-legend', children: colors.map((colorId) => {
            const hex = getColorHex(colorId);
            const text = texts[colorId] ?? getColorName(colorId);
            const label = `${getColorName(colorId)}: ${text}`;
            const swatch = (_jsx("span", { className: "color-legend-swatch", style: hex ? { backgroundColor: hex } : undefined, "aria-hidden": "true" }));
            const content = (_jsxs(_Fragment, { children: [swatch, _jsx("span", { className: "color-legend-text", children: text })] }));
            if (!interactive) {
                return (_jsx("span", { className: "color-legend-item color-legend-item-static", title: label, children: content }, colorId));
            }
            return (_jsx("button", { type: "button", className: "color-legend-item", onClick: () => onEditColor?.(colorId), title: `${label} – klicken zum Bearbeiten`, "aria-label": `${label} – klicken zum Bearbeiten`, children: content }, colorId));
        }) }));
}
