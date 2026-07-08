import { API_BASE } from './config.js';
import { getToken, clearToken } from './auth.js';
import { isDemo, demoApi } from './demo.js';

// Fired when the API returns 401 so the app can drop back to the login view.
export const UNAUTHORIZED_EVENT = 'pinvault:unauthorized';

export async function api(path, opts = {}) {
  // In demo mode every request is served by the in-memory fake API.
  if (isDemo()) return demoApi(path, opts);

  const { method = 'GET', body } = opts;
  const headers = { Authorization: `Bearer ${getToken()}` };
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: payload });

  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
    throw new Error('Session expired — please log in again');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export function photoUrl(signedPath) {
  // Demo pins (and pins added during the demo) carry data: URIs directly.
  if (typeof signedPath === 'string' && signedPath.startsWith('data:')) return signedPath;
  return `${API_BASE}${signedPath}`;
}
