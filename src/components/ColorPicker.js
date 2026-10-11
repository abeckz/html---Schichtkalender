import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { annotationColors, NO_COLOR_NAME, getColorHex } from '../config/annotationColors';
export function ColorPicker({ selectedColorId, onSelectColor }) {
    return (_jsxs("div", { className: "color-picker", role: "radiogroup", "aria-label": "Farbe", onKeyDown: (event) => {
            if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft')
                return;
            event.preventDefault();
            const options = [
                null,
                ...annotationColors.map((color) => color.id),
            ];
            const currentIndex = options.indexOf(selectedColorId);
            const step = event.key === 'ArrowRight' ? 1 : -1;
            const nextIndex = (currentIndex + step + options.length) % options.length;
            onSelectColor(options[nextIndex]);
        }, children: [_jsx(ColorOption, { colorId: null, name: NO_COLOR_NAME, hex: null, isSelected: selectedColorId === null, onSelect: onSelectColor }), annotationColors.map((color) => (_jsx(ColorOption, { colorId: color.id, name: color.name, hex: color.hex, isSelected: selectedColorId === color.id, onSelect: onSelectColor }, color.id)))] }));
}
function ColorOption({ colorId, name, hex, isSelected, onSelect }) {
    const safeHex = getColorHex(colorId) ?? hex ?? null;
    return (_jsxs("button", { type: "button", role: "radio", "aria-checked": isSelected, tabIndex: isSelected ? 0 : -1, className: isSelected ? 'color-option is-selected' : 'color-option', onClick: () => onSelect(colorId), title: name, children: [_jsx("span", { className: safeHex ? 'color-swatch' : 'color-swatch color-swatch-none', style: safeHex ? { backgroundColor: safeHex } : undefined, "aria-hidden": "true", children: isSelected ? '✓' : '' }), _jsx("span", { className: "color-name", children: name })] }));
}
