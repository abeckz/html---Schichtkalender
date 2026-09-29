/**
 * Tests für die Standardwerte der Anwendung.
 *
 * Wichtigste Anforderung: Die Jahresauswahl startet immer beim aktuellen
 * Jahr. 2021 bleibt als fachliches Referenzjahr (Spezifikation) erhalten.
 */

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  DEFAULT_YEAR,
  LAST_SELECTABLE_YEAR,
  REFERENCE_YEAR,
  SELECTABLE_YEARS,
  clampToSelectableYear,
  defaultYear,
} from '../config/appDefaults';

describe('Startjahr', () => {
  it('startet beim aktuellen Jahr', () => {
    expect(defaultYear(new Date(2026, 8, 29))).toBe(2026);
    expect(new Date().getFullYear()).toBe(DEFAULT_SETTINGS.selectedYear);
  });

  it('begrenzt Randlagen auf den Auswahlbereich', () => {
    expect(defaultYear(new Date(1999, 0, 1))).toBe(REFERENCE_YEAR);
    expect(defaultYear(new Date(2399, 0, 1))).toBe(LAST_SELECTABLE_YEAR);
  });

  it('liefert ausschließlich Jahre der Auswahlliste', () => {
    for (let year = 1990; year <= 2240; year += 1) {
      expect(SELECTABLE_YEARS).toContain(defaultYear(new Date(year, 5, 15)));
    }
  });
});

describe('Begrenzung auf den Auswahlbereich', () => {
  it('übernimmt Jahre innerhalb der Auswahlliste unverändert', () => {
    expect(clampToSelectableYear(2020)).toBe(2020);
    expect(clampToSelectableYear(REFERENCE_YEAR)).toBe(REFERENCE_YEAR);
    expect(clampToSelectableYear(2024)).toBe(2024);
    expect(clampToSelectableYear(LAST_SELECTABLE_YEAR)).toBe(LAST_SELECTABLE_YEAR);
  });

  it('fällt bei zu kleinen Werten auf das Referenzjahr zurück', () => {
    expect(clampToSelectableYear(2019)).toBe(REFERENCE_YEAR);
    expect(clampToSelectableYear(1900)).toBe(REFERENCE_YEAR);
  });

  it('begrenzt zu große Werte auf das letzte wählbare Jahr', () => {
    expect(clampToSelectableYear(LAST_SELECTABLE_YEAR + 1)).toBe(LAST_SELECTABLE_YEAR);
    expect(clampToSelectableYear(MAX_YEAR_FOR_TEST)).toBe(LAST_SELECTABLE_YEAR);
  });

  it('toleriert ungültige Werte ohne zu werfen', () => {
    expect(clampToSelectableYear(Number.NaN)).toBe(REFERENCE_YEAR);
    expect(clampToSelectableYear(2024.5)).toBe(REFERENCE_YEAR);
  });

  it('stellt DEFAULT_YEAR über das Referenzjahr hinaus ein', () => {
    // Das Startjahr folgt dem aktuellen Jahr, nicht dem Referenzjahr 2021.
    expect(DEFAULT_YEAR).toBeGreaterThanOrEqual(REFERENCE_YEAR);
    expect(SELECTABLE_YEARS).toContain(DEFAULT_YEAR);
  });
});

/** Nur für die Randprüfung, bewusst weit außerhalb des Auswahlbereichs. */
const MAX_YEAR_FOR_TEST = 3500;
