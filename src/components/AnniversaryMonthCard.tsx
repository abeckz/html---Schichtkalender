/**
 * Ein Monatsblock der jahreslosen Ansicht.
 *
 * Zeigt nur Tagesnummer und Wochentag; Schichten, KW und Feiertage gibt es in
 * dieser Ansicht nicht. Die an einem Tag eingetragenen Jahrestage erscheinen
 * direkt in der Zeile (Geburtstage mit Torten-Emoji, wiederkehrende Ereignisse
 * mit Wiederholungssymbol). Der Klick auf eine Zeile öffnet den Editor.
 */

import type { AnniversaryMap } from '../domain/types.ts';
import {
  MONTH_NAMES,
  getDaysInMonth,
  getIsoWeekday,
  getWeekdayShort,
  toDateKey,
} from '../utils/dateUtils.ts';
import { matchesForDateKey } from '../engines/anniversaryEngine.ts';

export interface AnniversaryMonthCardProps {
  /** Bezugsjahr (nur für Tagesanzahl und Wochentag). */
  year: number;
  /** 1 = Januar ... 12 = Dezember */
  month: number;
  anniversaries: AnniversaryMap;
  /** Öffnet den Editor anhand eines Tages. */
  onOpenEditor: (day: import('../domain/types.ts').CalendarDay) => void;
}

export function AnniversaryMonthCard({
  year,
  month,
  anniversaries,
  onOpenEditor,
}: AnniversaryMonthCardProps) {
  const dayCount = getDaysInMonth(year, month);
  const name = MONTH_NAMES[month - 1];

  return (
    <section className="month-card anniversary-month-card" aria-label={`${name} (jahreslos)`}>
      <header className="month-header">
        <span className="month-stat" aria-hidden="true" />
        <h2 className="month-title">{name}</h2>
        <span className="month-stat" aria-hidden="true" />
      </header>

      <div className="day-table anniversary-day-table" role="table" aria-label={`Tage im ${name}`}>
        {Array.from({ length: dayCount }, (_, index) => index + 1).map((day) => {
          const isoWeekday = getIsoWeekday(year, month, day);
          const dateKey = toDateKey(year, month, day);
          // Alle Jahrestage dieses konkreten Kalendertags: Geburtstage hängen am
          // Monat-Tag-Schlüssel; wiederkehrende Ereignisse werden über ihren
          // Rhythmus geprüft und erscheinen daher auch an anderen Tagen als
          // ihrem Ankertag (z. B. „wöchentlich" an jedem passenden Wochentag).
          // Ausgenommene Einzeltermine (`excludedDates`) und ein gesetztes
          // Serienende (`until`) werden dabei berücksichtigt.
          //
          // Als Basisjahr dient das angezeigte Jahr selbst: In der jahreslosen
          // Ansicht soll das Muster stabil bleiben (der Anker liegt immer im
          // selben „Jahr" wie der geprüfte Tag), damit z. B. „jeden 2. Montag"
          // unabhängig vom Bezugsjahr immer dieselben Wochentage trifft.
          const entries = matchesForDateKey(anniversaries, dateKey, year, year).map(
            ({ entry }) => entry,
          );
          const weekdayShort = getWeekdayShort(isoWeekday);
          const weekdayLabel = `${weekdayShort} ${day}.`;
          const isWeekend = isoWeekday >= 6;
          const isSunday = isoWeekday === 7;
          const names = entries.map((entry) => entry.name).join(', ');
          const ariaLabel = entries.length > 0
            ? `${weekdayLabel}, ${names}`
            : `${weekdayLabel}, Eintrag hinzufügen`;

          const classNames = ['day-row', 'anniversary-row'];
          if (isWeekend) classNames.push('is-weekend');
          if (isSunday) classNames.push('is-sunday');
          if (entries.some((entry) => entry.kind === 'birthday')) classNames.push('is-birthday');
          if (entries.some((entry) => entry.kind === 'recurring')) classNames.push('is-recurring');

          return (
            <button
              key={dateKey}
              type="button"
              className={classNames.join(' ')}
              onClick={() => onOpenEditor(makeDay(year, month, day))}
              aria-label={ariaLabel}
              title={ariaLabel}
            >
              <span className="cell cell-weekday anniversary-weekday">{weekdayShort}</span>
              <span className="cell cell-day anniversary-day">{String(day).padStart(2, '0')}</span>
              <span className="cell cell-information anniversary-information">
                {entries.map((entry, entryIndex) => (
                  <span
                    key={entry.id}
                    className={
                      entry.kind === 'birthday'
                        ? 'anniversary-entry is-birthday'
                        : 'anniversary-entry is-recurring'
                    }
                  >
                    {entryIndex > 0 && ' · '}
                    <span className="anniversary-emoji" aria-hidden="true">
                      {entry.kind === 'birthday' ? '🎂' : '🔁'}
                    </span>{' '}
                    <span className="anniversary-name">{entry.name}</span>
                  </span>
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Baut einen schlanken Kalendertag für die jahreslose Ansicht.
 *
 * Es werden ausschließlich Datumsangaben benötigt (für Editor und
 * aria-Label); Schicht- und Ereignisfelder bleiben leer, weil diese Ansicht
 * keine Schichten kennt.
 */
function makeDay(year: number, month: number, day: number): import('../domain/types.ts').CalendarDay {
  const isoWeekday = getIsoWeekday(year, month, day);
  return {
    dateKey: toDateKey(year, month, day),
    year,
    month,
    day,
    isoWeekday,
    weekdayShort: getWeekdayShort(isoWeekday),
    isoWeek: 0,
    shiftState: 'OFF',
    shiftLabel: '',
    events: [],
    isWeekend: isoWeekday >= 6,
    isSunday: isoWeekday === 7,
  };
}
