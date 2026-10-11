/**
 * Zentrales Domain-Modell des Schichtkalenders.
 *
 * Alle fachlichen Typen werden genau einmal hier definiert und von den
 * Engines, Services, der Screen-UI und der Print-UI gemeinsam verwendet
 * (Single Source of Truth).
 */
/**
 * Erzeugt den Map-Schlüssel eines Kalendertags.
 *
 * Rückwärtskompatibilität: ältere Aufrufer übergaben zusätzlich die Art; der
 * zweite Parameter wird seit der Umstellung auf Listen ignoriert, damit die
 * Signatur kompatibel bleibt.
 */
export function anniversaryKey(monthDay, _kind) {
    return monthDay;
}
