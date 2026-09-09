import {
  computeNextEnrollPin,
  parseEnrollPin,
  MAX_ENROLL_PIN,
} from './allocate-next-pin';

describe('computeNextEnrollPin', () => {
  it('fills lowest gaps first when UIDs start above 1 (5–14 → 1, then 2…)', () => {
    const used = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    expect(computeNextEnrollPin(used)).toBe('1');

    used.push(1);
    expect(computeNextEnrollPin(used)).toBe('2');

    used.push(2);
    expect(computeNextEnrollPin(used)).toBe('3');

    used.push(3);
    expect(computeNextEnrollPin(used)).toBe('4');

    used.push(4);
    expect(computeNextEnrollPin(used)).toBe('15');
  });

  it('assigns UID 6 when existing UIDs are contiguous 1–5', () => {
    expect(computeNextEnrollPin([1, 2, 3, 4, 5])).toBe('6');
  });

  it('never assigns an in-use UID (no overwrite / shift)', () => {
    expect(computeNextEnrollPin([1, 2, 3, 4, 5])).not.toBe('1');
    expect(computeNextEnrollPin([1])).toBe('2');
    expect(computeNextEnrollPin([1, 3, 4, 5])).toBe('2');
  });

  it('prefers a low gap over a polluted high orphan UID like 56', () => {
    // Real device has 5–14; stale DB also has 56 — still assign 1, not 57.
    expect(computeNextEnrollPin([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 56])).toBe(
      '1',
    );
  });

  it('assigns UID 1 only when UID 1 is actually free', () => {
    expect(computeNextEnrollPin([])).toBe('1');
    expect(computeNextEnrollPin(new Set())).toBe('1');
    expect(computeNextEnrollPin([2, 3])).toBe('1');
  });

  it('ignores junk outside the enroll range', () => {
    expect(computeNextEnrollPin([1, 2, 3, 65534, 0, -1])).toBe('4');
  });

  it('does not mutate or reorder the input list of existing UIDs', () => {
    const existing = [5, 6, 7, 8, 9, 10];
    const snapshot = [...existing];
    computeNextEnrollPin(existing);
    expect(existing).toEqual(snapshot);
  });

  it('throws when the range is exhausted', () => {
    const all = Array.from({ length: MAX_ENROLL_PIN }, (_, i) => i + 1);
    expect(() => computeNextEnrollPin(all)).toThrow(/No free fingerprint PIN/);
  });
});

describe('parseEnrollPin', () => {
  it('accepts valid employee-range PINs', () => {
    expect(parseEnrollPin('1')).toBe(1);
    expect(parseEnrollPin(' 42 ')).toBe(42);
    expect(parseEnrollPin(String(MAX_ENROLL_PIN))).toBe(MAX_ENROLL_PIN);
  });

  it('rejects invalid or junk device UIDs', () => {
    expect(parseEnrollPin(null)).toBeNull();
    expect(parseEnrollPin('')).toBeNull();
    expect(parseEnrollPin('0')).toBeNull();
    expect(parseEnrollPin('65534')).toBeNull();
    expect(parseEnrollPin('13.140.141.131')).toBeNull();
  });
});
