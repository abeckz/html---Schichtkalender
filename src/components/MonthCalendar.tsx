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

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type {
  AnnotationColorId,
  AnnotationMap,
  AnniversaryMap,
  CalendarDay,
  ColumnColorName,
  ExtraColumnColorKey,
  ExtraColumns,
  ExtraColumnText,
  MonthCalendar as MonthCalendarModel,
  StreakTarget,
} from '../domain/types.ts';
import { annotationColors, getColorHex } from '../config/annotationColors.ts';
import { CalendarDayRow } from './CalendarDayRow.tsx';
import {
  buildExtraColumnLayout,
  extraColumnUnitCount,
  type ExtraColumnDisplay,
} from './ExtraColumnCell.tsx';
import { ColumnInsertHandle, ColumnRemoveHandle } from './ColumnInsertHandle.tsx';
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

/**
 * Ein querliegender Text einer Zusatzspalte als Anzeigeelement im Monatsraster.
 *
 * `gridColumn` ist die Rasterspalte der Zusatzspalte (1-basiert), `gridRowStart`
 * die Tageszeile des Ankers und `gridRowSpan` die Anzahl markierter Zellen. Diese
 * Angaben dienen nur noch der Zuordnung (Anker, Spanne, Farbschlüssel); die
 * tatsächliche Platzierung erfolgt gemessen über `left`/`top`/`width`/`height`
 * (siehe `measureExtraColumnOverlay`), weil `.day-table` keine Grid-Spalten
 * kennt.
 */
export interface ExtraColumnOverlay {
  id: string;
  colorKey: ExtraColumnColorKey;
  columnLabel: string;
  text: string;
  vertical: boolean;
  /**
   * true, wenn die Zusatzspalte am Anker-Tag eine persönliche Farbe trägt.
   *
   * Die Palette ist satt und kräftig; auf einem gefärbten Feld ist die
   * (im Dunkelmodus helle) Standard-Textfarbe nicht lesbar. Deshalb wird der
   * querliegende Text dann - wie die übrigen Zellen einer Farbmarkierung -
   * in Schwarz gezeichnet (siehe `.cell-extra-text.has-color`).
   */
  colored: boolean;
  gridColumn: number;
  gridRowStart: number;
  gridRowSpan: number;
}

/**
 * Gemessene Platzierung eines querliegenden Textes (px, relativ zu `.day-table`).
 * Ist die Spanne bzw. Spalte im Monat nicht messbar (z. B. noch nicht
 * gerendert), liefert die Messung `null` und es wird kein Element ausgegeben.
 */
