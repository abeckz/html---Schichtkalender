# Entwickler-Notizen

Diese Datei hält projektweite Entscheidungen fest, damit sie nicht in jeder
Sitzung erneut analysiert werden müssen.

## Stderr-Warnung „An update to App inside a test was not wrapped in act(...)“

**Symptom:** Beim Testlauf (`npm test` / `vitest`) erschien auf **stderr** eine
React-Warnung `An update to App inside a test was not wrapped in act(...)`,
obwohl alle Tests grün waren.

**Ursache:** React 18 aktiviert die `act()`-Prüfung nur, wenn die globale
Variable `IS_REACT_ACT_ENVIRONMENT === true` gesetzt ist. Da die Testumgebung
in `vite.config.ts` global auf `environment: 'node'` steht und jsdom nur
pro Datei über eine Pragma-Kommentarzeile (`// @vitest-environment jsdom`)
zugeschaltet wird, wurde diese Variable nie gesetzt.

**Fix (dauerhaft):** In `src/tests/setupTests.ts` wird
`globalThis.IS_REACT_ACT_ENVIRONMENT = true` gesetzt. Die Datei ist in
`vite.config.ts` unter `test.setupFiles` registriert und läuft damit vor jedem
Test in jeder Umgebung:

```ts
// vite.config.ts
test: {
  setupFiles: ['./src/tests/setupTests.ts'],
  // ...
}
```

**Wichtig bei neuen Tests:** Zustandsänderungen, die über asynchrone Pfade
(z. B. `FileReader`, Promise-Ketten) ausgelöst werden, müssen mit einer
**asynchronen** act-Hülle umschlossen werden:

```ts
await act(async () => {
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 0));
});
```

Ein synchrones `act(...)` reicht dort nicht aus und erzeugt die Warnung erneut.

**Wichtig:** Beim Prüfen auf sauberes stderr den PowerShell-Stream getrennt
auswerten, da `2>&1` Warnungen unsichtbar mit dem normalen Vitest-Output
verschmelzen kann:

```powershell
cmd /c "node node_modules/vitest/vitest.mjs run 2>err.txt 1>out.txt"
```

## Jahrestage: Geburtstage und wiederkehrende Ereignisse

**Datenmodell.** Jahrestage sind **jahreslos**: gespeichert wird nur der
Monat-Tag-Schlüssel (`MM-DD`). An einem Kalendertag können **mehrere**
Geburtstage und **mehrere** wiederkehrende Ereignisse stehen. Die
`AnniversaryMap` ist daher `Record<MonthDayKey, AnniversaryEntry[]>` — jeder Tag
trägt eine **Liste** von Einträgen, die über ihre eindeutige `id` (Feld
`AnniversaryEntry.id`) unterschieden werden. `anniversaryKey(monthDay)` liefert
den Tagesschlüssel; der frühere zweite Parameter (`kind`) wird aus
Kompatibilität ignoriert.

- `AnniversaryEntry.birthYear` ist optional (nur Geburtstag) und dient allein
  der Altersanzeige in der Jahresansicht.
- `AnniversaryEntry.intervalKind` (`'daily' | 'weekly' | 'monthly' | 'yearly'`)
  und `intervalCount` (Zähler, ≥ 1) beschreiben den Wiederholungsrhythmus:
  täglich, wöchentlich, monatlich und jährlich sowie „alle n Tage/Wochen/
  Monate/Jahre". Fehlt `intervalKind`, gilt `interval` als Jahresintervall
  (Rückwärtskompatibilität mit früheren Zuständen und Dateien).
- **Anker = erstes Auftreten.** Der Monat-Tag-Schlüssel ist zugleich der
  Anker; alle Rhythmen werden ab dem Anker im Basisjahr (`baseYear = 2000`)
  fortlaufend gerechnet.
