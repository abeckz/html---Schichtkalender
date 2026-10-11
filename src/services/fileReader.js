/**
 * Kleiner Helfer zum Lesen einer vom Benutzer gewählten Datei.
 *
 * Gekapselt und defensiv: fehlt die FileReader-API oder schlägt das Lesen
 * fehl, wird null geliefert statt zu werfen. So bleibt die aufrufende
 * Oberfläche frei von Fehlerbehandlung.
 */
/**
 * Liest eine Datei als Text (Promise-basiert).
 * Liefert null, wenn die Datei nicht gelesen werden konnte.
 */
export function readFileAsText(file, readerFactory = () => typeof FileReader === 'undefined' ? null : new FileReader()) {
    return new Promise((resolve) => {
        let created;
        try {
            created = readerFactory();
            if (!created) {
                resolve(null);
                return;
            }
        }
        catch {
            resolve(null);
            return;
        }
        const reader = created;
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
        reader.onerror = () => resolve(null);
        try {
            reader.readAsText(file);
        }
        catch {
            resolve(null);
        }
    });
}
