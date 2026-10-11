/**
 * SettingsStore-Hook.
 *
 * Hält Jahr und Schicht und persistiert Änderungen. Die Fachlogik wird
 * dabei nicht verändert: ein Jahreswechsel berechnet den Kalender neu, ein
 * Schichtwechsel nur die Schichtdarstellung. Annotationen bleiben in beiden
 * Fällen erhalten, weil sie getrennt und global nach dateKey gespeichert
 * werden.
 */
import { useCallback, useState } from 'react';
import { MAX_EXTRA_COLUMNS, readState, } from '../services/storage.ts';
import { MAX_YEAR, MIN_YEAR, isValidYear } from '../utils/dateUtils.ts';
import { SELECTABLE_YEARS } from '../config/appDefaults.ts';
/** Begrenzt ein Jahr auf den unterstützten Bereich. */
export function clampYear(year) {
    if (!Number.isInteger(year))
        return MIN_YEAR;
    return Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
}
/** Vorjahr innerhalb der Auswahlliste (oder MIN_YEAR). */
export function previousSelectableYear(year) {
    const index = SELECTABLE_YEARS.indexOf(year);
    if (index > 0)
        return SELECTABLE_YEARS[index - 1];
    return clampYear(year - 1);
}
/** Folgejahr innerhalb der Auswahlliste (oder MAX_YEAR). */
export function nextSelectableYear(year) {
    const index = SELECTABLE_YEARS.indexOf(year);
    if (index >= 0 && index < SELECTABLE_YEARS.length - 1)
        return SELECTABLE_YEARS[index + 1];
    return clampYear(year + 1);
}
export function useSettingsStore(initial) {
    const [settings, setSettings] = useState(() => {
        const persisted = readState().settings;
        return {
            selectedYear: isValidYear(initial?.selectedYear ?? persisted.selectedYear)
                ? (initial?.selectedYear ?? persisted.selectedYear)
                : persisted.selectedYear,
            selectedShift: initial?.selectedShift ?? persisted.selectedShift,
            weekdayOverDate: initial?.weekdayOverDate ?? persisted.weekdayOverDate,
            showShiftCalendar: initial?.showShiftCalendar ?? persisted.showShiftCalendar,
            showBirthdays: initial?.showBirthdays ?? persisted.showBirthdays,
            showRecurringEvents: initial?.showRecurringEvents ?? persisted.showRecurringEvents,
            viewMode: initial?.viewMode ?? persisted.viewMode,
            extraColumns: initial?.extraColumns ?? persisted.extraColumns,
        };
    });
    const setYear = useCallback((year) => {
        setSettings((current) => ({ ...current, selectedYear: clampYear(year) }));
    }, []);
    const setShift = useCallback((shiftId) => {
        setSettings((current) => ({ ...current, selectedShift: shiftId }));
    }, []);
    const setWeekdayOverDate = useCallback((enabled) => {
        setSettings((current) => ({ ...current, weekdayOverDate: enabled }));
    }, []);
    const setShowShiftCalendar = useCallback((enabled) => {
        setSettings((current) => ({ ...current, showShiftCalendar: enabled }));
    }, []);
    const setShowBirthdays = useCallback((enabled) => {
        setSettings((current) => ({ ...current, showBirthdays: enabled }));
    }, []);
    const setShowRecurringEvents = useCallback((enabled) => {
        setSettings((current) => ({ ...current, showRecurringEvents: enabled }));
    }, []);
    const setViewMode = useCallback((mode) => {
        setSettings((current) => ({ ...current, viewMode: mode }));
    }, []);
    const addExtraColumn = useCallback((month, side) => {
        setSettings((current) => {
            const existing = current.extraColumns[month];
            const left = [...(existing?.left ?? [])];
            const right = [...(existing?.right ?? [])];
            const target = side === 'left' ? left : right;
            if (target.length >= MAX_EXTRA_COLUMNS)
                return current;
            target.unshift(1);
            return {
                ...current,
                extraColumns: { ...current.extraColumns, [month]: { left, right } },
            };
        });
    }, []);
    const removeExtraColumn = useCallback((month, side, index) => {
        setSettings((current) => {
            const existing = current.extraColumns[month];
            if (!existing)
                return current;
            const list = [...(side === 'left' ? existing.left : existing.right)];
            if (index !== 0 || list.length === 0)
                return current;
            // Jede Zusatzspalte ist eine eigenständige Spalte. Die Spalte an der
            // Trennlinie (Index 0) entfällt vollständig, die übrigen rücken nach.
            list.shift();
            // Ist die Liste danach leer, wird der Monatseintrag entfernt.
            const nextMonth = side === 'left' ? { left: list, right: existing.right } : { left: existing.left, right: list };
            const extraColumns = { ...current.extraColumns };
            if (nextMonth.left.length === 0 && nextMonth.right.length === 0) {
                delete extraColumns[month];
            }
            else {
                extraColumns[month] = nextMonth;
            }
            return { ...current, extraColumns };
        });
    }, []);
    const replaceSettings = useCallback((next) => {
        setSettings((current) => ({
            selectedYear: next.selectedYear !== undefined ? clampYear(next.selectedYear) : current.selectedYear,
            selectedShift: next.selectedShift ?? current.selectedShift,
            weekdayOverDate: next.weekdayOverDate ?? current.weekdayOverDate,
            showShiftCalendar: next.showShiftCalendar ?? current.showShiftCalendar,
            showBirthdays: next.showBirthdays ?? current.showBirthdays,
            showRecurringEvents: next.showRecurringEvents ?? current.showRecurringEvents,
            viewMode: next.viewMode ?? current.viewMode,
            extraColumns: next.extraColumns ?? current.extraColumns,
        }));
    }, []);
    const goToPreviousYear = useCallback(() => {
        setSettings((current) => ({
            ...current,
            selectedYear: previousSelectableYear(current.selectedYear),
        }));
    }, []);
    const goToNextYear = useCallback(() => {
        setSettings((current) => ({
            ...current,
            selectedYear: nextSelectableYear(current.selectedYear),
        }));
    }, []);
    return {
        settings,
        setYear,
        setShift,
        setWeekdayOverDate,
        setShowShiftCalendar,
        setShowBirthdays,
        setShowRecurringEvents,
        setViewMode,
        addExtraColumn,
        removeExtraColumn,
        setSettings: replaceSettings,
        goToPreviousYear,
        goToNextYear,
        canGoToPreviousYear: settings.selectedYear > MIN_YEAR,
        canGoToNextYear: settings.selectedYear < MAX_YEAR,
    };
}
