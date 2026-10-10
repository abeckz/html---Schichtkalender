/**
 * Zugriff auf die File System Access API (Speichern-/Öffnen-Dialog).
 *
 * Chrome und Edge bieten über `window.showSaveFilePicker` bzw.
 * `window.showOpenFilePicker` einen echten Betriebssystem-Dateidialog an,
 * mit dem der Benutzer Speicherort und Dateinamen frei wählen kann. Firefox
 * und Safari unterstützen diese Schnittstelle (noch) nicht.
 *
 * Dieses Modul kapselt den Zugriff vollständig und defensiv:
 * - es wird nie geworfen,
 * - fehlt die API, liefern die Funktionen einen Fehlercode zurück, damit die
 *   aufrufende Oberfläche auf den klassischen Download umschwenken kann,
 * - ein vom Benutzer abgebrochener Dialog wird als "abgebrochen" (nicht als
 *   Fehler) gemeldet, damit die Oberfläche keine Fehlermeldung zeigt.
 *
 * Fachlogik (Kalenderberechnung) wird hier nicht berührt; es werden immer nur
 * fertig serialisierte Zeichenketten gelesen und geschrieben.
 */

/** Ergebnis eines Speicherversuchs über den Systemdialog. */
export type SaveWithPickerResult =
  | 'saved'
  | 'cancelled'
  | 'unsupported'
  | 'failed';

/** Ergebnis eines Ladeversuchs über den Systemdialog. */
export type LoadWithPickerResult =
  | { status: 'loaded'; text: string }
  | { status: 'cancelled' }
  | { status: 'unsupported' }
  | { status: 'failed' };

/** Dateityp-Filter für den Systemdialog (JSON-Sicherungsdatei). */
export interface PickerFileType {
  description: string;
  accept: Record<string, string[]>;
}

/**
 * Minimale, typsichere Sicht auf die File System Access API.
 *
 * Die Standard-`lib.dom.d.ts` von TypeScript enthält diese noch jungen
 * Schnittstellen nicht zuverlässig; deshalb werden sie hier lokal deklariert
 * und über eine schmale Fassade angesprochen (erleichtert auch Tests).
 */
interface FileSystemWritable {
  write(data: Blob | string): Promise<void>;
  close(): Promise<void>;
}

interface FileSystemFileHandleLike {
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritable>;
}

interface WindowWithFileSystemAccess {
  showSaveFilePicker?: (options?: {
    suggestedName?: string;
    types?: PickerFileType[];
  }) => Promise<FileSystemFileHandleLike>;
  showOpenFilePicker?: (options?: {
    multiple?: boolean;
    types?: PickerFileType[];
  }) => Promise<FileSystemFileHandleLike[]>;
}

/** Liefert window (oder null in Nicht-Browser-Umgebungen). */
function getWindow(): WindowWithFileSystemAccess | null {
  if (typeof window === 'undefined') return null;
  return window as unknown as WindowWithFileSystemAccess;
}

/** Ist der Systemdialog zum Speichern verfügbar (Chrome/Edge)? */
export function canUseSavePicker(): boolean {
  return typeof getWindow()?.showSaveFilePicker === 'function';
}

/** Ist der Systemdialog zum Öffnen verfügbar (Chrome/Edge)? */
export function canUseOpenPicker(): boolean {
  return typeof getWindow()?.showOpenFilePicker === 'function';
}

/** Erkennt einen vom Benutzer abgebrochenen Dialog (AbortError). */
function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}

/** Standard-Dateitypfilter für Sicherungsdateien. */
export function buildJsonFileTypes(): PickerFileType[] {
  return [
    {
      description: 'Schichtkalender-Sicherung (JSON)',
      accept: { 'application/json': ['.json'] },
    },
  ];
}

/**
 * Speichert Text über den Systemdialog unter dem vorgeschlagenen Dateinamen.
 *
 * @param text          fertig serialisierter Inhalt.
 * @param suggestedName vorgeschlagener Dateiname inkl. Endung.
 * @returns 'saved' bei Erfolg, 'cancelled' bei Abbruch durch den Benutzer,
 *          'unsupported' ohne API und 'failed' bei einem sonstigen Fehler.
 */
export async function saveTextWithPicker(
  text: string,
  suggestedName: string,
): Promise<SaveWithPickerResult> {
  const win = getWindow();
  if (typeof win?.showSaveFilePicker !== 'function') return 'unsupported';
  try {
    const handle = await win.showSaveFilePicker({
      suggestedName,
      types: buildJsonFileTypes(),
    });
    const writable = await handle.createWritable();
    await writable.write(new Blob([text], { type: 'application/json' }));
    await writable.close();
    return 'saved';
  } catch (error) {
    return isAbortError(error) ? 'cancelled' : 'failed';
  }
}

/**
 * Öffnet eine Datei über den Systemdialog und liefert ihren Textinhalt.
 *
 * @returns { status: 'loaded', text } bei Erfolg, sonst 'cancelled',
 *          'unsupported' oder 'failed'.
 */
export async function loadTextWithPicker(): Promise<LoadWithPickerResult> {
  const win = getWindow();
  if (typeof win?.showOpenFilePicker !== 'function') return { status: 'unsupported' };
  try {
    const handles = await win.showOpenFilePicker({
      multiple: false,
      types: buildJsonFileTypes(),
    });
    const handle = handles[0];
    if (!handle) return { status: 'failed' };
    const file = await handle.getFile();
    const text = await file.text();
    return { status: 'loaded', text };
  } catch (error) {
    return { status: isAbortError(error) ? 'cancelled' : 'failed' };
  }
}
