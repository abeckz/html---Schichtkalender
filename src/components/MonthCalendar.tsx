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
  CalendarDay,
  ColumnColorName,
  MonthCalendar as MonthCalendarModel,
} from '../domain/types';
import { annotationColors, getColorHex } from '../config/annotationColors';
import { CalendarDayRow } from './CalendarDayRow';

export interface MonthCalendarProps {
  month: MonthCalendarModel;
  annotations: AnnotationMap;
  onOpenEditor: (day: CalendarDay) => void;
  /** dateKeys der aktuell markierten Streifen-Auswahl. */
  selectedKeys?: ReadonlySet<string>;
  /** Spalte, die während der aktuellen Streifen-Auswahl hervorgehoben wird. */
  selectedColumn?: ColumnColorName | null;
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
  onOpenEditor,
  selectedKeys,
  selectedColumn,
  onStreakStart,
  onStreakEnter,
  onStreakEnd,
}: MonthCalendarProps) {
  const { statistics } = month;
  const markedShiftCounts = countMarkedShiftsByColor(month.days, annotations);
  return (
    <section className="month-card" aria-label={`${month.name} ${month.year}`}>
      <header className="month-header">
        <span className="month-stat" title="Werktage Montag bis Freitag">
          {statistics.weekdayCount} Werktage
        </span>
        <h2 className="month-title" aria-label={`${month.name}, ${statistics.weekdayCount} Werktage, ${statistics.requiredShiftCount} Sollschichten`}>
          {month.name}
        </h2>
        <span className="month-stat" title="Sollschichten (T + N)">
          {statistics.requiredShiftCount} Soll
        </span>
      </header>

      <div className="day-table" role="table" aria-label={`Tage im ${month.name}`}>
        {month.days.map((day) => (
          <CalendarDayRow
            key={day.dateKey}
            day={day}
            annotation={annotations[day.dateKey]}
            onOpenEditor={onOpenEditor}
            isSelected={selectedKeys?.has(day.dateKey) ?? false}
            selectedColumn={selectedColumn}
            onStreakStart={onStreakStart}
            onStreakEnter={onStreakEnter}
            onStreakEnd={onStreakEnd}
          />
        ))}
      </div>

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
    </section>
  );
}
