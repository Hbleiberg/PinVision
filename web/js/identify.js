import { $, toast } from './util.js';
import { api } from './api.js';
import { onViewShow, showView } from './app.js';
import { processImageFile } from './image.js';
import { openAddForm } from './form.js';

let currentCapture = null; // { renditions, phash, result }

function resetIdentify() {
  $('#identify-start').hidden = false;
  $('#identify-busy').hidden = true;
  $('#identify-result').hidden = true;
  $('#identify-result').innerHTML = '';
  $('#capture-input').value = '';
  if (currentCapture?.renditions?.previewUrl) {
    URL.revokeObjectURL(currentCapture.renditions.previewUrl);
  }
  currentCapture = null;
}

async function computePhash(photoCanvas) {
  try {
    const { dhashFromCanvas } = await import('./phash.js');
    return dhashFromCanvas(photoCanvas);
  } catch {
    return ''; // phash module ships in a later phase
  }
}

async function analyze(file) {
  $('#identify-start').hidden = true;
  $('#identify-busy').hidden = false;
  $('#identify-status').textContent = 'Analyzing…';

  let renditions;
  try {
    renditions = await processImageFile(file);
  } catch (err) {
    toast(err.message, true);
    resetIdentify();
    return;
  }
  $('#identify-preview').src = renditions.previewUrl;

  const phash = await computePhash(renditions.photoCanvas);

  try {
    const result = await api('/api/identify', {
      method: 'POST',
      body: { photo_b64: renditions.photoB64, phash },
    });
    currentCapture = { renditions, phash, result };
    $('#identify-busy').hidden = true;
    renderResult(result);
  } catch (err) {
    toast(err.message, true);
    resetIdentify();
  }
}

// Vision-only rendering for now; the verdict-card phase replaces this with
// the full ranked-match UI.
function renderResult(result) {
  openAddForm({
    prefill: result.attributes,
    renditions: currentCapture.renditions,
    phash: currentCapture.phash,
    onSaved: () => {
      resetIdentify();
      showView('identify');
    },
  });
}

$('#capture-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) analyze(file);
});

onViewShow('identify', () => {
  // Returning to the tab always offers a fresh capture.
  if (!currentCapture) resetIdentify();
});

export {};
