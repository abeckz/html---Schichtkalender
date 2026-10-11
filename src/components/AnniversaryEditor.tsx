/**
 * AnniversaryEditor.
 *
 * Dialog zum Pflegen aller Jahrestage eines Kalendertags. An einem Tag können
 * mehrere Geburtstage und mehrere wiederkehrende Ereignisse stehen; der Dialog
 * ist daher zweispaltig und jede Spalte führt eine Liste:
 * - links: Geburtstage (Name und optionales Geburtsjahr),
 * - rechts: wiederkehrende Ereignisse (Name und Wiederholungsrhythmus).
 *
 * Der Rhythmus deckt alle gängigen Wiederholungen ab: täglich, wöchentlich,
 * monatlich und jährlich sowie die Steigerungen „alle n Tage/Wochen/Monate/
 * Jahre" über einen wählbaren Zähler.
 *
 * Über „Hinzufügen" entsteht eine leere Zeile, über „Entfernen" wird ein
 * Eintrag gelöscht. Beim Speichern wird die vollständige Liste beider Spalten
 * übergeben; leer gelassene Namen werden verworfen (der Store entfernt sie).
 *
 * Reine Eingabe-Oberfläche: es wird niemals gedruckt und keine Fachlogik
 * (Schichten, Events, Statistiken) verändert. Die Einträge sind jahreslos und
 * werden ausschließlich über den Monat-Tag-Schlüssel geführt.
 */

import { useEffect, useId, useRef, useState } from 'react';
import type { AnniversaryEntry, AnniversaryIntervalKind } from '../domain/types.ts';
import {
  MAX_ANNIVERSARY_NAME_LENGTH,
  MAX_DAILY_INTERVAL_COUNT,
  MIN_ANNIVERSARY_INTERVAL,
  createAnniversaryId,
  maxIntervalCountFor,
} from '../services/storage.ts';
import { intervalSpecOf, isExcludedOn, occursOnDateKey } from '../engines/anniversaryEngine.ts';
import { formatGermanDate, formatMonthDay } from '../utils/dateUtils.ts';

/**
 * Auswahl des Wiederholungsrhythmus.
 *
 * Feste Rhythmen haben den Zähler 1; die „alle n"-Varianten und die
 * ausgeschriebenen Steigerungen (vierteljährlich, halbjährlich) teilen sich
 * die zugrunde liegende Rhythmus-Art mit eigenen Standardzählern.
 */
const INTERVAL_OPTIONS: readonly {
  value: string;
  label: string;
  kind: AnniversaryIntervalKind;
  count?: number;
}[] = [
  { value: 'daily', label: 'Täglich', kind: 'daily' },
  { value: 'weekly', label: 'Wöchentlich', kind: 'weekly' },
  { value: 'monthly', label: 'Monatlich', kind: 'monthly' },
  { value: 'quarterly', label: 'Vierteljährlich', kind: 'monthly', count: 3 },
  { value: 'halfyearly', label: 'Halbjährlich', kind: 'monthly', count: 6 },
  { value: 'yearly', label: 'Jährlich', kind: 'yearly' },
  { value: 'daily-n', label: 'Alle X Tage', kind: 'daily' },
  { value: 'weekly-n', label: 'Alle X Wochen', kind: 'weekly' },
  { value: 'monthly-n', label: 'Alle X Monate', kind: 'monthly' },
  { value: 'yearly-n', label: 'Alle X Jahre', kind: 'yearly' },
];

/** Anfangswert des Zählers, wenn ein Rhythmus gewechselt wird. */
const DEFAULT_COUNTS: Record<AnniversaryIntervalKind, number> = {
  daily: 2,
  weekly: 2,
  monthly: 2,
  yearly: 2,
};

/** Ermittelt den Auswahlwert (inkl. Zähler) eines gespeicherten Eintrags. */
function selectorOf(
  kind: AnniversaryIntervalKind,
  count: number,
): { value: string; count: number } {
  const fixed = INTERVAL_OPTIONS.find(
    (option) => option.kind === kind && option.count === undefined && option.value === kind,
  );
  if (fixed && count === 1) return { value: fixed.value, count };
  // Ausgeschriebene Steigerungen exakt treffen (3 = vierteljährlich, 6 = halbjährlich).
  const spelled = INTERVAL_OPTIONS.find((option) => option.kind === kind && option.count === count);
  if (spelled) return { value: spelled.value, count };
  return { value: `${kind}-n`, count };
}

