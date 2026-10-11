import { jsx as _jsx } from "react/jsx-runtime";
import { AnniversaryMonthCard } from './AnniversaryMonthCard.tsx';
export function AnniversaryYearCalendar({ year, anniversaries, onOpenEditor, }) {
    return (_jsx("div", { className: "year-calendar anniversary-year-calendar", children: Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (_jsx(AnniversaryMonthCard, { year: year, month: month, anniversaries: anniversaries, onOpenEditor: onOpenEditor }, month))) }));
}