- **Zwei Prüfungen.** `occursOnDateKey(entry, dateKey, year)` prüft den
  konkreten Tag (maßgeblich für die Anzeige, u. a. „alle n Tage" und „jeden
  n-ten Wochentag im Monat"); `occursInYear(entry, year)` liefert die einfache
  Jahresaussage. `formatIntervalLabel(entry)` erzeugt die Kurzbeschreibung
  („alle 90 Tage") für Bildschirm, Editor-Hinweis und Druck.
- **Zuordnung.** `matchesForDateKey(anniversaries, dateKey, year)` liefert für
  einen Kalendertag **alle** passenden Einträge (mehrere Geburtstage und/oder
  mehrere Ereignisse) samt Alter. Geburtstage hängen am Monat-Tag-Schlüssel;
  wiederkehrende Ereignisse werden vollständig über ihren Rhythmus geprüft und
  können daher auch an anderen Tagen als ihrem Ankertag erscheinen. Dieselbe
  Funktion nutzen Bildschirm und Druck (Single Source of Truth).
- **Accessoren.** `anniversariesAt`, `birthdaysAt`, `recurringsAt` liefern die
  Listen eines Tages; `birthdayAt`/`recurringAt` weiterhin den ersten Eintrag
  der jeweiligen Art (Bequemlichkeit).
- **Migration.** `normalizeAnniversaries` liest neben der aktuellen
  Listen-Struktur auch ältere Formen (flache Liste und die frühere, nach
  `"MM-DD:kind"` indizierte Map) und gruppiert sie nach Tag. Die Einträge
  werden je Tag sortiert (Geburtstage zuerst, dann Ereignisse).

**Anzeige-Bedienelemente (Menübar).** Zwei Formen sind bewusst getrennt:
- **Kästchen** (`CheckboxField`, echtes `<input type="checkbox">`): Mehrfach-
  auswahl einer Gruppe - „Schichtkalender", „Geburtstage" und „Wiederkehrende
  Ereignisse". Die Einstellungen (`showShiftCalendar`, `showBirthdays`,
  `showRecurringEvents`) liegen in `AppSettings` (Standard: alle an) und wirken
  in Bildschirm- und Druckansicht (Spalten entfallen bzw. Einträge entfallen).
- **Pille** (`ToggleSwitch`, `role="switch"`): Ein/Aus - „Wochentag über Datum"
  (`weekdayOverDate`) und „Geburtstag & wiederkehrende Ereignisse"
  (`viewMode`). Der kombinierte Umschalter ist der frühere Schichtkalender-
  Toggle: statt eines vierten Schalters schaltet er jetzt die jahreslose
  Ansicht.

Beide Formen stehen in `.display-toggles` gemeinsam in einer Spalte, links-
bündig und mit einheitlichem Zeilenraster, damit sie sauber fluchten.
`WeekdayOverDateToggle` entfällt; „Wochentag über Datum" ist jetzt ein
regulärer `ToggleSwitch`.

**Jahreslose Ansicht.** `viewMode` (`'shift' | 'anniversaries'`) schaltet über
den zweiten Toggle zwischen dem regulären Kalender und der jahreslosen
Ansicht (`AnniversaryYearCalendar` → `AnniversaryMonthCard`) um. Dort gibt es
keine Schichten, keine KW und keine Datumszellen; ein Zellklick öffnet den
zweispaltigen `AnniversaryEditor`. Links stehen die **Geburtstage** (Name +
optionales Geburtsjahr), rechts die **wiederkehrenden Ereignisse** (Name +
Rhythmus-Auswahl und Zähler). Beide Spalten führen **Listen**: „＋ … hinzufügen"
legt eine leere Zeile an, „Entfernen" löscht einen Eintrag. Beim Speichern
übergibt der Editor die vollständige Liste des Tages; leere Namen werden
verworfen (der Store entfernt sie).

**Klickverhalten in der Schichtansicht.** Im regulären Schichtkalender öffnet
**jeder Zellklick immer den `DayEditor`** (Beschriftung/Farbe). Geburtstage und
wiederkehrende Ereignisse sind dort **reine Anzeige** und fangen den Klick
nicht ab (die Info-Zelle ist kein Editor-Button); bearbeitet werden sie
ausschließlich im `AnniversaryEditor` der jahreslosen Ansicht.

Trägt ein Tag sowohl einen Tageseditor-Eintrag (Beschriftung) als auch
Jahrestage, werden beide Inhalte in derselben Info-Zelle angezeigt:
**Geburtstage/ereignisse (`🎂`/`🔁`) stehen immer ganz oben**, der
Tageseditor-Eintrag darunter. Liegt ein zusätzlicher Tageseditor-Eintrag vor,
wird der Zellinhalt mehrzeilig umgebrochen. Die **Schriftgröße folgt den
DayEditor-Regeln**, wobei **jeder Jahrestag als eine zusätzliche Zeile zählt**
(`cellLineClass(informationText, anniversaryCount)` in `utils/textFit.ts`):
Eine Beschriftung + ein Geburtstag ergeben so zwei Zeilen und damit die mittlere
Stufe (`label-lines-2`). Ohne Beschriftung und ohne Jahrestage (nur Terminnamen)
bleibt die normale Zeilengröße erhalten. Bildschirm (`CalendarDayRow`) und Druck
(`PrintMonth`) nutzen dieselbe Funktion.

**Färbung.** Die persönliche Farbe der Info-Spalte sitzt auf dem Textblock
`.cell-information-text` bzw. `.print-col-info-text` (nur so breit wie sein
Inhalt) und färbt damit **ausschließlich den Tageseditor-Eintrag** ein, nicht die
Jahrestage. Fällt ein eingefärbtes DayEditor-Ereignis mit einem
Geburtstag/wiederkehrenden Ereignis zusammen, bleiben die Jahrestage unfarbig.

Zuvor fing die (breite) Info-Zelle den Klick immer ab und öffnete den
Geburtstags-/Ereignis-Editor, sodass beim Anlegen eines normalen Tageseintrags
stets das falsche Fenster erschien.

**Persistenz.** `PersistedState` enthält zusätzlich `anniversaries`. Beim
Schreiben übernehmen die Stores die jeweils anderen Zustandsbereiche aus dem
Speicher (`readState`), damit Schreibvorgänge sich nicht gegenseitig
überschreiben.

## Frei angelegte Zusatzspalten in der Bildschirmansicht

**Zweck.** Der Benutzer kann je Monat schmale, leere Zusatzspalten anlegen, die
er im Tageseditor als eigenen Bereich (Beschriftung/Farbe) nutzen kann. Das
Datenmodell steht in `ExtraColumns` (`{ left: number[]; right: number[] }`); jede
Zahl ist die Breite einer Spalte in Einheiten (`EXTRA_COLUMN_UNIT_EM = 1.6`).
Farbschlüssel sind `extra0`, `extra1`, … je Seite (`ExtraColumnCell.tsx`).

**Lage der Spalten** (Raster der Tageszeile, `--day-row-columns` in
`MonthCalendar.tsx`):
`Wochentag | Datum | [Zusatz links] | Info/Ereignis | KW | [Zusatz rechts] | T/N`.

- Die Spalten der Seite `left` liegen **links der Ereignis-/Info-Zelle**
  (zwischen Datum und Info).
- Die Spalten der Seite `right` liegen **rechts der KW-Zelle** (zwischen KW und
  T/N).

**Bedienpunkte** (`ColumnInsertHandle.tsx`): Im Monatskopf sitzen zwei
`+`-Punkte auf den beiden Trennlinien.

- Linker Punkt: linke Kante der Info-/Ereigniszelle. Weil Datum und Wochentag
  (bzw. „Wochentag über Datum": eine 3.6em-Zelle) und die linken Zusatzspalten
  feste Breiten sind, wird der Punkt über `left: calc(5px + …)` gesetzt.
- Rechter Punkt: linke Kante der Schichtspalte T/N, gesetzt über
  `right: calc(5px + …)`.

Der `5px`-Versatz erklärt sich daraus, dass die absolut gesetzten Punkte im
Padding-Bereich des Kopfs liegen (deckungsgleich mit dem Inhaltsbereich der
Karte), die Tageszeile aber zusätzlich um ihren eigenen Rahmen und Innenabstand
(1px + 4px) nach innen versetzt ist. Ein wiederholter Klick auf dieselbe Linie
erweitert die dort liegende Spalte (Breite +1 Einheit), statt eine weitere
anzulegen; die schon sichtbaren Spalten behalten ihre Lage, nur die Info-Zelle
wird schmaler.

**Sichtbarkeit.** Die Punkte sind unsichtbar und werden beim Überfahren der
**ganzen Monatskarte** (`.month-card:hover`, also Kopf **und** Tageszeilen)
eingeblendet; so erscheint der linke Punkt auch dann, wenn die Maus über der
linken Datumsspalte steht. Zusätzlich sind sie per Tastaturfokus
(`:focus-visible`) erreichbar. Der gestrichelte Andeutungsstrich läuft an der
Info- bzw. Schichtzelle über alle Tageszeilen (`.cell-information::before`,
`.cell-shift::before`).

**Druck.** Zusatzspalten sind reine Bildschirm-Funktion und werden nicht
gedruckt; `PrintMonth` kennt sie nicht.

