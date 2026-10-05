import { describe, expect, it } from 'vitest';
import {
  MAX_LABEL_LENGTH,
  STORAGE_KEY,
  clearState,
  getAnnotationColorId,
  normalizeAnnotation,
  normalizeAnnotations,
  normalizeLabel,
  normalizeSettings,
  readState,
  saveSettings,
  writeState,
  type StorageLike,
} from '../services/storage';
import { DEFAULT_SETTINGS } from '../config/appDefaults';
import type { AnnotationMap, PersistedState, UserDayAnnotation } from '../domain/types';

/** In-Memory-Storage für Tests. */
function createMemoryStorage(initial: Record<string, string> = {}): StorageLike & {
  dump(): Record<string, string>;
} {
  const data: Record<string, string> = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value;
    },
    removeItem: (key) => {
      delete data[key];
    },
    dump: () => ({ ...data }),
  };
}

describe('Label-Normalisierung', () => {
  it('begrenzt Freitext auf 50 Zeichen', () => {
    const long = 'x'.repeat(120);
    expect(normalizeLabel(long)).toHaveLength(MAX_LABEL_LENGTH);
    expect(normalizeLabel('Kurz')).toBe('Kurz');
    expect(normalizeLabel('')).toBe('');
  });

  it('toleriert ungültige Eingaben ohne zu werfen', () => {
    expect(normalizeLabel(undefined as unknown as string)).toBe('');
  });
});

describe('Normalisierung einzelner Annotationen', () => {
  it('akzeptiert gültige Annotationen', () => {
    const annotation: UserDayAnnotation = {
      dateKey: '2021-01-01',
      label: 'Arzt',
      colors: { info: 'green' },
    };
    expect(normalizeAnnotation(annotation)).toEqual(annotation);
  });

  it('lehnt ungültige dateKeys ab', () => {
    expect(normalizeAnnotation({ dateKey: '2021-02-30', label: 'x' })).toBeNull();
    expect(normalizeAnnotation({ dateKey: '01.01.2021', label: 'x' })).toBeNull();
    expect(normalizeAnnotation({ label: 'x' })).toBeNull();
    expect(normalizeAnnotation(null)).toBeNull();
    expect(normalizeAnnotation('text')).toBeNull();
  });

  it('behält gültige Spaltenfarben und verwirft unbekannte', () => {
    const result = normalizeAnnotation({
      dateKey: '2021-05-05',
      label: 'y'.repeat(80),
      colors: { weekday: 'red', day: 'neonpink', unbekannt: 'blue', shift: 42 },
    });
    expect(result).toEqual({
      dateKey: '2021-05-05',
      label: 'y'.repeat(MAX_LABEL_LENGTH),
      colors: { weekday: 'red' },
    });
  });

  it('verwirft vollständig leere Annotationen', () => {
    expect(normalizeAnnotation({ dateKey: '2021-05-05', label: '', colors: {} })).toBeNull();
    expect(normalizeAnnotation({ dateKey: '2021-05-05', label: '' })).toBeNull();
  });

  it('übernimmt das frühere colorId als Farbe der Informationsspalte', () => {
    // Abwärtskompatibilität: ältere Speicherstände nutzten ein einzelnes
    // `colorId`; es entsprach der persönlichen Tagesfarbe (Info-Spalte).
    expect(normalizeAnnotation({ dateKey: '2021-05-05', label: 'Alt', colorId: 'red' })).toEqual({
      dateKey: '2021-05-05',
      label: 'Alt',
      colors: { info: 'red' },
    });
  });

  it('bereinigt eine Sammlung und indexiert nach dateKey', () => {
    const map = normalizeAnnotations({
      a: { dateKey: '2021-01-01', label: 'A', colors: { info: 'red' } },
      b: { dateKey: '2021-01-01', label: 'B', colors: { info: 'blue' } },
      c: { dateKey: 'ungültig', label: 'C', colors: { info: 'blue' } },
    });
    expect(Object.keys(map)).toEqual(['2021-01-01']);
    expect(map['2021-01-01'].label).toBe('B');
  });
});

describe('Einstellungen', () => {
  it('übernimmt gültige Einstellungen', () => {
    expect(normalizeSettings({ selectedYear: 2024, selectedShift: 'A' })).toEqual({
      selectedYear: 2024,
      selectedShift: 'A',
    });
  });

  it('fällt auf Standardwerte zurück', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ selectedYear: 1700, selectedShift: 'Z' })).toEqual(DEFAULT_SETTINGS);
  });
});


describe('Lesen und Schreiben', () => {
  const state: PersistedState = {
    version: 1,
    settings: { selectedYear: 2023, selectedShift: 'B' },
    annotations: {
      '2023-04-04': { dateKey: '2023-04-04', label: 'Urlaub', colors: { info: 'orange' } },
    },
  };

  it('rundreist verlustfrei', () => {
    const storage = createMemoryStorage();
    expect(writeState(state, storage)).toBe(true);
    const loaded = readState(storage);
    expect(loaded.settings).toEqual(state.settings);
    expect(loaded.annotations).toEqual(state.annotations);
    expect(loaded.version).toBe(1);
  });

  it('liefert ohne Storage oder ohne Daten die Standardwerte', () => {
    expect(readState(null)).toEqual({ version: 1, settings: DEFAULT_SETTINGS, annotations: {} });
    expect(readState(createMemoryStorage())).toEqual({
      version: 1,
      settings: DEFAULT_SETTINGS,
      annotations: {},
    });
  });

  it('toleriert defektes JSON ohne zu werfen', () => {
    const storage = createMemoryStorage({ [STORAGE_KEY]: '{kaputt' });
    expect(readState(storage).settings).toEqual(DEFAULT_SETTINGS);
  });

  it('repariert teilweise beschädigte Zustände', () => {
    const storage = createMemoryStorage({
      [STORAGE_KEY]: JSON.stringify({
        version: 1,
        settings: { selectedYear: 'x', selectedShift: 'C' },
        annotations: {
          ok: { dateKey: '2024-06-01', label: 'Test', colorId: 'lila' },
        },
      }),
    });
    const loaded = readState(storage);
    expect(loaded.settings.selectedYear).toBe(DEFAULT_SETTINGS.selectedYear);
    expect(loaded.settings.selectedShift).toBe('C');
    expect(loaded.annotations['2024-06-01']).toEqual({
      dateKey: '2024-06-01',
      label: 'Test',
      colors: {},
    });
  });

  it('meldet fehlgeschlagenes Schreiben ohne zu werfen', () => {
    const broken: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
      removeItem: () => undefined,
    };
    expect(writeState(state, broken)).toBe(false);
    expect(writeState(state, null)).toBe(false);
  });

  it('speichert Einstellungen mit Annotationen über saveSettings', () => {
    const storage = createMemoryStorage();
    const annotations: AnnotationMap = {
      '2021-12-24': { dateKey: '2021-12-24', label: 'frei', colors: { info: 'pink' } },
    };
    expect(saveSettings({ selectedYear: 2021, selectedShift: 'C' }, annotations, storage)).toBe(
      true,
    );
    const loaded = readState(storage);
    expect(getAnnotationColorId(loaded.annotations, '2021-12-24')).toBe('pink');
    expect(getAnnotationColorId(loaded.annotations, '2021-12-25')).toBeNull();
  });

  it('löscht den Zustand vollständig', () => {
    const storage = createMemoryStorage();
    writeState(state, storage);
    clearState(storage);
    expect(storage.dump()).toEqual({});
    expect(() => clearState(null)).not.toThrow();
  });
});
