import { $, esc, toast, confirmDialog } from './util.js';
import { api, photoUrl } from './api.js';
import { onViewShow, showView } from './app.js';
import { processImageFile } from './image.js';
import { openAddForm } from './form.js';

let currentCapture = null; // { renditions, phash, result }

const HEADLINES = {
  exact_certain: { text: 'You own this pin', cls: 'own' },
  exact_match: { text: 'You likely own this pin', cls: 'likely' },
  same_character_same_pose: { text: 'Possible match — same character & pose', cls: 'likely' },
  same_character: { text: 'You own pins with this character', cls: 'likely' },
  similar_only: { text: 'Not in your collection', cls: 'new' },
  not_in_collection: { text: 'Not in your collection', cls: 'new' },
};

const LAYER_LABELS = {
  exact_match: 'Exact match',
  same_character_same_pose: 'Same character & pose',
  same_character: 'Same character',
  similar: 'Similar',
};

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
  } catch (err) {
    console.error('phash failed', err);
    return '';
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
    renderVerdict(result);
  } catch (err) {
    toast(err.message, true);
    resetIdentify();
  }
}

function candidateTitle(c) {
  const chars = c.metadata.characters?.join(', ');
  return chars || c.metadata.franchise || 'Pin';
}

function candidateSubtitle(c) {
  const bits = [LAYER_LABELS[c.layer] || c.layer];
  if (c.phash_distance !== null && c.phash_distance !== undefined) {
    bits.push(`hash Δ${c.phash_distance}`);
  } else if (typeof c.similarity === 'number') {
    bits.push(`${Math.round(c.similarity * 100)}% similar`);
  }
  if (c.metadata.series_or_event) bits.push(c.metadata.series_or_event);
  return bits.join(' · ');
}

function renderVerdict(result) {
  const el = $('#identify-result');
  const key = result.verdict === 'exact_match' && result.certain ? 'exact_certain' : result.verdict;
  const headline = HEADLINES[key] || HEADLINES.not_in_collection;
  const removable = result.candidates.filter((c) => c.layer !== 'similar');
  const showPicker = removable.length > 1;

  el.innerHTML = `
    <div class="verdict-card">
      <img class="query-photo" src="${esc(currentCapture.renditions.previewUrl)}" alt="Captured pin">
      <p class="verdict-headline ${headline.cls}">${esc(headline.text)}</p>
      <p class="muted">${esc(result.attributes.canonical_description || '')}</p>
      ${result.candidates.length ? `
        <p class="muted" style="margin-bottom:4px">${showPicker ? 'Matches in your collection (pick one to remove):' : 'From your collection:'}</p>
        <div class="candidate-list">
          ${result.candidates.map((c, i) => `
            <label class="candidate" data-pin-id="${esc(c.pin_id)}">
              ${showPicker && c.layer !== 'similar'
                ? `<input type="radio" name="remove-target" value="${esc(c.pin_id)}" ${i === 0 ? 'checked' : ''}>`
                : ''}
              ${c.thumb_url ? `<img src="${esc(photoUrl(c.thumb_url))}" alt="">` : ''}
              <span class="cand-meta">
                <span class="cand-title">${esc(candidateTitle(c))}</span><br>
                <span class="cand-sub">${esc(candidateSubtitle(c))}</span>
              </span>
            </label>
          `).join('')}
        </div>` : ''}
      <div class="verdict-actions">
        <button class="btn btn-success" id="verdict-add">Add</button>
        ${removable.length ? '<button class="btn btn-danger" id="verdict-remove">Remove</button>' : ''}
        <button class="btn" id="verdict-dismiss">Dismiss</button>
      </div>
    </div>
  `;
  el.hidden = false;

  $('#verdict-add').addEventListener('click', () => {
    openAddForm({
      prefill: result.attributes,
      renditions: currentCapture.renditions,
      phash: currentCapture.phash,
      onSaved: () => {
        resetIdentify();
        showView('identify');
      },
    });
  });

  $('#verdict-remove')?.addEventListener('click', async () => {
    const selected = showPicker
      ? el.querySelector('input[name=remove-target]:checked')?.value
      : removable[0].pin_id;
    if (!selected) {
      toast('Pick which pin you are removing', true);
      return;
    }
    const target = result.candidates.find((c) => c.pin_id === selected);
    const ok = await confirmDialog(
      `Remove "${candidateTitle(target)}" from your collection? It moves to Traded away.`,
      'Remove',
      true
    );
    if (!ok) return;
    try {
      await api(`/api/pins/${selected}`, { method: 'DELETE' });
      toast('Moved to Traded away');
      resetIdentify();
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#verdict-dismiss').addEventListener('click', resetIdentify);
}

$('#capture-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) analyze(file);
});

onViewShow('identify', () => {
  // Keep an in-progress result when hopping between tabs; otherwise offer a
  // fresh capture.
  if (!currentCapture) resetIdentify();
});

export {};
