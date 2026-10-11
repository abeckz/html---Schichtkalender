/**
 * AnniversaryEngine.
 *
 * Reine, seiteneffektfreie Funktionen für die jahreslosen Jahrestage
 * (Geburtstage und wiederkehrende Ereignisse). Es wird nichts gespeichert und
 * keine Fachlogik der Schichten berührt.
 *
 * Grundlage ist stets der Monat-Tag-Schlüssel ("MM-DD"). Das Geburtsjahr ist
 * optional und dient ausschließlich der Altersberechnung; der Wiederholungs-
 * rhythmus (täglich, wöchentlich, monatlich, jährlich - jeweils „jeden n-ten")
 * steuert, an welchen Kalendertagen ein wiederkehrendes Ereignis erscheint.
 */
import { monthDayOfDateKey, parseMonthDayKey, WEEKDAY_SHORT_NAMES } from '../utils/dateUtils.ts';
import { DAYS_PER_WEEK, MS_PER_DAY, dayIndex } from '../utils/dayIndex.ts';
/**
 * Effektiver Rhythmus eines wiederkehrenden Ereignisses.
 *
 * Fehlt die Rhythmus-Art (ältere Einträge), gilt die frühere Bedeutung des
 * Feldes `interval`: alle n Jahre. Der Zähler wird auf mindestens 1 begrenzt.
 */
export function intervalSpecOf(entry) {
    const kind = entry.intervalKind ?? 'yearly';
    const rawCount = entry.intervalCount ?? entry.interval ?? 1;
    const count = Number.isInteger(rawCount) && rawCount >= 1 ? rawCount : 1;
    return { kind, count };
}
/**
 * Berechnet das Alter einer Person im angegebenen Jahr.
 *
 * Liefert null, wenn kein gültiges Geburtsjahr vorliegt oder das Geburtsjahr
 * nach dem angezeigten Jahr liegt (dann ist kein Alter darstellbar).
 */
export function ageInYear(birthYear, year) {
    if (typeof birthYear !== 'number' || !Number.isInteger(birthYear))
        return null;
    const age = year - birthYear;
    return age >= 0 ? age : null;
}
/** Referenztag (1. Januar des Jahres) als stabiler Tagesindex. */
function yearStartDayIndex(year) {
    return dayIndex(year, 1, 1);
}
/** Tagesindex eines dateKey ("YYYY-MM-DD") aus dem UTC-Anker. */
function dateKeyDayIndex(dateKey) {
    return Math.floor(Date.parse(`${dateKey}T00:00:00Z`) / MS_PER_DAY);
}
/**
 * n-ter Wochentag eines Monats (z. B. 2. Dienstag im März).
 *
 * Grundlage ist der Wochentag des Ankers: der Anker selbst liefert dessen
 * n-te Position im Monat. Fehlt diese Position (z. B. 5. Sonntag), findet im
 * Monat kein Termin statt.
 */
function nthWeekdayOfMonth(year, month, isoWeekday, nth) {
    const firstIndex = dayIndex(year, month, 1);
    const firstWeekday = ((firstIndex + 3) % DAYS_PER_WEEK) + 1; // 1970-01-01 war Donnerstag.
    const offset = (isoWeekday - firstWeekday + DAYS_PER_WEEK) % DAYS_PER_WEEK;
    const day = 1 + offset + (nth - 1) * DAYS_PER_WEEK;
    const probe = new Date(Date.UTC(year, month - 1, day));
    if (probe.getUTCMonth() !== month - 1)
        return null;
    return { month, day };
}
/**
 * Prüft, ob ein wiederkehrendes Ereignis im angegebenen Jahr stattfindet.
 *
 * Der Monat-Tag-Schlüssel ist der Anker und zugleich das erste Auftreten:
 * - yearly:  Jahr - Ankerjahr ist ein Vielfaches des Zählers.
 * - daily:   Abstand in Tagen ab dem Anker ist ein Vielfaches des Zählers.
 * - weekly:  Abstand in Wochen ab dem Anker ist ein Vielfaches des Zählers
 *            (Anzeige am Wochentag des Ankers).
 * - monthly: Abstand in Monaten ab dem Anker ist ein Vielfaches des Zählers
 *            (Anzeige am n-ten Wochentag des Ankers).
 *
 * `baseYear` bleibt als Referenzjahr der Schichtberechnung erhalten und
 * verankert den Tagesrhythmus, wenn kein Ankerjahr bekannt ist.
 *
 * Hinweis: Für die Anzeige ist `occursOnDateKey` maßgeblich, weil nur dort der
 * konkrete Kalendertag geprüft wird. Diese Jahresprüfung bleibt als einfache
 * Ja/Nein-Aussage („findet das Ereignis in diesem Jahr statt?") erhalten.
 */
