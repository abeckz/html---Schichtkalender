import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Einzelne Tageszeile der Bildschirmdarstellung.
 *
 * Es werden immer alle Informationen als Text angeboten: Wochentag,
 * Tagesnummer, Termine, persönliche Beschriftung, ISO-KW und T/N. Eine
 * persönliche Farbe wird als Hintergrund verwendet, ersetzt aber niemals
 * den Text.
 *
 * Gesetzliche Feiertage werden in der KW-Spalte (rechts) als rosa Kästchen
 * mit "F" markiert. In der Textspalte steht der ausgeschriebene
 * Feiertagsname; die Markierung "F" erscheint ausschließlich in der
 * KW-Spalte. Trägt der Tag einen Kommentar bzw. eine Info, verdrängt dieser
 * Text die Termin- und Feiertagsangaben vollständig.
 *
 * Ein Klick in die Zeile öffnet immer den Tageseditor (Beschriftung/Farbe).
 * Geburtstage und wiederkehrende Ereignisse sind hier reine Anzeige; bearbeitet
 * werden sie ausschließlich im Jahrestag-Editor der jahreslosen Ansicht. Tragen
 * Beschriftung (Tageseditor) und Jahrestage denselben Tag, werden beide Inhalte
 * gemeinsam mehrzeilig in der Info-Zelle umgebrochen: Die Jahrestage stehen
 * dabei **immer ganz oben**, der Tageseditor-Eintrag darunter. Die persönliche
 * Farbe der Info-Spalte färbt ausschließlich den Tageseditor-Eintrag ein, nicht
 * die Jahrestage; die Schriftgröße folgt den Regeln des Tageseditors
 * (`label-lines-1/2/3`).
 *
 * Rheinland-Pfalz gilt als Bezugsraum: gesetzliche Feiertage sind Neujahr,
 * Karfreitag, Ostermontag, Maifeiertag, Christi Himmelfahrt, Pfingstmontag,
 * Fronleichnam, Tag der Deutschen Einheit, Allerheiligen sowie
 * 1. und 2. Weihnachtstag. Heilige Drei Könige, Mariä Himmelfahrt und der
 * Reformationstag sind dort keine gesetzlichen Feiertage.
 */
import { useRef } from 'react';
import { getColorHex } from '../config/annotationColors.ts';
import { hasPublicHoliday } from '../engines/eventEngine.ts';
import { matchesForDateKey } from '../engines/anniversaryEngine.ts';
import { PUBLIC_HOLIDAY_MARK, PUBLIC_HOLIDAY_TITLE } from '../print/PrintMonth.tsx';
import { informationLineClass } from '../utils/textFit.ts';
import { ExtraColumnCell } from './ExtraColumnCell.tsx';
/**
 * Ordnet eine Zieh-Zelle dem Spaltennamen zu.
 *
 * Die festen Farbspalten liefern ihren Spaltennamen ('weekday', 'day', 'shift').
 * Eine Zusatzspalte (`.cell-extra`) liefert ihr **einheitenstabiles** Zieh-Ziel
 * aus `data-extra-unit-key`: die erste Breiteneinheit den Farbschlüssel
 * ('extra0'), jede weitere Einheit einen Suffix ('extra0#1'). Dadurch wird beim
 * Ziehen nur die getroffene Einheit hervorgehoben und nicht die ganze
 * erweiterte Spalte.
 */
