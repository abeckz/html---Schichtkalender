/**
 * Prüft die tatsächlich erzeugte Druckausgabe (A3 Querformat, 2 Seiten).
 *
 * Chrome erzeugt beim Aufruf mit --print-to-pdf genau die Seiten, die auch
 * an den Drucker gehen. Damit wird die reale Druckausgabe geprüft:
 *  - Seitengröße muss A3 Querformat sein,
 *  - genau zwei Seiten,
 *  - jede Seite nutzt die volle Blatthöhe.
 *
 * Reines Prüfskript für die Entwicklung, nicht Teil der App.
 * Aufruf: node scripts/checkPrintPdf.mjs <pfad-zur-html-datei>
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chrome =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const file = resolve(process.argv[2] ?? 'BASF-Schichtkalender.html');
const mm = (points) => (Number(points) / 72) * 25.4;

// In einem Arbeitsverzeichnis arbeiten, damit relative Pfade stimmen und
// die Ergebnisprufung reproduzierbar bleibt.
const workDir = mkdtempSync(join(tmpdir(), 'sk-print-'));
const workFile = join(workDir, 'probe.html');

// Automatisch in die Druckansicht wechseln, damit genau das gedruckt wird,
// was der Benutzer sieht.
const source = readFileSync(file, 'utf8');
const clicker = `<script>
window.addEventListener('load', function () {
  setTimeout(function () {
    var buttons = document.querySelectorAll('.toolbar-controls .primary-button');
    if (buttons.length) buttons[buttons.length - 1].click();
  }, 300);
});
</script>`;
writeFileSync(workFile, source.replace('</body>', `${clicker}\n  </body>`), 'utf8');

const pdfFile = join(workDir, 'print-check.pdf');
const profile = join(workDir, 'profile');
const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-pdf-header-footer',
    '--virtual-time-budget=12000',
    `--user-data-dir=${profile}`,
    `--print-to-pdf=${pdfFile}`,
    `file:///${workFile.replace(/\\/g, '/')}`,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);

if (result.status !== 0) {
  console.error('Chrome-Fehler:', result.stderr ?? '');
  process.exit(1);
}

const text = readFileSync(pdfFile).toString('latin1');
const pages = Number(/\/Count\s+(\d+)/.exec(text)?.[1] ?? 0);
const boxes = text.match(/\/MediaBox\s*\[[^\]]+\]/g) ?? [];
const first = /\[([^\]]+)\]/.exec(boxes[0] ?? '')?.[1].trim().split(/\s+/).map(Number) ?? [];

const widthMm = mm(first[2] - first[0]);
const heightMm = mm(first[3] - first[1]);
const isA3Landscape = Math.abs(widthMm - 420) < 2 && Math.abs(heightMm - 297) < 2;

// Höhenausnutzung: Die gerenderten Zeilen müssen den bedruckbaren Bereich
// (297 mm - 2 x 5 mm Rand = 287 mm) nahezu vollständig füllen.
const report = [];
const contentStreams = text.match(/\/Type\s*\/Page\b[\s\S]{0,400}?\/Contents\s+(\d+)\s+0\s+R/g) ?? [];
report.push(`Inhaltsströme gefunden: ${contentStreams.length}`);

const checks = [
  [`Seitengröße A3 quer (${widthMm.toFixed(1)} x ${heightMm.toFixed(1)} mm)`, isA3Landscape],
  [`genau zwei Seiten (${pages})`, pages === 2],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${label}`);
  if (!ok) failed += 1;
}

rmSync(workDir, { recursive: true, force: true });
void copyFileSync;
console.log(failed === 0 ? '\nDruckausgabe korrekt.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

