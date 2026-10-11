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

import type { MouseEvent as ReactMouseEvent } from 'react';
import type {
  AnniversaryMap,
  CalendarDay,
  ColumnColorName,
  UserDayAnnotation,
} from '../domain/types.ts';
import { getColorHex } from '../config/annotationColors.ts';
import { hasPublicHoliday } from '../engines/eventEngine.ts';
import { matchesForDateKey, formatIntervalLabel } from '../engines/anniversaryEngine.ts';
import { PUBLIC_HOLIDAY_MARK, PUBLIC_HOLIDAY_TITLE } from '../print/PrintMonth.tsx';
import { cellLineClass } from '../utils/textFit.ts';
import { ExtraColumnCell, type ExtraColumnDisplay } from './ExtraColumnCell.tsx';

export interface CalendarDayRowProps {
  day: CalendarDay;
  annotation: UserDayAnnotation | undefined;
  /**
   * Anzeige-Option "Wochentag über Datum" (Standard: aus).
   *
   * false: Wochentag und Tagesnummer stehen in getrennten Zellen.
   * true:  Das Datum steht unter dem Wochentag in einer Zelle, die Zelle der
   *        Tagesnummer entfällt.
   */
  weekdayOverDate?: boolean;
  onOpenEditor: (day: CalendarDay) => void;
  /** Anzeige-Checkbox "Schichtkalender" (Standard: an). */
  showShiftCalendar?: boolean;
  /** Jahreslose Geburtstage und wiederkehrende Ereignisse. */
  anniversaries?: AnniversaryMap;
  /** Anzeige-Checkbox "Geburtstag" (Standard: an). */
  showBirthdays?: boolean;
  /** Anzeige-Checkbox "wdh. Ereignis" (Standard: an). */
  showRecurringEvents?: boolean;
  /**
   * Frei angelegte Zusatzspalten des Monats, in Anzeigereihenfolge.
   *
   * Sie sind leer und dienen dem Benutzer als zusätzlicher Platz. Spalten der
   * Seite `left` stehen zwischen Datum und Info (links der Ereigniszelle),
   * Spalten der Seite `right` zwischen KW und T/N. Ohne Eintrag bleibt die
   * Zeile unverändert.
   */
  extraColumns?: ExtraColumnDisplay[];
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
  weekdayOverDate = false,
  onOpenEditor,
  showShiftCalendar = true,
  anniversaries = {},
  showBirthdays = true,
  showRecurringEvents = true,
  extraColumns,
  isSelected = false,
  selectedColumn = null,
  onStreakStart,
  onStreakEnter,
  onStreakEnd,
}: CalendarDayRowProps) {
  const publicHoliday = hasPublicHoliday(day);
  const annotationLabel = annotation?.label ?? '';

  // Passende Jahrestage des Kalendertags: Geburtstag und/oder wiederkehrendes
  // Ereignis. Über die Checkboxen lassen sich beide Arten getrennt ein- und
  // ausblenden; die angezeigten Einträge werden hier danach gefiltert.
  const anniversaryMatches = matchesForDateKey(anniversaries, day.dateKey, day.year).filter(
    ({ entry }) =>
      (entry.kind === 'birthday' && showBirthdays) ||
      (entry.kind === 'recurring' && showRecurringEvents),
  );

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

  const columnStyle = (hex: string | null) =>
    hex ? { backgroundColor: hex } : undefined;

  // Eine Zeile gilt als eingefärbt, sobald in irgendeiner Spalte eine Farbe
  // gesetzt ist. Das steuert die Kontrast-/Textfarbe der Zeile. Die frei
  // angelegten Zusatzspalten zählen dabei mit.
  const hasColor = Boolean(
    weekdayHex ||
      dayHex ||
      infoHex ||
      shiftHex ||
      Object.keys(annotation?.extraColors ?? {}).length > 0,
  );

  // Der Informationstext zeigt die Termine und den Kommentar/die Info des
  // Anwenders. Gesetzliche Feiertage stehen dort ausgeschrieben; die
  // Markierung "F" gehört ausschließlich in die KW-Spalte.
  //
  // Sobald ein Kommentar vorliegt, steht ausschließlich dieser Text in der
  // Zeile: der Termin- bzw. Feiertagsname verschwindet dann vollständig.
  const informationText =
    annotationLabel !== ''
      ? annotationLabel
      : day.events.map((event) => event.name).join(' · ');

  // Adaptive Schrift über den gesamten Zellinhalt: Die Beschriftung folgt den
  // DayEditor-Regeln, jeder Jahrestag belegt zusätzlich eine Zeile (siehe
  // `cellLineClass`). Dadurch wird die Schrift kleiner, sobald zu einer
  // einzeiligen Beschriftung noch ein Geburtstag/ereignis hinzukommt. Ohne
  // Beschriftung und ohne Jahrestage (nur Terminnamen) bleibt die normale
  // Zeilengröße erhalten.
  const infoLineClass =
    annotationLabel !== '' || anniversaryMatches.length > 0
      ? cellLineClass(informationText, anniversaryMatches.length)
      : '';

  const classNames = ['day-row'];
  if (weekdayOverDate) classNames.push('is-weekday-over-date');
  if (day.isWeekend) classNames.push('is-weekend');
  if (day.isSunday) classNames.push('is-sunday');
  if (annotation) classNames.push('has-annotation');
  if (hasColor) classNames.push('has-color');
  if (weekdayHex) classNames.push('has-color-weekday');
  if (dayHex) classNames.push('has-color-day');
  if (infoHex) classNames.push('has-color-info');
  if (shiftHex) classNames.push('has-color-shift');

  const anniversaryLabel = anniversaryMatches
    .map(({ entry, age }) => {
      if (entry.kind === 'birthday') {
        return `Geburtstag ${entry.name}${age !== undefined ? ` (${age})` : ''}`;
      }
      return `wiederkehrendes Ereignis ${entry.name} (${formatIntervalLabel(entry)})`;
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
      {weekdayOverDate ? (
        // Datum unter dem Wochentag: eine gemeinsame Zelle, keine eigene
        // Tagesnummer-Zelle. Der Zugriff auf die Farbe der Tagesnummer bleibt
        // über `data-color-day` erhalten.
        <span
          className={`cell cell-weekday cell-date-stack${selectedClass('weekday')}`}
          style={columnStyle(combinedWeekdayHex)}
        >
          <span className="cell-weekday-name">{day.weekdayShort}</span>
          <span className="cell-weekday-date">{String(day.day).padStart(2, '0')}</span>
        </span>
      ) : (
        <>
          <span className={`cell cell-weekday${selectedClass('weekday')}`} style={columnStyle(weekdayHex)}>
            {day.weekdayShort}
          </span>
          <span className={`cell cell-day${selectedClass('day')}`} style={columnStyle(dayHex)}>
            {String(day.day).padStart(2, '0')}
          </span>
        </>
      )}
      {/* Zusatzspalten links der Ereignis-/Info-Zelle (zwischen Datum und Info). */}
      {(extraColumns ?? [])
        .filter((column) => column.side === 'left')
        .map((column) => (
          <ExtraColumnCell
            key={`extra-left-${column.name}`}
            column={column}
            annotation={annotation}
          />
        ))}
      <span
        className={[
          'cell',
          'cell-information',
          selectedClass('info'),
          infoLineClass,
          annotationLabel !== '' ? 'has-annotation-entry' : '',
        ]
          .filter((name) => name !== '')
          .join(' ')}
      >
        {anniversaryMatches.length > 0 && (
          <span className="cell-anniversaries">
            {anniversaryMatches.map(({ entry, age }, index) => (
              <span
                key={entry.id}
                className={
                  entry.kind === 'birthday'
                    ? 'anniversary-entry is-birthday'
                    : 'anniversary-entry is-recurring'
                }
              >
                {index > 0 && ' · '}
                <span className="anniversary-emoji" aria-hidden="true">
                  {entry.kind === 'birthday' ? '🎂' : '🔁'}
                </span>{' '}
                {entry.name}
                {entry.kind === 'birthday' && age !== undefined && (
                  <span className="anniversary-age"> ({age})</span>
                )}
                {entry.kind === 'recurring' && (
                  <span className="anniversary-interval"> ({formatIntervalLabel(entry)})</span>
                )}
              </span>
            ))}
          </span>
        )}
        {informationText !== '' && (
          <span className="cell-information-text" style={columnStyle(infoHex)}>
            {informationText}
          </span>
        )}
      </span>
      <span className="cell cell-kw">
        {day.isoWeekday === 1 && <span className="cell-week">{day.isoWeek}</span>}
        {publicHoliday && (
          <span className="holiday-mark" title={PUBLIC_HOLIDAY_TITLE} aria-hidden="true">
            {PUBLIC_HOLIDAY_MARK}
          </span>
        )}
      </span>
      {(extraColumns ?? [])
        .filter((column) => column.side === 'right')
        .map((column) => (
          <ExtraColumnCell
            key={`extra-right-${column.name}`}
            column={column}
            annotation={annotation}
          />
        ))}
      {showShiftCalendar && (
        <span
          className={`cell cell-shift${selectedClass('shift')}`}
          style={columnStyle(shiftHex)}
        >
          {day.shiftLabel}
        </span>
      )}
    </button>
  );
}
