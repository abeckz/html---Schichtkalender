/**
 * Mathematische Helfer.
 */

/**
 * Modulo mit ausschließlich positivem Ergebnis (euklidischer Rest).
 * Negative Werte werden korrekt auf den Bereich [0, divisor) abgebildet.
 *
 * positiveModulo(-1, 3) === 2
 */
export function positiveModulo(value: number, divisor: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(divisor)) {
    throw new TypeError('positiveModulo: value und divisor müssen endliche Zahlen sein.');
  }
  if (divisor <= 0) {
    throw new RangeError('positiveModulo: divisor muss größer als 0 sein.');
  }
  const rest = value % divisor;
  return rest < 0 ? rest + divisor : rest;
}
