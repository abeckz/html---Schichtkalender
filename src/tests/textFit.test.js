/**
 * Tests für die adaptive Schriftgröße mehrzeiliger Beschriftungen.
 *
 * Abgesichert wird die reine, messfreie Logik aus `utils/textFit.ts`:
 * Zeilenzählung, Schriftgrößenwahl und die CSS-Klasse für die Zeilensteuerung.
 */
import { describe, expect, it } from 'vitest';
import { EVENT_EXTRA_LINES, LABEL_CHARS_PER_LINE, MAX_LABEL_LINES, MIN_LABEL_FONT_SIZE, cellFitFontSize, cellLineClass, countCellLines, countLabelLines, fitFontSize, informationLineClass, labelLineClass, } from '../utils/textFit';
describe('countLabelLines', () => {
    it('liefert 0 für eine leere Beschriftung', () => {
        expect(countLabelLines('')).toBe(0);
    });
    it('zählt eine kurze Beschriftung als eine Zeile', () => {
        expect(countLabelLines('Urlaub')).toBe(1);
        expect(countLabelLines('x'.repeat(LABEL_CHARS_PER_LINE))).toBe(1);
    });
    it('zählt harte Umbrüche als eigene Zeilen', () => {
        expect(countLabelLines('Urlaub\nArzt')).toBe(2);
        expect(countLabelLines('A\nB\nC')).toBe(3);
    });
    it('zählt weiche Umbrüche aus der Zeichenlänge', () => {
        // Zwei volle Zeilen ergeben zwei logische Zeilen.
        expect(countLabelLines('x'.repeat(LABEL_CHARS_PER_LINE + 1))).toBe(2);
    });
    it('begrenzt die Zeilenzahl auf das Maximum', () => {
        expect(countLabelLines('A\nB\nC\nD\nE')).toBe(MAX_LABEL_LINES);
        expect(countLabelLines('x'.repeat(200))).toBe(MAX_LABEL_LINES);
    });
});
describe('fitFontSize', () => {
    it('wählt für eine Zeile die größte Schrift', () => {
        expect(fitFontSize('Urlaub')).toBeGreaterThan(fitFontSize('A\nB'));
    });
    it('verkleinert die Schrift mit steigender Zeilenzahl', () => {
        const one = fitFontSize('Urlaub');
        const two = fitFontSize('Urlaub\nArzt');
        const three = fitFontSize('A\nB\nC');
        expect(one).toBeGreaterThan(two);
        expect(two).toBeGreaterThan(three);
        expect(three).toBe(MIN_LABEL_FONT_SIZE);
    });
    it('behandelt eine leere Beschriftung wie eine einzelne Zeile', () => {
        expect(fitFontSize('')).toBe(fitFontSize('Urlaub'));
    });
});
describe('labelLineClass', () => {
    it('liefert die passende Klasse je Zeilenzahl', () => {
        expect(labelLineClass('Urlaub')).toBe('label-lines-1');
        expect(labelLineClass('Urlaub\nArzt')).toBe('label-lines-2');
        expect(labelLineClass('A\nB\nC')).toBe('label-lines-3');
    });
    it('begrenzt die Klasse auf höchstens drei Zeilen', () => {
        expect(labelLineClass('A\nB\nC\nD\nE')).toBe('label-lines-3');
    });
    it('liefert für eine leere Beschriftung die Ein-Zeilen-Klasse', () => {
        expect(labelLineClass('')).toBe('label-lines-1');
    });
});
describe('countCellLines', () => {
    it('zählt je Jahrestag eine zusätzliche Zeile', () => {
        expect(countCellLines('Urlaub', 0)).toBe(1);
        expect(countCellLines('Urlaub', 1)).toBe(2);
        expect(countCellLines('Urlaub', 2)).toBe(3);
    });
    it('behandelt eine leere Beschriftung als null Grundzeilen', () => {
        expect(countCellLines('', 0)).toBe(0);
        expect(countCellLines('', 1)).toBe(1);
    });
    it('berücksichtigt harte und weiche Umbrüche der Beschriftung', () => {
        expect(countCellLines('Urlaub\nArzt', 0)).toBe(2);
        expect(countCellLines('x'.repeat(LABEL_CHARS_PER_LINE + 1), 0)).toBe(2);
    });
    it('begrenzt die Zeilenzahl auf das Maximum', () => {
        expect(countCellLines('Urlaub', 5)).toBe(MAX_LABEL_LINES);
    });
});
describe('cellLineClass', () => {
    it('verkleinert die Stufe, sobald ein Jahrestag zur Beschriftung hinzukommt', () => {
        expect(cellLineClass('Urlaub')).toBe('label-lines-1');
        expect(cellLineClass('Urlaub', 1)).toBe('label-lines-2');
        expect(cellLineClass('Urlaub', 2)).toBe('label-lines-3');
    });
    it('liefert für leeren Inhalt die Ein-Zeilen-Klasse', () => {
        expect(cellLineClass('')).toBe('label-lines-1');
    });
});
describe('cellFitFontSize', () => {
    it('verkleinert die Schrift mit steigender Zeilenzahl', () => {
        const one = cellFitFontSize('Urlaub');
        const two = cellFitFontSize('Urlaub', 1);
        const three = cellFitFontSize('Urlaub', 2);
        expect(one).toBeGreaterThan(two);
        expect(two).toBeGreaterThan(three);
        expect(three).toBe(MIN_LABEL_FONT_SIZE);
    });
});
describe('informationLineClass', () => {
    it('lässt eine persönliche Beschriftung unverändert (Stufe nach Zeilenzahl)', () => {
        expect(informationLineClass('Urlaub')).toBe('label-lines-1');
        expect(informationLineClass('Urlaub', 1)).toBe('label-lines-2');
        expect(informationLineClass('Urlaub', 2)).toBe('label-lines-3');
    });
    it('stellt reine Terminnamen eine Stufe kleiner als eine Beschriftung', () => {
        // Beschriftung „Urlaub" → Stufe 1; gleich langer Terminname → Stufe 2.
        expect(informationLineClass('Urlaub', 0, true)).toBe('label-lines-2');
        // Eine persönliche Beschriftung bleibt bei Stufe 1.
        expect(informationLineClass('Urlaub', 0, false)).toBe('label-lines-1');
        expect(EVENT_EXTRA_LINES).toBe(1);
    });
    it('deckelt lange Terminnamen auf die kleinste Stufe', () => {
        // „Tag der Deutschen Einheit" (25 Zeichen) ergibt zwei Grundzeilen; mit
        // der Termin-Anrechnung steigt das auf die Maximalstufe.
        expect(informationLineClass('Tag der Deutschen Einheit', 0, true)).toBe('label-lines-3');
    });
    it('behandelt einen leeren Informationstext als eine Zeile', () => {
        expect(informationLineClass('', 0, true)).toBe('label-lines-1');
    });
});
