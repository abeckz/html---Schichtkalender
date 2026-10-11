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
 * Zusätzliche logische Zeilen, die reine Termin-/Feiertagsnamen (ohne
 * persönliche Beschriftung) angerechnet bekommen.
 *
 * Eine persönliche Beschriftung darf groß erscheinen (Stufe 1). Die fest
 * übernommenen Ereignisse des Schichtkalenders (z. B. „Tag der Deutschen
 * Einheit") sind dagegen reine Zusatzinformation und sollen nie so groß wie
 * eine Beschriftung werden. Durch die um eine Zeile höhere Anrechnung starten
 * sie eine Schriftstufe kleiner und rutschen bei langen Namen in die kleinste
 * Stufe - die Schriftgröße wird also geprüft und nach oben gedeckelt.
 */
export const EVENT_EXTRA_LINES = 1;

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

/**
 * Logische Zeilenzahl einer Zelle aus Beschriftung und zusätzlichen Zeilen.
 *
 * Die persönliche Beschriftung (bzw. die Terminnamen) folgt den
 * DayEditor-Regeln: harte Umbrüche und weiche Umbrüche aus der Zeichenlänge
 * zählen (`countLabelLines`). Zu den so ermittelten Zeilen kommen je anzuzeigendem
 * Geburtstag/wiederkehrenden Ereignis `extraLines` Zeilen hinzu: Diese Einträge
 * stehen als eigener Textblock oben in der Zelle und belegen jeweils eine Zeile.
 * Die Summe wird auf `MAX_LABEL_LINES` begrenzt.
 *
 * Damit sinkt die Schriftgröße auch dann, wenn zu einer einzeiligen Beschriftung
 * noch ein Geburtstag oder wiederkehrendes Ereignis hinzukommt: Aus einer Zeile
 * werden zwei - die Schrift folgt der Zeilenzahl des Tageseditors.
 */
export function countCellLines(label: string, extraLines: number = 0): number {
  const base = label === '' ? 0 : countLabelLines(label);
  const lines = base + Math.max(0, extraLines);
  return Math.min(lines, MAX_LABEL_LINES);
}

/**
 * CSS-Klasse für die adaptive Zeilen-/Schriftsteuerung eines Zellinhalts aus
 * Beschriftung und zusätzlichen Zeilen (Jahrestage). Siehe `countCellLines`.
 */
export function cellLineClass(label: string, extraLines: number = 0): string {
  const lines = countCellLines(label, extraLines);
  const clamped = Math.min(Math.max(lines, 1), MAX_LABEL_LINES);
  return `label-lines-${clamped}`;
}

/**
 * Schriftgröße (px) für einen Zellinhalt aus Beschriftung und zusätzlichen
 * Zeilen (siehe `countCellLines`).
 */
export function cellFitFontSize(label: string, extraLines: number = 0): number {
  const lines = countCellLines(label, extraLines);
  if (lines <= 0) return FONT_SIZES[1];
  return FONT_SIZES[lines] ?? MIN_LABEL_FONT_SIZE;
}

/**
 * CSS-Klasse für die Info-Zelle (Bildschirm wie Druck).
 *
 * Sie bündelt die gemeinsame Regel für Beschriftung, Termine und Jahrestage
 * an einer Stelle, damit Bildschirm (`CalendarDayRow`) und Druck (`PrintMonth`)
 * exakt dieselbe Schriftstufe wählen:
 *
 * - Eine **persönliche Beschriftung** (`label`) folgt unverändert den
 *   DayEditor-Regeln: 1/2/3 Zeilen -> `label-lines-1/2/3`.
 * - **Reine Termin-/Feiertagsnamen** (keine Beschriftung, `eventOnly = true`)
 *   bekommen {@link EVENT_EXTRA_LINES} Zeilen zusätzlich angerechnet. Dadurch
 *   sind sie stets eine Stufe kleiner als eine gleich lange Beschriftung: ein
 *   einzelner kurzer Termin ist höchstens mittelgroß, lange Namen wie
 *   „Tag der Deutschen Einheit" rutschen in die kleinste Stufe.
 * - **Jahrestage** (`extraLines`) zählen wie bisher je einen zusätzlichen Block.
 *
 * Die Zeilenzahl wird auf {@link MAX_LABEL_LINES} begrenzt, die Klasse liegt
 * damit immer zwischen `label-lines-1` und `label-lines-3`.
 */
export function informationLineClass(
  label: string,
  extraLines: number = 0,
  eventOnly: boolean = false,
): string {
  const lines = countCellLines(label, extraLines + (eventOnly ? EVENT_EXTRA_LINES : 0));
  const clamped = Math.min(Math.max(lines, 1), MAX_LABEL_LINES);
  return `label-lines-${clamped}`;
}
