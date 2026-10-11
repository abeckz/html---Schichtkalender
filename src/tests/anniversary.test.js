import { jsx as _jsx } from "react/jsx-runtime";
/**
 * Tests für die jahreslosen Jahrestage (Geburtstage und wiederkehrende
 * Ereignisse) sowie für den zugehörigen Modus der Bildschirmansicht.
 *
 * Abgedeckt werden:
 * - AnniversaryEngine: Alter, Wiederholungsintervall, Zuordnung zu Tagen,
 * - Normalisierung (Storage) von Jahrestagen,
 * - Bildschirmansicht: Schicht-Ausblendung, Geburtstagsanzeige mit 🎂 und
 *   Alter in Klammern, jahreslose Ansicht und zweispaltiger Editor.
 */
/* @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { ageInYear, anniversariesAt, formatIntervalLabel, occursInYear, matchesForDateKey, } from '../engines/anniversaryEngine.ts';
import { STORAGE_VERSION, normalizeAnniversaries, normalizeAnniversary, normalizeAnniversaryIntervalCount, readState, writeState, } from '../services/storage.ts';
import { DEFAULT_SETTINGS } from '../config/appDefaults.ts';
import { App } from '../components/App.tsx';
/* ------------------------------------------------------------ Engine */
describe('AnniversaryEngine', () => {
    it('berechnet das Alter nur mit gültigem Geburtsjahr', () => {
        expect(ageInYear(1990, 2026)).toBe(36);
        expect(ageInYear(2026, 2026)).toBe(0);
        expect(ageInYear(2030, 2026)).toBeNull();
        expect(ageInYear(undefined, 2026)).toBeNull();
    });
    it('zeigt wiederkehrende Ereignisse passend zum Rhythmus', () => {
        expect(occursInYear({ id: 'a', monthDay: '05-01', name: 'x', kind: 'recurring', intervalKind: 'yearly', intervalCount: 1 }, 2026)).toBe(true);
        // Alle 5 Jahre mit Basisjahr 2000: 2025 und 2030 treffen, 2026 nicht.
        const entry = {
            id: 'b',
            monthDay: '05-01',
            name: 'y',
            kind: 'recurring',
            intervalKind: 'yearly',
            intervalCount: 5,
        };
        expect(occursInYear(entry, 2025, 2000)).toBe(true);
        expect(occursInYear(entry, 2030, 2000)).toBe(true);
        expect(occursInYear(entry, 2026, 2000)).toBe(false);
    });
    it('deckt alle gängigen Wiederholungen in der Jahresprüfung ab', () => {
        const anchor = (overrides) => ({
            id: 'x',
            monthDay: '05-01',
            name: 'x',
            kind: 'recurring',
            ...overrides,
        });
        // Täglich: mindestens ein Termin je Jahr.
        expect(occursInYear(anchor({ intervalKind: 'daily', intervalCount: 1 }), 2026)).toBe(true);
        // Wöchentlich: mindestens ein Termin je Jahr.
        expect(occursInYear(anchor({ intervalKind: 'weekly', intervalCount: 1 }), 2026)).toBe(true);
        // Monatlich mit Zähler 3: Quartalsmonate sind Januar, April, Juli, Oktober
        // (Monatsindex ab Januar 2000: (m-1) % 3 === 0). Mai liegt nicht im Raster.
        const quarterly = anchor({ intervalKind: 'monthly', intervalCount: 3 });
        expect(occursInYear(quarterly, 2026)).toBe(false);
        const january = { ...quarterly, monthDay: '01-10' };
        expect(occursInYear(january, 2026)).toBe(true);
        const april = { ...quarterly, monthDay: '04-10' };
        expect(occursInYear(april, 2026)).toBe(true);
        // Alle 2 Jahre im Mai: (Jahr - 2000) % 2 === 0, d. h. 2024 und 2026 treffen.
        const biennial = anchor({ intervalKind: 'yearly', intervalCount: 2 });
        expect(occursInYear(biennial, 2024, 2000)).toBe(true);
        expect(occursInYear(biennial, 2026, 2000)).toBe(true);
        expect(occursInYear(biennial, 2025, 2000)).toBe(false);
    });
    it('ordnet Geburtstag und Alter einem Kalendertag zu', () => {
        const map = {
            '03-15': [{ id: 'b1', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 }],
        };
        const matches = matchesForDateKey(map, '2026-03-15', 2026);
        expect(matches).toHaveLength(1);
        expect(matches[0].age).toBe(36);
        expect(matches[0].entry.name).toBe('Anna');
        // Ein anderer Tag liefert keinen Treffer.
        expect(matchesForDateKey(map, '2026-03-16', 2026)).toEqual([]);
    });
    it('berücksichtigt Geburtstag und Ereignis am selben Tag', () => {
        const map = {
            '03-15': [
                { id: 'b1', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 },
                { id: 'r1', monthDay: '03-15', name: 'Jubiläum', kind: 'recurring', interval: 1 },
            ],
        };
        const matches = matchesForDateKey(map, '2026-03-15', 2026);
        expect(matches).toHaveLength(2);
        expect(matches.map((match) => match.entry.kind)).toEqual(['birthday', 'recurring']);
    });
    it('liefert an einem Tag mehrere Geburtstage und mehrere Ereignisse', () => {
        const map = {
            '03-15': [
                { id: 'b1', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 },
                { id: 'b2', monthDay: '03-15', name: 'Bert', kind: 'birthday', birthYear: 1985 },
                { id: 'r1', monthDay: '03-15', name: 'Jubiläum', kind: 'recurring', intervalKind: 'yearly', intervalCount: 1 },
                { id: 'r2', monthDay: '03-15', name: 'Wartung', kind: 'recurring', intervalKind: 'daily', intervalCount: 1 },
            ],
        };
        const matches = matchesForDateKey(map, '2026-03-15', 2026);
        // Zwei Geburtstage und zwei wiederkehrende Ereignisse am selben Tag.
        expect(matches.filter((match) => match.entry.kind === 'birthday')).toHaveLength(2);
        expect(matches.filter((match) => match.entry.kind === 'recurring')).toHaveLength(2);
        const names = matches.map((match) => match.entry.name);
        expect(names).toContain('Anna');
        expect(names).toContain('Bert');
        expect(names).toContain('Jubiläum');
        expect(names).toContain('Wartung');
        // Das Alter wird je Geburtstag individuell berechnet.
        const anna = matches.find((match) => match.entry.name === 'Anna');
        const bert = matches.find((match) => match.entry.name === 'Bert');
        expect(anna?.age).toBe(36);
        expect(bert?.age).toBe(41);
    });
    it('liefert die Einträge eines Monat-Tag-Schlüssels', () => {
        const map = {
            '12-24': [{ id: 'r1', monthDay: '12-24', name: 'Firma', kind: 'recurring', intervalKind: 'yearly', intervalCount: 1 }],
        };
        expect(anniversariesAt(map, '12-24')).toHaveLength(1);
        expect(anniversariesAt(map, '12-24')[0].name).toBe('Firma');
        expect(anniversariesAt(map, '12-25')).toEqual([]);
    });
    it('trifft Termine exakt über den Rhythmus (Tag, Woche, Monat)', () => {
        // Anker 06.03.2000: ein Montag.
        const anchor = (overrides) => ({
            id: 'x',
            monthDay: '03-06',
            name: 'x',
            kind: 'recurring',
            ...overrides,
        });
        // Täglich mit Zähler 10: der Anker selbst zählt als erster Termin.
        const daily = anchor({ intervalKind: 'daily', intervalCount: 10 });
        const map = { '03-06': [daily] };
        expect(matchesForDateKey(map, '2000-03-06', 2000)).toHaveLength(1);
        expect(matchesForDateKey(map, '2000-03-16', 2000)).toHaveLength(1);
        expect(matchesForDateKey(map, '2000-03-11', 2000)).toHaveLength(0);
        // Wöchentlich mit Zähler 2: nur montags in geraden Wochen ab dem Anker.
        // 03.04.2000 liegt 4 Wochen nach dem Anker (gerade) und ist ein Montag.
        const weekly = anchor({ intervalKind: 'weekly', intervalCount: 2 });
        const weeklyMap = { '03-06': [weekly] };
        expect(matchesForDateKey(weeklyMap, '2000-04-03', 2000)).toHaveLength(1);
        // 10.04.2000 ist Montag, liegt aber in einer ungeraden Woche.
        expect(matchesForDateKey(weeklyMap, '2000-04-10', 2000)).toHaveLength(0);
        // 08.03.2000 ist kein Montag.
        expect(matchesForDateKey(weeklyMap, '2000-03-08', 2000)).toHaveLength(0);
        // Monatlich mit Zähler 1: jeden 1. Montag im Monat.
        // April 2000: 03.04. ist der 1. Montag, 10.04. der 2. Montag.
        const monthly = anchor({ intervalKind: 'monthly', intervalCount: 1 });
        const monthlyMap = { '03-06': [monthly] };
        expect(matchesForDateKey(monthlyMap, '2000-04-03', 2000)).toHaveLength(1);
        expect(matchesForDateKey(monthlyMap, '2000-04-10', 2000)).toHaveLength(0);
    });
    it('zeigt ein tägliches Ereignis auch an Tagen ohne eigenen Eintrag an', () => {
        // Nur ein Anker (06.03.) liegt in der Map; der Rhythmus trägt den Termin
        // auf alle 10 Tage. Genau das konnte das frühere Modell (nur Jahre) nicht.
        const map = {
            '03-06': [
                {
                    id: 'r1',
                    monthDay: '03-06',
                    name: 'Zinslauf',
                    kind: 'recurring',
                    intervalKind: 'daily',
                    intervalCount: 10,
                },
            ],
        };
        const matches = matchesForDateKey(map, '2000-03-16', 2000);
        expect(matches).toHaveLength(1);
        expect(matches[0].entry.name).toBe('Zinslauf');
    });
    it('beschreibt den Rhythmus in Kurzform', () => {
        // Anker 06.03.2000: Montag und zugleich 1. Montag im Monat.
        const entry = (overrides) => ({
            id: 'x',
            monthDay: '03-06',
            name: 'x',
            kind: 'recurring',
            ...overrides,
        });
        expect(formatIntervalLabel(entry({ intervalKind: 'yearly', intervalCount: 1 }))).toBe('jedes Jahr');
        expect(formatIntervalLabel(entry({ intervalKind: 'yearly', intervalCount: 5 }))).toBe('alle 5 Jahre');
        expect(formatIntervalLabel(entry({ intervalKind: 'daily', intervalCount: 90 }))).toBe('alle 90 Tage');
        expect(formatIntervalLabel(entry({ intervalKind: 'weekly', intervalCount: 1 }))).toBe('wöchentlich');
        expect(formatIntervalLabel(entry({ intervalKind: 'monthly', intervalCount: 1 }))).toBe('jeden Mo im Monat (monatlich)');
        expect(formatIntervalLabel(entry({ intervalKind: 'monthly', intervalCount: 3 }))).toBe('jeden Mo im Monat (alle 3 Monate)');
        // Zweiter Montag im Monat: 13.03.2000.
        expect(formatIntervalLabel({ ...entry({ intervalKind: 'monthly', intervalCount: 1 }), monthDay: '03-13' })).toBe('jeden 2. Mo im Monat (monatlich)');
    });
});
/* ------------------------------------------------------------ Storage */
describe('Normalisierung der Jahrestage', () => {
    it('akzeptiert gültige Geburtstage und wiederkehrende Ereignisse', () => {
        expect(normalizeAnniversary({ monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 })).toEqual({ id: '03-15', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 });
        expect(normalizeAnniversary({
            monthDay: '05-01',
            name: 'Jubiläum',
            kind: 'recurring',
            intervalKind: 'yearly',
            intervalCount: 5,
        })).toEqual({
            id: '05-01',
            monthDay: '05-01',
            name: 'Jubiläum',
            kind: 'recurring',
            intervalKind: 'yearly',
            intervalCount: 5,
        });
    });
    it('übernimmt ältere Einträge mit Jahresintervall als jährlichen Rhythmus', () => {
        expect(normalizeAnniversary({ monthDay: '05-01', name: 'Jubiläum', kind: 'recurring', interval: 5 })).toEqual({
            id: '05-01',
            monthDay: '05-01',
            name: 'Jubiläum',
            kind: 'recurring',
            intervalKind: 'yearly',
            intervalCount: 5,
        });
        // Ohne Rhythmusangabe gilt „jedes Jahr".
        const plain = normalizeAnniversary({ monthDay: '05-01', name: 'Fest', kind: 'recurring' });
        expect(plain?.intervalKind).toBe('yearly');
        expect(plain?.intervalCount).toBe(1);
    });
    it('verwirft ungültige Einträge ohne zu werfen', () => {
        expect(normalizeAnniversary(null)).toBeNull();
        expect(normalizeAnniversary({ monthDay: '13-40', name: 'x', kind: 'birthday' })).toBeNull();
        expect(normalizeAnniversary({ monthDay: '03-15', name: '', kind: 'birthday' })).toBeNull();
        expect(normalizeAnniversary({ monthDay: '03-15', name: 'x', kind: 'other' })).toBeNull();
    });
    it('begrenzt den Rhythmus-Zähler je Rhythmus-Art', () => {
        expect(normalizeAnniversaryIntervalCount(0, 'yearly')).toBe(1);
        expect(normalizeAnniversaryIntervalCount(5, 'yearly')).toBe(5);
        expect(normalizeAnniversaryIntervalCount(1000, 'yearly')).toBe(99);
        expect(normalizeAnniversaryIntervalCount('x', 'yearly')).toBe(1);
        // Tagesrhythmus erlaubt bis zu 365 Tage.
        expect(normalizeAnniversaryIntervalCount(250, 'daily')).toBe(250);
        expect(normalizeAnniversaryIntervalCount(1000, 'daily')).toBe(365);
        // Unbekannte Rhythmus-Arten fallen auf „jedes Jahr" zurück.
        expect(normalizeAnniversary({ monthDay: '05-01', name: 'x', kind: 'recurring', intervalKind: 'stündlich' })?.intervalKind).toBe('yearly');
    });
    it('bereinigt eine Sammlung und gruppiert nach Monat-Tag', () => {
        const map = normalizeAnniversaries([
            { monthDay: '03-15', name: 'Anna', kind: 'birthday' },
            { monthDay: '03-15', name: 'Bert', kind: 'birthday' },
            { monthDay: '03-15', name: 'Geburtstag', kind: 'recurring', intervalKind: 'yearly', intervalCount: 1 },
            { monthDay: 'ungültig', name: 'x', kind: 'birthday' },
        ]);
        // Ein Tag mit mehreren Geburtstagen und einem Ereignis bleibt erhalten.
        expect(Object.keys(map)).toEqual(['03-15']);
        expect(map['03-15']).toHaveLength(3);
        // Geburtstage zuerst, dann wiederkehrende Ereignisse.
        expect(map['03-15'].map((entry) => entry.kind)).toEqual(['birthday', 'birthday', 'recurring']);
        expect(map['03-15'][0].name).toBe('Anna');
        expect(map['03-15'][1].name).toBe('Bert');
    });
    it('übernimmt ältere nach "MM-DD:kind" indizierte Zustände', () => {
        const map = normalizeAnniversaries({
            '03-15:birthday': { id: 'b1', monthDay: '03-15', name: 'Anna', kind: 'birthday' },
            '03-15:recurring': { id: 'r1', monthDay: '03-15', name: 'Jubiläum', kind: 'recurring', interval: 1 },
        });
        expect(map['03-15']).toHaveLength(2);
        expect(map['03-15'].map((entry) => entry.kind)).toEqual(['birthday', 'recurring']);
        expect(map['03-15'][0].name).toBe('Anna');
        expect(map['03-15'][1].name).toBe('Jubiläum');
    });
    it('gruppiert eine flache Liste nach Monat-Tag', () => {
        const map = normalizeAnniversaries([
            { monthDay: '07-01', name: 'Ben', kind: 'birthday' },
            { monthDay: '12-24', name: 'Firma', kind: 'recurring', intervalKind: 'yearly', intervalCount: 1 },
            { monthDay: '07-01', name: 'Fest', kind: 'recurring', intervalKind: 'daily', intervalCount: 5 },
        ]);
        expect(Object.keys(map).sort()).toEqual(['07-01', '12-24']);
        expect(map['07-01']).toHaveLength(2);
    });
    it('rundreist Jahrestage über readState/writeState verlustfrei', () => {
        const map = {
            '07-01': [
                { id: 'b', monthDay: '07-01', name: 'Ben', kind: 'birthday', birthYear: 2000 },
                {
                    id: 'r',
                    monthDay: '07-01',
                    name: 'Zinslauf',
                    kind: 'recurring',
                    intervalKind: 'daily',
                    intervalCount: 90,
                },
            ],
        };
        const storage = {
            data: {},
            getItem(key) {
                return this.data[key] ?? null;
            },
            setItem(key, value) {
                this.data[key] = value;
            },
            removeItem(key) {
                delete this.data[key];
            },
        };
        writeState({
            version: STORAGE_VERSION,
            settings: DEFAULT_SETTINGS,
            annotations: {},
            colorLegend: {},
            anniversaries: map,
        }, storage);
        expect(readState(storage).anniversaries).toEqual(map);
    });
    it('ergänzt in älteren Zuständen die Anzeige-Checkboxen als Standards', () => {
        const storage = {
            data: {
                'schichtkalender.state': JSON.stringify({
                    version: 1,
                    settings: { selectedYear: 2021, selectedShift: 'C' },
                    annotations: {},
                }),
            },
            getItem(key) {
                return this.data[key] ?? null;
            },
            setItem() { },
            removeItem() { },
        };
        const state = readState(storage);
        expect(state.settings.showShiftCalendar).toBe(true);
        expect(state.settings.showBirthdays).toBe(true);
        expect(state.settings.showRecurringEvents).toBe(true);
        expect(state.settings.viewMode).toBe('shift');
        expect(state.anniversaries).toEqual({});
    });
});
/* ------------------------------------------------------------ UI */
const mountedRoots = [];
function unmountAll() {
    for (const entry of mountedRoots.splice(0)) {
        act(() => entry.root.unmount());
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
const STATE_KEY = 'schichtkalender.state';
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
/**
 * Findet ein Anzeige-Kästchen über die sichtbare Beschriftung.
 *
 * Die Kästchen sind echte `<input type="checkbox">`-Elemente; das Label trägt
 * die Beschriftung als `aria-labelledby`-Ziel.
 */
function checkboxByLabel(container, label) {
    return (Array.from(container.querySelectorAll('.checkbox-input')).find((element) => {
        const labelledBy = element.getAttribute('aria-labelledby');
        if (!labelledBy)
            return false;
        const labelElement = document.getElementById(labelledBy);
        return container.contains(labelElement) && labelElement?.textContent === label;
    }) ?? null);
}
/** Klickt ein Kästchen fachgerecht (löst change aus). */
function toggleCheckbox(element) {
    if (!element)
        throw new Error('Kästchen nicht gefunden.');
    act(() => {
        element.click();
    });
}
/** Findet eine Schaltfläche über ihren sichtbaren Text (innerhalb von root). */
function buttonByText(root, text) {
    const button = Array.from(root.querySelectorAll('button')).find((candidate) => candidate.textContent?.trim() === text);
    if (!button)
        throw new Error(`Schaltfläche "${text}" nicht gefunden.`);
    return button;
}
/** Setzt den Wert eines Eingabefelds fachgerecht (löst input aus). */
function setInputValue(input, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
}
/** Setzt den Wert einer Auswahl fachgerecht (löst change aus). */
function setSelectValue(select, value) {
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
}
describe('Anzeige-Kästchen der regulären Ansicht', () => {
    it('schaltet die Schichtspalte über das Kästchen "Schichtkalender" aus', () => {
        const container = render(_jsx(App, {}));
        expect(container.querySelectorAll('.cell-shift').length).toBeGreaterThan(0);
        toggleCheckbox(checkboxByLabel(container, 'Schichtkalender'));
        expect(container.querySelectorAll('.cell-shift').length).toBe(0);
        toggleCheckbox(checkboxByLabel(container, 'Schichtkalender'));
        expect(container.querySelectorAll('.cell-shift').length).toBeGreaterThan(0);
        unmountAll();
    });
    it('blendet Geburtstage über das Kästchen "Geburtstage" aus', () => {
        window.localStorage.setItem(STATE_KEY, JSON.stringify({
            version: 1,
            settings: { ...DEFAULT_SETTINGS, selectedYear: 2021 },
            annotations: {},
            anniversaries: {
                '03-15': [
                    { id: 'b', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 },
                ],
            },
        }));
        try {
            const container = render(_jsx(App, {}));
            expect(container.textContent).toContain('🎂 Anna');
            expect(container.textContent).toContain('(31)');
            toggleCheckbox(checkboxByLabel(container, 'Geburtstage'));
            expect(container.textContent).not.toContain('🎂 Anna');
        }
        finally {
            window.localStorage.removeItem(STATE_KEY);
            unmountAll();
        }
    });
    it('blendet wiederkehrende Ereignisse über das Kästchen aus', () => {
        window.localStorage.setItem(STATE_KEY, JSON.stringify({
            version: 1,
            settings: { ...DEFAULT_SETTINGS, selectedYear: 2021 },
            annotations: {},
            anniversaries: {
                '03-15': [
                    {
                        id: 'r',
                        monthDay: '03-15',
                        name: 'Jubiläum',
                        kind: 'recurring',
                        intervalKind: 'yearly',
                        intervalCount: 1,
                    },
                ],
            },
        }));
        try {
            const container = render(_jsx(App, {}));
            expect(container.textContent).toContain('🔁 Jubiläum');
            toggleCheckbox(checkboxByLabel(container, 'Wiederkehrende Ereignisse'));
            expect(container.textContent).not.toContain('🔁 Jubiläum');
        }
        finally {
            window.localStorage.removeItem(STATE_KEY);
            unmountAll();
        }
    });
});
describe('Jahreslose Ansicht', () => {
    it('schaltet über den Modus-Umschalter um und zeigt die zwölf Monate', () => {
        const container = render(_jsx(App, {}));
        click(toggleByLabel(container, 'Geburtstag & wiederkehrende Ereignisse'));
        const view = container.querySelector('.anniversary-year-calendar');
        expect(view).not.toBeNull();
        expect(view.querySelectorAll('.anniversary-month-card').length).toBe(12);
        // Keine Schichtspalte in der jahreslosen Ansicht.
        expect(view.querySelectorAll('.cell-shift').length).toBe(0);
        unmountAll();
    });
});
describe('AnniversaryEditor', () => {
    /**
     * Öffnet den AnniversaryEditor des 15.03. über die jahreslose Ansicht.
     *
     * In der regulären Schichtansicht öffnet ein Klick in eine Zelle immer den
     * Tageseditor; Geburtstage und wiederkehrende Ereignisse sind dort reine
     * Anzeige. Bearbeitet werden sie ausschließlich in der jahreslosen Ansicht
     * (Modus-Umschalter), in der ein Zellklick direkt den zweispaltigen Editor
     * öffnet.
     */
    function openMarch15Editor(container) {
        click(toggleByLabel(container, 'Geburtstag & wiederkehrende Ereignisse'));
        const march = Array.from(container.querySelectorAll('.anniversary-month-card')).find((card) => card.querySelector('.month-title')?.textContent === 'März');
        const row = Array.from(march.querySelectorAll('.anniversary-row')).find((candidate) => candidate.querySelector('.cell-day')?.textContent === '15');
        expect(row).toBeDefined();
        click(row);
        const editor = container.querySelector('.anniversary-editor');
        expect(editor).not.toBeNull();
        return editor;
    }
    /**
     * Fehlverhalten (Regression): In der Schichtansicht öffnete ein Klick in die
     * (breite) Info-Zelle den Geburtstags-/Ereignis-Editor. Geburtstage und
     * wiederkehrende Ereignisse sind im Schichtkalender jedoch reine Anzeige: Ein
     * Klick in die Zeile muss immer den Tageseditor (Beschriftung/Farbe) öffnen.
     */
    it('öffnet in der Schichtansicht immer den Tageseditor, auch mit angezeigtem Jahrestag', () => {
        window.localStorage.setItem(STATE_KEY, JSON.stringify({
            version: 1,
            settings: { ...DEFAULT_SETTINGS, selectedYear: 2021, viewMode: 'shift' },
            annotations: {},
            anniversaries: {
                '03-15': [{ id: 'b1', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 }],
            },
        }));
        try {
            const container = render(_jsx(App, {}));
            const march = Array.from(container.querySelectorAll('.month-card')).find((card) => card.querySelector('.month-title')?.textContent === 'März');
            const row = Array.from(march.querySelectorAll('.day-row')).find((candidate) => candidate.querySelector('.cell-day')?.textContent === '15');
            expect(row).toBeDefined();
            const infoCell = row.querySelector('.cell-information');
            // Die Info-Zelle ist reine Anzeige und kein Editor-Button.
            expect(infoCell.getAttribute('role')).toBeNull();
            // Der Geburtstag wird im Schichtkalender angezeigt.
            expect(infoCell.textContent).toContain('🎂 Anna');
            click(infoCell);
            expect(container.querySelector('.day-editor')).not.toBeNull();
            expect(container.querySelector('.anniversary-editor')).toBeNull();
        }
        finally {
            window.localStorage.removeItem(STATE_KEY);
            unmountAll();
        }
    });
    /**
     * Der Tageseditor-Eintrag (Beschriftung) wird zusätzlich zu Geburtstagen und
     * wiederkehrenden Ereignissen angezeigt; bei vorhandener Beschriftung wird
     * die Zelle über `has-annotation-entry` mehrzeilig umgebrochen.
     */
    it('zeigt Beschriftung zusätzlich zu Jahrestagen und bricht dann mehrzeilig um', () => {
        window.localStorage.setItem(STATE_KEY, JSON.stringify({
            version: 1,
            settings: { ...DEFAULT_SETTINGS, selectedYear: 2021, viewMode: 'shift' },
            annotations: {
                '2021-03-15': { dateKey: '2021-03-15', label: 'Frühschicht', colors: { info: 'green' } },
            },
            anniversaries: {
                '03-15': [{ id: 'b1', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 }],
            },
        }));
        try {
            const container = render(_jsx(App, {}));
            const march = Array.from(container.querySelectorAll('.month-card')).find((card) => card.querySelector('.month-title')?.textContent === 'März');
            const row = Array.from(march.querySelectorAll('.day-row')).find((candidate) => candidate.querySelector('.cell-day')?.textContent === '15');
            expect(row).toBeDefined();
            const infoCell = row.querySelector('.cell-information');
            // Beides steht in derselben Zelle: Beschriftung und Jahrestag.
            expect(infoCell.textContent).toContain('Frühschicht');
            expect(infoCell.textContent).toContain('🎂 Anna');
            // Bei vorhandener Beschriftung wird mehrzeilig umgebrochen.
            expect(infoCell.classList.contains('has-annotation-entry')).toBe(true);
            // Beschriftung (1 Zeile) + Geburtstag (1 Zeile) → zwei Zeilen: die
            // Schrift folgt der DayEditor-Regel und wird kleiner (label-lines-2).
            expect(infoCell.classList.contains('label-lines-2')).toBe(true);
            // Die Jahrestage stehen ganz oben, der Tageseditor-Eintrag darunter.
            const children = Array.from(infoCell.children);
            expect(children[0].classList.contains('cell-anniversaries')).toBe(true);
            expect(children[1].classList.contains('cell-information-text')).toBe(true);
            expect(infoCell.querySelector('.cell-information-text')?.textContent).toBe('Frühschicht');
            // Nur der Tageseditor-Eintrag ist eingefärbt; die Jahrestage nicht.
            const infoText = infoCell.querySelector('.cell-information-text');
            expect(infoText.style.backgroundColor).not.toBe('');
            const anniversaries = infoCell.querySelector('.cell-anniversaries');
            expect(anniversaries.style.backgroundColor).toBe('');
            expect(infoCell.style.backgroundColor).toBe('');
        }
        finally {
            window.localStorage.removeItem(STATE_KEY);
            unmountAll();
        }
    });
    it('speichert mehrere Geburtstage und mehrere wiederkehrende Ereignisse', () => {
        window.localStorage.setItem(STATE_KEY, JSON.stringify({
            version: 1,
            settings: { ...DEFAULT_SETTINGS, selectedYear: 2021 },
            annotations: {},
            anniversaries: {},
        }));
        try {
            const container = render(_jsx(App, {}));
            const editor = openMarch15Editor(container);
            // Zweispaltig: links Geburtstage, rechts wiederkehrende Ereignisse.
            expect(editor.querySelector('.anniversary-editor-columns')).not.toBeNull();
            expect(editor.querySelectorAll('.anniversary-column').length).toBe(2);
            // Zwei Geburtstage und zwei wiederkehrende Ereignisse anlegen.
            act(() => buttonByText(editor, '＋ Geburtstag hinzufügen').click());
            act(() => buttonByText(editor, '＋ Geburtstag hinzufügen').click());
            act(() => buttonByText(editor, '＋ Ereignis hinzufügen').click());
            act(() => buttonByText(editor, '＋ Ereignis hinzufügen').click());
            const birthdayColumn = editor.querySelectorAll('.anniversary-column')[0];
            const recurringColumn = editor.querySelectorAll('.anniversary-column')[1];
            expect(birthdayColumn.querySelectorAll('.anniversary-entry-row').length).toBe(2);
            expect(recurringColumn.querySelectorAll('.anniversary-entry-row').length).toBe(2);
            // Namen und Geburtsjahre befüllen.
            const birthdayRows = Array.from(birthdayColumn.querySelectorAll('.anniversary-entry-row'));
            act(() => {
                setInputValue(birthdayRows[0].querySelector('input[type="text"]'), 'Anna');
                setInputValue(birthdayRows[0].querySelector('input[type="number"]'), '1990');
                setInputValue(birthdayRows[1].querySelector('input[type="text"]'), 'Bert');
            });
            // Namen und Rhythmen der Ereignisse befüllen.
            const recurringRows = Array.from(recurringColumn.querySelectorAll('.anniversary-entry-row'));
            act(() => {
                setInputValue(recurringRows[0].querySelector('input[type="text"]'), 'Jubiläum');
                setInputValue(recurringRows[1].querySelector('input[type="text"]'), 'Wartung');
            });
            // Erstes Ereignis: „Alle X Tage" mit dem Zähler 90.
            act(() => {
                setSelectValue(recurringRows[0].querySelector('select'), 'daily-n');
            });
            const countInput = recurringRows[0].querySelector('input[type="number"]');
            expect(countInput).not.toBeNull();
            act(() => setInputValue(countInput, '90'));
            act(() => buttonByText(editor, 'Speichern').click());
            const persisted = JSON.parse(window.localStorage.getItem(STATE_KEY) ?? '{}');
            const day = persisted.anniversaries['03-15'];
            expect(Array.isArray(day)).toBe(true);
            expect(day).toHaveLength(4);
            expect(day.filter((entry) => entry.kind === 'birthday')).toHaveLength(2);
            expect(day.filter((entry) => entry.kind === 'recurring')).toHaveLength(2);
            expect(day.some((entry) => entry.name === 'Anna' && entry.birthYear === 1990)).toBe(true);
            expect(day.some((entry) => entry.name === 'Bert')).toBe(true);
            expect(day.some((entry) => entry.name === 'Jubiläum' &&
                entry.intervalKind === 'daily' &&
                entry.intervalCount === 90)).toBe(true);
            expect(day.some((entry) => entry.name === 'Wartung')).toBe(true);
            // Zurück in die Schichtansicht: dort werden Geburtstage mit Alter
            // (2021 - 1990 = 31) und wiederkehrende Ereignisse mit Rhythmus angezeigt.
            click(toggleByLabel(container, 'Geburtstag & wiederkehrende Ereignisse'));
            expect(container.textContent).toContain('🎂 Anna');
            expect(container.textContent).toContain('(31)');
            expect(container.textContent).toContain('🎂 Bert');
        }
        finally {
            window.localStorage.removeItem(STATE_KEY);
            unmountAll();
        }
    });
    it('lädt vorhandene Einträge eines Tages und entfernt sie per "Entfernen"', () => {
        window.localStorage.setItem(STATE_KEY, JSON.stringify({
            version: 1,
            settings: { ...DEFAULT_SETTINGS, selectedYear: 2021 },
            annotations: {},
            anniversaries: {
                '03-15': [
                    { id: 'b1', monthDay: '03-15', name: 'Anna', kind: 'birthday', birthYear: 1990 },
                    { id: 'b2', monthDay: '03-15', name: 'Bert', kind: 'birthday' },
                    { id: 'r1', monthDay: '03-15', name: 'Jubiläum', kind: 'recurring', intervalKind: 'yearly', intervalCount: 1 },
                ],
            },
        }));
        try {
            const container = render(_jsx(App, {}));
            const editor = openMarch15Editor(container);
            const birthdayColumn = editor.querySelectorAll('.anniversary-column')[0];
            const recurringColumn = editor.querySelectorAll('.anniversary-column')[1];
            // Bestehende Zeilen werden geladen.
            expect(birthdayColumn.querySelectorAll('.anniversary-entry-row').length).toBe(2);
            expect(recurringColumn.querySelectorAll('.anniversary-entry-row').length).toBe(1);
            // Den zweiten Geburtstag (Bert) entfernen.
            const removeButtons = Array.from(birthdayColumn.querySelectorAll('.row-remove-button'));
            act(() => removeButtons[1].click());
            expect(birthdayColumn.querySelectorAll('.anniversary-entry-row').length).toBe(1);
            act(() => buttonByText(editor, 'Speichern').click());
            const persisted = JSON.parse(window.localStorage.getItem(STATE_KEY) ?? '{}');
            const day = persisted.anniversaries['03-15'];
            expect(day).toHaveLength(2);
            expect(day.some((entry) => entry.name === 'Bert')).toBe(false);
            expect(day.some((entry) => entry.name === 'Anna')).toBe(true);
            expect(day.some((entry) => entry.name === 'Jubiläum')).toBe(true);
        }
        finally {
            window.localStorage.removeItem(STATE_KEY);
            unmountAll();
        }
    });
});
