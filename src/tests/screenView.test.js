import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Strukturverifikation der Bildschirmdarstellung und der Anzeige-Einstellung.
 *
 * Abgesichert werden die Anforderungen, die nur die Oberfläche betreffen:
 * - keine Spaltenkopfzeile ueber den Tageszeilen,
 * - rosa "F"-Kästchen bei gesetzlichen Feiertagen in der KW-Spalte,
 * - "F" als einzige Nennung des Feiertags; ein Kommentar in der Zeile
 *   verdrängt Termin- und Feiertagsnamen vollständig,
 * - Titel "BASF Schichtkalender" und funktionierender Hell/Dunkel-Umschalter,
 * - Unabhängigkeit der Anzeige-Einstellung von den Fachdaten.
 */
/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { App } from '../components/App.tsx';
import { countMarkedShiftsByColor, MonthCalendar } from '../components/MonthCalendar.tsx';
import { buildYearCalendar, summarizeYear } from '../engines/calendarBuilder.ts';
/**
 * Liest das Bildschirm-Stylesheet als Text.
 *
 * Reine Regeln wie der Greif-Cursor der Zieh-Spalten lassen sich in jsdom nicht
 * über `getComputedStyle` prüfen (jsdom wertet Stylesheets nicht aus). Der
 * Regressionstest prüft deshalb direkt die Stylesheet-Quelle. Der Pfad wird
 * gegen das Arbeitsverzeichnis (Projektwurzel, in der Vitest startet) gebildet.
 */
function readStylesheet() {
    return readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
}
/** Baut einen realen Monat für die Markierungs-Tests (März 2021, Schicht C). */
function buildMarch2021() {
    return buildYearCalendar({ year: 2021, selectedShift: 'C' }).months[2];
}
import { DEFAULT_SHIFT, DEFAULT_SETTINGS } from '../config/appDefaults.ts';
import { THEME_ATTRIBUTE, THEME_STORAGE_KEY, applyTheme, readThemePreference, } from '../services/themeStore.ts';
import { parseState, serializeState } from '../services/persistence.ts';
/**
 * Startjahr der Anwendung: das aktuelle Jahr. Die Feiertagspr�fungen pr�fen
 * gezielt Maifeiertag (01.05.) und Neujahr (01.01.), weil beide Termine
 * unabh�ngig vom Wochentag immer gesetzliche Feiertage sind.
 */
const startYear = new Date().getFullYear();
/**
 * Gemountete Wurzeln aller Renderaufrufe. Die Tests brauchen dies, um vor
 * einem neuen Render die vorherigen Anwendungen sauber zu entfernen; sonst
 * würden mehrere App-Instanzen parallel am selben `window` lauschen (z. B. am
 * `beforeunload`-Ereignis).
 */
