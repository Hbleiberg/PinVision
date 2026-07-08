// Shared-passphrase auth: the passphrase's SHA-256 is compared against the
// PASSPHRASE_HASH secret; success issues a long-lived HMAC-signed token that
// the client stores in localStorage and sends as `Authorization: Bearer`.
// Everything uses WebCrypto — no dependencies.

const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

const encoder = new TextEncoder();

export function b64urlEncode(bytes) {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmacKey(secret) {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function hmacSign(message, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

export async function hmacVerify(message, signature, secret) {
  const key = await hmacKey(secret);
  let sigBytes;
  try {
    sigBytes = b64urlDecode(signature);
  } catch {
    return false;
  }
  return crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(message));
}

export async function issueToken(secret, now = Date.now()) {
  const payload = b64urlEncode(encoder.encode(JSON.stringify({ iat: now, exp: now + TOKEN_TTL_MS })));
  const sig = await hmacSign(payload, secret);
  return `${payload}.${sig}`;
}

export async function verifyToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  if (!(await hmacVerify(payload, sig, secret))) return false;
  try {
    const claims = JSON.parse(new TextDecoder().decode(b64urlDecode(payload)));
    return typeof claims.exp === 'number' && claims.exp > now;
  } catch {
    return false;
  }
}

// Comparing SHA-256 digests (fixed length, secret-derived) rather than the raw
// passphrase makes a timing side-channel impractical.
export async function checkPassphrase(passphrase, expectedHashHex) {
  if (typeof passphrase !== 'string' || !expectedHashHex) return false;
  const actual = await sha256Hex(passphrase);
  if (actual.length !== expectedHashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  }
  return diff === 0;
}

// Signed photo URLs: <img> tags can't send an Authorization header, so R2
// fetches are authorized by an HMAC over `key|exp` carried in query params.
const PHOTO_URL_TTL_MS = 24 * 60 * 60 * 1000;

export async function signPhotoPath(key, secret, now = Date.now()) {
  const exp = now + PHOTO_URL_TTL_MS;
  const sig = await hmacSign(`${key}|${exp}`, secret);
  return `/api/photo/${encodeURIComponent(key)}?exp=${exp}&sig=${sig}`;
}

export async function verifyPhotoSig(key, exp, sig, secret, now = Date.now()) {
  const expNum = Number(exp);
  if (!Number.isFinite(expNum) || expNum < now) return false;
  return hmacVerify(`${key}|${exp}`, sig, secret);
}
