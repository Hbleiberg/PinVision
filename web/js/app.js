import { $, $all, toast } from './util.js';
import { getToken, login } from './auth.js';
import { UNAUTHORIZED_EVENT } from './api.js';
import { isDemo, enterDemo, exitDemo } from './demo.js';

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

function updateDemoChrome() {
  const on = isDemo();
  document.body.classList.toggle('demo', on);
  $('#demo-banner').hidden = !on;
}

function initDemo() {
  $('#demo-enter').addEventListener('click', () => {
    enterDemo();
    history.replaceState(null, '', '#demo');
    updateDemoChrome();
    showView('identify');
    toast('Demo mode — this is sample data');
  });
  $('#demo-exit').addEventListener('click', () => {
    exitDemo();
    history.replaceState(null, '', location.pathname);
    updateDemoChrome();
    showView('login');
  });
}

async function boot() {
  initLogin();
  initTabs();
  initDemo();

  // A shareable #demo link drops straight into demo mode.
  if (location.hash.replace('#', '') === 'demo') enterDemo();
  updateDemoChrome();

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

  showView(isDemo() || getToken() ? 'identify' : 'login');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

boot();
