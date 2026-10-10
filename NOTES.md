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
