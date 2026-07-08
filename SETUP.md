# PinVault Setup

One-time provisioning for the Cloudflare backend and GitHub Pages frontend.
Everything below runs from the `worker/` directory unless noted.

## Prerequisites

- Node 20+ and `npm`
- A Cloudflare account (free plan works; see "Free-tier notes" below)
- An Anthropic API key (https://platform.claude.com)

```sh
cd worker
npm install
npx wrangler login
```

## 1. Create the Cloudflare resources

```sh
# D1 database — copy the printed database_id into worker/wrangler.toml
npx wrangler d1 create pinvault

# R2 bucket (name must match wrangler.toml)
npx wrangler r2 bucket create pinvault-photos

# Vectorize index: 768 dims (bge-base-en-v1.5), cosine metric
npx wrangler vectorize create pinvault-pins --dimensions=768 --metric=cosine
```

Edit `worker/wrangler.toml`:
- replace `REPLACE_WITH_D1_DATABASE_ID` with the id printed by `d1 create`
- set `ALLOWED_ORIGINS` to your GitHub Pages origin, e.g. `https://<user>.github.io`

## 2. Apply the database schema

```sh
npx wrangler d1 migrations apply pinvault --remote
```

## 3. Set secrets

```sh
# SHA-256 of your shared passphrase:
#   node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode('YOUR PASSPHRASE')).then(d => console.log([...new Uint8Array(d)].map(b=>b.toString(16).padStart(2,'0')).join('')))"
npx wrangler secret put PASSPHRASE_HASH

# Long random string, e.g.: node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
npx wrangler secret put SESSION_SECRET

# Your Anthropic API key
npx wrangler secret put ANTHROPIC_API_KEY
```

## 4. Deploy the Worker

```sh
npx wrangler deploy
```

Note the printed URL (e.g. `https://pinvault-api.<subdomain>.workers.dev`) and
put it in `web/js/config.js` as `API_BASE`.

## 5. Enable GitHub Pages

Repo Settings → Pages → Source: **GitHub Actions**. The included workflow
(`.github/workflows/pages.yml`) deploys `web/` on every push to `main`.
The app will be served at `https://<user>.github.io/PinVision/`.

Make sure that origin (just the scheme+host, no path) is listed in
`ALLOWED_ORIGINS` in `wrangler.toml`, then redeploy the Worker if you changed it.

## 6. Install on iPhone

Open the Pages URL in Safari → Share → **Add to Home Screen**.

## Local development

```sh
# API (D1/R2 run locally via miniflare; Workers AI + Vectorize proxy to your account)
cd worker && npx wrangler dev

# Frontend — any static server, e.g.:
cd web && python3 -m http.server 8788
```

Set `API_BASE` in `web/js/config.js` to `http://localhost:8787` while developing
(and keep `http://localhost:8788` in `ALLOWED_ORIGINS`).
For local secrets, create `worker/.dev.vars`:

```
PASSPHRASE_HASH=...
SESSION_SECRET=dev-secret
ANTHROPIC_API_KEY=sk-ant-...
```

## Free-tier notes (approximate published limits — check current docs)

| Service | Free allowance | PinVault reality (2 users) |
|---|---|---|
| Workers | 100k req/day | Nowhere close |
| D1 | 5 GB, ~5M reads/day, 100k writes/day | Fine |
| R2 | **10 GB storage**, 1M writes/mo, 10M reads/mo | ~350 KB/pin → ~28k pins; the only limit worth watching |
| Vectorize | ~5M stored dims (≈6.5k vectors @768), 30M queried dims/mo | Fine for a beta collection; 10k+ pins needs the $5/mo Workers paid plan |
| Workers AI | Daily free neuron allocation | Hundreds of embeddings/day — fine |

Anthropic cost: ≈ $0.006 per identified photo on `claude-sonnet-5` intro
pricing (≈ $0.01 standard). Bulk-loading 500 pins ≈ $3.