export function occursInYear(entry, year, baseYear = 2000) {
    const { kind, count } = intervalSpecOf(entry);
    const parts = parseMonthDayKey(entry.monthDay);
    if (!parts)
        return false;
    if (kind === 'yearly' && count <= 1)
        return true;
    switch (kind) {
        case 'yearly':
            return ((year - baseYear) % count + count) % count === 0;
        case 'daily': {
            const anchor = dayIndex(baseYear, parts.month, parts.day);
            const offset = yearStartDayIndex(year) - anchor;
            return offset >= 0 && offset % count === 0;
        }
        case 'weekly': {
            const anchor = dayIndex(baseYear, parts.month, parts.day);
            const offset = yearStartDayIndex(year) - anchor;
            return offset >= 0 && Math.floor(offset / DAYS_PER_WEEK) % count === 0;
        }
        case 'monthly':
            return (((year - baseYear) * 12 + (parts.month - 1)) % count + count) % count === 0;
    }
}
/**
 * Kurze deutsche Beschreibung des Wiederholungsrhythmus ("jedes Jahr",
 * "alle 90 Tage", "jeden 2. Dienstag im Monat").
 *
 * Der Text wird sowohl in der Bildschirmansicht als auch im Druck verwendet
 * (Single Source of Truth) und ist bewusst knapp gehalten.
 */
export function formatIntervalLabel(entry) {
    const { kind, count } = intervalSpecOf(entry);
    const parts = parseMonthDayKey(entry.monthDay);
    switch (kind) {
        case 'daily':
            return count <= 1 ? 'täglich' : `alle ${count} Tage`;
        case 'weekly':
            return count <= 1 ? 'wöchentlich' : `alle ${count} Wochen`;
        case 'monthly': {
            const nth = parts ? Math.floor((parts.day - 1) / DAYS_PER_WEEK) + 1 : 1;
            const weekday = parts ? WEEKDAY_SHORT_NAMES[((dayIndex(2000, parts.month, parts.day) + 3) % 7)] : '';
            const ordinal = nth === 1 ? 'jeden' : `jeden ${nth}.`;
            const label = `${ordinal} ${weekday} im Monat`.replace(/\s+/g, ' ');
            return count <= 1 ? `${label} (monatlich)` : `${label} (alle ${count} Monate)`;
        }
        case 'yearly':
            return count <= 1 ? 'jedes Jahr' : `alle ${count} Jahre`;
    }
}
/**
 * Ermittelt für einen Kalendertag (dateKey "YYYY-MM-DD") die passenden
 * Jahrestage des Jahres.
 * An einem Tag können mehrere Geburtstage und mehrere wiederkehrende
 * Ereignisse stehen; alle werden berücksichtigt. Wiederkehrende Ereignisse
 * werden dabei vollständig nach ihrem Rhythmus geprüft: ein Termin muss exakt
 * auf den Kalendertag fallen. Bei Geburtstagen wird das Alter für das
 * angezeigte Jahr berechnet.
 */
