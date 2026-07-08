import { $, esc, toast } from './util.js';
import { api } from './api.js';
import { showView } from './app.js';
import { processImageFile } from './image.js';

export const MAKERS = [
  'Disney Parks / OE', 'Loungefly', 'The Pink a la Mode', 'WDI',
  'Disney Employee Center', 'HKDL', 'DLP', 'Her Universe',
  'BoxLunch exclusive', 'fantasy/unofficial', 'unknown',
];

const FIELDS = [
  { key: 'characters', label: 'Characters (comma-separated)', type: 'text' },
  { key: 'franchise', label: 'Franchise', type: 'text' },
  { key: 'maker', label: 'Maker', type: 'maker' },
  { key: 'pose_description', label: 'Pose / action', type: 'text' },
  { key: 'pin_shape', label: 'Pin shape', type: 'text' },
  { key: 'dominant_colors', label: 'Colors (comma-separated)', type: 'text' },
  { key: 'text_on_pin', label: 'Text on pin', type: 'text' },
  { key: 'series_or_event', label: 'Series / event', type: 'text' },
  { key: 'le_size', label: 'LE size', type: 'number' },
  { key: 'canonical_description', label: 'Description (used for matching)', type: 'textarea' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

function fieldValue(pin, key) {
  const v = pin?.[key];
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(', ');
  return String(v);
}

function renderFields(pin) {
  return FIELDS.map((f) => {
    const val = esc(fieldValue(pin, f.key));
    if (f.type === 'textarea') {
      return `<label>${esc(f.label)}<textarea name="${f.key}" rows="2">${val}</textarea></label>`;
    }
    if (f.type === 'maker') {
      return `<label>${esc(f.label)}
        <input name="${f.key}" value="${val}" list="maker-options">
        <datalist id="maker-options">${MAKERS.map((m) => `<option value="${esc(m)}">`).join('')}</datalist>
      </label>`;
    }
    const typeAttr = f.type === 'number' ? 'number" inputmode="numeric' : 'text';
    return `<label>${esc(f.label)}<input type="${typeAttr}" name="${f.key}" value="${val}"></label>`;
  }).join('');
}

function collectFields(formEl) {
  const data = new FormData(formEl);
  const out = {};
  for (const f of FIELDS) {
    const raw = (data.get(f.key) ?? '').toString().trim();
    if (f.key === 'characters' || f.key === 'dominant_colors') {
      out[f.key] = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
    } else if (f.key === 'le_size') {
      out[f.key] = raw === '' ? null : Number(raw);
    } else {
      out[f.key] = raw === '' ? null : raw;
    }
  }
  return out;
}

// Add flow. `prefill` comes from vision extraction (may be empty for a fully
// manual add); `renditions` ({photoB64, thumbB64, previewUrl}) and `phash` are
// passed when the identify flow already processed the capture.
export function openAddForm({ prefill = {}, renditions = null, phash = '', onSaved } = {}) {
  const body = $('#form-body');
  $('#form-title').textContent = 'Add pin';

  let current = { renditions, phash };

  body.innerHTML = `
    <img id="form-photo" class="form-photo" alt="Pin photo" ${renditions ? '' : 'hidden'}>
    <label class="btn btn-block" for="form-photo-input" id="form-photo-label" style="margin:12px 0">
      ${renditions ? 'Retake photo' : '&#128247; Choose photo'}
    </label>
    <input type="file" id="form-photo-input" accept="image/*" capture="environment" hidden>
    <form id="pin-form" class="form-grid">
      ${renderFields(prefill)}
      <div class="button-row">
        <button type="submit" class="btn btn-success">Save pin</button>
      </div>
    </form>
  `;

  const photoEl = $('#form-photo');
  if (renditions?.previewUrl) photoEl.src = renditions.previewUrl;

  $('#form-photo-input').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const processed = await processImageFile(file);
      let hash = '';
      try {
        const { dhashFromCanvas } = await import('./phash.js');
        hash = dhashFromCanvas(processed.photoCanvas);
      } catch { /* phash module ships in a later phase */ }
      current = { renditions: processed, phash: hash };
      photoEl.src = processed.previewUrl;
      photoEl.hidden = false;
      $('#form-photo-label').textContent = 'Retake photo';
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#pin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!current.renditions) {
      toast('Add a photo first', true);
      return;
    }
    const fields = collectFields(e.target);
    if (!fields.canonical_description) {
      toast('Description is required — it powers matching', true);
      return;
    }
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      await api('/api/pins', {
        method: 'POST',
        body: {
          ...fields,
          phash: current.phash || '',
          photo_b64: current.renditions.photoB64,
          thumb_b64: current.renditions.thumbB64,
        },
      });
      toast('Pin added to collection');
      onSaved ? onSaved() : showView('collection');
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Save pin';
    }
  });

  showView('form');
}

export function openEditForm(pin, onSaved) {
  const body = $('#form-body');
  $('#form-title').textContent = 'Edit pin';

  body.innerHTML = `
    ${pin.photo_url ? `<img class="form-photo" alt="Pin photo" id="form-photo-existing">` : ''}
    <form id="pin-form" class="form-grid" style="margin-top:12px">
      ${renderFields(pin)}
      <div class="button-row">
        <button type="submit" class="btn btn-success">Save changes</button>
      </div>
    </form>
  `;

  const img = $('#form-photo-existing');
  if (img) {
    import('./api.js').then(({ photoUrl }) => { img.src = photoUrl(pin.photo_url); });
  }

  $('#pin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const { pin: updated } = await api(`/api/pins/${pin.id}`, {
        method: 'PATCH',
        body: collectFields(e.target),
      });
      toast('Saved');
      onSaved?.(updated);
    } catch (err) {
      toast(err.message, true);
      btn.disabled = false;
      btn.textContent = 'Save changes';
    }
  });

  showView('form');
}
