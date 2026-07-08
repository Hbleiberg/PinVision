// Escape user/model-derived text before inserting into HTML strings.
// Every innerHTML write in the app goes through esc() for dynamic values.
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $all(selector, root = document) {
  return [...root.querySelectorAll(selector)];
}

let toastTimer = null;
export function toast(message, isError = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = isError ? 'toast-error' : '';
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

export function confirmDialog(message, confirmLabel = 'Confirm', danger = false) {
  return new Promise((resolve) => {
    const dlg = document.createElement('dialog');
    const p = document.createElement('p');
    p.textContent = message;
    const row = document.createElement('div');
    row.className = 'button-row';
    const cancel = document.createElement('button');
    cancel.className = 'btn';
    cancel.textContent = 'Cancel';
    const ok = document.createElement('button');
    ok.className = danger ? 'btn btn-danger' : 'btn btn-primary';
    ok.textContent = confirmLabel;
    row.append(cancel, ok);
    dlg.append(p, row);
    document.body.append(dlg);
    dlg.showModal();
    const done = (result) => { dlg.close(); dlg.remove(); resolve(result); };
    cancel.addEventListener('click', () => done(false));
    ok.addEventListener('click', () => done(true));
    dlg.addEventListener('cancel', () => done(false));
  });
}
