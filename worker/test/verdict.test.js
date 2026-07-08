import { describe, it, expect } from 'vitest';
import {
  rankCandidates,
  charactersOverlap,
  COSINE_EXACT_THRESHOLD,
  COSINE_POSE_THRESHOLD,
} from '../src/verdict.js';

const stitchQuery = {
  characters: ['Stitch'],
  pin_shape: 'circular',
  canonical_description: 'Stitch sitting with ice cream circular pin',
};

function pin(id, overrides = {}) {
  return {
    id,
    characters: ['Stitch'],
    pin_shape: 'circular',
    franchise: 'Lilo & Stitch',
    status: 'owned',
    ...overrides,
  };
}

describe('charactersOverlap', () => {
  it('matches case-insensitively', () => {
    expect(charactersOverlap(['Stitch'], ['stitch', 'Angel'])).toBe(true);
  });
  it('no overlap → false', () => {
    expect(charactersOverlap(['Stitch'], ['Mickey Mouse'])).toBe(false);
    expect(charactersOverlap([], [])).toBe(false);
  });
});

describe('rankCandidates', () => {
  it('empty inputs → not in collection', () => {
    const r = rankCandidates(stitchQuery, [], []);
    expect(r.verdict).toBe('not_in_collection');
    expect(r.certain).toBe(false);
    expect(r.candidates).toEqual([]);
  });

  it('pHash hit → certain exact match ranked first', () => {
    const r = rankCandidates(
      stitchQuery,
      [{ id: 'a', distance: 3 }],
      [
        { pin: pin('a'), score: 0.85 },
        { pin: pin('b'), score: 0.95 },
      ]
    );
    expect(r.verdict).toBe('exact_match');
    expect(r.certain).toBe(true);
    expect(r.candidates[0].pin.id).toBe('a');
    expect(r.candidates[0].layer).toBe('exact_match');
  });

  it('high cosine + character + shape → exact match but NOT certain', () => {
    const r = rankCandidates(stitchQuery, [], [
      { pin: pin('a'), score: COSINE_EXACT_THRESHOLD + 0.01 },
    ]);
    expect(r.verdict).toBe('exact_match');
    expect(r.certain).toBe(false);
  });

  it('high cosine without character overlap is NOT exact', () => {
    const r = rankCandidates(stitchQuery, [], [
      { pin: pin('a', { characters: ['Mickey Mouse'] }), score: 0.97 },
    ]);
    expect(r.verdict).toBe('similar_only');
    expect(r.candidates[0].layer).toBe('similar');
  });

  it('high cosine + character but different shape → same_character_same_pose', () => {
    const r = rankCandidates(stitchQuery, [], [
      { pin: pin('a', { pin_shape: 'heart' }), score: 0.95 },
    ]);
    expect(r.candidates[0].layer).toBe('same_character_same_pose');
  });

  it('character overlap with mid cosine → same_character_same_pose; low cosine → same_character', () => {
    const r = rankCandidates(stitchQuery, [], [
      { pin: pin('mid'), score: COSINE_POSE_THRESHOLD + 0.02 },
      { pin: pin('low'), score: COSINE_POSE_THRESHOLD - 0.2 },
    ]);
    const byId = Object.fromEntries(r.candidates.map((c) => [c.pin.id, c.layer]));
    expect(byId.mid).toBe('same_character_same_pose');
    expect(byId.low).toBe('same_character');
    expect(r.verdict).toBe('same_character_same_pose');
  });

  it('orders layers exact > pose > character > similar', () => {
    const r = rankCandidates(stitchQuery, [{ id: 'exact', distance: 5 }], [
      { pin: pin('similar', { characters: ['Mickey Mouse'] }), score: 0.99 },
      { pin: pin('char', {}), score: 0.5 },
      { pin: pin('pose', {}), score: 0.85 },
      { pin: pin('exact', {}), score: 0.7 },
    ]);
    expect(r.candidates.map((c) => c.pin.id)).toEqual(['exact', 'pose', 'char', 'similar']);
  });

  it('multiple pHash hits sort by distance', () => {
    const r = rankCandidates(
      stitchQuery,
      [
        { id: 'far', distance: 9 },
        { id: 'near', distance: 1 },
      ],
      [
        { pin: pin('far'), score: 0.8 },
        { pin: pin('near'), score: 0.8 },
      ]
    );
    expect(r.candidates[0].pin.id).toBe('near');
    expect(r.candidates[1].pin.id).toBe('far');
  });

  it('null vector scores (pHash-only candidates) never beat scored exacts within the layer', () => {
    const r = rankCandidates(
      stitchQuery,
      [{ id: 'a', distance: 2 }],
      [{ pin: pin('a'), score: null }]
    );
    expect(r.verdict).toBe('exact_match');
    expect(r.certain).toBe(true);
    expect(r.candidates[0].phash_distance).toBe(2);
  });
});
