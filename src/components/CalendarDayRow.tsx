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

import type { CalendarDay, UserDayAnnotation } from '../domain/types';
import { getColorHex } from '../config/annotationColors';
import { hasPublicHoliday } from '../engines/eventEngine';
import { PUBLIC_HOLIDAY_MARK, PUBLIC_HOLIDAY_TITLE } from '../print/PrintMonth';

export interface CalendarDayRowProps {
  day: CalendarDay;
  annotation: UserDayAnnotation | undefined;
  onOpenEditor: (day: CalendarDay) => void;
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

export function CalendarDayRow({ day, annotation, onOpenEditor }: CalendarDayRowProps) {
  const colorHex = getColorHex(annotation?.colorId ?? null);
  const publicHoliday = hasPublicHoliday(day);
  const annotationLabel = annotation?.label ?? '';

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

  const classNames = ['day-row'];
  if (day.isWeekend) classNames.push('is-weekend');
  if (day.isSunday) classNames.push('is-sunday');
  if (annotation) classNames.push('has-annotation');
  if (colorHex) classNames.push('has-color');

  const ariaLabel = publicHoliday
    ? `${describeDay(day, annotation)}, ${PUBLIC_HOLIDAY_TITLE}`
    : describeDay(day, annotation);

  return (
    <button
      type="button"
      className={classNames.join(' ')}
      style={colorHex ? { backgroundColor: colorHex } : undefined}
      onClick={() => onOpenEditor(day)}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-color-id={annotation?.colorId ?? undefined}
      data-public-holiday={publicHoliday ? 'true' : undefined}
    >
      <span className="cell cell-weekday">{day.weekdayShort}</span>
      <span className="cell cell-day">{String(day.day).padStart(2, '0')}</span>
      <span className="cell cell-information">{informationText}</span>
      <span className="cell cell-kw">
        {day.isoWeekday === 1 && <span className="cell-week">{day.isoWeek}</span>}
        {publicHoliday && (
          <span className="holiday-mark" title={PUBLIC_HOLIDAY_TITLE} aria-hidden="true">
            {PUBLIC_HOLIDAY_MARK}
          </span>
        )}
      </span>
      <span className="cell cell-shift">{day.shiftLabel}</span>
    </button>
  );
}