/** Der zur Auswahl gehörende Rhythmus (Art und voreingestellter Zähler). */
function optionOf(value: string) {
  return INTERVAL_OPTIONS.find((option) => option.value === value) ?? INTERVAL_OPTIONS[5];
}

/** Einheitenname des Zählers je Rhythmus-Art. */
const INTERVAL_UNIT_NAMES: Record<AnniversaryIntervalKind, string> = {
  daily: 'Tage',
  weekly: 'Wochen',
  monthly: 'Monate',
  yearly: 'Jahre',
};

/** Bedeutung des Zählers 1 je Rhythmus-Art. */
const INTERVAL_FIXED_HINT: Record<AnniversaryIntervalKind, string> = {
  daily: 'jeden Tag',
  weekly: 'jede Woche',
  monthly: 'jeden Monat',
  yearly: 'jedes Jahr',
};

/** Hinweis zur Verankerung wöchentlicher Wiederholungen. */
const WEEKDAY_NAMES_HINT = 'Wochentag dieses Datums';

/** Ein bearbeitbarer Geburtstag im Dialog. */
interface BirthdayDraft {
  /** Lokaler Schlüssel (stabil während der Bearbeitung). */
  key: string;
  /** Vorhandene Kennung des Eintrags (bleibt beim Speichern erhalten). */
  id: string;
  name: string;
  birthYear: string;
}

/** Ein bearbeitbares wiederkehrendes Ereignis im Dialog. */
interface RecurringDraft {
  key: string;
  id: string;
  name: string;
  intervalKind: AnniversaryIntervalKind;
  intervalCount: string;
  selectorValue: string;
  countEditable: boolean;
  /** Ausgenommene Einzeltermine (dateKeys), die aus der Serie herausfallen. */
  excludedDates: string[];
  /**
   * Monat-Tag-Schlüssel, an dem die Serie aktuell verankert (gespeichert) ist.
   *
   * Wird der Editor an einem Folgetag geöffnet, kann eine Serie hier mit ihrem
   * Ursprungsanker erscheinen. Beim Speichern wandert der Anker an den
   * angeklickten Tag; die ursprüngliche Position wird entfernt (kein Duplikat).
   */
  originMonthDay: string;
  /** Letzter Termin der Serie ("YYYY-MM-DD"); leer = unbegrenzt. */
  until: string;
}

export interface AnniversaryEditorProps {
  /** Monat-Tag-Schlüssel des bearbeiteten Tages ("MM-DD"). */
  monthDay: string;
  /** Konkret angeklickter Tag ("YYYY-MM-DD") der bearbeiteten Zelle. */
  dateKey: string;
  /** Bezugsjahr (für die Prüfung, ob dieser Tag ein Vorkommen ist). */
  year: number;
  /** Alle vorhandenen Einträge des Tages (Geburtstage und Ereignisse). */
  initialEntries: AnniversaryEntry[];
  /**
   * Speichert die vollständige Liste des Tages. Leere Namen werden vom Store
   * verworfen; eine leere Liste entfernt den Tag.
   */
  onSave: (entries: AnniversaryEntry[]) => void;
  /** Entfernt alle Einträge des Tages. */
  onReset: () => void;
  /**
   * Nimmt ein einzelnes Vorkommen einer Serie aus bzw. wieder auf.
   * `excluded === true` entfernt nur diesen Tag, die Serie bleibt bestehen.
   */
  onToggleOccurrence: (
    monthDay: string,
    id: string,
    dateKey: string,
    excluded: boolean,
  ) => void;
  /**
   * Setzt das Ende einer Serie (`until`, "YYYY-MM-DD") bzw. hebt es mit einem
   * leeren Wert wieder auf. Der Tag selbst findet noch statt.
   */
  onEndSeries: (monthDay: string, id: string, until: string) => void;
  onClose: () => void;
}

/** Baut den lokalen Entwurf eines Geburtstags aus einem Eintrag. */
function toBirthdayDraft(entry: AnniversaryEntry): BirthdayDraft {
  return {
    key: entry.id,
    id: entry.id,
    name: entry.name,
    birthYear: entry.birthYear !== undefined ? String(entry.birthYear) : '',
  };
}

