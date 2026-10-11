import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { annotationColors, getColorHex } from '../config/annotationColors';
import { CalendarDayRow } from './CalendarDayRow';
/**
 * Zählt die in der Schichtspalte (T/N) markierten Schichten je Farbe.
 *
 * Berücksichtigt werden ausschließlich Tage, die tatsächlich eine Schicht
 * tragen ("T" oder "N", also `shiftLabel !== ''`). Freie Tage des Zyklus
 * (OFF) werden nicht gezählt, selbst wenn die Schichtspalte dort eingefärbt
 * wurde. Gezählt wird nur die Spalte 'shift'; die übrigen Farbspalten
 * (Wochentag, Tagesnummer, Info) bleiben ohne Wirkung.
 *
 * Das Ergebnis ist nach der Reihenfolge der Farbpalette sortiert, damit die
 * Anzeige unabhängig von der Reihenfolge der Annotationen stabil bleibt.
 */
export function countMarkedShiftsByColor(days, annotations) {
    return countMarkedShiftsByColorLookup(days, (dateKey) => annotations[dateKey]?.colors.shift);
}
/**
 * Variante von `countMarkedShiftsByColor` für die Druckansicht, die mit einer
 * Farbtabelle (datumsschlüssel -> Spaltenfarben) arbeitet, statt mit der
 * vollständigen AnnotationMap.
 */
export function countMarkedShiftsByColorTable(days, colorTable) {
    return countMarkedShiftsByColorLookup(days, (dateKey) => colorTable[dateKey]?.shift);
}
/**
 * Gemeinsamer Kern: zählt je Farbe die erfassten Schichttage anhand eines
 * Farb-Lookup. Nur Tage mit tatsächlicher Schicht (T/N) werden gezählt.
 */
function countMarkedShiftsByColorLookup(days, getShiftColor) {
    const counts = new Map();
    for (const day of days) {
        // Nur erfasste Schichten (T/N) zählen; freie Tage bleiben außen vor.
        if (day.shiftLabel === '')
            continue;
        const colorId = getShiftColor(day.dateKey);
        if (!colorId)
            continue;
        counts.set(colorId, (counts.get(colorId) ?? 0) + 1);
    }
    return annotationColors
        .filter((color) => counts.has(color.id))
        .map((color) => ({ colorId: color.id, count: counts.get(color.id) ?? 0 }));
}
export function MonthCalendar({ month, annotations, onOpenEditor, selectedKeys, selectedColumn, onStreakStart, onStreakEnter, onStreakEnd, }) {
    const { statistics } = month;
    const markedShiftCounts = countMarkedShiftsByColor(month.days, annotations);
    return (_jsxs("section", { className: "month-card", "aria-label": `${month.name} ${month.year}`, children: [_jsxs("header", { className: "month-header", children: [_jsxs("span", { className: "month-stat", title: "Werktage Montag bis Freitag", children: [statistics.weekdayCount, " Werktage"] }), _jsx("h2", { className: "month-title", "aria-label": `${month.name}, ${statistics.weekdayCount} Werktage, ${statistics.requiredShiftCount} Sollschichten`, children: month.name }), _jsxs("span", { className: "month-stat", title: "Sollschichten (T + N)", children: [statistics.requiredShiftCount, " Soll"] })] }), _jsx("div", { className: "day-table", role: "table", "aria-label": `Tage im ${month.name}`, children: month.days.map((day) => (_jsx(CalendarDayRow, { day: day, annotation: annotations[day.dateKey], onOpenEditor: onOpenEditor, isSelected: selectedKeys?.has(day.dateKey) ?? false, selectedColumn: selectedColumn, onStreakStart: onStreakStart, onStreakEnter: onStreakEnter, onStreakEnd: onStreakEnd }, day.dateKey))) }), _jsxs("footer", { className: "month-footer", children: [_jsxs("span", { children: [statistics.dayShiftCount, " \u00D7 T"] }), _jsxs("span", { children: [statistics.nightShiftCount, " \u00D7 N"] }), markedShiftCounts.length > 0 && (_jsx("span", { className: "month-footer-marked", title: "Markierte Schichten (T/N) je Farbe", children: markedShiftCounts.map(({ colorId, count }) => (_jsx("span", { className: "month-footer-chip", style: { backgroundColor: getColorHex(colorId) ?? undefined }, title: `${count} markierte ${count === 1 ? 'Schicht' : 'Schichten'}`, children: count }, colorId))) }))] })] }));
}
