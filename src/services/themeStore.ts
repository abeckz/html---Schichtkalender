/**
 * ThemeStore (Hell / Dunkel / System).
 *
 * Die Anzeige ist eine reine Komfortfunktion: Sie beeinflusst niemals die
 * Fachlogik (Kalenderberechnung, Annotationen, Persistenz) und niemals die
 * Druckansicht. Der Wert wird getrennt vom übrigen Zustand gespeichert,
 * damit ein beschädigter Eintrag nur das Theme zurücksetzt.
 *
 * Zugriffe sind defensiv gekapselt: bei fehlendem localStorage, fehlendem
 * matchMedia oder defekten Werten wird auf "system" zurückgefallen. Es
 * wird nie geworfen.
 *
 * Die Vorbelegung erfolgt bereits im HTML (Inline-Skript), damit beim
 * Öffnen kein heller Blitz entsteht. Ein erzwungener Anzeigewert aus der
 * Adresse (?theme=dark|light) hat Vorrang und wird nicht gespeichert.
 *
 * Die Startansicht ist grundsätzlich der Dunkelmodus: ohne gespeicherte
 * Einstellung (und ohne Adressparameter) beginnt die Anzeige dunkel.
 */

import { useCallback, useEffect, useState } from 'react';

/** Vom Benutzer wählbare Theme-Einstellung. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Tatsächlich anzuwendendes Theme (system wird aufgelöst). */
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

const THEME_PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/** Deutscher Anzeigename einer Theme-Einstellung. */
export const themePreferenceNames: Record<ThemePreference, string> = {
  system: 'System',
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

/** Systemeinstellung des Betriebssystems/Browsers ("dunkel" als Standard). */
export function getSystemTheme(): ResolvedTheme {
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

/** Löst eine Einstellung zum tatsächlich anzuwendenden Theme auf. */
export function resolveTheme(
  preference: ThemePreference,
  systemTheme: ResolvedTheme,
): ResolvedTheme {
  if (preference === 'system') return systemTheme;
  return preference;
}

/** Setzt das Theme-Attribut am Wurzelelement (idempotent). */
export function applyTheme(resolved: ResolvedTheme, root?: HTMLElement | null): void {
  const target = root ?? (typeof document === 'undefined' ? null : document.documentElement);
  if (!target) return;
  target.setAttribute(THEME_ATTRIBUTE, resolved);
}

export interface ThemeStore {
  /** Gewählte Einstellung (Hell, Dunkel oder System). */
  preference: ThemePreference;
  /** Tatsächlich aktives Theme. */
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  /** Wechselt zwischen Hell und Dunkel (ausgehend vom sichtbaren Theme). */
  toggle: () => void;
}

/**
 * Theme-Hook: hält die Einstellung, beobachtet die Systemeinstellung im
 * Modus "system" und spiegelt das Ergebnis in data-theme am <html>.
 */
export function useThemeStore(): ThemeStore {
  const [preference, setPreferenceState] = useState<ThemePreference>(() =>
    readThemePreference(),
  );
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  // Systemeinstellung live verfolgen (nur solange sie relevant ist).
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => setSystemTheme(query.matches ? 'dark' : 'light');
    handleChange();
    // Ältere Browser kennen addEventListener am MediaQueryList nicht.
    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleChange);
      return () => query.removeEventListener('change', handleChange);
    }
    query.addListener?.(handleChange);
    return () => query.removeListener?.(handleChange);
  }, []);

  const resolved = resolveTheme(preference, systemTheme);

  useEffect(() => {
    applyTheme(resolved);
  }, [resolved]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeThemePreference(next);
  }, []);

  const toggle = useCallback(() => {
    // Ausgehend vom sichtbaren Theme wechseln, damit ein Klick im
    // Systemmodus immer sofort den erwarteten Effekt hat.
    const visible = resolveTheme(preference, systemTheme);
    setPreference(visible === 'dark' ? 'light' : 'dark');
  }, [preference, systemTheme, setPreference]);

  return { preference, resolved, setPreference, toggle };
}
