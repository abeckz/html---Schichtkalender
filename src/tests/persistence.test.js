import { describe, expect, it } from 'vitest';
import { EXPORT_FILE_EXTENSION, buildExportFileName, downloadState, parseState, serializeState, triggerDownload, } from '../services/persistence.ts';
import { readFileAsText } from '../services/fileReader.ts';
import { STORAGE_VERSION, normalizeSettings } from '../services/storage.ts';
import { DEFAULT_SETTINGS } from '../config/appDefaults.ts';
const sampleState = {
    version: STORAGE_VERSION,
    settings: { ...DEFAULT_SETTINGS, selectedYear: 2026, selectedShift: 'C', weekdayOverDate: false },
    annotations: {
        '2026-03-15': { dateKey: '2026-03-15', label: 'Urlaub', colors: { info: 'yellow' } },
        '2026-04-01': { dateKey: '2026-04-01', label: '', colors: { weekday: 'red' } },
    },
    colorLegend: {},
    anniversaries: {},
};
describe('Dateiname', () => {
    it('nennt Jahr und Endung', () => {
        expect(buildExportFileName(2026)).toBe(`schichtkalender-2026.${EXPORT_FILE_EXTENSION}`);
    });
    it('toleriert ungültige Jahre ohne zu werfen', () => {
        expect(buildExportFileName(Number.NaN)).toBe(`schichtkalender-.${EXPORT_FILE_EXTENSION}`);
    });
});
describe('Serialisierung', () => {
    it('rundreist verlustfrei durch serializeState/parseState', () => {
        const text = serializeState(sampleState);
        const loaded = parseState(text);
        expect(loaded).not.toBeNull();
        expect(loaded?.settings).toEqual(normalizeSettings(sampleState.settings));
        expect(loaded?.annotations).toEqual(sampleState.annotations);
        expect(loaded?.version).toBe(STORAGE_VERSION);
    });
    it('erzeugt lesbares JSON mit den bekannten Feldern', () => {
        const text = serializeState(sampleState);
        expect(text).toContain('\n');
        const parsed = JSON.parse(text);
        expect(Object.keys(parsed).sort()).toEqual([
            'anniversaries',
            'annotations',
            'colorLegend',
            'settings',
            'version',
        ]);
    });
    it('bereinigt ungültige Werte bereits beim Serialisieren', () => {
        const text = serializeState({
            version: 999,
            settings: { ...DEFAULT_SETTINGS, selectedYear: 1200, selectedShift: 'Z', weekdayOverDate: false },
            annotations: {
                bad: { dateKey: 'kein-datum', label: 'x' },
            },
            colorLegend: {},
            anniversaries: {},
        });
        const loaded = parseState(text);
        expect(loaded?.version).toBe(STORAGE_VERSION);
        expect(loaded?.settings).toEqual(normalizeSettings({ ...DEFAULT_SETTINGS }));
        expect(loaded?.annotations).toEqual({});
    });
});
describe('Parsen einer Sicherungsdatei', () => {
    it('liefert null bei leerem oder ungültigem Inhalt', () => {
        expect(parseState('')).toBeNull();
        expect(parseState('   ')).toBeNull();
        expect(parseState('{kaputt')).toBeNull();
        expect(parseState('null')).toBeNull();
        expect(parseState('42')).toBeNull();
        expect(parseState('"text"')).toBeNull();
    });
    it('repariert unvollständige Dateien mit Standardwerten', () => {
        const loaded = parseState('{"settings":{"selectedShift":"A"}}');
        expect(loaded?.settings.selectedShift).toBe('A');
        expect(loaded?.settings.selectedYear).toBe(DEFAULT_SETTINGS.selectedYear);
        expect(loaded?.annotations).toEqual({});
    });
});
describe('Download', () => {
    it('meldet ohne Dokument false, ohne zu werfen', () => {
        expect(triggerDownload('{}', 'x.json', null)).toBe(false);
        expect(downloadState(sampleState, null)).toBe(false);
    });
    it('löst einen Dateidownload aus und räumt das Link-Element wieder ab', () => {
        const created = [];
        const urlApi = {
            createObjectURL: () => 'blob:test',
            revokeObjectURL: () => undefined,
        };
        const originalUrl = globalThis.URL;
        // Minimale Dokument-Attrappe: nur die vom Download genutzten Methoden.
        const link = {
            href: '',
            download: '',
            rel: '',
            style: {},
            click: () => created.push('click'),
        };
        const fakeDoc = {
            createElement: () => link,
            body: {
                appendChild: () => created.push('append'),
                removeChild: () => created.push('remove'),
            },
        };
        // URL.createObjectURL ist im Node-Testlauf nicht vorhanden; hier gezielt
        // bereitstellen, um den Ablauf zu prüfen.
        globalThis.URL = urlApi;
        try {
            expect(triggerDownload('{}', 'sicherung.json', fakeDoc)).toBe(true);
        }
        finally {
            globalThis.URL = originalUrl;
        }
        expect(link.download).toBe('sicherung.json');
        expect(created).toEqual(['append', 'click', 'remove']);
    });
});
describe('Datei lesen', () => {
    it('liefert null, wenn kein FileReader verfügbar ist', async () => {
        await expect(readFileAsText({}, () => null)).resolves.toBeNull();
    });
    it('liefert den Textinhalt der Datei', async () => {
        const fakeReader = () => ({
            result: null,
            onload: null,
            onerror: null,
            readAsText() {
                this.result = '{"a":1}';
                this.onload?.();
            },
        });
        await expect(readFileAsText({}, fakeReader)).resolves.toBe('{"a":1}');
    });
});
