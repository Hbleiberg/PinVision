import { describe, it, expect } from 'vitest';
import {
  sha256Hex,
  issueToken,
  verifyToken,
  checkPassphrase,
  signPhotoPath,
  verifyPhotoSig,
} from '../src/auth.js';

const SECRET = 'test-session-secret';

describe('passphrase check', () => {
  it('accepts the correct passphrase', async () => {
    const hash = await sha256Hex('mickey ears 1971');
    expect(await checkPassphrase('mickey ears 1971', hash)).toBe(true);
  });

  it('rejects a wrong passphrase', async () => {
    const hash = await sha256Hex('mickey ears 1971');
    expect(await checkPassphrase('donald duck', hash)).toBe(false);
  });

  it('rejects missing input or missing hash', async () => {
    const hash = await sha256Hex('x');
    expect(await checkPassphrase(undefined, hash)).toBe(false);
    expect(await checkPassphrase('x', undefined)).toBe(false);
  });
});

describe('session tokens', () => {
  it('round-trips a valid token', async () => {
    const token = await issueToken(SECRET);
    expect(await verifyToken(token, SECRET)).toBe(true);
  });

  it('rejects a tampered payload', async () => {
    const token = await issueToken(SECRET);
    const [payload, sig] = token.split('.');
    const tampered = payload.slice(0, -2) + 'xx.' + sig;
    expect(await verifyToken(tampered, SECRET)).toBe(false);
  });

  it('rejects a token signed with another secret', async () => {
    const token = await issueToken('other-secret');
    expect(await verifyToken(token, SECRET)).toBe(false);
  });

  it('rejects an expired token', async () => {
    const twoYearsAgo = Date.now() - 2 * 365 * 24 * 60 * 60 * 1000;
    const token = await issueToken(SECRET, twoYearsAgo);
    expect(await verifyToken(token, SECRET)).toBe(false);
  });

  it('rejects garbage', async () => {
    expect(await verifyToken('not-a-token', SECRET)).toBe(false);
    expect(await verifyToken(null, SECRET)).toBe(false);
  });
});

describe('signed photo URLs', () => {
  it('verifies a freshly signed path', async () => {
    const path = await signPhotoPath('thumb/abc.jpg', SECRET);
    const url = new URL('https://x.example' + path);
    const ok = await verifyPhotoSig('thumb/abc.jpg', url.searchParams.get('exp'), url.searchParams.get('sig'), SECRET);
    expect(ok).toBe(true);
  });

  it('rejects an expired signature', async () => {
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    const path = await signPhotoPath('thumb/abc.jpg', SECRET, twoDaysAgo);
    const url = new URL('https://x.example' + path);
    const ok = await verifyPhotoSig('thumb/abc.jpg', url.searchParams.get('exp'), url.searchParams.get('sig'), SECRET);
    expect(ok).toBe(false);
  });

  it('rejects a signature for a different key', async () => {
    const path = await signPhotoPath('thumb/abc.jpg', SECRET);
    const url = new URL('https://x.example' + path);
    const ok = await verifyPhotoSig('photo/other.jpg', url.searchParams.get('exp'), url.searchParams.get('sig'), SECRET);
    expect(ok).toBe(false);
  });
});
