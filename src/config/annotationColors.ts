/**
 * Zentrale Farbpalette der persönlichen Tagesmarkierungen.
 *
 * Gespeichert wird ausschließlich die colorId (nicht der Hexwert), damit
 * die Palette später geändert werden kann, ohne bestehende Annotationen
 * zu zerstören.
 *
 * Die Palette ist bewusst satt und kräftig: die Farben unterscheiden sich
 * deutlich voneinander und bleiben auch nebeneinander eindeutig erkennbar.
 * Der Text auf einer farbigen Zeile wird zusätzlich immer in Schwarz
 * dargestellt (siehe styles.css), damit die Beschriftung auf jeder der
 * kräftigen Farben lesbar bleibt.
 */

import type { AnnotationColor, AnnotationColorId, AnnotationMap, ColumnColorName } from '../domain/types';

export const annotationColors: readonly AnnotationColor[] = [
  { id: 'yellow', name: 'Gelb', hex: '#FFE000' },
  { id: 'green', name: 'Grün', hex: '#2E9E3E' },
  { id: 'blue', name: 'Blau', hex: '#1E6FE0' },
  { id: 'orange', name: 'Orange', hex: '#FF7A00' },
  { id: 'pink', name: 'Pink', hex: '#FF2E93' },
  { id: 'red', name: 'Rot', hex: '#E01B1B' },
  { id: 'purple', name: 'Violett', hex: '#8A2BE2' },
  { id: 'turquoise', name: 'Türkis', hex: '#00C2B2' },
  { id: 'gray', name: 'Grau', hex: '#9AA0A6' },
];

/** Schnellzugriff colorId -> Farbe. */
export const annotationColorMap: Record<AnnotationColorId, AnnotationColor> = annotationColors.reduce(
  (map, color) => {
    map[color.id] = color;
    return map;
  },
  {} as Record<AnnotationColorId, AnnotationColor>,
);

export const ANNOTATION_COLOR_IDS: readonly AnnotationColorId[] = annotationColors.map(
  (color) => color.id,
);

/** Anzeigename "Keine Farbe" für colorId === null. */
export const NO_COLOR_NAME = 'Keine Farbe';

/** Prüft, ob ein unbekannter Wert eine gültige colorId ist. */
export function isAnnotationColorId(value: unknown): value is AnnotationColorId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(annotationColorMap, value);
}

/** Deutscher Anzeigename einer colorId (oder "Keine Farbe"). */
export function getColorName(colorId: AnnotationColorId | null | undefined): string {
  if (!colorId) return NO_COLOR_NAME;
  return isAnnotationColorId(colorId) ? annotationColorMap[colorId].name : NO_COLOR_NAME;
}

/**
 * Hexwert einer colorId. liefert null, wenn keine (gültige) Farbe gesetzt
 * ist. Ungültige Werte werden niemals direkt als CSS verwendet.
 */
export function getColorHex(colorId: AnnotationColorId | null | undefined): string | null {
  if (!colorId) return null;
  return isAnnotationColorId(colorId) ? annotationColorMap[colorId].hex : null;
}

/**
 * Spalten, die über einen gezogenen Streifen eingefärbt werden können.
 * Die Informationsspalte ('info') gehört bewusst nicht dazu; sie wird über
 * den DayEditor gepflegt.
 */
export const STREAK_COLUMN_NAMES: readonly ColumnColorName[] = ['weekday', 'day', 'shift'];

/** Prüft, ob ein unbekannter Wert ein gültiger Spaltenname ist. */
export function isColumnColorName(value: unknown): value is ColumnColorName {
  return value === 'weekday' || value === 'day' || value === 'shift' || value === 'info';
}

/**
 * Ermittelt die im angegebenen Jahr tatsächlich benutzten Markierungsfarben.
 *
 * Eine Farbe gilt als benutzt, sobald sie in mindestens einer Annotation des
 * Jahres in einer der Spalten (weekday, day, shift, info) gesetzt ist. Der
 * Jahresbezug ergibt sich aus dem dateKey (YYYY-MM-DD).
 *
 * Das Ergebnis folgt der Reihenfolge der Farbpalette, damit die Anzeige
 * unabhängig von der Reihenfolge der Annotationen stabil bleibt.
 */
export function usedAnnotationColors(
  annotations: AnnotationMap,
  year: number,
): AnnotationColorId[] {
  const prefix = `${year}-`;
  const used = new Set<AnnotationColorId>();
  for (const [dateKey, annotation] of Object.entries(annotations)) {
    if (!dateKey.startsWith(prefix)) continue;
    for (const colorId of Object.values(annotation.colors)) {
      if (isAnnotationColorId(colorId)) used.add(colorId);
    }
  }
  return annotationColors.filter((color) => used.has(color.id)).map((color) => color.id);
}
