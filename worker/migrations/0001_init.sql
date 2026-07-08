-- Migration number: 0001
CREATE TABLE pins (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'owned', -- owned | removed
  characters TEXT NOT NULL,             -- JSON array of strings
  franchise TEXT,
  maker TEXT,
  pose_description TEXT,
  pin_shape TEXT,
  dominant_colors TEXT,                 -- JSON array of strings
  text_on_pin TEXT,
  series_or_event TEXT,
  le_size INTEGER,
  canonical_description TEXT NOT NULL,
  phash TEXT NOT NULL,                  -- 16-hex-char 64-bit dHash
  photo_key TEXT NOT NULL,              -- R2 key of the full photo
  thumb_key TEXT NOT NULL,              -- R2 key of the thumbnail
  vector_id TEXT NOT NULL,              -- Vectorize vector id (same as id)
  added_at TEXT NOT NULL,
  removed_at TEXT,
  notes TEXT
);

CREATE INDEX idx_pins_status ON pins (status);
CREATE INDEX idx_pins_franchise ON pins (franchise);
CREATE INDEX idx_pins_maker ON pins (maker);
