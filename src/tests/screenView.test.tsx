/**
 * Strukturverifikation der Bildschirmdarstellung und der Anzeige-Einstellung.
 *
 * Abgesichert werden die Anforderungen, die nur die Oberfläche betreffen:
 * - keine Spaltenkopfzeile ueber den Tageszeilen,
 * - rosa "F!"-Kästchen bei gesetzlichen Feiertagen in der KW-Spalte,
 * - "F!" als einzige Nennung des Feiertags; ein Kommentar in der Zeile
 *   verdrängt Termin- und Feiertagsnamen vollständig,
 * - Titel "BASF Schichtkalender" und funktionierender Hell/Dunkel-Umschalter,
 * - Unabhängigkeit der Anzeige-Einstellung von den Fachdaten.
 */

/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from '../components/App';
import {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  applyTheme,
  readThemePreference,
  resolveTheme,
} from '../services/themeStore';

/**
 * Startjahr der Anwendung: das aktuelle Jahr. Die Feiertagspr�fungen pr�fen
 * gezielt Maifeiertag (01.05.) und Neujahr (01.01.), weil beide Termine
 * unabh�ngig vom Wochentag immer gesetzliche Feiertage sind.
 */
const startYear = new Date().getFullYear();

function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<StrictMode>{element}</StrictMode>);
  });
  return container;
}

function click(element: Element | null): void {
  if (!element) throw new Error('Element nicht gefunden.');
  act(() => {
    (element as HTMLElement).click();
  });
}

