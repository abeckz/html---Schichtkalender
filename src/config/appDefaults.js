/**
 * Standardwerte der Anwendung.
 *
 * Das Startjahr ist grundsätzlich das aktuelle Jahr: die Jahresauswahl
 * startet damit immer beim laufenden Jahr und nicht bei einem festen
 * Bezugsjahr. Liegt das aktuelle Jahr außerhalb des Auswahlbereichs, wird
 * auf den nächstliegenden Rand begrenzt.
 *
 * 2021 bleibt als fachliches Referenzjahr erhalten: für dieses Jahr liegt
 * die verbindliche Referenzberechnung der Spezifikation vor.
 */
/** Fachliches Referenzjahr der Spezifikation. */
export const REFERENCE_YEAR = 2021;
/** Jahr für die Jahresauswahl. */
export const SELECTABLE_YEARS = Array.from({ length: 31 }, (_, index) => 2020 + index);
/** Kleinstes wählbares Jahr. */
export const FIRST_SELECTABLE_YEAR = SELECTABLE_YEARS[0];
/** Größtes wählbares Jahr. */
export const LAST_SELECTABLE_YEAR = SELECTABLE_YEARS[SELECTABLE_YEARS.length - 1];
/**
 * Begrenzt ein Jahr auf den Auswahlbereich der Jahresauswahl.
 * Vor dem ersten wählbaren Jahr wird 2021 (Referenzjahr) verwendet, weil
 * das früheste wählbare Jahr 2020 ist, aber 2021 das verbindliche
 * Referenzjahr darstellt.
 */
export function clampToSelectableYear(year) {
    if (!Number.isInteger(year))
        return REFERENCE_YEAR;
    if (year < FIRST_SELECTABLE_YEAR)
        return REFERENCE_YEAR;
    return Math.min(LAST_SELECTABLE_YEAR, year);
}
/**
 * Startjahr der Anwendung: immer das aktuelle Jahr (bei Randlagen
 * begrenzt auf den Auswahlbereich).
 */
export function defaultYear(now = new Date()) {
    return clampToSelectableYear(now.getFullYear());
}
export const DEFAULT_YEAR = defaultYear();
export const DEFAULT_SHIFT = 'C';
/**
 * Standard der Anzeige-Option "Wochentag über Datum".
 *
 * Die Option ist standardmäßig aus: Wochentag und Tagesnummer stehen in
 * getrennten Spalten. Erst mit dem Einschalten rückt das Datum unter den
 * Wochentag und lässt die Tagesnummer-Spalte entfallen.
 */
export const DEFAULT_WEEKDAY_OVER_DATE = false;
/**
 * Anzeige-Checkboxen der regulären Ansicht. Alle drei sind standardmäßig
 * eingeschaltet: der Schichtkalender und die beiden Ereignisarten.
 */
export const DEFAULT_SHOW_SHIFT_CALENDAR = true;
export const DEFAULT_SHOW_BIRTHDAYS = true;
export const DEFAULT_SHOW_RECURRING_EVENTS = true;
/** Standardmodus der Ansicht: regulärer Schichtkalender. */
export const DEFAULT_VIEW_MODE = 'shift';
/** Standard der frei angelegten Zusatzspalten: keine Spalte vorhanden. */
export const DEFAULT_EXTRA_COLUMNS = {};
export const DEFAULT_SETTINGS = {
    selectedYear: DEFAULT_YEAR,
    selectedShift: DEFAULT_SHIFT,
    weekdayOverDate: DEFAULT_WEEKDAY_OVER_DATE,
    showShiftCalendar: DEFAULT_SHOW_SHIFT_CALENDAR,
    showBirthdays: DEFAULT_SHOW_BIRTHDAYS,
    showRecurringEvents: DEFAULT_SHOW_RECURRING_EVENTS,
    viewMode: DEFAULT_VIEW_MODE,
    extraColumns: DEFAULT_EXTRA_COLUMNS,
};
