import { describe, it, expect } from 'vitest';
import { hammingHex, PHASH_EXACT_THRESHOLD } from '../src/verdict.js';
import { dhashFromLuminance, DHASH_W, DHASH_H } from '../../web/js/phash.js';

describe('hammingHex', () => {
  it('is 0 for identical hashes', () => {
    expect(hammingHex('a1b2c3d4e5f60718', 'a1b2c3d4e5f60718')).toBe(0);
  });

  it('counts single-bit differences', () => {
    expect(hammingHex('0000000000000000', '0000000000000001')).toBe(1);
    expect(hammingHex('0000000000000000', '0000000000000003')).toBe(2);
  });

  it('is 64 for complementary hashes', () => {
    expect(hammingHex('0000000000000000', 'ffffffffffffffff')).toBe(64);
  });

  it('returns Infinity for malformed input (never a false match)', () => {
    expect(hammingHex('abc', 'abcd')).toBe(Infinity);
    expect(hammingHex('', '')).toBe(Infinity);
    expect(hammingHex(null, 'ffff')).toBe(Infinity);
    expect(hammingHex('zzzzzzzzzzzzzzzz', '0000000000000000')).toBe(Infinity);
  });

  it('threshold constant is sane', () => {
    expect(PHASH_EXACT_THRESHOLD).toBeGreaterThan(0);
    expect(PHASH_EXACT_THRESHOLD).toBeLessThan(32);
  });
});

describe('dhashFromLuminance (shared client hash logic)', () => {
  const size = DHASH_W * DHASH_H;

  it('produces a 16-hex-char hash', () => {
    const lum = Array.from({ length: size }, (_, i) => i % 9);
    const hash = dhashFromLuminance(lum);
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic', () => {
    const lum = Array.from({ length: size }, (_, i) => (i * 37) % 251);
    expect(dhashFromLuminance(lum)).toBe(dhashFromLuminance(lum));
  });

  it('all-increasing rows produce all 1 bits', () => {
    const lum = [];
    for (let y = 0; y < DHASH_H; y++) for (let x = 0; x < DHASH_W; x++) lum.push(x);
    expect(dhashFromLuminance(lum)).toBe('ffffffffffffffff');
  });

  it('flat image produces all 0 bits', () => {
    const lum = new Array(size).fill(128);
    expect(dhashFromLuminance(lum)).toBe('0000000000000000');
  });

  it('small luminance noise stays within the exact-match threshold', () => {
    const base = Array.from({ length: size }, (_, i) => (i * 53) % 200);
    const noisy = base.map((v) => v + (Math.sin(v) * 0.4)); // sub-quantization jitter
    const d = hammingHex(dhashFromLuminance(base), dhashFromLuminance(noisy));
    expect(d).toBeLessThanOrEqual(PHASH_EXACT_THRESHOLD);
  });
});
