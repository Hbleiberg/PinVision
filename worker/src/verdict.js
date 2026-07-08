// Matching thresholds and verdict ranking. Pure functions — unit-tested and
// tunable in one place (see scripts/seed.md for the calibration protocol).

// Hamming distance (out of 64) at or below which two dHashes are treated as
// the same physical pin design.
export const PHASH_EXACT_THRESHOLD = 10;

// Cosine similarity at or above which (plus matching attributes) a candidate
// counts as the same pin even without a pHash hit.
export const COSINE_EXACT_THRESHOLD = 0.92;

// Cosine similarity at or above which a shared-character candidate counts as
// "same character, same pose".
export const COSINE_POSE_THRESHOLD = 0.8;

const POPCOUNT = new Uint8Array(16);
for (let i = 0; i < 16; i++) {
  POPCOUNT[i] = (i & 1) + ((i >> 1) & 1) + ((i >> 2) & 1) + ((i >> 3) & 1);
}

// Hamming distance between two hex-encoded hashes. Returns Infinity for
// malformed/mismatched input so bad data never masquerades as a match.
export function hammingHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || !a || a.length !== b.length) {
    return Infinity;
  }
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    const na = parseInt(a[i], 16);
    const nb = parseInt(b[i], 16);
    if (Number.isNaN(na) || Number.isNaN(nb)) return Infinity;
    dist += POPCOUNT[na ^ nb];
  }
  return dist;
}

function normalizeName(name) {
  return String(name).trim().toLowerCase();
}

export function charactersOverlap(a = [], b = []) {
  const setA = new Set(a.map(normalizeName));
  return b.some((name) => setA.has(normalizeName(name)));
}

function sameShape(a, b) {
  return Boolean(a && b) && normalizeName(a) === normalizeName(b);
}

// Combine the layers into a ranked candidate list plus an overall verdict.
//
//   queryAttrs    – attributes extracted from the photographed pin
//   phashMatches  – [{ id, distance }] pins within PHASH_EXACT_THRESHOLD
//   vectorMatches – [{ pin, score }] owned pins from the Vectorize query
//
// Layers (best first): exact_match > same_character_same_pose >
// same_character > similar. Only a pHash hit is ever "certain".
export function rankCandidates(queryAttrs, phashMatches, vectorMatches) {
  const phashById = new Map(phashMatches.map((m) => [m.id, m.distance]));
  const candidates = new Map(); // id -> candidate

  for (const { pin, score } of vectorMatches) {
    const overlap = charactersOverlap(queryAttrs.characters, pin.characters);
    let layer = 'similar';
    if (phashById.has(pin.id)) {
      layer = 'exact_match';
    } else if (score >= COSINE_EXACT_THRESHOLD && overlap && sameShape(queryAttrs.pin_shape, pin.pin_shape)) {
      layer = 'exact_match';
    } else if (overlap && score >= COSINE_POSE_THRESHOLD) {
      layer = 'same_character_same_pose';
    } else if (overlap) {
      layer = 'same_character';
    }
    candidates.set(pin.id, {
      pin,
      similarity: score,
      layer,
      phash_distance: phashById.has(pin.id) ? phashById.get(pin.id) : null,
    });
  }

  // pHash hits that the vector query didn't surface still rank first.
  for (const { id, distance } of phashMatches) {
    if (!candidates.has(id)) {
      candidates.set(id, { pin: null, pinId: id, similarity: null, layer: 'exact_match', phash_distance: distance });
    }
  }

  const LAYER_ORDER = { exact_match: 0, same_character_same_pose: 1, same_character: 2, similar: 3 };
  const ranked = [...candidates.values()].sort((a, b) => {
    const byLayer = LAYER_ORDER[a.layer] - LAYER_ORDER[b.layer];
    if (byLayer !== 0) return byLayer;
    if (a.phash_distance !== null && b.phash_distance !== null) {
      return a.phash_distance - b.phash_distance;
    }
    if (a.phash_distance !== null) return -1;
    if (b.phash_distance !== null) return 1;
    return (b.similarity ?? 0) - (a.similarity ?? 0);
  });

  // Overall verdict. `certain` is reserved for the pHash layer.
  let verdict = 'not_in_collection';
  let certain = false;
  if (ranked.length) {
    const top = ranked[0];
    if (top.layer === 'exact_match') {
      verdict = 'exact_match';
      certain = top.phash_distance !== null;
    } else if (top.layer === 'same_character_same_pose') {
      verdict = 'same_character_same_pose';
    } else if (top.layer === 'same_character') {
      verdict = 'same_character';
    } else {
      verdict = 'similar_only';
    }
  }

  return { verdict, certain, candidates: ranked };
}
