/**
 * Strukturverifikation der Druckansicht per DOM-Rendering.
 *
 * Abgesichert werden die harten Druckanforderungen der Spezifikation:
 * - genau zwei Seiten,
 * - je Seite genau sechs Monate,
 * - Monate ausschließlich nebeneinander (niemals untereinander),
 * - jeder Monat mit exakt 31 Rasterzeilen.
 */

/* @vitest-environment jsdom */

import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import type { AnnotationMap } from '../domain/types';
import { buildYearCalendar } from '../engines/calendarBuilder';
import { PrintCalendar } from '../print/PrintCalendar';
import { PRINT_ROWS } from '../print/PrintMonth';

function render(element: React.ReactElement): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<StrictMode>{element}</StrictMode>);
  });
  return container;
}

describe('PrintCalendar', () => {
  const calendar = buildYearCalendar({ year: 2021, selectedShift: 'C' });
  const annotations: AnnotationMap = {
    '2021-03-15': { dateKey: '2021-03-15', label: 'Urlaub', colorId: 'yellow' },
  };

  it('rendert genau zwei Seiten', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(container.querySelectorAll('.print-page').length).toBe(2);
  });

  it('zeigt je Seite genau sechs Monate nebeneinander', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const halves = container.querySelectorAll('.print-half-year');
    expect(halves.length).toBe(2);
    halves.forEach((half) => {
      expect(half.querySelectorAll('.print-month').length).toBe(6);
    });
  });

  it('verteilt die Monate in der korrekten Reihenfolge auf beide Seiten', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const halves = Array.from(container.querySelectorAll('.print-half-year'));
    const firstSideMonths = Array.from(halves[0].querySelectorAll('.print-month-name')).map(
      (element) => element.textContent,
    );
    const secondSideMonths = Array.from(halves[1].querySelectorAll('.print-month-name')).map(
      (element) => element.textContent,
    );
    expect(firstSideMonths).toEqual([
      'JANUAR',
      'FEBRUAR',
      'MÄRZ',
      'APRIL',
      'MAI',
      'JUNI',
    ]);
    expect(secondSideMonths).toEqual([
      'JULI',
      'AUGUST',
      'SEPTEMBER',
      'OKTOBER',
      'NOVEMBER',
      'DEZEMBER',
    ]);
  });

  it('gibt jedem Monat exakt 31 Rasterzeilen', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const months = container.querySelectorAll('.print-month');
    expect(months.length).toBe(12);
    months.forEach((month) => {
      expect(month.querySelectorAll('.print-month-body > .print-row').length).toBe(PRINT_ROWS);
    });
  });

  it('übernimmt Termine und persönliche Beschriftungen unverändert', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const annotatedRow = container.querySelector('[data-date-key="2021-03-15"]');
    expect(annotatedRow).not.toBeNull();
    expect(annotatedRow?.textContent).toContain('Urlaub');
    // jsdom normalisiert Hexwerte zu rgb(); #FFF2A8 entspricht rgb(255, 242, 168).
    expect(annotatedRow?.getAttribute('style')).toContain('rgb(255, 242, 168)');

    const neujahrRow = container.querySelector('[data-date-key="2021-01-01"]');
    // "F!" steht ausschließlich als rosa Kästchen in der KW-Spalte; die
    // Textspalte nennt den Feiertag ausgeschrieben.
    expect(
      neujahrRow?.querySelector('.print-col-info .print-holiday-mark'),
    ).toBeNull();
    expect(neujahrRow?.querySelector('.print-col-info')?.textContent).toBe('Neujahr');
    expect(neujahrRow?.querySelector('.print-col-kw .print-holiday-mark')?.textContent).toBe('F!');
    expect(
      neujahrRow?.querySelector('.print-col-kw .print-holiday-mark')?.getAttribute('title'),
    ).toBe('Gesetzlicher Feiertag');
    expect(neujahrRow?.querySelector('.print-holiday-note')).toBeNull();
  });

  it('überschreibt die Fachdaten nicht: Schichtkennung stammt aus dem Kalender', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    // 04.01.2021 ist laut verifizierter Referenz eine Tagschicht in System C.
    const dayRow = container.querySelector('[data-date-key="2021-01-04"]');
    expect(dayRow?.textContent).toContain('T');
    expect(dayRow?.textContent).not.toContain('N');
  });

  it('zeigt bei einem Kommentar nur den Kommentar und behält das "F!"-Kästchen', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={{ '2021-01-01': { dateKey: '2021-01-01', label: 'Frühschicht', colorId: 'yellow' } }}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const neujahrRow = container.querySelector('[data-date-key="2021-01-01"]');
    // Der Kommentar verdrängt Termin- und Feiertagsnamen vollständig.
    expect(neujahrRow?.querySelector('.print-col-info')?.textContent).toBe('Frühschicht');
    expect(neujahrRow?.querySelector('.print-col-info .print-holiday-mark')).toBeNull();
    // Der Feiertag bleibt über das rosa Kästchen in der KW-Spalte sichtbar.
    expect(neujahrRow?.querySelector('.print-col-kw .print-holiday-mark')?.textContent).toBe('F!');
  });

  it('zeigt die KW ausschließlich am Montag', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    // 04.01.2021 ist der erste Montag des Jahres 2021 (KW 1).
    const monday = container.querySelector('[data-date-key="2021-01-04"] .print-col-kw');
    expect(monday?.querySelector('.print-week')?.textContent).toBe('1');

    // Der Dienstag derselben Woche trägt keinen KW-Wert.
    const tuesday = container.querySelector('[data-date-key="2021-01-05"] .print-col-kw');
    expect(tuesday?.querySelector('.print-week')).toBeNull();
  });

  it('setzt das rosa "F!"-Kästchen bei gesetzlichen Feiertagen in die KW-Spalte', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    // Neujahr 2021 (Freitag).
    const newYear = container.querySelector('[data-date-key="2021-01-01"] .print-col-kw');
    expect(newYear?.querySelector('.print-holiday-mark')?.textContent).toBe('F!');

    // Ostermontag 2021 (Montag): KW-Wert und Feiertagsmarkierung zugleich.
    const easterMonday = container.querySelector('[data-date-key="2021-04-05"] .print-col-kw');
    expect(easterMonday?.querySelector('.print-week')?.textContent).toBe('14');
    expect(easterMonday?.querySelector('.print-holiday-mark')?.textContent).toBe('F!');
  });

  it('markiert Brauchtumstage nicht mit "F!"', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    // Reformationstag (31.10.) und Heiligabend (24.12.) sind keine
    // gesetzlichen Feiertage.
    expect(
      container.querySelector('[data-date-key="2021-10-31"] .print-holiday-mark'),
    ).toBeNull();
    expect(
      container.querySelector('[data-date-key="2021-12-24"] .print-holiday-mark'),
    ).toBeNull();
    // An einem reinen Feiertag steht in der Textspalte der ausgeschriebene
    // Name; "F!" erscheint ausschließlich in der KW-Spalte.
    expect(
      container.querySelector('[data-date-key="2021-01-01"] .print-col-info')?.textContent,
    ).toBe('Neujahr');
    expect(
      container.querySelector('[data-date-key="2021-01-01"] .print-col-info')?.textContent,
    ).not.toContain('F!');
  });

  it('markiert Feiertage anderer Bundesländer in Rheinland-Pfalz nicht', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    // Heilige Drei Könige (06.01.) und Mariä Himmelfahrt (15.08.) sind in
    // Rheinland-Pfalz keine gesetzlichen Feiertage.
    expect(
      container.querySelector('[data-date-key="2021-01-06"] .print-holiday-mark'),
    ).toBeNull();
    expect(
      container.querySelector('[data-date-key="2021-08-15"] .print-holiday-mark'),
    ).toBeNull();
  });

  it('nennt einen Feiertag genau einmal und verwendet keinen Kurztext', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    // 03.10.2021: Die Textspalte nennt Feiertag und Erntedank; die KW-Spalte
    // enthält nur das rosa "F!"-Kästchen.
    const unity = container.querySelector('[data-date-key="2021-10-03"]');
    expect(unity?.querySelector('.print-col-info .print-holiday-mark')).toBeNull();
    expect(unity?.querySelector('.print-col-info')?.textContent).toBe(
      'Tag der Deutschen Einheit · Erntedank',
    );
    expect(unity?.querySelector('.print-col-kw .print-holiday-mark')?.textContent).toBe('F!');
    expect(unity?.querySelector('.print-col-info')?.textContent).not.toContain('F!');
  });

  it('nennt den Kalender im Seitenheader "BASF Schichtkalender"', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const headers = container.querySelectorAll('.print-header-title');
    expect(headers.length).toBe(2);
    headers.forEach((header) => {
      expect(header.textContent).toBe('BASF Schichtkalender');
    });
  });
});
