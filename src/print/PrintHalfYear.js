import { jsx as _jsx } from "react/jsx-runtime";
import { PrintMonth } from './PrintMonth.tsx';
export function PrintHalfYear({ months, annotationLabels, annotationColors, weekdayOverDate = false, showShiftCalendar = true, anniversaries = {}, showBirthdays = true, showRecurringEvents = true, extraColumns, annotationExtraColors = {}, extraTextsByDateKey = {}, side, }) {
    return (_jsx("section", { className: "print-half-year", "data-side": side, children: months.map((month) => (_jsx(PrintMonth, { month: month, annotationLabels: annotationLabels, annotationColors: annotationColors, weekdayOverDate: weekdayOverDate, showShiftCalendar: showShiftCalendar, anniversaries: anniversaries, showBirthdays: showBirthdays, showRecurringEvents: showRecurringEvents, extraColumns: extraColumns?.[month.month], annotationExtraColors: annotationExtraColors, extraTextsByDateKey: extraTextsByDateKey }, month.month))) }));
}
