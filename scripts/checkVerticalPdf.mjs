/**
 * Prüft, ob ein querliegender Text auch im erzeugten PDF (Druckausgabe)
 * tatsächlich als Text enthalten ist.
 *
 * Chrome erzeugt über --print-to-pdf genau das PDF, das auch an den Drucker
 * geht. Der Text wird über die `ToUnicode`-CMaps der eingebetteten Schriften
 * dekodiert und im PDF gesucht.
 *
 * Reines Prüfskript für die Entwicklung.
 * Aufruf: node scripts/checkVerticalPdf.mjs <pfad-zur-html-datei>
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { inflateSync } from 'node:zlib';

const chrome =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const file = resolve(process.argv[2] ?? 'BASF-Schichtkalender.html');
const workDir = mkdtempSync(join(tmpdir(), 'sk-vpdf-'));
const workFile = join(workDir, 'probe.html');

const state = {
  version: 1,
  settings: { extraColumns: { 1: { left: [1], right: [] } }, showShiftCalendar: true },
  annotations: {
    '2026-01-01': {
      dateKey: '2026-01-01', label: '', colors: {}, extraColors: { extra0: 'red' },
      extraTexts: {
        extra0: {
          colorKey: 'extra0', columnLabel: 'Zusatzspalte 0', vertical: true,
          text: 'Urlaub', dateKeys: ['2026-01-01', '2026-01-02', '2026-01-03'], length: 3,
        },
      },
    },
    '2026-01-02': { dateKey: '2026-01-02', label: '', colors: {}, extraColors: { extra0: 'red' } },
    '2026-01-03': { dateKey: '2026-01-03', label: '', colors: {}, extraColors: { extra0: 'red' } },
  },
  colorLegend: {},
  anniversaries: {},
};

const probe = `<script>
window.addEventListener('load', function () {
  if (!location.hash) {
    try { localStorage.setItem('schichtkalender.state', ${JSON.stringify(JSON.stringify(state))}); } catch (e) {}
    location.hash = '#probe';
    location.reload();
    return;
  }
  setTimeout(function () {
    var buttons = document.querySelectorAll('.toolbar-controls .primary-button');
    if (buttons.length) buttons[buttons.length - 1].click();
  }, 500);
});
</script>`;

writeFileSync(workFile, readFileSync(file, 'utf8').replace('</body>', `${probe}\n  </body>`), 'utf8');

const pdfFile = join(workDir, 'print-vertical.pdf');
const result = spawnSync(
  chrome,
  [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--no-pdf-header-footer',
    '--virtual-time-budget=15000', `--user-data-dir=${join(workDir, 'profile')}`,
    `--print-to-pdf=${pdfFile}`, `file:///${workFile.replace(/\\/g, '/')}`,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
if (result.status !== 0) {
  console.error('Chrome-Fehler:', result.stderr ?? '');
  process.exit(1);
}

const raw = readFileSync(pdfFile);

/** Alle (ggf. mit FlateDecode komprimierten) Stream-Inhalte sammeln. */
function* streams(buffer) {
  let index = 0;
  while (true) {
    const start = buffer.indexOf('stream', index);
    if (start < 0) return;
    let dataStart = start + 'stream'.length;
    if (buffer[dataStart] === 0x0d) dataStart += 1;
    if (buffer[dataStart] === 0x0a) dataStart += 1;
    const end = buffer.indexOf('endstream', dataStart);
    if (end < 0) return;
    const chunk = buffer.subarray(dataStart, end);
    let decoded = null;
    try { decoded = inflateSync(chunk); } catch { /* unkomprimiert */ }
    yield { raw: chunk, decoded };
    index = end + 'endstream'.length;
  }
}

// ToUnicode-CMaps einsammeln: glyph-Code (hex) -> Unicode-Zeichen.
const cmapTexts = [];
for (const { raw: chunk, decoded } of streams(raw)) {
  const text = (decoded ?? chunk).toString('latin1');
  if (text.includes('beginbfchar') || text.includes('beginbfrange')) cmapTexts.push(text);
}

const codeToUnicode = new Map();
const hexToUnicode = (hex) => Buffer.from(hex, 'hex').swap16().toString('utf16le');

for (const cmap of cmapTexts) {
  for (const block of cmap.match(/beginbfchar([\s\S]*?)endbfchar/g) ?? []) {
    for (const pair of block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) ?? []) {
      const m = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(pair);
      codeToUnicode.set(m[1].toUpperCase(), hexToUnicode(m[2]));
    }
  }
  for (const block of cmap.match(/beginbfrange([\s\S]*?)endbfrange/g) ?? []) {
    for (const entry of block.match(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g) ?? []) {
      const m = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/.exec(entry);
      const lo = parseInt(m[1], 16);
      const hi = parseInt(m[2], 16);
      const base = parseInt(m[3], 16);
      for (let c = lo; c <= hi; c += 1) {
        codeToUnicode.set(
          c.toString(16).toUpperCase().padStart(m[1].length, '0'),
          String.fromCodePoint(base + (c - lo)),
        );
      }
    }
  }
}

// Text-Show-Operatoren auswerten (hexadezimale und literale Strings).
let allText = '';
for (const { raw: chunk, decoded } of streams(raw)) {
  const body = (decoded ?? chunk).toString('latin1');
  if (!/\bTj\b|\bTJ\b/.test(body)) continue;
  for (const m of body.matchAll(/<([0-9A-Fa-f\s]+)>/g)) {
    const codes = m[1].replace(/\s+/g, '');
    for (let i = 0; i + 4 <= codes.length; i += 4) {
      const code = codes.slice(i, i + 4).toUpperCase();
      if (codeToUnicode.has(code)) allText += codeToUnicode.get(code);
    }
  }
  for (const m of body.matchAll(/\(((?:\\.|[^\\)])*)\)/g)) {
    for (const ch of m[1]) {
      const code = ch.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0');
      allText += codeToUnicode.get(code) ?? ch;
    }
  }
}

const compact = allText.replace(/\s+/g, '');
const hasText = /Urlaub/.test(compact);
const checks = [
  ['querliegender Text "Urlaub" im PDF-Text vorhanden', hasText],
  ['ToUnicode-Zuordnungen gefunden', codeToUnicode.size > 0],
];

console.log(`Zeichen aus PDF dekodiert: ${compact.length}`);
if (!hasText) console.log('Auszug:', JSON.stringify(compact.slice(0, 300)));

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${label}`);
  if (!ok) failed += 1;
}
rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
console.log(failed === 0 ? '\nQuerliegender Text ist im PDF vorhanden.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