function columnOfCell(target) {
    const element = target;
    const cell = element?.closest?.('.cell-weekday, .cell-day, .cell-shift, .cell-extra');
    if (!cell)
        return null;
    if (cell.classList.contains('cell-weekday'))
        return 'weekday';
    if (cell.classList.contains('cell-day'))
        return 'day';
    if (cell.classList.contains('cell-shift'))
        return 'shift';
    if (cell.classList.contains('cell-extra')) {
        const key = cell.getAttribute('data-extra-unit-key') ?? cell.getAttribute('data-extra-column-key');
        return key ? key : null;
    }
    return null;
}
function describeDay(day, annotation) {
    const parts = [
        `${day.weekdayShort} ${day.day}.`,
        day.events.map((event) => event.name).join(', '),
        annotation?.label ?? '',
        day.shiftLabel ? `Schicht ${day.shiftLabel}` : 'keine Schicht',
    ];
    return parts.filter((part) => part !== '').join(', ');
}
export function CalendarDayRow({ day, annotation, weekdayOverDate = false, onOpenEditor, showShiftCalendar = true, anniversaries = {}, showBirthdays = true, showRecurringEvents = true, extraColumns, isSelected = false, selectedColumn = null, onStreakStart, onStreakEnter, onStreakEnd, }) {
    const publicHoliday = hasPublicHoliday(day);
    const annotationLabel = annotation?.label ?? '';
    // Passende Jahrestage des Kalendertags: Geburtstag und/oder wiederkehrendes
    // Ereignis. Über die Checkboxen lassen sich beide Arten getrennt ein- und
    // ausblenden; die angezeigten Einträge werden hier danach gefiltert.
    const anniversaryMatches = matchesForDateKey(anniversaries, day.dateKey, day.year, day.year).filter(({ entry }) => (entry.kind === 'birthday' && showBirthdays) ||
        (entry.kind === 'recurring' && showRecurringEvents));
    // Hintergrundfarben je Spalte. Der Streifen färbt Wochentag, Tagesnummer
    // oder T/N; die Info-Spalte trägt die Farbe aus dem DayEditor.
    const weekdayHex = getColorHex(annotation?.colors.weekday ?? null);
    const dayHex = getColorHex(annotation?.colors.day ?? null);
    const infoHex = getColorHex(annotation?.colors.info ?? null);
    const shiftHex = getColorHex(annotation?.colors.shift ?? null);
    // Anzeige-Option "Wochentag über Datum": Datum unter den Wochentag, ohne
    // eigene Tagesnummer-Zelle. Die persönliche Farbe der Tagesnummer wird
    // dabei auf die gemeinsame Zelle übertragen, damit die Markierung sichtbar
    // bleibt; die Farbe des Wochentags hat Vorrang, wenn beide gesetzt sind.
    const combinedWeekdayHex = weekdayOverDate ? (weekdayHex ?? dayHex) : weekdayHex;
    const columnStyle = (hex) => hex ? { backgroundColor: hex } : undefined;
    // Eine Zeile gilt als eingefärbt, sobald in irgendeiner Spalte eine Farbe
    // gesetzt ist. Das steuert die Kontrast-/Textfarbe der Zeile. Die frei
    // angelegten Zusatzspalten zählen dabei mit.
    const hasColor = Boolean(weekdayHex ||
        dayHex ||
        infoHex ||
        shiftHex ||
        Object.keys(annotation?.extraColors ?? {}).length > 0);
    // Der Informationstext zeigt die Termine und den Kommentar/die Info des
    // Anwenders. Gesetzliche Feiertage stehen dort ausgeschrieben; die
    // Markierung "F" gehört ausschließlich in die KW-Spalte.
    //
    // Sobald ein Kommentar vorliegt, steht ausschließlich dieser Text in der
    // Zeile: der Termin- bzw. Feiertagsname verschwindet dann vollständig.
    const informationText = annotationLabel !== ''
        ? annotationLabel
        : day.events.map((event) => event.name).join(' · ');
    // Adaptive Schrift über den gesamten Zellinhalt: Die Beschriftung folgt den
    // DayEditor-Regeln, jeder Jahrestag belegt zusätzlich eine Zeile. Reine
    // Termin-/Feiertagsnamen (keine persönliche Beschriftung) werden um eine
    // Zeile höher angesetzt (siehe `informationLineClass`), damit sie nie so
    // groß wie eine Beschriftung erscheinen - die Schriftgröße wird geprüft und
    // gedeckelt.
    const infoLineClass = informationText !== ''
        ? informationLineClass(informationText, anniversaryMatches.length, annotationLabel === '')
        : '';
    const classNames = ['day-row'];
    if (weekdayOverDate)
        classNames.push('is-weekday-over-date');
    if (day.isWeekend)
        classNames.push('is-weekend');
    if (day.isSunday)
        classNames.push('is-sunday');
    if (annotation)
        classNames.push('has-annotation');
    if (hasColor)
        classNames.push('has-color');
    if (weekdayHex)
        classNames.push('has-color-weekday');
    if (dayHex)
        classNames.push('has-color-day');
    if (infoHex)
        classNames.push('has-color-info');
    if (shiftHex)
        classNames.push('has-color-shift');
    const anniversaryLabel = anniversaryMatches
        .map(({ entry, age }) => {
        if (entry.kind === 'birthday') {
            return `Geburtstag ${entry.name}${age !== undefined ? ` (${age})` : ''}`;
        }
        return `wiederkehrendes Ereignis ${entry.name}`;
    })
        .join(', ');
    const ariaLabel = [
        describeDay(day, annotation),
        anniversaryLabel,
        publicHoliday ? PUBLIC_HOLIDAY_TITLE : '',
    ]
        .filter((part) => part !== '')
        .join(', ');
    /**
     * Unterdrückt den Editor öffnenden `click`, der auf ein `mousedown` in einer
     * Zieh-Spalte folgt.
     *
     * Ein Klick auf eine Zieh-Zelle (Wochentag, Tagesnummer, T/N oder eine
     * Zusatzspalte) startet mit `mousedown` eine Streifen-Auswahl und wird mit
     * `mouseup` bereits zentral ausgewertet (Farbe/Text bzw. Einfärbe-Dialog). Der
     * Browser feuert danach zusätzlich ein `click`-Ereignis, das zum umgebenden
     * Tageszeilen-Button hochsteigt und dort den `DayEditor` öffnen würde. Da der
     * Streak-End-Handler die Auswahl (`isSelected`) zu diesem Zeitpunkt bereits
     * zurückgesetzt hat, greift dessen Schutz nicht mehr. Dieses Flag merkt sich,
     * dass der kommende `click` aus einer Zieh-Spalte stammt, und wird dort
     * einmalig verbraucht, damit der `DayEditor` nicht ungewollt (zusätzlich)
     * aufgeht.
     */
    const suppressClickRef = useRef(false);
    /**
     * Streifen-Auswahl: Ein Ziehen zeigt sich nur, wenn die Maustaste in einer
     * der Zieh-Zellen (Wochentag, Tagesnummer, T/N) gedrückt wurde. Ein reiner
     * Klick ohne Zieh-Spalte öffnet weiterhin den Editor. Die gestartete Spalte
     * wird an die Auswahl übergeben und steuert die Hervorhebung.
     */
    const handleMouseDown = (event) => {
        if (event.button !== 0)
            return;
        if (!onStreakStart)
            return;
        const column = columnOfCell(event.target);
        if (!column)
            return;
        // Ab hier stammt der nachfolgende `click` aus einer Zieh-Spalte und darf
        // den Tageseditor nicht zusätzlich öffnen (siehe `suppressClickRef`).
        suppressClickRef.current = true;
        event.preventDefault();
        onStreakStart(day, column);
    };
    const handleMouseEnter = () => {
        if (!onStreakEnter)
            return;
        onStreakEnter(day);
    };
    /** Nur die vom Streifen gestartete Spalte wird während der Auswahl markiert. */
    const isColumnSelected = (column) => isSelected && selectedColumn === column;
    const selectedClass = (column) => isColumnSelected(column) ? ' is-column-selected' : '';
    return (_jsxs("button", { type: "button", className: classNames.join(' '), onClick: () => {
            // Während einer Streifen-Auswahl löst das Loslassen kein Öffnen des
            // Editors aus; das übernimmt der Streak-End-Handler zentral.
            if (isSelected)
                return;
            // Ein `click`, der auf ein `mousedown` in einer Zieh-Spalte folgt, ist
            // nur das Nachspiel der Streifen-Auswahl (Farbe/Text bzw. Einfärben)
            // und darf den Tageseditor nicht zusätzlich öffnen. Das Flag wird beim
            // nächsten Klick einmalig verbraucht.
            if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
            }
            onOpenEditor(day);
        }, onMouseDown: handleMouseDown, onMouseEnter: handleMouseEnter, onMouseUp: onStreakEnd, "aria-label": ariaLabel, title: ariaLabel, "data-color-weekday": annotation?.colors.weekday ?? undefined, "data-color-day": annotation?.colors.day ?? undefined, "data-color-info": annotation?.colors.info ?? undefined, "data-color-shift": annotation?.colors.shift ?? undefined, "data-public-holiday": publicHoliday ? 'true' : undefined, children: [weekdayOverDate ? (
            // Datum unter dem Wochentag: eine gemeinsame Zelle, keine eigene
            // Tagesnummer-Zelle. Der Zugriff auf die Farbe der Tagesnummer bleibt
            // über `data-color-day` erhalten.
            _jsxs("span", { className: `cell cell-weekday cell-date-stack${selectedClass('weekday')}`, style: columnStyle(combinedWeekdayHex), children: [_jsx("span", { className: "cell-weekday-name", children: day.weekdayShort }), _jsx("span", { className: "cell-weekday-date", children: String(day.day).padStart(2, '0') })] })) : (_jsxs(_Fragment, { children: [_jsx("span", { className: `cell cell-weekday${selectedClass('weekday')}`, style: columnStyle(weekdayHex), children: day.weekdayShort }), _jsx("span", { className: `cell cell-day${selectedClass('day')}`, style: columnStyle(dayHex), children: String(day.day).padStart(2, '0') })] })), (extraColumns ?? [])
                .filter((column) => column.side === 'left')
                .map((column) => (_jsx(ExtraColumnCell, { column: column, annotation: annotation, selected: isColumnSelected(column.unitKey) }, `extra-left-${column.name}`))), _jsxs("span", { className: [
                    'cell',
                    'cell-information',
                    selectedClass('info'),
                    infoLineClass,
                    annotationLabel !== '' ? 'has-annotation-entry' : '',
                ]
                    .filter((name) => name !== '')
                    .join(' '), children: [anniversaryMatches.length > 0 && (_jsx("span", { className: "cell-anniversaries", children: anniversaryMatches.map(({ entry, age }, index) => (_jsxs("span", { className: entry.kind === 'birthday'
                                ? 'anniversary-entry is-birthday'
                                : 'anniversary-entry is-recurring', children: [index > 0 && ' · ', _jsx("span", { className: "anniversary-emoji", "aria-hidden": "true", children: entry.kind === 'birthday' ? '🎂' : '🔁' }), ' ', entry.name, entry.kind === 'birthday' && age !== undefined && (_jsxs("span", { className: "anniversary-age", children: [" (", age, ")"] }))] }, entry.id))) })), informationText !== '' && (_jsx("span", { className: "cell-information-text", style: columnStyle(infoHex), children: informationText }))] }), _jsxs("span", { className: "cell cell-kw", children: [day.isoWeekday === 1 && _jsx("span", { className: "cell-week", children: day.isoWeek }), publicHoliday && (_jsx("span", { className: "holiday-mark", title: PUBLIC_HOLIDAY_TITLE, "aria-hidden": "true", children: PUBLIC_HOLIDAY_MARK }))] }), (extraColumns ?? [])
                .filter((column) => column.side === 'right')
                .map((column) => (_jsx(ExtraColumnCell, { column: column, annotation: annotation, selected: isColumnSelected(column.unitKey) }, `extra-right-${column.name}`))), showShiftCalendar && (_jsx("span", { className: `cell cell-shift${selectedClass('shift')}`, style: columnStyle(shiftHex), children: day.shiftLabel }))] }));
}
