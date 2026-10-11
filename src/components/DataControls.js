import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Datei-Steuerung (Sichern / Laden).
 *
 * Ergänzt den flüchtigen Browser-Speicher um eine dauerhafte, dateibasierte
 * Sicherung. Über "Sichern" wird der aktuelle Zustand (Einstellungen und
 * persönliche Tagesmarkierungen) als JSON-Datei gesichert; über "Laden" wird
 * eine zuvor gesicherte Datei wieder eingelesen.
 *
 * Bevorzugter Weg ist der Betriebssystem-Dateidialog der File System Access
 * API (Chrome und Edge): Der Benutzer wählt Dateiname und Speicherort selbst.
 * Nur wenn diese Schnittstelle fehlt oder der Dialog nicht zustande kommt,
 * wird auf den klassischen Download in den Download-Ordner bzw. den
 * Datei-Eingabedialog zurückgegriffen.
 *
 * Beide Funktionen sind reine Komfortfunktionen der Bildschirmansicht: sie
 * werden nie gedruckt und verändern keine Fachdaten (Kalenderberechnung).
 * Fehlerhafte Dateien werden abgewiesen, ohne den bestehenden Zustand zu
 * beschädigen.
 */
import { useId, useRef, useState } from 'react';
import { readFileAsText } from '../services/fileReader';
import { loadState, parseState } from '../services/persistence';
export function DataControls({ onSave, onLoad }) {
    const inputRef = useRef(null);
    const [status, setStatus] = useState('');
    const statusId = useId();
    const handleSave = async () => {
        const ok = await onSave();
        setStatus(ok ? 'Datei gespeichert.' : 'Speichern abgebrochen.');
    };
    const handleLoad = async () => {
        // Bevorzugt der Systemdialog (Chrome/Edge). Fehlt er, wird der klassische
        // Datei-Eingabedialog geöffnet.
        const outcome = await loadState();
        if (outcome.status === 'loaded') {
            onLoad(outcome.state);
            setStatus('Daten geladen.');
            return;
        }
        if (outcome.status === 'unavailable') {
            inputRef.current?.click();
            return;
        }
        if (outcome.status === 'invalid') {
            setStatus('Datei konnte nicht gelesen werden.');
        }
        // 'cancelled': bewusst keine Meldung.
    };
    const handleFile = async (file) => {
        if (!file)
            return;
        const text = await readFileAsText(file);
        const state = text === null ? null : parseState(text);
        if (!state) {
            setStatus('Datei konnte nicht gelesen werden.');
            return;
        }
        onLoad(state);
        setStatus('Daten geladen.');
    };
    return (_jsxs("div", { className: "toolbar-group data-controls", role: "group", "aria-label": "Speichern und Laden", children: [_jsx("button", { type: "button", className: "secondary-button", onClick: () => void handleSave(), children: "Sichern" }), _jsx("button", { type: "button", className: "secondary-button", onClick: () => void handleLoad(), children: "Laden" }), _jsx("input", { ref: inputRef, type: "file", accept: "application/json,.json", className: "visually-hidden", "aria-hidden": "true", tabIndex: -1, onChange: (event) => {
                    void handleFile(event.target.files?.[0]);
                    // Auswahl zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
                    event.target.value = '';
                } }), _jsx("span", { className: "field-hint", id: statusId, role: "status", "aria-live": "polite", children: status })] }));
}
