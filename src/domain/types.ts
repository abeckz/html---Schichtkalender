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

/**
 * Färbbare Spalte einer Tageszeile.
 *
 * Über einen gezogenen Streifen lassen sich ausschließlich die drei linken
 * Spalten einfärben:
 * - 'weekday': Wochentag
 * - 'day': Tagesnummer
 * - 'shift': Schichtrhythmus T/N
 *
 * 'info' ist die Informationsspalte; sie wird weiterhin über den DayEditor
 * eingefärbt (persönliche Tagesfarbe). Damit sind in einer Zeile bis vier
 * verschiedene Farben möglich.
 *
 * Zusätzlich kann der Benutzer je Monat schmale, freie Spalten anlegen
 * (`Zusatzspalte`). Deren Farben werden wie die der Informationsspalte über den
 * DayEditor gesetzt (persönliche Tagesfarbe des Tages in dieser Spalte).
 */
export type ColumnColorName = 'weekday' | 'day' | 'shift' | 'info';

/**
 * Schlüssel der Farbe einer Zusatzspalte in den persönlichen Tagesmarkierungen.
 *
 * Die Zusatzspalten sind je Monat frei anlegbar und fortlaufend nummeriert;
 * `0` steht für die erste, `1` für die zweite Spalte usw. Damit bleiben die
 * Schlüssel stabil, auch wenn links oder rechts weitere Spalten hinzukommen.
 */
export type ExtraColumnColorKey = `extra${number}`;

/**
 * Zielspalte einer Streifen-Auswahl (Ziehen mit gedrückter Maustaste).
 *
 * Neben den festen Farbspalten der Tageszeile ('weekday', 'day', 'shift')
 * lassen sich auch die frei angelegten Zusatzspalten markieren und einfärben.
 * Deren Ziel wird über den stabilen Farbschlüssel (`extra0`, `extra1`, …)
 * benannt, damit die Auswahl unabhängig von der Lage der Spalte bleibt.
 */
export type StreakColumnTarget = ColumnColorName | ExtraColumnColorKey;

/**
 * Zieh-Ziel einer einzelnen Breiteneinheit einer Zusatzspalte.
 *
 * Eine erweiterte Zusatzspalte (`ExtraColumns.left: [2]`) besteht aus mehreren
 * Breiteneinheiten mit **demselben** Farbschlüssel: gefärbt und beschriftet wird
 * immer die ganze Spalte. Für die Streifen-Auswahl muss jedoch die einzelne
 * Einheit unterscheidbar sein, damit beim Ziehen ausschließlich die Spalte unter
 * dem Zeiger hervorgehoben wird. Die erste Einheit trägt deshalb den reinen
 * Farbschlüssel ('extra0'), jede weitere einen Suffix ('extra0#1').
 */
export type ExtraColumnUnitKey = ExtraColumnColorKey | `${ExtraColumnColorKey}#${number}`;

/**
 * Zieh-Ziel der Streifen-Auswahl: feste Farbspalte oder einzelne
 * Breiteneinheit einer Zusatzspalte.
 */
export type StreakTarget = StreakColumnTarget | ExtraColumnUnitKey;

/**
 * Querliegender Text einer Zusatzspalte.
 *
 * Der Text gehört zu einer markierten Spanne (Streifen-Auswahl) innerhalb einer
 * Zusatzspalte und wird als **ein** Eintrag gespeichert. Anker ist die oberste
 * markierte Zelle; `dateKeys` hält die vollständige, chronologisch sortierte
 * Spanne, damit die Darstellung den Text mittig über alle markierten Zellen
 * setzen kann. `length` ist die Anzahl der markierten Zellen (Zeilenhöhen) und
 * dient als Gradmaß für die zentrierte Platzierung.
 *
 * Ist `vertical` gesetzt (Checkbox "Querliegender Text"), wird der Text um 90°
 * nach links gedreht mittig über die Gesamtzahl der markierten Zellen gesetzt.
 */