describe('Bildschirmdarstellung', () => {
  it('nennt die Anwendung "BASF Schichtkalender"', () => {
    const container = render(<App />);
    expect(container.querySelector('.app-title')?.textContent).toBe('BASF Schichtkalender');
  });

  it('zeigt keine Spaltenkopfzeile über den Tageszeilen', () => {
    const container = render(<App />);
    expect(container.querySelector('.day-table-head')).toBeNull();
    expect(container.querySelectorAll('[role="columnheader"]').length).toBe(0);
  });

  it('startet die Jahresauswahl beim aktuellen Jahr', () => {
    const container = render(<App />);
    const select = container.querySelector('.year-select') as HTMLSelectElement | null;
    expect(select?.value).toBe(String(startYear));
    const selectedOption = Array.from(select?.options ?? []).find(
      (option) => option.value === String(startYear),
    );
    expect(selectedOption?.textContent).toBe(String(startYear));
  });

  it('markiert gesetzliche Feiertage mit "F!" und Brauchtumstage nicht', () => {
    const container = render(<App />);
    // Der Maifeiertag (01.05.) ist immer ein gesetzlicher Feiertag, und der
    // 01.01. ist immer Neujahr; beide werden gezielt gepr�ft.
    const rows = Array.from(container.querySelectorAll('.day-row'));
    expect(rows.length).toBeGreaterThan(0);

    const label = (row: Element) => row.getAttribute('aria-label') ?? '';
    const maiRow = rows.find((row) => label(row).includes('Maifeiertag'));
    expect(maiRow).toBeDefined();
    expect(maiRow?.querySelector('.cell-kw .holiday-mark')?.textContent).toBe('F!');
    expect(label(maiRow!)).toContain('Gesetzlicher Feiertag');
    // Der Feiertagsname steht ausgeschrieben im Informationstext; "F!" gibt es
    // ausschließlich in der KW-Spalte.
    expect(label(maiRow!)).toContain('Maifeiertag');
    expect(maiRow?.querySelector('.cell-information')?.textContent).toBe('Maifeiertag');
    expect(maiRow?.querySelector('.cell-information .holiday-mark')).toBeNull();

    const newYearRow = rows.find((row) => label(row).includes('Neujahr'));
    expect(newYearRow?.querySelector('.cell-kw .holiday-mark')?.textContent).toBe('F!');
    expect(label(newYearRow!)).toContain('Gesetzlicher Feiertag');
    expect(newYearRow?.querySelector('.cell-information')?.textContent).toBe('Neujahr');

    const december = Array.from(container.querySelectorAll('.month-card')).find(
      (card) => card.getAttribute('aria-label') === `Dezember ${startYear}`,
    );
    expect(december).toBeDefined();
    const decemberRows = Array.from(december!.querySelectorAll('.day-row'));
    const eveRow = decemberRows.find((row) => label(row).includes('Heiligabend'));
    expect(eveRow).toBeDefined();
    expect(eveRow?.querySelector('.holiday-mark')).toBeNull();
    expect(label(eveRow!)).toContain('Heiligabend');
  });

  it('nennt einen gesetzlichen Feiertag ausgeschrieben und markiert ihn mit "F!"', () => {
    const container = render(<App />);
    const rows = Array.from(container.querySelectorAll('.day-row'));
    const maiRow = rows.find((row) =>
      (row.getAttribute('aria-label') ?? '').includes('Maifeiertag'),
    );
    expect(maiRow).toBeDefined();

    // Der Feiertag steht ausgeschrieben im Informationstext; das rosa
    // "F!"-Kästchen sitzt ausschließlich in der KW-Spalte.
    expect(maiRow!.querySelector('.cell-information')?.textContent).toBe('Maifeiertag');
    expect(maiRow!.querySelector('.cell-information .holiday-mark')).toBeNull();
    expect(maiRow!.querySelector('.cell-information')?.textContent).not.toContain('F!');
    expect(maiRow!.querySelector('.cell-kw .holiday-mark')?.textContent).toBe('F!');
    expect(maiRow!.querySelector('.cell-badge')).toBeNull();
    expect(maiRow!.querySelector('.cell-kw')?.textContent).not.toContain('Maifeiertag');
    expect(maiRow!.querySelector('.cell-kw')?.textContent).not.toContain('Dt. Einheit');
  });

  it('blendet den Feiertagsnamen aus, sobald ein Kommentar in der Zeile steht', () => {
    // Der Maifeiertag ist immer ein gesetzlicher Feiertag; hier wird er mit
    // einem Kommentar belegt. Der Kommentar wird über denselben
    // Speicherzustand gesetzt, den die Anwendung beim Start liest.
    const year = 2021;
    window.localStorage.setItem(
      'schichtkalender.state',
      JSON.stringify({
        version: 1,
        settings: { selectedYear: year, selectedShift: 'C' },
        annotations: {
          '2021-05-01': { dateKey: '2021-05-01', label: 'Bereitschaft', colorId: null },
        },
      }),
    );

    try {
      const container = render(<App />);
      const mayCard = Array.from(container.querySelectorAll('.month-card')).find(
        (card) => card.getAttribute('aria-label') === `Mai ${year}`,
      );
      expect(mayCard).toBeDefined();
      const row = Array.from(mayCard!.querySelectorAll('.day-row')).find((candidate) =>
        (candidate.getAttribute('aria-label') ?? '').startsWith('Sa 1.'),
      );
      expect(row).toBeDefined();

      // Nur der Kommentar steht in der Zeile: Termin- und Feiertagsname sind
      // ausgeblendet. Auch der Informationstext enthält kein "F!" - der
      // Feiertag bleibt ausschließlich über das rosa Kästchen in der
      // KW-Spalte erkennbar.
      expect(row!.querySelector('.cell-information')?.textContent).toBe('Bereitschaft');
      expect(row!.querySelector('.cell-information .holiday-mark')).toBeNull();
      expect(row!.querySelector('.cell-information')?.textContent).not.toContain('F!');
      expect(row!.querySelector('.cell-information')?.textContent).not.toContain('Maifeiertag');
      // Der Feiertag bleibt über das rosa Kästchen in der KW-Spalte sichtbar.
      expect(row!.querySelector('.cell-kw .holiday-mark')?.textContent).toBe('F!');
    } finally {
      window.localStorage.removeItem('schichtkalender.state');
    }
  });

  it('lädt gespeicherte Kommentare über den Standard-Speicher und schreibt sie zurück', () => {
    // Regression: der AnnotationStore darf ohne ausdrücklich übergebenen
    // Speicher den Standard-Speicher (localStorage) verwenden. Andernfalls
    // blieben gespeicherte Kommentare beim Start unsichtbar.
    const year = 2021;
    const storedAnnotations = {
      '2021-05-01': { dateKey: '2021-05-01', label: 'Bereitschaft', colorId: 'yellow' },
    };
    window.localStorage.setItem(
      'schichtkalender.state',
      JSON.stringify({
        version: 1,
        settings: { selectedYear: year, selectedShift: 'C' },
        annotations: storedAnnotations,
      }),
    );

    try {
      const container = render(<App />);
      const rows = Array.from(container.querySelectorAll('.day-row'));
      const annotated = rows.find(
        (candidate) => candidate.querySelector('.cell-information')?.textContent === 'Bereitschaft',
      );
      expect(annotated).toBeDefined();

      // Der persistierte Zustand bleibt vollständig erhalten (Rundreise).
      const persisted = JSON.parse(window.localStorage.getItem('schichtkalender.state') ?? '{}');
      expect(persisted.annotations).toEqual(storedAnnotations);
      expect(persisted.settings).toEqual({ selectedYear: year, selectedShift: 'C' });
    } finally {
      window.localStorage.removeItem('schichtkalender.state');
    }
  });

  it('markiert Feiertage anderer Bundesländer in Rheinland-Pfalz nicht', () => {
    const container = render(<App />);
    const rows = Array.from(container.querySelectorAll('.day-row'));
    const label = (row: Element) => row.getAttribute('aria-label') ?? '';

    // Heilige Drei Könige (06.01.) und Mariä Himmelfahrt (15.08.) sind in
    // Rheinland-Pfalz keine gesetzlichen Feiertage.
    for (const name of ['Heilige Drei Könige', 'Mariä Himmelfahrt']) {
      const row = rows.find((candidate) => label(candidate).includes(name));
      expect(row).toBeDefined();
      expect(row?.querySelector('.holiday-mark')).toBeNull();
    }
  });

  it('weist in der Fußzeile ausschließlich die Schichtzahlen aus', () => {
    // Anforderung: Die Anzeige der bezahlten Feiertage ist aus der Fußzeile
    // entfernt. Sichtbar bleiben nur die Schichtzahlen (T und N); die
    // Berechnung der vollen und halben Feiertage bleibt im Modell erhalten
    // (siehe calendarBuilder.test.ts) und wird hier nicht mehr dargestellt.
    const container = render(<App />);
    const footers = Array.from(container.querySelectorAll('.month-footer'));
    expect(footers.length).toBe(12);

    for (const footer of footers) {
      const text = footer.textContent ?? '';
      expect(text).toMatch(/\d+ × T/);
      expect(text).toMatch(/\d+ × N/);
      expect(text).not.toContain('Feiertage mit Schicht');
      expect(text).not.toContain('halbe Feiertage');
      expect(text).not.toContain('bezahlt gesamt');
      expect(text).not.toContain('Nachtschicht');
    }
  });

  it('zeigt die bezahlten Feiertage nicht mehr in der Monatskarte an', () => {
    // Schicht C im Dezember 2021: Der 31.12. (N) reicht in das Neujahr 2022
    // hinein und erzeugt einen halben Feiertag. Die Berechnung bleibt
    // bestehen, die Fußzeile nennt den Wert jedoch nicht mehr.
    window.localStorage.setItem(
      'schichtkalender.state',
      JSON.stringify({
        version: 1,
        settings: { selectedYear: 2021, selectedShift: 'C' },
        annotations: {},
      }),
    );

    try {
      const container = render(<App />);
      const card = (name: string) =>
        Array.from(container.querySelectorAll('.month-card')).find(
          (candidate) => candidate.getAttribute('aria-label') === name,
        );

      const december = card('Dezember 2021');
      expect(december).toBeDefined();
      const footer = december!.querySelector('.month-footer')?.textContent ?? '';
      expect(footer).not.toContain('halbe Feiertage');
      expect(footer).not.toContain('bezahlt gesamt');
      expect(footer).not.toContain('Feiertage mit Schicht');
    } finally {
      window.localStorage.removeItem('schichtkalender.state');
    }
  });

  it('führt einen Feiertag ohne Schicht nicht als vollen Feiertag auf', () => {
    // Schicht C im Januar 2021: Der 06.01. (Mi) ist eine Tagschicht und
    // damit der eine Feiertag mit Schicht. Heilige Drei Könige ist in
    // Rheinland-Pfalz jedoch nicht bezahlt und zählt nicht mit. Geprüft
    // wird das an der Kennzahl im Modell, da die Fußzeile die bezahlten
    // Feiertage nicht mehr anzeigt.
    window.localStorage.setItem(
      'schichtkalender.state',
      JSON.stringify({
        version: 1,
        settings: { selectedYear: 2021, selectedShift: 'C' },
        annotations: {},
      }),
    );

    try {
      const container = render(<App />);
      const card = (name: string) =>
        Array.from(container.querySelectorAll('.month-card')).find(
          (candidate) => candidate.getAttribute('aria-label') === name,
        );

      const january = card('Januar 2021');
      expect(january).toBeDefined();
      expect(january!.querySelector('.month-footer')?.textContent).not.toContain(
        'Feiertage mit Schicht',
      );

      // Schicht C: Der 01.01.2021 (Fr) ist eine Nachtschicht und fällt
      // damit selbst unter die Regel.
      const newYearRow = Array.from(january!.querySelectorAll('.day-row')).find((row) =>
        (row.getAttribute('aria-label') ?? '').includes('Neujahr'),
      );
      expect(newYearRow?.querySelector('.cell-shift')?.textContent).toBe('N');
    } finally {
      window.localStorage.removeItem('schichtkalender.state');
    }
  });

  it('schaltet die Anzeige zwischen Hell und Dunkel um', () => {
    const container = render(<App />);
    const buttons = Array.from(container.querySelectorAll('.theme-button'));
    expect(buttons.length).toBe(3);

    const darkButton = buttons.find((button) => button.textContent?.includes('Dunkel'));
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    click(darkButton ?? null);
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    const lightButton = buttons.find((button) => button.textContent?.includes('Hell'));
    click(lightButton ?? null);
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });
});

