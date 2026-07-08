// D1 access layer. All queries are parameterized; JSON-array columns
// (characters, dominant_colors) are (de)serialized here so the rest of the
// Worker only ever sees plain objects.

const PIN_COLUMNS = `id, status, characters, franchise, maker, pose_description,
  pin_shape, dominant_colors, text_on_pin, series_or_event, le_size,
  canonical_description, phash, photo_key, thumb_key, vector_id, added_at,
  removed_at, notes`;

function parseJsonArray(text) {
  if (text === null || text === undefined || text === '') return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rowToPin(row) {
  if (!row) return null;
  return {
    ...row,
    characters: parseJsonArray(row.characters),
    dominant_colors: parseJsonArray(row.dominant_colors),
    // le_size stays as-is: 0 is a legal value, so no truthiness games —
    // D1 returns NULL as null and integers as numbers.
    le_size: row.le_size === null || row.le_size === undefined ? null : row.le_size,
  };
}

// Fields a client may set on create/update, with normalizers.
const STRING_FIELDS = [
  'franchise', 'maker', 'pose_description', 'pin_shape', 'text_on_pin',
  'series_or_event', 'canonical_description', 'notes',
];

export function normalizeAttributes(input = {}) {
  const out = {};
  if (Array.isArray(input.characters)) {
    out.characters = input.characters.map((c) => String(c).trim()).filter(Boolean);
  }
  if (Array.isArray(input.dominant_colors)) {
    out.dominant_colors = input.dominant_colors.map((c) => String(c).trim()).filter(Boolean);
  }
  for (const field of STRING_FIELDS) {
    if (field in input) {
      const v = input[field];
      out[field] = v === null || v === undefined || v === '' ? null : String(v).trim();
    }
  }
  if ('le_size' in input) {
    if (input.le_size === null || input.le_size === undefined || input.le_size === '') {
      out.le_size = null;
    } else {
      const n = Number(input.le_size);
      out.le_size = Number.isFinite(n) ? Math.trunc(n) : null;
    }
  }
  return out;
}

export async function insertPin(db, pin) {
  await db
    .prepare(
      `INSERT INTO pins (id, status, characters, franchise, maker, pose_description,
        pin_shape, dominant_colors, text_on_pin, series_or_event, le_size,
        canonical_description, phash, photo_key, thumb_key, vector_id, added_at,
        removed_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      pin.id,
      pin.status,
      JSON.stringify(pin.characters ?? []),
      pin.franchise ?? null,
      pin.maker ?? null,
      pin.pose_description ?? null,
      pin.pin_shape ?? null,
      JSON.stringify(pin.dominant_colors ?? []),
      pin.text_on_pin ?? null,
      pin.series_or_event ?? null,
      pin.le_size === null || pin.le_size === undefined ? null : pin.le_size,
      pin.canonical_description,
      pin.phash,
      pin.photo_key,
      pin.thumb_key,
      pin.vector_id,
      pin.added_at,
      pin.removed_at ?? null,
      pin.notes ?? null
    )
    .run();
}

export async function getPin(db, id) {
  const row = await db.prepare(`SELECT ${PIN_COLUMNS} FROM pins WHERE id = ?`).bind(id).first();
  return rowToPin(row);
}

export async function deletePinRow(db, id) {
  await db.prepare('DELETE FROM pins WHERE id = ?').bind(id).run();
}

export async function updatePin(db, id, fields) {
  const sets = [];
  const binds = [];
  const push = (col, val) => {
    sets.push(`${col} = ?`);
    binds.push(val);
  };

  if ('characters' in fields) push('characters', JSON.stringify(fields.characters ?? []));
  if ('dominant_colors' in fields) push('dominant_colors', JSON.stringify(fields.dominant_colors ?? []));
  for (const f of STRING_FIELDS) {
    if (f in fields) push(f, fields[f]);
  }
  if ('le_size' in fields) push('le_size', fields.le_size);
  if ('status' in fields) push('status', fields.status);
  if ('removed_at' in fields) push('removed_at', fields.removed_at);
  if ('phash' in fields) push('phash', fields.phash);

  if (sets.length === 0) return;
  binds.push(id);
  await db.prepare(`UPDATE pins SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run();
}

export async function listPins(db, { status = 'owned', character, franchise, maker, series, q } = {}) {
  const where = [];
  const binds = [];

  if (status && status !== 'all') {
    where.push('status = ?');
    binds.push(status);
  }
  if (character) {
    // characters is a JSON array of strings; match the quoted value inside it.
    where.push('characters LIKE ? COLLATE NOCASE');
    binds.push(`%"${character}"%`);
  }
  if (franchise) {
    where.push('franchise = ? COLLATE NOCASE');
    binds.push(franchise);
  }
  if (maker) {
    where.push('maker = ? COLLATE NOCASE');
    binds.push(maker);
  }
  if (series) {
    where.push('series_or_event = ? COLLATE NOCASE');
    binds.push(series);
  }
  if (q) {
    const like = `%${q}%`;
    where.push(`(characters LIKE ? COLLATE NOCASE
      OR franchise LIKE ? COLLATE NOCASE
      OR maker LIKE ? COLLATE NOCASE
      OR pose_description LIKE ? COLLATE NOCASE
      OR pin_shape LIKE ? COLLATE NOCASE
      OR text_on_pin LIKE ? COLLATE NOCASE
      OR series_or_event LIKE ? COLLATE NOCASE
      OR canonical_description LIKE ? COLLATE NOCASE
      OR notes LIKE ? COLLATE NOCASE)`);
    for (let i = 0; i < 9; i++) binds.push(like);
  }

  const sql = `SELECT ${PIN_COLUMNS} FROM pins
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY added_at DESC`;
  const { results } = await db.prepare(sql).bind(...binds).all();
  return results.map(rowToPin);
}

// Used by the identify pipeline's pHash layer: every owned pin's hash.
export async function listOwnedHashes(db) {
  const { results } = await db
    .prepare(`SELECT id, phash FROM pins WHERE status = 'owned' AND phash != ''`)
    .all();
  return results;
}

// Fetch a batch of pins by id (identify pipeline joins Vectorize matches).
export async function getPinsByIds(db, ids) {
  if (!ids.length) return [];
  const placeholders = ids.map(() => '?').join(', ');
  const { results } = await db
    .prepare(`SELECT ${PIN_COLUMNS} FROM pins WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all();
  return results.map(rowToPin);
}
