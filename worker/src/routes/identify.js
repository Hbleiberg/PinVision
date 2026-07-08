import { json, errorResponse } from '../index.js';
import { extractAttributes } from '../vision.js';
import { listOwnedHashes, getPinsByIds } from '../db.js';
import { querySimilarPins } from '../embeddings.js';
import { hammingHex, PHASH_EXACT_THRESHOLD, rankCandidates } from '../verdict.js';
import { withPhotoUrls } from './pins.js';

// POST /api/identify — analysis only, persists nothing. The client holds the
// image and extracted attributes and only saves on an explicit "Add".
//
// Layers:
//   1. pHash Hamming distance vs owned pins (only source of certainty)
//   2. Claude vision attribute extraction
//   3. canonical-description embedding similarity via Vectorize
// combined by rankCandidates() into a ranked verdict.
export async function handleIdentify(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  if (typeof body.photo_b64 !== 'string' || !body.photo_b64) {
    return errorResponse('photo_b64 is required', 400);
  }
  const queryHash = typeof body.phash === 'string' ? body.phash : '';

  // Layer 1: perceptual hash vs every owned pin.
  const phashMatches = [];
  if (queryHash) {
    const owned = await listOwnedHashes(env.DB);
    for (const { id, phash } of owned) {
      const distance = hammingHex(queryHash, phash);
      if (distance <= PHASH_EXACT_THRESHOLD) phashMatches.push({ id, distance });
    }
    phashMatches.sort((a, b) => a.distance - b.distance);
  }

  // Layer 2: Claude vision attribute extraction.
  let attributes;
  try {
    attributes = await extractAttributes(env, body.photo_b64);
  } catch (err) {
    console.error('Vision extraction failed:', err.stack || err);
    return errorResponse(err.message || 'Vision extraction failed', 502);
  }

  // Layer 3: embedding similarity. Vector ids are pin ids; ownership is
  // filtered by joining against D1 (removed pins keep their vectors).
  let vectorHits = [];
  if (attributes.canonical_description) {
    try {
      vectorHits = await querySimilarPins(env, attributes.canonical_description, 10);
    } catch (err) {
      // Degrade gracefully: pHash + attributes still produce a useful verdict.
      console.error('Vector query failed:', err.stack || err);
    }
  }

  const candidateIds = [...new Set([...vectorHits.map((v) => v.id), ...phashMatches.map((m) => m.id)])];
  const pins = await getPinsByIds(env.DB, candidateIds);
  const ownedById = new Map(pins.filter((p) => p.status === 'owned').map((p) => [p.id, p]));

  const scoreById = new Map(vectorHits.map((v) => [v.id, v.score]));
  const vectorMatches = [...ownedById.values()].map((pin) => ({
    pin,
    score: scoreById.has(pin.id) ? scoreById.get(pin.id) : null,
  }));
  const ownedPhashMatches = phashMatches.filter((m) => ownedById.has(m.id));

  const { verdict, certain, candidates } = rankCandidates(attributes, ownedPhashMatches, vectorMatches);

  const responseCandidates = await Promise.all(
    candidates
      .filter((c) => c.pin) // defensive: every ranked candidate should carry its pin
      .map(async (c) => {
        const pin = await withPhotoUrls(c.pin, env);
        return {
          pin_id: pin.id,
          layer: c.layer,
          similarity: c.similarity,
          phash_distance: c.phash_distance,
          thumb_url: pin.thumb_url,
          metadata: {
            characters: pin.characters,
            franchise: pin.franchise,
            maker: pin.maker,
            pose_description: pin.pose_description,
            series_or_event: pin.series_or_event,
            canonical_description: pin.canonical_description,
          },
        };
      })
  );

  return json({
    verdict,
    certain,
    attributes,
    phash: queryHash,
    candidates: responseCandidates,
  });
}
