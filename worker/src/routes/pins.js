import { json, errorResponse } from '../index.js';
import { signPhotoPath } from '../auth.js';
import {
  listPins,
  getPin,
  insertPin,
  updatePin,
  deletePinRow,
  normalizeAttributes,
} from '../db.js';

function b64ToBytes(b64) {
  // Tolerate data-URL prefixes from the client.
  const clean = b64.replace(/^data:[^,]*,/, '');
  const bin = atob(clean);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

// Add signed photo URLs to a pin object before returning it to the client.
export async function withPhotoUrls(pin, env) {
  if (!pin) return pin;
  return {
    ...pin,
    photo_url: pin.photo_key ? await signPhotoPath(pin.photo_key, env.SESSION_SECRET) : null,
    thumb_url: pin.thumb_key ? await signPhotoPath(pin.thumb_key, env.SESSION_SECRET) : null,
  };
}

export async function handlePinsList(searchParams, env) {
  const pins = await listPins(env.DB, {
    status: searchParams.get('status') || 'owned',
    character: searchParams.get('character') || undefined,
    franchise: searchParams.get('franchise') || undefined,
    maker: searchParams.get('maker') || undefined,
    series: searchParams.get('series') || undefined,
    q: searchParams.get('q') || undefined,
  });
  return json({ pins: await Promise.all(pins.map((p) => withPhotoUrls(p, env))) });
}

export async function handlePinCreate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const attrs = normalizeAttributes(body);
  if (!attrs.canonical_description) {
    return errorResponse('canonical_description is required', 400);
  }
  if (typeof body.photo_b64 !== 'string' || typeof body.thumb_b64 !== 'string') {
    return errorResponse('photo_b64 and thumb_b64 are required', 400);
  }

  let photoBytes, thumbBytes;
  try {
    photoBytes = b64ToBytes(body.photo_b64);
    thumbBytes = b64ToBytes(body.thumb_b64);
  } catch {
    return errorResponse('photo_b64/thumb_b64 must be valid base64', 400);
  }

  const id = crypto.randomUUID();
  const photoKey = `photo/${id}.jpg`;
  const thumbKey = `thumb/${id}.jpg`;
  const pin = {
    id,
    status: 'owned',
    characters: attrs.characters ?? [],
    dominant_colors: attrs.dominant_colors ?? [],
    franchise: attrs.franchise ?? null,
    maker: attrs.maker ?? null,
    pose_description: attrs.pose_description ?? null,
    pin_shape: attrs.pin_shape ?? null,
    text_on_pin: attrs.text_on_pin ?? null,
    series_or_event: attrs.series_or_event ?? null,
    le_size: 'le_size' in attrs ? attrs.le_size : null,
    canonical_description: attrs.canonical_description,
    notes: attrs.notes ?? null,
    phash: typeof body.phash === 'string' ? body.phash : '',
    photo_key: photoKey,
    thumb_key: thumbKey,
    vector_id: id,
    added_at: new Date().toISOString(),
    removed_at: null,
  };

  // Write order: R2 → D1 (→ Vectorize, added by the similarity phase). If a
  // later write fails, compensate for the earlier ones so no orphaned record
  // is ever left behind.
  const written = [];
  try {
    await env.PHOTOS.put(photoKey, photoBytes, { httpMetadata: { contentType: 'image/jpeg' } });
    written.push(photoKey);
    await env.PHOTOS.put(thumbKey, thumbBytes, { httpMetadata: { contentType: 'image/jpeg' } });
    written.push(thumbKey);
    await insertPin(env.DB, pin);
  } catch (err) {
    console.error('Pin create failed, rolling back:', err.stack || err);
    for (const key of written) {
      try {
        await env.PHOTOS.delete(key);
      } catch (cleanupErr) {
        console.error(`Rollback delete failed for ${key}:`, cleanupErr);
      }
    }
    try {
      await deletePinRow(env.DB, id);
    } catch { /* row may not exist; best-effort */ }
    return errorResponse('Failed to save pin — nothing was stored', 500);
  }

  return json({ pin: await withPhotoUrls(pin, env) }, 201);
}

export async function handlePinGet(id, env) {
  const pin = await getPin(env.DB, id);
  if (!pin) return errorResponse('Pin not found', 404);
  return json({ pin: await withPhotoUrls(pin, env) });
}

export async function handlePinPatch(id, request, env) {
  const existing = await getPin(env.DB, id);
  if (!existing) return errorResponse('Pin not found', 404);

  let body;
  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const fields = normalizeAttributes(body);

  if ('status' in body) {
    if (body.status === 'removed') {
      fields.status = 'removed';
      fields.removed_at = new Date().toISOString();
    } else if (body.status === 'owned') {
      fields.status = 'owned';
      fields.removed_at = null;
    } else {
      return errorResponse("status must be 'owned' or 'removed'", 400);
    }
  }

  await updatePin(env.DB, id, fields);
  const pin = await getPin(env.DB, id);
  return json({ pin: await withPhotoUrls(pin, env) });
}

export async function handlePinDelete(id, searchParams, env) {
  const existing = await getPin(env.DB, id);
  if (!existing) return errorResponse('Pin not found', 404);

  if (searchParams.get('hard') === 'true') {
    // Purge: photos first (idempotent), then the row.
    if (existing.photo_key) await env.PHOTOS.delete(existing.photo_key);
    if (existing.thumb_key) await env.PHOTOS.delete(existing.thumb_key);
    await deletePinRow(env.DB, id);
    return json({ deleted: id, hard: true });
  }

  await updatePin(env.DB, id, { status: 'removed', removed_at: new Date().toISOString() });
  const pin = await getPin(env.DB, id);
  return json({ pin: await withPhotoUrls(pin, env) });
}
