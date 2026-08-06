import { getAuthConfigStatus } from '../_lib/password.js';
import { jsonResponse } from '../_lib/http.js';

/** Public diagnostics (no secrets). Use when login fails. */
export default function handler(request: Request): Response {
  try {
    if (request.method !== 'GET') {
      return jsonResponse({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, {
        status: 405,
        headers: { Allow: 'GET' },
      });
    }
    const status = getAuthConfigStatus();
    return jsonResponse({
      ok: status.canAuthenticate,
      ...status,
    });
  } catch (e) {
    console.error('status handler error', e);
    return jsonResponse({
      ok: false,
      error: 'Could not read auth status',
      code: 'SERVER_ERROR',
      hint: e instanceof Error ? e.message : undefined,
    }, { status: 500 });
  }
}
