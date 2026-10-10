/**
 * Tests der Farblegende.
 *
 * Abgesichert werden:
 * - die Ermittlung der im Jahr tatsächlich benutzten Farben (jahresbezogen,
 *   in Palettenreihenfolge, spaltenunabhängig),
 * - die Normalisierung der jahresbezogenen Erklärtexte (Längenbegrenzung,
 *   defensive Behandlung ungültiger Eingaben),
 * - die Serialisierung der Farblegende in Sicherungsdateien,
 * - das Rendern der Farblegende in Bildschirm- und Druckansicht.
 */

/* @vitest-environment jsdom */

import { describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import type { AnnotationMap, ColorLegendMap } from '../domain/types';
import { usedAnnotationColors } from '../config/annotationColors';
import {
  MAX_LEGEND_TEXT_LENGTH,
  normalizeColorLegend,
  normalizeLegendText,
} from '../services/storage';
import { parseState, serializeState } from '../services/persistence';
import { DEFAULT_SETTINGS } from '../config/appDefaults';
import { ColorLegendBox } from '../components/ColorLegendBox';
import { ColorLegendEditor } from '../components/ColorLegendEditor';
import { CalendarLegend } from '../components/CalendarLegend';

function render(element: React.ReactElement): { container: HTMLElement } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<StrictMode>{element}</StrictMode>);
  });
  return { container };
}

function findButton(container: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(container.querySelectorAll('button')).find(
    (candidate) => candidate.textContent === text,
  );
  if (!button) throw new Error(`Schaltfläche "${text}" nicht gefunden`);
  return button as HTMLButtonElement;
}

describe('usedAnnotationColors', () => {
  const annotations: AnnotationMap = {
    // 2021: drei unterschiedliche Farben in unterschiedlichen Spalten.
    '2021-01-05': { dateKey: '2021-01-05', label: '', colors: { weekday: 'blue', day: 'yellow' } },
    '2021-06-10': { dateKey: '2021-06-10', label: 'x', colors: { info: 'yellow' } },
    '2021-09-01': { dateKey: '2021-09-01', label: '', colors: { shift: 'red' } },
    // 2022: nur eine Farbe, die 2021 nicht vorkommt.
    '2022-02-02': { dateKey: '2022-02-02', label: '', colors: { info: 'green' } },
  };

  it('liefert die benutzten Farben eines Jahres in Palettenreihenfolge', () => {
    // Palette: gelb, grün, blau, orange, pink, rot, violett, türkis, grau.
    expect(usedAnnotationColors(annotations, 2021)).toEqual(['yellow', 'blue', 'red']);
    expect(usedAnnotationColors(annotations, 2022)).toEqual(['green']);
  });

  it('berücksichtigt ausschließlich das angefragte Jahr', () => {
    expect(usedAnnotationColors(annotations, 2022)).not.toContain('blue');
    expect(usedAnnotationColors(annotations, 2022)).not.toContain('red');
  });

  it('liefert ein leeres Ergebnis für Jahre ohne Annotationen', () => {
    expect(usedAnnotationColors(annotations, 2020)).toEqual([]);
  });
});

describe('Normalisierung der Erklärtexte', () => {
  it('begrenzt Freitext auf MAX_LEGEND_TEXT_LENGTH Zeichen', () => {
    expect(normalizeLegendText('x'.repeat(200))).toHaveLength(MAX_LEGEND_TEXT_LENGTH);
    expect(normalizeLegendText('Urlaub')).toBe('Urlaub');
  });

  it('toleriert ungültige Eingaben ohne zu werfen', () => {
    expect(normalizeLegendText(undefined)).toBe('');
    expect(normalizeLegendText(42 as unknown as string)).toBe('');
  });

  it('bereinigt eine vollständige Farblegende', () => {
    const normalized = normalizeColorLegend({
      2021: { yellow: 'Urlaub', red: 'Schulung', neonpink: 'unbekannte Farbe' },
      2022: { green: 'x'.repeat(80) },
      nope: { blue: 'ungültiges Jahr' },
      1800: { blue: 'unplausibles Jahr' },
    });
    expect(Object.keys(normalized)).toEqual(['2021', '2022']);
    expect(normalized[2021]).toEqual({ yellow: 'Urlaub', red: 'Schulung' });
    expect(normalized[2022]?.green).toHaveLength(MAX_LEGEND_TEXT_LENGTH);
  });

  it('verwirft leere Einträge und leere Jahre', () => {
    expect(normalizeColorLegend({ 2021: { yellow: '' } })).toEqual({});
    expect(normalizeColorLegend(null)).toEqual({});
  });
});

describe('Farblegende in Sicherungsdateien', () => {
  it('übersteht Serialisieren und Parsen unverändert', () => {
    const colorLegend: ColorLegendMap = { 2021: { yellow: 'Urlaub', red: 'Schulung' } };
    const state = {
      version: 1 as const,
      settings: DEFAULT_SETTINGS,
      annotations: {},
      colorLegend,
    };
    expect(parseState(serializeState(state))).toEqual(state);
  });

  it('ergänzt eine fehlende Farblegende leer (Rückwärtskompatibilität)', () => {
    const json = JSON.stringify({ version: 1, settings: DEFAULT_SETTINGS, annotations: {} });
    expect(parseState(json)?.colorLegend).toEqual({});
  });
});

