import { $, $all, toast } from './util.js';
import { getToken, login } from './auth.js';
import { UNAUTHORIZED_EVENT } from './api.js';

const VIEWS = ['login', 'identify', 'collection', 'detail', 'form', 'removed'];

// Views register a callback to run each time they're shown.
const viewInitializers = {};
export function onViewShow(view, fn) {
  viewInitializers[view] = fn;
}

export function showView(name) {
  for (const v of VIEWS) {
    $(`#view-${v}`).hidden = v !== name;
  }
  const tabbar = $('#tabbar');
  tabbar.hidden = name === 'login';
  for (const tab of $all('#tabbar .tab')) {
    tab.classList.toggle('active', tab.dataset.view === name);
  }
  window.scrollTo(0, 0);
  viewInitializers[name]?.();
}

function initLogin() {
  $('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#login-error');
    errEl.hidden = true;
    try {
      await login($('#login-passphrase').value);
      $('#login-passphrase').value = '';
      showView('identify');
    } catch (err) {
      errEl.textContent = err.message;
      errEl.hidden = false;
    }
  });
}

function initTabs() {
  for (const tab of $all('#tabbar .tab')) {
    tab.addEventListener('click', () => showView(tab.dataset.view));
  }
}

async function boot() {
  initLogin();
  initTabs();

  window.addEventListener(UNAUTHORIZED_EVENT, () => {
    toast('Please log in again', true);
    showView('login');
  });

  // Feature modules register their views; loaded lazily so a syntax error in
  // one module doesn't take down login.
  await Promise.all([
    import('./identify.js').catch((e) => console.error('identify module', e)),
    import('./collection.js').catch((e) => console.error('collection module', e)),
    import('./removed.js').catch((e) => console.error('removed module', e)),
  ]);

  showView(getToken() ? 'identify' : 'login');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