const mountedRoots = [];
/** Entfernt alle zuvor gerenderten Anwendungen (inkl. ihrer Listener). */
function unmountAll() {
    for (const entry of mountedRoots.splice(0)) {
        act(() => {
            entry.root.unmount();
        });
        entry.container.remove();
    }
}
function render(element) {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    mountedRoots.push({ root, container });
    act(() => {
        root.render(_jsx(StrictMode, { children: element }));
    });
    return container;
}
function click(element) {
    if (!element)
        throw new Error('Element nicht gefunden.');
    act(() => {
        element.click();
    });
}
/** Findet einen Toggle-Umschalter über die sichtbare Beschriftung seines Labels. */
function toggleByLabel(container, label) {
    return (Array.from(container.querySelectorAll('[role="switch"]')).find((element) => {
        const labelledBy = element.getAttribute('aria-labelledby');
        if (!labelledBy)
            return false;
        const labelElement = document.getElementById(labelledBy);
        return container.contains(labelElement) && labelElement?.textContent === label;
    }) ?? null);
}
describe('Bildschirmdarstellung', () => {
    it('nennt die Anwendung "BASF Schichtkalender"', () => {
        const container = render(_jsx(App, {}));
        expect(container.querySelector('.app-title')?.textContent).toBe('BASF Schichtkalender');
    });
    it('zeigt keine Spaltenkopfzeile über den Tageszeilen', () => {
        const container = render(_jsx(App, {}));
        expect(container.querySelector('.day-table-head')).toBeNull();
        expect(container.querySelectorAll('[role="columnheader"]').length).toBe(0);
    });
    it('startet die Jahresauswahl beim aktuellen Jahr', () => {
        const container = render(_jsx(App, {}));
        const select = container.querySelector('.year-select');
        expect(select?.value).toBe(String(startYear));
        const selectedOption = Array.from(select?.options ?? []).find((option) => option.value === String(startYear));
        expect(selectedOption?.textContent).toBe(String(startYear));
    });
    it('markiert gesetzliche Feiertage mit "F" und Brauchtumstage nicht', () => {
        const container = render(_jsx(App, {}));
        // Der Maifeiertag (01.05.) ist immer ein gesetzlicher Feiertag, und der
        // 01.01. ist immer Neujahr; beide werden gezielt gepr�ft.
        const rows = Array.from(container.querySelectorAll('.day-row'));
        expect(rows.length).toBeGreaterThan(0);
        const label = (row) => row.getAttribute('aria-label') ?? '';
        const maiRow = rows.find((row) => label(row).includes('Maifeiertag'));
        expect(maiRow).toBeDefined();
        expect(maiRow?.querySelector('.cell-kw .holiday-mark')?.textContent).toBe('F');
        expect(label(maiRow)).toContain('Gesetzlicher Feiertag');
        // Der Feiertagsname steht ausgeschrieben im Informationstext; "F" gibt es
        // ausschließlich in der KW-Spalte.
        expect(label(maiRow)).toContain('Maifeiertag');
        expect(maiRow?.querySelector('.cell-information')?.textContent).toBe('Maifeiertag');
        expect(maiRow?.querySelector('.cell-information .holiday-mark')).toBeNull();
        const newYearRow = rows.find((row) => label(row).includes('Neujahr'));
        expect(newYearRow?.querySelector('.cell-kw .holiday-mark')?.textContent).toBe('F');
        expect(label(newYearRow)).toContain('Gesetzlicher Feiertag');
        expect(newYearRow?.querySelector('.cell-information')?.textContent).toBe('Neujahr');
        const december = Array.from(container.querySelectorAll('.month-card')).find((card) => card.getAttribute('aria-label') === `Dezember ${startYear}`);
        expect(december).toBeDefined();
        const decemberRows = Array.from(december.querySelectorAll('.day-row'));
        const eveRow = decemberRows.find((row) => label(row).includes('Heiligabend'));
        expect(eveRow).toBeDefined();
        expect(eveRow?.querySelector('.holiday-mark')).toBeNull();
        expect(label(eveRow)).toContain('Heiligabend');
    });
    it('nennt einen gesetzlichen Feiertag ausgeschrieben und markiert ihn mit "F"', () => {
        const container = render(_jsx(App, {}));
        const rows = Array.from(container.querySelectorAll('.day-row'));
        const maiRow = rows.find((row) => (row.getAttribute('aria-label') ?? '').includes('Maifeiertag'));
        expect(maiRow).toBeDefined();
        // Der Feiertag steht ausgeschrieben im Informationstext; das rosa
        // "F"-Kästchen sitzt ausschließlich in der KW-Spalte.
        expect(maiRow.querySelector('.cell-information')?.textContent).toBe('Maifeiertag');
        expect(maiRow.querySelector('.cell-information .holiday-mark')).toBeNull();
        expect(maiRow.querySelector('.cell-information')?.textContent).not.toContain('F');
        expect(maiRow.querySelector('.cell-kw .holiday-mark')?.textContent).toBe('F');
        expect(maiRow.querySelector('.cell-badge')).toBeNull();
        expect(maiRow.querySelector('.cell-kw')?.textContent).not.toContain('Maifeiertag');
        expect(maiRow.querySelector('.cell-kw')?.textContent).not.toContain('Dt. Einheit');
    });
    it('blendet den Feiertagsnamen aus, sobald ein Kommentar in der Zeile steht', () => {
        // Der Maifeiertag ist immer ein gesetzlicher Feiertag; hier wird er mit
        // einem Kommentar belegt. Der Kommentar wird über denselben
        // Speicherzustand gesetzt, den die Anwendung beim Start liest.
        const year = 2021;
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { selectedYear: year, selectedShift: 'C' },
            annotations: {
                '2021-05-01': { dateKey: '2021-05-01', label: 'Bereitschaft', colorId: null },
            },
        }));
        try {
            const container = render(_jsx(App, {}));
            const mayCard = Array.from(container.querySelectorAll('.month-card')).find((card) => card.getAttribute('aria-label') === `Mai ${year}`);
            expect(mayCard).toBeDefined();
            const row = Array.from(mayCard.querySelectorAll('.day-row')).find((candidate) => (candidate.getAttribute('aria-label') ?? '').startsWith('Sa 1.'));
            expect(row).toBeDefined();
            // Nur der Kommentar steht in der Zeile: Termin- und Feiertagsname sind
            // ausgeblendet. Auch der Informationstext enthält kein "F" - der
            // Feiertag bleibt ausschließlich über das rosa Kästchen in der
            // KW-Spalte erkennbar.
            expect(row.querySelector('.cell-information')?.textContent).toBe('Bereitschaft');
            expect(row.querySelector('.cell-information .holiday-mark')).toBeNull();
            expect(row.querySelector('.cell-information')?.textContent).not.toContain('F');
            expect(row.querySelector('.cell-information')?.textContent).not.toContain('Maifeiertag');
            // Der Feiertag bleibt über das rosa Kästchen in der KW-Spalte sichtbar.
            expect(row.querySelector('.cell-kw .holiday-mark')?.textContent).toBe('F');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('lädt gespeicherte Kommentare über den Standard-Speicher und schreibt sie zurück', () => {
        // Regression: der AnnotationStore darf ohne ausdrücklich übergebenen
        // Speicher den Standard-Speicher (localStorage) verwenden. Andernfalls
        // blieben gespeicherte Kommentare beim Start unsichtbar.
        const year = 2021;
        const storedAnnotations = {
            '2021-05-01': { dateKey: '2021-05-01', label: 'Bereitschaft', colors: { info: 'yellow' } },
        };
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { selectedYear: year, selectedShift: 'C' },
            annotations: storedAnnotations,
        }));
        try {
            const container = render(_jsx(App, {}));
            const rows = Array.from(container.querySelectorAll('.day-row'));
            const annotated = rows.find((candidate) => candidate.querySelector('.cell-information')?.textContent === 'Bereitschaft');
            expect(annotated).toBeDefined();
            // Der persistierte Zustand bleibt vollständig erhalten (Rundreise).
            const persisted = JSON.parse(window.localStorage.getItem('schichtkalender.state') ?? '{}');
            expect(persisted.annotations).toEqual(storedAnnotations);
            expect(persisted.settings).toEqual({
                ...DEFAULT_SETTINGS,
                selectedYear: year,
                selectedShift: 'C',
                weekdayOverDate: false,
            });
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('behält die harten Zeilenumbrüche einer mehrzeiligen Beschriftung in der Tageszeile', () => {
        // Regression: Die drei im DayEditor eingegebenen Zeilen müssen in der
        // Bildschirmzelle als eigene Zeilen erhalten bleiben (und dürfen nicht zu
        // Leerzeichen oder "|" zusammengezogen werden). Der Textinhalt trägt die
        // echten Umbrüche (\n), die Anzeige erfolgt über `white-space: pre-line`.
        const year = 2021;
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { selectedYear: year, selectedShift: 'C' },
            annotations: {
                '2021-03-15': { dateKey: '2021-03-15', label: 'Urlaub\nArzt\nSchulung', colorId: null },
            },
        }));
        try {
            const container = render(_jsx(App, {}));
            // Gezielt die Zelle mit der persönlichen Beschriftung prüfen: Seit der
            // Schriftgrößen-Prüfung für Termine tragen auch reine Ereigniszellen
            // eine `label-lines-*`-Klasse, daher nicht auf das erste Element
            // verlassen, sondern über den Textinhalt auswählen.
            const info = Array.from(container.querySelectorAll('.day-row .cell-information')).find((cell) => cell.textContent === 'Urlaub\nArzt\nSchulung');
            expect(info).toBeDefined();
            expect(info?.classList.contains('label-lines-3')).toBe(true);
            expect(info?.textContent).toBe('Urlaub\nArzt\nSchulung');
            expect(info?.textContent).not.toContain('|');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('deckelt die Schrift reiner Terminnamen über eine label-lines-Klasse', () => {
        // Übernommene Ereignisse ohne persönliche Beschriftung trugen zuvor keine
        // label-lines-Klasse und erbten die ungedeckelte Standardgröße. Jetzt wird
        // ihre Schrift geprüft und gedeckelt.
        const container = render(_jsx(App, {}));
        const rows = Array.from(container.querySelectorAll('.day-row'));
        // Maifeiertag (kurz) -> höchstens mittelgroß.
        const maiRow = rows.find((row) => (row.getAttribute('aria-label') ?? '').includes('Maifeiertag'));
        const maiInfo = maiRow?.querySelector('.cell-information');
        expect(maiInfo?.textContent).toBe('Maifeiertag');
        expect(maiInfo?.classList.contains('label-lines-2')).toBe(true);
        expect(maiInfo?.classList.contains('label-lines-1')).toBe(false);
        // Tag der Deutschen Einheit (lang) -> kleinste Stufe.
        const einheitRow = rows.find((row) => (row.getAttribute('aria-label') ?? '').includes('Tag der Deutschen Einheit'));
        const einheitInfo = einheitRow?.querySelector('.cell-information');
        expect(einheitInfo?.textContent).toContain('Tag der Deutschen Einheit');
        expect(einheitInfo?.classList.contains('label-lines-3')).toBe(true);
    });
    it('markiert Feiertage anderer Bundesländer in Rheinland-Pfalz nicht', () => {
        const container = render(_jsx(App, {}));
        const rows = Array.from(container.querySelectorAll('.day-row'));
        const label = (row) => row.getAttribute('aria-label') ?? '';
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
        const container = render(_jsx(App, {}));
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
    it('zählt die in der T/N-Spalte markierten Schichten je Farbe ohne freie Tage', () => {
        // Anforderung: Werden Zellen der rechten T/N-Spalte eingefärbt, soll ganz
        // unten im Monat die Summe der markierten Schichten erscheinen. Gezählt
        // werden ausschließlich tatsächlich erfasste T/N; freie Tage (OFF) zählen
        // nicht mit, selbst wenn die Spalte dort eingefärbt wurde.
        const month = buildMarch2021();
        const workedDays = month.days.filter((day) => day.shiftLabel !== '');
        const offDays = month.days.filter((day) => day.shiftLabel === '');
        expect(workedDays.length).toBeGreaterThan(2);
        expect(offDays.length).toBeGreaterThan(0);
        // Die shift-Spalte an allen T/N-Tagen gelb und zusätzlich an einem freien
        // Tag markieren. Der freie Tag darf die Summe nicht erhöhen.
        const annotations = {};
        for (const day of workedDays) {
            annotations[day.dateKey] = { dateKey: day.dateKey, label: '', colors: { shift: 'yellow' } };
        }
        annotations[offDays[0].dateKey] = {
            dateKey: offDays[0].dateKey,
            label: '',
            colors: { shift: 'yellow' },
        };
        const counts = countMarkedShiftsByColor(month.days, annotations);
        expect(counts).toEqual([{ colorId: 'yellow', count: workedDays.length }]);
    });
    it('trennt die markierten Schichten in der Fußzeile nach Farben', () => {
        const month = buildMarch2021();
        const workedDays = month.days.filter((day) => day.shiftLabel !== '');
        // Mindestens zwei Schichttage mit unterschiedlichen Farben markieren.
        const first = workedDays[0];
        const second = workedDays[1];
        const annotations = {
            [first.dateKey]: { dateKey: first.dateKey, label: '', colors: { shift: 'yellow' } },
            [second.dateKey]: { dateKey: second.dateKey, label: '', colors: { shift: 'green' } },
        };
        const container = render(_jsx(MonthCalendar, { month: month, annotations: annotations, onOpenEditor: () => undefined }));
        const chips = Array.from(container.querySelectorAll('.month-footer-chip'));
        expect(chips.length).toBe(2);
        // Reihenfolge folgt der Farbpalette: Gelb vor Grün.
        expect(chips[0].textContent).toBe('1');
        expect(chips[0].getAttribute('style')).toContain('rgb(255, 224, 0)');
        expect(chips[1].textContent).toBe('1');
        expect(chips[1].getAttribute('style')).toContain('rgb(46, 158, 62)');
    });
    it('zeigt keine Markierungs-Summe, wenn die T/N-Spalte nicht markiert ist', () => {
        const month = buildMarch2021();
        const container = render(_jsx(MonthCalendar, { month: month, annotations: {}, onOpenEditor: () => undefined }));
        expect(container.querySelector('.month-footer-chip')).toBeNull();
    });
    it('zeigt die bezahlten Feiertage nicht mehr in der Monatskarte an', () => {
        // Schicht C im Dezember 2021: Der 31.12. (N) reicht in das Neujahr 2022
        // hinein und erzeugt einen halben Feiertag. Die Berechnung bleibt
        // bestehen, die Fußzeile nennt den Wert jedoch nicht mehr.
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { selectedYear: 2021, selectedShift: 'C' },
            annotations: {},
        }));
        try {
            const container = render(_jsx(App, {}));
            const card = (name) => Array.from(container.querySelectorAll('.month-card')).find((candidate) => candidate.getAttribute('aria-label') === name);
            const december = card('Dezember 2021');
            expect(december).toBeDefined();
            const footer = december.querySelector('.month-footer')?.textContent ?? '';
            expect(footer).not.toContain('halbe Feiertage');
            expect(footer).not.toContain('bezahlt gesamt');
            expect(footer).not.toContain('Feiertage mit Schicht');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('führt einen Feiertag ohne Schicht nicht als vollen Feiertag auf', () => {
        // Schicht C im Januar 2021: Der 06.01. (Mi) ist eine Tagschicht und
        // damit der eine Feiertag mit Schicht. Heilige Drei Könige ist in
        // Rheinland-Pfalz jedoch nicht bezahlt und zählt nicht mit. Geprüft
        // wird das an der Kennzahl im Modell, da die Fußzeile die bezahlten
        // Feiertage nicht mehr anzeigt.
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { selectedYear: 2021, selectedShift: 'C' },
            annotations: {},
        }));
        try {
            const container = render(_jsx(App, {}));
            const card = (name) => Array.from(container.querySelectorAll('.month-card')).find((candidate) => candidate.getAttribute('aria-label') === name);
            const january = card('Januar 2021');
            expect(january).toBeDefined();
            expect(january.querySelector('.month-footer')?.textContent).not.toContain('Feiertage mit Schicht');
            // Schicht C: Der 01.01.2021 (Fr) ist eine Nachtschicht und fällt
            // damit selbst unter die Regel.
            const newYearRow = Array.from(january.querySelectorAll('.day-row')).find((row) => (row.getAttribute('aria-label') ?? '').includes('Neujahr'));
            expect(newYearRow?.querySelector('.cell-shift')?.textContent).toBe('N');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('zeigt die obere Legende ohne die entfernten Erläuterungen', () => {
        const container = render(_jsx(App, {}));
        const legend = container.querySelector('.legend');
        expect(legend).toBeDefined();
        const text = legend?.textContent ?? '';
        // Entfernt: die Zeile zu Feiertagen mit Schicht.
        expect(text).not.toContain('Feiertage mit Schicht');
        expect(text).not.toContain('Feiertage, die mit T oder N zusammenfallen');
        // Entfernt: der Klammerzusatz zum rosa Kästchen.
        expect(text).not.toContain('rosa Kästchen');
        // Erhalten: die übrigen Legendenzeilen einschließlich "F".
        expect(text).toContain('Tagschicht');
        expect(text).toContain('Nachtschicht');
        expect(text).toContain('Werktage');
        expect(text).toContain('Sollschichten');
        expect(legend?.querySelector('.holiday-mark')?.textContent).toBe('F');
    });
    it('zeigt oben in der Legende die Arbeitsschichten gesamt im Jahr', () => {
        const container = render(_jsx(App, {}));
        const legend = container.querySelector('.legend');
        expect(legend).toBeDefined();
        // Die Anwendung startet beim aktuellen Jahr und der Standardschicht.
        // Die Gesamtzahl entspricht Tag- plus Nachtschichten des Jahres.
        const expected = summarizeYear(buildYearCalendar({ year: startYear, selectedShift: DEFAULT_SHIFT })).requiredShiftCount;
        const total = legend?.querySelector('.legend-total');
        expect(total).toBeDefined();
        // Die Zeile steht ganz oben in der Legende.
        expect(legend?.firstElementChild).toBe(total);
        expect(total?.textContent).toBe(`Arbeitsschichten gesamt im Jahr ${startYear} für Schicht ${DEFAULT_SHIFT}: ${expected}`);
    });
    it('klappt Menübar und Legendenbox über den Dreieckspfeil gemeinsam ein und wieder aus', () => {
        const container = render(_jsx(App, {}));
        const toggle = container.querySelector('.toolbar-collapse-toggle');
        expect(toggle).not.toBeNull();
        // Der Pfeil ist ein Dreieck mit der Spitze nach unten.
        expect(toggle?.querySelector('.toolbar-collapse-arrow')?.textContent).toBe('▼');
        // Ausgangszustand: ausgeklappt, Steuerung und Legendenbox sichtbar.
        expect(container.querySelector('.toolbar')?.classList.contains('is-collapsed')).toBe(false);
        expect(toggle?.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('.toolbar-controls')).not.toBeNull();
        expect(container.querySelector('.legend')).not.toBeNull();
        // Einklappen: Steuerung wird ausgeblendet (CSS-Klasse), Legendenbox entfernt.
        click(toggle);
        expect(container.querySelector('.toolbar')?.classList.contains('is-collapsed')).toBe(true);
        expect(container.querySelector('.toolbar-collapse-toggle')).not.toBeNull();
        expect(toggle?.getAttribute('aria-expanded')).toBe('false');
        expect(container.querySelector('.legend')).toBeNull();
        // Erneutes Klicken klappt beides wieder aus.
        click(toggle);
        expect(container.querySelector('.toolbar')?.classList.contains('is-collapsed')).toBe(false);
        expect(toggle?.getAttribute('aria-expanded')).toBe('true');
        expect(container.querySelector('.toolbar-controls')).not.toBeNull();
        expect(container.querySelector('.legend')).not.toBeNull();
    });
    it('schaltet die Anzeige zwischen Hell und Dunkel um', () => {
        const container = render(_jsx(App, {}));
        const buttons = Array.from(container.querySelectorAll('.theme-button'));
        expect(buttons.length).toBe(2);
        // Startansicht ist grundsätzlich der Dunkelmodus.
        const darkButton = buttons.find((button) => button.textContent?.includes('Dunkel'));
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
        const lightButton = buttons.find((button) => button.textContent?.includes('Hell'));
        click(lightButton ?? null);
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
        click(darkButton ?? null);
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
        expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    });
    it('öffnet ein mehrzeiliges Beschriftungsfeld mit adaptiver Schrift im DayEditor', () => {
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { selectedYear: 2021, selectedShift: 'C' },
            annotations: {},
        }));
        try {
            const container = render(_jsx(App, {}));
            const firstRow = container.querySelector('.day-row');
            click(firstRow);
            const field = container.querySelector('.editor-textarea');
            expect(field).not.toBeNull();
            expect(field?.tagName).toBe('TEXTAREA');
            expect(field?.getAttribute('rows')).toBe('3');
            // Ohne Eingabe gilt die Ein-Zeilen-Klasse mit der größten Schrift.
            expect(field?.classList.contains('label-lines-1')).toBe(true);
            expect(Number.parseFloat(field?.style.fontSize ?? '0')).toBeGreaterThan(0);
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('markiert per vertikalem Ziehen einen Streifen und färbt ihn spaltenweise ein', () => {
        // Regression-Anforderung: Mit gedrückter und gezogener Maustaste lässt
        // sich vertikal über eine einzelne Zieh-Spalte (hier: die T/N-Zelle) ein
        // Streifen markieren. Beim Loslassen öffnet sich ein Fenster, in dem
        // ausschließlich diese Spalte eingefärbt wird. Bestehende Beschriftungen
        // und andere Spaltenfarben bleiben erhalten.
        const year = 2021;
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { selectedYear: year, selectedShift: 'C' },
            annotations: {
                '2021-03-15': { dateKey: '2021-03-15', label: 'Urlaub', colors: {} },
            },
        }));
        function mouse(element, type, target) {
            if (!element)
                throw new Error('Element nicht gefunden.');
            const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
            act(() => {
                (target ?? element).dispatchEvent(event);
            });
        }
        try {
            const container = render(_jsx(App, {}));
            const march = Array.from(container.querySelectorAll('.month-card')).find((card) => card.getAttribute('aria-label') === `März ${year}`);
            expect(march).toBeDefined();
            const marchRows = Array.from(march.querySelectorAll('.day-row'));
            // Die ersten drei zusammenhängenden Tage des Monats markieren.
            const rows = marchRows.slice(0, 3);
            expect(rows.length).toBe(3);
            // Ziehen beginnt in der T/N-Zelle (Zieh-Spalte) der ersten Zeile.
            mouse(rows[0], 'mousedown', rows[0].querySelector('.cell-shift') ?? rows[0]);
            for (const row of rows.slice(1)) {
                // React leitet onMouseEnter aus mouseover ab; im Test wird daher
                // mouseover (mit relatedTarget außerhalb) ausgelöst.
                act(() => {
                    row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                });
            }
            // Loslassen beendet die Auswahl und öffnet das Streifen-Fenster.
            mouse(rows[2], 'mouseup', rows[2].querySelector('.cell-shift') ?? rows[2]);
            act(() => {
                window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            });
            const dialog = container.querySelector('.day-editor');
            expect(dialog).not.toBeNull();
            expect(dialog?.textContent).toContain('Streifen einfärben');
            expect(dialog?.textContent).toContain('3 Tage markiert');
            // Die Zusammenfassung nennt die gestartete Spalte.
            expect(dialog?.textContent).toContain('T/N');
            // Einfärben: eine Farbe wählen und anwenden.
            const yellow = Array.from(dialog.querySelectorAll('.color-option')).find((option) => option.textContent?.includes('Gelb'));
            click(yellow ?? null);
            const apply = Array.from(dialog.querySelectorAll('button')).find((button) => button.textContent === 'Einfärben');
            click(apply ?? null);
            // Die drei Tage tragen nun die Farbe ausschließlich in der gestarteten
            // Spalte (shift); die übrigen Spalten bleiben ungefärbt. Der Dialog ist
            // geschlossen.
            expect(container.querySelector('.day-editor')).toBeNull();
            const persisted = JSON.parse(window.localStorage.getItem('schichtkalender.state') ?? '{}');
            // Die drei gefärbten Tage plus die unveränderte Altmarkierung am 15.03.
            expect(persisted.annotations['2021-03-01']).toEqual({
                dateKey: '2021-03-01',
                label: '',
                colors: { shift: 'yellow' },
            });
            expect(persisted.annotations['2021-03-02'].colors.shift).toBe('yellow');
            expect(persisted.annotations['2021-03-03'].colors.shift).toBe('yellow');
            expect(persisted.annotations['2021-03-02'].colors.weekday).toBeUndefined();
            // Bestehende Beschriftung außerhalb der Auswahl bleibt vollständig
            // unverändert (Farbe und Beschriftung).
            expect(persisted.annotations['2021-03-15']).toEqual({
                dateKey: '2021-03-15',
                label: 'Urlaub',
                colors: {},
            });
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('übernimmt eine geladene Sicherungsdatei in Einstellungen und Kalender', async () => {
        // Dateibasierte Persistenz: Eine zuvor erzeugte Sicherung (serializeState)
        // wird über den Lade-Baustein wieder eingelesen und muss Jahr und Schicht
        // sichtbar übernehmen.
        const container = render(_jsx(App, {}));
        const fileButton = Array.from(container.querySelectorAll('.data-controls button')).find((button) => button.textContent?.includes('Laden'));
        expect(fileButton).toBeDefined();
        const state = {
            version: 1,
            settings: {
                ...DEFAULT_SETTINGS,
                selectedYear: 2022,
                selectedShift: 'B',
                weekdayOverDate: false,
            },
            annotations: {
                '2022-05-05': { dateKey: '2022-05-05', label: 'Schulung', colors: { info: 'green' } },
            },
            colorLegend: {},
            anniversaries: {},
        };
        const parsed = parseState(serializeState(state));
        expect(parsed?.settings.selectedYear).toBe(2022);
        // Den Datei-Dialog umgehen: das Lesen läuft über den FileReader und ist
        // asynchron. Daher wird der Change-Event samt nachgelagerter Zustands-
        // aktualisierung mit einer asynchronen act-Hülle umschlossen.
        const input = container.querySelector('.data-controls input[type="file"]');
        expect(input).not.toBeNull();
        const file = new File([serializeState(state)], 'schichtkalender-2022.json', {
            type: 'application/json',
        });
        Object.defineProperty(input, 'files', { value: [file], configurable: true });
        await act(async () => {
            input.dispatchEvent(new Event('change', { bubbles: true }));
            // Dem FileReader Zeit geben, das Promise aufzulösen.
            await new Promise((resolve) => setTimeout(resolve, 0));
        });
        const select = container.querySelector('.year-select');
        expect(select?.value).toBe('2022');
        const activeShift = container.querySelector('.shift-button.is-active');
        expect(activeShift?.textContent).toBe('B');
    });
    it('färbt nur die betroffene Zelle ein und lässt die übrigen Spalten unmarkiert', () => {
        // Regression: Eine einzelne eingefärbte Spalte darf nicht die
        // Textfarbe der gesamten Zeile umstellen. Die Kontrastfarbe hängt an
        // der Spaltenklasse `has-color-<spalte>` und betrifft damit
        // ausschließlich die tatsächlich hinterlegte Zelle.
        unmountAll();
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { selectedYear: 2022, selectedShift: 'B' },
            annotations: {
                // Nur die Info-Spalte trägt eine Farbe.
                '2022-05-05': { dateKey: '2022-05-05', label: 'Schulung', colors: { info: 'green' } },
                // Nur die T/N-Spalte (Streifen) trägt eine Farbe.
                '2022-05-06': { dateKey: '2022-05-06', label: '', colors: { shift: 'yellow' } },
            },
        }));
        try {
            const container = render(_jsx(App, {}));
            // Die Bildschirmzeilen tragen kein data-date-key (das gibt es nur in der
            // Druckansicht). Die Zeile wird daher über die gesetzte Farbspalte
            // gefunden.
            const infoRow = container.querySelector('.day-row[data-color-info="green"]');
            expect(infoRow).not.toBeNull();
            // Die Zeile ist als eingefärbt markiert ...
            expect(infoRow?.className).toContain('has-color');
            // ... aber nur die Info-Spalte trägt die Kontrast-Spaltenklasse.
            expect(infoRow?.className).toContain('has-color-info');
            expect(infoRow?.className).not.toContain('has-color-weekday');
            expect(infoRow?.className).not.toContain('has-color-day');
            expect(infoRow?.className).not.toContain('has-color-shift');
            // Nur der Tageseditor-Eintrag (Textblock) trägt den Hintergrund; die
            // Info-Zelle selbst bleibt unfarbig, damit die Farbe nicht auf
            // Geburtstage/wiederkehrende Ereignisse übergeht.
            const infoCell = infoRow?.querySelector('.cell-information');
            expect(infoCell?.style.backgroundColor).toBe('');
            const infoText = infoRow?.querySelector('.cell-information .cell-information-text');
            expect(infoText?.style.backgroundColor).not.toBe('');
            const weekdayCell = infoRow?.querySelector('.cell-weekday');
            expect(weekdayCell?.style.backgroundColor).toBe('');
            const shiftRow = container.querySelector('.day-row[data-color-shift="yellow"]');
            expect(shiftRow).not.toBeNull();
            expect(shiftRow?.className).toContain('has-color-shift');
            expect(shiftRow?.className).not.toContain('has-color-info');
            expect(shiftRow?.className).not.toContain('has-color-weekday');
            expect(shiftRow?.className).not.toContain('has-color-day');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
});
describe('Anzeige-Option "Wochentag über Datum"', () => {
    it('ist standardmäßig aus und lässt Datum und Wochentag in getrennten Zellen', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            const toggle = toggleByLabel(container, 'Wochentag über Datum');
            expect(toggle).not.toBeNull();
            expect(toggle?.getAttribute('aria-checked')).toBe('false');
            // Ohne Schalter: getrennte Spalten, keine gestapelte Zelle.
            expect(container.querySelector('.day-table.is-weekday-over-date')).toBeNull();
            const row = container.querySelector('.day-row');
            expect(row?.querySelector('.cell-day')).not.toBeNull();
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('schreibt das Datum unter den Wochentag und entfernt die Tagesnummer-Spalte', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            const toggle = toggleByLabel(container, 'Wochentag über Datum');
            click(toggle);
            // Der Schalter meldet den eingeschalteten Zustand ...
            expect(toggle?.getAttribute('aria-checked')).toBe('true');
            // ... und der Monat nutzt das gestapelte Raster.
            expect(container.querySelector('.day-table.is-weekday-over-date')).not.toBeNull();
            const row = container.querySelector('.day-row');
            // Die eigene Tagesnummer-Zelle entfällt vollständig.
            expect(row?.querySelector('.cell-day')).toBeNull();
            // Das Datum steht unter dem Wochentag in derselben Zelle.
            const weekdayCell = row?.querySelector('.cell-weekday');
            expect(weekdayCell?.querySelector('.cell-weekday-name')?.textContent).toBe(row?.querySelector('.cell-weekday-name')?.textContent);
            expect(weekdayCell?.querySelector('.cell-weekday-date')?.textContent).toMatch(/^\d{2}$/);
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('behält die Anzeige-Option im Standard-Speicher', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const first = render(_jsx(App, {}));
            const toggle = toggleByLabel(first, 'Wochentag über Datum');
            click(toggle);
            unmountAll();
            // Neue Sitzung: die Einstellung wird aus dem Speicher übernommen.
            const second = render(_jsx(App, {}));
            expect(toggleByLabel(second, 'Wochentag über Datum')?.getAttribute('aria-checked')).toBe('true');
            expect(second.querySelector('.day-table.is-weekday-over-date')).not.toBeNull();
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
});
describe('Frei angelegte Zusatzspalten im Monatskopf', () => {
    /** Findet den Bedienpunkt einer Seite im Monatskopf. */
    function handle(container, side) {
        return container.querySelector(`.column-insert-handle[data-extra-column-side="${side}"]`);
    }
    it('zeigt je Monat zwei Bedienpunkte auf den vertikalen Trennlinien', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            const header = container.querySelector('.month-header');
            expect(header).not.toBeNull();
            // Links vor KW/T/N und rechts unmittelbar neben der Schichtspalte.
            expect(handle(container, 'left')).not.toBeNull();
            expect(handle(container, 'right')).not.toBeNull();
            // Der Punkt selbst zeigt das Plus im Kreis.
            expect(handle(container, 'left')?.querySelector('circle')).not.toBeNull();
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    /** Liefert die Monatskarte (`.month-card`) über ihren Beschriftungstext. */
    function cardOf(container, label) {
        return (Array.from(container.querySelectorAll('.month-card')).find((card) => card.getAttribute('aria-label') === label) ?? null);
    }
    /** Anzahl der Zusatzzellen einer Tageszeile der Monatskarte. */
    function extraCellCount(card) {
        return card?.querySelectorAll('.day-row')[0]?.querySelectorAll('.cell-extra').length ?? 0;
    }
    it('legt bei jedem Klick eine neue, eigenständige Spalte an', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            const row = container.querySelector('.day-row');
            expect(row?.querySelectorAll('.cell-extra').length).toBe(0);
            // Erster Klick: eine Spalte direkt an der linken Trennlinie; jede
            // Tageszeile des angeklickten Monats (Januar) erhält genau eine
            // zusätzliche Zelle, die übrigen Monate bleiben unverändert.
            click(handle(container, 'left'));
            const firstCard = cardOf(container, 'Januar 2026');
            expect(firstCard?.querySelectorAll('.day-row').length).toBe(31);
            expect(extraCellCount(firstCard)).toBe(1);
            expect(extraCellCount(cardOf(container, 'Februar 2026'))).toBe(0);
            expect(firstCard?.style.getPropertyValue('--extra-left-width')).toBe('1.6em');
            // Jeder weitere Klick legt eine **weitere, eigenständige** Spalte an
            // (eigener Farbschlüssel, eigenes Zieh-Ziel); die Ansicht wird nach außen
            // geschoben. Die Spalten teilen sich also nicht denselben Farbschlüssel.
            click(handle(container, 'left'));
            const secondCard = cardOf(container, 'Januar 2026');
            expect(secondCard?.style.getPropertyValue('--extra-left-width')).toBe('3.2em');
            expect(extraCellCount(secondCard)).toBe(2);
            const keys = Array.from(secondCard.querySelectorAll('.day-row')[0].querySelectorAll('.cell-extra')).map((cell) => cell.getAttribute('data-extra-column-key'));
            expect(new Set(keys).size).toBe(2);
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('legt rechts eine Spalte zwischen KW und T/N an', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            click(handle(container, 'right'));
            const card = cardOf(container, 'Januar 2026');
            expect(card?.style.getPropertyValue('--extra-left-width')).toBe('0em');
            expect(card?.style.getPropertyValue('--extra-right-width')).toBe('1.6em');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('markiert eine Zusatzspalte per Ziehen und öffnet den eigenen Editor', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            // Eine Zusatzspalte links anlegen (Januar 2026).
            click(handle(container, 'left'));
            const card = cardOf(container, 'Januar 2026');
            expect(extraCellCount(card)).toBe(1);
            /** Hilfsfunktion: ein Maus-Ereignis auf einem Zielelement auslösen. */
            const mouse = (element, type, target) => {
                const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 });
                act(() => {
                    (target ?? element).dispatchEvent(event);
                });
            };
            const rows = Array.from(card.querySelectorAll('.day-row'));
            // Ziehen in der Zusatzspalte über die ersten drei Tage.
            mouse(rows[0], 'mousedown', rows[0].querySelector('.cell-extra') ?? rows[0]);
            for (const row of rows.slice(1, 3)) {
                act(() => {
                    row.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                });
            }
            mouse(rows[2], 'mouseup', rows[2].querySelector('.cell-extra') ?? rows[2]);
            act(() => {
                window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            });
            // Der eigene Zusatzspalten-Editor erscheint (kein Streifen-Dialog).
            const editor = container.querySelector('.day-editor');
            expect(editor).not.toBeNull();
            expect(editor?.textContent).toContain('Zusatzspalte 0');
            expect(editor?.textContent).toContain('Querliegender Text');
            expect(editor?.textContent).toContain('3 Zellen');
            // Text eingeben und eine Farbe (Rot) wählen.
            expect(editor?.querySelector('.cell-extra-text')).toBeNull();
            const textarea = editor.querySelector('textarea');
            act(() => {
                const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
                setter?.call(textarea, 'Urlaub');
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            });
            const redOption = Array.from(editor.querySelectorAll('.color-option')).find((option) => option.getAttribute('title') === 'Rot');
            click(redOption ?? null);
            const saveButton = Array.from(editor.querySelectorAll('button')).find((button) => button.textContent === 'Speichern');
            click(saveButton ?? null);
            // Farbe und querliegender Text landen in der Persistenz (Anker = erster Tag).
            const persisted = JSON.parse(window.localStorage.getItem('schichtkalender.state') ?? '{}');
            expect(persisted.annotations['2026-01-01']?.extraColors?.extra0).toBe('red');
            const text = persisted.annotations['2026-01-01']?.extraTexts?.extra0?.[0];
            expect(text?.text).toBe('Urlaub');
            expect(text?.vertical).toBe(true);
            expect(text?.dateKeys).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
            // Die Farbe wird in der Zelle dargestellt.
            const rowAfter = (cardOf(container, 'Januar 2026')?.querySelectorAll('.day-row')[0] ??
                null);
            expect(rowAfter?.querySelector('.cell-extra')?.getAttribute('style') ?? '').toContain('background-color');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('hebt beim Ziehen nur die getroffene Spalte hervor', () => {
        // Regression: Jede Zusatzspalte ist eine eigenständige Spalte mit eigenem
        // Farbschlüssel (`extra0`, `extra1`, …). Beim Ziehen darf nur die getroffene
        // Spalte hervorgehoben werden - nicht die benachbarte, deren Text/Farbe
        // sonst mitgeändert würde.
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            // Zwei eigenständige Spalten links anlegen.
            click(handle(container, 'left'));
            click(handle(container, 'left'));
            const card = cardOf(container, 'Januar 2026');
            const rows = Array.from(card.querySelectorAll('.day-row'));
            const startCells = rows[0].querySelectorAll('.cell-extra');
            expect(startCells.length).toBe(2);
            // Jede Spalte hat einen eigenen Farbschlüssel und ein eigenes Zieh-Ziel.
            expect(startCells[0].getAttribute('data-extra-column-key')).toBe('extra0');
            expect(startCells[1].getAttribute('data-extra-column-key')).toBe('extra1');
            expect(startCells[0].getAttribute('data-extra-unit-key')).toBe('extra0');
            expect(startCells[1].getAttribute('data-extra-unit-key')).toBe('extra1');
            const mouse = (element, type, target) => {
                act(() => {
                    (target ?? element).dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
                });
            };
            // Ziehen beginnt in der ZWEITEN Spalte.
            mouse(rows[0], 'mousedown', startCells[1]);
            mouse(rows[1], 'mouseover');
            const selected = (row) => Array.from(row.querySelectorAll('.cell-extra'))
                .map((cell) => cell.classList.contains('is-column-selected'))
                .join(',');
            // Nur die getroffene Spalte ist hervorgehoben - nicht die erste daneben.
            expect(selected(rows[0])).toBe('false,true');
            expect(selected(rows[1])).toBe('false,true');
            // Außerhalb der Auswahl bleibt alles unmarkiert.
            expect(selected(rows[3])).toBe('false,false');
            mouse(rows[1], 'mouseup');
            act(() => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
            // Der eigene Zusatzspalten-Editor erscheint für die zweite Spalte.
            const editor = container.querySelector('.day-editor');
            expect(editor?.textContent).toContain('Zusatzspalte 1');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('zeigt den Greif-Cursor (crosshair) auch über Zusatzspalten', () => {
        // Regression: Die Zusatzspalten waren als Zieh-Spalten nutzbar, zeigten
        // aber nicht denselben Cursor wie die festen Farbspalten.
        const stylesheet = readStylesheet();
        const rule = /\.cell-weekday\s*,[\s\S]*?\.cell-extra\s*\{[^}]*cursor:\s*crosshair/s;
        expect(rule.test(stylesheet)).toBe(true);
    });
    /**
     * Regression: Zwei unabhängige Markierungen derselben Zusatzspalte müssen mit
     * eigenem Text nebeneinander bestehen können. Früher entfernte das Speichern
     * eines Textes sämtliche Texte desselben Spalten-Schlüssels - die obere
     * Markierung verlor ihren Text, sobald die untere bearbeitet wurde.
     */
    it('behält den Text zweier unabhängiger Markierungen derselben Zusatzspalte', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            // Eine Zusatzspalte links anlegen (Januar 2026).
            click(handle(container, 'left'));
            const card = cardOf(container, 'Januar 2026');
            expect(card).not.toBeNull();
            const mouse = (element, type, target) => {
                act(() => {
                    (target ?? element).dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0 }));
                });
            };
            /** Führt ein Ziehen in der Zusatzspalte über die Zeilen `from..to` aus. */
            const dragExtra = (from, to) => {
                // Die Monatskarte nach jedem Render neu holen: nach dem Speichern wird
                // die Ansicht neu aufgebaut, alte DOM-Referenzen wären veraltet.
                const rows = Array.from(cardOf(container, 'Januar 2026').querySelectorAll('.day-row'));
                mouse(rows[from], 'mousedown', rows[from].querySelector('.cell-extra') ?? rows[from]);
                for (let i = from + 1; i <= to; i += 1) {
                    act(() => {
                        rows[i].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                    });
                }
                mouse(rows[to], 'mouseup', rows[to].querySelector('.cell-extra') ?? rows[to]);
                act(() => window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
            };
            /** Trägt in den offenen Zusatzspalten-Editor einen Text ein und speichert. */
            const saveText = (value) => {
                const editor = container.querySelector('.day-editor');
                expect(editor).not.toBeNull();
                const textarea = editor.querySelector('textarea');
                act(() => {
                    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
                    setter?.call(textarea, value);
                    textarea.dispatchEvent(new Event('input', { bubbles: true }));
                });
                const saveButton = Array.from(editor.querySelectorAll('button')).find((button) => button.textContent === 'Speichern');
                click(saveButton ?? null);
            };
            // Obere Markierung (Zeilen 0–2) und untere Markierung (Zeilen 9–10).
            dragExtra(0, 2);
            saveText('Urlaub');
            dragExtra(9, 10);
            saveText('Schulung');
            // Beide Texte liegen an ihren jeweiligen Ankern in derselben Spalte
            // `extra0` (Anker 2026-01-01 und 2026-01-10).
            const persisted = JSON.parse(window.localStorage.getItem('schichtkalender.state') ?? '{}');
            const first = persisted.annotations['2026-01-01']?.extraTexts?.extra0 ?? [];
            const second = persisted.annotations['2026-01-10']?.extraTexts?.extra0 ?? [];
            expect(first).toHaveLength(1);
            expect(second).toHaveLength(1);
            expect(first[0].text).toBe('Urlaub');
            expect(first[0].dateKeys).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
            expect(second[0].text).toBe('Schulung');
            expect(second[0].dateKeys).toEqual(['2026-01-10', '2026-01-11']);
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    /**
     * Regression: Eine über mehrere Tageszellen markierte Zusatzspalte wurde an
     * jeder Zeilengrenze von der dünnen horizontalen Zeilenlinie durchschnitten
     * und hatte durch das senkrechte Zellen-Padding der Zeile zusätzlich einen
     * weißen Rand. Die gefärbte Zelle wird nun um Padding plus Linienstärke über
     * die Zeilengrenzen hinausgezogen (negatives `margin`), damit der farbige
     * Streifen randlos und ungebrochen erscheint.
     */
    it('zieht gefärbte Zusatzspalten über Padding und Zeilenlinie (ungebrochen)', () => {
        const stylesheet = readStylesheet();
        const rule = /\.cell-extra\[style\]\s*\{[^}]*margin:\s*-4px\s+0/s;
        expect(rule.test(stylesheet)).toBe(true);
    });
    /**
     * Regression: Der querliegende Text der Zusatzspalten lag hinter dem
     * Farbstreifen der markierten Zelle. Die gefärbten Zellen werden über
     * `.cell-extra[style]` auf `z-index: 1` gehoben (durchgehender Streifen);
     * damit der Text sichtbar bleibt, muss die Überlagerungsebene einen höheren
     * Stapelwert besitzen - nicht nur die spätere DOM-Reihenfolge für sich nutzen.
     */
    it('legt den querliegenden Text über den Farbstreifen (sichtbar)', () => {
        const stylesheet = readStylesheet();
        const cellRule = /\.cell-extra\[style\]\s*\{([^}]*)\}/s.exec(stylesheet)?.[1] ?? '';
        const overlayRule = /\.day-table-overlay\s*\{([^}]*)\}/s.exec(stylesheet)?.[1] ?? '';
        const cellZ = Number(/z-index:\s*(-?\d+)/.exec(cellRule)?.[1] ?? 'NaN');
        const overlayZ = Number(/z-index:\s*(-?\d+)/.exec(overlayRule)?.[1] ?? 'NaN');
        expect(Number.isFinite(cellZ)).toBe(true);
        expect(Number.isFinite(overlayZ)).toBe(true);
        expect(overlayZ).toBeGreaterThan(cellZ);
    });
    /**
     * Regression: Der querliegende Text wurde mit `writing-mode: vertical-rl`
     * plus `transform: rotate(180deg)` gedreht. Ein `transform` legt das Element
     * auf eine eigene Compositing-Ebene, die der Browser beim Drucken als Bitmap
     * in Bildschirmauflösung rastert - der Text erschien im Ausdruck verpixelt.
     * `writing-mode: sideways-lr` erreicht dieselbe Leserichtung rein über
     * Textlayout und bleibt vektoriell (scharfer Druck).
     */
    it('dreht den querliegenden Text ohne transform (scharfer Druck)', () => {
        const stylesheet = readStylesheet();
        // Die Grundregel nutzt `sideways-lr` (vektoriell) ohne `transform`.
        const base = /\.cell-extra-text\.is-vertical\s*\{([^}]*)\}/s;
        const baseBody = base.exec(stylesheet)?.[1] ?? '';
        expect(baseBody).toContain('writing-mode: sideways-lr');
        expect(baseBody).not.toContain('transform');
        // Nur die Rückfallebene (ohne `sideways-lr`-Unterstützung) darf drehen.
        expect(/@supports not \(writing-mode: sideways-lr\)/.test(stylesheet)).toBe(true);
    });
    it('behält die angelegten Spalten über eine neue Sitzung', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const first = render(_jsx(App, {}));
            click(handle(first, 'left'));
            unmountAll();
            const second = render(_jsx(App, {}));
            expect(cardOf(second, 'Januar 2026')?.style.getPropertyValue('--extra-left-width')).toBe('1.6em');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('entfernt eine Zusatzspalte über den Minus-Bedienpunkt', () => {
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            // Ohne Spalte gibt es noch keinen Minus-Punkt.
            expect(container.querySelector('.column-remove-handle[data-extra-column-side="left"]')).toBeNull();
            // Zwei eigenständige Spalten links anlegen.
            click(handle(container, 'left'));
            click(handle(container, 'left'));
            expect(extraCellCount(cardOf(container, 'Januar 2026'))).toBe(2);
            // Minus-Punkt erscheint, sobald eine Spalte vorhanden ist.
            const minus = container.querySelector('.column-remove-handle[data-extra-column-side="left"]');
            expect(minus).not.toBeNull();
            // Erster Klick entfernt die Spalte an der Trennlinie vollständig.
            click(minus);
            expect(extraCellCount(cardOf(container, 'Januar 2026'))).toBe(1);
            expect(cardOf(container, 'Januar 2026')?.style.getPropertyValue('--extra-left-width')).toBe('1.6em');
            // Zweiter Klick entfernt die verbliebene Spalte vollständig.
            click(container.querySelector('.column-remove-handle[data-extra-column-side="left"]'));
            expect(extraCellCount(cardOf(container, 'Januar 2026'))).toBe(0);
            expect(container.querySelector('.column-remove-handle[data-extra-column-side="left"]')).toBeNull();
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    it('zeigt den querliegenden Text über die markierten Zellen', () => {
        window.localStorage.removeItem('schichtkalender.state');
        // Querliegenden Text für die Spanne 01.–03.01.2026 direkt vorbelegen.
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { ...DEFAULT_SETTINGS, extraColumns: { 1: { left: [1], right: [] } } },
            annotations: {
                '2026-01-01': {
                    dateKey: '2026-01-01',
                    label: '',
                    colors: {},
                    extraTexts: {
                        extra0: {
                            colorKey: 'extra0',
                            columnLabel: 'Zusatzspalte 0',
                            vertical: true,
                            text: 'Urlaub',
                            dateKeys: ['2026-01-01', '2026-01-02', '2026-01-03'],
                            length: 3,
                        },
                    },
                },
            },
            colorLegend: {},
            anniversaries: {},
        }));
        try {
            const container = render(_jsx(App, {}));
            const card = cardOf(container, 'Januar 2026');
            const overlay = card?.querySelector('.cell-extra-text');
            expect(overlay).not.toBeNull();
            expect(overlay?.textContent).toBe('Urlaub');
            // Querliegend: um 90° gedreht (Klasse is-vertical).
            expect(overlay?.classList.contains('is-vertical')).toBe(true);
            // Die Überlagerung liegt in der Ebene über dem Tagesraster und wird
            // gemessen platziert (die Rasterspalte dient nur der Zuordnung).
            expect(card?.querySelector('.day-table-overlay .cell-extra-text')).not.toBeNull();
            const element = overlay;
            const style = element.style;
            // Position als Inline-Stil (auch wenn jsdom keine echten Maße liefert).
            expect(style.left).not.toBe('');
            expect(style.top).not.toBe('');
            expect(style.width).not.toBe('');
            expect(style.height).not.toBe('');
            // Die Rasterspalte der Zusatzspalte (Wochentag | Datum | [links] | Info …).
            expect(element.getAttribute('data-grid-column')).toBe('3');
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
    /**
     * Regression: Der querliegende Text blieb auf einer eingefärbten
     * Zusatzspalte in der (im Dunkelmodus weißen) Standard-Textfarbe und war
     * damit auf dem satten Farbfeld unlesbar. Trägt die Spalte am Anker-Tag eine
     * persönliche Farbe, wird der Text - wie die übrigen Zellen einer
     * Farbmarkierung - in Schwarz gezeichnet (`has-color`).
     */
    it('färbt den querliegenden Text einer eingefärbten Zusatzspalte schwarz', () => {
        window.localStorage.removeItem('schichtkalender.state');
        window.localStorage.setItem('schichtkalender.state', JSON.stringify({
            version: 1,
            settings: { ...DEFAULT_SETTINGS, extraColumns: { 1: { left: [1], right: [] } } },
            annotations: {
                '2026-01-01': {
                    dateKey: '2026-01-01',
                    label: '',
                    colors: {},
                    extraColors: { extra0: 'red' },
                    extraTexts: {
                        extra0: {
                            colorKey: 'extra0',
                            columnLabel: 'Zusatzspalte 0',
                            vertical: true,
                            text: 'Urlaub',
                            dateKeys: ['2026-01-01', '2026-01-02', '2026-01-03'],
                            length: 3,
                        },
                    },
                },
            },
            colorLegend: {},
            anniversaries: {},
        }));
        try {
            const container = render(_jsx(App, {}));
            const card = cardOf(container, 'Januar 2026');
            const overlay = card?.querySelector('.cell-extra-text');
            expect(overlay).not.toBeNull();
            // Die eingefärbte Spalte ist markiert (Kontrastfarbe greift).
            expect(overlay?.classList.contains('has-color')).toBe(true);
            // Die zugehörige Regel setzt schwarze Schrift.
            const rule = /\.cell-extra-text\.has-color\s*\{[^}]*color:\s*#000000/s;
            expect(rule.test(readStylesheet())).toBe(true);
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
});
describe('Warnung bei ungespeicherten Daten', () => {
    it('blockiert das Schließen und zeigt den Hinweis, sobald Änderungen vorliegen', () => {
        // Frühere Renderaufrufe entfernen, damit nur diese App am window lauscht.
        unmountAll();
        window.localStorage.removeItem('schichtkalender.state');
        try {
            const container = render(_jsx(App, {}));
            // Ohne Änderungen (leerer Zustand): kein Blockieren.
            const clean = new Event('beforeunload', { cancelable: true });
            act(() => {
                window.dispatchEvent(clean);
            });
            expect(clean.defaultPrevented).toBe(false);
            expect(container.querySelector('.unsaved-dialog')).toBeNull();
            // Eine persönliche Markierung setzen (Tag öffnen, speichern).
            const row = container.querySelector('.day-row');
            expect(row).not.toBeNull();
            click(row);
            const editor = container.querySelector('.day-editor');
            expect(editor).not.toBeNull();
            const textarea = editor.querySelector('textarea');
            act(() => {
                // Der Change-Handler liest event.target.value.
                const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
                setter?.call(textarea, 'Notiz');
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            });
            const saveButton = Array.from(editor.querySelectorAll('button')).find((button) => button.textContent === 'Speichern');
            click(saveButton ?? null);
            // Nun gibt es ungespeicherte Änderungen: das Schließen wird blockiert.
            const blocked = new Event('beforeunload', { cancelable: true });
            act(() => {
                window.dispatchEvent(blocked);
            });
            expect(blocked.defaultPrevented).toBe(true);
            expect(container.querySelector('.unsaved-dialog')).not.toBeNull();
            expect(container.querySelector('.unsaved-dialog')?.textContent).toContain('Ungespeicherte Daten');
            // Abbrechen schließt nur das Hinweisfenster und kehrt zur App zurück.
            const cancel = Array.from(container.querySelectorAll('.unsaved-dialog button')).find((button) => button.textContent === 'Abbrechen');
            click(cancel ?? null);
            expect(container.querySelector('.unsaved-dialog')).toBeNull();
        }
        finally {
            window.localStorage.removeItem('schichtkalender.state');
        }
    });
});
describe('ThemeStore', () => {
    it('fällt bei unbekannten oder fehlenden Werten auf den Dunkelmodus zurück', () => {
        expect(readThemePreference(null, '')).toBe('dark');
        expect(readThemePreference({ getItem: () => 'neon', setItem: () => undefined }, '')).toBe('dark');
        expect(readThemePreference({ getItem: () => null, setItem: () => undefined }, '')).toBe('dark');
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
    it('löst die gespeicherte Einstellung direkt auf', () => {
        // Ohne Modus "System" entspricht das angewendete Theme der Einstellung.
        const storage = { getItem: () => 'light', setItem: () => undefined };
        expect(readThemePreference(storage, '')).toBe('light');
        expect(readThemePreference({ getItem: () => 'dark', setItem: () => undefined }, '')).toBe('dark');
    });
    it('setzt das Theme-Attribut am Wurzelelement', () => {
        applyTheme('dark');
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('dark');
        applyTheme('light');
        expect(document.documentElement.getAttribute(THEME_ATTRIBUTE)).toBe('light');
    });
});
