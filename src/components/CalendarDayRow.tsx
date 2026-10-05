/**
 * Einzelne Tageszeile der Bildschirmdarstellung.
 *
 * Es werden immer alle Informationen als Text angeboten: Wochentag,
 * Tagesnummer, Termine, persönliche Beschriftung, ISO-KW und T/N. Eine
 * persönliche Farbe wird als Hintergrund verwendet, ersetzt aber niemals
 * den Text.
 *
 * Gesetzliche Feiertage werden in der KW-Spalte (rechts) als rosa Kästchen
 * mit "F!" markiert. In der Textspalte steht der ausgeschriebene
 * Feiertagsname; die Markierung "F!" erscheint ausschließlich in der
 * KW-Spalte. Trägt der Tag einen Kommentar bzw. eine Info, verdrängt dieser
 * Text die Termin- und Feiertagsangaben vollständig.
 *
 * Rheinland-Pfalz gilt als Bezugsraum: gesetzliche Feiertage sind Neujahr,
 * Karfreitag, Ostermontag, Maifeiertag, Christi Himmelfahrt, Pfingstmontag,
 * Fronleichnam, Tag der Deutschen Einheit, Allerheiligen sowie
 * 1. und 2. Weihnachtstag. Heilige Drei Könige, Mariä Himmelfahrt und der
 * Reformationstag sind dort keine gesetzlichen Feiertage.
 */

import type { MouseEvent as ReactMouseEvent } from 'react';
import type { CalendarDay, ColumnColorName, UserDayAnnotation } from '../domain/types';
import { getColorHex } from '../config/annotationColors';
import { hasPublicHoliday } from '../engines/eventEngine';
import { PUBLIC_HOLIDAY_MARK, PUBLIC_HOLIDAY_TITLE } from '../print/PrintMonth';
import { labelLineClass } from '../utils/textFit';

export interface CalendarDayRowProps {
  day: CalendarDay;
  annotation: UserDayAnnotation | undefined;
  onOpenEditor: (day: CalendarDay) => void;
  /** true, wenn der Tag Teil der aktuellen Streifen-Auswahl ist. */
  isSelected?: boolean;
  /**
   * Spalte, die während der aktuellen Streifen-Auswahl hervorgehoben wird.
   * null bedeutet: keine laufende Streifen-Auswahl.
   */
  selectedColumn?: ColumnColorName | null;
  /** Beginnt eine Streifen-Auswahl in einer der Zieh-Spalten. */
  onStreakStart?: (day: CalendarDay, column: ColumnColorName) => void;
  /** Erweitert die Streifen-Auswahl um einen berührten Tag. */
  onStreakEnter?: (day: CalendarDay) => void;
  /** Schließt die Streifen-Auswahl ab. */
  onStreakEnd?: () => void;
}

/** Ordnet eine Zieh-Zelle dem Spaltennamen zu. */
function columnOfCell(target: EventTarget | null): ColumnColorName | null {
  const element = target as HTMLElement | null;
  const cell = element?.closest?.('.cell-weekday, .cell-day, .cell-shift');
  if (!cell) return null;
  if (cell.classList.contains('cell-weekday')) return 'weekday';
  if (cell.classList.contains('cell-day')) return 'day';
  if (cell.classList.contains('cell-shift')) return 'shift';
  return null;
}

function describeDay(day: CalendarDay, annotation: UserDayAnnotation | undefined): string {
  const parts = [
    `${day.weekdayShort} ${day.day}.`,
    day.events.map((event) => event.name).join(', '),
    annotation?.label ?? '',
    day.shiftLabel ? `Schicht ${day.shiftLabel}` : 'keine Schicht',
  ];
  return parts.filter((part) => part !== '').join(', ');
}

