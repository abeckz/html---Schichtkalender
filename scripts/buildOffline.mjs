/**
 * Erzeugt die Offline-fähige Einzeldatei-Variante des Schichtkalenders.
 *
 * Ablauf:
 *   1. TypeScript-Projekt prüfen (tsc -b)
 *   2. Vite-Build mit eingebettetem JS/CSS (BUILD_OFFLINE=1)
 *   3. Ergebnis als "Schichtkalender-Offline.html" ablegen und zusätzlich
 *      als doppelklickbare Datei "BASF-Schichtkalender.html" in das
 *      Projektwurzelverzeichnis kopieren.
 *
 * Reines Node-Skript ohne zusätzliche Abhängigkeiten.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDirectory, '..');
const buildDirectory = join(projectRoot, 'offline');
const sourceTemplate = join(projectRoot, 'src', 'index.html');
const viteTemplate = join(projectRoot, 'index.html');
const finalName = 'Schichtkalender-Offline.html';

/**
 * Die HTML-Vorlage gehört nach src/. Vite erwartet sie in der Projektwurzel
 * und schreibt den Build genau dorthin. Damit der Build die Vorlage nie
 * überschreiben kann, wird sie vor dem Build kopiert.
 */
function ensureViteTemplate() {
  if (!existsSync(sourceTemplate)) {
    throw new Error(
      `HTML-Vorlage fehlt: ${sourceTemplate}\n` +
        'Diese Datei enthält das Grundgerüst der Anwendung und darf nicht gelöscht werden.',
    );
  }
  copyFileSync(sourceTemplate, viteTemplate);
}

/** Startet einen Schritt mit der zum aktuellen Node gehörenden npm-CLI. */
function run(label, command, args) {
  console.log(`\n> ${label}`);
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: { ...process.env, BUILD_OFFLINE: '1' },
  });
  if (result.status !== 0) {
    console.error(`\nFEHLER in Schritt "${label}" (Exit-Code ${result.status}).`);
    process.exit(result.status ?? 1);
  }
}

/** Findet die von Vite erzeugte, noch nicht umbenannte HTML-Datei. */
function findBuiltHtml() {
  const entries = readdirSync(buildDirectory).filter((entry) =>
    entry.toLowerCase().endsWith('.html'),
  );
  if (entries.length === 0) {
    throw new Error(`Keine HTML-Datei in ${buildDirectory} gefunden.`);
  }
  // Die größte HTML-Datei ist die vollständige Einzeldatei.
  return entries
    .map((entry) => join(buildDirectory, entry))
    .sort((a, b) => statSync(b).size - statSync(a).size)[0];
}

ensureViteTemplate();

run('TypeScript-Prüfung (tsc -b)', process.execPath, [
  join(projectRoot, 'node_modules', 'typescript', 'bin', 'tsc'),
  '-b',
]);

run('Vite-Build als Einzeldatei', process.execPath, [
  join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  'build',
]);

if (!existsSync(buildDirectory)) {
  console.error(`\nFEHLER: Build-Verzeichnis "${buildDirectory}" existiert nicht.`);
  process.exit(1);
}

const builtHtml = findBuiltHtml();
const offlineFile = join(buildDirectory, finalName);
if (builtHtml !== offlineFile) {
  rmSync(offlineFile, { force: true });
  renameSync(builtHtml, offlineFile);
}

// Doppelklickbare Kopie im Projektwurzelverzeichnis. In der Wurzel liegt
// zusätzlich die generierte index.html aus dem Vite-Build; deshalb wird
// bewusst ein sprechender Dateiname verwendet, der nicht mit der Vorlage
// für Web-Auslieferungen kollidiert.
const rootCopy = join(projectRoot, 'BASF-Schichtkalender.html');
copyFileSync(offlineFile, rootCopy);

const kilobytes = Math.round(statSync(offlineFile).size / 1024);
console.log('\nFertig. Offline-Datei erstellt:');
console.log(`  ${offlineFile}  (${kilobytes} kB)`);
console.log(`  ${rootCopy}  (identische Kopie, per Doppelklick öffnen)`);
console.log('\nDie HTML-Vorlage bleibt unverändert unter src/index.html erhalten.');
