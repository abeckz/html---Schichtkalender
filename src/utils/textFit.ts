/**
 * Schriftanpassung für mehrzeilige Beschriftungen.
 *
 * Persönliche Beschriftungen dürfen bis zu drei Zeilen belegen. Damit eine
 * kurze Beschriftung (z. B. eine einzelne Zeile) groß erscheint und erst
 * bei drei Zeilen kleiner wird, liefert dieses Modul zwei Dinge:
 *
 * - `countLabelLines`: die logische Zeilenzahl einer Beschriftung. Gezählt
 *   werden harte Umbrüche (`\n`) sowie der zusätzliche Umbruchbedarf, der
 *   sich aus der Zeichenlänge ergibt, damit auch ohne gemessene Breite eine
 *   belastbare Zeilenzahl entsteht.
 * - `fitFontSize`: die zugehörige Schriftgröße in Pixeln. 1 Zeile -> groß,
 *   2 Zeilen -> mittel, 3 oder mehr Zeilen -> klein.
 *
 * Die Werte sind bewusst als reine Funktionen umgesetzt: Dadurch lassen sie
 * sich identisch in Bildschirmzelle, Druckzelle und Eingabefeld verwenden
 * und geräteunabhängig testen.
 */

/** Maximale Zeilenzahl einer Beschriftung. */
export const MAX_LABEL_LINES = 3;

/**
 * Zeichen, ab denen innerhalb einer Zeile ein zusätzlicher (weicher) Umbruch
 * angenommen wird. Die Bildschirm- und Druckzelle sind unterschiedlich
 * breit; ein Mittelwert von rund 16 Zeichen pro Zeile trifft die tatsächliche
 * Darstellung im Kalender gut und hält die Berechnung messfrei.
 */
export const LABEL_CHARS_PER_LINE = 16;

/** Schriftgrößen (px) je Zeilenzahl; aufsteigend nach Zeilenzahl kleiner. */
const FONT_SIZES: Record<number, number> = {
  1: 20,
  2: 15,
  3: 12,
};

/** Kleinste verwendete Schriftgröße für PDF-unabhängige Vollständigkeit. */
export const MIN_LABEL_FONT_SIZE = FONT_SIZES[MAX_LABEL_LINES];

/**
 * Logische Zeilenzahl einer Beschriftung.
 *
 * Jede Zeile einer Beschriftung kann zusätzlich weich umbrechen. Gezählt
 * wird die Summe aus harten Umbrüchen und dem weichen Umbruchbedarf jeder
 * Einzelzeile, begrenzt auf `MAX_LABEL_LINES`.
 */
export function countLabelLines(label: string): number {
  if (label === '') return 0;
  let lines = 0;
  for (const hardLine of label.split('\n')) {
    const softBreaks = Math.ceil(hardLine.length / LABEL_CHARS_PER_LINE);
    lines += Math.max(1, softBreaks);
    if (lines >= MAX_LABEL_LINES) return MAX_LABEL_LINES;
  }
  return Math.min(lines, MAX_LABEL_LINES);
}

/**
 * Schriftgröße (px) passend zur Beschriftung.
 *
 * Leere Beschriftungen erhalten die größte Schrift, damit das leere Feld bzw.
 * eine noch fehlende Angabe denselben ruhigen Grundzustand zeigt.
 */
export function fitFontSize(label: string): number {
  const lines = countLabelLines(label);
  if (lines <= 0) return FONT_SIZES[1];
  return FONT_SIZES[lines] ?? MIN_LABEL_FONT_SIZE;
}

/**
 * CSS-Klasse für die adaptive Zeilen-/Schriftsteuerung.
 *
 * 1 Zeile -> `label-lines-1`, 2 Zeilen -> `label-lines-2`,
 * 3 oder mehr Zeilen -> `label-lines-3` (kleinste Schrift).
 */
export function labelLineClass(label: string): string {
  const lines = countLabelLines(label);
  const clamped = Math.min(Math.max(lines, 1), MAX_LABEL_LINES);
  return `label-lines-${clamped}`;
}
