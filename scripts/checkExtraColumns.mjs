/**
 * Prüft die frei anlegbaren Zusatzspalten in der erzeugten Offline-Datei.
 *
 * Chrome lädt die Datei über file://, klickt nacheinander auf die Bedienpunkte
 * im Monatskopf und gibt den DOM-Mitschnitt aus. Geprüft werden:
 *  - zwei Bedienpunkte je Monat (links vor KW/T-N, rechts vor T/N),
 *  - ein Klick links legt genau eine zusätzliche Zelle je Tageszeile an,
 *  - ein zweiter Klick auf dieselbe Linie erweitert die Spalte (Breite wächst),
 *  - der Bedienpunkt sitzt beide Male auf derselben Trennlinie,
 *  - ein Klick links fügt KEINE weitere Spalte hinzu (die Ansicht wird nach
 *    außen geschoben).
 *
 * Reines Prüfskript für die Entwicklung, nicht Teil der App.
 * Aufruf: node scripts/checkExtraColumns.mjs <pfad-zur-html-datei>
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chrome =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argument = process.argv[2] ?? 'offline/Schichtkalender-Offline.html';
// Für die Prüfung der Live-Ausgabe kann auch eine HTTP-Adresse übergeben werden
// (z. B. http://localhost:5178); sonst wird der Pfad als file://-URL geöffnet.
const isUrl = /^https?:\/\//.test(argument);
const target = isUrl ? argument : resolve(argument);
const targetUrl = isUrl ? argument : `file:///${target.replace(/\\/g, '/')}`;
const file = isUrl ? null : target;

/** Kleines Skript, das im Browser die Bedienpunkte anklickt und meldet. */
const probe = `<style>
  /* Im Prüflauf gibt es kein echtes Überfahren; die Sichtbarkeit wird daher
     erzwungen, damit die Trefferprüfung (kein verdeckendes Element) gültig ist. */
  .column-insert-handle { opacity: 1 !important; }
</style>
<script>
window.addEventListener('load', function () {
  // React committet Zustandsänderungen erst nach dem Klick-Ereignis; deshalb
  // wird nach jedem Klick ein Animationsschritt abgewartet, bevor gemessen wird.
  function centerX(el) {
    if (!el) return -1;
    var r = el.getBoundingClientRect();
    return Math.round((r.left + r.width / 2) * 100) / 100;
  }
  function leftEdge(el) {
    if (!el) return -1;
    return Math.round(el.getBoundingClientRect().left * 100) / 100;
  }
  function rightEdge(el) {
    if (!el) return -1;
    return Math.round(el.getBoundingClientRect().right * 100) / 100;
  }
  var steps = [
    function (r, card) {
      var row = card.querySelector('.day-row');
      r.handleCount = card.querySelectorAll('.column-insert-handle').length;
      r.cellsBefore = cells(card);
      r.leftHandleBefore = centerX(left(card));
      r.rightHandleBefore = centerX(right(card));
      // Linke Trennlinie: linke Kante der Ereignis-/Info-Zelle (die Zusatzspalten
      // links werden zwischen Datum und Info eingefügt).
      // Rechte Trennlinie: linke Kante der Schichtspalte T/N.
      r.leftLineBefore = leftEdge(row.querySelector('.cell-information'));
      r.rightLineBefore = leftEdge(row.querySelector('.cell-shift'));
      r.leftHandleHitBefore = hit(left(card));
      left(card).click();
    },
    function (r, card) {
      var row = card.querySelector('.day-row');
      r.cellsAfterFirstClick = cells(card);
      r.widthAfterFirstClick = card.style.getPropertyValue('--extra-left-width');
      r.leftHandleAfterFirstClick = centerX(left(card));
      r.rightHandleAfterFirstClick = centerX(right(card));
      r.leftLineAfterFirstClick = leftEdge(row.querySelector('.cell-information'));
      // Reihenfolge der Zellen: die linke Zusatzzelle muss VOR der Info-Zelle liegen.
      var order = Array.prototype.map.call(row.children, function (el) {
        return el.className;
      });
      var extraIx = order.findIndex(function (c) { return c.indexOf('cell-extra') >= 0; });
      var infoIx = order.findIndex(function (c) { return c.indexOf('cell-information') >= 0; });
      r.extraBeforeInfo = extraIx >= 0 && infoIx >= 0 ? extraIx < infoIx : null;
      left(card).click();
    },
    function (r, card) {
      var row = card.querySelector('.day-row');
      r.cellsAfterSecondClick = cells(card);
      r.widthAfterSecondClick = card.style.getPropertyValue('--extra-left-width');
      r.leftHandleAfterSecondClick = centerX(left(card));
      r.leftLineAfterSecondClick = leftEdge(row.querySelector('.cell-information'));
      right(card).click();
    },
    function (r, card) {
      var row = card.querySelector('.day-row');
      r.cellsAfterRightClick = cells(card);
      r.widthRightAfterClick = card.style.getPropertyValue('--extra-right-width');
      r.rightHandleAfterRightClick = centerX(right(card));
      r.leftHandleAfterRightClick = centerX(left(card));
      r.shiftLeftAfterRight = leftEdge(row.querySelector('.cell-shift'));
      r.kwLeftAfterRight = leftEdge(row.querySelector('.cell-kw'));
      r.kwRightAfterRight = rightEdge(row.querySelector('.cell-kw'));
      r.leftLineAfterRight = leftEdge(row.querySelector('.cell-information'));
      r.stored = window.localStorage.getItem('schichtkalender.state');
      var hole = document.createElement('pre');
      hole.id = 'probe-result';
      hole.textContent = JSON.stringify(r);
      document.body.appendChild(hole);
    },
  ];
  var result = {};
  function card() { return document.querySelector('.month-card'); }
  function rows(c) { return c.querySelectorAll('.day-row'); }
  function cells(c) { return rows(c)[0] ? rows(c)[0].querySelectorAll('.cell-extra').length : -1; }
  function left(c) { return c.querySelector('.column-insert-handle[data-extra-column-side="left"]'); }
  function right(c) { return c.querySelector('.column-insert-handle[data-extra-column-side="right"]'); }
  function hit(el) {
    if (!el) return false;
    var rect = el.getBoundingClientRect();
    var top = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return top === el || el.contains(top);
  }

  var index = 0;
  function run() {
    if (index >= steps.length) return;
    var current = steps[index];
    index += 1;
    // setTimeout statt requestAnimationFrame: Unter headless (--dump-dom)
    // werden Animationsschritte nicht zuverlässig zugestellt, wodurch die
    // Messkette sonst stehen bleibt.
    setTimeout(function () {
      current(result, card());
      run();
    }, 120);
  }
  setTimeout(run, 300);
});
</script>`;

