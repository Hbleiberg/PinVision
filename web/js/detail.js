import { $, esc, toast, confirmDialog } from './util.js';
import { api, photoUrl } from './api.js';
import { showView } from './app.js';
import { openEditForm } from './form.js';

let returnView = 'collection';

const ROWS = [
  ['Characters', (p) => p.characters.join(', ')],
  ['Franchise', (p) => p.franchise],
  ['Maker', (p) => p.maker],
  ['Pose', (p) => p.pose_description],
  ['Shape', (p) => p.pin_shape],
  ['Colors', (p) => p.dominant_colors.join(', ')],
  ['Text on pin', (p) => p.text_on_pin],
  ['Series / event', (p) => p.series_or_event],
  ['LE size', (p) => (p.le_size === null || p.le_size === undefined ? null : String(p.le_size))],
  ['Description', (p) => p.canonical_description],
  ['Notes', (p) => p.notes],
  ['Added', (p) => p.added_at?.slice(0, 10)],
  ['Removed', (p) => p.removed_at?.slice(0, 10)],
];

function render(pin) {
  const body = $('#detail-body');
  const removed = pin.status === 'removed';
  body.innerHTML = `
    ${pin.photo_url ? `<img class="detail-photo" src="${esc(photoUrl(pin.photo_url))}" alt="Pin photo">` : ''}
    <h2 style="margin:12px 0 0">${esc(pin.characters.join(', ') || pin.franchise || 'Pin')}
      ${removed ? '<span class="removed-badge">traded away</span>' : ''}</h2>
    <table class="attr-table">
      ${ROWS.map(([label, get]) => {
        const val = get(pin);
        return val ? `<tr><td>${esc(label)}</td><td>${esc(val)}</td></tr>` : '';
      }).join('')}
    </table>
    <div class="button-row">
      <button class="btn" id="detail-edit">Edit</button>
      ${removed
        ? '<button class="btn btn-success" id="detail-restore">Restore</button>\
           <button class="btn btn-danger" id="detail-purge">Delete forever</button>'
        : '<button class="btn btn-danger" id="detail-remove">Remove</button>'}
    </div>
  `;

  $('#detail-edit').addEventListener('click', () => {
    openEditForm(pin, (updated) => openDetailPin(updated));
  });

  $('#detail-remove')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Remove this pin from your collection? It moves to Traded away.', 'Remove', true))) return;
    try {
      await api(`/api/pins/${pin.id}`, { method: 'DELETE' });
      toast('Moved to Traded away');
      showView(returnView);
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#detail-restore')?.addEventListener('click', async () => {
    try {
      const { pin: updated } = await api(`/api/pins/${pin.id}`, { method: 'PATCH', body: { status: 'owned' } });
      toast('Restored to collection');
      openDetailPin(updated);
    } catch (err) {
      toast(err.message, true);
    }
  });

  $('#detail-purge')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Permanently delete this pin, its photos, and its match data? This cannot be undone.', 'Delete forever', true))) return;
    try {
      await api(`/api/pins/${pin.id}?hard=true`, { method: 'DELETE' });
      toast('Pin permanently deleted');
      showView(returnView);
    } catch (err) {
      toast(err.message, true);
    }
  });
}

function openDetailPin(pin) {
  render(pin);
  showView('detail');
}

export async function openDetail(id, from = 'collection') {
  returnView = from;
  try {
    const { pin } = await api(`/api/pins/${id}`);
    openDetailPin(pin);
  } catch (err) {
    toast(err.message, true);
  }
}

$('#detail-back').addEventListener('click', () => showView(returnView));
$('#form-back').addEventListener('click', () => showView(returnView));
