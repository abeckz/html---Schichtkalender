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
import { STORAGE_VERSION, getDefaultStorage, normalizeAnniversary, normalizeAnniversaryName, readState, writeState, } from '../services/storage.ts';
/** Bereinigt einen Eintrag für eine feste Tagesliste (Name und Art relevant). */
function cleanEntry(entry) {
    const name = normalizeAnniversaryName(entry.name);
    if (name === '')
        return null;
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
export function useAnniversaryStore(settings, storage = getDefaultStorage()) {
    const [anniversaries, setAnniversaries] = useState(() => readState(storage).anniversaries);
    // Beim Wechsel des Storage (praktisch nur in Tests) neu einlesen.
    useEffect(() => {
        setAnniversaries(readState(storage).anniversaries);
    }, [storage]);
    // Jede Änderung sofort persistieren; Annotationen und Farblegende werden
    // aus dem Speicher übernommen, damit sie nicht überschrieben werden.
    useEffect(() => {
        const persisted = readState(storage);
        writeState({
            version: STORAGE_VERSION,
            settings,
            annotations: persisted.annotations,
            colorLegend: persisted.colorLegend,
            anniversaries,
        }, storage);
    }, [settings, anniversaries, storage]);
    const setAnniversary = useCallback((entry) => {
        setAnniversaries((current) => {
            const cleaned = cleanEntry(entry);
            const list = (current[entry.monthDay] ?? []).filter((item) => item.id !== entry.id);
            if (cleaned)
                list.push(cleaned);
            return withDay(current, entry.monthDay, list);
        });
    }, []);
    const replaceDay = useCallback((monthDay, entries) => {
        setAnniversaries((current) => {
            const cleaned = [];
            for (const entry of entries) {
                const prepared = cleanEntry(entry);
                if (prepared)
                    cleaned.push(prepared);
            }
            return withDay(current, monthDay, cleaned);
        });
    }, []);
    const resetAnniversary = useCallback((monthDay) => {
        setAnniversaries((current) => withDay(current, monthDay, []));
    }, []);
    const removeAnniversary = useCallback((monthDay, id) => {
        setAnniversaries((current) => {
            const list = (current[monthDay] ?? []).filter((item) => item.id !== id);
            return withDay(current, monthDay, list);
        });
    }, []);
    const replaceAnniversaries = useCallback((next) => {
        setAnniversaries(next);
    }, []);
    return {
        anniversaries,
        setAnniversary,
        replaceDay,
        resetAnniversary,
        removeAnniversary,
        replaceAnniversaries,
    };
}
/**
 * Liefert eine neue Map, in der der angegebene Tag durch `list` ersetzt wird.
 * Eine leere Liste entfernt den Tag vollständig (kein leerer Resteintrag).
 */
function withDay(current, monthDay, list) {
    const next = { ...current };
    if (list.length === 0) {
        delete next[monthDay];
    }
    else {
        next[monthDay] = list;
    }
    return next;
}
