import { errorResponse } from '../index.js';
import { verifyPhotoSig } from '../auth.js';

// GET /api/photo/:key?exp=...&sig=...
// <img> tags can't send an Authorization header, so photo fetches are
// authorized by an HMAC signature over `key|exp` (issued by the API when it
// returns pin data).
export async function handlePhoto(key, searchParams, env) {
  const exp = searchParams.get('exp');
  const sig = searchParams.get('sig');
  if (!exp || !sig || !(await verifyPhotoSig(key, exp, sig, env.SESSION_SECRET))) {
    return errorResponse('Invalid or expired photo signature', 403);
  }

  const object = await env.PHOTOS.get(key);
  if (!object) return errorResponse('Photo not found', 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
      ETag: object.httpEtag,
    },
  });
}