describe('ColorLegendBox', () => {
  it('zeigt Farbblock und Erklärung; fehlender Text fällt auf den Farbnamen zurück', () => {
    const { container } = render(<ColorLegendBox colors={['yellow', 'red']} texts={{ yellow: 'Urlaub' }} />);
    const items = container.querySelectorAll('.color-legend-item');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('Urlaub');
    // Ohne Erklärung erscheint der deutsche Farbname, nie nur die Farbe.
    expect(items[1].textContent).toContain('Rot');
  });

  it('rendert nichts, wenn keine Farbe benutzt wird', () => {
    const { container } = render(<ColorLegendBox colors={[]} texts={{}} />);
    expect(container.querySelector('.color-legend')).toBeNull();
  });

  it('ruft beim Klick die Bearbeitung mit der colorId auf', () => {
    const onEditColor = vi.fn();
    const { container } = render(
      <ColorLegendBox colors={['yellow']} texts={{}} onEditColor={onEditColor} />,
    );
    act(() => {
      (container.querySelector('.color-legend-item') as HTMLButtonElement).click();
    });
    expect(onEditColor).toHaveBeenCalledWith('yellow');
  });

  it('ist mit interactive=false read-only (keine Schaltflächen)', () => {
    const { container } = render(
      <ColorLegendBox colors={['yellow']} texts={{}} interactive={false} />,
    );
    expect(container.querySelectorAll('button').length).toBe(0);
    expect(container.querySelector('.color-legend-item-static')).not.toBeNull();
    expect(container.textContent).toContain('Gelb');
  });
});

describe('ColorLegendEditor', () => {
  it('speichert den eingegebenen Text für Jahr und Farbe', () => {
    const onSave = vi.fn();
    const { container } = render(
      <ColorLegendEditor
        colorId="yellow"
        year={2021}
        initialText=""
        onSave={onSave}
        onClose={() => undefined}
      />,
    );
    const input = container.querySelector('input') as HTMLInputElement;
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, 'Urlaub');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    act(() => {
      findButton(container, 'Speichern').click();
    });
    expect(onSave).toHaveBeenCalledWith(2021, 'yellow', 'Urlaub');
  });

  it('löscht einen vorhandenen Eintrag über die Löschen-Schaltfläche', () => {
    const onSave = vi.fn();
    const { container } = render(
      <ColorLegendEditor
        colorId="red"
        year={2021}
        initialText="Schulung"
        onSave={onSave}
        onClose={() => undefined}
      />,
    );
    act(() => {
      findButton(container, 'Löschen').click();
    });
    expect(onSave).toHaveBeenCalledWith(2021, 'red', '');
  });

  it('bietet bei leerem Eintrag kein Löschen an', () => {
    const { container } = render(
      <ColorLegendEditor
        colorId="yellow"
        year={2021}
        initialText=""
        onSave={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(findButton(container, 'Löschen').disabled).toBe(true);
  });

  it('schließt sich bei Escape ohne zu speichern', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();
    render(
      <ColorLegendEditor
        colorId="yellow"
        year={2021}
        initialText=""
        onSave={onSave}
        onClose={onClose}
      />,
    );
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('CalendarLegend', () => {
  it('zeigt benutzte Farben mit Erklärung und meldet Klicks', () => {
    const onEditColor = vi.fn();
    const { container } = render(
      <CalendarLegend
        year={2021}
        selectedShift="C"
        workedShiftCount={42}
        usedColors={['yellow', 'blue']}
        colorTexts={{ yellow: 'Urlaub' }}
        onEditColor={onEditColor}
      />,
    );
    const items = container.querySelectorAll('.legend-colors .color-legend-item');
    expect(items.length).toBe(2);
    expect(container.textContent).toContain('Urlaub');
    // Ohne hinterlegten Text steht der Farbname daneben.
    expect(container.textContent).toContain('Blau');

    act(() => {
      (items[1] as HTMLButtonElement).click();
    });
    expect(onEditColor).toHaveBeenCalledWith('blue');
  });

  it('zeigt ohne benutzte Farben keine Farbzeile', () => {
    const { container } = render(
      <CalendarLegend year={2021} selectedShift="C" workedShiftCount={42} />,
    );
    expect(container.querySelector('.legend-colors')).toBeNull();
  });

  it('stellt die Farblegende vor die Erklärungen der Buchstaben und Kennzahlen', () => {
    // Anforderung: In der Legende stehen die Farbzeilen oben, darunter erst
    // die Erläuterungen zu T, N, Werktage, Sollschichten und F.
    const { container } = render(
      <CalendarLegend
        year={2021}
        selectedShift="C"
        workedShiftCount={42}
        usedColors={['yellow', 'green', 'blue']}
        colorTexts={{}}
      />,
    );
    const legend = container.querySelector('.legend') as HTMLElement;
    const children = Array.from(legend.children);

    // Erste Zeile bleibt die Gesamtzahl der Arbeitsschichten.
    expect(children[0].classList.contains('legend-total')).toBe(true);
    // Direkt darunter steht die Farblegende.
    expect(children[1].classList.contains('legend-colors')).toBe(true);
    // Erst danach kommen die Buchstaben- und Kennzahlenerklärungen.
    const afterLegend = children.slice(2).map((child) => child.textContent ?? '');
    expect(afterLegend).toEqual([
      'T = Tagschicht von 6 bis 18 Uhr',
      'N = Nachtschicht von 18 bis 6 Uhr',
      'Werktage = Anzahl Montag bis Freitag',
      'Sollschichten = Anzahl T + N',
      'F = Gesetzlicher Feiertag',
    ]);
  });
});
