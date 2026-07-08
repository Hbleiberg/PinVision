import { describe, it, expect } from 'vitest';
import { safeParse } from '../src/safeParse.js';

describe('safeParse', () => {
  it('parses clean JSON', () => {
    expect(safeParse('{"a": 1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences', () => {
    expect(safeParse('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('strips bare ``` fences', () => {
    expect(safeParse('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('recovers JSON wrapped in prose', () => {
    expect(safeParse('Here is the result:\n{"a": {"b": 2}}\nHope that helps!')).toEqual({ a: { b: 2 } });
  });

  it('returns null for garbage', () => {
    expect(safeParse('not json at all')).toBe(null);
    expect(safeParse('')).toBe(null);
    expect(safeParse(null)).toBe(null);
    expect(safeParse(undefined)).toBe(null);
  });

  it('returns null for truncated JSON', () => {
    expect(safeParse('{"a": 1, "b":')).toBe(null);
  });
});