/**
 * Erzeugt die zu prüfende Seite: Bei einer Datei wird das Messskript direkt vor
 * `</body>` eingebettet; bei einer HTTP-Adresse genügt die Adresse selbst.
 */
function buildWorkTarget() {
  if (!file) return { url: targetUrl, cleanup: () => {} };
  const workDir = mkdtempSync(join(tmpdir(), 'sk-extra-'));
  const workFile = join(workDir, 'probe.html');
  const source = readFileSync(file, 'utf8');
  writeFileSync(workFile, source.replace('</body>', `${probe}\n  </body>`), 'utf8');
  return {
    url: `file:///${workFile.replace(/\\/g, '/')}`,
    cleanup: () => rmSync(workDir, { recursive: true, force: true }),
    workDir,
  };
}

const work = buildWorkTarget();

const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1600,1200',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=15000',
    `--user-data-dir=${join(work.workDir ?? tmpdir(), 'profile')}`,
    '--dump-dom',
    work.url,
  ],
  { encoding: 'buffer', maxBuffer: 256 * 1024 * 1024, timeout: 120000 },
);

const dom = (result.stdout ?? Buffer.alloc(0)).toString('utf8');
// Nur für die Entwicklung: den vollständigen Mitschnitt ablegen, damit die
// Ursache eines fehlenden Messblocks schnell zu sehen ist.
writeFileSync(join(process.cwd(), 'probe-dom.html'), dom, 'utf8');
const marker = '<pre id="probe-result">';
const markerIndex = dom.indexOf(marker);
const match =
  markerIndex >= 0
    ? [dom.slice(markerIndex, dom.indexOf('</pre>', markerIndex))]
    : null;
if (!match) {
  console.error(
    `Keine Messergebnisse im DOM gefunden (Exit ${result.status}, ${dom.length} Zeichen).`,
  );
  console.error(dom.slice(0, 3000));
  console.error('--- Ende ---');
  console.error(dom.slice(-1500));
  work.cleanup();
  process.exit(1);
}

