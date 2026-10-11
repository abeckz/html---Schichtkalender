/**
 * Monatskalender der Bildschirmdarstellung.
 *
 * Der Monat wirkt tabellarisch: jeder Tag ist eine Zeile, die Tage laufen
 * von oben nach unten. Der Kopf zeigt Monatsname und Kennzahlen; auf eine
 * Spaltenkopfzeile wird bewusst verzichtet.
 *
 * Die Fußzeile nennt ausschließlich die Schichtzahlen (T und N). Die
 * Berechnung der bezahlten Feiertage (volle und halbe aus dem
 * Nachtschichtüberhang) bleibt im Modell erhalten, wird hier aber nicht
 * angezeigt.
 *
 * Zusätzlich werden die in der Schichtspalte (T/N) farbig markierten
 * Schichten je Farbe zusammengefasst. Gezählt wird dabei nur ein Tag, der
 * tatsächlich eine Schicht trägt (T oder N); freie Tage des Zyklus (OFF)
 * zählen nicht mit. Die Summe erscheint ganz unten als farbiges Kästchen in
 * der jeweiligen Markierungsfarbe mit der Anzahl der markierten Tage.
 */

import type {
  AnnotationColorId,
  AnnotationMap,
  AnniversaryMap,
  CalendarDay,
  ColumnColorName,
  ExtraColumns,
  MonthCalendar as MonthCalendarModel,
} from '../domain/types.ts';
import { annotationColors, getColorHex } from '../config/annotationColors.ts';
import { CalendarDayRow } from './CalendarDayRow.tsx';
import {
  buildExtraColumnLayout,
  extraColumnUnitCount,
  type ExtraColumnDisplay,
} from './ExtraColumnCell.tsx';
import { ColumnInsertHandle } from './ColumnInsertHandle.tsx';
import type { ExtraColumnSide } from '../services/settingsStore.ts';

/** Breite einer Spalteneinheit in em; muss zum Raster in styles.css passen. */
export const EXTRA_COLUMN_UNIT_EM = 1.6;

/**
 * Baut die Trackliste der Zusatzspalten einer Seite.
 *
 * `repeat()` in CSS kennt keinen variablen Zähler; die Spuren müssen daher als
 * fertige Zeichenkette vorliegen. Je Einheit entsteht genau ein Track der
 * Breite `unitEm` (Leerzeichen-getrennt, mit führendem Leerzeichen);
 * bei 0 Einheiten bleibt die Zeichenkette leer.
 */
function extraTracks(units: number, unitEm: number): string {
  if (units <= 0) return '';
  return ` ${`${unitEm}em `.repeat(units).trim()}`;
}

export interface MonthCalendarProps {
  month: MonthCalendarModel;
  annotations: AnnotationMap;
  /** Anzeige-Option "Wochentag über Datum" (Standard: aus). */
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
  /** dateKeys der aktuell markierten Streifen-Auswahl. */
  selectedKeys?: ReadonlySet<string>;
  /** Spalte, die während der aktuellen Streifen-Auswahl hervorgehoben wird. */
  selectedColumn?: ColumnColorName | null;
  /**
   * Frei angelegte Zusatzspalten des Monats.
   *
   * Sie liegen links der Ereignis-/Info-Zelle (zwischen Datum und Info) sowie
   * rechts der KW-Zelle (zwischen KW und T/N). Jede Spalte belegt einen eigenen
   * Rasterslot; da die Gesamtbreite fest ist und die Info-Spalte den Rest
   * aufnimmt, wird beim Anlegen nur die Info-Spalte schmaler, ohne dass etwas
   * verdeckt wird. Die Schichtspalte T/N bleibt am rechten Rand.
   */
  extraColumns?: ExtraColumns;
  /** Legt eine schmale Zusatzspalte an einer der beiden Trennlinien an. */
  onAddExtraColumn?: (month: number, side: ExtraColumnSide) => void;
  /** Erweitert die Spalte unmittelbar an der Trennlinie um eine Einheit. */
  onWidenExtraColumn?: (month: number, side: ExtraColumnSide, index: number) => void;
  onStreakStart?: (day: CalendarDay, column: ColumnColorName) => void;
  onStreakEnter?: (day: CalendarDay) => void;
  onStreakEnd?: () => void;
}

