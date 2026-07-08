// Client-side demo mode. Lets anyone sample the full UI on the static site
// with no backend: a flag (URL "#demo" or sessionStorage) routes every api()
// call to an in-memory fake API seeded with sample pins. Sample photos are
// inline SVG data URIs; pins you add during the demo use your real captured
// photo (its base64 becomes a data: URL). Everything resets on reload.

const FLAG = 'pinvault_demo';

let store = null;
let counter = 0;

export function isDemo() {
  return sessionStorage.getItem(FLAG) === '1';
}

export function enterDemo() {
  sessionStorage.setItem(FLAG, '1');
  seed();
}

export function exitDemo() {
  sessionStorage.removeItem(FLAG);
  store = null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- sample imagery -------------------------------------------------------

function initials(chars) {
  const name = (chars[0] || 'Pin').trim();
  const parts = name.split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

// XML-escape text placed inside the inline SVG — an unescaped & or < makes the
// SVG invalid and the image fails to render.
function xmlEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function svgThumb(chars, franchise, bg, fg) {
  const label = xmlEsc(initials(chars));
  const sub = xmlEsc((franchise || '').slice(0, 22));
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'>` +
    `<rect width='300' height='300' fill='${bg}'/>` +
    `<circle cx='150' cy='132' r='92' fill='${fg}' opacity='0.22'/>` +
    `<text x='150' y='140' font-family='Helvetica,Arial,sans-serif' font-size='104' ` +
    `font-weight='700' fill='${fg}' text-anchor='middle' dominant-baseline='central'>${label}</text>` +
    `<text x='150' y='250' font-family='Helvetica,Arial,sans-serif' font-size='24' ` +
    `fill='${fg}' opacity='0.85' text-anchor='middle'>${sub}</text>` +
    `</svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// --- seed data ------------------------------------------------------------

function makePin(p) {
  const img = svgThumb(p.characters, p.franchise, p.bg, p.fg);
  return {
    id: `demo-${++counter}`,
    status: p.status || 'owned',
    characters: p.characters,
    franchise: p.franchise,
    maker: p.maker,
    pose_description: p.pose_description,
    pin_shape: p.pin_shape,
    dominant_colors: p.dominant_colors,
    text_on_pin: p.text_on_pin ?? null,
    series_or_event: p.series_or_event ?? null,
    le_size: p.le_size ?? null,
    canonical_description: p.canonical_description,
    phash: p.phash || '',
    notes: p.notes ?? null,
    added_at: p.added_at,
    removed_at: p.removed_at ?? null,
    thumb_url: img,
    photo_url: img,
  };
}

function seed() {
  counter = 0;
  store = [
    makePin({
      characters: ['Stitch'], franchise: 'Lilo & Stitch', maker: 'Disney Parks / OE',
      pose_description: 'Stitch sitting, holding a melting ice cream cone, tongue out',
      pin_shape: 'circular', dominant_colors: ['blue', 'teal', 'white'],
      series_or_event: 'Pin of the Month', le_size: 3000,
      canonical_description: 'Stitch sitting holding an ice cream cone circular pin from Lilo & Stitch, blue tones',
      added_at: '2026-05-02T14:00:00Z', bg: '#123a4a', fg: '#57c7e0', phash: 'a1b2c3d4e5f60718',
    }),
    makePin({
      characters: ['Stitch'], franchise: 'Lilo & Stitch', maker: 'Loungefly',
      pose_description: 'Stitch surfing on a yellow surfboard, arms out',
      pin_shape: 'character silhouette', dominant_colors: ['blue', 'yellow', 'aqua'],
      canonical_description: 'Stitch surfing on a surfboard silhouette pin from Lilo & Stitch, blue and yellow tones',
      added_at: '2026-05-10T14:00:00Z', bg: '#16495a', fg: '#ffd23f', phash: 'b1c2d3e4f5061728',
    }),
    makePin({
      characters: ['Mickey Mouse'], franchise: 'Mickey & Friends', maker: 'Disney Parks / OE',
      pose_description: 'Mickey waving, big smile',
      pin_shape: 'circular', dominant_colors: ['red', 'black', 'white'],
      text_on_pin: 'Walt Disney World',
      canonical_description: 'Mickey Mouse waving circular pin from Mickey & Friends, red and black tones',
      added_at: '2026-04-18T14:00:00Z', bg: '#3a1214', fg: '#e94560',
    }),
    makePin({
      characters: ['Maleficent'], franchise: 'Sleeping Beauty', maker: 'WDI',
      pose_description: 'Maleficent raising her staff, green flame',
      pin_shape: 'character silhouette', dominant_colors: ['purple', 'green', 'black'],
      series_or_event: 'Villains', le_size: 500,
      canonical_description: 'Maleficent raising her staff silhouette pin from Sleeping Beauty, purple and green tones',
      added_at: '2026-03-30T14:00:00Z', bg: '#2a1440', fg: '#7bd88f',
    }),
    makePin({
      characters: ['Jack Skellington'], franchise: 'The Nightmare Before Christmas', maker: 'Loungefly',
      pose_description: 'Jack grinning with arms spread',
      pin_shape: 'character silhouette', dominant_colors: ['black', 'white', 'grey'],
      canonical_description: 'Jack Skellington grinning silhouette pin from The Nightmare Before Christmas, black and white tones',
      added_at: '2026-05-20T14:00:00Z', bg: '#1a1a1a', fg: '#e8e8e8',
    }),
    makePin({
      characters: ['Cinderella Castle'], franchise: 'Disney Parks', maker: 'Disney Parks / OE',
      pose_description: 'Cinderella Castle with fireworks behind',
      pin_shape: 'castle silhouette', dominant_colors: ['blue', 'gold', 'pink'],
      series_or_event: 'Park Icons',
      canonical_description: 'Cinderella Castle with fireworks silhouette pin from Disney Parks, blue and gold tones',
      added_at: '2026-02-14T14:00:00Z', bg: '#141c3a', fg: '#f0b64b',
    }),
    makePin({
      characters: ['Baymax'], franchise: 'Big Hero 6', maker: 'BoxLunch exclusive',
      pose_description: 'Baymax giving a hug, tilted head',
      pin_shape: 'circular', dominant_colors: ['white', 'red', 'grey'],
      canonical_description: 'Baymax giving a hug circular pin from Big Hero 6, white and red tones',
      added_at: '2026-01-08T14:00:00Z', removed_at: '2026-06-01T14:00:00Z', status: 'removed',
      bg: '#2b2b2b', fg: '#f5f5f5',
    }),
  ];
}

function ensureSeeded() {
  if (!store) seed();
}

// --- fake API -------------------------------------------------------------

const EDITABLE = [
  'characters', 'dominant_colors', 'franchise', 'maker', 'pose_description',
  'pin_shape', 'text_on_pin', 'series_or_event', 'le_size', 'canonical_description', 'notes',
];

function coerce(key, value) {
  if (key === 'characters' || key === 'dominant_colors') {
    return Array.isArray(value) ? value.filter(Boolean) : [];
  }
  if (key === 'le_size') {
    if (value === '' || value === null || value === undefined) return null;
    const n = Number(value);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  return value === '' || value === undefined ? null : value;
}

function nowIso() {
  return new Date().toISOString();
}

export async function demoApi(path, { method = 'GET', body } = {}) {
  ensureSeeded();
  await delay(160); // a touch of latency so the UI's loading states show

  const url = new URL(path, 'https://demo.local');
  const p = url.pathname;
  const sp = url.searchParams;

  if (p === '/api/pins' && method === 'GET') {
    const status = sp.get('status') || 'owned';
    const pins = store.filter((x) => status === 'all' || x.status === status);
    return { pins: pins.map((x) => ({ ...x })) };
  }

  if (p === '/api/pins' && method === 'POST') {
    const pin = {
      id: `demo-${++counter}`,
      status: 'owned',
      characters: coerce('characters', body.characters),
      dominant_colors: coerce('dominant_colors', body.dominant_colors),
      franchise: coerce('franchise', body.franchise),
      maker: coerce('maker', body.maker),
      pose_description: coerce('pose_description', body.pose_description),
      pin_shape: coerce('pin_shape', body.pin_shape),
      text_on_pin: coerce('text_on_pin', body.text_on_pin),
      series_or_event: coerce('series_or_event', body.series_or_event),
      le_size: coerce('le_size', body.le_size),
      canonical_description: body.canonical_description || '',
      phash: body.phash || '',
      notes: coerce('notes', body.notes),
      added_at: nowIso(),
      removed_at: null,
      thumb_url: body.thumb_b64 ? `data:image/jpeg;base64,${body.thumb_b64}` : svgThumb(body.characters || [], body.franchise, '#2a2a42', '#e94560'),
      photo_url: body.photo_b64 ? `data:image/jpeg;base64,${body.photo_b64}` : svgThumb(body.characters || [], body.franchise, '#2a2a42', '#e94560'),
    };
    store.unshift(pin);
    return { pin: { ...pin } };
  }

  const m = p.match(/^\/api\/pins\/([^/]+)$/);
  if (m) {
    const pin = store.find((x) => x.id === m[1]);
    if (!pin) throw new Error('Pin not found');

    if (method === 'GET') return { pin: { ...pin } };

    if (method === 'PATCH') {
      for (const k of EDITABLE) {
        if (k in body) pin[k] = coerce(k, body[k]);
      }
      if ('status' in body) {
        if (body.status === 'removed') { pin.status = 'removed'; pin.removed_at = nowIso(); }
        else if (body.status === 'owned') { pin.status = 'owned'; pin.removed_at = null; }
      }
      return { pin: { ...pin } };
    }

    if (method === 'DELETE') {
      if (sp.get('hard') === 'true') {
        store = store.filter((x) => x.id !== pin.id);
        return { deleted: pin.id, hard: true };
      }
      pin.status = 'removed';
      pin.removed_at = nowIso();
      return { pin: { ...pin } };
    }
  }

  if (p === '/api/identify' && method === 'POST') {
    // No real vision model in the demo — return a canned Stitch verdict against
    // whatever Stitch pins are still owned, so the verdict card renders fully.
    const attributes = {
      characters: ['Stitch'], franchise: 'Lilo & Stitch', maker: 'unknown',
      pose_description: 'Stitch on a beach holding a shell', pin_shape: 'circular',
      dominant_colors: ['blue', 'sand', 'aqua'], text_on_pin: null, series_or_event: null,
      le_size: null,
      canonical_description: 'Stitch on a beach holding a shell circular pin from Lilo & Stitch, blue tones',
    };
    const matches = store.filter((x) => x.status === 'owned' && x.characters.some((c) => c.toLowerCase() === 'stitch'));
    const layers = ['same_character_same_pose', 'same_character'];
    const candidates = matches.map((pin, i) => ({
      pin_id: pin.id,
      layer: layers[i] || 'same_character',
      similarity: 0.86 - i * 0.09,
      phash_distance: null,
      thumb_url: pin.thumb_url,
      metadata: {
        characters: pin.characters, franchise: pin.franchise, maker: pin.maker,
        pose_description: pin.pose_description, series_or_event: pin.series_or_event,
        canonical_description: pin.canonical_description,
      },
    }));
    return {
      verdict: candidates.length ? 'same_character_same_pose' : 'not_in_collection',
      certain: false,
      attributes,
      phash: body.phash || '',
      candidates,
    };
  }

  throw new Error('Demo: this action needs the live backend');
}
