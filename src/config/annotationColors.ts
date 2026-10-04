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

import type { AnnotationColor, AnnotationColorId } from '../domain/types';

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
