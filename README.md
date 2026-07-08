# PinVault

A mobile-first PWA for tracking a Disney pin collection with photo-based
identification. Photograph a single pin and PinVault tells you whether you
already own it, shows visually/thematically similar pins you own, and offers
**Add to collection**, **Remove from collection**, or **Dismiss**.

Built for two users sharing one collection.

## Architecture

| Piece | Tech |
|---|---|
| Frontend | Static PWA (vanilla HTML/CSS/JS) on GitHub Pages |
| API | Cloudflare Worker (`worker/`) |
| Database | Cloudflare D1 (pin metadata) |
| Photos | Cloudflare R2 (client-resized original + thumbnail) |
| Vector search | Cloudflare Vectorize + Workers AI `@cf/baai/bge-base-en-v1.5` |
| Vision | Anthropic `claude-sonnet-5` with structured outputs |
| Auth | Shared passphrase → long-lived HMAC session token |

## Matching pipeline

`POST /api/identify` runs three layers and combines them into a ranked verdict:

1. **Perceptual hash** (client-computed dHash, Hamming distance vs owned pins)
   — the only layer allowed to say "You own this" with certainty.
2. **Claude vision extraction** — characters, franchise, maker, pose, shape,
   colors, text, series, LE size, and a canonical one-sentence description.
3. **Embedding similarity** — the canonical description embedded with
   bge-base-en-v1.5, queried against Vectorize over owned pins.

Verdict tiers: `exact_match` → `same_character_same_pose` → `same_character`
→ `similar` → not in collection.

## Getting started

See [SETUP.md](SETUP.md) for Cloudflare provisioning, secrets, and deploys.
See [scripts/seed.md](scripts/seed.md) for the 10-pin matching-quality test to
run before bulk-loading a real collection.

## Development

```sh
cd worker
npm install
npm test          # vitest unit tests (verdict ranking, hashing, auth, parsing)
npx wrangler dev  # local API
```

## Out of scope for beta (v2 ideas)

- Whole-board photo → auto-segmentation into individual pins (v2: manual
  crop-assist grid tool)
- Trading wishlist / want lists
- Multi-collection support or public sharing
- Price/valuation lookups
