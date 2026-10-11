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

## Glitch „alles verschwindet" beim Anlegen eines wiederkehrenden Ereignisses

**Symptom:** In der jahreslosen Ansicht verschwand die **gesamte App**, sobald im
`AnniversaryEditor` eine Ereigniszeile angelegt wurde („＋ Ereignis hinzufügen").
In der Konsole stand `Uncaught RangeError: Ungültiger dateKey: undefined`.

**Ursache:** Neben den TypeScript-Quellen liegen im Quellbaum **veraltete,
kompilierte `*.js`-Dubletten** (z. B. `src/components/App.js`). `src/main.tsx`
importierte die App **ohne Dateiendung** (`from './components/App'`). Beim Build
wählte Vite dafür die veraltete `App.js`, während der neuere
`AnniversaryEditor.tsx` (in `App.js` mit expliziter `.tsx`-Endung importiert)
geladen wurde - ein **Versions-Mix**: Der neue Editor erwartet die Props
`dateKey`/`year`/`onToggleOccurrence`, die alte App reichte sie nicht durch.
`formatGermanDate(undefined)` wirft dann `RangeError`, React unmountet die App
(kein Error-Boundary) -> „alles verschwindet". In den Vitest-Tests blieb der
Fehler unsichtbar, weil sie `App.tsx` direkt importieren.

**Fix (dauerhaft):** `src/main.tsx` importiert `App` **mit expliziter Endung**
(`from './components/App.tsx'`). `App.tsx` selbst importiert alle weiteren
Module bereits mit `.ts`/`.tsx`, sodass die veralteten `.js`-Dubletten nicht
mehr herangezogen werden. Faustregel für neue Importe: relative Importe immer
mit passender Endung schreiben (`.ts`/`.tsx`), damit die Auflösung unabhängig
von `resolve.extensions` eindeutig ist.

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
  (Rückwärtskompatibilität mit früheren Zuständen und Dateien). Der Rhythmus
  wird **nur im Editor** angezeigt, **nicht** in der Zellen-/Druckdarstellung
  (die Zellen sind zu klein).
- `AnniversaryEntry.excludedDates` (nur bei `kind === 'recurring'`) ist eine
  chronologisch sortierte Liste konkreter Datumsschlüssel (`"YYYY-MM-DD"`), an
  denen die Serie **ausgesetzt** ist. Die Serie bleibt bestehen und erscheint
  an allen übrigen Terminen; `isExcludedOn(entry, dateKey)` prüft den Ausschluss.
  `normalizeExcludedDates` bereinigt die Liste (gültig, eindeutig, sortiert).
- **Anker = erstes Auftreten.** Der Monat-Tag-Schlüssel ist zugleich der
  Anker; alle Rhythmen werden ab dem Anker fortlaufend gerechnet. Das
  **Basisjahr** ist der Anzeigezeitraum: Bildschirm (`CalendarDayRow`,
  `AnniversaryMonthCard`) und Druck (`PrintMonth`) sowie der Editor übergeben
  das jeweils angezeigte Jahr als `baseYear`, damit das Muster (z. B. „jeden
  2. Montag") unabhängig vom Bezugsjahr stabil bleibt. Nur die Engine-Tests
  nutzen weiterhin das Standard-Basisjahr `2000` (`baseYear = 2000`).
- **Serienende `until`.** Ein wiederkehrendes Ereignis kann ein Enddatum
  (`AnniversaryEntry.until`, `"YYYY-MM-DD"`) tragen. Der Termin am `until`-Tag
  selbst findet noch statt, alle späteren werden übersprungen;
  `isEndedOn(entry, dateKey)` prüft das.
- **Zwei Prüfungen.** `occursOnDateKey(entry, dateKey, year, baseYear)` prüft
  den konkreten Tag (maßgeblich für die Anzeige, u. a. „alle n Tage" und „jeden
  n-ten Wochentag im Monat"). Bei „jährlich" ist **nur der Ankertag** (Monat/
  Tag) ein Termin – ein früherer Fehler ließ das Ereignis an jedem Tag
  erscheinen. `occursInYear(entry, year)` liefert die einfache Jahresaussage.
  `formatIntervalLabel(entry)` erzeugt die Kurzbeschreibung („alle 90 Tage")
  für den Editor-Hinweis.
- **Zuordnung.** `matchesForDateKey(anniversaries, dateKey, year, baseYear)`
  liefert für einen Kalendertag **alle** passenden Einträge (mehrere
  Geburtstage und/oder mehrere Ereignisse) samt Alter. Geburtstage hängen am
  Monat-Tag-Schlüssel; wiederkehrende Ereignisse werden vollständig über ihren
  Rhythmus geprüft und können daher auch an anderen Tagen als ihrem Ankertag
  erscheinen. Ausnahmen (`excludedDates`) und ein Serienende (`until`) werden
  übersprungen. Dieselbe Funktion nutzen Bildschirm und Druck (Single Source of
  Truth); die jahreslose Ansicht prüft damit **alle** Tage eines Monats, nicht
  nur die Ankertage.

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
legt eine leere Zeile an. Beim Speichern übergibt der Editor die vollständige
Liste des Tages; leere Namen werden verworfen (der Store entfernt sie).

**Löschen: Serie, Vorkommen oder Serienende.** Bei einem wiederkehrenden
Ereignis bietet der Editor drei Wege:
- **„Serie löschen"** entfernt den Eintrag vollständig (alle Termine).
- **„Nur dieses Vorkommen löschen"** nimmt ausschließlich den angeklickten Tag
  (`dateKey`) über `excludedDates` aus; die Serie bleibt an allen übrigen
  Terminen erhalten. Der Knopf erscheint nur, wenn der angeklickte Tag nach dem
  Rhythmus tatsächlich ein Vorkommen ist (`occursOnDateKey`); ist es bereits
  ausgenommen, heißt er „Vorkommen zurücknehmen". Die Anzeige
  (`matchesForDateKey`) überspringt ausgenommene Tage.
- **„Serie ab hier beenden"** setzt das Serienende (`until`) auf den
  angeklickten Tag: Der Tag selbst bleibt Termin, alle späteren fallen weg
  („Serie ab diesem Datum nicht weiterführen"). Erneut ausgelöst („Serienende
  aufheben") läuft die Serie wieder unbegrenzt.

**Vorkommen an einem Folgetag.** Öffnet der Benutzer den Editor an einem Tag,
der nur ein **Vorkommen** einer an einem anderen Tag verankerten Serie ist,
erscheint die Serie als Zeile mit dem Hinweis „Vorkommen der Serie vom …".
„Nur dieses Vorkommen löschen" und „Serie ab hier beenden" wirken dann **sofort
und direkt** auf die bestehende Serie am Ursprungsanker (der Store schreibt
unmittelbar). Ein bloßes **Speichern** verschiebt den Serien-Anker **nicht**:
Fremde Vorkommen werden von `collectEntries` ausgelassen und bleiben an ihrem
Ursprung; so entsteht kein Duplikat und der Rhythmus-Anker bleibt stabil.


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
(`informationLineClass(...)` in `utils/textFit.ts`): Eine Beschriftung + ein
Geburtstag ergeben so zwei Zeilen und damit die mittlere Stufe (`label-lines-2`).

**Schriftgrößen-Prüfung für übernommene Ereignisse.** Reine Termin-/
Feiertagsnamen (keine persönliche Beschriftung) werden seitdem ebenfalls der
adaptiven Schriftprüfung unterzogen: Sie bekommen über
`EVENT_EXTRA_LINES` **eine Zeile mehr angerechnet** und sind damit stets eine
Stufe kleiner als eine gleich lange Beschriftung. Ein einzelner kurzer Termin
ist so höchstens mittelgroß (`label-lines-2`, 15px/8pt); lange Namen wie
„Tag der Deutschen Einheit" rutschen in die kleinste Stufe (`label-lines-3`,
12px/6.5pt). Zuvor blieb die Zelle bei reinen Terminen ohne Klasse und erbte die
ungedeckelte Standardgröße - die Schrift wirkte dadurch „viel zu groß".
Bildschirm (`CalendarDayRow`) und Druck (`PrintMonth`) nutzen dieselbe Funktion
`informationLineClass(label, extraLines, eventOnly)`.

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
(1px + 4px) nach innen versetzt ist. Ein Klick auf den `+`-Punkt legt stets
eine **neue, eigenständige** Spalte an der Trennlinie an (siehe unten).

**Sichtbarkeit.** Die Punkte sind unsichtbar und werden beim Überfahren der
**ganzen Monatskarte** (`.month-card:hover`, also Kopf **und** Tageszeilen)
eingeblendet; so erscheint der linke Punkt auch dann, wenn die Maus über der
linken Datumsspalte steht. Zusätzlich sind sie per Tastaturfokus
(`:focus-visible`) erreichbar. Der gestrichelte Andeutungsstrich läuft an der
Info- bzw. Schichtzelle über alle Tageszeilen (`.cell-information::before`,
`.cell-shift::before`).

**Druck.** Zusatzspalten werden inzwischen auch gedruckt (siehe unten,
„Druck" im Abschnitt Zusatzspalten).

## Zusatzspalten: Entfernen, Streifen-Markierung und eigener Editor

**Anlegen (`+`).** Jeder Klick auf einen `+`-Punkt legt eine **neue,
eigenständige** Zusatzspalte an der jeweiligen Trennlinie an
(`addExtraColumn`: `unshift(1)`). Jede Spalte ist eine individuelle Spalte mit
eigenem Farbschlüssel (`extra0`, `extra1`, …), eigenem Text und eigener Farbe;
ein wiederholter Klick legt daher eine weitere Spalte an der Linie an, während
die bereits sichtbaren Spalten nach außen rücken. Ein „Erweitern" einer
bestehenden Spalte gibt es bewusst nicht (Rückwärtskompatibilität: alte
gespeicherte Breiten > 1 aus früheren Versionen werden beim Laden weiterhin
dargestellt, aber nicht mehr neu erzeugt).

**Entfernen (`−`).** Im Monatskopf sitzt neben jedem `+`-Punkt ein `−`-Punkt
(`ColumnRemoveHandle` in `ColumnInsertHandle.tsx`), tiefer versetzt, damit sich
beide nicht überlagern. Er ist nur sichtbar, wenn an der Trennlinie eine Spalte
liegt. Ein Klick ruft `removeExtraColumn(month, side, index)` im
`settingsStore` auf: die Spalte an der Linie (Index 0) entfällt vollständig, die
übrigen Spalten rücken nach; ist die Liste danach leer, entfällt der
Monatseintrag. Da die Farbschlüssel (`extraN`) positionsbasiert sind, verschiebt
App die Annotationen des Monats über `shiftMonthExtraAnnotations` /
`shiftExtraMap` / `shiftExtraTextMap` um eine Position nach innen - so bleiben
Farben und querliegende Texte bei ihrer Spalte.

**Streifen-Markierung.** Die schmalen Zusatzspalten sind wie die festen
Farbspalten über einen gezogenen Streifen markier- und einfärbbar. Dafür trägt
jede Zelle ihren stabilen Farbschlüssel als `data-extra-column-key` und ihr
Zieh-Ziel als `data-extra-unit-key` (bei einer normalen, einheitlichen Spalte
identisch zum Farbschlüssel; der Suffix `#n` bleibt für alte, breitere Spalten
aus früheren Versionen erhalten). `columnOfCell` in `CalendarDayRow.tsx` erkennt
`.cell-extra` und liefert das Zieh-Ziel. Das Streifen-Ziel ist daher
`StreakTarget = StreakColumnTarget | ExtraColumnUnitKey`. So hebt ein Zug nur die
**Spalte unter dem Zeiger** hervor. Die Farbe wird über
`setColumnColorForDateKeys` in
`extraColors` geschrieben (Zusatzspalten getrennt von den festen Spalten); App
führt das Zieh-Ziel dabei über `extraColorKeyOfUnit` auf den Farbschlüssel
zurück, damit die ganze Spalte gefärbt und beschriftet wird.

**Eigener Editor (`ExtraColumnEditor.tsx`).** Nach einer Streifen-Auswahl in
einer Zusatzspalte öffnet App **direkt** diesen Editor (kein `StreakEditor`).
Er gleicht dem `DayEditor` (mehrzeilige Beschriftung, Farbe, Escape, Fokus),
ergänzt aber die Checkbox **„Querliegender Text"**: ist sie aktiv, wird der Text
um 90° nach links gedreht und mittig über die Gesamtzahl der markierten Zellen
gesetzt. Die Spanne wird als **ein** Eintrag auf der obersten (Anker-)Zelle in
`UserDayAnnotation.extraTexts[colorKey]` gespeichert (`ExtraColumnText` mit
`id`, `vertical`, `text`, `dateKeys`, `length`). Der Wert ist eine **Liste**:
in derselben Zusatzspalte dürfen mehrere, unabhängige Spannen (z. B. oben und
unten im Monat) mit eigenem Text nebeneinander bestehen. Unterschieden werden
sie über `id` (Farbschlüssel + Anker, z. B. `extra0@2026-01-20`);
`setExtraColumnText` im `annotationStore` ersetzt beim Speichern ausschließlich
den Text mit **demselben Anker** - andere Spannen bleiben erhalten. Der
`StreakEditor` kennt ausschließlich die festen Farbspalten
(`ColumnColorName`).

**Farbigkeit der Schlüssel.** `buildExtraColumnLayout` vergibt die Farbschlüssel
seitenübergreifend eindeutig: links ab `extra0`, rechts ab der Anzahl linker
Spalten. Damit kollidieren die persönlichen Farben der linken und rechten
Zusatzspalten nicht mehr im selben Tagesdatensatz.

**Darstellung des querliegenden Textes (Bildschirm).** Die querliegenden Texte
werden nicht in der Zelle selbst, sondern in einer Überlagerungsebene
(`.day-table-overlay`) gerendert. **Wichtig:** `.day-table` ist eine
Spalten-Flexbox; die Spaltenbreiten stehen ausschließlich auf den Tageszeilen
(`.day-row`). Ein Subgrid über `.day-table` könnte die Zeilenraster daher nie
treffen - die frühere Subgrid-Lösung war deshalb wirkungslos und der Text blieb
unsichtbar. Die Ebene liegt jetzt absolut über dem Raster
(`.day-table { position: relative }`, `.day-table-overlay { position: absolute;
inset: 0 }`) und jeder Text wird aus den **gemessenen** Rechtecken der Zielzelle
(alle Einheiten der Spalte) und der markierten Zeilen platziert
(`measureExtraColumnOverlay` in `MonthCalendar.tsx`, `useLayoutEffect`, auch bei
`resize`). `.cell-extra-text.is-vertical` dreht um 90°.

**Crosshair.** Die Zusatzspalten zählen zu den Zieh-Spalten und zeigen deshalb
denselben Greif-Cursor (`cursor: crosshair`) wie Wochentag, Datumsnummer und
T/N (siehe `styles.css`).

**Druck.** Zusatzspalten und querliegende Texte erscheinen auch im Druck.
`PrintMonth` kennt `extraColumns`, `annotationExtraColors` und
`extraTextsByDateKey`; `PrintCalendar` leitet die beiden Maps aus der
`AnnotationMap` ab und reicht sie über `PrintHalfYear` durch. Die Spaltenbreiten
kommen als CSS-Variablen `--print-extra-left` / `--print-extra-right` in die
`grid-template-columns` der `.print-row` (je 3 mm pro Einheit,
`PRINT_EXTRA_COLUMN_UNIT_MM`). Der querliegende Text liegt in
`.print-month-overlay` (letztes Kind des 31-Zeilen-Rasters); da alle Zeilen über
`minmax(0, 1fr)` gleich hoch sind, genügen Prozentangaben für die Zeilenspanne
und Millimeter für die Spalte (`collectPrintExtraTexts`). Das 31-Zeilen-Raster
bleibt dabei unverändert.

**Druck: Überlagerung darf KEINEN Rasterplatz belegen.** `.print-month-overlay`
war früher mit `grid-row: 1 / -1` über das gesamte Raster gespannt. Dadurch
belegte die Ebene die erste Spalte vollständig; die 31 `.print-row`-Zeilen wichen
per Auto-Placement in 31 zusätzliche, implizite Zeilen aus. Das Raster besaß dann
62 Zeilen und jede Zelle war auf weniger als die halbe Höhe gestaucht (Fehlerbild:
„Zusatzspalte + querliegender Text zerstört die Druckansicht"). Der Fix:
`.print-month-body` ist `position: relative`, `.print-month-overlay` ist
`position: absolute; inset: 0` **ohne** `grid-row`/`grid-column`. Die Ebene ist
damit aus dem Rasterfluss und erzeugt keine impliziten Zeilen mehr (siehe
`print.css` und die Regressionstests in `printCalendar.test.tsx`).

**Querliegender Text auf eingefärbter Zusatzspalte.** Der Text lag in der
Standard-Textfarbe (`--color-text`, im Dunkelmodus fast weiß) und war auf dem
satten Palette-Farbfeld unlesbar. Trägt die Zusatzspalte am Anker-Tag eine
persönliche Farbe, erhält der Text die Klasse `has-color` und wird in Schwarz
gezeichnet (`.cell-extra-text.has-color`), analog zu `.day-row.has-color-*`.
Die Information kommt als `colored`-Feld aus `collectExtraColumnTexts`
(`MonthCalendar.tsx`).

**Markierte (gefärbte) Zusatzspalten wurden von den Zeilenlinien zerschnitten.**
Ein über mehrere Tageszellen gezogener Farbstreifen in einer Zusatzspalte wurde
an jeder Zeilengrenze von der dünnen horizontalen Zeilenlinie durchschnitten und
hatte zusätzlich einen weißen Rand (Bildschirm `.day-row` `padding: 3px 4px` +
`border-bottom: 1px`, Druck `.print-row` `border-top: 0.25pt`), was das Lesen
erschwerte. Fix: Eine Zelle **mit** Farbe trägt `[style]` (Inline-Style wird
ausschließlich für `backgroundColor` gesetzt) und wird per negativem `margin`
um das senkrechte Zellen-Padding plus die Linienstärke über die Zeilengrenzen
hinausgezogen (Bildschirm `-4px 0`, Druck `-0.25pt 0`) und mit `z-index: 1` über
die Linien der Nachbarzeilen gelegt. Da zwei benachbarte gefärbte Zellen die
gemeinsame Grenze von beiden Seiten überdecken, verschwindet die Linie
vollständig und der Streifen erscheint randlos und durchgehend. Rasterzeilen und
Nachbarspalten bleiben unverändert (`.cell-extra[style]` in `styles.css`,
`.print-row > .print-col-extra[style]` in `print.css`, Regressionstests in
`screenView.test.tsx` und `printCalendar.test.tsx`).

**Querliegender Text im Druck war verpixelt bzw. unsichtbar.** Der Text wurde
sowohl am Bildschirm als auch im Druck mit `writing-mode: vertical-rl` **plus**
`transform: rotate(180deg)` gedreht. Ein `transform` legt das Element auf eine
eigene Compositing-Ebene, die der Browser beim Drucken als **Bitmap** rastern
kann (verpixelte Ausgabe). Fix: Die Grundregel nutzt jetzt
`writing-mode: sideways-lr`, das dieselbe Leserichtung (von unten nach oben)
rein über Textlayout erreicht und **vektoriell** bleibt. Über
`@supports not (writing-mode: sideways-lr)` bleibt der `rotate`-Weg als
Rückfallebene erhalten (`print.css`, `styles.css`). Die Druckausgabe ist damit
scharf. Das Prüfskript `scripts/checkVerticalText.mjs` misst in der echten
Druckvorschau, dass der Text vorhanden, sichtbar und über die markierte
Zeilenspanne zentriert ist.

**Querliegender Text lag hinter dem Farbstreifen und war nicht sichtbar.**
Der querliegende Text der Zusatzspalten war weder in der Druckvorschau noch im
gespeicherten PDF zu sehen (nur das Farbfeld war da), obwohl die Textbox die
richtige Größe und Position hatte. Ursache: Der Fix für den durchgehenden
Farbstreifen hebt die gefärbten Zellen auf `z-index: 1`
(`.print-row > .print-col-extra[style]` bzw. `.cell-extra[style]`). Die
Textebene hatte **keinen** eigenen Stapelwert (`z-index: auto`) und lag damit
**darunter** - am Bildschirm nur zufällig sichtbar, weil `.day-table-overlay`
später im DOM stand, im Druck (`.print-month-overlay`) jedoch unsichtbar. Fix:
Die Überlagerungsebene erhält `z-index: 2` und liegt damit zuverlässig über den
gefärbten Zellen (`.print-month-overlay` in `print.css`, `.day-table-overlay`
in `styles.css`). Regressionstests in `printCalendar.test.tsx` und
`screenView.test.tsx` prüfen, dass der Stapelwert der Textebene höher ist als
der der gefärbten Zellen. Prüfskript `scripts/checkVerticalTextPrintMedia.mjs`
misst den Text mit **Druckmedien-Emulation** (Chrome DevTools) und legt optional
einen Screenshot ab; das frühere `checkVerticalText.mjs` prüfte nur am
Bildschirm und konnte diese Überdeckung nicht erkennen.




**DayEditor.** Das frühere Feld „Zusatzspalten" (Farbwahl je Spalte im
`DayEditor`) wurde entfernt: Zusatzspalten-Farben setzt jetzt ausschließlich die
Streifen-Auswahl, Texte und Ausrichtung der eigene `ExtraColumnEditor`.


