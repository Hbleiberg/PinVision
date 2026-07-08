# Matching-Quality Test — 10 Seeded Pins

Run this before bulk-loading the real collection. It calibrates the two
matching thresholds and confirms the verdict tiers behave correctly.

## 1. Choose the 10 seed pins

Pick real pins with controlled overlap:

| # | What | Why |
|---|---|---|
| 1–2 | Two **Stitch pins in different poses** | Exercises `same_character` vs `same_character_same_pose` |
| 3–4 | Two pins from the **same named series** (e.g. two Pin-of-the-Month) | Series-mates should surface as candidates |
| 5–6 | A **near-identical pair** (same design, color/variant difference) | Stresses the pHash threshold from both sides |
| 7–10 | Four **unrelated singles** (different characters/franchises) | Negative-control population |

## 2. Seed them

Add each pin through the app (Identify → photograph → correct attributes →
**Add**). Photograph flat, well-lit, pin filling most of the frame — this
matters, the pHash is only as stable as the framing. Verify each saved pin's
attributes in the detail view and fix any vision mistakes; the canonical
description drives similarity, so make sure it's accurate.

## 3. Run the scored protocol

Each row is a fresh photo taken through the Identify screen. Record results.

| Test | Photos | Pass criterion |
|---|---|---|
| **Exact re-identification** | Re-photograph 5 of the seeded pins in different lighting/angle | "You own this pin" (pHash) or exact-match tier fires on **4/5+** |
| **Variant discrimination** | Photograph seed #5, then #6 | Each surfaces the *other* as a top candidate; check whether the pHash layer separates or merges them and note the Hamming distance shown (hash Δ) |
| **Same-character discrimination** | Photograph a **non-owned** Stitch pin | Owned Stitch pins appear as `same character` / `same character & pose`, **never** "You own this pin" |
| **Same-series** | Photograph a **non-owned** pin from the seeded series | Series-mates appear in the candidate list |
| **Negative control** | 3 pins totally unrelated to the collection | "Not in your collection", no exact-tier candidate |
| **Remove targeting** | Photograph an owned pin → **Remove** | The correct pin is offered one-tap (or preselected in the picker) |

## 4. Tune thresholds

All three constants live in `worker/src/verdict.js`:

| Constant | Default | Raise it when… | Lower it when… |
|---|---|---|---|
| `PHASH_EXACT_THRESHOLD` | 10 (of 64) | Re-photographs of owned pins miss the exact tier | Different pins (esp. the variant pair) collide as "You own this" |
| `COSINE_EXACT_THRESHOLD` | 0.92 | Different same-character pins reach the exact tier | Genuinely identical pins only score "likely" |
| `COSINE_POSE_THRESHOLD` | 0.80 | Different poses lump into "same pose" | Same-pose pins fall to plain "same character" |

Redeploy (`npx wrangler deploy`) between tuning rounds — the thresholds are
server-side only, no client changes needed.

## 5. Sign-off

When every row passes, bulk-load the real collection through the app. Photos
matter more than thresholds: consistent framing at add-time is what makes the
pHash layer reliable at trading events later.

## Backfill note

Pins created before the Vectorize phase (or whose vector write failed with a
warning) can be re-indexed by opening the pin, editing the description
(e.g. add and remove a character), and saving — any description change
re-embeds the vector.