export function matchesForDateKey(anniversaries, dateKey, year, baseYear = 2000) {
    const monthDay = monthDayOfDateKey(dateKey);
    if (!monthDay)
        return [];
    const result = [];
    const seen = new Set();
    // Geburtstage: alle Einträge des Tages (Anker = Monat-Tag).
    for (const entry of birthdaysAt(anniversaries, monthDay)) {
        const age = ageInYear(entry.birthYear, year);
        result.push(age === null ? { entry } : { entry, age });
        seen.add(entry.id);
    }
    // Wiederkehrende Ereignisse: der Anker bindet den Rhythmus; der Termin muss
    // exakt auf den Kalendertag fallen. Ein Ereignis kann daher auch an anderen
    // Tagen als seinem Ankertag erscheinen (z. B. „alle 10 Tage" oder „jeden
    // Montag"), weshalb alle wiederkehrenden Einträge geprüft werden.
    for (const list of Object.values(anniversaries)) {
        for (const entry of list) {
            if (entry.kind !== 'recurring' || seen.has(entry.id))
                continue;
            if (!occursOnDateKey(entry, dateKey, year, baseYear))
                continue;
            seen.add(entry.id);
            result.push({ entry });
        }
    }
    return result;
}
/**
 * Prüft, ob ein wiederkehrendes Ereignis exakt auf einen Kalendertag fällt.
 *
 * Der Anker (Monat-Tag im Ankerjahr) ist das erste Auftreten; danach wird der
 * Rhythmus auf den konkreten Tag hochgerechnet. Der Tagesrhythmus zählt
 * fortlaufend über Monats- und Jahresgrenzen.
 */
export function occursOnDateKey(entry, dateKey, year, baseYear = 2000) {
    const parts = parseMonthDayKey(entry.monthDay);
    if (!parts)
        return false;
    const { kind, count } = intervalSpecOf(entry);
    const target = dateKeyDayIndex(dateKey);
    const anchor = dayIndex(baseYear, parts.month, parts.day);
    const offset = target - anchor;
    switch (kind) {
        case 'yearly':
            if (count <= 1)
                return true;
            return ((year - baseYear) % count + count) % count === 0;
        case 'daily':
            return offset >= 0 && offset % count === 0;
        case 'weekly': {
            if (offset < 0)
                return false;
            const targetWeekday = ((target + 3) % DAYS_PER_WEEK) + 1;
            const anchorWeekday = ((anchor + 3) % DAYS_PER_WEEK) + 1;
            if (targetWeekday !== anchorWeekday)
                return false;
            return Math.floor(offset / DAYS_PER_WEEK) % count === 0;
        }
        case 'monthly': {
            const months = (year - baseYear) * 12 + (parts.month - 1);
            if (months < 0 || months % count !== 0)
                return false;
            const targetParts = parseMonthDayKey(monthDayOfDateKey(dateKey) ?? '');
            if (!targetParts)
                return false;
            const nth = Math.floor((parts.day - 1) / DAYS_PER_WEEK) + 1;
            const anchorWeekday = ((anchor + 3) % DAYS_PER_WEEK) + 1;
            const candidate = nthWeekdayOfMonth(year, targetParts.month, anchorWeekday, nth);
            return candidate !== null && candidate.day === targetParts.day;
        }
    }
}
/**
 * Alle Einträge eines Monat-Tag-Schlüssels in fester Reihenfolge:
 * zuerst alle Geburtstage, dann alle wiederkehrenden Ereignisse.
 */
export function anniversariesAt(anniversaries, monthDay) {
    const list = anniversaries[monthDay];
    return list ? [...list] : [];
}
/** Alle Geburtstage eines Monat-Tag-Schlüssels. */
export function birthdaysAt(anniversaries, monthDay) {
    return (anniversaries[monthDay] ?? []).filter((entry) => entry.kind === 'birthday');
}
/** Alle wiederkehrenden Ereignisse eines Monat-Tag-Schlüssels. */
export function recurringsAt(anniversaries, monthDay) {
    return (anniversaries[monthDay] ?? []).filter((entry) => entry.kind === 'recurring');
}
/** Der erste Geburtstag eines Monat-Tag-Schlüssels (oder undefined). */
export function birthdayAt(anniversaries, monthDay) {
    return birthdaysAt(anniversaries, monthDay)[0];
}
/** Das erste wiederkehrende Ereignis eines Monat-Tag-Schlüssels (oder undefined). */
export function recurringAt(anniversaries, monthDay) {
    return recurringsAt(anniversaries, monthDay)[0];
}
