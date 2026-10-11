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
  AnniversaryMap,
  CalendarDay,
  ColumnColorName,
  ExtraColumnColorKey,
  ExtraColumnText,
  ExtraColumns,
  MonthCalendar as MonthCalendarModel,
} from '../domain/types.ts';
import { getColorHex } from '../config/annotationColors.ts';
import { getPrintEventName } from '../config/eventDefinitions.ts';
import { hasPublicHoliday } from '../engines/eventEngine.ts';
import { matchesForDateKey, formatIntervalLabel } from '../engines/anniversaryEngine.ts';
import { cellLineClass } from '../utils/textFit.ts';
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
  /** Anzeige-Checkbox "Schichtkalender" (Standard: an). */
  showShiftCalendar?: boolean;
  /** Jahreslose Geburtstage und wiederkehrende Ereignisse. */
  anniversaries?: AnniversaryMap;
  /** Anzeige-Checkbox "Geburtstag" (Standard: an). */
  showBirthdays?: boolean;
  /** Anzeige-Checkbox "wdh. Ereignis" (Standard: an). */
  showRecurringEvents?: boolean;
  /**
   * Frei angelegte Zusatzspalten des Monats (rein darstellungsbezogen).
   *
   * Sie werden - wie am Bildschirm - links der Informationsspalte und rechts
   * der KW-Spalte eingefügt. Ohne Eintrag bleibt der Monatsblock unverändert.
   */
  extraColumns?: ExtraColumns;
  /** Farben der Zusatzspalten je Tag (`dateKey` -> `extraN` -> colorId). */
  annotationExtraColors?: Record<string, Partial<Record<ExtraColumnColorKey, AnnotationColorId>>>;
  /**
   * Querliegende Texte je Ankertag (`dateKey` -> Liste der Texte).
   * Sie werden als Überlagerung über die markierte Zeilenspanne gezogen.
   */
  extraTextsByDateKey?: Record<string, readonly ExtraColumnText[]>;
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

/**
 * Textbausteine der Jahrestage eines Tages für den Druck.
 *
 * Geburtstage erscheinen mit Torten-Emoji und - sofern ein Geburtsjahr
 * vorliegt - dem Alter in Klammern; wiederkehrende Ereignisse mit
 * Wiederholungssymbol. Die beiden Anzeige-Checkboxen steuern, welche Art
 * übernommen wird.
 */
export function buildAnniversaryPrintParts(
  day: CalendarDay,
  year: number,
  anniversaries: AnniversaryMap | undefined,
  showBirthdays: boolean,
  showRecurringEvents: boolean,
): string[] {
  if (!anniversaries) return [];
  return matchesForDateKey(anniversaries, day.dateKey, year)
    .filter(
      ({ entry }) =>
        (entry.kind === 'birthday' && showBirthdays) ||
        (entry.kind === 'recurring' && showRecurringEvents),
    )
    .map(({ entry, age }) => {
      if (entry.kind === 'birthday') {
        const agePart = age !== undefined ? ` (${age})` : '';
        return `🎂 ${entry.name}${agePart}`;
      }
      const intervalPart = ` (${formatIntervalLabel(entry)})`;
      return `🔁 ${entry.name}${intervalPart}`;
    });
}


/**
 * Querliegender Text der Druckansicht samt Platzierung im 31-Zeilen-Raster.
 *
 * `leftMm`/`rightMm`/`widthMm` bestimmen die Spalte in Millimetern (die
 * Maßangaben der Drucktabelle sind fest), `topRow`/`spanRows` die Zeilenspanne
 * im festen 31-Zeilen-Raster. Da alle Zeilen über `minmax(0, 1fr)` gleich hoch
 * sind, lässt sich die Platzierung als Prozentwert der Rasterhöhe angeben.
 */
export interface PrintExtraTextOverlay {
  id: string;
  text: string;
  vertical: boolean;
  /** Abstand vom linken Rand des Rasters (mm); null = von rechts messen. */
  leftMm: number | null;
  /** Abstand vom rechten Rand des Rasters (mm); null = von links messen. */
  rightMm: number | null;
  /** Breite der Spalte (mm). */
  widthMm: number;
  /** 0-basierte erste Zeile der Spanne im 31-Zeilen-Raster. */
  topRow: number;
  /** Anzahl belegter Zeilen der Spanne (≥ 1). */
  spanRows: number;
}

