/**
 * ColorLegendStore-Hook.
 *
 * Kapselt die Erklärtexte der Farblegende als React-Zustand und persistiert
 * jede Änderung sofort über den Storage-Service.
 *
 * Die Erklärtexte sind rein darstellungsbezogen: sie verändern niemals die
 * Fachlogik (Schichten, Events, Statistiken) und auch nicht die Annotationen.
 * Sie sind jahresbezogen: derselbe Farbton kann in unterschiedlichen Jahren
 * eine andere Bedeutung tragen.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  AnnotationColorId,
  AnnotationMap,
  AppSettings,
  ColorLegendMap,
} from '../domain/types';
import {
  MAX_LEGEND_TEXT_LENGTH,
  getDefaultStorage,
  readState,
  writeState,
  type StorageLike,
} from '../services/storage';

export interface ColorLegendStore {
  colorLegend: ColorLegendMap;
  /**
   * Setzt (oder entfernt) den Erklärtext einer Farbe für ein Jahr.
   * Ein leerer Text löscht den Eintrag.
   */
  setColorLegendText: (year: number, colorId: AnnotationColorId, text: string) => void;
  /** Ersetzt die gesamte Map (Reset/Import). */
  replaceColorLegend: (next: ColorLegendMap) => void;
}

/**
 * Verwaltet die Erklärtexte inklusive Persistenz.
 *
 * @param settings    aktuelle Einstellungen; sie werden zusammen mit
 *                    Annotationen und Farblegende gespeichert, damit ein
 *                    einziger Storage-Key den vollständigen Zustand enthält.
 * @param annotations aktuelle Annotationen; werden mitpersistiert, damit
 *                    Schreibvorgänge sich nicht gegenseitig überschreiben.
 * @param storage     optionaler Speicher (nur für Tests).
 */
export function useColorLegendStore(
  settings: AppSettings,
  annotations: AnnotationMap,
  storage: StorageLike | null = getDefaultStorage(),
): ColorLegendStore {
  const [colorLegend, setColorLegend] = useState<ColorLegendMap>(
    () => readState(storage).colorLegend,
  );

  // Beim Wechsel des Storage (praktisch nur in Tests) neu einlesen.
  useEffect(() => {
    setColorLegend(readState(storage).colorLegend);
  }, [storage]);

  // Jede Änderung sofort persistieren.
  useEffect(() => {
    writeState({ version: 1, settings, annotations, colorLegend }, storage);
  }, [settings, annotations, colorLegend, storage]);

  const setColorLegendText = useCallback(
    (year: number, colorId: AnnotationColorId, text: string) => {
      setColorLegend((current) => {
        const trimmed = text.slice(0, MAX_LEGEND_TEXT_LENGTH);
        const yearEntry = { ...(current[year] ?? {}) };
        if (trimmed !== '') {
          yearEntry[colorId] = trimmed;
        } else {
          delete yearEntry[colorId];
        }
        const next = { ...current };
        if (Object.keys(yearEntry).length > 0) {
          next[year] = yearEntry;
        } else {
          delete next[year];
        }
        return next;
      });
    },
    [],
  );

  const replaceColorLegend = useCallback((next: ColorLegendMap) => {
    setColorLegend(next);
  }, []);

  return { colorLegend, setColorLegendText, replaceColorLegend };
}
