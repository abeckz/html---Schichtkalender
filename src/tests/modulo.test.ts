import { describe, expect, it } from 'vitest';
import { positiveModulo } from '../utils/modulo';

describe('positiveModulo', () => {
  it('liefert für positive Werte den euklidischen Rest', () => {
    expect(positiveModulo(0, 3)).toBe(0);
    expect(positiveModulo(1, 3)).toBe(1);
    expect(positiveModulo(2, 3)).toBe(2);
    expect(positiveModulo(3, 3)).toBe(0);
    expect(positiveModulo(4, 3)).toBe(1);
  });

  it('behandelt negative Werte korrekt', () => {
    expect(positiveModulo(-1, 3)).toBe(2);
    expect(positiveModulo(-2, 3)).toBe(1);
    expect(positiveModulo(-3, 3) + 0).toBe(0);
    expect(positiveModulo(-4, 3)).toBe(2);
    expect(positiveModulo(-1, 4)).toBe(3);
  });

  it('behandelt große Werte korrekt', () => {
    expect(positiveModulo(1_000_000, 7)).toBe(1_000_000 % 7);
    expect(positiveModulo(-1_000_000, 7)).toBe(6);
  });

  it('wirft bei ungültigen Argumenten', () => {
    expect(() => positiveModulo(1, 0)).toThrow(RangeError);
    expect(() => positiveModulo(1, -3)).toThrow(RangeError);
    expect(() => positiveModulo(Number.NaN, 3)).toThrow(TypeError);
    expect(() => positiveModulo(1, Number.POSITIVE_INFINITY)).toThrow(TypeError);
  });
});