/** Eine gezählte Schichtmarkierung: Anzahl markierter Schichttage je Farbe. */
export interface MarkedShiftCount {
  colorId: AnnotationColorId;
  /** Anzahl der mit dieser Farbe markierten und tatsächlich erfassten Schichttage. */
  count: number;
}

/**
 * Zählt die in der Schichtspalte (T/N) markierten Schichten je Farbe.
 *
 * Berücksichtigt werden ausschließlich Tage, die tatsächlich eine Schicht
 * tragen ("T" oder "N", also `shiftLabel !== ''`). Freie Tage des Zyklus
 * (OFF) werden nicht gezählt, selbst wenn die Schichtspalte dort eingefärbt
 * wurde. Gezählt wird nur die Spalte 'shift'; die übrigen Farbspalten
 * (Wochentag, Tagesnummer, Info) bleiben ohne Wirkung.
 *
 * Das Ergebnis ist nach der Reihenfolge der Farbpalette sortiert, damit die
 * Anzeige unabhängig von der Reihenfolge der Annotationen stabil bleibt.
 */
export function countMarkedShiftsByColor(
  days: readonly CalendarDay[],
  annotations: AnnotationMap,
): MarkedShiftCount[] {
  return countMarkedShiftsByColorLookup(days, (dateKey) => annotations[dateKey]?.colors.shift);
}

/**
 * Variante von `countMarkedShiftsByColor` für die Druckansicht, die mit einer
 * Farbtabelle (datumsschlüssel -> Spaltenfarben) arbeitet, statt mit der
 * vollständigen AnnotationMap.
 */
export function countMarkedShiftsByColorTable(
  days: readonly CalendarDay[],
  colorTable: Record<string, Partial<Record<ColumnColorName, AnnotationColorId>>>,
): MarkedShiftCount[] {
  return countMarkedShiftsByColorLookup(days, (dateKey) => colorTable[dateKey]?.shift);
}

/**
 * Gemeinsamer Kern: zählt je Farbe die erfassten Schichttage anhand eines
 * Farb-Lookup. Nur Tage mit tatsächlicher Schicht (T/N) werden gezählt.
 */
function countMarkedShiftsByColorLookup(
  days: readonly CalendarDay[],
  getShiftColor: (dateKey: string) => AnnotationColorId | undefined,
): MarkedShiftCount[] {
  const counts = new Map<AnnotationColorId, number>();
  for (const day of days) {
    // Nur erfasste Schichten (T/N) zählen; freie Tage bleiben außen vor.
    if (day.shiftLabel === '') continue;
    const colorId = getShiftColor(day.dateKey);
    if (!colorId) continue;
    counts.set(colorId, (counts.get(colorId) ?? 0) + 1);
  }
  return annotationColors
    .filter((color) => counts.has(color.id))
    .map((color) => ({ colorId: color.id, count: counts.get(color.id) ?? 0 }));
}

