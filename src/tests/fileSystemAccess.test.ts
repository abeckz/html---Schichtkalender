import { describe, expect, it, vi } from 'vitest';
import {
  buildJsonFileTypes,
  canUseOpenPicker,
  canUseSavePicker,
  loadTextWithPicker,
  saveTextWithPicker,
} from '../services/fileSystemAccess';
import { downloadState, loadState, saveState } from '../services/persistence';
import { DEFAULT_SETTINGS } from '../config/appDefaults';
import { STORAGE_VERSION } from '../services/storage';
import type { PersistedState } from '../domain/types';

const sampleState: PersistedState = {
  version: STORAGE_VERSION,
  settings: { selectedYear: 2026, selectedShift: 'C' },
  annotations: {
    '2026-03-15': { dateKey: '2026-03-15', label: 'Urlaub', colors: { info: 'yellow' } },
  },
  colorLegend: {},
};

/** Baut eine minimale window-Attrappe mit optionaler File System Access API. */
function stubWindow(win: Record<string, unknown> | null): () => void {
  const original = (globalThis as { window?: unknown }).window;
  if (win === null) {
    delete (globalThis as { window?: unknown }).window;
  } else {
    (globalThis as { window?: unknown }).window = win;
  }
  return () => {
    if (original === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = original;
  };
}

describe('File System Access – Verfügbarkeit', () => {
  it('meldet ohne window false', () => {
    const restore = stubWindow(null);
    try {
      expect(canUseSavePicker()).toBe(false);
      expect(canUseOpenPicker()).toBe(false);
    } finally {
      restore();
    }
  });

  it('erkennt vorhandene Dialog-Funktionen', () => {
    const restore = stubWindow({
      showSaveFilePicker: () => undefined,
      showOpenFilePicker: () => undefined,
    });
    try {
      expect(canUseSavePicker()).toBe(true);
      expect(canUseOpenPicker()).toBe(true);
    } finally {
      restore();
    }
  });

  it('beschreibt den JSON-Dateitypfilter', () => {
    expect(buildJsonFileTypes()[0].accept['application/json']).toContain('.json');
  });
});

describe('Systemdialog – Speichern', () => {
  it('meldet unsupported ohne API', async () => {
    const restore = stubWindow({});
    try {
      await expect(saveTextWithPicker('{}', 'x.json')).resolves.toBe('unsupported');
    } finally {
      restore();
    }
  });

  it('schreibt den Text über den Dialog und meldet saved', async () => {
    const written: string[] = [];
    let closed = false;
    const restore = stubWindow({
      showSaveFilePicker: async () => ({
        createWritable: async () => ({
          write: async (data: Blob) => {
            written.push(await data.text());
          },
          close: async () => {
            closed = true;
          },
        }),
      }),
    });
    try {
      await expect(saveTextWithPicker('{"a":1}', 'x.json')).resolves.toBe('saved');
    } finally {
      restore();
    }
    expect(written).toEqual(['{"a":1}']);
    expect(closed).toBe(true);
  });

  it('meldet cancelled bei Abbruch durch den Benutzer', async () => {
    const abort = Object.assign(new Error('abort'), { name: 'AbortError' });
    const restore = stubWindow({
      showSaveFilePicker: async () => {
        throw abort;
      },
    });
    try {
      await expect(saveTextWithPicker('{}', 'x.json')).resolves.toBe('cancelled');
    } finally {
      restore();
    }
  });

  it('meldet failed bei sonstigem Fehler', async () => {
    const restore = stubWindow({
      showSaveFilePicker: async () => {
        throw new Error('kaputt');
      },
    });
    try {
      await expect(saveTextWithPicker('{}', 'x.json')).resolves.toBe('failed');
    } finally {
      restore();
    }
  });
});

describe('Systemdialog – Laden', () => {
  it('meldet unsupported ohne API', async () => {
    const restore = stubWindow({});
    try {
      await expect(loadTextWithPicker()).resolves.toEqual({ status: 'unsupported' });
    } finally {
      restore();
    }
  });

  it('liest den Textinhalt der gewählten Datei', async () => {
    const restore = stubWindow({
      showOpenFilePicker: async () => [{ getFile: async () => ({ text: async () => '{"a":1}' }) }],
    });
    try {
      await expect(loadTextWithPicker()).resolves.toEqual({ status: 'loaded', text: '{"a":1}' });
    } finally {
      restore();
    }
  });

  it('meldet cancelled bei Abbruch', async () => {
    const abort = Object.assign(new Error('abort'), { name: 'AbortError' });
    const restore = stubWindow({
      showOpenFilePicker: async () => {
        throw abort;
      },
    });
    try {
      await expect(loadTextWithPicker()).resolves.toEqual({ status: 'cancelled' });
    } finally {
      restore();
    }
  });
});

describe('Speichern mit Fallback', () => {
  it('nutzt den Systemdialog, wenn vorhanden', async () => {
    const restore = stubWindow({
      showSaveFilePicker: async () => ({
        createWritable: async () => ({
          write: async () => undefined,
          close: async () => undefined,
        }),
      }),
    });
    try {
      await expect(saveState(sampleState)).resolves.toBe('saved');
    } finally {
      restore();
    }
  });

  it('fällt ohne Dialog auf den Download zurück', async () => {
    const restore = stubWindow({});
    const click = vi.fn();
    const urlApi = { createObjectURL: () => 'blob:test', revokeObjectURL: () => undefined };
    const originalUrl = globalThis.URL;
    (globalThis as { URL: typeof URL }).URL = urlApi as unknown as typeof URL;
    const fakeDoc = {
      createElement: () => ({ style: {}, click }),
      body: { appendChild: () => undefined, removeChild: () => undefined },
    } as unknown as Document;
    try {
      await expect(saveState(sampleState, fakeDoc)).resolves.toBe('saved');
    } finally {
      restore();
      (globalThis as { URL: typeof URL }).URL = originalUrl;
    }
    expect(click).toHaveBeenCalledTimes(1);
  });

  it('lädt über den Dialog und bereinigt den Zustand', async () => {
    const json = JSON.stringify({ settings: { selectedShift: 'A' } });
    const restore = stubWindow({
      showOpenFilePicker: async () => [{ getFile: async () => ({ text: async () => json }) }],
    });
    let outcome: Awaited<ReturnType<typeof loadState>>;
    try {
      outcome = await loadState();
    } finally {
      restore();
    }
    expect(outcome.status).toBe('loaded');
    if (outcome.status === 'loaded') {
      expect(outcome.state.settings.selectedShift).toBe('A');
      expect(outcome.state.settings.selectedYear).toBe(DEFAULT_SETTINGS.selectedYear);
    }
  });

  it('meldet invalid, wenn der Dialog ungültigen Inhalt liefert', async () => {
    const restore = stubWindow({
      showOpenFilePicker: async () => [
        { getFile: async () => ({ text: async () => 'kein json' }) },
      ],
    });
    try {
      await expect(loadState()).resolves.toEqual({ status: 'invalid' });
    } finally {
      restore();
    }
  });

  it('meldet unavailable, wenn kein Dialog vorhanden ist', async () => {
    const restore = stubWindow({});
    try {
      await expect(loadState()).resolves.toEqual({ status: 'unavailable' });
    } finally {
      restore();
    }
  });

  it('behält den klassischen Download als Baustein', () => {
    expect(downloadState(sampleState, null)).toBe(false);
  });
});