export function CalendarDayRow({
  day,
  annotation,
  onOpenEditor,
  isSelected = false,
  selectedColumn = null,
  onStreakStart,
  onStreakEnter,
  onStreakEnd,
}: CalendarDayRowProps) {
  const publicHoliday = hasPublicHoliday(day);
  const annotationLabel = annotation?.label ?? '';

  // Hintergrundfarben je Spalte. Der Streifen färbt Wochentag, Tagesnummer
  // oder T/N; die Info-Spalte trägt die Farbe aus dem DayEditor.
  const weekdayHex = getColorHex(annotation?.colors.weekday ?? null);
  const dayHex = getColorHex(annotation?.colors.day ?? null);
  const infoHex = getColorHex(annotation?.colors.info ?? null);
  const shiftHex = getColorHex(annotation?.colors.shift ?? null);

  const columnStyle = (hex: string | null) =>
    hex ? { backgroundColor: hex } : undefined;

  // Eine Zeile gilt als eingefärbt, sobald in irgendeiner Spalte eine Farbe
  // gesetzt ist. Das steuert die Kontrast-/Textfarbe der Zeile.
  const hasColor = Boolean(weekdayHex || dayHex || infoHex || shiftHex);

  // Der Informationstext zeigt die Termine und den Kommentar/die Info des
  // Anwenders. Gesetzliche Feiertage stehen dort ausgeschrieben; die
  // Markierung "F!" gehört ausschließlich in die KW-Spalte.
  //
  // Sobald ein Kommentar vorliegt, steht ausschließlich dieser Text in der
  // Zeile: der Termin- bzw. Feiertagsname verschwindet dann vollständig.
  const informationText =
    annotationLabel !== ''
      ? annotationLabel
      : day.events.map((event) => event.name).join(' · ');

  // Adaptive Schrift: kurze Beschriftungen erscheinen groß, drei Zeilen
  // kleiner. Maßgeblich ist ausschließlich die Beschriftung des Anwenders;
  // Termin- und Feiertagsnamen bleiben in ihrer Standardgröße.
  const infoLineClass = annotationLabel !== '' ? labelLineClass(annotationLabel) : '';

  const classNames = ['day-row'];
  if (day.isWeekend) classNames.push('is-weekend');
  if (day.isSunday) classNames.push('is-sunday');
  if (annotation) classNames.push('has-annotation');
  if (hasColor) classNames.push('has-color');
  if (weekdayHex) classNames.push('has-color-weekday');
  if (dayHex) classNames.push('has-color-day');
  if (infoHex) classNames.push('has-color-info');
  if (shiftHex) classNames.push('has-color-shift');

  const ariaLabel = publicHoliday
    ? `${describeDay(day, annotation)}, ${PUBLIC_HOLIDAY_TITLE}`
    : describeDay(day, annotation);

  /**
   * Streifen-Auswahl: Ein Ziehen zeigt sich nur, wenn die Maustaste in einer
   * der Zieh-Zellen (Wochentag, Tagesnummer, T/N) gedrückt wurde. Ein reiner
   * Klick ohne Zieh-Spalte öffnet weiterhin den Editor. Die gestartete Spalte
   * wird an die Auswahl übergeben und steuert die Hervorhebung.
   */
  const handleMouseDown = (event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    if (!onStreakStart) return;
    const column = columnOfCell(event.target);
    if (!column) return;
    event.preventDefault();
    onStreakStart(day, column);
  };

  const handleMouseEnter = () => {
    if (!onStreakEnter) return;
    onStreakEnter(day);
  };

  /** Nur die vom Streifen gestartete Spalte wird während der Auswahl markiert. */
  const isColumnSelected = (column: ColumnColorName) =>
    isSelected && selectedColumn === column;

  const selectedClass = (column: ColumnColorName) =>
    isColumnSelected(column) ? ' is-column-selected' : '';

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      onClick={() => {
        // Während einer Streifen-Auswahl löst das Loslassen kein Öffnen des
        // Editors aus; das übernimmt der Streak-End-Handler zentral.
        if (isSelected) return;
        onOpenEditor(day);
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseUp={onStreakEnd}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-color-weekday={annotation?.colors.weekday ?? undefined}
      data-color-day={annotation?.colors.day ?? undefined}
      data-color-info={annotation?.colors.info ?? undefined}
      data-color-shift={annotation?.colors.shift ?? undefined}
      data-public-holiday={publicHoliday ? 'true' : undefined}
    >
      <span className={`cell cell-weekday${selectedClass('weekday')}`} style={columnStyle(weekdayHex)}>
        {day.weekdayShort}
      </span>
      <span className={`cell cell-day${selectedClass('day')}`} style={columnStyle(dayHex)}>
        {String(day.day).padStart(2, '0')}
      </span>
      <span
        className={`cell cell-information${selectedClass('info')} ${infoLineClass}`.trim()}
        style={columnStyle(infoHex)}
      >
        {informationText}
      </span>
      <span className="cell cell-kw">
        {day.isoWeekday === 1 && <span className="cell-week">{day.isoWeek}</span>}
        {publicHoliday && (
          <span className="holiday-mark" title={PUBLIC_HOLIDAY_TITLE} aria-hidden="true">
            {PUBLIC_HOLIDAY_MARK}
          </span>
        )}
      </span>
      <span className={`cell cell-shift${selectedClass('shift')}`} style={columnStyle(shiftHex)}>
        {day.shiftLabel}
      </span>
    </button>
  );
}