export interface ExtraColumnText {
  /** Zusatzspalten-Farbschlüssel ('extra0', 'extra1', …). */
  colorKey: ExtraColumnColorKey;
  /** Anzeigename der Spalte (z. B. "Zusatzspalte 0"). */
  columnLabel: string;
  /** Querliegender (= um 90° nach links gedrehter) Text. */
  vertical: boolean;
  /** Freitext; bei `vertical === false` normale horizontale Darstellung. */
  text: string;
  /** Chronologisch sortierte Spanne der markierten Tage (inkl. Anker). */
  dateKeys: string[];
  /** Anzahl der markierten Zellen; entspricht `dateKeys.length`. */
  length: number;
}

/**
 * Anordnung der Zusatzspalten eines Monats.
 *
 * - `left`: schmale Spalten zwischen der großen Kommentarspalte und der
 *   KW-Spalte (sie schieben KW und T/N nach rechts),
 * - `right`: schmale Spalten zwischen der KW-Spalte und der Schichtspalte T/N
 *   (sie schieben T/N nach rechts).
 *
 * Beide Listen führen die Anzahl der angelegten Spalten (`width` = Anzahl der
 * Einheiten à ~1,6 em). Das Feld wird als Ganzes gespeichert.
 */
export interface ExtraColumns {
  left: number[];
  right: number[];
}

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
   * "F"-Rechtecks in der KW-Spalte. Sie ist bewusst unabhängig von
   * countsAsPaidNormalShiftHoliday, weil die Kennzahl die bezahlten Feiertage
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

/**
 * Art eines wiederkehrenden Jahrestages.
 *
 * - 'birthday': Geburtstag; das Geburtsjahr ist optional und dient
 *   ausschließlich der Altersanzeige in der Jahresansicht.
 * - 'recurring': wiederkehrendes Ereignis; die Wiederholung wird über ein
 *   Intervall in Jahren beschrieben.
 */
export type AnniversaryKind = 'birthday' | 'recurring';

/**
 * Rhythmus-Art eines wiederkehrenden Ereignisses.
 *
 * Das Ereignis trägt immer einen Monat-Tag-Anker (die Einträge sind
 * jahreslos). Der Anker ist zugleich das erste Auftreten:
 *
 * - 'daily':   alle `intervalCount` Tage ab dem Anker.
 * - 'weekly':  alle `intervalCount` Wochen; angezeigt wird der Wochentag des
 *              Ankers (z. B. „jeden 2. Dienstag").
 * - 'monthly': alle `intervalCount` Monate; angezeigt wird der n-te Wochentag
 *              des Ankers im Monat (z. B. „jeden 2. Dienstag").
 * - 'yearly':  alle `intervalCount` Jahre am Ankerdatum.
 *
 * `intervalCount` ist immer ein positiver Zähler; 1 steht für „jeden/jedes".
 */
export type AnniversaryIntervalKind = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Ein wiederkehrender Jahrestag (Geburtstag oder Ereignis).
 *
 * Die Einträge sind bewusst jahreslos: gespeichert wird ausschließlich der
 * Monat-Tag-Schlüssel (Format "MM-DD"). Dadurch erscheint derselbe Eintrag
 * automatisch in jedem Jahr und die jahreslose Ansicht ist ohne
 * Jahresberechnung möglich.
 *
 * Da an einem Kalendertag mehrere Geburtstage und mehrere wiederkehrende
 * Ereignisse stehen können, werden die Einträge eines Tages als Liste geführt.
 * Jeder Eintrag trägt eine eindeutige `id`, über die er in dieser Liste
 * identifiziert und verändert wird.
 */
