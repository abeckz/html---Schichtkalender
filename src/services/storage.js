/**
 * Persistenzschicht für Einstellungen und persönliche Tagesmarkierungen.
 *
 * Alle Zugriffe auf localStorage sind gekapselt und defensiv: bei fehlendem
 * Speicher, defekten Daten oder unbekannten Farbwerten wird auf gültige
 * Standardwerte zurückgefallen. Es wird nie geworfen.
 */
import { SHIFT_IDS } from '../config/shiftDefinitions.ts';
import { isAnnotationColorId, isColumnColorName } from '../config/annotationColors.ts';
import { DEFAULT_SETTINGS } from '../config/appDefaults.ts';
import { isValidDateKey, isMonthDayKey, isPlausibleBirthYear } from '../utils/dateUtils.ts';
export const STORAGE_KEY = 'schichtkalender.state';
export const STORAGE_VERSION = 1;
export const MAX_LABEL_LENGTH = 50;
/** Maximale Länge eines querliegenden Textes einer Zusatzspalte. */
export const MAX_EXTRA_TEXT_LENGTH = 50;
/** Kleinste Breite einer Zusatzspalte, in Einheiten à 1,6 em (~2 Zeichen). */
export const MIN_EXTRA_COLUMN_WIDTH = 1;
/** Größte Breite einer Zusatzspalte, in Einheiten à 1,6 em. */
export const MAX_EXTRA_COLUMN_WIDTH = 24;
/** Höchstzahl frei anlegbarer Zusatzspalten je Monat und Seite. */
export const MAX_EXTRA_COLUMNS = 12;
/** Liefert localStorage oder null (z. B. SSR, Privatmodus, deaktiviert). */
export function getDefaultStorage() {
    try {
        if (typeof window === 'undefined' || !window.localStorage)
            return null;
        return window.localStorage;
    }
    catch {
        return null;
    }
}
/** Freitext auf 50 Zeichen begrenzen und trimmen. */
export function normalizeLabel(label) {
    return typeof label === 'string' ? label.slice(0, MAX_LABEL_LENGTH) : '';
}
/** Prüft eine Schichtkennung. */
export function isShiftId(value) {
    return typeof value === 'string' && SHIFT_IDS.includes(value);
}
/** Prüft ein gültiges Kalenderjahr. */
function isPlausibleYear(value) {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1900 && value <= 2200;
}
/** Bereinigt ein einzelnes Annotationsobjekt oder liefert null. */
export function normalizeAnnotation(value) {
    if (!value || typeof value !== 'object')
        return null;
    const candidate = value;
    if (typeof candidate.dateKey !== 'string' || !isValidDateKey(candidate.dateKey))
        return null;
    const label = normalizeLabel(candidate.label ?? '');
    const colors = {};
    const rawColors = candidate.colors;
    if (rawColors && typeof rawColors === 'object') {
        for (const [column, colorId] of Object.entries(rawColors)) {
            if (isColumnColorName(column) && isAnnotationColorId(colorId)) {
                colors[column] = colorId;
            }
        }
    }
    // Rückwärtskompatibilität: die frühere Tagesfarbe (`colorId`) entsprach der
    // Farbe der Informationsspalte und wird dorthin übernommen.
    if (candidate.colorId !== undefined && colors.info === undefined && isAnnotationColorId(candidate.colorId)) {
        colors.info = candidate.colorId;
    }
    // Farben der frei angelegten Zusatzspalten (`extra0`, `extra1`, …).
    const extraColors = {};
    const rawExtra = candidate.extraColors;
    if (rawExtra && typeof rawExtra === 'object') {
        for (const [key, colorId] of Object.entries(rawExtra)) {
            if (isExtraColumnColorKey(key) && isAnnotationColorId(colorId)) {
                extraColors[key] = colorId;
            }
        }
    }
    // Querliegende Texte der Zusatzspalten (`extra0`, `extra1`, …). Je Spalte
    // liegt eine Liste von Spannen-Texten vor, damit mehrere unabhängige
    // Markierungen derselben Spalte nebeneinander bestehen können. Zur
    // Rückwärtskompatibilität wird auch das frühere Einzel-Objekt je Spalte
    // übernommen.
    const extraTexts = {};
    const rawExtraTexts = candidate.extraTexts;
    if (rawExtraTexts && typeof rawExtraTexts === 'object') {
        for (const [key, value] of Object.entries(rawExtraTexts)) {
            if (!isExtraColumnColorKey(key))
                continue;
            const entries = Array.isArray(value) ? value : [value];
            const list = [];
            const seenIds = new Set();
            for (const entry of entries) {
                const text = normalizeExtraColumnText(entry, key);
                if (!text || seenIds.has(text.id))
                    continue;
                seenIds.add(text.id);
                list.push(text);
            }
            if (list.length > 0)
                extraTexts[key] = list;
        }
    }
    // Vollständig leere Annotationen werden nicht gespeichert.
    if (label === '' &&
        Object.keys(colors).length === 0 &&
        Object.keys(extraColors).length === 0 &&
        Object.keys(extraTexts).length === 0) {
        return null;
    }
    const annotation = { dateKey: candidate.dateKey, label, colors };
    if (Object.keys(extraColors).length > 0)
        annotation.extraColors = extraColors;
    if (Object.keys(extraTexts).length > 0)
        annotation.extraTexts = extraTexts;
    return annotation;
}
/** Erzeugt den Farbschlüssel einer Zusatzspalte (`name` -> "extraN"). */
export function extraColumnColorKey(name) {
    const index = typeof name === 'number' ? name : Number(name);
    return `extra${Number.isFinite(index) && index >= 0 ? Math.trunc(index) : 0}`;
}
/** Prüft den Farbschlüssel einer Zusatzspalte ("extra0", "extra1", …). */
export function isExtraColumnColorKey(value) {
    return typeof value === 'string' && /^extra[0-9]+$/.test(value);
}
/** Länge einer Beschriftung/eines Textes auf 50 Zeichen begrenzen. */
function normalizeExtraText(value) {
    return typeof value === 'string' ? value.slice(0, MAX_EXTRA_TEXT_LENGTH) : '';
}
/**
 * Stabiler Anzeige-Schlüssel eines Zusatzspalten-Textes.
 *
 * Er verbindet Farbschlüssel und Anker (oberster Tag der Spanne). Da in einer
 * Spalte mehrere unabhängige Spannen existieren dürfen, ist allein der
 * Farbschlüssel nicht eindeutig; der Anker unterscheidet die Spannen.
 */
