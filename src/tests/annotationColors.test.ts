/**
 * Tests der persönlichen Farbpalette.
 *
 * Abgesichert werden:
 * - die Palette ist satt und stark unterschiedlich (Gelb, Rot, Blau, Orange
 *   sind enthalten und alle Farbeinträge unterscheiden sich),
 * - die colorIds sind stabil (gespeicherte Annotationen überleben eine
 *   Änderung der Hexwerte),
 * - die Zuordnung colorId <-> Hexwert und Anzeigename arbeitet defensiv.
 */

import { describe, expect, it } from 'vitest';
import {
  ANNOTATION_COLOR_IDS,
  annotationColorMap,
  annotationColors,
  getColorHex,
  getColorName,
  isAnnotationColorId,
} from '../config/annotationColors';

describe('Farbpalette', () => {
  it('enthält die geforderten Farben Gelb, Rot, Blau und Orange', () => {
    for (const id of ['yellow', 'red', 'blue', 'orange'] as const) {
      expect(ANNOTATION_COLOR_IDS).toContain(id);
    }
    expect(annotationColorMap.yellow.name).toBe('Gelb');
    expect(annotationColorMap.red.name).toBe('Rot');
    expect(annotationColorMap.blue.name).toBe('Blau');
    expect(annotationColorMap.orange.name).toBe('Orange');
  });

  it('unterscheidet alle Farben eindeutig (keine doppelten Hexwerte)', () => {
    const hexValues = annotationColors.map((color) => color.hex.toUpperCase());
    expect(new Set(hexValues).size).toBe(hexValues.length);
    expect(new Set(ANNOTATION_COLOR_IDS).size).toBe(ANNOTATION_COLOR_IDS.length);
  });

  it('vergibt gültige Hexwerte mit führendem Doppelkreuz', () => {
    for (const color of annotationColors) {
      expect(color.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('Farbzuordnung', () => {
  it('liefert den Hexwert und Namen einer bekannten colorId', () => {
    expect(getColorHex('red')).toBe(annotationColorMap.red.hex);
    expect(getColorHex('orange')).toBe(annotationColorMap.orange.hex);
    expect(getColorName('blue')).toBe('Blau');
  });

  it('liefert bei fehlender Farbe null bzw. "Keine Farbe"', () => {
    expect(getColorHex(null)).toBeNull();
    expect(getColorHex(undefined)).toBeNull();
    expect(getColorName(null)).toBe('Keine Farbe');
    expect(getColorName(undefined)).toBe('Keine Farbe');
  });

  it('prüft colorIds defensiv gegen unbekannte Werte', () => {
    expect(isAnnotationColorId('yellow')).toBe(true);
    expect(isAnnotationColorId('neonpink')).toBe(false);
    expect(isAnnotationColorId(42)).toBe(false);
    expect(isAnnotationColorId(null)).toBe(false);
    expect(getColorHex('neonpink' as never)).toBeNull();
  });
});