const value = JSON.parse(
  match[0]
    .slice(match[0].indexOf('>') + 1)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&'),
);

const checks = [
  [`zwei Bedienpunkte je Monat (${value.handleCount})`, value.handleCount === 2],
  ['ohne Zusatzspalten startet der Monat ohne Zusatzzellen', value.cellsBefore === 0],
  [
    `Klick links legt eine Zusatzzelle je Tageszeile an (${value.cellsBefore} -> ${value.cellsAfterFirstClick})`,
    value.cellsAfterFirstClick === 1,
  ],
  [
    `die neue linke Spalte ist genau eine Einheit breit (${value.widthAfterFirstClick})`,
    value.widthAfterFirstClick === '1.6em',
  ],
  [
    `linker Bedienpunkt sitzt links der Ereigniszelle (Punkt ${value.leftHandleBefore}, Linie ${value.leftLineBefore})`,
    Math.abs(value.leftHandleBefore - value.leftLineBefore) < 0.6,
  ],
  [
    `rechter Bedienpunkt sitzt vor T/N (Punkt ${value.rightHandleBefore}, Linie ${value.rightLineBefore})`,
    Math.abs(value.rightHandleBefore - value.rightLineBefore) < 0.6,
  ],
  [
    'die linke Zusatzzelle steht VOR der Ereigniszelle',
    value.extraBeforeInfo === true,
  ],
  [
    'der linke Bedienpunkt ist an seiner Mitte mit der Maus erreichbar',
    value.leftHandleHitBefore === true,
  ],
  [
    `rechter Bedienpunkt wird von links nicht verschoben (${value.rightHandleBefore} -> ${value.rightHandleAfterFirstClick})`,
    Math.abs(value.rightHandleBefore - value.rightHandleAfterFirstClick) < 0.6,
  ],
  [
    `wiederholter Klick erweitert dieselbe Spalte (${value.widthAfterFirstClick} -> ${value.widthAfterSecondClick})`,
    value.widthAfterSecondClick === '3.2em',
  ],
  [
    `erweiterte Spalte wird als zwei Zellen dargestellt (${value.cellsAfterSecondClick})`,
    value.cellsAfterSecondClick === 2,
  ],
  [
    `die Ereigniszelle rückt beim Erweitern nach rechts, der Punkt folgt (Linie ${value.leftLineBefore} -> ${value.leftLineAfterSecondClick})`,
    value.leftLineAfterSecondClick > value.leftLineBefore + 0.5,
  ],
  [
    `linker Bedienpunkt bleibt auch nach dem Erweitern auf der Linie (${value.leftHandleAfterSecondClick} / ${value.leftLineAfterSecondClick})`,
    Math.abs(value.leftHandleAfterSecondClick - value.leftLineAfterSecondClick) < 0.6,
  ],
  [
    `Klick rechts legt eine Spalte links neben T/N an (${value.widthRightAfterClick})`,
    value.widthRightAfterClick === '1.6em',
  ],
  [
    `rechter Bedienpunkt bleibt auf der Linie vor T/N (${value.rightHandleAfterRightClick} / Linie ${value.shiftLeftAfterRight})`,
    Math.abs(value.rightHandleAfterRightClick - value.shiftLeftAfterRight) < 0.6,
  ],
  [
    `die neue rechte Spalte liegt zwischen KW und T/N (KW-Ende ${value.kwRightAfterRight}, T/N ${value.shiftLeftAfterRight})`,
    value.shiftLeftAfterRight > value.kwRightAfterRight + 0.5,
  ],
  [
    `KW bleibt links der neuen rechten Spalte (KW ${value.kwLeftAfterRight}..${value.kwRightAfterRight}, T/N ${value.shiftLeftAfterRight})`,
    value.kwLeftAfterRight < value.kwRightAfterRight && value.kwRightAfterRight < value.shiftLeftAfterRight,
  ],
  [
    `linker Bedienpunkt bleibt auf der linken Trennlinie (${value.leftHandleAfterRightClick} / ${value.leftLineAfterRight})`,
    Math.abs(value.leftHandleAfterRightClick - value.leftLineAfterRight) < 0.6,
  ],
  [
    `Spalten werden gespeichert (${value.stored ? 'ja' : 'nein'})`,
    typeof value.stored === 'string' && value.stored.includes('extraColumns'),
  ],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${label}`);
  if (!ok) failed += 1;
}

work.cleanup();
console.log(failed === 0 ? '\nZusatzspalten korrekt.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
