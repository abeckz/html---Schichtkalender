/**
 * Prüft die Darstellung des querliegenden Textes in der Druckansicht.
 *
 * Chrome lädt die Offline-Datei über file://, befüllt den lokalen Speicher mit
 * einer markierten Zusatzspalte samt querliegendem Text, wechselt in die
 * Druckansicht und misst die tatsächlichen Boxen der Text-Overlays.
 *
 * Geprüft wird:
 *  - der querliegende Text ist im Druck vorhanden,
 *  - sein innerer Textkörper hat eine sichtbare Größe (Breite und Höhe > 0),
 *  - der Text ist über die markierte Zeilenspanne zentriert.
 *
 * Reines Prüfskript für die Entwicklung, nicht Teil der App.
 * Aufruf: node scripts/checkVerticalText.mjs <pfad-zur-html-datei>
 */

import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chrome =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const file = resolve(process.argv[2] ?? 'BASF-Schichtkalender.html');
const workDir = mkdtempSync(join(tmpdir(), 'sk-vtext-'));
const workFile = join(workDir, 'probe.html');

const state = {
  version: 1,
  settings: { extraColumns: { 1: { left: [1], right: [] } }, showShiftCalendar: true },
  annotations: {
    '2026-01-01': {
      dateKey: '2026-01-01',
      label: '',
      colors: {},
      extraColors: { extra0: 'red' },
      extraTexts: {
        extra0: {
          colorKey: 'extra0',
          columnLabel: 'Zusatzspalte 0',
          vertical: true,
          text: 'Urlaub',
          dateKeys: ['2026-01-01', '2026-01-02', '2026-01-03'],
          length: 3,
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
    setTimeout(function () {
      function R(el) { var r = el.getBoundingClientRect(); return { y: r.top, h: r.height, b: r.bottom, x: r.left, w: r.width }; }
      var text = document.querySelector('.print-extra-text');
      var r = { present: !!text };
      if (text) {
        var inner = text.querySelector('span');
        var outer = R(text);
        var innerRect = inner ? R(inner) : null;
        r.isVertical = text.classList.contains('is-vertical');
        r.writingMode = getComputedStyle(text).writingMode;
        r.outerH = Math.round(outer.h * 10) / 10;
        r.innerW = innerRect ? Math.round(innerRect.w * 10) / 10 : -1;
        r.innerH = innerRect ? Math.round(innerRect.h * 10) / 10 : -1;
        // Zentrierung: Abstand oben zu Abstand unten im Textkörper.
        r.padTop = innerRect ? Math.round((innerRect.y - outer.y) * 10) / 10 : -1;
        r.padBottom = innerRect ? Math.round((outer.b - innerRect.b) * 10) / 10 : -1;
        r.text = (inner ? inner.textContent : text.textContent) || '';
      }
      var pre = document.createElement('pre');
      pre.id = 'probe-result';
      pre.textContent = JSON.stringify(r);
      document.body.appendChild(pre);
    }, 800);
  }, 500);
});
</script>`;

const source = readFileSync(file, 'utf8');
writeFileSync(workFile, source.replace('</body>', `${probe}\n  </body>`), 'utf8');

const profile = join(workDir, 'profile');
const result = spawnSync(
  chrome,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--virtual-time-budget=12000',
    `--user-data-dir=${profile}`,
    '--dump-dom',
    `file:///${workFile.replace(/\\/g, '/')}`,
  ],
  { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, cwd: workDir },
);

const dom = result.stdout ?? '';
const match = /<pre id="probe-result">([\s\S]*?)<\/pre>/.exec(dom);
rmSync(workDir, { recursive: true, force: true });

if (!match) {
  console.error('Kein Messergebnis gefunden.');
  console.error(dom.slice(0, 500));
  process.exit(1);
}

const data = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
console.log('Ergebnis:', JSON.stringify(data, null, 2));

const centered = data.padTop >= 0 && data.padBottom >= 0 && Math.abs(data.padTop - data.padBottom) <= 1;
const checks = [
  ['querliegender Text im Druck vorhanden', data.present === true],
  ['Textkörper sichtbar (Breite > 0 und Höhe > 0)', data.innerW > 0 && data.innerH > 0],
  ['als querliegend markiert (is-vertical)', data.isVertical === true],
  ['Text über die Zeilenspanne zentriert', centered],
];

let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${label}`);
  if (!ok) failed += 1;
}
console.log(failed === 0 ? '\nQuerliegender Drucktext korrekt.' : `\n${failed} Prüfung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
