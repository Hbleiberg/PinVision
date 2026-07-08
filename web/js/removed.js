// "Traded away" ledger: soft-removed pins, excluded from ownership matching
// but browsable at trading events ("I used to have this"). Restore and
// permanent purge live on the detail view.
import { $, esc, toast } from './util.js';
import { api, photoUrl } from './api.js';
import { onViewShow } from './app.js';
import { openDetail } from './detail.js';

function pinTitle(pin) {
  return pin.characters.length ? pin.characters.join(', ') : (pin.franchise || 'Pin');
}

async function reloadRemoved() {
  try {
    const { pins } = await api('/api/pins?status=removed');
    const list = $('#removed-list');
    $('#removed-empty').hidden = pins.length > 0;
    list.innerHTML = '';
    for (const pin of pins) {
      const cell = document.createElement('button');
      cell.className = 'pin-cell';
      cell.innerHTML = `
        ${pin.thumb_url ? `<img src="${esc(photoUrl(pin.thumb_url))}" alt="${esc(pinTitle(pin))}" loading="lazy">` : ''}
        <span class="pin-label">${esc(pinTitle(pin))}</span>
        <span class="pin-label muted">traded ${esc(pin.removed_at?.slice(0, 10) || '')}</span>
      `;
      cell.addEventListener('click', () => openDetail(pin.id, 'removed'));
      list.append(cell);
    }
  } catch (err) {
    toast(err.message, true);
  }
}

onViewShow('removed', reloadRemoved);

export {};
