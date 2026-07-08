import { json, errorResponse } from '../index.js';
import { extractAttributes } from '../vision.js';

// POST /api/identify — analysis only, persists nothing. The client holds the
// image and extracted attributes and only saves on an explicit "Add".
// Later phases add the pHash and embedding-similarity layers.
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

  let attributes;
  try {
    attributes = await extractAttributes(env, body.photo_b64);
  } catch (err) {
    console.error('Vision extraction failed:', err.stack || err);
    return errorResponse(err.message || 'Vision extraction failed', 502);
  }

  return json({ attributes });
}
