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
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import type { AnnotationMap } from '../domain/types.ts';
import { buildYearCalendar, summarizeYear } from '../engines/calendarBuilder.ts';
import { PrintCalendar } from '../print/PrintCalendar.tsx';
import { PrintMonth, PRINT_ROWS } from '../print/PrintMonth.tsx';

/**
 * Liest die Druckstildatei, um CSS-Regeln prüfen zu können (jsdom berechnet
 * kein Rasterlayout). Der Pfad wird gegen das Arbeitsverzeichnis gebildet.
 */
function readPrintStylesheet(): string {
  return readFileSync(resolve(process.cwd(), 'src/print/print.css'), 'utf8');
}


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
    '2021-03-15': { dateKey: '2021-03-15', label: 'Urlaub', colors: { info: 'yellow' } },
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
    // Die persönliche Farbe liegt auf dem Tageseditor-Textblock (nicht auf der
    // ganzen Info-Spalte), damit sie nicht auf Jahrestage übergeht. jsdom
    // normalisiert Hexwerte zu rgb(); #FFE000 (sattes Gelb) wird rgb(255, 224, 0).
    const infoCell = annotatedRow?.querySelector('.print-col-info-text');
    expect(infoCell?.getAttribute('style')).toContain('rgb(255, 224, 0)');

    const neujahrRow = container.querySelector('[data-date-key="2021-01-01"]');
    // "F" steht ausschließlich als rosa Kästchen in der KW-Spalte; die
    // Textspalte nennt den Feiertag ausgeschrieben.
    expect(
      neujahrRow?.querySelector('.print-col-info .print-holiday-mark'),
    ).toBeNull();
    expect(neujahrRow?.querySelector('.print-col-info')?.textContent).toBe('Neujahr');
    expect(neujahrRow?.querySelector('.print-col-kw .print-holiday-mark')?.textContent).toBe('F');
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

  it('zeigt bei einem Kommentar nur den Kommentar und behält das "F"-Kästchen', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={{ '2021-01-01': { dateKey: '2021-01-01', label: 'Frühschicht', colors: { info: 'yellow' } } }}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const neujahrRow = container.querySelector('[data-date-key="2021-01-01"]');
    // Der Kommentar verdrängt Termin- und Feiertagsnamen vollständig.
    expect(neujahrRow?.querySelector('.print-col-info')?.textContent).toBe('Frühschicht');
    expect(neujahrRow?.querySelector('.print-col-info .print-holiday-mark')).toBeNull();
    // Der Feiertag bleibt über das rosa Kästchen in der KW-Spalte sichtbar.
    expect(neujahrRow?.querySelector('.print-col-kw .print-holiday-mark')?.textContent).toBe('F');
  });

  it('behält die harten Zeilenumbrüche einer mehrzeiligen Beschriftung', () => {
    // Regression: Die drei im DayEditor eingegebenen Zeilen müssen in der
    // Druckzelle als eigene Zeilen erhalten bleiben (und dürfen nicht zu
    // Leerzeichen zusammengezogen werden). Der Textinhalt trägt die
    // echten Umbrüche (\n), die Anzeige erfolgt über `white-space: pre-line`.
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={{
          '2021-03-15': { dateKey: '2021-03-15', label: 'Urlaub\nArzt\nSchulung', colors: {} },
        }}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const info = container.querySelector('[data-date-key="2021-03-15"] .print-col-info');
    expect(info?.textContent).toBe('Urlaub\nArzt\nSchulung');
    expect(info?.textContent).not.toContain('|');
    // Drei Zeilen -> kleinste Schriftstufe.
    expect(info?.classList.contains('label-lines-3')).toBe(true);
  });

  it('stellt Geburtstage im Druck ganz oben und färbt nur den Tageseditor-Eintrag', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={{
          '2021-03-15': { dateKey: '2021-03-15', label: 'Frühschicht', colors: { info: 'yellow' } },
        }}
        anniversaries={{
          '03-15': [{ id: 'b1', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 }],
        }}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const info = container.querySelector('[data-date-key="2021-03-15"] .print-col-info') as HTMLElement;
    // Beschriftung (1 Zeile) + Geburtstag (1 Zeile) → zwei Zeilen.
    expect(info.classList.contains('label-lines-2')).toBe(true);
    // Jahrestage stehen ganz oben, der Tageseditor-Eintrag darunter.
    const children = Array.from(info.children) as HTMLElement[];
    expect(children[0].classList.contains('print-col-anniversaries')).toBe(true);
    expect(children[1].classList.contains('print-col-info-text')).toBe(true);
    // Nur der Tageseditor-Eintrag ist eingefärbt; die Jahrestage nicht.
    const infoText = info.querySelector('.print-col-info-text') as HTMLElement;
    expect(infoText.getAttribute('style')).toContain('rgb(255, 224, 0)');
    const anniversaries = info.querySelector('.print-col-anniversaries') as HTMLElement;
    expect(anniversaries.getAttribute('style')).toBeNull();
    expect(info.getAttribute('style')).toBeNull();
  });

  it('deckelt die Schrift reiner Terminnamen über eine label-lines-Klasse', () => {
    // Ohne persönliche Beschriftung trug die Info-Zelle zuvor keine
    // label-lines-Klasse und erbte die ungedeckelte Standardgröße. Jetzt wird
    // die Schrift auch für reine Termine geprüft und gedeckelt: kurze Namen
    // höchstens mittelgroß, lange Namen in der kleinsten Stufe.
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={{}}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );

    // 01.01.2021 = Neujahr (kurz) -> höchstens mittelgroß.
    const neujahr = container.querySelector(
      '[data-date-key="2021-01-01"] .print-col-info',
    ) as HTMLElement;
    expect(neujahr.textContent).toBe('Neujahr');
    expect(neujahr.classList.contains('label-lines-2')).toBe(true);
    expect(neujahr.classList.contains('label-lines-1')).toBe(false);

    // 03.10.2021 = Tag der Deutschen Einheit (lang) -> kleinste Stufe.
    const einheit = container.querySelector(
      '[data-date-key="2021-10-03"] .print-col-info',
    ) as HTMLElement;
    expect(einheit.textContent).toContain('Tag der Deutschen Einheit');
    expect(einheit.classList.contains('label-lines-3')).toBe(true);
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

  it('setzt das rosa "F"-Kästchen bei gesetzlichen Feiertagen in die KW-Spalte', () => {
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
    expect(newYear?.querySelector('.print-holiday-mark')?.textContent).toBe('F');

    // Ostermontag 2021 (Montag): KW-Wert und Feiertagsmarkierung zugleich.
    const easterMonday = container.querySelector('[data-date-key="2021-04-05"] .print-col-kw');
    expect(easterMonday?.querySelector('.print-week')?.textContent).toBe('14');
    expect(easterMonday?.querySelector('.print-holiday-mark')?.textContent).toBe('F');
  });

  it('markiert Brauchtumstage nicht mit "F"', () => {
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
    // Name; "F" erscheint ausschließlich in der KW-Spalte.
    expect(
      container.querySelector('[data-date-key="2021-01-01"] .print-col-info')?.textContent,
    ).toBe('Neujahr');
    expect(
      container.querySelector('[data-date-key="2021-01-01"] .print-col-info')?.textContent,
    ).not.toContain('F');
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
    // enthält nur das rosa "F"-Kästchen.
    const unity = container.querySelector('[data-date-key="2021-10-03"]');
    expect(unity?.querySelector('.print-col-info .print-holiday-mark')).toBeNull();
    expect(unity?.querySelector('.print-col-info')?.textContent).toBe(
      'Tag der Deutschen Einheit · Erntedank',
    );
    expect(unity?.querySelector('.print-col-kw .print-holiday-mark')?.textContent).toBe('F');
    expect(unity?.querySelector('.print-col-info')?.textContent).not.toContain('F');
  });

  it('schreibt im Monatskopf "Werktage" und "Sollschichten" aus', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    // Der Monatskopf nennt die Kennzahlen ausgeschrieben statt nur als Zahl:
    // links die Werktage, rechts die Sollschichten.
    const january = container.querySelector('.print-month[data-month="1"]');
    expect(january).not.toBeNull();
    const stats = Array.from(january?.querySelectorAll('.print-month-stat') ?? []).map(
      (node) => node.textContent,
    );
    const januaryStats = calendar.months[0].statistics;
    expect(stats).toEqual([
      `${januaryStats.weekdayCount} Werktage`,
      `${januaryStats.requiredShiftCount} Sollschichten`,
    ]);
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

  it('nennt oben in der Print-Legende die Arbeitsschichten gesamt im Jahr', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const expected = summarizeYear(calendar).requiredShiftCount;
    const totals = container.querySelectorAll('.print-header-total');
    // Beide Seiten tragen dieselbe erste Legendenzeile.
    expect(totals.length).toBe(2);
    totals.forEach((total) => {
      expect(total.textContent).toBe(
        `Arbeitsschichten gesamt im Jahr 2021 für Schicht C: ${expected}`,
      );
      // Die Zeile steht ganz oben in der Legende.
      expect((total.parentElement as HTMLElement).firstElementChild).toBe(total);
    });
  });

  it('zeigt die benutzte Farblegende read-only im Seitenkopf', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        colorLegend={{ yellow: 'Urlaub' }}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const boxes = container.querySelectorAll('.print-header-colors');
    // Beide Seiten tragen die Farblegende des Jahres.
    expect(boxes.length).toBe(2);
    boxes.forEach((box) => {
      expect(box.textContent).toContain('Urlaub');
      // In der Druckansicht gibt es keine Schaltflächen.
      expect(box.querySelectorAll('button').length).toBe(0);
    });
  });

  it('lässt die Farblegende im Kopf weg, wenn keine Farbe benutzt wird', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={{}}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(container.querySelectorAll('.print-header-colors').length).toBe(0);
  });

  it('führt in der Kopflegende nur noch die Gesamtzeile der Arbeitsschichten', () => {
    // Anforderung: Die Legendenzeile des Kopfes nennt ausschließlich die
    // Gesamtzahl der gearbeiteten Schichten des Jahres.
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        colorLegend={{ yellow: 'Urlaub' }}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const legend = container.querySelector('.print-header-legend') as HTMLElement;
    const children = Array.from(legend.children);

    expect(children.length).toBe(1);
    expect(children[0].classList.contains('print-header-total')).toBe(true);
  });

  it('setzt die Legenden links als Spalten übereinander', () => {
    // Anforderung: Am linken Rand stehen T, N, Werktage und Sollschichten
    // übereinander; daneben bilden F, Geburtstag und wiederkehrendes Ereignis
    // sowie die beschriebenen Farben eigene Spalten.
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        colorLegend={{ yellow: 'Urlaub' }}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const explain = container.querySelector('.print-header-explain') as HTMLElement;
    expect(explain).not.toBeNull();

    const shifts = Array.from(explain.querySelector('.print-header-shifts')!.children).map(
      (element) => element.textContent ?? '',
    );
    expect(shifts).toEqual([
      'T = Tagschicht von 6 bis 18 Uhr',
      'N = Nachtschicht von 18 bis 6 Uhr',
      'Werktage = Anzahl Montag bis Freitag',
      'Sollschichten = Anzahl T + N',
    ]);

    const marks = Array.from(explain.querySelector('.print-header-marks')!.children).map(
      (element) => element.textContent ?? '',
    );
    expect(marks).toEqual([
      'F = Gesetzlicher Feiertag',
      '🎂 = Geburtstag (Alter in Klammern)',
      '🔁 = wiederkehrendes Ereignis',
    ]);

    // Die beschriebenen Farben bilden eine weitere Spalte daneben.
    const colors = explain.querySelector('.print-header-colors') as HTMLElement;
    expect(colors).not.toBeNull();
    expect(colors.textContent).toContain('Urlaub');

    // Die drei Spalten stehen in dieser Reihenfolge nebeneinander.
    expect(explain.querySelector('.print-header-shifts')!.nextElementSibling).toBe(
      explain.querySelector('.print-header-marks'),
    );
    expect(explain.querySelector('.print-header-marks')!.nextElementSibling).toBe(colors);
  });

  it('setzt Titel, Jahr und Schicht rechts untereinander', () => {
    // Anforderung: Titel, Jahr und Schicht stehen übereinander am rechten Rand.
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    const titles = container.querySelector('.print-header-titles') as HTMLElement;
    expect(titles).not.toBeNull();
    const children = Array.from(titles.children).map((element) => element.textContent ?? '');
    expect(children).toEqual(['BASF Schichtkalender', '2021', 'Schicht C']);
  });

  it('führt am Ende der Monatsspalte keine Feiertagskennzahlen mehr auf', () => {
    // Anforderung: Die Anzeige der bezahlten Feiertage (volle, halbe aus der
    // Nachtschicht und Gesamtsumme) ist am Spaltenende entfernt. Die
    // Berechnung bleibt im Modell erhalten (siehe calendarBuilder.test.ts).
    // Stattdessen trägt die finale Zeile je Monat die Schichtzahlen (T/N).
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={annotations}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(container.querySelectorAll('.print-month-footer').length).toBe(12);
    expect(container.textContent).not.toContain('FT mit Schicht');
    expect(container.textContent).not.toContain('halbe FT (Nacht)');
    expect(container.textContent).not.toContain('bezahlt gesamt');
  });

  it('zählt in der Druck-Monatsspalte die markierten T/N-Schichten je Farbe', () => {
    // Anforderung: Auch im Druck erscheint ganz unten im Monat - unter dem
    // 31-Zeilen-Raster - eine finale Zeile mit den Schichtzahlen (T/N) und
    // rechts die farblich markierten Schichten als Kästchen. Gezählt werden
    // nur tatsächlich erfasste T/N; freie Tage bleiben außen vor.
    const march = calendar.months[2]; // März 2021, Schicht C
    const workedDays = march.days.filter((day) => day.shiftLabel !== '');
    const offDays = march.days.filter((day) => day.shiftLabel === '');
    expect(workedDays.length).toBeGreaterThan(1);
    expect(offDays.length).toBeGreaterThan(0);

    const annotationColors: Record<string, { shift?: 'yellow' | 'green' }> = {};
    workedDays.forEach((day, index) => {
      annotationColors[day.dateKey] = { shift: index === 0 ? 'green' : 'yellow' };
    });
    // Ein freier Tag zusätzlich markiert: darf die Summe nicht erhöhen.
    annotationColors[offDays[0].dateKey] = { shift: 'yellow' };

    const container = render(
      <PrintMonth month={march} annotationLabels={{}} annotationColors={annotationColors} />,
    );

    // Die finale Zeile sitzt außerhalb des 31-Zeilen-Rasters.
    const footer = container.querySelector('.print-month-footer');
    expect(footer).not.toBeNull();
    expect(container.querySelector('.print-month-body .print-month-footer')).toBeNull();

    // Dort stehen die Tag- und Nachtschichtzahlen der Monatsstatistik.
    const shiftTexts = Array.from(container.querySelectorAll('.print-footer-shift')).map(
      (node) => node.textContent,
    );
    expect(shiftTexts).toEqual([`${march.statistics.dayShiftCount} × T`, `${march.statistics.nightShiftCount} × N`]);

    const chips = Array.from(container.querySelectorAll('.print-month-chip'));
    // Gelb (Palette zuerst) mit allen bis auf einen Schichttag; Grün mit einem.
    expect(chips.length).toBe(2);
    expect(chips[0].textContent).toBe(String(workedDays.length - 1));
    expect(chips[0].getAttribute('style')).toContain('rgb(255, 224, 0)');
    expect(chips[1].textContent).toBe('1');
    expect(chips[1].getAttribute('style')).toContain('rgb(46, 158, 62)');
  });

  it('behält in der Druckansicht das 31-Zeilen-Raster trotz finaler Zeile bei', () => {
    // Anforderung: Die finale Zeile darf das Layout der Monate nicht verändern.
    // Das Tagesraster muss weiterhin genau PRINT_ROWS Zeilen enthalten.
    const march = calendar.months[2];
    const annotationColors: Record<string, { shift?: 'yellow' }> = {};
    const workedDays = march.days.filter((day) => day.shiftLabel !== '');
    workedDays.forEach((day) => {
      annotationColors[day.dateKey] = { shift: 'yellow' };
    });

    const container = render(
      <PrintMonth month={march} annotationLabels={{}} annotationColors={annotationColors} />,
    );
    expect(container.querySelectorAll('.print-month-body > .print-row').length).toBe(PRINT_ROWS);
  });

  it('zeigt in der Druck-Monatsspalte ohne T/N-Markierung nur die T/N-Zahlen', () => {
    const march = calendar.months[2];
    const container = render(
      <PrintMonth month={march} annotationLabels={{}} annotationColors={{}} />,
    );
    // Die finale Zeile ist immer vorhanden (wie in der App), aber ohne
    // Markierungen fehlen die farbigen Kästchen.
    const footer = container.querySelector('.print-month-footer');
    expect(footer).not.toBeNull();
    expect(footer?.querySelectorAll('.print-month-chip').length).toBe(0);
    const shiftTexts = Array.from(container.querySelectorAll('.print-footer-shift')).map(
      (node) => node.textContent,
    );
    expect(shiftTexts).toEqual([`${march.statistics.dayShiftCount} × T`, `${march.statistics.nightShiftCount} × N`]);
  });
});

