import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { getColorHex } from '../config/annotationColors.ts';
import { getPrintEventName } from '../config/eventDefinitions.ts';
import { hasPublicHoliday } from '../engines/eventEngine.ts';
import { matchesForDateKey } from '../engines/anniversaryEngine.ts';
import { informationLineClass } from '../utils/textFit.ts';
import { buildExtraColumnLayout } from '../components/ExtraColumnCell.tsx';
import { countMarkedShiftsByColorTable } from '../components/MonthCalendar.tsx';
/** Feste Rasterhöhe: jeder Monatsblock besitzt genau 31 Tagespositionen. */
export const PRINT_ROWS = 31;
/**
 * Breite einer Breiteneinheit der Zusatzspalten im Druck (mm).
 * Bewusst schmaler als am Bildschirm (1,6em), damit die gedruckten Monate
 * trotz der zusätzlichen Spalten auf eine A3-Seite passen.
 */
export const PRINT_EXTRA_COLUMN_UNIT_MM = 3;
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
/**
 * Textbausteine der Jahrestage eines Tages für den Druck.
 *
 * Geburtstage erscheinen mit Torten-Emoji und - sofern ein Geburtsjahr
 * vorliegt - dem Alter in Klammern; wiederkehrende Ereignisse mit
 * Wiederholungssymbol. Die beiden Anzeige-Checkboxen steuern, welche Art
 * übernommen wird.
 */
export function buildAnniversaryPrintParts(day, year, anniversaries, showBirthdays, showRecurringEvents) {
    if (!anniversaries)
        return [];
    return matchesForDateKey(anniversaries, day.dateKey, year, year)
        .filter(({ entry }) => (entry.kind === 'birthday' && showBirthdays) ||
        (entry.kind === 'recurring' && showRecurringEvents))
        .map(({ entry, age }) => {
        if (entry.kind === 'birthday') {
            const agePart = age !== undefined ? ` (${age})` : '';
            return `🎂 ${entry.name}${agePart}`;
        }
        // Der Wiederholungsrhythmus wird bewusst nicht angezeigt: die Zellen sind
        // klein, und der Rhythmus ist beim Bearbeiten sichtbar.
        return `🔁 ${entry.name}`;
    });
}
/**
 * Ermittelt die querliegenden Texte eines Monats für den Druck.
 *
 * Anders als am Bildschirm steht hier kein DOM zur Messung zur Verfügung:
 * die Spaltenbreiten der Drucktabelle sind fest (mm) und die Zeilen sind alle
 * gleich hoch. Die Platzierung lässt sich daher rein rechnerisch bestimmen.
 * Berücksichtigt werden nur Texte, deren Zusatzspalte im Druck vorhanden ist.
 */
export function collectPrintExtraTexts(month, extraTextsByDateKey, extraColumns, weekdayOverDate) {
    const dayIndexByKey = new Map();
    month.days.forEach((day, index) => dayIndexByKey.set(day.dateKey, index));
    // Offsets der festen Spalten in mm (siehe print.css).
    const leadingMm = weekdayOverDate ? 6.5 : 6.5 + 7;
    const trailingMm = 5; // Schichtspalte T/N
    const unitMm = PRINT_EXTRA_COLUMN_UNIT_MM;
    const leftColumns = extraColumns.filter((column) => column.side === 'left');
    const rightColumns = extraColumns.filter((column) => column.side === 'right');
    const overlays = [];
    for (const [dateKey, texts] of Object.entries(extraTextsByDateKey)) {
        if (!dayIndexByKey.has(dateKey))
            continue;
        for (const text of texts) {
            if (!text || text.text === '')
                continue;
            // Nur der Anker (frühester Tag der Spanne) trägt einen Text.
            if (text.dateKeys[0] !== dateKey)
                continue;
            const leftIndex = leftColumns.findIndex((column) => column.colorKey === text.colorKey);
            const rightIndex = rightColumns.findIndex((column) => column.colorKey === text.colorKey);
            if (leftIndex < 0 && rightIndex < 0)
                continue;
            const rows = text.dateKeys
                .map((key) => dayIndexByKey.get(key))
                .filter((index) => index !== undefined)
                .sort((a, b) => a - b);
            if (rows.length === 0)
                continue;
            overlays.push({
                id: text.id,
                text: text.text,
                vertical: text.vertical,
                // Links liegende Spalten werden von links, rechts liegende von rechts
                // gemessen (die Informationsspalte dazwischen ist 1fr und damit
                // unbekannt breit).
                leftMm: leftIndex >= 0 ? leadingMm + leftIndex * unitMm : null,
                rightMm: rightIndex >= 0 ? trailingMm + (rightColumns.length - 1 - rightIndex) * unitMm : null,
                widthMm: unitMm,
                topRow: rows[0],
                spanRows: rows[rows.length - 1] - rows[0] + 1,
            });
        }
    }
    return overlays;
}
/**
 * Schmale Zusatzspalten-Zelle des Drucks.
 *
 * Rein darstellungsbezogen: sie trägt nur eine optionale persönliche Farbe und
 * bleibt sonst leer. Der querliegende Text wird nicht hier, sondern als
 * Überlagerung über die markierte Zeilenspanne gezeichnet (siehe `PrintMonth`).
 */
