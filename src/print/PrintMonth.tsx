/**
 * Ein Monatsblock der Druckansicht.
 *
 * Aufbau als kleine Tabelle mit den Spalten Tag, Datum, Information, KW und
 * Schicht. Die Tage laufen immer von oben nach unten. Über das
 * 31-Zeilen-Raster wird jeder Monatsblock gleich hoch und alle Monate sind
 * horizontal auf derselben Höhe ausgerichtet.
 *
 * In der KW-Spalte steht ausschließlich die ISO-Kalenderwoche (jeweils am
 * Montag). Gesetzliche Feiertage werden dort zusätzlich als rosa Kästchen
 * mit "F" markiert. In der Spalte "Information" steht der Termin- bzw.
 * Feiertagsname ausgeschrieben; die Markierung "F" erscheint ausschließlich
 * in der KW-Spalte und trägt den vollständigen Namen als title.
 *
 * Sobald der Tag einen Kommentar bzw. eine Info trägt, steht in der
 * Textspalte ausschließlich dieser Kommentar: Termin- und Feiertagsnamen
 * verschwinden dann vollständig. Der Feiertag bleibt über das rosa
 * "F"-Kästchen in der KW-Spalte erkennbar.
 *
 * Beispiel: "Neujahr" in der Spalte Information, daneben die KW und das
 * rosa Kästchen.
 *
 * Bezugsraum für die gesetzlichen Feiertage ist Rheinland-Pfalz.
 */

import type {
  AnnotationColorId,
  CalendarDay,
  ColumnColorName,
  MonthCalendar as MonthCalendarModel,
} from '../domain/types.ts';
import { getColorHex } from '../config/annotationColors.ts';
import { getPrintEventName } from '../config/eventDefinitions.ts';
import { hasPublicHoliday } from '../engines/eventEngine.ts';
import { labelLineClass } from '../utils/textFit.ts';
import { countMarkedShiftsByColorTable } from '../components/MonthCalendar.tsx';

/** Feste Rasterhöhe: jeder Monatsblock besitzt genau 31 Tagespositionen. */
export const PRINT_ROWS = 31;

/** Zeichen der Feiertagsmarkierung in der KW-Spalte. */
export const PUBLIC_HOLIDAY_MARK = 'F';

/** Barrierefreie Beschreibung der Feiertagsmarkierung. */
export const PUBLIC_HOLIDAY_TITLE = 'Gesetzlicher Feiertag';

export interface PrintMonthProps {
  month: MonthCalendarModel;
  annotationLabels: Record<string, string>;
  /** Farben je Tag und Spalte (Spaltenname -> colorId). */
  annotationColors: Record<string, Partial<Record<ColumnColorName, AnnotationColorId>>>;
  /**
   * Anzeige-Option "Wochentag über Datum" (Standard: aus).
   *
   * false: eigene Spalten für Wochentag und Tagesnummer.
   * true:  Das Datum steht unter dem Wochentag in einer gemeinsamen Spalte;
   *        die Tagesnummer-Spalte entfällt und die Bemerkungsspalte gewinnt
   *        die Breite hinzu.
   */
  weekdayOverDate?: boolean;
}

interface PrintRow {
  position: number;
  day: CalendarDay | null;
}

