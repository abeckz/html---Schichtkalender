/**
 * Tests für die adaptive Schriftgröße mehrzeiliger Beschriftungen.
 *
 * Abgesichert wird die reine, messfreie Logik aus `utils/textFit.ts`:
 * Zeilenzählung, Schriftgrößenwahl und die CSS-Klasse für die Zeilensteuerung.
 */

import { describe, expect, it } from 'vitest';
import {
  LABEL_CHARS_PER_LINE,
  MAX_LABEL_LINES,
  MIN_LABEL_FONT_SIZE,
  countLabelLines,
  fitFontSize,
  labelLineClass,
} from '../utils/textFit';

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
