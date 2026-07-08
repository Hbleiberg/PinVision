// Text embeddings via Workers AI + vector storage via Vectorize.
// Each pin has exactly one vector: id = pin id, values = embedding of its
// canonical_description. Removed pins keep their vector — ownership filtering
// happens at query time against D1, so remove/restore never touches Vectorize.

const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5'; // 768 dims, cosine

export async function embedText(env, text) {
  const result = await env.AI.run(EMBEDDING_MODEL, { text: [text] });
  const vector = result?.data?.[0];
  if (!Array.isArray(vector) || vector.length === 0) {
    throw new Error('Embedding model returned no vector');
  }
  return vector;
}

export async function upsertPinVector(env, pinId, description) {
  const values = await embedText(env, description);
  await env.VECTORS.upsert([{ id: pinId, values }]);
}

export async function deletePinVector(env, pinId) {
  await env.VECTORS.deleteByIds([pinId]);
}

// Top-K nearest pins by canonical-description similarity. Returns
// [{ id, score }] — caller joins against D1 and filters by status.
export async function querySimilarPins(env, description, topK = 10) {
  const values = await embedText(env, description);
  const result = await env.VECTORS.query(values, { topK });
  return (result?.matches ?? []).map((m) => ({ id: m.id, score: m.score }));
}
