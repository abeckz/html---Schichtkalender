/**
 * Hook zur Überwachung ungespeicherter Änderungen.
 *
 * Der Hook vergleicht den aktuellen Zustand mit dem zuletzt gesicherten und
 * meldet über `beforeunload`, ob beim Schließen/Neuladen gewarnt werden muss.
 * Beim tatsächlichen Schließen-Versuch (Ereignis `beforeunload`) blockiert der
 * Browser das Schließen und zeigt seinen eigenen Bestätigungsdialog; parallel
 * wird die Anwendung über `onCloseAttempt` informiert, damit sie zusätzlich
 * einen eigenen Hinweis anzeigen kann.
 *
 * Der Hook ist defensiv: fehlt `window`, passiert nichts. Die Signatur des
 * gesicherten Zustands wird über `markSaved`/`markUnsaved` gesteuert.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PersistedState } from '../domain/types';
import { hasUnsavedChanges, stateSignature } from './changeTracking';

export interface UnsavedChangesGuard {
  /** true, wenn seit der letzten Sicherung Änderungen vorliegen. */
  isDirty: boolean;
  /** Markiert den aktuellen Zustand als gesichert (Daten sind dieser Zustand). */
  markSaved: (state: PersistedState) => void;
  /**
   * Grundzustand nach einem Import/Laden: der geladene Zustand gilt als
   * gesichert (er stammt aus einer Datei und liegt bereits lokal vor).
   */
  markLoaded: (state: PersistedState) => void;
  /** Erzwingt "keine ungespeicherten Änderungen" (z. B. nach Verwerfen). */
  clear: () => void;
}

/**
 * @param state         aktueller Zustand; bei jeder Änderung neu ausgewertet.
 * @param onCloseAttempt optionale Rückmeldung, wenn der Benutzer das Fenster
 *                       schließen möchte (zur zusätzlichen Anzeige eines
 *                       Hinweises). Wird nur bei aktiven Änderungen aufgerufen.
 */
export function useUnsavedChangesGuard(
  state: PersistedState,
  onCloseAttempt?: () => void,
): UnsavedChangesGuard {
  // Signatur des zuletzt gesicherten Zustands; null = noch nie gesichert.
  const [savedSignature, setSavedSignature] = useState<string | null>(null);
  const dirty = hasUnsavedChanges(savedSignature, state);

  // Aktuellen Zustand für den beforeunload-Handler ohne Neuregistrierung.
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const closeAttemptRef = useRef(onCloseAttempt);
  closeAttemptRef.current = onCloseAttempt;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    function handleBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirtyRef.current) return;
      // Standardverhalten: Der Browser zeigt seinen eigenen Sicherheitsdialog
      // und blockiert das Schließen, solange der Benutzer nicht bestätigt.
      event.preventDefault();
      // Ältere Browser verlangen einen Rückgabewert.
      event.returnValue = '';
      closeAttemptRef.current?.();
      return '';
    }
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  const markSaved = useCallback((next: PersistedState) => {
    setSavedSignature(stateSignature(next));
  }, []);

  const markLoaded = markSaved;

  const clear = useCallback(() => {
    setSavedSignature(null);
  }, []);

  return { isDirty: dirty, markSaved, markLoaded, clear };
}
