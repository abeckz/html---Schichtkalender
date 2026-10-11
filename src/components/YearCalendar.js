import { jsx as _jsx } from "react/jsx-runtime";
import { MonthCalendar } from './MonthCalendar';
export function YearCalendar({ calendar, annotations, onOpenEditor, selectedKeys, selectedColumn, onStreakStart, onStreakEnter, onStreakEnd, }) {
    return (_jsx("div", { className: "year-calendar", children: calendar.months.map((month) => (_jsx(MonthCalendar, { month: month, annotations: annotations, onOpenEditor: onOpenEditor, selectedKeys: selectedKeys, selectedColumn: selectedColumn, onStreakStart: onStreakStart, onStreakEnter: onStreakEnter, onStreakEnd: onStreakEnd }, month.month))) }));
}
