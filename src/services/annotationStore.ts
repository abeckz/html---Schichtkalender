/**
 * AnnotationStore-Hook.
 *
 * Kapselt die persönlichen Tagesmarkierungen als React-Zustand und
 * persistiert jede Änderung sofort über den Storage-Service.
 *
 * Annotationen verändern niemals die Fachlogik (Schichten, Events,
 * Statistiken); sie liegen in einer eigenen, nach dateKey indizierten Map
 * und bleiben über Jahres- und Schichtwechsel hinweg erhalten.
 */

import { useCallback, useEffect, useState } from 'react';
import type {
  AnnotationColorId,
  AnnotationMap,
  AppSettings,
  ColumnColorName,
  ExtraColumnColorKey,
  ExtraColumnText,
  UserDayAnnotation,
} from '../domain/types';
import {
  getDefaultStorage,
  normalizeAnnotation,
  extraColumnTextId,
  MAX_EXTRA_TEXT_LENGTH,
  readState,
  writeState,
  type StorageLike,
} from '../services/storage.ts';

export interface AnnotationStore {
  annotations: AnnotationMap;
  /**
   * Setzt oder entfernt Beschriftung und Info-Farbe eines Tages. Leere Werte
   * löschen den Eintrag. Farben der Zusatzspalten und deren querliegende Texte
   * bleiben dabei unverändert erhalten.
   */
  setAnnotation: (
    dateKey: string,
    label: string,
    colorId: AnnotationColorId | null,
  ) => void;
  /** Entfernt nur Beschriftung und Farbe eines Tages. */
  resetAnnotation: (dateKey: string) => void;
  /**
   * Setzt die Farbe einer Spalte für mehrere Tage auf einmal
   * (Streifen-Markierung).
   *
   * Deckt sowohl die festen Farbspalten der Tageszeile ('weekday', 'day',
   * 'shift', 'info') als auch die frei angelegten Zusatzspalten (`extra0`,
   * `extra1`, …) ab. Bestehende Beschriftungen und übrige Spaltenfarben bleiben
   * unverändert erhalten. Eine Farbe von null entfernt nur die Farbe dieser
   * Spalte.
   */
  setColumnColorForDateKeys: (
    dateKeys: readonly string[],
    column: ColumnColorName | ExtraColumnColorKey,
    colorId: AnnotationColorId | null,
  ) => void;
  /**
   * Setzt oder entfernt den querliegenden Text einer Zusatzspalte.
   *
   * Der Text gehört zu einer markierten Spanne und wird auf deren **oberster**
   * Zelle (erstes Element von `dateKeys`) gespeichert. Dabei wird ausschließlich
   * der Text **derselben Spanne** (Anker = kleinster markierter Tag) ersetzt;
   * weitere, unabhängige Spannen derselben Spalte (z. B. oben und unten im
   * Monat) bleiben mit eigenem Text erhalten.
   */
  setExtraColumnText: (
    dateKeys: readonly string[],
    colorKey: ExtraColumnColorKey,
    columnLabel: string,
    vertical: boolean,
    text: string,
  ) => void;
  /** Ersetzt die gesamte Map (Reset/Import). */
  replaceAnnotations: (next: AnnotationMap) => void;
}

/**
 * Verwaltet Annotationen inklusive Persistenz.
 *
 * @param settings aktuelle Einstellungen; sie werden zusammen mit den
 *                 Annotationen gespeichert, damit ein einziger Storage-Key
 *                 den vollständigen Zustand enthält.
 * @param storage  optionaler Speicher (nur für Tests). Ohne Angabe wird der
 *                 Standard-Speicher (localStorage) verwendet; ein explizites
 *                 null deaktiviert die Persistenz.
 */
