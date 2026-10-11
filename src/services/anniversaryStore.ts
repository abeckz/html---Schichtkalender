/**
 * AnniversaryStore-Hook.
 *
 * Verwaltet die jahreslosen Geburtstage und wiederkehrenden Ereignisse als
 * React-Zustand und persistiert jede Änderung sofort über den
 * Storage-Service.
 *
 * Pro Kalendertag können mehrere Geburtstage und mehrere wiederkehrende
 * Ereignisse gespeichert werden. Die Einträge liegen daher als Liste unter dem
 * Monat-Tag-Schlüssel ("MM-DD") und werden über ihre eindeutige `id`
 * unterschieden.
 *
 * Die Einträge verändern niemals die Fachlogik (Schichten, Events,
 * Statistiken); sie bleiben über Jahreswechsel hinweg erhalten.
 */

import { useCallback, useEffect, useState } from 'react';
import type { AnniversaryEntry, AnniversaryMap, AppSettings } from '../domain/types.ts';
import {
  STORAGE_VERSION,
  getDefaultStorage,
  normalizeAnniversary,
  normalizeAnniversaryName,
  readState,
  writeState,
  type StorageLike,
} from '../services/storage.ts';

export interface AnniversaryStore {
  anniversaries: AnniversaryMap;
  /**
   * Setzt einen einzelnen Eintrag (Upsert über seine `id`). Ein leerer Name
   * entfernt den Eintrag.
   */
  setAnniversary: (entry: AnniversaryEntry) => void;
  /**
   * Ersetzt alle Einträge eines Kalendertags in einem Schritt.
   * Leere Namen werden verworfen; eine leere Liste entfernt den Tag.
   */
  replaceDay: (monthDay: string, entries: AnniversaryEntry[]) => void;
  /** Entfernt alle Einträge eines Kalendertags. */
  resetAnniversary: (monthDay: string) => void;
  /** Entfernt gezielt einen Eintrag über seine `id`. */
  removeAnniversary: (monthDay: string, id: string) => void;
  /**
   * Nimmt ein einzelnes Vorkommen einer Ereignisserie aus oder wieder auf.
   *
   * Die Serie bleibt bestehen; nur der eine Tag (`dateKey`) wird über die
   * Ausnahmeliste `excludedDates` ein- bzw. ausgeschlossen.
   */
  setOccurrenceExcluded: (
    monthDay: string,
    id: string,
    dateKey: string,
    excluded: boolean,
  ) => void;
  /**
   * Setzt das Ende einer Serie (`until`, "YYYY-MM-DD") bzw. hebt es mit einem
   * leeren Wert wieder auf. Der Termin am `until`-Tag selbst findet noch statt.
   */
  setSeriesEnd: (monthDay: string, id: string, until: string) => void;
  /** Ersetzt die gesamte Map (Reset/Import). */
  replaceAnniversaries: (next: AnniversaryMap) => void;
}

/** Bereinigt einen Eintrag für eine feste Tagesliste (Name und Art relevant). */
function cleanEntry(entry: AnniversaryEntry): AnniversaryEntry | null {
  const name = normalizeAnniversaryName(entry.name);
  if (name === '') return null;
  return normalizeAnniversary({
    ...entry,
    name,
    interval: undefined,
    intervalKind: entry.kind === 'recurring' ? entry.intervalKind : undefined,
    intervalCount: entry.kind === 'recurring' ? entry.intervalCount : undefined,
  });
}

/**
 * Verwaltet Jahrestage inklusive Persistenz.
 *
 * @param settings aktuelle Einstellungen; sie werden zusammen mit den
 *                 Jahrestagen gespeichert, damit ein einziger Storage-Key
 *                 den vollständigen Zustand enthält.
 * @param storage  optionaler Speicher (nur für Tests).
 */
