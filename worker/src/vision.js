import Anthropic from '@anthropic-ai/sdk';
import { safeParse } from './safeParse.js';

export const VISION_MODEL = 'claude-sonnet-5';

export const MAKER_VOCABULARY = [
  'Disney Parks / OE',
  'Loungefly',
  'The Pink a la Mode',
  'WDI',
  'Disney Employee Center',
  'HKDL',
  'DLP',
  'Her Universe',
  'BoxLunch exclusive',
  'fantasy/unofficial',
  'unknown',
];

// Tune attribute extraction here without touching pipeline code.
export const VISION_PROMPT = `You are a Disney pin identification expert. Analyze the photo of a single
enamel/trading pin and extract its attributes.

Rules:
- Identify every distinct named character visible on the pin. Use official
  character names ("Stitch", not "blue alien"). If a character is ambiguous,
  give your best single guess.
- "franchise" is the film/show/property (e.g. "Lilo & Stitch", "The Nightmare
  Before Christmas", "Mickey & Friends"). Use "Disney Parks" for park-icon
  pins (castle, attractions, food) with no film tie-in.
- "maker": choose the most likely value from this vocabulary — Disney Parks /
  OE, Loungefly, The Pink a la Mode, WDI, Disney Employee Center, HKDL, DLP,
  Her Universe, BoxLunch exclusive, fantasy/unofficial, unknown. Look for
  back-stamp clues if the back is visible; otherwise infer from art style,
  and prefer "unknown" over guessing between official makers.
- "pose_description": one short phrase capturing what the character(s) are
  doing and their expression (e.g. "Stitch sitting, holding an ice cream cone,
  tongue out").
- "pin_shape": the silhouette/outline of the pin itself (e.g. "circular",
  "character silhouette", "rectangular banner", "heart").
- "dominant_colors": 3-5 plain color words, most prominent first.
- "text_on_pin": transcribe any visible text exactly; null if none.
- "series_or_event": named series or event if identifiable (e.g. "Pin of the
  Month", "EPCOT Food & Wine 2023", "Hidden Mickey"); null if none.
- "limited_edition_size": the LE number if printed or known (e.g. 3000);
  null if not determinable. Never guess this number.
- "canonical_description": exactly one sentence in this shape:
  "<Character(s)> <pose/action> <notable elements> <shape> pin from
  <franchise/series>, <dominant color> tones". This sentence is used for
  similarity matching — make it dense, factual, and consistently structured.
- Describe only what is visible. Do not invent attributes.`;

// Enforced via structured outputs, so responses always match this shape.
export const ATTRIBUTE_SCHEMA = {
  type: 'object',
  properties: {
    characters: { type: 'array', items: { type: 'string' } },
    franchise: { type: 'string' },
    maker: { type: 'string', enum: MAKER_VOCABULARY },
    pose_description: { type: 'string' },
    pin_shape: { type: 'string' },
    dominant_colors: { type: 'array', items: { type: 'string' } },
    text_on_pin: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    series_or_event: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    limited_edition_size: { anyOf: [{ type: 'integer' }, { type: 'null' }] },
    canonical_description: { type: 'string' },
  },
  required: [
    'characters', 'franchise', 'maker', 'pose_description', 'pin_shape',
    'dominant_colors', 'text_on_pin', 'series_or_event',
    'limited_edition_size', 'canonical_description',
  ],
  additionalProperties: false,
};

// Calls Claude vision on a base64 JPEG and returns the parsed attribute
// object, or throws with a user-presentable message.
export async function extractAttributes(env, photoB64) {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 1024,
    thinking: { type: 'disabled' }, // fast, single-shot extraction
    system: VISION_PROMPT,
    output_config: { format: { type: 'json_schema', schema: ATTRIBUTE_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: photoB64 } },
          { type: 'text', text: 'Identify this pin.' },
        ],
      },
    ],
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('The vision model declined to analyze this photo');
  }

  const text = response.content.find((b) => b.type === 'text')?.text ?? '';
  const parsed = safeParse(text);
  if (!parsed || typeof parsed !== 'object') {
    console.error('Unparseable vision response:', text.slice(0, 500));
    throw new Error('Could not parse the vision response — try another photo');
  }

  // Map API field name to the DB column name and normalize array fields.
  return {
    characters: Array.isArray(parsed.characters) ? parsed.characters : [],
    franchise: parsed.franchise ?? null,
    maker: parsed.maker ?? 'unknown',
    pose_description: parsed.pose_description ?? null,
    pin_shape: parsed.pin_shape ?? null,
    dominant_colors: Array.isArray(parsed.dominant_colors) ? parsed.dominant_colors : [],
    text_on_pin: parsed.text_on_pin ?? null,
    series_or_event: parsed.series_or_event ?? null,
    le_size: parsed.limited_edition_size === null || parsed.limited_edition_size === undefined
      ? null
      : parsed.limited_edition_size,
    canonical_description: parsed.canonical_description ?? '',
  };
}
