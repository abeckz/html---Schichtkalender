/**
 * Darstellung der frei angelegten Zusatzspalten eines Monats.
 *
 * Die schmalen Spalten sind reine Darstellung und verändern keine Fachdaten.
 * Links der KW-Spalte (und der Schichtspalte T/N) liegen die Spalten der Liste
 * `left`, rechts davon die der Liste `right`; sie schieben die jeweils
 * rechtsstehenden Spalten nach außen.
 *
 * Der Farbschlüssel (`colorKey`) ist je Seite fortlaufend nummeriert und damit
 * stabil, wenn an einer Seite weitere Spalten hinzukommen.
 */

import type {
  AnnotationColorId,
  ExtraColumnColorKey,
  ExtraColumnUnitKey,
  ExtraColumns,
  UserDayAnnotation,
} from '../domain/types.ts';
import { getColorHex } from '../config/annotationColors.ts';
import type { ExtraColumnSide } from '../services/settingsStore.ts';

export interface ExtraColumnDisplay {
  /** Anzeigename im Farbschlüssel ('0', '1', …; Leereinheiten '0·1'). */
  name: string;
  /** Farbschlüssel der persönlichen Tagesfarbe ('extra0', 'extra1', …). */
  colorKey: ExtraColumnColorKey;
  /**
   * Zieh-Ziel genau dieser Breiteneinheit ('extra0', 'extra0#1', …).
   *
   * Eine erweiterte Spalte besteht aus mehreren Einheiten mit demselben
   * `colorKey`; gefärbt und beschriftet wird stets die ganze Spalte. Für die
   * Streifen-Auswahl muss jedoch die **einzelne Einheit** unterscheidbar sein,
   * damit beim Ziehen nur die Spalte unter dem Zeiger hervorgehoben wird.
   */
  unitKey: ExtraColumnUnitKey;
  /** Seite der Trennlinie, an der die Spalte liegt. */
  side: ExtraColumnSide;
  /** Reihenfolge innerhalb der Anzeige (links vor rechts). */
  order: number;
}

export interface ExtraColumnLayout {
  /** Spalten zwischen Kommentarspalte und KW-Spalte (in Anzeigereihenfolge). */
  left: ExtraColumnDisplay[];
  /** Spalten zwischen KW-Spalte und Schichtspalte T-N (in Anzeigereihenfolge). */
  right: ExtraColumnDisplay[];
}

/**
 * Baut aus den gespeicherten Spaltenlisten das Anzeigemodell.
 *
 * Die gespeicherten Listen sind von innen nach außen geordnet: Listenanfang ist
 * stets die Spalte direkt an der Trennlinie. Für jeden Eintrag entsteht eine
 * Anzeigespalte; ein Eintrag `2` erzeugt zusätzlich eine Leereinheit
 * (`name` mit "·"), damit eine erweiterte Spalte in jeder Tageszeile ohne
 * zusätzlichen Inhalt dargestellt werden kann.
 *
 * Die Farbschlüssel (`extra0`, `extra1`, …) sind seitenübergreifend eindeutig:
 * die linke Seite beginnt bei 0, die rechte zählt hinter den linken Spalten
 * weiter. So kollidieren die persönlichen Farben der linken und rechten
 * Zusatzspalten nicht mehr im selben Tagesdatensatz.
 */
export function buildExtraColumnLayout(columns: ExtraColumns | undefined): ExtraColumnLayout {
  const left = buildExtraColumnSide(columns?.left, 'left', 0);
  const right = buildExtraColumnSide(columns?.right, 'right', left.length);
  return { left, right };
}

/** Baut die Anzeigespalten einer Seite (Farbschlüssel ab `keyOffset`). */
function buildExtraColumnSide(
  widths: readonly number[] | undefined,
  side: ExtraColumnSide,
  keyOffset: number,
): ExtraColumnDisplay[] {
  const result: ExtraColumnDisplay[] = [];
  let order = 0;
  widths?.forEach((rawWidth, nameIndex) => {
    const width = Math.max(1, Math.trunc(rawWidth));
    const colorKey: ExtraColumnColorKey = `extra${keyOffset + nameIndex}`;
    for (let unit = 0; unit < width; unit += 1) {
      result.push({
        name: unit === 0 ? `${nameIndex}` : `${nameIndex}·${unit}`,
        colorKey,
        // Erste Einheit trägt den reinen Farbschlüssel, weitere Einheiten einen
        // Suffix, damit jede Einheit ein eigenes, stabiles Zieh-Ziel hat.
        unitKey: unit === 0 ? colorKey : `${colorKey}#${unit}`,
        side,
        order: order++,
      });
    }
  });
  return result;
}

/**
 * Anzahl der Breiteneinheiten einer Seite.
 * Ein leerer Eintrag zählt als eine Einheit (Mindestbreite).
 */
export function extraColumnUnitCount(widths: readonly number[] | undefined): number {
  return (widths ?? []).reduce((total, width) => total + Math.max(1, Math.trunc(width)), 0);
}

/**
 * Farbe einer Zusatzspalte für einen Anzeigenamen.
 * Leereinheiten einer erweiterten Spalte tragen dieselbe Farbe wie die Spalte
 * selbst.
 */
export function extraColumnColor(
  annotation: UserDayAnnotation | undefined,
  colorKey: ExtraColumnColorKey,
): AnnotationColorId | null {
  return annotation?.extraColors?.[colorKey] ?? null;
}

export interface ExtraColumnCellProps {
  column: ExtraColumnDisplay;
  annotation: UserDayAnnotation | undefined;
  /** true, wenn genau diese Breiteneinheit aktuell Ziel der Streifen-Auswahl ist. */
  selected?: boolean;
}

/**
 * Schmale Zelle einer Tageszeile.
 *
 * Der Inhalt ist bewusst leer: die Spalte bietet Platz, den der Benutzer über
 * den Tageseditor (Beschriftung und Farbe) befüllt. Der Klick auf die Zelle
 * wird von der umgebenden Tageszeile übernommen und öffnet denselben Editor.
 *
 * Die Zelle ist - wie die festen Farbspalten - über einen gezogenen Streifen
 * markierbar und einfärbbar. Dafür trägt sie ihren stabilen Farbschlüssel als
 * `data-extra-column-key` und - für die Unterscheidung einzelner
 * Breiteneinheiten einer erweiterten Spalte - zusätzlich `data-extra-unit-key`;
 * bei Auswahl wird nur die getroffene Einheit über `is-column-selected`
 * hervorgehoben. Ein querliegender Text wird nicht in der Zelle selbst
 * dargestellt, sondern monatsweit über die markierte Spanne gezogen (siehe
 * `MonthCalendar`), damit er über mehrere Zellen hinweg zentriert erscheint.
 */
export function ExtraColumnCell({ column, annotation, selected = false }: ExtraColumnCellProps) {
  const colorHex = getColorHex(extraColumnColor(annotation, column.colorKey));
  return (
    <span
      className={`cell cell-extra${selected ? ' is-column-selected' : ''}`}
      data-extra-column={column.name}
      data-extra-column-key={column.colorKey}
      data-extra-unit-key={column.unitKey}
      data-extra-column-side={column.side}
      style={colorHex ? { backgroundColor: colorHex } : undefined}
    />
  );
}
