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
import { MAX_LEGEND_TEXT_LENGTH, getDefaultStorage, readState, writeState, } from '../services/storage.ts';
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
export function useColorLegendStore(settings, annotations, storage = getDefaultStorage()) {
    const [colorLegend, setColorLegend] = useState(() => readState(storage).colorLegend);
    // Beim Wechsel des Storage (praktisch nur in Tests) neu einlesen.
    useEffect(() => {
        setColorLegend(readState(storage).colorLegend);
    }, [storage]);
    // Jede Änderung sofort persistieren; die Jahrestage werden aus dem Speicher
    // übernommen, damit sie nicht überschrieben werden.
    useEffect(() => {
        const persisted = readState(storage);
        writeState({ version: 1, settings, annotations, colorLegend, anniversaries: persisted.anniversaries }, storage);
    }, [settings, annotations, colorLegend, storage]);
    const setColorLegendText = useCallback((year, colorId, text) => {
        setColorLegend((current) => {
            const trimmed = text.slice(0, MAX_LEGEND_TEXT_LENGTH);
            const yearEntry = { ...(current[year] ?? {}) };
            if (trimmed !== '') {
                yearEntry[colorId] = trimmed;
            }
            else {
                delete yearEntry[colorId];
            }
            const next = { ...current };
            if (Object.keys(yearEntry).length > 0) {
                next[year] = yearEntry;
            }
            else {
                delete next[year];
            }
            return next;
        });
    }, []);
    const replaceColorLegend = useCallback((next) => {
        setColorLegend(next);
    }, []);
    return { colorLegend, setColorLegendText, replaceColorLegend };
}