describe('ThemeStore', () => {
  it('fällt bei unbekannten oder fehlenden Werten auf "system" zurück', () => {
    expect(readThemePreference(null, '')).toBe('system');
    expect(
      readThemePreference({ getItem: () => 'neon', setItem: () => undefined }, ''),
    ).toBe('system');
    expect(readThemePreference({ getItem: () => null, setItem: () => undefined }, '')).toBe(
      'system',
    );
  });

  it('liest eine gespeicherte Einstellung', () => {
    const storage = { getItem: () => 'dark', setItem: () => undefined };
    expect(readThemePreference(storage, '')).toBe('dark');
  });

  it('lässt einen Anzeigewert aus der Adresse Vorrang haben', () => {
    const storage = { getItem: () => 'dark', setItem: () => undefined };
    expect(readThemePreference(storage, '?theme=light')).toBe('light');
    expect(readThemePreference(storage, '?foo=1&theme=light')).toBe('light');
    expect(readThemePreference(storage, '?theme=dark')).toBe('dark');
    // Unbekannte oder unvollständige Werte werden ignoriert.
    expect(readThemePreference(storage, '?theme=neon')).toBe('dark');
    expect(readThemePreference(storage, '?themes=light')).toBe('dark');
  });

  it('löst die Einstellung "system" gegen die Systemeinstellung auf', () => {
    expect(resolveTheme('system', 'dark')).toBe('dark');
    expect(resolveTheme('system', 'light')).toBe('light');
    expect(resolveTheme('dark', 'light')).toBe('dark');
    expect(resolveTheme('light', 'dark')).toBe('light');
  });

  it('setzt das Theme-Attribut am Wurzelelement', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
  });
});
