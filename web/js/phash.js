// 64-bit difference hash (dHash): downscale to 9×8 grayscale, emit one bit
// per horizontally-adjacent pixel pair (left < right), pack to 16 hex chars.
// Computed client-side because Workers can't decode images. The Worker only
// ever compares hashes (Hamming distance), so this file is the single source
// of truth for hash generation — don't reimplement it elsewhere.

export const DHASH_W = 9;
export const DHASH_H = 8;

// Pure bit computation over a luminance array (row-major, length w*h).
// Kept DOM-free so it can be unit-tested.
export function dhashFromLuminance(lum, w = DHASH_W, h = DHASH_H) {
  let hex = '';
  let nibble = 0;
  let bits = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w - 1; x++) {
      const bit = lum[y * w + x] < lum[y * w + x + 1] ? 1 : 0;
      nibble = (nibble << 1) | bit;
      bits++;
      if (bits === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }
  return hex; // 64 bits -> 16 hex chars
}

export function dhashFromCanvas(sourceCanvas) {
  const c = document.createElement('canvas');
  c.width = DHASH_W;
  c.height = DHASH_H;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceCanvas, 0, 0, DHASH_W, DHASH_H);
  const { data } = ctx.getImageData(0, 0, DHASH_W, DHASH_H);
  const lum = new Float64Array(DHASH_W * DHASH_H);
  for (let i = 0; i < lum.length; i++) {
    const o = i * 4;
    lum[i] = 0.299 * data[o] + 0.587 * data[o + 1] + 0.114 * data[o + 2];
  }
  return dhashFromLuminance(lum);
}