export function extraColumnTextId(colorKey, anchor) {
    return `${colorKey}@${anchor}`;
}
/**
 * Bereinigt einen querliegenden Text einer Zusatzspalte.
 *
 * Erwartet als `fallbackKey` den Farbschlüssel der Spalte (aus dem Map-Schlüssel).
 * Liefert null, wenn weder Text noch Spanne gültig sind bzw. kein Text vorliegt.
 * Die Spanne (`dateKeys`) wird auf gültige, eindeutige Datumsschlüssel beschränkt
 * und chronologisch sortiert; `length` folgt aus ihrer Länge. Die `id` folgt
 * (bzw. wird neu bestimmt) aus Farbschlüssel und Anker.
 */
export function normalizeExtraColumnText(value, fallbackKey) {
    if (!value || typeof value !== 'object')
        return null;
    const candidate = value;
    const colorKey = isExtraColumnColorKey(candidate.colorKey)
        ? candidate.colorKey
        : fallbackKey;
    if (!colorKey)
        return null;
    const text = normalizeExtraText(candidate.text);
    const rawKeys = Array.isArray(candidate.dateKeys) ? candidate.dateKeys : [];
    const dateKeys = [];
    const seen = new Set();
    for (const key of rawKeys) {
        if (typeof key !== 'string' || !isValidDateKey(key) || seen.has(key))
            continue;
        seen.add(key);
        dateKeys.push(key);
    }
    dateKeys.sort();
    if (dateKeys.length === 0 && text === '')
        return null;
    const anchor = dateKeys[0] ?? '';
    return {
        id: extraColumnTextId(colorKey, anchor),
        colorKey,
        columnLabel: typeof candidate.columnLabel === 'string'
            ? candidate.columnLabel.slice(0, MAX_LABEL_LENGTH)
            : '',
        vertical: candidate.vertical !== false,
        text,
        dateKeys,
        length: dateKeys.length,
    };
}
/** Begrenzt eine Spaltenbreite auf den zulässigen Bereich. */
export function normalizeExtraColumnWidth(value) {
    if (typeof value !== 'number' || !Number.isInteger(value))
        return null;
    if (value < MIN_EXTRA_COLUMN_WIDTH || value > MAX_EXTRA_COLUMN_WIDTH)
        return null;
    return value;
}
/** Bereinigt die Anordnung der Zusatzspalten eines Monats. */
export function normalizeExtraColumns(value) {
    if (!value || typeof value !== 'object')
        return null;
    const candidate = value;
    const left = normalizeExtraColumnList(candidate.left);
    const right = normalizeExtraColumnList(candidate.right);
    if (left.length === 0 && right.length === 0)
        return null;
    return { left, right };
}
/** Bereinigt eine einzelne Spaltenliste (höchstens MAX_EXTRA_COLUMNS Einträge). */
function normalizeExtraColumnList(value) {
    if (!Array.isArray(value))
        return [];
    const widths = [];
    for (const entry of value) {
        const width = normalizeExtraColumnWidth(entry);
        if (width !== null)
            widths.push(width);
        if (widths.length >= MAX_EXTRA_COLUMNS)
            break;
    }
    return widths;
}
/** Bereinigt die Zusatzspalten aller Monate (Schlüssel 1..12). */
export function normalizeExtraColumnsByMonth(value) {
    const result = {};
    if (!value || typeof value !== 'object')
        return result;
    for (const [monthKey, rawColumns] of Object.entries(value)) {
        const month = Number(monthKey);
        if (!Number.isInteger(month) || month < 1 || month > 12)
            continue;
        const columns = normalizeExtraColumns(rawColumns);
        if (columns)
            result[month] = columns;
    }
    return result;
}
/** Länge einer Spaltenliste in Einheiten (leere Spalten zählen als 1). */
export function extraColumnCount(columns) {
    if (!columns)
        return 0;
    return columns.reduce((total, width) => total + Math.max(1, width), 0);
}
/** Bereinigt Einstellungen. */
export function normalizeSettings(value) {
    if (!value || typeof value !== 'object')
        return { ...DEFAULT_SETTINGS };
    const candidate = value;
    return {
        selectedYear: isPlausibleYear(candidate.selectedYear)
            ? candidate.selectedYear
            : DEFAULT_SETTINGS.selectedYear,
        selectedShift: isShiftId(candidate.selectedShift)
            ? candidate.selectedShift
            : DEFAULT_SETTINGS.selectedShift,
        // Rückwärtskompatibilität: Ältere Zustände kennen die Anzeige-Option
        // nicht; sie wird dann auf den Standard (aus) gesetzt.
        weekdayOverDate: typeof candidate.weekdayOverDate === 'boolean'
            ? candidate.weekdayOverDate
            : DEFAULT_SETTINGS.weekdayOverDate,
        // Rückwärtskompatibilität: Fehlen die Anzeige-Checkboxen, gelten die
        // Standards (alle drei eingeschaltet).
        showShiftCalendar: typeof candidate.showShiftCalendar === 'boolean'
            ? candidate.showShiftCalendar
            : DEFAULT_SETTINGS.showShiftCalendar,
        showBirthdays: typeof candidate.showBirthdays === 'boolean'
            ? candidate.showBirthdays
            : DEFAULT_SETTINGS.showBirthdays,
        showRecurringEvents: typeof candidate.showRecurringEvents === 'boolean'
            ? candidate.showRecurringEvents
            : DEFAULT_SETTINGS.showRecurringEvents,
        viewMode: isCalendarViewMode(candidate.viewMode)
            ? candidate.viewMode
            : DEFAULT_SETTINGS.viewMode,
        // Rückwärtskompatibilität: ältere Zustände kennen die frei angelegten
        // Zusatzspalten nicht; sie starten dann ohne Zusatzspalten.
        extraColumns: normalizeExtraColumnsByMonth(candidate.extraColumns),
    };
}
/** Prüft einen Modus der Bildschirmansicht. */
export function isCalendarViewMode(value) {
    return value === 'shift' || value === 'anniversaries';
}
/** Bereinigt eine komplette Annotationsliste. */
export function normalizeAnnotations(value) {
    const result = {};
    if (!value || typeof value !== 'object')
        return result;
    for (const entry of Object.values(value)) {
        const annotation = normalizeAnnotation(entry);
        if (annotation) {
            result[annotation.dateKey] = annotation;
        }
    }
    return result;
}
/** Maximale Länge eines Erklärtextes der Farblegende. */
export const MAX_LEGEND_TEXT_LENGTH = 50;
/** Maximale Länge eines Ereignis-/Personennamens. */
export const MAX_ANNIVERSARY_NAME_LENGTH = 50;
/** Erlaubte Zähler eines Wiederholungsrhythmus. */
export const MIN_ANNIVERSARY_INTERVAL = 1;
export const MAX_ANNIVERSARY_INTERVAL = 99;
/** Obergrenze für „alle X Tage" (Tagesrhythmus darf größer sein). */
export const MAX_DAILY_INTERVAL_COUNT = 365;
/** Rückwärtskompatibilität: früher war 99 das größte Intervall in Jahren. */
const LEGACY_MAX_YEAR_INTERVAL = MAX_ANNIVERSARY_INTERVAL;
/** Prüft die Art eines Jahrestages. */
export function isAnniversaryKind(value) {
    return value === 'birthday' || value === 'recurring';
}
/** Prüft die Rhythmus-Art eines wiederkehrenden Ereignisses. */
export function isAnniversaryIntervalKind(value) {
    return value === 'daily' || value === 'weekly' || value === 'monthly' || value === 'yearly';
}
/** Obergrenze des Zählers je Rhythmus-Art. */
export function maxIntervalCountFor(kind) {
    return kind === 'daily' ? MAX_DAILY_INTERVAL_COUNT : MAX_ANNIVERSARY_INTERVAL;
}
/** Begrenzt einen Rhythmus-Zähler auf den zur Art passenden Bereich. */
export function normalizeAnniversaryIntervalCount(value, kind = 'yearly') {
    if (typeof value !== 'number' || !Number.isInteger(value))
        return MIN_ANNIVERSARY_INTERVAL;
    return Math.min(maxIntervalCountFor(kind), Math.max(MIN_ANNIVERSARY_INTERVAL, value));
}
/**
 * Laufender Zähler für neue Jahrestag-Kennungen.
 *
 * Die Kennungen müssen innerhalb eines Tages eindeutig sein, damit mehrere
 * Einträge desselben Tages (mehrere Geburtstage bzw. Ereignisse) sicher
 * unterschieden werden können. Ein Zeitanteil plus Zähler genügt; die genaue
 * Form ist nicht fachlich relevant.
 */