/** Baut den lokalen Entwurf eines wiederkehrenden Ereignisses aus einem Eintrag. */
function toRecurringDraft(entry: AnniversaryEntry): RecurringDraft {
  const spec = intervalSpecOf(entry);
  const selector = selectorOf(spec.kind, spec.count);
  return {
    key: entry.id,
    id: entry.id,
    name: entry.name,
    intervalKind: spec.kind,
    intervalCount: String(spec.count),
    selectorValue: selector.value,
    countEditable: selector.value.endsWith('-n'),
    excludedDates: entry.excludedDates ?? [],
    originMonthDay: entry.monthDay,
    until: entry.until ?? '',
  };
}

/** Eine neue, leere Geburtstags-Zeile. */
function emptyBirthdayDraft(): BirthdayDraft {
  const id = createAnniversaryId();
  return { key: id, id, name: '', birthYear: '' };
}

/** Eine neue, leere Ereignis-Zeile (Standardrhythmus: jährlich). */
function emptyRecurringDraft(monthDay: string): RecurringDraft {
  const id = createAnniversaryId();
  return {
    key: id,
    id,
    name: '',
    intervalKind: 'yearly',
    intervalCount: '1',
    selectorValue: 'yearly',
    countEditable: false,
    excludedDates: [],
    originMonthDay: monthDay,
    until: '',
  };
}