function PrintExtraCell({ colorKey, annotationExtraColors, dateKey, side, }) {
    const colorId = dateKey ? annotationExtraColors[dateKey]?.[colorKey] ?? null : null;
    const hex = getColorHex(colorId);
    return (_jsx("span", { className: "print-col-extra", "data-extra-column-key": colorKey, "data-extra-column-side": side, style: hex ? { backgroundColor: hex } : undefined }));
}
/**
 * Überlagerungsebene der querliegenden Texte im Druck.
 *
 * Sie liegt als letztes Kind im 31-Zeilen-Raster (`.print-month-body`) und
 * überspannt alle Zeilen. Jeder Text wird über `top`/`height` in Prozent der
 * Rasterhöhe sowie `left`/`right` in Millimetern exakt über die markierte
 * Spanne gelegt - ohne eigene Grid-Spuren, die das Zeilenraster verschieben
 * würden.
 */
function PrintExtraTextOverlay({ overlays }) {
    if (overlays.length === 0)
        return null;
    return (_jsx("div", { className: "print-month-overlay", "aria-hidden": "true", children: overlays.map((overlay) => (_jsx("span", { className: overlay.vertical ? 'print-extra-text is-vertical' : 'print-extra-text', style: {
                top: `${(overlay.topRow / PRINT_ROWS) * 100}%`,
                height: `${(overlay.spanRows / PRINT_ROWS) * 100}%`,
                width: `${overlay.widthMm}mm`,
                left: overlay.leftMm !== null ? `${overlay.leftMm}mm` : undefined,
                right: overlay.rightMm !== null ? `${overlay.rightMm}mm` : undefined,
            }, children: _jsx("span", { children: overlay.text }) }, overlay.id))) }));
}
export function PrintMonth({ month, annotationLabels, annotationColors, weekdayOverDate = false, showShiftCalendar = true, anniversaries, showBirthdays = true, showRecurringEvents = true, extraColumns, annotationExtraColors = {}, extraTextsByDateKey = {}, }) {
    const rows = buildRows(month);
    const markedShiftCounts = countMarkedShiftsByColorTable(month.days, annotationColors);
    // Die Anzeige-Option steuert ausschließlich das Spaltenraster der Tabelle:
    // mit gesetztem Schalter steht das Datum unter dem Wochentag und es gibt
    // keine eigene Tagesnummer-Spalte mehr.
    const emptyRowClassName = weekdayOverDate
        ? 'print-row print-row-empty print-row-weekday-over-date'
        : 'print-row print-row-empty';
    // Frei angelegte Zusatzspalten: dieselbe Anordnung wie am Bildschirm. Links
    // der Information (zwischen Datum und Info), rechts der KW-Spalte. Die
    // Breiten werden als CSS-Variablen gesetzt, damit Kopf, Zeilen und der
    // querliegende Text dieselbe Aufteilung verwenden.
    const layout = buildExtraColumnLayout(extraColumns);
    const leftColumns = layout.left;
    const rightColumns = showShiftCalendar ? layout.right : [];
    const extraColumnsForRow = [...leftColumns, ...rightColumns];
    /**
     * Trackliste der Zusatzspalten für das Spaltenraster der Tageszeilen.
     *
     * `repeat()` in CSS kennt keinen variablen Zähler; die Spuren müssen daher als
     * fertige Zeichenkette vorliegen. Je Einheit entsteht genau ein Track der
     * Breite `PRINT_EXTRA_COLUMN_UNIT_MM` (Leerzeichen-getrennt, mit führendem
     * Leerzeichen); bei 0 Einheiten bleibt die Zeichenkette leer. Damit entsprechen
     * die Spuren exakt der Anzahl der in `PrintMonth` gerenderten Zellen.
     */
    const extraTracks = (units) => units <= 0 ? '' : ` ${`${PRINT_EXTRA_COLUMN_UNIT_MM}mm `.repeat(units).trim()}`;
    const leftTracks = extraTracks(leftColumns.length);
    const rightTracks = extraTracks(rightColumns.length);
    /**
     * Vollständige Spaltenraster der Tageszeilen (siehe `print.css`).
     *
     * Reihenfolge: Wochentag | Datum | [Zusatz links] | Info | KW | [Zusatz
     * rechts] | T/N. Bei „Wochentag über Datum" fällt die Datumsspalte weg; ohne
     * Schichtkalender entfällt zusätzlich die rechte Seite (KW + T/N).
     */
    const rowColumns = `6.5mm 7mm${leftTracks} 1fr 8mm${rightTracks} 5mm`;
    const rowColumnsWeekdayOverDate = `6.5mm${leftTracks} 1fr 8mm${rightTracks} 5mm`;
    const rowColumnsNoShift = `6.5mm 7mm${leftTracks} 1fr 8mm`;
    const rowColumnsNoShiftWeekdayOverDate = `6.5mm${leftTracks} 1fr 8mm`;
    /**
     * Querliegende Texte der Zusatzspalten für den Druck.
     *
     * Ein Text gehört zu einer markierten Spanne und liegt auf deren oberster
     * Zelle (Anker). Der Text wird als Überlagerung im 31-Zeilen-Raster
     * (`.print-month-body`) platziert; da alle Zeilen gleich hoch sind, genügen
     * Prozentangaben (siehe `print.css`), um die Spanne exakt zu treffen.
     */
    const extraTextOverlays = collectPrintExtraTexts(month, extraTextsByDateKey, extraColumnsForRow, weekdayOverDate);
    return (_jsxs("div", { className: showShiftCalendar ? 'print-month' : 'print-month is-shift-hidden', "data-month": month.month, style: {
            '--print-extra-left': `${leftColumns.length * PRINT_EXTRA_COLUMN_UNIT_MM}mm`,
            '--print-extra-right': `${rightColumns.length * PRINT_EXTRA_COLUMN_UNIT_MM}mm`,
            '--print-row-columns': rowColumns,
            '--print-row-columns-weekday-over-date': rowColumnsWeekdayOverDate,
            '--print-row-columns-no-shift': rowColumnsNoShift,
            '--print-row-columns-no-shift-weekday-over-date': rowColumnsNoShiftWeekdayOverDate,
        }, children: [_jsxs("div", { className: "print-month-header", children: [showShiftCalendar ? (_jsxs("span", { className: "print-month-stat", title: "Werktage Montag bis Freitag", children: [month.statistics.weekdayCount, " Werktage"] })) : (_jsx("span", { className: "print-month-stat", "aria-hidden": "true" })), _jsx("span", { className: "print-month-name", children: month.name.toUpperCase() }), showShiftCalendar ? (_jsxs("span", { className: "print-month-stat print-month-stat-end", title: "Sollschichten (T + N)", children: [month.statistics.requiredShiftCount, " Sollschichten"] })) : (_jsx("span", { className: "print-month-stat print-month-stat-end", "aria-hidden": "true" }))] }), _jsxs("div", { className: "print-month-body", children: [rows.map((row) => {
                        if (!row.day) {
                            return (_jsxs("div", { className: emptyRowClassName, children: [_jsx("span", { className: "print-col-wo" }), !weekdayOverDate && _jsx("span", { className: "print-col-datum" }), leftColumns.map((column) => (_jsx(PrintExtraCell, { colorKey: column.colorKey, annotationExtraColors: annotationExtraColors, dateKey: null, side: "left" }, `extra-left-${column.name}`))), _jsx("span", { className: "print-col-info" }), _jsx("span", { className: "print-col-kw" }), rightColumns.map((column) => (_jsx(PrintExtraCell, { colorKey: column.colorKey, annotationExtraColors: annotationExtraColors, dateKey: null, side: "right" }, `extra-right-${column.name}`))), showShiftCalendar && _jsx("span", { className: "print-col-schicht" })] }, `empty-${row.position}`));
                        }
                        const { day } = row;
                        const label = annotationLabels[day.dateKey] ?? '';
                        const colors = annotationColors[day.dateKey] ?? {};
                        const weekdayHex = getColorHex(colors.weekday ?? null);
                        const datumHex = getColorHex(colors.day ?? null);
                        const infoHex = getColorHex(colors.info ?? null);
                        const schichtHex = getColorHex(colors.shift ?? null);
                        const columnStyle = (hex) => (hex ? { backgroundColor: hex } : undefined);
                        const anniversaryParts = buildAnniversaryPrintParts(day, month.year, anniversaries, showBirthdays, showRecurringEvents);
                        const baseInformation = buildPrintInformation(day, label);
                        // Adaptive Schrift über den gesamten Zellinhalt: Die Beschriftung
                        // folgt den DayEditor-Regeln, jeder Jahrestag belegt zusätzlich eine
                        // Zeile. Reine Termin-/Feiertagsnamen (keine persönliche
                        // Beschriftung) werden um eine Zeile höher angesetzt (siehe
                        // `informationLineClass`), damit sie nie so groß wie eine
                        // Beschriftung erscheinen - die Schriftgröße wird geprüft und
                        // gedeckelt.
                        const infoLineClass = baseInformation !== ''
                            ? informationLineClass(baseInformation, anniversaryParts.length, label === '')
                            : '';
                        const classNames = ['print-row'];
                        if (weekdayOverDate)
                            classNames.push('print-row-weekday-over-date');
                        if (day.isWeekend)
                            classNames.push('is-weekend');
                        if (day.isSunday)
                            classNames.push('is-sunday');
                        // Ohne eigene Datumsspalte übernimmt die Wochentagsspalte beide
                        // Angaben; die Farbe der Tagesnummer wird dorthin übertragen, damit
                        // die Markierung erhalten bleibt (Wochentagsfarbe hat Vorrang).
                        const combinedWeekdayHex = weekdayOverDate ? weekdayHex ?? datumHex : weekdayHex;
                        return (_jsxs("div", { className: classNames.join(' '), "data-date-key": day.dateKey, children: [_jsxs("span", { className: weekdayOverDate
                                        ? 'print-col-wo print-col-date-stack'
                                        : 'print-col-wo', style: columnStyle(combinedWeekdayHex), children: [_jsx("span", { className: "print-col-weekday-name", children: day.weekdayShort }), weekdayOverDate && (_jsx("span", { className: "print-col-weekday-date", children: String(day.day).padStart(2, '0') }))] }), !weekdayOverDate && (_jsx("span", { className: "print-col-datum", style: columnStyle(datumHex), children: String(day.day).padStart(2, '0') })), leftColumns.map((column) => (_jsx(PrintExtraCell, { colorKey: column.colorKey, annotationExtraColors: annotationExtraColors, dateKey: day.dateKey, side: "left" }, `extra-left-${column.name}`))), _jsxs("span", { className: `print-col-info ${infoLineClass}`.trim(), children: [anniversaryParts.length > 0 && (_jsx("span", { className: "print-col-anniversaries", children: anniversaryParts.join(' · ') })), baseInformation !== '' && (_jsx("span", { className: "print-col-info-text", style: columnStyle(infoHex), children: baseInformation }))] }), _jsxs("span", { className: "print-col-kw", children: [day.isoWeekday === 1 && _jsx("span", { className: "print-week", children: day.isoWeek }), hasPublicHoliday(day) && _jsx(PublicHolidayMark, {})] }), rightColumns.map((column) => (_jsx(PrintExtraCell, { colorKey: column.colorKey, annotationExtraColors: annotationExtraColors, dateKey: day.dateKey, side: "right" }, `extra-right-${column.name}`))), showShiftCalendar && (_jsx("span", { className: "print-col-schicht", style: columnStyle(schichtHex), children: day.shiftLabel }))] }, day.dateKey));
                    }), _jsx(PrintExtraTextOverlay, { overlays: extraTextOverlays })] }), showShiftCalendar && (_jsxs("div", { className: "print-month-footer", children: [_jsxs("span", { className: "print-footer-shift", children: [month.statistics.dayShiftCount, " \u00D7 T"] }), _jsxs("span", { className: "print-footer-shift", children: [month.statistics.nightShiftCount, " \u00D7 N"] }), markedShiftCounts.length > 0 && (_jsx("span", { className: "print-footer-marked", title: "Markierte Schichten (T/N) je Farbe", children: markedShiftCounts.map(({ colorId, count }) => (_jsx("span", { className: "print-month-chip", style: { backgroundColor: getColorHex(colorId) ?? undefined }, title: `${count} markierte ${count === 1 ? 'Schicht' : 'Schichten'}`, children: count }, colorId))) }))] }))] }));
}
