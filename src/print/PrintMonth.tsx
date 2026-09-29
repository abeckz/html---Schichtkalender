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
 * mit "F!" markiert. In der Spalte "Information" steht der Termin- bzw.
 * Feiertagsname ausgeschrieben; die Markierung "F!" erscheint ausschließlich
 * in der KW-Spalte und trägt den vollständigen Namen als title.
 *
 * Sobald der Tag einen Kommentar bzw. eine Info trägt, steht in der
 * Textspalte ausschließlich dieser Kommentar: Termin- und Feiertagsnamen
 * verschwinden dann vollständig. Der Feiertag bleibt über das rosa
 * "F!"-Kästchen in der KW-Spalte erkennbar.
 *
 * Beispiel: "Neujahr" in der Spalte Information, daneben die KW und das
 * rosa Kästchen.
 *
 * Bezugsraum für die gesetzlichen Feiertage ist Rheinland-Pfalz.
 */

import type { AnnotationColorId, CalendarDay, MonthCalendar as MonthCalendarModel } from '../domain/types';
import { getColorHex } from '../config/annotationColors';
import { getPrintEventName } from '../config/eventDefinitions';
import { hasPublicHoliday } from '../engines/eventEngine';

/** Feste Rasterhöhe: jeder Monatsblock besitzt genau 31 Tagespositionen. */
export const PRINT_ROWS = 31;

/** Zeichen der Feiertagsmarkierung in der KW-Spalte. */
export const PUBLIC_HOLIDAY_MARK = 'F!';

/** Barrierefreie Beschreibung der Feiertagsmarkierung. */
export const PUBLIC_HOLIDAY_TITLE = 'Gesetzlicher Feiertag';

export interface PrintMonthProps {
  month: MonthCalendarModel;
  annotationLabels: Record<string, string>;
  annotationColors: Record<string, AnnotationColorId>;
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
 *   Feiertagsnamens (getrennt mit "·"). Die Markierung "F!" erscheint
 *   ausschließlich in der KW-Spalte, niemals hier.
 * - Mit Kommentar: ausschließlich der Kommentar. Termin- und Feiertagsnamen
 *   verschwinden dann vollständig; der Feiertag bleibt über das rosa
 *   "F!"-Kästchen in der KW-Spalte erkennbar.
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

export function PrintMonth({ month, annotationLabels, annotationColors }: PrintMonthProps) {
  const rows = buildRows(month);
  return (
    <div className="print-month" data-month={month.month}>
      <div className="print-month-header">
        <span className="print-month-stat">{month.statistics.weekdayCount}</span>
        <span className="print-month-name">{month.name.toUpperCase()}</span>
        <span className="print-month-stat">{month.statistics.requiredShiftCount}</span>
      </div>
      <div className="print-month-body">
        {rows.map((row) => {
          if (!row.day) {
            return (
              <div className="print-row print-row-empty" key={`empty-${row.position}`}>
                <span className="print-col-wo" />
                <span className="print-col-datum" />
                <span className="print-col-info" />
                <span className="print-col-kw" />
                <span className="print-col-schicht" />
              </div>
            );
          }

          const { day } = row;
          const label = annotationLabels[day.dateKey] ?? '';
          const colorId = annotationColors[day.dateKey] ?? null;
          const colorHex = getColorHex(colorId);
          const information = buildPrintInformation(day, label);
          const classNames = ['print-row'];
          if (day.isWeekend) classNames.push('is-weekend');
          if (day.isSunday) classNames.push('is-sunday');

          return (
            <div
              className={classNames.join(' ')}
              key={day.dateKey}
              style={colorHex ? { backgroundColor: colorHex } : undefined}
              data-date-key={day.dateKey}
            >
              <span className="print-col-wo">{day.weekdayShort}</span>
              <span className="print-col-datum">{String(day.day).padStart(2, '0')}</span>
              <span className="print-col-info">{information}</span>
              <span className="print-col-kw">
                {day.isoWeekday === 1 && <span className="print-week">{day.isoWeek}</span>}
                {hasPublicHoliday(day) && <PublicHolidayMark />}
              </span>
              <span className="print-col-schicht">{day.shiftLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
