/**
 * ThemeStore (Hell / Dunkel).
 *
 * Die Anzeige ist eine reine Komfortfunktion: Sie beeinflusst niemals die
 * Fachlogik (Kalenderberechnung, Annotationen, Persistenz) und niemals die
 * Druckansicht. Der Wert wird getrennt vom übrigen Zustand gespeichert,
 * damit ein beschädigter Eintrag nur das Theme zurücksetzt.
 *
 * Zugriffe sind defensiv gekapselt: bei fehlendem localStorage oder
 * defekten Werten wird auf den Dunkelmodus zurückgefallen. Es wird nie
 * geworfen.
 *
 * Die Vorbelegung erfolgt bereits im HTML (Inline-Skript), damit beim
 * Öffnen kein heller Blitz entsteht. Ein erzwungener Anzeigewert aus der
 * Adresse (?theme=dark|light) hat Vorrang und wird nicht gespeichert.
 *
 * Die Startansicht ist grundsätzlich der Dunkelmodus: ohne gespeicherte
 * Einstellung (und ohne Adressparameter) beginnt die Anzeige dunkel.
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * Vom Benutzer wählbare Theme-Einstellung.
 *
 * Bewusst auf Hell/Dunkel beschränkt: Ein Modus "System" entfällt. Ohne
 * ausdrückliche Wahl gilt der Dunkelmodus als Standard.
 */
export type ThemePreference = 'light' | 'dark';

/** Tatsächlich anzuwendendes Theme (identisch mit der Einstellung). */
export type ResolvedTheme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'schichtkalender.theme';
export const THEME_ATTRIBUTE = 'data-theme';
/** URL-Parameter zum Erzwingen einer Anzeige (nur für Tests/Vorschau). */
export const THEME_QUERY_PARAMETER = 'theme';

/**
 * Standardeinstellung ohne gespeicherten/nutzbaren Wert: Dunkelmodus.
 * Ohne ausdrückliche Wahl beginnt die Startansicht grundsätzlich dunkel.
 */
export const DEFAULT_THEME_PREFERENCE: ThemePreference = 'dark';

const THEME_PREFERENCES: readonly ThemePreference[] = ['light', 'dark'];

/** Deutscher Anzeigename einer Theme-Einstellung. */
export const themePreferenceNames: Record<ThemePreference, string> = {
  light: 'Hell',
  dark: 'Dunkel',
};

/** Prüft einen unbekannten Wert auf eine gültige Theme-Einstellung. */
export function isThemePreference(value: unknown): value is ThemePreference {
  return typeof value === 'string' && (THEME_PREFERENCES as readonly string[]).includes(value);
}

/** Minimale, gekapselte Storage-Schnittstelle (erleichtert Tests). */
export interface ThemeStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getDefaultStorage(): ThemeStorageLike | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Liest die gespeicherte Theme-Einstellung (nie werfend). */
export function readThemePreference(
  storage: ThemeStorageLike | null = getDefaultStorage(),
  search: string = typeof window === 'undefined' ? '' : window.location.search,
): ThemePreference {
  // Erzwungene Anzeige aus der Adresse hat Vorrang, verändert aber keine
  // gespeicherte Einstellung. Nützlich für Vorschau und Tests.
  const forced = new RegExp(`(?:^|[?&])${THEME_QUERY_PARAMETER}=(dark|light)(?:&|$)`).exec(search);
  if (forced) return forced[1] as ThemePreference;

  if (!storage) return DEFAULT_THEME_PREFERENCE;
  try {
    const raw = storage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
  }
}

/** Speichert die Theme-Einstellung (Fehler werden geschluckt). */
export function writeThemePreference(
  preference: ThemePreference,
  storage: ThemeStorageLike | null = getDefaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, preference);
    return true;
  } catch {
    return false;
  }
}

/** Setzt das Theme-Attribut am Wurzelelement (idempotent). */
export function applyTheme(resolved: ResolvedTheme, root?: HTMLElement | null): void {
  const target = root ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (!target) return;
  target.setAttribute(THEME_ATTRIBUTE, resolved);
}

export interface ThemeStore {
  /** Gewählte Einstellung (Hell oder Dunkel). */
  preference: ThemePreference;
  /** Tatsächlich aktives Theme (identisch mit der Einstellung). */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Wechselt zwischen Hell und Dunkel. */
  toggle: () => void;
}

/**
 * Theme-Hook: hält die Einstellung und spiegelt sie in data-theme am <html>.
 *
 * Ohne ausdrückliche Wahl gilt der Dunkelmodus. Ein Modus "System" entfällt
 * vollständig.
 */
export function useThemeStore(): ThemeStore {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference(),
  );

  useEffect(() => {
    applyTheme(preference);
  }, [preference]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeThemePreference(next);
  }, []);

  const toggle = useCallback(() => {
    setPreference(preference === 'dark' ? 'light' : 'dark');
  }, [preference, setPreference]);

  return { preference, resolved: preference, setPreference, toggle };
}
