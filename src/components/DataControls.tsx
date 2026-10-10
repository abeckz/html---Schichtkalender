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
import type { PersistedState } from '../domain/types';
import { readFileAsText } from '../services/fileReader';
import { loadState, parseState } from '../services/persistence';

export interface DataControlsProps {
  /** Bietet den aktuellen Zustand zum Speichern an; Rückgabe: Erfolg. */
  onSave: () => Promise<boolean>;
  /** Übernimmt einen aus einer Datei geladenen Zustand. */
  onLoad: (state: PersistedState) => void;
}

export function DataControls({ onSave, onLoad }: DataControlsProps) {
  const inputRef = useRef<HTMLInputElement>(null);
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

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const text = await readFileAsText(file);
    const state = text === null ? null : parseState(text);
    if (!state) {
      setStatus('Datei konnte nicht gelesen werden.');
      return;
    }
    onLoad(state);
    setStatus('Daten geladen.');
  };

  return (
    <div className="toolbar-group data-controls" role="group" aria-label="Speichern und Laden">
      <button type="button" className="secondary-button" onClick={() => void handleSave()}>
        Sichern…
      </button>
      <button type="button" className="secondary-button" onClick={() => void handleLoad()}>
        Laden…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="visually-hidden"
        aria-hidden="true"
        tabIndex={-1}
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          // Auswahl zurücksetzen, damit dieselbe Datei erneut gewählt werden kann.
          event.target.value = '';
        }}
      />
      <span className="field-hint" id={statusId} role="status" aria-live="polite">
        {status}
      </span>
    </div>
  );
}