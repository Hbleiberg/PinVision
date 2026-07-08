// Generates the PWA icon PNGs (no native deps — hand-rolled PNG encoder over
// node:zlib). Run `node scripts/gen-icons.mjs` from the repo root after
// changing the design, then commit the PNGs in web/icons/.
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'web', 'icons');
mkdirSync(outDir, { recursive: true });

// --- minimal PNG encoder (truecolor, 8-bit) ---
const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
function crc32(bytes) {
  let c = -1;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
function encodePng(width, height, rgb) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // filter: none
    rgb.copy(raw, y * (1 + width * 3) + 1, y * width * 3, (y + 1) * width * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: truecolor
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- icon design: dark rounded field, accent pin-head circle + highlight ---
const BG = [0x12, 0x12, 0x1f];
const ACCENT = [0xe9, 0x45, 0x60];
const HIGHLIGHT = [0xff, 0x8f, 0xa3];

function drawIcon(size) {
  const rgb = Buffer.alloc(size * size * 3);
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size * 0.34;
  const rInner = size * 0.13;
  const hx = cx - size * 0.1;
  const hy = cy - size * 0.1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy);
      const dh = Math.hypot(x - hx, y - hy);
      let color = BG;
      if (dh < rInner) color = HIGHLIGHT;
      else if (d < rOuter) color = ACCENT;
      const o = (y * size + x) * 3;
      rgb[o] = color[0];
      rgb[o + 1] = color[1];
      rgb[o + 2] = color[2];
    }
  }
  return encodePng(size, size, rgb);
}

for (const size of [180, 192, 512]) {
  const file = join(outDir, `icon-${size}.png`);
  writeFileSync(file, drawIcon(size));
  console.log('wrote', file);
}