let anniversaryIdCounter = 0;
/** Erzeugt eine neue, eindeutige Kennung für einen Jahrestag. */
export function createAnniversaryId() {
    anniversaryIdCounter += 1;
    return `a${Date.now().toString(36)}${anniversaryIdCounter.toString(36)}`;
}
/**
 * Bereinigt einen Jahrestag.
 *
 * Erwartet einen Monat-Tag-Schlüssel "MM-DD" und liefert null bei ungültigem
 * oder leerem Eintrag. Das Geburtsjahr wird nur für Geburtstage übernommen;
 * Rhythmus-Art und -Zähler nur für wiederkehrende Ereignisse. Ältere Einträge
 * mit dem früheren Feld `interval` (Jahre) werden auf 'yearly' abgebildet.
 *
 * `fallbackId` liefert die Kennung, wenn der Eintrag keine gültige `id` trägt
 * (z. B. bei älteren Zuständen). So bleiben mehrere Einträge eines Tages
 * unterscheidbar.
 */
export function normalizeAnniversary(value, fallbackId) {
    if (!value || typeof value !== 'object')
        return null;
    const candidate = value;
    if (!isMonthDayKey(candidate.monthDay))
        return null;
    if (!isAnniversaryKind(candidate.kind))
        return null;
    const name = normalizeAnniversaryName(candidate.name ?? '');
    const id = typeof candidate.id === 'string' && candidate.id !== ''
        ? candidate.id
        : fallbackId ?? candidate.monthDay;
    if (name === '')
        return null;
    const entry = {
        id,
        monthDay: candidate.monthDay,
        name,
        kind: candidate.kind,
    };
    if (candidate.kind === 'birthday' && isPlausibleBirthYear(candidate.birthYear)) {
        entry.birthYear = candidate.birthYear;
    }
    if (candidate.kind === 'recurring') {
        // Ohne Rhythmus-Art gilt der frühere Zustand: Intervall in Jahren.
        const kind = isAnniversaryIntervalKind(candidate.intervalKind)
            ? candidate.intervalKind
            : 'yearly';
        entry.intervalKind = kind;
        if (isAnniversaryIntervalKind(candidate.intervalKind)) {
            entry.intervalCount = normalizeAnniversaryIntervalCount(candidate.intervalCount, kind);
        }
        else {
            // Altbestand: `interval` war auf 99 Jahre begrenzt.
            const legacyYears = typeof candidate.interval === 'number' && Number.isInteger(candidate.interval)
                ? Math.min(LEGACY_MAX_YEAR_INTERVAL, Math.max(MIN_ANNIVERSARY_INTERVAL, candidate.interval))
                : MIN_ANNIVERSARY_INTERVAL;
            entry.intervalCount = legacyYears;
        }
        // Ausnahmetermine: nur gültige, eindeutige Datumsschlüssel, chronologisch.
        const excluded = normalizeExcludedDates(candidate.excludedDates);
        if (excluded.length > 0)
            entry.excludedDates = excluded;
        // Serienende: nur ein gültiger Datumsschlüssel wird übernommen.
        if (typeof candidate.until === 'string' && isValidDateKey(candidate.until)) {
            entry.until = candidate.until;
        }
    }
    return entry;
}
/** Bereinigt die Ausnahmetermine einer Serie (gültig, eindeutig, sortiert). */
export function normalizeExcludedDates(value) {
    if (!Array.isArray(value))
        return [];
    const seen = new Set();
    const result = [];
    for (const raw of value) {
        if (typeof raw !== 'string' || !isValidDateKey(raw) || seen.has(raw))
            continue;
        seen.add(raw);
        result.push(raw);
    }
    result.sort();
    return result;
}
/** Freitext eines Ereignis-/Personennamens begrenzen und trimmen. */
export function normalizeAnniversaryName(name) {
    return typeof name === 'string' ? name.slice(0, MAX_ANNIVERSARY_NAME_LENGTH) : '';
}
/**
 * Bereinigt die Map der Jahrestage.
 *
 * Erwartet die neue Struktur `MM-DD -> AnniversaryEntry[]`. Für
 * Rückwärtskompatibilität werden zusätzlich zwei ältere Formen übernommen:
 * - eine flache Liste von Einträgen,
 * - eine nach `"MM-DD:kind"` indizierte Map (Wert = einzelner Eintrag).
 * Mehrere Einträge desselben Tages bleiben in fester Reihenfolge (Geburtstage
 * zuerst, dann wiederkehrende Ereignisse) erhalten. Ungültige Einträge werden
 * verworfen; es wird nie geworfen.
 */
