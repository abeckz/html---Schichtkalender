/**
 * Zentrales Domain-Modell des Schichtkalenders.
 *
 * Alle fachlichen Typen werden genau einmal hier definiert und von den
 * Engines, Services, der Screen-UI und der Print-UI gemeinsam verwendet
 * (Single Source of Truth).
 */

/** Kennung eines Schichtsystems. */
export type ShiftId = 'I' | 'II' | 'III' | 'A' | 'B' | 'C' | 'D';

/** Zustand eines Kalendertages innerhalb eines Schichtzyklus. */
export type ShiftState = 'DAY' | 'NIGHT' | 'OFF';

/** Kennung einer persönlichen Annotationsfarbe. */
export type AnnotationColorId =
  | 'yellow'
  | 'green'
  | 'blue'
  | 'orange'
  | 'pink'
  | 'red'
  | 'purple'
  | 'turquoise'
  | 'gray';

/** Definition eines Schichtsystems (datengetrieben, zyklisch). */
export interface ShiftDefinition {
  readonly id: ShiftId;
  /** Länge des Zyklus in Kalendertagen. */
  readonly cycleLength: number;
  /** Muster in Zyklusreihenfolge; index = Position im Zyklus. */
  readonly pattern: readonly ShiftState[];
  /** Anzeigename für die UI. */
  readonly displayName: string;
}

/** Ein Kalenderereignis (Feiertag, Brauchtum, Sommerzeit ...). */
export interface CalendarEvent {
  id: string;
  name: string;
  /** Kalendertag im Format YYYY-MM-DD. */
  dateKey: string;
  /**
   * true, wenn der Tag als bezahlter Feiertag mit normaler Schicht gilt.
   * Grundlage für paidWeekdayHolidayCount.
   */
  countsAsPaidNormalShiftHoliday: boolean;
  /**
   * true für gesetzliche Feiertage.
   *
   * Diese Kennzeichnung steuert ausschließlich die Anzeige des rosa
   * "F!"-Rechtecks in der KW-Spalte. Sie ist bewusst unabhängig von
   * countsAsPaidNormalShiftHoliday, weil die Kennzahl die Werktagsfeiertage
   * nach der bestehenden Referenz zählt (dort sind auch regionale/hohe
   * Feiertage wie Mariä Himmelfahrt und Allerheiligen enthalten).
   */
  isPublicHoliday: boolean;
  /** Anzeigepriorität; kleinere Zahl = wichtigere Anzeige. */
  priority: number;
}

/** Ein vollständig berechneter Kalendertag. */
export interface CalendarDay {
  dateKey: string;
  year: number;
  /** 1 = Januar ... 12 = Dezember */
  month: number;
  day: number;

  /** 1 = Montag ... 7 = Sonntag */
  isoWeekday: number;
  /** Mo, Di, Mi, Do, Fr, Sa, So */
  weekdayShort: string;
  /** ISO-8601-Kalenderwoche (1..53) */
  isoWeek: number;

  shiftState: ShiftState;
  /** "T", "N" oder "" (OFF) */
  shiftLabel: string;

  events: CalendarEvent[];

  isWeekend: boolean;
  isSunday: boolean;
}

/** Persönliche, vom Benutzer gesetzte Markierung eines Tages. */
export interface UserDayAnnotation {
  dateKey: string;
  /** Freitext, maximal 50 Zeichen. */
  label: string;
  colorId: AnnotationColorId | null;
}

/** Monatskennzahlen. */
export interface MonthStatistics {
  /** Alle Kalendertage von Montag bis Freitag (Feiertage zählen mit). */
  weekdayCount: number;
  dayShiftCount: number;
  nightShiftCount: number;
  /** dayShiftCount + nightShiftCount */
  requiredShiftCount: number;
  /**
   * Ereignisse mit countsAsPaidNormalShiftHoliday === true an Werktagen
   * (Montag bis Freitag). Samstags- und sonntagsfeiertage zählen nicht mit.
   */
  paidWeekdayHolidayCount: number;
  /**
   * Anzahl halber Feiertage aus Nachtschichtüberhängen.
   *
   * Die Nachtschicht läuft von 18 bis 6 Uhr und reicht damit in den Folgetag
   * hinein. Liegt am Folgetag ein bezahlter Feiertag
   * (countsAsPaidNormalShiftHoliday === true), wird die Nachtschicht zur
   * Hälfte auf den Feiertag angerechnet: je Nachtschicht mit Feiertag am
   * Folgetag zählt ein halber Feiertag.
   *
   * Der Wert ist die Summe dieser halben Anteile (z. B. 2 bei vier
   * betroffenen Nachtschichten) und damit immer ein Vielfaches von 0,5.
   * Der Feiertag selbst wird zusätzlich über paidWeekdayHolidayCount
   * erfasst, sofern er auf einen Werktag fällt; der Nachtschichttag kann
   * unabhängig davon auf ein Wochenende fallen.
   */
  paidNightShiftHolidayCount: number;
  /**
   * Gesamte bezahlte Feiertage des Monats:
   * paidWeekdayHolidayCount + 0,5 × paidNightShiftHolidayCount.
   */
  paidHolidayCount: number;
}

/** Ein berechneter Monat. */
export interface MonthCalendar {
  year: number;
  /** 1 = Januar ... 12 = Dezember */
  month: number;
  name: string;
  /** Kurzname für die Printansicht, z. B. "JAN". */
  shortName: string;
  days: CalendarDay[];
  statistics: MonthStatistics;
}

/** Ein vollständig berechnetes Kalenderjahr. */
export interface YearCalendar {
  year: number;
  selectedShift: ShiftId;
  months: MonthCalendar[];
}

/** Eingangskonfiguration der Kalenderberechnung. */
export interface CalendarConfiguration {
  year: number;
  selectedShift: ShiftId;
}

/** Eine Farbe der persönlichen Palette. */
export interface AnnotationColor {
  id: AnnotationColorId;
  /** Deutscher Anzeigename. */
  name: string;
  /** Hexwert inkl. führendem "#". */
  hex: string;
}

/** Persistierte Anwendungseinstellungen. */
export interface AppSettings {
  selectedYear: number;
  selectedShift: ShiftId;
}

/** Persistierte Annotationen, global nach dateKey. */
export type AnnotationMap = Record<string, UserDayAnnotation>;

/** Versionierter LocalStorage-Zustand. */
export interface PersistedState {
  version: number;
  settings: AppSettings;
  annotations: AnnotationMap;
}
