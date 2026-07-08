import { json, errorResponse } from '../index.js';
import { extractAttributes } from '../vision.js';
import { listOwnedHashes } from '../db.js';
import { hammingHex, PHASH_EXACT_THRESHOLD } from '../verdict.js';

// POST /api/identify — analysis only, persists nothing. The client holds the
// image and extracted attributes and only saves on an explicit "Add".
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

  // Layer 1: perceptual hash vs every owned pin. Runs alongside (before) the
  // vision call — a near-identical hash means "you almost certainly own this
  // exact pin" regardless of what the model says.
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

  return json({ attributes, phash_matches: phashMatches });
}