export function AnniversaryEditor({
  monthDay,
  dateKey,
  year,
  initialEntries,
  onSave,
  onReset,
  onToggleOccurrence,
  onEndSeries,
  onClose,
}: AnniversaryEditorProps) {
  const [birthdays, setBirthdays] = useState<BirthdayDraft[]>(() =>
    initialEntries.filter((entry) => entry.kind === 'birthday').map(toBirthdayDraft),
  );
  const [recurrings, setRecurrings] = useState<RecurringDraft[]>(() =>
    initialEntries.filter((entry) => entry.kind === 'recurring').map(toRecurringDraft),
  );

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  // Beim Wechsel des Tages den Zustand neu aufbauen. Bewusst nur an den Tag
  // gebunden: der Editor wird beim Schließen ausgehängt, sodass beim erneuten
  // Öffnen bereits der neue Zustand initialisiert wird.
  useEffect(() => {
    setBirthdays(initialEntries.filter((entry) => entry.kind === 'birthday').map(toBirthdayDraft));
    setRecurrings(
      initialEntries.filter((entry) => entry.kind === 'recurring').map(toRecurringDraft),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthDay]);

  function updateBirthday(key: string, patch: Partial<BirthdayDraft>) {
    setBirthdays((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function updateRecurring(key: string, patch: Partial<RecurringDraft>) {
    setRecurrings((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  /** Baut aus einem Entwurf einen Eintrag (für die Rhythmus-Prüfung). */
  function draftEntry(row: RecurringDraft): AnniversaryEntry {
    const parsedCount = Number(row.intervalCount);
    const entry: AnniversaryEntry = {
      id: row.id,
      // Anker = Ursprungsspeicherort; nur so stimmt der Rhythmus auch dann,
      // wenn der Editor an einem Folgetag geöffnet wurde.
      monthDay: row.originMonthDay,
      name: row.name,
      kind: 'recurring',
      intervalKind: row.intervalKind,
      intervalCount: parsedCount >= 1 ? parsedCount : 1,
    };
    if (row.excludedDates.length > 0) entry.excludedDates = row.excludedDates;
    if (row.until !== '') entry.until = row.until;
    return entry;
  }

  /**
   * true, wenn der angeklickte Tag (`dateKey`) nach dem Rhythmus ein Vorkommen
   * dieses Eintrags ist. Nur dann lässt sich genau dieses Vorkommen ausnehmen.
   *
   * Als Basisjahr dient das angezeigte Jahr selbst - so stimmt das Muster mit
   * der jahreslosen Anzeige überein (dort ist der Anker ebenfalls im
   * angezeigten Jahr verortet).
   */
  function occurrenceHere(row: RecurringDraft): boolean {
    return occursOnDateKey(draftEntry(row), dateKey, year, year);
  }

  /** true, wenn genau dieses Vorkommen aktuell ausgenommen ist. */
  function occurrenceExcluded(row: RecurringDraft): boolean {
    return isExcludedOn(draftEntry(row), dateKey);
  }

  /**
   * true, wenn diese Serie an einem anderen Tag verankert ist als dem
   * angeklickten – sie erscheint hier also nur als Vorkommen.
   */
  function isForeignOccurrence(row: RecurringDraft): boolean {
    return row.originMonthDay !== monthDay;
  }

  /** true, wenn die Serie mit dem angeklickten Tag endet (letzter Termin). */
  function endsHere(row: RecurringDraft): boolean {
    return row.until !== '' && row.until === dateKey;
  }

  /** true, wenn der angeklickte Tag nach dem gesetzten Serienende liegt. */
  function isAfterEnd(row: RecurringDraft): boolean {
    return row.until !== '' && dateKey > row.until;
  }

  /**
   * Beendet die Serie mit dem angeklickten Tag: der Tag selbst findet noch
   * statt, alle späteren Termine fallen weg. Erneutes Auslösen hebt das Ende
   * wieder auf (Serie läuft unbegrenzt weiter).
   */
  function endSeriesHere(row: RecurringDraft) {
    const next = endsHere(row) ? '' : dateKey;
    updateRecurring(row.key, { until: next });
    onEndSeries(row.originMonthDay, row.id, next);
  }

  /** Wechselt den Wiederholungsrhythmus einer Zeile und passt den Zähler an. */
  function changeInterval(key: string, value: string) {
    const option = optionOf(value);
    if (option.count !== undefined) {
      // Ausgeschriebene Steigerung (vierteljährlich/halbjährlich).
      updateRecurring(key, {
        selectorValue: value,
        intervalKind: option.kind,
        intervalCount: String(option.count),
        countEditable: false,
      });
      return;
    }
    if (value.endsWith('-n')) {
      // Freie Wahl: vorhandenen Zähler beibehalten, sonst Standard setzen.
      setRecurrings((current) =>
        current.map((row) => {
          if (row.key !== key) return row;
          const parsed = Number(row.intervalCount);
          const count =
            Number.isInteger(parsed) && parsed > 1
              ? row.intervalCount
              : String(DEFAULT_COUNTS[option.kind]);
          return {
            ...row,
            selectorValue: value,
            intervalKind: option.kind,
            intervalCount: count,
            countEditable: true,
          };
        }),
      );
      return;
    }
    updateRecurring(key, { selectorValue: value, intervalKind: option.kind, intervalCount: '1', countEditable: false });
  }

  useEffect(() => {
    firstInputRef.current?.focus();
  }, [monthDay]);

  // Escape schließt den Dialog; der Fokus bleibt im Dialog.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const hasContent =
    birthdays.some((row) => row.name.trim() !== '') ||
    recurrings.some((row) => row.name.trim() !== '');

  /**
   * Überträgt die Entwürfe in speicherbare Einträge (ohne leere Namen).
   *
   * Serie, die hier nur als **Vorkommen** erscheint (Anker an einem anderen
   * Tag), werden dabei nicht übernommen: Sie gehören weiterhin ihrem
   * Ursprungstag und werden ausschließlich über die Sofort-Aktionen
   * „Nur dieses Vorkommen löschen" bzw. „Serie ab hier beenden" verändert. So
   * verschiebt ein bloßes Speichern den Serien-Anker nicht.
   */
  function collectEntries(): AnniversaryEntry[] {
    const entries: AnniversaryEntry[] = [];
    for (const row of birthdays) {
      if (row.name.trim() === '') continue;
      const entry: AnniversaryEntry = {
        id: row.id,
        monthDay,
        name: row.name.trim(),
        kind: 'birthday',
      };
      const parsedYear = Number(row.birthYear);
      if (row.birthYear !== '' && Number.isInteger(parsedYear) && parsedYear > 0) {
        entry.birthYear = parsedYear;
      }
      entries.push(entry);
    }
    for (const row of recurrings) {
      if (row.name.trim() === '') continue;
      if (isForeignOccurrence(row)) continue;
      const parsedCount = Number(row.intervalCount);
      const entry: AnniversaryEntry = {
        id: row.id,
        monthDay,
        name: row.name.trim(),
        kind: 'recurring',
        intervalKind: row.intervalKind,
        intervalCount: parsedCount >= 1 ? parsedCount : 1,
      };
      // Ausgenommene Einzeltermine bleiben beim Speichern erhalten.
      if (row.excludedDates.length > 0) entry.excludedDates = [...row.excludedDates].sort();
      // Ein gesetztes Serienende bleibt erhalten.
      if (row.until !== '') entry.until = row.until;
      entries.push(entry);
    }
    return entries;
  }

  return (
    <div className="editor-backdrop no-print" role="presentation" onClick={onClose}>
      <div
        className="anniversary-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="anniversary-editor-header">
          <h2 className="day-editor-title" id={titleId}>
            Geburtstage &amp; wiederkehrende Ereignisse
          </h2>
          <p className="anniversary-editor-date">{formatMonthDay(monthDay)}</p>
        </header>
        <div className="anniversary-editor-columns">
          <section className="anniversary-column" aria-label="Geburtstage">
            <h3 className="anniversary-column-title">
              <span aria-hidden="true">🎂</span> Geburtstage
            </h3>
            {birthdays.map((row, index) => (
              <div className="anniversary-entry-row" key={row.key}>
                <div className="editor-field">
                  <label className="field-label" htmlFor={`${row.key}-name`}>
                    Name
                  </label>
                  <input
                    id={`${row.key}-name`}
                    ref={index === 0 ? firstInputRef : undefined}
                    type="text"
                    className="text-input"
                    value={row.name}
                    maxLength={MAX_ANNIVERSARY_NAME_LENGTH}
                    placeholder="z. B. Anna"
                    onChange={(event) =>
                      updateBirthday(row.key, {
                        name: event.target.value.slice(0, MAX_ANNIVERSARY_NAME_LENGTH),
                      })
                    }
                  />
                </div>
                <div className="editor-field">
                  <label className="field-label" htmlFor={`${row.key}-year`}>
                    Geburtsjahr (optional)
                  </label>
                  <input
                    id={`${row.key}-year`}
                    type="number"
                    inputMode="numeric"
                    min={1900}
                    max={2200}
                    className="text-input"
                    value={row.birthYear}
                    placeholder="z. B. 1990"
                    onChange={(event) =>
                      updateBirthday(row.key, {
                        birthYear: event.target.value.replace(/[^0-9]/g, '').slice(0, 4),
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  className="row-remove-button"
                  aria-label="Geburtstag entfernen"
                  title="Diesen Geburtstag entfernen"
                  onClick={() =>
                    setBirthdays((current) => current.filter((item) => item.key !== row.key))
                  }
                >
                  Entfernen
                </button>
              </div>
            ))}
            <button
              type="button"
              className="row-add-button"
              onClick={() => setBirthdays((current) => [...current, emptyBirthdayDraft()])}
            >
              ＋ Geburtstag hinzufügen
            </button>
          </section>
          <section className="anniversary-column" aria-label="Wiederkehrende Ereignisse">
            <h3 className="anniversary-column-title">
              <span aria-hidden="true">🔁</span> Wiederkehrende Ereignisse
            </h3>
            {recurrings.map((row) => (
              <div className="anniversary-entry-row" key={row.key}>
                {isForeignOccurrence(row) && (
                  <p className="anniversary-occurrence-note field-hint">
                    Vorkommen der Serie vom {formatMonthDay(row.originMonthDay)}
                    {row.until !== '' && `, Ende ${formatGermanDate(row.until)}`}
                  </p>
                )}
                <div className="editor-field">
                  <label className="field-label" htmlFor={`${row.key}-name`}>
                    Name
                  </label>
                  <input
                    id={`${row.key}-name`}
                    type="text"
                    className="text-input"
                    value={row.name}
                    maxLength={MAX_ANNIVERSARY_NAME_LENGTH}
                    placeholder="z. B. Jubiläum"
                    onChange={(event) =>
                      updateRecurring(row.key, {
                        name: event.target.value.slice(0, MAX_ANNIVERSARY_NAME_LENGTH),
                      })
                    }
                  />
                </div>
                <div className="editor-field">
                  <label className="field-label" htmlFor={`${row.key}-interval`}>
                    Wiederholung
                  </label>
                  <select
                    id={`${row.key}-interval`}
                    className="year-select text-input"
                    value={row.selectorValue}
                    onChange={(event) => changeInterval(row.key, event.target.value)}
                  >
                    {INTERVAL_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="field-hint">
                    Grundlage ist das Datum des angeklickten Tages (z. B. „Wöchentlich" = jeder{' '}
                    {WEEKDAY_NAMES_HINT} nach diesem Datum).
                  </span>
                </div>
                {row.countEditable && (
                  <div className="editor-field">
                    <label className="field-label" htmlFor={`${row.key}-count`}>
                      Anzahl {INTERVAL_UNIT_NAMES[row.intervalKind]}
                    </label>
                    <input
                      id={`${row.key}-count`}
                      type="number"
                      inputMode="numeric"
                      min={MIN_ANNIVERSARY_INTERVAL}
                      max={maxIntervalCountFor(row.intervalKind)}
                      className="text-input"
                      value={row.intervalCount}
                      onChange={(event) =>
                        updateRecurring(row.key, {
                          intervalCount: event.target.value.replace(/[^0-9]/g, '').slice(0, 3),
                        })
                      }
                    />
                    <span className="field-hint">
                      1 = {INTERVAL_FIXED_HINT[row.intervalKind]}; höchstens{' '}
                      {maxIntervalCountFor(row.intervalKind)}.
                    </span>
                  </div>
                )}
                <div className="anniversary-remove-actions">
                  <button
                    type="button"
                    className="row-remove-button"
                    aria-label="Ereignisserie entfernen"
                    title="Die gesamte Ereignisserie entfernen (alle Termine)"
                    onClick={() =>
                      setRecurrings((current) => current.filter((item) => item.key !== row.key))
                    }
                  >
                    Serie löschen
                  </button>
                  {occurrenceHere(row) && (
                    <button
                      type="button"
                      className="row-remove-button is-occurrence"
                      aria-label={
                        occurrenceExcluded(row)
                          ? 'Vorkommen wieder aufnehmen'
                          : 'Nur dieses Vorkommen löschen'
                      }
                      title={
                        occurrenceExcluded(row)
                          ? `${formatGermanDate(dateKey)} wieder in die Serie aufnehmen`
                          : `Nur den ${formatGermanDate(dateKey)} aus der Serie ausnehmen`
                      }
                      onClick={() => {
                        const nextExcluded = !occurrenceExcluded(row);
                        updateRecurring(row.key, {
                          excludedDates: nextExcluded
                            ? [...row.excludedDates, dateKey].sort()
                            : row.excludedDates.filter((key) => key !== dateKey),
                        });
                        onToggleOccurrence(row.originMonthDay, row.id, dateKey, nextExcluded);
                      }}
                    >
                      {occurrenceExcluded(row)
                        ? 'Vorkommen zurücknehmen'
                        : 'Nur dieses Vorkommen löschen'}
                    </button>
                  )}
                  <button
                    type="button"
                    className="row-remove-button is-occurrence"
                    aria-label={
                      endsHere(row) ? 'Serienende aufheben' : 'Serie ab diesem Datum beenden'
                    }
                    title={
                      endsHere(row)
                        ? 'Das Serienende aufheben – die Serie läuft wieder unbegrenzt weiter'
                        : `Die Serie nach dem ${formatGermanDate(dateKey)} nicht weiterführen`
                    }
                    onClick={() => endSeriesHere(row)}
                  >
                    {endsHere(row) ? 'Serienende aufheben' : 'Serie ab hier beenden'}
                  </button>
                </div>
                {row.until !== '' && (
                  <p
                    className={
                      isAfterEnd(row)
                        ? 'anniversary-occurrence-note field-hint is-ended'
                        : 'anniversary-occurrence-note field-hint'
                    }
                  >
                    Serie endet am {formatGermanDate(row.until)}
                    {isAfterEnd(row) && ' – dieser Tag liegt danach'}
                  </p>
                )}
              </div>
            ))}
            <button
              type="button"
              className="row-add-button"
              onClick={() => setRecurrings((current) => [...current, emptyRecurringDraft(monthDay)])}
            >
              ＋ Ereignis hinzufügen
            </button>
          </section>
        </div>

        <p className="field-hint anniversary-editor-hint">
          {MAX_DAILY_INTERVAL_COUNT} Tage sind für „Alle X Tage" die Obergrenze; „Alle X
          Wochen/Monate/Jahre" endet bei 99.
        </p>

        <div className="editor-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Abbrechen
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={!hasContent && birthdays.length === 0 && recurrings.length === 0}
            onClick={() => {
              onReset();
              onClose();
            }}
          >
            Zurücksetzen
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              onSave(collectEntries());
              onClose();
            }}
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}
