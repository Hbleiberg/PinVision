import { checkPassphrase, issueToken, verifyToken } from './auth.js';
import { handlePinsList, handlePinCreate, handlePinGet, handlePinPatch, handlePinDelete } from './routes/pins.js';
import { handlePhoto } from './routes/photo.js';
import { handleIdentify } from './routes/identify.js';

function corsHeaders(env, origin) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const headers = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Max-Age': '86400',
  };
  if (origin && allowed.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}

export function errorResponse(message, status) {
  return json({ error: message }, status);
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;

  if (method === 'POST' && pathname === '/api/auth') {
    let body;
    try {
      body = await request.json();
    } catch {
      return errorResponse('Invalid JSON body', 400);
    }
    if (await checkPassphrase(body.passphrase, env.PASSPHRASE_HASH)) {
      return json({ token: await issueToken(env.SESSION_SECRET) });
    }
    return errorResponse('Invalid passphrase', 401);
  }

  // Photo route authenticates via signed query params (img tags can't send headers)
  const photoMatch = pathname.match(/^\/api\/photo\/(.+)$/);
  if (method === 'GET' && photoMatch) {
    return handlePhoto(decodeURIComponent(photoMatch[1]), url.searchParams, env);
  }

  // Everything else under /api requires a valid Bearer token
  const authHeader = request.headers.get('Authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !(await verifyToken(token, env.SESSION_SECRET))) {
    return errorResponse('Unauthorized', 401);
  }

  if (method === 'POST' && pathname === '/api/identify') return handleIdentify(request, env);
  if (method === 'GET' && pathname === '/api/pins') return handlePinsList(url.searchParams, env);
  if (method === 'POST' && pathname === '/api/pins') return handlePinCreate(request, env);

  const pinMatch = pathname.match(/^\/api\/pins\/([A-Za-z0-9_-]+)$/);
  if (pinMatch) {
    const id = pinMatch[1];
    if (method === 'GET') return handlePinGet(id, env);
    if (method === 'PATCH') return handlePinPatch(id, request, env);
    if (method === 'DELETE') return handlePinDelete(id, url.searchParams, env);
  }

  return errorResponse('Not found', 404);
}

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const cors = corsHeaders(env, origin);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }

    let response;
    try {
      response = await route(request, env, ctx);
    } catch (err) {
      console.error('Unhandled error:', err.stack || err);
      response = errorResponse('Internal error', 500);
    }

    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(response.body, { status: response.status, headers });
  },
};