export function normalizeAnniversaries(value) {
    const result = {};
    if (!value || typeof value !== 'object')
        return result;
    const push = (entry) => {
        if (!entry)
            return;
        const list = result[entry.monthDay] ?? (result[entry.monthDay] = []);
        list.push(entry);
    };
    if (Array.isArray(value)) {
        // Flache Liste von Einträgen.
        for (const raw of value)
            push(normalizeAnniversary(raw));
        return sortAnniversaryMap(result);
    }
    for (const [key, raw] of Object.entries(value)) {
        if (Array.isArray(raw)) {
            // Neue Struktur: Liste von Einträgen eines Tages.
            for (const item of raw)
                push(normalizeAnniversary(item));
            continue;
        }
        // Einzelner Eintrag: entweder neuer Schlüssel "MM-DD" oder alter
        // zusammengesetzter Schlüssel "MM-DD:kind". Der Tag wird aus dem Eintrag
        // (oder ersatzweise aus dem Schlüssel) abgeleitet.
        const legacyKind = key.includes(':') ? key.split(':')[1] : undefined;
        const fallbackId = `${key}`;
        const entry = normalizeAnniversary(legacyKind && raw?.kind === undefined
            ? { ...raw, kind: legacyKind }
            : raw, fallbackId);
        push(entry);
    }
    return sortAnniversaryMap(result);
}
/** Sortiert die Einträge jedes Tages: Geburtstage zuerst, dann Ereignisse. */
function sortAnniversaryMap(map) {
    for (const list of Object.values(map)) {
        list.sort((a, b) => {
            if (a.kind === b.kind)
                return 0;
            return a.kind === 'birthday' ? -1 : 1;
        });
    }
    return map;
}
/** Freitext eines Legendeneintrags auf die Maximallänge begrenzen. */
export function normalizeLegendText(text) {
    return typeof text === 'string' ? text.slice(0, MAX_LEGEND_TEXT_LENGTH) : '';
}
/**
 * Bereinigt die Erklärtexte der Farblegende.
 *
 * Erwartet die Struktur Jahr -> colorId -> Text. Ungültige Jahre, unbekannte
 * Farben und leere Texte werden verworfen; es wird nie geworfen.
 */
