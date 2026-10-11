import { jsx as _jsx } from "react/jsx-runtime";
import { getColorHex } from '../config/annotationColors.ts';
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
 *
 * Seit dem Wegfall des „Erweiterns" hat jede neu angelegte Zusatzspalte die
 * Breite 1 und damit genau einen Farbschlüssel (eine Zelle je Tageszeile). Der
 * Code für breitere Spalten (`width > 1`, mehrere Einheiten mit Suffix `#n`)
 * bleibt nur erhalten, um ältere gespeicherte Zustände weiterhin korrekt
 * darzustellen.
 */
export function buildExtraColumnLayout(columns) {
    const left = buildExtraColumnSide(columns?.left, 'left', 0);
    const right = buildExtraColumnSide(columns?.right, 'right', left.length);
    return { left, right };
}
/** Baut die Anzeigespalten einer Seite (Farbschlüssel ab `keyOffset`). */
function buildExtraColumnSide(widths, side, keyOffset) {
    const result = [];
    let order = 0;
    widths?.forEach((rawWidth, nameIndex) => {
        const width = Math.max(1, Math.trunc(rawWidth));
        const colorKey = `extra${keyOffset + nameIndex}`;
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
export function extraColumnUnitCount(widths) {
    return (widths ?? []).reduce((total, width) => total + Math.max(1, Math.trunc(width)), 0);
}
/**
 * Farbe einer Zusatzspalte für einen Anzeigenamen.
 * Leereinheiten einer erweiterten Spalte tragen dieselbe Farbe wie die Spalte
 * selbst.
 */
export function extraColumnColor(annotation, colorKey) {
    return annotation?.extraColors?.[colorKey] ?? null;
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
export function ExtraColumnCell({ column, annotation, selected = false }) {
    const colorHex = getColorHex(extraColumnColor(annotation, column.colorKey));
    return (_jsx("span", { className: `cell cell-extra${selected ? ' is-column-selected' : ''}`, "data-extra-column": column.name, "data-extra-column-key": column.colorKey, "data-extra-unit-key": column.unitKey, "data-extra-column-side": column.side, style: colorHex ? { backgroundColor: colorHex } : undefined }));
}
