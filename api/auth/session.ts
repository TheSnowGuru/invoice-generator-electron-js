import { COOKIE_NAME, verifySessionToken } from '../_lib/session';
import { getCookie, jsonResponse } from '../_lib/http';

export default function handler(request: Request): Response {
  if (request.method !== 'GET') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET' } });
  }
  const token = getCookie(request, COOKIE_NAME);
  if (!verifySessionToken(token)) {
    return jsonResponse({ authenticated: false }, { status: 401 });
  }
  return jsonResponse({ authenticated: true });
}