export function MonthCalendar({
  month,
  annotations,
  weekdayOverDate = false,
  onOpenEditor,
  showShiftCalendar = true,
  anniversaries = {},
  showBirthdays = true,
  showRecurringEvents = true,
  selectedKeys,
  selectedColumn,
  extraColumns,
  onAddExtraColumn,
  onWidenExtraColumn,
  onStreakStart,
  onStreakEnter,
  onStreakEnd,
}: MonthCalendarProps) {
  const { statistics } = month;
  const markedShiftCounts = countMarkedShiftsByColor(month.days, annotations);
  // Die Anzeige-Option ändert ausschließlich das Spaltenraster des Monats:
  // mit gesetztem Schalter steht das Datum unter dem Wochentag und die
  // Tagesnummer-Spalte entfällt (der Platz kommt der Info-Spalte zugute).
  const tableClassName = weekdayOverDate
    ? 'day-table is-weekday-over-date'
    : 'day-table';

  // Frei angelegte Zusatzspalten: Anzeigemodell sowie das Spaltenraster des
  // Monats. Die Breite wird als CSS-Variable gesetzt, damit alle Zeilen des
  // Monats dieselbe Aufteilung verwenden und die Ansicht nach außen wächst.
  const layout = buildExtraColumnLayout(extraColumns);
  const leftUnits = extraColumnUnitCount(extraColumns?.left);
  const rightUnits = extraColumnUnitCount(extraColumns?.right);
  /**
   * Spaltenraster des Monats als CSS-Variablen.
   *
   * `--day-row-columns` ist die vollständige Trackliste der Tageszeilen;
   * `--day-row-columns-weekday-over-date` die Variante mit gemeinsamem Feld für
   * Wochentag und Datum (sowie die beiden `-no-shift`-Varianten ohne
   * Schichtspalte). Diese Zeichenketten werden hier gebaut, weil `repeat()` in
   * CSS keinen variablen Zähler kennt.
   *
   * `--extra-left-width` / `--extra-right-width` sind die Gesamtbreiten; sie
   * dienen ausschließlich der Positionierung der Bedienpunkte. Wichtig: Jede
   * Zusatzspalte belegt genau EINEN Rastertrack. Sonst würden die zusätzlichen
   * Zellen das Raster verschieben (KW/T-N rutschen nach innen), weil mehr
   * Zellen als Spuren vorhanden wären.
   */
  const extraUnitEm = EXTRA_COLUMN_UNIT_EM;
  const leftTracks = extraTracks(leftUnits, extraUnitEm);
  const rightTracks = extraTracks(rightUnits, extraUnitEm);
  /**
   * Spaltenraster des Monats.
   *
   * Reihenfolge: Wochentag | Datum | [Zusatz links] | Info/Ereignis |
   * KW | [Zusatz rechts] | T/N.
   *
   * Die Zusatzspalten der Seite `left` liegen damit unmittelbar LINKS der
   * Ereignis-/Info-Zelle (zwischen Datum und Info), die der Seite `right`
   * rechts der KW-Zelle (zwischen KW und T/N).
   */
  const columnWidths: Record<string, string> = {
    '--extra-left-width': `${leftUnits * extraUnitEm}em`,
    '--extra-right-width': `${rightUnits * extraUnitEm}em`,
    '--day-row-columns': `2.4em 2.4em${leftTracks} minmax(0, 1fr) 3.2em${rightTracks} 2.2em`,
    '--day-row-columns-weekday-over-date': `3.6em${leftTracks} minmax(0, 1fr) 3.2em${rightTracks} 2.2em`,
    '--day-row-columns-no-shift': `2.4em 2.4em${leftTracks} minmax(0, 1fr) 3.2em`,
    '--day-row-columns-no-shift-weekday-over-date': `3.6em${leftTracks} minmax(0, 1fr) 3.2em`,
  };
  const leftColumns = layout.left;
  const rightColumns = layout.right;
  // Links vor der KW-/T-N-Spalte, rechts unmittelbar nach der KW-Spalte. Ohne
  // Schichtspalte (Anzeige-Checkbox "Schichtkalender" aus) entfällt die rechte
  // Trennlinie und damit auch die rechts liegenden Zusatzspalten.
  const extraColumnsForRow: ExtraColumnDisplay[] = showShiftCalendar
    ? [...leftColumns, ...rightColumns]
    : leftColumns;

  /**
   * Klick auf einen Bedienpunkt: liegt an der Trennlinie noch keine
   * Zusatzspalte, wird eine angelegt; andernfalls wächst die bereits dort
   * liegende Spalte um eine Einheit. Dadurch bleibt die Lage der vorhandenen
   * Spalten unverändert und die Ansicht wird nach außen geschoben.
   */
  const handleInsertActivate = (side: ExtraColumnSide, nearEdgeIndex: number) => {
    if (nearEdgeIndex >= 0) {
      onWidenExtraColumn?.(month.month, side, nearEdgeIndex);
      return;
    }
    onAddExtraColumn?.(month.month, side);
  };

  return (
    <section
      className={showShiftCalendar ? 'month-card' : 'month-card is-shift-hidden'}
      aria-label={`${month.name} ${month.year}`}
      style={columnWidths}
    >
      <header
        className={
          weekdayOverDate ? 'month-header is-weekday-over-date' : 'month-header'
        }
      >
        {showShiftCalendar ? (
          <span className="month-stat" title="Werktage Montag bis Freitag">
            {statistics.weekdayCount} Werktage
          </span>
        ) : (
          <span className="month-stat" aria-hidden="true" />
        )}
        <h2 className="month-title" aria-label={month.name}>
          {month.name}
        </h2>
        {showShiftCalendar ? (
          <span className="month-stat" title="Sollschichten (T + N)">
            {statistics.requiredShiftCount} Soll
          </span>
        ) : (
          <span className="month-stat" aria-hidden="true" />
        )}

        {/*
          Bedienpunkte auf den vertikalen Trennlinien: links vor der KW-Spalte,
          rechts vor der Schichtspalte T/N. Sie werden erst beim Überfahren des
          Monatskopfs sichtbar. Rechts ist der Punkt um die Breite der bereits
          rechts liegenden Zusatzspalten eingerückt, damit er genau auf der
          Trennlinie sitzt.
        */}
        {onAddExtraColumn && (
          <ColumnInsertHandle
            side="left"
            nearEdgeIndex={leftColumns.length > 0 ? 0 : -1}
            onActivate={handleInsertActivate}
          />
        )}
        {onAddExtraColumn && showShiftCalendar && (
          <ColumnInsertHandle
            side="right"
            nearEdgeIndex={rightColumns.length > 0 ? 0 : -1}
            onActivate={handleInsertActivate}
          />
        )}
      </header>

      <div className={tableClassName} role="table" aria-label={`Tage im ${month.name}`}>
        {month.days.map((day) => (
          <CalendarDayRow
            key={day.dateKey}
            day={day}
            annotation={annotations[day.dateKey]}
            weekdayOverDate={weekdayOverDate}
            onOpenEditor={onOpenEditor}
            showShiftCalendar={showShiftCalendar}
            anniversaries={anniversaries}
            showBirthdays={showBirthdays}
            showRecurringEvents={showRecurringEvents}
            extraColumns={extraColumnsForRow}
            isSelected={selectedKeys?.has(day.dateKey) ?? false}
            selectedColumn={selectedColumn}
            onStreakStart={onStreakStart}
            onStreakEnter={onStreakEnter}
            onStreakEnd={onStreakEnd}
          />
        ))}
      </div>

      {showShiftCalendar && (
        <footer className="month-footer">
          <span>{statistics.dayShiftCount} × T</span>
          <span>{statistics.nightShiftCount} × N</span>
          {markedShiftCounts.length > 0 && (
            <span className="month-footer-marked" title="Markierte Schichten (T/N) je Farbe">
              {markedShiftCounts.map(({ colorId, count }) => (
                <span
                  key={colorId}
                  className="month-footer-chip"
                  style={{ backgroundColor: getColorHex(colorId) ?? undefined }}
                  title={`${count} markierte ${count === 1 ? 'Schicht' : 'Schichten'}`}
                >
                  {count}
                </span>
              ))}
            </span>
          )}
        </footer>
      )}
    </section>
  );
}
