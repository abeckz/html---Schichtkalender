import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getColorHex } from '../config/annotationColors';
import { getPrintEventName } from '../config/eventDefinitions';
import { hasPublicHoliday } from '../engines/eventEngine';
import { labelLineClass } from '../utils/textFit';
import { countMarkedShiftsByColorTable } from '../components/MonthCalendar';
/** Feste Rasterhöhe: jeder Monatsblock besitzt genau 31 Tagespositionen. */
export const PRINT_ROWS = 31;
/** Zeichen der Feiertagsmarkierung in der KW-Spalte. */
export const PUBLIC_HOLIDAY_MARK = 'F';
/** Barrierefreie Beschreibung der Feiertagsmarkierung. */
export const PUBLIC_HOLIDAY_TITLE = 'Gesetzlicher Feiertag';
function buildRows(month) {
    const rows = [];
    for (let position = 1; position <= PRINT_ROWS; position += 1) {
        rows.push({ position, day: month.days[position - 1] ?? null });
    }
    return rows;
}
/**
 * Informationstext einer Zeile.
 *
 * - Ohne Kommentar: alle Termine des Tages inklusive des ausgeschriebenen
 *   Feiertagsnamens (getrennt mit "·"). Die Markierung "F" erscheint
 *   ausschließlich in der KW-Spalte, niemals hier.
 * - Mit Kommentar: ausschließlich der Kommentar. Termin- und Feiertagsnamen
 *   verschwinden dann vollständig; der Feiertag bleibt über das rosa
 *   "F"-Kästchen in der KW-Spalte erkennbar.
 */
export function buildPrintInformation(day, annotationLabel) {
    if (annotationLabel !== '')
        return annotationLabel;
    return day.events
        .map((event) => getPrintEventName(event.name))
        .filter((name) => name !== '')
        .join(' · ');
}
/** Massivdruckbare Markierung eines gesetzlichen Feiertags. */
export function PublicHolidayMark() {
    return (_jsx("span", { className: "print-holiday-mark", title: PUBLIC_HOLIDAY_TITLE, "aria-hidden": "true", children: PUBLIC_HOLIDAY_MARK }));
}
export function PrintMonth({ month, annotationLabels, annotationColors }) {
    const rows = buildRows(month);
    const markedShiftCounts = countMarkedShiftsByColorTable(month.days, annotationColors);
    return (_jsxs("div", { className: "print-month", "data-month": month.month, children: [_jsxs("div", { className: "print-month-header", children: [_jsxs("span", { className: "print-month-stat", title: "Werktage Montag bis Freitag", children: [month.statistics.weekdayCount, " Werktage"] }), _jsx("span", { className: "print-month-name", children: month.name.toUpperCase() }), _jsxs("span", { className: "print-month-stat print-month-stat-end", title: "Sollschichten (T + N)", children: [month.statistics.requiredShiftCount, " Sollschichten"] })] }), _jsx("div", { className: "print-month-body", children: rows.map((row) => {
                    if (!row.day) {
                        return (_jsxs("div", { className: "print-row print-row-empty", children: [_jsx("span", { className: "print-col-wo" }), _jsx("span", { className: "print-col-datum" }), _jsx("span", { className: "print-col-info" }), _jsx("span", { className: "print-col-kw" }), _jsx("span", { className: "print-col-schicht" })] }, `empty-${row.position}`));
                    }
                    const { day } = row;
                    const label = annotationLabels[day.dateKey] ?? '';
                    const colors = annotationColors[day.dateKey] ?? {};
                    const weekdayHex = getColorHex(colors.weekday ?? null);
                    const datumHex = getColorHex(colors.day ?? null);
                    const infoHex = getColorHex(colors.info ?? null);
                    const schichtHex = getColorHex(colors.shift ?? null);
                    const columnStyle = (hex) => (hex ? { backgroundColor: hex } : undefined);
                    const information = buildPrintInformation(day, label);
                    const infoLineClass = label !== '' ? labelLineClass(label) : '';
                    const classNames = ['print-row'];
                    if (day.isWeekend)
                        classNames.push('is-weekend');
                    if (day.isSunday)
                        classNames.push('is-sunday');
                    return (_jsxs("div", { className: classNames.join(' '), "data-date-key": day.dateKey, children: [_jsx("span", { className: "print-col-wo", style: columnStyle(weekdayHex), children: day.weekdayShort }), _jsx("span", { className: "print-col-datum", style: columnStyle(datumHex), children: String(day.day).padStart(2, '0') }), _jsx("span", { className: `print-col-info ${infoLineClass}`.trim(), style: columnStyle(infoHex), children: information }), _jsxs("span", { className: "print-col-kw", children: [day.isoWeekday === 1 && _jsx("span", { className: "print-week", children: day.isoWeek }), hasPublicHoliday(day) && _jsx(PublicHolidayMark, {})] }), _jsx("span", { className: "print-col-schicht", style: columnStyle(schichtHex), children: day.shiftLabel })] }, day.dateKey));
                }) }), _jsxs("div", { className: "print-month-footer", children: [_jsxs("span", { className: "print-footer-shift", children: [month.statistics.dayShiftCount, " \u00D7 T"] }), _jsxs("span", { className: "print-footer-shift", children: [month.statistics.nightShiftCount, " \u00D7 N"] }), markedShiftCounts.length > 0 && (_jsx("span", { className: "print-footer-marked", title: "Markierte Schichten (T/N) je Farbe", children: markedShiftCounts.map(({ colorId, count }) => (_jsx("span", { className: "print-month-chip", style: { backgroundColor: getColorHex(colorId) ?? undefined }, title: `${count} markierte ${count === 1 ? 'Schicht' : 'Schichten'}`, children: count }, colorId))) }))] })] }));
}
