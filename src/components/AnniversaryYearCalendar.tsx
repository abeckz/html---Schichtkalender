/**
 * Jahreslose Ansicht für Geburtstage und wiederkehrende Ereignisse.
 *
 * Diese Ansicht zeigt ausschließlich die zwölf Monate ohne Jahr, ohne
 * Schichten und ohne feste Datumsbezüge. Jede Zelle trägt nur die Tagesnummer
 * (und den Wochentag) sowie die an diesem Tag eingetragenen Jahrestage.
 *
 * Es werden hier keine Fachdaten berechnet: die Anzeige stützt sich
 * ausschließlich auf die jahreslosen Einträge (Monat-Tag-Schlüssel). Ein Klick
 * auf eine Zelle öffnet den zweispaltigen Editor.
 */

import type { AnniversaryMap, CalendarDay } from '../domain/types.ts';
import { AnniversaryMonthCard } from './AnniversaryMonthCard.tsx';

export interface AnniversaryYearCalendarProps {
  /** Bezugsjahr (nur für die Berechnung der Tagesanzahl/Schaltjahr). */
  year: number;
  anniversaries: AnniversaryMap;
  /** Öffnet den Editor für einen Tag. */
  onOpenEditor: (day: CalendarDay) => void;
}

export function AnniversaryYearCalendar({
  year,
  anniversaries,
  onOpenEditor,
}: AnniversaryYearCalendarProps) {
  return (
    <div className="year-calendar anniversary-year-calendar">
      {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
        <AnniversaryMonthCard
          key={month}
          year={year}
          month={month}
          anniversaries={anniversaries}
          onOpenEditor={onOpenEditor}
        />
      ))}
    </div>
  );
}
