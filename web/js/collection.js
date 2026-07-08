import { $, esc, toast } from './util.js';
import { api, photoUrl } from './api.js';
import { onViewShow, showView } from './app.js';
import { openDetail } from './detail.js';
import { openAddForm } from './form.js';

let allPins = [];
let filters = { q: '', character: '', franchise: '', maker: '', series: '' };

function pinTitle(pin) {
  return pin.characters.length ? pin.characters.join(', ') : (pin.franchise || 'Pin');
}

function applyFilters(pins) {
  const q = filters.q.toLowerCase();
  return pins.filter((p) => {
    if (filters.character && !p.characters.includes(filters.character)) return false;
    if (filters.franchise && p.franchise !== filters.franchise) return false;
    if (filters.maker && p.maker !== filters.maker) return false;
    if (filters.series && p.series_or_event !== filters.series) return false;
    if (q) {
      const hay = [
        ...p.characters, p.franchise, p.maker, p.pose_description, p.pin_shape,
        ...p.dominant_colors, p.text_on_pin, p.series_or_event,
        p.canonical_description, p.notes,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function fillSelect(selectEl, values, placeholder) {
  const current = selectEl.value;
  selectEl.innerHTML = `<option value="">${esc(placeholder)}</option>` +
    values.map((v) => `<option value="${esc(v)}">${esc(v)}</option>`).join('');
  if (values.includes(current)) selectEl.value = current;
}

function refreshFilterOptions() {
  const uniq = (vals) => [...new Set(vals.filter(Boolean))].sort((a, b) => a.localeCompare(b));
  fillSelect($('#filter-character'), uniq(allPins.flatMap((p) => p.characters)), 'Character');
  fillSelect($('#filter-franchise'), uniq(allPins.map((p) => p.franchise)), 'Franchise');
  fillSelect($('#filter-maker'), uniq(allPins.map((p) => p.maker)), 'Maker');
  fillSelect($('#filter-series'), uniq(allPins.map((p) => p.series_or_event)), 'Series');
}

export function renderPinCell(pin) {
  const btn = document.createElement('button');
  btn.className = 'pin-cell';
  btn.innerHTML = `
    ${pin.thumb_url ? `<img src="${esc(photoUrl(pin.thumb_url))}" alt="${esc(pinTitle(pin))}" loading="lazy">` : ''}
    <span class="pin-label">${esc(pinTitle(pin))}</span>
  `;
  return btn;
}

function renderGrid() {
  const grid = $('#pin-grid');
  const visible = applyFilters(allPins);
  $('#collection-count').textContent = visible.length ? `${visible.length} pins` : '';
  $('#collection-empty').hidden = allPins.length > 0;
  grid.innerHTML = '';
  for (const pin of visible) {
    const cell = renderPinCell(pin);
    cell.addEventListener('click', () => openDetail(pin.id, 'collection'));
    grid.append(cell);
  }
}

export async function reloadCollection() {
  try {
    const { pins } = await api('/api/pins?status=owned');
    allPins = pins;
    refreshFilterOptions();
    renderGrid();
  } catch (err) {
    toast(err.message, true);
  }
}

function initOnce() {
  $('#search-input').addEventListener('input', (e) => {
    filters.q = e.target.value.trim();
    renderGrid();
  });
  const selects = [
    ['#filter-character', 'character'],
    ['#filter-franchise', 'franchise'],
    ['#filter-maker', 'maker'],
    ['#filter-series', 'series'],
  ];
  for (const [sel, key] of selects) {
    $(sel).addEventListener('change', (e) => {
      filters[key] = e.target.value;
      renderGrid();
    });
  }

  // Manual add path from the collection view.
  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-ghost';
  addBtn.textContent = '+ Add';
  addBtn.style.marginLeft = 'auto';
  addBtn.addEventListener('click', () => openAddForm({ onSaved: () => showView('collection') }));
  $('#view-collection .topbar').append(addBtn);
}

initOnce();
onViewShow('collection', reloadCollection);