export function normalizeColorLegend(value) {
    const result = {};
    if (!value || typeof value !== 'object')
        return result;
    for (const [yearKey, colors] of Object.entries(value)) {
        const year = Number(yearKey);
        if (!isPlausibleYear(year) || !colors || typeof colors !== 'object')
            continue;
        const entry = {};
        for (const [colorKey, text] of Object.entries(colors)) {
            if (!isAnnotationColorId(colorKey))
                continue;
            const normalized = normalizeLegendText(text);
            if (normalized !== '')
                entry[colorKey] = normalized;
        }
        if (Object.keys(entry).length > 0)
            result[year] = entry;
    }
    return result;
}
/** Liest und validiert den persistierten Zustand. */
export function readState(storage = getDefaultStorage()) {
    const fallback = {
        version: STORAGE_VERSION,
        settings: { ...DEFAULT_SETTINGS },
        annotations: {},
        colorLegend: {},
        anniversaries: {},
    };
    if (!storage)
        return fallback;
    let raw = null;
    try {
        raw = storage.getItem(STORAGE_KEY);
    }
    catch {
        return fallback;
    }
    if (!raw)
        return fallback;
    try {
        const parsed = JSON.parse(raw);
        return {
            version: STORAGE_VERSION,
            settings: normalizeSettings(parsed.settings),
            annotations: normalizeAnnotations(parsed.annotations),
            colorLegend: normalizeColorLegend(parsed.colorLegend),
            anniversaries: normalizeAnniversaries(parsed.anniversaries),
        };
    }
    catch {
        return fallback;
    }
}
/** Schreibt den Zustand; Fehler werden geschluckt (Speicher kann fehlen). */
export function writeState(state, storage = getDefaultStorage()) {
    if (!storage)
        return false;
    try {
        const payload = {
            version: STORAGE_VERSION,
            settings: normalizeSettings(state.settings),
            annotations: normalizeAnnotations(state.annotations),
            colorLegend: normalizeColorLegend(state.colorLegend),
            anniversaries: normalizeAnniversaries(state.anniversaries),
        };
        storage.setItem(STORAGE_KEY, JSON.stringify(payload));
        return true;
    }
    catch {
        return false;
    }
}
/** Entfernt den persistierten Zustand vollständig. */
export function clearState(storage = getDefaultStorage()) {
    if (!storage)
        return;
    try {
        storage.removeItem(STORAGE_KEY);
    }
    catch {
        // absichtlich ignorieren
    }
}
/** Einstellungen einzeln speichern (praktisch für die UI). */
export function saveSettings(settings, annotations, storage = getDefaultStorage(), colorLegend = {}, anniversaries = {}) {
    return writeState({ version: STORAGE_VERSION, settings, annotations, colorLegend, anniversaries }, storage);
}
/** Farbe der Informationsspalte einer Annotation (null, wenn keine gesetzt ist). */
export function getAnnotationColorId(annotations, dateKey) {
    return annotations[dateKey]?.colors.info ?? null;
}
/** Farbe einer beliebigen Spalte einer Annotation (null, wenn keine gesetzt ist). */
export function getColumnColorId(annotations, dateKey, column) {
    return annotations[dateKey]?.colors[column] ?? null;
}