export function useAnniversaryStore(
  settings: AppSettings,
  storage: StorageLike | null = getDefaultStorage(),
): AnniversaryStore {
  const [anniversaries, setAnniversaries] = useState<AnniversaryMap>(
    () => readState(storage).anniversaries,
  );

  // Beim Wechsel des Storage (praktisch nur in Tests) neu einlesen.
  useEffect(() => {
    setAnniversaries(readState(storage).anniversaries);
  }, [storage]);

  // Jede Änderung sofort persistieren; Annotationen und Farblegende werden
  // aus dem Speicher übernommen, damit sie nicht überschrieben werden.
  useEffect(() => {
    const persisted = readState(storage);
    writeState(
      {
        version: STORAGE_VERSION,
        settings,
        annotations: persisted.annotations,
        colorLegend: persisted.colorLegend,
        anniversaries,
      },
      storage,
    );
  }, [settings, anniversaries, storage]);

  const setAnniversary = useCallback((entry: AnniversaryEntry) => {
    setAnniversaries((current) => {
      const cleaned = cleanEntry(entry);
      const list = (current[entry.monthDay] ?? []).filter((item) => item.id !== entry.id);
      if (cleaned) list.push(cleaned);
      return withDay(current, entry.monthDay, list);
    });
  }, []);

  const replaceDay = useCallback((monthDay: string, entries: AnniversaryEntry[]) => {
    setAnniversaries((current) => {
      const cleaned: AnniversaryEntry[] = [];
      for (const entry of entries) {
        const prepared = cleanEntry(entry);
        if (prepared) cleaned.push(prepared);
      }
      return withDay(current, monthDay, cleaned);
    });
  }, []);

  const resetAnniversary = useCallback((monthDay: string) => {
    setAnniversaries((current) => withDay(current, monthDay, []));
  }, []);

  const removeAnniversary = useCallback((monthDay: string, id: string) => {
    setAnniversaries((current) => {
      const list = (current[monthDay] ?? []).filter((item) => item.id !== id);
      return withDay(current, monthDay, list);
    });
  }, []);

  const setSeriesEnd = useCallback((monthDay: string, id: string, until: string) => {
    setAnniversaries((current) => {
      const list = (current[monthDay] ?? []).map((item) => {
        if (item.id !== id || item.kind !== 'recurring') return item;
        const updated: AnniversaryEntry = { ...item };
        if (until !== '') {
          updated.until = until;
        } else {
          delete updated.until;
        }
        return normalizeAnniversary(updated, item.id) ?? updated;
      });
      return withDay(current, monthDay, list);
    });
  }, []);

  const setOccurrenceExcluded = useCallback(
    (monthDay: string, id: string, dateKey: string, excluded: boolean) => {
      setAnniversaries((current) => {
        const list = (current[monthDay] ?? []).map((item) => {
          if (item.id !== id || item.kind !== 'recurring') return item;
          const dates = new Set(item.excludedDates ?? []);
          if (excluded) {
            dates.add(dateKey);
          } else {
            dates.delete(dateKey);
          }
          const next = [...dates].sort();
          const updated: AnniversaryEntry = { ...item };
          if (next.length > 0) {
            updated.excludedDates = next;
          } else {
            delete updated.excludedDates;
          }
          return normalizeAnniversary(updated, item.id) ?? updated;
        });
        return withDay(current, monthDay, list);
      });
    },
    [],
  );

  const replaceAnniversaries = useCallback((next: AnniversaryMap) => {
    setAnniversaries(next);
  }, []);

  return {
    anniversaries,
    setAnniversary,
    replaceDay,
    resetAnniversary,
    removeAnniversary,
    setOccurrenceExcluded,
    setSeriesEnd,
    replaceAnniversaries,
  };
}

/**
 * Liefert eine neue Map, in der der angegebene Tag durch `list` ersetzt wird.
 * Eine leere Liste entfernt den Tag vollständig (kein leerer Resteintrag).
 */
function withDay(
  current: AnniversaryMap,
  monthDay: string,
  list: AnniversaryEntry[],
): AnniversaryMap {
  const next = { ...current };
  if (list.length === 0) {
    delete next[monthDay];
  } else {
    next[monthDay] = list;
  }
  return next;
}