function buildRows(month: MonthCalendarModel): PrintRow[] {
  const rows: PrintRow[] = [];
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
export function buildPrintInformation(
  day: CalendarDay,
  annotationLabel: string,
): string {
  if (annotationLabel !== '') return annotationLabel;
  return day.events
    .map((event) => getPrintEventName(event.name))
    .filter((name) => name !== '')
    .join(' · ');
}

/** Massivdruckbare Markierung eines gesetzlichen Feiertags. */
export function PublicHolidayMark() {
  return (
    <span className="print-holiday-mark" title={PUBLIC_HOLIDAY_TITLE} aria-hidden="true">
      {PUBLIC_HOLIDAY_MARK}
    </span>
  );
}

export function PrintMonth({
  month,
  annotationLabels,
  annotationColors,
  weekdayOverDate = false,
}: PrintMonthProps) {
  const rows = buildRows(month);
  const markedShiftCounts = countMarkedShiftsByColorTable(month.days, annotationColors);
  // Die Anzeige-Option steuert ausschließlich das Spaltenraster der Tabelle:
  // mit gesetztem Schalter steht das Datum unter dem Wochentag und es gibt
  // keine eigene Tagesnummer-Spalte mehr.
  const emptyRowClassName = weekdayOverDate
    ? 'print-row print-row-empty print-row-weekday-over-date'
    : 'print-row print-row-empty';
  return (
    <div className="print-month" data-month={month.month}>
      <div className="print-month-header">
        <span className="print-month-stat" title="Werktage Montag bis Freitag">
          {month.statistics.weekdayCount} Werktage
        </span>
        <span className="print-month-name">{month.name.toUpperCase()}</span>
        <span className="print-month-stat print-month-stat-end" title="Sollschichten (T + N)">
          {month.statistics.requiredShiftCount} Sollschichten
        </span>
      </div>
      <div className="print-month-body">
        {rows.map((row) => {
          if (!row.day) {
            return (
              <div className={emptyRowClassName} key={`empty-${row.position}`}>
                <span className="print-col-wo" />
                {/* Ohne eigene Datumsspalte trägt die Wochentagsspalte beide Angaben. */}
                {!weekdayOverDate && <span className="print-col-datum" />}
                <span className="print-col-info" />
                <span className="print-col-kw" />
                <span className="print-col-schicht" />
              </div>
            );
          }

          const { day } = row;
          const label = annotationLabels[day.dateKey] ?? '';
          const colors = annotationColors[day.dateKey] ?? {};
          const weekdayHex = getColorHex(colors.weekday ?? null);
          const datumHex = getColorHex(colors.day ?? null);
          const infoHex = getColorHex(colors.info ?? null);
          const schichtHex = getColorHex(colors.shift ?? null);
          const columnStyle = (hex: string | null) => (hex ? { backgroundColor: hex } : undefined);
          const information = buildPrintInformation(day, label);
          const infoLineClass = label !== '' ? labelLineClass(label) : '';
          const classNames = ['print-row'];
          if (weekdayOverDate) classNames.push('print-row-weekday-over-date');
          if (day.isWeekend) classNames.push('is-weekend');
          if (day.isSunday) classNames.push('is-sunday');

          // Ohne eigene Datumsspalte übernimmt die Wochentagsspalte beide
          // Angaben; die Farbe der Tagesnummer wird dorthin übertragen, damit
          // die Markierung erhalten bleibt (Wochentagsfarbe hat Vorrang).
          const combinedWeekdayHex = weekdayOverDate ? weekdayHex ?? datumHex : weekdayHex;

          return (
            <div className={classNames.join(' ')} key={day.dateKey} data-date-key={day.dateKey}>
              <span
                className={
                  weekdayOverDate
                    ? 'print-col-wo print-col-date-stack'
                    : 'print-col-wo'
                }
                style={columnStyle(combinedWeekdayHex)}
              >
                <span className="print-col-weekday-name">{day.weekdayShort}</span>
                {weekdayOverDate && (
                  <span className="print-col-weekday-date">{String(day.day).padStart(2, '0')}</span>
                )}
              </span>
              {!weekdayOverDate && (
                <span className="print-col-datum" style={columnStyle(datumHex)}>
                  {String(day.day).padStart(2, '0')}
                </span>
              )}
              <span className={`print-col-info ${infoLineClass}`.trim()} style={columnStyle(infoHex)}>
                {information}
              </span>
              <span className="print-col-kw">
                {day.isoWeekday === 1 && <span className="print-week">{day.isoWeek}</span>}
                {hasPublicHoliday(day) && <PublicHolidayMark />}
              </span>
              <span className="print-col-schicht" style={columnStyle(schichtHex)}>
                {day.shiftLabel}
              </span>
            </div>
          );
        })}
      </div>
      <div className="print-month-footer">
        <span className="print-footer-shift">
          {month.statistics.dayShiftCount} × T
        </span>
        <span className="print-footer-shift">
          {month.statistics.nightShiftCount} × N
        </span>
        {markedShiftCounts.length > 0 && (
          <span className="print-footer-marked" title="Markierte Schichten (T/N) je Farbe">
            {markedShiftCounts.map(({ colorId, count }) => (
              <span
                key={colorId}
                className="print-month-chip"
                style={{ backgroundColor: getColorHex(colorId) ?? undefined }}
                title={`${count} markierte ${count === 1 ? 'Schicht' : 'Schichten'}`}
              >
                {count}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
