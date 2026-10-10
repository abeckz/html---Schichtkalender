/**
 * Globale Testkonfiguration.
 *
 * React 18 verlangt für `act(...)` eine ausdrückliche Freigabe der
 * Testumgebung. Ohne diese Freigabe schreibt React bei jedem `act()`-Aufruf
 * die Warnung
 *
 *   Warning: The current testing environment is not configured to support act(...)
 *
 * auf stderr. Die Tests laufen zwar korrekt durch, die Warnung sorgt aber in
 * PowerShell für einen scheinbaren Fehler (NativeCommandError).
 *
 * Diese Datei setzt die Freigabe genau einmal zentral. Sie ist bewusst die
 * einzige Stelle und wird über `test.setupFiles` in vite.config.ts geladen.
 */

// Freigabe für Reacts `act(...)` in der Testumgebung (jsdom und node).
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;