/**
 * Ermittelt die querliegenden Texte eines Monats für den Druck.
 *
 * Anders als am Bildschirm steht hier kein DOM zur Messung zur Verfügung:
 * die Spaltenbreiten der Drucktabelle sind fest (mm) und die Zeilen sind alle
 * gleich hoch. Die Platzierung lässt sich daher rein rechnerisch bestimmen.
 * Berücksichtigt werden nur Texte, deren Zusatzspalte im Druck vorhanden ist.
 */
export function collectPrintExtraTexts(
  month: MonthCalendarModel,
  extraTextsByDateKey: Record<string, readonly ExtraColumnText[]>,
  extraColumns: readonly { colorKey: ExtraColumnColorKey; side: 'left' | 'right' }[],
  weekdayOverDate: boolean,
): PrintExtraTextOverlay[] {
  const dayIndexByKey = new Map<string, number>();
  month.days.forEach((day, index) => dayIndexByKey.set(day.dateKey, index));

  // Offsets der festen Spalten in mm (siehe print.css).
  const leadingMm = weekdayOverDate ? 6.5 : 6.5 + 7;
  const trailingMm = 5; // Schichtspalte T/N
  const unitMm = PRINT_EXTRA_COLUMN_UNIT_MM;
  const leftColumns = extraColumns.filter((column) => column.side === 'left');
  const rightColumns = extraColumns.filter((column) => column.side === 'right');

  const overlays: PrintExtraTextOverlay[] = [];
  for (const [dateKey, texts] of Object.entries(extraTextsByDateKey)) {
    if (!dayIndexByKey.has(dateKey)) continue;
    for (const text of texts) {
      if (!text || text.text === '') continue;
      // Nur der Anker (frühester Tag der Spanne) trägt einen Text.
      if (text.dateKeys[0] !== dateKey) continue;

      const leftIndex = leftColumns.findIndex((column) => column.colorKey === text.colorKey);
      const rightIndex = rightColumns.findIndex((column) => column.colorKey === text.colorKey);
      if (leftIndex < 0 && rightIndex < 0) continue;

      const rows = text.dateKeys
        .map((key) => dayIndexByKey.get(key))
        .filter((index): index is number => index !== undefined)
        .sort((a, b) => a - b);
      if (rows.length === 0) continue;

      overlays.push({
        id: `${dateKey}-${text.colorKey}`,
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
function PrintExtraCell({
  colorKey,
  annotationExtraColors,
  dateKey,
}: {
  colorKey: ExtraColumnColorKey;
  annotationExtraColors: Record<string, Partial<Record<ExtraColumnColorKey, AnnotationColorId>>>;
  dateKey: string | null;
}) {
  const colorId = dateKey ? annotationExtraColors[dateKey]?.[colorKey] ?? null : null;
  const hex = getColorHex(colorId);
  return (
    <span
      className="print-col-extra"
      data-extra-column-key={colorKey}
      style={hex ? { backgroundColor: hex } : undefined}
    />
  );
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
function PrintExtraTextOverlay({ overlays }: { overlays: readonly PrintExtraTextOverlay[] }) {
  if (overlays.length === 0) return null;
  return (
    <div className="print-month-overlay" aria-hidden="true">
      {overlays.map((overlay) => (
        <span
          key={overlay.id}
          className={overlay.vertical ? 'print-extra-text is-vertical' : 'print-extra-text'}
          style={{
            top: `${(overlay.topRow / PRINT_ROWS) * 100}%`,
            height: `${(overlay.spanRows / PRINT_ROWS) * 100}%`,
            width: `${overlay.widthMm}mm`,
            left: overlay.leftMm !== null ? `${overlay.leftMm}mm` : undefined,
            right: overlay.rightMm !== null ? `${overlay.rightMm}mm` : undefined,
          }}
        >
          <span>{overlay.text}</span>
        </span>
      ))}
    </div>
  );
}

export function PrintMonth({
  month,
  annotationLabels,
  annotationColors,
  weekdayOverDate = false,
  showShiftCalendar = true,
  anniversaries,
  showBirthdays = true,
  showRecurringEvents = true,
  extraColumns,
  annotationExtraColors = {},
  extraTextsByDateKey = {},
}: PrintMonthProps) {
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
  const extraTracks = (units: number): string =>
    units <= 0 ? '' : ` ${`${PRINT_EXTRA_COLUMN_UNIT_MM}mm `.repeat(units).trim()}`;
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
  const extraTextOverlays = collectPrintExtraTexts(
    month,
    extraTextsByDateKey,
    extraColumnsForRow,
    weekdayOverDate,
  );

  return (
    <div
      className={showShiftCalendar ? 'print-month' : 'print-month is-shift-hidden'}
      data-month={month.month}
      style={
        {
          '--print-extra-left': `${leftColumns.length * PRINT_EXTRA_COLUMN_UNIT_MM}mm`,
          '--print-extra-right': `${rightColumns.length * PRINT_EXTRA_COLUMN_UNIT_MM}mm`,
          '--print-row-columns': rowColumns,
          '--print-row-columns-weekday-over-date': rowColumnsWeekdayOverDate,
          '--print-row-columns-no-shift': rowColumnsNoShift,
          '--print-row-columns-no-shift-weekday-over-date': rowColumnsNoShiftWeekdayOverDate,
        } as Record<string, string>
      }
    >
      <div className="print-month-header">
        {showShiftCalendar ? (
          <span className="print-month-stat" title="Werktage Montag bis Freitag">
            {month.statistics.weekdayCount} Werktage
          </span>
        ) : (
          <span className="print-month-stat" aria-hidden="true" />
        )}
        <span className="print-month-name">{month.name.toUpperCase()}</span>
        {showShiftCalendar ? (
          <span className="print-month-stat print-month-stat-end" title="Sollschichten (T + N)">
            {month.statistics.requiredShiftCount} Sollschichten
          </span>
        ) : (
          <span className="print-month-stat print-month-stat-end" aria-hidden="true" />
        )}
      </div>
      <div className="print-month-body">
        {rows.map((row) => {
          if (!row.day) {
            return (
              <div className={emptyRowClassName} key={`empty-${row.position}`}>
                <span className="print-col-wo" />
                {/* Ohne eigene Datumsspalte trägt die Wochentagsspalte beide Angaben. */}
                {!weekdayOverDate && <span className="print-col-datum" />}
                {leftColumns.map((column) => (
                  <PrintExtraCell
                    key={`extra-left-${column.name}`}
                    colorKey={column.colorKey}
                    annotationExtraColors={annotationExtraColors}
                    dateKey={null}
                  />
                ))}
                <span className="print-col-info" />
                <span className="print-col-kw" />
                {rightColumns.map((column) => (
                  <PrintExtraCell
                    key={`extra-right-${column.name}`}
                    colorKey={column.colorKey}
                    annotationExtraColors={annotationExtraColors}
                    dateKey={null}
                  />
                ))}
                {showShiftCalendar && <span className="print-col-schicht" />}
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
          const anniversaryParts = buildAnniversaryPrintParts(
            day,
            month.year,
            anniversaries,
            showBirthdays,
            showRecurringEvents,
          );
          const baseInformation = buildPrintInformation(day, label);
          // Adaptive Schrift über den gesamten Zellinhalt: Die Beschriftung
          // folgt den DayEditor-Regeln, jeder Jahrestag belegt zusätzlich eine
          // Zeile (siehe `cellLineClass`). Ohne Beschriftung und ohne
          // Jahrestage (nur Terminnamen) bleibt die normale Zeilengröße.
          const infoLineClass =
            label !== '' || anniversaryParts.length > 0
              ? cellLineClass(baseInformation, anniversaryParts.length)
              : '';
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
              {leftColumns.map((column) => (
                <PrintExtraCell
                  key={`extra-left-${column.name}`}
                  colorKey={column.colorKey}
                  annotationExtraColors={annotationExtraColors}
                  dateKey={day.dateKey}
                />
              ))}
              <span className={`print-col-info ${infoLineClass}`.trim()}>
                {anniversaryParts.length > 0 && (
                  <span className="print-col-anniversaries">
                    {anniversaryParts.join(' · ')}
                  </span>
                )}
                {baseInformation !== '' && (
                  <span className="print-col-info-text" style={columnStyle(infoHex)}>
                    {baseInformation}
                  </span>
                )}
              </span>
              <span className="print-col-kw">
                {day.isoWeekday === 1 && <span className="print-week">{day.isoWeek}</span>}
                {hasPublicHoliday(day) && <PublicHolidayMark />}
              </span>
              {rightColumns.map((column) => (
                <PrintExtraCell
                  key={`extra-right-${column.name}`}
                  colorKey={column.colorKey}
                  annotationExtraColors={annotationExtraColors}
                  dateKey={day.dateKey}
                />
              ))}
              {showShiftCalendar && (
                <span className="print-col-schicht" style={columnStyle(schichtHex)}>
                  {day.shiftLabel}
                </span>
              )}
            </div>
          );
        })}
        <PrintExtraTextOverlay overlays={extraTextOverlays} />
      </div>
      {showShiftCalendar && (
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
      )}
    </div>
  );
}
