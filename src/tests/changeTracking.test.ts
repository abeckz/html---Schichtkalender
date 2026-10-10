import { describe, expect, it } from 'vitest';
import { hasUnsavedChanges, isStateEmpty, stateSignature } from '../services/changeTracking';
import { DEFAULT_SETTINGS } from '../config/appDefaults';
import { STORAGE_VERSION } from '../services/storage';
import type { PersistedState } from '../domain/types';

const emptyState: PersistedState = {
  version: STORAGE_VERSION,
  settings: { ...DEFAULT_SETTINGS },
  annotations: {},
  colorLegend: {},
};

const sampleState: PersistedState = {
  version: STORAGE_VERSION,
  settings: { selectedYear: 2026, selectedShift: 'C' },
  annotations: {
    '2026-03-15': { dateKey: '2026-03-15', label: 'Urlaub', colors: { info: 'yellow' } },
  },
  colorLegend: {},
};

describe('Signatur des Zustands', () => {
  it('liefert für inhaltlich gleiche Zustände dieselbe Signatur', () => {
    const a: PersistedState = {
      version: 1,
      settings: { selectedYear: 2026, selectedShift: 'C' },
      annotations: {
        '2026-05-01': { dateKey: '2026-05-01', label: 'x', colors: { day: 'red', info: 'blue' } },
      },
      colorLegend: {},
    };
    // Andere Version, andere Schlüsselreihenfolge – gleicher Inhalt.
    const b: PersistedState = {
      version: 9,
      settings: { selectedShift: 'C', selectedYear: 2026 },
      annotations: {
        '2026-05-01': {
          dateKey: '2026-05-01',
          label: 'x',
          colors: { info: 'blue', day: 'red' } as never,
        },
      },
      colorLegend: {},
    };
    expect(stateSignature(a)).toBe(stateSignature(b));
  });

  it('erkennt Änderungen an Jahr, Schicht und Annotationen', () => {
    const base = stateSignature(sampleState);
    expect(
      stateSignature({ ...sampleState, settings: { ...sampleState.settings, selectedYear: 2027 } }),
    ).not.toBe(base);
    expect(
      stateSignature({
        ...sampleState,
        annotations: {
          ...sampleState.annotations,
          '2026-06-01': { dateKey: '2026-06-01', label: 'neu', colors: {} },
        },
      }),
    ).not.toBe(base);
  });
});

describe('Erkennung ungespeicherter Änderungen', () => {
  it('meldet ohne Sicherung nur bei echten Daten Änderungen', () => {
    expect(hasUnsavedChanges(null, emptyState)).toBe(false);
    expect(hasUnsavedChanges(null, sampleState)).toBe(true);
  });

  it('vergleicht gegen die letzte Sicherung', () => {
    const saved = stateSignature(sampleState);
    expect(hasUnsavedChanges(saved, sampleState)).toBe(false);
    expect(hasUnsavedChanges(saved, { ...sampleState, annotations: {} })).toBe(true);
  });

  it('erkennt den leeren Auslieferungszustand', () => {
    expect(isStateEmpty(emptyState)).toBe(true);
    expect(isStateEmpty(sampleState)).toBe(false);
    expect(
      isStateEmpty({
        version: STORAGE_VERSION,
        settings: { selectedYear: 2026, selectedShift: 'C' },
        annotations: {},
        colorLegend: {},
      }),
    ).toBe(true);
  });
});
