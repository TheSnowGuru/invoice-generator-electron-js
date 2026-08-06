import { clearSessionCookieHeader } from '../_lib/session';
import { jsonResponse } from '../_lib/http';

export default function handler(request: Request): Response {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'POST' } });
  }
  return jsonResponse({ ok: true }, {
    headers: { 'Set-Cookie': clearSessionCookieHeader() },
  });
}
