import { jsx as _jsx } from "react/jsx-runtime";
import { PrintMonth } from './PrintMonth';
export function PrintHalfYear({ months, annotationLabels, annotationColors, side, }) {
    return (_jsx("section", { className: "print-half-year", "data-side": side, children: months.map((month) => (_jsx(PrintMonth, { month: month, annotationLabels: annotationLabels, annotationColors: annotationColors }, month.month))) }));
}
