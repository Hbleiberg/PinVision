import { describe, it, expect } from 'vitest';
import { rowToPin, normalizeAttributes } from '../src/db.js';

describe('rowToPin', () => {
  it('parses JSON array columns', () => {
    const pin = rowToPin({
      id: 'x',
      characters: '["Stitch","Angel"]',
      dominant_colors: '["blue","pink"]',
      le_size: null,
    });
    expect(pin.characters).toEqual(['Stitch', 'Angel']);
    expect(pin.dominant_colors).toEqual(['blue', 'pink']);
  });

  it('tolerates malformed JSON in array columns', () => {
    const pin = rowToPin({ id: 'x', characters: 'not json', dominant_colors: null, le_size: null });
    expect(pin.characters).toEqual([]);
    expect(pin.dominant_colors).toEqual([]);
  });

  it('preserves le_size of 0 (never conflated with null)', () => {
    expect(rowToPin({ id: 'x', characters: '[]', dominant_colors: '[]', le_size: 0 }).le_size).toBe(0);
    expect(rowToPin({ id: 'x', characters: '[]', dominant_colors: '[]', le_size: null }).le_size).toBe(null);
  });

  it('returns null for a missing row', () => {
    expect(rowToPin(null)).toBe(null);
  });
});

describe('normalizeAttributes', () => {
  it('trims and drops empty character entries', () => {
    const out = normalizeAttributes({ characters: [' Stitch ', '', 42] });
    expect(out.characters).toEqual(['Stitch', '42']);
  });

  it('normalizes empty strings to null for text fields', () => {
    const out = normalizeAttributes({ franchise: '', maker: '  Loungefly ' });
    expect(out.franchise).toBe(null);
    expect(out.maker).toBe('Loungefly');
  });

  it('keeps le_size 0, coerces numerics, nulls junk', () => {
    expect(normalizeAttributes({ le_size: 0 }).le_size).toBe(0);
    expect(normalizeAttributes({ le_size: '3000' }).le_size).toBe(3000);
    expect(normalizeAttributes({ le_size: 'unknown' }).le_size).toBe(null);
    expect(normalizeAttributes({ le_size: null }).le_size).toBe(null);
  });

  it('omits fields that were not provided', () => {
    const out = normalizeAttributes({ franchise: 'Lilo & Stitch' });
    expect('le_size' in out).toBe(false);
    expect('characters' in out).toBe(false);
  });
});
