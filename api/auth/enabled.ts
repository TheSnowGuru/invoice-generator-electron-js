import { jsonResponse } from '../_lib/http.js';

/** Public: tells the SPA that server-side auth is available (no secrets). */
export default function handler(request: Request): Response {
  try {
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
    }
    return jsonResponse({ enabled: true });
  } catch (e) {
    console.error('enabled handler error', e);
    return jsonResponse({
      enabled: false,
      error: 'Server error',
      hint: e instanceof Error ? e.message : undefined,
    }, { status: 500 });
  }
}
