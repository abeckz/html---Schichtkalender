import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { MONTH_NAMES, getDaysInMonth, getIsoWeekday, getWeekdayShort, toDateKey, } from '../utils/dateUtils.ts';
import { matchesForDateKey } from '../engines/anniversaryEngine.ts';
export function AnniversaryMonthCard({ year, month, anniversaries, onOpenEditor, }) {
    const dayCount = getDaysInMonth(year, month);
    const name = MONTH_NAMES[month - 1];
    return (_jsxs("section", { className: "month-card anniversary-month-card", "aria-label": `${name} (jahreslos)`, children: [_jsxs("header", { className: "month-header", children: [_jsx("span", { className: "month-stat", "aria-hidden": "true" }), _jsx("h2", { className: "month-title", children: name }), _jsx("span", { className: "month-stat", "aria-hidden": "true" })] }), _jsx("div", { className: "day-table anniversary-day-table", role: "table", "aria-label": `Tage im ${name}`, children: Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => {
                    const isoWeekday = getIsoWeekday(year, month, day);
                    const dateKey = toDateKey(year, month, day);
                    // Alle Jahrestage dieses konkreten Kalendertags: Geburtstage hängen am
                    // Monat-Tag-Schlüssel; wiederkehrende Ereignisse werden über ihren
                    // Rhythmus geprüft und erscheinen daher auch an anderen Tagen als
                    // ihrem Ankertag (z. B. „wöchentlich" an jedem passenden Wochentag).
                    // Ausgenommene Einzeltermine (`excludedDates`) und ein gesetztes
                    // Serienende (`until`) werden dabei berücksichtigt.
                    //
                    // Als Basisjahr dient das angezeigte Jahr selbst: In der jahreslosen
                    // Ansicht soll das Muster stabil bleiben (der Anker liegt immer im
                    // selben „Jahr" wie der geprüfte Tag), damit z. B. „jeden 2. Montag"
                    // unabhängig vom Bezugsjahr immer dieselben Wochentage trifft.
                    const entries = matchesForDateKey(anniversaries, dateKey, year, year).map(({ entry }) => entry);
                    const weekdayShort = getWeekdayShort(isoWeekday);
                    const weekdayLabel = `${weekdayShort} ${day}.`;
                    const isWeekend = isoWeekday >= 6;
                    const isSunday = isoWeekday === 7;
                    const names = entries.map((entry) => entry.name).join(', ');
                    const ariaLabel = entries.length > 0
                        ? `${weekdayLabel}, ${names}`
                        : `${weekdayLabel}, Eintrag hinzufügen`;
                    const classNames = ['day-row', 'anniversary-row'];
                    if (isWeekend)
                        classNames.push('is-weekend');
                    if (isSunday)
                        classNames.push('is-sunday');
                    if (entries.some((entry) => entry.kind === 'birthday'))
                        classNames.push('is-birthday');
                    if (entries.some((entry) => entry.kind === 'recurring'))
                        classNames.push('is-recurring');
                    return (_jsxs("button", { type: "button", className: classNames.join(' '), onClick: () => onOpenEditor(makeDay(year, month, day)), "aria-label": ariaLabel, title: ariaLabel, children: [_jsx("span", { className: "cell cell-weekday anniversary-weekday", children: weekdayShort }), _jsx("span", { className: "cell cell-day anniversary-day", children: String(day).padStart(2, '0') }), _jsx("span", { className: "cell cell-information anniversary-information", children: entries.map((entry, entryIndex) => (_jsxs("span", { className: entry.kind === 'birthday'
                                        ? 'anniversary-entry is-birthday'
                                        : 'anniversary-entry is-recurring', children: [entryIndex > 0 && ' · ', _jsx("span", { className: "anniversary-emoji", "aria-hidden": "true", children: entry.kind === 'birthday' ? '🎂' : '🔁' }), ' ', _jsx("span", { className: "anniversary-name", children: entry.name })] }, entry.id))) })] }, dateKey));
                }) })] }));
}
/**
 * Baut einen schlanken Kalendertag für die jahreslose Ansicht.
 *
 * Es werden ausschließlich Datumsangaben benötigt (für Editor und
 * aria-Label); Schicht- und Ereignisfelder bleiben leer, weil diese Ansicht
 * keine Schichten kennt.
 */
function makeDay(year, month, day) {
    const isoWeekday = getIsoWeekday(year, month, day);
    return {
        dateKey: toDateKey(year, month, day),
        year,
        month,
        day,
        isoWeekday,
        weekdayShort: getWeekdayShort(isoWeekday),
        isoWeek: 0,
        shiftState: 'OFF',
        shiftLabel: '',
        events: [],
        isWeekend: isoWeekday >= 6,
        isSunday: isoWeekday === 7,
    };
}
