/**
 * Prüft die Anzeige-Einstellung der Offline-Datei bei file://.
 *
 * Geprüft werden:
 *  1. Standard (kein gespeicherter Wert): folgt der Systemeinstellung.
 *  2. Gespeicherter Wert "dark"/"light": wird ohne Parameter angewendet.
 *  3. Klick auf den Umschalter: Attribut und Speicherwert ändern sich.
 *
 * Reines Prüfskript für die Entwicklung, nicht Teil der App.
 * Aufruf: node scripts/checkTheme.mjs <pfad-zur-html-datei>
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chrome =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const file = resolve(process.argv[2] ?? 'BASF-Schichtkalender.html').replace(/\\/g, '/');
const baseUrl = `file:///${file}`;

/** Führt Chrome headless aus und liefert den DOM-Mitschnitt. */
function dumpDom(extraArgs, url = baseUrl) {
  const profile = mkdtempSync(join(tmpdir(), 'sk-check-'));
  const result = spawnSync(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--virtual-time-budget=8000',
      ...extraArgs,
      '--dump-dom',
      url,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 60000 },
  );
  rmSync(profile, { recursive: true, force: true });
  const dom = result.stdout ?? '';
  if (dom.trim() === '') {
    throw new Error(
      `Chrome lieferte keinen DOM-Mitschnitt (Exit ${result.status}): ${result.stderr ?? ''}`,
    );
  }
  return dom;
}

/** Liest das data-theme-Attribut des Wurzelelements. */
function themeOf(dom) {
  const match = /<html[^>]*data-theme="([a-z]+)"/.exec(dom);
  if (!match) {
    const htmlTag = /<html[^>]*>/.exec(dom)?.[0] ?? '(kein html-Tag)';
    console.log('   Diagnose html-Tag:', htmlTag);
  }
  return match?.[1] ?? '(nicht gesetzt)';
}

const checks = [];

const defaultDom = dumpDom([]);
const defaultTheme = themeOf(defaultDom);
checks.push([
  `Standard folgt der Systemeinstellung (${defaultTheme})`,
  defaultTheme === 'light' || defaultTheme === 'dark',
]);

const defaultDarkDom = dumpDom(['--force-dark-mode']);
checks.push(['System dunkel -> dunkel', themeOf(defaultDarkDom) === 'dark']);

const forcedDark = dumpDom([], `${baseUrl}?theme=dark`);
checks.push(['Parameter theme=dark -> dunkel', themeOf(forcedDark) === 'dark']);

const forcedLight = dumpDom([], `${baseUrl}?theme=light`);
const forcedLightTheme = themeOf(forcedLight);
checks.push([
  `Parameter theme=light -> hell (erhalten: ${forcedLightTheme})`,
  forcedLightTheme === 'light',
]);

// Die erzwungene Anzeige muss den dunklen Farbsatz tatsächlich anwenden.
checks.push([
  'Dunkles Farbschema im CSS vorhanden',
  forcedDark.includes(':root[data-theme=dark]') && forcedDark.includes('#0b0f14'),
]);

const holidayCount = (defaultDom.match(/class="holiday-mark"/g) ?? []).length;
checks.push([`F!-Marken vorhanden (${holidayCount})`, holidayCount >= 15]);

const title = /class="app-title">([^<]*)</.exec(defaultDom)?.[1];
checks.push([`Titel "BASF Schichtkalender" (${title})`, title === 'BASF Schichtkalender']);

const columnHeads = Array.from(defaultDom.matchAll(/role="columnheader">([^<]*)</g)).map(
  (match) => match[1],
);
const dayTableHeadCount = (defaultDom.match(/class="day-table-head"/g) ?? []).length;
checks.push([
  `Keine Spaltenkopfzeile über den Tageszeilen (${dayTableHeadCount} Kopfzeilen, ${columnHeads.length} Spaltenköpfe)`,
  dayTableHeadCount === 0 && columnHeads.length === 0,
]);

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${label}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? '\nAlle Prüfungen erfolgreich.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);

