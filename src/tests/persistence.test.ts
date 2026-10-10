import { describe, expect, it } from 'vitest';
import {
  EXPORT_FILE_EXTENSION,
  buildExportFileName,
  downloadState,
  parseState,
  serializeState,
  triggerDownload,
} from '../services/persistence';
import { readFileAsText } from '../services/fileReader';
import { STORAGE_VERSION } from '../services/storage';
import { DEFAULT_SETTINGS } from '../config/appDefaults';
import type { PersistedState } from '../domain/types';

const sampleState: PersistedState = {
  version: STORAGE_VERSION,
  settings: { selectedYear: 2026, selectedShift: 'C' },
  annotations: {
    '2026-03-15': { dateKey: '2026-03-15', label: 'Urlaub', colors: { info: 'yellow' } },
    '2026-04-01': { dateKey: '2026-04-01', label: '', colors: { weekday: 'red' } },
  },
};

describe('Dateiname', () => {
  it('nennt Jahr und Endung', () => {
    expect(buildExportFileName(2026)).toBe(`schichtkalender-2026.${EXPORT_FILE_EXTENSION}`);
  });

  it('toleriert ungültige Jahre ohne zu werfen', () => {
    expect(buildExportFileName(Number.NaN)).toBe(
      `schichtkalender-.${EXPORT_FILE_EXTENSION}`,
    );
  });
});

describe('Serialisierung', () => {
  it('rundreist verlustfrei durch serializeState/parseState', () => {
    const text = serializeState(sampleState);
    const loaded = parseState(text);
    expect(loaded).not.toBeNull();
    expect(loaded?.settings).toEqual(sampleState.settings);
    expect(loaded?.annotations).toEqual(sampleState.annotations);
    expect(loaded?.version).toBe(STORAGE_VERSION);
  });

  it('erzeugt lesbares JSON mit den bekannten Feldern', () => {
    const text = serializeState(sampleState);
    expect(text).toContain('\n');
    const parsed = JSON.parse(text);
    expect(Object.keys(parsed).sort()).toEqual(['annotations', 'settings', 'version']);
  });

  it('bereinigt ungültige Werte bereits beim Serialisieren', () => {
    const text = serializeState({
      version: 999,
      settings: { selectedYear: 1200, selectedShift: 'Z' as never },
      annotations: {
        bad: { dateKey: 'kein-datum', label: 'x' } as never,
      },
    });
    const loaded = parseState(text);
    expect(loaded?.version).toBe(STORAGE_VERSION);
    expect(loaded?.settings).toEqual(DEFAULT_SETTINGS);
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
    const created: string[] = [];
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
      style: {} as CSSStyleDeclaration,
      click: () => created.push('click'),
    };
    const fakeDoc = {
      createElement: () => link,
      body: {
        appendChild: () => created.push('append'),
        removeChild: () => created.push('remove'),
      },
    } as unknown as Document;

    // URL.createObjectURL ist im Node-Testlauf nicht vorhanden; hier gezielt
    // bereitstellen, um den Ablauf zu prüfen.
    (globalThis as { URL: typeof URL }).URL = urlApi as unknown as typeof URL;
    try {
      expect(triggerDownload('{}', 'sicherung.json', fakeDoc)).toBe(true);
    } finally {
      (globalThis as { URL: typeof URL }).URL = originalUrl;
    }

    expect(link.download).toBe('sicherung.json');
    expect(created).toEqual(['append', 'click', 'remove']);
  });
});

describe('Datei lesen', () => {
  it('liefert null, wenn kein FileReader verfügbar ist', async () => {
    await expect(readFileAsText({} as File, () => null as never)).resolves.toBeNull();
  });

  it('liefert den Textinhalt der Datei', async () => {
    const fakeReader = (): FileReader =>
      ({
        result: null,
        onload: null,
        onerror: null,
        readAsText() {
          (this as unknown as { result: string }).result = '{"a":1}';
          (this as unknown as { onload: (() => void) | null }).onload?.();
        },
      }) as unknown as FileReader;
    await expect(readFileAsText({} as File, fakeReader)).resolves.toBe('{"a":1}');
  });
});