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
import { getDefaultStorage, normalizeAnnotation, MAX_EXTRA_TEXT_LENGTH, readState, writeState, } from '../services/storage.ts';
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
    // Jede Änderung sofort persistieren; die übrigen Zustandsbereiche werden
    // dabei aus dem Speicher übernommen, damit sie nicht überschrieben werden.
    useEffect(() => {
        const persisted = readState(storage);
        writeState({ version: 1, settings, annotations, colorLegend: persisted.colorLegend, anniversaries: persisted.anniversaries }, storage);
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
            // Farben und querliegende Texte der Zusatzspalten bleiben unverändert
            // erhalten: sie werden ausschließlich über die Streifen-Auswahl bzw.
            // den Zusatzspalten-Editor gepflegt.
            const normalized = normalizeAnnotation({
                dateKey,
                label,
                colors,
                extraColors: existing?.extraColors,
                extraTexts: existing?.extraTexts,
            });
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
        // Feste Farbspalten der Tageszeile landen in `colors`, Zusatzspalten
        // (`extra0`, …) in `extraColors`; beide werden getrennt gepflegt.
        const isExtra = isExtraColorKey(column);
        setAnnotations((current) => {
            const next = { ...current };
            for (const dateKey of dateKeys) {
                const existing = current[dateKey];
                const label = existing?.label ?? '';
                const colors = { ...(existing?.colors ?? {}) };
                const extraColors = {
                    ...(existing?.extraColors ?? {}),
                };
                if (isExtra) {
                    const key = column;
                    if (colorId) {
                        extraColors[key] = colorId;
                    }
                    else {
                        delete extraColors[key];
                    }
                }
                else {
                    const key = column;
                    if (colorId) {
                        colors[key] = colorId;
                    }
                    else {
                        delete colors[key];
                    }
                }
                const normalized = normalizeAnnotation({
                    dateKey,
                    label,
                    colors,
                    extraColors: Object.keys(extraColors).length > 0 ? extraColors : undefined,
                    extraTexts: existing?.extraTexts,
                });
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
    const setExtraColumnText = useCallback((dateKeys, colorKey, columnLabel, vertical, text) => {
        const span = [...dateKeys].sort();
        if (span.length === 0)
            return;
        const anchor = span[0];
        const trimmed = text.slice(0, MAX_EXTRA_TEXT_LENGTH);
        setAnnotations((current) => {
            const next = { ...current };
            // Zuerst einen früheren Text desselben Schlüssels im gesamten Zustand
            // entfernen (Spanne kann sich verschoben haben), dann neu auf dem Anker
            // setzen. So existiert höchstens ein Text je Spalten-Schlüssel und Tag.
            const removeFrom = (target, dateKey) => {
                const existing = target[dateKey];
                if (!existing?.extraTexts?.[colorKey])
                    return;
                const extraTexts = { ...existing.extraTexts };
                delete extraTexts[colorKey];
                const normalized = normalizeAnnotation({
                    ...existing,
                    extraTexts: Object.keys(extraTexts).length > 0 ? extraTexts : undefined,
                });
                if (normalized) {
                    target[dateKey] = normalized;
                }
                else {
                    delete target[dateKey];
                }
            };
            for (const dateKey of Object.keys(next)) {
                removeFrom(next, dateKey);
            }
            if (trimmed === '')
                return next;
            const existing = next[anchor] ?? current[anchor];
            const normalized = normalizeAnnotation({
                dateKey: anchor,
                label: existing?.label ?? '',
                colors: existing?.colors ?? {},
                extraColors: existing?.extraColors,
                extraTexts: {
                    ...(existing?.extraTexts ?? {}),
                    [colorKey]: {
                        colorKey,
                        columnLabel,
                        vertical,
                        text: trimmed,
                        dateKeys: span,
                        length: span.length,
                    },
                },
            });
            if (normalized) {
                next[anchor] = normalized;
            }
            else {
                delete next[anchor];
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
        setExtraColumnText,
        replaceAnnotations,
    };
}
/** Prüft, ob ein Streifen-Ziel eine Zusatzspalte (`extra0`, …) benennt. */
function isExtraColorKey(column) {
    return /^extra[0-9]+$/.test(column);
}