describe('Anzeige-Option "Wochentag über Datum" (Druck)', () => {
  const calendar = buildYearCalendar({ year: 2021, selectedShift: 'C' });

  it('lässt im Standard Wochentag und Datum in getrennten Spalten', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={{}}
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    expect(container.querySelector('.print-row-weekday-over-date')).toBeNull();
    const row = container.querySelector('[data-date-key="2021-01-04"]');
    // Eigene Datumsspalte mit zweistelliger Tagesnummer.
    expect(row?.querySelector('.print-col-datum')?.textContent).toBe('04');
    expect(row?.querySelector('.print-col-wo')?.textContent).toBe('Mo');
  });

  it('schreibt im Druck das Datum unter den Wochentag und entfernt die Datumsspalte', () => {
    const container = render(
      <PrintCalendar
        calendar={calendar}
        annotations={{}}
        weekdayOverDate
        onPrint={() => undefined}
        onBack={() => undefined}
      />,
    );
    // Jede Tageszeile trägt die Rasterklasse der Option ...
    expect(container.querySelectorAll('.print-row-weekday-over-date').length).toBeGreaterThan(0);
    // ... und alle Rasterzeilen enthalten kein eigenes Datumsfeld mehr.
    expect(container.querySelectorAll('.print-month-body .print-col-datum').length).toBe(0);

    const row = container.querySelector('[data-date-key="2021-01-04"]');
    const weekdayCell = row?.querySelector('.print-col-wo');
    // Wochentag oben, Datum darunter - in derselben Zelle.
    expect(weekdayCell?.querySelector('.print-col-weekday-name')?.textContent).toBe('Mo');
    expect(weekdayCell?.querySelector('.print-col-weekday-date')?.textContent).toBe('04');
    expect(weekdayCell?.classList.contains('print-col-date-stack')).toBe(true);
  });

  it('fasst in der leeren Auffüllzeile keine Datumsspalte mehr auf', () => {
    // Der Februar 2021 hat 28 Tage und wird auf 31 Positionen aufgefüllt.
    const march = buildYearCalendar({ year: 2021, selectedShift: 'C' }).months[1];
    const container = render(
      <PrintMonth month={march} annotationLabels={{}} annotationColors={{}} weekdayOverDate />,
    );
    const emptyRow = container.querySelector('.print-row-empty');
    expect(emptyRow).not.toBeNull();
    expect(emptyRow?.classList.contains('print-row-weekday-over-date')).toBe(true);
    expect(emptyRow?.querySelector('.print-col-datum')).toBeNull();
    // Das 31-Zeilen-Raster bleibt unverändert.
    expect(container.querySelectorAll('.print-month-body > .print-row').length).toBe(PRINT_ROWS);
  });
});

