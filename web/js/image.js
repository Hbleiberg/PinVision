// Client-side image processing. Workers can't decode images, so the browser
// produces both renditions before upload:
//   - "photo": max 1600px long edge, JPEG q0.85 (also what Claude vision sees)
//   - "thumb": 300px square-ish cover crop, JPEG q0.8

const PHOTO_MAX = 1600;
const THUMB_SIZE = 300;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image'));
    };
    img.src = url;
  });
}

function drawScaled(img, maxEdge) {
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(img, 0, 0, w, h);
  return canvas;
}

function drawThumb(img, size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  // Center-crop to a square.
  const edge = Math.min(img.naturalWidth, img.naturalHeight);
  const sx = (img.naturalWidth - edge) / 2;
  const sy = (img.naturalHeight - edge) / 2;
  ctx.drawImage(img, sx, sy, edge, edge, 0, 0, size, size);
  return canvas;
}

function canvasToB64(canvas, quality) {
  // strip the data-URL prefix; the API stores raw JPEG bytes
  return canvas.toDataURL('image/jpeg', quality).split(',')[1];
}

// Returns { photoB64, thumbB64, previewUrl, photoCanvas }.
// Caller is responsible for URL.revokeObjectURL(previewUrl) when done.
export async function processImageFile(file) {
  const { img, url } = await loadImage(file);
  const photoCanvas = drawScaled(img, PHOTO_MAX);
  const thumbCanvas = drawThumb(img, THUMB_SIZE);
  return {
    photoB64: canvasToB64(photoCanvas, 0.85),
    thumbB64: canvasToB64(thumbCanvas, 0.8),
    previewUrl: url,
    photoCanvas,
  };
}