export interface AnniversaryEntry {
  /** Eindeutige Kennung des Eintrags (innerhalb eines Tages). */
  id: string;
  /** Monat-Tag-Schlüssel im Format "MM-DD" (jahreslos). */
  monthDay: string;
  /** Name der Person bzw. des Ereignisses (max. 50 Zeichen). */
  name: string;
  kind: AnniversaryKind;
  /**
   * Geburtsjahr (nur bei kind === 'birthday' und nur optional).
   * Wird zur Berechnung des Alters in der Jahresansicht verwendet.
   */
  birthYear?: number;
  /**
   * Rhythmus-Art des wiederkehrenden Ereignisses (nur bei kind === 'recurring').
   * Fehlend bedeutet 'yearly' (Rückwärtskompatibilität mit früheren Zuständen).
   */
  intervalKind?: AnniversaryIntervalKind;
  /**
   * Zähler des Rhythmus (nur bei kind === 'recurring').
   * 1 = jeden Tag / jede Woche / jeden Monat / jedes Jahr. Standard ist 1.
   */
  intervalCount?: number;
  /**
   * Veraltetes Wiederholungsintervall in Jahren (nur bei kind === 'recurring').
   *
   * Wird nur noch gelesen, um ältere Zustände und Dateien zu übernehmen:
   * ein Eintrag ohne `intervalKind`/`intervalCount` gilt als „alle `interval`
   * Jahre". Neue Einträge nutzen ausschließlich `intervalKind`/`intervalCount`.
   */
  interval?: number;
}

/**
 * Schlüssel eines Kalendertags in der Map: der Monat-Tag-Schlüssel.
 *
 * Die Art des Eintrags steckt nicht mehr im Schlüssel (früher "MM-DD:kind");
 * ein Tag kann beliebig viele Geburtstage und wiederkehrende Ereignisse
 * tragen. Die Einträge liegen daher als Liste unter dem Monat-Tag-Schlüssel.
 */
export type AnniversaryKey = string;

/**
 * Erzeugt den Map-Schlüssel eines Kalendertags.
 *
 * Rückwärtskompatibilität: ältere Aufrufer übergaben zusätzlich die Art; der
 * zweite Parameter wird seit der Umstellung auf Listen ignoriert, damit die
 * Signatur kompatibel bleibt.
 */
export function anniversaryKey(monthDay: string, _kind?: AnniversaryKind): AnniversaryKey {
  return monthDay;
}

/**
 * Alle Jahrestage eines Kalendertags, indiziert nach Monat-Tag ("MM-DD").
 *
 * Der Wert ist die (geordnete) Liste aller Einträge dieses Tages: mehrere
 * Geburtstage und mehrere wiederkehrende Ereignisse sind möglich.
 */
export type AnniversaryMap = Record<AnniversaryKey, AnniversaryEntry[]>;

/**
 * Persönliche, vom Benutzer gesetzte Markierung eines Tages.
 *
 * Neben Beschriftung und Farben kann ein Tag Träger eines **querliegenden
 * Textes** einer Zusatzspalte sein (siehe `extraTexts`). Der Text gehört zu
 * einer markierten Spanne und wird ausschließlich auf der obersten (Anker-)
 * Zelle der Spanne gespeichert.
 */
