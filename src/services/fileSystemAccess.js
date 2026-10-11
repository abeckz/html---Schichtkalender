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
/** Liefert window (oder null in Nicht-Browser-Umgebungen). */
function getWindow() {
    if (typeof window === 'undefined')
        return null;
    return window;
}
/** Ist der Systemdialog zum Speichern verfügbar (Chrome/Edge)? */
export function canUseSavePicker() {
    return typeof getWindow()?.showSaveFilePicker === 'function';
}
/** Ist der Systemdialog zum Öffnen verfügbar (Chrome/Edge)? */
export function canUseOpenPicker() {
    return typeof getWindow()?.showOpenFilePicker === 'function';
}
/** Erkennt einen vom Benutzer abgebrochenen Dialog (AbortError). */
function isAbortError(error) {
    return (typeof error === 'object' &&
        error !== null &&
        error.name === 'AbortError');
}
/** Standard-Dateitypfilter für Sicherungsdateien. */
export function buildJsonFileTypes() {
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
export async function saveTextWithPicker(text, suggestedName) {
    const win = getWindow();
    if (typeof win?.showSaveFilePicker !== 'function')
        return 'unsupported';
    try {
        const handle = await win.showSaveFilePicker({
            suggestedName,
            types: buildJsonFileTypes(),
        });
        const writable = await handle.createWritable();
        await writable.write(new Blob([text], { type: 'application/json' }));
        await writable.close();
        return 'saved';
    }
    catch (error) {
        return isAbortError(error) ? 'cancelled' : 'failed';
    }
}
/**
 * Öffnet eine Datei über den Systemdialog und liefert ihren Textinhalt.
 *
 * @returns { status: 'loaded', text } bei Erfolg, sonst 'cancelled',
 *          'unsupported' oder 'failed'.
 */
export async function loadTextWithPicker() {
    const win = getWindow();
    if (typeof win?.showOpenFilePicker !== 'function')
        return { status: 'unsupported' };
    try {
        const handles = await win.showOpenFilePicker({
            multiple: false,
            types: buildJsonFileTypes(),
        });
        const handle = handles[0];
        if (!handle)
            return { status: 'failed' };
        const file = await handle.getFile();
        const text = await file.text();
        return { status: 'loaded', text };
    }
    catch (error) {
        return { status: isAbortError(error) ? 'cancelled' : 'failed' };
    }
}