export interface ExtraColumnOverlayPlacement {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Ermittelt die Rasterspalte (1-basiert) eines Zusatzspalten-Schlüssels.
 *
 * Reihenfolge des Rasters: Wochentag | Datum | [links] | Info | KW | [rechts] | T/N.
 * Bei „Wochentag über Datum" fallen Wochentag und Datum in eine Spalte.
 */
function extraColumnGridColumn(
  colorKey: ExtraColumnColorKey,
  extraColumns: readonly ExtraColumnDisplay[],
  weekdayOverDate: boolean,
): number {
  const leading = weekdayOverDate ? 1 : 2;
  // Position der Spalte innerhalb der Anzeigeliste (links vor rechts).
  const index = extraColumns.findIndex((column) => column.colorKey === colorKey);
  if (index < 0) return 0;
  const leftCount = extraColumns.filter((column) => column.side === 'left').length;
  if (index < leftCount) return leading + index + 1;
  // Rechts der Info- und KW-Spalte: leading + links + Info + KW + rechts.
  return leading + leftCount + 2 + (index - leftCount) + 1;
}

/**
 * Sammelt die querliegenden Texte eines Monats aus den Annotationen.
 *
 * Berücksichtigt werden nur Texte, deren Spanne im Monat liegt und deren
 * Zusatzspalte aktuell (links bzw. rechts) vorhanden ist. Die Spanne wird auf
 * die tatsächlich im Monat vorhandenen Tage begrenzt, damit die Überlagerung
 * nie über den Monat hinausreicht.
 */
export function collectExtraColumnTexts(
  month: MonthCalendarModel,
  annotations: AnnotationMap,
  extraColumns: readonly ExtraColumnDisplay[],
  showShiftCalendar: boolean,
  weekdayOverDate = false,
): ExtraColumnOverlay[] {
  const dayIndexByKey = new Map<string, number>();
  month.days.forEach((day, index) => dayIndexByKey.set(day.dateKey, index));

  const overlays: ExtraColumnOverlay[] = [];
  for (const [dateKey, annotation] of Object.entries(annotations)) {
    // Nur Anker-Tage des Monats betrachten (frühestes Datum der Spanne).
    if (!dayIndexByKey.has(dateKey)) continue;
    const texts = annotation.extraTexts;
    if (!texts) continue;
    for (const text of Object.values(texts) as ExtraColumnText[]) {
      if (!text || text.text === '') continue;
      if (text.dateKeys[0] !== dateKey) continue;
      const column = extraColumns.find((entry) => entry.colorKey === text.colorKey);
      // Rechts liegende Spalten sind ohne Schichtkalender ausgeblendet.
      if (!column || (column.side === 'right' && !showShiftCalendar)) continue;
      const presentRows = text.dateKeys
        .map((key) => dayIndexByKey.get(key))
        .filter((index): index is number => index !== undefined)
        .sort((a, b) => a - b);
      if (presentRows.length === 0) continue;
      const start = presentRows[0];
      const end = presentRows[presentRows.length - 1];
      overlays.push({
        id: `${dateKey}-${text.colorKey}`,
        colorKey: text.colorKey,
        columnLabel: text.columnLabel,
        text: text.text,
        vertical: text.vertical,
        // Am Anker-Tag entscheidet die persönliche Farbe der Zusatzspalte über
        // die Textfarbe der Überlagerung (schwarz auf gefärbtem Feld).
        colored: (annotation.extraColors?.[text.colorKey] ?? null) !== null,
        gridColumn: extraColumnGridColumn(text.colorKey, extraColumns, weekdayOverDate),
        gridRowStart: start + 1,
        gridRowSpan: end - start + 1,
      });
    }
  }
  return overlays;
}

/**
 * Misst die Platzierung eines querliegenden Textes im Tagesraster.
 *
 * `.day-table` ist eine Spalten-Flexbox: die Spaltenbreiten stehen ausschließlich
 * auf den Tageszeilen (`.day-row`). Deshalb wird die Zielzelle (bzw. - bei
 * "Wochentag über Datum" - die passende Zelle der ersten Tageszeile) gesucht und
 * ihr Rechteck sowie die Rechtecke der markierten Zeilen relativ zum Raster
 * ausgewertet.
 *
 * Rückgabe: `left`/`width` aus der Zielzelle, `top`/`height` aus dem
 * zusammengefassten Bereich der markierten Zeilen. Fehlt die Zelle (z. B. weil
 * die Spanne außerhalb des Monats liegt), wird null geliefert.
 */
export function measureExtraColumnOverlay(
  table: HTMLElement,
  overlay: ExtraColumnOverlay,
): ExtraColumnOverlayPlacement | null {
  const rows = table.querySelectorAll<HTMLElement>('.day-row');
  const firstRowIndex = overlay.gridRowStart - 1;
  const lastRowIndex = overlay.gridRowStart - 1 + overlay.gridRowSpan - 1;
  const firstRow = rows[firstRowIndex];
  const lastRow = rows[lastRowIndex];
  if (!firstRow || !lastRow) return null;

  // Eine erweiterte Spalte besteht aus mehreren Zellen mit demselben
  // Farbschlüssel; der Text gehört über die gesamte Spalte.
  const cells = firstRow.querySelectorAll<HTMLElement>(
    `.cell-extra[data-extra-column-key="${overlay.colorKey}"]`,
  );
  if (cells.length === 0) return null;

  const tableRect = table.getBoundingClientRect();
  const firstCellRect = cells[0].getBoundingClientRect();
  const lastCellRect = cells[cells.length - 1].getBoundingClientRect();
  const topRect = firstRow.getBoundingClientRect();
  const bottomRect = lastRow.getBoundingClientRect();

  return {
    left: firstCellRect.left - tableRect.left,
    width: lastCellRect.right - firstCellRect.left,
    top: topRect.top - tableRect.top,
    height: bottomRect.bottom - topRect.top,
  };
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
  selectedColumn?: StreakTarget | null;
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
  /** Entfernt bzw. verkleinert die Spalte unmittelbar an der Trennlinie. */
  onRemoveExtraColumn?: (month: number, side: ExtraColumnSide, index: number) => void;
  onStreakStart?: (day: CalendarDay, column: StreakTarget) => void;
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
  onRemoveExtraColumn,
  onStreakStart,
  onStreakEnter,
  onStreakEnd,
}: MonthCalendarProps) {
  const { statistics } = month;
  const markedShiftCounts = countMarkedShiftsByColor(month.days, annotations);
  // Referenz auf das Tagesraster: Grundlage der Messung querliegender Texte.
  const tableRef = useRef<HTMLDivElement>(null);
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
   * Stabile Signatur der Anzeigespalten (Farbschlüssel + Seite).
   *
   * `extraColumnsForRow` entsteht bei jedem Render neu; die Signatur hält die
   * davon abhängigen Ableitungen (querliegende Texte) stabil, damit das
   * Messen der Überlagerung nicht bei jedem Render neu anläuft.
   */
  const extraColumnsSignature = extraColumnsForRow
    .map((column) => `${column.colorKey}:${column.side}`)
    .join(',');

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

  /** Klick auf den Minus-Bedienpunkt: verkleinert/entfernt die Spalte. */
  const handleRemoveActivate = (side: ExtraColumnSide, nearEdgeIndex: number) => {
    onRemoveExtraColumn?.(month.month, side, nearEdgeIndex);
  };

  /**
   * Querliegende Texte der Zusatzspalten, die in diesem Monat sichtbar sind.
   *
   * Ein Text gehört zu einer markierten Spanne und liegt auf der obersten
   * Zelle (Anker). Seine Darstellung zieht ihn über alle Zellen der Spanne,
   * mittig und - bei vertikaler Ausrichtung - um 90° nach links gedreht.
   */
  const extraColumnTexts = useMemo(
    () =>
      collectExtraColumnTexts(
        month,
        annotations,
        extraColumnsForRow,
        showShiftCalendar,
        weekdayOverDate,
      ),
    // `extraColumnsForRow` wird bei jedem Render neu gebaut; die für die
    // Sammlung maßgeblichen Angaben (Farbschlüssel und Seite je Spalte) werden
    // deshalb über eine stabile Signatur verglichen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [month, annotations, extraColumnsSignature, showShiftCalendar, weekdayOverDate],
  );

  // Gemessene Platzierung der querliegenden Texte (px, relativ zum Tagesraster).
  // Das Raster kennt keine Grid-Spalten, daher werden die Rechtecke der
  // Zielzelle und der markierten Zeilen ausgelesen und als Inline-Stile gesetzt.
  const [extraTextPlacements, setExtraTextPlacements] = useState<
    Record<string, ExtraColumnOverlayPlacement>
  >({});

  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table || extraColumnTexts.length === 0) {
      setExtraTextPlacements((current) =>
        Object.keys(current).length === 0 ? current : {},
      );
      return;
    }
    const measure = () => {
      const next: Record<string, ExtraColumnOverlayPlacement> = {};
      for (const overlay of extraColumnTexts) {
        const placement = measureExtraColumnOverlay(table, overlay);
        if (placement) next[overlay.id] = placement;
      }
      setExtraTextPlacements(next);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [extraColumnTexts]);

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
        {/* Minus-Punkte: entfernen/verkleinern die Spalte an der Trennlinie. */}
        {onRemoveExtraColumn && leftColumns.length > 0 && (
          <ColumnRemoveHandle side="left" nearEdgeIndex={0} onActivate={handleRemoveActivate} />
        )}
        {onRemoveExtraColumn && showShiftCalendar && rightColumns.length > 0 && (
          <ColumnRemoveHandle side="right" nearEdgeIndex={0} onActivate={handleRemoveActivate} />
        )}
      </header>

      <div className={tableClassName} role="table" aria-label={`Tage im ${month.name}`} ref={tableRef}>
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
        {extraColumnTexts.length > 0 && (
          <div className="day-table-overlay" aria-hidden="true">
            {extraColumnTexts.map((overlay) => {
              const placement = extraTextPlacements[overlay.id];
              if (!placement) return null;
              return (
                <span
                  key={overlay.id}
                  className={[
                    'cell-extra-text',
                    overlay.vertical ? 'is-vertical' : '',
                    overlay.colored ? 'has-color' : '',
                  ]
                    .filter((name) => name !== '')
                    .join(' ')}
                  title={overlay.text}
                  data-grid-column={overlay.gridColumn}
                  style={{
                    left: placement.left,
                    top: placement.top,
                    width: placement.width,
                    height: placement.height,
                  }}
                >
                  <span>{overlay.text}</span>
                </span>
              );
            })}
          </div>
        )}
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
