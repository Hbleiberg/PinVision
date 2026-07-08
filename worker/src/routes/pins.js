import { json, errorResponse } from '../index.js';
import {
  listPins,
  getPin,
  insertPin,
  updatePin,
  deletePinRow,
  normalizeAttributes,
} from '../db.js';

export async function handlePinsList(searchParams, env) {
  const pins = await listPins(env.DB, {
    status: searchParams.get('status') || 'owned',
    character: searchParams.get('character') || undefined,
    franchise: searchParams.get('franchise') || undefined,
    maker: searchParams.get('maker') || undefined,
    series: searchParams.get('series') || undefined,
    q: searchParams.get('q') || undefined,
  });
  return json({ pins });
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

  const id = crypto.randomUUID();
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
    photo_key: '',
    thumb_key: '',
    vector_id: id,
    added_at: new Date().toISOString(),
    removed_at: null,
  };

  await insertPin(env.DB, pin);
  return json({ pin }, 201);
}

export async function handlePinGet(id, env) {
  const pin = await getPin(env.DB, id);
  if (!pin) return errorResponse('Pin not found', 404);
  return json({ pin });
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
  return json({ pin });
}

export async function handlePinDelete(id, searchParams, env) {
  const existing = await getPin(env.DB, id);
  if (!existing) return errorResponse('Pin not found', 404);

  if (searchParams.get('hard') === 'true') {
    await deletePinRow(env.DB, id);
    return json({ deleted: id, hard: true });
  }

  await updatePin(env.DB, id, { status: 'removed', removed_at: new Date().toISOString() });
  const pin = await getPin(env.DB, id);
  return json({ pin });
}
