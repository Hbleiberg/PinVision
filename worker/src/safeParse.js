// All JSON parsing of model output goes through here. Structured outputs
// should guarantee clean JSON, but never assume it: strip markdown fences,
// fall back to the outermost {...} slice, and return null rather than throw.
export function safeParse(text) {
  if (typeof text !== 'string' || !text.trim()) return null;

  let candidate = text.trim();

  // Strip ```json ... ``` / ``` ... ``` fences if present.
  const fenced = candidate.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced) candidate = fenced[1].trim();

  try {
    return JSON.parse(candidate);
  } catch { /* fall through */ }

  // Last resort: outermost brace pair (handles stray prose around the JSON).
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      return JSON.parse(candidate.slice(start, end + 1));
    } catch { /* fall through */ }
  }

  return null;
}
