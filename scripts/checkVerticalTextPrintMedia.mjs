/**
 * Misst den querliegenden Text der Druckansicht **mit Druckmedien-Emulation**.
 *
 * Chrome wird headless über das DevTools-Protokoll gesteuert. Nach dem Befüllen
 * des lokalen Speichers und dem Wechsel in die Druckansicht wird die Seite auf
 * `media: print` umgeschaltet und die tatsächliche Geometrie der Text-Overlays
 * gemessen. Damit lässt sich prüfen, ob der Text auch in der Druckdarstellung
 * sichtbar ist (nicht nur am Bildschirm).
 *
 * Reines Prüfskript für die Entwicklung.
 * Aufruf: node scripts/checkVerticalTextPrintMedia.mjs <html-datei>
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const chrome =
  process.env.CHROME_PATH ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const file = resolve(process.argv[2] ?? 'BASF-Schichtkalender.html');
const workDir = mkdtempSync(join(tmpdir(), 'sk-pmedia-'));
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

const setup = `<script>
window.__prepared = false;
window.addEventListener('load', function () {
  if (window.__prepared) return;
  try { localStorage.setItem('schichtkalender.state', ${JSON.stringify(JSON.stringify(state))}); } catch (e) {}
  window.__prepared = true;
  setTimeout(function () {
    var buttons = document.querySelectorAll('.toolbar-controls .primary-button');
    if (buttons.length) buttons[buttons.length - 1].click();
  }, 400);
});
</script>`;
writeFileSync(workFile, readFileSync(file, 'utf8').replace('</body>', `${setup}\n  </body>`), 'utf8');

const port = 9333;
const profile = join(workDir, 'profile');
const child = spawn(
  chrome,
  [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `file:///${workFile.replace(/\\/g, '/')}`,
  ],
  { stdio: 'ignore' },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      /* noch nicht bereit */
    }
    await sleep(250);
  }
  throw new Error('Kein DevTools-Ziel gefunden.');
}

let id = 0;
const pending = new Map();
function send(ws, method, params = {}) {
  const messageId = ++id;
  ws.send(JSON.stringify({ id: messageId, method, params }));
  return new Promise((resolvePromise, reject) => pending.set(messageId, { resolvePromise, reject }));
}

const page = await getTarget();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
ws.addEventListener('message', (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolvePromise, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolvePromise(msg.result);
  }
});

await send(ws, 'Runtime.enable');
await send(ws, 'Page.enable');
await sleep(1800); // Druckansicht aufbauen lassen
await send(ws, 'Emulation.setEmulatedMedia', { media: 'print' });
await sleep(400);

// In den Bereich des querliegenden Textes scrollen und einen Screenshot machen,
// damit die Druckdarstellung optisch geprüft werden kann.
await send(ws, 'Runtime.evaluate', {
  expression: `(() => {
    const t = document.querySelector('.print-extra-text');
    if (t) t.scrollIntoView({ block: 'center' });
    return true;
  })()`,
  returnByValue: true,
});
await sleep(300);
try {
  const shot = await send(ws, 'Page.captureScreenshot', { format: 'png' });
  const outPng = resolve(process.argv[3] ?? 'vertical-printmedia.png');
  const { writeFileSync } = await import('node:fs');
  writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
  console.log('Screenshot (Druckmedien):', outPng);
} catch (e) {
  console.log('Screenshot nicht möglich:', String(e));
}

const expression = `(() => {
  const text = document.querySelector('.print-extra-text');
  if (!text) return { present: false };
  const inner = text.querySelector('span');
  const cs = getComputedStyle(text);
  const range = document.createRange();
  if (inner && inner.firstChild) range.selectNodeContents(inner);
  const rr = inner && inner.firstChild ? range.getBoundingClientRect() : null;
  return {
    present: true,
    isVertical: text.classList.contains('is-vertical'),
    writingMode: cs.writingMode,
    display: cs.display,
    visibility: cs.visibility,
    overflow: cs.overflow,
    innerHtml: text.innerHTML,
    rangeW: rr ? Math.round(rr.width * 10) / 10 : -1,
    rangeH: rr ? Math.round(rr.height * 10) / 10 : -1,
    text: inner ? inner.textContent : '',
  };
})()`;

const result = await send(ws, 'Runtime.evaluate', { expression, returnByValue: true });
const data = result.result.value;

ws.close();
child.kill();
await sleep(300);
try {
  rmSync(workDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
} catch {
  /* temporäres Profilverzeichnis kann von Chrome kurzzeitig gesperrt sein */
}

console.log('Ergebnis (Druckmedien):', JSON.stringify(data, null, 2));

const visible = data.present && data.rangeW > 0 && data.rangeH > 0 && data.visibility !== 'hidden';
const checks = [
  ['querliegender Text in Druckdarstellung vorhanden', data.present === true],
  ['Textkörper sichtbar (Breite > 0 und Höhe > 0)', data.rangeW > 0 && data.rangeH > 0],
  ['Text nicht ausgeblendet', data.visibility !== 'hidden' && data.display !== 'none'],
];
let failed = 0;
for (const [label, ok] of checks) {
  console.log(`${ok ? 'OK  ' : 'FEHL'}  ${label}`);
  if (!ok) failed += 1;
}
void visible;
process.exit(failed === 0 ? 0 : 1);