/**
 * Frei angelegte Zusatzspalten und querliegende Texte im Druck.
 *
 * Sie sind rein darstellungsbezogen, sollen aber - wie am Bildschirm - auch im
 * Ausdruck erscheinen: als schmale Spalten links der Information und rechts der
 * KW-Spalte sowie als querliegender Text über die markierte Zeilenspanne.
 */
describe('PrintMonth – Zusatzspalten', () => {
  const january2026 = buildYearCalendar({ year: 2026, selectedShift: 'B' }).months[0];

  it('fügt links und rechts je eine schmale Spalte ein und setzt die Breiten', () => {
    const container = render(
      <PrintMonth
        month={january2026}
        annotationLabels={{}}
        annotationColors={{}}
        extraColumns={{ left: [1], right: [1] }}
      />,
    );
    const month = container.querySelector('.print-month') as HTMLElement | null;
    expect(month).not.toBeNull();
    // Breiten der Zusatzspalten als CSS-Variablen (je 3 mm pro Einheit).
    expect(month?.style.getPropertyValue('--print-extra-left')).toBe('3mm');
    expect(month?.style.getPropertyValue('--print-extra-right')).toBe('3mm');

    const firstRow = container.querySelector('.print-row') as HTMLElement | null;
    expect(firstRow?.querySelectorAll('.print-col-extra').length).toBe(2);
    // Reihenfolge: Wochentag, Datum, [links], Info, KW, [rechts], T/N.
    const cellClasses = Array.from(firstRow?.children ?? []).map((cell) =>
      Array.from(cell.classList).find((name) => name.startsWith('print-col-')),
    );
    expect(cellClasses).toEqual([
      'print-col-wo',
      'print-col-datum',
      'print-col-extra',
      'print-col-info',
      'print-col-kw',
      'print-col-extra',
      'print-col-schicht',
    ]);
    // Die vollständige Trackliste muss exakt zu den gerenderten Zellen passen
    // (je Zusatzspalte genau ein Track). Weicht sie ab, verrutscht das
    // Spaltenraster und die Zeilen wachsen über die Blatthöhe hinaus.
    expect(month?.style.getPropertyValue('--print-row-columns')).toBe(
      '6.5mm 7mm 3mm 1fr 8mm 3mm 5mm',
    );
  });

  it('gibt ohne Zusatzspalten die unveränderte Trackliste aus', () => {
    const container = render(
      <PrintMonth
        month={january2026}
        annotationLabels={{}}
        annotationColors={{}}
      />,
    );
    const month = container.querySelector('.print-month') as HTMLElement | null;
    // Keine zusätzlichen Spuren: das Raster entspricht exakt dem Ursprungszustand.
    expect(month?.style.getPropertyValue('--print-row-columns')).toBe('6.5mm 7mm 1fr 8mm 5mm');
    expect(month?.style.getPropertyValue('--print-row-columns-weekday-over-date')).toBe(
      '6.5mm 1fr 8mm 5mm',
    );
    expect(month?.style.getPropertyValue('--print-row-columns-no-shift')).toBe(
      '6.5mm 7mm 1fr 8mm',
    );
    expect(
      month?.style.getPropertyValue('--print-row-columns-no-shift-weekday-over-date'),
    ).toBe('6.5mm 1fr 8mm');
  });

  it('lässt das 31-Zeilen-Raster bei Zusatzspalten unverändert', () => {
    const container = render(
      <PrintMonth
        month={january2026}
        annotationLabels={{}}
        annotationColors={{}}
        extraColumns={{ left: [2], right: [] }}
      />,
    );
    expect(container.querySelectorAll('.print-month-body > .print-row').length).toBe(PRINT_ROWS);
  });

  it('färbt die Zusatzspalte eines Tages ein', () => {
    const container = render(
      <PrintMonth
        month={january2026}
        annotationLabels={{}}
        annotationColors={{}}
        extraColumns={{ left: [1], right: [] }}
        annotationExtraColors={{ '2026-01-05': { extra0: 'red' } }}
      />,
    );
    const row = container.querySelector('.print-row[data-date-key="2026-01-05"]');
    const cell = row?.querySelector('.print-col-extra') as HTMLElement | null;
    expect(cell).not.toBeNull();
    expect(cell?.getAttribute('data-extra-column-key')).toBe('extra0');
    expect(cell?.style.backgroundColor).not.toBe('');
  });

  it('zieht den querliegenden Text über die markierte Zeilenspanne', () => {
    const container = render(
      <PrintMonth
        month={january2026}
        annotationLabels={{}}
        annotationColors={{}}
        extraColumns={{ left: [1], right: [] }}
        extraTextsByDateKey={{
          '2026-01-01': [
            {
              id: 'extra0@2026-01-01',
              colorKey: 'extra0',
              columnLabel: 'Zusatzspalte 0',
              vertical: true,
              text: 'Urlaub',
              dateKeys: ['2026-01-01', '2026-01-02', '2026-01-03'],
              length: 3,
            },
          ],
        }}
      />,
    );
    const overlay = container.querySelector('.print-month-overlay');
    expect(overlay).not.toBeNull();
    const text = overlay?.querySelector('.print-extra-text') as HTMLElement | null;
    expect(text).not.toBeNull();
    expect(text?.textContent).toBe('Urlaub');
    // Querliegend (um 90° gedreht) und über die drei ersten Zeilen gespannt.
    expect(text?.classList.contains('is-vertical')).toBe(true);
    expect(text?.style.top).toBe('0%');
    expect(text?.style.height).toBe(`${(3 / PRINT_ROWS) * 100}%`);
    // Die Spalte liegt links der Information: Wochentag (6,5) + Datum (7) = 13,5 mm.
    expect(text?.style.left).toBe('13.5mm');
    expect(text?.style.width).toBe('3mm');
    // Das Zeilenraster bleibt unverändert (die Überlagerung zählt nicht mit).
    expect(container.querySelectorAll('.print-month-body > .print-row').length).toBe(PRINT_ROWS);
  });

  it('verschiebt den Text der zweiten linken Spalte um eine Einheit', () => {
    const container = render(
      <PrintMonth
        month={january2026}
        annotationLabels={{}}
        annotationColors={{}}
        extraColumns={{ left: [1, 1], right: [] }}
        extraTextsByDateKey={{
          '2026-01-10': [
            {
              id: 'extra1@2026-01-10',
              colorKey: 'extra1',
              columnLabel: 'Zusatzspalte 1',
              vertical: true,
              text: 'Schulung',
              dateKeys: ['2026-01-10'],
              length: 1,
            },
          ],
        }}
      />,
    );
    const text = container.querySelector('.print-extra-text') as HTMLElement | null;
    expect(text).not.toBeNull();
    // Zweite Spalte: 13,5 mm + 1 × 3 mm.
    expect(text?.style.left).toBe('16.5mm');
    expect(text?.style.top).toBe(`${(9 / PRINT_ROWS) * 100}%`);
  });

  it('zeigt ohne Zusatzspalten weder Zellen noch Überlagerung', () => {
    const container = render(
      <PrintMonth
        month={january2026}
        annotationLabels={{}}
        annotationColors={{}}
        extraTextsByDateKey={{
          '2026-01-01': [
            {
              id: 'extra0@2026-01-01',
              colorKey: 'extra0',
              columnLabel: 'Zusatzspalte 0',
              vertical: true,
              text: 'Urlaub',
              dateKeys: ['2026-01-01'],
              length: 1,
            },
          ],
        }}
      />,
    );
    expect(container.querySelector('.print-col-extra')).toBeNull();
    expect(container.querySelector('.print-month-overlay')).toBeNull();
  });

  /**
   * Regression: Der querliegende Text wurde früher als letztes Rasterkind über
   * `grid-row: 1 / -1` über das gesamte Raster gespannt. Dadurch belegte die
   * Überlagerung die erste Spalte vollständig; die 31 Tageszeilen wichen per
   * Auto-Placement in 31 zusätzliche, implizite Zeilen aus. Das Raster besaß
   * anschließend 62 Zeilen und jede Zelle war auf weniger als die halbe Höhe
   * gestaucht. Die Ebene muss deshalb aus dem Rasterfluss genommen werden
   * (`position: absolute` gegen den relativen `.print-month-body`).
   */
  it('nimmt die Überlagerung aus dem Zeilenraster (keine gestauchten Zellen)', () => {
    render(
      <PrintMonth
        month={january2026}
        annotationLabels={{}}
        annotationColors={{}}
        extraColumns={{ left: [1], right: [] }}
        extraTextsByDateKey={{
          '2026-01-01': [
            {
              id: 'extra0@2026-01-01',
              colorKey: 'extra0',
              columnLabel: 'Zusatzspalte 0',
              vertical: true,
              text: 'Urlaub',
              dateKeys: ['2026-01-01', '2026-01-02', '2026-01-03'],
              length: 3,
            },
          ],
        }}
      />,
    );

    // Der Rasterrahmen muss Bezugsrahmen der absolut positionierten Ebene sein.
    const bodyRule = /\.print-month-body\s*\{[^}]*position:\s*relative/s;
    expect(bodyRule.test(readPrintStylesheet())).toBe(true);

    // Die Ebene selbst darf keinen Rasterplatz belegen: absolut positioniert
    // und ohne `grid-row`/`grid-column`-Spanne.
    const overlayRule = /\.print-month-overlay\s*\{([^}]*)\}/s.exec(readPrintStylesheet())?.[1] ?? '';
    expect(overlayRule).toMatch(/position:\s*absolute/);
    expect(overlayRule).toMatch(/inset:\s*0/);
    expect(overlayRule).not.toMatch(/grid-row/);
    expect(overlayRule).not.toMatch(/grid-column/);
  });

  /**
   * Regression: Der querliegende Drucktext lag **hinter** dem Farbstreifen der
   * markierten Zusatzspalte und war dadurch weder in der Vorschau noch im
   * gedruckten PDF sichtbar.
   *
   * Ursache: die gefärbten Zusatzspalten-Zellen werden über
   * `.print-row > .print-col-extra[style]` auf `z-index: 1` gehoben, damit ihr
   * Streifen die Zeilenlinien durchgehend überdeckt. Die Textebene
   * (`.print-month-overlay`) hatte keinen eigenen Stapelwert (`auto`) und lag
   * damit darunter. Sie muss einen höheren `z-index` als die Zellen besitzen.
   */
  it('legt den querliegenden Drucktext über den Farbstreifen (sichtbar)', () => {
    const stylesheet = readPrintStylesheet();
    const cellRule =
      /\.print-row\s*>\s*\.print-col-extra\[style\]\s*\{([^}]*)\}/s.exec(stylesheet)?.[1] ?? '';
    const overlayRule = /\.print-month-overlay\s*\{([^}]*)\}/s.exec(stylesheet)?.[1] ?? '';

    const cellZ = Number(/z-index:\s*(-?\d+)/.exec(cellRule)?.[1] ?? 'NaN');
    const overlayZ = Number(/z-index:\s*(-?\d+)/.exec(overlayRule)?.[1] ?? 'NaN');

    expect(Number.isFinite(cellZ)).toBe(true);
    expect(Number.isFinite(overlayZ)).toBe(true);
    // Der Text muss über den gefärbten Zellen liegen.
    expect(overlayZ).toBeGreaterThan(cellZ);
  });

  /**
   * Regression: Der querliegende Drucktext wurde mit `writing-mode: vertical-rl`
   * plus `transform: rotate(180deg)` gedreht. Ein `transform` legt das Element
   * auf eine eigene Compositing-Ebene, die Chrome beim Drucken als Bitmap in
   * Bildschirmauflösung rastert - der Text erschien im Ausdruck verpixelt.
   * `writing-mode: sideways-lr` erreicht dieselbe Leserichtung rein über
   * Textlayout und bleibt vektoriell (scharfer Druck).
   */
  it('dreht den querliegenden Drucktext ohne transform (scharfer Druck)', () => {
    const stylesheet = readPrintStylesheet();
    const base = /\.print-extra-text\.is-vertical\s*\{([^}]*)\}/s;
    const baseBody = base.exec(stylesheet)?.[1] ?? '';
    expect(baseBody).toContain('writing-mode: sideways-lr');
    expect(baseBody).not.toContain('transform');
    // Nur die Rückfallebene (ohne `sideways-lr`-Unterstützung) darf drehen.
    expect(/@supports not \(writing-mode: sideways-lr\)/.test(stylesheet)).toBe(true);
  });

  /**
   * Regression: Eine über mehrere Zellen markierte Zusatzspalte wurde an jeder
   * Zeilengrenze von der dünnen horizontalen Zeilenlinie (`.print-row`
   * `border-top`) durchschnitten und war dadurch schwer zu lesen. Die gefärbte
   * Zelle wird nun um die Linienstärke über die Zeilengrenzen hinausgezogen
   * (negatives `margin`), damit der farbige Streifen ungebrochen erscheint.
   */
  it('zieht gefärbte Zusatzspalten über die Zeilenlinie (ungebrochener Streifen)', () => {
    const stylesheet = readPrintStylesheet();
    const rule = /\.print-row\s*>\s*\.print-col-extra\[style\]\s*\{[^}]*margin:\s*-0\.25pt\s+0/s;
    expect(rule.test(stylesheet)).toBe(true);
  });
});
