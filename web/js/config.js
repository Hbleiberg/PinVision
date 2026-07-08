// Deployment configuration. Bump VERSION on every deploy — the service worker
// uses it to invalidate the offline shell cache.
export const VERSION = '0.1.0';

// The Worker API origin. Replace with your workers.dev subdomain (or custom
// domain) after the first `wrangler deploy`.
export const API_BASE = 'https://pinvault-api.YOUR_SUBDOMAIN.workers.dev';
