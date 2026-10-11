/**
 * Prüft die senkrechten Trennstriche der frei angelegten Zusatzspalten in der
 * erzeugten Offline-Datei.
 *
 * Geprüft wird, dass sowohl die linke als auch die rechte Zusatzspalte an
 * beiden senkrechten Kanten einen durchgehenden Trennstrich trägt. Die linke
 * Zusatzspalte bekommt den linken Strich von der Tagesspalte (`.cell-day`); die
 * rechte Zusatzspalte muss ihren linken Strich selbst ziehen, weil die
 * KW-Spalte bewusst strichfrei bleibt.
 *
 * Reines Prüfskript für die Entwicklung, nicht Teil der App.
 * Aufruf: node scripts/checkExtraColumnBorders.mjs <pfad-zur-html-datei>
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chrome =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const argument = process.argv[2] ?? 'offline/Schichtkalender-Offline.html';
const isUrl = /^https?:\/\//.test(argument);
const target = isUrl ? argument : resolve(argument);
const targetUrl = isUrl ? argument : `file:///${target.replace(/\\/g, '/')}`;

/**
 * Kleines Skript, das im Browser zuerst je eine Zusatzspalte links und rechts
 * anlegt und dann die senkrechten Rahmen der Zusatzspalten misst. Das Ergebnis
 * wird als JSON in `<div id="check">` geschrieben und per `--dump-dom`
 * ausgelesen.
 */
const probe = `<style>
  /* Im Prüflauf gibt es kein echtes Überfahren; die Sichtbarkeit wird daher
     erzwungen, damit die Punkte anklickbar sind. */
  .column-insert-handle { opacity: 1 !important; }
</style>
<script>
window.addEventListener('load', function () {
  var result = {};
  function card() { return document.querySelector('.month-card'); }
  function leftHandle(c) { return c.querySelector('.column-insert-handle[data-extra-column-side="left"]'); }
  function rightHandle(c) { return c.querySelector('.column-insert-handle[data-extra-column-side="right"]'); }
  function styleOf(el) {
    if (!el) return null;
    var cs = getComputedStyle(el);
    return {
      left: cs.borderLeftWidth + ' ' + cs.borderLeftStyle,
      right: cs.borderRightWidth + ' ' + cs.borderRightStyle,
    };
  }
  // Effektive Trennlinien einer Zusatzspalte: links liefert sie der eigene
  // linke Rahmen ODER der rechte Rahmen der vorausgehenden Zelle (die linke
  // Zusatzspalte nutzt den rechten Rahmen ihrer Tagesspalte); rechts liefert
  // sie der eigene rechte Rahmen.
  function effective(el) {
    if (!el) return null;
    var prev = el.previousElementSibling;
    var own = styleOf(el);
    var leftEdge = own.left;
    if (leftEdge.startsWith('0px') && prev) {
      var pcs = getComputedStyle(prev);
      leftEdge = pcs.borderRightWidth + ' ' + pcs.borderRightStyle;
    }
    return { leftEdge: leftEdge, rightEdge: own.right };
  }
  var steps = [
    function () {
      leftHandle(card()).click();
    },
    function () {
      rightHandle(card()).click();
    },
    function () {
      var row = card().querySelector('.day-row');
      result.left = effective(row.querySelector('.cell-extra[data-extra-column-side="left"]'));
      result.right = effective(row.querySelector('.cell-extra[data-extra-column-side="right"]'));
      // In die Druckansicht wechseln.
      var buttons = Array.prototype.slice.call(document.querySelectorAll('button'));
      var printButton = buttons.filter(function (b) { return /Druckansicht/.test(b.textContent || ''); })[0];
      result.hasPrintButton = Boolean(printButton);
      if (printButton) printButton.click();
    },
    function () {
      var printRow = document.querySelector('.print-row');
      result.printLeft = effective(printRow && printRow.querySelector('.print-col-extra[data-extra-column-side="left"]'));
      result.printRight = effective(printRow && printRow.querySelector('.print-col-extra[data-extra-column-side="right"]'));
      var hole = document.createElement('pre');
      hole.id = 'probe-result';
      hole.textContent = JSON.stringify(result);
      document.body.appendChild(hole);
    },
  ];
  var index = 0;
  function run() {
    if (index >= steps.length) return;
    var current = steps[index];
    index += 1;
    // setTimeout statt requestAnimationFrame: Unter headless (--dump-dom)
    // werden Animationsschritte nicht zuverlässig zugestellt.
    setTimeout(function () {
      current();
      run();
    }, 150);
  }
  setTimeout(run, 400);
});
</script>`;

const profile = mkdtempSync(join(tmpdir(), 'sk-border-'));
let file = null;
let url = targetUrl;
if (!isUrl) {
  const source = readFileSync(target, 'utf8');
  // Prüfskript vor dem schließenden Body-Tag einschleusen.
  const prepared = source.replace('</body>', `${probe}\n</body>`);
  file = join(profile, 'probe.html');
  writeFileSync(file, prepared);
  url = `file:///${file.replace(/\\/g, '/')}`;
}

const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    `--user-data-dir=${join(profile, 'ud')}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1600,1200',
    '--run-all-compositor-stages-before-draw',
    '--virtual-time-budget=15000',
    '--dump-dom',
    url,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120000 },
);
rmSync(profile, { recursive: true, force: true });

const dom = result.stdout ?? '';
const marker = '<pre id="probe-result">';
const markerIndex = dom.indexOf(marker);
const raw =
  markerIndex >= 0
    ? dom.slice(markerIndex + marker.length, dom.indexOf('</pre>', markerIndex))
    : '(nicht gefunden)';

let value = null;
try {
  value = JSON.parse(raw);
} catch {
  /* Fehler unten sichtbar machen */
}

// Ein Trennstrich liegt vor, wenn der berechnete Rahmen eine sichtbare Breite
// (> 0 px) und den Stil "solid" besitzt. Bildschirm: 1px, Druck: 0.25pt.
const solid = (border) => {
  if (typeof border !== 'string' || !border.endsWith('solid')) return false;
  const width = parseFloat(border);
  return Number.isFinite(width) && width > 0;
};

const checks = [
  ['Messung ausgelesen', value !== null],
  [
    `linke Zusatzspalte (Bildschirm) beidseitig abgetrennt (${JSON.stringify(value?.left)})`,
    Boolean(value?.left) && solid(value.left.leftEdge) && solid(value.left.rightEdge),
  ],
  [
    `rechte Zusatzspalte (Bildschirm) beidseitig abgetrennt (${JSON.stringify(value?.right)})`,
    Boolean(value?.right) && solid(value.right.leftEdge) && solid(value.right.rightEdge),
  ],
  ['Druckansicht geöffnet', Boolean(value?.hasPrintButton)],
  [
    `linke Zusatzspalte (Druck) beidseitig abgetrennt (${JSON.stringify(value?.printLeft)})`,
    Boolean(value?.printLeft) && solid(value.printLeft.leftEdge) && solid(value.printLeft.rightEdge),
  ],
  [
    `rechte Zusatzspalte (Druck) beidseitig abgetrennt (${JSON.stringify(value?.printRight)})`,
    Boolean(value?.printRight) && solid(value.printRight.leftEdge) && solid(value.printRight.rightEdge),
  ],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${label}`);
  if (!ok) failed += 1;
}
if (value === null) console.log('  Rohausgabe:', raw);
console.log(failed === 0 ? '\nZusatzspalten beidseitig abgetrennt.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