export function useAnnotationStore(
  settings: AppSettings,
  storage: StorageLike | null = getDefaultStorage(),
): AnnotationStore {
  const [annotations, setAnnotations] = useState<AnnotationMap>(() => readState(storage).annotations);

  // Beim Wechsel des Storage (praktisch nur in Tests) neu einlesen.
  useEffect(() => {
    setAnnotations(readState(storage).annotations);
  }, [storage]);

  // Jede Änderung sofort persistieren; die übrigen Zustandsbereiche werden
  // dabei aus dem Speicher übernommen, damit sie nicht überschrieben werden.
  useEffect(() => {
    const persisted = readState(storage);
    writeState(
      { version: 1, settings, annotations, colorLegend: persisted.colorLegend, anniversaries: persisted.anniversaries },
      storage,
    );
  }, [settings, annotations, storage]);

  const setAnnotation = useCallback(
    (dateKey: string, label: string, colorId: AnnotationColorId | null) => {
      setAnnotations((current) => {
        const existing = current[dateKey];
        const colors = { ...(existing?.colors ?? {}) };
        if (colorId) {
          colors.info = colorId;
        } else {
          delete colors.info;
        }
        // Farben und querliegende Texte der Zusatzspalten bleiben unverändert
        // erhalten: sie werden ausschließlich über die Streifen-Auswahl bzw.
        // den Zusatzspalten-Editor gepflegt.
        const normalized = normalizeAnnotation({
          dateKey,
          label,
          colors,
          extraColors: existing?.extraColors,
          extraTexts: existing?.extraTexts,
        } as UserDayAnnotation);
        const next = { ...current };
        if (normalized) {
          next[dateKey] = normalized;
        } else {
          delete next[dateKey];
        }
        return next;
      });
    },
    [],
  );

  const resetAnnotation = useCallback((dateKey: string) => {
    setAnnotations((current) => {
      if (!(dateKey in current)) return current;
      const next = { ...current };
      delete next[dateKey];
      return next;
    });
  }, []);

  const setColumnColorForDateKeys = useCallback(
    (
      dateKeys: readonly string[],
      column: ColumnColorName | ExtraColumnColorKey,
      colorId: AnnotationColorId | null,
    ) => {
      // Feste Farbspalten der Tageszeile landen in `colors`, Zusatzspalten
      // (`extra0`, …) in `extraColors`; beide werden getrennt gepflegt.
      const isExtra = isExtraColorKey(column);
      setAnnotations((current) => {
        const next = { ...current };
        for (const dateKey of dateKeys) {
          const existing = current[dateKey];
          const label = existing?.label ?? '';
          const colors = { ...(existing?.colors ?? {}) };
          const extraColors: Partial<Record<ExtraColumnColorKey, AnnotationColorId>> = {
            ...(existing?.extraColors ?? {}),
          };
          if (isExtra) {
            const key = column as ExtraColumnColorKey;
            if (colorId) {
              extraColors[key] = colorId;
            } else {
              delete extraColors[key];
            }
          } else {
            const key = column as ColumnColorName;
            if (colorId) {
              colors[key] = colorId;
            } else {
              delete colors[key];
            }
          }
          const normalized = normalizeAnnotation({
            dateKey,
            label,
            colors,
            extraColors: Object.keys(extraColors).length > 0 ? extraColors : undefined,
            extraTexts: existing?.extraTexts,
          } as UserDayAnnotation);
          if (normalized) {
            next[dateKey] = normalized;
          } else {
            delete next[dateKey];
          }
        }
        return next;
      });
    },
    [],
  );

  const setExtraColumnText = useCallback(
    (
      dateKeys: readonly string[],
      colorKey: ExtraColumnColorKey,
      columnLabel: string,
      vertical: boolean,
      text: string,
    ) => {
      const span = [...dateKeys].sort();
      if (span.length === 0) return;
      const anchor = span[0];
      const trimmed = text.slice(0, MAX_EXTRA_TEXT_LENGTH);
      const targetId = extraColumnTextId(colorKey, anchor);
      setAnnotations((current) => {
        const next = { ...current };
        // Ausschließlich die Spanne mit demselben Anker ersetzen: andere,
        // unabhängige Spannen derselben Spalte bleiben erhalten.
        const removeText = (
          target: Record<string, UserDayAnnotation>,
          dateKey: string,
        ) => {
          const existing = target[dateKey];
          const list = existing?.extraTexts?.[colorKey];
          if (!existing || !list || list.length === 0) return;
          const remaining = list.filter((entry) => entry.id !== targetId);
          if (remaining.length === list.length) return;
          const extraTexts = { ...existing.extraTexts };
          if (remaining.length > 0) {
            extraTexts[colorKey] = remaining;
          } else {
            delete extraTexts[colorKey];
          }
          const normalized = normalizeAnnotation({
            ...existing,
            extraTexts: Object.keys(extraTexts).length > 0 ? extraTexts : undefined,
          } as UserDayAnnotation);
          if (normalized) {
            target[dateKey] = normalized;
          } else {
            delete target[dateKey];
          }
        };
        for (const dateKey of Object.keys(next)) {
          removeText(next, dateKey);
        }

        if (trimmed === '') return next;

        const existing = next[anchor] ?? current[anchor];
        const list = existing?.extraTexts?.[colorKey] ?? [];
        const normalized = normalizeAnnotation({
          dateKey: anchor,
          label: existing?.label ?? '',
          colors: existing?.colors ?? {},
          extraColors: existing?.extraColors,
          extraTexts: {
            ...(existing?.extraTexts ?? {}),
            [colorKey]: [
              ...list.filter((entry) => entry.id !== targetId),
              {
                id: targetId,
                colorKey,
                columnLabel,
                vertical,
                text: trimmed,
                dateKeys: span,
                length: span.length,
              } satisfies ExtraColumnText,
            ],
          },
        } as UserDayAnnotation);
        if (normalized) {
          next[anchor] = normalized;
        } else {
          delete next[anchor];
        }
        return next;
      });
    },
    [],
  );

  const replaceAnnotations = useCallback((next: AnnotationMap) => {
    setAnnotations(next);
  }, []);

  return {
    annotations,
    setAnnotation,
    resetAnnotation,
    setColumnColorForDateKeys,
    setExtraColumnText,
    replaceAnnotations,
  };
}

/** Prüft, ob ein Streifen-Ziel eine Zusatzspalte (`extra0`, …) benennt. */
function isExtraColorKey(column: ColumnColorName | ExtraColumnColorKey): boolean {
  return /^extra[0-9]+$/.test(column);
}