export interface UserDayAnnotation {
  dateKey: string;
  /** Freitext, maximal 50 Zeichen. */
  label: string;
  /**
   * Persönliche Farben je Spalte (Spaltenname -> colorId).
   *
   * Der gezogene Streifen setzt die drei linken Spalten ('weekday', 'day',
   * 'shift'); die Informationsspalte ('info') wird über den DayEditor gepflegt.
   * Fehlende Einträge bedeuten "keine Farbe" für diese Spalte.
   */
  colors: Partial<Record<ColumnColorName, AnnotationColorId>>;
  /**
   * Persönliche Farben der frei angelegten Zusatzspalten
   * (Schlüssel `extra0`, `extra1`, … -> colorId).
   *
   * Sie werden über die Streifen-Auswahl eingefärbt (wie die festen
   * Farbspalten); fehlende Einträge bedeuten "keine Farbe" für diese Spalte.
   */
  extraColors?: Partial<Record<ExtraColumnColorKey, AnnotationColorId>>;
  /**
   * Querliegende Texte der Zusatzspalten, deren Spanne auf diesem Tag beginnt.
   *
   * Schlüssel ist der Farbschlüssel der Zusatzspalte (`extra0`, `extra1`, …).
   * Der Eintrag liegt immer auf der obersten Zelle der markierten Spanne; die
   * Darstellung zieht ihn über alle Zellen der Spanne (`dateKeys`).
   */
  extraTexts?: Partial<Record<ExtraColumnColorKey, ExtraColumnText>>;
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
   * Ereignisse mit countsAsPaidNormalShiftHoliday === true, die an diesem
   * Tag auch gearbeitet werden (die Schicht zeigt "T" oder "N").
   *
   * Ein bezahlter Feiertag begründet nur dann einen Anspruch, wenn an ihm
   * tatsächlich gearbeitet wird. Freie Tage des Zyklus (OFF) zählen nicht
   * mit, auch dann nicht, wenn sie auf einen Werktag fallen. Umgekehrt
   * zählt ein gearbeiteter Samstag, Sonntag oder Feiertag mit.
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
  /**
   * Anzeige-Option "Wochentag über Datum" (Standard: false).
   *
   * false: Der Monat nutzt zwei getrennte Spalten - links der Wochentag,
   *        daneben die Tagesnummer.
   * true:  Das Datum steht unter dem Wochentag in einer gemeinsamen Zelle;
   *        die Tagesnummer-Spalte entfällt und der gewonnene Platz kommt der
   *        großen Spalte mit den Bemerkungen (Information) zugute.
   *
   * Die Option ist rein darstellungsbezogen und ändert keine Fachdaten;
   * sie wirkt jedoch - wie in der Spezifikation gefordert - sowohl in der
   * Bildschirm- als auch in der Druckansicht.
   */
  weekdayOverDate: boolean;
  /**
   * Anzeige-Checkbox "Schichtkalender" (Standard: an).
   *
   * Ist sie aus, werden die Schichtspalte (T/N), die Schichtkennzahlen und die
   * Soll-/Werktagsangaben in Bildschirm- und Druckansicht ausgeblendet. Die
   * zugrunde liegenden Fachdaten bleiben unverändert erhalten.
   */
  showShiftCalendar: boolean;
  /** Anzeige-Checkbox "Geburtstag" (Standard: an). */
  showBirthdays: boolean;
  /** Anzeige-Checkbox "wdh. Ereignis" (Standard: an). */
  showRecurringEvents: boolean;
  /**
   * Modus der Bildschirmansicht.
   *
   * 'shift': regulärer Schichtkalender (Standard).
   * 'anniversaries': jahreslose Ansicht für Geburtstage und wiederkehrende
   *                  Ereignisse (ohne Schichten und ohne Datumsangaben).
   */
  viewMode: CalendarViewMode;
  /**
   * Frei angelegte Zusatzspalten je Monat.
   *
   * Schlüssel ist der Monat (1..12), Wert die Anordnung der schmalen Spalten
   * links und rechts der KW-/T-N-Spalten. Die Anordnung ist rein
   * darstellungsbezogen und verändert keine Fachdaten; sie wird jedoch - wie die
   * übrigen Anzeige-Optionen - zusammen mit dem Zustand gespeichert.
   */
  extraColumns: Record<number, ExtraColumns>;
}

/** Betriebsart der Bildschirmansicht. */
export type CalendarViewMode = 'shift' | 'anniversaries';

/** Persistierte Annotationen, global nach dateKey. */
export type AnnotationMap = Record<string, UserDayAnnotation>;

/**
 * Erklärtexte der Farblegende, geschlüsselt nach Jahr und Farbe.
 *
 * Pro Jahr kann jeder Farbe der persönlichen Palette ein Freitext zugeordnet
 * werden (z. B. "Gelb = Urlaub"). Die Zuordnung ist bewusst jahresbezogen:
 * derselbe Farbton kann in unterschiedlichen Jahren eine andere Bedeutung
 * haben. Fehlt ein Eintrag, zeigt die Legende nur den Farbnamen.
 *
 * Struktur: Jahr (als Zahl) -> colorId -> Text.
 */
export type ColorLegendMap = Record<number, Partial<Record<AnnotationColorId, string>>>;

/** Versionierter LocalStorage-Zustand. */
export interface PersistedState {
  version: number;
  settings: AppSettings;
  annotations: AnnotationMap;
  /** Erklärtexte der Farblegende je Jahr und Farbe. */
  colorLegend: ColorLegendMap;
  /** Jahreslose Geburtstage und wiederkehrende Ereignisse, nach "MM-DD". */
  anniversaries: AnniversaryMap;
}
