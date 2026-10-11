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
import { getDefaultStorage, normalizeAnnotation, readState, writeState, } from '../services/storage';
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
export function useAnnotationStore(settings, storage = getDefaultStorage()) {
    const [annotations, setAnnotations] = useState(() => readState(storage).annotations);
    // Beim Wechsel des Storage (praktisch nur in Tests) neu einlesen.
    useEffect(() => {
        setAnnotations(readState(storage).annotations);
    }, [storage]);
    // Jede Änderung sofort persistieren.
    useEffect(() => {
        writeState({ version: 1, settings, annotations, colorLegend: {} }, storage);
    }, [settings, annotations, storage]);
    const setAnnotation = useCallback((dateKey, label, colorId) => {
        setAnnotations((current) => {
            const existing = current[dateKey];
            const colors = { ...(existing?.colors ?? {}) };
            if (colorId) {
                colors.info = colorId;
            }
            else {
                delete colors.info;
            }
            const normalized = normalizeAnnotation({ dateKey, label, colors });
            const next = { ...current };
            if (normalized) {
                next[dateKey] = normalized;
            }
            else {
                delete next[dateKey];
            }
            return next;
        });
    }, []);
    const resetAnnotation = useCallback((dateKey) => {
        setAnnotations((current) => {
            if (!(dateKey in current))
                return current;
            const next = { ...current };
            delete next[dateKey];
            return next;
        });
    }, []);
    const setColumnColorForDateKeys = useCallback((dateKeys, column, colorId) => {
        setAnnotations((current) => {
            const next = { ...current };
            for (const dateKey of dateKeys) {
                const existing = current[dateKey];
                const label = existing?.label ?? '';
                const colors = { ...(existing?.colors ?? {}) };
                if (colorId) {
                    colors[column] = colorId;
                }
                else {
                    delete colors[column];
                }
                const normalized = normalizeAnnotation({ dateKey, label, colors });
                if (normalized) {
                    next[dateKey] = normalized;
                }
                else {
                    delete next[dateKey];
                }
            }
            return next;
        });
    }, []);
    const replaceAnnotations = useCallback((next) => {
        setAnnotations(next);
    }, []);
    return {
        annotations,
        setAnnotation,
        resetAnnotation,
        setColumnColorForDateKeys,
        replaceAnnotations,
    };
}
