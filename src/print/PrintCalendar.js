import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Druckansicht.
 *
 * Greift ausschließlich auf den bereits berechneten YearCalendar zu. Es
 * findet hier keine zweite Berechnung von Schichten, Events oder
 * Monatsstatistiken statt.
 *
 * Die Vorschau zeigt exakt zwei verkleinerte A3-Seiten: Januar bis Juni und
 * Juli bis Dezember. Beim Drucken werden die Steuerelemente ausgeblendet,
 * sodass genau zwei Seiten entstehen.
 */
import { useMemo } from 'react';
import { usedAnnotationColors } from '../config/annotationColors.ts';
import { summarizeYear } from '../engines/calendarBuilder.ts';
import { PrintHeader } from './PrintHeader.tsx';
import { PrintHalfYear } from './PrintHalfYear.tsx';
export function PrintCalendar({ calendar, annotations, colorLegend = {}, weekdayOverDate = false, showShiftCalendar = true, anniversaries = {}, showBirthdays = true, showRecurringEvents = true, extraColumns, onPrint, onBack, }) {
    const firstHalf = calendar.months.slice(0, 6);
    const secondHalf = calendar.months.slice(6, 12);
    // Gearbeitete Schichten insgesamt (Tag- plus Nachtschichten) des Jahres.
    const workedShiftCount = summarizeYear(calendar).requiredShiftCount;
    // Benutzte Markierungsfarben des Jahres für die Farblegende im Seitenkopf.
    const usedColors = usedAnnotationColors(annotations, calendar.year);
    // Die Aufbereitung ist reine Darstellungslogik und verändert keine
    // Fachdaten: Beschriftungen und Farb-IDs werden aus der AnnotationMap
    // gelesen, nicht neu berechnet.
    const annotationLabels = useMemo(() => {
        const map = {};
        for (const [dateKey, annotation] of Object.entries(annotations)) {
            if (annotation.label !== '')
                map[dateKey] = annotation.label;
        }
        return map;
    }, [annotations]);
    const annotationColors = useMemo(() => {
        const map = {};
        for (const [dateKey, annotation] of Object.entries(annotations)) {
            if (Object.keys(annotation.colors).length > 0)
                map[dateKey] = annotation.colors;
        }
        return map;
    }, [annotations]);
    // Farben der frei angelegten Zusatzspalten je Tag. Sie liegen getrennt von
    // den festen Farbspalten in `extraColors` und werden - rein
    // darstellungsbezogen - in den Druck übernommen.
    const annotationExtraColors = useMemo(() => {
        const map = {};
        for (const [dateKey, annotation] of Object.entries(annotations)) {
            if (annotation.extraColors && Object.keys(annotation.extraColors).length > 0) {
                map[dateKey] = annotation.extraColors;
            }
        }
        return map;
    }, [annotations]);
    // Querliegende Texte der Zusatzspalten je Ankertag. Sie werden als
    // Überlagerung über die markierte Zeilenspanne gezogen. Je Spalte liegt eine
    // Liste unabhängiger Spannen-Texte vor; sie werden hier je Ankertag zu einer
    // flachen Liste zusammengeführt.
    const extraTextsByDateKey = useMemo(() => {
        const map = {};
        for (const [dateKey, annotation] of Object.entries(annotations)) {
            const texts = annotation.extraTexts;
            if (!texts)
                continue;
            const list = [];
            for (const group of Object.values(texts)) {
                if (!group)
                    continue;
                for (const text of group) {
                    if (!text || text.text === '')
                        continue;
                    list.push(text);
                }
            }
            if (list.length > 0)
                map[dateKey] = list;
        }
        return map;
    }, [annotations]);
    return (_jsxs("div", { className: "print-view", children: [_jsxs("div", { className: "print-controls no-print", children: [_jsx("button", { type: "button", className: "primary-button", onClick: onPrint, children: "Drucken" }), _jsx("button", { type: "button", className: "secondary-button", onClick: onBack, children: "Zur\u00FCck" }), _jsxs("p", { className: "print-hint", children: ["Druckempfehlung: DIN A3, Querformat, beidseitig drucken.", _jsx("br", {}), "Wendung an der f\u00FCr A3-Querformat passenden Kante w\u00E4hlen.", _jsx("br", {}), "Beide Seiten f\u00FCllen das Blatt vollst\u00E4ndig aus \u2013 Skalierung auf 100 % bzw. \u201EAn Seite anpassen\u201C deaktiviert lassen.", _jsx("br", {}), "Hintergrundfarben aktivieren, damit Farbmarkierungen und das rosa Feiertagsfeld (F) farbig gedruckt werden."] })] }), _jsxs("div", { className: "print-preview print-only-root", children: [_jsxs("article", { className: "print-page", "data-page": "1", children: [_jsx(PrintHeader, { year: calendar.year, selectedShift: calendar.selectedShift, workedShiftCount: workedShiftCount, usedColors: usedColors, colorLegend: colorLegend, showShiftCalendar: showShiftCalendar }), _jsx(PrintHalfYear, { months: firstHalf, annotationLabels: annotationLabels, annotationColors: annotationColors, weekdayOverDate: weekdayOverDate, showShiftCalendar: showShiftCalendar, anniversaries: anniversaries, showBirthdays: showBirthdays, showRecurringEvents: showRecurringEvents, extraColumns: extraColumns, annotationExtraColors: annotationExtraColors, extraTextsByDateKey: extraTextsByDateKey, side: 1 })] }), _jsxs("article", { className: "print-page", "data-page": "2", children: [_jsx(PrintHeader, { year: calendar.year, selectedShift: calendar.selectedShift, workedShiftCount: workedShiftCount, usedColors: usedColors, colorLegend: colorLegend, showShiftCalendar: showShiftCalendar }), _jsx(PrintHalfYear, { months: secondHalf, annotationLabels: annotationLabels, annotationColors: annotationColors, weekdayOverDate: weekdayOverDate, showShiftCalendar: showShiftCalendar, anniversaries: anniversaries, showBirthdays: showBirthdays, showRecurringEvents: showRecurringEvents, extraColumns: extraColumns, annotationExtraColors: annotationExtraColors, extraTextsByDateKey: extraTextsByDateKey, side: 2 })] })] })] }));
}
